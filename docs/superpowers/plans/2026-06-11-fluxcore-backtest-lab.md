# fluxcore Backtest Lab (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Client-side backtest lab over a chunked historical ERCOT archive, with a perfect-hindsight oracle benchmark scoring every strategy as % of theoretical max.

**Architecture:** A Python script slices the cached annual gridstatus pickles into per-month static JSON chunks for 4 ERCOT hubs (2023–2024). The core engine gains two pure modules: `oracle.ts` (per-day perfect-hindsight LP with SoC carryover and curtailable free solar — a true upper bound on the simulator) and `backtest.ts` (a steppable max-speed runner over the existing `deskTick`). The UI gains a Lab view (hub + date range + run + results table) reachable via a header tab and shareable URL hash; backtests run chunked on the main thread with a progress bar.

**Tech Stack:** existing stack only — TypeScript, React, vitest, javascript-lp-solver, pandas (ingest).

---

## File structure

- `scripts/ingest/build_archive.py` — NEW: pickles → monthly chunks + archive index
- `public/data/archive/index.json` + `public/data/archive/{hub}/{YYYY-MM}.json` — generated data
- `src/core/oracle.ts` — NEW: `oraclePnl()` perfect-hindsight benchmark
- `src/core/backtest.ts` — NEW: `Backtest` steppable runner + results
- `src/core/__tests__/oracle.test.ts`, `src/core/__tests__/backtest.test.ts`
- `src/ui/lab/range.ts` — NEW: month/epoch range helpers (pure)
- `src/ui/lab/share.ts` — NEW: URL hash codec (pure)
- `src/ui/lab/useLab.ts` — NEW: archive fetch + chunked run hook
- `src/ui/lab/LabView.tsx` — NEW: lab page
- `src/ui/__tests__/lab.test.ts` — range + share tests
- `src/ui/App.tsx` — Desk/Lab tabs + hash routing
- `src/ui/styles.css` — tab + results styles

---

### Task 1: Archive ingest script + generated data

**Files:**
- Create: `scripts/ingest/build_archive.py`
- Generate: `public/data/archive/index.json`, `public/data/archive/{HB_NORTH,HB_HOUSTON,HB_WEST,HB_SOUTH}/{2023-01..2024-12}.json`

No TDD (generated data + one-shot script, consistent with `fetch_ercot.py`); verified by a node sanity check.

- [ ] **Step 1: Write the script**

