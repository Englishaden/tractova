# Tractova Data-Trust Audit

Generated: **2026-05-04**  ·  Run from `scripts/data-trust-audit.mjs`

---

## Summary

| Tier | Description | Audit entries | Total fields covered |
|---|---|---|---|
| **A** | Anchored on primary data with verified citation. Just needs refresh when source updates. | 13 | 110 |
| **B** | Regional analog or partially-anchored, with documented choice. Defensible but contains synthesis. | 9 | 114 |
| **C** | Editorial / synthesis without primary citation. **REVIEW PRIORITY** — same risk pattern as the Lazard issue Aden caught 2026-05-04. | 9 | 53 |
| **Mixed** | Audit entry covers fields at multiple tiers (e.g., per-state values where some are A and some are B). | 2 | 34 |
| **Total** | | 33 | 311 |

**Risk distribution:** 0 high-risk · 16 medium-risk · 17 low-risk.

---

## Tier C — Editorial / unanchored (REVIEW PRIORITY)

These constants are pure Tractova synthesis without a primary-source anchor. Same pattern as the Lazard issue caught 2026-05-04. Listed in priority order (highest risk first).

| Field | File:Line | Risk | Source / Vintage | Notes |
|---|---|---|---|---|
| **CI_REVENUE_DATA — ppaRateCentsKwh (C&I PPA rate per state)** _(17 values)_ | `src/lib/revenueEngine.js:191` | medium | EIA Form 861 cited + Tractova editorial state allocation<br>**Vintage:** 2025-06 | EIA Form 861 covers retail rates (state-level). PPA rates are typically a discount to retail (developer-quoted). Tractova picks ~50-60% of retail as PPA — synthesis. Best refresh path: LevelTen PPA Price Index (paywalled), or DOE/PPA Watch. |
| **STAGE_MODIFIERS — score adjustments per project stage (offtake/ix/site triple)** _(7 values)_ | `src/lib/scoreEngine.js:1` | medium | Tractova editorial — captures de-risking by project stage<br>**Vintage:** unknown (likely original product design) | Magnitudes (e.g., NTP +25 site) are not anchored to any primary source. Refresh path: industry survey of CS developers on stage-by-stage de-risking expectations, or anchor against published CS project IRR sensitivity studies. |
| **computeFeasibilityScore csStatus base values (active=65, limited=40, pending=18, none=5)** _(4 values)_ | `src/lib/scoreEngine.js:37` | medium | Tractova editorial<br>**Vintage:** unknown | Used in dashboard + email digest score computation. Same magnitude as offtake CS base in computeSubScores (active=80) — duplicated/inconsistent? Worth audit. |
| **computeSubScores CS base values (active=80, limited=52, pending=25, none=8)** _(4 values)_ | `src/lib/scoreEngine.js:202` | medium | Tractova editorial<br>**Vintage:** unknown | Different magnitudes than computeFeasibilityScore (active=65 vs 80). Why two formulas? Possible legacy. |
| **computeSubScores LMI penalty thresholds (-14, -7, -3 for ≥40%, ≥25%, ≥10%)** _(3 values)_ | `src/lib/scoreEngine.js:205` | medium | Tractova editorial — captures subscriber-acquisition friction at higher LMI requirements<br>**Vintage:** unknown | Magnitudes are editorial. LBNL CS Trends report does discuss LMI subscriber acquisition cost premium ($0.04/Wdc per NREL Q1 2023) but the SCORE penalty doesn't directly map. |
| **computeSubScores IX score brackets (easy=88, moderate=65, hard=38, very_hard=14)** _(4 values)_ | `src/lib/scoreEngine.js:211` | medium | Tractova editorial — qualitative IX difficulty mapping<br>**Vintage:** unknown | These map qualitative ix_difficulty enum to numeric scores. The enum itself (per state) is curated from ISO/RTO data sources. Brackets are editorial. |
| **computeSiteSubScore values (82/56/42/26 + partial-input midpoints)** _(9 values)_ | `src/lib/scoreEngine.js:131` | medium | Tractova editorial — maps land/wetland boolean × tech to numeric<br>**Vintage:** unknown | The thresholds for "available land" (>=25% prime farmland) and "wetland warning" (>=15% NWI) ARE calibrated. The site sub-score numeric values (82/56/etc.) are editorial. |
| **computeSubScores capacity bonus (>1000 MW: +12, >500: +8, >100: +4, >0: +2)** _(4 values)_ | `src/lib/scoreEngine.js:43` | low | Tractova editorial — rewards programs with more headroom<br>**Vintage:** unknown | Used only in dashboard quick-feasibility-score formula. Editorial. |
| **send-alerts opportunity_score drop threshold (>10 pts to fire alert)** | `api/send-alerts.js:65` | low | Tractova editorial<br>**Vintage:** unknown | Email alert threshold. Editorial choice — fires alert if state score drops more than 10 pts. Could be A/B tested. |

