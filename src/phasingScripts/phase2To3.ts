console.info('Generate HTML pages from the untracked Phase2 JSON files');

import fs from 'node:fs';
import path from 'node:path';
import type { Chapter, EnglishInsertion, EnglishWordInfo, Snippet } from './phase1To2/phase2Types';
import { makeHtmlBase } from './phase2To3/makeHtmlBase';
import ancientDocNames from './phase1To2/ancientDocNames.json';

const scriptTag = `<script src="/js/servewell-app-shell.js"></script>`;
const USE_SHARED_WORD_POPOVER = true;
const SHARED_WORD_POPOVER_ID = 'word-popover-shared';
const COLUMN_VISIBILITY_STORAGE_KEY = 'servewell-visible-columns';

const METADATA_LABEL_TO_KEY: Record<string, string> = {
  Pane: 'p',
  Snippet: 'sn',
  'Word Position': 'wp',
  'Morpheme Gloss': 'mg',
  'Segment In Morpheme': 'sim',
  'Segments In Morpheme': 'smc',
  'Morpheme ID': 'mid',
  'Original Script': 'os',
  Transliteration: 'tr',
  'Grammar Code': 'gc',
  Grammar: 'gr',
  'Grammar Function': 'gf',
  Language: 'lg',
  "Strong's Root": 'sr',
  'Root Script': 'rs',
  'Root Translation': 'rt',
  Source: 'src',
  'Source Token': 'stok',
  'Token Segment': 'tseg',
  "Strong's ID": 'sid',
  'Original Morpheme ID': 'omid'
};

const METADATA_KEY_TO_LABEL = Object.fromEntries(
  Object.entries(METADATA_LABEL_TO_KEY).map(([label, key]) => [key, label])
) as Record<string, string>;

const baseDistDir = 'public/-/';
const baseSrcDir = 'src/json-Phase2/docs';

type MetadataValue = string | number | undefined;

interface MetadataEntry {
  label: string;
  value: MetadataValue;
}

interface RenderableTokenPart {
  text: string;
  html: string;
}

type TraditionalParagraphToken =
  | {
      kind: 'word';
      text: string;
      wordOrdinal: number;
      strongsId?: string;
      originalMorphemeId?: string;
      resolvedOriginalMorphemeIds?: string[];
      originalToken?: string;
      tokenSegmentOrdinal?: number;
      tokenSegmentCount?: number;
    }
  | {
      kind: 'text';
      text: string;
    }
  | {
      kind: 'footnote';
      text: string;
    };

await resetDir(baseDistDir);

// ---- bible-nav data --------------------------------------------------------

// Sections: each inner array is one visual group (no visible label). Defined here at build time.
const BIBLE_NAV_SECTIONS: string[][] = [
  ['Gen','Exo','Lev','Num','Deu'],
  ['Jos','Jdg','Rut','1Sa','2Sa','1Ki','2Ki','1Ch','2Ch','Ezr','Neh','Est'],
  ['Job','Psa','Pro','Ecc','Sng'],
  ['Isa','Jer','Lam','Ezk','Dan'],
  ['Hos','Jol','Amo','Oba','Jon','Mic','Nam','Hab','Zep','Hag','Zec','Mal'],
  ['Mat','Mrk','Luk','Jhn','Act'],
  ['Rom','1Co','2Co','Gal','Eph','Php','Col','1Th','2Th'],
  ['1Ti','2Ti','Tit','Phm'],
  ['Heb','Jas','1Pe','2Pe','1Jn','2Jn','3Jn','Jud','Rev'],
];

// Display abbreviation overrides: abbr2 → user-facing display abbreviation.
const DISPLAY_ABBR_OVERRIDES: Record<string, string> = {
  'Jud': 'Jde', // Jude — 'Jud' too easily confused with Judges
};

type BibleNavBook = { abbr: string; displayAbbr: string; name: string; url: string; chapters: number };
type BibleNavData = { books: BibleNavBook[]; sections: string[][] };

function buildBibleNavDataJson(
  chapterCounts: Map<string, number>,
  urlPaths: Map<string, string>
): string {
  const canonicalBooks = ancientDocNames.filter(d => {
    const num = parseInt(d.numPlusAbbr2.split('-')[0], 10);
    return num >= 1 && num <= 66;
  });
  const books: BibleNavBook[] = canonicalBooks
    .map(d => ({
      abbr: d.abbr2,
      displayAbbr: DISPLAY_ABBR_OVERRIDES[d.abbr2] ?? d.abbr2,
      name: d.name,
      url: urlPaths.get(d.abbr2) ?? safePathPart(d.name),
      chapters: chapterCounts.get(d.abbr2) ?? 0,
    }))
    .filter(b => b.chapters > 0);
  const data: BibleNavData = { books, sections: BIBLE_NAV_SECTIONS };
  return JSON.stringify(data);
}

// ---- end bible-nav data ----------------------------------------------------
await writeLegacyHeyPage();

const chapterFilePaths = listChapterFilePaths(baseSrcDir);

// First pass: collect chapter counts and URL paths per book abbreviation.
const bookChapterCounts = new Map<string, number>();
const bookUrlPaths = new Map<string, string>();
const chapterPayloads: Array<{ chapter: Chapter; bookDirName: string; chapterNumber: string }> = [];
for (const chapterFilePath of chapterFilePaths) {
  const chapter = readChapterPayload(chapterFilePath);
  if (!chapter) continue;
  const abbr = chapter.DocOrBookAbbreviation;
  const bookDirName = safePathPart(chapter.DocumentOrBook || abbr || 'Unknown');
  const chapterNumber = Number.isFinite(chapter.ChapterNumber)
    ? chapter.ChapterNumber.toString()
    : extractChapterNumberFromPath(chapterFilePath);
  const n = typeof chapter.ChapterNumber === 'number' ? chapter.ChapterNumber : parseInt(chapterNumber, 10);
  if ((bookChapterCounts.get(abbr) ?? 0) < n) bookChapterCounts.set(abbr, n);
  if (!bookUrlPaths.has(abbr)) bookUrlPaths.set(abbr, bookDirName);
  chapterPayloads.push({ chapter, bookDirName, chapterNumber });
}

const bibleNavDataJson = buildBibleNavDataJson(bookChapterCounts, bookUrlPaths);

