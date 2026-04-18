/**
 * generateWordStudyJson.ts
 *
 * Reads all Phase 2 chapter JSON files and emits one JSON file per
 * (lemmatized-English-word, Strongs-ID) pair into reports/tmp/words/.
 *
 * File naming:
 *   light.json   — first Strongs for "light" in Bible order (H0216)
 *   light_2.json — second Strongs for "light" (G5457), etc.
 *
 * Also writes:
 *   _word_index.json    — { "<lemma>": <fileCount> } only for words with >1 file
 *   _strongs_index.json — { "<strongsId>": "<fileName>" } primary file per Strongs
 *
 * Non-canonical forms (e.g. "lights") get redirect stubs:
 *   lights.json — { "_redirect": "light" }
 *
 * For multi-word renderings (e.g. "[THE] LIGHT OF" for H0216), only the
 * first non-grammar-helper word is the primary key for Strongs association.
 * Grammar-helper words (of/the/a/an/and/or) that appear as secondary words
 * in multi-word renderings are not indexed under that Strongs. Standalone
 * grammar-helper renderings like "AND" for H9002 are indexed normally.
 *
 * Run: npm run p2-words
 * Designed for evaluation — NOT committed, NOT deployed.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);
const winkLemmatizer = _require('wink-lemmatizer') as {
  noun: (w: string) => string;
  verb: (w: string) => string;
  adjective: (w: string) => string;
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ROOT = path.resolve(process.cwd());
const SRC_DIR = path.join(ROOT, 'src/json-Phase2/docs');
const OUT_DIR = path.join(ROOT, 'src/json-Phase2/words');

/** True-total instances above which book-level overflow sub-documents are generated. */
const OVERFLOW_THRESHOLD = 1000;

// ---------------------------------------------------------------------------
// Lexicon transliteration lookup (TBESH / TBESG)
// ---------------------------------------------------------------------------
// Builds a Map<strongsId, transliteration> from the STEPBible brief lexicons.
// These give the canonical lemma (dictionary) form, unlike the per-morpheme
// OriginalMorphemeTransliteration which reflects the specific inflected form
// used in whichever verse is encountered first (e.g. "charin" instead of "charis").
// Fallback: for disambiguated IDs (e.g. H5653G, H0157G) strip the trailing
// uppercase letter(s) or + suffix and try again.
interface LexiconEntry { translit: string; script: string; }
function buildLexiconMap(filePath: string): Map<string, LexiconEntry> {
  const map = new Map<string, LexiconEntry>();
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length < 5) continue;
      const id = cols[0].trim().toUpperCase(); // normalize: TBESH uses H1254a, data uses H1254A
      const script = cols[3].trim();
      const translit = cols[4].trim();
      if (!id || !translit || !/^[HG]\d+/.test(id)) continue;
      if (!map.has(id)) map.set(id, { translit, script });
    }
  } catch { /* file not present — silent, falls back gracefully */ }
  return map;
}
const TSTEP_DIR = path.join(ROOT, 'src/step-Phase1a');
const _tbesh = buildLexiconMap(path.join(TSTEP_DIR, 'TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt'));
const _tbesg = buildLexiconMap(path.join(TSTEP_DIR, 'TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt'));

function lexiconEntry(strongsId: string): LexiconEntry | undefined {
  const map = strongsId.startsWith('H') ? _tbesh : _tbesg;
  if (map.has(strongsId)) return map.get(strongsId);
  // Fallback: strip trailing uppercase letter suffix or + content (disambiguated IDs)
  const base = strongsId.replace(/[A-Z]+$/, '').replace(/\+.*$/, '');
  return base !== strongsId ? map.get(base) : undefined;
}

function lexiconTranslit(strongsId: string): string | undefined {
  return lexiconEntry(strongsId)?.translit;
}

const BOOK_ORDER = [
  'Gen', 'Exo', 'Lev', 'Num', 'Deu',
  'Jos', 'Jdg', 'Rut', '1Sa', '2Sa', '1Ki', '2Ki', '1Ch', '2Ch', 'Ezr', 'Neh', 'Est',
  'Job', 'Psa', 'Pro', 'Ecc', 'Sol',
  'Isa', 'Jer', 'Lam', 'Eze', 'Dan', 'Hos', 'Joe', 'Amo', 'Oba', 'Jon',
  'Mic', 'Nah', 'Hab', 'Zep', 'Hag', 'Zec', 'Mal',
  'Mat', 'Mrk', 'Luk', 'Jhn', 'Act',
  'Rom', '1Co', '2Co', 'Gal', 'Eph', 'Php', 'Col', '1Th', '2Th',
  '1Ti', '2Ti', 'Tit', 'Phm', 'Heb', 'Jas', '1Pe', '2Pe', '1Jn', '2Jn', '3Jn', 'Jud', 'Rev',
  'Unknown',
] as const;

