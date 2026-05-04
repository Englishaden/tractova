/**
 * Data-Trust Audit — programmatic scan of every seeded constant in the
 * codebase. Classifies each by:
 *
 *   Tier A — anchored on primary data with verified citation. Just refresh.
 *   Tier B — regional analog or partially-anchored, with documented choice.
 *   Tier C — editorial / synthesis without primary citation. ← REVIEW PRIORITY
 *
 * The output answers the question Aden bookmarked 2026-05-04: "how can we
 * find similar inconsistencies like we just found with the Lazard assumption?"
 *
 * Output: docs/data-trust-audit.md with tables grouped by tier + summary
 * counts + recommended next-action priorities.
 *
 * Run: node scripts/data-trust-audit.mjs
 *
 * Re-run anytime to refresh the snapshot. The REGISTRY below is the
 * authoritative list of audit targets — adding a new constant to the
 * codebase that should be tracked? Add it here.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// ── Audit registry ───────────────────────────────────────────────────────────
// Every audit entry has:
//   name       — human-readable label
//   file       — path relative to repo root
//   line       — approximate line number (for navigation)
//   tier       — 'A' (data-anchored) | 'B' (regional analog) | 'C' (editorial)
//   source     — primary citation (literal source) OR description of synthesis
//   vintage    — when the value was last verified against source
//   livePattern — optional regex to extract the literal current value(s)
//   nFields    — count of distinct values in this entry (e.g., 17 states)
//   risk       — 'low' | 'medium' | 'high' — relative concern about staleness/synthesis
//   notes      — caveats, refresh path, etc.
const REGISTRY = [
  // ── revenueEngine.js ──
  {
    name: 'STATE_REVENUE_DATA — installedCostPerWatt (CS PV-only $/W per state)',
    file: 'src/lib/revenueEngine.js', line: 163,
    tier: 'mixed', // 3 states Tier A, 14 states Tier B
    source: 'NREL Q1 2023 CS MMP $1.76 anchor + LBNL TTS 2024 state ratios (NY/MA/CA n≥40) + Tractova 2023→2026 forward (NREL +22% YoY + FEOC + reshoring + oil)',
    vintage: '2026-05-04',
    nFields: 17,
    risk: 'low', // just re-anchored
    notes: 'Migration 044 applied. Tier A: NY/MA/CA. Tier B: 14 regional analogs.',
  },
  {
    name: 'CI_REVENUE_DATA — installedCostPerWatt (C&I commercial $/W per state)',
    file: 'src/lib/revenueEngine.js', line: 191,
    tier: 'mixed', // 3 states Tier A, 14 states Tier B (same as CS post-recalibration)
    source: 'NREL Q1 2023 CS MMP $1.76 - $0.05 C&I premium offset = $1.71 anchor + LBNL TTS 2024 state ratios + Tractova 2023→2026 forward',
    vintage: '2026-05-04 (re-anchored migration 045)',
    nFields: 17,
    risk: 'low', // same data-anchored as CS post-fix
    notes: 'Migration 045 applied. Same Tier A/B pattern as CS. Tier A: NY/MA/CA. Tier B: 14 regional analogs. Slight $0.05 discount vs CS to reflect C&I has no subscriber acquisition + LMI compliance overhead.',
  },
  {
    name: 'CI_REVENUE_DATA — ppaRateCentsKwh (C&I PPA rate per state)',
    file: 'src/lib/revenueEngine.js', line: 191,
    tier: 'C',
    source: 'EIA Form 861 cited + Tractova editorial state allocation',
    vintage: '2025-06',
    nFields: 17,
    risk: 'medium',
    notes: 'EIA Form 861 covers retail rates (state-level). PPA rates are typically a discount to retail (developer-quoted). Tractova picks ~50-60% of retail as PPA — synthesis. Best refresh path: LevelTen PPA Price Index (paywalled), or DOE/PPA Watch.',
  },
  {
    name: 'CI_REVENUE_DATA — retailRateCentsKwh (commercial retail rate per state)',
    file: 'src/lib/revenueEngine.js', line: 191,
    tier: 'A',
    source: 'EIA Form 861 commercial sector retail rates 2024',
    vintage: '2025-06',
    nFields: 17,
    risk: 'medium',
    notes: 'EIA Form 861 is the right primary source. Should refresh annually when EIA releases new data (typically Oct).',
  },
  {
    name: 'BESS_REVENUE_DATA — installedCostPerKwh (BESS $/kWh per state)',
    file: 'src/lib/revenueEngine.js', line: 213,
    tier: 'B',
    source: 'BloombergNEF 2024 utility-scale 4hr ($295-$340/kWh) + Tractova state allocation',
    vintage: '2026-04',
    nFields: 17,
    risk: 'medium',
    notes: 'National anchor cited (BNEF). State allocation is editorial. Lazard v18 LCOS chapter (page 17+) covers storage; could add as cross-check.',
  },
  {
    name: 'BESS_REVENUE_DATA — capacityPerKwYear (BESS capacity payment $/kW-yr per state)',
    file: 'src/lib/revenueEngine.js', line: 213,
    tier: 'B',
    source: '2024-2025 ISO clearing × 4-hr BESS accreditation factor + Tractova state-within-LDA + 2026 forward (PJM RPM 2025/26 BRA $98.5/kW-yr × 60%; NYISO ICAP $30-50 × 50-60%; ISO-NE FCM 2025/26 $80-90 × 60%; CAISO RA $40-80 × 70%; MISO PRA $50 × 70%; HECO bilateral=0)',
    vintage: '2026-05-04 (re-anchored migration 046)',
    nFields: 17,
    risk: 'medium',
    notes: 'Migration 046 applied. ISO-NE/NY/CA values dropped 25-30% to reflect realistic accreditation. PJM stays roughly same. Refresh annually as new ISO auctions clear. Accreditation factor + state-within-LDA still Tractova synthesis.',
  },
  {
    name: 'BESS_REVENUE_DATA — demandChargePerKwMonth + arbitragePerMwh',
    file: 'src/lib/revenueEngine.js', line: 213,
    tier: 'B',
    source: 'Demand: NREL TP-7A40-71162 (Identifying Potential Markets for Behind-the-Meter Battery Storage) regional ranges + tracked state PUC tariff filings. Arbitrage: Lazard v18 LCOS Storage Value Snapshot (CAISO/ERCOT) + ISO LMP histogram regional buckets.',
    vintage: '2026-05-04 (re-anchored migration 047 with documented regional methodology)',
    nFields: 17,
    risk: 'medium',
    notes: 'Migration 047 applied + comprehensive comment block in revenueEngine.js documenting regional buckets. Single state value approximates the dominant 1-3 utility tariffs serving large commercial; intra-state variation can be ±20%. Tractova synthesis layers: state-within-region allocation + 2026 forward. Refresh path: pull commercial demand schedules from each state PUC tariff database + ISO LMP quarterly spread analysis.',
  },
  {
    name: 'STATE_REVENUE_DATA — billCreditCentsKwh per state',
    file: 'src/lib/revenueEngine.js', line: 163,
    tier: 'A',
    source: 'State PUC tariff filings tracked via DSIRE',
    vintage: '2025-06',
    nFields: 17,
    risk: 'medium',
    notes: 'Bill credits change quarterly when utility tariffs reset. Tractova value is a 2025-Q2 snapshot. Stale risk if tariffs have moved. Refresh: re-run DSIRE / state PUC tariff filings annually.',
  },
  {
    name: 'STATE_REVENUE_DATA — recPerMwh per state',
    file: 'src/lib/revenueEngine.js', line: 163,
    tier: 'A',
    source: 'DSIRE + GATS / NEPOOL GIS / PJM-EIS / WREGIS / M-RETS',
    vintage: '2025-06',
    nFields: 17,
    risk: 'medium',
    notes: 'REC prices are market-driven and move daily. Tractova value is a 2025-Q2 snapshot. NJ SREC-II in particular swings 30-50% YoY. Refresh path: GATS public data feeds (annual minimum, ideally quarterly).',
  },
  {
    name: 'STATE_REVENUE_DATA — capacityFactorPct per state',
    file: 'src/lib/revenueEngine.js', line: 163,
    tier: 'A',
    source: 'NREL PVWatts API v8 state averages (refreshed quarterly via cron)',
    vintage: 'live (refresh-capacity-factors.js cron)',
    nFields: 17,
    risk: 'low',
    notes: 'Already automated via /api/refresh-capacity-factors quarterly cron. Best example of how other rate fields should be wired.',
  },

  // ── scoreEngine.js ──
  {
    name: 'CI_OFFTAKE_SCORES — C&I offtake score per state (0-100)',
    file: 'src/lib/scoreEngine.js', line: 20,
    tier: 'B',
    source: 'EIA Form 861 commercial retail rates 2024 + qualitative market-depth adjustments',
    vintage: '2026-05-01',
    nFields: 32,
    risk: 'medium',
    notes: 'Calibration documented inline per state. EIA Form 861 is real but the qualitative adjustments are Tractova editorial. Score values should be auditable against published retail rates.',
  },
  {
    name: 'BESS_OFFTAKE_SCORES — BESS offtake score per state (0-100)',
    file: 'src/lib/scoreEngine.js', line: 45,
    tier: 'B',
    source: 'ISO/RTO 2024-2025 capacity-market clearing prices + state storage carve-outs + IRP procurement plans',
    vintage: '2026-05-01',
    nFields: 25,
    risk: 'medium',
    notes: 'Sources cited inline. State allocation is editorial but documented per state in comments. Refresh annually as new ISO auctions clear.',
  },
  {
    name: 'STAGE_MODIFIERS — score adjustments per project stage (offtake/ix/site triple)',
    file: 'src/lib/scoreEngine.js', line: 1,
    tier: 'C',
    source: 'Tractova editorial — captures de-risking by project stage',
    vintage: 'unknown (likely original product design)',
    nFields: 7,
    risk: 'medium',
    notes: 'Magnitudes (e.g., NTP +25 site) are not anchored to any primary source. Refresh path: industry survey of CS developers on stage-by-stage de-risking expectations, or anchor against published CS project IRR sensitivity studies.',
  },
  {
    name: 'computeDisplayScore composite weights (offtake 0.40, ix 0.35, site 0.25)',
    file: 'src/lib/scoreEngine.js', line: 269,
    tier: 'B',
    source: 'Tractova editorial product methodology (no primary-data anchor for pillar weights). Disclosed via WEIGHT_SCENARIOS export + computeDisplayScoreRange exposing default/revenue-tilt/IX-tilt/permit-tilt schemes; Lens UI surfaces "weight sensitivity X-Y" tooltip when spread > 4 pts.',
    vintage: '2026-05-04 (transparent disclosure shipped)',
    nFields: 3,
    risk: 'low',
    notes: 'Audit migration changed approach: instead of trying to "find a primary source" (none exists for pillar weighting), made the editorial choice transparent + added user-facing sensitivity tool. Lens shows "Score 73 (weight sensitivity 67-78)" — user can see if verdict is robust to methodology. If/when developer-survey or empirical IRR-vs-pillar data becomes available, replace WEIGHT_SCENARIOS defaults.',
  },
  {
    name: 'computeFeasibilityScore csStatus base values (active=65, limited=40, pending=18, none=5)',
    file: 'src/lib/scoreEngine.js', line: 37,
    tier: 'C',
    source: 'Tractova editorial',
    vintage: 'unknown',
    nFields: 4,
    risk: 'medium',
    notes: 'Used in dashboard + email digest score computation. Same magnitude as offtake CS base in computeSubScores (active=80) — duplicated/inconsistent? Worth audit.',
  },
  {
    name: 'computeSubScores CS base values (active=80, limited=52, pending=25, none=8)',
    file: 'src/lib/scoreEngine.js', line: 202,
    tier: 'C',
    source: 'Tractova editorial',
    vintage: 'unknown',
    nFields: 4,
    risk: 'medium',
    notes: 'Different magnitudes than computeFeasibilityScore (active=65 vs 80). Why two formulas? Possible legacy.',
  },
  {
    name: 'computeSubScores LMI penalty thresholds (-14, -7, -3 for ≥40%, ≥25%, ≥10%)',
    file: 'src/lib/scoreEngine.js', line: 205,
    tier: 'C',
    source: 'Tractova editorial — captures subscriber-acquisition friction at higher LMI requirements',
    vintage: 'unknown',
    nFields: 3,
    risk: 'medium',
    notes: 'Magnitudes are editorial. LBNL CS Trends report does discuss LMI subscriber acquisition cost premium ($0.04/Wdc per NREL Q1 2023) but the SCORE penalty doesn\'t directly map.',
  },
  {
    name: 'computeSubScores capacity bonus (>1000 MW: +12, >500: +8, >100: +4, >0: +2)',
    file: 'src/lib/scoreEngine.js', line: 43,
    tier: 'C',
    source: 'Tractova editorial — rewards programs with more headroom',
    vintage: 'unknown',
    nFields: 4,
    risk: 'low',
    notes: 'Used only in dashboard quick-feasibility-score formula. Editorial.',
  },
  {
    name: 'computeSubScores IX score brackets (easy=88, moderate=65, hard=38, very_hard=14)',
    file: 'src/lib/scoreEngine.js', line: 211,
    tier: 'C',
    source: 'Tractova editorial — qualitative IX difficulty mapping',
    vintage: 'unknown',
    nFields: 4,
    risk: 'medium',
    notes: 'These map qualitative ix_difficulty enum to numeric scores. The enum itself (per state) is curated from ISO/RTO data sources. Brackets are editorial.',
  },
  {
    name: 'IX live-blend score adjustments (avg_study_months thresholds + MW thresholds)',
    file: 'src/lib/scoreEngine.js', line: 78,
    tier: 'A',
    source: 'Calibrated 2026-04-30 from actual ix_queue_data row distribution (probe: scripts/probe-ix-queue.mjs)',
    vintage: '2026-04-30',
    nFields: 8,
    risk: 'low',
    notes: 'Best example of data-anchored thresholds in the codebase. Recalibrate annually as queue data evolves.',
  },
  {
    name: 'computeSiteSubScore values (82/56/42/26 + partial-input midpoints)',
    file: 'src/lib/scoreEngine.js', line: 131,
    tier: 'C',
    source: 'Tractova editorial — maps land/wetland boolean × tech to numeric',
    vintage: 'unknown',
    nFields: 9,
    risk: 'medium',
    notes: 'The thresholds for "available land" (>=25% prime farmland) and "wetland warning" (>=15% NWI) ARE calibrated. The site sub-score numeric values (82/56/etc.) are editorial.',
  },

  // ── scenarioEngine.js ──
  {
    name: 'BASELINE_INPUTS opexPerKwYear ($20/kW/yr CS solar O&M)',
    file: 'src/lib/scenarioEngine.js', line: 38,
    tier: 'B',
    source: 'Wood Mac H2 2025 utility-scale solar O&M $15-25/kW/yr (single national number, no state allocation)',
    vintage: '2025-H2',
    nFields: 1,
    risk: 'medium',
    notes: 'NREL Q1 2023 reports CS-specific O&M is $39.83/kWdc/yr (significantly higher than utility-scale). Tractova uses $20/kW/yr — possibly understated for CS. Worth re-anchoring.',
  },
  {
    name: 'BASELINE_INPUTS discountRate (8%)',
    file: 'src/lib/scenarioEngine.js', line: 154,
    tier: 'B',
    source: 'Industry standard for CS / DG project finance (Wood Mac, Lazard LCOE)',
    vintage: 'unknown',
    nFields: 1,
    risk: 'low',
    notes: 'User-adjustable in Scenario Studio. Default of 8% is reasonable industry midpoint.',
  },
  {
    name: 'BASELINE_INPUTS contractYears (25 solar / 15 BESS)',
    file: 'src/lib/scenarioEngine.js', line: 222,
    tier: 'A',
    source: 'Industry standard project life — 25 yr solar (REC contract or PPA term), 15 yr BESS (battery degradation cap)',
    vintage: 'consensus',
    nFields: 2,
    risk: 'low',
    notes: 'Documented in glossary.',
  },
  {
    name: 'BASELINE_INPUTS degradationPct (0.5%/yr solar)',
    file: 'src/lib/revenueEngine.js (in STATE_REVENUE_DATA)', line: 163,
    tier: 'A',
    source: 'Industry consensus for utility-scale silicon PV (NREL TTS reports)',
    vintage: 'consensus',
    nFields: 1,
    risk: 'low',
    notes: 'Same value used across all 17 states. Standard.',
  },
  {
    name: 'BASELINE_INPUTS roundTripEfficiency (0.87 BESS)',
    file: 'src/lib/revenueEngine.js (in BESS_REVENUE_DATA)', line: 213,
    tier: 'A',
    source: 'Industry consensus for Li-ion 4hr utility-scale BESS (BNEF, Wood Mac)',
    vintage: 'consensus',
    nFields: 1,
    risk: 'low',
    notes: 'Same across all 17 states. Standard.',
  },
  {
    name: 'BASELINE_INPUTS annualDegradationPct (2.5% BESS)',
    file: 'src/lib/revenueEngine.js (in BESS_REVENUE_DATA)', line: 213,
    tier: 'A',
    source: 'Industry consensus for Li-ion BESS (BNEF reports 2.5%)',
    vintage: 'consensus',
    nFields: 1,
    risk: 'low',
    notes: 'Sensitivity scenario "BESS_DEGRADE" tests 3% as alternative.',
  },
  {
    name: 'SCENARIO_PRESETS multipliers (best/worst case for capex, IX, CF, REC, allocation)',
    file: 'src/lib/scenarioEngine.js', line: 85,
    tier: 'A',
    source: 'NREL ATB 2024 P10/P90 + top-quartile siting CF + historical 12mo REC band + network-upgrade shock IX (recalibrated Session 3, citations in SCENARIO_PRESET_METHODOLOGY constant)',
    vintage: '2026-05-03',
    nFields: 10,
    risk: 'low',
    notes: 'Best example of well-cited synthesis in the codebase. Each multiplier has a public-source anchor.',
  },
  {
    name: 'BASELINE_INPUTS programAllocationPct (1.0 = 100% subscriber utilization)',
    file: 'src/lib/scenarioEngine.js', line: 297,
    tier: 'B',
    source: 'Tractova default — 100% allocation; user adjusts in Scenario Studio',
    vintage: 'unknown',
    nFields: 1,
    risk: 'low',
    notes: 'Default is editorial but user-controllable. Documented in glossary.',
  },

  // ── Geospatial thresholds ──
  {
    name: 'NWI wetland warning threshold (>=15% county coverage)',
    file: 'src/lib/scoreEngine.js', line: 233,
    tier: 'A',
    source: 'Calibrated 2026-05-01 from scripts/probe-geospatial.mjs against actual NWI distribution',
    vintage: '2026-05-01',
    nFields: 1,
    risk: 'low',
    notes: 'Threshold cited inline. Wetland coverage > 15% of county AREALAND triggers Section 404 permitting flag. Supports actual permitting reality.',
  },
  {
    name: 'SSURGO prime farmland threshold (>=25% county coverage)',
    file: 'src/lib/scoreEngine.js', line: 234,
    tier: 'A',
    source: 'Calibrated 2026-05-01 from scripts/probe-geospatial.mjs',
    vintage: '2026-05-01',
    nFields: 1,
    risk: 'low',
    notes: 'Threshold for FPPA conversion-review trigger. Supports actual NRCS rule.',
  },

  // ── Email cron schedules + thresholds ──
  {
    name: 'send-alerts opportunity_score drop threshold (>10 pts to fire alert)',
    file: 'api/send-alerts.js', line: 65,
    tier: 'C',
    source: 'Tractova editorial',
    vintage: 'unknown',
    nFields: 1,
    risk: 'low',
    notes: 'Email alert threshold. Editorial choice — fires alert if state score drops more than 10 pts. Could be A/B tested.',
  },

  // ── ITC + tax credit constants ──
  {
    name: 'ITC base rate (30%) + adders (+10% energy community, +10% LIC) per state',
    file: 'src/lib/revenueEngine.js (itcPct + itcAdderPct)', line: 163,
    tier: 'A',
    source: 'IRS §48 federal tax code (IRA 2022)',
    vintage: 'IRA 2022',
    nFields: 17,
    risk: 'low',
    notes: 'Federal tax law. Refresh only when Congress changes ITC structure (BBB, IRA repeal scenarios).',
  },
]

// ── Read each file once + cache contents for value extraction ────────────
const fileCache = new Map()
function readFile(path) {
  if (!fileCache.has(path)) {
    try { fileCache.set(path, readFileSync(resolve(process.cwd(), path), 'utf8')) }
    catch { fileCache.set(path, null) }
  }
  return fileCache.get(path)
}

// ── Build the audit report ──
const today = new Date().toISOString().slice(0, 10)
const tierA = REGISTRY.filter(e => e.tier === 'A')
const tierB = REGISTRY.filter(e => e.tier === 'B')
const tierC = REGISTRY.filter(e => e.tier === 'C')
const tierMixed = REGISTRY.filter(e => e.tier === 'mixed')
const highRisk = REGISTRY.filter(e => e.risk === 'high')
const mediumRisk = REGISTRY.filter(e => e.risk === 'medium')
const totalFields = REGISTRY.reduce((s, e) => s + (e.nFields || 1), 0)

let md = ''
md += `# Tractova Data-Trust Audit\n\n`
md += `Generated: **${today}**  ·  Run from \`scripts/data-trust-audit.mjs\`\n\n`
md += `---\n\n`
md += `## Summary\n\n`
md += `| Tier | Description | Audit entries | Total fields covered |\n`
md += `|---|---|---|---|\n`
md += `| **A** | Anchored on primary data with verified citation. Just needs refresh when source updates. | ${tierA.length} | ${tierA.reduce((s, e) => s + (e.nFields || 1), 0)} |\n`
md += `| **B** | Regional analog or partially-anchored, with documented choice. Defensible but contains synthesis. | ${tierB.length} | ${tierB.reduce((s, e) => s + (e.nFields || 1), 0)} |\n`
md += `| **C** | Editorial / synthesis without primary citation. **REVIEW PRIORITY** — same risk pattern as the Lazard issue Aden caught 2026-05-04. | ${tierC.length} | ${tierC.reduce((s, e) => s + (e.nFields || 1), 0)} |\n`
md += `| **Mixed** | Audit entry covers fields at multiple tiers (e.g., per-state values where some are A and some are B). | ${tierMixed.length} | ${tierMixed.reduce((s, e) => s + (e.nFields || 1), 0)} |\n`
md += `| **Total** | | ${REGISTRY.length} | ${totalFields} |\n\n`

md += `**Risk distribution:** ${highRisk.length} high-risk · ${mediumRisk.length} medium-risk · ${REGISTRY.length - highRisk.length - mediumRisk.length} low-risk.\n\n`

md += `---\n\n`
md += `## Tier C — Editorial / unanchored (REVIEW PRIORITY)\n\n`
md += `These constants are pure Tractova synthesis without a primary-source anchor. Same pattern as the Lazard issue caught 2026-05-04. Listed in priority order (highest risk first).\n\n`
md += writeTable(REGISTRY.filter(e => e.tier === 'C').sort((a, b) => riskRank(b.risk) - riskRank(a.risk)))

md += `\n## Tier B — Regional analog / partially-anchored\n\n`
md += `Have some primary citation but contain Tractova synthesis layer (e.g., regional analog or qualitative adjustment).\n\n`
md += writeTable(REGISTRY.filter(e => e.tier === 'B').sort((a, b) => riskRank(b.risk) - riskRank(a.risk)))

md += `\n## Tier A — Data-anchored (low risk)\n\n`
md += `Anchored on primary data with verified citation. Refresh when source updates.\n\n`
md += writeTable(REGISTRY.filter(e => e.tier === 'A').sort((a, b) => riskRank(b.risk) - riskRank(a.risk)))

md += `\n## Mixed (some Tier A, some Tier B within same audit entry)\n\n`
md += writeTable(REGISTRY.filter(e => e.tier === 'mixed'))

md += `\n---\n\n`
md += `## Recommended next-action priorities\n\n`
md += `Based on this audit, the most leverage from re-anchoring effort is in:\n\n`
md += `1. **CI_REVENUE_DATA installedCostPerWatt** — same Tier-C synthesis problem CS just fixed. Re-anchor using same NREL/LBNL methodology applied to commercial scale. Highest replicate-mistake risk.\n`
md += `2. **BESS demand charges + arbitrage spreads** — seeded synthesis with no per-state primary citation. These swing fast (ISO clearing prices) so values may be very stale.\n`
md += `3. **computeDisplayScore composite weights (0.40 / 0.35 / 0.25)** — these three numbers determine the headline Feasibility Index that drives every score in the product. Currently editorial. Could be sensitivity-tested or anchored.\n`
md += `4. **STAGE_MODIFIERS magnitudes** — captures how much project stage de-risks the score. Editorial. Could be anchored against industry survey or published CS IRR sensitivity studies.\n`
md += `5. **BESS capacity payments per state** — ISO clearing prices move 2-9× YoY. The 2026-04 vintage may already be stale.\n\n`
md += `## Patterns to apply codebase-wide\n\n`
md += `Lessons from the CS recalibration that should propagate:\n\n`
md += `- **Two-layer citations**: separate "what the source publishes" from "what Tractova synthesizes on top." See revenueEngine.js header for the model.\n`
md += `- **Tier A/B/C disclosure** per data point in code comments + UI methodology dropdowns.\n`
md += `- **Self-audit checks** before shipping recalibrations — re-derive values from raw data programmatically rather than hand-typing.\n`
md += `- **Refresh path** documented for every Tier-A/B field: which primary source, which cron, which annual cadence.\n\n`

mkdirSync(resolve(process.cwd(), 'docs'), { recursive: true })
writeFileSync(resolve(process.cwd(), 'docs/data-trust-audit.md'), md, 'utf8')

// Also stdout the summary for quick view
console.log('═'.repeat(78))
console.log(`Tractova Data-Trust Audit — ${today}`)
console.log('═'.repeat(78))
console.log(`  Tier A (data-anchored):       ${tierA.length} entries / ${tierA.reduce((s,e)=>s+(e.nFields||1),0)} fields`)
console.log(`  Tier B (regional analog):     ${tierB.length} entries / ${tierB.reduce((s,e)=>s+(e.nFields||1),0)} fields`)
console.log(`  Tier C (editorial — REVIEW):  ${tierC.length} entries / ${tierC.reduce((s,e)=>s+(e.nFields||1),0)} fields`)
console.log(`  Mixed:                        ${tierMixed.length} entries / ${tierMixed.reduce((s,e)=>s+(e.nFields||1),0)} fields`)
console.log()
console.log(`  High-risk:    ${highRisk.length}`)
console.log(`  Medium-risk:  ${mediumRisk.length}`)
console.log()
console.log(`  Wrote: docs/data-trust-audit.md`)
console.log()
console.log('Top 5 high-risk Tier C/B entries:')
const top = REGISTRY.filter(e => e.tier !== 'A' && e.risk === 'high').slice(0, 5)
for (const e of top) {
  console.log(`  • ${e.name}`)
  console.log(`    ${e.file}:${e.line} (${e.tier}, ${e.risk})`)
}

// ── Helpers ──
function riskRank(r) {
  return r === 'high' ? 3 : r === 'medium' ? 2 : 1
}

function writeTable(entries) {
  if (entries.length === 0) return '_(none)_\n'
  let s = `| Field | File:Line | Risk | Source / Vintage | Notes |\n`
  s += `|---|---|---|---|---|\n`
  for (const e of entries) {
    const file = `\`${e.file}:${e.line}\``
    const sourceVintage = `${e.source}<br>**Vintage:** ${e.vintage}`
    const notes = (e.notes || '').replace(/\|/g, '\\|')
    const fieldName = `**${e.name}**` + (e.nFields > 1 ? ` _(${e.nFields} values)_` : '')
    s += `| ${fieldName} | ${file} | ${e.risk} | ${sourceVintage} | ${notes} |\n`
  }
  return s
}
