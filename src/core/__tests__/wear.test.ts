import { describe, expect, it } from 'vitest';
import { Ledger } from '../ledger';
import { wearStats } from '../wear';

function loaded(): Ledger {
  const l = new Ledger();
  l.record({ t: 1, strategy: 's', action: 'charge', mwh: 2.0, price: 10, value: -20 });
  l.record({ t: 2, strategy: 's', action: 'discharge', mwh: 1.5, price: 100, value: 150 });
  l.record({ t: 3, strategy: 's', action: 'discharge', mwh: 1.2, price: 200, value: 240 });
  return l;
}

describe('Ledger totals', () => {
  it('sums charged and discharged MWh separately', () => {
    const l = loaded();
    expect(l.mwhCharged).toBeCloseTo(2.0);
    expect(l.mwhDischarged).toBeCloseTo(2.7);
  });
  it('is zero on an empty ledger', () => {
    const l = new Ledger();
    expect(l.mwhCharged).toBe(0);
    expect(l.mwhDischarged).toBe(0);
  });
});

describe('wearStats', () => {
  it('derives equivalent full cycles and degradation dollars', () => {
    const s = wearStats(loaded(), 2700, 20); // 2.7 MWh fleet
    expect(s.cycles).toBeCloseTo(1.0);            // 2.7 MWh out / 2.7 MWh cap
    expect(s.degradationDollars).toBeCloseTo(54); // 2.7 * $20
    expect(s.mwhDischarged).toBeCloseTo(2.7);
  });
  it('guards zero capacity', () => {
    expect(wearStats(new Ledger(), 0, 20).cycles).toBe(0);
  });
});
