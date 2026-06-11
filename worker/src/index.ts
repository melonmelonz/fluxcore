import { latestDocId, parseDamCsv, parseRtmCsv, unzipCsv } from '../lib/mis';
import { mergePoints } from '../lib/merge';
import type { PricePoint } from '../../src/core/types';
export { LiveDesk } from './livedesk';

export interface Env {
  FLUX_KV: KVNamespace;
  FLUX_DB: D1Database;
  LIVE_DESK: DurableObjectNamespace;
}

const HUB = 'HB_NORTH';
const RTM_REPORT = 12301;
const DAM_REPORT = 12331;
const WEEK_MS = 7 * 86_400_000;
const DAM_KEEP_MS = 3 * 86_400_000;
const MIS_LIST = 'https://www.ercot.com/misapp/servlets/IceDocListJsonWS?reportTypeId=';
const MIS_DL = 'https://www.ercot.com/misdownload/servlets/mirDownload?doclookupId=';

function cookiesOf(res: Response): string | undefined {
  const all = res.headers.getSetCookie?.() ?? [];
  if (all.length === 0) return undefined;
  return all.map((c) => c.split(';')[0]).join('; ');
}

/** ERCOT sits behind Imperva, which sometimes serves an HTML cookie
 *  challenge instead of JSON. Retry once carrying the issued cookies. */
async function fetchReport(reportTypeId: number): Promise<Uint8Array> {
  let res = await fetch(MIS_LIST + reportTypeId);
  let cookie = cookiesOf(res);
  let list: unknown;
  try {
    list = JSON.parse(await res.text());
  } catch {
    res = await fetch(MIS_LIST + reportTypeId, { headers: cookie ? { cookie } : {} });
    cookie = cookiesOf(res) ?? cookie;
    list = JSON.parse(await res.text()); // still HTML -> throw -> fail closed, serve cache
  }
  const docId = latestDocId(list);
  const dl = await fetch(MIS_DL + docId, { headers: cookie ? { cookie } : {} });
  return new Uint8Array(await dl.arrayBuffer());
}

async function persist(env: Env, hub: string, market: 'rtm' | 'dam', pts: PricePoint[]): Promise<void> {
  if (pts.length === 0) return;
  const stmt = env.FLUX_DB.prepare(
    'INSERT OR REPLACE INTO price_points (hub, market, t, price) VALUES (?, ?, ?, ?)',
  );
  await env.FLUX_DB.batch(pts.map((p) => stmt.bind(hub, market, p.t, p.price)));
}

async function refresh(env: Env, market: 'rtm' | 'dam'): Promise<void> {
  const zip = await fetchReport(market === 'rtm' ? RTM_REPORT : DAM_REPORT);
  const csv = unzipCsv(zip);
  const pts = market === 'rtm' ? parseRtmCsv(csv, HUB) : parseDamCsv(csv, HUB);
  const key = `prices:${HUB}:${market}`;
  const existing = (await env.FLUX_KV.get<PricePoint[]>(key, 'json')) ?? [];
  const merged = mergePoints(existing, pts, Date.now(), market === 'rtm' ? WEEK_MS : DAM_KEEP_MS);
  await env.FLUX_KV.put(key, JSON.stringify(merged), {
    metadata: { lastUpdated: Date.now() },
  });
  await persist(env, HUB, market, pts);
}

export default {
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    try { await refresh(env, 'rtm'); } catch (e) { console.error('rtm refresh failed', e); }
    // DAM publishes once daily; refreshing on a sparse cadence is plenty
    const hourUtc = new Date(controller.scheduledTime).getUTCHours();
    const minute = new Date(controller.scheduledTime).getUTCMinutes();
    if (minute < 5 && hourUtc % 3 === 0) {
      try { await refresh(env, 'dam'); } catch (e) { console.error('dam refresh failed', e); }
    }
    const desk = env.LIVE_DESK.get(env.LIVE_DESK.idFromName(HUB));
    await desk.fetch('https://desk/tick', { method: 'POST' });
  },

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/probe') {
      // temporary diagnostics: what does ERCOT MIS return to a Workers fetch?
      const res = await fetch(MIS_LIST + RTM_REPORT);
      const body = await res.text();
      return Response.json({
        status: res.status,
        headers: Object.fromEntries(res.headers),
        head: body.slice(0, 600),
      });
    }
    return new Response('fluxcore-desk: cron + DO host', { status: 200 });
  },
};
