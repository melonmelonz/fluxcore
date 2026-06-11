import solver from 'javascript-lp-solver';
import { HOLD, type Action, type MarketContext, type Strategy } from './strategy';

const HOUR_MS = 3_600_000;

/**
 * Maximize sum_i (d_i * p_i - c_i * p_i - d_i * degradation)
 * subject to, for every hour k:
 *   0 <= soc0 + sum_{i<=k} (c_i * eff - d_i) <= capacity     (MWh, dt = 1h)
 *   0 <= c_i <= maxCharge, 0 <= d_i <= maxDischarge          (MW)
 */
export class LPStrategy implements Strategy {
  readonly name = 'lp-optimizer';

  private planHour = Number.NaN;
  private plan = { chargeMW: 0, dischargeMW: 0 };

  constructor(private readonly horizonHours = 24) {}

  decide(ctx: MarketContext): Action {
    const hour = Math.floor(ctx.now.t / HOUR_MS);
    if (hour !== this.planHour) {
      this.plan = this.solve(ctx);
      this.planHour = hour;
    }
    const f = ctx.fleet;
    if (this.plan.dischargeMW > 1e-6 && f.socKWh > 1e-9) {
      return { type: 'discharge', kW: Math.min(this.plan.dischargeMW * 1000, f.maxDischargeKW) };
    }
    if (this.plan.chargeMW > 1e-6 && f.chargeHeadroomKWh > 1e-9) {
      return { type: 'charge', kW: Math.min(this.plan.chargeMW * 1000, f.maxChargeKW) };
    }
    return HOLD;
  }

  private solve(ctx: MarketContext): { chargeMW: number; dischargeMW: number } {
    const none = { chargeMW: 0, dischargeMW: 0 };
    const prices = ctx.damForecast.slice(0, this.horizonHours).map((p) => p.price);
    if (prices.length === 0) return none;
    prices[0] = ctx.now.price; // react to real-time divergence from day-ahead

    const f = ctx.fleet;
    const eff = f.roundTripEfficiency;
    const capMWh = f.capacityKWh / 1000;
    const soc0 = f.socKWh / 1000;
    const cMaxMW = f.maxChargeKW / 1000;
    const dMaxMW = f.maxDischargeKW / 1000;

    const constraints: Record<string, { max?: number; min?: number }> = {};
    const variables: Record<string, Record<string, number>> = {};
    const H = prices.length;

    for (let i = 0; i < H; i++) {
      constraints[`c${i}`] = { max: cMaxMW };
      constraints[`d${i}`] = { max: dMaxMW };
      variables[`c${i}`] = { profit: -prices[i], [`c${i}`]: 1 };
      variables[`d${i}`] = { profit: prices[i] - f.degradationCostPerMWh, [`d${i}`]: 1 };
      for (let k = i; k < H; k++) {
        variables[`c${i}`][`soc${k}`] = eff;
        variables[`d${i}`][`soc${k}`] = -1;
      }
    }
    for (let k = 0; k < H; k++) {
      constraints[`soc${k}`] = { max: capMWh - soc0, min: -soc0 };
    }

    const out = solver.Solve({ optimize: 'profit', opType: 'max', constraints, variables });
    if (out.feasible === false) return none;
    const num = (v: unknown) => (typeof v === 'number' ? v : 0);
    return { chargeMW: num(out.c0), dischargeMW: num(out.d0) };
  }
}
