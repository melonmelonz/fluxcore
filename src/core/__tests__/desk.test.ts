import { describe, expect, it } from 'vitest';
import { Fleet } from '../fleet';
import { Ledger } from '../ledger';
import { damWindow, deskTick, hourOfDayCentral, type DeskLane } from '../desk';
import type { Strategy } from '../strategy';

const home = {
  battery: { capacityKWh: 10, maxChargeKW: 5, maxDischargeKW: 5, roundTripEfficiency: 1, degradationCostPerMWh: 0 },
  solarPeakKW: 0,
};
const always = (type: 'charge' | 'discharge'): Strategy => ({
  name: 'test', decide: () => ({ type, kW: 5 }),
});
const lane = (s: Strategy): DeskLane => ({
  strategy: s, fleet: Fleet.uniform(1, home, 'summer'), ledger: new Ledger(), lastAction: null,
});

describe('hourOfDayCentral', () => {
  it('converts epoch ms to fixed UTC-6 hour of day', () => {
    expect(hourOfDayCentral(Date.UTC(2024, 0, 15, 6, 0))).toBe(0);
    expect(hourOfDayCentral(Date.UTC(2024, 0, 15, 23, 30))).toBe(17.5);
  });
});

describe('damWindow', () => {
  it('slices dam from the hour covering t', () => {
    const dam = [0, 1, 2, 3].map((h) => ({ t: h * 3_600_000, price: h }));
    expect(damWindow(dam, 1_800_000)[0].price).toBe(0);
    expect(damWindow(dam, 3_700_000)[0].price).toBe(1);
  });
});

describe('deskTick', () => {
  it('executes a charge and books a negative-value ledger entry', () => {
    const l = lane(always('charge'));
    deskTick(l, { t: 0, price: 40 }, [], [], 15);
    expect(l.ledger.entries).toHaveLength(1);
    expect(l.ledger.entries[0].action).toBe('charge');
    expect(l.ledger.pnl).toBeLessThan(0);
    expect(l.fleet.view().socKWh).toBeGreaterThan(0);
  });
  it('does not book an entry when the fleet is empty and asked to discharge', () => {
    const l = lane(always('discharge'));
    deskTick(l, { t: 0, price: 400 }, [], [], 15);
    expect(l.ledger.entries).toHaveLength(0);
  });
});
