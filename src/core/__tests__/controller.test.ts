import { describe, expect, it } from 'vitest';
import { SimulationController } from '../controller';
import { Fleet } from '../fleet';
import { HOLD, type Strategy } from '../strategy';
import type { Scenario } from '../types';

const HOUR = 3_600_000;
// 4 intervals starting at 18:00 UTC = noon Central (solar active in summer)
const T0 = Date.UTC(2023, 7, 14, 18, 0, 0);

const scenario: Scenario = {
  id: 't', name: 'T', description: 'd', season: 'summer', intervalMinutes: 15,
  rtm: [0, 1, 2, 3].map((i) => ({ t: T0 + i * 900_000, price: [20, 20, 500, 500][i] })),
  dam: [0, 1].map((i) => ({ t: T0 + i * HOUR, price: 25 })),
};

function makeFleet(): Fleet {
  return Fleet.uniform(2, {
    battery: { capacityKWh: 10, maxChargeKW: 5, maxDischargeKW: 5, roundTripEfficiency: 1, degradationCostPerMWh: 0, initialSoCKWh: 5 },
    solarPeakKW: 0, // solar off for deterministic P&L tests
  }, 'summer');
}

const alwaysDischarge: Strategy = { name: 'dump', decide: () => ({ type: 'discharge', kW: 10 }) };
const alwaysHold: Strategy = { name: 'sit', decide: () => HOLD };

describe('SimulationController', () => {
  it('runs lanes independently and records ledgers', () => {
    const c = new SimulationController(scenario, makeFleet, [alwaysDischarge, alwaysHold]);
    const snap1 = c.tick()!;
    expect(snap1.price).toBe(20);
    // dump lane discharged 10 kW for 15 min = 2.5 kWh = 0.0025 MWh at $20
    expect(snap1.lanes[0].pnl).toBeCloseTo(0.0025 * 20);
    expect(snap1.lanes[1].pnl).toBe(0);
    expect(snap1.recent[0].strategy).toBe('dump');
  });

  it('reports done after the last interval', () => {
    const c = new SimulationController(scenario, makeFleet, [alwaysHold]);
    for (let i = 0; i < 4; i++) expect(c.tick()).not.toBeNull();
    expect(c.tick()).toBeNull();
  });

  it('applies solar before strategy decisions', () => {
    const solarFleet = () => Fleet.uniform(2, {
      battery: { capacityKWh: 10, maxChargeKW: 5, maxDischargeKW: 5, roundTripEfficiency: 1, degradationCostPerMWh: 0 },
      solarPeakKW: 4,
    }, 'summer');
    const c = new SimulationController(scenario, solarFleet, [alwaysHold]);
    const snap = c.tick()!;
    expect(snap.lanes[0].fleet.socKWh).toBeGreaterThan(0); // noon sun charged the batteries
    expect(snap.lanes[0].pnl).toBe(0); // for free
  });

  it('hands strategies a day-ahead window starting at the current hour', () => {
    let seen: number[] = [];
    const spy: Strategy = { name: 'spy', decide: (ctx) => { seen = ctx.damForecast.map((p) => p.price); return HOLD; } };
    const c = new SimulationController(scenario, makeFleet, [spy]);
    c.tick();
    expect(seen).toEqual([25, 25]);
  });
});
