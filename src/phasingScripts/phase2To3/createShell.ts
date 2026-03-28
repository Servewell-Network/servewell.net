export type ShellModuleListItem = {
  id: string;
  label: string;
  active: boolean;
};

export type ShellApi = {
  openPanel: () => void;
  closePanel: () => void;
  syncThemeInputs: (theme: 'light' | 'dark') => void;
  appendDemoLine: (text: string) => void;
  syncModuleInputs: (moduleId: string, active: boolean) => void;
  syncDemoButtons: (active: boolean) => void;
  renderModuleList: (modules: ShellModuleListItem[]) => void;
};

function qs<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector(selector) as T | null;
}

function qsa<T extends HTMLElement>(selector: string): T[] {
  return Array.from(document.querySelectorAll(selector)) as T[];
}

export function createShell(): ShellApi {
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

  if (!qs('#app-shell-style')) {
    const style = document.createElement('style');
    style.id = 'app-shell-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  if (!qs('#app-shell-root')) {
    document.body.insertAdjacentHTML(
      'afterbegin',
      `
<div id="app-shell-root">
  <header class="app-topbar">
    <button type="button" data-action="menu-open" aria-label="Open menu">☰</button>
    <a class="app-topbar-home" href="/">Servewell.net</a>
    <span class="app-spacer"></span>
    <label class="app-checkrow">
      <input type="checkbox" data-setting="dark-mode">
      <span>Dark</span>
    </label>
  </header>

  <aside class="app-sidepanel">
    <div class="app-sidepanel-header">
      <a class="app-sidepanel-home" href="/">Servewell.net</a>
      <button type="button" data-action="menu-close">✕</button>
    </div>

    <section>
      <h3>Settings</h3>
      <label class="app-checkrow">
        <input type="checkbox" data-setting="dark-mode">
        <span>Dark mode</span>
      </label>
    </section>

    <section>
      <h3>Modules</h3>
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

  document.body.classList.add('with-app-shell');

  // Remove legacy static link emitted by older generated pages.
  const legacyHomeLink = document.querySelector<HTMLAnchorElement>('body > a[href="/"]');
  if (legacyHomeLink?.textContent?.trim() === 'Back to Home') {
    legacyHomeLink.remove();
  }

  function openPanel() {
    document.body.classList.add('app-panel-open');
  }

  function closePanel() {
    document.body.classList.remove('app-panel-open');
  }

  function syncThemeInputs(theme: 'light' | 'dark') {
    const isDark = theme === 'dark';
    qsa<HTMLInputElement>('input[data-setting="dark-mode"]').forEach((input) => {
      input.checked = isDark;
    });
  }

  function appendDemoLine(text: string) {
    const output = qs<HTMLDivElement>('#demoOutput');
    if (!output) return;

    const line = document.createElement('div');
    line.textContent = text;
    output.insertBefore(line, output.firstChild);
  }

  function syncModuleInputs(moduleId: string, active: boolean) {
    qsa<HTMLInputElement>(`input[data-module-id="${moduleId}"]`).forEach((input) => {
      input.checked = active;
    });
  }

  function syncDemoButtons(active: boolean) {
    qsa<HTMLElement>('[data-module-target="demo"]').forEach((el) => {
      const inactive = !active;
      el.classList.toggle('is-inactive', inactive);
      el.setAttribute('aria-disabled', inactive ? 'true' : 'false');

      if (el instanceof HTMLButtonElement) {
        el.disabled = inactive;
      }
    });
  }

  function renderModuleList(modules: ShellModuleListItem[]) {
    const container = qs<HTMLDivElement>('#app-module-list');
    if (!container) return;

    container.innerHTML = modules
      .map((module) => {
        const checked = module.active ? ' checked' : '';
        return `
<label class="app-checkrow">
  <input type="checkbox" data-module-id="${module.id}"${checked}>
  <span>${module.label}</span>
</label>`;
      })
      .join('\n');
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