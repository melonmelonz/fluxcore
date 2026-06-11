# Diana's Feature Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land Diana's 2 large + 3 small features + brand chore (spec:
`docs/superpowers/specs/2026-06-11-fleet-designer-stress-and-polish-design.md`)
as six sequential branch-per-feature PRs before the 2026-06-12 demo.

**Architecture:** Pure tested logic in `src/core/` (units catalog, fleet
availability, Monte Carlo, wear math) and `src/ui/` helpers (storm, export,
mix storage); thin React components consume them. Touches to teammates'
files are additive-only. Every core/helper module is strict TDD with
red/green captures appended to `docs/tdd/logs/` (numbering continues at 29).

**Tech Stack:** TypeScript strict, Vitest + Testing Library, React 18,
existing `Backtest`/`deskTick` engine, no new dependencies.

---

## Workflow rules (apply to every feature)

- **Sequential PRs.** Branch from `main`, build, push, open PR, merge after
  CI green, then `git fetch origin; git checkout main; git reset --hard
  origin/main` before starting the next branch (safe: all work is pushed;
  this also stays correct if the repo squash-merges). The first PR (brand)
  carries the spec + plan docs commits already on local main.
- **PR creation:** `gh` CLI is not logged in. Run `gh auth status`; if it
  fails, Diana runs `! gh auth login` once. Fallback: push and open
  `https://github.com/melonmelonz/fluxcore/compare/main...<branch>` in the
  browser.
- **TDD capture convention:** for each red and green run, save terminal
  output, e.g.
  `npx vitest run <testfile> 2>&1 | Tee-Object -FilePath docs/tdd/logs/NN-<name>-red.txt`
  Commit captures with the feature.
- **Before every push:** `npm test` (full suite), `npm run typecheck`,
  `npm run lint` — all clean.
- Commit messages ASCII-only, conventional prefixes, no co-author trailers.

---

## Task 0: Preflight

- [ ] **Step 1:** `git fetch origin; git status` — confirm clean tree and local main = `origin/main` + 2 docs commits (spec, this plan).
- [ ] **Step 2:** `npm test` — expect 96 passing. `npm run typecheck; npm run lint` — clean.
- [ ] **Step 3:** `gh auth status` — if not authenticated, ask Diana to run `! gh auth login` (browser flow) before the first PR is needed.

---

## Feature 1 of 6: Brand assets (chore) — branch `diana/brand-assets`

**Files:**
- Replace: `public/brand/fluxcore-logo.webp` (or `.png` + reference update)
- Replace: `public/favicon.svg`
- Possibly modify: `README.md` (logo path/width only if format changes)

### Task 1.1: Branch

- [ ] **Step 1:** `git checkout -b diana/brand-assets`

### Task 1.2: Crop and commit the logo

Source image: `C:\Users\Diana\Downloads\ChatGPT Image Jun 11, 2026, 09_23_47 AM.png` (1536x1024; lockup occupies roughly x 240-1320, y 320-700).

- [ ] **Step 1:** Crop + downscale with System.Drawing (coordinates are a starting point — verify visually in Step 2 and adjust):

```powershell
Add-Type -AssemblyName System.Drawing
$srcPath = "C:\Users\Diana\Downloads\ChatGPT Image Jun 11, 2026, 09_23_47 AM.png"
$src = [System.Drawing.Image]::FromFile($srcPath)
$crop = New-Object System.Drawing.Rectangle(200, 300, 1180, 440)
$w = 720; $h = [int](440 * 720 / 1180)
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$dest = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$g.DrawImage($src, $dest, $crop, [System.Drawing.GraphicsUnit]::Pixel)
$bmp.Save("public\brand\fluxcore-logo-new.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $src.Dispose()
```

- [ ] **Step 2:** View `public/brand/fluxcore-logo-new.png` with the Read tool; adjust the crop rectangle until the lockup is centered with even padding and no clipped glow. Ask Diana to confirm.
- [ ] **Step 3:** Convert to webp if tooling exists: `Get-Command cwebp` — if found, `cwebp -q 90 public/brand/fluxcore-logo-new.png -o public/brand/fluxcore-logo.webp` and delete the temp png. If not found: `Grep` for `fluxcore-logo` (expect only `README.md`), rename temp to `public/brand/fluxcore-logo.png`, delete the old `.webp` via `git rm public/brand/fluxcore-logo.webp`, and update the README `<img src=...>` to the `.png` path.
- [ ] **Step 4:** Commit: `git commit -m "chore: new brand logo crop"`

### Task 1.3: Vector favicon (emblem only)

- [ ] **Step 1:** Overwrite `public/favicon.svg` with the redrawn emblem (iterate with Diana — she reviews in the browser via `npm run dev` tab icon or opening the file directly):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0B1320"/>
  <path d="M49 13.5 A24.5 24.5 0 1 0 57.5 32" fill="none" stroke="#2E86E0" stroke-width="5" stroke-linecap="round"/>
  <rect x="11" y="37" width="19" height="13" rx="1.5" fill="#1565C0"/>
  <path d="M17.3 37 v13 M23.7 37 v13 M11 41.3 h19 M11 45.7 h19" stroke="#0B1320" stroke-width="1.3"/>
  <rect x="36" y="27" width="15" height="23" rx="3" fill="#1E88E5"/>
  <rect x="40.5" y="23.5" width="6" height="4.5" rx="1" fill="#1E88E5"/>
  <path d="M45.5 31 l-7 10 h4.5 l-2.5 8 7.5 -11 h-4.5 z" fill="#4FC3F7"/>
  <polyline points="9,46 19,38 26,41 40,24" fill="none" stroke="#F5A623" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="19" cy="38" r="2.4" fill="#FFC04D"/>
  <circle cx="26" cy="41" r="2.4" fill="#FFC04D"/>
  <path d="M40 24 L52 12 M44 12 h8 v8" fill="none" stroke="#4FC3F7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 2:** `npm run build` — green (favicon is static; build proves nothing broke).
- [ ] **Step 3:** Diana approves the look (iterate on Step 1 as needed).
- [ ] **Step 4:** Commit: `git commit -m "chore: favicon redrawn as emblem-only vector"`

### Task 1.4: PR + merge

- [ ] **Step 1:** `npm test; npm run typecheck; npm run lint` — clean.
- [ ] **Step 2:** `git push -u origin diana/brand-assets`; open PR titled `chore: new brand assets (logo + emblem favicon)`; body notes the spec/plan docs ride in this PR.
- [ ] **Step 3:** After CI green, merge. Then `git fetch origin; git checkout main; git reset --hard origin/main`.

---

## Feature 2 of 6: Storm mode (small) — branch `diana/storm-mode`

**Files:**
- Create: `src/ui/storm.ts`, `src/ui/components/StormBadge.tsx`
- Test: `src/ui/__tests__/storm.test.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/LiveView.tsx`, `src/ui/components/PriceChart.tsx`, `src/ui/styles.css`
- Logs: `docs/tdd/logs/29-storm-red.txt`, `29-storm-green.txt`

### Task 2.1: Branch

- [ ] **Step 1:** `git checkout -b diana/storm-mode`

### Task 2.2: TDD the helper + badge

- [ ] **Step 1:** Write the failing test `src/ui/__tests__/storm.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StormBadge from '../components/StormBadge';
import { isStorm, STORM_PRICE } from '../storm';

describe('isStorm', () => {
  it('is false below the threshold and true at or above it', () => {
    expect(isStorm(STORM_PRICE - 0.01)).toBe(false);
    expect(isStorm(STORM_PRICE)).toBe(true);
    expect(isStorm(5193.14)).toBe(true);
  });
  it('is false for negative prices and missing data', () => {
    expect(isStorm(-30.72)).toBe(false);
    expect(isStorm(null)).toBe(false);
    expect(isStorm(undefined)).toBe(false);
  });
});

describe('StormBadge', () => {
  it('renders STORM when stormy and nothing otherwise', () => {
    const { rerender } = render(<StormBadge storm={true} />);
    expect(screen.getByText('STORM')).toBeTruthy();
    rerender(<StormBadge storm={false} />);
    expect(screen.queryByText('STORM')).toBeNull();
  });
});
```

- [ ] **Step 2:** Run red + capture: `npx vitest run src/ui/__tests__/storm.test.tsx 2>&1 | Tee-Object -FilePath docs/tdd/logs/29-storm-red.txt` — expect FAIL: cannot resolve `../storm`.
- [ ] **Step 3:** Implement `src/ui/storm.ts`:

```ts
/** RT price at or above which the UI shifts into storm mode ($/MWh). */
export const STORM_PRICE = 500;

export function isStorm(price: number | null | undefined): boolean {
  return typeof price === 'number' && price >= STORM_PRICE;
}
```

and `src/ui/components/StormBadge.tsx`:

```tsx
export default function StormBadge({ storm }: { storm: boolean }) {
  if (!storm) return null;
  return <span className="live-badge storm-on">STORM</span>;
}
```

- [ ] **Step 4:** Run green + capture: `npx vitest run src/ui/__tests__/storm.test.tsx 2>&1 | Tee-Object -FilePath docs/tdd/logs/29-storm-green.txt` — expect PASS (3 tests).
- [ ] **Step 5:** Commit: `git commit -m "feat: storm detection helper and badge"`

### Task 2.3: Wire into desk, live view, chart, CSS

- [ ] **Step 1:** `src/ui/components/PriceChart.tsx` — add optional `storm` prop and a recolor effect. Signature becomes `{ snap, epoch, storm = false }: { snap: SimSnapshot | null; epoch: number; storm?: boolean }`. Add after the existing snap effect:

```tsx
useEffect(() => {
  series.current?.applyOptions(storm
    ? { lineColor: '#F5A623', topColor: 'rgba(245, 166, 35, 0.28)', bottomColor: 'rgba(245, 166, 35, 0.02)' }
    : { lineColor: '#2E86E0', topColor: 'rgba(46, 134, 224, 0.28)', bottomColor: 'rgba(46, 134, 224, 0.02)' });
}, [storm, epoch]);
```

- [ ] **Step 2:** `src/ui/App.tsx` — compute storm and apply it (additive):

```tsx
import StormBadge from './components/StormBadge';
import { isStorm } from './storm';
// inside App(), after `const live = ...`:
const storm = isStorm(isLive ? live?.rtm[live.rtm.length - 1]?.price : sim.snap?.price);
```

`<main className={storm ? 'app storm' : 'app'}>`; in the desk chart card h2 append `{' '}<StormBadge storm={storm} />`; pass `storm={storm}` to `<PriceChart ... />`.
- [ ] **Step 3:** `src/ui/LiveView.tsx` — import `StormBadge` and `isStorm`; `LiveChart` gains a `storm` prop with the same recolor effect:

```tsx
function LiveChart({ points, storm }: { points: { t: number; price: number }[]; storm: boolean }) {
  // ...existing refs and create effect unchanged...
  useEffect(() => {
    series.current?.applyOptions(storm
      ? { lineColor: '#F5A623', topColor: 'rgba(245, 166, 35, 0.28)', bottomColor: 'rgba(245, 166, 35, 0.02)' }
      : { lineColor: '#2E86E0', topColor: 'rgba(46, 134, 224, 0.28)', bottomColor: 'rgba(46, 134, 224, 0.02)' });
  }, [storm]);
  // ...existing setData effect and return unchanged...
}
```

and in `LiveView`:

```tsx
export function LiveView({ live }: { live: LiveState | null }) {
  const snap = live ? toSnapshot(live) : null;
  const storm = isStorm(live?.rtm[live.rtm.length - 1]?.price ?? null);
  return (
    <>
      <div className="card span-2">
        <h2>
          Live — ERCOT HB_NORTH — $/MWh <LiveBadge lastUpdated={live?.lastUpdated ?? null} />
          {' '}<StormBadge storm={storm} />
        </h2>
        <LiveChart points={live?.rtm ?? []} storm={storm} />
      </div>
      {/* ...rest unchanged... */}
```
- [ ] **Step 4:** `src/ui/styles.css` — append:

```css
.live-badge.storm-on { background: var(--orange); color: var(--bg); animation: pulse 1.2s infinite; }
.app.storm .card { border-color: color-mix(in srgb, var(--orange) 35%, var(--line)); transition: border-color 400ms; }
@media (prefers-reduced-motion: reduce) {
  .live-badge { animation: none !important; }
  .app.storm .card { transition: none; }
}
```

- [ ] **Step 5:** Verify live: `npm run dev`, heat-wave scenario at 24h/s — cards warm and STORM pulses during the spike, reverts after. Full checks: `npm test; npm run typecheck; npm run lint`.
- [ ] **Step 6:** Commit: `git commit -m "feat: storm mode - spike-triggered ui shift"`

### Task 2.4: PR + merge

- [ ] **Step 1:** Push, PR `feat: storm mode`, merge after CI, reset main (workflow rules).

---

## Feature 3 of 6: Battery wear dashboard (small) — branch `diana/wear-dashboard`

**Files:**
- Create: `src/core/wear.ts`, `src/ui/components/WearPanel.tsx`
- Test: `src/core/__tests__/wear.test.ts`, append to `src/ui/__tests__/components.test.tsx`
- Modify: `src/core/ledger.ts` (two getters), `src/core/controller.ts` (snapshot field), `src/ui/App.tsx` (render), `src/ui/styles.css`
- Logs: `docs/tdd/logs/30-wear-red.txt`, `30-wear-green.txt`

### Task 3.1: Branch

- [ ] **Step 1:** `git checkout -b diana/wear-dashboard`

### Task 3.2: TDD ledger totals + wearStats

- [ ] **Step 1:** Write the failing test `src/core/__tests__/wear.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Ledger } from '../ledger';
import { wearStats } from '../wear';

function loaded(): Ledger {
  const l = new Ledger();
  l.record({ t: 1, strategy: 's', action: 'charge', mwh: 2.0, price: 10, value: -20 });
  l.record({ t: 2, strategy: 's', action: 'discharge', mwh: 1.5, price: 100, value: 150 });
  l.record({ t: 3, strategy: 's', action: 'discharge', mwh: 1.2, price: 200, value: 240 });
  return l;
}

describe('Ledger totals', () => {
  it('sums charged and discharged MWh separately', () => {
    const l = loaded();
    expect(l.mwhCharged).toBeCloseTo(2.0);
    expect(l.mwhDischarged).toBeCloseTo(2.7);
  });
  it('is zero on an empty ledger', () => {
    const l = new Ledger();
    expect(l.mwhCharged).toBe(0);
    expect(l.mwhDischarged).toBe(0);
  });
});

describe('wearStats', () => {
  it('derives equivalent full cycles and degradation dollars', () => {
    const s = wearStats(loaded(), 2700, 20); // 2.7 MWh fleet
    expect(s.cycles).toBeCloseTo(1.0);            // 2.7 MWh out / 2.7 MWh cap
    expect(s.degradationDollars).toBeCloseTo(54); // 2.7 * $20
    expect(s.mwhDischarged).toBeCloseTo(2.7);
  });
  it('guards zero capacity', () => {
    expect(wearStats(new Ledger(), 0, 20).cycles).toBe(0);
  });
});
```

- [ ] **Step 2:** Run red + capture to `docs/tdd/logs/30-wear-red.txt` — expect FAIL: `wear` module not found / `mwhCharged` undefined.
- [ ] **Step 3:** Implement. Append to `src/core/ledger.ts` (inside the class):

```ts
get mwhCharged(): number {
  return this.entries.reduce((s, e) => s + (e.action === 'charge' ? e.mwh : 0), 0);
}

get mwhDischarged(): number {
  return this.entries.reduce((s, e) => s + (e.action === 'discharge' ? e.mwh : 0), 0);
}
```

Create `src/core/wear.ts`:

```ts
import type { Ledger } from './ledger';

export interface WearStats {
  /** equivalent full cycles: MWh discharged / fleet capacity in MWh */
  cycles: number;
  mwhDischarged: number;
  /** accrued degradation cost in dollars */
  degradationDollars: number;
}

export function wearStats(ledger: Ledger, capacityKWh: number, degradationCostPerMWh: number): WearStats {
  const mwhDischarged = ledger.mwhDischarged;
  const capacityMWh = capacityKWh / 1000;
  return {
    cycles: capacityMWh > 0 ? mwhDischarged / capacityMWh : 0,
    mwhDischarged,
    degradationDollars: mwhDischarged * degradationCostPerMWh,
  };
}
```

- [ ] **Step 4:** Run green + capture to `docs/tdd/logs/30-wear-green.txt` — expect PASS (4 tests).
- [ ] **Step 5:** Commit: `git commit -m "feat: ledger throughput totals and wear stats"`

### Task 3.3: Snapshot + panel

- [ ] **Step 1:** `src/core/controller.ts` — additive: `LaneSnapshot` gains optional `wear?: WearStats` (import `{ wearStats, type WearStats } from './wear'`). In `snapshot()`, build each lane via a local view so it is computed once:

```ts
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
```