const BOOK_TO_DISPLAY_NAME: Record<string, string> = {
  Gen: 'Genesis', Exo: 'Exodus', Lev: 'Leviticus', Num: 'Numbers', Deu: 'Deuteronomy',
  Jos: 'Joshua', Jdg: 'Judges', Rut: 'Ruth',
  '1Sa': '1 Samuel', '2Sa': '2 Samuel', '1Ki': '1 Kings', '2Ki': '2 Kings',
  '1Ch': '1 Chronicles', '2Ch': '2 Chronicles', Ezr: 'Ezra', Neh: 'Nehemiah', Est: 'Esther',
  Job: 'Job', Psa: 'Psalms', Pro: 'Proverbs', Ecc: 'Ecclesiastes', Sol: 'Song of Solomon',
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
  Unknown: 'Unknown',
};

/** Normalize alias abbreviations to the primary form used in BOOK_ORDER. */
const BOOK_ABBREV_ALIASES: Record<string, string> = {
  Ezk: 'Eze', Jol: 'Joe', Sng: 'Sol', Nam: 'Nah',
};

function getBook(ref: string): string {
  // Match optional leading digit (for 1Sa, 2Ki, 1Co etc.) then letters only — stops before chapter digit
  const m = ref.match(/^([0-9]?[A-Za-z]+)/);
  if (!m) return 'Unknown';
  const abbrev = m[1];
  return BOOK_ABBREV_ALIASES[abbrev] ?? (abbrev in BOOK_TO_DISPLAY_NAME ? abbrev : 'Unknown');
}

/**
 * Words that are secondary/grammatical when appearing alongside content
 * words in a multi-word rendering (e.g. "LIGHT OF", "THE LIGHT").
 * Standalone renderings of these words (e.g. just "AND" for the vav
 * conjunction) are still indexed normally.
 */
const GRAMMAR_HELPERS = new Set(['of', 'the', 'a', 'an', 'and', 'or']);

/**
 * PRIMARY skip-set for root translation key selection.
 * When the first word of a root (after stripping leading "to ") is in this set,
 * skip it and look for the next content word:
 *   "to be able"  → "able"        (copula skip)
 *   "to have mercy" → "mercy"    (light-verb skip)
 *   "to make clear" → "clear"    (light-verb skip)
 *   "to go astray"  → "astray"   (light-verb skip)
 * If ALL words are primary-skip words, fall back to the first word.
 */
const ROOT_FIRST_SKIP_WORDS = new Set([
  // grammar/function words
  ...GRAMMAR_HELPERS,
  // copulas
  'be', 'being', 'been',
  // light verbs — these precede a content word in compound glosses
  'have', 'having',
  'make', 'give', 'bring', 'put', 'take',
  'set', 'go', 'come', 'get', 'do',
  'turn', 'cut', 'break', 'call', 'keep',
]);

/**
 * SECONDARY (particle) skip-set — only applied after a PRIMARY skip word has
 * been consumed. Prevents directional/relational particles from becoming the
 * file key when the actual content word follows:
 *   "to bring forth"    → fallback to "bring" (no content word after particle)
 *   "to come to know"   → "know"   (particle "to" skipped)
 *   "to set free"       → "free"   ("free" is NOT in this set, so it is kept)
 *   "to break the neck" → "neck"   ("the" consumed by primary skip)
 */
const ROOT_PARTICLE_SKIP_WORDS = new Set([
  // directional and relational particles
  'out', 'off', 'up', 'down', 'away', 'forth', 'upon', 'back', 'aside',
  'around', 'before', 'near', 'through', 'over', 'past', 'along', 'about',
  'toward', 'beside', 'in', 'on', 'to', 'for', 'with', 'by', 'from', 'as',
  'into', 'onto', 'among', 'within', 'without', 'together',
  // articles and conjunctions — also skip in phrase-interior position
  // e.g. "to cut off the tail" → "tail" (not "the")
  ...GRAMMAR_HELPERS,
]);

/**
 * Strongs-prefix remaps: when a Strongs ID starts with one of these prefixes,
 * override the derived word key. Applied before EnglishRootTranslation parsing.
 *   H0935* (בּוֹא to enter/come in) → "enter"
 *   H3318* (יָצָא to go out/emerge) → "emerge"
 */
const STRONGS_PREFIX_REMAP: Record<string, string> = {
  'H0935': 'enter',
  'H3318': 'emerge',
};

/**
 * Strongs exact remaps: for specific IDs where the lemmatizer produces the
 * wrong result or where a proper-noun/pronoun needs a stable canonical key.
 * These bypass getPrimaryRootKey and lemmatization entirely.
 */
const STRONGS_EXACT_REMAP: Record<string, string> = {
  // "saw" (tool/action) — wink verb("saw") → "see" (treats as past tense)
  'G4249': 'saw',  // πρίζω "to saw in two"
  'H7787': 'saw',  // שׂוּר "to saw/sever"
  // "wound" (injury) — wink verb("wound") → "wind" (treats as past tense)
  'H6481': 'wound', // פָּצַע "to wound"
  'H8428': 'wound', // תָּחָה "to wound"
  'G5135': 'wound', // τραυματίζω "to wound"
  // "found" (establish) — wink verb("found") → "find" (treats as past tense)
  'H3245': 'found', // יָסַד "to found/establish"
  'G2311': 'found', // θεμελιόω "to lay a foundation"
  // "left" (direction) — wink verb("left") → "leave" (treats as past tense)
  'H8041': 'left',  // שָׂמֹאל "to go left"
  // Greek first-person pronoun: falls back to rendering ("ME", "FROM ME", etc.)
  // and scatters into preposition files without an explicit remap.
  'G1473': 'me',    // ἐγώ "I/me"
  'G3165': 'me',    // short enclitic form of G1473
  // Proper noun: "Media" (the empire) lemmatizes as plural of "medium"
  'H4076H': 'media', // מָדִי (Mede/Media) — suffix form
  'H4074H': 'media', // מָדַי (Media) — suffix form
};

