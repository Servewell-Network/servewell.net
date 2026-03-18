import type { Delegator } from './createDelegator';
import type { ShellApi } from './createShell';
import type { ThemeApi } from './createTheme';
import type { ModuleRegistry } from './createModuleRegistry';

export function registerShellListeners(
  delegator: Delegator,
  shell: ShellApi,
  theme: ThemeApi,
  modules: ModuleRegistry
) {
  delegator.registerSublistener({
    eventName: 'click',
    tagName: 'BUTTON',
    selector: 'button[data-action="menu-open"]',
    handle() {
      shell.openPanel();
    }
  });

  delegator.registerSublistener({
    eventName: 'click',
    tagName: 'BUTTON',
    selector: 'button[data-action="menu-close"]',
    handle() {
      shell.closePanel();
    }
  });

  delegator.registerSublistener({
    eventName: 'click',
    tagName: 'DIV',
    selector: 'div[data-action="menu-close"]',
    handle() {
      shell.closePanel();
    }
  });

  delegator.registerSublistener({
    eventName: 'click',
    tagName: 'BUTTON',
    selector: 'button[data-action="scroll-top"]',
    handle() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  delegator.registerSublistener({
    eventName: 'change',
    tagName: 'INPUT',
    selector: 'input[data-setting="dark-mode"]',
    handle(matched) {
      const input = matched as HTMLInputElement;
      theme.set(input.checked ? 'dark' : 'light');
    }
  });

  delegator.registerSublistener({
    eventName: 'change',
    tagName: 'INPUT',
    selector: 'input[data-module-id]',
    handle(matched) {
      const input = matched as HTMLInputElement;
      const moduleId = input.getAttribute('data-module-id');
      if (!moduleId) return;

      if (input.checked) modules.activate(moduleId);
      else modules.deactivate(moduleId);
    }
  });
}