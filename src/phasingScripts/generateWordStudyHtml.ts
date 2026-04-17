/**
 * generateWordStudyHtml.ts
 *
 * Reads JSON word study files from reports/tmp/words/ and emits one HTML
 * file per JSON into public/words/.
 *
 * Must be run AFTER generateWordStudyJson.ts (npm run p2-words).
 *
 * Run: npm run p2-words-html
 */

import fs from 'fs';
import path from 'path';
import { makeHtmlBase } from './phase2To3/makeHtmlBase';

const ROOT = path.resolve(process.cwd());
const IN_DIR = path.join(ROOT, 'src/json-Phase2/words');
const OUT_DIR = path.join(ROOT, 'dist/words');

// ---------------------------------------------------------------------------
// Book name maps (mirrors generateWordStudyJson.ts)
// ---------------------------------------------------------------------------
const BOOK_TO_DISPLAY_NAME: Record<string, string> = {
  Gen: 'Genesis', Exo: 'Exodus', Lev: 'Leviticus', Num: 'Numbers', Deu: 'Deuteronomy',
  Jos: 'Joshua', Jdg: 'Judges', Rut: 'Ruth',
  '1Sa': '1 Samuel', '2Sa': '2 Samuel', '1Ki': '1 Kings', '2Ki': '2 Kings',
  '1Ch': '1 Chronicles', '2Ch': '2 Chronicles', Ezr: 'Ezra', Neh: 'Nehemiah', Est: 'Esther',
  Job: 'Job', Psa: 'Psalms', Pro: 'Proverbs', Ecc: 'Ecclesiastes', Sol: 'Song of Songs',
  Isa: 'Isaiah', Jer: 'Jeremiah', Lam: 'Lamentations', Eze: 'Ezekiel', Dan: 'Daniel',
  Hos: 'Hosea', Joe: 'Joel', Amo: 'Amos', Oba: 'Obadiah', Jon: 'Jonah',
  Mic: 'Micah', Nah: 'Nahum', Hab: 'Habakkuk', Zep: 'Zephaniah', Hag: 'Haggai',
  Zec: 'Zechariah', Mal: 'Malachi',
  Mat: 'Matthew', Mrk: 'Mark', Luk: 'Luke', Jhn: 'John', Act: 'Acts',
  Rom: 'Romans', '1Co': '1 Corinthians', '2Co': '2 Corinthians', Gal: 'Galatians',
  Eph: 'Ephesians', Php: 'Philippians', Col: 'Colossians',
  '1Th': '1 Thessalonians', '2Th': '2 Thessalonians',
  '1Ti': '1 Timothy', '2Ti': '2 Timothy', Tit: 'Titus', Phm: 'Philemon',
  Heb: 'Hebrews', Jas: 'James', '1Pe': '1 Peter', '2Pe': '2 Peter',
  '1Jn': '1 John', '2Jn': '2 John', '3Jn': '3 John', Jud: 'Jude', Rev: 'Revelation',
};

/** Alias abbreviations used in morpheme IDs → canonical BOOK_TO_DISPLAY_NAME key */
const BOOK_ABBREV_ALIASES: Record<string, string> = {
  Ezk: 'Eze', Jol: 'Joe', Sng: 'Sol', Nam: 'Nah',
};

/** Format a raw morpheme ref like "Exo4:1.2" into a readable citation like "Exodus 4:1". */
function formatRef(ref: string): string {
  const m = ref.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
  if (!m) return ref;
  const rawAbbrev = m[1];
  const canonAbbrev = BOOK_ABBREV_ALIASES[rawAbbrev] ?? rawAbbrev;
  const bookName = BOOK_TO_DISPLAY_NAME[canonAbbrev] ?? rawAbbrev;
  return `${bookName} ${m[2]}:${m[3]}`;
}

/** Build a /-/ chapter URL from a raw morpheme ref like "Exo4:1.2" → "https://servewell.net/-/Exodus/4#1"
 *  Must be absolute because word pages are served from words.servewell.net (different origin). */
function refToUrl(ref: string): string | null {
  const m = ref.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
  if (!m) return null;
  const rawAbbrev = m[1];
  const canonAbbrev = BOOK_ABBREV_ALIASES[rawAbbrev] ?? rawAbbrev;
  const bookName = BOOK_TO_DISPLAY_NAME[canonAbbrev];
  if (!bookName) return null;
  const bookPath = bookName.replace(/\s+/g, '-');
  return `https://servewell.net/-/${bookPath}/${m[2]}#${m[3]}`;
}
const SCRIPT_TAG = `<script src="/js/servewell-app-shell.js"></script>`;

