import type { Delegator } from './createDelegator';
import type { ShellApi } from './createShell';
import type { AppModule } from './createModuleRegistry';

function qs<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector(selector) as T | null;
}

export function createDemoModule(delegator: Delegator, shell: ShellApi): AppModule {
  // Inject demo HTML once
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

  // Inject demo CSS once
  if (!qs('#demo-style')) {
    const style = document.createElement('style');
    style.id = 'demo-style';
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

  function appendDemoLine(text: string) {
    const output = qs<HTMLDivElement>('#demoOutput');
    if (!output) return;

    const line = document.createElement('div');
    line.textContent = text;
    output.insertBefore(line, output.firstChild);
  }

  const module: AppModule = {
    id: 'demo',
    label: 'Demo module',
    active: false,
    activate() {
      if (module.active) return;

      const disposers = [
        delegator.registerSublistener({
          eventName: 'click',
          tagName: 'BUTTON',
          selector: 'button[data-action="demo-ping"]',
          handle() {
            appendDemoLine(`Demo handled at ${new Date().toLocaleTimeString()}`);
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
            appendDemoLine('Demo log cleared');
          }
        })
      ];

      module.active = true;
      shell.syncModuleInputs('demo', true);
      shell.syncDemoButtons(true);
      appendDemoLine('Demo module activated');

      // Store disposers for deactivate
      (module as any)._disposers = disposers;
    },
    deactivate() {
      if (!module.active) return;

      const disposers = (module as any)._disposers || [];
      while (disposers.length > 0) {
        const dispose = disposers.pop();
        if (dispose) dispose();
      }

      module.active = false;
      shell.syncModuleInputs('demo', false);
      shell.syncDemoButtons(false);
      appendDemoLine('Demo module deactivated');
    }
  };

  return module;
}