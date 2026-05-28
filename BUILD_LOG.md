# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-05-27 (latest) — Dashboard revamp v2: dark intelligence terminal + unified d3-canvas globe

**The product now.** Dashboard is no longer "well-formatted data" — it's an **intelligence terminal**. Dark surface scope (`dashboard-dark` class — every other page stays on the cream brand surface). 3-col hero: **Market Filters rail** (left) | **unified d3-canvas globe** (center) | **IntelligenceFeedCard** / **StateDetailPanel** (right). 5× sparkline KPI cards + Markets-on-the-Move below. ~80px of vertical reclaimed in Ship 1.8 so it lives above the fold on a 900px viewport — single-page, not scrollable.

**The globe is ONE artifact, not a splice.** Single `<canvas>` driven by `d3-geo` + Canvas 2D + `d3-timer` + `d3-interpolate`. Four phases on the same projection: **idle** (rotating dot-matrix world, ~150s/revolution) → **rotating** (rotation interpolates to [98°W, -38°N] = central US, shortest-path normalized) → **zooming** (scale 0.66 → 1.6×, dots fade out, state choropleth fades in) → **focused** (US fills the disc, sphere rim still visible at edges, states clickable via `projection.invert()` + point-in-polygon hit-test). 1600ms cubic ease-in-out; no DOM teardown, no canvas swap. Pattern lifted from `Skills/Interactive Globe Support/Interactive Globe 1.md`.

**This session shipped 7 commits (each full `npm run verify` green — lints + citations + secrets + audit + locs + 175 unit + build + 7/7 smoke):**

- **Phase 1 — MarketBrief + copy sweep** (commit `a548d6a`): new `src/components/MarketBrief.jsx` + `api/market-brief.js` weekly Sonnet 4.6 endpoint (ISO-week cache key, 8d TTL, derives context from news_feed + state_programs_snapshots + state_programs). Always renders SOMETHING via static fallback synthesized from props. Public to /preview + authed. Deleted "Phase 2 placeholder" block in StateDetailPanel + "Per-utility detail data available on request" in MetricsBar.
- **Hobby fn-cap fix** (commit `6d0c1ac`): Phase 1 broke prod build — Vercel Hobby caps at 12 Serverless Functions and `api/market-brief.js` was the 13th. Moved handler to `api/handlers/_market-brief.js` + extracted prompt to `api/prompts/market-brief.js`; routed via `api/lens-insight.js` as a PUBLIC action (before the Pro auth gate). **Memory captured:** `project_vercel_hobby_function_cap.md` — never add a 13th top-level api/*.js; use the multiplexer pattern.
- **Site Teardown — Defillama** (`research/2026-05-27-defillama-teardown.md`): full HTML (5.5MB rendered DOM) + main CSS bundle extracted into a complete design-token + animation-library + interaction-pattern reference. Where the rest of v2's tokens, keyframes (wiggle/linebeat/ai-glow/shimmer/spotlight-enter/marquee), and patterns (disclosure-metric, dotted-underline cells, hover-reveal CTAs) come from.
- **Ship 1 — Dashboard shell + map hero** (commit `559b55f`): dark `.dashboard-dark` scope class with brand-aligned CSS vars (`--app-bg #0B1623`, teal kept — not Defillama blue). 6 `dash-*` keyframes + `.thin-scrollbar` utility added to `index.css`. NEW: `DashboardGlobe.jsx`, `MarketFiltersRail.jsx`, `charts/KPISparkline.jsx`. MetricsBar reworked 530 → 200 LOC (modal-opening cards → disclosure-metric cards w/ 8-week sparklines; 4 of 5 use real history derived from `state_programs_snapshots` + `news_feed`; IX Headroom honest "trend tracking coming online"). Added `getDashboardMetricsHistory({weeks=8})` to programData.js. **New dep:** `cobe` (~30KB).
- **Ship 1.5 — globe geometry + condense feed** (commit `eb7ea4a`): aspect-ratio bug fix (1:1 + maxHeight conflicted → oval), US-orientation fix (phi 4.7 → 1.85, Pacific was at center, US is now), MarketBrief temporarily hidden (component intact + import commented for re-enable), new `IntelligenceFeedCard.jsx` replaces the verbose NewsFeed in the right rail (top-5 items, dotted-underline cells, `.lp-spotlight` chrome, hover-reveal "View all" CTA).
- **Ship 1.6 — orthographic US zoom** (commit `c80bf9f`): re-enabled slow globe rotation (0.0007 rad/frame); click target changed from flat AlbersUSA USMap to a new `USOrthographicGlobe.jsx` using `geoOrthographic` rotated [100,-38] in a circular sphere rim. Per Aden: "the globe itself moves and zooms in slightly showing the US in a zoomed in version of the globe."
- **Ship 1.7 — UNIFIED d3-canvas globe** (commit `08aa7a8`): Aden flagged Ship 1.6 as "two separate images just spliced together" (cobe canvas → SVG hard cut). Total rebuild of `DashboardGlobe.jsx` to ONE Canvas 2D + d3-geo artifact. `USOrthographicGlobe.jsx` retired (absorbed). `cobe` import dropped (dep stays installed). Four-phase continuous projection animation as described above. Pattern + dot-matrix from `Skills/Interactive Globe Support/Interactive Globe 1.md`. **No new deps** — d3-geo, d3-timer, d3-interpolate, topojson-client already installed transitively via react-simple-maps.
- **Ship 1.8 — sizing + ambient bg + dark StateDetailPanel + Run-a-Lens centerpiece + tighter layout** (commit `dc07edb`): five polish issues Aden flagged on Ship 1.7. cursor:wait removed during animating. `FOCUS_SCALE 1.0 → 1.6` (US now fills the disc edge-to-edge); `IDLE_SCALE 0.42 → 0.66` (globe fills 2/3 of disc). Ambient layers behind globe — `.lp-hero-grid` + radial teal-wash, both reused from existing Skills CSS. **StateDetailPanel dark-themed** via replace_all palette swaps (bg-white/border-gray-*/text-gray-* → dashboard-dark CSS tokens); STATUS_CONFIG + IX_CONFIG chip palettes rebuilt with teal/amber/red transparency-on-dark. **"Search in Lens" pill RETIRED → full-width gradient "Run a Lens on {state}" CTA below the score, pulsing with `dash-ai-glow`** ("centerpiece to the next phase of our product"). Layout tightened: main padding pt-20→16/pb-10→6, h1 text-2xl→xl, grid gaps 3→2, MetricsBar minHeight 108→94, map area maxHeight 560. ~80px vertical reclaimed.

