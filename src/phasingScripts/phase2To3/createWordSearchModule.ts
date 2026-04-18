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
#ws-see-text-bar label { cursor: pointer; user-select: none; }
.ws-sr-verse-text {
  font-size: 0.76rem;
  padding: 0.15rem 0.4rem 0.3rem;
  color: var(--muted);
  line-height: 1.55;
}
.ws-sr-trad { font-size: 0.9rem; }
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
<div id="ws-search-status" aria-live="polite"></div><div id="ws-see-text-bar">Show: <label>Lit <input type="checkbox" id="ws-show-lit"></label> <label>Trad <input type="checkbox" id="ws-show-trad"></label></div><ul id="${RESULTS_ID}" role="list" aria-label="Search results"></ul>`;
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

/** Render verse result rows. */
function showVerseResults(
  verseRefs: string[],
  primaryLemma: string,
  resolvedCount: number,
  hasOverflow: boolean,
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

  ul.innerHTML = items + hint;

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
    const renderings = currentAllRenderingsByVerse.get(vr) ?? new Set<string>();
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
  currentAllRenderingsByVerse = new Map();

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
      setStatus(tokens.length > 0 ? 'No matching words found.' : '');
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
    setStatus(`No verse data found for "${primary}". (JSON files may not be deployed yet.)`);
    return;
  }

  // Seed current intersection with primary word's verse set
  let currentSet: Set<string> = primaryResult.verseSet;
  let anyOverflow = primaryResult.hasOverflow;

  currentLitByVerse = new Map(primaryResult.litByVerse);
  currentTradByVerse = new Map(primaryResult.tradByVerse);
  for (const [vr, r] of primaryResult.sampleByVerse) {
    currentAllRenderingsByVerse.set(vr, new Set([r, ...sorted]));
  }

  showVerseResults(sortCanonical([...currentSet]), primary, sorted.length > 1 ? 0 : 1, anyOverflow);

  // Progressively intersect remaining words as they load
  if (sorted.length > 1) {
    const remaining = sorted.slice(1);
    await Promise.all(remaining.map(async (lemma) => {
      const result = await fetchPromises.get(lemma)!;
      if (searchId !== activeSearchId) return;
      if (!result) return;

      const narrowed = new Set<string>();
      for (const vr of currentSet) {
        if (result.verseSet.has(vr)) narrowed.add(vr);
      }
      currentSet = narrowed;
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
      showVerseResults(sortCanonical([...currentSet]), primary, sorted.length, anyOverflow);
    }));
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

      // Prefetch index on idle so it's ready before the user opens search
      if (typeof requestIdleCallback !== 'undefined') {
        const handle = requestIdleCallback(() => prefetchIndex());
        disposers.push(() => (typeof cancelIdleCallback !== 'undefined' ? cancelIdleCallback(handle) : undefined));
      } else {
        setTimeout(() => prefetchIndex(), 300);
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
