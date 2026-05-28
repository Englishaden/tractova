# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-05-28 (latest) — Dashboard v2.5: tab IA + Analytics charts + KPI reveals + polish

**The product now.** Dashboard is a **tab-based intelligence terminal** with a left sidebar (Home / Analytics / Markets & Policy), URL-routed via `?tab=`. **Home tab** = the Ship 1.8 surface (Market Filters · unified d3-canvas globe · IntelligenceFeedCard/StateDetailPanel · KPI strip · Markets on the Move). **Analytics tab** = 7 fully-built charts grounded in audited data sources, with a sticky state-multiselect filter at the top. **Markets & Policy tab** = honest placeholder for Ship 2.2. Footer is now route-aware (dark on `/`, cream elsewhere). KPI cards now reveal **card-specific intel** on click (top states / IX breakdown / recent news / pipeline split), not just a bigger sparkline.

**The IA shift.** Dashboard.jsx is now a thin ~120-LOC orchestrator (was ~360); HomeTab.jsx absorbed the entire Ship 1.8 hero verbatim; AnalyticsTab.jsx + MarketsPolicyTab.jsx sit alongside. DashboardSidebar.jsx uses a custom CSS `.dash-border-gradient` utility (conic-gradient ring rotating via `@property --dash-border-angle` + `@keyframes`) adapted from Skills/Hover Border Gradient.md — active tab gets the ring + a teal hairline accent + radial glow from the left edge.

**The globe is still ONE artifact** (Ship 1.7 d3-canvas + d3-geo, four phases on the same projection — idle / rotating / zooming / focused). Loading state polished in 2.1.1: three concentric pulsing teal rings + dash-shimmer band + live caption ("Building globe · Fetching world + state topology…") instead of the bare "Loading globe…" text.

**This session shipped 5 commits (each `npm run verify` green — lints + citations + secrets + audit + locs + 175 unit + build + 7/7 smoke):**

- **Ship 2.0 — route-aware Nav, Radix combobox, dark footer*, live globe markers** (commit `7bfa841`): Nav.jsx route-aware theming (dark on `/`, cream elsewhere) via `useLocation` + scope-token object; MarketFiltersRail's Utility datalist replaced with a Radix Popover combobox; StateDetailPanel final palette sweep; DashboardGlobe gained a LIVE markers layer (sized by the user's saved-Library project count per state, breathing teal halo). _*footer dark-theming was deferred here, shipped properly in 2.1.1._
- **Ship 2.0.1 — popover lightening + saved-only markers** (commit `25738c0`): Aden flagged the Utility popover as "literally black" — switched to a light-card-on-dark-page pattern (white surface, navy text, teal hairline border). Also: removed the LBNL fallback that was leaking WA/Oregon markers when the user had no saved Library projects. Now ONLY user-saved-Library states light up. Marker sizes tightened (3-7px → 2-4.5px).
- **Ship 2.1 — sidebar IA + Analytics charts + Markets&Policy placeholder** (commit `26ffbf1`): Big IA shift per warm-foraging-charm.md. NEW: `src/components/dashboard/` directory housing `DashboardSidebar`, `HomeTab`, `AnalyticsTab`, `MarketsPolicyTab`, plus `charts/` with `ChartCard` (shared dark wrapper) and 7 fully-built charts: CsProgramStatusBar, CsCapacityLeaderboard, LmiPenetrationBar, FeasibilityScoreDeltas (multi-line), PolicyPulseStacked (stacked area), IxDifficultyDonut, OperatingCsProjectsBar. New data getters: `getDashboardMetricsHistory()` extended with `policyPulseByPillar` (per-week per-pillar counts); NEW `getCsProjectsAggByState()` for LBNL ground truth. Dashboard.jsx refactored 360 → ~120 LOC thin tab router reading `?tab=` querystring.
- **Ship 2.1.1 — footer dark · overlap fix · sidebar polish · KPI reveals · loaders** (commit `3976e67`): 5 polish issues from Aden's 2.1 review. (1) Footer.jsx route-aware theming (dark on `/`, cream elsewhere) — was the missing piece from 2.0. (2) "1" count chip overlapped "CLEAR" in the 200px-wide MarketFiltersRail — restructured into two-row layout when filters active. (3) Sidebar tabs felt basic — new `.dash-border-gradient` utility (pure CSS, conic-gradient ring rotating via `@property` + `@keyframes`), adapted from Skills/Hover Border Gradient.md. Active tab also gets top hairline accent + radial teal glow. (4) **KPI card click reveal rebuilt** — was just a bigger sparkline ("not sure what clicking the cards at the bottom does"). Now each card reveals card-specific intel: CS Coverage→top 4 active states by MW; IX Headroom→4-tier difficulty stacked bar + legend; Policy Pulse→top 3 recent news items w/ pillar dots; Avg Capacity→top 4 by remaining MW; Pipeline Load→active vs limited stacked split + top 3 contributors. (5) Loading polish: DashboardGlobe loader = three concentric pulsing rings + dash-shimmer band; AnalyticsTab shows 6-card shimmer skeleton until first data resolves.

