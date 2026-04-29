# Tractova — 4-Week Premium Buildout Plan

> Last updated: April 28, 2026
> Status: V3 (Editorial Intelligence) BUILD DAY 1 COMPLETE. See `Tractova_V3_Plan.md` for current build plan.

---

## V3 Build Log (April 28, 2026)

Spent the day taking the product from "polished V2" through a full "Editorial Intelligence" V3 redesign + bug-fix sweep + recurring-engagement scaffolding. Everything is on `origin/main` and Vercel-deployed. See `Tractova_V3_Plan.md` for the live status snapshot.

### Shipped today (in commit order)
- **`742a12f`** V2 Phase 1 + V3 foundations — design tokens (brand navy `#0F1A2E`, teal `#14B8A6`, paper `#FAFAF7`, ink, feasibility ramp), Source Serif 4 + JetBrains Mono fonts, sensitivity AI action, signal cleanup, scenario $ + months quantification.
- **`704dd8d`** Step 2 — Dashboard tabbed StateDetailPanel (Program/Market/Subscribers/News), 5-bucket teal choropleth, Market Pulse AI summary in NewsFeed.
- **`ae8c3d3`** Step 3 — Library: dropped redundant Avg Score + Risk Spread widgets, added Risk Concentration widget, pipeline filter-on-click + 180-day stale flag, CSV → 18 cols, Deal Memo Generator (`action: 'deal-memo'`).
- **`ca58114`** Step 4 — Profile two-column layout, toggle dot fix, good-news alert toggle (migration 010), Glossary 7 V2 + 3 V3 platform terms.
- **`3b9c62e`** Step 5b — Brand rollout to Nav (Source Serif 4 wordmark + navy/teal mark), Footer, MetricsBar (navy chrome), USMap (teal palette).
- **`e5ab968`** Step 5c — Library institutional depth (navy hero banner, paper bg, navy stat-strip rails, navy WeeklySummary header). Profile banner gradient updated. UpgradePrompt + SignIn + SignUp V3 palette.
- **`8b8359d`** Save-to-Library hardening — surfaces DB errors inline; re-fetches session at click time; mw cast to number.
- **`ba1e6ad`** Landing palette — hero/final-CTA navy, monospace metrics, serif headlines, teal CTAs.
- **`d2cf23c`** Step 6 — migration `011_projects_columns_backfill.sql`, Landing How-it-works connector with chevron arrows, Lens theme rollout.
- **`c29cb83`** Schema-cache-resilient save handler — detects PostgREST "column not found" and retries without that field. Save works whether or not migration 011 ran.
- **`2c1a048`** Lens redesign (Editorial Intelligence) — used the frontend-design plugin to commit to a Bloomberg/Linear/Stripe aesthetic. Tachometer ArcGauge, terminal-style SubScoreBar with █ glyph segments, Source Serif 4 drop-cap on AI brief, mono eyebrow strips, side-rule AI tiles, ticker-tape signal strip, numbered editorial pillar headers (`01 / OFFTAKE`).
- **`4c7d903`** Step 7 Session A — Lens form chrome navy/teal (was dark emerald), ArcGauge clipping fix, SubScoreBar reorder, methodology tooltip clamp, pillar order reflow (Offtake → IX → Site Control left-to-right), **sensitivity-on-gauge architecture** (lifted state to SearchContent, toggle row sits below gauge, gauge animates to new score in place with delta indicator).
- **`c05f055`** SubScoreBar overflow fix — "INTERCONNECTION" was 148px wide overflowing a 100px container. Switched to CSS grid with `minmax(0, max-content)`; weight inlined next to label as gray meta.
- **`9ea468e`** ArcGauge spacing — viewBox 180×118, 5 majors at 0/25/50/75/100 instead of 11 ticks, generous breathing room.
- **`1da46f6`** Step 7 Session B — Glossary full revamp (navy hero, serif term titles, V3 pillar palette), Library legacy cleanup (filter+sort emerald → teal, project card names serif, **pipeline distribution stage ramp swapped from hardcoded emerald to V3 feasibility teal tokens**), Admin V3 pass.
- **`eae38f1`** Library follow-ups — alerts chip readability (deeper text colors with leading status dot), StagePicker dropdown clipping fix (drop overflow-hidden when collapsed; z-[100]), pipeline stage labels readable (separated label color from bar color so very-light teal stages still have ink labels).
- **`e76e14e`** Hybrid placeholder copy — Alaska/Hybrid no longer says "Enter project MW" when MW is entered. Distinguishes "MW missing" from "state has no seeded model" and names the coverage gap.
- **`45d1e91`** V3 Wave 1.1 + 1.2:
  - **1.1** New `ix_queue_snapshots` table (migration 012) + cron now appends snapshots alongside the existing upsert into `ix_queue_data`. Foundational for the Wave 2 IX Queue Forecaster (P50/P90 study completion modeling needs ≥12 weeks of trajectory).
  - **1.2** Weekly digest + policy alert email templates rebranded to V3 — brand navy header with teal/amber accent rail, Source Serif 4 "Tractova" wordmark, JetBrains Mono caps for project meta, deeper alert chip text colors, V3 teal CTA. Digest gains a Tracked / Capacity / States meta strip with hairline rules — reads like a Bloomberg portfolio summary.

### Pending Supabase migrations to run in SQL editor
- `010_alert_positive.sql` — Profile good-news toggle persistence (app handles missing column gracefully)
- `011_projects_columns_backfill.sql` — restores all Library project columns (save handler self-heals if not run)
- `012_ix_queue_snapshots.sql` — enables IX queue history accumulation (foundational for Wave 2)

### Where to pick up tomorrow
See `Tractova_V3_Plan.md` "Status Snapshot" section at the top for next-session priority list. P1 is **V3 Wave 1 remainder** (Slack alerts via webhook, derived metrics, "Markets-on-the-move" digest enrichment). P2 is deferred Step 7 polish (Lens Zone refactor, form component extraction, Deal Memo shareable URL, status thread audit log).

### Surfaces audit — fully V3-cohesive
Dashboard · Lens (form + results) · Library · Glossary · Profile · Compare · Sign-in/up · Upgrade · Landing · Admin · Email templates (digest + alerts).

### Infra constraints holding
- Vercel Hobby: 11/12 functions (no upgrade needed — all new AI actions multiplex through `lens-insight.js`)
- Supabase Free
- Anthropic Sonnet 4.6 only (Opus 4.7 reserved for future Premium tier Deal Memos)
- Resend Free (3K/mo)
- **Net infra cost increase from V3 Day 1 work: $0/mo**