// ---------------------------------------------------------------------------
// Types matching JSON output
// ---------------------------------------------------------------------------
interface InstanceEntry { ref: string; lit: string; trad: string; }
interface TranslationOut { totalInstances: number; instances: InstanceEntry[]; }
interface SlotOut {
  grammarFull: string; grammarFn: string;
  totalInstances: number; totalTranslations: number;
  translations: Record<string, TranslationOut>;
}
interface MetaOut {
  wordKey: string; fileNumber: number;
  strongsId: string; lang: string; lemma: string;
  rootTranslation?: string; transliteration?: string; totalInstances: number; totalSlots: number;
}
interface AncientWordOut { _meta: MetaOut; overflow?: Record<string, string>; slots: Record<string, SlotOut>; }
interface RelatedEntry { fileName: string; strongsId: string; lang: string; lemma: string; rootTranslation?: string; }
interface CrossRefEntry { fileName: string; wordKey: string; strongsId: string; lang: string; lemma: string; rootTranslation?: string; }
interface MainWordFile { relatedFiles?: RelatedEntry[]; crossRefs?: CrossRefEntry[]; ancientWord: AncientWordOut; }
interface OverflowFile { type: 'overflow'; overflowFrom: string; label: string; ancientWord: AncientWordOut; }
interface RedirectFile { _redirect: string; }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function wordLink(fileName: string, label: string): string {
  return `<a href="https://words.servewell.net/${encodeURIComponent(fileName)}">${esc(label)}</a>`;
}

// ---------------------------------------------------------------------------
// CSS (inserted into open <style> block from makeHtmlBase)
// ---------------------------------------------------------------------------
const PAGE_CSS = `
:root {
  color-scheme: light;
  --page-bg: #f4f6f9;
  --page-fg: #0f172a;
  --muted: #475467;
  --label-bg: #f8fafc;
  --pane-bg: #ffffff;
  --pane-border: #dbe3ea;
  --link: #1d4ed8;
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --page-bg: #0b1220;
  --page-fg: #e5edf7;
  --muted: #a6b3c5;
  --label-bg: #172235;
  --pane-bg: #101a2a;
  --pane-border: #2a3b52;
  --link: #8ab4ff;
}
body {
  background: var(--page-bg);
  color: var(--page-fg);
}
a { color: var(--link); }
.ws-meta { margin-bottom: 1.5rem; line-height: 1.6; }
.ws-meta-lemma { font-size: 1.5em; font-family: serif; margin-right: 0.4rem; }
.ws-meta-info {
  font-size: 0.85rem;
  color: var(--muted);
}
.ws-meta-stats { font-size: 0.85rem; color: var(--muted); margin: 0.3rem 0 0; }
.ws-title-sub {
  font-size: 0.45em;
  font-weight: normal;
  font-variant: normal;
  letter-spacing: normal;
  color: var(--muted);
  margin-left: 0.4em;
}
.ws-expand-btn {
  margin-left: 0.6rem;
  padding: 0.1rem 0.55rem;
  font-size: 0.8rem;
  cursor: pointer;
  border: 1px solid var(--pane-border);
  border-radius: 4px;
  background: var(--label-bg);
  color: var(--page-fg);
  vertical-align: middle;
}
.ws-slot {
  border-top: 2px solid var(--pane-border);
  padding-top: 1rem;
  margin-top: 1.75rem;
}
.ws-slot-highlighted { border-top-color: var(--link); }
.ws-grammar-full {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 0.2rem;
  color: var(--page-fg);
}
.ws-slot-stats { font-size: 0.85rem; color: var(--muted); margin: 0 0 0.75rem; }
.ws-translation { margin: 0.8rem 0 0.8rem 0.5rem; }
.ws-rendering {
  font-size: 0.95rem;
  font-weight: 700;
  font-variant: small-caps;
  letter-spacing: 0.02em;
  margin: 0 0 0.4rem;
}
.ws-count { font-weight: 400; font-variant: normal; color: var(--muted); font-size: 0.85em; }
.ws-instance {
  background: var(--pane-bg);
  border-left: 3px solid var(--pane-border);
  padding: 0.4rem 0.7rem;
  margin: 0.3rem 0;
  border-radius: 0 4px 4px 0;
}
.ws-ref {
  display: block;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 0.15rem;
}
a.ws-ref {
  color: var(--link);
  text-decoration: none;
}
a.ws-ref:hover { text-decoration: underline; }
.ws-trad { margin: 0 0 0.2rem; font-size: 0.9rem; }
.ws-lit { margin: 0; font-size: 0.85rem; color: var(--muted); font-style: italic; }
mark.ws-target { background: #fef08a; color: #1a1200; border-radius: 2px; padding: 0 1px; font-style: normal; }
:root[data-theme="dark"] mark.ws-target { background: #5a3e00; color: #fde68a; }
.ws-more summary {
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--link);
  padding: 0.2rem 0;
  margin-top: 0.25rem;
}
.ws-overflow-note { font-size: 0.82rem; color: var(--muted); font-style: italic; margin: 0.4rem 0 0; }
.ws-back-link { font-size: 0.9rem; margin-bottom: 0.75rem; display: block; }
.ws-footer {
  border-top: 2px solid var(--pane-border);
  margin-top: 2.5rem;
  padding-top: 1.25rem;
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
}
.ws-footer section > h2 { font-size: 0.95rem; margin: 0 0 0.4rem; }
.ws-footer section ul { margin: 0; padding-left: 1.25rem; }
.ws-footer section li { font-size: 0.9rem; margin: 0.25rem 0; }
`;

