import { Fleet } from '../../src/core/fleet';
import { Ledger, type LedgerEntry } from '../../src/core/ledger';
import { LPStrategy } from '../../src/core/lp';
import { seasonForMonth } from '../../src/core/solar';
import { ThresholdStrategy } from '../../src/core/threshold';
import { deskTick, type DeskLane } from '../../src/core/desk';
import type { PricePoint } from '../../src/core/types';
import type { Env } from './index';

const HUB = 'HB_NORTH';
const HOME = {
  battery: {
    capacityKWh: 13.5, maxChargeKW: 5, maxDischargeKW: 5,
    roundTripEfficiency: 0.86, degradationCostPerMWh: 20,
  },
  solarPeakKW: 5,
};
const HOMES = 200;
const INTERVAL_MIN = 15;
const RECENT_KEEP = 100;

interface LaneState {
  fleetState: number[];
  pnl: number;
  recent: LedgerEntry[];
}
interface DeskState {
  lastT: number;
  startedAt: number;
  lanes: Record<string, LaneState>;
}

export class LiveDesk implements DurableObject {
  constructor(private state: DurableObjectState, private env: Env) {}

  private makeLanes(season: ReturnType<typeof seasonForMonth>): DeskLane[] {
    return [new ThresholdStrategy(), new LPStrategy()].map((strategy) => ({
      strategy,
      fleet: Fleet.uniform(HOMES, HOME, season),
      ledger: new Ledger(),
      lastAction: null,
    }));
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/tick') return this.tick();
    if (url.pathname === '/state') return this.stateResponse();
    return new Response('not found', { status: 404 });
  }

  private async tick(): Promise<Response> {
    const rtm = (await this.env.FLUX_KV.get<PricePoint[]>(`prices:${HUB}:rtm`, 'json')) ?? [];
    const dam = (await this.env.FLUX_KV.get<PricePoint[]>(`prices:${HUB}:dam`, 'json')) ?? [];
    if (rtm.length === 0) return Response.json({ ticked: 0 });

    const stored = await this.state.storage.get<DeskState>('desk');
    const desk: DeskState = stored ?? { lastT: 0, startedAt: Date.now(), lanes: {} };
    const season = seasonForMonth(new Date().getUTCMonth() + 1);
    const lanes = this.makeLanes(season);
    for (const lane of lanes) {
      const ls = desk.lanes[lane.strategy.name];
      if (ls) {
        lane.fleet.restore(ls.fleetState);
        for (const e of ls.recent) lane.ledger.record(e); // seed tail; pnl tracked separately
      }
    }
    const priorPnl: Record<string, number> = {};
    for (const lane of lanes) {
      priorPnl[lane.strategy.name] =
        (desk.lanes[lane.strategy.name]?.pnl ?? 0) - lane.ledger.pnl;
    }

    const fresh = rtm.filter((p) => p.t > desk.lastT);
    const newEntries: LedgerEntry[] = [];
    for (const point of fresh) {
      const history = rtm.filter((p) => p.t <= point.t);
      for (const lane of lanes) {
        const before = lane.ledger.entries.length;
        deskTick(lane, point, history, dam, INTERVAL_MIN);
        newEntries.push(...lane.ledger.entries.slice(before));
      }
      desk.lastT = point.t;
    }

    for (const lane of lanes) {
      desk.lanes[lane.strategy.name] = {
        fleetState: lane.fleet.state(),
        pnl: priorPnl[lane.strategy.name] + lane.ledger.pnl,
        recent: lane.ledger.tail(RECENT_KEEP),
      };
    }
    await this.state.storage.put('desk', desk);

    if (newEntries.length > 0) {
      const stmt = this.env.FLUX_DB.prepare(
        'INSERT INTO dispatches (hub, strategy, t, action, mwh, price, value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      );
      await this.env.FLUX_DB.batch(
        newEntries.map((e) => stmt.bind(HUB, e.strategy, e.t, e.action, e.mwh, e.price, e.value)),
      );
    }
    return Response.json({ ticked: fresh.length });
  }

  private async stateResponse(): Promise<Response> {
    const desk = await this.state.storage.get<DeskState>('desk');
    if (!desk) return Response.json({ live: false });
    return Response.json({
      live: true,
      hub: HUB,
      startedAt: desk.startedAt,
      lastT: desk.lastT,
      lanes: Object.entries(desk.lanes).map(([name, l]) => ({
        name,
        pnl: l.pnl,
        socKWh: l.fleetState.reduce((a, b) => a + b, 0),
        capacityKWh: HOMES * HOME.battery.capacityKWh,
        maxDischargeKW: HOMES * HOME.battery.maxDischargeKW,
        homesOnline: HOMES,
        recent: l.recent.slice(-25),
      })),
    });
  }
}
