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
    console.info('A custom JS framework is running...');

    // Prevent duplicate bootstrap
    if (document.documentElement.dataset.appBootstrapped === '1') return;
    document.documentElement.dataset.appBootstrapped = '1';

    type Sublistener = {
        event: 'click';
        tagName: string;
        selector: string;
        handle: (matched: Element, event: Event) => void;
    };

    class Delegator {
        private sublisteners: Sublistener[] = [];
        private listening = false;

        register(sublistener: Sublistener) {
            this.sublisteners.push(sublistener);

            // Exactly one event sublistener on document
            if (!this.listening) {
                document.addEventListener('click', this.dispatch);
                this.listening = true;
            }
        }

        private dispatch = (event: Event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) return;

            for (const sublistener of this.sublisteners) {
                const matched = target.closest(sublistener.selector);
                if (!matched) continue;
                if (matched.tagName.toUpperCase() !== sublistener.tagName.toUpperCase()) continue;
                sublistener.handle(matched, event);
            }
        };
    }

    const css = `
:root {
  --bg: #ffffff;
  --fg: #111111;
  --bar: #f3f3f3;
  --panel: #ffffff;
  --border: #d8d8d8;
}
:root[data-theme="dark"] {
  --bg: #101215;
  --fg: #e8e8e8;
  --bar: #171a1f;
  --panel: #161a1f;
  --border: #2a2f37;
}
html, body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
}
body.with-shell {
  padding-top: 52px;
  padding-bottom: 56px;
}
#app-shell-root .topbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  display: flex;
  align-items: center;
  gap: .75rem;
  padding: .5rem .75rem;
  background: var(--bar);
  border-bottom: 1px solid var(--border);
  z-index: 30;
}
#app-shell-root .spacer { flex: 1; }

#app-shell-root .panel {
  position: fixed;
  top: 0; bottom: 0; left: 0;
  width: min(84vw, 320px);
  transform: translateX(-105%);
  transition: transform .18s ease;
  background: var(--panel);
  border-right: 1px solid var(--border);
  padding: 1rem;
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: .75rem;
}
body.panel-open #app-shell-root .panel { transform: translateX(0); }

#app-shell-root .overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.35);
  opacity: 0;
  pointer-events: none;
  transition: opacity .18s ease;
  z-index: 35;
}
body.panel-open #app-shell-root .overlay {
  opacity: 1;
  pointer-events: auto;
}

#app-shell-root .bottombar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: .5rem;
  padding: .5rem;
  background: var(--bar);
  border-top: 1px solid var(--border);
  z-index: 30;
}

#app-shell-root button {
  cursor: pointer;
  padding: .4rem .6rem;
}

@media (min-width: 900px) {
  body.with-shell { padding-bottom: 0; }
  #app-shell-root .bottombar { display: none; }
}
`;

    if (!document.getElementById('app-shell-style')) {
        const style = document.createElement('style');
        style.id = 'app-shell-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    if (!document.getElementById('app-shell-root')) {
        document.body.insertAdjacentHTML(
            'afterbegin',
            `
<div id="app-shell-root">
  <header class="topbar">
    <button data-action="menu-open">☰</button>
    <strong>Servewell</strong>
    <span class="spacer"></span>
    <label data-action="toggle-dark">
      <input type="checkbox" data-role="dark-toggle" />
      Dark mode
    </label>
  </header>

  <aside class="panel" id="overflowPanel">
    <button data-action="menu-close">Close</button>
    <button data-action="home">Home</button>
    <button data-action="demo">Demo action</button>
    <label data-action="toggle-dark">
      <input type="checkbox" data-role="dark-toggle" />
      Dark mode
    </label>
  </aside>

  <div class="overlay" data-action="menu-close"></div>

  <nav class="bottombar">
    <button data-action="home">Home</button>
    <button data-action="menu-open">Menu</button>
    <button data-action="scroll-top">Top</button>
  </nav>
</div>
      `
        );
    }

    document.body.classList.add('with-shell');

    const setTheme = (mode: 'light' | 'dark') => {
        document.documentElement.dataset.theme = mode;
        try {
            localStorage.setItem('theme', mode);
        } catch { }
        document.querySelectorAll('input[data-role="dark-toggle"]').forEach((el) => {
            (el as HTMLInputElement).checked = mode === 'dark';
        });
    };

    const savedTheme = (() => {
        try {
            return localStorage.getItem('theme');
        } catch {
            return null;
        }
    })();
    setTheme(savedTheme === 'dark' ? 'dark' : 'light');

    const bus = new Delegator();

    // Module 1: layout/nav
    const layoutModule = () => {
        bus.register({
            event: 'click',
            tagName: 'BUTTON',
            selector: 'button[data-action="menu-open"]',
            handle: () => document.body.classList.add('panel-open')
        });

        bus.register({
            event: 'click',
            tagName: 'BUTTON',
            selector: 'button[data-action="menu-close"]',
            handle: () => document.body.classList.remove('panel-open')
        });

        bus.register({
            event: 'click',
            tagName: 'DIV',
            selector: 'div[data-action="menu-close"]',
            handle: () => document.body.classList.remove('panel-open')
        });

        bus.register({
            event: 'click',
            tagName: 'BUTTON',
            selector: 'button[data-action="home"]',
            handle: () => {
                window.location.href = '/';
            }
        });

        bus.register({
            event: 'click',
            tagName: 'BUTTON',
            selector: 'button[data-action="scroll-top"]',
            handle: () => window.scrollTo({ top: 0, behavior: 'smooth' })
        });
    };

    // Module 2: theme
    const themeModule = () => {
        bus.register({
            event: 'click',
            tagName: 'LABEL',
            selector: 'label[data-action="toggle-dark"]',
            handle: () => {
                const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
                setTheme(current === 'dark' ? 'light' : 'dark');
            }
        });
    };

    // Module 3: demo
    const demoModule = () => {
        bus.register({
            event: 'click',
            tagName: 'BUTTON',
            selector: 'button[data-action="demo"]',
            handle: () => {
                console.log('[demo-module] handled via delegated click sublistener');
            }
        });
    };

    layoutModule();
    themeModule();
    demoModule();
}