// ---------------------------------------------------------------------------
// Client-side JS (runs after render)
// ---------------------------------------------------------------------------
const PAGE_JS = `<script>
(function () {
  // Expand/collapse-all button
  var allDetails = document.querySelectorAll('details.ws-more');
  var btn = document.getElementById('ws-expand-all');
  if (allDetails.length > 0 && btn) {
    function updateBtn() {
      var anyCollapsed = Array.prototype.some.call(allDetails, function (d) { return !d.open; });
      btn.textContent = anyCollapsed ? 'Expand all' : 'Collapse most';
    }
    updateBtn();
    allDetails.forEach(function (d) { d.addEventListener('toggle', updateBtn); });
    btn.addEventListener('click', function () {
      var anyCollapsed = Array.prototype.some.call(allDetails, function (d) { return !d.open; });
      allDetails.forEach(function (d) { d.open = anyCollapsed; });
      updateBtn();
    });
  } else if (btn) {
    btn.hidden = true;
  }

  // Fragment-based slot priority:
  //   #grammar=Vqw3ms  → move that slot element to top of #ws-slots
  var hash = window.location.hash;
  if (hash && typeof CSS !== 'undefined' && CSS.escape) {
    var m = hash.match(/[#&?]grammar=([^&]+)/);
    if (m) {
      var code = decodeURIComponent(m[1]);
      var container = document.getElementById('ws-slots');
      if (container) {
        var target = container.querySelector('[data-grammar-code="' + CSS.escape(code) + '"]');
        if (target && target.parentNode === container) {
          container.insertBefore(target, container.firstChild);
          target.classList.add('ws-slot-highlighted');
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  }
}());
</script>`;

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strip angle-bracket markers and bracket insertions, keep only word chars. */
function cleanRendering(r: string): string {
  return r
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Single-word stop-words for which trad highlighting would be too noisy.
const SKIP_HIGHLIGHT_WORDS = new Set([
  'a','an','and','are','as','at','be','but','by','for','from','he','her','his',
  'i','if','in','is','it','its','my','no','not','of','on','or','our','out',
  'she','so','that','the','their','they','this','to','up','was','we','were',
  'what','who','will','with','you','your',
]);

/**
 * Return HTML where the target rendering phrase is wrapped in <mark>.
 * Falls back to plain esc(rawText) when the phrase can't be reliably located.
 */
function highlightTarget(rawText: string, rendering: string, isLit: boolean): string {
  const cleaned = cleanRendering(rendering);
  if (!cleaned) return esc(rawText);

  if (!isLit) {
    // For trad: skip if the entire phrase is just stop-words / very-short tokens.
    const words = cleaned.toLowerCase().split(/\s+/);
    const hasContent = words.some(w => w.length > 2 && !SKIP_HIGHLIGHT_WORDS.has(w));
    if (!hasContent) return esc(rawText);
  }

  const escapedText = esc(rawText);
  const pattern = escapeRegex(cleaned);
  try {
    return escapedText.replace(
      new RegExp(`\\b(${pattern})\\b`, 'gi'),
      '<mark class="ws-target">$1</mark>',
    );
  } catch {
    return escapedText;
  }
}

function renderInstance(inst: InstanceEntry, rendering: string): string {
  const url = refToUrl(inst.ref);
  const refHtml = url
    ? `<a class="ws-ref" href="${url}">${esc(formatRef(inst.ref))}</a>`
    : `<span class="ws-ref">${esc(formatRef(inst.ref))}</span>`;
  return [
    `<div class="ws-instance">`,
    refHtml,
    `<p class="ws-trad">${highlightTarget(inst.trad, rendering, false)}</p>`,
    `<p class="ws-lit">${highlightTarget(inst.lit, rendering, true)}</p>`,
    `</div>`,
  ].join('');
}

function renderTranslation(
  rendering: string,
  trans: TranslationOut,
  collapse: boolean,
): string {
  const countLabel = `${trans.totalInstances.toLocaleString()} instance${trans.totalInstances === 1 ? '' : 's'}`;
  const heading = `<h3 class="ws-rendering">${esc(rendering)} <span class="ws-count">(${countLabel})</span></h3>`;

  if (!collapse || trans.instances.length <= 1) {
    return [
      `<div class="ws-translation">`,
      heading,
      ...trans.instances.map(inst => renderInstance(inst, rendering)),
      `</div>`,
    ].join('\n');
  }

  const [first, ...rest] = trans.instances;
  const hiddenCount = trans.totalInstances - 1; // total reported minus the one shown
  const storedRest = rest.length;
  const notStoredCount = trans.totalInstances - 1 - storedRest; // in overflow docs
  const summaryText = `${hiddenCount.toLocaleString()} more instance${hiddenCount === 1 ? '' : 's'}`;
  const overflowNote = notStoredCount > 0
    ? `<p class="ws-overflow-note">${notStoredCount.toLocaleString()} additional instance${notStoredCount === 1 ? '' : 's'} are in overflow documents linked below.</p>`
    : '';

  return [
    `<div class="ws-translation">`,
    heading,
    renderInstance(first, rendering),
    `<details class="ws-more">`,
    `<summary>${summaryText}</summary>`,
    ...rest.map(inst => renderInstance(inst, rendering)),
    overflowNote,
    `</details>`,
    `</div>`,
  ].join('\n');
}

function renderSlot(code: string, slot: SlotOut, fileTotal: number): string {
  const shouldCollapse = fileTotal > 30;
  // Sort translations by instance count descending
  const sortedTranslations = Object.entries(slot.translations)
    .sort((a, b) => b[1].totalInstances - a[1].totalInstances);

  const translationsHtml = sortedTranslations
    .map(([r, t]) => renderTranslation(r, t, shouldCollapse && t.totalInstances > 5))
    .join('\n');

  const grammarLabel = slot.grammarFull?.trim() || code;
  const statsLabel = `${slot.totalInstances.toLocaleString()} instance${slot.totalInstances === 1 ? '' : 's'} · ${slot.totalTranslations} translation${slot.totalTranslations === 1 ? '' : 's'}`;

  return [
    `<section class="ws-slot" data-grammar-code="${esc(code)}">`,
    `<h2 class="ws-grammar-full">${esc(grammarLabel)}</h2>`,
    `<p class="ws-slot-stats">${statsLabel}</p>`,
    translationsHtml,
    `</section>`,
  ].join('\n');
}

function renderSlotsSection(slots: Record<string, SlotOut>, fileTotal: number): { html: string; mergedSlotCount: number } {
  // Merge slots that share an identical grammarFull display label (different grammar codes,
  // same human-readable description — e.g. HNpm and Npm both "Proper Noun (Masculine individual)").
  const seen = new Map<string, { representativeCode: string; merged: SlotOut }>();
  for (const [code, slot] of Object.entries(slots)) {
    const key = slot.grammarFull?.trim() || code;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, {
        representativeCode: code,
        merged: {
          grammarFull: slot.grammarFull,
          grammarFn: slot.grammarFn,
          totalInstances: slot.totalInstances,
          totalTranslations: slot.totalTranslations,
          translations: { ...slot.translations },
        },
      });
    } else {
      const m = existing.merged;
      for (const [rendering, trans] of Object.entries(slot.translations)) {
        if (!m.translations[rendering]) {
          m.translations[rendering] = { totalInstances: 0, instances: [] };
          m.totalTranslations++;
        }
        const t = m.translations[rendering];
        t.instances = [...t.instances, ...trans.instances];
        t.totalInstances += trans.totalInstances;
      }
      m.totalInstances += slot.totalInstances;
    }
  }
  // Sort merged slots by instance count descending
  const sorted = [...seen.values()]
    .sort((a, b) => b.merged.totalInstances - a.merged.totalInstances);
  return {
    html: sorted.map(({ representativeCode, merged }) => renderSlot(representativeCode, merged, fileTotal)).join('\n'),
    mergedSlotCount: sorted.length,
  };
}