/**
 * Word-level cross-references added to _meta.crossRefs of the first sibling
 * file for a lemma. Used by the front-end search to find semantically related
 * files that are NOT siblings (different English words, same domain).
 * Format: { lemmaKey: [relatedLemmaKey, ...] }
 */
const WORD_CROSS_REFS: Record<string, string[]> = {
  'come':   ['enter', 'emerge'],
  'go':     ['enter', 'emerge'],
  'out':    ['emerge', 'enter'],
  'in':     ['enter', 'emerge'],
  'near':   ['bring'],
  'bring':  ['near'],
};

// ---------------------------------------------------------------------------
// Inline types (mirrors phase2Types.ts)
// ---------------------------------------------------------------------------
interface Morpheme {
  MorphemeId?: string;
  OriginalMorphemeScript: string;
  OriginalMorphemeTransliteration?: string;
  OriginalLexemeScript?: string;
  OriginalRootScript?: string;
  OriginalRootStrongsID: string;
  EnglishMorphemeWithPunctuationInOriginalOrder: string;
  OriginalMorphemeGrammarCode?: string;  // e.g. "Vqw3ms", "HNcsm"
  OriginalMorphemeGrammar?: string;       // e.g. "Verb : Qal, Wayyiqtol, 3ms"
  OriginalMorphemeGrammarFunction?: string;
  OriginalLanguage?: string;
  EnglishRootTranslation?: string;
  IsPunctuation?: boolean;
}

interface EnglishWordInfo { EnglishWord: string; }
interface EnglishInsertion { InsertionType: string; Text: string; }

interface Snippet {
  SnippetNumber: number;
  OriginalMorphemes: Morpheme[];
  EnglishHeadingsAndWords: (EnglishWordInfo | EnglishInsertion)[];
}

interface Chapter {
  DocOrBookAbbreviation: string;
  ChapterNumber: number;
  SnippetsAndExplanations: Snippet[];
}

// ---------------------------------------------------------------------------
// Accumulator types
// ---------------------------------------------------------------------------
interface InstanceEntry { ref: string; lit: string; trad: string; }
interface TranslationAcc {
  /** Instances grouped by Bible book (canonical abbreviation). */
  instancesByBook: Map<string, InstanceEntry[]>;
}
interface SlotAcc {
  grammarCode: string;  // e.g. "Vqw3ms"
  grammarFull: string;  // e.g. "Verb : Qal, Wayyiqtol, 3ms"
  grammarFn: string;    // e.g. "Verb"
  translations: Map<string, TranslationAcc>; // normalizedRendering → instances
}
interface WordFileAcc {
  wordKey: string;      // canonical lemma
  strongsId: string;
  lemmaScript: string;  // original-script lemma form
  lang: string;
  rootTranslation?: string;
  transliteration?: string;
  slots: Map<string, SlotAcc>; // grammarCode → SlotAcc
}

// ---------------------------------------------------------------------------
// File-assignment state
// ---------------------------------------------------------------------------
// lemma → ordered list of strongsIds (index 0 = "lemma.json", 1 = "lemma_2.json", ...)
const lemmaToStrongsIds = new Map<string, string[]>();
// `${lemma}::${strongsId}` → file base name
const assignedFileNames = new Map<string, string>();
// strongsId → file base name (set on first encounter in Bible order)
const strongsToFile = new Map<string, string>();

function makeFileKey(lemma: string, strongsId: string): string {
  return `${lemma}::${strongsId}`;
}

function assignFile(lemma: string, strongsId: string): string {
  const key = makeFileKey(lemma, strongsId);
  const existing = assignedFileNames.get(key);
  if (existing !== undefined) return existing;

  const list = lemmaToStrongsIds.get(lemma) ?? [];
  const n = list.length;
  const name = n === 0 ? lemma : `${lemma}_${n + 1}`;
  list.push(strongsId);
  lemmaToStrongsIds.set(lemma, list);
  assignedFileNames.set(key, name);
  return name;
}

// ---------------------------------------------------------------------------
// Per-file data and running counts
// ---------------------------------------------------------------------------
const wordFileData = new Map<string, WordFileAcc>();
// `${fileName}::${grammarCode}` → total instances for this grammar slot
const grammarRunningCounts = new Map<string, number>();
// `${fileName}::${grammarCode}::${rendering}` → total instances for this translation
const translationRunningCounts = new Map<string, number>();
// strongsId → list of lemmatized words that should get reverse crossRefs pointing here.
// Populated by getWordKey on first encounter of each Strongs ID.
const pendingReverseKeys = new Map<string, string[]>();
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getLemma(m: Morpheme): string {
  return m.OriginalRootScript ?? m.OriginalLexemeScript ?? m.OriginalMorphemeScript;
}

