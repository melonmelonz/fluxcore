import { beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, chartPalette, loadTheme, saveTheme } from '../theme';

describe('theme storage', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to dark', () => {
    expect(loadTheme()).toBe('dark');
  });
  it('round-trips light', () => {
    saveTheme('light');
    expect(loadTheme()).toBe('light');
  });
  it('ignores garbage in storage', () => {
    localStorage.setItem('fluxcore.theme', 'neon');
    expect(loadTheme()).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('sets the data-theme attribute on the document root', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('chartPalette', () => {
  it('provides distinct chrome colors per theme', () => {
    expect(chartPalette.dark.text).not.toBe(chartPalette.light.text);
    expect(chartPalette.dark.grid).not.toBe(chartPalette.light.grid);
    expect(chartPalette.dark.border).not.toBe(chartPalette.light.border);
  });
});
