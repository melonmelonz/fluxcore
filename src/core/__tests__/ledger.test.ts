import { describe, expect, it } from 'vitest';
import { Ledger } from '../ledger';

describe('Ledger', () => {
  it('starts at zero P&L', () => {
    expect(new Ledger().pnl).toBe(0);
  });

  it('accumulates P&L across entries', () => {
    const l = new Ledger();
    l.record({ t: 1, strategy: 's', action: 'charge', mwh: 1, price: 30, value: -30 });
    l.record({ t: 2, strategy: 's', action: 'discharge', mwh: 1, price: 100, value: 80 });
    expect(l.pnl).toBe(50);
    expect(l.entries).toHaveLength(2);
  });

  it('returns the most recent n entries with tail()', () => {
    const l = new Ledger();
    for (let i = 0; i < 5; i++) {
      l.record({ t: i, strategy: 's', action: 'charge', mwh: 1, price: 1, value: -1 });
    }
    expect(l.tail(2).map((e) => e.t)).toEqual([3, 4]);
  });
});
