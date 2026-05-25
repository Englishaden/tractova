# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-05-25 (latest) — 5-pillar signal pivot COMPLETE + prod-review feedback shipped

**The product now.** Tractova Lens is a **5-pillar signal-based go/no-go** — **Offtake 25 · Interconnection 25 · Incentives 20 · Site 20 · Policy & Timing 10**, all 0-100 signals, **zero synthesized dollars**. The old synthesized-$ layer (revenue / payback / IRR / NPV / $-per-watt, Scenario Studio) is removed. Saved scenarios are frozen as a legacy viewer.

**This session (commits `be75672` → `d0b1f06` → `2a94ac5` → `770ce47`; each verified: build + 172 unit + 7/7 smoke):**
- **Phase 1** — promoted **Incentives** (ITC adder eligibility from real EPA Energy-Community / Census-CDFI §48(e) / HUD county data) + **Policy & Timing** (`federalTimeline.js` OBBBA §48E/§45Y rules engine keyed to stage+COD, blended with state policy severity×probability) into the composite. §04 → 5 pillar cards. AI-proposed `impact_severity`/`impact_probability` in policy-classify.
- **Phase 2** — deleted `revenueEngine` + $ components; **ScenarioStudio → DevFeasibilityView promoted to §03**; StructureComparison re-oriented to rank by the offtake signal; `scenarioEngine` slimmed to 2 non-$ helpers; policyAdjustments gutted of $-deltas. DB tables (`revenue_rates`, `scenario_snapshots`) left intact, just unread.
- **Prod-review feedback (3 waves)** — de-$'d the **AI Analyst Brief** (was leaking −bps IRR / $-per-MW from `system.js` rules + `buildContext` policy fields → now severity/timing framing, enacted-law facts only); §04 **Incentives + Policy & Timing now open detail-modal tabs**; **Dev Feasibility what-if levers** (ITC-adder / COD / IX / subscription all flow into the verdict); removed the editorial Timeline Gantt; **collapsible Lens sections** (default collapsed, §01 open, fade-open); pillar-bar tooltips; IX dropdown clip fix.

### ⏭ DO NEXT
1. **Prod browser-verify** the 5-pillar Lens: collapsed-by-default sections + fade; all five §04 cards open their modal tab; the ITC-adder lever moves the Incentives pillar + verdict; AI brief reads with **no synthesized $**; IX dropdown no longer clips.
2. **Net Billing** — deferred DATA arc (no fabrication): needs real per-state export-credit basis (start CA NEM 3.0 ACC; sourcing is per-state PUC since DSIRE went paid). Honestly gated until sourced.
3. Optional polish: §-numbers for the now-unnumbered Comparable Deals + Regulatory Watch collapsibles; rename internal `revenueImpact` → `signalImpact`; trim stale "Scenario Studio" copy in Terms/Privacy/glossary.

### Prior recent arcs (full detail → `docs/archive/BUILD_LOG-history-2026-05-25.md`)
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
