import type { AppModule } from './createModuleRegistry';
import {
  type TokenResolution,
  type WordIndex,
  resolveToken,
  parseQueryTokens,
  sortByRarity,
} from './wordSearchLogic';
import {
  type LoadedWordData,
  WORDS_BASE_URL,
  loadIndex,
  prefetchIndex,
  fetchLemmaFiles,
  getIndexSync,
  isIndexLoadFailed,
  getTradIndexSync,
  loadTradIndex,
  prefetchTradIndex,
} from './wordSearchFetch';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POPOVER_ID        = 'ws-search-popover';
const INPUT_ID          = 'ws-search-input';
const RESULTS_ID        = 'ws-search-results';
const TOPBAR_BTN_ID     = 'ws-search-topbar-btn';
const BOTTOMBAR_BTN_ID  = 'ws-search-bottombar-btn';
const MAX_DISPLAYED     = 50;

// ---------------------------------------------------------------------------
// Book-code → display name (mirrors wordPageEntry.ts)
// ---------------------------------------------------------------------------

const BOOK_DISPLAY: Record<string, string> = {
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
const BOOK_ALIASES: Record<string, string> = { Ezk: 'Eze', Jol: 'Joe', Sng: 'Sol', Nam: 'Nah' };
const BOOK_ORDER: Record<string, number> = Object.fromEntries(Object.keys(BOOK_DISPLAY).map((k, i) => [k, i]));

// ---------------------------------------------------------------------------
// Reverse lookup: user-typed name/abbreviation → canonical book code
// ---------------------------------------------------------------------------

// Each entry: lowercased alias → canonical code in BOOK_DISPLAY
const BOOK_NAME_TO_CODE: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  const add = (alias: string, code: string) => { m[alias.toLowerCase()] = code; };

  // Canonical codes and display names auto-populated
  for (const [code, name] of Object.entries(BOOK_DISPLAY)) {
    add(code, code);
    add(name, code);
    // "1 Kings" → also "1kings"
    add(name.replace(/\s+/g, ''), code);
  }
  // Also register BOOK_ALIASES keys
  for (const [alias, code] of Object.entries(BOOK_ALIASES)) add(alias, code);

  // Common abbreviations not covered by the 3-letter codes
  const extras: Array<[string, string]> = [
    // OT
    ['ge', 'Gen'], ['gn', 'Gen'],
    ['ex', 'Exo'], ['exod', 'Exo'],
    ['lv', 'Lev'],
    ['nm', 'Num'], ['nb', 'Num'],
    ['dt', 'Deu'], ['deut', 'Deu'],
    ['josh', 'Jos'],
    ['judg', 'Jdg'], ['jg', 'Jdg'],
    ['ru', 'Rut'],
    ['1sam', '1Sa'], ['1 sam', '1Sa'], ['i sam', '1Sa'], ['i samuel', '1Sa'],
    ['2sam', '2Sa'], ['2 sam', '2Sa'], ['ii sam', '2Sa'], ['ii samuel', '2Sa'],
    ['1kgs', '1Ki'], ['1 kgs', '1Ki'], ['i kgs', '1Ki'], ['i kings', '1Ki'],
    ['2kgs', '2Ki'], ['2 kgs', '2Ki'], ['ii kgs', '2Ki'], ['ii kings', '2Ki'],
    ['1chr', '1Ch'], ['1 chr', '1Ch'], ['1chron', '1Ch'], ['i chronicles', '1Ch'],
    ['2chr', '2Ch'], ['2 chr', '2Ch'], ['2chron', '2Ch'], ['ii chronicles', '2Ch'],
    ['ezra', 'Ezr'],
    ['neh', 'Neh'],
    ['esth', 'Est'],
    ['ps', 'Psa'], ['pss', 'Psa'], ['psalm', 'Psa'],
    ['prov', 'Pro'], ['pv', 'Pro'],
    ['eccl', 'Ecc'], ['qoh', 'Ecc'],
    ['song', 'Sol'], ['ss', 'Sol'], ['sg', 'Sol'],
    ['song of solomon', 'Sol'], ['canticles', 'Sol'], ['cant', 'Sol'],
    ['isa', 'Isa'],
    ['jer', 'Jer'],
    ['lam', 'Lam'],
    ['ezek', 'Eze'],
    ['dan', 'Dan'],
    ['hos', 'Hos'],
    ['joel', 'Joe'],
    ['amos', 'Amo'],
    ['obad', 'Oba'],
    ['jonah', 'Jon'],
    ['mic', 'Mic'],
    ['nah', 'Nah'],
    ['hab', 'Hab'],
    ['zeph', 'Zep'],
    ['hag', 'Hag'],
    ['zech', 'Zec'],
    ['mal', 'Mal'],
    // NT
    ['matt', 'Mat'], ['mt', 'Mat'],
    ['mk', 'Mrk'], ['mar', 'Mrk'],
    ['lk', 'Luk'],
    ['jn', 'Jhn'], ['joh', 'Jhn'],
    ['acts', 'Act'],
    ['rom', 'Rom'],
    ['1cor', '1Co'], ['1 cor', '1Co'], ['i cor', '1Co'], ['i corinthians', '1Co'],
    ['2cor', '2Co'], ['2 cor', '2Co'], ['ii cor', '2Co'], ['ii corinthians', '2Co'],
    ['gal', 'Gal'],
    ['eph', 'Eph'],
    ['phil', 'Php'], ['php', 'Php'],
    ['col', 'Col'],
    ['1th', '1Th'], ['1 th', '1Th'], ['1thess', '1Th'], ['i thess', '1Th'],
    ['2th', '2Th'], ['2 th', '2Th'], ['2thess', '2Th'], ['ii thess', '2Th'],
    ['1tim', '1Ti'], ['1 tim', '1Ti'], ['i tim', '1Ti'], ['i timothy', '1Ti'],
    ['2tim', '2Ti'], ['2 tim', '2Ti'], ['ii tim', '2Ti'], ['ii timothy', '2Ti'],
    ['titus', 'Tit'],
    ['philem', 'Phm'], ['phlm', 'Phm'],
    ['heb', 'Heb'],
    ['jas', 'Jas'],
    ['1pt', '1Pe'], ['1 pet', '1Pe'], ['i pet', '1Pe'], ['i peter', '1Pe'],
    ['2pt', '2Pe'], ['2 pet', '2Pe'], ['ii pet', '2Pe'], ['ii peter', '2Pe'],
    ['1jn', '1Jn'], ['1 jn', '1Jn'], ['i jn', '1Jn'], ['i john', '1Jn'],
    ['2jn', '2Jn'], ['2 jn', '2Jn'], ['ii jn', '2Jn'], ['ii john', '2Jn'],
    ['3jn', '3Jn'], ['3 jn', '3Jn'], ['iii jn', '3Jn'], ['iii john', '3Jn'],
    ['jude', 'Jud'],
    ['rev', 'Rev'], ['apoc', 'Rev'],
  ];
  for (const [alias, code] of extras) add(alias, code);
  return m;
})();

