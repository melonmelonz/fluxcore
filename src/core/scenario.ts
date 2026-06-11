import type { PricePoint, Scenario, Season } from './types';

const SEASONS: ReadonlySet<string> = new Set(['summer', 'shoulder', 'winter']);

function parsePoints(raw: unknown, field: string): PricePoint[] {
  if (!Array.isArray(raw)) throw new Error(`scenario: ${field} must be an array`);
  return raw.map((p, i) => {
    const o = p as Record<string, unknown>;
    if (typeof o?.t !== 'number' || !Number.isFinite(o.t)) {
      throw new Error(`scenario: ${field}[${i}].t must be a number`);
    }
    if (typeof o?.price !== 'number' || !Number.isFinite(o.price)) {
      throw new Error(`scenario: ${field}[${i}].price must be a number`);
    }
    return { t: o.t, price: o.price };
  });
}

export function parseScenario(raw: unknown): Scenario {
  const o = raw as Record<string, unknown>;
  for (const k of ['id', 'name', 'description'] as const) {
    if (typeof o?.[k] !== 'string' || o[k] === '') throw new Error(`scenario: ${k} must be a non-empty string`);
  }
  if (typeof o.season !== 'string' || !SEASONS.has(o.season)) {
    throw new Error('scenario: season must be summer | shoulder | winter');
  }
  if (typeof o.intervalMinutes !== 'number' || o.intervalMinutes <= 0) {
    throw new Error('scenario: intervalMinutes must be a positive number');
  }
  const rtm = parsePoints(o.rtm, 'rtm');
  const dam = parsePoints(o.dam, 'dam');
  if (rtm.length === 0) throw new Error('scenario: rtm must not be empty');
  return {
    id: o.id as string,
    name: o.name as string,
    description: o.description as string,
    season: o.season as Season,
    intervalMinutes: o.intervalMinutes,
    rtm,
    dam,
  };
}
