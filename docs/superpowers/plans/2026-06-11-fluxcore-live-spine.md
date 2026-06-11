# fluxcore Live Spine (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Worker scrapes live ERCOT prices every 5 minutes, persists them durably (KV hot cache + D1 permanent archive), an always-on LiveDesk Durable Object trades them with the existing strategies, and the frontend gains a LIVE mode.

**Architecture:** Sibling Worker `fluxcore-desk` (cron + DO + D1/KV writes) per the CF-Pages-cannot-host-DOs constraint; Pages Functions under `functions/api/` serve the frontend same-origin (CSP unchanged) via bindings (`script_name` for the DO). Engine reused unchanged from `src/core`; new pure modules (`desk.ts`, MIS parser, merge) are TDD'd in plain vitest; thin CF glue is verified by deploy + curl.

**Tech Stack:** existing app + fflate (zip), @cloudflare/workers-types, wrangler. No new frontend deps.

---

### Task 1: Real MIS fixtures

**Files:**
- Create: `worker/__tests__/fixtures/doclist-rtm.json`, `worker/__tests__/fixtures/rtm-spp.zip`, `worker/__tests__/fixtures/doclist-dam.json`, `worker/__tests__/fixtures/dam-spp.zip`

- [ ] **Step 1: Download the live doc lists and latest reports**

```bash
mkdir -p worker/__tests__/fixtures
curl -s 'https://www.ercot.com/misapp/servlets/IceDocListJsonWS?reportTypeId=12301' -o worker/__tests__/fixtures/doclist-rtm.json
curl -s 'https://www.ercot.com/misapp/servlets/IceDocListJsonWS?reportTypeId=12331' -o worker/__tests__/fixtures/doclist-dam.json
node -e "
const fs=require('fs');
for (const [f,out] of [['doclist-rtm.json','rtm'],['doclist-dam.json','dam']]) {
  const j=JSON.parse(fs.readFileSync('worker/__tests__/fixtures/'+f,'utf8'));
  const docs=j.ListDocsByRptTypeRes.DocumentList;
  console.log(out, docs[0].Document.DocID, docs[0].Document.FriendlyName);
}"
# use the two printed DocIDs:
curl -s 'https://www.ercot.com/misdownload/servlets/mirDownload?doclookupId=<RTM_DOCID>' -o worker/__tests__/fixtures/rtm-spp.zip
curl -s 'https://www.ercot.com/misdownload/servlets/mirDownload?doclookupId=<DAM_DOCID>' -o worker/__tests__/fixtures/dam-spp.zip
unzip -p worker/__tests__/fixtures/rtm-spp.zip | head -3   # note exact CSV header
unzip -p worker/__tests__/fixtures/dam-spp.zip | head -3
```

Expected RTM header: `"DeliveryDate","DeliveryHour","DeliveryInterval","SettlementPointName","SettlementPointType","SettlementPointPrice","DSTFlag"`
Expected DAM header: `"DeliveryDate","HourEnding","SettlementPoint","SettlementPointPrice","DSTFlag"`
**If headers differ, adjust the Task 2 parser code and tests to the real columns — the fixture is the source of truth.**

- [ ] **Step 2: Commit**

```bash
git add worker/__tests__/fixtures && git commit -m "test: real ERCOT MIS report fixtures for parser TDD"
```

---

### Task 2: MIS parser (pure, TDD)

**Files:**
- Create: `worker/lib/mis.ts`
- Test: `worker/__tests__/mis.test.ts`

- [ ] **Step 1: Install fflate + workers-types; include worker tests in vitest**

```bash
npm i fflate && npm i -D @cloudflare/workers-types
```

Check `vite.config.ts` — if vitest `include` is defaulted, worker tests are picked up automatically; otherwise add `'worker/**/*.test.ts'` to the include list.

- [ ] **Step 2: Write the failing tests**

