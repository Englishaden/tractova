# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-05-26 (latest) — Lens UI feedback waves 3+4 + Net Billing CA/AZ/UT/ID sourced

**The product now.** Tractova Lens is the 5-pillar signal model (Offtake 25 · IX 25 · Incentives 20 · Site 20 · Policy 10). **The §01 gauge and §02 Analyst Brief verdict now read from ONE canonical 5-pillar composite** (no more partial-score divergence). The What-If sensitivity row + brief overlay are gone — §03 Dev Feasibility levers own sensitivity entirely, no synthesized dollars anywhere in the live Lens. **Net Billing is no longer a flat placeholder for every state**: CA / AZ / UT / ID score for real from sourced export-credit ratios; other states stay honestly gated.

**This session (commits `7fd85f2` → `2376bbc` → `2b578e1` → `7c8420f` → `3286571`; each verified: lints + 41 unit + 7/7 smoke):**
- **Wave 3 (UI feedback)** — fixed the invisible / jumpy section toggle: `useLensReveal` now recomputes opacity+transform via a ResizeObserver (was stale-on-scroll), and `CollapsibleSection` animates height via the CSS `grid-template-rows 0fr↔1fr` technique (OOM-safe; sidesteps framer `height:auto`). Removed the What-If scenario row + Analyst Brief overlay + 3 orphan files (`LensScenarioRow`, `CustomScenarioInline`, `CustomScenarioBuilder`) + `buildSensitivityScenarios`/`computeScoreDelta` — de-$'d the brief's last `$` leak (PJM precedent figures etc.). §04 offtake numbers restyled as tinted score chips with a proportional base fill-bar (best row gets an emphasis ring). Pillar cards de-captioned + grid `items-stretch` for uniform heights with aligned footers; Policy card no longer wraps.
- **Wave 4 (UI feedback follow-up + Net Billing CA)** — unified the feasibility score: Search.jsx computes one `lensSubs`/`lensScore` and feeds the gauge, the brief verdict, the §05 cards, and the pillar modal (brief and gauge can no longer disagree; gauge is now live-MW responsive). Fixed §01 Market Position re-open lag (`keepMounted` keeps the heavy panel in the DOM through collapse + trailing-debounced RO kills layout thrash). Gated `—` chip matched to score-chip box (uniform min-width). Added a Pro-form regression test (`tests/pro-smoke.spec.js`) confirming the recurring "filter reset on Net Billing / Net Metering" report is a non-bug — state always preserved (visual reflow illusion; memory note saved). Narrowed "stale Scenario Studio copy" scope after finding IRR / payback / NPV / $/W still legitimately render in the legacy saved-scenarios viewer + PDF + ProjectCard (those caveats aren't stale there) — fixed only the glossary `Scenario Studio` entry (claimed the *current* Lens has the $ tab) + dropped unverified `$1.32–1.78/W` example figures from the `p50/p90` entry.
- **Net Billing — first sourcing pass** — `NET_BILLING_EXPORT_RATIO` in `scoreEngine.js` now carries 4 sourced + WebFetch-verified states: **CA 0.23** (NEM 3.0 / NBT, CPUC ACC: ~8-9¢ vs ~30-44¢ retail), **AZ 0.50** (APS RCP ~7¢ vs ~14-15¢ retail, "roughly half"), **UT 0.49** (RMP ECR ~5-6¢ vs ~10.2¢ retail, "roughly half"), **ID 0.33** (Idaho Power net-billing ECR ~3¢ vs ~8-10¢ retail, TOU caveat — dominant non-summer-peak rate). Two-layer: ratio sourced, signal = `anchor × (0.35 + 0.65·ratio)` (disclosed editorial floor). Other states stay honestly gated on the directional baseline (45, `coverage: 'fallback'`). Unit tests guard both the sourced (CA) and gated paths. UI copy (`OfftakeCard` mechanism text, `StructureComparison` gate reason) is state-aware. **Deliberately deferred** (documented inline): NV (75% of retail but reduced *net-metering*, not avoided-cost net billing — wrong structure), HI (per-island TOU mid-transition), MS (export rate sourced but no clean MS retail).

### ⏭ DO NEXT
1. **Continue Net Billing sourcing — but answer the TOU methodology question first.** Remaining net-billing states are mostly TOU export tariffs (HI Smart DER, NY VDER value-stack, the growing list of states moving this way). A single ratio understates summer-on-peak value and overstates off-peak. **Decide:** production-weighted (weight TOU credits by an assumed solar generation shape — more rigorous, requires a generation profile assumption) or stick with the dominant-rate approximation (today's ID approach — simpler, conservative for summer-peaking solar)? That decision gates HI / NY / further sourcing. Cleanly skippable until decided.
2. **NV reduced-net-metering gap** — separate from net billing: NV's "net metering" is 75% of retail (Tier 4 / NMR-405) but the Lens currently scores Net Metering at the full retail anchor, so NV is overstated. Add a `NET_METERING_HAIRCUT[state]` (or rename to `NET_METERING_EXPORT_RATIO`) to apply per-state reductions — same two-layer pattern as net billing.
3. Still-open optional polish from prior pickup: rename internal `revenueImpact` → `signalImpact`; Terms/Privacy "Scenario Studio" legal copy (deliberately deferred per "non-legal only" call). The "§-numbers for Comparable Deals + Regulatory Watch" item is resolved — user picked "separate, unnumbered" in wave 3.
4. **Prod browser-verify** waves 3+4 + the new Net Billing sourcing: collapsible toggles smooth/no-flicker; brief verdict matches the §01 gauge; gauge now moves with the §03 MW lever (intentional); CA/AZ/UT/ID Net Billing rows in §04 show real numbers + "curated", other states still "not modeled".

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
