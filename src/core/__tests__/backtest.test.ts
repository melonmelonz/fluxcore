import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Backtest } from '../backtest';
import { Fleet } from '../fleet';
import { LPStrategy } from '../lp';
import { oraclePnl } from '../oracle';
import { parseScenario } from '../scenario';
import { ThresholdStrategy } from '../threshold';

const HOME = {
  battery: {
    capacityKWh: 13.5, maxChargeKW: 5, maxDischargeKW: 5,
    roundTripEfficiency: 0.86, degradationCostPerMWh: 20,
  },
  solarPeakKW: 5,
};

function heatwave() {
  return parseScenario(JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/data/heatwave-2023.json'), 'utf8'),
  ));
}

function run(scenario = heatwave()) {
  const bt = new Backtest(scenario, () => Fleet.uniform(200, HOME, scenario.season), [
    new ThresholdStrategy(),
    new LPStrategy(),
  ]);
  while (!bt.step(500)) { /* run to completion */ }
  return bt;
}

describe('Backtest', () => {
  it('reproduces the known deterministic heatwave P&L', () => {
    const results = run().results();
    const byName = Object.fromEntries(results.map((r) => [r.name, r]));
    expect(byName['threshold'].pnl).toBeCloseTo(22116.69, 2);
    expect(byName['lp-optimizer'].pnl).toBeCloseTo(17516.79, 2);
  });

  it('reports energy and dispatch counts', () => {
    for (const r of run().results()) {
      expect(r.mwhDischarged).toBeGreaterThan(0);
      expect(r.dispatches).toBeGreaterThan(0);
    }
  });

  it('tracks progress and completion', () => {
    const s = heatwave();
    const bt = new Backtest(s, () => Fleet.uniform(200, HOME, s.season), [new ThresholdStrategy()]);
    expect(bt.progress).toBe(0);
    bt.step(10);
    expect(bt.progress).toBeGreaterThan(0);
    expect(bt.progress).toBeLessThan(1);
    while (!bt.step(500)) { /* drain */ }
    expect(bt.progress).toBe(1);
  });

  it('never beats the oracle', () => {
    const s = heatwave();
    const oracle = oraclePnl(s.rtm, {
      capacityKWh: 200 * 13.5, maxChargeKW: 200 * 5, maxDischargeKW: 200 * 5,
      roundTripEfficiency: 0.86, degradationCostPerMWh: 20, solarPeakKW: 200 * 5,
    }, s.season, s.intervalMinutes);
    for (const r of run(s).results()) {
      expect(oracle).toBeGreaterThanOrEqual(r.pnl);
    }
  });
});