```python
#!/usr/bin/env python3
"""Build monthly archive chunks from cached annual ERCOT SPP frames.

Output: public/data/archive/{hub}/{YYYY-MM}.json with the same PricePoint
schema the app already uses ({t: epoch-ms, price: $/MWh}), plus an index.
Annual frames are cached as pickles in /tmp (downloaded once if missing).
"""
import json
import pathlib

import pandas as pd

OUT = pathlib.Path(__file__).resolve().parents[2] / "public" / "data" / "archive"
CACHE = pathlib.Path("/tmp")
HUBS = ["HB_NORTH", "HB_HOUSTON", "HB_WEST", "HB_SOUTH"]
YEARS = [2023, 2024]


def annual(market: str, year: int) -> pd.DataFrame:
    path = CACHE / f"ercot_{market}_{year}.pkl"
    if path.exists():
        return pd.read_pickle(path)
    import gridstatus
    iso = gridstatus.Ercot()
    df = iso.get_rtm_spp(year) if market == "rtm" else iso.get_dam_spp(year)
    df.to_pickle(path)
    return df


def points(df: pd.DataFrame) -> list:
    return sorted(
        ({"t": int(ts.timestamp() * 1000), "price": round(float(p), 2)}
         for ts, p in zip(df["Interval Start"], df["SPP"])),
        key=lambda p: p["t"],
    )


def main():
    months = set()
    for year in YEARS:
        rtm = annual("rtm", year)
        dam = annual("dam", year)
        for hub in HUBS:
            hub_rtm = rtm[rtm["Location"] == hub].copy()
            hub_dam = dam[dam["Location"] == hub].copy()
            hub_rtm["month"] = hub_rtm["Interval Start"].dt.strftime("%Y-%m")
            hub_dam["month"] = hub_dam["Interval Start"].dt.strftime("%Y-%m")
            out_dir = OUT / hub
            out_dir.mkdir(parents=True, exist_ok=True)
            for month, r in hub_rtm.groupby("month"):
                d = hub_dam[hub_dam["month"] == month]
                chunk = {"hub": hub, "month": month,
                         "rtm": points(r), "dam": points(d)}
                (out_dir / f"{month}.json").write_text(
                    json.dumps(chunk, separators=(",", ":")))
                months.add(month)
                print(f"{hub} {month}: rtm={len(chunk['rtm'])} dam={len(chunk['dam'])}")
    (OUT / "index.json").write_text(json.dumps(
        {"hubs": HUBS, "months": sorted(months)}, separators=(",", ":")))


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `python3 scripts/ingest/build_archive.py`
Expected: per-line counts, rtm≈2700–2980/month, dam≈700–750/month, 96 chunk files + index.json.

- [ ] **Step 3: Sanity-check from node**

Run:
```bash
node -e "
const c = require('./public/data/archive/HB_NORTH/2023-08.json');
const aligned = c.rtm.every(p => p.t % (15*60000) === 0);
console.log(c.rtm.length, c.dam.length, 'aligned:', aligned);
const idx = require('./public/data/archive/index.json');
console.log(idx.hubs.length, 'hubs,', idx.months.length, 'months');
"
```
Expected: ~2976 rtm, ~744 dam, `aligned: true`, `4 hubs, 24 months`.

- [ ] **Step 4: Commit**

```bash
git add scripts/ingest/build_archive.py public/data/archive
git commit -m "feat: monthly historical archive chunks for 4 ERCOT hubs (2023-2024)"
```

---

### Task 2: Oracle benchmark (TDD)

**Files:**
- Create: `src/core/oracle.ts`
- Test: `src/core/__tests__/oracle.test.ts`

The oracle is a perfect-hindsight LP that sees actual RT prices. Solved one Central day at a time (H≤96, trivial for the solver) with SoC carried across days — batteries cycle daily, so day-chunking is a tight bound. Solar enters as a *free, curtailable* charge variable, which dominates the simulator's forced solar, so the oracle stays a true upper bound on anything `deskTick` can book.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { oraclePnl, type OracleFleetSpec } from '../oracle';

const NIGHT = Date.UTC(2024, 0, 15, 6, 0); // 00:00 Central — no solar all day in winter test windows below

const SPEC: OracleFleetSpec = {
  capacityKWh: 1000,
  maxChargeKW: 1000,
  maxDischargeKW: 1000,
  roundTripEfficiency: 1,
  degradationCostPerMWh: 0,
  solarPeakKW: 0,
};

describe('oraclePnl', () => {
  it('captures a perfect two-interval spread exactly', () => {
    const rtm = [
      { t: NIGHT, price: 10 },
      { t: NIGHT + 3_600_000, price: 1000 },
    ];
    // charge 1 MWh @ $10, discharge 1 MWh @ $1000
    expect(oraclePnl(rtm, SPEC, 'winter', 60)).toBeCloseTo(990, 6);
  });

  it('holds when the spread cannot clear efficiency + degradation', () => {
    const rtm = [
      { t: NIGHT, price: 100 },
      { t: NIGHT + 3_600_000, price: 200 },
    ];
    const spec = { ...SPEC, roundTripEfficiency: 0.5, degradationCostPerMWh: 20 };
    expect(oraclePnl(rtm, spec, 'winter', 60)).toBeCloseTo(0, 6);
  });

  it('returns zero on flat prices with no solar', () => {
    const rtm = Array.from({ length: 96 }, (_, i) => ({ t: NIGHT + i * 900_000, price: 50 }));
    const spec = { ...SPEC, roundTripEfficiency: 0.86, degradationCostPerMWh: 20 };
    expect(oraclePnl(rtm, spec, 'winter', 15)).toBeCloseTo(0, 6);
  });

  it('monetizes free solar even on flat prices', () => {
    const noon = Date.UTC(2023, 7, 20, 18, 0); // 12:00 Central, summer
    const rtm = [
      { t: noon, price: 100 },
      { t: noon + 3_600_000, price: 100 },
    ];
    const spec = { ...SPEC, roundTripEfficiency: 1, degradationCostPerMWh: 20, solarPeakKW: 1000 };
    expect(oraclePnl(rtm, spec, 'summer', 60)).toBeGreaterThan(0);
  });

  it('carries SoC across day boundaries', () => {
    // cheap last interval of day 1, expensive first interval of day 2
    const lastOfDay = Date.UTC(2024, 0, 15, 5, 0); // 23:00 Central Jan 14
    const rtm = [
      { t: lastOfDay, price: 5 },
      { t: lastOfDay + 3_600_000, price: 500 },
    ];
    expect(oraclePnl(rtm, SPEC, 'winter', 60)).toBeCloseTo(495, 6);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/core/__tests__/oracle.test.ts`
