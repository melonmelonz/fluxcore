import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeToggle from '../components/ThemeToggle';
import { loadTheme, saveTheme } from '../theme';

function mockPrefersColorScheme(light: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-color-scheme: light)' && light,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe('loadTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    mockPrefersColorScheme(false);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the stored preference when present', () => {
    saveTheme('light');
    expect(loadTheme()).toBe('light');
    saveTheme('dark');
    expect(loadTheme()).toBe('dark');
  });

  it('falls back to the OS preference when nothing is stored', () => {
    mockPrefersColorScheme(true);
    expect(loadTheme()).toBe('light');
    mockPrefersColorScheme(false);
    expect(loadTheme()).toBe('dark');
  });

  it('ignores garbage in storage', () => {
    localStorage.setItem('fluxcore.theme', 'blue');
    expect(loadTheme()).toBe('dark');
  });
});

describe('ThemeToggle', () => {
  it('shows a moon (switch to dark) in light mode and a sun (switch to light) in dark mode', () => {
    const { rerender } = render(<ThemeToggle theme="light" onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeTruthy();
    rerender(<ThemeToggle theme="dark" onToggle={() => {}} />);
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeTruthy();
  });

  it('calls onToggle when clicked', () => {
    let calls = 0;
    render(<ThemeToggle theme="dark" onToggle={() => { calls += 1; }} />);
    fireEvent.click(screen.getByRole('button'));
    expect(calls).toBe(1);
  });
});