let renderedChapters = 0;
for (let i = 0; i < chapterPayloads.length; i++) {
  const { chapter, bookDirName, chapterNumber } = chapterPayloads[i];
  const prevPayload = i > 0 ? chapterPayloads[i - 1] : undefined;
  const nextPayload = i < chapterPayloads.length - 1 ? chapterPayloads[i + 1] : undefined;

  const prevInfo: AdjacentChapterInfo | undefined =
    prevPayload && prevPayload.chapter.SnippetsAndExplanations.length > 0
      ? {
          label: `${prevPayload.chapter.DocumentOrBook} ${prevPayload.chapterNumber}`,
          url: `/-/${prevPayload.bookDirName}/${prevPayload.chapterNumber}`,
          snippet: prevPayload.chapter.SnippetsAndExplanations[prevPayload.chapter.SnippetsAndExplanations.length - 1]
        }
      : undefined;

  const nextInfo: AdjacentChapterInfo | undefined =
    nextPayload && nextPayload.chapter.SnippetsAndExplanations.length > 0
      ? {
          label: `${nextPayload.chapter.DocumentOrBook} ${nextPayload.chapterNumber}`,
          url: `/-/${nextPayload.bookDirName}/${nextPayload.chapterNumber}`,
          snippet: nextPayload.chapter.SnippetsAndExplanations[0]
        }
      : undefined;

  const outputDir = path.join(baseDistDir, bookDirName);
  await fs.promises.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${chapterNumber}.html`);
  await fs.promises.writeFile(outputPath, renderChapterPage(chapter, bibleNavDataJson, prevInfo, nextInfo), { encoding: 'utf8' });
  renderedChapters += 1;
}

console.info(`Rendered ${renderedChapters} chapter pages from ${chapterFilePaths.length} source files`);

async function writeLegacyHeyPage() {
  const html = makeHtmlBase('hey', 'This is a description of the hey page');
  const heyHtml = [
    ...html.topOfHead,
    ...html.headToBody,
    `<div id="app"></div>`,
    scriptTag,
    ...html.bottom
  ].join('\n');

  await fs.promises.writeFile(path.join(baseDistDir, 'hey.html'), heyHtml, { encoding: 'utf8' });
}

async function resetDir(dir: string) {
  await fs.promises.rm(dir, { recursive: true, force: true }).catch((err) => {
    console.error(`Error deleting directory ${dir}:`, err);
  });
  await fs.promises.mkdir(dir, { recursive: true }).catch((err) => {
    console.error(`Error recreating directory ${dir}:`, err);
  });
  console.log(`Directory ${dir} has been reset`);
}

function listChapterFilePaths(rootDir: string): string[] {
  const docDirs = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const chapterPaths: string[] = [];
  for (const docDir of docDirs) {
    const absoluteDocDir = path.join(rootDir, docDir);
    const chapterFiles = fs
      .readdirSync(absoluteDocDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const chapterFile of chapterFiles) {
      chapterPaths.push(path.join(absoluteDocDir, chapterFile));
    }
  }

  return chapterPaths;
}

function readChapterPayload(chapterFilePath: string): Chapter | null {
  try {
    const rawFile = fs.readFileSync(chapterFilePath, { encoding: 'utf8' });
    const parsed = JSON.parse(rawFile) as unknown;
    const resolved = resolveChapterPayload(parsed);
    if (resolved) return resolved;

    console.warn(`Skipping ${chapterFilePath}: file does not match expected chapter schema`);
    return null;
  } catch (error) {
    console.warn(`Skipping ${chapterFilePath}: ${(error as Error).message}`);
    return null;
  }
}

function resolveChapterPayload(rawPayload: unknown): Chapter | null {
  if (!isRecord(rawPayload)) return null;

  const nestedDefault = rawPayload.default;
  const candidate = isRecord(nestedDefault) ? nestedDefault : rawPayload;
  if (!isRecord(candidate)) return null;

  const chapterNumberRaw = candidate.ChapterNumber;
  const chapterNumber =
    typeof chapterNumberRaw === 'number'
      ? chapterNumberRaw
      : typeof chapterNumberRaw === 'string'
        ? Number.parseInt(chapterNumberRaw, 10)
        : Number.NaN;

  if (!Number.isFinite(chapterNumber)) return null;
  const snippets = candidate.SnippetsAndExplanations;
  if (!Array.isArray(snippets)) return null;

  return {
    DocumentOrBook: asString(candidate.DocumentOrBook, 'Unknown'),
    DocOrBookAbbreviation: asString(candidate.DocOrBookAbbreviation, 'UNK'),
    PaddedNumWithDocAbbr: asString(candidate.PaddedNumWithDocAbbr, '00-UNK'),
    ChapterNumber: chapterNumber,
    PaddedChapterNumber: asString(candidate.PaddedChapterNumber, `UNK${chapterNumber.toString().padStart(3, '0')}`),
    ChapterId: asString(candidate.ChapterId, `UNK${chapterNumber}`),
    NumPrecedingVersesToInclude: asNumber(candidate.NumPrecedingVersesToInclude, 0),
    SnippetsAndExplanations: snippets as Snippet[],
    NumFollowingVersesToInclude: asNumber(candidate.NumFollowingVersesToInclude, 0)
  };
}

interface AdjacentChapterInfo {
  label: string;
  url: string;
  snippet: Snippet;
}

// Sections: each inner array is one visual group (no visible label). Defined here at build time.
function renderChapterPage(
  chapter: Chapter,
  bibleNavDataJson: string,
  prevInfo?: AdjacentChapterInfo,
  nextInfo?: AdjacentChapterInfo
): string {
  const title = `${chapter.DocumentOrBook} ${chapter.ChapterNumber}`;
  const description = `First-pass literal and traditional view for ${title}`;
  const baseHtml = makeHtmlBase(title, description);

  const snippetRows = chapter.SnippetsAndExplanations.map((snippet) => renderSnippetRow(snippet)).join('\n');

  // Split headToBody so we can insert the top chapter nav before the h1.
  // makeHtmlBase always ends headToBody with the <h1> line.
  const headToBodyLines = baseHtml.headToBody;
  const h1Line = headToBodyLines[headToBodyLines.length - 1];
  const headToBodyBeforeH1 = headToBodyLines.slice(0, -1);

  return [
    ...baseHtml.topOfHead,
    ...getChapterPageCss(),
    ...headToBodyBeforeH1,
    prevInfo ? renderChapterNavHeader(prevInfo, nextInfo) : '',
    h1Line,
    `<script id="bible-nav-data" type="application/json">${bibleNavDataJson}</script>`,
    `<main class="chapter-page" data-book="${escapeHtml(chapter.DocOrBookAbbreviation)}" data-chapter="${chapter.ChapterNumber}">`,
    `<div class="snippet-grid-header" role="group" aria-label="Column visibility">`,
    `<label class="snippet-grid-header-card" for="column-toggle-literal">`,
    `<input type="checkbox" id="column-toggle-literal" data-column-toggle="literal" />`,
    `<span class="snippet-grid-header-text">LITERAL</span>`,
    `</label>`,
    `<label class="snippet-grid-header-card" for="column-toggle-traditional">`,
    `<input type="checkbox" id="column-toggle-traditional" data-column-toggle="traditional" />`,
    `<span class="snippet-grid-header-text">TRADITIONAL</span>`,
    `</label>`,
    `</div>`,
    `<p class="snippet-grid-empty-message" data-column-empty-message hidden>Select a column header to see its column.</p>`,
    `<section class="snippet-grid">`,
    snippetRows,
    `</section>`,
    USE_SHARED_WORD_POPOVER ? renderSharedWordPopover() : '',
    nextInfo ? renderChapterNavFooter(nextInfo) : '',
    `</main>`,
    renderColumnVisibilityScript(),
    USE_SHARED_WORD_POPOVER ? renderSharedWordPopoverScript() : '',
    scriptTag,
    ...baseHtml.bottom
  ].join('\n');
}

function renderChapterNavHeader(prevInfo: AdjacentChapterInfo, nextInfo?: AdjacentChapterInfo): string {
  const prevHref = escapeHtmlAttribute(prevInfo.url);
  const prevLabel = escapeHtml(prevInfo.label);
  const nextArrow = nextInfo
    ? `<a href="${escapeHtmlAttribute(nextInfo.url)}" class="chapter-nav-next-arrow" aria-label="Next chapter: ${escapeHtml(nextInfo.label)}">&#8594;</a>`
    : '';
  return [
    `<div class="chapter-nav-header">`,
    `<div class="chapter-nav-header-row">`,
    `<a href="${prevHref}" class="chapter-nav-prev-link">&#8592; ${prevLabel}</a>`,
    nextArrow,
    `</div>`,
    `<div class="chapter-nav-prev-preview snippet-grid">`,
    renderSnippetRow(prevInfo.snippet, 'prev-'),
    `</div>`,
    `</div>`
  ].join('\n');
}

