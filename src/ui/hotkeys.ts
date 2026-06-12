import { SPEEDS, type Speed } from './useSimulation';

export type HotkeyAction =
  | { type: 'toggle' }
  | { type: 'speed'; speed: Speed }
  | { type: 'step'; dir: 1 | -1 }
  | null;

const FORM_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON']);

/** Map a keydown to a desk control action; null when not a shortcut or typed in a form control. */
export function hotkeyAction(e: KeyboardEvent): HotkeyAction {
  // never shadow browser shortcuts: alt+left is Back, ctrl/cmd+digit is tab switch
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const tag = (e.target as HTMLElement | null)?.tagName ?? '';
  if (FORM_TAGS.has(tag)) return null;
  // ignore key-repeat for toggle so holding space doesn't flicker play/pause;
  // arrows deliberately repeat - holding one scrubs tick by tick
  if (e.key === ' ') return e.repeat ? null : { type: 'toggle' };
  if (e.key === 'ArrowRight') return { type: 'step', dir: 1 };
  if (e.key === 'ArrowLeft') return { type: 'step', dir: -1 };
  const idx = ['1', '2', '3'].indexOf(e.key);
  if (idx !== -1) return { type: 'speed', speed: SPEEDS[idx] };
  return null;
}
