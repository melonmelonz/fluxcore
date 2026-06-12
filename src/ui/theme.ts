export type Theme = 'dark' | 'light';

const KEY = 'fluxcore.theme';

/** Stored preference, falling back to the OS theme, then dark (the app default). */
export function loadTheme(): Theme {
  const stored = localStorage.getItem(KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(KEY, theme);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