Expected: FAIL — module `../oracle` not found.

- [ ] **Step 3: Implement**

```typescript
import solver from 'javascript-lp-solver';
import { hourOfDayCentral } from './desk';
import { solarOutputKW } from './solar';
import type { PricePoint, Season } from './types';

const HOUR_MS = 3_600_000;
const CENTRAL_OFFSET_HOURS = 6;

export interface OracleFleetSpec {
  /** fleet totals */
  capacityKWh: number;
  maxChargeKW: number;
  maxDischargeKW: number;
  roundTripEfficiency: number;
  degradationCostPerMWh: number;
  /** fleet-total solar peak kW; 0 disables solar */
  solarPeakKW: number;
}

/**
 * Perfect-hindsight upper bound: an LP that sees actual RT prices, solved
 * one Central day at a time with SoC carried across days. Solar enters as a
 * free curtailable charge source, dominating the simulator's forced solar,
 * so the result is a true upper bound on any strategy's bookable P&L.
 */
export function oraclePnl(
  rtm: PricePoint[],
  spec: OracleFleetSpec,
  season: Season,
  intervalMinutes: number,
): number {
  const days = new Map<number, PricePoint[]>();
  for (const p of rtm) {
    const day = Math.floor(p.t / HOUR_MS / 24 - CENTRAL_OFFSET_HOURS / 24);
    const arr = days.get(day);
    if (arr) arr.push(p);
    else days.set(day, [p]);
  }
  let soc = 0;
  let pnl = 0;
  for (const key of [...days.keys()].sort((a, b) => a - b)) {
    const r = solveDay(days.get(key)!, soc, spec, season, intervalMinutes);
    pnl += r.pnl;
    soc = r.socEnd;
  }
  return pnl;
}

function solveDay(
  points: PricePoint[],
  soc0KWh: number,
  spec: OracleFleetSpec,
  season: Season,
  intervalMinutes: number,
): { pnl: number; socEnd: number } {
  const dt = intervalMinutes / 60;
  const H = points.length;
  const eff = spec.roundTripEfficiency;
  const capMWh = spec.capacityKWh / 1000;
  const soc0 = soc0KWh / 1000;
  const cMaxMW = spec.maxChargeKW / 1000;
  const dMaxMW = spec.maxDischargeKW / 1000;

  const constraints: Record<string, { max?: number; min?: number }> = {};
  const variables: Record<string, Record<string, number>> = {};

  for (let i = 0; i < H; i++) {
    const price = points[i].price;
    const solarMW = spec.solarPeakKW > 0
      ? Math.min(solarOutputKW(spec.solarPeakKW, hourOfDayCentral(points[i].t), season), spec.maxChargeKW) / 1000
      : 0;
    constraints[`c${i}`] = { max: cMaxMW };
    constraints[`d${i}`] = { max: dMaxMW };
    variables[`c${i}`] = { profit: -price * dt, [`c${i}`]: 1 };
    variables[`d${i}`] = { profit: (price - spec.degradationCostPerMWh) * dt, [`d${i}`]: 1 };
    if (solarMW > 0) {
      constraints[`g${i}`] = { max: solarMW };
      variables[`g${i}`] = { profit: 0, [`g${i}`]: 1 };
    }
    for (let k = i; k < H; k++) {
      variables[`c${i}`][`soc${k}`] = eff * dt;
      variables[`d${i}`][`soc${k}`] = -dt;
      if (solarMW > 0) variables[`g${i}`][`soc${k}`] = eff * dt;
    }
  }
  for (let k = 0; k < H; k++) {
    constraints[`soc${k}`] = { max: capMWh - soc0, min: -soc0 };
  }

  const out = solver.Solve({ optimize: 'profit', opType: 'max', constraints, variables });
  if (out.feasible === false) return { pnl: 0, socEnd: soc0KWh };
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  let delta = 0; // MWh
  for (let i = 0; i < H; i++) {
    delta += eff * dt * num(out[`c${i}`]) - dt * num(out[`d${i}`]) + eff * dt * num(out[`g${i}`]);
  }
  return { pnl: num(out.result), socEnd: Math.max(0, Math.min((soc0 + delta) * 1000, spec.capacityKWh)) };
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run src/core/__tests__/oracle.test.ts`, all 5 pass. Capture red/green via tee to `docs/tdd/logs/25-oracle-{red,green}.txt`.

