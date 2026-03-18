import type { ShellApi } from './createShell';

export type ThemeName = 'light' | 'dark';

export type ThemeApi = {
  set: (theme: ThemeName) => void;
  restore: () => void;
};

export function createTheme(shell: Pick<ShellApi, 'syncThemeInputs'>): ThemeApi {
  const themeStorageKey = 'servewell-theme';

  function set(theme: ThemeName) {
    document.documentElement.dataset.theme = theme;
    shell.syncThemeInputs(theme);

    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {}
  }

  function restore() {
    let savedTheme = '';
    try {
      savedTheme = localStorage.getItem(themeStorageKey) || '';
    } catch {}

    set(savedTheme === 'dark' ? 'dark' : 'light');
  }

  return { set, restore };
}