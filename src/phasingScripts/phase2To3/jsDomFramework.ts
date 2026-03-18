/*
We need. An object. Where the keys are events. And the value. Is. Event listener objects. 
We need. Event listener objects. Where the. Keys. Are. Tag names. And the values. Are. Modules. Better listening. 
We need. A register and deregister function. So that A modules tag name and event name. Can be added or removed. 
We need a button type. That has a checkbox. And either. Symbol or text or both? 
When you click on the symbol or text. Comma which represent an action like mute.A flyout. 
The flyout gives information. And the ability to pin or unpin. 
There are special buttons. That are similar. But they represent a mode. 
A mode is a collection of settings. Where settings are. Key value pairs. 
If a mode. Is set to on. It controls all of those key value pairs. 
If someone. Changes the value of a key the mode owns. Comma then the Mode automatically turns. Itself off. 
There's a pinned section. And a recent section. In the top bar. 
There's a default mode, always pinned. And that brings back pinned things like search. 
There's also a hamburger menu. Or such. That is. Always pinned. it is the overflow. 
When a. Checkbox. Is toggled. It removes. Or registers. That module's listeners. 
Dark Mode may be an exception. As it may have no listeners. 
So putting those together, let's say. That. Toggle. Runs. A module's init function. 
I think proving all of this. Would be a decent basis. 
I'm making this simple. JS DOM framework because I don't. Know that I need. A multipurpose tool. 
It feels more efficient and lightweight to just have what I need. 
Does this work for Bible nav? That has. More state, not just Boolean. 
Maybe that's an alternate pattern. If there's no checkbox. You still see the fly out. 
I wonder if the flyout can also be used. For the side menu. 
For bookmarks, I might have a star Or bookmark. symbol and a check box. 
When you select the check box. I might animate a star going into the list that's hidden. 
Then if you select the star Or bookmark. you see the flyout with. Existing bookmarks.
Maybe. A hint. For first time users that says. Tap anything to see. More info about it. 



*/

