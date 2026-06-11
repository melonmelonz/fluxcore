import type { Fleet } from './fleet';
import type { Ledger } from './ledger';
import type { Action, MarketContext, Strategy } from './strategy';
import type { PricePoint } from './types';

const HOUR_MS = 3_600_000;
const CENTRAL_OFFSET_HOURS = 6; // ERCOT is US Central; DST ignored deliberately

export interface DeskLane {
  strategy: Strategy;
  fleet: Fleet;
  ledger: Ledger;
  lastAction: Action | null;
}

export function hourOfDayCentral(t: number): number {
  return (((t / HOUR_MS - CENTRAL_OFFSET_HOURS) % 24) + 24) % 24;
}

export function damWindow(dam: PricePoint[], t: number): PricePoint[] {
  let start = dam.findIndex((p) => p.t > t);
  start = start === -1 ? dam.length : start;
  start = Math.max(0, start - 1);
  return dam.slice(start, start + 24);
}

/** Run one market interval for a lane: solar, decision, execution, booking. */
export function deskTick(
  lane: DeskLane,
  point: PricePoint,
  history: PricePoint[],
  dam: PricePoint[],
  intervalMinutes: number,
): void {
  const hourOfDay = hourOfDayCentral(point.t);
  lane.fleet.applySolar(hourOfDay, intervalMinutes);
  const ctx: MarketContext = {
    now: point,
    history,
    damForecast: damWindow(dam, point.t),
    fleet: lane.fleet.view(),
    intervalMinutes,
  };
  const action = lane.strategy.decide(ctx);
  lane.lastAction = action;
  if (action.type === 'charge') {
    const { drawnKWh } = lane.fleet.charge(action.kW, intervalMinutes);
    if (drawnKWh > 1e-9) {
      const mwh = drawnKWh / 1000;
      lane.ledger.record({
        t: point.t, strategy: lane.strategy.name, action: 'charge',
        mwh, price: point.price, value: -mwh * point.price,
      });
    }
  } else if (action.type === 'discharge') {
    const { deliveredKWh } = lane.fleet.discharge(action.kW, intervalMinutes);
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
