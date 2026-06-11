import { describe, expect, it } from 'vitest';
import { MarketClock } from '../clock';

const POINTS = [
  { t: 0, price: 10 },
  { t: 900_000, price: 20 },
  { t: 1_800_000, price: 30 },
];

describe('MarketClock', () => {
  it('steps through points in order', () => {
    const c = new MarketClock(POINTS);
    expect(c.next()?.price).toBe(10);
    expect(c.next()?.price).toBe(20);
    expect(c.current()?.price).toBe(20);
  });

  it('returns undefined when exhausted and reports done', () => {
    const c = new MarketClock(POINTS);
    c.next(); c.next(); c.next();
    expect(c.done).toBe(true);
    expect(c.next()).toBeUndefined();
  });

  it('exposes history up to and including the current point', () => {
    const c = new MarketClock(POINTS);
    c.next(); c.next();
    expect(c.history().map((p) => p.price)).toEqual([10, 20]);
  });

  it('reports progress 0..1', () => {
    const c = new MarketClock(POINTS);
    expect(c.progress).toBe(0);
    c.next(); c.next(); c.next();
    expect(c.progress).toBe(1);
  });

  it('resets', () => {
    const c = new MarketClock(POINTS);
    c.next(); c.reset();
    expect(c.current()).toBeUndefined();
    expect(c.next()?.price).toBe(10);
  });
});
