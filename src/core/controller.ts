import { MarketClock } from './clock';
import type { Fleet, FleetView } from './fleet';
import { Ledger, type LedgerEntry } from './ledger';
import type { Action, MarketContext, Strategy } from './strategy';
import type { PricePoint, Scenario } from './types';

const HOUR_MS = 3_600_000;
const CENTRAL_OFFSET_HOURS = 6; // ERCOT is US Central; DST ignored deliberately

export interface LaneSnapshot {
  name: string;
  pnl: number;
  fleet: FleetView;
  lastAction: Action | null;
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

interface Lane {
  strategy: Strategy;
  fleet: Fleet;
  ledger: Ledger;
  lastAction: Action | null;
}

export class SimulationController {
  private readonly clock: MarketClock;
  private readonly lanes: Lane[];

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
    const minutes = this.scenario.intervalMinutes;
    const hourOfDay = (((point.t / HOUR_MS - CENTRAL_OFFSET_HOURS) % 24) + 24) % 24;
    const damForecast = this.damWindow(point.t);
    const history = this.clock.history();

    for (const lane of this.lanes) {
      lane.fleet.applySolar(hourOfDay, minutes);
      const ctx: MarketContext = {
        now: point, history, damForecast,
        fleet: lane.fleet.view(),
        intervalMinutes: minutes,
      };
      const action = lane.strategy.decide(ctx);
      lane.lastAction = action;
      this.execute(lane, action, point, minutes);
    }
    return this.snapshot(point);
  }

  private execute(lane: Lane, action: Action, point: PricePoint, minutes: number): void {
    if (action.type === 'charge') {
      const { drawnKWh } = lane.fleet.charge(action.kW, minutes);
      if (drawnKWh > 1e-9) {
        const mwh = drawnKWh / 1000;
        lane.ledger.record({
          t: point.t, strategy: lane.strategy.name, action: 'charge',
          mwh, price: point.price, value: -mwh * point.price,
        });
      }
    } else if (action.type === 'discharge') {
      const { deliveredKWh } = lane.fleet.discharge(action.kW, minutes);
      if (deliveredKWh > 1e-9) {
        const mwh = deliveredKWh / 1000;
        const deg = lane.fleet.view().degradationCostPerMWh;
        lane.ledger.record({
          t: point.t, strategy: lane.strategy.name, action: 'discharge',
          mwh, price: point.price, value: mwh * (point.price - deg),
        });
      }
    }
  }

  private damWindow(t: number): PricePoint[] {
    const dam = this.scenario.dam;
    let start = dam.findIndex((p) => p.t > t);
    start = start === -1 ? dam.length : start;
    start = Math.max(0, start - 1);
    return dam.slice(start, start + 24);
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
      lanes: this.lanes.map((l) => ({
        name: l.strategy.name,
        pnl: l.ledger.pnl,
        fleet: l.fleet.view(),
        lastAction: l.lastAction,
      })),
      recent,
    };
  }
}
