import { type FleetMix, PRESETS, UNIT_TYPES } from '../core/units';

const KEY = 'fluxcore.fleetMix';

function valid(raw: unknown): raw is FleetMix {
  return Array.isArray(raw) && raw.length > 0 && raw.every((e) =>
    typeof e === 'object' && e !== null &&
    Object.prototype.hasOwnProperty.call(UNIT_TYPES, (e as { type?: unknown }).type as string) &&
    Number.isInteger((e as { count?: unknown }).count) &&
    ((e as { count: number }).count) >= 0 && ((e as { count: number }).count) <= 1000);
}

export function loadMix(): FleetMix {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '');
    if (valid(raw)) return raw;
  } catch { /* fall through */ }
  return PRESETS[0].mix;
}

export function saveMix(mix: FleetMix): void {
  localStorage.setItem(KEY, JSON.stringify(mix));
}
