// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeUiTheme, useUiTheme } from './uiTheme';
import { CHART_THEME } from '../utils/chartTheme';

afterEach(() => {
  vi.restoreAllMocks();
  useUiTheme.getState().setTheme('dark');
  localStorage.removeItem('duckdb-ui-theme');
  document.documentElement.style.removeProperty('--monokai-fg');
});

describe('shared UI theme', () => {
  it('changes document, preference, and chart tokens together without reloading data', () => {
    useUiTheme.getState().setTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('duckdb-ui-theme')).toBe('light');
    document.documentElement.style.setProperty('--monokai-fg', '#262b21');
    expect(CHART_THEME.fg).toBe('#262b21');
    useUiTheme.getState().setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('applies the stored state on startup and remains usable when storage is unavailable', () => {
    useUiTheme.getState().setTheme('light');
    delete document.documentElement.dataset.theme;
    initializeUiTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage denied'); });
    expect(() => useUiTheme.getState().setTheme('dark')).not.toThrow();
    expect(useUiTheme.getState().theme).toBe('dark');
  });
});
