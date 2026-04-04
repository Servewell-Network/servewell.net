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
  padding-left: 1%;
}

body.with-app-shell main.chapter-page {
  padding-right: 1%;
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

#app-shell-root .app-topbar-link {
  color: var(--fg);
  text-decoration: none;
  font-size: 0.9rem;
  padding: 0.2rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: 0.35rem;
  background: var(--panel);
  white-space: nowrap;
}

#app-shell-root .app-topbar-link:hover {
  color: var(--fg);
  background: var(--bg);
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

#app-shell-root .app-sidepanel-links {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

#app-shell-root .app-sidepanel-link {
  color: var(--fg);
  text-decoration: none;
  font-size: 0.95rem;
  border: 1px solid var(--border);
  border-radius: 0.35rem;
  padding: 0.45rem 0.6rem;
  background: var(--bar);
}

#app-shell-root .app-sidepanel-link:hover {
  background: var(--bg);
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
  #app-shell-root .app-topbar > .app-checkrow,
  #app-shell-root .app-topbar > .app-topbar-link {
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
    <a class="app-topbar-link" href="/features">Features</a>
    <a class="app-topbar-link" href="/whats-next">What's Next</a>
    <a class="app-topbar-link" href="/about">About</a>
    <span class="app-spacer"></span>
  </header>

  <aside class="app-sidepanel">
    <div class="app-sidepanel-header">
      <a class="app-sidepanel-home" href="/">Servewell.net</a>
      <button type="button" data-action="menu-close">\u2715</button>
    </div>

    <section class="app-sidepanel-links">
      <a class="app-sidepanel-link" href="/features">Features</a>
      <a class="app-sidepanel-link" href="/whats-next">What's Next</a>
      <a class="app-sidepanel-link" href="/about">About</a>
    </section>

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
    legacyChapterNote?.remove();
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
  function isChapterRoute(pathname) {
    return /^\/-\/[^/]+\/(\d+)(?:\.html)?\/?$/.test(pathname);
  }
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
  color: var(--fg);
  cursor: pointer;
}