/**
 * Try to parse the query as a verse reference like "Gen 1:1", "1 Kings 3:5", "Ps 23".
 * Returns { url, display } if matched, null otherwise.
 */
function parseVerseRefQuery(query: string): { url: string; display: string } | null {
  const q = query.trim();
  // Match: optional leading number + book name + whitespace + chapter + optional :verse + optional -endVerse
  // Also accept period as chapter/verse separator e.g. "Gen 1.1"
  const m = q.match(/^((?:\d\s*)?[a-z\s]+?)\s+(\d+)(?:[:.]\s*(\d+)(?:\s*[-\u2013\u2014]\s*(\d+))?)?$/i);
  if (!m) return null;
  const bookRaw = m[1].trim().toLowerCase();
  const chapter = parseInt(m[2], 10);
  const verse = m[3] ? parseInt(m[3], 10) : null;
  const endVerse = m[4] ? parseInt(m[4], 10) : null;

  const code = BOOK_NAME_TO_CODE[bookRaw];
  if (!code) return null;
  const bookName = BOOK_DISPLAY[code];
  if (!bookName) return null;

  let anchor = '';
  let displaySuffix = '';
  if (verse !== null) {
    anchor = endVerse !== null ? `#${verse}-${endVerse}` : `#${verse}`;
    displaySuffix = endVerse !== null ? `:${verse}-${endVerse}` : `:${verse}`;
  }

  const url = `https://servewell.net/-/${bookName.replace(/\s+/g, '-')}/${chapter}${anchor}`;
  const display = `${bookName} ${chapter}${displaySuffix}`;
  return { url, display };
}

