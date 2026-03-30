import type { Delegator } from './createDelegator';
import type { AppModule } from './createModuleRegistry';

// ---- page-embedded book data -----------------------------------------------

type BookInfo = {
  abbr: string;        // canonical abbreviation (matches data-book on <main>)
  displayAbbr: string; // user-facing abbreviation (may differ, e.g. 'Jde' for Jude)
  name: string;        // full display name
  url: string;         // URL path segment
  chapters: number;
};

type NavData = { books: BookInfo[]; sections: string[][] };

let navData: NavData | null = null;
let navDataLoading = false;

function loadNavData(): NavData {
  if (navData) return navData;
  try {
    const el = document.getElementById('bible-nav-data');
    if (el) navData = JSON.parse(el.textContent ?? '{}') as NavData;
  } catch {}
  if (!navData) navData = { books: [], sections: [] };
  return navData;
}

function parseNavData(raw: string): NavData | null {
  try {
    const parsed = JSON.parse(raw) as Partial<NavData>;
    const books = Array.isArray(parsed.books) ? parsed.books : [];
    const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
    if (books.length === 0) return null;
    return {
      books: books as BookInfo[],
      sections: sections as string[][],
    };
  } catch {
    return null;
  }
}

function loadNavDataFromHtml(html: string): NavData | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const el = doc.getElementById('bible-nav-data');
  if (!el?.textContent) return null;
  return parseNavData(el.textContent);
}

// ---- storage keys -----------------------------------------------------------

const STORAGE_KEY_BOOKMARKS   = 'servewell-nav-bookmarks';
const STORAGE_KEY_ALPHABETICAL = 'servewell-nav-alphabetical';

// ---- helpers ----------------------------------------------------------------

type NavRef = { book: string; chapter: number };

function qs<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector(selector) as T | null;
}

function escHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- CSS -------------------------------------------------------------------

const CSS = `
#bible-nav-btns {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  min-width: 0;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}

#bible-nav-btns::-webkit-scrollbar {
  display: none;
}

#bible-nav-btns ~ .app-spacer {
  display: none;
}

.nav-ref-chip {
  display: inline-flex;
  align-items: stretch;
  min-width: 0;
  flex-shrink: 0;
}

.nav-ref-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.2rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--bar);
  color: var(--fg);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  text-decoration: none;
}

.nav-ref-btn:hover { background: var(--bg); }

.nav-ref-btn--with-remove {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.nav-ref-chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.55rem;
  padding: 0 0.32rem;
  border: 1px solid var(--border);
  border-left: none;
  border-radius: 0 0.375rem 0.375rem 0;
  background: var(--bar);
  color: var(--muted);
  font: inherit;
  font-size: 0.8rem;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
}

.nav-ref-chip-remove:hover {
  background: var(--bg);
  color: var(--fg);
}

.nav-radio {
  font-size: 0.65em;
  line-height: 1;
  color: var(--muted);
  opacity: 0.45;
}

.nav-radio--enabled         { opacity: 1; color: var(--muted); }
.nav-radio--enabled-selected { opacity: 1; color: var(--fg); }

#bible-nav-popover {
  position: fixed;
  top: 62px;
  left: 0.75rem;
  width: min(96vw, 400px);
  max-height: calc(100dvh - 130px);
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--panel);
  padding: 0;
  margin: 0;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
}

#bible-nav-popover:not(:popover-open) { display: none; }

.nav-pop-inner  { padding: 0.65rem 0.75rem; }

.nav-pop-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}

.nav-pop-controls {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.55rem;
}

.nav-check-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  cursor: pointer;
}

.nav-goto-btn {
  display: inline-block;
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: var(--bar);
  color: var(--fg);
  font: inherit;
  font-size: 0.85rem;
  text-decoration: none;
  font-weight: 600;
}

.nav-goto-btn:hover { background: var(--bg); }

.nav-remove-btn {
  align-self: flex-start;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: var(--bar);
  color: var(--fg);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.nav-remove-btn:hover { background: var(--bg); }

.nav-book-grid  { display: flex; flex-direction: column; gap: 0.2rem; }

.nav-book-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.nav-book-btn {
  padding: 0.18rem 0.4rem;
  border: 1px solid var(--border);
  border-radius: 0.22rem;
  background: var(--bar);
  color: var(--fg);
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
  white-space: nowrap;
}

.nav-book-btn:hover { background: var(--bg); }

.nav-ch-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}

.nav-ch-btn {
  display: inline-block;
  padding: 0.18rem 0.3rem;
  min-width: 1.8rem;
  text-align: center;
  border: 1px solid var(--border);
  border-radius: 0.22rem;
  background: var(--bar);
  color: var(--fg);
  font: inherit;
  font-size: 0.78rem;
  text-decoration: none;
}

.nav-ch-btn:hover { background: var(--bg); }

.nav-back-btn {
  border: none;
  background: none;
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
  color: var(--muted);
  padding: 0 0.15rem;
  line-height: 1;
}

.nav-back-btn:hover { color: var(--fg); }
`;

