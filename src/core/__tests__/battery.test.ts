import { describe, expect, it } from 'vitest';
import { Battery, type BatterySpec } from '../battery';

const SPEC: BatterySpec = {
  capacityKWh: 13.5,
  maxChargeKW: 5,
  maxDischargeKW: 5,
  roundTripEfficiency: 0.86,
  degradationCostPerMWh: 20,
};

describe('Battery', () => {
  it('starts empty by default', () => {
    expect(new Battery(SPEC).soc).toBe(0);
  });

  it('charges with efficiency loss', () => {
    const b = new Battery(SPEC);
    const r = b.charge(5, 60); // 5 kW for 1 h
    expect(r.drawnKWh).toBeCloseTo(5);
    expect(r.storedKWh).toBeCloseTo(4.3);
    expect(b.soc).toBeCloseTo(4.3);
  });

  it('clamps charge to max rate', () => {
    const b = new Battery(SPEC);
    const r = b.charge(50, 60);
    expect(r.drawnKWh).toBeCloseTo(5);
  });

  it('clamps charge to remaining capacity and reduces draw to match', () => {
    const b = new Battery({ ...SPEC, initialSoCKWh: 13.0 });
    const r = b.charge(5, 60);
    expect(r.storedKWh).toBeCloseTo(0.5);
    expect(r.drawnKWh).toBeCloseTo(0.5 / 0.86);
    expect(b.soc).toBeCloseTo(13.5);
  });

  it('discharges up to state of charge', () => {
    const b = new Battery({ ...SPEC, initialSoCKWh: 2 });
    const r = b.discharge(5, 60);
    expect(r.deliveredKWh).toBeCloseTo(2);
    expect(b.soc).toBeCloseTo(0);
  });

  it('clamps discharge to max rate', () => {
    const b = new Battery({ ...SPEC, initialSoCKWh: 13.5 });
    const r = b.discharge(50, 60);
    expect(r.deliveredKWh).toBeCloseTo(5);
  });

  it('reports headroom', () => {
    const b = new Battery({ ...SPEC, initialSoCKWh: 10 });
    expect(b.headroomKWh).toBeCloseTo(3.5);
  });
});
