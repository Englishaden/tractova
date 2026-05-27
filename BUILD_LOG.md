# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-05-27 (latest) — NB waves 2-4 (12 states) + Geist sans + NV NM haircut wired

**The product now.** Tractova Lens is the 5-pillar signal model (Offtake 25 · IX 25 · Incentives 20 · Site 20 · Policy 10). **Net Billing sourced for 12 states**: CA/AZ/UT/ID wave-1 → +AR/IN/LA/MI/NC wave-2 → +OH/KY wave-3 → +SC wave-4. **Net Metering NV-haircut now wired** (NV Tier 4 0.75 of retail) — fixes a known overstatement where NV had been scoring at the full-retail NM anchor. HI Smart DER + NY VDER stay deliberately gated (per-interval TOU); MT/IA/VA explicitly NOT in the NM-haircut map (their haircuts are conditional / year-end-only / opt-in — not appropriate for state-level signal); MN deferred (hybrid + opaque tariff PDFs).

**Also this session: brand-typography fix.** `index.html` was loading Inter from Google Fonts but `src/index.css` was setting `html { font-family: system-ui... }`, silently overriding the load — so the site rendered SF Pro on Mac / Segoe UI on Windows / Roboto on Android, *and* was downloading ~100KB of Inter that never displayed. Source Serif 4 was also dead bytes (the PDF report uses @react-pdf/renderer's built-in Times-Roman, not Source Serif 4). Now: **Geist** (Vercel, variable 100-900, open-source) is the primary UI sans — chosen for the renewable-energy market-intelligence brand (Linear / Vercel visual neighborhood: geometric, technical, modern; pairs with the existing JetBrains Mono for §-markers + gauge readouts). system-ui chain kept as fallback.

**This session (three slices, all verified: full `npm run verify` — lints + citations + secrets + audit + locs + 173 unit + build + 7/7 smoke):**
- **Wave 2 — AR/IN/LA/MI/NC** (commit `518a281`) + **TOU methodology call** (chose **dominant-rate approximation** over production-weighting — production-weighting would require importing a solar generation shape on top of the export rate, breaking the two-layer pattern; dominant-rate is conservative for summer-peaking solar; per-state override only when the utility/PUC itself publishes a production-weighted "effective" rate).
  - AR 0.35 · IN 0.37 · LA 0.20 · MI 0.50 · NC 0.32 (each cited inline in `scoreEngine.js`; full detail in commit message).
- **Geist font switch** (commit `027f489`) — Inter loaded-but-unused bug fixed (system-ui chain was overriding it); Source Serif 4 dropped (was also dead bytes — PDF uses Times-Roman). Geist now renders consistently across every OS instead of SF Pro / Segoe UI / Roboto per-OS divergence.
- **Wave 3 — OH/KY** (commit `6afd1e5`):
  - **OH 0.78** — net-metering structure but credit basis is the energy-only component of the Standard Service Offer (unbundled generation). AEP Ohio Generation Energy Rider (GENE) 11.0¢/kWh as of 2025 vs 14.03¢ retail → 0.78. **Highest ratio in the cohort.**
  - **KY 0.54** — S.B. 100 (2019) → NMS-2 for post-Sep 24 2021 customers. KPSC 2021 order: LG&E 6.9¢ + KU 7.4¢ avg 7.15¢ vs 13.20¢ retail → 0.54.
- **Wave 4 — SC + deferral docs** (this commit):
  - **SC 0.24** — Solar Choice Permanent Tariffs (post Jan 1 2022), PSC Orders 2021-390/391. DSIRE-cited 2023 NEEC rates: Duke Carolinas 2.70¢, Duke Progress 2.30¢, Dominion SC 3.36¢ → 3-IOU avg 2.79¢ vs 11.70¢ retail (EIA EPM Mar-2026) → 0.24. Like NC, TOU self-netting + flat avoided-cost export (dominant-rate applies cleanly). Pre-2022 customers grandfathered on prior NM tariff through 2025-2029.
  - **VA explicitly NOT NB** (inline comment): SCC's 2025 Appalachian Power NMS II order RETAINED monthly netting; full-retail crediting with opt-in year-end avoided-cost cash-out. Stays on NM full-retail anchor.
  - **MN explicitly DEFERRED** (inline comment): hybrid NM/NB tiered by system size (<40 kW = NM; 40 kW–1 MW = avoided-cost default with opt-in kWh-credit alternative). Treating as pure NB would overstate the haircut for self-consumption-sized projects; Xcel Rider QF1 avoided-cost rate not WebFetch-accessible. Revisit with direct tariff source or a separate hybrid-tier treatment.
- **Geist sans live** (commit `027f489`): Inter loaded-but-unused bug fixed; Source Serif 4 dead bytes dropped. Geist now renders consistently across every OS instead of per-OS divergence.
- **Sourcing files on disk** (audit trail, 12 files): `docs/dsire-net-billing/{AR,AZ,IN,KY,LA,MI,MN,MT,NC,OH,SC,VA}.txt`.
- **NM-haircut wave 1 — NV** (this commit): new `NET_METERING_EXPORT_RATIO` map mirrors `NET_BILLING_EXPORT_RATIO` pattern. NV NMR-405 Tier 4: 0.75 of retail (verified Solar United Neighbors NV resource + NV Energy NMR-405 schedule eff. 2025-11-15). Wired into the Net Metering branch with same two-layer formula as NB (`anchor × (0.35 + 0.65·ratio)`). At ratio=1.0 the formula degenerates to anchor exactly, so unsourced NM states are unaffected (no regression — verified by unit test). MT/IA/VA explicitly documented as NOT in the map: their haircuts are conditional (only bite oversized projects: MT use-it-or-lose-it surrender, IA year-end residual cash-out) or opt-in (VA customer chooses indefinite roll-forward vs avoided-cost cash-out) — state-level signal stays at NM full-retail anchor; per-project sizing belongs to §03 Dev Feasibility, not §04 monetization signal. 2 new unit tests (43 total) guard the NV haircut + the no-regression unsourced-NM path.

### ⏭ DO NEXT
1. **Continue Net Billing sourcing** — methodology + workflow settled. Next candidates with non-TOU, single-rate avoided-cost structures: **TX** (per-REP variants — Green Mountain Renewable Rewards / TXU Free Nights — tricky because TX is unbundled and per-REP), **NJ** (post-2024 SuSI program changes), **MO** (Ameren MO + Evergy MO), **OK** (OG&E + PSO). HI Smart DER + NY VDER stay gated (per-interval TOU). MN deferred (hybrid + opaque tariff PDFs).
2. **NM-haircut wave 1 SHIPPED** (NV 0.75 wired) — for additional NM-haircut candidates: HI Smart Export (per-island TOU, gated; ~24-28¢ off-peak credit vs ~33¢ retail at HECO), NM (regular NM full retail), CT (full retail with annual cash-out at 80% of retail residential, similar small-haircut pattern to IA). Any state where the NM tariff caps credit below retail per kWh exported (not just at year-end) belongs in the map.
3. **TN special case** — no retail net metering. TVA DPP avoided cost (~2¢) flows through LPCs. Separate from NB and NM-haircut; needs its own scope conversation.
4. **HI / NY TOU export rates** — deferred. Either (a) leave gated until utility publishes a production-weighted "effective" rate, or (b) build a small TOU-weighting helper with a sourced solar shape. Option (a) is currently honest.
5. **MN revisit** — hybrid NM/NB tier deserves its own structural treatment OR I find a direct source for Xcel Rider QF1 avoided cost (likely needs PDF parsing of Xcel's MN tariff book).
6. Still-open optional polish: rename internal `revenueImpact` → `signalImpact`; Terms/Privacy "Scenario Studio" legal copy.
7. **Prod browser-verify** Geist + the 8 newly-sourced NB states (waves 2-4: AR/IN/LA/MI/NC/OH/KY/SC). SC 0.24 is bottom-cohort honest; OH 0.78 is top-cohort favorable.

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
