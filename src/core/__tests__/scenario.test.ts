import { describe, expect, it } from 'vitest';
import { parseScenario } from '../scenario';

const valid = {
  id: 's1',
  name: 'Test',
  description: 'd',
  season: 'summer',
  intervalMinutes: 15,
  rtm: [{ t: 1000, price: 25.5 }],
  dam: [{ t: 1000, price: 30 }],
};

describe('parseScenario', () => {
  it('accepts a valid scenario document', () => {
    const s = parseScenario(valid);
    expect(s.id).toBe('s1');
    expect(s.rtm[0].price).toBe(25.5);
  });

  it('rejects a missing rtm array', () => {
    const { rtm: _rtm, ...bad } = valid;
    expect(() => parseScenario(bad)).toThrow(/rtm/);
  });

  it('rejects non-numeric prices', () => {
    const bad = { ...valid, rtm: [{ t: 1, price: 'x' }] };
    expect(() => parseScenario(bad)).toThrow(/price/);
  });

  it('rejects an unknown season', () => {
    const bad = { ...valid, season: 'monsoon' };
    expect(() => parseScenario(bad)).toThrow(/season/);
  });
});