// ---- module -----------------------------------------------------------------

export function createBibleNavModule(delegator: Delegator): AppModule {
  let bookmarks: NavRef[] = [];
  let alphabetical = false;
  // 'current' = current page slot; number = index into bookmarks array
  let activeSlot: 'current' | number = 'current';
  let navView: 'books' | 'chapters' = 'books';
  let navSelectedBook: string | null = null;
  const disposers: Array<() => void> = [];

  function ensureNavDataLoaded() {
    if (loadNavData().books.length > 0) return;
    if (navDataLoading) return;
    navDataLoading = true;

    // Home page may not have inline nav data. Borrow the canonical payload from one generated chapter page.
    fetch('/-/Genesis/1')
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((html) => {
        const loaded = loadNavDataFromHtml(html);
        if (loaded) {
          navData = loaded;
          renderTopbar();
          renderPopover();
        }
      })
      .catch(() => {
        // Keep silent fallback: nav button still works for direct current-ref navigation.
      })
      .finally(() => {
        navDataLoading = false;
      });
  }

  // ---- state helpers --------------------------------------------------------

  function getCurrentRef(): NavRef | null {
    const main = qs<HTMLElement>('main.chapter-page');
    if (!main) return null;
    const book = main.dataset.book ?? '';
    const chapter = parseInt(main.dataset.chapter ?? '0', 10);
    return (book && chapter) ? { book, chapter } : null;
  }

  function loadStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
      bookmarks = raw ? (JSON.parse(raw) as NavRef[]) : [];
    } catch { bookmarks = []; }
    try {
      alphabetical = localStorage.getItem(STORAGE_KEY_ALPHABETICAL) === 'true';
    } catch { alphabetical = false; }
  }

  function saveBookmarks() {
    try { localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(bookmarks)); } catch {}
  }

  function saveAlphabetical() {
    try { localStorage.setItem(STORAGE_KEY_ALPHABETICAL, String(alphabetical)); } catch {}
  }

  function refsEqual(a: NavRef, b: NavRef): boolean {
    return a.book === b.book && a.chapter === b.chapter;
  }

  function isCurrentBookmarked(): boolean {
    const cur = getCurrentRef();
    return !!cur && bookmarks.some(b => refsEqual(b, cur));
  }

  function addCurrentBookmark() {
    const cur = getCurrentRef();
    if (cur && !isCurrentBookmarked()) { bookmarks.push(cur); saveBookmarks(); }
  }

  function removeCurrentBookmark() {
    const cur = getCurrentRef();
    if (cur) { bookmarks = bookmarks.filter(b => !refsEqual(b, cur)); saveBookmarks(); }
  }

  function removeBookmarkAt(idx: number) {
    bookmarks.splice(idx, 1);
    saveBookmarks();
  }

  function getBook(abbr: string): BookInfo | undefined {
    return loadNavData().books.find(b => b.abbr === abbr);
  }

  function refLabel(ref: NavRef): string {
    const book = getBook(ref.book);
    return `${book?.displayAbbr ?? ref.book}\u00a0${ref.chapter}`;
  }

  function refHref(ref: NavRef): string {
    const book = getBook(ref.book);
    return book ? `/-/${book.url}/${ref.chapter}` : '#';
  }

  // ---- DOM setup ------------------------------------------------------------

  function injectOnce() {
    if (qs('#bible-nav-btns')) return;

    if (!qs('#bible-nav-style')) {
      const style = document.createElement('style');
      style.id = 'bible-nav-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    // inject button row into topbar, right after the home link label
    const topbar = qs<HTMLElement>('#app-shell-root .app-topbar');
    if (!topbar) return;
    const titleLink = topbar.querySelector('.app-topbar-home');
    const btns = document.createElement('div');
    btns.id = 'bible-nav-btns';
    btns.addEventListener('wheel', (event) => {
      if (event.deltaY !== 0) {
        event.preventDefault();
        btns.scrollLeft += event.deltaY;
      }
    }, { passive: false });
    if (titleLink?.nextSibling) {
      topbar.insertBefore(btns, titleLink.nextSibling);
    } else {
      topbar.appendChild(btns);
    }

    // inject the popover element
    const popover = document.createElement('div');
    popover.id = 'bible-nav-popover';
    popover.setAttribute('popover', '');
    document.body.appendChild(popover);
  }

  // ---- topbar rendering -----------------------------------------------------

  function renderTopbar() {
    const container = qs<HTMLElement>('#bible-nav-btns');
    if (!container) return;

    const cur = getCurrentRef();
    if (!cur) { container.innerHTML = ''; return; }

    // slots: current ref first, then bookmarks that are not the current ref
    const slots: Array<{ ref: NavRef; isCurrent: boolean; bmIdx: number }> = [
      { ref: cur, isCurrent: true, bmIdx: -1 },
      ...bookmarks
        .map((b, i) => ({ ref: b, isCurrent: false, bmIdx: i }))
        .filter(s => !refsEqual(s.ref, cur)),
    ];

    const hasMultiple = slots.length > 1;

    container.innerHTML = slots.map(({ ref, isCurrent, bmIdx }) => {
      let radioClass: string;
      let radioSymbol: string;
      if (!hasMultiple) {
        // disabled appearance: just show '●' with muted styling
        radioClass = 'nav-radio';
        radioSymbol = '●';
      } else if (isCurrent) {
        radioClass = 'nav-radio nav-radio--enabled-selected';
        radioSymbol = '●';
      } else {
        radioClass = 'nav-radio nav-radio--enabled';
        radioSymbol = '○';
      }

      const labelHtml = `<span class="${radioClass}" aria-hidden="true">${radioSymbol}</span>${escHtml(refLabel(ref))}`;

      if (!isCurrent) {
        return `<span class="nav-ref-chip"><a class="nav-ref-btn nav-ref-btn--with-remove" href="${escHtml(refHref(ref))}">${labelHtml}</a><button type="button" class="nav-ref-chip-remove" aria-label="Remove bookmark ${escHtml(refLabel(ref))}" data-nav-remove-top-bookmark="${bmIdx}">&times;</button></span>`;
      }

      const slotData = isCurrent ? 'current' : String(bmIdx);
      return `<button type="button" class="nav-ref-btn" popovertarget="bible-nav-popover" data-nav-book="${escHtml(ref.book)}" data-nav-chapter="${ref.chapter}" data-nav-slot="${slotData}">${labelHtml}</button>`;
    }).join('');
  }

  // ---- popover rendering ----------------------------------------------------

  function renderPopover() {
    const popover = qs<HTMLElement>('#bible-nav-popover');
    if (!popover) return;
    popover.innerHTML = navView === 'chapters' && navSelectedBook
      ? renderChaptersView(navSelectedBook)
      : renderBooksView();
  }

  function renderBooksView(): string {
    ensureNavDataLoaded();
    const isCurrentSlot = activeSlot === 'current';
    const bmIdx = typeof activeSlot === 'number' ? activeSlot : -1;
    const slotRef: NavRef | null = isCurrentSlot
      ? getCurrentRef()
      : (bookmarks[bmIdx] ?? null);

    // top controls
    let topControls = '';
    if (isCurrentSlot) {
      const checked = isCurrentBookmarked() ? ' checked' : '';
      topControls = `<label class="nav-check-row"><input type="checkbox" id="nav-bookmark-chk"${checked}><span>Bookmark This Reference</span></label>`;
    } else if (slotRef) {
      const book = getBook(slotRef.book);
      const href = book ? `/-/${escHtml(book.url)}/${slotRef.chapter}` : '#';
      topControls = `<a class="nav-goto-btn" href="${href}">Go\u00a0to ${escHtml(refLabel(slotRef))}</a><button type="button" class="nav-remove-btn" id="nav-remove-bookmark">Remove This Bookmark</button>`;
    }

    const alphaChecked = alphabetical ? ' checked' : '';
    const alphaControl = `<label class="nav-check-row"><input type="checkbox" id="nav-alpha-chk"${alphaChecked}><span>Alphabetical</span></label>`;

    // book buttons
    const data = loadNavData();
    if (data.books.length === 0) {
      return `<div class="nav-pop-inner">
<div class="nav-pop-header"><strong>Select A Document</strong></div>
<div class="nav-pop-controls">${topControls}${alphaControl}</div>
<div class="nav-book-grid"><div class="nav-check-row">Loading references...</div></div>
</div>`;
    }

    let booksHtml: string;
    if (alphabetical) {
      const sorted = [...data.books].sort((a, b) => a.displayAbbr.localeCompare(b.displayAbbr));
      const btns = sorted.map(b => `<button type="button" class="nav-book-btn" data-nav-pick-book="${escHtml(b.abbr)}">${escHtml(b.displayAbbr)}</button>`).join('');
      booksHtml = `<div class="nav-book-group">${btns}</div>`;
    } else {
      const bookMap = new Map(data.books.map(b => [b.abbr, b]));
      booksHtml = data.sections.map(section => {
        const btns = section.map(abbr => {
          const b = bookMap.get(abbr);
          if (!b) return '';
          return `<button type="button" class="nav-book-btn" data-nav-pick-book="${escHtml(b.abbr)}">${escHtml(b.displayAbbr)}</button>`;
        }).join('');
        return `<div class="nav-book-group">${btns}</div>`;
      }).join('');
    }

    return `<div class="nav-pop-inner">
<div class="nav-pop-header"><strong>Select A Document</strong></div>
<div class="nav-pop-controls">${topControls}${alphaControl}</div>
<div class="nav-book-grid">${booksHtml}</div>
</div>`;
  }

  function renderChaptersView(abbr: string): string {
    const book = getBook(abbr);
    if (!book) return '';
    const links = Array.from({ length: book.chapters }, (_, i) => i + 1)
      .map(n => `<a class="nav-ch-btn" href="/-/${escHtml(book.url)}/${n}">${n}</a>`)
      .join('');
    return `<div class="nav-pop-inner">
<div class="nav-pop-header"><button type="button" class="nav-back-btn" id="nav-back" aria-label="Back to book list">&#8249;</button><strong>${escHtml(book.name)}</strong></div>
<div class="nav-ch-grid">${links}</div>
</div>`;
  }

  // ---- module lifecycle -----------------------------------------------------

  const module: AppModule = {
    id: 'bible-nav',
    label: 'Bible Navigation',
    active: false,
    includeInMenu: false,

    activate() {
      if (module.active) return;
      module.active = true;

      loadStorage();
      ensureNavDataLoaded();
      injectOnce();
      renderTopbar();

      // current nav-ref-btn click: set active slot and pre-render popover content
      // (popovertarget opens the popover after this handler runs)
      disposers.push(delegator.registerSublistener({
        eventName: 'click',
        tagName: 'BUTTON',
        selector: 'button.nav-ref-btn',
        handle(el) {
          const slot = el.dataset.navSlot ?? 'current';
          activeSlot = slot === 'current' ? 'current' : parseInt(slot, 10);
          navView = 'books';
          navSelectedBook = null;
          renderPopover();
        },
      }));

      // remove bookmark directly from topbar split-chip
      disposers.push(delegator.registerSublistener({
        eventName: 'click',
        tagName: 'BUTTON',
        selector: 'button[data-nav-remove-top-bookmark]',
        handle(el, event) {
          event.preventDefault();
          const idx = parseInt(el.dataset.navRemoveTopBookmark ?? '-1', 10);
          if (idx < 0) return;
          removeBookmarkAt(idx);
          renderTopbar();
        },
      }));

      // book button click → switch to chapter view
      disposers.push(delegator.registerSublistener({
        eventName: 'click',
        tagName: 'BUTTON',
        selector: 'button[data-nav-pick-book]',
        handle(el) {
          navSelectedBook = el.dataset.navPickBook ?? null;
          if (navSelectedBook) {
            navView = 'chapters';
            renderPopover();
          }
        },
      }));

      // back button in chapter view
      disposers.push(delegator.registerSublistener({
        eventName: 'click',
        tagName: 'BUTTON',
        selector: 'button#nav-back',
        handle() {
          navView = 'books';
          navSelectedBook = null;
          renderPopover();
        },
      }));

      // bookmark checkbox toggle
      disposers.push(delegator.registerSublistener({
        eventName: 'change',
        tagName: 'INPUT',
        selector: 'input#nav-bookmark-chk',
        handle(el) {
          const input = el as HTMLInputElement;
          if (input.checked) {
            addCurrentBookmark();
          } else {
            removeCurrentBookmark();
          }
          renderTopbar();
          renderPopover();
        },
      }));

      // remove bookmark button
      disposers.push(delegator.registerSublistener({
        eventName: 'click',
        tagName: 'BUTTON',
        selector: 'button#nav-remove-bookmark',
        handle() {
          if (typeof activeSlot === 'number') removeBookmarkAt(activeSlot);
          qs<HTMLElement>('#bible-nav-popover')?.hidePopover();
          activeSlot = 'current';
          renderTopbar();
        },
      }));

      // alphabetical toggle
      disposers.push(delegator.registerSublistener({
        eventName: 'change',
        tagName: 'INPUT',
        selector: 'input#nav-alpha-chk',
        handle(el) {
          alphabetical = (el as HTMLInputElement).checked;
          saveAlphabetical();
          renderPopover();
        },
      }));
    },

    deactivate() {
      if (!module.active) return;
      module.active = false;
      while (disposers.length) disposers.pop()?.();
    },
  };

  return module;
}