### ⏭ DO NEXT
1. **Aden Vercel-prod browser-review of Ship 1.8** — does the unified globe feel like one continuous artifact, does the focused-zoom US fill properly, does the dark StateDetailPanel + bigger Run-a-Lens land, are the KPI strip + Markets-on-the-Move above the fold?
2. **Auto-resize globe when StateDetailPanel opens** — motion-coordinated layout shift (globe shrinks gracefully, panel slides into space). Aden offered Skills/Resizeable Panels.md if needed. Deferred from Ship 1.8; pick up if layout still feels constrained.
3. **Original v2 plan's Ship 2 work that's still open** — MarketsOnTheMove extraction + dash-marquee infinite-scroll behavior (CSS-vars-as-props, reverses on hover). StateDetailPanel palette pass — ALREADY DONE in Ship 1.8. IntelligenceFeed density rework — partially done via IntelligenceFeedCard but the Defillama dotted-underline + data-attribute tabs polish could go deeper.
4. **MarketBrief re-enable** — currently hidden in Dashboard (`<MarketBrief>` block commented). API + component both intact. Toggle back on once Aden decides whether the editorial preamble belongs back above the 3-col grid.
5. **Net Billing sourcing pipeline** (carried over from 2026-05-25, NOT touched today) — TX/NJ/MO/OK NB; CT/HI NM-haircut; TN TVA DPP special case; HI/NY TOU; MN hybrid revisit. Methodology + workflow settled; this is straight execution when we return to data-honesty work.

### Prior recent arcs (full detail → `docs/archive/BUILD_LOG-history-2026-05-25.md`)
- **2026-05-27 (data slice)** — NB waves 2-4 (12 states sourced: +AR/IN/LA/MI/NC/OH/KY/SC); Geist sans switched on (fixed Inter loaded-but-unused bug); NV NM-haircut wired (0.75 of retail) with two-layer formula matching NB; sourcing files on disk for AR/AZ/IN/KY/LA/MI/MN/MT/NC/OH/SC/VA; 173 unit + 7/7 smoke. (Same calendar day as the dashboard revamp slice above — that's why both pickups carry the 2026-05-27 stamp.)
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
