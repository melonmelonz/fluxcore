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
  unavailable?: { fromHour: number; toHour: number };
}

export class Fleet {
  private homes: Home[];
  private lastSolarKW = 0;

  /** Local hour set by applySolar; deskTick applies solar before any dispatch,
   *  so availability below is always evaluated at the current tick's hour. */
  private currentHour = 0;

  constructor(specs: HomeSpec[], readonly season: Season) {
    this.homes = specs.map((s) => ({ battery: new Battery(s.battery), solarPeakKW: s.solarPeakKW, unavailable: s.unavailable }));
  }

  static uniform(count: number, home: HomeSpec, season: Season): Fleet {
    return new Fleet(Array.from({ length: count }, () => home), season);
  }

  private available(h: Home): boolean {
    if (!h.unavailable) return true;
    return this.currentHour < h.unavailable.fromHour || this.currentHour >= h.unavailable.toHour;
  }

  applySolar(hourOfDay: number, minutes: number): number {
    this.currentHour = hourOfDay;
    let stored = 0;
    let kw = 0;
    for (const h of this.homes) {
      if (!this.available(h)) continue;
      const out = solarOutputKW(h.solarPeakKW, hourOfDay, this.season);
      kw += out;
      stored += h.battery.charge(out, minutes).storedKWh;
    }
    this.lastSolarKW = kw;
    return stored;
  }

  charge(totalKW: number, minutes: number): { drawnKWh: number } {
    const headrooms = this.homes.map((h) => (this.available(h) ? h.battery.headroomKWh : 0));
    const total = headrooms.reduce((a, b) => a + b, 0);
    if (total <= 0) return { drawnKWh: 0 };
    let drawn = 0;
    this.homes.forEach((h, i) => {
      drawn += h.battery.charge(totalKW * (headrooms[i] / total), minutes).drawnKWh;
    });
    return { drawnKWh: drawn };
  }

  discharge(totalKW: number, minutes: number): { deliveredKWh: number } {
    const socs = this.homes.map((h) => (this.available(h) ? h.battery.soc : 0));
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
    const first = this.homes[0]?.battery.spec;
    let online = 0, soc = 0, cap = 0, headroom = 0, cRate = 0, dRate = 0, effW = 0, degW = 0;
    for (const h of this.homes) {
      if (!this.available(h)) continue;
      online += 1;
      soc += h.battery.soc;
      cap += h.battery.spec.capacityKWh;
      headroom += h.battery.headroomKWh;
      cRate += h.battery.spec.maxChargeKW;
      dRate += h.battery.spec.maxDischargeKW;
      effW += h.battery.spec.roundTripEfficiency * h.battery.spec.capacityKWh;
      degW += h.battery.spec.degradationCostPerMWh * h.battery.spec.capacityKWh;
    }
    return {
      homesOnline: online,
      socKWh: soc,
      capacityKWh: cap,
      chargeHeadroomKWh: headroom,
      maxChargeKW: cRate,
      maxDischargeKW: dRate,
      roundTripEfficiency: cap > 0 ? effW / cap : first?.roundTripEfficiency ?? 0.86,
      degradationCostPerMWh: cap > 0 ? degW / cap : first?.degradationCostPerMWh ?? 20,
      solarKWNow: this.lastSolarKW,
    };
  }
}