## Tier B — Regional analog / partially-anchored

Have some primary citation but contain Tractova synthesis layer (e.g., regional analog or qualitative adjustment).

| Field | File:Line | Risk | Source / Vintage | Notes |
|---|---|---|---|---|
| **BESS_REVENUE_DATA — installedCostPerKwh (BESS $/kWh per state)** _(17 values)_ | `src/lib/revenueEngine.js:213` | medium | BloombergNEF 2024 utility-scale 4hr ($295-$340/kWh) + Tractova state allocation<br>**Vintage:** 2026-04 | National anchor cited (BNEF). State allocation is editorial. Lazard v18 LCOS chapter (page 17+) covers storage; could add as cross-check. |
| **BESS_REVENUE_DATA — capacityPerKwYear (BESS capacity payment $/kW-yr per state)** _(17 values)_ | `src/lib/revenueEngine.js:213` | medium | 2024-2025 ISO clearing × 4-hr BESS accreditation factor + Tractova state-within-LDA + 2026 forward (PJM RPM 2025/26 BRA $98.5/kW-yr × 60%; NYISO ICAP $30-50 × 50-60%; ISO-NE FCM 2025/26 $80-90 × 60%; CAISO RA $40-80 × 70%; MISO PRA $50 × 70%; HECO bilateral=0)<br>**Vintage:** 2026-05-04 (re-anchored migration 046) | Migration 046 applied. ISO-NE/NY/CA values dropped 25-30% to reflect realistic accreditation. PJM stays roughly same. Refresh annually as new ISO auctions clear. Accreditation factor + state-within-LDA still Tractova synthesis. |
| **BESS_REVENUE_DATA — demandChargePerKwMonth + arbitragePerMwh** _(17 values)_ | `src/lib/revenueEngine.js:213` | medium | Demand: NREL TP-7A40-71162 (Identifying Potential Markets for Behind-the-Meter Battery Storage) regional ranges + tracked state PUC tariff filings. Arbitrage: Lazard v18 LCOS Storage Value Snapshot (CAISO/ERCOT) + ISO LMP histogram regional buckets.<br>**Vintage:** 2026-05-04 (re-anchored migration 047 with documented regional methodology) | Migration 047 applied + comprehensive comment block in revenueEngine.js documenting regional buckets. Single state value approximates the dominant 1-3 utility tariffs serving large commercial; intra-state variation can be ±20%. Tractova synthesis layers: state-within-region allocation + 2026 forward. Refresh path: pull commercial demand schedules from each state PUC tariff database + ISO LMP quarterly spread analysis. |
| **CI_OFFTAKE_SCORES — C&I offtake score per state (0-100)** _(32 values)_ | `src/lib/scoreEngine.js:20` | medium | EIA Form 861 commercial retail rates 2024 + qualitative market-depth adjustments<br>**Vintage:** 2026-05-01 | Calibration documented inline per state. EIA Form 861 is real but the qualitative adjustments are Tractova editorial. Score values should be auditable against published retail rates. |
| **BESS_OFFTAKE_SCORES — BESS offtake score per state (0-100)** _(25 values)_ | `src/lib/scoreEngine.js:45` | medium | ISO/RTO 2024-2025 capacity-market clearing prices + state storage carve-outs + IRP procurement plans<br>**Vintage:** 2026-05-01 | Sources cited inline. State allocation is editorial but documented per state in comments. Refresh annually as new ISO auctions clear. |
| **BASELINE_INPUTS opexPerKwYear ($20/kW/yr CS solar O&M)** | `src/lib/scenarioEngine.js:38` | medium | Wood Mac H2 2025 utility-scale solar O&M $15-25/kW/yr (single national number, no state allocation)<br>**Vintage:** 2025-H2 | NREL Q1 2023 reports CS-specific O&M is $39.83/kWdc/yr (significantly higher than utility-scale). Tractova uses $20/kW/yr — possibly understated for CS. Worth re-anchoring. |
| **computeDisplayScore composite weights (offtake 0.40, ix 0.35, site 0.25)** _(3 values)_ | `src/lib/scoreEngine.js:269` | low | Tractova editorial product methodology (no primary-data anchor for pillar weights). Disclosed via WEIGHT_SCENARIOS export + computeDisplayScoreRange exposing default/revenue-tilt/IX-tilt/permit-tilt schemes; Lens UI surfaces "weight sensitivity X-Y" tooltip when spread > 4 pts.<br>**Vintage:** 2026-05-04 (transparent disclosure shipped) | Audit migration changed approach: instead of trying to "find a primary source" (none exists for pillar weighting), made the editorial choice transparent + added user-facing sensitivity tool. Lens shows "Score 73 (weight sensitivity 67-78)" — user can see if verdict is robust to methodology. If/when developer-survey or empirical IRR-vs-pillar data becomes available, replace WEIGHT_SCENARIOS defaults. |
| **BASELINE_INPUTS discountRate (8%)** | `src/lib/scenarioEngine.js:154` | low | Industry standard for CS / DG project finance (Wood Mac, Lazard LCOE)<br>**Vintage:** unknown | User-adjustable in Scenario Studio. Default of 8% is reasonable industry midpoint. |
| **BASELINE_INPUTS programAllocationPct (1.0 = 100% subscriber utilization)** | `src/lib/scenarioEngine.js:297` | low | Tractova default — 100% allocation; user adjusts in Scenario Studio<br>**Vintage:** unknown | Default is editorial but user-controllable. Documented in glossary. |