```ts
// worker/__tests__/mis.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { latestDocId, parseDamCsv, parseRtmCsv, unzipCsv } from '../lib/mis';

const FIX = resolve(process.cwd(), 'worker/__tests__/fixtures');
const read = (f: string) => readFileSync(resolve(FIX, f));

describe('latestDocId', () => {
  it('returns the first (newest) DocID from a doc list', () => {
    const json = JSON.parse(read('doclist-rtm.json').toString('utf8'));
    const id = latestDocId(json);
    expect(id).toMatch(/^\d+$/);
  });
  it('throws on malformed doc lists', () => {
    expect(() => latestDocId({})).toThrow();
  });
});

describe('unzipCsv', () => {
  it('extracts the CSV text from a report zip', () => {
    const csv = unzipCsv(new Uint8Array(read('rtm-spp.zip')));
    expect(csv).toContain('SettlementPointPrice');
  });
});

describe('parseRtmCsv', () => {
  it('parses HB_NORTH 15-min points with epoch-ms timestamps (fixed UTC-6)', () => {
    const csv = unzipCsv(new Uint8Array(read('rtm-spp.zip')));
    const pts = parseRtmCsv(csv, 'HB_NORTH');
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) {
      expect(Number.isFinite(p.t)).toBe(true);
      expect(Number.isFinite(p.price)).toBe(true);
      expect(p.t % (15 * 60_000)).toBe(0); // interval-aligned
    }
  });
  it('returns empty for an unknown hub', () => {
    const csv = unzipCsv(new Uint8Array(read('rtm-spp.zip')));
    expect(parseRtmCsv(csv, 'HB_NOWHERE')).toEqual([]);
  });
  it('round-trips a known synthetic row', () => {
    const csv = '"DeliveryDate","DeliveryHour","DeliveryInterval","SettlementPointName","SettlementPointType","SettlementPointPrice","DSTFlag"\n' +
      '"08/20/2023","18","2","HB_NORTH","HU","102.55","N"';
    // hour 18, interval 2 => 17:15 central => 23:15 UTC
    expect(parseRtmCsv(csv, 'HB_NORTH')).toEqual([
      { t: Date.UTC(2023, 7, 20, 17, 15) + 6 * 3_600_000, price: 102.55 },
    ]);
  });
});

describe('parseDamCsv', () => {
  it('parses HB_NORTH hourly DAM points', () => {
    const csv = unzipCsv(new Uint8Array(read('dam-spp.zip')));
    const pts = parseDamCsv(csv, 'HB_NORTH');
    expect(pts.length).toBeGreaterThan(0);
    expect(pts.length).toBeLessThanOrEqual(25); // one operating day
  });
  it('round-trips a known synthetic row', () => {
    const csv = '"DeliveryDate","HourEnding","SettlementPoint","SettlementPointPrice","DSTFlag"\n' +
      '"01/15/2024","01:00","HB_NORTH","45.20","N"';
    expect(parseDamCsv(csv, 'HB_NORTH')).toEqual([
      { t: Date.UTC(2024, 0, 15, 0, 0) + 6 * 3_600_000, price: 45.2 },
    ]);
  });
});
```

- [ ] **Step 3: Run, verify it fails with "Failed to resolve import ../lib/mis"**

```bash
npx vitest run worker/__tests__/mis.test.ts 2>&1 | FORCE_COLOR=1 tee docs/tdd/logs/20-mis-red.txt
```

- [ ] **Step 4: Implement**

