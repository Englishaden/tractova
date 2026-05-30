# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-05-30 (latest) — Dashboard v2.9: Home-tab review rd5 (⌘K fade-not-clamp · synthesis/map decouple · 2-D map color)

**Product now.** Dashboard = tab terminal (Home / Analytics / Markets & Policy via `?tab=`); Markets&Policy BUILT (v2.6). This round = Aden's 5th Home-tab review pass, 3 fixes. Globe still ONE d3-canvas artifact (idle GLOBE → focused MAP).

**Shipped — one slice, `npm run verify` green (lints+citations+secrets+audit+locs+unit+build+7/7 smoke):**
- **⌘K bounce KILLED (3rd attempt)** — the per-scroll-frame footer-CLAMP (v2.8) recomputed `bottom` and lifted the chip = the bounce. Now plain `position:fixed` at a CONSTANT bottom (CSS scroll-follow, zero per-frame JS) + **fade-out** as the footer enters view (IntersectionObserver, opacity only) so it never overlaps. Right offset aligns to the `max-w` container on resize only.
- **Market Pulse expand no longer moves the map** — vertical twin of the v2.8 min-w-0 bug: the detail track's auto MIN-HEIGHT = content height, so expanding the synthesis grew the hero row and pushed the globe down. Fix: `min-h-0` + `minHeight:0` on the detail track → it stretches to the map-driven row height and scrolls internally. Expand/collapse is now independent.
- **Map fill is now 2-D (status HUE × feasibility INTENSITY)** — pending states rendered solid amber, hiding feasibility (Michigan = 14 but full orange). `fillForState` refactored: HUE = status (teal=program[active/limited], amber=pending, slate=none), INTENSITY = feasibility (5 buckets). Ramps exported (`FEAS_RAMP`/`NONE_FILL`) as the single source of truth; the legend redrawn from the same arrays (status rows × Low→High). No-program stays one muted slate (formula clusters those low — honest, not a fake gradient). `computeFeasibilityScore` is real for every state incl. pending. Inset no-program fallback re-pointed to `NONE_FILL`.

### ⏭ DO NEXT
1. **Aden's notes on Analytics + Markets&Policy tabs** — he has "a ton" queued; Home-tab loop now 5 rounds deep.
2. **Visual gut-check** (Aden reviews on prod per no-popup pref): ⌘K fade-near-footer feel, 2-D legend wording/placement, pending amber ramp readability.
3. **MarketBrief re-enable** — still Aden's call; import + block commented in HomeTab.jsx.
4. **Net Billing sourcing** (carried from 2026-05-25) — TX/NJ/MO/OK NB; CT/HI NM-haircut; TN TVA DPP; HI/NY TOU; MN. Methodology settled; straight data-honesty execution.

### Prior recent arcs (full detail → `docs/archive/BUILD_LOG-history-2026-05-25.md`)
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
