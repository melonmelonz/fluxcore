import { describe, expect, it } from 'vitest';
import type { LabRun } from '../lab/useLab';
import { ledgerCSV, labRunCSV, toCSV } from '../export';

describe('toCSV', () => {
  it('escapes commas, quotes, and newlines per RFC 4180', () => {
    const csv = toCSV([['a,b', 'say "hi"', 'two\nlines', 'plain']]);
    expect(csv).toBe('"a,b","say ""hi""","two\nlines",plain\r\n');
  });
});

describe('ledgerCSV', () => {
  it('emits a header and ISO-8601 timestamps', () => {
    const csv = ledgerCSV([
      { t: Date.UTC(2023, 7, 17, 19, 30), strategy: 'lp-optimizer', action: 'discharge', mwh: 0.25, price: 312.5, value: 73.13 },
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('time_utc,strategy,action,mwh,price_usd_per_mwh,value_usd');
    expect(lines[1]).toBe('2023-08-17T19:30:00.000Z,lp-optimizer,discharge,0.25,312.5,73.13');
  });
});

describe('labRunCSV', () => {
  it('includes params, every strategy, and an oracle row', () => {
    const run: LabRun = {
      params: { hub: 'HB_NORTH', start: '2023-08-14', end: '2023-08-21' },
      results: [{ name: 'threshold', pnl: 22116.69, mwhCharged: 30, mwhDischarged: 25, dispatches: 410 }],
      oracle: 31000,
      points: 672,
    };
    const lines = labRunCSV(run).trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('threshold');
    expect(lines[1]).toContain('71.3'); // pct of oracle
    expect(lines[2]).toContain('oracle');
  });
});
