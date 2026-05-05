# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it appends the latest commit, flips backlog items to shipped, and updates the migration list. No more juggling Running_Notes / V3_Plan / V2_Plan / Prop_Plan — those are archived in `docs/archive/`.

---

## 🟢 Pickup — Library bug-fixes + UX wins shipped (`362e222`) → next: Aden applies migrations 050-054 + runs three seed scripts, then build resumes in priority order: 2 → 1 → 3 → 4 → 5 → site audit → onboarding revamp

**Session 2026-05-05 (close-out).** Bug-fix sweep on top of Phases B/D/E/G/Phase C-pivoted. Aden flagged four items off the live Vercel render after applying some migrations; all addressed.

### What landed (commit `362e222`)

1. **Portfolio Health + Geographic Spread NaN** — root cause was `Object.values(subs)` spreading the `coverage` object (4th key, with string values 'researched' / 'fallback') as the `weights` argument to `computeDisplayScore`. `weights.offtake = 'researched'`, so `number × string = NaN`, poisoning every per-project score and downstream aggregate. Fixed in `Library.jsx:2621` AND `Profile.jsx:346` (both had the same bug). Defensive `Number.isFinite` filters added in `healthScore` + `geoBreakdown` so a single bad row can't poison the aggregate again.
2. **SolarCostLineagePanel promoted** out of the methodology dropdown into the top of `OfftakeCard` body. Tier A/B coloring (5 visual variants from Phase E) is now visible at first glance, not buried behind a click-to-expand. Methodology dropdown keeps the broader citation paragraph for context.
3. **Pipeline Distribution collapsible.** Was eating ~150px of vertical space above the project grid. Default collapsed, chevron + summary count line; expand on click. Active filter forces-expand.
4. **Audit-tab loader** — `LoadingDot` (green dot) → `TractovaLoader` per saved cinematic-loading feedback. Branded affordance for a discrete tab switch.

### Aden-side action items (carried)

1. **Apply migrations 050, 051, 052, 053, 054** in Supabase SQL editor (in order — 049 done previous session; 052 depends on 048; 054 depends on 053).
2. **Re-run `seed-solar-cost-index.mjs`** — should populate 7 new rows (3 → 10 Tier-A states).
3. **Run `seed-cs-projects.mjs`** — ~3,799 NREL Sharing the Sun rows.
4. **Run `seed-cs-specific-yield.mjs --dry-run` FIRST** — regex parsers are best-effort. If output is sparse, use `--inspect=nexamp|srenergy|catalyze` to dump raw HTML, tune regexes, then live-run. (This is option 1 below.)

### Locked priority order for the next sessions

User-set 2026-05-05:

1. **Option 2 — `cs_projects` audit of `cs_status` accuracy.** Once Sharing the Sun is seeded, flag states whose `state_programs.cs_status='active'` have negligible operating MW (or vice versa — `cs_status='limited'` but huge real deployment, e.g. FL). Small audit script + admin-curation queue. ~2-3 hours. **Highest leverage per hour.**
2. **Option 1 — Phase G Specific Yield seed regex tuning.** Iterate on the three scrapers after the first `--dry-run` reveals which patterns extract sparsely vs cleanly. ~30-60 min of HTML inspection + regex refinement. Bounded.
3. **Option 3 — Replace synthesized `comparable_deals` with `cs_projects`-backed real comparables.** Refactor `ComparableDealsPanel` to query `cs_projects` for nearby/similar operating projects matching MW + state + tech. ~1 day. The curated `comparable_deals` table is mostly empty and now has a real-data substitute.
4. **Option 4 — Mobile responsiveness audit.** Search.jsx is 4,500+ LOC and likely breaks <640px. ~2-3 days. Lower urgency since Aden's user base is desk-centric, but unblocks the email-footer mobile-disclaimer story.
5. **Option 5 — Path 2 ground-truthing.** LevelTen PPA Index (~$1.5K/yr) or industry-developer survey or direct state-program outreach. Closes the 9 Tier-B states (5 structural SREC + 4 below-floor) that the Lens UI now visibly discloses. Money/relationship spend, not engineering.

### After option 5

**Full site audit + UI/UX check** — comprehensive sweep matching the original site-walk arc style. Then **onboarding revamp** (the work paused a few sessions back; plan exists at `~/.claude/plans/huly-onboarding-revamp.md`).

### Resume-prompt suggestions

- *"Apply migrations + run seeds, then start option 2 (cs_status accuracy audit)"*
- *"Phase G `--inspect=nexamp` — let's tune the regex"*
- *"Skip ahead to option 3 — comparable_deals refactor"*

---

## Pickup (prior, 2026-05-04 evening) — Phase G shipped: cs_specific_yield (Nexamp + SR Energy + Catalyze fleet)

**Session 2026-05-04 (continuation, sessions 11–12).** Phase G shipped on
top of Phase E in the approved sequence. Both data-lineage layers now
exist: cost (solar_cost_index, lower threshold n≥3 + tiered) and
production (cs_specific_yield, three-source fleet observed SY).

### What landed (this commit, on top of Phase E `6ebcee9`)

- **Migration 053** — `cs_specific_yield` table per the plan
  (`~/.claude/plans/nexamp-srenergy-specific-yield-fleet-data.md`).
  Per-project rows with capacity_basis (AC/DC), specific_yield_kwh_per_kwp_yr,
  observed_capacity_factor_pct, source attribution, CHECK SY ∈ [600, 2400].
  RLS public-read.
- **Migration 054** — `get_data_freshness()` + cs_specific_yield block.
- **Three-source seed `scripts/seed-cs-specific-yield.mjs`** — Nexamp
  (sitemap → per-project HTML scrape, ~300-500 projects), SR Energy
  (listing scrape with 10s crawl-delay, ~80-150 projects), Catalyze
  (listing scrape, drop rows missing production, ~9 SY-eligible). Rate-
  limited per source. `--source=NAME` and `--dry-run` flags. `--inspect=NAME`
  dumps raw HTML for regex tuning.
- **`getSpecificYieldLineage(stateId)` in `programData.js`** — defensive
  try/catch lineage fetch (null when migration 053 not applied yet).
  Returns AC + DC summaries separately (capacity-basis split) so the UI
  doesn't apples-to-oranges average across them.
- **`SpecificYieldPanel` component** — three confidence-tier visual
  variants reusing the Phase E pattern (strong/modest/thin). Tier-A · Thin
  treatment uses the same amber-tinged-teal as cost lineage. AC and DC
  basis-rows render side-by-side. Headline source attribution +
  bottom-of-card bias caveat with COI disclosure of Nexamp affiliation.
- **`MaybeSpecificYieldPanel` wrapper** in Search.jsx, placed between
  `MaybeRegulatoryPanel` and `MaybeCsMarketPanel` (real ground truth
  before curated supplements).
- **Methodology dropdown PVWatts line updated** — adds the cross-check
  sentence pointing to the observed-fleet panel + bias disclosure.
- **`Privacy.jsx`** — 5 new `<Source>` bullets: Nexamp (with explicit
  COI disclosure), SR Energy, Catalyze, plus a single bullet naming all
  15 reviewed-but-excluded developers (Standard Solar, Soltage, MEI,
  BlueWave, US Solar, CCR, AES Distributed, Pivot, New Leaf, Borrego,
  DSD, NEE, Lightsource bp, IGS, Coronal — checked, none publish full
  size+production). New paragraph on three-source bias. EFFECTIVE_DATE
  bumped to May 4, 2026; VERSION → 1.2.
- **`Admin.jsx` FRESHNESS_CONFIG** — new `cs_specific_yield` entry,
  mode='seeded', thresholds [120, 270] days.

### Aden-side action items

1. **Apply migrations 052, 053, 054 in Supabase SQL editor.** Order
   matters: 052 (Phase E) → 053 → 054 (Phase G freshness depends on 053).
2. **Re-run `node scripts/seed-solar-cost-index.mjs`** (Phase E). Confirms
   3 → 10 Tier-A row publication.
3. **Run `node scripts/seed-cs-specific-yield.mjs --dry-run`** first to
   confirm parsers extract sane data from Nexamp/SR Energy/Catalyze
   pages. The regex patterns are best-effort; if rows look thin or wrong,
   use `--inspect=nexamp` (or `=srenergy` / `=catalyze`) to dump raw HTML
   for tuning. Then re-run without `--dry-run` to upsert.
4. **(Optional) BUILD_LOG flip migrations 052/053/054 to ✅** after
   applying.

### Where the data spine stands now

| Layer | Source | State coverage |
|---|---|---|
| Solar capex anchor (national) | NREL Q1 2023 + LBNL TTS national + NREL ATB 2024 | 3 independent benchmarks |
| Solar capex per-state observed (Phase B + E) | LBNL TTS w/ tier ladder | 10 Tier-A (3 strong + 3 modest + 4 thin) + 9 Tier-B (5 structural + 4 thin-below-floor) |
| BESS capex | NREL ATB 2024 | national, no paywall |
| BESS capacity revenue | ISO/RTO clearing | per-ISO |
| Operating CS market (Phase C-pivoted) | NREL Sharing the Sun | 3,799 projects, all 50 states |
| Capacity factor primary | NREL PVWatts API v8 | all 50 states (modeled) |
| **Capacity factor observed (Phase G — new)** | **3-developer fleet (Nexamp/SR Energy/Catalyze)** | **pending seed run; estimated ~6-8 states with n≥3 after vintage filter** |

Five data-lineage layers, three independent national benchmarks, every
synthesis basis disclosed in Privacy.jsx + Lens UI.

### Next pickup options

1. **Run both seed scripts** (Phase E re-seed + Phase G first seed)
   and visually verify the new panels render correctly.
2. **Tune Phase G regex parsers** if dry-run output is sparse — `--inspect`
   flag is provided for this.
3. **Path-2 ground-truthing** of remaining structural-gap states
   (LevelTen PPA Index, dev outreach).
4. **IX scraper expansion** (CAISO/ERCOT/SPP/WECC).
5. **Mobile responsiveness audit**.

### Resume-prompt suggestions

- *"Apply 052/053/054, run both seed scripts, then [N]"*
- *"Phase G seed regex needs tuning — `--inspect=nexamp` and let's iterate"*

---

## Pickup (prior, 2026-05-04 evening) — Phase E shipped: lower n threshold to 3 + tiered confidence disclosure

**Session 2026-05-04 (continuation, sessions 9–10).** The framing-problem
plan landed. Approved + shipped in approval-mode → execution flow.

### What landed (this commit)

- **Migration 052** — adds `confidence_tier` + `aggregation_window_years`
  to `solar_cost_index`. CHECK enforces n≥3 floor at the DB layer.
  Extends unique key to (state, sector, vintage_year, source,
  aggregation_window_years). Backfills `[TIER_B:STRUCTURAL incentive=SREC]`
  prefix onto `revenue_rates.notes` for IL/PA/OR/DE/WA (5 SREC-design
  states with no LBNL paper trail) and `[TIER_B:THIN n=N]` for FL/MD/NH/CT
  (4 below-floor states). Idempotent; re-runs don't double-prefix.
- **Seed script + API handler** — threshold lowered from 40 → 3 with a
  three-tier ladder (`TIER_FLOOR=3 / TIER_MODEST_MIN=10 / TIER_STRONG_MIN=40`).
  Constants mirrored across both files with `MUST mirror` lockstep
  comments. Three-tier console output (STRONG/MODEST/THIN sub-tables).
