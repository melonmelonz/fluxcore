import { type DeskLane, deskTick } from './desk';
import type { Fleet } from './fleet';
import { Ledger } from './ledger';
import type { Strategy } from './strategy';
import type { PricePoint, Scenario } from './types';

export interface BacktestResult {
  name: string;
  pnl: number;
  mwhCharged: number;
  mwhDischarged: number;
  dispatches: number;
}

/** Max-speed steppable backtest over the shared desk tick. */
export class Backtest {
  private readonly lanes: DeskLane[];
  private readonly seen: PricePoint[] = [];
  private i = 0;

  constructor(
    private readonly scenario: Scenario,
    fleetFactory: () => Fleet,
    strategies: Strategy[],
  ) {
    this.lanes = strategies.map((strategy) => ({
      strategy,
      fleet: fleetFactory(),
      ledger: new Ledger(),
      lastAction: null,
    }));
  }

  get progress(): number {
    return this.scenario.rtm.length === 0 ? 1 : this.i / this.scenario.rtm.length;
  }

  /** Run up to n ticks; returns true when the scenario is exhausted. */
  step(n: number): boolean {
    const { rtm, dam, intervalMinutes } = this.scenario;
    for (let k = 0; k < n && this.i < rtm.length; k++, this.i++) {
      const point = rtm[this.i];
      this.seen.push(point);
      for (const lane of this.lanes) {
        deskTick(lane, point, this.seen, dam, intervalMinutes);
      }
    }
    return this.i >= rtm.length;
  }

  results(): BacktestResult[] {
    return this.lanes.map((l) => {
      let charged = 0;
      let discharged = 0;
      for (const e of l.ledger.entries) {
        if (e.action === 'charge') charged += e.mwh;
        else discharged += e.mwh;
      }
      return {
        name: l.strategy.name,
        pnl: l.ledger.pnl,
        mwhCharged: charged,
        mwhDischarged: discharged,
        dispatches: l.ledger.entries.length,
      };
    });
  }
}
