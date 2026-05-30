# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-05-30 (latest) — Dashboard v2.10: Analytics tab full rework (bento + KPI strip · honest citations · LMI/Projects re-viz)

**Product now.** Dashboard = tab terminal (Home / Analytics / Markets & Policy via `?tab=`). This round = Aden's 1st Analytics review pass, executed as a full layout + data rework (acting lead UI/UX + data-analytics COO brief). Commit `56e1f4c`.

**Shipped — one slice, `npm run verify` green (api+citations+secrets+audit+locs+175 unit+build+7/7 smoke):**
- **Bento layout kills the whitespace** — `AnalyticsTab.jsx` rebuilt: Zone A KPI strip (`AnalyticsKpiStrip` — filter-aware mono numbers + inline `KPISparkline`/`CountUp`; sparkline only when unfiltered, no fake-trend-under-filter), Zone B collapsible filter (condenses to a one-line "N selected · chips" summary; full chip grid keeps Aden's liked UI), Zone C 12-col bento (status ribbon ×12 · capacity/IX/projects ×4 · LMI/trends ×6 · policy hero ×12) on **normalized 288px** feature heights via `ChartCard h-full` + fixed-height scroll bodies. Faint `.dash-map-grid` control-room backdrop.
- **Citations now name the UPSTREAM source, not the table** — all 7 footers rewritten two-layer: DSIRE (NCSU/DOE) for program identity, status/MW **admin-curated** (honest); US Census ACS for LMI; LBNL "Sharing the Sun" Q4 2024 for operating projects; ISO/RTO queues for IX tier; PV Magazine/Utility Dive/Solar Power World/Solar Industry RSS for signals; scoreEngine.js for feasibility.
- **LMI re-viz → diverging lollipop** (`LmiDivergingLollipop`, replaces `LmiPenetrationBar`) — Δ vs ~38% national median (custom stem+dot glyph), `interval={0}` ALL labels, teal-above/amber-below; honest deviation axis surfaces the clustered ~30–45% values. **Projects re-viz → dot plot + Lin/Log toggle** (`OperatingCsProjectsDot`, replaces `OperatingCsProjectsBar`) — sorted dots, `interval={0}`, log scale (ticks 1/10/100) resolves the MA/IL/CO/FL skew so small states stay legible.
- **De-numbered eyebrows** — "Chart 0X" → semantic category tags (PROGRAMS / CAPACITY / EQUITY / TRENDS / SIGNALS / INTERCONNECTION / DEPLOYMENT). `ChartCard` gained `headerRight`/`badge`/`className` + a shared `ChartToggle` + `TILE_H`.
- **CS capacity verified single-sourced** — Chart 2 + Home "CS Coverage" card both read `state_programs.capacity_mw` via `getStatePrograms()` (no duplicate compute). Kept current values; citation reframed honestly (see follow-up #1).

### ⏭ DO NEXT
1. **Verify `state_programs.capacity_mw` values** against DSIRE / state-PUC sources + add per-row `source`/`last_updated` (admin-curated today, no attribution — `DATA_SOURCES.md`). Citation is now honest about this; the numbers still need a verification pass.
2. **Aden visual gut-check** on prod (no-popup pref): bento density/whitespace, LMI lollipop readability, projects Lin/Log toggle feel, KPI-strip filter-aware behavior, semantic eyebrows.
3. **Markets & Policy tab notes** — still queued from Aden's "a ton" backlog.
4. **MarketBrief re-enable** — Aden's call; import + block commented in HomeTab.jsx.
5. **Net Billing sourcing** (carried from 2026-05-25) — TX/NJ/MO/OK NB; CT/HI NM-haircut; TN TVA DPP; HI/NY TOU; MN. Methodology settled; straight data-honesty execution.

### Prior recent arcs (full detail → `docs/archive/BUILD_LOG-history-2026-05-25.md`)
- **2026-05-30 (dashboard v2.9)** — Home rd5: ⌘K bounce killed (constant `position:fixed` + IntersectionObserver fade vs per-frame clamp); Market Pulse expand decoupled from map (`min-h-0`); 2-D map fill (status HUE × feasibility INTENSITY, `FEAS_RAMP`/`NONE_FILL` single source). Commit `1816a86`.
- **2026-05-30 (dashboard v2.8)** — Home rd4: globe-disappears-on-synthesis bug (grid `min-width:auto` overflow → `min-w-0`); Regulatory DocketCard dark-themed for the dashboard tab (light kept for Lens); focused-phase map legend; ⌘K fixed+footer-clamp (superseded by v2.9 fade). Commit `6005257`.
- **2026-05-29 (dashboard v2.7)** — Home rd3: AK/HI box-only bug (a `selId` scope ReferenceError in the globe render loop, not geometry); ⌘K static-in-footer (later reversed); white→brand scrollbars via `html:has(.dashboard-dark)`; collapsible 200→56px icon rail (pulsing triple-chevron, `.dash-shell-grid`); map aurora→infinite grid (`.dash-map-grid`) via globe `onPhaseChange`. Commit `12b6162`.
- **2026-05-29 (dashboard v2.6)** — Markets&Policy tab BUILT (StateProgramGrid · SubscriptionMixChart · FeasibilityScoreDeltas · DensePolicyFeed; `subscription_marketer` reframe for the no-split LBNL data); Home UX rds 1-2 (KPI multi-open, Pipeline Load teal/amber, dark utility dropdown, filters-collapse-on-select keeps globe constant, real Policy Pulse dual-line, CSS map aurora, AK/HI clickable insets). Commits `6b74e49`→`c9fb5f7`.
- **2026-05-28 (dashboard v2.5)** — tab IA (sidebar Home/Analytics/Markets, `?tab=`); thin Dashboard.jsx router; 7 Analytics charts + ChartCard; KPI card-specific reveals; footer/Nav route-aware; `.dash-border-gradient` sidebar; globe live markers + loader polish. Commits `7bfa841`→`3976e67`.
- **2026-05-27 (dashboard revamp v1)** — MarketBrief + Hobby fn-cap fix (multiplexer); Defillama teardown; Ships 1–1.8 — dark scope + unified d3-canvas globe + filters + sparklines + IntelligenceFeedCard + dark StateDetailPanel + Run-a-Lens CTA. `a548d6a`→`dc07edb`.
- **2026-05-27 (data slice)** — NB waves 2-4 (+AR/IN/LA/MI/NC/OH/KY/SC); Geist sans on; NV NM-haircut (0.75 retail, two-layer); sourcing files for 12 states.
- **2026-05-25** — 5-pillar signal pivot COMPLETE; Incentives + Policy&Timing → composite; revenueEngine + Scenario $-layer removed; ScenarioStudio → DevFeasibilityView.
- **2026-05-24** — two-axis Architecture × Structure rename (migration 069); net-metering economics; capture-all-DG layer (migration 068).
- **2026-05-23** — IX distribution-queue coverage closed (+VA/WI/NJ/CA/MD, CO demote); county-resolver fix.

---

## Supabase migrations (current)

> **Source of truth = `node scripts/check-migrations.mjs` against the live DB.** This note drifts; always probe before asking Aden to re-run anything.

- **070** `cod_year_and_policy_severity.sql` — `projects.cod_target_year` + `policy_impact_events.impact_severity`/`impact_probability` — ✅ applied 2026-05-25 (Aden).
- **069** two-axis architecture/structure · **068** capture-all-DG `ix_queue_data` — ✅ applied (2026-05-24).
- **≤067** — applied earlier; full historical migration table in the archive file. Probe the live DB to confirm exact state.
- **Pending:** none known.

---

## Backlog (priority-ranked)

### P1 — next data/product work
- **Net Billing economics** — source per-state export-credit basis (avoided-cost / ACC schedules), curated state-by-state starting with states that publish it (CA NEM 3.0 ACC). Until then Net Billing stays honestly gated (offtake fallback baseline, "not modeled"). DSIRE is paid as of May 2026, so sourcing is per-state PUC tariff filings.
- **Manual-data IX ingest pipeline** for the gated states (NJ ACE, ME CMP, MN Xcel, HI HECO, OR OASIS) — upload → Supabase Storage → parse → `ix_queue_data`.

### Accepted dependency risks (dependabot keeps flagging — rationale here)
| Package | Severity | Why accepted | Resolution path |
|---|---|---|---|
| `xlsx` | high (proto-pollution + ReDoS) | Vulns require **parsing** malicious workbooks; we only **write** xlsx (Library export). SheetJS left npm 2023 (no patch). | Replace with `exceljs` only if we add xlsx import. |
| `react-simple-maps` chain (`d3-color` ReDoS) | high ×4 | ReDoS needs user-controlled color strings; we pass static us-atlas topojson. Library abandoned at v3. | Swap for `@nivo/geo` if the map needs new features. |

### P3 — pre-revenue legal / IP (non-engineering)
- Hand-rolled Privacy + Terms (avoid Termly/Iubenda monthly) · LLC formation before significant revenue · USPTO "Tractova" wordmark · defensive domain registrations.

### Deferred until paying-user traction
- IX Queue Forecaster (needs ≥12 weekly snapshots) · Comparable Deals DB · PUC dockets full crawl · OpenEI URDB tariffs · §48(e) Categories 2-4.

---

## How to update this file

When Aden says **"update build log"** / **"log this"** / **"save what we did"**:

1. **Prepend a CONDENSED pickup** at the top (latest first): what shipped, commit hashes, verification, and a short DO-NEXT. Keep it to ~one screen — do NOT write a 50-line diary entry.
2. Roll the previous "(latest)" pickup into the **Prior recent arcs** one-liner list; when that list grows past ~6 entries, move the oldest into `docs/archive/BUILD_LOG-history-*.md`.
3. Update **Supabase migrations** — add new `0NN` files; flip to ✅ when Aden confirms applied (probe live DB first).
4. Move shipped **Backlog** items out; add new ones the session generated.
5. **Keep this file lean.** Full history lives in the archive; this file is the working-memory snapshot, not the permanent record.