(`LiveView.toSnapshot` needs no change — `wear` is optional.)
- [ ] **Step 2:** Write the failing component test — append to `src/ui/__tests__/components.test.tsx`:

```tsx
import WearPanel from '../components/WearPanel';

describe('WearPanel', () => {
  it('shows cycles and wear dollars per strategy', () => {
    const withWear: SimSnapshot = {
      ...snap,
      lanes: snap.lanes.map((l) => ({
        ...l,
        wear: { cycles: 4.25, mwhDischarged: 11.475, degradationDollars: 229.5 },
      })),
    };
    render(<WearPanel snap={withWear} />);
    expect(screen.getAllByText(/4.25 cycles/)).toHaveLength(2);
    expect(screen.getAllByText(/\$229.50/)).toHaveLength(2);
  });
});
```

Run: `npx vitest run src/ui/__tests__/components.test.tsx` — expect FAIL (module not found).
- [ ] **Step 3:** Implement `src/ui/components/WearPanel.tsx`:

```tsx
import type { SimSnapshot } from '../../core/controller';

const usd = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WearPanel({ snap }: { snap: SimSnapshot | null }) {
  const lanes = snap?.lanes ?? [];
  return (
    <div className="card">
      <h2>Battery wear</h2>
      <div className="wear-grid">
        {lanes.map((l) => (
          <div key={l.name}>
            <div className="label">{l.name === 'lp-optimizer' ? 'lp' : 'thresh'}</div>
            <div className="value">{l.wear ? `${l.wear.cycles.toFixed(2)} cycles` : '-'}</div>
            <div className="delta">{l.wear ? `${usd(l.wear.degradationDollars)} wear` : '-'}</div>
          </div>
        ))}
        {lanes.length === 0 && <div className="label">no data yet</div>}
      </div>
    </div>
  );
}
```

CSS append: `.wear-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; } .wear-grid .label { color: var(--dim); font-size: 12px; } .wear-grid .value { font-family: var(--mono); font-size: 16px; } .wear-grid .delta { font-size: 12px; color: var(--dim); }`
- [ ] **Step 4:** `src/ui/App.tsx` — render `<WearPanel snap={sim.snap} />` directly after `<FleetPanel snap={sim.snap} />` in the desk branch.
- [ ] **Step 5:** Run green; full `npm test; npm run typecheck; npm run lint`. Visual check in dev server (run heat wave, watch wear accrue).
- [ ] **Step 6:** Commit: `git commit -m "feat: battery wear dashboard - cycles and degradation dollars"`

### Task 3.4: PR + merge

- [ ] **Step 1:** Push, PR `feat: battery wear dashboard`, merge after CI, reset main.

---

## Feature 4 of 6: Data export (small) — branch `diana/data-export`

**Files:**
- Create: `src/ui/export.ts`
- Test: `src/ui/__tests__/export.test.ts`
- Modify: `src/core/controller.ts` (one method), `src/ui/useSimulation.ts` (expose), `src/ui/App.tsx` (button), `src/ui/lab/LabView.tsx` (buttons), `src/ui/styles.css` (button style)
- Logs: `docs/tdd/logs/31-export-red.txt`, `31-export-green.txt`

### Task 4.1: Branch

- [ ] **Step 1:** `git checkout -b diana/data-export`

### Task 4.2: TDD the serializers

- [ ] **Step 1:** Write the failing test `src/ui/__tests__/export.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { LabRun } from '../lab/useLab';
import { ledgerCSV, labRunCSV, toCSV } from '../export';

describe('toCSV', () => {
  it('escapes commas, quotes, and newlines per RFC 4180', () => {
    const csv = toCSV([['a,b', 'say "hi"', 'two\nlines', 'plain']]);
    expect(csv).toBe('"a,b","say ""hi""","two\nlines",plain\r\n');
  });
});

describe('ledgerCSV', () => {
  it('emits a header and ISO-8601 timestamps', () => {
    const csv = ledgerCSV([
      { t: Date.UTC(2023, 7, 17, 19, 30), strategy: 'lp-optimizer', action: 'discharge', mwh: 0.25, price: 312.5, value: 73.13 },
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('time_utc,strategy,action,mwh,price_usd_per_mwh,value_usd');
    expect(lines[1]).toBe('2023-08-17T19:30:00.000Z,lp-optimizer,discharge,0.25,312.5,73.13');
  });
});

describe('labRunCSV', () => {
  it('includes params, every strategy, and an oracle row', () => {
    const run: LabRun = {
      params: { hub: 'HB_NORTH', start: '2023-08-14', end: '2023-08-21' },
      results: [{ name: 'threshold', pnl: 22116.69, mwhCharged: 30, mwhDischarged: 25, dispatches: 410 }],
      oracle: 31000,
      points: 672,
    };
    const lines = labRunCSV(run).trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('threshold');
    expect(lines[1]).toContain('71.3'); // pct of oracle
    expect(lines[2]).toContain('oracle');
  });
});
```

- [ ] **Step 2:** Run red + capture to `docs/tdd/logs/31-export-red.txt` — expect FAIL (module not found).
- [ ] **Step 3:** Implement `src/ui/export.ts`:

```ts
import type { LedgerEntry } from '../core/ledger';
import type { LabRun } from './lab/useLab';

const esc = (v: string): string =>
  /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;

export function toCSV(rows: (string | number)[][]): string {
  return rows.map((r) => r.map((c) => esc(String(c))).join(',')).join('\r\n') + '\r\n';
}

export function ledgerCSV(entries: LedgerEntry[]): string {
  return toCSV([
    ['time_utc', 'strategy', 'action', 'mwh', 'price_usd_per_mwh', 'value_usd'],
    ...entries.map((e) => [new Date(e.t).toISOString(), e.strategy, e.action, e.mwh, e.price, e.value]),
  ]);
}

export function labRunCSV(run: LabRun): string {
  const pct = (pnl: number) => (run.oracle > 0 ? ((pnl / run.oracle) * 100).toFixed(1) : '');
  return toCSV([
    ['hub', 'start', 'end', 'intervals', 'strategy', 'pnl_usd', 'pct_of_oracle', 'mwh_charged', 'mwh_discharged', 'dispatches'],
    ...run.results.map((r) => [
      run.params.hub, run.params.start, run.params.end, run.points,
      r.name, r.pnl, pct(r.pnl), r.mwhCharged, r.mwhDischarged, r.dispatches,
    ]),
    [run.params.hub, run.params.start, run.params.end, run.points, 'oracle', run.oracle, '100.0', '', '', ''],
  ]);
}

export function download(filename: string, content: string, mime = 'text/csv'): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4:** Run green + capture to `docs/tdd/logs/31-export-green.txt` — expect PASS (3 tests).
- [ ] **Step 5:** Commit: `git commit -m "feat: csv and json serializers for ledger and lab runs"`

### Task 4.3: Expose full ledgers + buttons

- [ ] **Step 1:** `src/core/controller.ts` — additive method on `SimulationController` (full entries are not in snapshots; this is pull-on-demand):

```ts
/** Full per-strategy ledger entries, for export. */
ledgers(): { name: string; entries: LedgerEntry[] }[] {
  return this.lanes.map((l) => ({ name: l.strategy.name, entries: l.ledger.entries }));
}
```

- [ ] **Step 2:** `src/ui/useSimulation.ts` — add to the returned object: `exportEntries: () => ctl?.ledgers().flatMap((g) => g.entries).sort((a, b) => a.t - b.t) ?? []`.
- [ ] **Step 3:** `src/ui/App.tsx` — dispatch-log card header gets a button (import `download, ledgerCSV` from `./export`):

```tsx
<h2>Dispatch log
  <button className="export-btn"
    onClick={() => download(`fluxcore-dispatch-${scenarioId}.csv`, ledgerCSV(sim.exportEntries()))}>
    Export CSV
  </button>
</h2>
```

- [ ] **Step 4:** `src/ui/lab/LabView.tsx` — in the results card h2, after the intervals span (import `download, labRunCSV` from `../export`):

```tsx
<button className="export-btn" onClick={() =>
  download(`fluxcore-lab-${lab.run!.params.hub}-${lab.run!.params.start}-${lab.run!.params.end}.csv`, labRunCSV(lab.run!))}>
  CSV
</button>
<button className="export-btn" onClick={() =>
  download(`fluxcore-lab-${lab.run!.params.hub}-${lab.run!.params.start}-${lab.run!.params.end}.json`,
    JSON.stringify(lab.run, null, 2), 'application/json')}>
  JSON
