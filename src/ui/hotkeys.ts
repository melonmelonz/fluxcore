import { SPEEDS, type Speed } from './useSimulation';

export type HotkeyAction =
  | { type: 'toggle' }
  | { type: 'speed'; speed: Speed }
  | { type: 'step'; dir: 1 | -1 }
  | null;

const FORM_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON']);

/** Map a keydown to a desk control action; null when not a shortcut or typed in a form control. */
export function hotkeyAction(e: KeyboardEvent): HotkeyAction {
  const tag = (e.target as HTMLElement | null)?.tagName ?? '';
  if (FORM_TAGS.has(tag)) return null;
  if (e.key === ' ') return { type: 'toggle' };
  if (e.key === 'ArrowRight') return { type: 'step', dir: 1 };
  if (e.key === 'ArrowLeft') return { type: 'step', dir: -1 };
  const idx = ['1', '2', '3'].indexOf(e.key);
  if (idx !== -1) return { type: 'speed', speed: SPEEDS[idx] };
  return null;
}
