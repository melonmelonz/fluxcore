import { describe, expect, it } from 'vitest';
import { hotkeyAction } from '../hotkeys';

const ev = (key: string, tag = 'BODY') =>
  ({ key, target: { tagName: tag } }) as unknown as KeyboardEvent;

describe('hotkeyAction', () => {
  it('maps space to toggle and digits to speeds', () => {
    expect(hotkeyAction(ev(' '))).toEqual({ type: 'toggle' });
    expect(hotkeyAction(ev('1'))).toEqual({ type: 'speed', speed: 1 });
    expect(hotkeyAction(ev('2'))).toEqual({ type: 'speed', speed: 6 });
    expect(hotkeyAction(ev('3'))).toEqual({ type: 'speed', speed: 24 });
  });
  it('ignores other keys', () => {
    expect(hotkeyAction(ev('4'))).toBeNull();
    expect(hotkeyAction(ev('Enter'))).toBeNull();
    expect(hotkeyAction(ev('a'))).toBeNull();
  });
  it('ignores keys typed into form controls', () => {
    expect(hotkeyAction(ev(' ', 'INPUT'))).toBeNull();
    expect(hotkeyAction(ev('1', 'SELECT'))).toBeNull();
    expect(hotkeyAction(ev('2', 'TEXTAREA'))).toBeNull();
    expect(hotkeyAction(ev('3', 'BUTTON'))).toBeNull();
  });
});
