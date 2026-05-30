# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-05-30 (latest) — Dashboard v2.8: Home-tab review rd4 (globe-collapse bug · dark regulatory · map legend · ⌘K scroll-clamp)

**Product now.** Dashboard = tab terminal (Home / Analytics / Markets & Policy via `?tab=`); Markets&Policy BUILT (v2.6). This round = Aden's 4th Home-tab review pass, 4 fixes. Globe still ONE d3-canvas artifact (idle GLOBE → focused MAP).

**Shipped — one slice, `npm run verify` green (lints+citations+secrets+audit+locs+unit+build+7/7 smoke):**
- **Globe-disappears-on-synthesis-click bug FIXED** — classic grid `min-width:auto` overflow: the StateDetailPanel grid track in `HomeTab` had no `min-w-0`, while its sibling globe track had `overflow-hidden` (auto-min → 0). Expanding the News-tab Market Pulse synthesis grew the detail track's min-content width and collapsed the globe to 0 ("state analysis took the whole screen"). Fix: `min-w-0 overflow-hidden` on the detail track + `min-w-0` on the map track + `break-words` on the synthesis `<p>`.
- **Regulatory tab dark theme** — `DocketCard` was `bg-white` + ink text (clashed on the navy dashboard). Now dark-aware: `mode==='tab'` → navy surface + light text matching the News cards (added `STATUS_CONFIG_DARK`/`PILLAR_COLOR_DARK`/`IMPACT_DOT_DARK`, dark `MetaItem`/`ExplorePucButton`/empty-state). `mode==='lens'` (Lens results, cream page) unchanged.
- **Map legend** — compact focused-phase overlay bottom-right in `DashboardGlobe`: Low→High feasibility ramp + Pending (amber) + No-program swatches. `pointer-events-none` so it never blocks a state click; clears the zoom-out pill (top-right) + AK/HI insets (bottom-left).
- **⌘K chip → fixed-follow + footer-clamp** (reversed v2.7's embed). Back to `position:fixed` so it follows the viewport while scrolling, but bottom is CLAMPED above the footer (rests just above it, never overlaps); right edge aligns to the `max-w` content container (above © Tractova). NO `bottom` transition → tracks scroll 1:1, no "bounce." Back in App.jsx; removed from Footer.

### ⏭ DO NEXT
1. **Aden's notes on Analytics + Markets&Policy tabs** — he has "a ton" queued; Home-tab loop now 4 rounds deep.
2. **Visual gut-check** (Aden reviews on prod per no-popup pref): legend placement/wording, regulatory dark contrast, ⌘K resting spot above ©, grid background.
3. **MarketBrief re-enable** — still Aden's call; import + block commented in HomeTab.jsx.
4. **Net Billing sourcing** (carried from 2026-05-25) — TX/NJ/MO/OK NB; CT/HI NM-haircut; TN TVA DPP; HI/NY TOU; MN. Methodology settled; straight data-honesty execution.

### Prior recent arcs (full detail → `docs/archive/BUILD_LOG-history-2026-05-25.md`)
- **2026-05-29 (dashboard v2.7)** — Home rd3: AK/HI box-only bug (a `selId` scope ReferenceError in the globe render loop, not geometry); ⌘K static-in-footer (later reversed in v2.8); white→brand scrollbars via `html:has(.dashboard-dark)`; collapsible 200→56px icon rail (pulsing triple-chevron, `.dash-shell-grid`); map aurora→infinite grid (`.dash-map-grid`) via globe `onPhaseChange`. Commit `12b6162`.
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
