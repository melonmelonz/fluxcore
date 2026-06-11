import { Fleet } from '../core/fleet';
import type { Season } from '../core/types';

/** 200 Powerwall-class homes: 2.7 MWh storage, 1 MW dispatchable. */
export function makeFleet(season: Season): Fleet {
  return Fleet.uniform(200, {
    battery: {
      capacityKWh: 13.5,
      maxChargeKW: 5,
      maxDischargeKW: 5,
      roundTripEfficiency: 0.86,
      degradationCostPerMWh: 20,
    },
    solarPeakKW: 5,
  }, season);
}
