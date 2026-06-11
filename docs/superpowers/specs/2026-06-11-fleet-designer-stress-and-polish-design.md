# Fleet Designer, Monte Carlo Stress, and Polish — Design Spec

**Date:** 2026-06-11
**Status:** Approved
**Author:** Diana (DBusch-Developer)
**Deadline:** features landed via PR before the 2026-06-12 demo
**Baseline:** `main` @ `d0d0845` (96 tests green, live desk + backtest lab shipped)

## 1. Context

Each team member contributes 2 large + 3 small features. This spec covers
Diana's set, chosen from the full-app design's Phase D ("stretch") and
Phase F idea bank to avoid colliding with the lead's lanes (live spine and
backtest lab are done; strategy workshop / Phase C is his next lane and is
explicitly out of scope here).

| # | Size | Feature |
| --- | --- | --- |
| 1 | Large | Fleet Designer — heterogeneous unit mixes |
| 2 | Large | Monte Carlo stress test — P&L distribution under forecast noise |
| 3 | Small | Storm mode — spike-triggered UI shift |
| 4 | Small | Battery wear dashboard — cycles + degradation dollars |
| 5 | Small | Data export — CSV/JSON of ledgers and lab results |
| 6 | Chore | Brand assets — new logo crop + vector favicon redraw |

Shared rules: strict TDD with red/green captures appended to
`docs/tdd/logs/` (numbering continues from 28); pure logic in `src/core/`,
thin UI in `src/ui/`; touches to teammates' files are additive-only; each
feature is its own branch and PR through the CI gate; ASCII-only commit
messages.

## 2. Feature 1 (large): Fleet Designer

The fleet stops being "200 identical Powerwall homes" and becomes a
designable portfolio, selectable via presets or a custom mix editor, used by
the replay desk and the backtest lab. The live desk (server-side Durable
Object) is untouched.

### Unit catalog — new `src/core/units.ts`

| Type id | Label | Battery | Solar | Availability |
| --- | --- | --- | --- | --- |
| `home` | Suburban home | 13.5 kWh / 5 kW charge / 5 kW discharge | 5 kW | always |
| `commercial` | Commercial unit | 100 kWh / 50 kW / 50 kW | none | always |
| `ev` | EV | 60 kWh / 11 kW / 11 kW | none | **unavailable 08:00-18:00 Central** |

All units share 0.86 round-trip efficiency and $20/MWh degradation cost.
`FleetMix = { type: UnitTypeId; count: number }[]`.

### Core changes (`src/core/fleet.ts`, additive)