- **`SolarCostLineagePanel`** — 5 visual variants:
  - Tier A · Strong (teal, full p10–p90)
  - Tier A · Modest (teal + "modest sample" caveat)
  - Tier A · Thin (amber-tinged teal; **p10/p90 suppressed** at thin n
    where they're false precision; mandatory caveat)
  - Tier B · Thin (amber + "below floor" copy; parsed from `[TIER_B:THIN]`
    prefix)
  - Tier B · Structural (amber + "incentive design generates no paper
    trail" copy; parsed from `[TIER_B:STRUCTURAL]` prefix)
  - Legacy/no-prefix Tier B graceful degrade preserved.
- **`Privacy.jsx`** — three new `<Source>` entries (LBNL TTS with
  structural-coverage disclosure, NREL Sharing the Sun, NREL ATB).
  New paragraph about confidence-tier surface. EFFECTIVE_DATE → May 4,
  2026; VERSION → 1.1.

### State coverage projection (verified via seed --dry-run)

| Tier | n range | States | Count |
|---|---|---|---|
| Strong | n≥40 | CA(468), MA(84), NY(183) | **3** |
| Modest | n=10–39 | AZ(24), MN(17), TX(32) | **3** |
| Thin | n=3–9 | CO(4), RI(8), UT(3), WI(9) | **4** |
| **Tier A total** | | | **10** |
| Tier B · Thin | n<3 | CT(1), DE(0)*, FL(2), MD(2), NH(2) | 5 |
| Tier B · Structural | SREC design | IL, OR, PA, WA | 4 |

*DE=0 in current TTS; classified as THIN because DE's incentive structure
isn't formally SREC. May reclassify to STRUCTURAL in future audit.

**Net result:** Tier-A coverage **3 → 10** out of 17 active CS states.
Remaining 9 are visibly disclosed (with reason) on the Lens.

### Aden-side action items

1. **Apply migration 052 in Supabase SQL editor.**
2. **Re-run `node scripts/seed-solar-cost-index.mjs`** (without `--dry-run`).
   Confirms 3 → 10 Tier-A row publication. Migration 052's CHECK
   constraint will enforce n≥3 at the DB layer.
3. **(Then) Phase G** — Specific Yield from Nexamp + SR Energy + Catalyze.
   Plan at `~/.claude/plans/nexamp-srenergy-specific-yield-fleet-data.md`.

---

## Pickup (prior, 2026-05-04 evening) — Phase C-pivoted shipped: cs_projects (NREL Sharing the Sun) ground-truth ingestion

**Session 2026-05-04 (continuation, sessions 7-8).** All migrations 044-049
confirmed applied to live DB. hello@tractova.com forwarding tested working
(non-Gmail senders confirm inbound). Phase C originally scoped as EIA Form
860 utility-scale cross-check was pivoted mid-session — quick probe of
NREL's "Sharing the Sun: Community Solar Project Data (Jan 2026).xlsx"
(already in `public/`) revealed 3,799 individual operating CS projects
with state / utility / developer / size / vintage / LMI attribution but
**no cost data**. Right call: drop the EIA cost cross-check (scale-mismatched
with TTS 0.5-5 MW non-res anyway) and ingest Sharing the Sun as a
completely new ground-truth layer for CS market activity.

Aden's instruction: ship the ingestion, then take a beat to think about
the $/W question independently before committing to path-2 ground-truthing.

### What landed (this session, two commits)

**`f79be0e` (already shipped earlier)** — Phase B (table + cron + seed + freshness)
**`7e71044` (already shipped earlier)** — Phase D (Lens lineage panel)

**This session's third commit:**
- **Migration 050** (`cs_projects.sql`) — per-project CS ground truth (3,799
  rows). 16 useful columns: project_id (PK), utility_id, project_name,
  city, state, utility_name + utility_type, subscription_marketer,
  program_name, developer_name, system_size_mw_ac + mw_dc, vintage_year,
  lmi_required + lmi_portion_pct + lmi_size_mw_ac. Source attribution
  (`NREL_SHARING_THE_SUN`) + `source_release` (e.g. 'Jan 2026'). Indexed
  on (state), (state, vintage_year desc), (state, system_size_mw_ac desc).
  RLS public-read + admin-write. `'Unknown'` and `'.'` source values
  coerced to null in seed.
- **Migration 051** (`freshness_cs_projects.sql`) — RPC + cs_projects
  block (row_count, states_covered, latest_vintage, source_release,
  last_updated). No cron (NREL serves through Drupal/Cloudflare; same
  block as LBNL).
- **`scripts/seed-cs-projects.mjs`** — canonical local refresh path.
  Auto-picks the newest `Sharing the Sun*.xlsx` in `public/`, parses the
  "Project List" sheet (47 cols, only 24 useful), filters to individual
  (non-aggregated) projects with valid state + project_id + vintage_year,
  reports per-state distribution before upsert. `--dry-run` available.
  Exact-header column lookup via `Object.keys(headers).findIndex(...)`
  so NREL adding columns mid-list won't break parsing.
- **`src/lib/programData.js` getCsMarketSnapshot(stateId, opts)`** — new
  per-state aggregate exporter. Returns `{projectCount, totalOperationalMwAc,
  medianSizeMwAc, vintageMin/Max, recentInstallsLast5y, topDevelopers (3),
  utilityTypeMix, lmiRequiredCount, lmiAvgPct, sourceRelease, sample (6)}`.
  `sampleMwTarget` opt sorts the sample by closeness to user's target
  MW. Defensive try/catch — null when migration 050 not applied.
- **`src/components/CsMarketPanel.jsx`** — new presentational panel.
  Header shows project count + Sharing the Sun release + state name.
  4 KPI cells (operational MW, median size, vintage range, last-5-yr
  installs). Two side-by-side lists (top developers, utility-type mix).
  LMI line when penetration > 0. Sample of nearest-MW projects (6 rows,
  closest-to-target sort when MW input present, largest-first otherwise).
  Source footer with file attribution.
- **`src/pages/Search.jsx`** — `MaybeCsMarketPanel` wrapper (mirrors
  MaybeRegulatoryPanel/MaybeComparableDealsPanel pattern). Hides when no
  data. Placed BETWEEN Regulatory and ComparableDeals panels — real
  ground truth before curated supplements.
- **Admin Data Health** — FRESHNESS_CONFIG entry for cs_projects
  (mode='seeded', icon='🌞', thresholds [180, 365]).

### Top 15 states by CS project count (NREL Sharing the Sun, Jan 2026)

| State | Projects | Operational MW-AC |
|-------|---------:|------------------:|
| NY    | 1,351    | 2,698.0           |
| MA    |   592    | 1,061.3           |
| MN    |   563    |   931.7           |
| ME    |   449    |   474.0           |
| IL    |   261    |   512.6           |
| MD    |   224    |   250.2           |
| CO    |   192    |   231.0           |
| NJ    |   164    |   194.2           |
| FL    |    63    | 3,873.4           |
| OR    |    52    |    92.0           |
| WA    |    42    |    19.6           |
| VT    |    30    |    10.9           |
| GA    |    22    |   135.7           |
| SC    |    21    |    24.0           |
| CA    |    20    |   217.3           |

(FL low project count + huge MW = utility-style large CS like FPL
SolarTogether, makes sense. CA's tiny count tracks "limited" status.)

### Aden-side action items (apply when convenient)

1. **Apply migrations 050 + 051** in Supabase SQL editor.
2. **Seed `cs_projects` locally**: `node scripts/seed-cs-projects.mjs`
   (~3,799 rows from `public/Sharing the Sun Community Solar Project Data
   (Jan 2026).xlsx`). `--dry-run` available.
3. **Then revisit the $/W question** independently — the visible Phase D
   lineage panel + the new Phase C-pivot ground truth gives you the
   complete data-validity picture before deciding path-2 spend.

### What NREL's Sharing the Sun unlocks for the platform

- **Per-state market reality check**: validate `state_programs.cs_status`
  against actual operating MW. Some states with `'active'` have thin
  deployment; some with `'limited'` have huge utility-style CS markets.
- **Real comparables for the Lens** — replaces synthesized comparable_deals
  with actual operating projects matching MW + state.
- **LMI deployment penetration per state** — informs §48(e) Cat 1 patterns.
- **Developer concentration signal** — which players are active where.

### Next pickup options

1. **Path 2 — ground-truth Tier B states for $/W**. Now with full
   data-validity picture visible (Phase D lineage + Phase C-pivot ground
   truth), the cost question can be re-evaluated. LevelTen PPA Index
   (~$1.5K/yr), industry-developer survey, or direct outreach to state
   programs.
2. **IX scraper expansion** (CAISO/ERCOT/SPP/WECC, ~1-2 wks).
3. **Mobile responsiveness audit** (~2-3 days).
4. **Phase 3 multi-tenant RBAC** (queued for customer #2).
5. **Use cs_projects to validate `state_programs.cs_status`** — flag
   states whose stated status doesn't match their actual operating MW.
   Could be a small audit script.
6. **Replace synthesized comparable_deals with cs_projects-driven**
   real deal cards. Larger refactor of ComparableDealsPanel.

### Resume-prompt suggestions

- *"Apply 050 + 051, run seed-cs-projects, then [pickup option N]"*
- *"What's the data-validity picture look like across both Phase B/D and the new ground truth?"*

---

## Pickup (prior, 2026-05-04 evening) — LBNL Phase D shipped: solar_cost_lineage now visible in Lens methodology dropdown (3-vs-14 honest disclosure)

**Session 2026-05-04 (continuation, third commit).** Phase D landed as a
sibling to Phase B's table + pipeline. Honest 3-vs-14 disclosure: every
Lens result for a CS state now surfaces an explicit data-lineage panel
above the methodology paragraph — Tier A teal panel with observed LBNL
percentiles + sample size + p25-p75 band when n≥40, Tier B amber panel
explicitly stating "no qualifying LBNL TTS sample" + the regional analog
basis when not. Both link out to LBNL Tracking the Sun.

### What landed in Phase D (this session, third commit)

- **`SolarCostLineagePanel`** new component in `Search.jsx:1713` (above
  `OfftakeCard`). Reads `rates.solar_cost_lineage` (attached by Phase B's
  `getRevenueRates`) and renders one of two visual states:
  - **Tier A — observed**: teal panel, "LBNL observed" mono-caps badge,
    install_count + p10/p25/p50/p75/p90 grid, vintage stamp, → Tractova
    2026 anchor synthesized value. LBNL link.
  - **Tier B — regional analog**: amber panel, "no qualifying sample
    (n<40)" disclosure, synthesized value, state-specific basis pulled
    from `rates.notes` (per-state rationale from migration 044).
- **Methodology paragraph rewritten** at `Search.jsx:2222` — the
  state-specific NY/MA/CA values previously hardcoded into the static
  paragraph are now pulled into the dynamic per-state panel above. Static
  paragraph retains the national 2026 anchor + forward-extrapolation
  driver layers (NREL +22% YoY / FEOC / reshoring / logistics).

### Visible state of CS coverage today (after seed-solar-cost-index ran)

| Tier | Count | States |
|---|---|---|
| **A — LBNL observed** | 3 | CA, MA, NY (n=468 / 84 / 183) |
| **B — regional analog** | 14 | IL, MN, CO, NJ, ME, MD, FL, CT, HI, NM, OR, RI, VA, WA |

Every Lens result now shows which tier the user is looking at. The
asymmetry is no longer a hidden engine detail — it's the first thing in
the data-lineage block.

### Aden-side action items (carried over from previous pickup)

1. **Apply migrations 044, 045, 046, 047, 048, 049 in Supabase SQL editor.**
   048 must precede 049 (049 references the table 048 creates).
2. **Migration 048 already applied** — confirmed by tonight's
   successful `node scripts/seed-solar-cost-index.mjs` run (3 rows
   upserted).
3. **(Optional) Configure `LBNL_TTS_CSV_URL`** in Vercel env vars to
   enable the annual cron.

### Next pickup options (priority-ordered)

1. **Phase C — EIA Form 860 utility-scale cross-check** (~1-2 days). Add
   a second source feeding `solar_cost_index` for utility-scale ≤25 MW
   solar. Validation across two independent federal datasets. Plan
   detail at `~/.claude/plans/what-about-sites-like-quiet-blanket.md`.
2. **Path 2 — Ground-truth Tier B states**. LevelTen PPA Index (paywalled,
   ~$1.5K/yr), industry-developer survey, or direct outreach to state
   programs for cost-data validation. The Phase D UI now makes the gap
   visible; this closes it.
3. **IX scraper expansion** (CAISO/ERCOT/SPP/WECC, ~1-2 wks).
4. **Mobile responsiveness audit** (~2-3 days).
5. **Phase 3 multi-tenant RBAC** (queued for customer #2).

### Resume-prompt suggestions

- *"Phase C — wire EIA Form 860 as a second source"*
- *"What's the cheapest path to Tier-A coverage on the 14 Tier-B states?"*
- *"Continue with [option N]"*

---

## 🟢 Pickup (prior, 2026-05-04 evening) — LBNL Phase B shipped: solar_cost_index pipeline + annual cron + seed script + freshness card

**Session 2026-05-04 (continuation).** Phase B of the LBNL ingestion plan
landed. Solar $/W upstream truth (LBNL Tracking the Sun observed
percentiles) now has a dedicated table + automated annual ingestion
pipeline. The data-lineage layer is ready for Phase D's UI surfacing.

### Aden-side action items (apply when convenient)

1. **Apply migrations 044, 045, 046, 047, 048, 049 in Supabase SQL editor.**
   Order matters for 048 → 049 (049 references the table 048 creates).
   044-047 are the data-trust-audit re-anchors from the previous pickup;
   048-049 are Phase B (table + freshness RPC update).
2. **Seed `solar_cost_index` locally**: `node scripts/seed-solar-cost-index.mjs`
   (uses `public/TTS_LBNL_public_file_29-Sep-2025_all.csv` already on disk;
   ~17-25 state rows for the 0.5-5 MW LBNL large non-res bracket, 2022-2024
   install years). `--dry-run` available for inspect-without-upsert.
3. **(Optional) Configure `LBNL_TTS_CSV_URL`** in Vercel env vars to enable
   the annual cron (`0 8 1 11 *` — Nov 1 each year). Without the env var,
   the cron returns ok:false with a "use seed script" message — graceful.

### What landed in Phase B (this session)

- **Migration 048** (`solar_cost_index.sql`) — per-state PV installed-cost
  percentiles (p10/p25/p50/p75/p90) with sample size + vintage_year +
  source attribution. RLS public-read + admin-write. Indexed on
  (state, sector, vintage_year desc) for the latest-vintage lookup.
- **Migration 049** (`freshness_solar_cost_index.sql`) — extends
  `get_data_freshness()` RPC with a solar_cost_index block (row_count,
  states_covered, latest_vintage, last_updated, last_cron_success).
- **`api/refresh-data.js` → `refreshSolarCosts()`** — new handler. Streams
  the LBNL TTS CSV via `LBNL_TTS_CSV_URL` env var, applies the same filter
  as the Phase A aggregator (non-res segments + 0.5-5 MW DC + last 3
  install years + sanity bounds), computes per-state percentiles, upserts.
  Excluded from `?source=all` and `?source=fast` so weekly cron + admin
  Refresh button never trigger the heavyweight 1.9 GB upstream fetch —
  fires only on its own annual `?source=solar_costs` cron or explicit
  invocation.
- **`scripts/seed-solar-cost-index.mjs`** — canonical local refresh path.
  Auto-picks the newest `public/TTS_LBNL_public_file_*.csv` by mtime, or
  `--file=PATH` override. `--dry-run` prints the per-state aggregate
  table without writing. Filter constants mirror the cron handler exactly.
- **`src/lib/programData.js` getRevenueRates / getAllRevenueRates** — now
  joins `solar_cost_index` lineage onto the rates payload as a new
  `solar_cost_lineage` field (LBNL p10/p25/p50/p75/p90 + n + vintage +
  source URL). Defensive: try/catch around the lineage fetch so production
  doesn't break if migration 048 hasn't been applied yet — null lineage,
  no throw. Engine still reads `installed_cost_per_watt` from
  revenue_rates (Tractova's 2026-forward synthesis), unchanged. Lineage
  is data-trust evidence for Phase D's Lens methodology surfacing.
- **`vercel.json`** — annual cron entry `{ path: '/api/refresh-data?source=solar_costs', schedule: '0 8 1 11 *' }` (Nov 1 at 08:00 UTC).
- **Admin freshness card** — `src/pages/Admin.jsx` FRESHNESS_CONFIG +
  `api/data-health.js` cadence map both updated. Card shows row_count,
  last cron success age, with thresholds [400, 540] days (annual data).

### Architectural decision: solar_cost_index ≠ engine input

`solar_cost_index` stores OBSERVED LBNL TTS truth (e.g. NY p50 ~$1.58/W
for 2022-2024 install years). `revenue_rates.installed_cost_per_watt`
carries Tractova-synthesized 2026 forward (e.g. NY $2.03/W = LBNL × 0.83
multiplier × $2.45 national 2026 anchor with explicit NREL +22% YoY
forward). Plan A originally proposed using LBNL p50 directly as the
engine value, but the data-trust audit work that landed in 044-047 makes
that a regression — it would silently undo the audit's careful 2-year
forward extrapolation.

The Phase B that actually shipped: LBNL is the data-lineage / upstream
truth layer; Tractova-synthesized 2026 forward stays the engine value;
Phase D will surface BOTH in the Lens methodology dropdown ("LBNL TTS
2024 observed: $1.58/W (n=183) → Tractova 2026 anchor: $2.03/W").

### Next pickup options

1. **Phase D — Lens methodology UI surfacing** (~0.5 day). Wire
   `solar_cost_lineage` into `Search.jsx:2116` revenue methodology
   dropdown so users see "TTS observed $X.XX/W (n=Y, vintage 2024) →
   Tractova 2026 anchor $Z.ZZ/W". Plan calls this Phase D.
2. **Phase C — EIA Form 860 cross-check** (~1-2 days, optional). Add
   second source feeding solar_cost_index for utility-scale validation.
3. **IX scraper expansion** (CAISO/ERCOT/SPP/WECC, ~1-2 wks).
4. **Mobile responsiveness audit** (~2-3 days).
5. **Phase 3 multi-tenant RBAC** (queued for customer #2).

### Resume-prompt suggestions

- *"Apply migrations 044-049, run seed-solar-cost-index, then ship Phase D"*
- *"Continue with [option N]"*

---

## 🟢 Pickup — Data-trust audit closed all 4 high-risk surfaces (sessions 5+6+audit arc, 24 commits since 2026-05-03) → next: Aden applies migrations 044-047 + post-audit menu

**Session 2026-05-04.** Long uninterrupted block. Three threads finished
end-to-end: (1) the original site-walk plan closed in entirety (Sessions
1-6, 100% complete); (2) the LBNL ingestion plan Phase A shipped + got
self-audited and corrected after Aden caught a Lazard-citation problem;
(3) the data-trust audit Aden bookmarked got built, identified 4
high-risk Tier C/B surfaces, and **all 4 are now closed** with the
audit script as a permanent infrastructure piece for future scans.

### Aden-side action items (apply when convenient)

1. **Apply migrations 044, 045, 046, 047 in Supabase SQL editor** — each is
   safe to re-run (`UPDATE ... WHERE state_id = '...'` pattern, targeted
   columns only, doesn't touch other 16 fields). Order doesn't matter.
   - **044** — CS $/W (PV-only) re-anchored on NREL+LBNL TTS + 2026 forward
   - **045** — C&I $/W (commercial) re-anchored same methodology -$0.05
   - **046** — BESS capacityPerKwYear on 2024-25 ISO clearing × accreditation
   - **047** — BESS demand+arb documented + CA/HI refinements
   - All four touch `revenue_rates` table only, different columns. Re-pasting
     043 is no longer needed (044 supersedes its CS layer).
2. **Test `hello@tractova.com` forwarding from a non-Gmail account.**
   Gmail's loop-detection sometimes squashes self-forwards. Try work email
   or any non-Gmail. Confirms migration of email infrastructure (commit
   `563d004` wired `reply_to` on every Resend send).
3. **G4 visual sweep** (still optional) — fire test digest + alert through
   /admin → eyeball Gmail desktop + mobile rendering.

### What landed since the last BUILD_LOG pickup (`bc192d9`, 2026-05-03 evening)

**Site-walk Session 5+6 (closed the 4-session original plan in entirety):**
- `b566fd2` — A2 title strip; G4 enum-leak fixes (IX/Status enum no longer leaks through alert/digest copy); admin staleness email teal correction
- `2d0d78b` — F4 drop CSV + 3-sheet XLSX (Projects + Methodology hyperlinks + Glossary); #12 Analyst Brief Option A drilldown accordion (Brief + Immediate Action always visible; Risk/Opportunity/Stage/Competitive collapsed)
- `563d004` — `reply_to: hello@tractova.com` wired on every Resend send (closes I3 once DNS forwards)
- `06a9751` — Library compare missing sub-scores fixed + LMI scenario unit bug ($79/yr → $79K/yr — missing × 1000 MWh→kWh conversion)
- `5fb2ac0` + `51e0e19` — Compare drawer: condensed Actions row + sticky project-name header
- `30b26d6` — Initial recalibration to Lazard v18 ranges (later corrected)
- `97260b1` — Lazard v18 honest recalibration (acknowledged state-level data isn't what Lazard publishes)
- `5ef5970` — Session 6: G4 deeper email audit (plain-text fallback for spam-filter + a11y; List-Unsubscribe + One-Click POST headers; "Good morning" → "Hi" time-neutral); J1 keyboard shortcuts (Cmd/Ctrl+K palette + Cmd/Ctrl+L Lens + g+d/l/b/g/p vim chord nav + Cmd/Ctrl+/ help dialog); J2 deal notes markdown (Edit↔Preview toggle, toolbar B/I/H/•/1./link/code, ~80-LOC inline parser, no new dependency)
- `279ef06` — Compare AI: rename "Non-obvious insight" → "Pattern"; Market Pulse collapsibility on dashboard NewsFeed; TractovaLoader visibility bug fixed (was hidden by gating condition)
- `14f22fd` — StateDetailPanel Market Pulse: TractovaLoader + collapsibility parity with dashboard
- `cd1056b` — Digest score-drop: render delta inline with SCORE (no standalone alerts-row pill — eliminated the ~60% taller card visual)

**LBNL ingestion plan Phase A — multi-attempt CS $/W recalibration:**
- `a7c44f9` — Initial: CS $/W re-anchored on LBNL TTS 2024 + Tractova forward. Aden then asked for self-audit.
- `6af771d` — **Self-audit fixes** (3 issues caught): citation accuracy ("1-5 MW" → "0.5-5 MW LBNL large non-residential bracket"), forward methodology (NREL +22% YoY 2023→2024 explicitly used vs LBNL's modest trend), denominator ($1.91 actual TTS national median vs prior $2.40 midpoint-of-band synthesis). Corrected Tier A multipliers + values across 17 states.
- Final per-state CS $/W (2026 vintage): NY $2.03, MA $3.38, CA $2.40 (Tier A from TTS observed); IL $2.70, NJ/ME $2.70, MD $2.45, MN $2.21, CO $2.21, NJ $2.70, FL $2.08, CT $3.19, HI $3.80, NM $2.08, OR $2.33, RI $2.94, VA $2.21, WA $2.33 (Tier B regional analog × $2.45 national 2026 anchor). IL $2.70 lands middle of Aden's stated $2.60-$3.00 EPC quote range.

**Data-trust audit — built + run + closed all 4 high-risk:**
- `1b81741` — `scripts/data-trust-audit.mjs` + `docs/data-trust-audit.md` (33 audit entries / 311 fields). Initial scan: 4 high-risk Tier C/B.
- `ce8b2b7` — **C&I $/W** re-anchored same NREL+LBNL methodology with $0.05 CS-premium offset. NY $1.99, MA $3.31, CA $2.35, IL $2.64, HI $3.72, etc.
- `8b7ba0e` — **BESS capacityPerKwYear** re-anchored on 2024-25 ISO clearing × 4-hr BESS accreditation. PJM 2025/26 BRA $98.5/kW-yr × 60% = $59 base; ISO-NE FCM × 60%; CAISO RA × 70%; NY-specific VDER+ICAP stack. Most ISO-NE/NY/CA values came down 25-30% to reflect realistic 4-hr accreditation cuts. PJM roughly stable.
- `bb5574c` — **Composite weights (0.40/0.35/0.25)**: transparent editorial disclosure + Lens UI sensitivity tooltip. New `WEIGHT_SCENARIOS` export with 4 named schemes (default offtake-led, revenue-tilt, IX-tilt, permit-tilt) + `computeDisplayScoreRange()` returning min/max/spread. MarketPositionPanel surfaces "weight sensitivity X-Y" mono-caps line under verdict when spread > 4 pts (suppressed for clearly-strong/clearly-weak projects). Hover → full scenario table.
- `4812f6f` — **BESS demand+arbitrage** documented + small refinements. Comprehensive 50-line methodology block above BESS_REVENUE_DATA covering NREL TP-7A40-71162 regional ranges + Lazard v18 LCOS + ISO LMP buckets. CA arb $40→$45 (NEM 3.0 + duck curve); CA demand $16→$18; HI demand $20→$22.

### Audit final state (vs initial 1b81741)

| Metric | Initial | Now |
|---|---|---|
| **High-risk Tier C/B** | **4** | **0** |
| Tier A entries | 13 / 110 fields | 13 / 110 fields |
| Tier B (regional analog) | 7 / 94 fields | 9 / 114 fields (+20 fields) |
| Tier C (editorial) | 12 / 90 fields | 9 / 53 fields (-37 fields) |
| Mixed | 1 / 17 fields | 2 / 34 fields (CS+CI) |

Tier C entries that REMAIN are defensible editorial product-design choices
where no primary source exists ("how do we map qualitative IX difficulty
to a number 0-100?" — that's product methodology, not data). All
medium-or-low-risk per the audit. Deferred for future product iterations
or A/B testing. List in `docs/data-trust-audit.md`.

### Lessons learned (now codebase-pattern)

1. **Two-layer citations everywhere**: separate "what the source publishes" from "what Tractova synthesizes on top." `revenueEngine.js` header is the model.
2. **Tier A/B/C disclosure** in code comments + audit registry. Saved feedback memory `feedback_no_synthesis_as_primary.md` ensures continuity.
3. **Explicit refresh path** documented for every Tier-A/B field.
4. **UI-level transparency for editorial choices** (composite-weight sensitivity tooltip).

`scripts/data-trust-audit.mjs` is the canonical "what's our data trust state?" tool. Re-run anytime; report regenerates `docs/data-trust-audit.md`.

### Next pickup options (priority-ordered)

1. **LBNL Phase B — automated annual ingestion pipeline** (~3-5 days). Plan exists at `~/.claude/plans/what-about-sites-like-quiet-blanket.md`. Builds `solar_cost_index` table + cron + seed script so values refresh automatically when LBNL releases new TTS each October. Removes the manual "re-run aggregator + write migration" step.
2. **IX scraper expansion** (CAISO/ERCOT/SPP/WECC, ~1-2 weeks). Currently scrape PJM/MISO/NYISO/ISO-NE only. Each ISO is its own ~1-2h investigation against their portal.
3. **Mobile responsiveness audit** (~2-3 days). Search.jsx is 4500+ LOC dense. Likely breaks <640px. Aden's user base is desk-centric so LOW user-impact, but kills the email-footer mobile-disclaimer.
4. **Phase 3 multi-tenant RBAC** (queued for customer #2).
5. **Composite weights anchoring** (when developer-survey data becomes available — currently transparent disclosure suffices).
6. **CI_REVENUE_DATA ppaRateCentsKwh** refresh (Tier C medium-risk per audit; refresh path = LevelTen PPA Index, paywalled, or DOE/PPA Watch).
7. **Tier C remaining items (low priority)**: STAGE_MODIFIERS, score base values, LMI penalties, IX brackets, site sub-score values — could A/B test or anchor against developer-survey data.

### Resume-prompt suggestions

- *"Apply migration 044/045/046/047, then move to LBNL Phase B"*
- *"Audit refresh — run `node scripts/data-trust-audit.mjs` and tell me what's stale"*
- *"Continue with [option N]"*
- Or just say what you want; the audit registry + saved memories carry the context.

---

## 🟢 Pickup — Site-walk Session 5 shipped (`b566fd2` + `2d0d78b`) → next: Aden finishes Namecheap UI toggle, then I wire `replyTo: hello@tractova.com`

**Session 2026-05-03 (Session 5 of the site-walk arc).** Aden returned
the 3 outstanding decisions; this session shipped them as two commits
on `main`. The only remaining work in the entire site-walk arc is the
Namecheap UI toggle for `hello@tractova.com` forwarding (Aden's hands)
and the corresponding `replyTo` wiring (5-LOC commit, fires after Aden
confirms hello@ lands in his Gmail).

### Sessions 1-4 recap (still relevant for context — full detail below)

Aden completed a manual end-to-end walkthrough of the production site
2026-05-02 and captured ~40 findings in `Full Manual Site Review.md`.
The plan (`~/.claude/plans/read-build-log-and-then-sorted-taco.md`)
sequenced the fixes into Groups A–J. Sessions 1-4 closed nearly every
actionable item; Session 5 closed the last 4 that needed Aden's input.

### What landed across the 4 sessions

**Session 1 — `a1c00dd`** · visual + animation + tooltip polish
- Favicon `#0F6E56` → canonical teal `#0F766E`
- StateDetailPanel SubStat sub-headers grey → teal (matches "Strong (75+)" legend)
- Revenue stack ITC adder blue `#3B82F6` → amber `#D97706` so the +10% bonus reads distinctly from ITC base
- Email "+15 idx" → "+15 pts"; digest "IDX" → "SCORE"
- Score-drop alert: structured `delta` (from/to/change) + big "↓ N pts · X → Y" gutter cell in standalone alerts; digest pill shows "Score Drop · ↓N pts" inline
- Profile "Considering canceling?" passive CTA removed (capture path: future Stripe-webhook on subscription.updated cancel_at_period_end=true)
- IntelligenceBackground: removed the slow-flowing teal "fog" band; dots + WalkingTractovaMark wrapped in a gutter mask (initially 18-30% / 70-82%, tightened to 8-12% / 88-92% in Session 2 follow-up after Aden flagged dots still drifting through Pillar Diagnostics cards on a 1920px viewport where content extends 12.5-87.5%)
- WalkingTractovaMark top/bottom variants narrowed to corner gutters
- USMap legend swatches: methodology tooltips on all 7 tiers (Strong/Viable/Moderate/Weak/Non-viable + Pending + No program)
- Site Control status badges: 8 tooltips citing USDA SSURGO / USFWS NWI / hosting-capacity sources
- Data Limitations modal: scrollable (max-h-85vh overflow-y-auto) + cursor-pointer + ⓘ icon on trigger

**Session 2 — `1268cbc`** · data-freshness honesty + Lens score transparency
- Dashboard hero "data refreshed Nd ago" caption now sources from `cron_runs.finished_at` (same RPC as Footer + Admin) — closes the "27d ago" lag from `state_programs.last_verified`
- Admin Data Health: each freshness card carries a `LIVE` / `CURATED` / `SEEDED` chip; new mode legend at top of section. `county_geospatial_data` (NWI+SSURGO) added as `SEEDED`
- "Last Run per Cron" caption clarifies these are *cron completion* timestamps, not data freshness — addresses Aden's IX-scraper-says-stale-while-cron-says-success confusion
- Market Position now surfaces `[STATE] baseline 81 ↓11 project` under the gauge with a tooltip explaining the divergence between Analyst Brief's "the market" (state baseline) and the gauge value (stage + county adjusted)
- `lens-insight.js` SYSTEM_PROMPT rule 16: forbids the AI from conflating "the market" (state baseline) with "your project's score" (project-adjusted gauge)
- Capacity Factor row gets a tooltip + `· NREL PVWatts` provenance suffix — confirms it's per-state averages with examples (CO 20% vs MA 16.5% vs MN 16%)
- Revenue stack methodology dropdown title rewritten: "How we built this revenue stack — sources, ITC math, assumptions"
- Site Control Land + Wetland tile notes now display the actual NWI + SSURGO percentages (Path B numbers were computed but never surfaced)

**Session 3 — `288b1be` + `19b2638`** · scenarios + jump-to-glossary + source-link audit
- `scenarioEngine.js` SCENARIO_PRESETS recalibrated: best-case allocation cap 1.25 → **1.10** (was extrapolating past 110% of curated baseline); worst-case IX cost 1.50 → **2.50** (real-world network-upgrade shocks are wider than ±50%)
- Each multiplier anchored to a public industry source via new `SCENARIO_PRESET_METHODOLOGY` constant (NREL ATB 2024 P10/P90, top-quartile siting CF, historical 12mo REC band, network-upgrade shock IX)
- Each preset chip wraps in Radix Tooltip rendering the multiplier + source table; "Best Case / Worst Case Scenario" added to Glossary
- ScenarioStudio clarifying intro: "Sliders move the financial outputs (Y1 revenue, payback, IRR, NPV, DSCR) — not the Feasibility Index gauge above" — closes the dual-system confusion
- `Glossary.jsx` exports `GLOSSARY_TERMS` + `toSlug`; CommandPalette indexes glossary entries (purple kind tag); Glossary deep-link useEffect now watches `location.hash` so navigations from the palette while already on /glossary re-fire the scroll-to-card flow
- ScenarioStudio post-save: new inline `Saved to your Library · "name" · state · technology · view →` card holds for 6s with click-through to `/library?tab=scenarios`; Library reads `?tab=scenarios` on mount and switches viewMode
- Source-attribution link audit via WebFetch: 4 broken URLs replaced
  - PJM Queue 404 → `planningcenter.pjm.com/planningcenter/`
  - CAISO `.aspx` 404 → `caiso.com/` root (CAISO restructured)
  - `energycommunities.gov` ECONNREFUSED → IRS Low-Income Communities Bonus Credit page
  - IRS ITC 404 → IRS Form 3468 page

**Session 4 — `445bce9` + `a456cca`** · Library/Compare + legal
- Compare AI summary collapsible (default closed) with `insightType` badge in header. `COMPARE_PROMPT` revamped to forbid score restatement and force one of three real insight types (Recommendation / Differentiator / Non-obvious insight); insightType field returned by API and surfaced in UI
- 5 new Compare rows in COMPOSITE section: Offtake / IX / Site Control sub-scores + Wetland coverage + Prime farmland. `lensResultToCompareItem` captures sub-scores via `computeSubScores` + Path B geospatial percentages; library items gracefully degrade to "—"
- Library "Select all": `handleSelectAll` callback fills selection from displayProjects via a ref mirror. Inline "Select all N →" link visible above the grid before any selection; toolbar gains a "Select all (N)" / "Deselect all" toggle
- SignUp.jsx: required `agreed` checkbox — "I am at least 18 years old and have read the Terms of Service and Privacy Policy" with new-tab links. Submit button disabled until checked. Closes the implicit-consent gap left by the statement-only language in Terms § 02
- Terms.jsx § 04 (Acceptable use): reverse-engineering / proprietary-misappropriation clause strengthened with explicit civil-action language citing the Defend Trade Secrets Act (18 U.S.C. § 1836), state trade-secret law, and reservation of all remedies at law and in equity (injunctive relief, damages, attorneys' fees, criminal-violation referral)

### Verification

`npm run verify` ran clean before each push (build + 7 Playwright smoke
tests, 16-26s). Manual prod check guidance in each commit message
covers the surfaces touched.

### What landed in Session 5 (2 commits, 5 file changes)

**`b566fd2` — A2 page title strip + G4 email audit (code-level pass)**
- **A2**: `index.html` `<title>Tractova — Market Intelligence for Solar Developers</title>` → `<title>Tractova</title>`. Aden's call: strip subtitle.
- **G4 enum-leak fixes** (real findings from a code-level pass on `api/send-alerts.js` + `api/send-digest.js`):
  - `send-alerts.js`: added `IX_LABEL` + `STATUS_LABEL` maps. The "IX Queue Harder" alert detail used to render raw `easy → very_hard` enums; now reads `Easy → Very hard`. The TEST alert no longer leaks raw `csStatus` enum.
  - `send-digest.js`: "Markets in Motion" `lastChange` line now formats field names + values through `FIELD_LABELS` / `STATUS_LABEL` / `IX_LABEL` / unit suffixes. Used to render `cs status: active → limited` or `ix difficulty: easy → very_hard`; now reads `Status: Active → Limited`.
  - `check-staleness.js`: legacy green `#0F6E56` → canonical teal `#0F766E` (admin-only staleness email; same drift the favicon had pre-Session 1).
- **G4 deferred**: full Gmail desktop+mobile visual sweep (requires real test send + manual eyeball — not autonomous code work).

**`2d0d78b` — F4 drop CSV / enrich XLSX + #12 Analyst Brief drilldown accordion**
- **F4**: `exportCSV()` and `handleBulkExportCSV` removed. CSV button + bulk action button retired. `exportXLSX()` rewritten as a 3-sheet workbook:
  - **Sheet 1 "Projects"** — existing 18 columns + new sub-score cols (Offtake / IX / Site computed via `scoreEngine.computeSubScores()`) + Wetland Coverage % + Prime Farmland % from Path B geospatial. 23 columns. Header row frozen, USD format on revenue (col U).
  - **Sheet 2 "Methodology & Sources"** — 15 reference rows mapping each pillar/component to authoritative source (DSIRE, EIA Form 861, ISO/RTOs, USFWS NWI, USDA SSURGO, DOE NETL, HUD QCT/DDA, CDFI NMTC, NREL PVWatts, Census ACS) with **clickable hyperlinks** via SheetJS `cell.l = { Target }`.
  - **Sheet 3 "Glossary"** — pulls from canonical `src/lib/glossaryDefinitions.js` `GLOSSARY_DEFINITIONS`. Term + short + long, word-wrap on detail.
  - Header button: dual `CSV` / `XLSX` → single `Export Excel`. Bulk-action toolbar: `Export CSV` → `Export Excel`.
- **#12 (option A — Aden's call)**: new `<BriefDrilldown>` component (~40 LOC, no new dependencies). Chevron-toggled side-rule row with eyebrow always visible, body collapsed by default. ChevronRight rotates 90° on open, 200ms transition. `MarketIntelligenceSummary` restructured:
  - **Always visible**: Brief pull-quote, Decision Signals strip, Immediate Action — Next 30 Days
  - **Collapsed into "Drill-Down" accordion**: Primary Risk (red), Top Opportunity (teal), Stage Guidance — {stage} (teal), Competitive Context (blue)
  - Original gating preserved: Risk + Opportunity hide while a scenario is active (those are base-case signals); Stage Guidance + Competitive Context remain visible always.

`npm run verify` green on both commits (build + 7 smoke, 15.4s and 19.6s).

### Items NOT addressed (need Aden's hands or are deferred)

1. **G4 visual sweep** — Gmail desktop+mobile rendering audit. Aden sends a real test through Admin → Alert tester (urgent + opportunity + digest), eyeballs each in Gmail desktop + Gmail mobile, flags any layout drift. Not autonomous code work.
2. **`hello@tractova.com` mailbox** — see "Where Aden is right now" section below for the live state of the DNS work and the exact next step.
3. **J1 + J2** — custom keyboard shortcuts + Library deal-notes OneNote-style editor. Explicitly deferred per plan ("way down the line" + "needs target UX").

### Where Aden is right now (DNS — the only blocker before `replyTo` lands)

**Goal:** `hello@tractova.com` forwards to `aden.walker67@gmail.com`. Once
that lands, I wire `replyTo: 'hello@tractova.com'` into the Resend send
calls in `api/send-alerts.js` + `api/send-digest.js` (~5 LOC, one
commit). Until then user replies to alerts/digests bounce on the
no-monitor `alerts@` / `digest@` from-addresses.

**Domain context (verified live via Google DNS HTTP API in Session 5):**
- Domain: `tractova.com`, registrar: Namecheap (DNS hosted there too —
  `dns1.registrar-servers.com`). No Cloudflare in the picture.
- **Resend outbound infra is on the `send.tractova.com` subdomain** —
  SPF `v=spf1 include:amazonses.com ~all` lives there. This is
  independent of root-domain mail config. Don't touch `send.*`.
- **Root `tractova.com` MX records (now correctly published, verified
  2026-05-03):**
  ```
  10 eforward1.registrar-servers.com.
  10 eforward2.registrar-servers.com.
  10 eforward3.registrar-servers.com.
  10 eforward4.registrar-servers.com.
  10 eforward5.registrar-servers.com.
  ```
  These replaced a leftover `feedback-smtp.us-east-1.amazonses.com` MX
  that had been at root from Resend's original verification flow. The
  SES MX is for bounce-tracking metrics (mildly useful, not load-bearing
  — Tractova's volume is low enough that fewer bounce details is fine).
- **Root TXT (SPF) record (already there, kept as-is):**
  `v=spf1 include:spf.efwd.registrar-servers.com ~all`

**The block as of session end:**
Even with all 5 eforward MX records correctly published on `@`,
Namecheap's UI on the **Domain** tab is still showing
*"Your domain is using other email service"* and the Redirect Email
section is locked. The DNS plumbing is correct; what's missing is a
**Namecheap UI toggle** — a "Mail Settings" dropdown / radio control
on the Domain tab (separate from Advanced DNS) that has to be flipped
to "Free Email Forwarding". Namecheap's UI checks that toggle, not the
live DNS records, before unlocking the Redirect Email rules.

**Aden's exact next step when he picks this back up:**
1. Namecheap → Domain List → tractova.com → Manage → **Domain** tab
   (default tab, leftmost — *not* Advanced DNS).
2. Find a section/dropdown labeled one of: "Mail Settings", "Email",
   "Redirect Email" header, or a left-side nav item. The control may
   be a dropdown (options: Custom MX / Free Email Forwarding / MXE /
   Private Email / No Email Service) OR a radio set OR a "Manage"
   button next to "Email Forwarding".
3. Set it to **"Free Email Forwarding"** → save.
4. The Redirect Email card will unlock → add row: alias `hello` →
   forward to `aden.walker67@gmail.com` → save.
5. Wait 5-30 min for Namecheap-side propagation (DNS MX is already in
   place from Session 5, so the wait is only Namecheap's internal
   provisioning of the alias).
6. Send a test email to `hello@tractova.com` from any other account —
   confirm it arrives in Gmail (and check Spam folder for the very
   first message).

If the Domain tab UI doesn't expose any "Mail Settings" control at all,
fallback option is to screenshot the page and I'll point at the right
control — Namecheap reorganizes their UI periodically and the dropdown
sometimes hides under a "Manage" button.

**When Aden confirms `hello@tractova.com` lands in his Gmail:**
- I add `replyTo: 'hello@tractova.com'` to the Resend `sendEmail()`
  helpers in `api/send-alerts.js:399-413` (alerts) and
  `api/send-digest.js:374-388` (digest). Single field added to the
  fetch body. ~5 LOC change, one commit.
- (Later, optional) wire Gmail "Send mail as `hello@tractova.com`"
  via Resend SMTP so Aden can reply *as* hello@. Not blocking.

### Next session start prompt

Just say *"continue with the remaining items"* or *"hello@ landed,
wire replyTo"* and Claude reads this section to pick up. The full
context is here — DNS state, what's shipped, what's pending, exact
next code change.

---

## Previous pickup — Cron latency monitor + AI scenario commentary + onboarding deepened (LensTour) + NWI catch-up running

**Session 2026-05-02.** Three ship items + one long-running data refresh:

1. **LensTour onboarding walkthrough** (`8848dd8`) — first-time-Pro Lens
   tour, four-step coachmark with spotlight + closing card. Closed the
   audit-roadmap "post-confirmation tutorial trigger" gap.
2. **AI scenario commentary** (`2cd7399`) — every saved Scenario Studio
   row gets an inline "▸ Why?" expander that fetches a 2-3 sentence
   Haiku 4.5 narrative explaining the dominant 1-2 input drivers behind
   the IRR/payback/NPV/DSCR shifts. Auto-fires on save. Cached server-side
   under a content hash so identical runs across users share one API call.
3. **Cron-runs latency monitor** (this commit) — promoted from P2 backlog.
   Admin Data Health tab now ends with a "Cron Latency" panel that pulls
   the last 30 days of `cron_runs`, computes p95 / max / avg per
   `cron_name`, maps each handler to its parent function's `maxDuration`
   ceiling, and severity-bands the result (warn ≥ 70% of ceiling, watch
   ≥ 50%, ok otherwise). First spot-check on live data flags
   `monthly-data-refresh` (substations) at p95=34s on a 60s ceiling
   (57% utilization, WATCH) — a real drift the team can act on before
   it tips into a 504 like `bbc9543` did.
4. **NWI catch-up seed running in background** — `--refresh --parallel=2`
   reprocessing 2,144 counties (anything with `wetland_last_updated > 90
   days OR null`). Coverage was 79.9% pre-run; goal is 95%+. ETA ~2h;
   logs at `.logs/nwi-seed-2026-05-02.log`.

Migration **042 confirmed live in Supabase** via direct probe
(`scenario_snapshots` 7 rows, `cancellation_feedback` 0 rows — table
present, awaiting first prod survey submission).

### What landed this session

#### Cron-runs latency monitor (this commit)

- **`src/lib/cronLatencyMonitor.js`** (new). Pure helper:
  `analyzeCronLatency(supabaseClient, daysBack=30)` queries `cron_runs`
  for `status='success'` rows in the window, buckets by `cron_name`,
  computes p95 (linear-interpolated), max, avg, and headroom-vs-ceiling.
  `FUNCTION_BUDGETS_MS` mirrors `vercel.json` configured maxDurations
  (refresh-data 300s, lens-insight + refresh-substations + refresh-ix-queue
  + refresh-capacity-factors all 60s). Cron-name prefix-stripping handles
  the `refresh-data:nmtc_lic` style. Default 60s ceiling for unconfigured
  handlers (send-digest, send-alerts, check-staleness). Severity bands at
  70% / 50% of ceiling. Sorts warn-first so the panel surfaces the drift
  at the top.
- **`src/pages/Admin.jsx`** — new `<CronLatencyPanel>` rendered at the
  bottom of the Data Health tab. Mounts → loads the helper → renders a
  table (Cron Name · Runs · p95 · Max · Avg · Ceiling · Headroom · Severity)
  with brand-coloured severity pills (red warn / amber watch / emerald
  ok). Inline copy explains the rationale and references the original
  `bbc9543` 504 to make the value concrete.

**Verification:** `npm run verify` green (build + 7 smoke tests in 16s).
A live-DB spot check via `analyzeCronLatency()` returned 11 distinct
crons over 239 samples; the only drift is `monthly-data-refresh` at
57% utilization (WATCH) — the substations cron creeping toward its
60s ceiling. Exactly the structural class of bug the monitor exists
to catch before it becomes a 504.

**Manual prod check after Vercel redeploy:** sign in as admin →
`/admin?tab=8` (Data Health) → scroll past Last Run per Cron → "Cron
Latency" table renders with the same WATCH on `monthly-data-refresh`.

#### AI scenario commentary (`2cd7399`)

- **`api/lens-insight.js`** — new `scenario-commentary` action routed
  through the existing endpoint (12-function Hobby cap is full, so any
  new AI feature has to multiplex). New `SCENARIO_COMMENTARY_PROMPT`
  (analyst-tone, 60-word ceiling, declarative). New helpers
  `describeScenarioDeltas()` + `formatScenarioOutputs()` build a structured
  user-message context out of the JSONB columns from `scenario_snapshots`.
  Uses **Haiku 4.5** (`claude-haiku-4-5-20251001`) for ~$0.001/call, 30-day
  cache TTL keyed on hashed inputs+outputs (rounded to 4 decimals so
  floating-point drift collapses). When no scenario inputs diverge from
  baseline, the handler short-circuits to a "Baseline run" stock string
  without burning an API call.
- **`src/components/ScenarioHistoryList.jsx`** — per-row `▸ Why?` /
  `▼ Hide` expand button surfaces the AI commentary inline beneath the
  row metrics. Component-local state caches the response so re-toggling
  is free. Loading / error / no-yet states render distinctly. Kept the
  existing `↳ inputs` mechanical summary line since the AI narrative is
  complementary, not a replacement.
- **`src/components/ScenarioStudio.jsx`** — `handleSave()` now uses
  `.select('id').maybeSingle()` so we capture the inserted row's id,
  passed down as `autoExpandId={justSavedId}`. The history list's effect
  picks it up after `loadSavedScenarios()` rehydrates and auto-fires the
  commentary fetch. 4-second hold ensures the Haiku call lands inside
  the auto-expand window.
- **Library "Scenarios" tab** also benefits — same component, same prop
  surface — without any Library.jsx change.

**Verification:** `npm run verify` green (build 2.97s + 7 smoke tests
in 15.7s). No new console warnings.

**Manual prod check after Vercel redeploy:** open Lens for any saved
project, drag a couple of sliders, save with a name → row appears in
the history list with `◆ Analyst note` panel auto-open + Haiku commentary
("a $0.20/W capex cut adds ~220 bps of project IRR; the 5% capacity-
factor bump compounds the effect to lift Y1 revenue 12%."). Click
`▼ Hide` to collapse. Expand again → instant (cached). Open any older
saved row → `▸ Why?` fires a fresh fetch (or cache hit if another user
ran the same scenario).

#### LensTour onboarding (`8848dd8`)

- **`src/components/LensTour.jsx`** (new, ~270 LOC). Reads
  `?onboarding=1` from URL + checks `tractova_lens_tour_completed_at`
  in localStorage. If both clear and Lens results have rendered, fires
  a 5-step coachmark walkthrough: spotlight ring (inverted box-shadow
  trick → dim everywhere except the anchor) + tooltip card with serif
  title + research-grade body copy + Step N/4 + Skip + Back/Next/Finish.
  Closes with a "Now run your own analysis" centered modal. ESC dismisses
  + persists. ArrowLeft/Right + Enter for keyboard nav. Re-measures on
  resize/scroll. Falls forward gracefully if a `data-tour-id` anchor is
  missing (skips the step rather than stranding the user).
- **`src/pages/Search.jsx`**: 4 `data-tour-id` anchors added
  (`composite` on MarketPositionPanel, `pillars` on the navy
  Pillar Diagnostics band, `scenario` on ScenarioStudio, `save` on the
  Save-as-Project button) + `<LensTour resultsReady={!!results} />`
  mounted inside the result panel. ~12 LOC delta.
- **`src/pages/UpgradeSuccess.jsx`** + **`src/components/WelcomeCard.jsx`**:
  DEMO_HREF now appends `&onboarding=1` so first-time-Pro users (post-
  Stripe redirect) and Dashboard onboarders both arrive with the tour
  trigger primed.
- **Persistence**: localStorage-only. Re-doing a 30-second walkthrough
  on a new device isn't worth a migration; the existing welcome-card
  pattern's DB column would have introduced 043 + a Supabase paste
  burden for marginal value.

### Verification

`npm run verify` green (build 2.97s + 7 Playwright smoke tests in 17.4s).
No new console warnings, no DOM-structure tests broken (smoke.spec
doesn't touch the result panel internals; pro-smoke.spec would but
DEMO_HREF wasn't referenced there).

### Manual prod verification after Vercel redeploy

- Sign in as a Pro test account, hit
  `/search?state=IL&county=Will&mw=5&stage=Prospecting&technology=Community%20Solar&onboarding=1`
- Lens auto-runs (existing 5-param auto-submit logic) → after results
  render + ~600ms settle, Step 1 (Composite Feasibility Index) spotlight
  fires, page scrolls the gauge to center, navy dim everywhere else.
- Click Next → smooth scroll to Pillar Diagnostics + new tooltip.
- Step 3 → Scenario Studio. Step 4 → smooth scroll back up to Save
  button (anchor at top of result panel).
- Click Finish → centered "You're set" close card. Click "Got it" →
  tour exits + localStorage `tractova_lens_tour_completed_at` written.
- Reload the same URL → tour does NOT re-fire (localStorage hit).
- Open in a different browser/profile (clean localStorage) → tour fires
  again — expected for the lean implementation.
- ESC at any step → tour exits + persists.
- Skip button at any step → same.

### Next pickup options (priority-ordered)

- **ISO scraper repair status (in progress)**
  - ✅ **NYISO restored (`94fe80c`)** — landing-page xlsx discovery
    + parse with `xlsx` package. Active queue now flowing again.
  - 🚫 **PJM ABANDONED for legal reasons (2026-05-02).** Data Miner 2
    TOS forbids redistribution of derived data without a paid PJM
    Redistribution License. Incompatible with SaaS use. Decision:
    keep PJM stale, surface honestly via the existing IX·Live amber
    pill. Revisit only with attorney guidance or alternative public-
    domain queue path (FERC Form 715/1 filings, PJM Manual 14H Att B).
  - ⏸️ **ISO-NE pending investigation.** Their landing pages
    (system-planning/transmission-planning/interconnection-queue,
    system-planning/key-study-areas/queues, system-planning/
    system-plans-studies/interconnection-queue) all 404 to plain
    HTTP probes — their site likely requires a specific user-agent
    or JS rendering. Needs a focused 1-2h investigation session via
    a real browser to discover the current xlsx URL pattern.
  - Once PJM is restored, the originally requested PJM expansion to
    DC/DE/OH/PA/VA/WV is ~30min of UTILITY_STATE_MAP additions
    (utility codes and state mappings need to come from the live
    Data Miner 2 response shape, which we haven't seen yet).
- **NWI re-run for the 622 timeouts** — first pass 2026-05-02 hit 92.1%
  coverage; the remaining gap is mostly NWI-server-throttled counties
  in ND/SD/MT. A second `node scripts/seed-county-geospatial-nwi.mjs
  --refresh --parallel=2` run would likely lift coverage to 95-97%.
  Run it on a quieter day (mid-week, off-business-hours) to dodge the
  NWI ArcGIS server's peak load.
- **Investigate `monthly-data-refresh` drift** — the new latency monitor
  flagged it at 57% utilization on the 60s ceiling. Same structural
  class of bug as the original `bbc9543` 504 (sequential per-state).
  Worth a parallelization pass before it tips.
- **Mobile responsiveness audit** — Search.jsx is now 4500+ LOC with
  dense Lens result + scenario grid + tour overlay; likely breaks
  <640px. Aden's user base is desk-centric so LOW user impact, but
  still a polish item.
- **Search.jsx component extraction** — 4500-line monolith. L effort,
  LOW user-visible impact (maintenance).
- **Cron-runs latency monitor** (P2 backlog, see `dc85c18`).
- **Path-toward-50-states-fully-live**: site (✅) → IX (scraper
  expansion) → utility serving (EIA Form 861) → offtake (✅).
- **Phase 3 multi-tenant RBAC** — when customer #2 is queued.

---

## ✅ Shipped 2026-05-01 (afternoon-evening) — $29.99/mo launch roadmap: Phases 0, 1, 2, 4 + churn

**Session 2026-05-01 (afternoon-evening, ~8h after the morning Path B + audit
work).** Senior-consultant audit scored the product 58/100 against the
$29-49/mo bar for sub-100-shop CS developers. Today closed the highest-
leverage gaps in a single thrust: pricing positioning, trust signals,
glossary infrastructure, the killer Scenario Studio feature (with full
financial-modeling stack), bulk Library operations, broad coverage
expansion, and a churn-defense flow. **Phase 3 (multi-tenant RBAC) is
deferred** — no customer #2 lined up; Aden wants a complete product
before targeting an audience.

**Today's launch-roadmap commits on `main` (most recent first):**

```
357d7f9  ScenarioStudio polish: confirm-delete + visible-save + input pills + auto-Lens
a13f33d  ScenarioStudio: history list + orphan promote + Library Scenarios tab
fd621a0  Churn flow: pre-cancel exit-intent survey + cancellation_feedback table
251bc38  Phase 4: C&I offtake → 32 states · BESS offtake → 25 states
e696d40  ScenarioStudio: 3 lifecycle sliders + Equity-IRR + DSCR
0dcc051  ScenarioStudio: IRR + LCOE + NPV + lifetime rev, presets, share-with-memo
6caf484  ScenarioStudio: directional slider colors
576927b  Phase 2 part 2: Library scenarios chip + PDF embed + project_id wiring
42fd476  Phase 2: Scenario Studio (engine + UI + integration + migration 041)
c72272e  Phase 1: trust signals + glossary tooltips + Library bulk ops
7cf5713  Phase 0: pricing → $29.99/mo + 14-day trial, webhook hardening, cron consolidation
```

**Two SQL migrations Aden still needs to apply** (paste into Supabase SQL editor):

1. **Migration 041** — `041_scenario_snapshots.sql` — table + RLS for the
   Scenario Studio save/load/share flow. Until applied, the Save button
   silently fails (try/catch logs warn but never blocks the user).
2. **Migration 042** — `042_cancellation_feedback.sql` — table + RLS for
   the pre-cancel exit-intent survey. Until applied, the modal still
   renders + routes to Stripe portal but no feedback row is recorded.

Aden noted he's already run 041; 042 still pending verification.

**Audit roadmap status (was 58/100):**

| Phase | Scope | Status | Audit-score impact |
|-------|-------|--------|---------------------|
| 0 | Pricing → $29.99 + trial · webhook hardening · cron consolidation | ✅ shipped (`7cf5713`) | +5 |
| 1 | Trust signals (Landing) · Glossary tooltips · Library bulk ops | ✅ shipped (`c72272e`) | +10 |
| 2 | Scenario Studio (Year 1 rev + payback + IRR + LCOE + NPV + Equity-IRR + DSCR + Lifetime rev + Best/Worst presets + share-flow + Library card chip + PDF embed) | ✅ shipped (`42fd476` → `357d7f9`) | +20 (3-4× the planned scope) |
| 3 | Multi-tenant RBAC | ⏸ deferred | n/a — no customer #2 |
| 4 | C&I 12 → 32 states · BESS 8 → 25 states | ✅ shipped (`251bc38`, exceeded plan target) | +5 |
| Bonus | Churn defense — pre-cancel survey + win-back hook | ✅ shipped (`fd621a0`) | +5 (HIGH ROI per the audit gap-scan) |

Projected new score: **80-85** (clearing the $29-49/mo bar). Phase 3 +
mobile audit + onboarding deepening are the items still below that line.

**Verification on prod after Vercel redeploy + migrations applied:**

- Open Lens for IL/Lake/CS/5MW → Scenario Studio renders as § 03 with 9
  sliders (3 lifecycle + 6 inputs depending on tech), 8 metrics in the
  navy output card, Best/Worst preset chips, modified-inputs pill row.
- Drag any slider → metrics + pills + slider-track color update live.
- Click "◆ Save this scenario" → name input → Enter → "Saved [name]"
  green badge lingers 2.5s → row appears in the vertical history list
  below the panel with timestamp + Y1 rev + IRR + payback + delta + the
  "↳ inputs" sub-line.
- Trash icon on a saved row → confirm modal → "Delete scenario" → row
  vanishes. NO auto-delete.
- Without saving the project, navigate to /library → toggle "Scenarios"
  tab → see the saved scenarios grouped under "IL · Lake · CS — Exploration
  · not yet in Library" with an "Open in Lens to save →" CTA.
- Click that CTA → /search auto-runs (loading screen fires immediately,
  no manual Run click) with state+county+mw pre-filled.
- Save the project from Lens → toast confirms "N scenarios attached
  to this project" (orphan auto-promote).
- Library card shows "Scenarios · N" badge in the card header. Click →
  card expands + picker opens. Pick one + "Include in PDF" → Export PDF
  → recipient sees the scenario block in the deal memo PDF.
- Profile page → click "Considering canceling?" link below "Manage
  subscription" → exit-intent modal opens with reason radios + free-text
  → "Continue to Stripe" writes a `cancellation_feedback` row + opens
  the Stripe portal.

**Next pickup options (priority-ordered):**

- **Apply migration 042** (cancellation_feedback) — required for the
  exit survey to record rows. 041 already applied per Aden.
- **Mobile responsiveness audit** — Search.jsx is 4500 lines with dense
  Lens result panel + scenario grid; likely breaks <640px. Aden's user
  base is desk-centric so LOW impact, but still a polish item.
- **Onboarding deepening** — UpgradeSuccess + WelcomeCard exist; gap is
  the post-confirmation tutorial trigger. M effort, HIGH impact on
  trial conversion.
- **AI scenario commentary** — auto-explain "your IRR dropped 200 bps
  because X" when a scenario is saved. M effort, MED impact (polish on
  top of an already-deep feature).
- **Search.jsx component extraction** — 4500-line monolith. L effort,
  LOW user-visible impact (maintenance only).
- **Cron-runs latency monitor** (P2 backlog, see `dc85c18`).
- **Phase 3 multi-tenant RBAC** — when customer #2 is queued.
- **Path-toward-50-states-fully-live**: site (✅) → IX (scraper expansion)
  → utility serving (EIA Form 861) → offtake (now ✅ via Phase 4).

---

## ✅ Shipped 2026-05-01 (afternoon) — $29.99/mo launch roadmap: Phases 0/1/2/4 + churn (`7cf5713` → `357d7f9`)

**Eleven commits across one continuous block.** Audit consultant scored
the product 58/100 against the $29-49/mo bar — closed by sequencing the
4 highest-leverage roadmap phases plus a churn-defense bonus.

### Phase 0 — pricing + Stripe hardening (`7cf5713`)
- Pricing flipped from $9.99 → **$29.99/mo + 14-day no-credit-card trial**
  (the $9.99 was actively collapsing the "this is real software" perception).
  Stripe price ID env-var swap + UpgradePrompt copy refresh + trial
  messaging on Landing.
- `api/create-checkout-session.js` now passes `subscription_data:
  {trial_period_days: 14}`.
- `api/webhook.js` hardened: validates `client_reference_id` against
  `profiles` via `maybeSingle()` before tier upsert; trial-aware status
  retrieval from Stripe so webhook captures `trialing` vs `active`.
- `vercel.json` cron consolidation: 9 → 7 entries (merged 3 refresh-data
  source-specific calls into a single weekly `?source=all`).

### Phase 1 — trust signals + glossary + bulk ops (`c72272e`)
- **Landing trust signals**: data-sources strip (8 federal/ISO sources
  named — EIA / NREL / USFWS NWI / USDA SSURGO / Census ACS / DSIRE /
  ISO/RTO) + 3-column time-saved comparison ("4 hours manual research
  → 2-min Lens analysis · 120× faster"). Quantifies the labor
  replacement directly.
- **Glossary tooltips**: new `src/lib/glossaryDefinitions.js` with 14
  canonical entries (Site Control, IX, Offtake, Feasibility Index, LMI
  Carveout, Prime Farmland, Wetland Warning, Capacity Factor, REC, ITC,
  Energy Community, Program Runway, IX · Live, Site · Live). Wrapped in
  Radix tooltips via new `<GlossaryLabel>` component (mirrors the
  existing TechLabel pattern). Wired into Search.jsx sub-score labels +
  Glossary page auto-includes via `Object.entries(GLOSSARY_DEFINITIONS)`.
- **Library bulk ops**: per-card checkbox + sticky toolbar at top of
  grid showing N selected + 3 actions (Add to Compare, Export CSV,
  Delete with confirm modal). Reuses existing exportCSV + useCompare.

### Phase 2 — Scenario Studio (`42fd476` → `357d7f9`)
**Eight commits, ~3-4× the original v1 scope.** This was the killer
feature the audit identified as the #1 missing workflow — reframes
Tractova from "research tool" to "deal-structuring platform" without
the risk of a too-detailed pro-forma.

- `src/lib/scenarioEngine.js` — pure compute layer over the existing
  revenueEngine. `computeBaseline({stateId, technology, mw, rates})`
  returns the achievable starting point + all the lifecycle inputs
  needed for downstream metrics. `applyScenario(baseline, sliders)`
  recomputes synchronously when any of the 9 sliders moves.
- **9 sliders** (tech-aware): system size MW · capex $/W · IX cost $/W
  · capacity factor · REC price $/MWh · program allocation · opex
  $/kW/yr · discount rate · contract tenor.
- **8 output metrics** in a 2×4 grid: Year 1 revenue · simple payback
  · project IRR · equity IRR (70/30 leverage @ 6.5% / 18-yr amort) ·
  NPV @ user-set discount · DSCR (Y1 NOI / debt service, with
  "tight"/"healthy" suffix) · LCOE · lifetime revenue.
- **Newton-Raphson IRR solver** on the cashflow stream (year 0 = -dev
  cost, years 1-N = revenue × degradation - opex × inflation + ITC
  annualized over 6 years; equity stream subtracts annual debt service).
- **Best/Worst preset chips** above the sliders — modest ±15-30%
  multipliers on the helpful inputs so users get a defensible upside
  vs. downside read in one tap.
- **Directional slider colors**: slate at baseline, teal when moved in
  the financially helpful direction, amber when worse. Color applied
  to both the value chip AND the slider track gradient (per Aden's
  field-test feedback).
- **Modified-inputs pill row** in the navy output card: each modified
  slider becomes a colored pill ([Capex $1.30/W -8%]) — click to reset
  just that one input. Replaces the unreadable dot-separated summary.
- **Save flow**: name input → insert into `scenario_snapshots` → green
  "Saved [name]" badge lingers 2.5s + toast.
- **Vertical history list** (new `<ScenarioHistoryList>` component
  reused in Studio + Library Scenarios tab) showing each saved
  scenario with timestamp + 4 metrics + delta-vs-baseline + a "↳
  inputs" sub-line so two saves with the same preset name are
  immediately distinguishable. Confirm modal on delete (no auto-delete).
- **Project-link wiring**: Search.jsx looks up matching saved project
  by state+county+technology and threads the project_id into save.
- **Orphan auto-promote**: when user saves a project from Lens, any
  pre-existing scenarios with matching context (within last 7 days)
  auto-attach to the new project. Toast confirms "N scenarios attached".
- **Library "Scenarios" tab** alongside "Projects" — groups all of the
  user's scenarios by Lens context (state + county + tech). Exploration
  groups (project_id null) get an amber "Exploration · not yet in
  Library" badge + "Open in Lens to save →" CTA that auto-runs Search
  with the context pre-filled.
- **Library card chip** promoted to the card header as a teal
  "Scenarios · N" badge (was buried below the action footer). Click
  expands the card + opens the picker.
- **PDF export** — `ProjectPDFExport` accepts an optional `scenario`
  param and renders a 2×4 metric grid + summary + disclaimer in the
  Deal Memo. Saved scenarios also ride the existing `/memo/:token`
  share flow when selected via "Include in PDF" toggle.
- **9 new glossary entries** for the financial terms (IRR, LCOE, NPV,
  Lifetime Rev, Equity IRR, DSCR, Opex, Discount Rate, Contract Tenor)
  — each documents the exact assumption being modeled.
- **Migration 041** — `scenario_snapshots` table with user_id +
  nullable project_id + jsonb (baseline_inputs, scenario_inputs,
  outputs). RLS owner-only. Append-only (no update/delete policy
  beyond cascading project deletes).

### Phase 4 — coverage expansion (`251bc38`)
- **C&I offtake: 12 → 32 states.** Calibrated against EIA Form 861
  commercial retail rates (2024) + qualitative market-depth adjustments.
  Added: ISO-NE (RI/NH/VT) · PJM (DC/DE/PA/OH) · MISO (MI/WI/IN/MO)
  · CAISO + SW (CA 88 / AZ / NV) · ERCOT + South (TX 62 — low retail
  offset by huge market / FL / NC / GA / SC) · SPP (NM).
- **BESS offtake: 8 → 25 states.** Calibrated against ISO/RTO
  capacity-market clearing prices + state storage carve-outs.
  Added: CAISO (CA 88) · ERCOT (TX 85) · PJM (VA/PA/OH/DE/DC) · SW
  (AZ/NV/NM) · MISO (MI/WI) · PNW (WA/OR) · SE (FL/NC/GA).
- All existing 18 states' scores preserved — no regression. Inline
  per-ISO calibration comments make future tweaks auditable.

### Bonus — churn defense flow (`fd621a0`)
- **Pre-cancel exit-intent survey.** "Manage subscription →" stays
  zero-friction (for payment method updates), but a separate
  "Considering canceling?" link below opens a modal with reason radios
  (pricing / missing_feature / wrong_fit / just_exploring /
  data_coverage / other) + free-text capture before handoff to Stripe
  portal.
- Email + tier snapshotted at submit time so the row stays meaningful
  even after the user is downgraded.
- **Migration 042** — `cancellation_feedback` table with own-rows-only
  RLS. Append-only — no update/delete policy.
- Client-side direct insert via RLS rather than a new API endpoint
  (we're at the Vercel Hobby 12-function cap).

### Polish bundle (`357d7f9`) — field-test feedback
- Best/Worst buttons: cursor-pointer + hover-brighten + dropped native
  title= tooltips (read as passive labels before).
- Delete on scenarios: confirm Dialog at both entry points (Studio
  history trash + Library card picker ✕).
- "Orphan" → "Exploration" in user-facing copy (state name stays
  `orphanScenarios` in code).
- Lens auto-search loosened: required state+county+mw+stage+technology
  → now just state+county+mw. Stage + tech are optional. Eliminates the
  "I clicked re-analyze but it didn't run" footgun.
- WoW state-delta chip: native title= → Radix Tooltip with proper
  styling (matches IX · Live tooltip treatment).
- StagePicker + Scenarios badge: native title= → aria-label (no
  visible tooltip — the labels carry their own meaning).
- Save button: lingers as green "Saved [name]" checkmark for 2.5s
  after success.
- Modified-inputs row: dot-separated string → pill chips (described
  above in Phase 2).
- Saved-scenarios history rows: added inputs-summary sub-line so two
  saves with the same name don't look identical.
- Navy output card: padding p-4 → p-3.5, gap-3 → gap-2.5 to reduce the
  dark expanse Aden flagged.
- Verified $/W consistency for capital metrics — capex + IX both
  render `$X.XX/W` everywhere (other units like $/MWh for REC + $/kW/yr
  for opex are conventional and kept).

---

## ✅ Shipped 2026-05-01 — Path B: county_geospatial_data (`7c49c5c`)

**Single large commit closing out a multi-session estimate in one session.**
Pre-work probes (in `scripts/probe-fips-conventions.mjs` and
`scripts/probe-geospatial.mjs`) validated the approach before touching
production code: confirmed all 4 county-keyed tables share `county_fips`
text PK with leading zeros, validated the USFWS NWI ArcGIS outStatistics
query against `Wetlands.ACRES` table-qualified, validated the USDA SSURGO
T-SQL aggregate of `farmlndcl IN (...)` returning whole-state prime-farmland
percentages in <100ms.

**`7c49c5c` — Path B build.** Replaces the silent `site=60` fallback for the
32 states that lack a `county_intelligence` default row with derived
signals from authoritative federal sources, covering all 3,142 counties.

- **Migration 039** — `county_geospatial_data` table keyed on `county_fips`,
  fields `wetland_coverage_pct`, `wetland_category`, `prime_farmland_pct`,
  separate `*_last_updated` timestamps because the two sources refresh at
  different cadences. Wetland category is bucketed (minimal/moderate/
  significant/severe) since raw NWI % can exceed 100% from polygon overlap
  + water inclusion (calibrated thresholds in the migration comment).
- **SSURGO refresh** — wired into the multiplexed `refresh-data.js` as
  `?source=geospatial_farmland`. Single T-SQL aggregate query covers the
  whole US in ~5s. New 7:45 Sunday cron entry. AK skipped (137 NRCS
  regions vs 30 boroughs); CT/RI handled as statewide single-area
  assignments to all counties via `county_acs_data`.
- **NWI seed** — `scripts/seed-county-geospatial-nwi.mjs`. Runs locally
  with 4x parallelism (~1.5h for 3,142 counties — too long for the 300s
  Vercel ceiling). Idempotent + resumable via `--refresh` flag (skips
  counties updated within 90 days).
- **scoreEngine** — three-layer site sub-score: live geospatial → curated
  `county_intelligence` → `site=60` baseline. Backward-compatible — when
  geospatial row is absent, the curated path runs with no behavior change.
  `coverage.site = 'live'|'researched'|'fallback'` exposed.
- **programData.getCountyData** — augmented to fetch `county_geospatial_data`
  via `county_fips` (resolved through `county_acs_data`, same FIPS bridge
  as `getNmtcLic`/`getHudQctDda`) and merge as `countyData.geospatial`.
  No frontend changes required — the data block just gets richer.
- **lens-insight context** — when geospatial is present, the AI prompt
  receives live numeric inputs (prime farmland %, wetland coverage %,
  NWI feature count) and an explicit `COVERAGE: live geospatial` line so
  the dossier reasons honestly about authoritative sources.
- **UI** — small teal **"Site · Live"** pill in the Lens result eyebrow,
  mirroring the IX · Live treatment. Radix tooltip explains inputs +
  thresholds. Absent (honest signal) for counties without a geospatial row.

`npm run verify` green (build + 7 smoke tests, ~12s).

---

## ✅ Shipped 2026-04-30 — IX score live-blend + Lens loader polish

Three commits closing out the long evening session. Together they shift
the IX sub-score from purely curated to a calibrated blend of curated +
live ISO/RTO queue signals, surface that honestly in the UI, and fix
the Lens loader stall.

**`e9506a7` — IX score live-blend.** `computeSubScores` now optionally
accepts an `ixQueueSummary` arg. When present + non-empty, applies a
clamped (±10) adjustment based on `avg_study_months` and total
`mw_pending`. Thresholds calibrated from the actual `ix_queue_data`
distribution (probe: `scripts/probe-ix-queue.mjs`):
- avg_study_months: <14mo +5 / 14-19 0 / 20-23 -3 / 24+ -8
- total mw_pending: <500 +3 / 500-999 0 / 1000-1499 -3 / 1500+ -6

New `coverage.ix = 'live' | 'curated'` flag. Library + Profile call
sites pass 4 args (no ixQueueSummary), so they stay on curated path.
Search.jsx passes the already-fetched `results.ixQueueSummary` →
Lens-only live blend, no regression elsewhere. Coverage today: 8 of
50 states (CO/IL/MA/MD/ME/MN/NJ/NY) — concentrated on the highest-
volume CS markets.

**`7d474e1` — IX · Live tooltip polish.** Replaced the native browser
`title` attribute with a Radix portal tooltip styled to match the
methodology popover at `Search.jsx:479` — dark navy bg, teal border,
structured headings + INPUTS / CLAMP / coverage-policy footnote.
Reads as research-note documentation, matching the Lens chrome
convention.

**`e4c6666` — Lens loader asymptote.** Halo arc was `p = (elapsed/14s)*88`
linear-then-stop, which produced a visible stall at 88% on every run.
Replaced with `p = 95 * (1 - exp(-elapsed/8s))` and removed the RAF
exit guard. Result: motion never freezes (sub-pixel asymptotic creep
even on 60s outliers), and the snap-to-100% on completion always has
5+ points of headroom for a clean landing.

---

## ✅ Shipped 2026-04-30 — Library WoW + freshness signal

Two retention-driving surfaces added on the Library page in parallel
to the Dashboard hero indicator (`e2c8b48`):

**Freshness signal** — small mono "Data refreshed [date]" caption with
teal breathing dot under the hero meta line. Amber when underlying
program data is >14d old. Tooltip explains scores are recomputed from
this snapshot on every load. Same retention rationale as the Dashboard
version: Library is the daily-driver surface, so the live-data promise
needs to stay visible on the user's main return loop.

**WoW score-delta chip** — when a saved project's state has moved
week-over-week in `state_programs_snapshots`, a "State ±N pt" pill
renders in the project-card chip row. Teal up / amber down. Honestly
labeled "State" because the source is state-level program snapshots,
not per-project history; tooltip explains the project's blended score
may differ. Falls back to silent when delta is null/zero — no visual
noise pre-data. Lights up automatically once history accrues (~2 weeks
post-migration-038).

**One file changed:** `src/pages/Library.jsx` (~50 LOC). No new RPC,
no new migration, no new dependency — piggybacks on the existing
`getStateProgramDeltas()` already shipped for Markets on the Move
(`5c30369`). Verified via `npm run verify:full` (14 tests green).

---

## ✅ Shipped 2026-04-30 — Pro-flow smoke tests (`5b6a7a0`)

Five files changed:

- `tests/auth.setup.js` (new) — drives `/signin` with creds from `.env.local`,
  saves storage state to `tests/.auth/pro-user.json`
- `tests/pro-smoke.spec.js` (new) — 6 tests covering home (Dashboard
  resolution), Search past paywall, Library past paywall, Library
  empty-state preview, Profile + Pro-badge, /preview when authed
- `playwright.config.js` — added `setup` + `pro-chromium` projects with
  glob testMatch
- `package.json` scripts — `test:smoke` now unauth-only; new
  `test:smoke:pro`, `test:smoke:all`, `verify:full`. `npm run verify`
  unchanged (build + unauth smoke).
- `.gitignore` += `tests/.auth/`. `.env.example` += test-account setup
  instructions.

**Before committing — one-time setup the user must do:**

1. **Create the test account** in the live app (sign up via UI, e.g.
   `smoke-test@tractova.com` with any password).
2. **Flip it to Pro** via Supabase SQL editor:
   ```sql
   update profiles
      set subscription_tier='pro',
          subscription_status='active'
    where id = (select id from auth.users where email='smoke-test@tractova.com');
   ```
3. **Drop creds in `.env.local`:**
   ```
   TEST_USER_EMAIL=smoke-test@tractova.com
   TEST_USER_PASSWORD=<the password>
   ```
4. **Run `npm run test:smoke:pro`** — should pass 6 tests in ~10-15s.
5. **Then `npm run verify:full`** to confirm the full suite is green
   before committing.

**`npm run verify` keeps working with no creds set.** It runs build +
unauth smoke (the existing 7 tests). Use `verify:full` once Pro creds
are in place.

**No live API calls in any test.** Lens form submissions are deliberately
not exercised — the smoke is render-and-watch-for-console-errors. Cost
per run: $0.

**Deferred items, in priority order (unchanged from prior session):**
- **Library WoW score deltas + freshness signal** (parallel to
  Dashboard hero) — ~2 hours, retention-driving.
- **Expand curated economic coverage to top-10 solar markets**
  (CA, TX, FL, NC, AZ, GA, NV, NM) — biggest single-move leverage.
  EIA Form 861 + ISO capacity markets publicly sourced. ~4-8h/state.
- **Apply pending migrations 034-037** (HUD QCT/DDA + NMTC LIC) in
  Supabase SQL editor.
- **Wetlands + farmland data layers** — 3-4 day R&D + spatial join.

**Coverage gap (unchanged):** only 18 of 50 states have a `default`
county_intelligence row. Missing: AK, AL, AR, AZ, DE, GA, IA, ID, IN,
KS, KY, LA, MO, MS, MT, NC, ND, NE, NH, NV, OH, OK, PA, SC, SD, TN,
TX, UT, VT, WI, WV, WY.

**Run `npm run verify` before pushing any visible-feature change.**

---

## ✅ Shipped 2026-04-30 — Score honesty pass (`596de4b` + `d4061d2`)

**Two layered fixes** addressing the same trust-erosion class:
silent baseline fallbacks in the Lens scoring engine that produced
research-grade-looking numbers from placeholder values.

### `596de4b` — offtake coverage
**The bug.** Customer could pick BESS/C&I/Hybrid for any of 50
states in `/search`. `CI_OFFTAKE_SCORES` (12 states) and
`BESS_OFFTAKE_SCORES` (10 states) silently fell back to 55/45 for
uncovered states. The revenue panel honestly said "model not
available" but the feasibility number looked researched.

**The fix.** `computeSubScores` returns `coverage: { offtake }`.
`MarketPositionPanel` renders a "Limited offtake coverage" caption
listing curated states. `api/lens-insight.js` adds a `COVERAGE
NOTE` instructing the AI to speak directionally for uncovered
geographies (no fabricated $/kW or PPA cents/kWh).

### `d4061d2` — site coverage (parallel)
**The bug.** Only 18 of 50 states have a `default`
county_intelligence row seeded. For the other 32 states, the Site
Control sub-score silently defaults to 60. Same trust issue.

**The fix.** `coverage.site` = `'researched' | 'fallback'`. The
caption block consolidated into one "Limited coverage — directional
only" panel with per-pillar bullets (offtake, site) so common-case
where both fire stays visually clean.

**What this didn't change.** All 50 states still receive full Lens
analysis on the data side. State programs all 50, IX difficulty all
50, IRA/HUD/NMTC overlays all 50. Only the **economic** and
**county-level site** layers honestly signal coverage now.

---

## ✅ Shipped 2026-04-30 — Tailwind v4 + Vite 8 + shadcn integration

Cleaner than the BUILD_LOG plan estimated (~1.5h vs 3-5h budgeted)
because the codebase had **zero `@apply` usage**, no Tailwind plugins,
and a simple custom palette — the official codemod handled almost
everything mechanically.

**Three commits, merged to main as `475a095`:**

- `3e7df8e` — Tailwind v3.4.6 → v4.2.4, Vite 5.3.4 → 8.0.10. Codemod
  migrated 35 files. JS config (`tailwind.config.js`) replaced by
  CSS-first `@theme` block in `src/index.css`. Class-name renames:
  `flex-shrink-0` → `shrink-0`, `focus:outline-none` →
  `focus:outline-hidden`, `rounded` → `rounded-sm`, `rounded-sm` →
  `rounded-xs`. Border-color compat shim added (v4 default changed
  from gray-200 to currentcolor). autoprefixer dropped (v4 has its
  own). Build time 22s → 4s thanks to Rolldown.

- `55f3fc7` — shadcn/ui integrated, scoped to its own directory at
  `src/components/shadcn/ui/` so primitives never collide with our
  existing custom UI in `src/components/ui/`. Pruned shadcn's
  universal CSS overrides (Geist font import, `* { @apply
  border-border }`, body/html @applies, `--font-sans` /
  `--color-primary` / `--color-accent` overrides in @theme inline).
  shadcn primitives now inherit our brand (teal primary, amber
  accent, Inter font) automatically. Smoke-test components: `card`,
  `badge`. Added `jsconfig.json` + `vite.config.js` `@/*` alias.

- `475a095` — merge commit.

**Audit impact:** vite + esbuild moderate vulns cleared (confirmed
locally). Remaining 6 high are all pre-documented accepted-risks
(`xlsx` + `react-simple-maps` / d3-color chain).

---

## ✅ Resolved 2026-04-30 — refresh pipeline + Census 503 saga

The data refresh that started yesterday with the NMTC wildcard bug is
now fully shipped. Diagnostic endpoint (`/api/refresh-data?debug=1`,
auth-bypass, fully redacted) confirmed Census API + key + Vercel
egress are all healthy: HTTP 200 in ~470ms with valid ACS data. User
clicked Refresh → **5/5 endpoints OK in 20.7s**, all 8 sub-sources ✓.

The remaining work was the durability layer — **stale-tolerance** for
the three Census handlers (`d8be8ef`). When Census 503s and our last
successful pull is <90 days old, the panel goes amber with a
`stale-ok · last good Nd ago` badge instead of red. ACS publishes
annually so this is the right semantics. Server keeps `ok: false` on
the actual failure so `cron_runs` records honestly and the next
stale-check finds the real last-good run.

---

## Status snapshot

- **Branch:** `main` · 4-session site-walk fix sweep complete (commits `a1c00dd`, `1268cbc`, `288b1be`, `19b2638`, `445bce9`, `a456cca`) closing ~35 of ~40 review items. Highlights: favicon + sub-header recolor, ambient-animation gutter-mask, Active/Pending/No Program + Site Control tooltips, scrollable Data Limitations modal, Dashboard freshness via cron_runs (matches Footer), Admin LIVE/CURATED/SEEDED freshness chips, state-baseline-vs-project score line in Lens, NWI/SSURGO percentages surfaced in Site Control tiles, scenario presets recalibrated + methodology tooltips, jump-to-glossary in CommandPalette, scenario-save Library confirmation card, source-link audit (4 broken URLs replaced), Compare AI collapsible + insightType + sub-score rows, Library Select-all, 18+ signup checkbox, Terms § 04 strengthened with civil-action language. Pending Aden's input: analyst-brief verbosity redesign, CSV/XLSX consolidation, hello@ DNS setup.
- **NWI catch-up seed completed.** 1522 of 2144 queue items succeeded; 622 NWI server timeouts (concentrated in ND/SD where the server throttled). Live coverage went from **79.9% → 92.1%** (gained 382 new counties). 249 counties still missing — a second `--refresh` run would catch most of the timeouts.
- **Live data layers (all .gov / authoritative-source verified):**
  - `lmi_data` (state-level Census ACS)
  - `county_acs_data` (3,142 counties Census ACS)
  - `state_programs` + DSIRE verification
  - `revenue_stacks` + DSIRE verification
  - `news_feed` (RSS + Claude Haiku 4.5 classifier)
  - `energy_community_data` (DOE NETL EDX — IRA §45/§48 +10% ITC)
  - `hud_qct_dda_data` (HUD User — LIHTC LMI overlay)
  - `nmtc_lic_data` (Census ACS + CDFI methodology — IRA §48(e) Cat 1 +10% ITC)
  - `ix_queue_data` (ISO/RTO weekly scrapers)
  - `substations` (EIA Form 860 monthly)
  - `revenue_rates` (NREL PVWatts + EIA quarterly)
- **Multiplexed cron:** Two staggered Sunday runs to fit Hobby gateway window — `?source=fast` at 07:00 (7 quick sources) + `?source=nmtc_lic` at 07:30 (NMTC alone, ~50-70s due to 51-state iteration). Plus 3 separate cron functions for substations / IX queue / capacity factors (Hobby 12-function cap).
- **Admin manual refresh:** `/admin > Data Health > Refresh data from sources` parallel-fans-out to all **5 endpoints** (fast bundle + NMTC + substations + ix_queue + capacity) with admin JWT auth. Each endpoint has its own gateway window so a slow source can't drag the rest.

---

## Pending Supabase migrations

User runs these manually in Supabase SQL editor. Mark applied here when done.

✅ All migrations through 038 applied as of 2026-04-30 (verified via
`scripts/check-migrations.mjs` against the live DB — hud_qct_dda_data
has 1,801 rows, nmtc_lic_data has 3,144 rows, freshness RPC includes
both blocks).

| # | File | What it does | Status |
|---|------|--------------|--------|
| 028 | `news_feed_auto.sql` | RSS+AI ingest columns | ✅ |
| 029 | `revenue_stacks_dsire.sql` | DSIRE verification columns | ✅ |
| 030 | `data_freshness_rpc.sql` | RPC v1 | ✅ |
| 031 | `data_freshness_cron_driven.sql` | RPC reads cron_runs | ✅ |
| 032 | `energy_community_data.sql` | Energy Community table | ✅ |
| 033 | `freshness_energy_community.sql` | RPC +energy_community | ✅ |
| 034 | `hud_qct_dda_data.sql` | HUD QCT/DDA table | ✅ |
| 035 | `freshness_hud_qct_dda.sql` | RPC +hud_qct_dda | ✅ |
| 036 | `nmtc_lic_data.sql` | NMTC LIC table | ✅ |
| 037 | `freshness_nmtc_lic.sql` | RPC +nmtc_lic | ✅ |
| 038 | `state_programs_snapshots.sql` | Wave 1.4: append-only feasibility-score history table for WoW deltas + Markets on the Move trends | ✅ |
| 039 | `county_geospatial_data.sql` | Path B: per-county wetland coverage % (NWI) + prime farmland % (SSURGO) for all 3,142 counties — closes Site Control gap | ✅ |
| 040 | `dashboard_metrics_last_refresh.sql` | get_dashboard_metrics() returns lastRefreshAt from cron_runs so the Footer's "Data refreshed" caption reflects actual cron freshness rather than state_programs.last_verified | ✅ |
| 041 | `scenario_snapshots.sql` | Phase 2 Scenario Studio: user-saved scenarios with nullable project_id (orphan promotion to project on save), state_id + county_name + technology context, jsonb baseline_inputs / scenario_inputs / outputs. RLS owner-only. | ✅ |
| 042 | `cancellation_feedback.sql` | Pre-cancel exit-intent survey capture: reason category + free-text + email/tier snapshot + destination ("staying" / "stripe_portal"). RLS append-only own-rows. | ✅ |
| 043 | `revenue_rates_v18_recalibration.sql` | Lazard v18 re-anchored seed; superseded by 044 for the CS $/W column. | ✅ |
| 044 | `revenue_rates_cs_lbnl_anchor.sql` | CS $/W re-anchored on NREL Q1 2023 CS MMP + LBNL TTS 2024 + Tractova 2026 forward (Tier A/B per-state). | ✅ |
| 045 | `revenue_rates_ci_lbnl_anchor.sql` | C&I $/W re-anchored same methodology -$0.05 C&I premium offset. | ✅ |
| 046 | `revenue_rates_bess_capacity_iso_anchor.sql` | BESS capacityPerKwYear re-anchored on 2024-25 ISO clearing × 4-hr accreditation. | ✅ |
| 047 | `revenue_rates_bess_demand_arb_anchor.sql` | BESS demand+arb documented + CA/HI refinements. | ✅ |
| 048 | `solar_cost_index.sql` | Phase B: per-state LBNL TTS observed PV installed-cost percentiles. Data-lineage layer; engine still reads Tractova-synthesized $/W from revenue_rates. | ✅ |
| 049 | `freshness_solar_cost_index.sql` | RPC + solar_cost_index block (row_count, states_covered, latest_vintage, last_updated, last_cron_success). | ✅ |
| 050 | `cs_projects.sql` | Phase C-pivoted: NREL Sharing the Sun ground-truth ingestion. ~3,800 individual operating CS projects with utility/developer/size/vintage/LMI attribution. | ⏳ |
| 051 | `freshness_cs_projects.sql` | RPC + cs_projects block (row_count, states_covered, latest_vintage, source_release, last_updated). | ⏳ |
| 052 | `solar_cost_index_confidence_tier.sql` | Phase E: confidence_tier (strong/modest/thin) + aggregation_window_years + CHECK n≥3. Tier-B prefix backfill on revenue_rates.notes for 9 states. | ⏳ |
| 053 | `cs_specific_yield.sql` | Phase G: per-project observed Specific Yield from Nexamp + SR Energy + Catalyze public fleet. capacity_basis (AC/DC), SY ∈ [600, 2400] CHECK. | ⏳ |
| 054 | `freshness_cs_specific_yield.sql` | RPC + cs_specific_yield block. | ⏳ |

> **Verification protocol going forward:** before asking the user to
> re-run any migration, run `node scripts/check-migrations.mjs` (or
> a similar live-DB probe). The build-log state can drift from the
> live state when migrations are applied out-of-band.

---

## Recent builds (most recent first)

| Commit | Subject |
|--------|---------|
| `a456cca` | Site-walk Session 4 (legal): I1 18+ checkbox at signup (required `agreed` flag, blocked submit until checked, links open in new tabs) + I2 Terms § 04 reverse-engineering / proprietary-misappropriation clause strengthened with explicit civil-action language citing the Defend Trade Secrets Act (18 U.S.C. § 1836), state trade-secret law, and reservation of all remedies at law and in equity |
| `445bce9` | Site-walk Session 4 (Library/Compare): F1 Compare AI summary collapsible (default closed) + COMPARE_PROMPT revamped to forbid score restatement (forces Recommendation / Differentiator / Non-obvious-insight) + insightType badge in UI · F2 5 new Compare rows (Offtake / IX / Site Control sub-scores + Wetland % + Prime farmland %) via lensResultToCompareItem + computeSubScores + Path B geospatial · F3 Library "Select all" inline link above grid + toolbar Select all/Deselect all toggle |
| `19b2638` | Site-walk Session 3 final: H2 ScenarioStudio post-save inline "Saved to your Library · view →" card (6s hold, click → /library?tab=scenarios) + Library URL ?tab=scenarios handler · H4 source-attribution link audit (PJM 404 → planningcenter.pjm.com; CAISO .aspx 404 → caiso.com root; energycommunities.gov ECONNREFUSED → IRS Low-Income Communities Bonus Credit page; IRS ITC 404 → IRS Form 3468) |
| `288b1be` | Site-walk Session 3 partial: E2 scenario presets recalibrated (best allocation cap 1.25→1.10 per Aden, worst IX cost 1.50→2.50 for network-upgrade-shock honesty) + SCENARIO_PRESET_METHODOLOGY constant anchoring multipliers to NREL ATB / Lazard P10/P90 + Radix Tooltip on each preset chip + Best/Worst case glossary entry · E5 ScenarioStudio clarifying intro ("sliders move financial outputs, not the gauge") · H1 jump-to-glossary in CommandPalette (GLOSSARY_TERMS + toSlug exports + location.hash listener for in-page nav) |
| `1268cbc` | Site-walk Session 2: dot/T-mark mask tightened 18-30%/70-82% → 8-12%/88-92% (closes Pillar Diagnostics overlap on 1920px viewport) + WalkingTractovaMark top/bottom narrowed to corner gutters · C1 Dashboard hero "data refreshed" caption switched from state_programs.last_verified → cron_runs.finished_at (same source as Footer) · C2 Admin Data Health LIVE/CURATED/SEEDED chips on each freshness card + mode legend + Last Run per Cron clarifying caption · E1 Market Position state-baseline-vs-project line under gauge + lens-insight SYSTEM_PROMPT rule 16 forbidding score conflation · E3 Capacity Factor tooltip + NREL PVWatts provenance suffix · E4 revenue stack methodology drilldown title rewritten · E6 Site Control Land + Wetland tile notes now display NWI + SSURGO percentages |
| `a1c00dd` | Site-walk Session 1: favicon green→teal · StateDetailPanel SubStat sub-headers grey→teal · revenue stack ITC adder blue→amber #D97706 · email "+15 idx"→"+15 pts"; digest IDX→SCORE · score-drop alert structured delta with big "↓ N pts · X→Y" gutter cell · Profile "Considering canceling?" passive CTA removed · IntelligenceBackground teal "fog" band removed; dots + T-mark wrapped in gutter mask · WalkingTractovaMark top/bottom variants narrowed to corner gutters · USMap legend tooltips on all 7 tiers · Site Control status badge tooltips citing SSURGO/NWI/hosting sources · Data Limitations modal scrollable + cursor-pointer + ⓘ icon |
| _no commit_ | **PJM IX scraper officially abandoned for legal reasons.** Aden attempted Data Miner 2 API key registration; PJM's developer-portal landing page reads: *"Information and data contained in Data Miner 2 is for internal use only and redistribution of information and or data contained in or derived from Data Miner 2 is strictly prohibited without an effective PJM-issued Redistribution License."* That clause is incompatible with our SaaS model — Tractova surfaces derived metrics (queue counts, MW pending, study months) on customer-facing Lens results. Free Data Miner 2 access is internal-corporate-research-only; SaaS redistribution requires a separately-negotiated PJM Redistribution License (multi-week process, $5K-$50K/yr typical). **Decision (Aden 2026-05-02):** abandon PJM live coverage. Lens IX·Live pill stays amber for PJM states (`87cea98` already shipped honest disclosure). Future revisit only if (a) we pursue the redistribution license at scale, or (b) we find an alternative public-domain PJM queue path (FERC eLibrary Form 715/1 filings, PJM Manual 14H Attachment B). Other-ISO TOS audit (MISO/NYISO/ISO-NE) was inconclusive via WebFetch — bundled into the attorney-review checklist for formal launch. NYISO + MISO scrapers stay shipping (industry norm is permissive); ISO-NE repair stays deferred. |
| _no commit_ | **NWI seed pass 2 complete — 100% coverage achieved.** 2,136 of 2,144 retried succeeded; 8 failures (KY/network blips). Live `county_geospatial_data` populated count: 3,144 of 3,143 counties (slight over-count from DC double-counting). Path B's Site Control sub-score now has live geospatial truth (NWI wetlands + SSURGO farmland) for every U.S. county. |
| `c690b01` | Glossary scroll bug + ambient animation extension. (1) **Global ScrollToTop** — new `src/components/ScrollToTop.jsx` listens to `useLocation()` pathname changes, calls `window.scrollTo({top: 0, behavior: 'instant'})` when no hash. Mounted inside `<BrowserRouter>` above `<Routes>` in App.jsx. Fixes the Glossary land-at-bottom bug Aden reported and any other "navigate from long page → land at random offset" instance across the app. Glossary's existing hash-based deep-link logic preserved. (2) **IntelligenceBackground + WalkingTractovaMark on Glossary, Library, Lens** — extends the Profile ambient treatment. Glossary + Library get both (sessionGate=true, 30%/25% triggerProbability). Lens result page gets IntelligenceBackground only — no cameo on the content-dense Lens to avoid pulling focus mid-analysis. Glossary hero gains a pulsing teal dot matching the Library "Data refreshed" pattern |
| `80412cf` | Audit-driven trust transparency (3 items). After the data-trust audit (plan: `what-are-some-caveats-cached-kite.md`) Aden picked the recommended directions on disclosure / BESS-rate freshness / curation-drift visibility. (1) **Data Limitations modal** on every Lens result — new `<DataLimitationsModal>` component (Radix Dialog), 5 audit-identified caveats with severity tags (capacity_mw drift HIGH, BESS rates HIGH, IRR/DSCR defaults MEDIUM, IX scraper staleness MEDIUM, comparable-deals sample MEDIUM). Trigger inline in the Lens disclaimer block. Links to /privacy + /terms § 06 for the full audit. (2) **BESS revenue panel "as of" stamp** — `BESS_RATES_AS_OF` constant in revenueEngine.js (`'2026-04'`) exposed on `computeBESSProjection` return shape, rendered as an amber-tinted mono pill in the BESS revenue panel footer. Plus a new ToS Section 06 bullet explicitly disclosing that BESS revenue rates are seeded constants and may swing 2-9× year over year. (3) **Mission Control curation drift row** — `handleFreshness` returns a `state_programs_drift` array (warn ≥30d, urgent ≥60d, stable thresholds). New `<CurationDriftRow>` component renders below the 3-card KPI grid, hides when nothing's drifting. ⚠ flag for states with null capacity_mw or enrollment_rate (silently breaks Runway) |
| `5c04eed` | Polish-pass after multi-agent audit. Five fixes: (1) **scoreEngine over-claim**: the EIA-861 utility seed inserted 32 state-default rows with `available_land=true, wetland_warning=false` which scoreEngine read as a favorable 82 site score until NWI caught up — over-claiming honesty for 32 states. UPDATE'd all 32 to NULL/NULL so computeSiteSubScore returns the neutral 60 baseline; seed script also updated for future re-runs. (2) **Scenario auto-expand race**: the 4s `setTimeout(clear, 4000)` could fire before async `loadSavedScenarios()` returned on slow networks, leaving the new row un-expanded. Now awaits the refresh BEFORE setting `justSavedId`; tightened hold to 1.5s. (3) **Library empty-state skeleton**: replaced the silent `liveMarkets.length > 0 &&` gate with 4 placeholder cards while `stateProgramMap` hydrates — eliminates the late-paint shift. (4) **Terminology consistency**: standardized "intelligence report" across UpgradePrompt, WelcomeCard, Search.jsx form header (was a mix of "feasibility report" / "intelligence report"). (5) **Stale comment**: generalized the IX·Live tooltip rationale comment that hardcoded the 2026-04-24 → 2026-05-02 window. Plus: live-DB probe confirmed NWI coverage just crossed **95.9%** (was 92.1% pre-pass) as the seed crossed the ND/SD gap-state cluster |
| `6fc4bbe` | Library empty-state deepening + Mission Control responsive polish — Library /library new-user landing now leads with a "Live markets right now" strip pulling the 4 most-recently-verified active CS states from the existing stateProgramMap (no new fetch); each is a clickable mini-card showing state code · name · capacity remaining · "Run Lens →" → /search?state=XX. The "Live data refreshed [date]" stamp from the populated-Library hero is also surfaced pre-projects so the live-data promise is provable on first impression. Existing 3-value-prop card + CTAs preserved below. Mission Control header + KPI card titles flex-wrap on narrow viewports |
| `89a43a7` | Admin Mission Control — single-screen executive snapshot at the top of the Data Health tab. Three KPI cards (NWI coverage circular gauge tier-colored against the 95% goal · IX scraper freshness pills per ISO with stale flag · Substations cron latency bar with the 60s ceiling + 70% WATCH threshold marker) plus a usage-signals row (Scenario Studio saves + churn-defense surveys). Backed by an extension to `handleFreshness` that adds a `missionControl` block to the response (NWI counts, ix_freshness array, scenario + cancellation counts). Backwards compatible — the existing fields stay unchanged |
| `c07f76c` | data-health: bearer-token-gated `health-summary` action returning machine-readable system-health JSON (NWI %, per-ISO IX freshness, cron p95 + last-success per cron_name, scenario_snapshots count, cancellation_feedback count). Auth via `HEALTH_CHECK_TOKEN` env var. Powers the weekly Anthropic-cloud routine `trig_01Xafjra7dtEecSQEBLNAoQL` ("Tractova weekly system-health", every Monday 09:00 ET). Token + routine ID stored in `.env.local` (gitignored) |
| `94fe80c` | NYISO scraper repair — replaces the dead `https://www.nyiso.com/api/interconnections` JSON endpoint (404 since 2026-04-24) with a 2-step xlsx flow: scrape `/interconnections` landing page for the latest dated `NYISO-Interconnection-Queue-MM-DD-YYYY.xlsx` URL, download, parse the "Interconnection Queue" sheet with the existing `xlsx` package, filter Type/Fuel="S" + SP(MW) > 0 + < 25, aggregate by Utility code. Live test: 29 solar <25MW projects across NM-NG (19), NYSEG (6), CHG&E (2), O&R (1), RG&E (1). UTILITY_STATE_MAP expanded to map NYISO's utility-code abbreviations (NM-NG, CHG&E, NYPA, LIPA, O&R) to NY. PJM and ISO-NE remain blocked: PJM requires Data Miner 2 API-key registration, ISO-NE landing pages 404 — both deferred to a follow-up session |
| `ad86917` | Privacy Policy + Terms of Service v1.0 — hand-rolled, comprehensive, sign-ready. /privacy + /terms public routes lazy-loaded; Footer links added. Privacy covers all sub-processors (Supabase/Vercel/Stripe/Anthropic/Resend/Cloudflare), explicit AI processing disclosure (Claude Sonnet 4.6 + Haiku 4.5 with Anthropic ZDR), every data source we synthesize (EIA Form 860/861, NREL PVWatts, Census ACS, USFWS NWI, USDA SSURGO, HUD QCT/DDA, CDFI NMTC, DOE NETL EDX Energy Community, DSIRE, ISO/RTO scrapers, RSS), CCPA-tier rights extended to all users, retention windows. ToS Section 06 is the legal-cover spine — every methodology limitation, scoring subjectivity, AI hallucination risk, coverage gap, and "research accelerator not professional advice" clause spelled out. Liability cap = greater of (12mo paid revenue, $100). NY governing law + JAMS arbitration + class waiver. Effective 2026-05-02 |
| `87cea98` | IX scraper staleness honesty — Lens "IX · Live" pill now flips amber + "stale Nd" suffix when the underlying ix_queue_data row hasn't refreshed in >7 days; tooltip explains the upstream URL change reason. Admin Data Health tab gets a system-level "IX scraper staleness · N of M ISOs frozen" alert listing each stale ISO with its last successful pull date. Defensive disclosure pending the proper scraper repair sprint — PJM, NYISO, ISO-NE all 404 since 2026-04-24 |
| `ec4b96f` | EIA Form 861 utility seed — adds default `county_intelligence` rows for the 32 states that previously had no curated state-default (AK/AL/AR/AZ/DE/GA/IA/ID/IN/KS/KY/LA/MO/MS/MT/NC/ND/NE/NH/NV/OH/OK/PA/SC/SD/TN/TX/UT/VT/WI/WV/WY). Each row has the dominant retail-customer utility per EIA Form 861 (2023, published 2024) — Alabama Power, Entergy LA, Duke Carolinas, NV Energy, Oncor, etc. Lens IX panel now displays a real serving utility for all 50 states instead of "Utility TBD". v1 = state-level default; v2 = per-county HIFLD spatial join, deferred. Site scores neutral (60 baseline) until per-county NWI ingest completes |
| `39758ba` | refresh-substations: parallel batched upsert — fixes the `monthly-data-refresh` p95 drift the latency monitor flagged (was at 57% of its 60s ceiling). Sequential row-by-row supabase upsert (8 states × ~100 rows × ~25ms = ~20s in supabase alone) replaced with bucket-by-state + Promise.allSettled batched upsert — should collapse the supabase phase to 1-2s |
| `dde4877` | Pillar Diagnostics format pass — SectionMarker text-[9px]→[11px] (slightly bigger, less letterspacing); § 04 drops the navy/grey wrapper and uses the same white-surface SectionMarker treatment as Market Position / Analyst Brief / Scenario Studio for visual consistency; SiteControl 4-col tile grid → 4 stacked rows (each factor's note now has room to wrap legibly at 1/3-viewport column width); IX Serving Utility + Ease Score combined into one structured panel matching the ISO Queue Data block's character (amber left-border + mono eyebrow + gauge inline + KV chips + interpretation footer); IX County Queue Notes also amber-tinted to match |
| `efdc33b` | Cron-runs latency monitor — admin Data Health tab now aggregates last 30 days of `cron_runs` and flags any handler whose p95 > 70% of its parent function's `maxDuration` (warn / watch / ok severity bands), surfaces drift like `monthly-data-refresh` at 57% before it becomes a 504; pure JS aggregation (no migration) |
| `2cd7399` | AI scenario commentary — saved Studio rows expose a `▸ Why?` button that fetches a 2-3 sentence Haiku 4.5 narrative explaining the dominant 1-2 input drivers behind the IRR/payback/NPV/DSCR shifts; auto-fires on save (4s window for the call to land), 30-day server-side cache keyed on hashed inputs+outputs (cross-user collapse), Library Scenarios tab gets it for free |
| `8848dd8` | Onboarding deepening — LensTour 4-step coachmark walkthrough on first-time-Pro Lens result (composite gauge → pillars → Scenario Studio → save), `?onboarding=1` URL trigger appended to UpgradeSuccess + WelcomeCard demo links, localStorage persistence, ESC/skip/keyboard nav, graceful-fallthrough on missing anchor |
| `357d7f9` | ScenarioStudio polish: confirm-delete + visible-save + input-pill row + auto-Lens + Radix tooltips on header badges + dropped native title= attrs + dark-space tightening |
| `a13f33d` | ScenarioStudio: vertical history list (replaces chip row) + orphan auto-promote on project save + Library "Scenarios" tab grouping all scenarios by Lens context + card header badge |
| `fd621a0` | Churn flow: pre-cancel exit-intent survey + cancellation_feedback table (migration 042) + reason categories + free-text capture + email/tier snapshot before Stripe portal handoff |
| `251bc38` | Phase 4 coverage: C&I offtake 12 → 32 states (calibrated against EIA Form 861 retail rates), BESS offtake 8 → 25 states (calibrated against ISO/RTO capacity-market clearing prices) |
| `e696d40` | ScenarioStudio: 3 lifecycle sliders (opex $/kW/yr · discount rate · contract tenor) + Equity-IRR (70/30 lev) + DSCR (Y1 NOI / debt service) outputs; output card grows to 8 metrics in 2×4 grid |
| `0dcc051` | ScenarioStudio: lifecycle financial metrics (IRR via Newton-Raphson + LCOE + NPV + lifetime revenue) + Best/Worst preset chips + saved scenarios ride share-memo flow into MemoView for recipients |
| `6caf484` | ScenarioStudio: directional slider colors (slate at baseline / teal when better / amber when worse, applied to chip + track gradient) — replaces the binary "modified" amber treatment |
| `576927b` | Phase 2 part 2: Library "Saved Scenarios · N" chip on cards + 2-col picker + selectedScenario flows into PDF export AND share memo + Search.jsx auto-matches Lens results to saved projects so scenarios attach to project_id |
| `42fd476` | Phase 2: Scenario Studio — interactive sensitivity layer (`scenarioEngine.js` pure compute over revenueEngine + 6 sliders + Y1 revenue + payback + delta chips + saved scenarios chip row + 8 glossary entries + migration 041) |
| `c72272e` | Phase 1: Landing trust signals (8 federal data sources + 120× time-saved comparison) + 14 glossary tooltip entries via new `<GlossaryLabel>` component + Library bulk operations toolbar (Add to Compare / Export CSV / Delete with confirm) |
| `7cf5713` | Phase 0: pricing → $29.99/mo + 14-day no-credit-card trial (Stripe trial_period_days) + webhook hardening (client_reference_id validation via maybeSingle) + cron consolidation 9 → 7 (under Hobby cap) |
| `796bb17` | Backlog batch 2 — a11y + empty states + keyboard nav: aria-labels on icon-only buttons, NewsFeed empty state, tiny-chip contrast (teal-800), aria-live on Admin RefreshResultPanel + Library alerts, autoFocus on Sign{In,Up}, ESC + role=dialog on CompareTray + Search modals |
| `6260c54` | Backlog batch 1 — polish: Admin stale-ok 4th status tier, MemoView ≥7d age warning banner, SignUp 60s rate-limited resend-confirmation link, UpgradePrompt Library-entry "N projects saved · ready for re-scoring" personalization |
| `5fa13c7` | Audit follow-ups: useSubscription .catch + maybeSingle (no more stuck-loading on missing profile row), create-checkout-session priceId allowlist, seed-county-geospatial-nwi.mjs `--parallel=N` flag for NWI catch-up runs |
| `3539511` | Session 3 audit fixes — silent failure sweep: CompareTray AI compare error block, Glossary copy-link "Copied" / "Copy failed" feedback, console.warn for graceful-degrade helpers (Search PUC/Comparable wrappers, Library local fallback fetch, CommandPalette state map, Footer last-updated) |
| `5f70330` | Session 2 audit fixes — data integrity: scoreEngine partial-input midpoint scoring (replaces null→favorable shortcut), Library getAlerts threads countyDataMap (alert delta now matches card display), BroadcastChannel cross-tab cache invalidation on admin Refresh |
| `14f92b2` | Session 1 audit fixes — onboarding: /update-password route (Supabase reset target), Landing ApiErrorBanner instead of swallowed catches, UpgradeSuccess first-time Pro guided-action card, UpgradePrompt LensPreview component (paywall now shows the output) |
| `dc85c18` | BUILD_LOG: cron-runs latency monitor → P2 backlog (catch the next 504-class bug before users do via cron_runs.duration_ms p95 vs maxDuration scan) |
| `d50c9fd` | Admin: visible feedback on Copy report / Copy / Copy JSON buttons via shared CopyButton component |
| `bbc9543` | Fix substations 504: parallelize fetchEIAData + fetchRetailRates per-state with Promise.allSettled (was 8×15s sequential = up to 120s past 60s budget) |
| `9902f51` | Fix HTTP 500 on refresh-data: duplicate `const usps` SyntaxError; adds `lint:api` step to verify pipeline so api/*.js syntax is checked locally |
| `5b17f89` | Fix geospatial_farmland: switch SSURGO from single whole-US query to per-state batched (50 × ~80ms = ~5s, was tripping SDA's 100s execution cap and returning empty {}) |
| `7c49c5c` | Path B: county_geospatial_data — wetland coverage (NWI) + prime farmland (SSURGO) for all 50 states / 3,142 counties; closes Site Control gap; migration 039 + scoreEngine 3-layer fallback + Site · Live pill |
| `e4c6666` | Lens loader: asymptotic halo fill — replaces linear-stall-then-jump with `p = 95 * (1 - exp(-elapsed/8s))`; RAF loop never exits while overlay visible so the halo physically can't freeze on slow runs; cleaner snap-to-100 landing on completion |
| `7d474e1` | IX · Live pill: structured Radix tooltip matching the methodology popover (dark navy + teal border); replaces native browser `title` with INPUTS / CLAMP / coverage-policy box |
| `e9506a7` | IX score live-blend: scoreEngine.computeSubScores now optionally blends ix_queue_data quantitative signals (mw_pending, avg_study_months) on top of curated ixDifficulty baseline; coverage.ix = 'live'\|'curated' flag exposed; teal "IX · Live" pill in Lens eyebrow when blend fired (8 top-CS-market states today); Library/Profile call sites unchanged → no regression |
| `4702b98` | BUILD_LOG: flip migrations 034-037 to ✅ + add live-DB probe script |
| `b27dfa0` | Library WoW + freshness signal: "Data refreshed [date]" hero caption (teal breathing dot, amber if >14d) + "State ±N pt" chip on project cards when state_programs_snapshots show movement; piggybacks on getStateProgramDeltas already shipped for Markets on the Move |
| `5b6a7a0` | Pro-flow smoke tests: auth.setup.js + pro-smoke.spec.js (6 tests, ~10-15s, $0/run) — covers Search/Library/Profile/Dashboard past the paywall, catches the white-screen class on the authed surface that smoke.spec.js can't reach |
| `4fb24b6` | Landing onboarding: items-baseline on the simulated alert feed so chip + text share a typographic baseline; reverted "— lines / dots / solid" addendum from map legend |
| `8a7f2ea` | Visual polish: gauge labels (25/50/75), shimmer flow (real CSS bug — animate 0%→100% not 0%→50%), legend visibility, baseline symmetry sweep across NewsFeed / Comparable / Regulatory |
| `e2c8b48` | Dashboard: surface "data refreshed [date]" caption on hero — makes the live-data promise provable on first impression with teal breathing dot (fresh) or amber (>14d stale) |
| `26b86b0` | BUILD_LOG: capture site-coverage fix + state-level coverage gaps |
| `d4061d2` | Score honesty: site sub-score also signals fallback when county_intelligence row missing (only 18 of 50 states seeded — caption now consolidates both pillars in one block) |
| `9b0d96c` | BUILD_LOG: capture score-honesty fix + new pickup priorities |
| `596de4b` | Score honesty: surface "limited coverage" caption + AI COVERAGE NOTE when offtake falls back to baseline (BESS/CI/Hybrid outside curated 8-12 states) |
| `1474c3d` | BUILD_LOG: capture full audit / fix / smoke-suite stretch + post-break pickup |
| `79bfb08` | Smoke tests: Playwright suite catches runtime bugs that pass build (7 tests, ~20s) — `npm run verify` is the new pre-push gate |
| `318930e` | Two visual fixes: CSS-keyframe shimmer (replaces motion's keyframes that produced loop-boundary discontinuity) + ticks moved OUTSIDE the gauge arc |
| `09304d5` | useSubscription: unique channel name per hook instance — **fixes white-screen on dashboard state click** (Supabase realtime channel collision when WelcomeCard + StateDetailPanel both mounted the hook) |
| `eea8d78` | Dashboard: defensive Map check on deltaMap (preventative; speculative diagnosis of the white-screen, real fix was `09304d5`) |
| `5c30369` | Wave 1.4: state_programs_snapshots history + Markets on the Move WoW deltas (migration 038 — needs to be applied) |
| `53625e3` | Two refinements: tiled-gradient shimmer (still had loop discontinuity, superseded by `318930e`) + bigger gauge ticks |
| `d3af13c` | Three follow-up fixes: peer-state dropdown becomes styled custom popup (not native select), dual-shimmer attempt, gauge merge into single object |
| `dae9e65` | Three fixes: audit log dedupe + 8-row cap with "Show N earlier" expansion, peer-state diff list redesigned as labeled grid (was bullet list of strings), sub-score shimmer flow (1.4s repeatDelay removed) |
| `c709a29` | BUILD_LOG: close out queue items with explicit status |
| `1780fbd` | Library: tighter mobile padding/gap on project card collapsed header |
| `5bd249c` | Color audit: consolidate legacy primary teal #0F6E56 → canonical #0F766E across all surfaces (Library / Profile / Search / ProjectPDFExport / SectionDivider / UpgradeSuccess) |
| `bcc65d9` | Compare modal: teal-tinted slim scrollbar (.scrollbar-dark utility) |
| `2b14b83` | Library: `?preview=empty` URL flag to view empty-state onboarding without deleting projects |
| `f02704e` | Onboarding: subscription-aware WelcomeCard + contextual UpgradePrompt (URL params surface as "Lens analysis staged for you") |
| `41c91eb` | Compare: TractovaLoader on AI synthesis (replaces gradient skeleton) |
| `b3cb940` | MemoView: real conversion CTA for non-owner share-link viewers |
| `6dc21ab` | Markets on the Move: live-pulse indicator + overflow count + chip tooltips |
| `79390c1` | Compare: enrich items + group rows into §01 Composite / §02 Project sections (Program Capacity + LMI Carveout rows added) |
| `b45b359` | Lens: rewrite Custom scenario as Peer-State picker (apply any state's profile, see live diff) |
| `1780fbd` | Library: tighter mobile padding/gap on project card collapsed header |
| `5bd249c` | Color audit: consolidate legacy primary teal #0F6E56 → canonical #0F766E |
| `2b14b83` | Library: `?preview=empty` URL flag to view empty-state onboarding without deleting projects |
| `d2aa9a1` | BUILD_LOG: capture audit-cycle commits + UX/Lens redesign sweep |
| `31247ae` | Loaders: TractovaLoader on NewsFeed Market Pulse, scenario rationale, Admin Data Health |
| `e447a7e` | Hygiene + polish: drop `iad1` from masthead, delete TopoBackground, fix scroll-into-view ordering, gitignore scratch txt |
| `1eda205` | Library: upgrade empty-state into a 3-value-prop onboarding card |
| `0ca8b7a` | UX: surface API failures with retry instead of swallowing — new ApiErrorBanner across Dashboard / Comparable / Regulatory |
| `6b17f40` | Lens: research-desk masthead + §-numbered section markers + dossier band wrapping the 3 cards |
| `6a25073` | Revert: remove TopoBackground from Lens (lines felt too literal) |
| `2c58e4b` | (later reverted) Lens: subtle topographic background on results panel |
| `e63a0c3` | Library: project-bar redesign — mini arc gauge + accent rail + score-tinted gradient |
| `c88629e` | Loaders: branded TractovaLoader + Library Portfolio AI summary uses it |
| `eab8492` | Lens: cards collapsed by default — prompt user interaction |
| `4eff1e9` | Lens: full-card collapse on the 3 main cards + grid alignment fix |
| `3d69237` | Lens: click-to-expand drilldowns on the 3 main cards (SC / IX / Offtake) |
| `6733480` | Lens: precedent-anchored scenarios + brief feedback loop (smooth scroll + pulse) |
| `db92ccb` | Lens: shimmer constant on sub-score bars + fold Federal LIHTC into Offtake stack |
| `3d57820` | Lens: redesign sub-score bars (Offtake / IX / Site Control) — animated arcs + spring counters |
| `2fb04db` | Admin: surface Census diagnostic in Data Health UI (`Run Census diagnostic` button) |
| `475a095` | Merge: Tailwind v4 + Vite 8 + shadcn |
| `55f3fc7` | Integrate shadcn/ui (scoped, brand-preserving) |
| `3e7df8e` | Upgrade Tailwind v3 → v4 and Vite 5 → 8 |
| `d8be8ef` | Refresh: stale-tolerance for Census ACS sources (90-day window, amber-OK badge) |
| `4285c1a` | Refresh: make `?debug=1` auth-bypass + fully redact key |
| `0cab89f` | BUILD_LOG: capture diagnostic plan + clear pickup steps |
| `beaac11` | Refresh: Census `?debug=1` diagnostic mode + descriptive User-Agent |
| `2d974cd` | BUILD_LOG: capture today's multiplex refactor + UI polish |
| `875aa88` | Admin: color-code the 10 tabs for at-a-glance scanning |
| `8012250` | Profile: move Data Admin link to top of page |
| `d28956c` | Refresh: inline `keyed=` flag into Census error strings (UI visibility) |
| `6011cab` | Refresh: surface `keyed` flag on Census handler errors (env-var diagnostic) |
| `503aec7` | Refresh: split NMTC into its own HTTP call to fit Hobby gateway ceiling |
| `341410f` | Refresh: kill 503-retry storm + add 310s client-side timeout |
| `4ed7f3b` | Refresh: serialize Census handlers + retry on 503 (later refined by 341410f) |
| `0baad56` | Bump `@anthropic-ai/sdk` 0.88 → 0.91.1 (dependabot moderate) + accepted-risk doc |
| `ebf3deb` | Tune Census fetch budget for parallel multiplexed runs |
| `3d9f978` | Fix: multiplexed refresh hitting 60s gateway timeout (`maxDuration` 60→300, `Promise.all`) |
| `9ba2086` | Fix: NMTC LIC handler — iterate tract pulls per-state (Census wildcard fix) ✓ verified |
| `f2fdb6c` | Docs: consolidate planning trail into single BUILD_LOG.md |
| `ad67356` | Data layer: NMTC LIC tracts → IRA §48(e) Cat 1 +10% ITC bonus per county |
| `fe2b108` | Data layer: HUD QCT/DDA federal LIHTC overlay per county |
| `71d7456` | Data layer: IRA Energy Community (+10% ITC bonus) per-county eligibility |
| `4016fca` | Crons: kill `.catch`-on-builder bug + redesigned refresh status panel |
| `c3aaecb` | Crons: surface uncaught exceptions as JSON instead of generic 500 |
| `26202d3` | Cron observability: stop swallowing failures, fix cron_runs schema bug |
| `604d345` | Admin: better diagnostics + fallback for partial-refresh failures |
| `acceb1a` | Admin: every Refresh click verifies every source — panel reflects it |
| `6485ed9` | Admin: wire cron-driven updates into Data Health freshness + cache flush |
| `b628866` | Data pipeline: news_feed RSS+AI ingest + revenue_stacks DSIRE verification |
| `3ae35dd` | Data pipeline: county-level Census ACS — 3,142 counties live-pulled |
| `27d9b4f` | Data pipeline: DSIRE verification layer for state_programs |
| `6e1c6f4` | Data pipeline: live Census ACS pull + multiplexed refresh-data + admin trigger |

> Older entries are in `docs/archive/Running_Notes.md` (Day 1-4 V3 build log preserved verbatim).

---

## Backlog (priority-ranked)

### P1 — Scaffolding shipped 2026-04-30; lights up automatically as data history accrues
- **Markets on the Move WoW deltas** — ✅ scaffolding shipped (`5c30369`). Migration 038 (`state_programs_snapshots`) appends a row per active-CS state on every `state_programs` cron run. UI pulls the deltas via `getStateProgramDeltas()` and renders ↑/↓ pt arrows when ≥2 snapshots exist per state. Falls back to the recency sort + "Xd ago" caption until then. Data accrues automatically; first deltas appear ~2 weeks after migration 038 lands.
- **Library project-card WoW chip** — ✅ scaffolding shipped (this session). Same data source as Markets on the Move; renders a "State ±N pt" pill on each card whose state has moved between weekly snapshots. Honestly labeled "State" because deltas are state-program-level, not per-project. Silent until snapshot history accrues.
- **IX Velocity Index + Program Saturation Index** (Wave 1.4 derived metrics) — `ix_queue_snapshots` accumulating since 2026-04-28 (migration 012 already shipped). Computation logic is the only piece pending; once we have ≥4 weeks of history we'll add an RPC and a chip on the IX card. Readiness recheck **scheduled for 2026-06-03** via /loop agent.
- **Trend chips on KPIs (MetricsBar)** — same pattern: needs `dashboard_metrics_snapshots` history. Revisit when prioritized; the same scaffolding template (migration + cron hook + delta helper) used for `state_programs_snapshots` applies here.

### P2 — Closed: existing solution is correct
- ~~**Search.jsx form inputs → ui/* primitives**~~ — **Reviewed 2026-04-30, deliberately not refactored.** Search.jsx already uses clean `FieldSelect`, `CountyCombobox` field components with shared `labelCls`/`inputCls` Tailwind classes. The grid layout is intentionally dense (5-column on desktop) and forcing the project's `Input.jsx` primitive (designed for stacked-label layout) would degrade not improve. The "deferred to natural touches" guideline in the V3 plan is the right call — substitute incrementally as new fields are added, not as a bulk rewrite.

### P2 — Engineering-ready (real work)
- **Cron-runs latency monitor** — recurring agent (weekly cron or `/schedule`) that scans `cron_runs.duration_ms` p95s for each `cron_name` and flags any source whose p95 exceeds 70% of its function `maxDuration`. Surfaces in admin Data Health (or via PR/email). Catches the *next* `refresh-substations`-class 504 before it ships — the structural class of bug ("sequential per-state calls under a tight function budget") is invisible to syntax/smoke checks; it only shows up under upstream slowness, by which point users see a red panel. Implementation sketch: a `/api/check-cron-latency` endpoint that selects the last 8 successful runs per `cron_name` and computes p95 vs the corresponding vercel.json `maxDuration`; exits with a structured warning summary the admin UI can render. Estimated 2-3h. Pairs naturally with the existing `cron_runs` telemetry already populated by every refresh handler.
- **Wetlands + farmland data layers** (EPA NWI / USDA WSS) — ✅ shipped 2026-05-01 as Path B (`7c49c5c`).

### P3 — Pre-revenue legal / IP (non-engineering, no monthly subscriptions per user preference)
- Hand-roll **Privacy Policy + Terms of Service** (avoiding Termly/Iubenda monthly).
- **LLC formation** before significant revenue.
- **USPTO trademark filing** for "Tractova" wordmark (~$500 flat-fee attorney).
- **Defensive domain registrations** (.io / .app / .ai / typos).

### Accepted dependency risks (dependabot will keep flagging — context here)

| Package | Severity | Why we accept | Resolution path |
|---|---|---|---|
| `xlsx` | high (proto pollution + ReDoS) | Vulns require **parsing** malicious workbooks. We only **write** xlsx (Library export). No npm patch — SheetJS left npm in 2023. | Replace with `exceljs` only if we add xlsx import. Otherwise indefinite. |
| `react-simple-maps` chain (`d3-color` ReDoS) | high ×4 | ReDoS needs user-controlled color strings; we pass static us-atlas topojson. Library abandoned at v3; npm flags downgrade to v1 as the only "fix". | Swap for `@nivo/geo` or similar if the map needs new features. |
| ~~`vite` / `esbuild`~~ | ~~mod ×2~~ | ~~Dev-server-only vulns.~~ | ✅ **Resolved 2026-04-30** by Vite 5→8 upgrade (`3e7df8e`). |

### Deferred until paying-user traction
- **IX Queue Forecaster** (Wave 2 — needs ≥12 weekly snapshots, Q3 launch).
- **Comparable Deals DB** (~30+ Pro users justify build).
- **PUC dockets full crawl** (per-state portals, high curation cost).
- **OpenEI URDB integration** (utility tariff schedules — scale + utility-territory mapping issue).
- **§48(e) Categories 2-4** (Indian Land + low-income residential + economic benefit) — Cat 1 covers most CS projects; 2-4 require additional data layers.

---

## How to update this file

When the user says **"update build log"**, **"log this"**, **"save what we did"**, or similar, Claude should:

1. Run `git log --oneline -5` (or check session memory for new commits) and **prepend** any new commits to the Recent builds table.
2. Update **Pending migrations** — if a new `03X` SQL file was created, add it as ⏳; if user confirmed they ran SQL, flip the relevant row(s) to ✅.
3. Update **Status snapshot** — bump last-commit hash + subject; update the live-data-layers list if a new one shipped or one was removed.
4. Move any **Backlog** items that just shipped into Recent builds (delete from backlog).
5. Add new backlog items if the session generated them.
6. Keep the file concise — if Recent builds exceeds ~25 rows, move the bottom 5 to a "older builds" section or trim into `docs/archive/Running_Notes.md`.

That's the entire protocol. No other planning docs to maintain.