```ts
// worker/lib/mis.ts
import { unzipSync } from 'fflate';
import type { PricePoint } from '../../src/core/types';

const HOUR_MS = 3_600_000;
const CENTRAL_OFFSET_MS = 6 * HOUR_MS; // fixed UTC-6, DST ignored (matches engine)

export function latestDocId(docList: unknown): string {
  const docs = (docList as { ListDocsByRptTypeRes?: { DocumentList?: { Document?: { DocID?: unknown } }[] } })
    ?.ListDocsByRptTypeRes?.DocumentList;
  const id = docs?.[0]?.Document?.DocID;
  if (typeof id !== 'string' && typeof id !== 'number') throw new Error('malformed MIS doc list');
  return String(id);
}

export function unzipCsv(buf: Uint8Array): string {
  const files = unzipSync(buf);
  const name = Object.keys(files).find((n) => n.toLowerCase().endsWith('.csv'));
  if (!name) throw new Error('no csv in MIS zip');
  return new TextDecoder().decode(files[name]);
}

function rows(csv: string): string[][] {
  return csv.trim().split('\n').map((line) =>
    line.split(',').map((c) => c.replace(/^"|"$/g, '').trim()),
  );
}

function centralEpoch(dateMMDDYYYY: string, hour0: number, minute: number): number {
  const [mm, dd, yyyy] = dateMMDDYYYY.split('/').map(Number);
  return Date.UTC(yyyy, mm - 1, dd, hour0, minute) + CENTRAL_OFFSET_MS;
}

export function parseRtmCsv(csv: string, hub: string): PricePoint[] {
  const [header, ...data] = rows(csv);
  const col = (n: string) => header.indexOf(n);
  const [iDate, iHour, iInt, iName, iPrice] = [
    col('DeliveryDate'), col('DeliveryHour'), col('DeliveryInterval'),
    col('SettlementPointName'), col('SettlementPointPrice'),
  ];
  return data
    .filter((r) => r[iName] === hub)
    .map((r) => ({
      t: centralEpoch(r[iDate], Number(r[iHour]) - 1, (Number(r[iInt]) - 1) * 15),
      price: Number(r[iPrice]),
    }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.price))
    .sort((a, b) => a.t - b.t);
}

export function parseDamCsv(csv: string, hub: string): PricePoint[] {
  const [header, ...data] = rows(csv);
  const col = (n: string) => header.indexOf(n);
  const [iDate, iHE, iName, iPrice] = [
    col('DeliveryDate'), col('HourEnding'), col('SettlementPoint'), col('SettlementPointPrice'),
  ];
  return data
    .filter((r) => r[iName] === hub)
    .map((r) => ({
      t: centralEpoch(r[iDate], Number(r[iHE].split(':')[0]) - 1, 0),
      price: Number(r[iPrice]),
    }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.price))
    .sort((a, b) => a.t - b.t);
}
```

- [ ] **Step 5: Run, verify pass; capture green**

```bash
npx vitest run worker/__tests__/mis.test.ts 2>&1 | FORCE_COLOR=1 tee docs/tdd/logs/20-mis-green.txt
```

- [ ] **Step 6: Commit**

```bash
git add worker package.json package-lock.json docs/tdd/logs && git commit -m "feat: ERCOT MIS report parser with real-report fixtures"
```

---

### Task 3: mergePoints (pure, TDD)

**Files:**
- Create: `worker/lib/merge.ts`
- Test: `worker/__tests__/merge.test.ts`

- [ ] **Step 1: Failing tests**

```ts
// worker/__tests__/merge.test.ts
import { describe, expect, it } from 'vitest';
import { mergePoints } from '../lib/merge';

const p = (t: number, price: number) => ({ t, price });
const DAY = 86_400_000;

describe('mergePoints', () => {
  it('appends new points in order and dedupes by timestamp (incoming wins)', () => {
    const merged = mergePoints([p(1000, 10), p(2000, 20)], [p(2000, 21), p(3000, 30)], 3000, DAY);
    expect(merged).toEqual([p(1000, 10), p(2000, 21), p(3000, 30)]);
  });
  it('trims points older than maxAge', () => {
    const merged = mergePoints([p(0, 1)], [p(DAY + 1000, 2)], DAY + 1000, DAY);
    expect(merged).toEqual([p(DAY + 1000, 2)]);
  });
  it('handles empty existing cache', () => {
    expect(mergePoints([], [p(1, 1)], 1, DAY)).toEqual([p(1, 1)]);
  });
});
```

- [ ] **Step 2: Run, verify fails (module missing)**

```bash
npx vitest run worker/__tests__/merge.test.ts 2>&1 | FORCE_COLOR=1 tee docs/tdd/logs/21-merge-red.txt
```

- [ ] **Step 3: Implement**

```ts
// worker/lib/merge.ts
import type { PricePoint } from '../../src/core/types';

export function mergePoints(
  existing: PricePoint[], incoming: PricePoint[], now: number, maxAgeMs: number,
): PricePoint[] {
  const byT = new Map<number, number>();
  for (const pt of existing) byT.set(pt.t, pt.price);
  for (const pt of incoming) byT.set(pt.t, pt.price);
  return [...byT.entries()]
    .map(([t, price]) => ({ t, price }))
    .filter((pt) => pt.t >= now - maxAgeMs)
    .sort((a, b) => a.t - b.t);
}
```

- [ ] **Step 4: Run green, capture, commit**

```bash
npx vitest run worker/__tests__/merge.test.ts 2>&1 | FORCE_COLOR=1 tee docs/tdd/logs/21-merge-green.txt
git add worker docs/tdd/logs && git commit -m "feat: rolling price cache merge with dedupe and age trim"
```

---

### Task 4: Core additions — seasonForMonth, fleet state, deskTick (TDD)