function lemmatizeWord(word: string, grammarFn: string): string {
  const fn = grammarFn.toLowerCase();
  try {
    if (fn.includes('verb')) return winkLemmatizer.verb(word);
    if (fn.includes('adjective') || fn.includes('adverb')) return winkLemmatizer.adjective(word);
    return winkLemmatizer.noun(word);
  } catch {
    return word;
  }
}

/**
 * Extract clean lowercase word tokens from a rendering.
 * Removes [bracket] blocks entirely; strips angle-bracket/paren delimiters
 * but keeps their content (grammatical English insertions).
 */
function toWordTokens(rendering: string): string[] {
  const cleaned = rendering
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[<>(){}]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
  return [...new Set(cleaned.split(/\s+/).filter(w => w.length >= 2))];
}

/**
 * Return the primary word token from a rendering string (fallback only).
 * single-token → that token; multi-token → first non-grammar-helper.
 */
function getPrimaryToken(rendering: string): string | null {
  const words = toWordTokens(rendering);
  if (words.length === 0) return null;
  if (words.length === 1) return words[0];
  return words.find(w => !GRAMMAR_HELPERS.has(w)) ?? words[0];
}

/**
 * Return the primary word key AND a list of "reverse cross-ref source" words:
 * alternate slash segments and any consumed light-verb / article words.
 * These sources are used post-pass to add reverse crossRefs into the source
 * word's first-sibling file pointing back to the file that was chosen.
 *
 * Examples:
 *   "the/this/who" → key="the", reverseKeys=["this", "who"]
 *   "to cut off the tail" → key="tail", reverseKeys=["cut"]
 *   "the back" → key="back", reverseKeys=[]  (article not a meaningful reverse ref)
 */
function getPrimaryRootKey(morph: Morpheme): { key: string | null; reverseKeys: string[] } {
  const root = morph.EnglishRootTranslation?.trim();
  if (root) {
    // Slash-separated alternatives: "the/this/who" → primary="the", alts=["this","who"]
    const segments = root.split('/').map(s => s.trim()).filter(Boolean);
    const primarySegment = segments[0];
    // Reverse refs from slash alts: only segments that are single clean words
    // and are not grammar helpers (articles, conjunctions don't need back-refs).
    const slashAlts = segments.slice(1)
      .map(s => s.replace(/^to\s+/i, '').toLowerCase().replace(/[^a-z]/g,'').trim())
      .filter(w => w.length >= 2 && !GRAMMAR_HELPERS.has(w));

    // Special case: "(Mount )Hermon", "(Mount_of )Olives", etc.
    const mountMatch = primarySegment.match(/^\(mount[^)]*\)\s*(\S+)/i);
    if (mountMatch) {
      const name = mountMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (name.length >= 2) return { key: name, reverseKeys: slashAlts };
    }

    const stripped = primarySegment.replace(/^to\s+/i, '');
    const words = stripped
      .toLowerCase()
      .replace(/[<>(){}]/g, ' ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length >= 2);

    if (words.length > 0) {
      // Pass 1: find first word not in the primary skip set
      const firstNonPrimaryIdx = words.findIndex(w => !ROOT_FIRST_SKIP_WORDS.has(w));
      if (firstNonPrimaryIdx === -1) return { key: words[0], reverseKeys: slashAlts };

      const primarySkipUsed = firstNonPrimaryIdx > 0;
      if (!primarySkipUsed) return { key: words[firstNonPrimaryIdx], reverseKeys: slashAlts };

      // A light verb was consumed in pass 1.
      // Only add it as a reverse ref if it's a genuine light verb (not an article).
      const consumedWord = words[0];
      const lightVerbRef = !GRAMMAR_HELPERS.has(consumedWord) ? [consumedWord] : [];

      // Pass 2: skip directional particles and articles
      const contentWord = words
        .slice(firstNonPrimaryIdx)
        .find(w => !ROOT_PARTICLE_SKIP_WORDS.has(w));
      if (contentWord) return { key: contentWord, reverseKeys: [...slashAlts, ...lightVerbRef] };

      // All remaining words are particles — fall back
      const fallback = GRAMMAR_HELPERS.has(consumedWord) ? words[firstNonPrimaryIdx] : consumedWord;
      return { key: fallback, reverseKeys: slashAlts };
    }
  }
  return { key: getPrimaryToken(morph.EnglishMorphemeWithPunctuationInOriginalOrder ?? ''), reverseKeys: [] };
}

/**
 * Determine the word key (lemma) for Strongs-file assignment.
 * Checks explicit Strongs remaps first, then derives from EnglishRootTranslation.
 */
function getWordKey(morph: Morpheme): string | null {
  const sid = morph.OriginalRootStrongsID;
  if (STRONGS_EXACT_REMAP[sid]) return STRONGS_EXACT_REMAP[sid];
  for (const [prefix, key] of Object.entries(STRONGS_PREFIX_REMAP)) {
    if (sid.startsWith(prefix)) return key;
  }
  const { key: rawKey, reverseKeys } = getPrimaryRootKey(morph);
  if (!rawKey) return null;
  const lemma = lemmatizeWord(rawKey, morph.OriginalMorphemeGrammarFunction ?? '');
  // Store reverse keys on the morpheme so the main loop can record them.
  // We attach them to a side-channel map keyed by strongsId (first encounter wins).
  if (reverseKeys.length > 0 && !pendingReverseKeys.has(sid)) {
    pendingReverseKeys.set(sid, reverseKeys.map(w => lemmatizeWord(w, 'Verb')));
  }
  return lemma;
}

