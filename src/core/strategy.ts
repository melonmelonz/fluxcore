import type { FleetView } from './fleet';
import type { PricePoint } from './types';

export interface MarketContext {
  now: PricePoint;
  /** all rtm points up to and including now */
  history: PricePoint[];
  /** day-ahead hourly prices covering now and the next ~24h */
  damForecast: PricePoint[];
  fleet: FleetView;
  intervalMinutes: number;
}

export type Action =
  | { type: 'charge'; kW: number }
  | { type: 'discharge'; kW: number }
  | { type: 'hold'; kW: 0 };

export const HOLD: Action = { type: 'hold', kW: 0 };

export interface Strategy {
  readonly name: string;
  decide(ctx: MarketContext): Action;
}
