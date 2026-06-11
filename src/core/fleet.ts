import { Battery, type BatterySpec } from './battery';
import { solarOutputKW } from './solar';
import type { Season } from './types';

export interface HomeSpec {
  battery: BatterySpec;
  solarPeakKW: number;
  /** half-open local-hour window [fromHour, toHour) when the unit is offline */
  unavailable?: { fromHour: number; toHour: number };
}

export interface FleetView {
  homesOnline: number;
  socKWh: number;
  capacityKWh: number;
  chargeHeadroomKWh: number;
  maxChargeKW: number;
  maxDischargeKW: number;
  roundTripEfficiency: number;
  degradationCostPerMWh: number;
  solarKWNow: number;
}

interface Home {
  battery: Battery;
  solarPeakKW: number;
}

export class Fleet {
  private homes: Home[];
  private lastSolarKW = 0;

  constructor(specs: HomeSpec[], readonly season: Season) {
    this.homes = specs.map((s) => ({ battery: new Battery(s.battery), solarPeakKW: s.solarPeakKW }));
  }

  static uniform(count: number, home: HomeSpec, season: Season): Fleet {
    return new Fleet(Array.from({ length: count }, () => home), season);
  }

  applySolar(hourOfDay: number, minutes: number): number {
    let stored = 0;
    let kw = 0;
    for (const h of this.homes) {
      const out = solarOutputKW(h.solarPeakKW, hourOfDay, this.season);
      kw += out;
      stored += h.battery.charge(out, minutes).storedKWh;
    }
    this.lastSolarKW = kw;
    return stored;
  }

  charge(totalKW: number, minutes: number): { drawnKWh: number } {
    const headrooms = this.homes.map((h) => h.battery.headroomKWh);
    const total = headrooms.reduce((a, b) => a + b, 0);
    if (total <= 0) return { drawnKWh: 0 };
    let drawn = 0;
    this.homes.forEach((h, i) => {
      drawn += h.battery.charge(totalKW * (headrooms[i] / total), minutes).drawnKWh;
    });
    return { drawnKWh: drawn };
  }

  discharge(totalKW: number, minutes: number): { deliveredKWh: number } {
    const socs = this.homes.map((h) => h.battery.soc);
    const total = socs.reduce((a, b) => a + b, 0);
    if (total <= 0) return { deliveredKWh: 0 };
    let delivered = 0;
    this.homes.forEach((h, i) => {
      delivered += h.battery.discharge(totalKW * (socs[i] / total), minutes).deliveredKWh;
    });
    return { deliveredKWh: delivered };
  }

  /** Per-battery SoC snapshot, restorable via restore(). */
  state(): number[] {
    return this.homes.map((h) => h.battery.soc);
  }

  restore(state: number[]): void {
    this.homes.forEach((h, i) => h.battery.restore(state[i] ?? 0));
  }

  view(): FleetView {
    const first = this.homes[0].battery.spec;
    let soc = 0;
    let cap = 0;
    let headroom = 0;
    let cRate = 0;
    let dRate = 0;
    for (const h of this.homes) {
      soc += h.battery.soc;
      cap += h.battery.spec.capacityKWh;
      headroom += h.battery.headroomKWh;
      cRate += h.battery.spec.maxChargeKW;
      dRate += h.battery.spec.maxDischargeKW;
    }
    return {
      homesOnline: this.homes.length,
      socKWh: soc,
      capacityKWh: cap,
      chargeHeadroomKWh: headroom,
      maxChargeKW: cRate,
      maxDischargeKW: dRate,
      roundTripEfficiency: first.roundTripEfficiency,
      degradationCostPerMWh: first.degradationCostPerMWh,
      solarKWNow: this.lastSolarKW,
    };
  }
}