/**
 * Normalize a rendering as a slot key: remove [bracket] blocks, strip
 * angle-bracket/paren delimiters (keep content), strip edge punctuation,
 * collapse whitespace, uppercase.
 */
function normalizeRendering(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[<>(){}]/g, ' ')
    .replace(/^[,;:.!?'"]+|[,;:.!?'"]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildLiteralCtx(snippet: Snippet): string {
  return snippet.OriginalMorphemes
    .filter(m => !m.IsPunctuation)
    .map(m => m.EnglishMorphemeWithPunctuationInOriginalOrder)
    .join(' ');
}

function buildTraditionalCtx(snippet: Snippet): string {
  const words: string[] = [];
  for (const item of snippet.EnglishHeadingsAndWords) {
    if ('EnglishWord' in item) words.push(item.EnglishWord);
  }
  return words.join(' ');
}

// ---------------------------------------------------------------------------
// Read chapter files
// ---------------------------------------------------------------------------
function listAllChapterFiles(srcDir: string): string[] {
  const result: string[] = [];
  const bookDirs = fs
    .readdirSync(srcDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  for (const bookDir of bookDirs) {
    const absBook = path.join(srcDir, bookDir);
    const chapters = fs
      .readdirSync(absBook, { withFileTypes: true })
      .filter(e => e.isFile() && e.name.endsWith('.json'))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    for (const ch of chapters) result.push(path.join(absBook, ch));
  }
  return result;
}

function readChapter(filePath: string): Chapter | null {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    const c = (raw['default'] as Record<string, unknown>) ?? raw;
    if (!Array.isArray(c['SnippetsAndExplanations'])) return null;
    return c as unknown as Chapter;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main pass
// ---------------------------------------------------------------------------
const allFiles = listAllChapterFiles(SRC_DIR);
console.log(`Processing ${allFiles.length} chapter files...`);

let morphemeCount = 0;
let skippedCount = 0;

for (const filePath of allFiles) {
  const chapter = readChapter(filePath);
  if (!chapter) { skippedCount++; continue; }

  for (const snippet of chapter.SnippetsAndExplanations) {
    if (!Array.isArray(snippet.OriginalMorphemes)) continue;

    const litCtx = buildLiteralCtx(snippet);
    const tradCtx = buildTraditionalCtx(snippet);

    for (const morph of snippet.OriginalMorphemes) {
      if (morph.IsPunctuation) continue;

      const rawRendering = (morph.EnglishMorphemeWithPunctuationInOriginalOrder ?? '').trim();
      if (!rawRendering) continue;

      const grammarFn = morph.OriginalMorphemeGrammarFunction ?? 'Unknown';
      const strongsId = morph.OriginalRootStrongsID;
      const lemma = getWordKey(morph);
      if (!lemma) continue;
      const fileName = assignFile(lemma, strongsId);

      if (!strongsToFile.has(strongsId)) {
        strongsToFile.set(strongsId, fileName);
      }

      if (!wordFileData.has(fileName)) {
        const lex = lexiconEntry(strongsId);
        wordFileData.set(fileName, {
          wordKey: lemma,
          strongsId,
          lemmaScript: lex?.script || getLemma(morph),
          lang: morph.OriginalLanguage ?? 'Unknown',
          rootTranslation: morph.EnglishRootTranslation?.trim(),
          transliteration: lex?.translit ?? (morph.OriginalMorphemeTransliteration?.trim() || undefined),
          slots: new Map(),
        });
      }

      const data = wordFileData.get(fileName)!;
      const grammarCode = morph.OriginalMorphemeGrammarCode ?? 'Unknown';
      const grammarFull = morph.OriginalMorphemeGrammar ?? '';
      const renderingKey = normalizeRendering(rawRendering);

      if (!data.slots.has(grammarCode)) {
        data.slots.set(grammarCode, { grammarCode, grammarFull, grammarFn, translations: new Map() });
      }
      const slot = data.slots.get(grammarCode)!;
      if (!slot.translations.has(renderingKey)) {
        slot.translations.set(renderingKey, { instancesByBook: new Map() });
      }

      const gck = `${fileName}::${grammarCode}`;
      grammarRunningCounts.set(gck, (grammarRunningCounts.get(gck) ?? 0) + 1);
      const tck = `${gck}::${renderingKey}`;
      translationRunningCounts.set(tck, (translationRunningCounts.get(tck) ?? 0) + 1);

      const ref = morph.MorphemeId
        ?? `${chapter.DocOrBookAbbreviation}${chapter.ChapterNumber}:${snippet.SnippetNumber}`;
      const translation = slot.translations.get(renderingKey)!;
      const book = getBook(ref);
      const bookInst = translation.instancesByBook.get(book) ?? [];
      bookInst.push({ ref, lit: litCtx, trad: tradCtx });
      translation.instancesByBook.set(book, bookInst);

      morphemeCount++;
    }
  }
}

console.log(`Processed ${morphemeCount} morphemes (${skippedCount} chapters skipped).`);
console.log(`Unique word files to write: ${wordFileData.size}`);

// ---------------------------------------------------------------------------
// Post-process: build relatedFiles for each file
// ---------------------------------------------------------------------------
// relatedFiles is only written into the first sibling file (the bare lemma file).
const relatedFilesMap = new Map<
  string,
  Array<{ fileName: string; strongsId: string; lang: string; lemma: string; rootTranslation?: string }>
>();

for (const [lemma, strongsIds] of lemmaToStrongsIds) {
  if (strongsIds.length <= 1) continue;
  // Only the first file (bare lemma name) carries the relatedFiles list.
  const firstFile = assignedFileNames.get(makeFileKey(lemma, strongsIds[0]))!;
  const related = strongsIds.slice(1).map(sid => {
    const fn = assignedFileNames.get(makeFileKey(lemma, sid))!;
    const acc = wordFileData.get(fn);
    return {
      fileName: fn,
      strongsId: sid,
      lang: acc?.lang ?? 'Unknown',
      lemma: acc?.lemmaScript ?? '',
      ...(acc?.rootTranslation ? { rootTranslation: acc.rootTranslation } : {}),
    };
  });
  relatedFilesMap.set(firstFile, related);
}

// Cross-refs: semantic cross-references between files outside the sibling cluster.
// Start with manual WORD_CROSS_REFS, then add automatic reverse refs below.
type CrossRefEntry = {
  fileName: string; wordKey: string;
  strongsId: string; lang: string; lemma: string; rootTranslation?: string;
};
const crossRefsMap = new Map<string, CrossRefEntry[]>();
for (const [lemma, targets] of Object.entries(WORD_CROSS_REFS)) {
  const sids = lemmaToStrongsIds.get(lemma);
  if (!sids?.length) continue;
  const firstFile = assignedFileNames.get(makeFileKey(lemma, sids[0]));
  if (!firstFile) continue;
  const refs: CrossRefEntry[] = [];
  for (const target of targets) {
    const tids = lemmaToStrongsIds.get(target);
    if (!tids?.length) continue;
    const tFile = assignedFileNames.get(makeFileKey(target, tids[0]));
    if (tFile) {
      const tData = wordFileData.get(tFile);
      refs.push({
        fileName: tFile, wordKey: target,
        strongsId: tData?.strongsId ?? '',
        lang: tData?.lang ?? 'Unknown',
        lemma: tData?.lemmaScript ?? '',
        ...(tData?.rootTranslation ? { rootTranslation: tData.rootTranslation } : {}),
      });
    }
  }
  if (refs.length > 0) crossRefsMap.set(firstFile, refs);
}

// Automatic reverse cross-refs from slash-alt segments and consumed light verbs.
for (const [sid, reverseKeys] of pendingReverseKeys) {
  const targetFile = strongsToFile.get(sid);
  if (!targetFile) continue;
  const targetData = wordFileData.get(targetFile);
  if (!targetData) continue;
  for (const revKey of reverseKeys) {
    const revSids = lemmaToStrongsIds.get(revKey);
    if (!revSids?.length) continue;
    const revFirstFile = assignedFileNames.get(makeFileKey(revKey, revSids[0]));
    if (!revFirstFile || revFirstFile === targetFile) continue;
    const existing = crossRefsMap.get(revFirstFile) ?? [];
    if (!existing.some(e => e.fileName === targetFile)) {
      existing.push({
        fileName: targetFile, wordKey: targetData.wordKey,
        strongsId: targetData.strongsId,
        lang: targetData.lang,
        lemma: targetData.lemmaScript,
        ...(targetData.rootTranslation ? { rootTranslation: targetData.rootTranslation } : {}),
      });
      crossRefsMap.set(revFirstFile, existing);
    }
  }
}

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------
if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

/** Flatten book-grouped instances into canonical Bible order (Genesis → Unknown). */
function flattenInstances(trans: TranslationAcc, maxTotal: number): InstanceEntry[] {
  const result: InstanceEntry[] = [];
  for (const book of BOOK_ORDER) {
    for (const inst of trans.instancesByBook.get(book) ?? []) {
      if (result.length >= maxTotal) return result;
      result.push(inst);
    }
  }
  return result;
}

/**
 * Build per-book slot data for overflow files.
 * Returns a map of book abbreviation → { slots, total } where slots mirrors
 * the main slots structure but contains only instances from that book.
 */
function buildOverflowSlots(
  fileName: string,
  data: WordFileAcc,
): Map<string, { slots: Record<string, any>; total: number }> {
  const byBook = new Map<string, { slots: Record<string, any>; total: number }>();
  for (const [grammarCode, slot] of data.slots) {
    for (const [rendering, trans] of slot.translations) {
      for (const [book, instances] of trans.instancesByBook) {
        if (!byBook.has(book)) byBook.set(book, { slots: {}, total: 0 });
        const bk = byBook.get(book)!;
        if (!bk.slots[grammarCode]) {
          bk.slots[grammarCode] = {
            grammarFull: slot.grammarFull,
            grammarFn: slot.grammarFn,
            totalInstances: 0,
            totalTranslations: 0,
            translations: {},
          };
        }
        const sg = bk.slots[grammarCode];
        if (!sg.translations[rendering]) {
          sg.translations[rendering] = { totalInstances: 0, instances: [] };
          sg.totalTranslations++;
        }
        sg.translations[rendering].instances.push(...instances);
        sg.translations[rendering].totalInstances += instances.length;
        sg.totalInstances += instances.length;
        bk.total += instances.length;
      }
    }
  }
  return byBook;
}

/**
 * Build a single flat content object with ALL instances across all sections.
 * Used for the simple-overflow tier (SIMPLE_OVERFLOW_THRESHOLD < total ≤ OVERFLOW_THRESHOLD).
 */
function buildSimpleOverflowContent(
  data: WordFileAcc,
): { slots: Record<string, any>; total: number } {
  const result: { slots: Record<string, any>; total: number } = { slots: {}, total: 0 };
  for (const [grammarCode, slot] of data.slots) {
    for (const [rendering, trans] of slot.translations) {
      if (!result.slots[grammarCode]) {
        result.slots[grammarCode] = {
          grammarFull: slot.grammarFull,
          grammarFn: slot.grammarFn,
          totalInstances: 0,
          totalTranslations: 0,
          translations: {},
        };
      }
      const sg = result.slots[grammarCode];
      const allInstances = flattenInstances(trans, Infinity);
      if (!sg.translations[rendering]) {
        sg.translations[rendering] = { totalInstances: 0, instances: [] };
        sg.totalTranslations++;
      }
      sg.translations[rendering].instances.push(...allInstances);
      sg.translations[rendering].totalInstances = allInstances.length;
      sg.totalInstances += allInstances.length;
      result.total += allInstances.length;
    }
  }
  return result;
}

/** Return an overflow file name by appending `_<suffix>` to the base name. */
function overflowName(baseName: string, suffix: string): string {
  return `${baseName}_${suffix}`;
}
let fileCount = 0;
let overflowFileCount = 0;
let totalInstances = 0;

for (const [fileName, data] of wordFileData) {
  const related = relatedFilesMap.get(fileName) ?? [];
  const crossRefs = crossRefsMap.get(fileName) ?? [];

  // True total instances from running counts
  let fileTotalInstances = 0;
  for (const [grammarCode] of data.slots) {
    fileTotalInstances += grammarRunningCounts.get(`${fileName}::${grammarCode}`) ?? 0;
  }

  const strongsIds = lemmaToStrongsIds.get(data.wordKey) ?? [data.strongsId];
  const fileNumber = strongsIds.indexOf(data.strongsId) + 1;
  const needsSectionOverflow = fileTotalInstances > OVERFLOW_THRESHOLD;
  const needsAnyOverflow = needsSectionOverflow;

  // Build slots for main file
  const slotsOut: Record<string, unknown> = {};
  for (const [grammarCode, slot] of data.slots) {
    const grammarTotal = grammarRunningCounts.get(`${fileName}::${grammarCode}`) ?? 0;
    const translationsOut: Record<string, unknown> = {};
    for (const [rendering, trans] of slot.translations) {
      const transTotal = translationRunningCounts.get(`${fileName}::${grammarCode}::${rendering}`) ?? 0;
      if (needsAnyOverflow) {
        // One representative instance in main file; full content in overflow docs.
        translationsOut[rendering] = {
          totalInstances: transTotal,
          instances: flattenInstances(trans, 1),
        };
      } else {
        // No overflow: store every instance (no cap).
        translationsOut[rendering] = {
          totalInstances: transTotal,
          instances: flattenInstances(trans, Infinity),
        };
      }
    }
    slotsOut[grammarCode] = {
      grammarFull: slot.grammarFull,
      grammarFn: slot.grammarFn,
      totalInstances: grammarTotal,
      totalTranslations: slot.translations.size,
      translations: translationsOut,
    };
  }

  // Generate overflow sub-documents if needed
  let overflowIndex: Record<string, string> | undefined;
  if (needsSectionOverflow) {
    const byBook = buildOverflowSlots(fileName, data);
    const activeBooks = BOOK_ORDER.filter(b => byBook.has(b));
    overflowIndex = {};
    for (const book of activeBooks) {
      const ofName = overflowName(fileName, book);
      const displayName = BOOK_TO_DISPLAY_NAME[book] ?? book;
      overflowIndex[ofName] = displayName;
      const bk = byBook.get(book)!;
      const overflowOut = {
        type: 'overflow',
        overflowFrom: fileName,
        label: displayName,
        ancientWord: {
          _meta: {
            wordKey: data.wordKey,
            strongsId: data.strongsId,
            lang: data.lang,
            lemma: data.lemmaScript,
            ...(data.rootTranslation ? { rootTranslation: data.rootTranslation } : {}),
            ...(data.transliteration ? { transliteration: data.transliteration } : {}),
            totalInstances: bk.total,
            totalSlots: Object.keys(bk.slots).length,
          },
          slots: bk.slots,
        },
      };
      fs.writeFileSync(
        path.join(OUT_DIR, `${ofName}.json`),
        JSON.stringify(overflowOut, null, 2),
        'utf8',
      );
      overflowFileCount++;
    }
  }

  const output = {
    ...(related.length > 0 ? { relatedFiles: related } : {}),
    ...(crossRefs.length > 0 ? { crossRefs } : {}),
    ancientWord: {
      _meta: {
        wordKey: data.wordKey,
        fileNumber,
        strongsId: data.strongsId,
        lang: data.lang,
        lemma: data.lemmaScript,
        ...(data.rootTranslation ? { rootTranslation: data.rootTranslation } : {}),
        ...(data.transliteration ? { transliteration: data.transliteration } : {}),
        totalInstances: fileTotalInstances,
        totalSlots: data.slots.size,
      },
      ...(overflowIndex ? { overflow: overflowIndex } : {}),
      slots: slotsOut,
    },
  };

  fs.writeFileSync(path.join(OUT_DIR, `${fileName}.json`), JSON.stringify(output, null, 2), 'utf8');
  fileCount++;
  totalInstances += fileTotalInstances;
}

// _word_index.json
const wordIndex: Record<string, number> = {};
for (const [lemma, strongsIds] of lemmaToStrongsIds) {
  if (strongsIds.length > 1) wordIndex[lemma] = strongsIds.length;
}
fs.writeFileSync(path.join(OUT_DIR, '_word_index.json'), JSON.stringify(wordIndex, null, 2), 'utf8');

// _strongs_index.json
const strongsIndex: Record<string, string> = {};
for (const [sid, fn] of strongsToFile) strongsIndex[sid] = fn;
fs.writeFileSync(path.join(OUT_DIR, '_strongs_index.json'), JSON.stringify(strongsIndex, null, 2), 'utf8');

console.log(`Wrote ${fileCount} word files (+${overflowFileCount} overflow)`);
console.log(`_word_index.json: ${Object.keys(wordIndex).length} multi-file words`);
console.log(`_strongs_index.json: ${Object.keys(strongsIndex).length} Strongs mappings`);
console.log(`Total instance references: ${totalInstances}`);

// Copy _word_index.json to public/ so it's served by the main wrangler deploy
// at https://servewell.net/_word_index.json — used by the client-side search module.
{
  const publicDir = path.join(ROOT, 'public');
  const src = path.join(OUT_DIR, '_word_index.json');
  const dest = path.join(publicDir, '_word_index.json');
  fs.copyFileSync(src, dest);
  console.log('Copied _word_index.json → public/_word_index.json');
}

// Report Strongs IDs with no lexicon coverage (not even via base-strip fallback)
{
  const noLexicon: string[] = [];
  for (const [fileName, data] of wordFileData) {
    if (!lexiconTranslit(data.strongsId)) noLexicon.push(`${data.strongsId} (${fileName})`);
  }
  if (noLexicon.length > 0) {
    console.log(`\nStrongs IDs with no lexicon transliteration (${noLexicon.length}); morpheme fallback used:`);
    console.log('  ' + noLexicon.slice(0, 20).join(', ') + (noLexicon.length > 20 ? `, ... +${noLexicon.length - 20} more` : ''));
  } else {
    console.log('All Strongs IDs resolved via lexicon transliteration.');
  }
}

// ---------------------------------------------------------------------------
// Annotate Phase 2 chapter morphemes with OccurrencesFile
// ---------------------------------------------------------------------------
console.log('Annotating Phase 2 chapter morphemes with OccurrencesFile...');
let annotatedFiles = 0;
let annotatedMorphemeCount = 0;

for (const filePath of allFiles) {
  let rawObj: Record<string, unknown>;
  try {
    rawObj = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  } catch { continue; }

  // Handle optional .default wrapper (matches readChapter logic)
  const chapterTarget =
    (rawObj['default'] as Record<string, unknown> | undefined) ?? rawObj;
  const snips = chapterTarget['SnippetsAndExplanations'];
  if (!Array.isArray(snips)) continue;

  let changed = false;
  for (const snippet of snips as Record<string, unknown>[]) {
    const morphemes = snippet['OriginalMorphemes'];
    if (!Array.isArray(morphemes)) continue;
    for (const morph of morphemes as Record<string, unknown>[]) {
      const sid = morph['OriginalRootStrongsID'] as string | undefined;
      if (!sid) continue;
      const fn = strongsToFile.get(sid);
      if (!fn) continue;
      if (morph['OccurrencesFile'] !== fn) {
        morph['OccurrencesFile'] = fn;
        changed = true;
        annotatedMorphemeCount++;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(rawObj, null, 2), 'utf8');
    annotatedFiles++;
  }
}
console.log(`Annotated ${annotatedMorphemeCount} morphemes across ${annotatedFiles} chapter files`);

// Write a content fingerprint so pre-deploy can detect if word pages need R2 sync.
// Uses file count + total JSON bytes — changes whenever word content changes.
// Compared against dist/.words-r2-synced-fingerprint written by deploy:words-r2.
{
  const jsonFiles = fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.json'));
  let totalBytes = 0;
  for (const f of jsonFiles) totalBytes += fs.statSync(path.join(OUT_DIR, f)).size;
  const fingerprint = `${jsonFiles.length}:${totalBytes}`;
  const distDir = path.join(ROOT, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(path.join(distDir, '.words-content-fingerprint'), fingerprint, 'utf8');
}