- [ ] **Step 5: Commit**

```bash
git add src/core/oracle.ts src/core/__tests__/oracle.test.ts docs/tdd/logs/25-oracle-*.txt
git commit -m "feat: perfect-hindsight oracle benchmark (per-day LP, SoC carryover, curtailable solar)"
```

---

### Task 3: Backtest runner (TDD)

**Files:**
- Create: `src/core/backtest.ts`
- Test: `src/core/__tests__/backtest.test.ts`

A steppable max-speed runner so the UI can chunk work across frames. Owns `DeskLane[]` directly (unlike `SimulationController`, which hides ledgers behind snapshots).

- [ ] **Step 1: Write the failing tests**

```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Backtest } from '../backtest';
import { Fleet } from '../fleet';
import { LPStrategy } from '../lp';
import { oraclePnl } from '../oracle';
import { parseScenario } from '../scenario';
import { ThresholdStrategy } from '../threshold';

const HOME = {
  battery: {
    capacityKWh: 13.5, maxChargeKW: 5, maxDischargeKW: 5,
    roundTripEfficiency: 0.86, degradationCostPerMWh: 20,
  },
  solarPeakKW: 5,
};

function heatwave() {
  return parseScenario(JSON.parse(
    readFileSync(resolve(process.cwd(), 'public/data/heatwave-2023.json'), 'utf8'),
  ));
}

function run(scenario = heatwave()) {
  const bt = new Backtest(scenario, () => Fleet.uniform(200, HOME, scenario.season), [
    new ThresholdStrategy(),
    new LPStrategy(),
  ]);
  while (!bt.step(500)) { /* run to completion */ }
  return bt;
}

describe('Backtest', () => {
  it('reproduces the known deterministic heatwave P&L', () => {
    const results = run().results();
    const byName = Object.fromEntries(results.map((r) => [r.name, r]));
    expect(byName['threshold'].pnl).toBeCloseTo(22116.69, 2);
    expect(byName['lp-optimizer'].pnl).toBeCloseTo(17516.79, 2);
  });

  it('reports energy and dispatch counts', () => {
    for (const r of run().results()) {
      expect(r.mwhDischarged).toBeGreaterThan(0);
      expect(r.dispatches).toBeGreaterThan(0);
    }
  });

  it('tracks progress and completion', () => {
    const s = heatwave();
    const bt = new Backtest(s, () => Fleet.uniform(200, HOME, s.season), [new ThresholdStrategy()]);
    expect(bt.progress).toBe(0);
    bt.step(10);
    expect(bt.progress).toBeGreaterThan(0);
    expect(bt.progress).toBeLessThan(1);
    while (!bt.step(500)) { /* drain */ }
    expect(bt.progress).toBe(1);
  });

  it('never beats the oracle', () => {
    const s = heatwave();
    const oracle = oraclePnl(s.rtm, {
      capacityKWh: 200 * 13.5, maxChargeKW: 200 * 5, maxDischargeKW: 200 * 5,
      roundTripEfficiency: 0.86, degradationCostPerMWh: 20, solarPeakKW: 200 * 5,
    }, s.season, s.intervalMinutes);
    for (const r of run(s).results()) {
      expect(oracle).toBeGreaterThanOrEqual(r.pnl);
    }
  });
});
```

