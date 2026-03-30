"use strict";
(() => {
  // src/phasingScripts/phase2To3/createDelegator.ts
  function createDelegator() {
    const sublistenersByEvent = {};
    const dispatchersByEvent = {};
    function ensureDispatcher(eventName) {
      if (dispatchersByEvent[eventName]) return;
      const dispatcher = (event) => {
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (!target) return;
        const sublisteners = (sublistenersByEvent[eventName] || []).slice();
        for (const sublistener of sublisteners) {
          const matched = target.closest(sublistener.selector);
          if (!matched) continue;
          if (matched.tagName.toUpperCase() !== sublistener.tagName.toUpperCase()) continue;
          sublistener.handle(matched, event);
        }
      };
      dispatchersByEvent[eventName] = dispatcher;
      document.addEventListener(eventName, dispatcher);
    }
    function registerSublistener(sublistener) {
      if (!sublistenersByEvent[sublistener.eventName]) {
        sublistenersByEvent[sublistener.eventName] = [];
      }
      sublistenersByEvent[sublistener.eventName].push(sublistener);
      ensureDispatcher(sublistener.eventName);
      return function deregister() {
        const bucket = sublistenersByEvent[sublistener.eventName];
        if (!bucket) return;
        const index = bucket.indexOf(sublistener);
        if (index !== -1) bucket.splice(index, 1);
        if (bucket.length === 0 && dispatchersByEvent[sublistener.eventName]) {
          document.removeEventListener(sublistener.eventName, dispatchersByEvent[sublistener.eventName]);
          delete dispatchersByEvent[sublistener.eventName];
        }
      };
    }
    return { registerSublistener };
  }

  // src/phasingScripts/phase2To3/createShell.ts
  function qs(selector) {
    return document.querySelector(selector);
  }
  function qsa(selector) {
    return Array.from(document.querySelectorAll(selector));
  }
  function createShell() {
    const css = `
:root {
  --bg: #ffffff;
  --fg: #171717;
  --muted: #666666;
  --bar: #f4f4f5;
  --border: #d9d9de;
  --panel: #ffffff;
}

:root[data-theme="dark"] {
  --bg: #111317;
  --fg: #f1f3f5;
  --muted: #a6aebb;
  --bar: #1a1d23;
  --border: #2c323c;
  --panel: #171a20;
}

html, body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
}

body.with-app-shell {
  padding-top: 56px;
  padding-bottom: 60px;
}

#app-shell-root button,
#app-shell-root input {
  font: inherit;
}

#app-shell-root .app-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  background: var(--bar);
  border-bottom: 1px solid var(--border);
  z-index: 50;
}

#app-shell-root .app-topbar-home {
  color: var(--fg);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-decoration: none;
}

#app-shell-root .app-topbar-home:hover {
  color: var(--muted);
}

#app-shell-root .app-spacer {
  flex: 1;
}

#app-shell-root .app-checkrow {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

#app-shell-root .app-sidepanel {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  width: min(86vw, 320px);
  transform: translateX(-102%);
  transition: transform 0.18s ease;
  background: var(--panel);
  border-right: 1px solid var(--border);
  z-index: 60;
  padding: 1rem;
  overflow: auto;
}

body.app-panel-open #app-shell-root .app-sidepanel {
  transform: translateX(0);
}

#app-shell-root .app-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
  z-index: 55;
}

body.app-panel-open #app-shell-root .app-overlay {
  opacity: 1;
  pointer-events: auto;
}

#app-shell-root .app-sidepanel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

#app-shell-root .app-sidepanel-home {
  color: var(--fg);
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-decoration: none;
}

#app-shell-root .app-sidepanel-home:hover {
  color: var(--muted);
}

#app-shell-root .app-sidepanel section {
  margin-bottom: 1.25rem;
}

#app-shell-root .app-sidepanel h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
}

#app-shell-root .app-bottombar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--bar);
  border-top: 1px solid var(--border);
  z-index: 50;
}

.is-inactive {
  opacity: 0.45;
}

/* Literal pane: apply small-caps only to literal English word tokens. */
.literal-pane .word-token {
  font-variant: all-small-caps;
}

/* Runtime override: ensure long word metadata popovers remain fully readable. */
.word-popover {
  max-height: min(72dvh, 34rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 640px) {
  #app-shell-root .app-topbar > .app-topbar-home,
  #app-shell-root .app-topbar > .app-checkrow {
    display: none;
  }
}

@media (min-width: 900px) {
  body.with-app-shell {
    padding-bottom: 0;
  }

  #app-shell-root .app-bottombar {
    display: none;
  }
}
`;
    if (!qs("#app-shell-style")) {
      const style = document.createElement("style");
      style.id = "app-shell-style";
      style.textContent = css;
      document.head.appendChild(style);
    }
    if (!qs("#app-shell-root")) {
      document.body.insertAdjacentHTML(
        "afterbegin",
        `
<div id="app-shell-root">
  <header class="app-topbar">
    <button type="button" data-action="menu-open" aria-label="Open menu">\u2630</button>
    <a class="app-topbar-home" href="/">Servewell.net</a>
    <span class="app-spacer"></span>
  </header>

  <aside class="app-sidepanel">
    <div class="app-sidepanel-header">
      <a class="app-sidepanel-home" href="/">Servewell.net</a>
      <button type="button" data-action="menu-close">\u2715</button>
    </div>

    <section>
      <label class="app-checkrow">
        <input type="checkbox" data-setting="dark-mode">
        <span>Dark mode</span>
      </label>
    </section>

    <section>
      <div id="app-module-list"></div>
    </section>
  </aside>

  <div class="app-overlay" data-action="menu-close"></div>

  <nav class="app-bottombar">
    <button type="button" data-action="menu-open">Menu</button>
    <button type="button" data-action="scroll-top">Top</button>
  </nav>
</div>`
      );
    }
    document.body.classList.add("with-app-shell");
    const legacyHomeLink = document.querySelector('body > a[href="/"]');
    if (legacyHomeLink?.textContent?.trim() === "Back to Home") {
      legacyHomeLink.remove();
    }
    const legacyChapterNote = document.querySelector("main.chapter-page > p.chapter-note");
    const oldChapterNoteText = "Shared snippet label with side-by-side literal and traditional panes. Click any word to view metadata.";
    if (legacyChapterNote?.textContent?.trim() === oldChapterNoteText) {
      legacyChapterNote.textContent = "Click any word to see more.";
    }
    const sharedWordPopover = document.querySelector(".shared-word-popover");
    if (sharedWordPopover) {
      const hiddenLabels = /* @__PURE__ */ new Set([
        "Snippet",
        "Word Position",
        "Morpheme Gloss",
        "Segment In Morpheme",
        "Segments In Morpheme",
        "Grammar Code",
        "Grammar Function"
      ]);
      sharedWordPopover.addEventListener("toggle", (event) => {
        if (event.newState !== "open") return;
        sharedWordPopover.querySelectorAll(".word-meta-row").forEach((row) => {
          const label = row.querySelector(".word-meta-label");
          if (label && hiddenLabels.has(label.textContent || "")) row.remove();
        });
      });
    }
    function openPanel() {
      document.body.classList.add("app-panel-open");
    }
    function closePanel() {
      document.body.classList.remove("app-panel-open");
    }
    function syncThemeInputs(theme) {
      const isDark = theme === "dark";
      qsa('input[data-setting="dark-mode"]').forEach((input) => {
        input.checked = isDark;
      });
    }
    function appendDemoLine(text) {
      const output = qs("#demoOutput");
      if (!output) return;
      const line = document.createElement("div");
      line.textContent = text;
      output.insertBefore(line, output.firstChild);
    }
    function syncModuleInputs(moduleId, active) {
      qsa(`input[data-module-id="${moduleId}"]`).forEach((input) => {
        input.checked = active;
      });
    }
    function syncDemoButtons(active) {
      qsa('[data-module-target="demo"]').forEach((el) => {
        const inactive = !active;
        el.classList.toggle("is-inactive", inactive);
        el.setAttribute("aria-disabled", inactive ? "true" : "false");
        if (el instanceof HTMLButtonElement) {
          el.disabled = inactive;
        }
      });
    }
    function renderModuleList(modules) {
      const container = qs("#app-module-list");
      if (!container) return;
      container.innerHTML = modules.map((module) => {
        const checked = module.active ? " checked" : "";
        return `
<label class="app-checkrow">
  <input type="checkbox" data-module-id="${module.id}"${checked}>
  <span>${module.label}</span>
</label>`;
      }).join("\n");
    }
    return {
      openPanel,
      closePanel,
      syncThemeInputs,
      appendDemoLine,
      syncModuleInputs,
      syncDemoButtons,
      renderModuleList
    };
  }

  // src/phasingScripts/phase2To3/createTheme.ts
  function createTheme(shell) {
    const themeStorageKey = "servewell-theme";
    function set(theme) {
      document.documentElement.dataset.theme = theme;
      shell.syncThemeInputs(theme);
      try {
        localStorage.setItem(themeStorageKey, theme);
      } catch {
      }
    }
    function restore() {
      let savedTheme = "";
      try {
        savedTheme = localStorage.getItem(themeStorageKey) || "";
      } catch {
      }
      set(savedTheme === "dark" ? "dark" : "light");
    }
    return { set, restore };
  }

  // src/phasingScripts/phase2To3/createModuleRegistry.ts
  var STORAGE_KEY_PREFIX = "servewell-module-";
  function storageKey(id) {
    return `${STORAGE_KEY_PREFIX}${id}`;
  }
  function createModuleRegistry(shell) {
    const modules = {};
    function register(module) {
      modules[module.id] = module;
    }
    function render() {
      shell.renderModuleList(Object.values(modules).filter((module) => module.includeInMenu !== false));
    }
    function activate(id) {
      const module = modules[id];
      if (!module) return;
      module.activate();
      shell.syncModuleInputs(id, true);
      try {
        localStorage.setItem(storageKey(id), "1");
      } catch {
      }
    }
    function deactivate(id) {
      const module = modules[id];
      if (!module) return;
      module.deactivate();
      shell.syncModuleInputs(id, false);
      try {
        localStorage.removeItem(storageKey(id));
      } catch {
      }
    }
    function isActive(id) {
      return !!modules[id]?.active;
    }
    function getAll() {
      return Object.values(modules);
    }
    function restoreFromStorage() {
      Object.values(modules).forEach((module) => {
        if (module.includeInMenu === false) return;
        let saved = "";
        try {
          saved = localStorage.getItem(storageKey(module.id)) ?? "";
        } catch {
        }
        if (saved === "1") activate(module.id);
      });
    }
    return { register, render, activate, deactivate, isActive, getAll, restoreFromStorage };
  }

  // src/phasingScripts/phase2To3/registerShellListeners.ts
  function registerShellListeners(delegator, shell, theme, modules) {
    delegator.registerSublistener({
      eventName: "click",
      tagName: "BUTTON",
      selector: 'button[data-action="menu-open"]',
      handle() {
        shell.openPanel();
      }
    });
    delegator.registerSublistener({
      eventName: "click",
      tagName: "BUTTON",
      selector: 'button[data-action="menu-close"]',
      handle() {
        shell.closePanel();
      }
    });
    delegator.registerSublistener({
      eventName: "click",
      tagName: "DIV",
      selector: 'div[data-action="menu-close"]',
      handle() {
        shell.closePanel();
      }
    });
    delegator.registerSublistener({
      eventName: "click",
      tagName: "BUTTON",
      selector: 'button[data-action="scroll-top"]',
      handle() {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
    delegator.registerSublistener({
      eventName: "change",
      tagName: "INPUT",
      selector: 'input[data-setting="dark-mode"]',
      handle(matched) {
        const input = matched;
        theme.set(input.checked ? "dark" : "light");
      }
    });
    delegator.registerSublistener({
      eventName: "change",
      tagName: "INPUT",
      selector: "input[data-module-id]",
      handle(matched) {
        const input = matched;
        const moduleId = input.getAttribute("data-module-id");
        if (!moduleId) return;
        if (input.checked) modules.activate(moduleId);
        else modules.deactivate(moduleId);
      }
    });
  }

  // src/phasingScripts/phase2To3/createDemoModule.ts
  function qs2(selector) {
    return document.querySelector(selector);
  }
  function createDemoModule(delegator, shell) {
    if (!qs2("#framework-demo-root")) {
      document.body.insertAdjacentHTML(
        "beforeend",
        `
<section id="framework-demo-root">
  <h2>Framework demo</h2>
  <p>Turn the Demo module off in the side panel, then tap Demo again.</p>
  <div class="demo-buttons">
    <button type="button" data-action="demo-ping" data-module-target="demo">Demo button</button>
    <button type="button" data-action="demo-clear" data-module-target="demo">Clear demo log</button>
  </div>
  <div id="demoOutput"></div>
</section>`
      );
    }
    if (!qs2("#demo-style")) {
      const style = document.createElement("style");
      style.id = "demo-style";
      style.textContent = `
#framework-demo-root {
  margin: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}

#framework-demo-root .demo-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

#demoOutput {
  margin-top: 0.75rem;
  padding: 0.75rem;
  min-height: 3rem;
  border: 1px dashed var(--border);
  color: var(--muted);
}
`;
      document.head.appendChild(style);
    }
    function appendDemoLine(text) {
      const output = qs2("#demoOutput");
      if (!output) return;
      const line = document.createElement("div");
      line.textContent = text;
      output.insertBefore(line, output.firstChild);
    }
    const module = {
      id: "demo",
      label: "Demo module",
      active: false,
      activate() {
        if (module.active) return;
        const disposers = [
          delegator.registerSublistener({
            eventName: "click",
            tagName: "BUTTON",
            selector: 'button[data-action="demo-ping"]',
            handle() {
              appendDemoLine(`Demo handled at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`);
            }
          }),
          delegator.registerSublistener({
            eventName: "click",
            tagName: "BUTTON",
            selector: 'button[data-action="demo-clear"]',
            handle() {
              const output = qs2("#demoOutput");
              if (!output) return;
              output.innerHTML = "";
              appendDemoLine("Demo log cleared");
            }
          })
        ];
        module.active = true;
        shell.syncModuleInputs("demo", true);
        shell.syncDemoButtons(true);
        appendDemoLine("Demo module activated");
        module._disposers = disposers;
      },
      deactivate() {
        if (!module.active) return;
        const disposers = module._disposers || [];
        while (disposers.length > 0) {
          const dispose = disposers.pop();
          if (dispose) dispose();
        }
        module.active = false;
        shell.syncModuleInputs("demo", false);
        shell.syncDemoButtons(false);
        appendDemoLine("Demo module deactivated");
      }
    };
    return module;
  }

  // src/phasingScripts/phase2To3/createBibleNavModule.ts
  var navData = null;
  var navDataLoading = false;
  function loadNavData() {
    if (navData) return navData;
    try {
      const el = document.getElementById("bible-nav-data");
      if (el) navData = JSON.parse(el.textContent ?? "{}");
    } catch {
    }
    if (!navData) navData = { books: [], sections: [] };
    return navData;
  }
  function parseNavData(raw) {
    try {
      const parsed = JSON.parse(raw);
      const books = Array.isArray(parsed.books) ? parsed.books : [];
      const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
      if (books.length === 0) return null;
      return {
        books,
        sections
      };
    } catch {
      return null;
    }
  }
  function loadNavDataFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const el = doc.getElementById("bible-nav-data");
    if (!el?.textContent) return null;
    return parseNavData(el.textContent);
  }
  var STORAGE_KEY_BOOKMARKS = "servewell-nav-bookmarks";
  var STORAGE_KEY_ALPHABETICAL = "servewell-nav-alphabetical";
  function qs3(selector) {
    return document.querySelector(selector);
  }
  function escHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var CSS = `
#bible-nav-btns {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  min-width: 0;
  flex-shrink: 1;
  overflow: hidden;
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
  function createBibleNavModule(delegator) {
    let bookmarks = [];
    let alphabetical = false;
    let activeSlot = "current";
    let navView = "books";
    let navSelectedBook = null;
    const disposers = [];
    function ensureNavDataLoaded() {
      if (loadNavData().books.length > 0) return;
      if (navDataLoading) return;
      navDataLoading = true;
      fetch("/-/Genesis/1").then((res) => res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))).then((html) => {
        const loaded = loadNavDataFromHtml(html);
        if (loaded) {
          navData = loaded;
          renderTopbar();
          renderPopover();
        }
      }).catch(() => {
      }).finally(() => {
        navDataLoading = false;
      });
    }
    function getCurrentRef() {
      const main = qs3("main.chapter-page");
      if (!main) return null;
      const book = main.dataset.book ?? "";
      const chapter = parseInt(main.dataset.chapter ?? "0", 10);
      return book && chapter ? { book, chapter } : null;
    }
    function loadStorage() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
        bookmarks = raw ? JSON.parse(raw) : [];
      } catch {
        bookmarks = [];
      }
      try {
        alphabetical = localStorage.getItem(STORAGE_KEY_ALPHABETICAL) === "true";
      } catch {
        alphabetical = false;
      }
    }
    function saveBookmarks() {
      try {
        localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(bookmarks));
      } catch {
      }
    }
    function saveAlphabetical() {
      try {
        localStorage.setItem(STORAGE_KEY_ALPHABETICAL, String(alphabetical));
      } catch {
      }
    }
    function refsEqual(a, b) {
      return a.book === b.book && a.chapter === b.chapter;
    }
    function isCurrentBookmarked() {
      const cur = getCurrentRef();
      return !!cur && bookmarks.some((b) => refsEqual(b, cur));
    }
    function addCurrentBookmark() {
      const cur = getCurrentRef();
      if (cur && !isCurrentBookmarked()) {
        bookmarks.push(cur);
        saveBookmarks();
      }
    }
    function removeCurrentBookmark() {
      const cur = getCurrentRef();
      if (cur) {
        bookmarks = bookmarks.filter((b) => !refsEqual(b, cur));
        saveBookmarks();
      }
    }
    function removeBookmarkAt(idx) {
      bookmarks.splice(idx, 1);
      saveBookmarks();
    }
    function getBook(abbr) {
      return loadNavData().books.find((b) => b.abbr === abbr);
    }
    function refLabel(ref) {
      const book = getBook(ref.book);
      return `${book?.displayAbbr ?? ref.book}\xA0${ref.chapter}`;
    }
    function refHref(ref) {
      const book = getBook(ref.book);
      return book ? `/-/${book.url}/${ref.chapter}` : "#";
    }
    function injectOnce() {
      if (qs3("#bible-nav-btns")) return;
      if (!qs3("#bible-nav-style")) {
        const style = document.createElement("style");
        style.id = "bible-nav-style";
        style.textContent = CSS;
        document.head.appendChild(style);
      }
      const topbar = qs3("#app-shell-root .app-topbar");
      if (!topbar) return;
      const titleLink = topbar.querySelector(".app-topbar-home");
      const btns = document.createElement("div");
      btns.id = "bible-nav-btns";
      if (titleLink?.nextSibling) {
        topbar.insertBefore(btns, titleLink.nextSibling);
      } else {
        topbar.appendChild(btns);
      }
      const popover = document.createElement("div");
      popover.id = "bible-nav-popover";
      popover.setAttribute("popover", "");
      document.body.appendChild(popover);
    }
    function renderTopbar() {
      const container = qs3("#bible-nav-btns");
      if (!container) return;
      const cur = getCurrentRef();
      if (!cur) {
        container.innerHTML = "";
        return;
      }
      const slots = [
        { ref: cur, isCurrent: true, bmIdx: -1 },
        ...bookmarks.map((b, i) => ({ ref: b, isCurrent: false, bmIdx: i })).filter((s) => !refsEqual(s.ref, cur))
      ];
      const hasMultiple = slots.length > 1;
      container.innerHTML = slots.map(({ ref, isCurrent, bmIdx }) => {
        let radioClass;
        let radioSymbol;
        if (!hasMultiple) {
          radioClass = "nav-radio";
          radioSymbol = "\u25CF";
        } else if (isCurrent) {
          radioClass = "nav-radio nav-radio--enabled-selected";
          radioSymbol = "\u25CF";
        } else {
          radioClass = "nav-radio nav-radio--enabled";
          radioSymbol = "\u25CB";
        }
        const labelHtml = `<span class="${radioClass}" aria-hidden="true">${radioSymbol}</span>${escHtml(refLabel(ref))}`;
        if (!isCurrent) {
          return `<span class="nav-ref-chip"><a class="nav-ref-btn nav-ref-btn--with-remove" href="${escHtml(refHref(ref))}">${labelHtml}</a><button type="button" class="nav-ref-chip-remove" aria-label="Remove bookmark ${escHtml(refLabel(ref))}" data-nav-remove-top-bookmark="${bmIdx}">&times;</button></span>`;
        }
        const slotData = isCurrent ? "current" : String(bmIdx);
        return `<button type="button" class="nav-ref-btn" popovertarget="bible-nav-popover" data-nav-book="${escHtml(ref.book)}" data-nav-chapter="${ref.chapter}" data-nav-slot="${slotData}">${labelHtml}</button>`;
      }).join("");
    }
    function renderPopover() {
      const popover = qs3("#bible-nav-popover");
      if (!popover) return;
      popover.innerHTML = navView === "chapters" && navSelectedBook ? renderChaptersView(navSelectedBook) : renderBooksView();
    }
    function renderBooksView() {
      ensureNavDataLoaded();
      const isCurrentSlot = activeSlot === "current";
      const bmIdx = typeof activeSlot === "number" ? activeSlot : -1;
      const slotRef = isCurrentSlot ? getCurrentRef() : bookmarks[bmIdx] ?? null;
      let topControls = "";
      if (isCurrentSlot) {
        const checked = isCurrentBookmarked() ? " checked" : "";
        topControls = `<label class="nav-check-row"><input type="checkbox" id="nav-bookmark-chk"${checked}><span>Bookmark This Reference</span></label>`;
      } else if (slotRef) {
        const book = getBook(slotRef.book);
        const href = book ? `/-/${escHtml(book.url)}/${slotRef.chapter}` : "#";
        topControls = `<a class="nav-goto-btn" href="${href}">Go\xA0to ${escHtml(refLabel(slotRef))}</a><button type="button" class="nav-remove-btn" id="nav-remove-bookmark">Remove This Bookmark</button>`;
      }
      const alphaChecked = alphabetical ? " checked" : "";
      const alphaControl = `<label class="nav-check-row"><input type="checkbox" id="nav-alpha-chk"${alphaChecked}><span>Alphabetical</span></label>`;
      const data = loadNavData();
      if (data.books.length === 0) {
        return `<div class="nav-pop-inner">
<div class="nav-pop-header"><strong>Select A Document</strong></div>
<div class="nav-pop-controls">${topControls}${alphaControl}</div>
<div class="nav-book-grid"><div class="nav-check-row">Loading references...</div></div>
</div>`;
      }
      let booksHtml;
      if (alphabetical) {
        const sorted = [...data.books].sort((a, b) => a.displayAbbr.localeCompare(b.displayAbbr));
        const btns = sorted.map((b) => `<button type="button" class="nav-book-btn" data-nav-pick-book="${escHtml(b.abbr)}">${escHtml(b.displayAbbr)}</button>`).join("");
        booksHtml = `<div class="nav-book-group">${btns}</div>`;
      } else {
        const bookMap = new Map(data.books.map((b) => [b.abbr, b]));
        booksHtml = data.sections.map((section) => {
          const btns = section.map((abbr) => {
            const b = bookMap.get(abbr);
            if (!b) return "";
            return `<button type="button" class="nav-book-btn" data-nav-pick-book="${escHtml(b.abbr)}">${escHtml(b.displayAbbr)}</button>`;
          }).join("");
          return `<div class="nav-book-group">${btns}</div>`;
        }).join("");
      }
      return `<div class="nav-pop-inner">
<div class="nav-pop-header"><strong>Select A Document</strong></div>
<div class="nav-pop-controls">${topControls}${alphaControl}</div>
<div class="nav-book-grid">${booksHtml}</div>
</div>`;
    }
    function renderChaptersView(abbr) {
      const book = getBook(abbr);
      if (!book) return "";
      const links = Array.from({ length: book.chapters }, (_, i) => i + 1).map((n) => `<a class="nav-ch-btn" href="/-/${escHtml(book.url)}/${n}">${n}</a>`).join("");
      return `<div class="nav-pop-inner">
<div class="nav-pop-header"><button type="button" class="nav-back-btn" id="nav-back" aria-label="Back to book list">&#8249;</button><strong>${escHtml(book.name)}</strong></div>
<div class="nav-ch-grid">${links}</div>
</div>`;
    }
    const module = {
      id: "bible-nav",
      label: "Bible Navigation",
      active: false,
      includeInMenu: false,
      activate() {
        if (module.active) return;
        module.active = true;
        loadStorage();
        ensureNavDataLoaded();
        injectOnce();
        renderTopbar();
        disposers.push(delegator.registerSublistener({
          eventName: "click",
          tagName: "BUTTON",
          selector: "button.nav-ref-btn",
          handle(el) {
            const slot = el.dataset.navSlot ?? "current";
            activeSlot = slot === "current" ? "current" : parseInt(slot, 10);
            navView = "books";
            navSelectedBook = null;
            renderPopover();
          }
        }));
        disposers.push(delegator.registerSublistener({
          eventName: "click",
          tagName: "BUTTON",
          selector: "button[data-nav-remove-top-bookmark]",
          handle(el, event) {
            event.preventDefault();
            const idx = parseInt(el.dataset.navRemoveTopBookmark ?? "-1", 10);
            if (idx < 0) return;
            removeBookmarkAt(idx);
            renderTopbar();
          }
        }));
        disposers.push(delegator.registerSublistener({
          eventName: "click",
          tagName: "BUTTON",
          selector: "button[data-nav-pick-book]",
          handle(el) {
            navSelectedBook = el.dataset.navPickBook ?? null;
            if (navSelectedBook) {
              navView = "chapters";
              renderPopover();
            }
          }
        }));
        disposers.push(delegator.registerSublistener({
          eventName: "click",
          tagName: "BUTTON",
          selector: "button#nav-back",
          handle() {
            navView = "books";
            navSelectedBook = null;
            renderPopover();
          }
        }));
        disposers.push(delegator.registerSublistener({
          eventName: "change",
          tagName: "INPUT",
          selector: "input#nav-bookmark-chk",
          handle(el) {
            const input = el;
            if (input.checked) {
              addCurrentBookmark();
            } else {
              removeCurrentBookmark();
            }
            renderTopbar();
            renderPopover();
          }
        }));
        disposers.push(delegator.registerSublistener({
          eventName: "click",
          tagName: "BUTTON",
          selector: "button#nav-remove-bookmark",
          handle() {
            if (typeof activeSlot === "number") removeBookmarkAt(activeSlot);
            qs3("#bible-nav-popover")?.hidePopover();
            activeSlot = "current";
            renderTopbar();
          }
        }));
        disposers.push(delegator.registerSublistener({
          eventName: "change",
          tagName: "INPUT",
          selector: "input#nav-alpha-chk",
          handle(el) {
            alphabetical = el.checked;
            saveAlphabetical();
            renderPopover();
          }
        }));
      },
      deactivate() {
        if (!module.active) return;
        module.active = false;
        while (disposers.length) disposers.pop()?.();
      }
    };
    return module;
  }

  // src/phasingScripts/phase2To3/createTransliterationModule.ts
  var TRANSLIT_COLORS = [
    "rgba(220,  60,  60, 0.28)",
    // red
    "rgba(225, 140,  30, 0.30)",
    // orange
    "rgba(195, 175,  10, 0.38)",
    // yellow
    "rgba( 40, 170,  70, 0.28)",
    // green
    "rgba( 20, 180, 165, 0.28)",
    // teal
    "rgba( 55, 130, 240, 0.30)",
    // blue
    "rgba(145,  65, 240, 0.28)",
    // purple
    "rgba(225,  50, 175, 0.28)",
    // pink
    "rgba(155,  95,  35, 0.32)",
    // brown
    "rgba(120, 185,  20, 0.32)"
    // lime
  ];
  var STYLE_ID = "translit-module-style";
  function decodePart(s) {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  }
  function parseDataM(raw) {
    const result = {};
    for (const pair of raw.split("&")) {
      if (!pair) continue;
      const sep = pair.indexOf("=");
      if (sep < 0) continue;
      result[decodePart(pair.slice(0, sep))] = decodePart(pair.slice(sep + 1));
    }
    return result;
  }
  function applyTransliterations() {
    document.querySelectorAll(".snippet-row").forEach((snippetRow) => {
      const colorMap = /* @__PURE__ */ new Map();
      let colorCounter = 0;
      snippetRow.querySelectorAll(".literal-pane .word-token").forEach((btn) => {
        const mid = parseDataM(btn.dataset.m ?? "")["mid"];
        if (mid && !colorMap.has(mid)) {
          colorMap.set(mid, TRANSLIT_COLORS[colorCounter % TRANSLIT_COLORS.length]);
          colorCounter++;
        }
      });
      snippetRow.querySelectorAll(".word-token").forEach((btn) => {
        const wrap = btn.parentElement;
        if (!wrap) return;
        const meta = parseDataM(btn.dataset.m ?? "");
        const translit = meta["tr"];
        if (!translit) return;
        const mid = meta["mid"];
        const color = mid ? colorMap.get(mid) ?? "" : "";
        const span = document.createElement("span");
        span.className = "word-translit";
        if (color) span.style.background = color;
        span.textContent = translit;
        wrap.appendChild(span);
      });
    });
  }
  function removeTransliterations() {
    document.querySelectorAll(".word-translit").forEach((el) => el.remove());
  }
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
/* Transliteration module */
.show-translit .word-wrap {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  vertical-align: top;
  gap: 2px;
}
.word-translit {
  font-size: 0.65em;
  color: var(--muted);
  border-radius: 3px;
  padding: 0 4px 1px;
  line-height: 1.4;
  white-space: nowrap;
  display: block;
}
`;
    document.head.appendChild(style);
  }
  function createTransliterationModule() {
    return {
      id: "transliteration",
      label: "Show transliteration beneath each word",
      active: false,
      activate() {
        this.active = true;
        ensureStyle();
        applyTransliterations();
        document.documentElement.classList.add("show-translit");
      },
      deactivate() {
        this.active = false;
        document.documentElement.classList.remove("show-translit");
        removeTransliterations();
      }
    };
  }

  // src/phasingScripts/phase2To3/jsDomFramework.ts
  function isDemoRoute(pathname) {
    const normalizedPath = pathname.replace(/\/+$/, "") || "/";
    return normalizedPath === "/-/hey" || normalizedPath === "/-/hey.html";
  }
  function jsDomFramework() {
    if (typeof document === "undefined") return;
    if (!document.body) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => jsDomFramework(), { once: true });
      }
      return;
    }
    if (document.documentElement.dataset.appBootstrapped === "1") return;
    document.documentElement.dataset.appBootstrapped = "1";
    const delegator = createDelegator();
    const shell = createShell();
    const theme = createTheme(shell);
    const modules = createModuleRegistry(shell);
    const onDemoPage = typeof window !== "undefined" && isDemoRoute(window.location.pathname);
    if (onDemoPage) {
      modules.register(createDemoModule(delegator, shell));
    }
    modules.register(createBibleNavModule(delegator));
    modules.register(createTransliterationModule());
    registerShellListeners(delegator, shell, theme, modules);
    theme.restore();
    modules.render();
    modules.restoreFromStorage();
    if (onDemoPage) {
      modules.activate("demo");
      shell.appendDemoLine("Framework booted");
    }
    if (document.querySelector("main.chapter-page")) {
      modules.activate("bible-nav");
    }
  }

  // src/phasingScripts/phase2To3/browserEntry.ts
  jsDomFramework();
})();