function sortCanonical(refs: string[]): string[] {
  return [...refs].sort((a, b) => {
    const ma = a.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
    const mb = b.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
    const ai = ma ? (BOOK_ORDER[BOOK_ALIASES[ma[1]] ?? ma[1]] ?? 999) : 999;
    const bi = mb ? (BOOK_ORDER[BOOK_ALIASES[mb[1]] ?? mb[1]] ?? 999) : 999;
    return (ai - bi) || (parseInt(ma?.[2] ?? '0') - parseInt(mb?.[2] ?? '0')) || (parseInt(ma?.[3] ?? '0') - parseInt(mb?.[3] ?? '0'));
  });
}

function formatVerseRef(ref: string): string {
  const m = ref.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
  if (!m) return ref;
  const code = BOOK_ALIASES[m[1]] ?? m[1];
  return `${BOOK_DISPLAY[code] ?? m[1]} ${m[2]}:${m[3]}`;
}

function verseUrl(ref: string): string | null {
  const m = ref.match(/^([0-9]?[A-Za-z]+)(\d+):(\d+)/);
  if (!m) return null;
  const code = BOOK_ALIASES[m[1]] ?? m[1];
  const bookName = BOOK_DISPLAY[code];
  if (!bookName) return null;
  return `https://servewell.net/-/${bookName.replace(/\s+/g, '-')}/${m[2]}#${m[3]}`;
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STYLES = `
#ws-search-popover {
  position: fixed;
  top: 62px;
  right: 0.75rem;
  left: 0.75rem;
  width: min(calc(100vw - 1.5rem), 380px);
  box-sizing: border-box;
}
@media (min-width: 540px) {
  #ws-search-popover {
    left: auto;
  }
  #ws-search-input { font-size: 1.05rem; }
  #ws-search-status { font-size: 0.88rem; }
  .ws-sr-verse-link { font-size: 0.97rem; }
  .ws-sr-word-link { font-size: 1rem; }
  #ws-see-text-bar { font-size: 0.85rem; }
  .ws-sr-verse-text { font-size: 0.84rem; }
}
#ws-search-popover {
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--panel);
  padding: 0.65rem 0.75rem 0.5rem;
  margin: 0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  display: flex;
  flex-direction: column;
  gap: 0;
}
#ws-search-popover:not(:popover-open) { display: none; }

#ws-search-input {
  width: 100%;
  font-size: 0.97rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  background: var(--bg);
  color: var(--fg);
  box-sizing: border-box;
}

#ws-search-status {
  font-size: 0.8rem;
  color: var(--muted);
  min-height: 1.3em;
  padding: 0.25rem 0.1rem 0.1rem;
}

#ws-search-results {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 55vh;
  overflow-y: auto;
  overscroll-behavior: contain;
}

#ws-search-results li {
  border-top: 1px solid var(--border);
}
#ws-search-results:empty { border: none; }

.ws-sr-verse-link {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.4rem 0.4rem;
  text-decoration: none;
  color: var(--fg);
  font-size: 0.88rem;
}
.ws-sr-verse-link:hover, .ws-sr-verse-link:focus {
  background: var(--bg);
  border-radius: 0.3rem;
}
.ws-sr-ref { font-weight: 600; white-space: nowrap; }
.ws-sr-hint {
  font-size: 0.78rem;
  color: var(--muted);
  padding: 0.35rem 0.4rem 0.1rem;
  font-style: italic;
  border-top: none !important;
}
.ws-sr-word-link {
  display: block;
  padding: 0.38rem 0.4rem;
  border-radius: 0.35rem;
  text-decoration: none;
  color: var(--fg);
  font-size: 0.9rem;
}
.ws-sr-word-link:hover, .ws-sr-word-link:focus { background: var(--bg); }
.ws-sr-count {
  font-size: 0.78em;
  color: var(--muted);
  margin-left: 0.35em;
}
#ws-see-text-bar {
  font-size: 0.78rem;
  color: var(--muted);
  padding: 0.15rem 0.1rem 0;
  display: flex;
  gap: 0.6rem;
  align-items: center;
}
#ws-see-text-bar label { cursor: pointer; user-select: none; display: inline-flex; align-items: center; gap: 0.3em; }
.ws-sr-verse-text {
  font-size: 0.76rem;
  padding: 0.15rem 0.4rem 0.3rem;
  color: var(--muted);
  line-height: 1.55;
}
.ws-sr-trad { font-size: 0.9rem; }
.ws-sr-nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.4rem;
  text-decoration: none;
  color: var(--fg);
  font-size: 0.9rem;
  font-weight: 600;
}
.ws-sr-nav-link:hover, .ws-sr-nav-link:focus { background: var(--bg); border-radius: 0.3rem; }
.ws-sr-nav-link::before { content: '→'; color: var(--muted); font-weight: 400; }
.ws-sr-partial .ws-sr-ref { font-weight: 400; }
.ws-sr-partial { opacity: 0.7; }
.ws-sr-verse-text mark {
  background: #ffe08a;
  color: #1a1a1a;
  border-radius: 0.1em;
  padding: 0 0.1em;
}
:root[data-theme="dark"] .ws-sr-verse-text mark {
  background: #7a5f00;
  color: #f5e6a3;
}
`;

// ---------------------------------------------------------------------------
// DOM injection — run once on first activate
// ---------------------------------------------------------------------------

let injected = false;

function injectOnce(): void {
  if (injected) return;
  injected = true;

  if (!document.getElementById('ws-search-styles')) {
    const style = document.createElement('style');
    style.id = 'ws-search-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  if (!document.getElementById(POPOVER_ID)) {
    const popover = document.createElement('div');
    popover.id = POPOVER_ID;
    popover.setAttribute('popover', '');
    popover.innerHTML = `
<input id="${INPUT_ID}" type="search" placeholder="Search Bible words…" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Search Bible words">
<div id="ws-search-status" aria-live="polite"></div><div id="ws-see-text-bar">Show: <label><input type="checkbox" id="ws-show-lit"> Literal</label> <label><input type="checkbox" id="ws-show-trad"> Traditional</label></div><ul id="${RESULTS_ID}" role="list" aria-label="Search results"></ul>`;
    document.body.appendChild(popover);
  }

  // Wire popovertarget on both search buttons so browser handles open/close/dismiss.
  for (const id of [TOPBAR_BTN_ID, BOTTOMBAR_BTN_ID]) {
    document.getElementById(id)?.setAttribute('popovertarget', POPOVER_ID);
  }

  document.getElementById(POPOVER_ID)?.addEventListener('toggle', (e) => {
    if ((e as ToggleEvent).newState === 'open') {
      setTimeout(() => (document.getElementById(INPUT_ID) as HTMLInputElement | null)?.focus(), 30);
      prefetchIndex();
      prefetchTradIndex();
    } else {
      // Clear on close so it's fresh next open.
      const inp = document.getElementById(INPUT_ID) as HTMLInputElement | null;
      if (inp) inp.value = '';
      clearDisplay();
    }
  });

  document.getElementById(INPUT_ID)?.addEventListener('input', (e) => {
    handleInput((e.target as HTMLInputElement).value);
  });
  document.getElementById(INPUT_ID)?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && currentVerseUrl) {
      e.preventDefault();
      window.location.href = currentVerseUrl;
    }
  });
  for (const id of ['ws-show-lit', 'ws-show-trad']) {
    document.getElementById(id)?.addEventListener('change', () => { void updateVerseText(); });
  }
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function setStatus(msg: string): void {
  const el = document.getElementById('ws-search-status');
  if (el) el.textContent = msg;
}

