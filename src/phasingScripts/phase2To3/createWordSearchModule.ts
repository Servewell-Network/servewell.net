import type { AppModule } from './createModuleRegistry';

// ---------------------------------------------------------------------------
// Index types
// ---------------------------------------------------------------------------

// _word_index.json: { "<lemma>": <fileCount> } — only lemmas with >1 file are listed.
// We treat all keys as valid lemmas regardless of file count.
type WordIndex = Record<string, number>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORD_INDEX_URL  = 'https://servewell.net/_word_index.json';
const WORDS_BASE_URL  = 'https://words.servewell.net';
const POPOVER_ID      = 'ws-search-popover';
const INPUT_ID        = 'ws-search-input';
const RESULTS_ID      = 'ws-search-results';
const TOPBAR_BTN_ID   = 'ws-search-topbar-btn';
const BOTTOMBAR_BTN_ID = 'ws-search-bottombar-btn';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let indexData: WordIndex | null = null;
let indexLoading = false;
let indexLoadFailed = false;

// ---------------------------------------------------------------------------
// Index loading
// ---------------------------------------------------------------------------

function loadIndex(): Promise<WordIndex | null> {
  if (indexData) return Promise.resolve(indexData);
  if (indexLoadFailed) return Promise.resolve(null);
  if (indexLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (!indexLoading) { clearInterval(check); resolve(indexData); }
      }, 50);
    });
  }
  indexLoading = true;
  return fetch(WORD_INDEX_URL)
    .then((res) => (res.ok ? res.json() as Promise<WordIndex> : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then((data) => { indexData = data; indexLoading = false; return data; })
    .catch(() => { indexLoadFailed = true; indexLoading = false; return null; });
}

function prefetchIndex(): void {
  if (!indexData && !indexLoading && !indexLoadFailed) loadIndex().catch(() => {});
}

// ---------------------------------------------------------------------------
// Search logic
// ---------------------------------------------------------------------------

const MAX_RESULTS = 8;

function search(query: string, index: WordIndex): string[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const exact: string[] = [];
  const startsWith: string[] = [];
  const contains: string[] = [];
  for (const lemma of Object.keys(index)) {
    if (lemma === q) exact.push(lemma);
    else if (lemma.startsWith(q)) startsWith.push(lemma);
    else if (lemma.includes(q)) contains.push(lemma);
    if (exact.length + startsWith.length + contains.length >= MAX_RESULTS * 3) break;
  }
  return [...exact, ...startsWith, ...contains].slice(0, MAX_RESULTS);
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wordUrl(lemma: string): string {
  return `${WORDS_BASE_URL}/${encodeURIComponent(lemma)}`;
}

// ---------------------------------------------------------------------------
// Styles — match bible-nav-popover pattern
// ---------------------------------------------------------------------------

const STYLES = `
#ws-search-popover {
  position: fixed;
  top: 62px;
  right: 0.75rem;
  left: auto;
  width: min(96vw, 320px);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--panel);
  padding: 0.65rem 0.75rem;
  margin: 0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
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

#ws-search-results {
  list-style: none;
  padding: 0;
  margin: 0.4rem 0 0;
}

#ws-search-results li a {
  display: block;
  padding: 0.38rem 0.4rem;
  border-radius: 0.35rem;
  text-decoration: none;
  color: var(--fg);
  font-size: 0.9rem;
}

#ws-search-results li a:hover,
#ws-search-results li a:focus {
  background: var(--bg);
}

#ws-search-results .ws-sr-count {
  font-size: 0.78em;
  color: var(--muted);
  margin-left: 0.35em;
}

#ws-search-status {
  font-size: 0.82rem;
  color: var(--muted);
  padding: 0.25rem 0.1rem 0;
}
`;

// ---------------------------------------------------------------------------
// DOM injection — done once on activate
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
<input id="${INPUT_ID}" type="search" placeholder="Search words…" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Search Bible words">
<ul id="${RESULTS_ID}" role="listbox" aria-label="Word search results"></ul>
<div id="ws-search-status"></div>`;
    document.body.appendChild(popover);
  }

  // Wire popovertarget onto both buttons — browser handles open/close/light-dismiss automatically.
  for (const btnId of [TOPBAR_BTN_ID, BOTTOMBAR_BTN_ID]) {
    document.getElementById(btnId)?.setAttribute('popovertarget', POPOVER_ID);
  }

  // Focus input and prefetch index when popover opens.
  document.getElementById(POPOVER_ID)?.addEventListener('toggle', (e) => {
    if ((e as ToggleEvent).newState === 'open') {
      setTimeout(() => (document.getElementById(INPUT_ID) as HTMLInputElement | null)?.focus(), 30);
      prefetchIndex();
    } else {
      // Clear input + results on close so it's fresh next time.
      const input = document.getElementById(INPUT_ID) as HTMLInputElement | null;
      if (input) input.value = '';
      const ul = document.getElementById(RESULTS_ID);
      if (ul) ul.innerHTML = '';
      const status = document.getElementById('ws-search-status');
      if (status) status.textContent = '';
    }
  });

  // Wire input for search-as-you-type.
  document.getElementById(INPUT_ID)?.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    const query = input.value;
    if (!query.trim()) {
      setResults([], {});
      setStatus('');
      return;
    }
    if (indexData) {
      const results = search(query, indexData);
      setResults(results, indexData);
      setStatus(results.length === 0 ? 'No matching words found.' : '');
    } else if (indexLoadFailed) {
      setStatus('Search index unavailable.');
    } else {
      setStatus('Loading index…');
      loadIndex().then((idx) => {
        if (!idx) { setStatus('Search index unavailable.'); return; }
        const results = search((document.getElementById(INPUT_ID) as HTMLInputElement).value, idx);
        setResults(results, idx);
        setStatus(results.length === 0 ? 'No matching words found.' : '');
      });
    }
  });
}

function setStatus(msg: string): void {
  const el = document.getElementById('ws-search-status');
  if (el) el.textContent = msg;
}

function setResults(results: string[], index: WordIndex): void {
  const ul = document.getElementById(RESULTS_ID);
  if (!ul) return;
  ul.innerHTML = results.map((lemma) => {
    const count = index[lemma];
    const countHtml = count ? `<span class="ws-sr-count">(${count} pages)</span>` : '';
    return `<li><a href="${esc(wordUrl(lemma))}" target="_blank" rel="noopener">${esc(lemma)}${countHtml}</a></li>`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Module
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

      // Prefetch index on idle
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
