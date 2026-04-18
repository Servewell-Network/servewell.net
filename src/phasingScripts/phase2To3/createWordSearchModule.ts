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
const MAX_DISPLAYED     = 10;

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
  left: auto;
  width: min(96vw, 380px);
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
.ws-sr-rendering {
  font-size: 0.78em;
  color: var(--muted);
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 50%;
}
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
<div id="ws-search-status" aria-live="polite"></div>
<ul id="${RESULTS_ID}" role="list" aria-label="Search results"></ul>`;
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
  sampleByVerse: Map<string, string>,
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
    const rendering = sampleByVerse.get(vr) ?? '';
    const renderHtml = rendering
      ? `<span class="ws-sr-rendering">${esc(rendering.toLowerCase())}</span>`
      : '';
    return url
      ? `<li><a class="ws-sr-verse-link" href="${esc(url)}"><span class="ws-sr-ref">${esc(display)}</span>${renderHtml}</a></li>`
      : `<li><span class="ws-sr-verse-link"><span class="ws-sr-ref">${esc(display)}</span>${renderHtml}</span></li>`;
  }).join('');

  const overflow = hasOverflow ? '+' : '';
  const hint = verseRefs.length > MAX_DISPLAYED
    ? `<li class="ws-sr-hint">Showing ${MAX_DISPLAYED} of ${verseRefs.length}${overflow} — keep typing to narrow down</li>`
    : '';

  ul.innerHTML = items + hint;

  const overflowNote = hasOverflow ? ' (overflow pages not searched)' : '';
  if (resolvedCount > 1) {
    setStatus(`${verseRefs.length}${overflow} verses match all terms${overflowNote}`);
  } else {
    setStatus(`${verseRefs.length}${overflow} verses for "${primaryLemma}"${overflowNote}${verseRefs.length ? ' — type more words to narrow' : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Active search — cancel stale searches on new input
// ---------------------------------------------------------------------------

let activeSearchId = 0;

// ---------------------------------------------------------------------------
// Core search pipeline
// ---------------------------------------------------------------------------

async function handleInput(rawQuery: string): Promise<void> {
  const searchId = ++activeSearchId;
  const query = rawQuery.trim();
  if (!query) { clearDisplay(); return; }

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
  let currentSample: Map<string, string> = primaryResult.sampleByVerse;
  let anyOverflow = primaryResult.hasOverflow;

  showVerseResults([...currentSet].sort(), currentSample, primary, sorted.length > 1 ? 0 : 1, anyOverflow);

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
      if (searchId !== activeSearchId) return;
      showVerseResults([...currentSet].sort(), currentSample, primary, sorted.length, anyOverflow);
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