**Files:**
- Modify: `src/core/solar.ts`, `src/core/battery.ts`, `src/core/fleet.ts`, `src/core/controller.ts`
- Create: `src/core/desk.ts`
- Test: `src/core/__tests__/desk.test.ts` (+ additions to `solar.test.ts`, `fleet.test.ts`)

- [ ] **Step 1: Failing tests**

Add to `src/core/__tests__/solar.test.ts`:

```ts
import { seasonForMonth } from '../solar';

describe('seasonForMonth', () => {
  it('maps months to seasons', () => {
    expect(seasonForMonth(7)).toBe('summer');   // July
    expect(seasonForMonth(9)).toBe('summer');   // Sept (ERCOT heat runs long)
    expect(seasonForMonth(1)).toBe('winter');
    expect(seasonForMonth(12)).toBe('winter');
    expect(seasonForMonth(4)).toBe('shoulder');
    expect(seasonForMonth(10)).toBe('shoulder');
  });
});
```

Add to `src/core/__tests__/fleet.test.ts` (reuse the file's existing home spec helper):

```ts
it('serializes and restores per-battery state', () => {
  const a = Fleet.uniform(3, home, 'summer');
  a.charge(15, 60);
  const state = a.state();
  const b = Fleet.uniform(3, home, 'summer');
  b.restore(state);
  expect(b.view().socKWh).toBeCloseTo(a.view().socKWh, 9);
  expect(b.state()).toEqual(state);
});
```

Create `src/core/__tests__/desk.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Fleet } from '../fleet';
import { Ledger } from '../ledger';
import { damWindow, deskTick, hourOfDayCentral, type DeskLane } from '../desk';
import type { Strategy } from '../strategy';

const home = {
  battery: { capacityKWh: 10, maxChargeKW: 5, maxDischargeKW: 5, roundTripEfficiency: 1, degradationCostPerMWh: 0 },
  solarPeakKW: 0,
};
const always = (type: 'charge' | 'discharge'): Strategy => ({
  name: 'test', decide: () => ({ type, kW: 5 }),
});
const lane = (s: Strategy): DeskLane => ({
  strategy: s, fleet: Fleet.uniform(1, home, 'summer'), ledger: new Ledger(), lastAction: null,
});

describe('hourOfDayCentral', () => {
  it('converts epoch ms to fixed UTC-6 hour of day', () => {
    expect(hourOfDayCentral(Date.UTC(2024, 0, 15, 6, 0))).toBe(0);
    expect(hourOfDayCentral(Date.UTC(2024, 0, 15, 23, 30))).toBe(17.5);
  });
});

describe('damWindow', () => {
  it('slices dam from the hour covering t', () => {
    const dam = [0, 1, 2, 3].map((h) => ({ t: h * 3_600_000, price: h }));
    expect(damWindow(dam, 1_800_000)[0].price).toBe(0);
    expect(damWindow(dam, 3_700_000)[0].price).toBe(1);
  });
});

describe('deskTick', () => {
  it('executes a charge and books a negative-value ledger entry', () => {
    const l = lane(always('charge'));
    deskTick(l, { t: 0, price: 40 }, [], [], 15);
    expect(l.ledger.entries).toHaveLength(1);
    expect(l.ledger.entries[0].action).toBe('charge');
    expect(l.ledger.pnl).toBeLessThan(0);
    expect(l.fleet.view().socKWh).toBeGreaterThan(0);
  });
  it('does not book an entry when the fleet is empty and asked to discharge', () => {
    const l = lane(always('discharge'));
    deskTick(l, { t: 0, price: 400 }, [], [], 15);
    expect(l.ledger.entries).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run all three, verify failures (missing exports/modules)**

```bash
npx vitest run src/core/__tests__/solar.test.ts src/core/__tests__/fleet.test.ts src/core/__tests__/desk.test.ts 2>&1 | FORCE_COLOR=1 tee docs/tdd/logs/22-desk-red.txt
```

- [ ] **Step 3: Implement**

`src/core/solar.ts` — append:

```ts
export function seasonForMonth(month: number): Season {
  if (month >= 6 && month <= 9) return 'summer';
  if (month === 12 || month <= 2) return 'winter';
  return 'shoulder';
}
```

`src/core/battery.ts` — add method:

```ts
restore(kwh: number): void {
  this.socKWh = Math.max(0, Math.min(kwh, this.spec.capacityKWh));
}
```

`src/core/fleet.ts` — add methods:

```ts
state(): number[] {
  return this.homes.map((h) => h.battery.soc);
}

restore(state: number[]): void {
  this.homes.forEach((h, i) => h.battery.restore(state[i] ?? 0));
}
```

`src/core/desk.ts` — new module (logic extracted from controller):

```ts
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
```

- [ ] **Step 4: Run green**

```bash
npx vitest run src/core 2>&1 | FORCE_COLOR=1 tee docs/tdd/logs/22-desk-green.txt
```

- [ ] **Step 5: REFACTOR controller to delegate to desk.ts** (kill the duplicated execute/damWindow/hour logic)

In `src/core/controller.ts`: delete the private `execute` and `damWindow` methods and the `Lane` interface; import and use the shared code:

```ts
import { type DeskLane, damWindow, deskTick } from './desk';
```

`tick()` body becomes:

```ts
tick(): SimSnapshot | null {
  const point = this.clock.next();
  if (!point) return null;
  const history = this.clock.history();
  for (const lane of this.lanes) {
    deskTick(lane, point, history, this.scenario.dam, this.scenario.intervalMinutes);
  }
  return this.snapshot(point);
}
```

with `private readonly lanes: DeskLane[];` (the shapes are identical). The `damForecast` slice previously computed once per tick is now computed inside `deskTick` per lane from the full `scenario.dam` — same result.

- [ ] **Step 6: Full suite must stay green — this is the refactor safety net**

```bash
npm test
```

Expected: all tests pass (52 prior + new). If `controller.test.ts` fails, the refactor broke behavior — fix the code, not the test.

- [ ] **Step 7: Commit**

```bash
git add src/core docs/tdd/logs && git commit -m "feat: shared desk tick executor, fleet state serialization, month-season map"
```

---

### Task 5: Worker — wrangler config, cron handler, LiveDesk DO

**Files:**
- Create: `worker/wrangler.toml`, `worker/src/index.ts`, `worker/src/livedesk.ts`, `worker/tsconfig.json`, `worker/schema.sql`
- Modify: root `tsconfig.json` (exclude `worker` from the web build), `package.json` (scripts)

- [ ] **Step 1: Create CF resources**

```bash
wrangler kv namespace create FLUX_KV          # note the id
wrangler d1 create fluxcore                   # note the database_id
```

- [ ] **Step 2: D1 schema**

```sql
-- worker/schema.sql
CREATE TABLE IF NOT EXISTS price_points (
  hub TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('rtm','dam')),
  t INTEGER NOT NULL,
  price REAL NOT NULL,
  PRIMARY KEY (hub, market, t)
);
CREATE TABLE IF NOT EXISTS dispatches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hub TEXT NOT NULL,
  strategy TEXT NOT NULL,
  t INTEGER NOT NULL,
  action TEXT NOT NULL,
  mwh REAL NOT NULL,
  price REAL NOT NULL,
  value REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dispatches_hub_t ON dispatches(hub, t);
