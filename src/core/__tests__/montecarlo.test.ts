import { describe, expect, it } from 'vitest';
import { Fleet } from '../fleet';
import { LPStrategy } from '../lp';
import { ThresholdStrategy } from '../threshold';
import { HOLD, type Action, type MarketContext, type Strategy } from '../strategy';
import { MonteCarlo, histogram, mulberry32, normal, perturbDam, summarize } from '../montecarlo';
import type { Scenario } from '../types';

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

const HOUR = 3600000;
/** 2 days of hourly points: flat $20 with a $400 spike each day at hour 18. */
function scenario(): Scenario {
  const rtm = Array.from({ length: 48 }, (_, i) =>
    ({ t: i * HOUR, price: i % 24 === 18 ? 400 : 20 }));
  const dam = rtm.map((p) => ({ ...p }));
  return { id: 'mc', name: 'mc', description: '', season: 'summer', intervalMinutes: 60, rtm, dam };
}
const fleetFactory = () => Fleet.uniform(10, {
  battery: { capacityKWh: 13.5, maxChargeKW: 5, maxDischargeKW: 5, roundTripEfficiency: 0.86, degradationCostPerMWh: 20 },
  solarPeakKW: 0,
}, 'summer');

/** Trades only on the forecast: charges if a forecast point beats breakeven later. */
class ForecastFollower implements Strategy {
  readonly name = 'follower';
  decide(ctx: MarketContext): Action {
    const future = Math.max(...ctx.damForecast.slice(1).map((p) => p.price), 0);
    if (future > 100 && ctx.fleet.chargeHeadroomKWh > 0) return { type: 'charge', kW: ctx.fleet.maxChargeKW };
    if (ctx.now.price > 100 && ctx.fleet.socKWh > 0) return { type: 'discharge', kW: ctx.fleet.maxDischargeKW };
    return HOLD;
  }
}

function run(seed: number, sigma: number, runs: number, strategies: () => Strategy[]) {
  const mc = new MonteCarlo(scenario(), fleetFactory, { runs, sigma, seed, strategyFactory: strategies });
  while (!mc.step(500)) { /* spin to completion */ }
  return mc.results();
}

describe('MonteCarlo runner', () => {
  it('is reproducible: same seed, same distributions', () => {
    const a = run(42, 0.5, 6, () => [new ForecastFollower()]);
    const b = run(42, 0.5, 6, () => [new ForecastFollower()]);
    expect(a[0].pnls).toEqual(b[0].pnls);
    expect(a[0].pnls).toHaveLength(7); // baseline + 6 runs
  });
  it('collapses to the baseline at sigma zero', () => {
    const r = run(1, 0, 4, () => [new ForecastFollower()])[0];
    expect(new Set(r.pnls).size).toBe(1);
  });
  it('thesis: threshold is forecast-immune, the LP is not', () => {
    const [thresh, lp] = run(7, 0.6, 5, () => [new ThresholdStrategy(), new LPStrategy()]);
    expect(new Set(thresh.pnls).size).toBe(1); // ignores DAM entirely
    expect(new Set(lp.pnls).size).toBeGreaterThan(1);
    expect(thresh.stats.min).toBeLessThanOrEqual(thresh.stats.max);
  });
});