export function jsDomFramework() {
  if (typeof document === 'undefined') return;

  if (!document.body) {
    document.addEventListener('DOMContentLoaded', jsDomFramework, { once: true });
    return;
  }

  if (document.documentElement.dataset.appBootstrapped === '1') return;
  document.documentElement.dataset.appBootstrapped = '1';

  type Sublistener = {
    eventName: string;
    tagName: string;
    selector: string;
    handle: (matched: Element, event: Event) => void;
  };

  type AppModule = {
    id: string;
    label: string;
    active: boolean;
    activate: () => void;
    deactivate: () => void;
  };

  const sublistenersByEvent: Record<string, Sublistener[]> = {};
  const dispatchersByEvent: Record<string, EventListener> = {};
  const modules: Record<string, AppModule> = {};
  const themeStorageKey = 'servewell-theme';

  function qs<T extends Element>(selector: string): T | null {
    return document.querySelector(selector) as T | null;
  }

  function qsa<T extends Element>(selector: string): T[] {
    return Array.from(document.querySelectorAll(selector)) as T[];
  }

  function ensureDispatcher(eventName: string) {
    if (dispatchersByEvent[eventName]) return;

    const dispatcher: EventListener = function (event: Event) {
      const target = event.target instanceof Element ? event.target : null;
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

  function registerSublistener(sublistener: Sublistener): () => void {
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

  function openPanel() {
    document.body.classList.add('app-panel-open');
  }

  function closePanel() {
    document.body.classList.remove('app-panel-open');
  }

  function syncThemeInputs() {
    const isDark = document.documentElement.dataset.theme === 'dark';
    qsa<HTMLInputElement>('input[data-setting="dark-mode"]').forEach((input) => {
      input.checked = isDark;
    });
  }

  function setTheme(theme: 'light' | 'dark') {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {}
    syncThemeInputs();
  }

  function restoreTheme() {
    let savedTheme = '';
    try {
      savedTheme = localStorage.getItem(themeStorageKey) || '';
    } catch {}
    setTheme(savedTheme === 'dark' ? 'dark' : 'light');
  }

  function appendDemoLine(text: string) {
    const output = qs<HTMLDivElement>('#demoOutput');
    if (!output) return;

    const line = document.createElement('div');
    line.textContent = text;
    output.prepend(line);
  }

  function syncModuleInputs(moduleId: string, active: boolean) {
    qsa<HTMLInputElement>(`input[data-module-id="${moduleId}"]`).forEach((input) => {
      input.checked = active;
    });
  }

  function syncDemoButtons() {
    const demoActive = !!modules.demo?.active;
    qsa<HTMLElement>('[data-module-target="demo"]').forEach((el) => {
      el.classList.toggle('is-inactive', !demoActive);
      el.setAttribute('aria-disabled', demoActive ? 'false' : 'true');
    });
  }

  function renderModuleList() {
    const container = qs<HTMLDivElement>('#app-module-list');
    if (!container) return;

    container.innerHTML = Object.values(modules)
      .map((module) => {
        const checked = module.active ? 'checked' : '';
        return `
<label class="app-checkrow">
  <input type="checkbox" data-module-id="${module.id}" ${checked}>
  <span>${module.label}</span>
</label>`;
      })
      .join('\n');
  }

  function createModule(
    id: string,
    label: string,
    wireUp: () => Array<() => void>
  ): AppModule {
    let disposers: Array<() => void> = [];

    const module: AppModule = {
      id,
      label,
      active: false,
      activate() {
        if (module.active) return;
        disposers = wireUp();
        module.active = true;
        syncModuleInputs(id, true);
        syncDemoButtons();
        appendDemoLine(`${label} activated`);
      },
      deactivate() {
        if (!module.active) return;
        while (disposers.length > 0) {
          const dispose = disposers.pop();
          if (dispose) dispose();
        }
        module.active = false;
        syncModuleInputs(id, false);
        syncDemoButtons();
        appendDemoLine(`${label} deactivated`);
      }
    };

    return module;
  }

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
#app-shell-root input,
#framework-demo-root button {
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

.is-inactive {
  opacity: 0.45;
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
    <strong>Servewell</strong>
    <span class="app-spacer"></span>
    <button type="button" data-action="demo-ping" data-module-target="demo">Demo</button>
    <label class="app-checkrow">
      <input type="checkbox" data-setting="dark-mode">
      <span>Dark</span>
    </label>
  </header>

  <aside class="app-sidepanel">
    <div class="app-sidepanel-header">
      <strong>Menu</strong>
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
    <button type="button" data-action="demo-ping" data-module-target="demo">Demo</button>
    <button type="button" data-action="scroll-top">Top</button>
  </nav>
</div>`
    );
  }

  if (!qs('#framework-demo-root')) {
    document.body.insertAdjacentHTML(
      'beforeend',
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

  document.body.classList.add('with-app-shell');

  modules.demo = createModule('demo', 'Demo module', function () {
    return [
      registerSublistener({
        eventName: 'click',
        tagName: 'BUTTON',
        selector: 'button[data-action="demo-ping"]',
        handle() {
          appendDemoLine(`Demo handled at ${new Date().toLocaleTimeString()}`);
        }
      }),
      registerSublistener({
        eventName: 'click',
        tagName: 'BUTTON',
        selector: 'button[data-action="demo-clear"]',
        handle() {
          const output = qs<HTMLDivElement>('#demoOutput');
          if (!output) return;
          output.innerHTML = '';
          appendDemoLine('Demo log cleared');
        }
      })
    ];
  });

  renderModuleList();

  registerSublistener({
    eventName: 'click',
    tagName: 'BUTTON',
    selector: 'button[data-action="menu-open"]',
    handle() {
      openPanel();
    }
  });

  registerSublistener({
    eventName: 'click',
    tagName: 'BUTTON',
    selector: 'button[data-action="menu-close"]',
    handle() {
      closePanel();
    }
  });

  registerSublistener({
    eventName: 'click',
    tagName: 'DIV',
    selector: 'div[data-action="menu-close"]',
    handle() {
      closePanel();
    }
  });

  registerSublistener({
    eventName: 'click',
    tagName: 'BUTTON',
    selector: 'button[data-action="scroll-top"]',
    handle() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  registerSublistener({
    eventName: 'click',
    tagName: 'INPUT',
    selector: 'input[data-setting="dark-mode"]',
    handle(matched) {
      const input = matched as HTMLInputElement;
      setTheme(input.checked ? 'dark' : 'light');
    }
  });

  registerSublistener({
    eventName: 'click',
    tagName: 'INPUT',
    selector: 'input[data-module-id]',
    handle(matched) {
      const input = matched as HTMLInputElement;
      const moduleId = input.getAttribute('data-module-id');
      if (!moduleId) return;

      const module = modules[moduleId];
      if (!module) return;

      if (input.checked) module.activate();
      else module.deactivate();
    }
  });

  restoreTheme();
  modules.demo.activate();
  syncDemoButtons();
  appendDemoLine('Framework booted');
}