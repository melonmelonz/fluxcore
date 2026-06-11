import { describe, expect, it } from 'vitest';
import { fleetFromMix, mixTotals, PRESETS, UNIT_TYPES } from '../units';

describe('unit catalog', () => {
  it('defines home, commercial, and ev with the spec hardware', () => {
    expect(UNIT_TYPES.home.spec.battery.capacityKWh).toBe(13.5);
    expect(UNIT_TYPES.home.spec.solarPeakKW).toBe(5);
    expect(UNIT_TYPES.commercial.spec.battery.maxDischargeKW).toBe(50);
    expect(UNIT_TYPES.commercial.spec.solarPeakKW).toBe(0);
    expect(UNIT_TYPES.ev.spec.battery.capacityKWh).toBe(60);
    expect(UNIT_TYPES.ev.spec.unavailable).toEqual({ fromHour: 8, toHour: 18 });
  });
});

describe('mixTotals', () => {
  it('aggregates units, capacity, and dispatchable power', () => {
    const t = mixTotals([{ type: 'home', count: 120 }, { type: 'commercial', count: 10 }, { type: 'ev', count: 60 }]);
    expect(t.units).toBe(190);
    expect(t.capacityKWh).toBeCloseTo(120 * 13.5 + 10 * 100 + 60 * 60);
    expect(t.maxDischargeKW).toBeCloseTo(120 * 5 + 10 * 50 + 60 * 11);
  });
});

describe('fleetFromMix', () => {
  it('builds a fleet whose view matches the mix totals at hour 0', () => {
    const fleet = fleetFromMix([{ type: 'home', count: 3 }, { type: 'commercial', count: 1 }], 'summer');
    const v = fleet.view();
    expect(v.homesOnline).toBe(4);
    expect(v.capacityKWh).toBeCloseTo(3 * 13.5 + 100);
  });
  it('suburban preset equals the original 200-home plant', () => {
    const v = fleetFromMix(PRESETS[0].mix, 'summer').view();
    expect(v.homesOnline).toBe(200);
    expect(v.capacityKWh).toBeCloseTo(2700);
    expect(v.maxDischargeKW).toBeCloseTo(1000);
  });
});
