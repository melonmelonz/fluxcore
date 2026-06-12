# fluxcore — Two-Day Sprint Plan

**Sprint window:** 2026-06-10 → 2026-06-12 (demo day)
**Team:** Penn (PM / reviewer / domain ops) + Claude (engineering)
**Mission:** Ship a live, demoable virtual power plant arbitrage engine — real ERCOT prices, real strategies, real money left on the table — in two days, with strict TDD the whole way down.

> Written retroactively at sprint close. Every line item below shipped is backed by a commit, a red/green TDD log pair, or a live URL. Statuses are honest: done means verified in production, open means open.

---

## Sprint Goal

> **A stranger with a browser can watch a 200-home battery fleet trade the ERCOT real-time market — live, replayed, and backtested against a perfect-hindsight oracle — at `fluxcore.solutions`.**

Three pillars, in priority order:

1. **Correct physics and money.** Battery, solar, fleet, ledger, and strategies are pure, deterministic, unit-tested core code. One `deskTick` executor feeds all three consumers (replay, live desk, backtest) — one set of physics, no drift.
2. **Real data, owned forever.** Zero paid/capped APIs at runtime. ERCOT prices come from public reports and are write-through archived into D1 — the dataset grows itself every 15 minutes.
3. **A narrative the room can feel.** "The threshold bot made $22k. The optimizer made $17k. The oracle proves $25.7k was available. Here's the gap, and here's why."

---

## Epics

### Epic 1 — Simulation Core (Day 1 AM) — DONE

Strict red/green TDD for every module. Logs in `docs/tdd/logs/`, rendered in the README.

| # | Story | TDD logs | Commit |
|---|-------|----------|--------|
| 1.1 | Scenario types + boundary parser | 02 | `b81e091` |
| 1.2 | Battery state machine (rate/capacity/efficiency clamping) | 03 | `3a2e0b7` |
| 1.3 | Clear-sky solar generation profile | 04 | `c0215cf` |
| 1.4 | Fleet aggregation, proportional dispatch, free solar charging | 05 | `87314ca` |
| 1.5 | Market clock replay stepper | 06 | `8f3b2d9` |
| 1.6 | Threshold baseline strategy with breakeven guard | 07 | `790d761` |
| 1.7 | LP optimizer strategy over day-ahead horizon | 08 | `0d5903a` |
| 1.8 | Dispatch ledger with running P&L | 09 | `0733344` |
| 1.9 | Simulation controller with per-strategy lanes | 10 | `e8f0dae` |

**Acceptance (met):** deterministic replay of the 2023 Texas heatwave week — threshold `$22,116.69`, LP `$17,516.79`, byte-for-byte reproducible.

### Epic 2 — Data, UI, Brand, CI (Day 1 PM) — DONE

| # | Story | Evidence |
|---|-------|----------|
| 2.1 | Ingest script + bundled real ERCOT scenarios | `20f26e5`, log 11 |
| 2.2 | App shell, design tokens, simulation hook | `4975433` |
| 2.3 | Dashboard: live chart, dispatch markers, lane cards | `ed272ef`, log 13 |
| 2.4 | Brand: logo, favicon, vivid blue/cyan + orange palette | `302688f`, `b5b413d` |
| 2.5 | Strict security headers + eslint | `2787d87` |
| 2.6 | CI: test gate + Pages deploy on main | `6b9f4fd` |
| 2.7 | README with red/green screenshots for every module | `1e6cba9` |

### Epic 3 — Plan A: The Live Spine (Day 2 AM) — DONE

Spec: `docs/superpowers/specs/2026-06-11-fluxcore-full-app-design.md` - Plan: `docs/superpowers/plans/2026-06-11-fluxcore-live-spine.md`

Constraint honored: **zero gridstatus.io calls at runtime** (free-tier caps). ERCOT MIS public reports scraped directly; every point fetched is archived (see Epic 6).

| # | Story | TDD logs | Commit |
|---|-------|----------|--------|
| 3.1 | ERCOT MIS report parser, real-report zip fixtures | 20 | `866e275` |
| 3.2 | Rolling price cache merge (dedupe, age trim) | 21 | `530e7b2` |
| 3.3 | Shared `deskTick` executor + fleet state serialization | 22 | `e0d6cf6` |
| 3.4 | `fluxcore-desk` Worker: cron ingest, D1 archive, LiveDesk Durable Object | — | `6544b4b` |
| 3.5 | Same-origin Pages Functions API over KV + DO bindings | — | `1598938` |
| 3.6 | Live mode UI: desk polling hook, freshness badge | 23 | `f8b756a` |
| 3.7 | CI: worker/functions typecheck; worker deploy | — | `3b952a2` (deploy step blocked on token scopes — see Open Items) |

**Architecture note (lesson institutionalized):** CF Pages cannot declare Durable Objects inline; the DO lives in a sibling Worker bound via `script_name`.

