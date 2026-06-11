import { describe, expect, it } from 'vitest';
import { Fleet } from '../fleet';
import type { BatterySpec } from '../battery';

const SPEC: BatterySpec = {
  capacityKWh: 10,
  maxChargeKW: 5,
  maxDischargeKW: 5,
  roundTripEfficiency: 1, // lossless here; efficiency is battery-tested already
  degradationCostPerMWh: 20,
};
const HOME = { battery: SPEC, solarPeakKW: 5 };

describe('Fleet', () => {
  it('aggregates capacity and rates in its view', () => {
    const f = Fleet.uniform(4, HOME, 'summer');
    const v = f.view();
    expect(v.homesOnline).toBe(4);
    expect(v.capacityKWh).toBe(40);
    expect(v.maxChargeKW).toBe(20);
    expect(v.maxDischargeKW).toBe(20);
    expect(v.socKWh).toBe(0);
  });

  it('splits a grid charge across homes and reports energy drawn', () => {
    const f = Fleet.uniform(2, HOME, 'summer');
    const { drawnKWh } = f.charge(10, 60); // 10 kW for 1 h across 2 homes
    expect(drawnKWh).toBeCloseTo(10);
    expect(f.view().socKWh).toBeCloseTo(10);
  });

  it('sends charge only to homes with headroom', () => {
    const full = { battery: { ...SPEC, initialSoCKWh: 10 }, solarPeakKW: 5 };
    const empty = { battery: SPEC, solarPeakKW: 5 };
    const f = new Fleet([full, empty], 'summer');
    const { drawnKWh } = f.charge(5, 60);
    expect(drawnKWh).toBeCloseTo(5); // all of it went to the empty home
    expect(f.view().socKWh).toBeCloseTo(15);
  });

  it('discharges proportional to state of charge', () => {
    const a = { battery: { ...SPEC, initialSoCKWh: 8 }, solarPeakKW: 5 };
    const b = { battery: { ...SPEC, initialSoCKWh: 2 }, solarPeakKW: 5 };
    const f = new Fleet([a, b], 'summer');
    const { deliveredKWh } = f.discharge(5, 60);
    expect(deliveredKWh).toBeCloseTo(5);
    expect(f.view().socKWh).toBeCloseTo(5);
  });

  it('returns zero when charging a full fleet', () => {
    const f = Fleet.uniform(2, { battery: { ...SPEC, initialSoCKWh: 10 }, solarPeakKW: 5 }, 'summer');
    expect(f.charge(5, 60).drawnKWh).toBe(0);
  });

  it('applySolar charges batteries for free and reports generation', () => {
    const f = Fleet.uniform(2, HOME, 'summer');
    const storedKWh = f.applySolar(13, 60); // solar noon, 2 homes x 5 kW peak
    expect(storedKWh).toBeCloseTo(10);
    expect(f.view().solarKWNow).toBeCloseTo(10);
    expect(f.view().socKWh).toBeCloseTo(10);
  });

  it('applySolar generates nothing at midnight', () => {
    const f = Fleet.uniform(2, HOME, 'summer');
    expect(f.applySolar(0, 60)).toBe(0);
  });
});
