import { create } from 'zustand';

export type UiTheme = 'dark' | 'light';
const preferenceKey = 'duckdb-ui-theme';

function readPreference(): UiTheme {
  try { return localStorage.getItem(preferenceKey) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

function applyTheme(theme: UiTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export const useUiTheme = create<{ theme: UiTheme; setTheme: (theme: UiTheme) => void }>(set => ({
  theme: readPreference(),
  setTheme: theme => {
    applyTheme(theme);
    try { localStorage.setItem(preferenceKey, theme); } catch { /* Session preference still applies. */ }
    set({ theme });
  },
}));

export function initializeUiTheme() { applyTheme(useUiTheme.getState().theme); }
