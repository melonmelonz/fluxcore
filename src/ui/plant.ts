import type { Fleet } from '../core/fleet';
import { type FleetMix, fleetFromMix } from '../core/units';
import type { Season } from '../core/types';

/** Build the dispatchable plant for the given unit mix. */
export function makeFleet(season: Season, mix: FleetMix): Fleet {
  return fleetFromMix(mix, season);
}