function renderFooter(
  overflow: Record<string, string> | undefined,
  relatedFiles: RelatedEntry[] | undefined,
  crossRefs: CrossRefEntry[] | undefined,
): string {
  const parts: string[] = [];

  if (overflow && Object.keys(overflow).length > 0) {
    const items = Object.entries(overflow)
      .map(([fn, label]) => `<li>${wordLink(fn, label)}</li>`)
      .join('\n');
    parts.push(`<section class="ws-overflow-links"><h2>More Instances</h2><ul>${items}</ul></section>`);
  }

  if (relatedFiles?.length) {
    const items = relatedFiles.map(r => {
      const label = r.rootTranslation
        ? `${r.rootTranslation} (${r.lang}, ${r.strongsId})`
        : `${r.fileName} (${r.lang}, ${r.strongsId})`;
      return `<li>${wordLink(r.fileName, label)}</li>`;
    }).join('\n');
    parts.push(`<section class="ws-related"><h2>Related Files</h2><ul>${items}</ul></section>`);
  }

  if (crossRefs?.length) {
    const items = crossRefs.map(r => {
      const label = r.rootTranslation
        ? `${r.rootTranslation} (${r.lang}, ${r.strongsId})`
        : `${r.wordKey} (${r.lang}, ${r.strongsId})`;
      return `<li>${wordLink(r.fileName, label)}</li>`;
    }).join('\n');
    parts.push(`<section class="ws-crossrefs"><h2>Cross References</h2><ul>${items}</ul></section>`);
  }

  return parts.length ? `<div class="ws-footer">\n${parts.join('\n')}\n</div>` : '';
}

