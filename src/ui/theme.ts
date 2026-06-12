export type Theme = 'dark' | 'light';

const KEY = 'fluxcore.theme';
const META_COLOR: Record<Theme, string> = { dark: '#0B1320', light: '#EDF2F8' };

/** Chart chrome colors (lightweight-charts needs concrete values, not CSS vars). */
export const chartPalette: Record<Theme, { text: string; grid: string; border: string }> = {
  dark: { text: '#7E93AC', grid: '#16263B', border: '#243A55' },
  light: { text: '#5B7188', grid: '#E2EAF4', border: '#C2D2E4' },
};

export function loadTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(KEY, theme);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme]);
}