### Epic 4 — Plan B: Backtest Lab + Oracle (Day 2 PM) — DONE

Plan: `docs/superpowers/plans/2026-06-11-fluxcore-backtest-lab.md`

| # | Story | TDD logs | Commit |
|---|-------|----------|--------|
| 4.1 | Historical archive: 96 monthly JSON chunks, 4 hubs, 2023-2024 (~12 MB, static) | — | `19a9fbb` |
| 4.2 | Perfect-hindsight oracle: 48h receding-horizon LP, SoC carryover, curtailable solar | 25 | `ce9ee7c` |
| 4.3 | Steppable max-speed backtest runner + "never beats the oracle" property test | 26 | `b7eaee0` |
| 4.4 | Lab date-range helpers + shareable URL codec (`#lab?hub=..&start=..&end=..`) | 27 | `c553ce3` |
| 4.5 | Lab UI: hub/date pickers, chunked progress, oracle table, "left on the table" | — | `a75bf34` |
| 4.6 | Deploy, screenshots, README "live spine and the lab" chapter | — | `e1de188` |

**Design call worth remembering:** a day-chunked oracle LP provably fails overnight carry (no motive to charge at 23:45 for tomorrow's spike). The fix — solve a 48h window, commit only day one, carry SoC — fell straight out of a failing test. TDD earned its keep here.

**Acceptance (met):** heatwave week in the Lab — threshold `$22,093.63` (85.8% of oracle), LP `$17,516.79` (68.0%), oracle `$25,748.79`. Share links cold-load and auto-run.

### Epic 5 — Production Hardening: The Imperva Campaign (Day 2, ongoing) — PARTIAL

ERCOT fronts MIS with Imperva. It serves Workers egress an HTML JS-challenge; residential IPs pass clean.

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| 5.1 | Pick newest `_csv` variant from doc list (defensive) | DONE | log 24, `959075b` |
| 5.2 | Cookie-jar retry helper: accumulating jar, browser headers, KV-persisted cookies | DONE (shipped, insufficient) | log 28, `02212ac` |
| 5.3 | Diagnosis: tail capture proves challenge defeats cookie replay on both attempts | DONE | `/tmp` tail evidence; root-caused to JS challenge (needs script execution, not cookie echo) |
| 5.4 | Egress probe: found `ercot.com/api/1/services/read/dashboards/systemWidePrices.json` returns **200 + full day of 15-min hub SPPs** to Workers egress | DONE | probe results; MIS list endpoint 500s/challenges |
| 5.5 | Switch RTM ingestion to dashboard JSON (parser + fallback chain) | **OPEN — top of day-3 backlog** | designed, not yet implemented |

**Demo posture meanwhile:** the desk fails closed and serves cached prices with an honest freshness badge; replay + Lab are fully self-contained and carry the demo regardless.

### Epic 6 — Self-Growing Archive — DONE

Every price point that ever reaches the worker is `INSERT OR REPLACE`d into D1. The historical Lab dataset (Epic 4.1) seeds 2023-2024; the cron grows it forward forever. No API caps, no vendor, no decay.

### Epic 7 — Launch Ops: Domain + Team (Demo day) — DONE

| # | Story | Status |
|---|-------|--------|
| 7.1 | Register `fluxcore.solutions` + `www` on Pages project via CF API (wrangler has no subcommand for this) | DONE |
| 7.2 | CF zone created; GoDaddy parked A records purged; apex CNAME-flattened to `fluxcore-30a.pages.dev` | DONE |
| 7.3 | Nameserver cutover GoDaddy -> Cloudflare (`liv`/`osmar.ns.cloudflare.com`), registry delegation verified at the TLD servers | DONE |
| 7.4 | Stuck cert validation root-caused (domains registered before zone existed); delete + re-add forced instant validation | DONE |
| 7.5 | End-to-end verify: apex + www 200, `/api/state` 200, archive index 200 | DONE |
| 7.6 | Collaborator audit: both partners confirmed write access | DONE |

**Canonical demo URL: `https://fluxcore.solutions`**

### Epic 8 — Diana's Feature Set (Day 2 -> Demo day, parallel track) — DONE

Designed in `docs/superpowers/specs` + planned in `docs/superpowers/plans` (2026-06-11 Diana set), delivered as 9 reviewed PRs (#1-#9), ~2,850 lines.

| # | Story | PR |
|---|-------|----|
| 8.1 | Brand assets: new logo crop, emblem-only vector favicon, header lockup | #1, #8, #9 |
| 8.2 | Storm mode: spike detection helper + spike-triggered UI shift with a11y badge | #2 |
| 8.3 | Battery wear dashboard: cycles, throughput totals, degradation dollars | #3 |
| 8.4 | One-click CSV/JSON export for dispatch log and lab runs | #4 |
| 8.5 | Fleet designer (was Plan D): unit catalog, presets, validated mix storage, capacity-weighted view, wired through replay desk AND backtest lab | #5 |
| 8.6 | Monte Carlo stress card: seeded PRNG, forecast noise model, steppable runner, streaming histogram | #6 |
| 8.7 | Keyboard shortcuts: space play/pause, 1/2/3 speed; control bar moved inline | #7 |

**Integration (merge day):** docs-only rebase, zero conflicts — the shared `deskTick`/lane architecture absorbed a fleet-mix dimension without touching core physics. One environment fix followed (`src/test/setup.ts`): Node >= 25's stub `localStorage` shadows jsdom's under vitest 4; an in-memory polyfill keeps the suite green on every machine and in CI.

---

## Sprint Metrics

| Metric | Value |
|---|---|
| Test suite | **136 tests, 28 files, all green** |
| TDD discipline | **20 red/green log pairs** (`docs/tdd/logs/02-28`), every core module test-first |
| Team throughput | 9 partner PRs reviewed + merged on demo eve; docs-only rebase, zero conflicts |
| Commits on main | 70+ — small, single-purpose, conventional |
| Deploys | Pages (app + Functions), Worker (cron + DO), D1, KV — all live |
| Historical data | 96 monthly chunks - 4 hubs - 2 years (~12 MB), growing every 15 min |
| Headline numbers | Threshold $22.1k - LP $17.5k - Oracle $25.7k (heatwave week) |
| Runtime API spend | $0 — no keyed/capped APIs anywhere in the hot path |

---

## Risk Log (as materialized)

| Risk | Hit? | Response |
|---|---|---|
| gridstatus free-tier caps | avoided | Direct MIS scraping + local pickle ingest; gridstatus only used offline to build the archive |
| Imperva blocks Workers egress | **HIT** | Cookie-jar + KV persistence shipped; root-caused as JS challenge; viable bypass found (dashboard JSON, probe-verified 200); swap queued |
| CF Pages can't host Durable Objects | hit early | Sibling Worker pattern, bound via `script_name` |
| Wrangler uploads stray heavy dirs | known from prior projects | Deploy from clean `dist` only |
| Day-chunked oracle under-bounds | **HIT (caught by test)** | 48h receding horizon, commit-first-day, SoC carryover |
| Domain cutover the night before demo | hit, survived | NS delegation watched at the registry; stuck validation fixed by re-registering domains against the active zone |
| Unicode in commit messages breaks Pages CI | avoided | ASCII-only commit discipline |

---

## Demo-Day Runbook (2026-06-12)

1. Open `https://fluxcore.solutions` — hard-refresh once (a GoDaddy parking service worker may linger in any browser that visited pre-cutover).
2. **Act 1 - Replay:** heatwave week, threshold vs LP lanes diverge, dispatch markers on the chart. End on the P&L: $22.1k vs $17.5k.
3. **Act 2 - Lab:** run the same week against the oracle. Punchline: even the winner left **$3.6k on the table** — point at the "left on the table" column.
4. **Act 3 - Share:** paste a share link (different hub/range) into a fresh tab — cold-loads and auto-runs. "Send your own backtest to anyone."
5. **Act 4 - Live:** show the live desk + freshness badge; narrate the self-growing D1 archive and the Imperva war story if asked about data sourcing.
6. Fallback URL if anything regional breaks: `fluxcore-30a.pages.dev` (identical deployment).

---

## Open Items (Day-3 Backlog, priority order)

1. **RTM ingestion via `systemWidePrices.json`** — parser (TDD), fallback chain `dashboard -> MIS -> fail closed`, backfills the whole current day per fetch. Unblocks true 15-min live trading.
2. CI worker deploy — needs `Workers Scripts:Edit` + `KV:Edit` + `D1:Edit` on the CI token (manual `npm run deploy:worker` meanwhile).
3. Plan C — strategy workshop (parameterized strategies, saved configs, leaderboard).
4. Plan D — fleet designer.
5. Render TDD logs 24-28 to PNGs for the README (raw logs linked meanwhile).

---

## Retro

**What went well**
- TDD wasn't ceremony — it caught the oracle's overnight-carry bug and the doc-list variant bug before either reached the demo.
- One `deskTick` for replay/live/backtest meant the Lab shipped in an afternoon with zero physics drift.
- Archive-everything turned an API-caps constraint into a permanent asset.

**What was hard**
- Imperva. Two escalations (retry, then cookie persistence) before accepting the challenge needs JS execution and pivoting to an egress probe — which found a cleaner door in 10 minutes. Lesson: when a bot wall wins twice, stop fighting the wall and map the building.
- DNS cutover under time pressure: registry-level verification (`dig @<TLD server>`) beat resolver-cache guessing every time.

**What we'd do differently**
- Probe ERCOT's public dashboard endpoints *first*, before building the MIS scrape path.
- Create the CF zone before registering Pages custom domains, so validation never lands in the stale state.
