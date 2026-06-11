import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { latestDocId, parseDamCsv, parseRtmCsv, unzipCsv } from '../lib/mis';

const FIX = resolve(process.cwd(), 'worker/__tests__/fixtures');
const read = (f: string) => readFileSync(resolve(FIX, f));

describe('latestDocId', () => {
  it('returns the first (newest) DocID from a doc list', () => {
    const json = JSON.parse(read('doclist-rtm.json').toString('utf8'));
    const id = latestDocId(json);
    expect(id).toMatch(/^\d+$/);
  });
  it('throws on malformed doc lists', () => {
    expect(() => latestDocId({})).toThrow();
  });
});

describe('unzipCsv', () => {
  it('extracts the CSV text from a report zip', () => {
    const csv = unzipCsv(new Uint8Array(read('rtm-spp.zip')));
    expect(csv).toContain('SettlementPointPrice');
  });
});

describe('parseRtmCsv', () => {
  it('parses HB_NORTH 15-min points with epoch-ms timestamps (fixed UTC-6)', () => {
    const csv = unzipCsv(new Uint8Array(read('rtm-spp.zip')));
    const pts = parseRtmCsv(csv, 'HB_NORTH');
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) {
      expect(Number.isFinite(p.t)).toBe(true);
      expect(Number.isFinite(p.price)).toBe(true);
      expect(p.t % (15 * 60_000)).toBe(0); // interval-aligned
    }
  });
  it('returns empty for an unknown hub', () => {
    const csv = unzipCsv(new Uint8Array(read('rtm-spp.zip')));
    expect(parseRtmCsv(csv, 'HB_NOWHERE')).toEqual([]);
  });
  it('round-trips a known synthetic row', () => {
    const csv = '"DeliveryDate","DeliveryHour","DeliveryInterval","SettlementPointName","SettlementPointType","SettlementPointPrice","DSTFlag"\n' +
      '"08/20/2023","18","2","HB_NORTH","HU","102.55","N"';
    // hour 18, interval 2 => 17:15 central => 23:15 UTC
    expect(parseRtmCsv(csv, 'HB_NORTH')).toEqual([
      { t: Date.UTC(2023, 7, 20, 17, 15) + 6 * 3_600_000, price: 102.55 },
    ]);
  });
});

describe('parseDamCsv', () => {
  it('parses HB_NORTH hourly DAM points', () => {
    const csv = unzipCsv(new Uint8Array(read('dam-spp.zip')));
    const pts = parseDamCsv(csv, 'HB_NORTH');
    expect(pts.length).toBeGreaterThan(0);
    expect(pts.length).toBeLessThanOrEqual(25); // one operating day
  });
  it('round-trips a known synthetic row', () => {
    const csv = '"DeliveryDate","HourEnding","SettlementPoint","SettlementPointPrice","DSTFlag"\n' +
      '"01/15/2024","01:00","HB_NORTH","45.20","N"';
    expect(parseDamCsv(csv, 'HB_NORTH')).toEqual([
      { t: Date.UTC(2024, 0, 15, 0, 0) + 6 * 3_600_000, price: 45.2 },
    ]);
  });
});