## Tier A — Data-anchored (low risk)

Anchored on primary data with verified citation. Refresh when source updates.

| Field | File:Line | Risk | Source / Vintage | Notes |
|---|---|---|---|---|
| **CI_REVENUE_DATA — retailRateCentsKwh (commercial retail rate per state)** _(17 values)_ | `src/lib/revenueEngine.js:191` | medium | EIA Form 861 commercial sector retail rates 2024<br>**Vintage:** 2025-06 | EIA Form 861 is the right primary source. Should refresh annually when EIA releases new data (typically Oct). |
| **STATE_REVENUE_DATA — billCreditCentsKwh per state** _(17 values)_ | `src/lib/revenueEngine.js:163` | medium | State PUC tariff filings tracked via DSIRE<br>**Vintage:** 2025-06 | Bill credits change quarterly when utility tariffs reset. Tractova value is a 2025-Q2 snapshot. Stale risk if tariffs have moved. Refresh: re-run DSIRE / state PUC tariff filings annually. |
| **STATE_REVENUE_DATA — recPerMwh per state** _(17 values)_ | `src/lib/revenueEngine.js:163` | medium | DSIRE + GATS / NEPOOL GIS / PJM-EIS / WREGIS / M-RETS<br>**Vintage:** 2025-06 | REC prices are market-driven and move daily. Tractova value is a 2025-Q2 snapshot. NJ SREC-II in particular swings 30-50% YoY. Refresh path: GATS public data feeds (annual minimum, ideally quarterly). |
| **STATE_REVENUE_DATA — capacityFactorPct per state** _(17 values)_ | `src/lib/revenueEngine.js:163` | low | NREL PVWatts API v8 state averages (refreshed quarterly via cron)<br>**Vintage:** live (refresh-capacity-factors.js cron) | Already automated via /api/refresh-capacity-factors quarterly cron. Best example of how other rate fields should be wired. |
| **IX live-blend score adjustments (avg_study_months thresholds + MW thresholds)** _(8 values)_ | `src/lib/scoreEngine.js:78` | low | Calibrated 2026-04-30 from actual ix_queue_data row distribution (probe: scripts/probe-ix-queue.mjs)<br>**Vintage:** 2026-04-30 | Best example of data-anchored thresholds in the codebase. Recalibrate annually as queue data evolves. |
| **BASELINE_INPUTS contractYears (25 solar / 15 BESS)** _(2 values)_ | `src/lib/scenarioEngine.js:222` | low | Industry standard project life — 25 yr solar (REC contract or PPA term), 15 yr BESS (battery degradation cap)<br>**Vintage:** consensus | Documented in glossary. |
| **BASELINE_INPUTS degradationPct (0.5%/yr solar)** | `src/lib/revenueEngine.js (in STATE_REVENUE_DATA):163` | low | Industry consensus for utility-scale silicon PV (NREL TTS reports)<br>**Vintage:** consensus | Same value used across all 17 states. Standard. |
| **BASELINE_INPUTS roundTripEfficiency (0.87 BESS)** | `src/lib/revenueEngine.js (in BESS_REVENUE_DATA):213` | low | Industry consensus for Li-ion 4hr utility-scale BESS (BNEF, Wood Mac)<br>**Vintage:** consensus | Same across all 17 states. Standard. |
| **BASELINE_INPUTS annualDegradationPct (2.5% BESS)** | `src/lib/revenueEngine.js (in BESS_REVENUE_DATA):213` | low | Industry consensus for Li-ion BESS (BNEF reports 2.5%)<br>**Vintage:** consensus | Sensitivity scenario "BESS_DEGRADE" tests 3% as alternative. |
| **SCENARIO_PRESETS multipliers (best/worst case for capex, IX, CF, REC, allocation)** _(10 values)_ | `src/lib/scenarioEngine.js:85` | low | NREL ATB 2024 P10/P90 + top-quartile siting CF + historical 12mo REC band + network-upgrade shock IX (recalibrated Session 3, citations in SCENARIO_PRESET_METHODOLOGY constant)<br>**Vintage:** 2026-05-03 | Best example of well-cited synthesis in the codebase. Each multiplier has a public-source anchor. |
| **NWI wetland warning threshold (>=15% county coverage)** | `src/lib/scoreEngine.js:233` | low | Calibrated 2026-05-01 from scripts/probe-geospatial.mjs against actual NWI distribution<br>**Vintage:** 2026-05-01 | Threshold cited inline. Wetland coverage > 15% of county AREALAND triggers Section 404 permitting flag. Supports actual permitting reality. |
| **SSURGO prime farmland threshold (>=25% county coverage)** | `src/lib/scoreEngine.js:234` | low | Calibrated 2026-05-01 from scripts/probe-geospatial.mjs<br>**Vintage:** 2026-05-01 | Threshold for FPPA conversion-review trigger. Supports actual NRCS rule. |
| **ITC base rate (30%) + adders (+10% energy community, +10% LIC) per state** _(17 values)_ | `src/lib/revenueEngine.js (itcPct + itcAdderPct):163` | low | IRS §48 federal tax code (IRA 2022)<br>**Vintage:** IRA 2022 | Federal tax law. Refresh only when Congress changes ITC structure (BBB, IRA repeal scenarios). |

