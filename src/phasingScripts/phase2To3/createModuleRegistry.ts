import type { ShellApi } from './createShell';

export type AppModule = {
  id: string;
  label: string;
  infoHref?: string;
  active: boolean;
  includeInMenu?: boolean;
  available?: boolean;
  activate: () => void;
  deactivate: () => void;
};

export type ModuleRegistry = {
  register: (module: AppModule) => void;
  render: () => void;
  activate: (id: string) => void;
  deactivate: (id: string) => void;
  isActive: (id: string) => boolean;
  getAll: () => AppModule[];
  restoreFromStorage: () => void;
};

function qs<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector(selector) as T | null;
}

const STORAGE_KEY_PREFIX = 'servewell-module-';

function storageKey(id: string): string {
  return `${STORAGE_KEY_PREFIX}${id}`;
}

export function createModuleRegistry(shell: ShellApi): ModuleRegistry {
  const modules: Record<string, AppModule> = {};

  function register(module: AppModule) {
    modules[module.id] = module;
  }

  function render() {
    shell.renderModuleList(Object.values(modules).filter((module) => module.includeInMenu !== false && module.available !== false));
  }

  function activate(id: string) {
    const module = modules[id];
    if (!module) return;
    module.activate();
    shell.syncModuleInputs(id, true);
    try { localStorage.setItem(storageKey(id), '1'); } catch {}
  }

  function deactivate(id: string) {
    const module = modules[id];
    if (!module) return;
    module.deactivate();
    shell.syncModuleInputs(id, false);
    try { localStorage.removeItem(storageKey(id)); } catch {}
  }

  function isActive(id: string): boolean {
    return !!modules[id]?.active;
  }

  function getAll(): AppModule[] {
    return Object.values(modules);
  }

  function restoreFromStorage() {
    Object.values(modules).forEach((module) => {
      if (module.includeInMenu === false) return;
      if (module.available === false) return;
      let saved = '';
      try { saved = localStorage.getItem(storageKey(module.id)) ?? ''; } catch {}
      if (saved === '1') activate(module.id);
    });
  }

  return { register, render, activate, deactivate, isActive, getAll, restoreFromStorage };
}