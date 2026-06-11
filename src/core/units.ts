import { Fleet, type HomeSpec } from './fleet';
import type { Season } from './types';

export type UnitTypeId = 'home' | 'commercial' | 'ev';

export const UNIT_TYPES: Record<UnitTypeId, { label: string; spec: HomeSpec }> = {
  home: {
    label: 'Suburban home',
    spec: {
      battery: { capacityKWh: 13.5, maxChargeKW: 5, maxDischargeKW: 5, roundTripEfficiency: 0.86, degradationCostPerMWh: 20 },
      solarPeakKW: 5,
    },
  },
  commercial: {
    label: 'Commercial unit',
    spec: {
      battery: { capacityKWh: 100, maxChargeKW: 50, maxDischargeKW: 50, roundTripEfficiency: 0.86, degradationCostPerMWh: 20 },
      solarPeakKW: 0,
    },
  },
  ev: {
    label: 'EV (away 8a-6p)',
    spec: {
      battery: { capacityKWh: 60, maxChargeKW: 11, maxDischargeKW: 11, roundTripEfficiency: 0.86, degradationCostPerMWh: 20 },
      solarPeakKW: 0,
      unavailable: { fromHour: 8, toHour: 18 },
    },
  },
};

export type FleetMix = { type: UnitTypeId; count: number }[];

export const PRESETS: { id: string; label: string; mix: FleetMix }[] = [
  { id: 'suburban', label: 'Suburban 200', mix: [{ type: 'home', count: 200 }] },
  { id: 'mixed', label: 'Mixed Portfolio', mix: [{ type: 'home', count: 120 }, { type: 'commercial', count: 10 }, { type: 'ev', count: 60 }] },
  { id: 'campus', label: 'Commercial Campus', mix: [{ type: 'commercial', count: 20 }] },
  { id: 'ev-heavy', label: 'EV Heavy', mix: [{ type: 'home', count: 20 }, { type: 'ev', count: 150 }] },
];

export function mixTotals(mix: FleetMix): { units: number; capacityKWh: number; maxDischargeKW: number; solarPeakKW: number } {
  let units = 0, capacityKWh = 0, maxDischargeKW = 0, solarPeakKW = 0;
  for (const { type, count } of mix) {
    const s = UNIT_TYPES[type].spec;
    units += count;
    capacityKWh += count * s.battery.capacityKWh;
    maxDischargeKW += count * s.battery.maxDischargeKW;
    solarPeakKW += count * s.solarPeakKW;
  }
  return { units, capacityKWh, maxDischargeKW, solarPeakKW };
}

export function fleetFromMix(mix: FleetMix, season: Season): Fleet {
  const specs = mix.flatMap(({ type, count }) =>
    Array.from({ length: count }, () => UNIT_TYPES[type].spec));
  return new Fleet(specs, season);
}