function renderChapterNavFooter(nextInfo: AdjacentChapterInfo): string {
  const nextHref = escapeHtmlAttribute(nextInfo.url);
  const nextLabel = escapeHtml(nextInfo.label);
  return [
    `<div class="chapter-nav-footer">`,
    `<div class="chapter-nav-footer-row">`,
    `<a href="${nextHref}" class="chapter-nav-next-link">${nextLabel} &#8594;</a>`,
    `</div>`,
    `<div class="chapter-nav-next-preview snippet-grid">`,
    renderSnippetRow(nextInfo.snippet, 'next-'),
    `</div>`,
    `</div>`
  ].join('\n');
}

function renderSnippetRow(snippet: Snippet, idPrefix = ''): string {
  const snippetLabel = getSnippetLabel(snippet);
  const snippetId = toSafeDomId(`${idPrefix}${snippetLabel}`);

  return [
    `<article class="snippet-row" id="${snippetId}">`,
    `<div class="snippet-pane literal-pane" aria-label="Literal">`,
    renderLiteralPane(snippet, idPrefix),
    `</div>`,
    `<div class="snippet-pane traditional-pane" aria-label="Traditional">`,
    renderTraditionalPane(snippet, idPrefix),
    `</div>`,
    `</article>`
  ].join('\n');
}

function renderLiteralPane(snippet: Snippet, idPrefix = ''): string {
  const snippetLabel = getSnippetLabel(snippet);
  const snippetKey = `${idPrefix}${snippet.SnippetId || snippetLabel}`;
  const renderParts: RenderableTokenPart[] = [];
  let tokenOrdinal = 0;

  for (const morpheme of snippet.OriginalMorphemes) {
    const tokenText = normalizeTokenText(morpheme.EnglishMorphemeWithPunctuationInOriginalOrder || '');
    if (!tokenText) continue;

    const wordSegments = splitTokenIntoWords(tokenText);

    for (const [segmentIndex, segmentText] of wordSegments.entries()) {
      tokenOrdinal += 1;
      const popoverSeed = morpheme.MorphemeId
        ? `${morpheme.MorphemeId}-${segmentIndex + 1}`
        : `${snippetKey}-literal-${tokenOrdinal}`;
      const popoverId = `popover-${toSafeDomId(popoverSeed)}`;
      const metadataEntries: MetadataEntry[] = [
        { label: 'Pane', value: 'Literal' },
        { label: 'Morpheme ID', value: morpheme.MorphemeId },
        { label: 'Original Script', value: morpheme.OriginalMorphemeScript },
        { label: 'Transliteration', value: morpheme.OriginalMorphemeTransliteration },
        { label: 'Grammar', value: morpheme.OriginalMorphemeGrammar },
        { label: 'Language', value: morpheme.OriginalLanguage },
        { label: "Strong's Root", value: morpheme.OriginalRootStrongsID },
        { label: 'Root Script', value: morpheme.OriginalRootScript },
        { label: 'Root Translation', value: morpheme.EnglishRootTranslation },
        { label: 'Source', value: morpheme.Source }
      ];

      renderParts.push({
        text: segmentText,
        html: renderWordToken(segmentText, popoverId, metadataEntries)
      });
    }
  }

  if (renderParts.length === 0) {
    return `<p class="pane-empty">[no literal text]</p>`;
  }

  const verseNumBtn = `<button type="button" class="verse-num" aria-label="Verse ${escapeHtml(snippetLabel)}">${escapeHtml(snippetLabel)}</button>`;
  return `<div class="pane-text word-line">${verseNumBtn}${renderTokenParts(renderParts)}</div>`;
}