// ---------------------------------------------------------------------------
// Page renderers
// ---------------------------------------------------------------------------
function renderMainPage(fileName: string, data: MainWordFile): string {
  const meta = data.ancientWord._meta;
  const suffix = meta.fileNumber > 1 ? ` (${meta.fileNumber})` : '';
  const displayWord = (meta.rootTranslation ?? meta.wordKey).toUpperCase();
  const title = meta.rootTranslation
    ? `${meta.rootTranslation}${suffix}`
    : `${meta.wordKey}${suffix}`;
  const description = `Ancient word study: ${title} (${meta.lang}, ${meta.strongsId})`;

  const base = makeHtmlBase(title, description);

  const hasAnyCollapse = meta.totalInstances > 30 &&
    Object.values(data.ancientWord.slots).some(s =>
      Object.values(s.translations).some(t => t.totalInstances > 5)
    );

  const { html: slotsHtml, mergedSlotCount } = renderSlotsSection(data.ancientWord.slots, meta.totalInstances);
  const footer = renderFooter(data.ancientWord.overflow, data.relatedFiles, data.crossRefs);

  const expandBtn = hasAnyCollapse
    ? ` <button id="ws-expand-all" class="ws-expand-btn">Expand all</button>`
    : '';

  const subtitleParts = [
    ...(meta.transliteration ? [esc(meta.transliteration)] : []),
    esc(meta.lemma),
    esc(meta.lang),
    esc(meta.strongsId),
  ];
  const richH1 = `<h1>${esc(displayWord)}${esc(suffix)} <span class="ws-title-sub">· ${subtitleParts.join(' · ')}</span></h1>`;

  const metaStats = `<p class="ws-meta-stats">${meta.totalInstances.toLocaleString()} total instance${meta.totalInstances === 1 ? '' : 's'} · ${mergedSlotCount} grammar slot${mergedSlotCount === 1 ? '' : 's'}${expandBtn}</p>`;

  const headToBodyBeforeH1 = base.headToBody.slice(0, -1);

  return [
    ...base.topOfHead,
    PAGE_CSS,
    ...headToBodyBeforeH1,
    richH1,
    metaStats,
    `<div id="ws-slots">`,
    slotsHtml,
    `</div>`,
    footer,
    PAGE_JS,
    SCRIPT_TAG,
    ...base.bottom,
  ].join('\n');
}