</button>
```

- [ ] **Step 5:** CSS append: `.export-btn { float: right; margin-left: 6px; background: var(--surface-2); color: var(--text); border: 1px solid var(--line); border-radius: 5px; padding: 2px 10px; font-size: 11px; font-family: var(--sans); cursor: pointer; text-transform: none; letter-spacing: 0; }`
- [ ] **Step 6:** Full checks + manual: run a sim, click Export CSV, open the file; run a lab backtest, export CSV and JSON.
- [ ] **Step 7:** Commit: `git commit -m "feat: one-click csv and json export for dispatch log and lab runs"`

### Task 4.4: PR + merge

- [ ] **Step 1:** Push, PR `feat: data export`, merge after CI, reset main.

---

## Feature 5 of 6: Fleet Designer (large) — branch `diana/fleet-designer`

**Files:**
- Create: `src/core/units.ts`, `src/ui/mixStorage.ts`, `src/ui/components/FleetDesigner.tsx`
- Test: `src/core/__tests__/units.test.ts`, `src/core/__tests__/availability.test.ts`, `src/ui/__tests__/designer.test.tsx`
- Modify: `src/core/fleet.ts` (availability + weighted view), `src/ui/plant.ts`, `src/ui/useSimulation.ts`, `src/ui/lab/useLab.ts`, `src/ui/lab/LabView.tsx`, `src/ui/App.tsx`, `src/ui/components/FleetPanel.tsx` (label), `src/ui/styles.css`
- Logs: `docs/tdd/logs/32-units-{red,green}.txt`, `33-availability-{red,green}.txt`, `34-designer-{red,green}.txt`

### Task 5.1: Branch

- [ ] **Step 1:** `git checkout -b diana/fleet-designer`

### Task 5.2: TDD the unit catalog

- [ ] **Step 1:** Write the failing test `src/core/__tests__/units.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fleetFromMix, mixTotals, PRESETS, UNIT_TYPES } from '../units';

describe('unit catalog', () => {
  it('defines home, commercial, and ev with the spec hardware', () => {
    expect(UNIT_TYPES.home.spec.battery.capacityKWh).toBe(13.5);
    expect(UNIT_TYPES.home.spec.solarPeakKW).toBe(5);
    expect(UNIT_TYPES.commercial.spec.battery.maxDischargeKW).toBe(50);
    expect(UNIT_TYPES.commercial.spec.solarPeakKW).toBe(0);
    expect(UNIT_TYPES.ev.spec.battery.capacityKWh).toBe(60);
    expect(UNIT_TYPES.ev.spec.unavailable).toEqual({ fromHour: 8, toHour: 18 });
  });
});

describe('mixTotals', () => {
  it('aggregates units, capacity, and dispatchable power', () => {
    const t = mixTotals([{ type: 'home', count: 120 }, { type: 'commercial', count: 10 }, { type: 'ev', count: 60 }]);
    expect(t.units).toBe(190);
    expect(t.capacityKWh).toBeCloseTo(120 * 13.5 + 10 * 100 + 60 * 60);
    expect(t.maxDischargeKW).toBeCloseTo(120 * 5 + 10 * 50 + 60 * 11);
  });
});

describe('fleetFromMix', () => {
  it('builds a fleet whose view matches the mix totals at hour 0', () => {
    const fleet = fleetFromMix([{ type: 'home', count: 3 }, { type: 'commercial', count: 1 }], 'summer');
    const v = fleet.view();
    expect(v.homesOnline).toBe(4);
    expect(v.capacityKWh).toBeCloseTo(3 * 13.5 + 100);
  });
  it('suburban preset equals the original 200-home plant', () => {
    const v = fleetFromMix(PRESETS[0].mix, 'summer').view();
    expect(v.homesOnline).toBe(200);
    expect(v.capacityKWh).toBeCloseTo(2700);
    expect(v.maxDischargeKW).toBeCloseTo(1000);
  });
});
```

- [ ] **Step 2:** Run red + capture to `docs/tdd/logs/32-units-red.txt` — FAIL (module not found).
- [ ] **Step 3:** Implement `src/core/units.ts`:

```ts
import { Fleet, type HomeSpec } from './fleet';
import type { Season } from './types';

export type UnitTypeId = 'home' | 'commercial' | 'ev';

export const UNIT_TYPES: Record<UnitTypeId, { label: string; spec: HomeSpec }> = {
  home: {
    label: 'Suburban home',
    spec: {
      battery: { capacityKWh: 13.5, maxChargeKW: 5, maxDischargeKW: 5, roundTripEfficiency: 0.86, degradationCostPerMWh: 20 },
      solarPeakKW: 5,
    },
  },
  commercial: {
    label: 'Commercial unit',
    spec: {
      battery: { capacityKWh: 100, maxChargeKW: 50, maxDischargeKW: 50, roundTripEfficiency: 0.86, degradationCostPerMWh: 20 },
      solarPeakKW: 0,
    },
  },
  ev: {
    label: 'EV (away 8a-6p)',
    spec: {
      battery: { capacityKWh: 60, maxChargeKW: 11, maxDischargeKW: 11, roundTripEfficiency: 0.86, degradationCostPerMWh: 20 },
      solarPeakKW: 0,
      unavailable: { fromHour: 8, toHour: 18 },
    },
  },
};

export type FleetMix = { type: UnitTypeId; count: number }[];

export const PRESETS: { id: string; label: string; mix: FleetMix }[] = [
  { id: 'suburban', label: 'Suburban 200', mix: [{ type: 'home', count: 200 }] },
  { id: 'mixed', label: 'Mixed Portfolio', mix: [{ type: 'home', count: 120 }, { type: 'commercial', count: 10 }, { type: 'ev', count: 60 }] },
  { id: 'campus', label: 'Commercial Campus', mix: [{ type: 'commercial', count: 20 }] },
  { id: 'ev-heavy', label: 'EV Heavy', mix: [{ type: 'home', count: 20 }, { type: 'ev', count: 150 }] },
];

export function mixTotals(mix: FleetMix): { units: number; capacityKWh: number; maxDischargeKW: number; solarPeakKW: number } {
  let units = 0, capacityKWh = 0, maxDischargeKW = 0, solarPeakKW = 0;
  for (const { type, count } of mix) {
    const s = UNIT_TYPES[type].spec;
    units += count;
    capacityKWh += count * s.battery.capacityKWh;
    maxDischargeKW += count * s.battery.maxDischargeKW;
    solarPeakKW += count * s.solarPeakKW;
  }
  return { units, capacityKWh, maxDischargeKW, solarPeakKW };
}

export function fleetFromMix(mix: FleetMix, season: Season): Fleet {
  const specs = mix.flatMap(({ type, count }) =>
    Array.from({ length: count }, () => UNIT_TYPES[type].spec));
  return new Fleet(specs, season);
}
```

This requires `HomeSpec` to carry the optional window first — add to `src/core/fleet.ts` `HomeSpec`:

```ts
export interface HomeSpec {
  battery: BatterySpec;
  solarPeakKW: number;
  /** half-open local-hour window [fromHour, toHour) when the unit is offline */
  unavailable?: { fromHour: number; toHour: number };
}
```

- [ ] **Step 4:** Run green + capture to `docs/tdd/logs/32-units-green.txt` — PASS (5 tests). Full suite still green (`npm test`).
- [ ] **Step 5:** Commit: `git commit -m "feat: unit catalog, fleet mixes, and presets"`

### Task 5.3: TDD availability gating + weighted view

- [ ] **Step 1:** Write the failing test `src/core/__tests__/availability.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Fleet, type HomeSpec } from '../fleet';

const batt = { maxChargeKW: 10, maxDischargeKW: 10, roundTripEfficiency: 1, degradationCostPerMWh: 20 };
const HOME: HomeSpec = { battery: { ...batt, capacityKWh: 10 }, solarPeakKW: 0 };
const EV: HomeSpec = { battery: { ...batt, capacityKWh: 10 }, solarPeakKW: 0, unavailable: { fromHour: 8, toHour: 18 } };
const SOLAR_EV: HomeSpec = { ...EV, solarPeakKW: 5 };

function fleetAt(hour: number, specs: HomeSpec[]): Fleet {
  const f = new Fleet(specs, 'summer');
  f.applySolar(hour, 15); // deskTick always applies solar first; this sets the fleet clock
  return f;
}