```

```bash
wrangler d1 execute fluxcore --remote --file worker/schema.sql
```

- [ ] **Step 3: worker/wrangler.toml** (substitute the real ids from Step 1)

```toml
name = "fluxcore-desk"
main = "src/index.ts"
compatibility_date = "2026-06-01"

[triggers]
crons = ["*/5 * * * *"]

[[kv_namespaces]]
binding = "FLUX_KV"
id = "<KV_ID>"

[[d1_databases]]
binding = "FLUX_DB"
database_name = "fluxcore"
database_id = "<D1_ID>"

[durable_objects]
bindings = [{ name = "LIVE_DESK", class_name = "LiveDesk" }]

[[migrations]]
tag = "v1"
new_sqlite_classes = ["LiveDesk"]
```

- [ ] **Step 4: worker/tsconfig.json** and root exclusion

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "noEmit": true, "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src", "lib", "../src/core/**/*.ts"]
}
```

Root `tsconfig.json`: add `"worker"` to `exclude` (alongside existing entries) so `tsc -b` for the web app ignores Worker globals. Add scripts to `package.json`:

```json
"typecheck:worker": "tsc -p worker --noEmit",
"deploy:worker": "wrangler deploy -c worker/wrangler.toml"
```

- [ ] **Step 5: worker/src/index.ts — cron: scrape -> KV + D1 write-through -> tick desk**