**Files of interest** (new this session):
- `src/components/dashboard/{DashboardSidebar,HomeTab,AnalyticsTab,MarketsPolicyTab}.jsx`
- `src/components/dashboard/charts/{ChartCard,CsProgramStatusBar,CsCapacityLeaderboard,LmiPenetrationBar,FeasibilityScoreDeltas,PolicyPulseStacked,IxDifficultyDonut,OperatingCsProjectsBar}.jsx`
- `src/lib/programData.js` extended (`policyPulseByPillar`, `getCsProjectsAggByState`)
- `src/index.css` `.dash-border-gradient` + `@property --dash-border-angle` + `dash-border-rotate` keyframe

### ⏭ DO NEXT
1. **Aden Vercel-prod browser-review of Ship 2.1.1** — footer dark, sidebar tabs (gradient ring), KPI reveals (does each card's intel feel useful), CLEAR overlap gone, loading states smooth across globe + Analytics.
2. **Ship 2.2 — Markets & Policy tab content** — placeholder currently. Plan calls for: State Program Grid (clickable cards for ~22 active/limited/pending states w/ capacity + runway + score gauge), Subscriber Mix Comparison (stacked-bar across LMI-required states from LBNL deployment data), State Score History (8-week multi-line for top movers — could reuse FeasibilityScoreDeltas chart shape), Dense Policy Feed (paginated 50-per-page NewsFeed reincarnation with pillar tabs + dotted-underline rows). Aden flagged he'll be scraping policy articles to seed this tab once UI is built.
3. **Auto-resize globe when StateDetailPanel opens** — still deferred. Motion-coordinated layout shift (globe shrinks gracefully, panel slides into space). `Skills/Resizeable Panels.md` on file if needed.
4. **MarketBrief re-enable decision** — block + import still commented in HomeTab.jsx for fast re-enable. API + component both intact.
5. **MarketsOnTheMove → dash-marquee** — original Ship 2 plan item, still pending. Currently inline static in HomeTab; the `.dash-marquee` keyframe + container CSS are already in index.css from Ship 1, just not wired up.
6. **Net Billing sourcing pipeline** (still carried over from 2026-05-25, NOT touched today) — TX/NJ/MO/OK NB; CT/HI NM-haircut; TN TVA DPP; HI/NY TOU; MN hybrid revisit. Methodology + workflow settled — straight execution when we return to data-honesty work.

### Prior recent arcs (full detail → `docs/archive/BUILD_LOG-history-2026-05-25.md`)
- **2026-05-27 (dashboard revamp v1)** — Phase 1 MarketBrief + Hobby fn-cap fix (multiplexer pattern; memory captured); Defillama teardown → `research/2026-05-27-defillama-teardown.md`; Ships 1 / 1.5 / 1.6 / 1.7 / 1.8 — dark scope + unified d3-canvas globe + filters + sparklines + IntelligenceFeedCard + dark StateDetailPanel + big Run-a-Lens CTA. Commits a548d6a → dc07edb.
- **2026-05-27 (data slice)** — NB waves 2-4 (12 states sourced: +AR/IN/LA/MI/NC/OH/KY/SC); Geist sans switched on (fixed Inter loaded-but-unused bug); NV NM-haircut wired (0.75 of retail) with two-layer formula matching NB; sourcing files on disk for AR/AZ/IN/KY/LA/MI/MN/MT/NC/OH/SC/VA; 173 unit + 7/7 smoke.
- **2026-05-25** — 5-pillar signal pivot COMPLETE; Incentives + Policy & Timing promoted to composite; `revenueEngine` + Scenario Studio $-layer removed; ScenarioStudio → DevFeasibilityView (§03); prod-review feedback (de-$'d AI brief, pillar detail modals, what-if levers, collapsible sections).
- **2026-05-24** — two-axis **Architecture × Structure** rename (migration 069); net-metering economics; "which structure pays best" view; **capture-all-DG** data layer (migration 068); label-consistency prod fixes.
- **2026-05-23** — IX distribution-queue coverage closed (+VA/WI/NJ/CA/MD, CO demote); county-resolver fix.
- **2026-05-21/22** — audit arc closed (Glossary + audit-ui tooling); IX distribution pivot + 3-pillar motion arc.
- **2026-05-03 → 20** — UX-001 nav / Library cockpit; data-trust audit + RLS hardening; LBNL/NREL data-lineage layers (cs_projects, cs_specific_yield, solar_cost_index); $29.99 launch; CLAUDE.md safety net.

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