.nav-check-row input {
  accent-color: #3b82f6;
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
      if (typeof window !== "undefined" && !isChapterRoute(window.location.pathname)) return null;
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
      btns.addEventListener("wheel", (event) => {
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
        container.innerHTML = `<button type="button" class="nav-ref-btn" popovertarget="bible-nav-popover" data-nav-slot="current">Bible</button>`;
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
      const currentRef = getCurrentRef();
      const slotRef = isCurrentSlot ? currentRef : bookmarks[bmIdx] ?? null;
      let topControls = "";
      if (isCurrentSlot && currentRef) {
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
    const isChapterPage = !!document.querySelector("main.chapter-page");
    return {
      id: "transliteration",
      label: "Show transliteration beneath each word",
      active: false,
      includeInMenu: isChapterPage,
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

  // src/phasingScripts/phase2To3/createSelectionControlModule.ts
  var STYLE_ID2 = "selection-control-style";
  function getChapterPage() {
    return document.querySelector("main.chapter-page");
  }
  function asElement(node) {
    if (!node) return null;
    if (node instanceof Element) return node;
    return node.parentElement;
  }
  function getPaneKindFromElement(element) {
    if (!element) return null;
    const pane = element.closest(".snippet-pane");
    if (!(pane instanceof HTMLElement)) return null;
    if (pane.classList.contains("literal-pane")) return "literal";
    if (pane.classList.contains("traditional-pane")) return "traditional";
    return null;
  }
  function getPaneKindFromNode(node) {
    return getPaneKindFromElement(asElement(node));
  }
  function tokenMatchesPaneMode(token, mode) {
    if (mode === "both") return true;
    return getPaneKindFromElement(token) === mode;
  }
  function decodePart2(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  function parseMetadata(raw) {
    const result = {};
    for (const pair of raw.split("&")) {
      if (!pair) continue;
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex < 0) continue;
      const key = decodePart2(pair.slice(0, separatorIndex));
      const value = decodePart2(pair.slice(separatorIndex + 1));
      result[key] = value;
    }
    return result;
  }
  function parseVerseLabelFromMid(mid) {
    const colonIndex = mid.lastIndexOf(":");
    if (colonIndex < 0) return null;
    const afterColon = mid.slice(colonIndex + 1);
    const verseLabel = afterColon.split(".")[0]?.trim() ?? "";
    return verseLabel || null;
  }
  function getTokenVerseLabel(token) {
    const metadata = parseMetadata(token.dataset.m ?? "");
    const mid = metadata.mid;
    if (mid) {
      const fromMid = parseVerseLabelFromMid(mid);
      if (fromMid) return fromMid;
    }
    const pane = token.closest(".snippet-pane");
    const paneVerse = pane?.querySelector(".verse-num")?.textContent?.trim();
    if (paneVerse) return paneVerse;
    const rowVerse = token.closest(".snippet-row")?.querySelector(".verse-num")?.textContent?.trim();
    return rowVerse || null;
  }
  function normalizeTokenText(value) {
    return value.replace(/\s+/g, " ").trim();
  }
  function shouldInsertSpaceBeforeToken(token, existingText) {
    if (/^[,.;:!?%\]\)]/.test(token)) return false;
    if (/[\[(]$/.test(existingText)) return false;
    return true;
  }
  function buildSelectionText(tokens) {
    let result = "";
    for (const token of tokens) {
      const tokenText = normalizeTokenText(token.textContent ?? "");
      if (!tokenText) continue;
      if (result && shouldInsertSpaceBeforeToken(tokenText, result)) {
        result += " ";
      }
      result += tokenText;
    }
    return result;
  }
  function buildTraditionalSelectionText(tokens) {
    const groups = [];
    let currentGroup = [];
    let currentPara = null;
    for (const token of tokens) {
      const para = token.closest(".traditional-paragraph") ?? token.closest(".snippet-row") ?? null;
      if (para !== currentPara) {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = [];
        currentPara = para;
      }
      currentGroup.push(token);
    }
    if (currentGroup.length > 0) groups.push(currentGroup);
    return groups.map(buildSelectionText).join("\n\n");
  }
  function rangeIntersectsNode(range, node) {
    try {
      const nodeRange = document.createRange();
      nodeRange.selectNodeContents(node);
      const endsAfterNodeStart = range.compareBoundaryPoints(Range.START_TO_END, nodeRange) > 0;
      const startsBeforeNodeEnd = range.compareBoundaryPoints(Range.END_TO_START, nodeRange) < 0;
      return endsAfterNodeStart && startsBeforeNodeEnd;
    } catch {
      return false;
    }
  }
  function rectsOverlap(a, b) {
    const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const overlapHeight = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return overlapWidth > 0 && overlapHeight > 0;
  }
  function hasVisualRangeOverlap(rangeRects, element) {
    const tokenRects = Array.from(element.getClientRects());
    if (tokenRects.length === 0) return false;
    for (const tokenRect of tokenRects) {
      for (const rangeRect of rangeRects) {
        if (rectsOverlap(tokenRect, rangeRect)) {
          return true;
        }
      }
    }
    return false;
  }
  function tokenIsSelectedByRange(range, rangeRects, token) {
    if (!rangeIntersectsNode(range, token)) return false;
    if (rangeRects.length > 0) {
      return hasVisualRangeOverlap(rangeRects, token);
    }
    return true;
  }
  function buildTraditionalSelectionTextFromRange(page, selection) {
    if (selection.rangeCount === 0) return "";
    const range = selection.getRangeAt(0);
    const rangeRects = Array.from(range.getClientRects());
    const blocks = Array.from(
      page.querySelectorAll(
        ".traditional-pane .traditional-heading, .traditional-pane .traditional-crossref, .traditional-pane .traditional-paragraph"
      )
    );
    const pieces = [];
    function pushPiece(text, kind) {
      const normalized = normalizeTokenText(text);
      if (!normalized) return;
      pieces.push({ text: normalized, kind });
    }
    for (const block of blocks) {
      if (!rangeIntersectsNode(range, block)) continue;
      if (block.classList.contains("traditional-paragraph")) {
        const tokens = Array.from(block.querySelectorAll("button.word-token")).filter(
          (token) => tokenIsSelectedByRange(range, rangeRects, token)
        );
        if (tokens.length > 0) {
          pushPiece(buildSelectionText(tokens), "paragraph");
        }
        continue;
      }
      if (block.classList.contains("traditional-heading")) {
        pushPiece(block.textContent ?? "", "heading");
        continue;
      }
      pushPiece(block.textContent ?? "", "crossref");
    }
    let result = "";
    for (const piece of pieces) {
      if (result) {
        result += piece.kind === "heading" ? "\n\n\n" : "\n\n";
      }
      result += piece.text;
    }
    return result;
  }
  function resolvePaneMode(selection) {
    const beginPane = getPaneKindFromNode(selection.anchorNode);
    const endPane = getPaneKindFromNode(selection.focusNode);
    if (beginPane && endPane && beginPane === endPane) return beginPane;
    return "both";
  }
  function getSelectedTokens(page, selection, mode) {
    if (selection.rangeCount === 0) return [];
    const range = selection.getRangeAt(0);
    const rangeRects = Array.from(range.getClientRects());
    const tokens = Array.from(page.querySelectorAll("button.word-token"));
    return tokens.filter((token) => {
      if (!tokenMatchesPaneMode(token, mode)) return false;
      return tokenIsSelectedByRange(range, rangeRects, token);
    });
  }
  function getSelectedPanesInVisualOrder(tokens) {
    const panesByKind = /* @__PURE__ */ new Map();
    for (const token of tokens) {
      const kind = getPaneKindFromElement(token);
      if (!kind || panesByKind.has(kind)) continue;
      const pane = token.closest(".snippet-pane");
      if (pane instanceof HTMLElement) {
        panesByKind.set(kind, pane);
      }
    }
    return Array.from(panesByKind.entries()).sort(([, a], [, b]) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map(([kind, element]) => ({ kind, element }));
  }
  function inferPaneFromPointerX(selectedPanes, pointerClientX) {
    if (selectedPanes.length === 0) return null;
    if (selectedPanes.length === 1) return selectedPanes[0].kind;
    let left = Number.POSITIVE_INFINITY;
    let right = Number.NEGATIVE_INFINITY;
    for (const pane of selectedPanes) {
      const rect = pane.element.getBoundingClientRect();
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
    }
    if (!(right > left)) return null;
    const clampedX = Math.min(Math.max(pointerClientX, left), right - 1e-3);
    const segmentWidth = (right - left) / selectedPanes.length;
    const index = Math.min(selectedPanes.length - 1, Math.floor((clampedX - left) / segmentWidth));
    return selectedPanes[index]?.kind ?? null;
  }
  function getVisibleModePane(page) {
    if (page.classList.contains("mode-traditional-only")) return "traditional";
    if (page.classList.contains("mode-literal-only")) return "literal";
    return null;
  }
  function addPartialSuffix(verseLabel, suffix) {
    if (/^\d+$/.test(verseLabel)) {
      return `${verseLabel}${suffix}`;
    }
    return verseLabel;
  }
  function getBookName(page) {
    const abbr = (page.dataset.book ?? "").trim();
    const fallback = abbr || "Reference";
    const navDataScript = document.getElementById("bible-nav-data");
    if (!(navDataScript instanceof HTMLScriptElement)) return fallback;
    if (!navDataScript.textContent) return fallback;
    try {
      const parsed = JSON.parse(navDataScript.textContent);
      const books = Array.isArray(parsed.books) ? parsed.books : [];
      for (const book of books) {
        if (book.abbr === abbr && typeof book.name === "string" && book.name.trim()) {
          return book.name.trim();
        }
      }
    } catch {
      return fallback;
    }
    return fallback;
  }
  function buildReferencePrefix(page, selectedTokens, mode) {
    if (selectedTokens.length === 0) return null;
    const allTokensInMode = Array.from(page.querySelectorAll("button.word-token")).filter(
      (token) => tokenMatchesPaneMode(token, mode)
    );
    const firstTokenByVerse = /* @__PURE__ */ new Map();
    const lastTokenByVerse = /* @__PURE__ */ new Map();
    for (const token of allTokensInMode) {
      const verseLabel = getTokenVerseLabel(token);
      if (!verseLabel) continue;
      if (!firstTokenByVerse.has(verseLabel)) {
        firstTokenByVerse.set(verseLabel, token);
      }
      lastTokenByVerse.set(verseLabel, token);
    }
    const firstSelected = selectedTokens[0];
    const lastSelected = selectedTokens[selectedTokens.length - 1];
    const startVerse = getTokenVerseLabel(firstSelected);
    const endVerse = getTokenVerseLabel(lastSelected);
    const chapterLabel = (page.dataset.chapter ?? "").trim();
    const bookName = getBookName(page);
    if (!startVerse || !endVerse || !chapterLabel) return null;
    const verseStartToken = firstTokenByVerse.get(startVerse);
    const verseEndToken = lastTokenByVerse.get(endVerse);
    const startPartial = !!verseStartToken && verseStartToken !== firstSelected;
    const endPartial = !!verseEndToken && verseEndToken !== lastSelected;
    let verseRangeLabel = "";
    if (startVerse === endVerse) {
      if (startPartial && !endPartial) {
        verseRangeLabel = addPartialSuffix(startVerse, "b");
      } else if (!startPartial && endPartial) {
        verseRangeLabel = addPartialSuffix(startVerse, "a");
      } else if (startPartial && endPartial) {
        verseRangeLabel = addPartialSuffix(startVerse, "b");
      } else {
        verseRangeLabel = startVerse;
      }
    } else {
      const startLabel = startPartial ? addPartialSuffix(startVerse, "b") : startVerse;
      const endLabel = endPartial ? addPartialSuffix(endVerse, "a") : endVerse;
      verseRangeLabel = `${startLabel}-${endLabel}`;
    }
    return `${bookName} ${chapterLabel}:${verseRangeLabel}`;
  }
  function trimLikelyBoundaryLeadToken(page, mode, tokens, lastGestureStartedOnToken) {
    if (mode === "both") return tokens;
    if (lastGestureStartedOnToken) return tokens;
    if (tokens.length < 2) return tokens;
    const firstToken = tokens[0];
    const secondToken = tokens[1];
    const firstVerse = getTokenVerseLabel(firstToken);
    const secondVerse = getTokenVerseLabel(secondToken);
    if (!firstVerse || !secondVerse || firstVerse === secondVerse) return tokens;
    const firstVerseCount = tokens.filter((token) => getTokenVerseLabel(token) === firstVerse).length;
    if (firstVerseCount !== 1) return tokens;
    const allTokensInMode = Array.from(page.querySelectorAll("button.word-token")).filter(
      (token) => tokenMatchesPaneMode(token, mode)
    );
    let lastTokenInFirstVerse = null;
    for (const token of allTokensInMode) {
      if (getTokenVerseLabel(token) === firstVerse) {
        lastTokenInFirstVerse = token;
      }
    }
    if (lastTokenInFirstVerse !== firstToken) return tokens;
    return tokens.slice(1);
  }
  function buildBothPanesSectionText(page, selection) {
    function groupByRow(tokens) {
      const rowMap = /* @__PURE__ */ new Map();
      for (const token of tokens) {
        const row = token.closest(".snippet-row");
        if (!row) continue;
        if (!rowMap.has(row)) rowMap.set(row, []);
        rowMap.get(row).push(token);
      }
      return Array.from(rowMap.values());
    }
    const literalGroups = groupByRow(getSelectedTokens(page, selection, "literal"));
    const traditionalText = buildTraditionalSelectionTextFromRange(page, selection);
    if (literalGroups.length === 0 && !traditionalText) return null;
    const sections = [];
    if (literalGroups.length > 0) {
      sections.push("LITERAL\n" + literalGroups.map(buildSelectionText).join("\n\n"));
    }
    if (traditionalText) {
      sections.push("TRADITIONAL\n" + traditionalText);
    }
    return sections.join("\n\n");
  }
  function ensureStyle2() {
    if (document.getElementById(STYLE_ID2)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID2;
    style.textContent = `
.chapter-page.selection-lock-literal .traditional-pane,
.chapter-page.selection-lock-traditional .literal-pane {
  user-select: none;
  -webkit-user-select: none;
}

.chapter-page .word-token {
  user-select: text;
  -webkit-user-select: text;
}
`;
    document.head.appendChild(style);
  }
  function createSelectionControlModule() {
    let page = null;
    let pointerId = null;
    let startPane = null;
    let lastPointerClientX = null;
    let gestureStartedOnToken = false;
    let lastGestureStartedOnToken = false;
    let gestureCrossedPanes = false;
    let lastGestureCrossedPanes = false;
    const disposers = [];
    function setLockedPane(pane) {
      if (!page) return;
      page.classList.toggle("selection-lock-literal", pane === "literal");
      page.classList.toggle("selection-lock-traditional", pane === "traditional");
    }
    function resetGestureState() {
      pointerId = null;
      startPane = null;
      gestureStartedOnToken = false;
      gestureCrossedPanes = false;
      window.setTimeout(() => setLockedPane(null), 0);
    }
    function onPointerDown(event) {
      if (!page) return;
      if (!event.isPrimary) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (!(event.target instanceof Node)) return;
      pointerId = event.pointerId;
      startPane = getPaneKindFromNode(event.target);
      lastPointerClientX = event.clientX;
      gestureStartedOnToken = asElement(event.target)?.closest("button.word-token") !== null;
      lastGestureStartedOnToken = false;
      gestureCrossedPanes = false;
      lastGestureCrossedPanes = false;
      setLockedPane(startPane);
    }
    function onPointerMove(event) {
      if (!page) return;
      if (pointerId === null || event.pointerId !== pointerId) return;
      if (!(event.target instanceof Node)) return;
      lastPointerClientX = event.clientX;
      const hoverPane = getPaneKindFromNode(event.target);
      if (startPane && hoverPane && hoverPane !== startPane) {
        gestureCrossedPanes = true;
        setLockedPane(null);
        return;
      }
      if (!startPane && hoverPane) {
        setLockedPane(hoverPane);
      }
    }
    function onPointerUpOrCancel(event) {
      if (pointerId === null) return;
      if (event.pointerId !== pointerId) return;
      lastPointerClientX = event.clientX;
      lastGestureStartedOnToken = gestureStartedOnToken;
      lastGestureCrossedPanes = gestureCrossedPanes;
      resetGestureState();
    }
    function onWindowBlur() {
      lastGestureStartedOnToken = false;
      lastGestureCrossedPanes = false;
      resetGestureState();
    }
    function onCopy(event) {
      if (!page) return;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      const selectionTouchesPage = page.contains(range.commonAncestorContainer) || rangeIntersectsNode(range, page);
      if (!selectionTouchesPage) return;
      const allSelectedTokens = getSelectedTokens(page, selection, "both");
      const traditionalBodyFromRange = buildTraditionalSelectionTextFromRange(page, selection);
      const forcedPane = getVisibleModePane(page);
      let paneMode = resolvePaneMode(selection);
      if (forcedPane) {
        paneMode = forcedPane;
      }
      const selectedPanes = getSelectedPanesInVisualOrder(
        forcedPane ? allSelectedTokens.filter((token) => getPaneKindFromElement(token) === forcedPane) : allSelectedTokens
      );
      if (!forcedPane && selectedPanes.length === 1) {
        paneMode = selectedPanes[0].kind;
      } else if (!forcedPane && selectedPanes.length === 0 && traditionalBodyFromRange) {
        paneMode = "traditional";
      } else if (!forcedPane && selectedPanes.length > 1) {
        if (lastGestureCrossedPanes) {
          paneMode = "both";
        } else if (lastPointerClientX !== null) {
          const inferredPane = inferPaneFromPointerX(selectedPanes, lastPointerClientX);
          if (inferredPane) {
            paneMode = inferredPane;
          }
        }
      }
      if (paneMode === "both") {
        if (selectedPanes.length < 2) return;
        const prefix2 = buildReferencePrefix(page, allSelectedTokens, "both");
        const bodyText2 = buildBothPanesSectionText(page, selection);
        if (!prefix2 && !bodyText2) return;
        const payload2 = prefix2 ? bodyText2 ? `${prefix2}
${bodyText2}` : prefix2 : bodyText2 ?? "";
        if (!payload2) return;
        event.preventDefault();
        event.clipboardData?.setData("text/plain", payload2);
        return;
      }
      let selectedTokens = allSelectedTokens.filter((token) => getPaneKindFromElement(token) === paneMode);
      selectedTokens = trimLikelyBoundaryLeadToken(page, paneMode, selectedTokens, lastGestureStartedOnToken);
      const prefix = selectedTokens.length > 0 ? buildReferencePrefix(page, selectedTokens, paneMode) : null;
      let bodyText = "";
      if (paneMode === "traditional") {
        bodyText = !lastGestureStartedOnToken && traditionalBodyFromRange ? traditionalBodyFromRange : selectedTokens.length > 0 ? buildTraditionalSelectionText(selectedTokens) : traditionalBodyFromRange;
      } else {
        if (selectedTokens.length === 0) return;
        bodyText = buildSelectionText(selectedTokens);
      }
      if (!prefix && !bodyText) return;
      const payload = prefix ? bodyText ? `${prefix}
${bodyText}` : prefix : bodyText;
      if (!payload) return;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", payload);
    }
    return {
      id: "selection-control",
      label: "Selection Control",
      active: false,
      includeInMenu: false,
      activate() {
        if (this.active) return;
        page = getChapterPage();
        if (!page) return;
        this.active = true;
        ensureStyle2();
        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("pointermove", onPointerMove, true);
        document.addEventListener("pointerup", onPointerUpOrCancel, true);
        document.addEventListener("pointercancel", onPointerUpOrCancel, true);
        document.addEventListener("copy", onCopy, true);
        window.addEventListener("blur", onWindowBlur);
        disposers.push(() => document.removeEventListener("pointerdown", onPointerDown, true));
        disposers.push(() => document.removeEventListener("pointermove", onPointerMove, true));
        disposers.push(() => document.removeEventListener("pointerup", onPointerUpOrCancel, true));
        disposers.push(() => document.removeEventListener("pointercancel", onPointerUpOrCancel, true));
        disposers.push(() => document.removeEventListener("copy", onCopy, true));
        disposers.push(() => window.removeEventListener("blur", onWindowBlur));
      },
      deactivate() {
        if (!this.active) return;
        this.active = false;
        while (disposers.length > 0) {
          disposers.pop()?.();
        }
        setLockedPane(null);
        pointerId = null;
        startPane = null;
        lastPointerClientX = null;
        gestureStartedOnToken = false;
        lastGestureStartedOnToken = false;
        gestureCrossedPanes = false;
        lastGestureCrossedPanes = false;
        page = null;
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
    modules.register(createSelectionControlModule());
    registerShellListeners(delegator, shell, theme, modules);
    theme.restore();
    modules.render();
    modules.restoreFromStorage();
    if (onDemoPage) {
      modules.activate("demo");
      shell.appendDemoLine("Framework booted");
    }
    modules.activate("bible-nav");
    if (document.querySelector("main.chapter-page")) {
      modules.activate("selection-control");
    }
  }

  // src/phasingScripts/phase2To3/browserEntry.ts
  jsDomFramework();
})();