---

## (Pre-V3 logs preserved below)

### Progress Log
- **Week 1** (commit 562627a): All placeholder text removed, typography unified, revenue colors overhauled (ITC→blue, credits→emerald, REC→violet), Profile page upgraded with avatar banner + recent activity, Library dark theme refined with column divider + bordered sections + stronger alerts, Landing page pricing + freshness added, bidirectional nav (Library→Lens carries all params) pulled forward from Week 4. **COMPLETE.**
- **Week 2** (commits c852301 + 76f63de): Revenue engine expanded with C&I PPA model (8 states), BESS capacity/demand/arbitrage model (8 states), and Hybrid combined model. Score engine updated with tech-aware offtake (retail rate tiers for C&I, capacity market tiers for BESS), IX modifiers (BESS +5, Hybrid -5), and site adjustments (BESS needs less land). Offtake card rebuilt: C&I shows PPA rate vs retail savings, BESS shows 3-stream revenue tiles (capacity/demand/arbitrage) with payback, Hybrid shows solar+storage split with ITC co-location bonus. Tech-specific scenarios added (C&I: PPA drop/rate rise/offtaker default; BESS: capacity drop/degradation/demand increase; Hybrid: ITC drop/solar clipping). AI prompt updated with tech-aware rules (#12, #13) and tech-specific revenue context in buildContext. **COMPLETE.**
- **Week 3** (commit 20b727c): "Feasibility Score" → "Feasibility Index" renamed across all surfaces (Search, Library, CompareTray, Glossary, PDF Export). Methodology info popover added to MarketPositionPanel. Sub-score breakdown bars (Offtake/IX/Site with weights) added to Library expanded cards. AI output schema expanded from 4→6 fields (added stageSpecificGuidance, competitiveContext). max_tokens increased 900→1200. IX queue data (project count, MW pending, per-utility breakdown) now fed into AI context. Quantified scenario impact chips (revenue cost + timeline) added to IX scenarios. **COMPLETE.**
- **Week 4** (commit 20b727c): Auto-submit when all URL params present (Library→Lens roundtrip with auto-analysis). "What Changed" blue dot badges on Library cards when state data updated since save. Portfolio update banner ("X projects have updated data · Y alerts"). Weekly Summary card (portfolio health, market signals, action items) for users with 3+ projects. Compare Tray enhanced with "Open in Lens" action per column and auto-generated "Best For" summary. **COMPLETE.**
- **Gap items** (commit 34fd46c): Site Control enriched with Hosting Capacity tile (derived from IX ease score), population density badge, serving-utility substation highlighting + voltage context. Custom Scenario builder with IX/CS dropdowns + live index impact. Library "Your Deal" section made collapsible with "Saved X days ago" timestamp. **COMPLETE.**
- **Bugfix** (commit e198ff9): Fixed white screen crash after Lens loading overlay. Root cause: `CustomScenarioBuilder` inside `MarketIntelligenceSummary` referenced bare `technology` variable that doesn't exist in that scope (parent receives `form`, not `technology`). Caused `ReferenceError` at runtime when scenarios rendered. Fixed to `form.technology`.
- **Bug audit** (April 23): Full scan across all pages. Fixes applied: (1) Feasibility Index tooltip repositioned from `bottom-full` to `top-full` and removed `overflow-hidden` from parent to prevent clipping. (2) SiteControlCard and InterconnectionCard null guards added — prevents crash when countyData is null. (3) Library: moved `const current` above `handleExportPDF` (used-before-defined), added savedAt null guard in YourDealSection. (4) Profile: added session null guard in ManageBillingButton. (5) Glossary: completed "Feasibility Score" → "Feasibility Index" rename. (6) metrics.js: corrected statesWithAnyCS from 18 → 19.
- **Hybrid Data Pipeline — Phase 1** (April 24-25): IX queue data migrated from hardcoded `ixQueueEngine.js` to Supabase table `ix_queue_data`. New migration `002_ix_queue.sql` (table + RLS) and seed `002_ix_queue_seed.sql` (12 utilities across 8 states). `programData.js` extended with `getIXQueueData()`, `getIXQueueSummary()`, `hasIXQueueData()`. Search.jsx updated from sync import to async pre-fetch in `handleSubmit`. Weekly cron scraper `api/refresh-ix-queue.js` fetches from MISO/PJM/NYISO/ISO-NE, runs Sunday 6AM UTC.
- **Hybrid Data Pipeline — Phase 2** (April 24-25): Admin data editor at `/admin`, gated by email check. 5 tabs: State Programs, Counties, Revenue Rates, News Feed, IX Queue. All use list→detail card UI pattern with `Field` component. Revenue rates table created (`003_revenue_rates.sql` + seed for 8 states with CS/C&I/BESS fields). `programData.js` extended with admin write helpers (`updateStateProgram`, `updateCountyIntelligence`, `upsertNewsItem`, etc.) and bulk read functions. Admin link added to Profile page (visible only to admin). Route added in App.jsx.
- **Hybrid Data Pipeline — Phase 3** (April 25): All static data imports eliminated. Landing.jsx, Footer.jsx, MetricsBar.jsx migrated from `data/metrics.js` and `data/statePrograms.js` to async `getStatePrograms()`/`getDashboardMetrics()` via useState/useEffect. `substationEngine.js` rewritten from hardcoded SUBSTATIONS object to async `getSubstations()` via new Supabase table. Search.jsx pre-fetches substations in `handleSubmit` alongside other data calls. New migration `004_substations.sql` + seed (48 substations across 8 states). Orphaned static files deleted: `metrics.js`, `statePrograms.js`, `newsFeed.js`, `countyData.js`. Bundle size dropped 821kB → 801kB.
- **Hybrid Data Pipeline — Phase 4** (April 25): Monthly substation refresh cron `api/refresh-substations.js`. Queries EIA API v2 for plant-level data, filters to tracked states, upserts to `substations` table. Runs 1st of each month (6AM UTC). Graceful per-state failure handling. Requires `EIA_API_KEY` env var (optional — skips gracefully if not set). Vercel cron entry added.
- **Library light theme + dashboard bugs** (commit 9c00f03, April 25): Full dark→light theme conversion of Library.jsx (~80 inline style changes). Page background #0C1220 → bg-surface, all cards → bg-white border-gray-200, all rgba(255,255,255,...) text → gray-{400-900} Tailwind classes. Fixed invisible filter dropdowns (white-on-white option elements). MetricsBar stale data warning muted from yellow to neutral gray. Updated `get_dashboard_metrics()` RPC to compute IX Headroom and Policy Pulse from live `ix_queue_data` and `news_feed` tables (new migration 005_dashboard_metrics_v2.sql). Footer.jsx dark-mode library check removed.
- **Data ops: Phases 1-3** (commit 599c61f, April 25): Fixed broken substations audit logging (wrong column names in data_updates insert). Fixed cache invalidation — all admin write helpers now target specific cache keys instead of nuking everything; added wildcard prefix support (`county:*`, `ix_queue:*`). New `cron_runs` table (migration 006) tracks every cron execution with status, duration, and summary JSONB. New `get_data_freshness()` RPC returns staleness metrics for all tables + last cron runs in one call. Both cron handlers now log to `cron_runs`. Added data validation: IX queue flags >50% drops and skips ISOs returning 0 rows; substations skips rows outside US bounds or with capacity >5000 MW. Warnings stored in `cron_runs.summary.warnings`.
- **Data ops: Phases 4-5** (April 25): Admin "Data Health" tab added as 6th tab in Admin panel. Three sections: (1) Freshness Grid — 6 cards showing row count, last-updated age, green/yellow/red staleness indicator per table; (2) Cron History — table of last 20 cron runs with status badge, duration, changes, warnings; (3) Recent Changes — last 30 `data_updates` rows with old→new diff, source badge (scraper vs admin). New serverless endpoint `api/data-health.js` serves admin-only data using service role key with JWT auth. Weekly staleness notification cron `api/check-staleness.js` runs Monday 8AM UTC — checks all 6 tables against freshness thresholds and emails admin via Resend if any are stale/overdue. Vercel cron entry added.
- **Data ops: Phase 6** (April 26): Expanded automated data refresh with two new sources. (1) EIA retail electricity rates — added to monthly substation cron (`refresh-substations.js`). Fetches state-average commercial retail rates from EIA `electricity/retail-sales` endpoint, writes to `revenue_rates.ci_retail_rate_cents_kwh` for C&I PPA model comparisons. Logs changes to `data_updates`. (2) NREL PVWatts capacity factors — new quarterly cron (`api/refresh-capacity-factors.js`). Fetches location-specific solar capacity factors from NREL PVWatts API v8 using representative lat/lon per state. Writes to both `capacity_factor_pct` and `ci_capacity_factor_pct` in `revenue_rates`. Validates range (10-30%), logs changes. Runs quarterly (Jan/Apr/Jul/Oct 1st). Both require API keys: `EIA_API_KEY` (already set) and `NREL_API_KEY` (free from developer.nrel.gov).

### Data Pipeline Summary

All market intelligence data now served from Supabase with 1-hour TTL cache in `programData.js`:

| Data | Source Table | Refresh | Admin Editable |
|------|-------------|---------|----------------|
| State programs (19 states) | `state_programs` | Manual (admin UI) | Yes |
| County intelligence (~150 counties) | `county_intelligence` | Manual (admin UI) | Yes |
| Revenue stacks | `revenue_stacks` | Manual (admin UI) | Yes |
| Revenue rates (CS/C&I/BESS) | `revenue_rates` | Manual (admin UI) | Yes |
| IX queue data (12 utilities) | `ix_queue_data` | Weekly cron (Sunday) | Yes (overrides until next scrape) |
| Substations (48 across 8 states) | `substations` | Monthly cron (1st) | No (EIA source) |
| News feed | `news_feed` | Manual (admin UI) | Yes |
| Dashboard metrics | `get_dashboard_metrics()` RPC | Live (computed) | N/A |

**Pending SQL migrations to run in Supabase:**
- `005_dashboard_metrics_v2.sql` — updates `get_dashboard_metrics()` RPC for IX Headroom + Policy Pulse
- `006_cron_runs.sql` — creates `cron_runs` table + `get_data_freshness()` RPC

### Data Ops — Remaining Phases (Phases 1-3 shipped, 4-7 pending)
- ~~Phase 1: Fix substations logging + cache invalidation~~ **DONE** (commit 599c61f)
- ~~Phase 2: Cron observability — `cron_runs` table + `get_data_freshness()` RPC~~ **DONE** (commit 599c61f)
- ~~Phase 3: Data validation — sanity checks in scrapers~~ **DONE** (commit 599c61f)
- ~~Phase 4: Admin "Data Health" tab — freshness grid, cron history, change log~~ **DONE**
- ~~Phase 5: Weekly staleness notification email to admin~~ **DONE**
- ~~Phase 6: Expand automated refresh (EIA retail rates, NREL capacity factors)~~ **DONE**
- ~~Phase 7: Retention policies, staging workflow, export/backup~~ **DONE**
See full plan: `.claude/plans/cheerful-seeking-adleman.md`

**Phase 7 details:**
- **7A — Data retention**: Weekly staleness cron now prunes `data_updates` >1 year and `cron_runs` >6 months
- **7B — Staging workflow**: `state_programs_staging` table now active. New `api/staging.js` endpoint + Admin "Staging" tab. Scrapers/bulk imports write to staging → admin reviews diff → approve (promotes to live) or reject
- **7C — Export/backup**: `api/export.js` endpoint downloads full JSON snapshot of all 7 data tables. Export button in Data Health tab

**Environment variables to add (optional):**
- `EIA_API_KEY` — enables monthly EIA data refresh for substations. Get from https://www.eia.gov/opendata/register.php
- `NREL_API_KEY` — enables quarterly capacity factor refresh. Get free from https://developer.nrel.gov/signup/

---

## Context & Strategic Assessment

Tractova is a community solar market intelligence SaaS targeting $10-20/mo recurring subscriptions from small independent solar developers (1-10 person shops). Three features shipped as pre-work before this plan began:

1. **Revenue calculator** (commit e6db332) — $/MW projections for 8 CS states
2. **IX queue intelligence** (commit bcc186e) — real queue data with per-utility breakdown for 8 states
3. **Substation proximity** (commit bd8a839) — nearest substations by distance in Site Control card for 8 states

### The Moat (What's Genuinely Hard to Replicate)

| Asset | Reproducibility | Strategic Value |
|-------|----------------|-----------------|
| **County-level site intelligence** (150+ counties, 18 states) | 50-80 hours per state | **HIGH** — expert curation, not available elsewhere |
| **Per-utility IX queue breakdowns** (16 utilities across 8 states) | 8-12 hours per state (ISO scraping + utility calls) | **HIGH** — public ISOs only show state aggregates |
| **Claude AI interpretation layer** (stage-aware, constraint-based prompting) | Cannot replicate without domain expertise | **HIGH** — turns data into strategy |
| **Program runway calculation** (enrollment rate tracking) | Requires ongoing state data collection | **MEDIUM** — leading indicator for saturation |

### What's Commodity (Anyone Can Build in a Weekend)

| Asset | Reproducibility | Notes |
|-------|----------------|-------|
| Revenue engine (NPV math) | 2-3 hours | Fixed tariff rates + basic NPV |
| State programs data (27 states) | 3-5 hours | DSIRE + state PUC websites |
| Score model (40/35/25 weights) | < 1 hour | Arbitrary heuristic |
| News feed | 5-10 min per alert | Public sources, curation is the labor |

### Critical Gaps Found in Deep Audit (all addressed)

1. ~~**Tech type is cosmetic**~~ → FIXED (Week 2): C&I, BESS, Hybrid all have dedicated revenue models, scoring, offtake cards, scenarios, and AI prompt rules.
2. ~~**Placeholder text visible to users**~~ → FIXED (Week 1): All "not yet seeded" replaced with professional fallback language.
3. ~~**Typography inconsistent**~~ → FIXED (Week 1): Unified scale applied (text-2xl for metrics/titles, text-xl for sections).
4. ~~**Revenue stack colors**~~ → FIXED (Week 1): Purpose-mapped palette (ITC=blue, REC=violet, credits=emerald). Amber reserved for IX/caution.
5. ~~**Site Control is thin**~~ → FIXED (commit 34fd46c): 4th tile (Hosting Capacity derived from IX ease score), population density badge derived from land notes, serving-utility substation highlighting, voltage context by MW size.
6. ~~**Profile page is MVP-basic**~~ → FIXED (Week 1): Avatar banner, recent activity, cleaner layout.
7. ~~**Library dark theme crowding**~~ → FIXED (Week 1 + 3): Column divider, bordered subsections, sub-score bars, weekly summary card.
8. ~~**Score model is arbitrary**~~ → FIXED (Week 3): Renamed to "Feasibility Index" with methodology popover explaining weights.
9. ~~**Cross-surface flow is one-directional**~~ → FIXED (Week 1 + 4): Full URL params, auto-submit on arrival.

### Current Data Coverage

| Engine | States | Granularity | Data Type |
|--------|--------|-------------|-----------|
| State Programs | 27 (14 active, 3 limited, 2 pending, 8 none) | State-level, 12 fields each | Hardcoded seed |
| Revenue Engine | 8 (IL, NY, MA, MN, CO, NJ, ME, MD) | State-level rates + NPV | Hardcoded seed |
| IX Queue Engine | 8 states, 16 utilities | Per-utility breakdown | Hardcoded Q1 2026 snapshot |
| County Intelligence | 18 states, ~150+ counties | County-level site + IX | Hardcoded seed + Supabase |
| Substation Engine | 8 states, ~60 substations | Per-substation with haversine distance | Hardcoded EIA Form 860 |

### Score Engine Details (for reference during implementation)

Current `computeSubScores` in `src/lib/scoreEngine.js`:
- **Offtake** (40% weight): Base from CS status (active=80, limited=52, pending=25, none=8). +8 if capacity >500MW. -10 if LMI >=40%, -5 if LMI >=25%.
- **IX** (35% weight): From difficulty enum (easy=88, moderate=65, hard=38, very_hard=14). No further adjustment.
- **Site** (25% weight): Base 60. Available+no wetland=82, available+wetland=56, no land+no wetland=42, no land+wetland=26.
- **Stage modifiers**: `[offtake, ix, site]` adjustments per development stage (e.g., NTP = [+8, -5, +25]).
- **Display score**: `offtake * 0.40 + ix * 0.35 + site * 0.25`

### Revenue Engine Details (for reference during implementation)

Current `computeRevenueProjection` in `src/lib/revenueEngine.js`:
- Annual MWh = MW * 8760 * capacity factor
- Bill credit revenue = annual kWh * cents/kWh
- REC revenue = annual MWh * $/MWh
- ITC = installed cost * (base% + adder%), amortized over 6 years
- 25-year NPV at 8% discount rate with 0.5%/yr degradation
- **Missing**: No cost side (zero O&M, insurance, land lease, IX costs). No tax complexity. Single capacity factor per state.

### AI Insights Details (current state)

`api/lens-insight.js`:
- Calls Claude Sonnet with ~1500-2500 token context (includes IX queue data)
- System prompt: "$5,000 boutique consultant" — 15 explicit rules (tech-aware, stage-specific)
- Output schema: `{ brief, primaryRisk, topOpportunity, immediateAction, stageSpecificGuidance, competitiveContext }`
- 3-tier JSON parser with regex field extraction for all 6 fields
- Pro-only feature gated behind Supabase profile check
- Max tokens: 1200
- IX queue data included in context (project count, MW pending, per-utility breakdown)

---

## Week 1 — Foundation & Polish

**Goal:** Make everything that exists feel like a finished $20/mo product. No user should see placeholder text. No inconsistent sizing. The site needs to look premium before we add features.

### 1A. Remove All Placeholder Text (CRITICAL)

**Files:** `src/pages/Search.jsx`, `src/data/countyData.js`, `api/lens-insight.js`

| Location | Current Text | Replacement |
|----------|-------------|-------------|
| `Search.jsx` ~line 819 | `"not yet seeded"` (italic gray, program runway) | "Contact program administrator for current block fill status" — styled as neutral info note (blue-50 bg), not italic gray |
| `Search.jsx` ~line 849 | `"Revenue stack summary not yet seeded for this state"` | Structured card showing ITC 30% base applies universally + clickable link to dsireusa.org for state incentives |
| `countyData.js` ~line 1690 | `"County-level land data not yet seeded for this state"` | "Statewide assessment — use USDA Web Soil Survey and EPA NWI for parcel-level diligence" |
| `countyData.js` ~line 1701 | `"Detailed county-level interconnection data not yet available"` | "State-level IX conditions apply. Contact serving utility for queue position and hosting capacity" |
| `lens-insight.js` ~line 77 | `"enrollment rate not seeded — cannot compute"` | "Enrollment pace data not available — advise developer to request current block fill rate from program administrator" |

Also do a full grep for: "not yet", "coming soon", "placeholder", "TODO", "FIXME", "iteration", "phase" — kill anything user-facing.

### 1B. Unify Typography Scale

**Files:** `src/components/MetricsBar.jsx`, `src/pages/Search.jsx`, `src/pages/Library.jsx`, `src/pages/Landing.jsx`, `src/pages/Profile.jsx`, `src/pages/Dashboard.jsx`

**The unified scale:**

| Level | Size | Usage | Current Issues |
|-------|------|-------|---------------|
| Display (hero) | `text-4xl` / `text-5xl` | Landing hero headline only | Fine as-is |
| Page metric numbers | `text-2xl` (24px) | MetricsBar cards, Library stat strip | MetricsBar uses `text-[2rem]` (32px) — change to `text-2xl` |
| Page titles (h1) | `text-2xl` (24px) | All page headings | Search uses `text-xl` — change to `text-2xl` |
| Section headlines (h2) | `text-xl` (20px) | Card section headers | Correct |
| Card stat values | `text-lg` (18px) | IX queue stats, revenue per MW, queue data | Correct |
| Body text / labels | `text-sm` / `text-xs` | Everything else | Correct |

**Specific changes:**
- `MetricsBar.jsx` ~line 410: `text-[2rem]` → `text-2xl`
- `Search.jsx` ~line 1966: page title `text-xl` → `text-2xl`
- `Library.jsx` ~line 798 (non-auth heading): `text-xl` → `text-2xl`
- `Landing.jsx` DashboardPreview: verify metric values match `text-2xl` scale
- Full sweep of every page for any other mismatches

### 1C. Revenue Stack Color Overhaul

**Files:** `src/pages/Search.jsx` (RevenueStackBar component, revenue display sections)

**Current problem:** Everything revenue-related uses `#BA7517` (burnt orange) or `#D97706` (amber-600). All revenue streams look the same. The amber doesn't sit well visually.

**New purpose-mapped palette:**

| Revenue Stream | Current Color | New Color | Hex | Rationale |
|---------------|---------------|-----------|-----|-----------|
| Bill Credits (primary) | `#0F6E56` (teal) | Emerald-600 | `#059669` | Keep as anchor, slightly brighter |
| REC/SREC | mixed | Violet-600 | `#7C3AED` | Distinct from all other streams |
| ITC (annualized) | `#D97706` (amber) | Blue-600 | `#2563EB` | Federal incentive = blue |

**Rules:**
- `#D97706` (amber) is ONLY for IX/caution contexts: queue congestion badges, IX difficulty indicators, warning states
- `#BA7517` is ONLY for IX pillar accents (border-left on IX sections, IX subscore bar)
- Revenue bars, revenue numbers, revenue labels must never be amber
- Each revenue stream must be visually distinguishable in the stacked bar without blending

**Files to update:** Search.jsx RevenueStackBar (~line 634-663), RevenueProjectionSection (~line 680-683), ITC display (~lines 636, 682, 743), any amber usage in revenue context.

### 1D. Profile Page Upgrade

**File:** `src/pages/Profile.jsx` (currently 171 lines)

**Current state:** 3 plain white cards (account info, subscription, usage) with just name/email/plan/project count. No visual personality.

**Add:**
1. **Initials avatar**: 64px circle with gradient background (primary-700 → primary-800). Extract initials from `user.user_metadata.full_name`. Position above account card or in new dark gradient banner.
2. **Dark gradient banner at top**: Match Library dark aesthetic. Show avatar + full name + plan badge ("Pro" / "Free") in a dark header strip.
3. **Recent Activity section**: New card below usage. Query Supabase for last 5 projects by `saved_at` or `updated_at`. Display: project name, state abbreviation, relative timestamp ("3 days ago").
4. **Notification preferences**: New card with toggles:
   - "Weekly market digest" (boolean)
   - "Project alerts" (boolean)
   - Wire to new columns on `profiles` table: `email_digest_enabled boolean default true`, `alert_emails_enabled boolean default true`
5. **Visual upgrade**: Field labels keep `text-xs font-semibold text-gray-400 uppercase tracking-wider`. Add subtle card hover states. Add section dividers between cards.

### 1E. Library Dark Theme Refinements

**File:** `src/pages/Library.jsx`

**Current issues:** Expanded cards show 20+ elements in 2-column layout on dark bg (#0D1624 cards, #0F1A2E expanded). Dense but readable — the issue is information density, not theme quality.

**Changes:**
- Add visual section dividers between "Market Intelligence" (left column) and "Your Deal" (right column) using a vertical separator or distinct background treatment
- Group the Program details grid (~lines 547-570) into a bordered subsection card with `rgba(255,255,255,0.04)` background and subtle top border color-coded to pillar
- Make alert strip (~lines 511-515) more prominent when urgent alerts present: stronger background opacity, slight glow on urgent
- Add consistent vertical spacing (gap-4 or gap-5) between dense data sections
- Ensure all tertiary text at `rgba(255,255,255,0.42)` is legible — consider bumping to 0.50 if any labels are hard to read

### 1F. Landing/Guest Page Cleanup

**File:** `src/pages/Landing.jsx`

**DashboardPreview component (lines 46-131):**
- Replace hardcoded `sampleStates` array with actual counts derived from `statePrograms` data (already imported)
- Policy alert examples (lines 113-116) are frozen in time — add "Updated weekly" badge or `lastUpdated` display
- Add subtle price indicator near primary CTA: "From $9.99/mo" or "Pro plans from $9.99/mo" — small text below the main button
- Verify preview metric values use consistent sizing (should match `text-2xl` scale from 1B)
- Scrub all number displays for consistent formatting (commas, decimal places, units)

---

## Week 2 — Tech Type Depth

**Goal:** Make C&I Solar, BESS, and Hybrid selections actually change the analysis output. Currently non-CS tech types get 3-4 sentences of generic placeholder text in the Offtake card and nothing changes in CAPEX, IX profile, or scenarios.

### 2A. Tech-Type Revenue Models

**File:** `src/lib/revenueEngine.js`

Add parallel revenue data and computation functions alongside existing CS model.

**C&I Solar data to add per state:**
```javascript
{
  ppaRateCentsKwh: 7.0,          // Typical contracted PPA rate
  escalatorPct: 2.0,              // Annual PPA price escalator
  installedCostPerWatt: 2.20,     // Higher than ground-mount CS
  itcPct: 30,                     // Base ITC only
  itcAdderPct: 0,                 // No LMI adder for C&I
  capacityFactorPct: 16.0,        // Similar or slightly lower
  degradationPct: 0.5,
  retailRateCentsKwh: 12.5,       // State avg retail rate (for savings comparison)
}
```
- **New export:** `computeCIRevenueProjection(stateId, mwAC)` — PPA revenue with escalator, ITC (base only), 25-year NPV. Include retail rate comparison ("PPA at 7.0 cents vs retail at 12.5 cents = 44% savings for offtaker").
- State PPA rates: IL ~7.0, NY ~8.0, MA ~8.5, MN ~6.5, CO ~6.0, NJ ~7.5, ME ~6.5, MD ~7.0

**BESS data to add per state:**
```javascript
{
  isoRegion: 'PJM',                // ISO/RTO serving the state
  capacityMarketPerKwYear: 65,     // Capacity market revenue
  demandChargePerKwMonth: 12,      // Demand charge reduction value
  arbitragePerMwh: 30,             // Energy arbitrage spread
  installedCostPerKwh: 380,        // 4-hour duration lithium-ion
  roundTripEfficiency: 0.87,       // 87% round-trip
  annualDegradationPct: 2.5,       // Battery degradation
  itcPct: 30,                      // IRA standalone storage ITC
}
```
- **New export:** `computeBESSProjection(stateId, mwAC, durationHrs)` — capacity market + demand charge + arbitrage revenue streams. 15-year NPV (battery lifecycle, not 25 years). Include installed cost and payback period estimate.
- ISO capacity prices: PJM (IL, NJ, MD) ~$50-80/kW-yr, MISO (MN) ~$30-50, ISO-NE (MA, ME) ~$60-100, NYISO (NY) ~$55-85

**Hybrid data:**
- **New export:** `computeHybridProjection(stateId, solarMW, storageMW, durationHrs)` — combines CS/C&I solar streams with BESS capacity value. ITC stacking: 40% for co-located storage per IRA Section 48. Show blended economics and highlight the ITC uplift from co-location.

### 2B. Tech-Aware Score Engine

**File:** `src/lib/scoreEngine.js`

Add `technology` parameter to `computeSubScores(stateProgram, countyData, stage, technology)`.

**Offtake sub-score by tech type:**
- **Community Solar** (existing): Base from CS status (active=80, limited=52, pending=25, none=8)
- **C&I Solar** (new): Base from state retail electricity rate tier. High-rate states (NY, MA, NJ, CT) = 75-85. Medium (IL, MD, CO) = 60-70. Low (MN, ME) = 50-60. States without favorable net metering = 35-45.
- **BESS** (new): Base from ISO capacity market price tier. ISO-NE states = 80. PJM states = 75. NYISO = 70. MISO = 55. No ISO = 30.
- **Hybrid** (new): Average of the CS/C&I offtake score and BESS offtake score, capped at 85.

**IX sub-score adjustments by tech:**
- **BESS**: +5 modifier (typically faster interconnection studies for storage)
- **Hybrid**: -5 modifier (more complex interconnection for combined resources)
- **C&I Solar**: no change (similar IX process to CS)

**Site sub-score adjustments by tech:**
- **BESS**: When `availableLand` is false, score 65 instead of 42 (storage needs 1-2 acres/MW vs 5-7 for solar)
- **Hybrid**: no change (still needs full solar footprint)

### 2C. Tech-Aware Offtake Card

**File:** `src/pages/Search.jsx` (OfftakeCard component, ~lines 761-896)

Replace generic non-CS placeholder paragraphs (lines 857-884) with structured analysis matching the CS visual treatment:

**C&I Solar card shows:**
- PPA rate range for the state (from new revenueEngine data)
- Retail rate comparison: "PPA at X cents vs utility retail at Y cents = Z% savings for offtaker"
- ITC eligibility: base 30% only (no LMI/CS-specific adders)
- Estimated annual revenue using `computeCIRevenueProjection`
- Key consideration: "C&I success depends on anchor tenant credit quality and contract length"

**BESS card shows:**
- ISO/RTO region and capacity market context
- Three revenue streams displayed as tiles: Capacity Market ($X/kW-yr), Demand Charge Reduction ($X/kW-mo), Arbitrage ($X/MWh spread)
- Estimated revenue from all three streams using `computeBESSProjection`
- Installed cost per kWh and estimated payback period
- Key consideration: "Revenue depends on capacity market pricing — historically volatile in [ISO region]"

**Hybrid card shows:**
- Combined solar + storage revenue streams
- ITC stacking highlight: "Co-located storage qualifies for 40% ITC under IRA Section 48"
- Blended project economics from `computeHybridProjection`
- Key consideration: "Hybrid projects have more complex permitting but stronger value stacking"

### 2D. Tech-Aware Scenarios

**File:** `src/pages/Search.jsx` (buildSensitivityScenarios function, ~lines 1079-1148)

Currently all scenarios are gated by `technology === 'Community Solar'`. Add tech-specific scenarios:

**C&I Solar scenarios:**
- "What if PPA rate drops 15%?" — show revenue impact and NPV delta
- "What if electricity prices rise 3%/yr?" — show upside case for offtaker savings
- "What if the offtaker defaults in year 5?" — discuss re-contracting risk and NPV impact

**BESS scenarios:**
- "What if capacity market prices drop 30%?" — significant revenue impact, show NPV delta
- "What if battery degradation is 3%/yr vs 2%?" — throughput and warranty risk, show lifecycle impact
- "What if demand charge rates increase 20%?" — upside case

**Hybrid scenarios:**
- "What if ITC for storage drops to 30%?" — loss of co-location bonus, NPV impact
- "What if solar clipping is higher than modeled?" — oversizing risk

### 2E. Tech-Aware AI Prompt

**File:** `api/lens-insight.js`

**System prompt additions:**
- New rule: "When technology is not Community Solar, DO NOT discuss CS program enrollment, subscriber sourcing, or bill credits unless the developer is explicitly evaluating a CS pivot. Focus on the relevant revenue mechanism: PPA rates and offtaker economics for C&I, capacity market and demand charge for BESS, value stacking for Hybrid."
- New rule: "For BESS projects, the primary risk is always capacity market price volatility and battery degradation. For C&I, it is offtaker credit risk and PPA contract terms. For Hybrid, it is permitting complexity and ITC stacking qualification."

**buildContext() additions:**
- When technology is BESS: include ISO/RTO region, capacity market price range, demand charge value
- When technology is C&I: include state retail electricity rate, typical PPA range, net metering policy
- When technology is Hybrid: include both solar program data and storage market data

---

## Week 3 — Intelligence Depth

**Goal:** Make the insights genuinely worth $10-20/month. Transform the score from arbitrary marketing into a defensible methodology. Make the AI analysis deeper. Make scenarios quantified with dollar and timeline impacts.

### 3A. Score Model Transparency

**Files:** `src/lib/scoreEngine.js`, `src/pages/Search.jsx` (MarketPositionPanel), `src/pages/Library.jsx`

1. **Rename across all surfaces:** "Feasibility Score" → "Feasibility Index"
   - A "score" implies objective truth. An "index" acknowledges it's a model with stated methodology.
   - Update text labels in Search.jsx (MarketPositionPanel, ArcGauge labels), Library.jsx (ScoreGauge, card headers), CompareTray.jsx, PDF export.

2. **Methodology info popover:** Add small info icon (ℹ) next to "Feasibility Index" in MarketPositionPanel (Search.jsx ~line 106). On click, show popover:
   - "Offtake (40%): Program status, remaining capacity, LMI complexity, enrollment runway"
   - "Interconnection (35%): Queue difficulty, study timelines, upgrade cost risk"
   - "Site Control (25%): Land availability, wetland risk, zoning constraints"
   - "Weights reflect typical development decision priority: offtake viability is the first gate, IX risk is the primary capital risk, site control is increasingly commoditized."

3. **Sub-score breakdown in Library:** The Library expanded card (~line 142) shows ScoreGauge but not individual pillar bars. Add the three SubScoreBar components (Offtake/IX/Site) below the gauge, matching the Lens format.

### 3B. Enrich Site Control

**Files:** `src/data/countyData.js`, `src/pages/Search.jsx` (SiteControlCard)

**Add new data fields to county entries:**

1. **`hostingCapacityStatus`**: `'available'` | `'constrained'` | `'unknown'`
   - Derived from utility hosting capacity maps (same source as ease scores)
   - Display as 4th tile in SiteControlCard alongside Land, Wetland, Zoning
   - Color-coded: green (available), amber (constrained), gray (unknown)

2. **`populationDensity`**: `'rural'` | `'suburban'` | `'urban'`
   - Derivable from Census data
   - Affects: site acquisition difficulty, CS subscriber density, C&I offtaker availability
   - Display as context note in SiteControlCard

3. **Smarter substation display:**
   - Highlight the substation that matches the county's serving utility (it's the one that actually matters for Point of Interconnection)
   - Add voltage context note: "138kV substations are typical POI for 5MW projects. 345kV+ may indicate available headroom but requires more expensive gen-tie line."
   - Visual: bold/highlight the matching-utility substation, subtle the others

### 3C. Deeper AI Analysis

**File:** `api/lens-insight.js`

**Expand JSON output schema from 4 fields to 6:**
```json
{
  "brief": "3-4 sentences of analyst intelligence",
  "primaryRisk": "1 sentence — the single biggest risk",
  "topOpportunity": "1 sentence — the most actionable upside",
  "immediateAction": "1 sentence — what to do in the next 30 days",
  "stageSpecificGuidance": "2-3 sentences specific to the developer's current stage",
  "competitiveContext": "1-2 sentences about what other developers are likely doing in this market"
}
```

**Implementation:**
- Increase `max_tokens` from 900 to 1200 (~line 228) to accommodate additional fields
- Add IX queue data to `buildContext()`: project count, MW pending, weighted avg study time, congestion level (from `ixQueueEngine.js`). This lets Claude say: "With 142 solar projects already in the ComEd queue totaling 1,840MW, you are competing for limited hosting capacity."
- Add stage-specific prompting rules to system prompt:
  - Prospecting → focus on market entry/exit decisions, competitive landscape
  - Site Control → focus on lease terms, IX timeline risk, landowner negotiation
  - Pre-Development → focus on enrollment timing, program runway urgency
  - Development → focus on construction timeline, equipment procurement
  - NTP → focus on final financing, subscriber acquisition deadlines
- Update the 3-tier JSON parser to handle the 2 new fields

### 3D. Quantified Scenario Analysis

**File:** `src/pages/Search.jsx` (MarketIntelligenceSummary, buildSensitivityScenarios)

**Current output:** Score delta + a paragraph of descriptive text. Need to add dollar and timeline impacts.

1. **Revenue impact on IX scenarios:** When a scenario changes IX difficulty, compute estimated upgrade cost change using `ixQueueEngine.js` data and display: "Score impact: -8 pts | Est. cost impact: +$425K in IX upgrades"

2. **Timeline impact on IX scenarios:** "Study timeline extends from ~18 months to ~26 months"

3. **Revenue impact on program capacity scenarios:** When capacity drops, show: "Score impact: -13 pts | Risk: enrollment window closes in ~60 days"

4. **Custom Scenario option:** Add a button/dropdown that lets the user manually override:
   - IX difficulty (easy/moderate/hard/very_hard dropdown)
   - CS status (active/limited/pending dropdown)
   - See the resulting score, revenue, and timeline impact in real time
   - This is the power-user feature that makes developers come back — "what if I move this project to a different utility territory?"

---

## Week 4 — Flow & Stickiness

**Goal:** Make the three surfaces feel like one coherent intelligence system. Make developers want to check Tractova every Monday morning. Close the loop between analysis and tracking.

### 4A. Bidirectional Cross-Surface Navigation

**Files:** `src/pages/Library.jsx` (~line 683-693), `src/pages/Search.jsx` (~line 1828-1831)

**Current problem:** Library → Lens only passes `?state=` in the URL. User has to manually re-enter county, MW, stage, and technology — friction that breaks the flow.

**Fix Library side:** Change "Re-Analyze in Lens" link to pass ALL project params:
```
/search?state=${project.state}&county=${encodeURIComponent(project.county)}&mw=${project.mw}&stage=${encodeURIComponent(project.stage)}&technology=${encodeURIComponent(project.technology)}
```

**Fix Search side:** In SearchContent (~lines 1828-1839), read all URL params:
```javascript
const initialState = searchParams.get('state')?.toUpperCase() || ''
const initialCounty = searchParams.get('county') || ''
const initialMW = searchParams.get('mw') || ''
const initialStage = searchParams.get('stage') || ''
const initialTechnology = searchParams.get('technology') || ''
```
Populate the form with all of them. Auto-submit analysis if all 5 fields arrive from URL params (add `useEffect` that calls `handleSubmit` when form is fully populated from URL).

### 4B. "What Changed" Indicators

**File:** `src/pages/Library.jsx`

1. **Visual "Updated" badge:** When state data has been refreshed since the project was saved (compare `stateProgram.lastUpdated` vs `project.saved_at`), show a blue dot next to the project name on collapsed card — not buried as an info-level alert chip.

2. **Revenue delta detection:** When saving a project, store the current NPV in the project record (`feasibility_npv25` column on `projects` table). On Library load, recompute NPV with current revenue engine data. If delta >5%, show alert: "Revenue estimate changed: $8.2M → $7.6M (-7%)" with old and new values.

3. **"Updates since last visit" banner:** Track last Library visit timestamp in localStorage. If user has projects and hasn't visited in 7+ days, show banner at top: "3 updates since your last visit" with summary of what changed (state data refreshes, score changes, capacity alerts).

### 4C. Library Information Hierarchy

**File:** `src/pages/Library.jsx` (ProjectCard expanded panel, ~lines 507-719)

Restructure the expanded view to reduce initial information density while keeping everything accessible:

1. **Top bar:** Alert strip (existing) + "Last analyzed X days ago" timestamp + re-analyze CTA
2. **Three-column pillar summary:** Compact versions of pillar cards:
   - Offtake: status badge + capacity remaining
   - IX: difficulty badge + ease score
   - Site: risk level badge
   - Each clickable to expand full detail below
3. **Bottom section:** "Your Deal" (stage picker + notes) as a collapsible section, defaulting to collapsed if the user hasn't added notes. Reduces visual clutter for projects that are just being tracked passively.

### 4D. Compare Tray Enhancement

**File:** `src/components/CompareTray.jsx`

Current compare modal (~lines 55-203) shows a table with score, CS status, IX difficulty, MW, tech, stage, source. Make it more useful:

1. **Revenue comparison row:** If revenue projection data is available for both items, show estimated annual revenue per MW side by side.

2. **Auto-generated "Best for" summary:** Below the table, generate a sentence: "Project A has stronger offtake (Active vs Limited program) but Project B has easier interconnection (Easy vs Hard). Choose A if you need to move fast on enrollment; choose B if IX timeline is your binding constraint."

3. **"Open in Lens" action:** Each column header gets a small link icon that opens the project in Lens with full parameters pre-filled (using the 4A URL pattern).

### 4E. "Your Week" Summary — The Monday Morning Feature

**Files:** New `src/components/WeeklySummary.jsx`, integrated into `src/pages/Library.jsx`

When the user opens Library and has 3+ saved projects, show a collapsible card at the top of the page:

- **Portfolio health:** "4 of 6 projects in strong markets. 1 project has a new alert."
- **Market moves:** "Illinois Shines capacity dropped 12% this month. Colorado IX queue shrank by 8 projects." (Derived from comparing current state program data against saved project snapshots.)
- **Action items:** "Your Will County project is in Pre-Development — program runway is ~14 months. Consider submitting your interconnection application this month." (Derived from project stage + state program runway calculation.)

Built with deterministic logic from existing alert system + state program data. No additional Claude API calls needed — this is pure data comparison, not AI-generated.

---

## Verification Plan

**After each week, run these checks:**
1. `npx vite build` — must compile clean with no errors
2. Start dev server, test golden path: search for Will County, IL, 5MW Community Solar at Prospecting stage
3. Test each tech type (C&I, BESS, Hybrid) and verify unique, substantive outputs (not placeholder text)
4. Check Library save/load roundtrip — save from Lens, verify in Library, re-analyze back in Lens
5. Grep for "not yet seeded", "not yet available", "coming soon", "iteration" — zero user-facing results
6. Test Library → Lens → Library bidirectional flow (full params after Week 4)
7. Visual audit: check typography consistency across Dashboard, Lens, Library, Landing, Profile on 1280px viewport

**Monday Morning Test (Post-Week 4):**
A developer opens Tractova, checks their Library, sees "3 updates since last visit," clicks into their Will County project, re-analyzes in Lens with all fields pre-filled, sees quantified scenarios with dollar and timeline impacts, saves updated analysis back to Library. The entire flow feels like one coherent intelligence system, not disconnected modules. They could not have assembled this intelligence in under 4 hours of manual research.

---

## Key Files Reference

| File | Weeks | Changes |
|------|-------|---------|
| `src/pages/Search.jsx` (~2100 lines) | 1,2,3,4 | Placeholder removal, typography, colors, tech-aware cards/scenarios, score transparency, cross-surface nav |
| `src/lib/revenueEngine.js` (169 lines) | 2 | C&I/BESS/Hybrid revenue models and computation functions |
| `src/lib/scoreEngine.js` (42 lines) | 2,3 | Tech-aware scoring, methodology disclosure, rename to Feasibility Index |
| `src/pages/Library.jsx` | 1,3,4 | Dark theme polish, sub-scores in expanded cards, info hierarchy, what-changed indicators, weekly summary |
| `api/lens-insight.js` | 1,2,3 | Placeholder fix, tech-aware prompt rules, expanded 6-field output schema |
| `src/pages/Profile.jsx` (171 lines) | 1 | Avatar, recent activity, notification preferences, dark gradient banner |
| `src/pages/Landing.jsx` | 1 | Live data in preview, pricing indicator, consistency scrub |
| `src/components/MetricsBar.jsx` | 1 | Typography fix (text-[2rem] → text-2xl) |
| `src/data/countyData.js` (~1706 lines) | 1,3 | Placeholder text replacement, hostingCapacityStatus, populationDensity fields |
| `src/components/CompareTray.jsx` | 4 | Revenue comparison row, "Best for" summary, "Open in Lens" action |
| `src/components/WeeklySummary.jsx` | 4 | New file — Monday morning portfolio briefing |
| `src/lib/substationEngine.js` (179 lines) | 3 | Highlight serving-utility match, voltage context notes |
| `src/lib/ixQueueEngine.js` (191 lines) | 3 | Feed queue data into AI context for competitive analysis |

---

## Deferred / Not In Scope

These items are acknowledged but intentionally deferred past this 4-week plan:

- STRIPE_WEBHOOK_SECRET placeholder in .env.local → needs real secret from Stripe dashboard
- CRON_SECRET missing from .env.local → needs value before cron jobs go live
- Web scraping infrastructure (DSIRE, FERC, EIA) → Iteration 5
- `program_rules` Supabase table → Iteration 5
- Admin panel for scraped data review → Iteration 5
- Data freshness indicators → Iteration 5 (after scraping exists)
- LMI ITC stacking logic in lens-insight.js → after tech type depth is complete
- Mobile responsiveness → future
- RFP Tracker, IRA Energy Community map, Utility Report Card, Document Vault → long-term backlog

---

## Long-term Backlog

- RFP Tracker (public PUC data)
- IRA Energy Community map layer (DOE API)
- Utility Report Card (standalone profile page per utility)
- Document Vault with AI summarization
- Per-state deep program pages (replacing DSIRE)
- Mobile responsive design
- Email digest system (Resend integration)
- Advanced scenario modeling with Monte Carlo simulation
