import { describe, expect, it } from 'vitest';
import { monthsInRange, rangeMs } from '../lab/range';
import { decodeLab, encodeLab } from '../lab/share';

describe('monthsInRange', () => {
  it('covers a single month', () => {
    expect(monthsInRange('2023-08-14', '2023-08-21')).toEqual(['2023-08']);
  });
  it('spans months and years', () => {
    expect(monthsInRange('2023-12-20', '2024-02-03'))
      .toEqual(['2023-12', '2024-01', '2024-02']);
  });
});

describe('rangeMs', () => {
  it('maps ISO dates to Central midnights (fixed UTC-6), end exclusive', () => {
    const { lo, hi } = rangeMs('2023-08-14', '2023-08-21');
    expect(lo).toBe(Date.UTC(2023, 7, 14, 6));
    expect(hi).toBe(Date.UTC(2023, 7, 21, 6));
  });
});

describe('lab share codec', () => {
  it('round-trips params through the hash', () => {
    const p = { hub: 'HB_WEST', start: '2024-01-14', end: '2024-01-21' };
    expect(decodeLab(encodeLab(p))).toEqual(p);
  });
  it('rejects garbage', () => {
    expect(decodeLab('')).toBeNull();
    expect(decodeLab('#foo')).toBeNull();
    expect(decodeLab('#lab?hub=<script>&start=2024-01-01&end=2024-01-02')).toBeNull();
    expect(decodeLab('#lab?hub=HB_NORTH&start=nope&end=2024-01-02')).toBeNull();
    expect(decodeLab('#lab?hub=HB_NORTH&start=2024-01-02&end=2024-01-01')).toBeNull();
  });
});
