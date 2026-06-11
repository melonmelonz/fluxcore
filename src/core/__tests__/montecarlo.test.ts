import { describe, expect, it } from 'vitest';
import { histogram, mulberry32, normal, perturbDam, summarize } from '../montecarlo';

describe('mulberry32', () => {
  it('is deterministic per seed and uniform in [0, 1)', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(7);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(Array.from({ length: 5 }, c)).not.toEqual(seqA);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('normal', () => {
  it('draws approximately standard normal', () => {
    const rand = mulberry32(1);
    const draws = Array.from({ length: 10000 }, () => normal(rand));
    const mean = draws.reduce((s, x) => s + x, 0) / draws.length;
    const sd = Math.sqrt(draws.reduce((s, x) => s + (x - mean) ** 2, 0) / draws.length);
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(sd - 1)).toBeLessThan(0.05);
  });
});

describe('perturbDam', () => {
  it('is the identity at sigma zero and preserves timestamps', () => {
    const dam = [{ t: 0, price: 50 }, { t: 3600000, price: -10 }];
    expect(perturbDam(dam, 0, mulberry32(9))).toEqual(dam);
    const noisy = perturbDam(dam, 0.25, mulberry32(9));
    expect(noisy.map((p) => p.t)).toEqual([0, 3600000]);
    expect(noisy[0].price).not.toBe(50);
  });
});

describe('summarize and histogram', () => {
  it('computes exact percentiles on 0..100', () => {
    const s = summarize(Array.from({ length: 101 }, (_, i) => i));
    expect(s).toEqual({ min: 0, p5: 5, median: 50, p95: 95, max: 100, mean: 50 });
  });
  it('bins values inclusively at the top edge', () => {
    const bins = histogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    expect(bins).toHaveLength(5);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(11);
    expect(bins[4].count).toBe(3); // 8, 9, 10
  });
});
