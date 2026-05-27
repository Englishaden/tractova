# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-05-27 (latest) — Net Billing wave 3 (OH/KY) + brand: Geist sans live

**The product now.** Tractova Lens is the 5-pillar signal model (Offtake 25 · IX 25 · Incentives 20 · Site 20 · Policy 10). **Net Billing is now sourced for 11 states** (was 9, was 4 at start of day): CA/AZ/UT/ID wave-1 → +AR/IN/LA/MI/NC wave-2 (this morning) → **+OH/KY wave-3** (this afternoon). HI Smart DER + NY VDER value-stack remain deliberately gated (per-interval TOU export rates can't be reduced to a single dominant ratio); IA + MT + NV pulled into the separate NET_METERING_HAIRCUT roadmap bucket.

**Also this session: brand-typography fix.** `index.html` was loading Inter from Google Fonts but `src/index.css` was setting `html { font-family: system-ui... }`, silently overriding the load — so the site rendered SF Pro on Mac / Segoe UI on Windows / Roboto on Android, *and* was downloading ~100KB of Inter that never displayed. Source Serif 4 was also dead bytes (the PDF report uses @react-pdf/renderer's built-in Times-Roman, not Source Serif 4). Now: **Geist** (Vercel, variable 100-900, open-source) is the primary UI sans — chosen for the renewable-energy market-intelligence brand (Linear / Vercel visual neighborhood: geometric, technical, modern; pairs with the existing JetBrains Mono for §-markers + gauge readouts). system-ui chain kept as fallback.

**This session (three slices, all verified: full `npm run verify` — lints + citations + secrets + audit + locs + 173 unit + build + 7/7 smoke):**
- **Wave 2 — AR/IN/LA/MI/NC** (commit `518a281`) + **TOU methodology call** (chose **dominant-rate approximation** over production-weighting — production-weighting would require importing a solar generation shape on top of the export rate, breaking the two-layer pattern; dominant-rate is conservative for summer-peaking solar; per-state override only when the utility/PUC itself publishes a production-weighted "effective" rate).
  - AR 0.35 · IN 0.37 · LA 0.20 · MI 0.50 · NC 0.32 (each cited inline in `scoreEngine.js`; full detail in commit message).
- **Geist font switch** (commit `027f489`) — Inter loaded-but-unused bug fixed (system-ui chain was overriding it); Source Serif 4 dropped (was also dead bytes — PDF uses Times-Roman). Geist now renders consistently across every OS instead of SF Pro / Segoe UI / Roboto per-OS divergence.
- **Wave 3 — OH/KY** (this commit):
  - **OH 0.78** — net-metering structure but credit basis is the energy-only component of the Standard Service Offer (unbundled generation, below bundled retail). AEP Ohio Generation Energy Rider (GENE) 11.0¢/kWh as of 2025 — dominant IOU. 11.0¢ vs 14.03¢ retail (EIA EPM Mar-2026 commercial) → 0.78. **Highest ratio in the cohort** — reflects OH's competitive-retail market structure where generation is a substantial share of the bundled rate even when unbundled at the GENE.
  - **KY 0.54** — S.B. 100 (2019) moved IOUs from net metering to net billing (NMS-2 for customers post-Sep 24 2021). KPSC 2021 order: LG&E 6.9¢ + KU 7.4¢ as export credit, distinct from full retail; KPSC rejected utilities' proposed 2.3¢ floor. LG&E + KU split ~all KY IOU load — avg 7.15¢ vs 13.20¢ retail → 0.54. Pre-2021 customers and electric cooperatives stay on full-retail NM (not in scope for NB list).
- **UI copy** unchanged this slice — the wave-2 mechanism-text refresh already spans 5 distinct structures (CA ACC, AZ RCP, IN 1.25× LMP, NC Duke NEEC, MI Inflow-Outflow). Adding OH GENE + KY NMS-2 examples would bloat the chip.
- **Sourcing files on disk** (audit trail): `docs/dsire-net-billing/{AR,AZ,IN,KY,LA,MI,MT,NC,OH}.txt` (9 files — KY fetched 2026-05-27, OH fetched 2026-05-27, the rest 2026-05-26).

### ⏭ DO NEXT
1. **Continue Net Billing sourcing** — methodology + workflow now both settled (dominant-rate; Aden pastes DSIRE → I source rate from utility tariffs). Next candidates after OH/KY: VA (Dominion Rider NEM-Q export rate vs retail), SC (Duke / Dominion Energy SC equivalent of NC NEEC), MN (Xcel Energy Net Metering tariff with avoided-cost cash-out), TX (depends on REP — Green Mountain Renewable Rewards / TXU Free Nights variants — most ERCOT REPs offer net-billing-style products; tricky because Texas is unbundled per REP). HI Smart DER + NY VDER stay gated (per-interval TOU; deferred per dominant-rate scope).
2. **NET_METERING_HAIRCUT bucket** (#2 in prior pickup, still open) — applies to states where the Lens currently anchors Net Metering at full retail but the actual structure is reduced: **NV** (75% of retail Tier 4 / NMR-405), **MT** (full retail with annual surrender of unused credits — use-it-or-lose-it), **IA** (within-year credits at full retail, annual cash-out at avoided cost — partial haircut). Add a `NET_METERING_HAIRCUT[state]` map (or rename to `NET_METERING_EXPORT_RATIO` to mirror the NB pattern) — same two-layer signal formula.
3. **TN special case** — no retail net metering at all. TVA DPP avoided cost (~2¢ vs ~12¢ retail) flows through to LPCs. Structurally separate from both NB and the NM-haircut bucket; needs its own scope conversation before sourcing.
4. **HI / NY TOU export rates** — deferred. Either (a) leave gated until utility/PUC publishes a production-weighted "effective" rate we can cite, or (b) build a small TOU-weighting helper with a sourced solar shape (PVWatts-style, lat-specific). Option (a) is currently honest, so deferred is fine.
5. Still-open optional polish: rename internal `revenueImpact` → `signalImpact`; Terms/Privacy "Scenario Studio" legal copy.
6. **Prod browser-verify** Geist + the 7 newly-sourced NB states (waves 2 + 3): font should read consistently across every OS (no more SF Pro/Segoe UI split); §04 should show real scores for AR/IN/LA/MI/NC/OH/KY (the prior "—" gated chip moves off those rows). OH 0.78 is the highest ratio in the cohort — flag if the §04 score looks too close to net-metering levels (it should — OH genuinely is a favorable NB regime).

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
