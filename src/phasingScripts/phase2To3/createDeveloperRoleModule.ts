import type { AppModule } from './createModuleRegistry';

export function createDeveloperRoleModule(): AppModule {
  return {
    id: 'developer-role',
    label: 'Developer role',
    active: false,
    includeInMenu: true,
    available: false,
    activate() {
      if (this.active) return;
      this.active = true;
      document.documentElement.dataset.developerMode = '1';
      window.dispatchEvent(new CustomEvent('servewell-developer-mode-changed', {
        detail: { enabled: true }
      }));
    },
    deactivate() {
      if (!this.active) return;
      this.active = false;
      delete document.documentElement.dataset.developerMode;
      window.dispatchEvent(new CustomEvent('servewell-developer-mode-changed', {
        detail: { enabled: false }
      }));
    }
  };
}