- [ ] **Step 2: Verify failure** — `npx vitest run src/core/__tests__/backtest.test.ts` → module not found.

- [ ] **Step 3: Implement**

```typescript
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
```

- [ ] **Step 4: Verify pass**, full suite green, capture `docs/tdd/logs/26-backtest-{red,green}.txt`.

- [ ] **Step 5: Commit** — `git commit -m "feat: steppable max-speed backtest runner with oracle bound test"`

---

### Task 4: Lab range + share-URL helpers (TDD)

**Files:**
- Create: `src/ui/lab/range.ts`, `src/ui/lab/share.ts`
- Test: `src/ui/__tests__/lab.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { monthsInRange, rangeMs } from '../lab/range';
import { decodeLab, encodeLab } from '../lab/share';

describe('monthsInRange', () => {
  it('covers a single month', () => {
    expect(monthsInRange('2023-08-14', '2023-08-21')).toEqual(['2023-08']);
  });
  it('spans months and years', () => {
    expect(monthsInRange('2023-12-20', '2024-02-03'))
      .toEqual(['2023-12', '2024-01', '2024-02']);
  });
});

describe('rangeMs', () => {
  it('maps ISO dates to Central midnights (fixed UTC-6), end exclusive', () => {
    const { lo, hi } = rangeMs('2023-08-14', '2023-08-21');
    expect(lo).toBe(Date.UTC(2023, 7, 14, 6));
    expect(hi).toBe(Date.UTC(2023, 7, 21, 6));
  });
});

describe('lab share codec', () => {
  it('round-trips params through the hash', () => {
    const p = { hub: 'HB_WEST', start: '2024-01-14', end: '2024-01-21' };
    expect(decodeLab(encodeLab(p))).toEqual(p);
  });
  it('rejects garbage', () => {
    expect(decodeLab('')).toBeNull();
    expect(decodeLab('#foo')).toBeNull();
    expect(decodeLab('#lab?hub=<script>&start=2024-01-01&end=2024-01-02')).toBeNull();
    expect(decodeLab('#lab?hub=HB_NORTH&start=nope&end=2024-01-02')).toBeNull();
  });
});
```

- [ ] **Step 2: Verify failure** (modules not found).

- [ ] **Step 3: Implement `range.ts`**

```typescript
const HOUR_MS = 3_600_000;
const CENTRAL_OFFSET_MS = 6 * HOUR_MS; // fixed UTC-6, matches engine

/** Months ('YYYY-MM') whose chunks cover [start, end], inclusive. */
export function monthsInRange(startISO: string, endISO: string): string[] {
  const [sy, sm] = startISO.split('-').map(Number);
  const [ey, em] = endISO.split('-').map(Number);
  const out: string[] = [];
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? (y++, m = 1) : m++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  return out;
}

/** [lo, hi) epoch-ms window: Central midnight of start to Central midnight of end. */
export function rangeMs(startISO: string, endISO: string): { lo: number; hi: number } {
  const ms = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d) + CENTRAL_OFFSET_MS;
  };
  return { lo: ms(startISO), hi: ms(endISO) };
}
```

