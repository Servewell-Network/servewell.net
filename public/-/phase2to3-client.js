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
      <button type="button" data-action="menu-close">\u2715</button>
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
    if (!qs("#framework-demo-root")) {
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
    document.body.classList.add("with-app-shell");
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
  function qs2(selector) {
    return document.querySelector(selector);
  }
  function createModuleRegistry(delegator, shell) {
    const modules = {};
    function refreshUi() {
      shell.syncDemoButtons(!!modules.demo?.active);
    }
    function createModule(id, label, wireUp) {
      let disposers = [];
      const module = {
        id,
        label,
        active: false,
        activate() {
          if (module.active) return;
          disposers = wireUp();
          module.active = true;
          shell.syncModuleInputs(id, true);
          refreshUi();
          shell.appendDemoLine(`${label} activated`);
        },
        deactivate() {
          if (!module.active) return;
          while (disposers.length > 0) {
            const dispose = disposers.pop();
            if (dispose) dispose();
          }
          module.active = false;
          shell.syncModuleInputs(id, false);
          refreshUi();
          shell.appendDemoLine(`${label} deactivated`);
        }
      };
      return module;
    }
    modules.demo = createModule("demo", "Demo module", function() {
      return [
        delegator.registerSublistener({
          eventName: "click",
          tagName: "BUTTON",
          selector: 'button[data-action="demo-ping"]',
          handle() {
            shell.appendDemoLine(`Demo handled at ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`);
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
            shell.appendDemoLine("Demo log cleared");
          }
        })
      ];
    });
    function render() {
      shell.renderModuleList(Object.values(modules));
    }
    function activate(id) {
      modules[id]?.activate();
    }
    function deactivate(id) {
      modules[id]?.deactivate();
    }
    function isActive(id) {
      return !!modules[id]?.active;
    }
    return { render, activate, deactivate, isActive };
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

  // src/phasingScripts/phase2To3/jsDomFramework.ts
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
    const modules = createModuleRegistry(delegator, shell);
    registerShellListeners(delegator, shell, theme, modules);
    theme.restore();
    modules.render();
    modules.activate("demo");
    shell.syncDemoButtons(modules.isActive("demo"));
    shell.appendDemoLine("Framework booted");
  }

  // src/phasingScripts/phase2To3/browserEntry.ts
  jsDomFramework();
})();