function renderTraditionalPane(snippet: Snippet, idPrefix = ''): string {
  const snippetLabel = getSnippetLabel(snippet);
  const snippetKey = `${idPrefix}${snippet.SnippetId || snippetLabel}`;
  const paneLines: string[] = [];
  const currentParagraphTokens: TraditionalParagraphToken[] = [];
  let traditionalWordOrdinal = 0;
  let didRenderVerseNum = false;
  const verseNumBtn = `<button type="button" class="verse-num" aria-label="Verse ${escapeHtml(snippetLabel)}">${escapeHtml(snippetLabel)}</button>`;

  const literalMetaByMorphemeId = new Map<string, MetadataEntry[]>();
  for (const morpheme of snippet.OriginalMorphemes) {
    if (!morpheme.MorphemeId) continue;
    literalMetaByMorphemeId.set(morpheme.MorphemeId, [
      { label: 'Morpheme ID', value: morpheme.MorphemeId },
      { label: 'Original Script', value: morpheme.OriginalMorphemeScript },
      { label: 'Transliteration', value: morpheme.OriginalMorphemeTransliteration },
      { label: 'Grammar', value: morpheme.OriginalMorphemeGrammar },
      { label: 'Language', value: morpheme.OriginalLanguage },
      { label: "Strong's Root", value: morpheme.OriginalRootStrongsID },
      { label: 'Root Script', value: morpheme.OriginalRootScript },
      { label: 'Root Translation', value: morpheme.EnglishRootTranslation },
      { label: 'Source', value: morpheme.Source }
    ]);
  }

  const flushParagraph = () => {
    const paragraphHasWords = currentParagraphTokens.some((token) => token.kind === 'word');
    const paragraph = renderTraditionalParagraphTokens(
      currentParagraphTokens,
      snippetLabel,
      snippetKey,
      literalMetaByMorphemeId,
      didRenderVerseNum ? undefined : verseNumBtn
    );
    currentParagraphTokens.length = 0;
    if (paragraph) {
      paneLines.push(`<div class="traditional-paragraph word-line">${paragraph}</div>`);
      if (paragraphHasWords && !didRenderVerseNum) {
        didRenderVerseNum = true;
      }
    }
  };

  for (const item of snippet.EnglishHeadingsAndWords) {
    if (isEnglishWord(item)) {
      const token = normalizeTraditionalText(item.EnglishWord);
      if (token) {
        const wordSegments = splitTokenIntoWords(token);

        for (const [segmentIndex, segmentText] of wordSegments.entries()) {
          traditionalWordOrdinal += 1;
          currentParagraphTokens.push({
            kind: 'word',
            text: segmentText,
            wordOrdinal: traditionalWordOrdinal,
            strongsId: item.StrongsId,
            originalMorphemeId: item.OriginalMorphemeId,
            resolvedOriginalMorphemeIds: item.ResolvedOriginalMorphemeIds,
            originalToken: wordSegments.length > 1 ? token : undefined,
            tokenSegmentOrdinal: wordSegments.length > 1 ? segmentIndex + 1 : undefined,
            tokenSegmentCount: wordSegments.length > 1 ? wordSegments.length : undefined
          });
        }
      }
      continue;
    }

    if (!isInsertion(item)) continue;
    const text = item.Text || '';

    switch (item.InsertionType) {
      case 'Heading':
        flushParagraph();
        if (text.trim()) {
          paneLines.push(`<p class="traditional-heading">${escapeHtml(text.trim())}</p>`);
        }
        break;
      case 'Cross Ref.':
        flushParagraph();
        if (text.trim()) {
          paneLines.push(`<p class="traditional-crossref">${sanitizeRichHtml(text, true)}</p>`);
        }
        break;
      case 'Paragraph Start':
        flushParagraph();
        break;
      case 'Space':
      case 'End Text':
        if (text) {
          currentParagraphTokens.push({ kind: 'text', text });
        }
        break;
      case 'Footnotes':
        if (text.trim()) {
          currentParagraphTokens.push({ kind: 'footnote', text });
        }
        break;
      default:
        break;
    }
  }

  flushParagraph();

  if (paneLines.length === 0) {
    return `<p class="pane-empty">[no traditional text]</p>`;
  }

  if (!didRenderVerseNum) {
    paneLines.push(`<div class="traditional-paragraph word-line">${verseNumBtn}</div>`);
  }

  return paneLines.join('\n');
}

function renderTraditionalParagraphTokens(
  tokens: TraditionalParagraphToken[],
  snippetLabel: string,
  snippetKey: string,
  literalMetaByMorphemeId: Map<string, MetadataEntry[]>,
  leadingHtmlBeforeFirstWord?: string
): string {
  let html = '';
  let plainText = '';
  let didInsertLeadingHtml = false;
  let suppressSpacingBeforeNextToken = false;

  const appendTokenHtml = (tokenText: string, tokenHtml: string) => {
    const normalizedText = normalizeTokenText(tokenText);
    if (!normalizedText) return;

    if (!suppressSpacingBeforeNextToken && plainText && shouldInsertSpaceBeforeToken(normalizedText, plainText)) {
      html += ' ';
      plainText += ' ';
    }

    html += tokenHtml;
    plainText += normalizedText;
    suppressSpacingBeforeNextToken = false;
  };

  const insertLeadingHtmlBeforeFirstWord = () => {
    if (!leadingHtmlBeforeFirstWord || didInsertLeadingHtml) return;

    if (plainText && shouldInsertSpaceBeforeToken(snippetLabel, plainText)) {
      html += ' ';
      plainText += ' ';
    }

    html += leadingHtmlBeforeFirstWord;
    didInsertLeadingHtml = true;
    suppressSpacingBeforeNextToken = true;
  };

  let footnoteIndex = 0;
  for (const token of tokens) {
    if (token.kind === 'text') {
      const plainText = normalizeTokenText(token.text);
      if (!plainText) continue;

      appendTokenHtml(plainText, escapeHtml(plainText));
      continue;
    }

    if (token.kind === 'footnote') {
      if (token.text.trim()) {
        const footnoteId = `fn-${toSafeDomId(snippetKey)}-${footnoteIndex++}`;
        const fnBtn = renderFootnoteMarker(token.text, footnoteId);
        const lastWordWrapIdx = html.lastIndexOf('<span class="word-wrap">');
        if (lastWordWrapIdx >= 0) {
          html = html.slice(0, lastWordWrapIdx) + '<span class="fn-anchor">' + html.slice(lastWordWrapIdx) + fnBtn + '</span>';
        } else {
          html += fnBtn;
        }
        plainText += '*';
      }
      continue;
    }

    insertLeadingHtmlBeforeFirstWord();

    const popoverId = `popover-${toSafeDomId(`${snippetKey}-traditional-${token.wordOrdinal}`)}`;
    const matchMorphemeId =
      token.resolvedOriginalMorphemeIds && token.resolvedOriginalMorphemeIds.length > 0
        ? token.resolvedOriginalMorphemeIds[0]
        : token.originalMorphemeId;
    const literalEntries = matchMorphemeId ? literalMetaByMorphemeId.get(matchMorphemeId) : undefined;
    const metadataEntries: MetadataEntry[] = literalEntries
      ? [{ label: 'Pane', value: 'Traditional' }, ...literalEntries]
      : [
          { label: 'Pane', value: 'Traditional' },
          { label: '—', value: "There's no direct match for this word in the original." }
        ];

    appendTokenHtml(token.text, renderWordToken(token.text, popoverId, metadataEntries));
  }

  return html;
}

function renderTokenParts(parts: RenderableTokenPart[]): string {
  let html = '';
  let plainText = '';

  for (const part of parts) {
    const tokenText = normalizeTokenText(part.text);
    if (!tokenText) continue;

    if (plainText && shouldInsertSpaceBeforeToken(tokenText, plainText)) {
      html += ' ';
      plainText += ' ';
    }

    html += part.html;
    plainText += tokenText;
  }

  return html;
}