- [ ] **Step 4: Implement `share.ts`**

```typescript
export interface LabParams {
  hub: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

const HUB_RE = /^HB_[A-Z]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function encodeLab(p: LabParams): string {
  const q = new URLSearchParams({ hub: p.hub, start: p.start, end: p.end });
  return `#lab?${q.toString()}`;
}

export function decodeLab(hash: string): LabParams | null {
  if (!hash.startsWith('#lab?')) return null;
  const q = new URLSearchParams(hash.slice('#lab?'.length));
  const hub = q.get('hub') ?? '';
  const start = q.get('start') ?? '';
  const end = q.get('end') ?? '';
  if (!HUB_RE.test(hub) || !DATE_RE.test(start) || !DATE_RE.test(end) || start >= end) return null;
  return { hub, start, end };
}
```

- [ ] **Step 5: Verify pass**, capture `docs/tdd/logs/27-lab-helpers-{red,green}.txt`, commit.

```bash
git add src/ui/lab/range.ts src/ui/lab/share.ts src/ui/__tests__/lab.test.ts docs/tdd/logs/27-*
git commit -m "feat: lab date-range helpers and shareable URL codec"
```

---

### Task 5: useLab hook + LabView + App tabs

**Files:**
- Create: `src/ui/lab/useLab.ts`, `src/ui/lab/LabView.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/styles.css`

Pure logic was TDD'd in Tasks 2–4; this task is wiring + presentation, verified by typecheck/lint/build plus a production screenshot in Task 6.

- [ ] **Step 1: `useLab.ts`**

```typescript
import { useEffect, useRef, useState } from 'react';
import { Backtest, type BacktestResult } from '../../core/backtest';
import { Fleet } from '../../core/fleet';
import { LPStrategy } from '../../core/lp';
import { oraclePnl } from '../../core/oracle';
import { seasonForMonth } from '../../core/solar';
import { ThresholdStrategy } from '../../core/threshold';
import type { PricePoint, Scenario } from '../../core/types';
import { monthsInRange, rangeMs } from './range';
import type { LabParams } from './share';

export interface ArchiveIndex { hubs: string[]; months: string[] }
export interface LabRun {
  params: LabParams;
  results: BacktestResult[];
  oracle: number;
  points: number;
}

const HOME = {
  battery: {
    capacityKWh: 13.5, maxChargeKW: 5, maxDischargeKW: 5,
    roundTripEfficiency: 0.86, degradationCostPerMWh: 20,
  },
  solarPeakKW: 5,
};
const HOMES = 200;

async function loadRange(params: LabParams): Promise<{ rtm: PricePoint[]; dam: PricePoint[] }> {
  const months = monthsInRange(params.start, params.end);
  const chunks = await Promise.all(months.map(async (m) => {
    const r = await fetch(`/data/archive/${params.hub}/${m}.json`);
    if (!r.ok) throw new Error(`no archive for ${params.hub} ${m}`);
    return r.json() as Promise<{ rtm: PricePoint[]; dam: PricePoint[] }>;
  }));
  const { lo, hi } = rangeMs(params.start, params.end);
  const inWin = (p: PricePoint) => p.t >= lo && p.t < hi;
  return {
    rtm: chunks.flatMap((c) => c.rtm).filter(inWin),
    dam: chunks.flatMap((c) => c.dam).filter(inWin),
  };
}

