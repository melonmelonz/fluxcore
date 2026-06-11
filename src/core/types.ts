export interface PricePoint {
  /** epoch milliseconds, interval start */
  t: number;
  /** $/MWh */
  price: number;
}

export type Season = 'summer' | 'shoulder' | 'winter';

export interface Scenario {
  id: string;
  name: string;
  description: string;
  season: Season;
  intervalMinutes: number;
  /** real-time settlement point prices, 15-min intervals */
  rtm: PricePoint[];
  /** day-ahead hourly prices */
  dam: PricePoint[];
}