- `Fleet.fromMix(mix, season)` alongside the existing `Fleet.uniform`
  (which keeps working unchanged — the lead's call sites are untouched).
- Unit spec gains optional `unavailable: { fromHour, toHour }` (hours in
  Central time, matching `hourOfDayCentral`; half-open interval
  `[fromHour, toHour)` — an EV is gone at 08:00 sharp and back at 18:00
  sharp).
- **Availability gating invariant:** `deskTick` calls
  `fleet.applySolar(hourOfDay, ...)` first on every tick; the fleet caches
  that hour and uses it to gate participation in `charge`/`discharge`.
  No signatures change; `desk.ts`, `backtest.ts`, and `controller.ts` need
  zero edits. An unavailable unit contributes no headroom, no SoC, and
  receives no solar. This invariant is documented on the method and pinned
  by a test.
- `FleetView` for mixed fleets: `roundTripEfficiency` and
  `degradationCostPerMWh` become capacity-weighted averages (identical to
  today's first-battery read for uniform fleets, so existing tests stay
  green). `homesOnline` counts currently *available* units — the panel
  visibly drops at 08:00 when EVs leave. `FleetPanel` label changes from
  "homes" to "units online".
- Lab oracle for mixed fleets: aggregate capacity/rates/solar are summed
  over the mix; availability is ignored by the oracle, which remains an
  explicit upper bound.

### UI

- New `src/ui/components/FleetDesigner.tsx` card: preset picker plus a
  custom editor (count stepper per unit type, live total MWh / MW readout).
- Presets: **Suburban 200** (default; exactly today's fleet),
  **Mixed Portfolio** (120 home + 10 commercial + 60 ev),
  **Commercial Campus** (20 commercial), **EV Heavy** (150 ev + 20 home).
- Mix is app-level state persisted to `localStorage`
  (key `fluxcore.fleetMix`, schema-validated on read, fall back to default
  on garbage). Feeds `plant.ts` (replay desk) and `useLab.ts` (replacing
  its hardcoded 200-home constant).

### Tests (red first, every one)

Catalog totals; `fromMix` construction; availability gating on/off the
window boundary (07:59 vs 08:00 vs 18:00); away units take no solar;
mixed-fleet weighted view math; uniform fleet view unchanged;
`FleetDesigner` rendered-output test; localStorage round-trip with invalid
JSON fallback.

## 3. Feature 2 (large): Monte Carlo stress test

One number per strategy becomes a distribution: strategies trade real RT
prices while each run perturbs the **day-ahead forecast** they plan
against. Threshold ignores forecasts (tight distribution); the LP plans on
them (wide distribution). The chart is the project's thesis — "optimization
is only as good as its forecast" — as a picture.

### Core — new `src/core/montecarlo.ts`

- Seeded PRNG (mulberry32) and a Box-Muller normal helper; zero
  dependencies; fully deterministic per seed.
- Noise: each DAM price becomes `price * (1 + sigma * z)`, sigma
  configurable, default 0.25. Works with negative prices.
- Steppable `MonteCarlo` runner wrapping the existing `Backtest` class
  unchanged: run 0 is the unperturbed baseline, then N perturbed runs
  (default 50), each on a fresh fleet from the same `fleetFactory` —
  composes with Feature 1 mixes for free.
- Results per strategy: every run's P&L, summary stats
  (min / p5 / median / p95 / max / mean), histogram bins.

### UI — new `src/ui/lab/StressCard.tsx` + `useStress.ts`

- Renders in the Lab tab after a backtest run completes, reusing that run's
  window, hub, and fleet. Only touch on the lead's code: one render line in
  `LabView.tsx`.
- Controls: run count, sigma slider. Results stream run-by-run with a
  progress bar (same setTimeout-yield pattern `useLab` uses).
- Display: CSS-bar histogram per strategy (no new chart dependency), stat
  strip, oracle P&L drawn as a reference line.
- Performance note: 50 runs x 1 week is seconds; long windows crawl. No
  hard cap; the card recommends week-scale windows in its helper text.

### Tests

Same seed reproduces identical distributions; sigma 0 makes every run equal
the plain backtest; threshold spread ~0 while LP spread > 0 (the thesis,
pinned); percentile/stat math on known arrays; histogram binning edges;
StressCard rendered-output test.

## 4. Feature 3 (small): Storm mode

- Threshold: `STORM_PRICE = 500` ($/MWh). Pure helper `isStorm(price)` in
  `src/ui/storm.ts`, unit tested.
- `App.tsx` (replay desk) and `LiveView.tsx` toggle a `storm` class on the
  app root from the latest RT price.
- CSS (`styles.css`): price line shifts to brand orange (via a color prop
  on `PriceChart`), scenario/LIVE badge pulses slowly, card borders warm.
  All transitions data-driven; wrapped in `prefers-reduced-motion` guard.

## 5. Feature 4 (small): Battery wear dashboard

- `Ledger` gains tested running totals: `mwhCharged`, `mwhDischarged`
  (additive getters, no behavior change).
- New pure `wearStats({ mwhDischarged, capacityMWh, degradationCostPerMWh })`
  in `src/core/wear.ts`: equivalent full cycles (discharged / capacity) and
  accrued degradation dollars (discharged x rate). TDD.
- New `src/ui/components/WearPanel.tsx` desk card: both strategies side by
  side — cycles and wear dollars. Reads from the existing snapshot plus the
  new ledger totals (exposed through the snapshot additively).

## 6. Feature 5 (small): Data export

- New `src/ui/export.ts`: pure serializers — `ledgerToCSV(entries)` and
  `labRunToCSV/JSON(run)` (parameters + per-strategy results + oracle).
  Proper CSV quoting/escaping, ISO-8601 timestamps. TDD against fixtures.
- Download via Blob object URL + anchor `download` attribute (no server,
  no CSP change needed). Filenames:
  `fluxcore-dispatch-<scenario>-<date>.csv`, `fluxcore-lab-<hub>-<range>.csv`.
- UI: one button on the dispatch-log card, one on the lab results card.

## 7. Chore: brand assets

- **Logo:** crop the supplied 1536x1024 render to the symbol + wordmark
  lockup with even padding (keeping the glow), commit at ~720px wide as
  `public/brand/fluxcore-logo.webp` (PNG fallback with reference updates if
  webp conversion tooling is unavailable; the README header is the only
  consumer).
- **Favicon:** hand-rebuilt vector at `public/favicon.svg` (already linked
  by `index.html` — no code change): circular swoosh ring with top-right
  gap, 3x3 solar panel bottom-left, battery + bolt right-of-center, orange
  chart line with dots rising into an arrowhead breaking out of the circle.
  Colors sampled from the logo (vivid blue / cyan / deep navy / signal
  orange) on the existing dark rounded-square backplate. Reviewed
  iteratively in the browser; no unit tests apply to assets, build must
  stay green.

## 8. Out of scope

Live desk (Durable Object) fleet changes; strategy workshop / saved configs
/ leaderboard (lead's Phase C lane); regret chart; any change to the lead's
strategies, worker, or API surface beyond the single render line in
`LabView.tsx`.

## 9. Suggested build order

1. Brand assets (fast, independent, immediately visible)
2. Smalls 3-5 (guaranteed credit early; all independent)
3. Fleet Designer (unlocks the fleet factory for stress runs)
4. Monte Carlo stress test (composes with 3)

Order is a plan-phase decision; features are independent except Monte Carlo
benefiting from Fleet Designer landing first.
