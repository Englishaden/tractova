# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-05-27 (latest) — Net Billing wave 2: AR / IN / LA / MI / NC sourced + TOU methodology call

**The product now.** Tractova Lens is the 5-pillar signal model (Offtake 25 · IX 25 · Incentives 20 · Site 20 · Policy 10). **Net Billing is now sourced for 9 states** (was 4): the CA/AZ/UT/ID wave-1 cohort plus **AR / IN / LA / MI / NC** sourced this session from DSIRE pastes on disk + WebFetch-verified utility tariff rates. The remaining net-billing states (HI Smart DER, NY VDER value-stack) sit on TOU export tariffs that *can't* be reduced to a single dominant rate — those stay gated by deliberate choice, not a missing TODO.

**This session (one slice; verified: full `npm run verify` — lints + citations + secrets + audit + locs + 173 unit + build + 7/7 smoke):**
- **TOU methodology call (documented inline in scoreEngine.js, above `NET_BILLING_EXPORT_RATIO`)** — chose **dominant-rate approximation** over production-weighting. Reasoning: production-weighting would require importing a solar generation shape (which lat/orientation?) on top of the export rate, breaking the two-layer pattern (ratio sourced, signal disclosed). Dominant-rate is conservative for summer-peaking solar (signal may understate real-world value when summer on-peak is materially higher); per-state override only when the utility/PUC itself publishes a production-weighted "effective" rate we can cite. Codifies what ID already did; unblocks all sourcing where the export credit is a single avoided-cost rate (even if the customer's *self-netting* happens TOU).
- **Net Billing — wave 2** (5 new sourced states; each ratio is utility-tariff-cited):
  - **AR 0.35** — non-legacy net metering (post Sep 30 2024): MISO/SPP prior-12-month LMP avg, ~4¢ vs 11.50¢ retail (EIA EPM Mar-2026 commercial). Legacy customers grandfathered at full retail through 2040 — we score the regime that applies to *new builds*.
  - **IN 0.37** — S.B. 309 EDG = 1.25 × prior-yr LMP, updated annually per IOU. 2026 5-utility avg ~5.30¢ (NIPSCO 4.97, AES 5.43, I&M 5.47, Duke IN 5.51, CenterPoint 5.56) vs 14.32¢ retail.
  - **LA 0.20** — post-2019 Entergy LA Rider DG: 2.59331¢/kWh eff. Apr 1 2025 vs 12.93¢ retail. Lowest ratio in the sourced cohort.
  - **MI 0.50** — Inflow-Outflow (all 20-550 kW DG): outflow at power-supply component of retail. DTE Rider 18 ~7.75¢ flat / CE RSP-DG off-peak ~7.89¢ (dominant) → avg ~7.8¢ vs 15.66¢ retail.
  - **NC 0.32** — post-Oct 2023 Duke NEEC ~3.4¢ avoided cost (both DEC and DEP) vs 10.63¢ retail. TOU element is internal self-netting only; export credit itself is a flat avoided-cost rate (dominant-rate applies cleanly).
- **MT explicitly noted not net billing** (inline comment below `NET_BILLING_EXPORT_RATIO`): full-retail crediting with annual surrender of unused credits — fits NET_METERING_HAIRCUT roadmap (#2 below), not the export-ratio model.
- **UI copy** — `OfftakeCard` mechanism text de-CAonly'd: now references the published basis per state ("CA NEM 3.0 ACC, AZ APS RCP, IN 1.25× LMP, NC Duke NEEC, MI Inflow-Outflow power-supply component") so it reads honest to any of the 9 sourced states. `StructureComparison` gate reason unchanged (still correct for the remaining ~41 gated states). Unit test (`scoreEngine.spec.js`) `NET_BILLING_OFFTAKE_COVERAGE` expectation updated to the 9-state list.
- **Sourcing files on disk** (kept verbatim, fetched 2026-05-26): `docs/dsire-net-billing/{AR,IN,LA,MI,MT,NC}.txt` joining the prior AZ paste. These are the audit trail for every ratio cited above (DSIRE text first, utility tariff rates cited inline in scoreEngine.js comments).

### ⏭ DO NEXT
1. **Continue Net Billing sourcing** — the dominant-rate methodology question is settled (documented above `NET_BILLING_EXPORT_RATIO`). Remaining sourceable states are those publishing a single avoided-cost rate (most states moving from NM → NB use a single rate; the genuinely TOU-only export states like HI Smart DER and NY VDER are the harder cases). Next candidates: IA (Alliant/MidAmerican), OH (AEP Ohio fuel cost), TN (TVA flat avoided cost), KY (KU/LG&E avoided cost). Pull the DSIRE pastes into `docs/dsire-net-billing/` first, then source per-state.
2. **NV reduced-net-metering gap** (#2 from prior pickup, still open) — separate from net billing: NV's "net metering" is 75% of retail (Tier 4 / NMR-405) but the Lens currently scores Net Metering at the full retail anchor, so NV is overstated. Add a `NET_METERING_HAIRCUT[state]` (or `NET_METERING_EXPORT_RATIO`) — same two-layer pattern as net billing. MT also fits this bucket (full retail with annual surrender → effective haircut from use-it-or-lose-it).
3. **HI / NY TOU export rates** — these are the cases the dominant-rate call doesn't unblock (the export rate itself is per-interval TOU). Either: (a) leave gated until a utility/PUC publishes a production-weighted effective rate, or (b) build a small TOU-weighting helper with a sourced solar shape (PVWatts-style, lat-specific) — deferred decision since (a) is currently honest.
4. Still-open optional polish from prior pickups: rename internal `revenueImpact` → `signalImpact`; Terms/Privacy "Scenario Studio" legal copy.
5. **Prod browser-verify** the 5 newly-sourced states in §04: AR/IN/LA/MI/NC Net Billing rows should now show real scores (vs the prior "—" gated chip), and the mechanism copy should reflect the broader sourced-state list ("CA NEM 3.0 ACC, AZ APS RCP, IN 1.25× LMP, NC Duke NEEC, MI Inflow-Outflow power-supply component").

### Prior recent arcs (full detail → `docs/archive/BUILD_LOG-history-2026-05-25.md`)
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
