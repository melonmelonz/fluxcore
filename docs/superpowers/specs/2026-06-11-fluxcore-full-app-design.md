# fluxcore Full App Design — from demo to living grid-trading laboratory

Date: 2026-06-11
Status: approved direction ("do it all"), demo deadline 2026-06-12

## 1. Product identity

fluxcore becomes a **living grid-trading laboratory**: robot strategies trade
the real Texas grid 24/7 with honest money math; anyone can backtest years of
history, tune strategies, design battery fleets, and watch the live desk.
Portfolio-grade depth, public-tool polish. The existing simulator (replay
engine, two strategies, enterprise grey/blue UI) is the seed, not a rewrite.

## 2. Architecture

Monorepo, two deployables plus a shared engine:

```
apps/web        React frontend (CF Pages) — current app evolves into this
apps/api        CF Worker: REST API + cron ingest + LiveDesk Durable Object
packages/core   the existing pure-TS engine (zero browser deps), shared by both
```

- **`LiveDesk` Durable Object** — the always-on trader. One DO instance per
  hub. A 5-minute alarm wakes it: read latest cached price, run every
  registered strategy against its persistent cloned fleet, book dispatches to
  its ledger (DO storage), roll up daily P&L to D1. Survives deploys and
  restarts; P&L is forever.
- **D1** — dispatch history, daily P&L rollups, saved strategy configs,
  leaderboard.
- **KV** — rolling live price cache: last 7 days of RTM (5-min), current +
  next-day DAM (hourly), per hub.
- **Static assets (Pages)** — the entire historical archive, pre-generated
  (Section 3). No R2 needed at current sizes.

Frontend talks only to same-origin `/api/*` (Pages Functions routing proxies
to the Worker, or Worker route on the same domain) — the strict CSP
(`connect-src 'self'`) is unchanged.

### API surface (v1)

```
GET  /api/prices/live?hub=HB_NORTH          rolling RTM + DAM from KV, with lastUpdated
GET  /api/desk?hub=HB_NORTH                 live desk state: per-strategy P&L, SoC, recent dispatches
GET  /api/desk/history?hub=...&days=30      daily P&L rollups from D1
GET  /api/leaderboard                       live configs ranked by P&L
POST /api/configs                           save a strategy config (named, validated)
POST /api/desk/submit                       submit a saved config to the live desk
```

All inputs schema-validated at the boundary (same `parseScenario` discipline).
Rate-limited per-IP on the POST routes.

## 3. Data strategy — zero gridstatus.io API at runtime, ever

- **Historical (backtest lab):** one-time local ingest using the existing
  Python script and the annual gridstatus pickles already cached in /tmp,
  extended to pull additional years/hubs locally (the gridstatus *library*
  scraping ERCOT directly is uncapped; only the hosted gridstatus.io API has
  caps, and we never call it). Output: per-month JSON chunks
  (`/data/archive/{hub}/{YYYY-MM}.json`, ~60 KB each, same PricePoint schema)
  for ERCOT hubs HB_NORTH, HB_HOUSTON, HB_WEST, HB_SOUTH, 2019 through
  present. Shipped as static files. Backtests run entirely client-side
  against them: no API calls, no caps, cannot fail during the demo.
- **Live (the desk):** Worker cron scrapes **ERCOT's own public MIS reports**
  directly (the same endpoints the gridstatus library uses — no key, no
  signup): RTM settlement point prices every 5 minutes, DAM once daily after
  publication. ~300 small requests/day. Reports are zipped CSV; unzip with
  fflate in the Worker. Parser is TDD'd against a checked-in fixture from a
  real downloaded report.
- **Failure mode:** if ERCOT is unreachable, `/api/prices/live` serves the
  last KV cache with its `lastUpdated` stamp; the UI shows a quiet "stale"
  badge. The desk simply skips a tick. The demo can never hard-fail on a
  feed hiccup.

## 4. Features by phase

### Phase A — the live spine (tonight, highest risk first)

- MIS scrape module in the Worker: doc-list JSON -> latest zip -> CSV ->
  PricePoint[], hub-filtered. TDD against fixture.
- Cron (`*/5 * * * *`): refresh RTM cache; daily cron for DAM.
- KV cache layout: `prices:{hub}:rtm` (rolling 7d), `prices:{hub}:dam`.
- `LiveDesk` DO with alarm loop; engine consumed from packages/core unchanged
  — a `LiveClock` adapter appends arriving points instead of stepping a fixed
  array; strategies and fleets are reused as-is.