```ts
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

async function fetchReport(reportTypeId: number): Promise<Uint8Array> {
  const list = await (await fetch(MIS_LIST + reportTypeId)).json();
  const docId = latestDocId(list);
  return new Uint8Array(await (await fetch(MIS_DL + docId)).arrayBuffer());
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

  async fetch(): Promise<Response> {
    return new Response('fluxcore-desk: cron + DO host', { status: 200 });
  },
};
```

- [ ] **Step 6: worker/src/livedesk.ts — the always-on trader**

```ts
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
        homesOnline: HOMES,
        recent: l.recent.slice(-25),
      })),
    });
  }
}
```

**Known judgment call:** pnl is carried as a separately persisted number (ledger only holds the recent tail across wakes); full dispatch history lives in D1. Threshold's rolling window and LP's hourly plan rebuild from KV `history` each wake — both strategies are stateless-by-construction over `MarketContext`, so this is correct, not approximate.

- [ ] **Step 7: Typecheck + deploy + verify**

```bash
npm run typecheck:worker
npm run deploy:worker
# trigger one cron immediately to seed data:
wrangler tail fluxcore-desk --format pretty &   # watch
curl -s "https://fluxcore-desk.<account-subdomain>.workers.dev/" # liveness only
# wait for the next */5 boundary, then confirm:
wrangler kv key get "prices:HB_NORTH:rtm" --namespace-id <KV_ID> --remote | head -c 300
wrangler d1 execute fluxcore --remote --command "SELECT COUNT(*) FROM price_points"
```

Expected: KV holds a JSON array of PricePoints; D1 count > 0.

- [ ] **Step 8: Commit**

```bash
git add worker package.json tsconfig.json && git commit -m "feat: fluxcore-desk worker - cron ingest, D1 archive, LiveDesk durable object"
```

---

### Task 6: Pages Functions API + bindings

**Files:**
- Create: root `wrangler.toml` (Pages config), `functions/api/prices/live.ts`, `functions/api/desk.ts`, `functions/tsconfig.json`

- [ ] **Step 1: Root wrangler.toml** (Pages project config; substitute real ids)

```toml
name = "fluxcore"
pages_build_output_dir = "dist"
compatibility_date = "2026-06-01"

[[kv_namespaces]]
binding = "FLUX_KV"
id = "<KV_ID>"

[[d1_databases]]
binding = "FLUX_DB"
database_name = "fluxcore"
database_id = "<D1_ID>"

[durable_objects]
bindings = [{ name = "LIVE_DESK", class_name = "LiveDesk", script_name = "fluxcore-desk" }]
```

- [ ] **Step 2: functions/api/prices/live.ts**

```ts
import type { PricePoint } from '../../../src/core/types';

interface Env {
  FLUX_KV: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const hub = new URL(request.url).searchParams.get('hub') ?? 'HB_NORTH';
  if (!/^HB_[A-Z]+$/.test(hub)) return new Response('bad hub', { status: 400 });
  const [rtm, dam] = await Promise.all([
    env.FLUX_KV.getWithMetadata<PricePoint[], { lastUpdated: number }>(`prices:${hub}:rtm`, 'json'),
    env.FLUX_KV.get<PricePoint[]>(`prices:${hub}:dam`, 'json'),
  ]);
  return Response.json(
    {
      hub,
      rtm: rtm.value ?? [],
      dam: dam ?? [],
      lastUpdated: rtm.metadata?.lastUpdated ?? null,
    },
    { headers: { 'cache-control': 'public, max-age=60' } },
  );
};
```

- [ ] **Step 3: functions/api/desk.ts**

```ts
interface Env {
  LIVE_DESK: DurableObjectNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const hub = new URL(request.url).searchParams.get('hub') ?? 'HB_NORTH';
  if (!/^HB_[A-Z]+$/.test(hub)) return new Response('bad hub', { status: 400 });
  const stub = env.LIVE_DESK.get(env.LIVE_DESK.idFromName(hub));
  const res = await stub.fetch('https://desk/state');
  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' },
  });
};
```

- [ ] **Step 4: functions/tsconfig.json** (same shape as worker/tsconfig.json, include `["**/*.ts", "../src/core/types.ts"]`); add `"functions"` to root tsconfig `exclude`; extend `typecheck:worker` script or add `typecheck:functions`. Wire both into the CI test job after `npm run typecheck`.