export function useLab() {
  const [index, setIndex] = useState<ArchiveIndex | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [run, setRun] = useState<LabRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    fetch('/data/archive/index.json')
      .then((r) => r.json())
      .then(setIndex)
      .catch(() => setError('failed to load archive index'));
  }, []);

  async function start(params: LabParams) {
    const id = ++seq.current;
    setRunning(true);
    setError(null);
    setRun(null);
    setProgress(0);
    try {
      const { rtm, dam } = await loadRange(params);
      if (rtm.length === 0) throw new Error('no data in that window');
      const season = seasonForMonth(Number(params.start.slice(5, 7)));
      const scenario: Scenario = {
        id: 'lab', name: 'lab', description: '', season, intervalMinutes: 15, rtm, dam,
      };
      const bt = new Backtest(scenario, () => Fleet.uniform(HOMES, HOME, season), [
        new ThresholdStrategy(),
        new LPStrategy(),
      ]);
      while (!bt.step(192)) {
        if (seq.current !== id) return; // superseded
        setProgress(bt.progress);
        await new Promise((r) => setTimeout(r, 0)); // yield to the UI
      }
      const oracle = oraclePnl(rtm, {
        capacityKWh: HOMES * HOME.battery.capacityKWh,
        maxChargeKW: HOMES * HOME.battery.maxChargeKW,
        maxDischargeKW: HOMES * HOME.battery.maxDischargeKW,
        roundTripEfficiency: HOME.battery.roundTripEfficiency,
        degradationCostPerMWh: HOME.battery.degradationCostPerMWh,
        solarPeakKW: HOMES * HOME.solarPeakKW,
      }, season, 15);
      if (seq.current !== id) return;
      setRun({ params, results: bt.results(), oracle, points: rtm.length });
    } catch (e) {
      if (seq.current === id) setError(e instanceof Error ? e.message : 'backtest failed');
    } finally {
      if (seq.current === id) { setRunning(false); setProgress(1); }
    }
  }

  return { index, running, progress, run, error, start };
}
```

- [ ] **Step 2: `LabView.tsx`**

```tsx
import { useState } from 'react';
import { encodeLab, type LabParams } from './share';
import { useLab } from './useLab';