function shouldInsertSpaceBeforeToken(token: string, existingText: string): boolean {
  if (/^[,.;:!?%\]\)]/.test(token)) {
    return false;
  }

  if (/[\[(]$/.test(existingText)) {
    return false;
  }

  return true;
}

function normalizeTokenText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeTraditionalText(value: string): string {
  return normalizeTokenText(value.replace(/[\[\]{}]/g, ''));
}

function splitTokenIntoWords(tokenText: string): string[] {
  const normalized = normalizeTokenText(tokenText);
  if (!normalized) return [];
  return normalized.split(' ').filter((segment) => segment.length > 0);
}

function renderWordToken(displayText: string, popoverId: string, metadataEntries: MetadataEntry[]): string {
  const escapedDisplayText = escapeHtml(displayText);
  const escapedDisplayTextAttribute = escapeHtmlAttribute(displayText);

  if (USE_SHARED_WORD_POPOVER) {
    const escapedSharedPopoverId = escapeHtmlAttribute(SHARED_WORD_POPOVER_ID);
    const encodedMetadata = escapeHtmlAttribute(serializeMetadataEntries(metadataEntries));

    return [
      `<span class="word-wrap">`,
      `<button type="button" class="word-token" popovertarget="${escapedSharedPopoverId}" data-m="${encodedMetadata}" aria-label="Show metadata for ${escapedDisplayTextAttribute}">${escapedDisplayText}</button>`,
      `</span>`
    ].join('');
  }

  const escapedPopoverId = escapeHtmlAttribute(popoverId);

  return [
    `<span class="word-wrap">`,
    `<button type="button" class="word-token" popovertarget="${escapedPopoverId}" aria-label="Show metadata for ${escapedDisplayTextAttribute}">${escapedDisplayText}</button>`,
    `<span id="${escapedPopoverId}" class="word-popover" popover="auto">`,
    `<span class="word-popover-header">`,
    `<strong class="word-popover-title">${escapedDisplayText}</strong>`,
    `<button type="button" class="popover-close" popovertarget="${escapedPopoverId}" popovertargetaction="hide">Close</button>`,
    `</span>`,
    renderWordMetadata(metadataEntries),
    `</span>`,
    `</span>`
  ].join('');
}

function renderWordMetadata(metadataEntries: MetadataEntry[]): string {
  const rows = metadataEntries
    .map(({ label, value }) => ({ label, value: value === undefined ? '' : String(value).trim() }))
    .filter(({ value }) => value.length > 0)
    .map(
      ({ label, value }) =>
        `<span class="word-meta-row"><span class="word-meta-label">${escapeHtml(label)}</span><span class="word-meta-value">${escapeHtml(value)}</span></span>`
    )
    .join('');

  if (!rows) {
    return `<span class="word-meta-empty">No metadata available for this word.</span>`;
  }

  return `<span class="word-meta-list">${rows}</span>`;
}

function renderFootnoteMarker(footnoteRichHtml: string, footnoteId: string): string {
  const escapedId = escapeHtmlAttribute(footnoteId);
  const sanitizedBody = sanitizeRichHtml(footnoteRichHtml, false);
  return [
    `<button type="button" class="footnote-marker" popovertarget="${escapedId}" aria-label="Footnote">*</button>`,
    `<span id="${escapedId}" class="footnote-popover" popover="auto">`,
    `<span class="footnote-popover-header">`,
    `<span class="footnote-popover-label">Note</span>`,
    `<button type="button" class="popover-close" popovertarget="${escapedId}" popovertargetaction="hide">Close</button>`,
    `</span>`,
    `<span class="footnote-popover-body">${sanitizedBody}</span>`,
    `</span>`
  ].join('');
}

function serializeMetadataEntries(metadataEntries: MetadataEntry[]): string {
  return metadataEntries
    .map(({ label, value }) => ({ label: label.trim(), value: value === undefined ? '' : String(value).trim() }))
    .filter(({ label, value }) => label.length > 0 && value.length > 0)
    .map(({ label, value }) => {
      const compactLabel = METADATA_LABEL_TO_KEY[label] || label;
      return `${encodeURIComponent(compactLabel)}=${encodeURIComponent(value)}`;
    })
    .join('&');
}

function renderSharedWordPopover(): string {
  const escapedPopoverId = escapeHtmlAttribute(SHARED_WORD_POPOVER_ID);

  return [
    `<span id="${escapedPopoverId}" class="word-popover shared-word-popover" popover="auto">`,
    `<span class="word-popover-header">`,
    `<strong class="word-popover-title"></strong>`,
    `<button type="button" class="popover-close" popovertarget="${escapedPopoverId}" popovertargetaction="hide">Close</button>`,
    `</span>`,
    `<span class="word-meta-list" data-shared-word-meta></span>`,
    `<span class="word-meta-empty" data-shared-word-empty>No metadata available for this word.</span>`,
    `</span>`
  ].join('');
}

function renderSharedWordPopoverScript(): string {
  const escapedPopoverId = escapeHtmlAttribute(SHARED_WORD_POPOVER_ID);
  const compactLabelMapJson = JSON.stringify(METADATA_KEY_TO_LABEL);

  return [
    '<script>',
    '(function () {',
    `  const popover = document.getElementById('${escapedPopoverId}');`,
    `  const labelMap = ${compactLabelMapJson};`,
    '  if (!(popover instanceof HTMLElement)) return;',
    '  const title = popover.querySelector(".word-popover-title");',
    '  const metaList = popover.querySelector("[data-shared-word-meta]");',
    '  const emptyState = popover.querySelector("[data-shared-word-empty]");',
    '  if (!(title instanceof HTMLElement) || !(metaList instanceof HTMLElement) || !(emptyState instanceof HTMLElement)) return;',
    '',
    '  function decodePart(value) {',
    '    try {',
    '      return decodeURIComponent(value);',
    '    } catch (_error) {',
    '      return value;',
    '    }',
    '  }',
    '',
    '  function parseMetadata(raw) {',
    '    if (!raw) return [];',
    '    return raw',
    '      .split("&")',
    '      .map((pair) => {',
    '        if (!pair) return null;',
    '        const separatorIndex = pair.indexOf("=");',
    '        if (separatorIndex < 0) return null;',
    '        const compactLabel = decodePart(pair.slice(0, separatorIndex));',
    '        const label = labelMap[compactLabel] || compactLabel;',
    '        const value = decodePart(pair.slice(separatorIndex + 1));',
    '        if (!label || !value) return null;',
    '        return { label, value };',
    '      })',
    '      .filter((entry) => entry !== null);',
    '  }',
    '',
    '  function renderMetadata(entries) {',
    '    metaList.textContent = "";',
    '    for (const entry of entries) {',
    '      const row = document.createElement("span");',
    '      row.className = "word-meta-row";',
    '      const label = document.createElement("span");',
    '      label.className = "word-meta-label";',
    '      label.textContent = entry.label;',
    '      const value = document.createElement("span");',
    '      value.className = "word-meta-value";',
    '      value.textContent = entry.value;',
    '      row.append(label, value);',
    '      metaList.appendChild(row);',
    '    }',
    '    emptyState.hidden = entries.length > 0;',
    '  }',
    '',
    '  document.addEventListener("click", (event) => {',
    '    const eventTarget = event.target;',
    '    if (!(eventTarget instanceof Element)) return;',
    '    const button = eventTarget.closest("button.word-token[data-m]");',
    '    if (!(button instanceof HTMLButtonElement)) return;',
    '',
    '    const displayWord = button.textContent || "";',
    '    title.textContent = displayWord;',
    '    const metadataEntries = parseMetadata(button.dataset.m || "");',
    '    renderMetadata(metadataEntries);',
    '  }, { capture: true });',
    '})();',
    '</script>'
  ].join('\n');
}

function renderColumnVisibilityScript(): string {
  const escapedStorageKey = escapeHtmlAttribute(COLUMN_VISIBILITY_STORAGE_KEY);

  return [
    '<script>',
    '(function () {',
    '  const page = document.querySelector(".chapter-page");',
    '  if (!(page instanceof HTMLElement)) return;',
    '  const literalToggle = page.querySelector(\'input[data-column-toggle="literal"]\');',
    '  const traditionalToggle = page.querySelector(\'input[data-column-toggle="traditional"]\');',
    '  const emptyMessage = page.querySelector("[data-column-empty-message]");',
    '  if (!(literalToggle instanceof HTMLInputElement) || !(traditionalToggle instanceof HTMLInputElement) || !(emptyMessage instanceof HTMLElement)) return;',
    '',
    '  function readState() {',
    '    const fallback = { literal: true, traditional: true };',
    '    try {',
    `      const raw = localStorage.getItem('${escapedStorageKey}');`,
    '      if (!raw) return fallback;',
    '      const parsed = JSON.parse(raw);',
    '      if (!parsed || typeof parsed !== "object") return fallback;',
    '      return {',
    '        literal: parsed.literal !== false,',
    '        traditional: parsed.traditional !== false',
    '      };',
    '    } catch (_error) {',
    '      return fallback;',
    '    }',
    '  }',
    '',
    '  function saveState(state) {',
    '    try {',
    `      localStorage.setItem('${escapedStorageKey}', JSON.stringify(state));`,
    '    } catch (_error) {',
    '      // Ignore storage errors (private mode, disabled storage).',
    '    }',
    '  }',
    '',
    '  function applyState(state) {',
    '    const showLiteral = !!state.literal;',
    '    const showTraditional = !!state.traditional;',
    '    literalToggle.checked = showLiteral;',
    '    traditionalToggle.checked = showTraditional;',
    '    page.classList.toggle("mode-both", showLiteral && showTraditional);',
    '    page.classList.toggle("mode-literal-only", showLiteral && !showTraditional);',
    '    page.classList.toggle("mode-traditional-only", !showLiteral && showTraditional);',
    '    page.classList.toggle("mode-none", !showLiteral && !showTraditional);',
    '    emptyMessage.hidden = showLiteral || showTraditional;',
    '  }',
    '',
    '  let state = readState();',
    '  applyState(state);',
    '',
    '  function updateFromToggles() {',
    '    state = {',
    '      literal: literalToggle.checked,',
    '      traditional: traditionalToggle.checked',
    '    };',
    '    saveState(state);',
    '    applyState(state);',
    '  }',
    '',
    '  literalToggle.addEventListener("change", updateFromToggles);',
    '  traditionalToggle.addEventListener("change", updateFromToggles);',
    '})();',
    '</script>'
  ].join('\n');
}

function sanitizeRichHtml(rawHtml: string, normalizePipes: boolean): string {
  const normalized = normalizePipes ? rawHtml.replace(/\|/g, '"') : rawHtml;
  let escaped = escapeHtml(normalized);

  escaped = escaped
    .replace(/&lt;br\s*\/?&gt;/gi, '<br />')
    .replace(/&lt;(i|em|strong|b|sup|sub)&gt;/gi, '<$1>')
    .replace(/&lt;\/(i|em|strong|b|sup|sub)&gt;/gi, '</$1>')
    .replace(/&lt;span class=&quot;cross&quot;&gt;/gi, '<span class="cross">')
    .replace(/&lt;\/span&gt;/gi, '</span>');

  escaped = escaped.replace(/&lt;a\s+href\s*=\s*&quot;([^&]*)&quot;&gt;/gi, (_fullMatch, hrefText) => {
    const safeHref = sanitizeHref(decodeHtmlEntities(hrefText));
    if (!safeHref) return '';
    return `<a href="${escapeHtmlAttribute(safeHref)}">`;
  });

  return escaped.replace(/&lt;\/a&gt;/gi, '</a>');
}

function sanitizeHref(rawHref: string): string {
  const href = rawHref.trim();
  if (!href) return '';
  if (/^\s*javascript:/i.test(href)) return '';
  if (/^https?:\/\//i.test(href)) return href;
  if (/^(\/|\.\.\/|\.\/|#)/i.test(href)) return normalizeInternalHref(href);
  return '';
}

function normalizeInternalHref(href: string): string {
  const hashIdx = href.indexOf('#');
  const pathPart = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const fragment = hashIdx >= 0 ? href.slice(hashIdx) : '';
  const cleanPath = pathPart.replace(/\.html?$/i, '');
  const capitalizedPath = cleanPath.replace(/(^|\/|-)([a-z])/g, (_, prefix, letter) => prefix + (letter as string).toUpperCase());
  return capitalizedPath + fragment;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function getSnippetLabel(snippet: Snippet): string {
  if (snippet.SnippetId?.includes(':')) {
    const label = snippet.SnippetId.split(':').pop();
    if (label) return label;
  }
  return String(snippet.SnippetNumber);
}

function toSafeDomId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function safePathPart(value: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, '-')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return cleaned || 'Unknown';
}

function extractChapterNumberFromPath(chapterPath: string): string {
  const fileName = path.basename(chapterPath, '.json');
  const numericPart = fileName.replace(/^\D+/, '');
  return numericPart ? Number.parseInt(numericPart, 10).toString() : '1';
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : fallback;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEnglishWord(entry: EnglishWordInfo | EnglishInsertion): entry is EnglishWordInfo {
  return 'EnglishWord' in entry;
}

function isInsertion(entry: EnglishWordInfo | EnglishInsertion): entry is EnglishInsertion {
  return 'InsertionType' in entry;
}

function getChapterPageCss(): string[] {
  return [
    '',
    ':root {',
    '  color-scheme: light;',
    '  --page-bg: #f4f6f9;',
    '  --page-fg: #0f172a;',
    '  --muted: #475467;',
    '  --label-bg: #f8fafc;',
    '  --label-fg: #2f4f4f;',
    '  --pane-bg: #ffffff;',
    '  --pane-fg: #0f172a;',
    '  --pane-border: #dbe3ea;',
    '  --link: #1d4ed8;',
    '  --hover-bg: #eaf2ff;',
    '  --hover-fg: #0f3b93;',
    '  --popover-bg: #ffffff;',
    '  --popover-fg: #0f172a;',
    '  --popover-border: #c7d2df;',
    '}',
    ':root[data-theme="dark"] {',
    '  color-scheme: dark;',
    '  --page-bg: #0b1220;',
    '  --page-fg: #e5edf7;',
    '  --muted: #a6b3c5;',
    '  --label-bg: #172235;',
    '  --label-fg: #d6e2f3;',
    '  --pane-bg: #101a2a;',
    '  --pane-fg: #e5edf7;',
    '  --pane-border: #2a3b52;',
    '  --link: #8ab4ff;',
    '  --hover-bg: #1b2a40;',
    '  --hover-fg: #d9e8ff;',
    '  --popover-bg: #0f1a2b;',
    '  --popover-fg: #e5edf7;',
    '  --popover-border: #3a4d68;',
    '}',
    'body {',
    '  background: var(--page-bg);',
    '  color: var(--page-fg);',
    '}',
    'a {',
    '  color: var(--link);',
    '}',
    '.chapter-page {',
    '  margin-top: 1rem;',
    '}',
    '.chapter-note {',
    '  color: var(--muted);',
    '  margin-bottom: 0.5rem;',
    '}',
    '.snippet-grid-header {',
    '  display: grid;',
    '  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);',
    '  gap: 0.65rem;',
    '  align-items: stretch;',
    '  margin-bottom: 0.35rem;',
    '}',
    '.snippet-grid-header-card {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  gap: 0.45rem;',
    '  min-width: 0;',
    '  border: 1px solid var(--pane-border);',
    '  border-radius: 0.45rem;',
    '  background: var(--pane-bg);',
    '  color: var(--label-fg);',
    '  padding: 0.3rem 0.5rem;',
    '  cursor: pointer;',
    '  user-select: none;',
    '}',
    '.snippet-grid-header-card:hover {',
    '  background: var(--hover-bg);',
    '}',
    '.snippet-grid-header-card input[type="checkbox"] {',
    '  margin: 0;',
    '  accent-color: var(--link);',
    '}',
    '.snippet-grid-header-text {',
    '  min-width: 0;',
    '  font-size: 0.78rem;',
    '  text-transform: uppercase;',
    '  letter-spacing: 0.08em;',
    '  color: var(--muted);',
    '  font-weight: 700;',
    '}',
    '.snippet-grid-empty-message {',
    '  margin: 0.25rem 0 0.55rem;',
    '  color: var(--muted);',
    '  font-style: italic;',
    '}',
    '.snippet-grid {',
    '  display: flex;',
    '  flex-direction: column;',
    '  gap: 0.55rem;',
    '}',
    '.snippet-row {',
    '  display: grid;',
    '  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);',
    '  gap: 0.65rem;',
    '  align-items: center;',
    '  padding: 0.2rem 0 0.45rem;',
    '}',
    '.snippet-row > * {',
    '  min-width: 0;',
    '}',
    '.chapter-page.mode-literal-only .snippet-row,',
    '.chapter-page.mode-traditional-only .snippet-row {',
    '  grid-template-columns: minmax(0, 1fr);',
    '}',
    '.chapter-page.mode-literal-only .traditional-pane {',
    '  display: none;',
    '}',
    '.chapter-page.mode-traditional-only .literal-pane {',
    '  display: none;',
    '}',
    '.chapter-page.mode-none .snippet-grid {',
    '  display: none;',
    '}',
    '.verse-num {',
    '  display: inline-block;',
    '  font-weight: 700;',
    '  font-size: 0.85rem;',
    '  line-height: 1;',
    '  color: var(--label-fg);',
    '  background: var(--label-bg);',
    '  border: 1px solid var(--pane-border);',
    '  border-radius: 0.35rem;',
    '  padding: 0.15rem 0.35rem;',
    '  user-select: none;',
    '  cursor: pointer;',
    '  vertical-align: middle;',
    '  margin-right: 0.3em;',
    '}',
    '.snippet-pane {',
    '  display: flex;',
    '  flex-direction: column;',
    '  justify-content: center;',
    '  border: 0;',
    '  border-radius: 0;',
    '  background: transparent;',
    '  color: var(--pane-fg);',
    '  padding: 0;',
    '}',
    '.snippet-pane:not(:first-child) {',
    '  height: 100%;',
    '  padding-left: 2%;',
    '  border-left: 1px solid rgba(128, 128, 128, 0.5);',
    '  background-clip: padding-box;',
    '}',
    '.pane-text, .traditional-paragraph, .traditional-heading, .traditional-crossref {',
    '  margin: 0.25rem 0;',
    '}',
    '.footnote-marker {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  background: transparent;',
    '  border: 0;',
    '  color: var(--muted);',
    '  cursor: pointer;',
    '  font: inherit;',
    '  font-size: 0.95em;',
    '  font-weight: 700;',
    '  line-height: 1;',
    '  min-width: 1.75rem;',
    '  min-height: 1.75rem;',
    '  padding: 0.25rem 0.2rem;',
    '  vertical-align: middle;',
    '  user-select: none;',
    '}',
    '.footnote-marker:hover {',
    '  color: var(--hover-fg);',
    '}',
    '.fn-anchor {',
    '  display: inline;',
    '  white-space: nowrap;',
    '}',
    '.footnote-popover {',
    '  max-width: min(92vw, 26rem);',
    '  border: 1px solid var(--popover-border);',
    '  border-radius: 0.6rem;',
    '  padding: 0.6rem 0.75rem;',
    '  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.22);',
    '  background: var(--popover-bg);',
    '  color: var(--popover-fg);',
    '}',
    '.footnote-popover:not(:popover-open) {',
    '  display: none;',
    '}',
    '.footnote-popover:popover-open {',
    '  display: block;',
    '}',
    '.footnote-popover::backdrop {',
    '  background: rgba(15, 23, 42, 0.25);',
    '}',
    '.footnote-popover-header {',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: space-between;',
    '  gap: 0.75rem;',
    '  margin-bottom: 0.5rem;',
    '}',
    '.footnote-popover-label {',
    '  font-weight: 600;',
    '  font-size: 0.9rem;',
    '  color: var(--muted);',
    '}',
    '.footnote-popover-body {',
    '  font-size: 0.95em;',
    '  line-height: 1.5;',
    '  color: var(--pane-fg);',
    '}',
    '.footnote-popover-body a {',
    '  color: var(--link);',
    '  text-decoration: underline;',
    '}',
    '.word-line {',
    '  line-height: 1.7;',
    '}',
    '.word-token {',
    '  display: inline;',
    '  background: transparent;',
    '  border: 0;',
    '  color: inherit;',
    '  cursor: pointer;',
    '  font: inherit;',
    '  margin: 0;',
    '  padding: 0.04rem 0.08rem;',
    '  border-radius: 0.25rem;',
    '  line-height: inherit;',
    '}',
    '.word-token:hover {',
    '  background: var(--hover-bg);',
    '  color: var(--hover-fg);',
    '}',
    '.word-token:focus-visible {',
    '  outline: 2px solid #1d4ed8;',
    '  outline-offset: 1px;',
    '}',
    '.word-popover {',
    '  max-width: min(92vw, 26rem);',
    '  border: 1px solid var(--popover-border);',
    '  border-radius: 0.6rem;',
    '  padding: 0.6rem 0.75rem;',
    '  box-shadow: 0 14px 28px rgba(15, 23, 42, 0.22);',
    '  background: var(--popover-bg);',
    '  color: var(--popover-fg);',
    '}',
    '.word-popover:not(:popover-open) {',
    '  display: none;',
    '}',
    '.word-popover:popover-open {',
    '  display: block;',
    '}',
    '.word-popover::backdrop {',
    '  background: rgba(15, 23, 42, 0.25);',
    '}',
    '.word-popover-header {',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: space-between;',
    '  gap: 0.75rem;',
    '  margin-bottom: 0.5rem;',
    '}',
    '.word-popover-title {',
    '  font-size: 1rem;',
    '}',
    '.popover-close {',
    '  border: 1px solid var(--pane-border);',
    '  border-radius: 0.35rem;',
    '  background: var(--label-bg);',
    '  color: var(--pane-fg);',
    '  cursor: pointer;',
    '  font: inherit;',
    '  font-size: 0.86rem;',
    '  padding: 0.1rem 0.5rem;',
    '}',
    '.word-meta-list {',
    '  display: block;',
    '}',
    '.word-meta-row {',
    '  display: grid;',
    '  grid-template-columns: 8rem minmax(0, 1fr);',
    '  gap: 0.3rem 0.65rem;',
    '  margin: 0.2rem 0;',
    '}',
    '.word-meta-label {',
    '  color: var(--muted);',
    '  font-weight: 600;',
    '}',
    '.word-meta-value {',
    '  color: var(--pane-fg);',
    '  overflow-wrap: anywhere;',
    '}',
    '.word-meta-empty {',
    '  color: var(--muted);',
    '  font-style: italic;',
    '}',
    '.traditional-heading {',
    '  font-weight: 700;',
    '}',
    '.traditional-crossref {',
    '  font-size: 0.95em;',
    '  color: var(--muted);',
    '}',
    '.pane-empty {',
    '  margin: 0.25rem 0;',
    '  color: var(--muted);',
    '  font-style: italic;',
    '}',
    '.traditional-crossref .cross {',
    '  color: var(--muted);',
    '}',
    '.traditional-crossref a {',
    '  color: var(--link);',
    '  text-decoration: underline;',
    '}',
    '/* Chapter-to-chapter navigation */',
    'html {',
    '  scroll-snap-type: y proximity;',
    '}',
    'h1 {',
    '  scroll-initial-target: nearest;',
    '  scroll-snap-align: start;',
    '  scroll-margin-top: 2em;',
    '}',
    '.chapter-nav-header {',
    '  margin-bottom: 0.5rem;',
    '  scroll-snap-align: start;',
    '  scroll-margin-top: 4em;',
    '  margin-top: 1em;',
    '}',
    '.chapter-nav-header-row {',
    '  display: flex;',
    '  gap: 0.5rem;',
    '  margin-bottom: 0.65rem;',
    '}',
    '.chapter-nav-prev-link {',
    '  flex: 1 1 0;',
    '  min-width: 0;',
    '  display: inline-flex;',
    '  align-items: center;',
    '  padding: 0.45rem 0.75rem;',
    '  border: 1px solid var(--pane-border);',
    '  border-radius: 0.45rem;',
    '  background: var(--pane-bg);',
    '  color: var(--link);',
    '  text-decoration: none;',
    '  font-weight: 600;',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '  white-space: nowrap;',
    '}',
    '.chapter-nav-prev-link:hover {',
    '  background: var(--hover-bg);',
    '  color: var(--hover-fg);',
    '}',
    '.chapter-nav-next-arrow {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  padding: 0.45rem 0.7rem;',
    '  border: 1px solid var(--pane-border);',
    '  border-radius: 0.45rem;',
    '  background: var(--pane-bg);',
    '  color: var(--link);',
    '  text-decoration: none;',
    '  font-weight: 600;',
    '  flex-shrink: 0;',
    '}',
    '.chapter-nav-next-arrow:hover {',
    '  background: var(--hover-bg);',
    '  color: var(--hover-fg);',
    '}',
    '.chapter-nav-prev-preview {',
    '  opacity: 0.75;',
    '}',
    '.chapter-nav-footer {',
    '  margin-top: 2.5rem;',
    '}',
    '.chapter-nav-footer-row {',
    '  display: flex;',
    '  justify-content: center;',
    '  margin-bottom: 1rem;',
    '}',
    '.chapter-nav-next-link {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  padding: 0.55rem 1.75rem;',
    '  border: 1px solid var(--pane-border);',
    '  border-radius: 0.45rem;',
    '  background: var(--pane-bg);',
    '  color: var(--link);',
    '  text-decoration: none;',
    '  font-weight: 600;',
    '}',
    '.chapter-nav-next-link:hover {',
    '  background: var(--hover-bg);',
    '  color: var(--hover-fg);',
    '}',
    '.chapter-nav-next-preview {',
    '  position: relative;',
    '  max-height: 11rem;',
    '  overflow: hidden;',
    '}',
    '.chapter-nav-next-preview::after {',
    '  content: "";',
    '  position: absolute;',
    '  bottom: 0;',
    '  left: 0;',
    '  right: 0;',
    '  height: 70%;',
    '  background: linear-gradient(to bottom, transparent, var(--page-bg));',
    '  pointer-events: none;',
    '}'
  ];
}