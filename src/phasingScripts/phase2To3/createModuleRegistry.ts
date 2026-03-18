import type { Delegator } from './createDelegator';
import type { ShellApi } from './createShell';

export type AppModule = {
  id: string;
  label: string;
  active: boolean;
  activate: () => void;
  deactivate: () => void;
};

export type ModuleRegistry = {
  render: () => void;
  activate: (id: string) => void;
  deactivate: (id: string) => void;
  isActive: (id: string) => boolean;
};

function qs<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector(selector) as T | null;
}

export function createModuleRegistry(delegator: Delegator, shell: ShellApi): ModuleRegistry {
  const modules: Record<string, AppModule> = {};

  function refreshUi() {
    shell.syncDemoButtons(!!modules.demo?.active);
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

  modules.demo = createModule('demo', 'Demo module', function () {
    return [
      delegator.registerSublistener({
        eventName: 'click',
        tagName: 'BUTTON',
        selector: 'button[data-action="demo-ping"]',
        handle() {
          shell.appendDemoLine(`Demo handled at ${new Date().toLocaleTimeString()}`);
        }
      }),
      delegator.registerSublistener({
        eventName: 'click',
        tagName: 'BUTTON',
        selector: 'button[data-action="demo-clear"]',
        handle() {
          const output = qs<HTMLDivElement>('#demoOutput');
          if (!output) return;
          output.innerHTML = '';
          shell.appendDemoLine('Demo log cleared');
        }
      })
    ];
  });

  function render() {
    shell.renderModuleList(Object.values(modules));
  }

  function activate(id: string) {
    modules[id]?.activate();
  }

  function deactivate(id: string) {
    modules[id]?.deactivate();
  }

  function isActive(id: string): boolean {
    return !!modules[id]?.active;
  }

  return { render, activate, deactivate, isActive };
}