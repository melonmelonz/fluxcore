import { describe, expect, it } from 'vitest';
import { Fleet, type HomeSpec } from '../fleet';

const batt = { maxChargeKW: 10, maxDischargeKW: 10, roundTripEfficiency: 1, degradationCostPerMWh: 20 };
const HOME: HomeSpec = { battery: { ...batt, capacityKWh: 10 }, solarPeakKW: 0 };
const EV: HomeSpec = { battery: { ...batt, capacityKWh: 10 }, solarPeakKW: 0, unavailable: { fromHour: 8, toHour: 18 } };
const SOLAR_EV: HomeSpec = { ...EV, solarPeakKW: 5 };

function fleetAt(hour: number, specs: HomeSpec[]): Fleet {
  const f = new Fleet(specs, 'summer');
  f.applySolar(hour, 15); // deskTick always applies solar first; this sets the fleet clock
  return f;
}

describe('availability window', () => {
  it('gates dispatch inside [fromHour, toHour) and not outside', () => {
    expect(fleetAt(7.99, [EV]).charge(10, 60).drawnKWh).toBeCloseTo(10);
    expect(fleetAt(8, [EV]).charge(10, 60).drawnKWh).toBe(0);
    expect(fleetAt(17.99, [EV]).charge(10, 60).drawnKWh).toBe(0);
    expect(fleetAt(18, [EV]).charge(10, 60).drawnKWh).toBeCloseTo(10);
  });
  it('an away unit contributes no SoC to discharge', () => {
    const f = new Fleet([EV], 'summer');
    f.applySolar(7, 15);
    f.charge(10, 60); // 10 kWh in, before leaving
    f.applySolar(12, 15); // now away
    expect(f.discharge(10, 60).deliveredKWh).toBe(0);
    f.applySolar(19, 15); // back home
    expect(f.discharge(10, 60).deliveredKWh).toBeCloseTo(10);
  });
  it('an away unit takes no solar', () => {
    const f = new Fleet([SOLAR_EV], 'summer');
    expect(f.applySolar(12, 60)).toBe(0); // noon, away: nothing stored
    expect(f.view().solarKWNow).toBe(0);
  });
  it('homesOnline counts only available units', () => {
    expect(fleetAt(12, [HOME, EV]).view().homesOnline).toBe(1);
    expect(fleetAt(20, [HOME, EV]).view().homesOnline).toBe(2);
  });
  it('away capacity and SoC are excluded from the view', () => {
    const f = new Fleet([HOME, EV], 'summer');
    f.applySolar(0, 15);
    f.charge(20, 60); // fill both: 10 kWh each
    f.applySolar(12, 15);
    const v = f.view();
    expect(v.capacityKWh).toBe(10);
    expect(v.socKWh).toBeCloseTo(10);
  });
  it('all units away yields a zeroed view, not NaN', () => {
    const v = fleetAt(12, [EV]).view();
    expect(v.homesOnline).toBe(0);
    expect(v.capacityKWh).toBe(0);
    expect(v.socKWh).toBe(0);
  });
});

describe('capacity-weighted view', () => {
  it('weights efficiency and degradation by capacity for mixed fleets', () => {
    const a: HomeSpec = { battery: { ...batt, capacityKWh: 10, roundTripEfficiency: 0.8, degradationCostPerMWh: 10 }, solarPeakKW: 0 };
    const b: HomeSpec = { battery: { ...batt, capacityKWh: 30, roundTripEfficiency: 0.9, degradationCostPerMWh: 30 }, solarPeakKW: 0 };
    const v = new Fleet([a, b], 'summer').view();
    expect(v.roundTripEfficiency).toBeCloseTo(0.875); // (0.8*10 + 0.9*30) / 40
    expect(v.degradationCostPerMWh).toBeCloseTo(25);  // (10*10 + 30*30) / 40
  });
});