- [ ] **Step 5: Deploy + verify same-origin API**

```bash
npm run build && wrangler pages deploy dist --project-name=fluxcore
curl -s 'https://fluxcore-30a.pages.dev/api/prices/live' | head -c 300
curl -s 'https://fluxcore-30a.pages.dev/api/desk' | head -c 300
```

Expected: JSON from both; `lastUpdated` non-null once the cron has fired at least once.

- [ ] **Step 6: Commit**

```bash
git add wrangler.toml functions tsconfig.json package.json .github && git commit -m "feat: same-origin pages functions api over kv and live desk bindings"
```

---

### Task 7: Frontend LIVE mode

**Files:**
- Create: `src/ui/useLiveDesk.ts`, `src/ui/LiveView.tsx`
- Modify: `src/ui/App.tsx` (mode switch), `src/ui/components/ControlBar.tsx` (LIVE entry), `src/ui/styles.css` (live badge)
- Test: `src/ui/__tests__/live.test.tsx`

- [ ] **Step 1: Failing component test**

```tsx
// src/ui/__tests__/live.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LiveBadge } from '../LiveView';

describe('LiveBadge', () => {
  it('shows LIVE when fresh', () => {
    render(<LiveBadge lastUpdated={Date.now() - 60_000} />);
    expect(screen.getByText('LIVE')).toBeTruthy();
  });
  it('shows STALE when the feed is older than 20 minutes', () => {
    render(<LiveBadge lastUpdated={Date.now() - 21 * 60_000} />);
    expect(screen.getByText(/STALE/)).toBeTruthy();
  });
  it('shows CONNECTING with no data', () => {
    render(<LiveBadge lastUpdated={null} />);
    expect(screen.getByText(/CONNECTING/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify fails (LiveView missing)**

```bash
npx vitest run src/ui/__tests__/live.test.tsx 2>&1 | FORCE_COLOR=1 tee docs/tdd/logs/23-live-red.txt
```

- [ ] **Step 3: Implement hook + view**

```ts
// src/ui/useLiveDesk.ts
import { useEffect, useState } from 'react';
import type { PricePoint } from '../core/types';
import type { LedgerEntry } from '../core/ledger';

export interface LiveLane {
  name: string;
  pnl: number;
  socKWh: number;
  capacityKWh: number;
  homesOnline: number;
  recent: LedgerEntry[];
}
export interface LiveState {
  rtm: PricePoint[];
  dam: PricePoint[];
  lastUpdated: number | null;
  startedAt: number | null;
  lanes: LiveLane[];
}

const POLL_MS = 30_000;

export function useLiveDesk(enabled: boolean): LiveState | null {
  const [state, setState] = useState<LiveState | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    async function poll() {
      try {
        const [prices, desk] = await Promise.all([
          fetch('/api/prices/live').then((r) => r.json()),
          fetch('/api/desk').then((r) => r.json()),
        ]);
        if (stop) return;
        setState({
          rtm: prices.rtm ?? [],
          dam: prices.dam ?? [],
          lastUpdated: prices.lastUpdated ?? null,
          startedAt: desk.startedAt ?? null,
          lanes: desk.lanes ?? [],
        });
      } catch {
        /* keep last good state; badge handles staleness */
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { stop = true; clearInterval(id); };
  }, [enabled]);
  return state;
}
```

```tsx
// src/ui/LiveView.tsx
import type { LiveState } from './useLiveDesk';
import { PriceChart } from './components/PriceChart';
import { PnlStrip } from './components/PnlStrip';
import { DecisionLog } from './components/DecisionLog';

const STALE_MS = 20 * 60_000;

export function LiveBadge({ lastUpdated }: { lastUpdated: number | null }) {
  if (lastUpdated === null) return <span className="live-badge connecting">CONNECTING...</span>;
  if (Date.now() - lastUpdated > STALE_MS) {
    const min = Math.round((Date.now() - lastUpdated) / 60_000);
    return <span className="live-badge stale">STALE ({min}m)</span>;
  }
  return <span className="live-badge on">LIVE</span>;
}

