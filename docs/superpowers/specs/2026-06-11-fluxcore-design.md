# fluxcore — Design Spec

**Date:** 2026-06-11
**Status:** Approved for implementation
**Timeline:** Build day 1 (today), test + rehearse day 2
**Team:** Penn + 2 partners. Evaluation: live demo + code review.

## 1. What it is

A virtual power plant (VPP) arbitrage engine. A simulated network of residential
solar-plus-battery homes is aggregated into one dispatchable power plant that
paper-trades real historical wholesale electricity prices (ERCOT), replayed as a
live feed at adjustable speed. Two strategies run side-by-side — a naive
threshold trader and an LP optimizer — and the dashboard shows the optimizer
winning in real dollars.

The pitch: "We aggregate 200 living rooms into a power plant, and it trades the
actual 2023 Texas heat wave."

## 2. Hard requirements

- **TDD is mandatory.** Every core module is built red-green-refactor. Commit
  history must show test-first ordering.
- **Enterprise-grade UI:** greys and blues, minimal, no wasted movement,
  mobile-first.
- **Secure by default / prod ready:** see Section 8.
- **Zero demo failure modes:** no runtime API dependency; all data bundled.
- **Team-ready repo:** GitHub (melonmelonz/fluxcore), protected main, PRs + CI
  gate, CI auto-deploy to Cloudflare Pages (fluxcore.pages.dev). Commit
  messages ASCII-only (wrangler-action constraint).

## 3. Architecture

Strict two-layer split:

```
src/core/   Pure TypeScript. Zero imports from React/DOM/browser APIs.
            Battery, fleet, solar model, market clock, strategies, ledger,
            scenario loader. 100% test coverage target.
src/ui/     React components. Consume core only through SimulationController.
scripts/    Data ingest script (one-time, produces bundled scenario JSON).
public/data/  Bundled scenario datasets (real ERCOT prices, processed).
```

The core runs identically in Vitest, Node, or the browser. The UI is a thin
shell over `SimulationController`.

### Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | React 18 + TypeScript (strict) + Vite | Team lingua franca; strict TS part of prod-ready story |
| Tests | Vitest | TDD mandate; fastest loop with Vite |
| Charts | TradingView lightweight-charts | Financial-grade time series, ~45kb, mobile-smooth, trading-desk aesthetic |
| LP solver | javascript-lp-solver | Pure JS, runs in browser and test runner, no WASM loading |
| Hosting | Cloudflare Pages (static) | Zero backend attack surface |
| CI/CD | GitHub Actions: typecheck, test, build, wrangler pages deploy on main | Any partner can ship by merging |

## 4. Domain core (build order, all TDD)

1. **`Battery`** — capacity (kWh), max charge/discharge rate (kW), state of
   charge, round-trip efficiency (~86%), degradation cost ($/MWh cycled).
   Pure state machine: `charge(kW, minutes)`, `discharge(kW, minutes)` return
   actual energy moved after constraint clamping.
2. **`SolarProfile`** — deterministic clear-sky generation curve per home
   (kW as a function of time of day and scenario season). Charging from solar
   is free energy; this is what makes residential arbitrage profitable.
3. **`Fleet`** — ~200 homes, each battery (Powerwall-class, 13.5 kWh / 5 kW)
   plus solar. Aggregate view: total available MW, total SoC, homes online.
   Dispatch fans out proportionally to per-home headroom.
4. **`MarketClock`** — replays 15-minute interval price data; emits ticks at
   1x to 3600x speed; pause/resume/seek.
5. **`ThresholdStrategy`** — rolling average + spread vs degradation cost.
   The honest baseline.
6. **`LPStrategy`** — linear program over a 24h day-ahead price horizon:
   maximize revenue subject to SoC bounds, rate limits, efficiency loss,
   solar input. Re-solved each hour as real-time prices diverge from
   day-ahead.
7. **`Ledger`** — every dispatch decision (timestamp, price, MWh, revenue or
   cost), cumulative P&L per strategy. Both strategies run simultaneously on
   cloned fleets for the side-by-side comparison.
8. **`SimulationController`** — composes all of the above; the single
   interface the UI consumes. Emits state snapshots on each tick.

## 5. Data

- Source: ERCOT historical real-time settlement point prices, HB_NORTH hub,
  15-minute intervals, plus day-ahead hourly prices for the LP horizon.
  Public download (ERCOT posts historical SPP reports; gridstatus as backup
  acquisition path).
- Three bundled scenarios: a violent 2023 heat-wave week, a calm
  shoulder-season week, and a winter event.
- `scripts/ingest/` converts raw downloads to compact scenario JSON committed
  to `public/data/`. The ingest script lives in the repo as evidence of data
  hygiene. No runtime API calls anywhere.

## 6. UI/UX

Mobile-first single column, widening to a desk layout at breakpoints:

1. **Price chart** (lightweight-charts) — real-time price line, day-ahead
   overlay, charge/discharge markers.
2. **P&L comparison strip** — threshold vs LP cumulative P&L, the headline
   numbers. Profit green is the single accent color.
3. **Fleet panel** — homes online, aggregate MW available, aggregate SoC,
   solar generation now.
4. **Decision log** — scrolling ledger entries ("14:35 discharged 0.8 MW @
   $312/MWh").
5. **Control bar** (bottom, thumb-reachable) — scenario select, play/pause,
   speed control.

Palette: slate/steel greys and blues, dark-friendly. Animation only where
data changes. No decorative motion.

## 7. Testing

- Vitest. Red-green-refactor for every core module, in the build order above.
- UI: smoke tests for SimulationController wiring and key components.
- CI gate: typecheck + full suite must pass before merge to main.
- Coverage target: core ~100%; UI smoke-level.

## 8. Security / prod-readiness

- Static site: strict CSP (no inline scripts), HSTS, X-Frame-Options: DENY,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy via Pages
  `_headers`.
- TypeScript strict; ESLint; lockfile committed; `npm audit` in CI; GitHub
  Actions pinned by SHA.
- No secrets in repo. Site is public (nothing to protect; effort goes into
  headers and supply chain).

## 9. Work split

- **Penn + Claude (critical path):** core engine, LP strategy, dashboard
  shell, CI/CD, deploy.
- **Partner A:** scenario data acquisition + ingest script + README and
  architecture docs for evaluators.
- **Partner B:** UI polish, mobile QA, decision log component, demo script
  for day-2 rehearsal.

Lanes are file-disjoint; all work lands via PR.

## 10. Out of scope (v1)

Live ERCOT polling, authentication, any backend, ML price forecasting,
ancillary services markets, battery thermal modeling. Each is a prepared
"here's how I'd add it" answer for the interview.

## 11. Demo narrative (day 2 rehearsal target)

1. Open fluxcore.pages.dev on a phone.
2. Select the heat-wave scenario, hit play at 600x.
3. Watch prices spike to $5,000/MWh; LP strategy pre-charged overnight and
   dumps at the peak; threshold strategy reacts late.
4. Point at the P&L gap. "Same batteries, same week, smarter math."
5. Code review: walk the core/ui boundary, the LP formulation, and the
   test-first commit history.