- Frontend LIVE mode: hub entry "Live — ERCOT HB_NORTH" in the scenario
  picker; real-time ticker, live P&L ("up $X since <launch date>"), live
  dispatch log, lastUpdated/stale indicator.

### Phase B — backtest lab (tonight / tomorrow morning)

- Archive ingest run + chunked static data committed.
- Lab UI: hub picker, date-range picker (any window 2019–present), strategy
  selection; runs client-side on the existing replay engine at max speed
  (no animation — compute-and-render-results path alongside the animated
  player).
- **Oracle benchmark**: perfect-hindsight LP over the entire selected window
  (it sees actual future RT prices). Every strategy result is scored as
  **% of theoretical max**. Implemented in packages/core, TDD.
- Side-by-side comparison table; shareable result URLs (all parameters
  URL-encoded; results recompute deterministically on load).

### Phase C — strategy workshop (tomorrow morning)

- Parameterized strategies surfaced in UI: threshold band width, rolling
  window, min samples; LP horizon, re-solve cadence; shared: degradation
  cost, fleet size/spec.
- Named configs saved to D1 via `/api/configs`; configs runnable in the lab
  and submittable to the live desk.
- Leaderboard page: live configs ranked by P&L (daily rollups), with age so
  young configs aren't oversold.

### Phase D — fleet designer (stretch for demo; specced fully)

- Heterogeneous fleets: unit types = Powerwall home (13.5 kWh / 5 kW /
  5 kW solar), commercial unit (100 kWh / 50 kW / no solar), EV (60 kWh /
  11 kW, availability window e.g. unavailable 08:00–18:00).
- `Fleet` generalizes from uniform constructor to a unit-mix spec
  `{ type, count }[]`; proportional dispatch logic already generalizes (it
  fans out by headroom/SoC, which heterogeneous units report naturally).
  Availability windows gate a unit's participation per tick.
- Fleet presets + custom mix editor; fleets usable in lab and live desk.

### Phase E — post-demo roadmap (specced, not built for the demo)

- Price-spike web-push alerts (VAPID via Worker).
- Magic-link accounts (configs/fleets sync across devices); until then,
  configs are public-anonymous with display names.
- Multi-ISO: CAISO, PJM hubs via the same local-ingest path; live scraping
  per-ISO added incrementally.
- Scheduled email digests of desk performance (MailChannels).

### Polish (woven through A–C)

- Onboarding tour: three cards explaining VPPs, arbitrage, and the two
  strategies, shown once (localStorage).
- Hub switcher in the header; keyboard shortcuts (space = play/pause,
  1/2/3 = speed); same enterprise grey/blue aesthetic everywhere.

## 5. Demo sequence (2026-06-12)

"This desk has been trading the real Texas grid since last night — here's its
actual P&L, here's the dispatch it made at 3 a.m. Now rewind to the 2023 heat
wave: the simple threshold strategy beats the LP optimizer, and the oracle
says both left $9k on the table — optimization is only as good as its
forecast." Live + historical + benchmark in 90 seconds, with the lab and
workshop available for Q&A spelunking.

## 6. Engineering discipline (unchanged)

- **Strict TDD continues**: engine changes, MIS parser, Worker handlers, DO
  logic — test-first with red/green captures accruing to docs/tdd/ and the
  README. Worker/DO tested with @cloudflare/vitest-pool-workers.
- Strict CSP retained; all new inputs validated at boundaries; POSTs
  rate-limited; no secrets in the frontend (the MIS scrape needs none).
- CI extends to typecheck/lint/test across the monorepo and deploys web +
  worker, both gated on the test job; actions stay SHA-pinned.

## 7. Risks and mitigations

- **DO + cron + MIS scrape is the most new-tech-in-one-night item** → built
  first (Phase A), TDD'd against fixtures; if it slips, Phases B/C still
  transform the app and demo.
- **MIS report format is crusty** (zipped CSV, occasional schema drift) →
  pinned real fixture; parser fails closed (skip tick, serve cache).
- **DAM publication timing** (afternoon, next-day) → LP on the live desk uses
  latest available DAM and is honest in the UI about forecast age.
- **D1/KV/DO free-tier limits** → usage is tiny (one DO, ~300 reads/day,
  rollups daily); nowhere near limits.

## 8. Out of scope

Real-money trading, ERCOT market participation, telemetry from physical
batteries, mobile apps, SSR.