export function LiveView({ live }: { live: LiveState | null }) {
  if (!live) return <div className="card span-2">Connecting to the live desk...</div>;
  const pnls = Object.fromEntries(live.lanes.map((l) => [l.name, l.pnl]));
  const recent = live.lanes.flatMap((l) => l.recent).sort((a, b) => a.t - b.t).slice(-50);
  return (
    <>
      <div className="card span-2">
        <h2>
          LIVE - ERCOT HB_NORTH - $/MWh <LiveBadge lastUpdated={live.lastUpdated} />
        </h2>
        <PriceChart points={live.rtm} markers={[]} epoch={0} />
      </div>
      <div className="card"><h2>Cumulative P&amp;L (since {live.startedAt ? new Date(live.startedAt).toLocaleDateString() : '...'})</h2>
        <PnlStrip pnls={pnls} />
      </div>
      <div className="card"><h2>Dispatch log</h2><DecisionLog entries={recent} /></div>
    </>
  );
}
```

**Note:** match `PriceChart`/`PnlStrip`/`DecisionLog` props to their actual signatures in `src/ui/components/` when wiring (read them first; the shapes above follow the existing usage in App.tsx). Add to `styles.css`:

```css
.live-badge { font-size: 10px; padding: 2px 8px; border-radius: 10px; margin-left: 8px; vertical-align: middle; }
.live-badge.on { background: var(--green); color: var(--bg); animation: pulse 2s infinite; }
.live-badge.stale { background: var(--orange); color: var(--bg); }
.live-badge.connecting { background: var(--surface-2); color: var(--dim); }
@keyframes pulse { 50% { opacity: 0.6; } }
```

In `App.tsx`: scenario select gains a first option `value="live"` labeled `Live - ERCOT HB_NORTH`; when selected, render `<LiveView live={useLiveDesk(mode === 'live')} />` instead of the replay layout (hooks called unconditionally at top level, mode chosen by state).

- [ ] **Step 4: Run green + full suite**

```bash
npx vitest run src/ui/__tests__/live.test.tsx 2>&1 | FORCE_COLOR=1 tee docs/tdd/logs/23-live-green.txt
npm test && npm run lint && npm run typecheck
```

- [ ] **Step 5: Visual check (playwright against preview), commit**

```bash
npm run build && node /tmp/shot.mjs   # replay mode unchanged
git add src/ui docs/tdd/logs && git commit -m "feat: live mode - desk polling hook, live view, freshness badge"
```

---

### Task 8: CI deploys the worker; ship it all

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Extend the test job** — after `npm run typecheck` add:

```yaml
      - run: npm run typecheck:worker
```

- [ ] **Step 2: Extend the deploy job** — after the pages deploy step add:

```yaml
      - uses: cloudflare/wrangler-action@9acf94ace14e7dc412b076f2c5c20b8ce93c79cd # v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy -c worker/wrangler.toml
```

**Note:** the API token needs Workers Scripts:Edit + D1:Edit + Workers KV:Edit in addition to Pages:Edit. If the current token is Pages-only, deploy the worker manually (`npm run deploy:worker`) until the token is upgraded, and say so in the session.

- [ ] **Step 3: Push and verify the full pipeline**

```bash
git add .github && git commit -m "ci: typecheck and deploy fluxcore-desk worker"
git push
gh run watch --repo melonmelonz/fluxcore --exit-status
curl -s 'https://fluxcore-30a.pages.dev/api/desk' | head -c 400
```

Expected: green run; `/api/desk` returns `live: true` with two lanes once the cron has fired and the desk has ticked at least once.

---

## Self-Review Notes

- **Spec coverage (Phase A):** MIS scrape (T1-2), KV cache + merge (T3, T5), D1 write-through self-growing capture (T5 schema + persist), LiveDesk DO (T5), same-origin API (T6), frontend LIVE mode + stale badge (T7), CI (T8). Nightly D1->archive compaction is Phase B scope (it serves the backtest lab).
- **Type consistency:** `DeskLane` matches controller's lane shape exactly (verified against current source); `Fleet.state()/restore()`, `Battery.restore()` and `seasonForMonth` are defined in T4 before first use in T5; `LedgerEntry` import paths verified.
- **Known judgment calls:** DO pnl persisted as a number with only a ledger tail (full history in D1); DAM refresh every 3h rather than tracking publication time; single hub (HB_NORTH) hardcoded for Phase A, parameterization arrives with multi-hub in Phase B/C.
- **Fixture-first honesty:** column names in T2 come from gridstatus's documented formats; T1 Step 1 prints the real headers and instructs adjusting the parser if they differ.