function clearDisplay(): void {
  const ul = document.getElementById(RESULTS_ID);
  if (ul) ul.innerHTML = '';
  setStatus('');
  currentAllRenderingsByVerse = new Map();
  currentLitByVerse = new Map();
  currentTradByVerse = new Map();
  currentVerseUrl = null;
  for (const id of ['ws-show-lit', 'ws-show-trad']) {
    const cb = document.getElementById(id) as HTMLInputElement | null;
    if (cb) cb.checked = false;
  }
}

/** Fallback: show word-index entry links when no verse data. */
function showWordLinks(matches: string[], idx: WordIndex): void {
  const ul = document.getElementById(RESULTS_ID);
  if (!ul) return;
  ul.innerHTML = matches.map((lemma) => {
    const count = idx[lemma];
    const countHtml = count && count > 1 ? `<span class="ws-sr-count">(${count} forms)</span>` : '';
    const url = `${WORDS_BASE_URL}/${encodeURIComponent(lemma)}`;
    return `<li><a class="ws-sr-word-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(lemma)}${countHtml}</a></li>`;
  }).join('');
}

/** Render verse result rows. Optional wordStudyHtml is prepended before verse items (for single-word queries). */
function showVerseResults(
  verseRefs: string[],
  primaryLemma: string,
  resolvedCount: number,
  hasOverflow: boolean,
  wordStudyHtml = '',
  partialRefs: string[] = [],
): void {
  const ul = document.getElementById(RESULTS_ID);
  if (!ul) return;

  const slice = verseRefs.slice(0, MAX_DISPLAYED);
  const items = slice.map((vr) => {
    const display = formatVerseRef(vr);
    const url = verseUrl(vr);
    const textDivs = `<div class="ws-sr-verse-text ws-sr-lit" hidden></div><div class="ws-sr-verse-text ws-sr-trad" hidden></div>`;
    return url
      ? `<li data-vr="${esc(vr)}"><a class="ws-sr-verse-link" href="${esc(url)}"><span class="ws-sr-ref">${esc(display)}</span></a>${textDivs}</li>`
      : `<li data-vr="${esc(vr)}"><span class="ws-sr-verse-link"><span class="ws-sr-ref">${esc(display)}</span></span>${textDivs}</li>`;
  }).join('');

  const overflow = hasOverflow ? '+' : '';
  const hint = verseRefs.length > MAX_DISPLAYED
    ? `<li class="ws-sr-hint">Showing ${MAX_DISPLAYED} of ${verseRefs.length}${overflow} — keep typing to narrow down</li>`
    : '';
  const versesHint = wordStudyHtml && verseRefs.length > 0
    ? `<li class="ws-sr-hint">Matching verses:</li>`
    : '';

  // Partial matches section: shown when multi-word search yields < 10 exact results
  const showPartials = resolvedCount > 1 && verseRefs.length < 10 && partialRefs.length > 0;
  const partialSection = showPartials
    ? `<li class="ws-sr-hint">Partial Matches:</li>` +
      partialRefs.slice(0, 20).map((vr) => {
        const display = formatVerseRef(vr);
        const url = verseUrl(vr);
        const textDivs = `<div class="ws-sr-verse-text ws-sr-lit" hidden></div><div class="ws-sr-verse-text ws-sr-trad" hidden></div>`;
        return url
          ? `<li data-vr="${esc(vr)}"><a class="ws-sr-verse-link ws-sr-partial" href="${esc(url)}"><span class="ws-sr-ref">${esc(display)}</span></a>${textDivs}</li>`
          : `<li data-vr="${esc(vr)}"><span class="ws-sr-verse-link ws-sr-partial"><span class="ws-sr-ref">${esc(display)}</span></span>${textDivs}</li>`;
      }).join('')
    : '';

  ul.innerHTML = wordStudyHtml + versesHint + items + hint + partialSection;

  const overflowNote = '';
  if (resolvedCount > 1) {
    setStatus(`${verseRefs.length}${overflow} verses match all terms`);
  } else {
    setStatus(`${verseRefs.length}${overflow} verses for "${primaryLemma}"${verseRefs.length ? ' — type more words to narrow' : ''}`);
  }
  const litCb = document.getElementById('ws-show-lit') as HTMLInputElement | null;
  const tradCb = document.getElementById('ws-show-trad') as HTMLInputElement | null;
  if (litCb?.checked || tradCb?.checked) { void updateVerseText(); }
}

