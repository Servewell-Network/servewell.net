import type { AppModule } from './createModuleRegistry';

export function createModeratorRoleModule(): AppModule {
  return {
    id: 'moderator-role',
    label: 'Moderator role',
    active: false,
    defaultActive: true,
    includeInMenu: true,
    available: false,
    activate() {
      if (this.active) return;
      this.active = true;
      document.documentElement.dataset.moderatorMode = '1';
      window.dispatchEvent(new CustomEvent('servewell-moderator-mode-changed', {
        detail: { enabled: true }
      }));
    },
    deactivate() {
      if (!this.active) return;
      this.active = false;
      delete document.documentElement.dataset.moderatorMode;
      window.dispatchEvent(new CustomEvent('servewell-moderator-mode-changed', {
        detail: { enabled: false }
      }));
    }
  };
}