describe('availability window', () => {
  it('gates dispatch inside [fromHour, toHour) and not outside', () => {
    expect(fleetAt(7.99, [EV]).charge(10, 60).drawnKWh).toBeCloseTo(10);
    expect(fleetAt(8, [EV]).charge(10, 60).drawnKWh).toBe(0);
    expect(fleetAt(17.99, [EV]).charge(10, 60).drawnKWh).toBe(0);
    expect(fleetAt(18, [EV]).charge(10, 60).drawnKWh).toBeCloseTo(10);
  });
  it('an away unit contributes no SoC to discharge', () => {
    const f = new Fleet([EV], 'summer');
    f.applySolar(7, 15);
    f.charge(10, 60); // 10 kWh in, before leaving
    f.applySolar(12, 15); // now away
    expect(f.discharge(10, 60).deliveredKWh).toBe(0);
    f.applySolar(19, 15); // back home
    expect(f.discharge(10, 60).deliveredKWh).toBeCloseTo(10);
  });
  it('an away unit takes no solar', () => {
    const f = new Fleet([SOLAR_EV], 'summer');
    expect(f.applySolar(12, 60)).toBe(0); // noon, away: nothing stored
    expect(f.view().solarKWNow).toBe(0);
  });
  it('homesOnline counts only available units', () => {
    expect(fleetAt(12, [HOME, EV]).view().homesOnline).toBe(1);
    expect(fleetAt(20, [HOME, EV]).view().homesOnline).toBe(2);
  });
  it('away capacity and SoC are excluded from the view', () => {
    const f = new Fleet([HOME, EV], 'summer');
    f.applySolar(0, 15);
    f.charge(20, 60); // fill both: 10 kWh each
    f.applySolar(12, 15);
    const v = f.view();
    expect(v.capacityKWh).toBe(10);
    expect(v.socKWh).toBeCloseTo(10);
  });
  it('all units away yields a zeroed view, not NaN', () => {
    const v = fleetAt(12, [EV]).view();
    expect(v.homesOnline).toBe(0);
    expect(v.capacityKWh).toBe(0);
    expect(v.socKWh).toBe(0);
  });
});

describe('capacity-weighted view', () => {
  it('weights efficiency and degradation by capacity for mixed fleets', () => {
    const a: HomeSpec = { battery: { ...batt, capacityKWh: 10, roundTripEfficiency: 0.8, degradationCostPerMWh: 10 }, solarPeakKW: 0 };
    const b: HomeSpec = { battery: { ...batt, capacityKWh: 30, roundTripEfficiency: 0.9, degradationCostPerMWh: 30 }, solarPeakKW: 0 };
    const v = new Fleet([a, b], 'summer').view();
    expect(v.roundTripEfficiency).toBeCloseTo(0.875); // (0.8*10 + 0.9*30) / 40
    expect(v.degradationCostPerMWh).toBeCloseTo(25);  // (10*10 + 30*30) / 40
  });
});
```

- [ ] **Step 2:** Run red + capture to `docs/tdd/logs/33-availability-red.txt` — expect assertion failures (gating not implemented).
- [ ] **Step 3:** Implement in `src/core/fleet.ts`. `Home` carries the window; the fleet caches the hour from `applySolar` (deskTick's first call each tick — documented invariant):

```ts
interface Home {
  battery: Battery;
  solarPeakKW: number;
  unavailable?: { fromHour: number; toHour: number };
}
```

In the constructor map: `({ battery: new Battery(s.battery), solarPeakKW: s.solarPeakKW, unavailable: s.unavailable })`.
Add to the class:

```ts
/** Local hour set by applySolar; deskTick applies solar before any dispatch,
 *  so availability below is always evaluated at the current tick's hour. */
private currentHour = 0;

private available(h: Home): boolean {
  if (!h.unavailable) return true;
  return this.currentHour < h.unavailable.fromHour || this.currentHour >= h.unavailable.toHour;
}
```

`applySolar` sets `this.currentHour = hourOfDay;` first and skips unavailable homes (`if (!this.available(h)) continue;` — they contribute neither generation nor storage).
`charge`: `const headrooms = this.homes.map((h) => (this.available(h) ? h.battery.headroomKWh : 0));` (rest unchanged — a zero headroom share dispatches 0 kW to that home; same pattern for `discharge` with `socs`).
`view()` skips unavailable homes in the aggregate loop and weights by capacity:

```ts
view(): FleetView {
  const first = this.homes[0].battery.spec;
  let online = 0, soc = 0, cap = 0, headroom = 0, cRate = 0, dRate = 0, effW = 0, degW = 0;
  for (const h of this.homes) {
    if (!this.available(h)) continue;
    online += 1;
    soc += h.battery.soc;
    cap += h.battery.spec.capacityKWh;
    headroom += h.battery.headroomKWh;
    cRate += h.battery.spec.maxChargeKW;
    dRate += h.battery.spec.maxDischargeKW;
    effW += h.battery.spec.roundTripEfficiency * h.battery.spec.capacityKWh;
    degW += h.battery.spec.degradationCostPerMWh * h.battery.spec.capacityKWh;
  }
  return {
    homesOnline: online,
    socKWh: soc,
    capacityKWh: cap,
    chargeHeadroomKWh: headroom,
    maxChargeKW: cRate,
    maxDischargeKW: dRate,
    roundTripEfficiency: cap > 0 ? effW / cap : first.roundTripEfficiency,
    degradationCostPerMWh: cap > 0 ? degW / cap : first.degradationCostPerMWh,
    solarKWNow: this.lastSolarKW,
  };
}
```

(For uniform always-available fleets every value is identical to before — the existing fleet tests prove it.)
- [ ] **Step 4:** Run green + capture to `docs/tdd/logs/33-availability-green.txt`; full suite green (his fleet/controller/backtest tests unchanged).
- [ ] **Step 5:** Commit: `git commit -m "feat: availability windows and capacity-weighted fleet view"`

### Task 5.4: TDD mix storage + designer component

- [ ] **Step 1:** Write the failing test `src/ui/__tests__/designer.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '../../core/units';
import FleetDesigner from '../components/FleetDesigner';
import { loadMix, saveMix } from '../mixStorage';

describe('mixStorage', () => {
  it('round-trips a saved mix', () => {
    saveMix(PRESETS[1].mix);
    expect(loadMix()).toEqual(PRESETS[1].mix);
  });
  it('falls back to the suburban default on garbage', () => {
    localStorage.setItem('fluxcore.fleetMix', '{nope');
    expect(loadMix()).toEqual(PRESETS[0].mix);
    localStorage.setItem('fluxcore.fleetMix', JSON.stringify([{ type: 'flying-car', count: 5 }]));
    expect(loadMix()).toEqual(PRESETS[0].mix);
    localStorage.setItem('fluxcore.fleetMix', JSON.stringify([{ type: 'home', count: -3 }]));
    expect(loadMix()).toEqual(PRESETS[0].mix);
  });
});

describe('FleetDesigner', () => {
  it('shows presets and the live capacity readout', () => {
    render(<FleetDesigner mix={PRESETS[0].mix} onMix={() => {}} />);
    expect(screen.getByRole('button', { name: 'Suburban 200' })).toBeTruthy();
    expect(screen.getByText(/2.7 MWh/)).toBeTruthy();
    expect(screen.getByText(/1.0 MW/)).toBeTruthy();
  });
  it('reports stepper edits through onMix', () => {
    let got = null as unknown;
    render(<FleetDesigner mix={PRESETS[0].mix} onMix={(m) => { got = m; }} />);
    fireEvent.change(screen.getByLabelText('EV (away 8a-6p)'), { target: { value: '40' } });
    expect(got).toEqual([{ type: 'home', count: 200 }, { type: 'ev', count: 40 }]);
  });
});
```

- [ ] **Step 2:** Run red + capture to `docs/tdd/logs/34-designer-red.txt` — FAIL (modules not found).
- [ ] **Step 3:** Implement `src/ui/mixStorage.ts`:

```ts
import { type FleetMix, PRESETS, UNIT_TYPES } from '../core/units';

const KEY = 'fluxcore.fleetMix';

function valid(raw: unknown): raw is FleetMix {
  return Array.isArray(raw) && raw.length > 0 && raw.every((e) =>
    typeof e === 'object' && e !== null &&
    Object.prototype.hasOwnProperty.call(UNIT_TYPES, (e as { type?: unknown }).type as string) &&
    Number.isInteger((e as { count?: unknown }).count) &&
    ((e as { count: number }).count) >= 0 && ((e as { count: number }).count) <= 1000);
}

export function loadMix(): FleetMix {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '');
    if (valid(raw)) return raw;
  } catch { /* fall through */ }
  return PRESETS[0].mix;
}

