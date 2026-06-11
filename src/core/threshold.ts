import { HOLD, type Action, type MarketContext, type Strategy } from './strategy';

/**
 * Naive baseline: compare the current price to a rolling mean.
 * Charge a band below the mean; discharge a band above it, but only
 * when the spread also clears efficiency loss plus degradation cost.
 */
export class ThresholdStrategy implements Strategy {
  readonly name = 'threshold';

  constructor(
    private readonly windowSize = 96, // 24h of 15-min intervals
    private readonly bandUSD = 20,
    private readonly minSamples = 8,
  ) {}

  decide(ctx: MarketContext): Action {
    const win = ctx.history.slice(-this.windowSize);
    if (win.length < this.minSamples) return HOLD;
    const mean = win.reduce((s, p) => s + p.price, 0) / win.length;
    const f = ctx.fleet;

    if (ctx.now.price <= mean - this.bandUSD && f.chargeHeadroomKWh > 1e-9) {
      return { type: 'charge', kW: f.maxChargeKW };
    }

    const breakeven = mean / f.roundTripEfficiency + f.degradationCostPerMWh;
    if (ctx.now.price >= Math.max(mean + this.bandUSD, breakeven) && f.socKWh > 1e-9) {
      return { type: 'discharge', kW: f.maxDischargeKW };
    }

    return HOLD;
  }
}