const usd = (n: number) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LabView({ initial }: { initial: LabParams | null }) {
  const lab = useLab();
  const [hub, setHub] = useState(initial?.hub ?? 'HB_NORTH');
  const [start, setStart] = useState(initial?.start ?? '2023-08-14');
  const [end, setEnd] = useState(initial?.end ?? '2023-08-21');
  const [autoRan, setAutoRan] = useState(false);

  const months = lab.index?.months ?? [];
  const min = months.length ? `${months[0]}-01` : undefined;
  const max = months.length ? `${months[months.length - 1]}-28` : undefined;
  const params: LabParams = { hub, start, end };

  if (initial && lab.index && !autoRan) {
    setAutoRan(true);
    lab.start(initial);
  }

  return (
    <>
      <div className="card span-2">
        <h2>Backtest lab — ERCOT historical archive</h2>
        <div className="lab-form">
          <select aria-label="hub" value={hub} onChange={(e) => setHub(e.target.value)}>
            {(lab.index?.hubs ?? ['HB_NORTH']).map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <input aria-label="start" type="date" value={start} min={min} max={max}
            onChange={(e) => setStart(e.target.value)} />
          <input aria-label="end" type="date" value={end} min={min} max={max}
            onChange={(e) => setEnd(e.target.value)} />
          <button className="primary" disabled={lab.running || start >= end}
            onClick={() => { window.location.hash = encodeLab(params); lab.start(params); }}>
            {lab.running ? `Running ${Math.round(lab.progress * 100)}%` : 'Run backtest'}
          </button>
        </div>
        {lab.running && <div className="lab-progress"><div style={{ width: `${lab.progress * 100}%` }} /></div>}
        {lab.error && <p className="lab-error">{lab.error}</p>}
      </div>
      {lab.run && (
        <div className="card span-2">
          <h2>
            Results — {lab.run.params.hub} {lab.run.params.start} → {lab.run.params.end}
            <span className="lab-points">{lab.run.points.toLocaleString()} intervals</span>
          </h2>
          <table className="lab-table">
            <thead>
              <tr><th>strategy</th><th>P&amp;L</th><th>% of oracle</th><th>MWh out</th><th>dispatches</th><th>left on table</th></tr>
            </thead>
            <tbody>
              {lab.run.results.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className={r.pnl >= 0 ? 'pos' : 'neg'}>{usd(r.pnl)}</td>
                  <td>{lab.run!.oracle > 0 ? `${((r.pnl / lab.run!.oracle) * 100).toFixed(1)}%` : '—'}</td>
                  <td>{r.mwhDischarged.toFixed(1)}</td>
                  <td>{r.dispatches}</td>
                  <td className="neg">{usd(lab.run!.oracle - r.pnl)}</td>
                </tr>
              ))}
              <tr className="lab-oracle">
                <td>oracle (perfect hindsight)</td>
                <td className="pos">{usd(lab.run.oracle)}</td>
                <td>100%</td><td>—</td><td>—</td><td>$0.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: App tabs + hash routing** — in `App.tsx`: add `view` state `'desk' | 'lab'` initialized from `decodeLab(window.location.hash)`; tab buttons in the header; render `<LabView initial={initialLab} />` when `view === 'lab'` (ControlBar hidden in lab mode).

```tsx
// additions to App.tsx
import LabView from './lab/LabView';
import { decodeLab } from './lab/share';

// inside App():
const [initialLab] = useState(() => decodeLab(window.location.hash));
const [view, setView] = useState<'desk' | 'lab'>(initialLab ? 'lab' : 'desk');
```

Header gains:

```tsx
<nav className="tabs">
  <button aria-pressed={view === 'desk'} onClick={() => setView('desk')}>Desk</button>
  <button aria-pressed={view === 'lab'} onClick={() => setView('lab')}>Lab</button>
</nav>
```

Body becomes: `view === 'lab' ? <LabView initial={initialLab} /> : (existing live/replay block)`; ControlBar renders only when `view === 'desk'`.

- [ ] **Step 4: styles** — append to `styles.css`: `.tabs` (header-right button pair using existing button styles with `aria-pressed` highlight), `.lab-form` (flex row gap 8), `.lab-progress` (2px track + animated fill), `.lab-table` (existing table look: muted th, right-aligned numerics, `.pos`/`.neg` green/red, `.lab-oracle` row top-border), `.lab-points` (muted, float right), `.lab-error` (red).

- [ ] **Step 5: Verify** — `npm run typecheck && npm run lint && npx vitest run && npm run build` all green.

- [ ] **Step 6: Commit** — `git commit -m "feat: backtest lab UI with oracle benchmark and shareable URLs"`

---

### Task 6: Deploy + visual verification + README

- [ ] **Step 1: Deploy** — `npx wrangler pages deploy dist` (direct deploy; git push does not publish).
- [ ] **Step 2: Replay regression** — run `/tmp/shot.mjs`; expect heatwave $22,116.69 / $17,516.79 unchanged.
- [ ] **Step 3: Lab screenshot** — playwright script: open prod, click Lab tab, run default heatwave week, await results table, screenshot to `docs/tdd/shots/ui-lab.png`; verify % of oracle column populated and oracle row present.
- [ ] **Step 4: Share-link check** — open `https://<prod>/#lab?hub=HB_NORTH&start=2024-01-14&end=2024-01-21` fresh; expect auto-run + Winter Storm Heather results.
- [ ] **Step 5: README** — add Lab section (archive, oracle, share links) + new TDD log references; commit and push.

---

## Self-review notes

- Spec coverage: archive ingest (T1), lab UI with hub/date/strategies (T5), oracle in core TDD (T2), % of theoretical max + comparison table (T5), shareable URLs (T4/T5). Client-side only — no new API surface. ✓
- Oracle is an upper bound: optional solar dominates forced solar; day-chunked LP with SoC carryover; `never beats the oracle` test enforces the invariant on real data. ✓
- Types consistent: `BacktestResult` fields used by LabView match Task 3; `LabParams` shared between share.ts/useLab/LabView. ✓
- 2023–2024 only for now (cached pickles, zero download risk before the demo); `YEARS` in build_archive.py extends trivially.
