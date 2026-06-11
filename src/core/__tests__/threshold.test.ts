import { describe, expect, it } from 'vitest';
import { ThresholdStrategy } from '../threshold';
import type { FleetView } from '../fleet';
import type { MarketContext } from '../strategy';

function fleetView(over: Partial<FleetView> = {}): FleetView {
  return {
    homesOnline: 200,
    socKWh: 1350,
    capacityKWh: 2700,
    chargeHeadroomKWh: 1350,
    maxChargeKW: 1000,
    maxDischargeKW: 1000,
    roundTripEfficiency: 0.86,
    degradationCostPerMWh: 20,
    solarKWNow: 0,
    ...over,
  };
}

function ctx(nowPrice: number, historyPrices: number[], fleet = fleetView()): MarketContext {
  const history = historyPrices.map((price, i) => ({ t: i * 900_000, price }));
  const now = { t: historyPrices.length * 900_000, price: nowPrice };
  return { now, history: [...history, now], damForecast: [], fleet, intervalMinutes: 15 };
}

describe('ThresholdStrategy', () => {
  const s = new ThresholdStrategy(96, 20, 8);

  it('holds until it has enough samples', () => {
    expect(s.decide(ctx(5, [30, 30])).type).toBe('hold');
  });

  it('charges when price is a band below the rolling mean', () => {
    const a = s.decide(ctx(5, [30, 30, 30, 30, 30, 30, 30, 30]));
    expect(a.type).toBe('charge');
    expect(a.kW).toBe(1000);
  });

  it('discharges on a spike that clears breakeven', () => {
    const a = s.decide(ctx(500, [30, 30, 30, 30, 30, 30, 30, 30]));
    expect(a.type).toBe('discharge');
  });

  it('holds in the dead band', () => {
    expect(s.decide(ctx(31, [30, 30, 30, 30, 30, 30, 30, 30])).type).toBe('hold');
  });

  it('does not charge a full fleet', () => {
    const full = fleetView({ chargeHeadroomKWh: 0, socKWh: 2700 });
    expect(s.decide(ctx(5, [30, 30, 30, 30, 30, 30, 30, 30], full)).type).toBe('hold');
  });

  it('does not discharge an empty fleet', () => {
    const empty = fleetView({ socKWh: 0, chargeHeadroomKWh: 2700 });
    expect(s.decide(ctx(500, [30, 30, 30, 30, 30, 30, 30, 30], empty)).type).toBe('hold');
  });
});