export function saveMix(mix: FleetMix): void {
  localStorage.setItem(KEY, JSON.stringify(mix));
}
```

and `src/ui/components/FleetDesigner.tsx`:

```tsx
import { type FleetMix, mixTotals, PRESETS, UNIT_TYPES, type UnitTypeId } from '../../core/units';

const sameMix = (a: FleetMix, b: FleetMix) => JSON.stringify(a) === JSON.stringify(b);
const countOf = (mix: FleetMix, type: UnitTypeId) => mix.find((e) => e.type === type)?.count ?? 0;

export default function FleetDesigner({ mix, onMix }: { mix: FleetMix; onMix: (m: FleetMix) => void }) {
  const t = mixTotals(mix);
  const setCount = (type: UnitTypeId, count: number) => {
    const next = (Object.keys(UNIT_TYPES) as UnitTypeId[])
      .map((u) => ({ type: u, count: u === type ? count : countOf(mix, u) }))
      .filter((e) => e.count > 0);
    onMix(next.length ? next : PRESETS[0].mix);
  };
  return (
    <div className="card">
      <h2>Fleet designer</h2>
      <div className="designer-presets">
        {PRESETS.map((p) => (
          <button key={p.id} aria-pressed={sameMix(p.mix, mix)} onClick={() => onMix(p.mix)}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="designer-units">
        {(Object.keys(UNIT_TYPES) as UnitTypeId[]).map((u) => (
          <label key={u}>
            <span>{UNIT_TYPES[u].label}</span>
            <input aria-label={UNIT_TYPES[u].label} type="number" min={0} max={1000}
              value={countOf(mix, u)}
              onChange={(e) => setCount(u, Math.max(0, Math.min(1000, Number(e.target.value) || 0)))} />
          </label>
        ))}
      </div>
      <div className="designer-totals">
        {t.units} units - {(t.capacityKWh / 1000).toFixed(1)} MWh - {(t.maxDischargeKW / 1000).toFixed(1)} MW
      </div>
    </div>
  );
}
```

CSS append:

```css
.designer-presets { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.designer-presets button { background: var(--surface-2); color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; }
.designer-presets button[aria-pressed='true'] { background: var(--blue-soft); border-color: var(--blue); }
.designer-units { display: grid; gap: 6px; }
.designer-units label { display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--dim); }
.designer-units input { width: 72px; background: var(--surface-2); color: var(--text); border: 1px solid var(--line); border-radius: 5px; padding: 4px 8px; font-family: var(--mono); }
.designer-totals { margin-top: 10px; font-family: var(--mono); font-size: 12px; color: var(--cyan); }
```

- [ ] **Step 4:** Run green + capture to `docs/tdd/logs/34-designer-green.txt` — PASS.
- [ ] **Step 5:** Commit: `git commit -m "feat: fleet designer card with presets and validated mix storage"`

### Task 5.5: Wire the mix through desk and lab

- [ ] **Step 1:** `src/ui/plant.ts` — replace the body of `makeFleet` (signature gains the mix):

```ts
import type { Fleet } from '../core/fleet';
import { type FleetMix, fleetFromMix } from '../core/units';
import type { Season } from '../core/types';

/** Build the dispatchable plant for the given unit mix. */
export function makeFleet(season: Season, mix: FleetMix): Fleet {
  return fleetFromMix(mix, season);
}
```

- [ ] **Step 2:** `src/ui/useSimulation.ts` — accept the mix and reset when it changes (same render-time-adjustment pattern as `prevScenario`):

```ts
import type { FleetMix } from '../core/units';

function makeController(scenario: Scenario, mix: FleetMix): SimulationController {
  return new SimulationController(scenario, () => makeFleet(scenario.season, mix), [
    new ThresholdStrategy(),
    new LPStrategy(),
  ]);
}

export function useSimulation(scenario: Scenario | null, mix: FleetMix) {
  // ...existing state unchanged...
  const [prevMixKey, setPrevMixKey] = useState('');
  const mixKey = JSON.stringify(mix);

  if (scenario !== prevScenario || mixKey !== prevMixKey) {
    setPrevScenario(scenario);
    setPrevMixKey(mixKey);
    setCtl(scenario ? makeController(scenario, mix) : null);
    setSnap(null);
    setPlaying(false);
    setEpoch((e) => e + 1);
  }

  // ...tick effect unchanged...
  const reset = () => {
    if (!scenario) return;
    setCtl(makeController(scenario, mix));
    setSnap(null);
    setPlaying(false);
    setEpoch((e) => e + 1);
  };
  // ...
}
```
- [ ] **Step 3:** `src/ui/App.tsx` — own the state and render the card in both views:

```tsx
import FleetDesigner from './components/FleetDesigner';
import { loadMix, saveMix } from './mixStorage';
import type { FleetMix } from '../core/units';
// in App():
const [mix, setMix] = useState<FleetMix>(loadMix);
const updateMix = (m: FleetMix) => { setMix(m); saveMix(m); };
const sim = useSimulation(isLive ? null : scenario, mix);
```

Desk branch: `<FleetDesigner mix={mix} onMix={updateMix} />` after `<WearPanel ... />`. Lab branch: pass the mix down — `<LabView initial={initialLab} mix={mix} onMix={updateMix} />`.
- [ ] **Step 4:** `src/ui/lab/useLab.ts` — `start(params: LabParams, mix: FleetMix)`: delete the `HOME`/`HOMES` constants; backtest uses `() => fleetFromMix(mix, season)`; oracle aggregate comes from totals plus the weighted view of a probe fleet:

```ts
const probe = fleetFromMix(mix, season).view();
const t = mixTotals(mix);
const oracle = oraclePnl(rtm, {
  capacityKWh: t.capacityKWh,
  maxChargeKW: probe.maxChargeKW,
  maxDischargeKW: t.maxDischargeKW,
  roundTripEfficiency: probe.roundTripEfficiency,
  degradationCostPerMWh: probe.degradationCostPerMWh,
  solarPeakKW: t.solarPeakKW,
}, season, 15);
```

(Probe is taken at construction hour 0 — all units home, full-fleet rates; the oracle stays an explicit upper bound and ignores availability, per spec.)
- [ ] **Step 5:** `src/ui/lab/LabView.tsx` — props gain `mix: FleetMix; onMix: (m: FleetMix) => void`; render `<FleetDesigner mix={mix} onMix={onMix} />` after the results card; `lab.start(params)` calls become `lab.start(params, mix)` (both the button and the auto-run effect, whose dep array gains `mix`).
- [ ] **Step 6:** `src/ui/components/FleetPanel.tsx` — label `Homes online` becomes `Units online`.
- [ ] **Step 7:** Full checks: `npm test; npm run typecheck; npm run lint`. Manual: pick EV Heavy, run the heat wave, watch "Units online" drop at 08:00 Central; run a lab backtest on Mixed Portfolio.
- [ ] **Step 8:** Commit: `git commit -m "feat: fleet mix wired through replay desk and backtest lab"`

### Task 5.6: PR + merge

- [ ] **Step 1:** Push, PR `feat: fleet designer - heterogeneous unit mixes`, merge after CI, reset main.

---

## Feature 6 of 6: Monte Carlo stress test (large) — branch `diana/monte-carlo`

**Files:**
- Create: `src/core/montecarlo.ts`, `src/ui/lab/StressCard.tsx`, `src/ui/lab/useStress.ts`
- Test: `src/core/__tests__/montecarlo.test.ts`, `src/ui/__tests__/stress.test.tsx`
- Modify: `src/ui/lab/useLab.ts` (export `loadRange`), `src/ui/lab/LabView.tsx` (one render line), `src/ui/styles.css`
- Logs: `docs/tdd/logs/35-montecarlo-{red,green}.txt`, `36-stress-ui-{red,green}.txt`

### Task 6.1: Branch

- [ ] **Step 1:** `git checkout -b diana/monte-carlo`

### Task 6.2: TDD PRNG, noise, stats

- [ ] **Step 1:** Write the failing test `src/core/__tests__/montecarlo.test.ts` (part 1):

```ts
import { describe, expect, it } from 'vitest';
import { histogram, mulberry32, normal, perturbDam, summarize } from '../montecarlo';

describe('mulberry32', () => {
  it('is deterministic per seed and uniform in [0, 1)', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(7);
    const seqA = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(seqA);
    expect(Array.from({ length: 5 }, c)).not.toEqual(seqA);
    expect(seqA.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('normal', () => {
  it('draws approximately standard normal', () => {
    const rand = mulberry32(1);
    const draws = Array.from({ length: 10000 }, () => normal(rand));
    const mean = draws.reduce((s, x) => s + x, 0) / draws.length;
    const sd = Math.sqrt(draws.reduce((s, x) => s + (x - mean) ** 2, 0) / draws.length);
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(sd - 1)).toBeLessThan(0.05);
  });
});

describe('perturbDam', () => {
  it('is the identity at sigma zero and preserves timestamps', () => {
    const dam = [{ t: 0, price: 50 }, { t: 3600000, price: -10 }];
    expect(perturbDam(dam, 0, mulberry32(9))).toEqual(dam);
    const noisy = perturbDam(dam, 0.25, mulberry32(9));
    expect(noisy.map((p) => p.t)).toEqual([0, 3600000]);
    expect(noisy[0].price).not.toBe(50);
  });
});

describe('summarize and histogram', () => {
  it('computes exact percentiles on 0..100', () => {
    const s = summarize(Array.from({ length: 101 }, (_, i) => i));
    expect(s).toEqual({ min: 0, p5: 5, median: 50, p95: 95, max: 100, mean: 50 });
  });
  it('bins values inclusively at the top edge', () => {
    const bins = histogram([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    expect(bins).toHaveLength(5);
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(11);
    expect(bins[4].count).toBe(3); // 8, 9, 10
  });
});
```

- [ ] **Step 2:** Run red + capture to `docs/tdd/logs/35-montecarlo-red.txt` — FAIL (module not found).
- [ ] **Step 3:** Implement the helpers in `src/core/montecarlo.ts`:

```ts
import { Backtest } from './backtest';
import type { Fleet } from './fleet';
import type { Strategy } from './strategy';
import type { PricePoint, Scenario } from './types';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal draw via Box-Muller. */
export function normal(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Multiplicative forecast noise: price * (1 + sigma * z). Timestamps preserved. */
export function perturbDam(dam: PricePoint[], sigma: number, rand: () => number): PricePoint[] {
  if (sigma === 0) return dam.map((p) => ({ ...p }));
  return dam.map((p) => ({ t: p.t, price: p.price * (1 + sigma * normal(rand)) }));
}

export interface DistStats { min: number; p5: number; median: number; p95: number; max: number; mean: number }

export function summarize(pnls: number[]): DistStats {
  const s = [...pnls].sort((a, b) => a - b);
  const q = (p: number) => s[Math.round(p * (s.length - 1))];
  return {
    min: s[0], p5: q(0.05), median: q(0.5), p95: q(0.95), max: s[s.length - 1],
    mean: s.reduce((a, b) => a + b, 0) / s.length,
  };
}

export interface HistBin { x0: number; x1: number; count: number }

export function histogram(values: number[], bins: number): HistBin[] {
  const min = Math.min(...values), max = Math.max(...values);
  const w = (max - min) / bins || 1;
  const out: HistBin[] = Array.from({ length: bins }, (_, i) =>
    ({ x0: min + i * w, x1: min + (i + 1) * w, count: 0 }));
  for (const v of values) out[Math.min(bins - 1, Math.floor((v - min) / w))].count += 1;
  return out;
}
```

- [ ] **Step 4:** Run green + capture to `docs/tdd/logs/35-montecarlo-green.txt` — PASS (5 tests).
- [ ] **Step 5:** Commit: `git commit -m "feat: seeded prng, forecast noise, distribution stats"`

### Task 6.3: TDD the MonteCarlo runner

- [ ] **Step 1:** Append the failing tests to `src/core/__tests__/montecarlo.test.ts` (part 2). The dummy strategy is forecast-sensitive on purpose; the thesis test uses the real strategies:

```ts
import { Fleet } from '../fleet';
import { LPStrategy } from '../lp';
import { ThresholdStrategy } from '../threshold';
import { HOLD, type MarketContext, type Strategy } from '../strategy';
import { MonteCarlo } from '../montecarlo';
import type { Scenario } from '../types';

const HOUR = 3600000;
/** 2 days of hourly points: flat $20 with a $400 spike each day at hour 18. */
function scenario(): Scenario {
  const rtm = Array.from({ length: 48 }, (_, i) =>
    ({ t: i * HOUR, price: i % 24 === 18 ? 400 : 20 }));
  const dam = rtm.map((p) => ({ ...p }));
  return { id: 'mc', name: 'mc', description: '', season: 'summer', intervalMinutes: 60, rtm, dam };
}
const fleetFactory = () => Fleet.uniform(10, {
  battery: { capacityKWh: 13.5, maxChargeKW: 5, maxDischargeKW: 5, roundTripEfficiency: 0.86, degradationCostPerMWh: 20 },
  solarPeakKW: 0,
}, 'summer');

/** Trades only on the forecast: charges if a forecast point beats breakeven later. */
class ForecastFollower implements Strategy {
  readonly name = 'follower';
  decide(ctx: MarketContext): ReturnType<Strategy['decide']> {
    const future = Math.max(...ctx.damForecast.slice(1).map((p) => p.price), 0);
    if (future > 100 && ctx.fleet.chargeHeadroomKWh > 0) return { type: 'charge', kW: ctx.fleet.maxChargeKW };
    if (ctx.now.price > 100 && ctx.fleet.socKWh > 0) return { type: 'discharge', kW: ctx.fleet.maxDischargeKW };
    return HOLD;
  }
}

function run(seed: number, sigma: number, runs: number, strategies: () => Strategy[]) {
  const mc = new MonteCarlo(scenario(), fleetFactory, { runs, sigma, seed, strategyFactory: strategies });
  while (!mc.step(500)) { /* spin to completion */ }
  return mc.results();
}

describe('MonteCarlo runner', () => {
  it('is reproducible: same seed, same distributions', () => {
    const a = run(42, 0.5, 6, () => [new ForecastFollower()]);
    const b = run(42, 0.5, 6, () => [new ForecastFollower()]);
    expect(a[0].pnls).toEqual(b[0].pnls);
    expect(a[0].pnls).toHaveLength(7); // baseline + 6 runs
  });
  it('collapses to the baseline at sigma zero', () => {
    const r = run(1, 0, 4, () => [new ForecastFollower()])[0];
    expect(new Set(r.pnls).size).toBe(1);
  });
  it('thesis: threshold is forecast-immune, the LP is not', () => {
    const [thresh, lp] = run(7, 0.6, 5, () => [new ThresholdStrategy(), new LPStrategy()]);
    expect(new Set(thresh.pnls).size).toBe(1); // ignores DAM entirely
    expect(new Set(lp.pnls).size).toBeGreaterThan(1);
    expect(thresh.stats.min).toBeLessThanOrEqual(thresh.stats.max);
  });
});
```

- [ ] **Step 2:** Run — expect FAIL (`MonteCarlo` not exported).
- [ ] **Step 3:** Implement the runner in `src/core/montecarlo.ts`:

```ts
export interface MonteCarloOptions {
  /** perturbed runs in addition to the unperturbed baseline (run 0) */
  runs: number;
  sigma: number;
  seed: number;
  /** fresh strategy instances per run (strategies may hold state) */
  strategyFactory: () => Strategy[];
}

export interface StrategyDistribution {
  name: string;
  /** index 0 = unperturbed baseline */
  pnls: number[];
  stats: DistStats;
  bins: HistBin[];
}

export class MonteCarlo {
  private readonly rand: () => number;
  private runIdx = 0;
  private current: Backtest | null = null;
  private names: string[] = [];
  private readonly collected: number[][] = [];

  constructor(
    private readonly scenario: Scenario,
    private readonly fleetFactory: () => Fleet,
    private readonly opts: MonteCarloOptions,
  ) {
    this.rand = mulberry32(opts.seed);
  }

  get totalRuns(): number {
    return this.opts.runs + 1;
  }

  get progress(): number {
    const inner = this.current?.progress ?? 0;
    return Math.min(1, (this.runIdx + inner) / this.totalRuns);
  }

  /** Step up to n engine ticks; true when every run is complete. */
  step(n: number): boolean {
    if (this.runIdx >= this.totalRuns) return true;
    if (!this.current) {
      const dam = this.runIdx === 0
        ? this.scenario.dam
        : perturbDam(this.scenario.dam, this.opts.sigma, this.rand);
      this.current = new Backtest({ ...this.scenario, dam }, this.fleetFactory, this.opts.strategyFactory());
    }
    if (this.current.step(n)) {
      const results = this.current.results();
      if (this.runIdx === 0) {
        this.names = results.map((r) => r.name);
        results.forEach(() => this.collected.push([]));
      }
      results.forEach((r, i) => this.collected[i].push(r.pnl));
      this.current = null;
      this.runIdx += 1;
    }
    return this.runIdx >= this.totalRuns;
  }

  /** Distributions over completed runs (callable mid-flight for streaming UI). */
  results(): StrategyDistribution[] {
    return this.names.map((name, i) => {
      const pnls = this.collected[i];
      return { name, pnls, stats: summarize(pnls), bins: histogram(pnls, 12) };
    });
  }
}
```

- [ ] **Step 4:** Run green; update the `35-montecarlo-green.txt` capture with the full file's output (8 tests). Full suite green. If the thesis test is flaky on LP spread, raise sigma in the test, not the assertion.
- [ ] **Step 5:** Commit: `git commit -m "feat: steppable monte carlo runner over perturbed forecasts"`

### Task 6.4: TDD the stress card

- [ ] **Step 1:** Write the failing test `src/ui/__tests__/stress.test.tsx` (presentational pieces only — the run loop is exercised manually; the engine is already covered):

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Distribution } from '../lab/StressCard';

describe('Distribution', () => {
  it('renders stats and an oracle reference', () => {
    render(<Distribution dist={{
      name: 'lp-optimizer',
      pnls: [100, 80, 120, 90, 110],
      stats: { min: 80, p5: 80, median: 100, p95: 120, max: 120, mean: 100 },
      bins: [{ x0: 80, x1: 100, count: 2 }, { x0: 100, x1: 120, count: 3 }],
    }} oracle={150} />);
    expect(screen.getByText(/lp-optimizer/)).toBeTruthy();
    expect(screen.getByText(/median \$100\.00/)).toBeTruthy();
    expect(screen.getByText(/p5 \$80\.00/)).toBeTruthy();
    expect(screen.getByText(/oracle \$150\.00/)).toBeTruthy();
  });
});
```

- [ ] **Step 2:** Run red + capture to `docs/tdd/logs/36-stress-ui-red.txt`.
- [ ] **Step 3:** Implement. First export the loader: in `src/ui/lab/useLab.ts` change `async function loadRange` to `export async function loadRange` (only change to that file). Create `src/ui/lab/useStress.ts`:

```ts
import { useRef, useState } from 'react';
import { MonteCarlo, type StrategyDistribution } from '../../core/montecarlo';
import { LPStrategy } from '../../core/lp';
import { ThresholdStrategy } from '../../core/threshold';
import { seasonForMonth } from '../../core/solar';
import { type FleetMix, fleetFromMix } from '../../core/units';
import type { Scenario } from '../../core/types';
import { loadRange } from './useLab';
import type { LabParams } from './share';

export interface StressResult { dists: StrategyDistribution[]; runsDone: number; total: number }

export function useStress() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<StressResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  async function start(params: LabParams, mix: FleetMix, runs: number, sigma: number) {
    const id = ++seq.current;
    setRunning(true); setError(null); setResult(null); setProgress(0);
    try {
      const { rtm, dam } = await loadRange(params);
      const season = seasonForMonth(Number(params.start.slice(5, 7)));
      const scenario: Scenario = { id: 'stress', name: 'stress', description: '', season, intervalMinutes: 15, rtm, dam };
      const mc = new MonteCarlo(scenario, () => fleetFromMix(mix, season), {
        runs, sigma, seed: 20260611,
        strategyFactory: () => [new ThresholdStrategy(), new LPStrategy()],
      });
      let done = false;
      while (!done) {
        done = mc.step(192);
        if (seq.current !== id) return; // superseded
        setProgress(mc.progress);
        setResult({ dists: mc.results(), runsDone: Math.round(mc.progress * (runs + 1)), total: runs + 1 });
        await new Promise((r) => setTimeout(r, 0)); // yield to the UI
      }
    } catch (e) {
      if (seq.current === id) setError(e instanceof Error ? e.message : 'stress run failed');
    } finally {
      if (seq.current === id) { setRunning(false); setProgress(1); }
    }
  }

  return { running, progress, result, error, start };
}
```

and `src/ui/lab/StressCard.tsx`:

```tsx
import { useState } from 'react';
import type { StrategyDistribution } from '../../core/montecarlo';
import type { FleetMix } from '../../core/units';
import type { LabParams } from './share';
import { useStress } from './useStress';

const usd = (n: number) =>
  (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function Distribution({ dist, oracle }: { dist: StrategyDistribution; oracle: number }) {
  const peak = Math.max(...dist.bins.map((b) => b.count), 1);
  return (
    <div className="dist">
      <div className="dist-name">{dist.name}</div>
      <div className="dist-bars" role="img" aria-label={`${dist.name} P&L distribution`}>
        {dist.bins.map((b, i) => (
          <div key={i} title={`${usd(b.x0)} to ${usd(b.x1)}: ${b.count}`}
            style={{ height: `${(b.count / peak) * 100}%` }} />
        ))}
      </div>
      <div className="dist-stats">
        <span>p5 {usd(dist.stats.p5)}</span>
        <span>median {usd(dist.stats.median)}</span>
        <span>p95 {usd(dist.stats.p95)}</span>
        <span className="oracle">oracle {usd(oracle)}</span>
      </div>
    </div>
  );
}

export default function StressCard({ params, mix, oracle }: { params: LabParams; mix: FleetMix; oracle: number }) {
  const stress = useStress();
  const [runs, setRuns] = useState(50);
  const [sigma, setSigma] = useState(0.25);
  return (
    <div className="card span-2">
      <h2>Stress test - P&amp;L under forecast error</h2>
      <div className="lab-form">
        <label className="stress-label">runs
          <input aria-label="runs" type="number" min={5} max={200} value={runs}
            onChange={(e) => setRuns(Math.max(5, Math.min(200, Number(e.target.value) || 50)))} />
        </label>
        <label className="stress-label">forecast noise {Math.round(sigma * 100)}%
          <input aria-label="noise" type="range" min={0.05} max={0.5} step={0.05} value={sigma}
            onChange={(e) => setSigma(Number(e.target.value))} />
        </label>
        <button className="primary" disabled={stress.running}
          onClick={() => stress.start(params, mix, runs, sigma)}>
          {stress.running ? `Run ${stress.result?.runsDone ?? 0}/${stress.result?.total ?? runs + 1}` : 'Run stress test'}
        </button>
      </div>
      <p className="stress-hint">Strategies trade real prices; each run perturbs the day-ahead forecast they plan on. Week-scale windows recommended.</p>
      {stress.running && <div className="lab-progress"><div style={{ width: `${stress.progress * 100}%` }} /></div>}
      {stress.error && <p className="lab-error">{stress.error}</p>}
      {stress.result && stress.result.dists.map((d) => <Distribution key={d.name} dist={d} oracle={oracle} />)}
    </div>
  );
}
```

CSS append:

```css
.dist { margin-top: 12px; }
.dist-name { font-family: var(--mono); font-size: 12px; color: var(--dim); margin-bottom: 4px; }
.dist-bars { display: flex; align-items: flex-end; gap: 2px; height: 64px; }
.dist-bars > div { flex: 1; background: linear-gradient(180deg, var(--cyan), var(--blue)); border-radius: 2px 2px 0 0; min-height: 2px; }
.dist-stats { display: flex; gap: 14px; font-family: var(--mono); font-size: 11px; color: var(--dim); margin-top: 4px; }
.dist-stats .oracle { color: var(--cyan); margin-left: auto; }
.stress-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--dim); }
.stress-hint { font-size: 11px; color: var(--dim); margin: 8px 0 0; }
```

- [ ] **Step 4:** `src/ui/lab/LabView.tsx` — the one render line, after the results card inside the existing `{lab.run && ...}` (plus the import):

```tsx
<StressCard params={lab.run.params} mix={mix} oracle={lab.run.oracle} />
```

- [ ] **Step 5:** Run green + capture to `docs/tdd/logs/36-stress-ui-green.txt`. Full checks. Manual: lab backtest on the heat-wave week, run stress at 50/25% — threshold bars form a spike, LP bars spread; histogram fills while running.
- [ ] **Step 6:** Commit: `git commit -m "feat: monte carlo stress card with streaming histogram"`

### Task 6.5: PR + merge

- [ ] **Step 1:** Push, PR `feat: monte carlo stress test`, merge after CI, reset main.

---

## Task 7: Wrap-up

- [ ] **Step 1:** `npm test; npm run typecheck; npm run lint; npm run build` on final main — all green.
- [ ] **Step 2:** Verify the deployed site picked up the last merge (CI deploy job) and the favicon/logo render on `https://fluxcore-30a.pages.dev`.
- [ ] **Step 3:** Confirm all six PRs show DBusch-Developer as author and the TDD log captures 29-36 are in `docs/tdd/logs/`.
