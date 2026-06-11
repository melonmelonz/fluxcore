import { MarketClock } from './clock';
import { type DeskLane, deskTick } from './desk';
import type { Fleet, FleetView } from './fleet';
import { Ledger, type LedgerEntry } from './ledger';
import type { Action, Strategy } from './strategy';
import type { PricePoint, Scenario } from './types';
import { wearStats, type WearStats } from './wear';

export interface LaneSnapshot {
  name: string;
  pnl: number;
  fleet: FleetView;
  lastAction: Action | null;
  wear?: WearStats;
}

export interface SimSnapshot {
  t: number;
  price: number;
  progress: number;
  done: boolean;
  lanes: LaneSnapshot[];
  /** merged most-recent ledger entries across lanes, oldest first */
  recent: LedgerEntry[];
}

export class SimulationController {
  private readonly clock: MarketClock;
  private readonly lanes: DeskLane[];

  constructor(
    private readonly scenario: Scenario,
    fleetFactory: () => Fleet,
    strategies: Strategy[],
  ) {
    this.clock = new MarketClock(scenario.rtm);
    this.lanes = strategies.map((strategy) => ({
      strategy,
      fleet: fleetFactory(),
      ledger: new Ledger(),
      lastAction: null,
    }));
  }

  tick(): SimSnapshot | null {
    const point = this.clock.next();
    if (!point) return null;
    const history = this.clock.history();
    for (const lane of this.lanes) {
      deskTick(lane, point, history, this.scenario.dam, this.scenario.intervalMinutes);
    }
    return this.snapshot(point);
  }

  private snapshot(point: PricePoint): SimSnapshot {
    const recent = this.lanes
      .flatMap((l) => l.ledger.tail(25))
      .sort((a, b) => a.t - b.t)
      .slice(-50);
    return {
      t: point.t,
      price: point.price,
      progress: this.clock.progress,
      done: this.clock.done,
      lanes: this.lanes.map((l) => {
        const fleet = l.fleet.view();
        return {
          name: l.strategy.name,
          pnl: l.ledger.pnl,
          fleet,
          lastAction: l.lastAction,
          wear: wearStats(l.ledger, fleet.capacityKWh, fleet.degradationCostPerMWh),
        };
      }),
      recent,
    };
  }
}
