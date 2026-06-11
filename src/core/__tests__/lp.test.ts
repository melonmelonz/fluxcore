import { describe, expect, it } from 'vitest';
import { LPStrategy } from '../lp';
import type { FleetView } from '../fleet';
import type { MarketContext } from '../strategy';

function fleetView(over: Partial<FleetView> = {}): FleetView {
  return {
    homesOnline: 200,
    socKWh: 0,
    capacityKWh: 2700,
    chargeHeadroomKWh: 2700,
    maxChargeKW: 1000,
    maxDischargeKW: 1000,
    roundTripEfficiency: 0.86,
    degradationCostPerMWh: 20,
    solarKWNow: 0,
    ...over,
  };
}

const HOUR = 3_600_000;

function ctx(nowPrice: number, damPrices: number[], fleet = fleetView()): MarketContext {
  return {
    now: { t: 0, price: nowPrice },
    history: [{ t: 0, price: nowPrice }],
    damForecast: damPrices.map((price, i) => ({ t: i * HOUR, price })),
    fleet,
    intervalMinutes: 15,
  };
}

describe('LPStrategy', () => {
  it('charges now when a big spike is coming later', () => {
    const s = new LPStrategy();
    const a = s.decide(ctx(15, [15, 15, 15, 400, 15, 15]));
    expect(a.type).toBe('charge');
    expect(a.kW).toBeGreaterThan(0);
  });

  it('discharges into a current spike when holding energy', () => {
    const s = new LPStrategy();
    const full = fleetView({ socKWh: 2700, chargeHeadroomKWh: 0 });
    const a = s.decide(ctx(800, [800, 20, 20, 20, 20, 20], full));
    expect(a.type).toBe('discharge');
  });

  it('holds when prices are flat (spread cannot beat efficiency + degradation)', () => {
    const s = new LPStrategy();
    const a = s.decide(ctx(30, [30, 30, 30, 30, 30, 30]));
    expect(a.type).toBe('hold');
  });

  it('holds with an empty forecast', () => {
    const s = new LPStrategy();
    expect(s.decide(ctx(30, [])).type).toBe('hold');
  });

  it('does not discharge an empty fleet even if the plan says to', () => {
    const s = new LPStrategy();
    const empty = fleetView({ socKWh: 0 });
    const a = s.decide(ctx(800, [800, 20, 20, 20, 20, 20], empty));
    expect(a.type).not.toBe('discharge');
  });
});
