import type { ShellApi } from './createShell';

export type AppModule = {
  id: string;
  label: string;
  active: boolean;
  includeInMenu?: boolean;
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
};

function qs<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector(selector) as T | null;
}

export function createModuleRegistry(shell: ShellApi): ModuleRegistry {
  const modules: Record<string, AppModule> = {};

  function register(module: AppModule) {
    modules[module.id] = module;
  }

  function render() {
    shell.renderModuleList(Object.values(modules).filter((module) => module.includeInMenu !== false));
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

  function getAll(): AppModule[] {
    return Object.values(modules);
  }

  return { register, render, activate, deactivate, isActive, getAll };
}