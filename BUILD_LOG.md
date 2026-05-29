# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-05-29 (latest) — Dashboard v2.6: Markets&Policy tab built + Home-tab review rounds

**Product now.** Dashboard = tab terminal (Home / Analytics / Markets & Policy via `?tab=`). **Markets & Policy is now BUILT** (was placeholder): State Program Grid (status-grouped clickable cards w/ radial score gauge + capacity + runway → opens StateDetailPanel in a modal) · Subscription Channel Mix (stacked bar) · Feasibility Score Movement (national top-movers, reused chart) · Dense Policy Feed (50/page, pillar tabs). **Home tab** took two review passes from Aden (cards, marquee, filters, command chip, globe). Globe still ONE d3-canvas artifact (idle→focused).

**Shipped to Vercel prod (confirmed). 6 commits, each `npm run verify` green (lints+citations+secrets+audit+locs+175 unit+build+7/7 smoke):**
- **2.2 `6b74e49`** Markets&Policy tab. NEW `src/components/dashboard/{StateProgramGrid,DensePolicyFeed,charts/SubscriptionMixChart}.jsx`; reused FeasibilityScoreDeltas (label now a prop); new getter `getCsSubscriptionMixByState()`. **Data-honesty:** LBNL/NREL `cs_projects` has NO residential/commercial subscriber split, so "Subscriber Mix" was reframed to `subscription_marketer` (Utility / Third-party / Combination / Unspecified) — unlabeled shown, not dropped.
- **2.3 `a34c151`** MarketsOnTheMove → seamless dash-marquee; first globe auto-resize on panel open.
- **2.4 `0084644`** Home UX rd1: KPI cards independent multi-open (Set); Pipeline Load Active=teal/Limited=amber + MW stacked under label (no wrap); utility filter = dark navy (#0A1828) click-to-open searchable dropdown, county-style; Size filter discrete 1–10 → `/search?mw=`; removed duplicate left-rail Run-a-Lens (StateDetailPanel CTA now carries Size+Stage); CmdKHint parks above footer.
- **2.5 `edab28d`** Globe: FOCUS_SCALE 1.6→1.9 + container 560→660; AK/HI clickable bottom-left insets (own Mercator fit; AK Aleutians sanitized; excluded from main draw/hit-test); FPS — dots back-face-culled + batched into ONE fill, cached stateId→feature map; CSS map aurora (transform-only blobs).
- **2.6 `2860771`** Home UX rd2: CmdKHint jump fixed (transition-opacity, not -all); detail-open resize reworked — **filters rail collapses 2/6/4→0/6/6 so the globe size stays CONSTANT**, panel grows; globe idle labels hidden when a state is selected (no overlap); aurora now reads in the focused MAP (ocean-disc alpha fades with zoom); Policy Pulse → real dual-line (Policy pillar vs all-other, from `policyPulseByPillar`).
- **`c9fb5f7`** AK/HI inset shapes made visible (no-program fill was ≈ tile bg).

### ⏭ DO NEXT
1. **Aden's notes on Analytics + Markets&Policy tabs** — he has "a ton" queued; Home-tab review loop is settled.
2. **Home-tab gut-checks** (single-value tweaks if off): aurora intensity (focused ocean alpha ~0.12), filters-collapse-on-select feel, 1.9× zoom, dark utility dropdown.
3. **MarketBrief re-enable** — still Aden's call; import + block commented in HomeTab.jsx.
4. **Net Billing sourcing** (carried from 2026-05-25) — TX/NJ/MO/OK NB; CT/HI NM-haircut; TN TVA DPP; HI/NY TOU; MN. Methodology settled; straight data-honesty execution.

### Prior recent arcs (full detail → `docs/archive/BUILD_LOG-history-2026-05-25.md`)
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
