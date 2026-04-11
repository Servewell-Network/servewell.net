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

import { createDelegator } from './createDelegator';
import { createShell } from './createShell';
import { createTheme } from './createTheme';
import { createModuleRegistry } from './createModuleRegistry';
import { registerShellListeners } from './registerShellListeners';
import { createDemoModule } from './createDemoModule';
import { createBibleNavModule } from './createBibleNavModule';
import { createVerseNumberPopoverModule } from './createVerseNumberPopoverModule';
import { createTransliterationModule } from './createTransliterationModule';
import { createSelectionControlModule } from './createSelectionControlModule';

function isDemoRoute(pathname: string): boolean {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  return normalizedPath === '/-/hey' || normalizedPath === '/-/hey.html';
}

export function jsDomFramework() {
  if (typeof document === 'undefined') return;

  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => jsDomFramework(), { once: true });
    }
    return;
  }

  if (document.documentElement.dataset.appBootstrapped === '1') return;
  document.documentElement.dataset.appBootstrapped = '1';

  const delegator = createDelegator();
  const shell = createShell();
  const theme = createTheme(shell);
  const modules = createModuleRegistry(shell);
  const onDemoPage = typeof window !== 'undefined' && isDemoRoute(window.location.pathname);

  // Register modules
  if (onDemoPage) {
    modules.register(createDemoModule(delegator, shell));
  }
  modules.register(createBibleNavModule(delegator));
  modules.register(createVerseNumberPopoverModule(delegator));
  modules.register(createTransliterationModule());
  modules.register(createSelectionControlModule());

  registerShellListeners(delegator, shell, theme, modules);

  theme.restore();
  modules.render();
  modules.restoreFromStorage();
  if (onDemoPage) {
    modules.activate('demo');
    shell.appendDemoLine('Framework booted');
  }
  modules.activate('bible-nav');
  if (document.querySelector('main.chapter-page')) {
    modules.activate('verse-number-popover');
    modules.activate('selection-control');
    activateVerseHashHighlight();
  }
}

function activateVerseHashHighlight() {
  // Inject keyframe animation CSS once
  const styleId = 'verse-highlight-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '@keyframes verseHighlight {',
      '  0%   { outline: 3px solid rgba(253, 224, 71, 0.9); background-color: rgba(254, 249, 195, 0.6); }',
      '  60%  { outline: 3px solid rgba(253, 224, 71, 0.9); background-color: rgba(254, 249, 195, 0.6); }',
      '  100% { outline: 3px solid rgba(253, 224, 71, 0); background-color: rgba(254, 249, 195, 0); }',
      '}',
      '@keyframes verseHighlightDark {',
      '  0%   { outline: 3px solid rgba(251, 191, 36, 0.6); background-color: rgba(251, 191, 36, 0.18); }',
      '  60%  { outline: 3px solid rgba(251, 191, 36, 0.6); background-color: rgba(251, 191, 36, 0.18); }',
      '  100% { outline: 3px solid rgba(251, 191, 36, 0); background-color: rgba(251, 191, 36, 0); }',
      '}',
      '.verse-highlight {',
      '  animation: verseHighlight 2.2s ease-out forwards;',
      '  border-radius: 4px;',
      '}',
      '[data-theme="dark"] .verse-highlight {',
      '  animation-name: verseHighlightDark;',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  function highlight() {
    const hash = window.location.hash;
    if (!hash) return;
    const verseRef = hash.slice(1); // e.g. "15" or "15-16"
    const match = /^(\d+)(?:-(\d+))?$/.exec(verseRef);
    if (!match) return;

    const start = parseInt(match[1], 10);
    const end = match[2] ? parseInt(match[2], 10) : start;
    const low = Math.min(start, end);
    const high = Math.max(start, end);

    // Keep the range bounded to avoid accidental very large highlights.
    if (high - low > 200) return;

    const targets: HTMLElement[] = [];
    for (let verse = low; verse <= high; verse += 1) {
      const el = document.getElementById(String(verse));
      if (el && el.classList.contains('snippet-row')) {
        targets.push(el as HTMLElement);
      }
    }
    if (targets.length === 0) return;

    targets[0].scrollIntoView({ block: 'start' });

    targets.forEach((target) => {
      target.classList.remove('verse-highlight');
      // Force reflow to restart animation if hash is clicked again
      void target.offsetWidth;
      target.classList.add('verse-highlight');
      target.addEventListener('animationend', () => {
        target.classList.remove('verse-highlight');
      }, { once: true });
    });
  }

  window.addEventListener('hashchange', highlight);
  highlight();
}