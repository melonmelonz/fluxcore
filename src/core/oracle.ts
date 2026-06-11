import solver from 'javascript-lp-solver';
import { hourOfDayCentral } from './desk';
import { solarOutputKW } from './solar';
import type { PricePoint, Season } from './types';

const HOUR_MS = 3_600_000;
const CENTRAL_OFFSET_HOURS = 6;

export interface OracleFleetSpec {
  /** fleet totals */
  capacityKWh: number;
  maxChargeKW: number;
  maxDischargeKW: number;
  roundTripEfficiency: number;
  degradationCostPerMWh: number;
  /** fleet-total solar peak kW; 0 disables solar */
  solarPeakKW: number;
}

/**
 * Perfect-hindsight benchmark: an LP that sees actual RT prices, solved as a
 * 48h receding horizon (two Central days per window, committing only the
 * first) with SoC carried across days. Solar enters as a free curtailable
 * charge source, dominating the simulator's forced solar.
 */
export function oraclePnl(
  rtm: PricePoint[],
  spec: OracleFleetSpec,
  season: Season,
  intervalMinutes: number,
): number {
  const days = new Map<number, PricePoint[]>();
  for (const p of rtm) {
    const day = Math.floor(p.t / HOUR_MS / 24 - CENTRAL_OFFSET_HOURS / 24);
    const arr = days.get(day);
    if (arr) arr.push(p);
    else days.set(day, [p]);
  }
  const keys = [...days.keys()].sort((a, b) => a - b);
  let soc = 0;
  let pnl = 0;
  for (let i = 0; i < keys.length; i++) {
    const today = days.get(keys[i])!;
    const tomorrow = i + 1 < keys.length ? days.get(keys[i + 1])! : [];
    const r = solveWindow([...today, ...tomorrow], today.length, soc, spec, season, intervalMinutes);
    pnl += r.pnl;
    soc = r.socEnd;
  }
  return pnl;
}

function solveWindow(
  points: PricePoint[],
  commit: number,
  soc0KWh: number,
  spec: OracleFleetSpec,
  season: Season,
  intervalMinutes: number,
): { pnl: number; socEnd: number } {
  const dt = intervalMinutes / 60;
  const H = points.length;
  const eff = spec.roundTripEfficiency;
  const capMWh = spec.capacityKWh / 1000;
  const soc0 = soc0KWh / 1000;
  const cMaxMW = spec.maxChargeKW / 1000;
  const dMaxMW = spec.maxDischargeKW / 1000;

  const constraints: Record<string, { max?: number; min?: number }> = {};
  const variables: Record<string, Record<string, number>> = {};

  for (let i = 0; i < H; i++) {
    const price = points[i].price;
    const solarMW = spec.solarPeakKW > 0
      ? Math.min(solarOutputKW(spec.solarPeakKW, hourOfDayCentral(points[i].t), season), spec.maxChargeKW) / 1000
      : 0;
    constraints[`c${i}`] = { max: cMaxMW };
    constraints[`d${i}`] = { max: dMaxMW };
    variables[`c${i}`] = { profit: -price * dt, [`c${i}`]: 1 };
    variables[`d${i}`] = { profit: (price - spec.degradationCostPerMWh) * dt, [`d${i}`]: 1 };
    if (solarMW > 0) {
      constraints[`g${i}`] = { max: solarMW };
      variables[`g${i}`] = { profit: 0, [`g${i}`]: 1 };
    }
    for (let k = i; k < H; k++) {
      variables[`c${i}`][`soc${k}`] = eff * dt;
      variables[`d${i}`][`soc${k}`] = -dt;
      if (solarMW > 0) variables[`g${i}`][`soc${k}`] = eff * dt;
    }
  }
  for (let k = 0; k < H; k++) {
    constraints[`soc${k}`] = { max: capMWh - soc0, min: -soc0 };
  }

  const out = solver.Solve({ optimize: 'profit', opType: 'max', constraints, variables });
  if (out.feasible === false) return { pnl: 0, socEnd: soc0KWh };
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  // Book only the committed intervals; the tail exists for lookahead.
  let pnl = 0;
  let delta = 0; // MWh
  for (let i = 0; i < commit; i++) {
    const c = num(out[`c${i}`]);
    const d = num(out[`d${i}`]);
    const g = num(out[`g${i}`]);
    pnl += dt * (d * (points[i].price - spec.degradationCostPerMWh) - c * points[i].price);
    delta += eff * dt * c - dt * d + eff * dt * g;
  }
  return { pnl, socEnd: Math.max(0, Math.min((soc0 + delta) * 1000, spec.capacityKWh)) };
}