## Mixed (some Tier A, some Tier B within same audit entry)

| Field | File:Line | Risk | Source / Vintage | Notes |
|---|---|---|---|---|
| **STATE_REVENUE_DATA — installedCostPerWatt (CS PV-only $/W per state)** _(17 values)_ | `src/lib/revenueEngine.js:163` | low | NREL Q1 2023 CS MMP $1.76 anchor + LBNL TTS 2024 state ratios (NY/MA/CA n≥40) + Tractova 2023→2026 forward (NREL +22% YoY + FEOC + reshoring + oil)<br>**Vintage:** 2026-05-04 | Migration 044 applied. Tier A: NY/MA/CA. Tier B: 14 regional analogs. |
| **CI_REVENUE_DATA — installedCostPerWatt (C&I commercial $/W per state)** _(17 values)_ | `src/lib/revenueEngine.js:191` | low | NREL Q1 2023 CS MMP $1.76 - $0.05 C&I premium offset = $1.71 anchor + LBNL TTS 2024 state ratios + Tractova 2023→2026 forward<br>**Vintage:** 2026-05-04 (re-anchored migration 045) | Migration 045 applied. Same Tier A/B pattern as CS. Tier A: NY/MA/CA. Tier B: 14 regional analogs. Slight $0.05 discount vs CS to reflect C&I has no subscriber acquisition + LMI compliance overhead. |

---

## Recommended next-action priorities

Based on this audit, the most leverage from re-anchoring effort is in:

1. **CI_REVENUE_DATA installedCostPerWatt** — same Tier-C synthesis problem CS just fixed. Re-anchor using same NREL/LBNL methodology applied to commercial scale. Highest replicate-mistake risk.
2. **BESS demand charges + arbitrage spreads** — seeded synthesis with no per-state primary citation. These swing fast (ISO clearing prices) so values may be very stale.
3. **computeDisplayScore composite weights (0.40 / 0.35 / 0.25)** — these three numbers determine the headline Feasibility Index that drives every score in the product. Currently editorial. Could be sensitivity-tested or anchored.
4. **STAGE_MODIFIERS magnitudes** — captures how much project stage de-risks the score. Editorial. Could be anchored against industry survey or published CS IRR sensitivity studies.
5. **BESS capacity payments per state** — ISO clearing prices move 2-9× YoY. The 2026-04 vintage may already be stale.

## Patterns to apply codebase-wide

Lessons from the CS recalibration that should propagate:

- **Two-layer citations**: separate "what the source publishes" from "what Tractova synthesizes on top." See revenueEngine.js header for the model.
- **Tier A/B/C disclosure** per data point in code comments + UI methodology dropdowns.
- **Self-audit checks** before shipping recalibrations — re-derive values from raw data programmatically rather than hand-typing.
- **Refresh path** documented for every Tier-A/B field: which primary source, which cron, which annual cadence.