function renderOverflowPage(fileName: string, data: OverflowFile): string {
  const meta = data.ancientWord._meta;
  const title = `${meta.wordKey} — ${data.label}`;
  const description = `Word study: ${title} (${meta.lang}, ${meta.strongsId})`;

  const base = makeHtmlBase(title, description);

  const hasAnyCollapse = meta.totalInstances > 30 &&
    Object.values(data.ancientWord.slots).some(s =>
      Object.values(s.translations).some(t => t.totalInstances > 5)
    );

  const backLink = `<a class="ws-back-link" href="https://words.servewell.net/${encodeURIComponent(data.overflowFrom)}">&#8592; Back to ${esc(meta.wordKey)}</a>`;

  const expandBtn = hasAnyCollapse
    ? ` <button id="ws-expand-all" class="ws-expand-btn">Expand all</button>`
    : '';

  const metaBlock = [
    `<div class="ws-meta">`,
    backLink,
    `<span class="ws-meta-info">${esc(data.label)}</span>`,
    ` · <span class="ws-meta-info">${esc(meta.lang)}</span>`,
    ` · <span class="ws-meta-info">${esc(meta.strongsId)}</span>`,
    `<p class="ws-meta-stats">${meta.totalInstances.toLocaleString()} instance${meta.totalInstances === 1 ? '' : 's'} in this section${expandBtn}</p>`,
    `</div>`,
  ].join('');

  const { html: slotsHtml } = renderSlotsSection(data.ancientWord.slots, meta.totalInstances);

  return [
    ...base.topOfHead,
    PAGE_CSS,
    ...base.headToBody,
    metaBlock,
    `<div id="ws-slots">`,
    slotsHtml,
    `</div>`,
    PAGE_JS,
    SCRIPT_TAG,
    ...base.bottom,
  ].join('\n');
}

function renderRedirectPage(target: string): string {
  const safeTarget = `https://words.servewell.net/${encodeURIComponent(target)}`;
  return [
    `<!DOCTYPE html>`,
    `<html lang="en">`,
    `<head>`,
    `<meta charset="UTF-8">`,
    `<meta http-equiv="refresh" content="0;url=${esc(safeTarget)}">`,
    `<title>Redirecting to ${esc(target)}</title>`,
    `</head>`,
    `<body>`,
    `<p>Redirecting to <a href="${esc(safeTarget)}">${esc(target)}</a>&hellip;</p>`,
    `</body>`,
    `</html>`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
if (!fs.existsSync(IN_DIR)) {
  console.error(`Input directory not found: ${IN_DIR}`);
  console.error('Run "npm run p2-words" first.');
  process.exit(1);
}

if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const jsonFiles = fs.readdirSync(IN_DIR)
  .filter(f => f.endsWith('.json') && !f.startsWith('_'))
  .sort();

let written = 0;
let mainCount = 0;
let overflowCount = 0;
let redirectCount = 0;

for (const jsonFile of jsonFiles) {
  const baseName = jsonFile.replace(/\.json$/, '');
  const raw = JSON.parse(fs.readFileSync(path.join(IN_DIR, jsonFile), 'utf8'));

  let html: string;
  if ((raw as OverflowFile).type === 'overflow') {
    html = renderOverflowPage(baseName, raw as OverflowFile);
    overflowCount++;
  } else if ((raw as RedirectFile)._redirect) {
    html = renderRedirectPage((raw as RedirectFile)._redirect);
    redirectCount++;
  } else {
    html = renderMainPage(baseName, raw as MainWordFile);
    mainCount++;
  }

  fs.writeFileSync(path.join(OUT_DIR, `${baseName}.html`), html, 'utf8');
  written++;
}

console.log(`Wrote ${written} word HTML files to dist/words/`);
console.log(`  ${mainCount} main word pages, ${overflowCount} overflow pages, ${redirectCount} redirects`);

// ---------------------------------------------------------------------------
// Copy a small set of diverse sample pages into public/test-r2/ so they are
// served by wrangler dev and visible in the visual-test-preview.html slides.
// These are NOT linked from any production page.
// ---------------------------------------------------------------------------
const TEST_R2_SAMPLES = ['aaron', 'love', 'grace', 'create'];
const TEST_R2_DIR = path.join(ROOT, 'public/test-r2');
if (fs.existsSync(TEST_R2_DIR)) fs.rmSync(TEST_R2_DIR, { recursive: true, force: true });
fs.mkdirSync(TEST_R2_DIR, { recursive: true });
let samplesCopied = 0;
for (const name of TEST_R2_SAMPLES) {
  const src = path.join(OUT_DIR, `${name}.html`);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(TEST_R2_DIR, `${name}.html`));
    samplesCopied++;
  }
}
console.log(`Copied ${samplesCopied} sample pages to public/test-r2/ for visual preview`);