// ---------------------------------------------------------------------------
// Active search — cancel stale searches on new input
// ---------------------------------------------------------------------------

let activeSearchId = 0;
let currentAllRenderingsByVerse = new Map<string, Set<string>>();
let currentLitByVerse = new Map<string, string>();
let currentTradByVerse = new Map<string, string>();
let currentVerseUrl: string | null = null;
// Raw words typed by the user (before stop-word filtering/lemmatization).
// Used to highlight exactly what was typed (e.g. "stones" even if lemma is "stone").
let currentRawTerms: string[] = [];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightRenderings(text: string, renderings: Set<string>): string {
  let result = esc(text);
  for (const rendering of renderings) {
    const cleaned = rendering.replace(/<[^>]*>/g, ' ').replace(/\[[^\]]*\]/g, ' ')
      .replace(/[^a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned.length < 2) continue;
    try {
      result = result.replace(new RegExp(`\\b(${escapeRegex(cleaned)})\\b`, 'gi'), '<mark>$1</mark>');
    } catch { /* ignore bad patterns */ }
  }
  return result;
}

async function updateVerseText(): Promise<void> {
  const ul = document.getElementById(RESULTS_ID);
  if (!ul) return;
  const showLit = (document.getElementById('ws-show-lit') as HTMLInputElement | null)?.checked ?? false;
  const showTrad = (document.getElementById('ws-show-trad') as HTMLInputElement | null)?.checked ?? false;
  for (const li of ul.querySelectorAll<HTMLLIElement>('li[data-vr]')) {
    const vr = li.dataset.vr ?? '';
    const renderings = new Set([...( currentAllRenderingsByVerse.get(vr) ?? []), ...currentRawTerms]);
    const litDiv = li.querySelector<HTMLDivElement>('.ws-sr-lit');
    const tradDiv = li.querySelector<HTMLDivElement>('.ws-sr-trad');
    if (litDiv) {
      if (showLit) {
        if (!litDiv.dataset.loaded) {
          const text = currentLitByVerse.get(vr) ?? '';
          litDiv.innerHTML = text ? highlightRenderings(text, renderings) : '';
          litDiv.dataset.loaded = '1';
        }
        litDiv.removeAttribute('hidden');
      } else {
        litDiv.setAttribute('hidden', '');
      }
    }
    if (tradDiv) {
      if (showTrad) {
        if (!tradDiv.dataset.loaded) {
          const text = currentTradByVerse.get(vr) ?? '';
          tradDiv.innerHTML = text ? highlightRenderings(text, renderings) : '';
          tradDiv.dataset.loaded = '1';
        }
        tradDiv.removeAttribute('hidden');
      } else {
        tradDiv.setAttribute('hidden', '');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Core search pipeline
// ---------------------------------------------------------------------------

async function handleInput(rawQuery: string): Promise<void> {
  const searchId = ++activeSearchId;
  const query = rawQuery.trim();
  if (!query) { clearDisplay(); return; }
  currentRawTerms = query.split(/\s+/).filter(Boolean).map(t => t.toLowerCase());
  currentAllRenderingsByVerse = new Map();

  // Check for verse reference before hitting the word index
  const verseRef = parseVerseRefQuery(query);
  if (verseRef) {
    currentVerseUrl = verseRef.url;
    const ul = document.getElementById(RESULTS_ID);
    if (ul) ul.innerHTML = `<li><a class="ws-sr-nav-link" href="${esc(verseRef.url)}">${esc(verseRef.display)}</a></li>`;
    setStatus('Go to verse');
    return;
  }
  currentVerseUrl = null;

  // Ensure index is available
  let idx = getIndexSync();
  if (!idx) {
    if (isIndexLoadFailed()) { setStatus('Search index unavailable.'); return; }
    setStatus('Loading index…');
    idx = await loadIndex();
    if (searchId !== activeSearchId) return;
    if (!idx) { setStatus('Search index unavailable.'); return; }
  }

  const tokens = parseQueryTokens(query);

  // Resolve each token to a lemma (or ambiguous candidates)
  const resolutions = tokens.map((t) => ({ token: t, res: resolveToken(t, idx!) }));

  // For unresolved or ambiguous tokens, check the trad index for an exact match.
  // Ambiguous case matters for short words like "dim" which may prefix-match
  // multiple word-index entries but have a distinct trad index entry.
  const tradIdx = getTradIndexSync();
  if (tradIdx) {
    for (const r of resolutions) {
      if (r.res.kind === 'unresolved' || r.res.kind === 'ambiguous') {
        const raw = tradIdx[r.token];
        if (!raw) continue;
        // Trad index targets may be file names (e.g. "faint_3") rather than
        // base lemma keys — strip the _N suffix when the key isn't in the index.
        const target: string = raw in idx! ? raw : raw.replace(/_\d+$/, '');
        if (target && target in idx!) r.res = { kind: 'resolved', lemma: target };
      }
    }
  }

  const resolvedLemmas = resolutions
    .filter((r) => r.res.kind === 'resolved')
    .map((r) => (r.res as { kind: 'resolved'; lemma: string }).lemma);

  // Nothing resolved yet — show suggestion links for the last partial token
  if (resolvedLemmas.length === 0) {
    const lastRes = resolutions[resolutions.length - 1]?.res;
    if (lastRes?.kind === 'ambiguous') {
      showWordLinks(lastRes.candidates.slice(0, 8), idx);
      setStatus('');
    } else {
      clearDisplay();
      setStatus('No matching words found.');
    }
    return;
  }

  // Sort: rarest first (fewest files → least data to transfer, most specific results)
  const sorted = sortByRarity(resolvedLemmas, idx);
  const primary = sorted[0];

  setStatus(`Searching "${sorted.join(' + ')}"…`);

  // Launch all fetches in parallel immediately; use primary result first
  const fetchPromises = new Map(sorted.map((lemma) => [lemma, fetchLemmaFiles(lemma, idx!)]));

  // Wait for the primary (rarest) word
  const primaryResult = await fetchPromises.get(primary)!;
  if (searchId !== activeSearchId) return;

  if (!primaryResult || primaryResult.verseSet.size === 0) {
    clearDisplay();
    setStatus(`No verse data found for "${primary}".`);
    return;
  }

  // For multi-word search, intersect using primaryVerseSet (primary files only, no crossRefs)
  // to avoid crossRef breadth causing false positives. For single-word, use full verseSet.
  const isSingleWord = sorted.length === 1;
  let currentSet: Set<string> = isSingleWord ? primaryResult.verseSet : primaryResult.primaryVerseSet;
  // Union of all words' primaryVerseSets — used to compute partial matches.
  const unionSet = new Set<string>(isSingleWord ? [] : primaryResult.primaryVerseSet);
  let anyOverflow = primaryResult.hasOverflow;

  currentLitByVerse = new Map(primaryResult.litByVerse);
  currentTradByVerse = new Map(primaryResult.tradByVerse);
  for (const [vr, r] of primaryResult.sampleByVerse) {
    currentAllRenderingsByVerse.set(vr, new Set([r, ...sorted]));
  }

  let wordStudyHtml = '';
  if (sorted.length === 1) {
    const wsUrl = `${WORDS_BASE_URL}/${encodeURIComponent(primary)}`;
    const count = idx![primary];
    const countHtml = count && count > 1 ? `<span class="ws-sr-count">(${count} forms)</span>` : '';
    wordStudyHtml = `<li><a class="ws-sr-word-link" href="${esc(wsUrl)}" target="_blank" rel="noopener">${esc(primary)}${countHtml}</a></li>`;
  }
  // Collect fetched results — needed for trad-text scoring after all loads finish.
  const collectedResults = new Map<string, Awaited<ReturnType<typeof fetchLemmaFiles>>>();
  collectedResults.set(primary, primaryResult);

  // Simple partials: union minus exact set, canonical order. Used during progressive loading.
  const computePartials = () =>
    sorted.length > 1
      ? sortCanonical([...unionSet].filter(vr => !currentSet.has(vr))).slice(0, 20)
      : [];

  // Scored partials: rank remaining union verses by how many raw tokens appear in their
  // trad text, then sort score-desc / canonical-within-score. Used for the final render.
  const computeScoredPartials = () => {
    if (sorted.length <= 1) return [];
    const tradPatterns = currentRawTerms.map(t => new RegExp(`\\b${escapeRegex(t)}\\b`, 'i'));
    const scored = [...unionSet]
      .filter(vr => !currentSet.has(vr))
      .map(vr => {
        let trad = currentTradByVerse.get(vr) ?? '';
        if (!trad) {
          for (const [, r] of collectedResults) {
            trad = r.tradByVerse.get(vr) ?? '';
            if (trad) break;
          }
        }
        return { vr, score: tradPatterns.filter(re => re.test(trad)).length };
      })
      .filter(s => s.score > 0);
    scored.sort((a, b) =>
      (b.score - a.score) ||
      (sortCanonical([a.vr, b.vr])[0] === a.vr ? -1 : 1)
    );
    return scored.slice(0, 20).map(s => s.vr);
  };

  showVerseResults(sortCanonical([...currentSet]), primary, sorted.length > 1 ? 0 : 1, anyOverflow, wordStudyHtml, computePartials());

  if (sorted.length > 1) {
    const remaining = sorted.slice(1);
    await Promise.all(remaining.map(async (lemma) => {
      const result = await fetchPromises.get(lemma)!;
      if (searchId !== activeSearchId) return;
      if (!result) return;

      collectedResults.set(lemma, result);
      const narrowed = new Set<string>();
      for (const vr of currentSet) {
        if (result.primaryVerseSet.has(vr)) narrowed.add(vr);
      }
      currentSet = narrowed;
      for (const vr of result.primaryVerseSet) unionSet.add(vr);
      if (result.hasOverflow) anyOverflow = true;
      for (const [vr, r] of result.sampleByVerse) {
        const s = currentAllRenderingsByVerse.get(vr);
        if (s) s.add(r); else currentAllRenderingsByVerse.set(vr, new Set([r]));
      }
      for (const [vr, lit] of result.litByVerse) {
        if (!currentLitByVerse.has(vr)) currentLitByVerse.set(vr, lit);
      }
      for (const [vr, trad] of result.tradByVerse) {
        if (!currentTradByVerse.has(vr)) currentTradByVerse.set(vr, trad);
      }
      if (searchId !== activeSearchId) return;
      showVerseResults(sortCanonical([...currentSet]), primary, sorted.length, anyOverflow, '', computePartials());
    }));

    // Trad-text expansion: when the exact lemma intersection is sparse (< 10),
    // sweep each lemma's tradByVerse for verses whose full sentence text contains
    // ALL raw typed tokens as whole words. This catches cases where the traditional
    // translation uses different words than the lemma key (e.g. "abundance" is
    // translated as "common" in 1Ki 10:27).
    if (searchId !== activeSearchId) return;
    if (currentSet.size < 10) {
      const tradPatterns = currentRawTerms.map(t => new RegExp(`\\b${escapeRegex(t)}\\b`, 'i'));
      const tradExpanded = new Set<string>();
      for (const [, result] of collectedResults) {
        for (const [vr, trad] of result.tradByVerse) {
          if (!trad || currentSet.has(vr) || tradExpanded.has(vr)) continue;
          if (tradPatterns.every(re => re.test(trad))) tradExpanded.add(vr);
        }
      }
      if (tradExpanded.size > 0) {
        for (const vr of tradExpanded) currentSet.add(vr);
        // Ensure lit/trad maps are populated for newly added verses.
        for (const [, result] of collectedResults) {
          for (const [vr, lit] of result.litByVerse) {
            if (!currentLitByVerse.has(vr)) currentLitByVerse.set(vr, lit);
          }
          for (const [vr, trad] of result.tradByVerse) {
            if (!currentTradByVerse.has(vr)) currentTradByVerse.set(vr, trad);
          }
        }
      }
    }
    // Final render: exact+expanded results with scored partials (score-desc, then canonical).
    if (searchId !== activeSearchId) return;
    showVerseResults(sortCanonical([...currentSet]), primary, sorted.length, anyOverflow, '', computeScoredPartials());
  }
}

// ---------------------------------------------------------------------------
// Module export
// ---------------------------------------------------------------------------

export function createWordSearchModule(): AppModule {
  const disposers: Array<() => void> = [];

  return {
    id: 'word-search',
    label: 'Word search',
    active: false,
    includeInMenu: false,

    activate() {
      if (this.active) return;
      this.active = true;

      injectOnce();

      // Keyboard shortcut: Cmd/Ctrl+K or /
      const keydownHandler = (e: KeyboardEvent) => {
        if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
          const active = document.activeElement;
          if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
          e.preventDefault();
          (document.getElementById(POPOVER_ID) as any)?.showPopover?.();
        }
      };
      document.addEventListener('keydown', keydownHandler);
      disposers.push(() => document.removeEventListener('keydown', keydownHandler));

      // Prefetch word index on idle, trad index a beat later so it doesn't
      // compete with the primary index fetch on page load.
      if (typeof requestIdleCallback !== 'undefined') {
        const handle = requestIdleCallback(() => {
          prefetchIndex();
          // Schedule trad index after the current idle period so the more
          // critical word index gets first use of the network.
          setTimeout(() => prefetchTradIndex(), 500);
        });
        disposers.push(() => (typeof cancelIdleCallback !== 'undefined' ? cancelIdleCallback(handle) : undefined));
      } else {
        setTimeout(() => prefetchIndex(), 300);
        setTimeout(() => prefetchTradIndex(), 1000);
      }
    },

    deactivate() {
      if (!this.active) return;
      this.active = false;
      while (disposers.length) disposers.pop()?.();
      (document.getElementById(POPOVER_ID) as any)?.hidePopover?.();
    },
  };
}
