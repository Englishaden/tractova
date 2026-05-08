// Search-page-shared helpers + presentational primitives.
//
// Extracted from src/pages/Search.jsx in Sprint F.2 to break a chain of
// circular imports: Search.jsx imported 7+ child components that in turn
// re-imported helpers from Search.jsx. Cycles like that work on Chromium
// but can fail to resolve on iOS Safari (TDZ on first paint → blank
// screen) and risk render-time throws under specific Suspense orderings.
// Putting the shared symbols in their own module that has zero JSX-tree
// dependencies removes the cycle entirely.
//
// Move was character-for-character; no logic changes.

// ── Market rank ─────────────────────────────────────────────────────────────
export function getMarketRank(stateId, programMap) {
  if (!programMap) return { rank: null, total: 0 }
  const ranked = Object.values(programMap)
    .filter(s => s.csStatus === 'active' || s.csStatus === 'limited')
    .sort((a, b) => b.feasibilityScore - a.feasibilityScore)
  const rank = ranked.findIndex(s => s.id === stateId) + 1
  return { rank: rank || null, total: ranked.length }
}

// ── CS program status badge config (chip styling) ───────────────────────────
export const STATUS_CFG = {
  active:  { label: 'Active Program',   bg: 'rgba(5,150,105,0.10)',  text: '#065F46', border: 'rgba(5,150,105,0.25)' },
  limited: { label: 'Limited Capacity', bg: 'rgba(180,83,9,0.10)',   text: '#92400E', border: 'rgba(180,83,9,0.25)' },
  pending: { label: 'Pending Launch',   bg: 'rgba(202,138,4,0.12)',  text: '#854D0E', border: 'rgba(202,138,4,0.30)' },
  none:    { label: 'No Program',       bg: 'rgba(0,0,0,0.05)',      text: '#6B7280', border: 'rgba(0,0,0,0.12)' },
}

// ── AI brief sanitizer ──────────────────────────────────────────────────────
// Guards against raw JSON leaking into the analyst brief (e.g. from truncated
// API responses cached in sessionStorage before the parser fix was deployed).
export function sanitizeBrief(text) {
  if (!text) return null
  const t = text.trim()
  if (!t.startsWith('{')) return t
  // Looks like raw JSON — try to recover just the brief value
  try {
    const parsed = JSON.parse(t)
    if (typeof parsed.brief === 'string' && !parsed.brief.trim().startsWith('{')) return parsed.brief
  } catch (_) {}
  const m = t.match(/"brief"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  return m ? m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim() : null
}

// ── Presentational primitives ───────────────────────────────────────────────
export function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{children}</p>
  )
}

export function DataRow({ label, value, highlight, valueClass }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-right ${valueClass || (highlight ? 'text-primary' : 'text-gray-800')}`}>
        {value}
      </span>
    </div>
  )
}

export function EaseArcGauge({ score }) {
  const s = (typeof score === 'number' && isFinite(score)) ? score : null
  if (s === null) {
    return <span className="text-xs text-gray-400 italic">Not available</span>
  }
  const pct = Math.max(0, Math.min(10, s)) / 10
  const R = 44, cx = 58, cy = 54
  const ex = cx - R * Math.cos(Math.PI * pct)
  const ey = cy - R * Math.sin(Math.PI * pct)
  // fill is always ≤ 180° of the full circle → never a large-arc in SVG terms
  const track = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`
  const fill  = pct > 0.01 ? `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${ex} ${ey}` : ''

  let color = '#DC2626'
  if (s >= 7)      color = '#0F766E'
  else if (s >= 5) color = '#D97706'
  else if (s >= 3) color = '#EA580C'

  return (
    <svg viewBox="0 0 116 62" className="w-full max-w-[120px]">
      <path d={track} fill="none" stroke="#E5E7EB" strokeWidth="9" strokeLinecap="round" />
      {fill && <path d={fill} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />}
      <text x="58" y="50" textAnchor="middle" fontSize="20" fontWeight="800" fill={color} fontFamily="system-ui">{s}/10</text>
    </svg>
  )
}

export function QueueBadge({ statusCode }) {
  const map = {
    open:      { label: 'Open', cls: 'bg-primary-50 text-primary-700 border-primary-200' },
    limited:   { label: 'Limited', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    saturated: { label: 'Saturated', cls: 'bg-red-50 text-red-700 border-red-200' },
    unknown:   { label: 'Unknown', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  }
  const cfg = map[statusCode] || map.unknown
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-sm border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

const RUNWAY_COLORS = {
  strong:   { bg: '#DCFCE7', text: '#14532D' },
  moderate: { bg: '#FEF3C7', text: '#78350F' },
  watch:    { bg: '#FFEDD5', text: '#7C2D12' },
  urgent:   { bg: '#FEE2E2', text: '#7F1D1D' },
}

export function RunwayBadge({ runway }) {
  const c = RUNWAY_COLORS[runway.urgency] || RUNWAY_COLORS.moderate
  const suffix = runway.urgency === 'watch' ? ' — watch' : runway.urgency === 'urgent' ? ' — act now' : ''
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-sm"
        style={{ background: c.bg, color: c.text }}
        title="Runway = remaining capacity ÷ annual-average enrollment rate. Real CS programs cluster enrollment around tax-credit deadlines + project milestones, so a Q4 rush can exhaust capacity faster than the annual average suggests. Treat this as a planning horizon, not a deadline."
      >
        ~{runway.months} months{suffix}
      </span>
      <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-sm">est.</span>
    </div>
  )
}

export function CSStatusBadge({ csStatus }) {
  const map = {
    active:  { label: 'Active Program', cls: 'bg-primary-50 text-primary-700 border-primary-200' },
    limited: { label: 'Limited Capacity', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    pending: { label: 'Pending Launch', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    none:    { label: 'No Program', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  }
  const cfg = map[csStatus] || map.none
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-sm border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Sensitivity analysis ────────────────────────────────────────────────────
export function computeScoreDelta(base, override) {
  const modified = { ...base, ...override }

  // IX sub-score (35pt range): easy=33, moderate=24, hard=14, very_hard=5
  const ixSub = { easy: 33, moderate: 24, hard: 14, very_hard: 5 }
  const ixDelta = (ixSub[modified.ixDifficulty] ?? 0) - (ixSub[base.ixDifficulty] ?? 0)

  // CS status sub-score (40pt range)
  const csSub = { active: 34, limited: 21, pending: 11, none: 2 }
  const csDelta = (csSub[modified.csStatus] ?? 0) - (csSub[base.csStatus] ?? 0)

  // LMI penalty (within offtake pillar)
  const lmiPen = (pct, req) => {
    if (!req) return 0
    if (pct >= 50) return -7
    if (pct >= 40) return -5
    if (pct >= 30) return -3
    return pct > 0 ? -1 : 0
  }
  const lmiDelta = lmiPen(modified.lmiPercent ?? base.lmiPercent, modified.lmiRequired ?? base.lmiRequired)
                 - lmiPen(base.lmiPercent, base.lmiRequired)

  const raw = Math.round(ixDelta + csDelta + lmiDelta)
  const newScore = Math.max(5, Math.min(95, base.feasibilityScore + raw))
  return newScore - base.feasibilityScore
}

const IX_LEVELS = ['easy', 'moderate', 'hard', 'very_hard']

export function buildSensitivityScenarios(stateProgram, technology, mw) {
  if (!stateProgram) return []
  const { ixDifficulty, csStatus, lmiRequired, lmiPercent, capacityMW, name: stateName, csProgram } = stateProgram
  const ixIdx = IX_LEVELS.indexOf(ixDifficulty)
  const mwNum = parseFloat(mw) || 5
  const scenarios = []

  // IX scenarios
  if (ixIdx < IX_LEVELS.length - 1) {
    const newLevel = IX_LEVELS[ixIdx + 1]
    const timelineMap = { moderate: '12–18 months', hard: '18–30 months', very_hard: '30–48+ months' }
    const costMap = { moderate: '$500K–$1.5M', hard: '$1–3M', very_hard: '$3–6M+' }
    const upgradeCostMap = { moderate: 85000, hard: 150000, very_hard: 350000 }
    const estUpgrade = Math.round((upgradeCostMap[newLevel] ?? 150000) * mwNum)
    scenarios.push({
      id: 'ix_harder',
      label: 'IX cost shock',
      override: { ixDifficulty: newLevel },
      precedent: 'PJM 2024 cluster: $1.5M/MW avg upgrade · 30 mo avg study',
      detail: `Queue conditions deteriorate to ${newLevel.replace('_', ' ')} — same trajectory PJM's 2024 cluster studies showed (avg 30 mo, $1.5M/MW upgrades, ~28% withdrawal rate). Add ${timelineMap[newLevel] ?? '18–30 months'} to your IX study timeline and budget ${costMap[newLevel] ?? '$1–3M'} in potential upgrade costs. At ${mwNum}MW, IX cost exposure could consume a significant portion of program enrollment value.`,
      revenueImpact: `Est. cost: +$${estUpgrade.toLocaleString()} in IX upgrades`,
      timelineImpact: `Study timeline extends to ~${timelineMap[newLevel] ?? '18–30 months'}`,
      tone: 'negative',
    })
  }
  if (ixIdx > 0) {
    const newLevel = IX_LEVELS[ixIdx - 1]
    const savingsMap = { easy: 350000, moderate: 150000, hard: 85000 }
    const estSavings = Math.round((savingsMap[newLevel] ?? 150000) * mwNum)
    const timelineSavingsMap = { easy: '6–9 months', moderate: '9–14 months', hard: '14–20 months' }
    scenarios.push({
      id: 'ix_easier',
      label: 'IX fast-track',
      override: { ixDifficulty: newLevel },
      precedent: 'MISO 2023 fast-track: 12 mo studies · sub-$500K/MW',
      detail: `Queue conditions ease to ${newLevel.replace('_', ' ')} — what MISO showed in 2023 with their fast-track cluster reform: 12 mo studies, sub-$500K/MW upgrades. Interconnection timelines compress and upgrade cost risk drops sharply. This is the upside case — valuable for sensitivity modeling but don't underwrite to it without a confirmed study result.`,
      revenueImpact: `Est. savings: $${estSavings.toLocaleString()} on IX upgrades`,
      timelineImpact: `Study timeline compresses to ~${timelineSavingsMap[newLevel] ?? '12–18 months'}`,
      tone: 'positive',
    })
  }

  // Program capacity scenarios (CS only)
  if (csStatus === 'active' && capacityMW > 0 && technology === 'Community Solar') {
    const pct = capacityMW > 0 ? Math.round((mwNum / capacityMW) * 100) : null
    const pctStr = pct != null ? ` Your ${mwNum}MW project represents ~${pct}% of remaining capacity.` : ''
    scenarios.push({
      id: 'program_caps',
      label: 'Program cap-out',
      override: { csStatus: 'limited' },
      precedent: 'NJ SuSI 2023: capped in 6 weeks · 18 mo gap before next block',
      detail: `${csProgram ?? stateName} moves to limited capacity — same dynamic NJ's SuSI program saw in 2023 (capped in 6 weeks of opening, 18 mo gap before the next block).${pctStr} Enrollment windows for limited-capacity programs often close within 30–60 days of announcement. Submit your application now or risk missing the window.`,
      revenueImpact: `Risk: enrollment window closes in ~30–60 days`,
      timelineImpact: `Re-open delay: 6–18 months until next block`,
      tone: 'negative',
    })
  }
  if (csStatus === 'limited' && technology === 'Community Solar') {
    scenarios.push({
      id: 'new_block',
      label: 'New block opens',
      override: { csStatus: 'active' },
      precedent: 'MA SMART 2024 reopen: 60-day filing rush · 3–5× developer activity',
      detail: `A new capacity block in ${stateName} would immediately unlock enrollment — historically these periods see 3–5x developer activity within the first 60 days, like MA SMART's 2024 reopening. Position your project now so you can file on day one. Monitor the state PUC docket for block announcement filings.`,
      revenueImpact: `Upside: full enrollment economics restored`,
      timelineImpact: `First-mover advantage: ~60-day filing window`,
      tone: 'positive',
    })
  }

  // LMI scenarios (community solar only)
  if (technology === 'Community Solar') {
    if (!lmiRequired || lmiPercent < 50) {
      const lmiSubs = Math.round(mwNum * 250)
      // Bill credit revenue: MW × 8760 hr × CF = annual MWh; × 1000 → kWh;
      // × $/kWh bill credit. The earlier expression dropped the MWh→kWh
      // conversion and rendered a $79/yr haircut for a 5MW project.
      // Aden flagged 2026-05-04: this should be ~$79K/yr, not $79/yr.
      const annualMWh = mwNum * 8760 * 0.17
      const billCreditRevenue = annualMWh * 1000 * 0.085 // $0.085/kWh blended bill credit
      const revenueHaircut = Math.round(billCreditRevenue * 0.125) // ~12.5% of bill credit revenue
      scenarios.push({
        id: 'lmi_rises',
        label: 'LMI carveout raised to 50%',
        override: { lmiRequired: true, lmiPercent: 50 },
        precedent: 'NY VDER 2023: 50% LMI carveout · 9 mo aggregator ramp',
        detail: `A 50% LMI requirement means sourcing ~${lmiSubs.toLocaleString()} low-income subscriber households for a ${mwNum}MW project — same shift NY VDER saw in 2023 when carveouts were raised. Budget 6–9 months for aggregator contracting and expect a 10–15% revenue haircut to attract compliant subscribers.`,
        revenueImpact: `Est. revenue haircut: ~$${revenueHaircut.toLocaleString()}/yr`,
        timelineImpact: `Adds 6–9 months for aggregator contracting`,
        tone: 'negative',
      })
    }
    if (lmiRequired && lmiPercent > 0) {
      scenarios.push({
        id: 'lmi_removed',
        label: 'LMI carveout removed',
        override: { lmiRequired: false, lmiPercent: 0 },
        precedent: 'CO Comm Solar Garden: full retail subscriber pool · no LMI minimum',
        detail: `Removing the LMI requirement opens the full commercial and residential subscriber market — what CO Community Solar Gardens have always allowed. Dramatically easier customer acquisition and stronger bill credit economics. This is the regulatory upside case; watch for pending state PUC proceedings on LMI carveout rules.`,
        revenueImpact: `Upside: ~10–15% lift on bill credit revenue`,
        timelineImpact: `Subscriber acquisition compresses by 4–6 months`,
        tone: 'positive',
      })
    }
  }

  // C&I Solar scenarios
  if (technology === 'C&I Solar') {
    const ciAnnualMWh = mwNum * 8760 * 0.17
    const ciDropRevenue = Math.round(ciAnnualMWh * 1000 * 0.07 * 0.15)
    scenarios.push({
      id: 'ci_ppa_drop',
      label: 'PPA rate −15%',
      override: { ixDifficulty: ixDifficulty },
      precedent: 'CA NEM 3.0 (Apr 2023): −57% bill credit reset',
      detail: `A 15% PPA rate reduction compresses annual revenue and weakens the 25-year NPV substantially — small relative to CA's NEM 3.0 reset (Apr 2023, −57% bill credit) but illustrative of the same regulatory pressure on offtaker demand for below-market rates. Below 5.5¢/kWh is typically uneconomic in most markets.`,
      revenueImpact: `Annual revenue: -$${ciDropRevenue.toLocaleString()}`,
      timelineImpact: `25-year NPV impact: significant downside`,
      tone: 'negative',
    })
    scenarios.push({
      id: 'ci_rate_rise',
      label: 'Retail rate +3%/yr',
      override: { ixDifficulty: ixDifficulty },
      precedent: 'Northeast IOUs 2020–2024: 3–5% annual rate hikes',
      detail: `Rising utility retail rates increase your offtaker's savings from the PPA and reduce re-contracting risk at term. The 3–5% trajectory matches Northeast IOUs from 2020–2024 (PSEG, Eversource, ConEd). At 3% annual escalation, the spread between your PPA and retail widens by ~50% over 10 years — this is the upside case for long-term C&I PPAs.`,
      revenueImpact: `Spread widens ~50% over 10 years`,
      timelineImpact: `Stronger re-contracting position at term`,
      tone: 'positive',
    })
    const ciDefaultGWh = Math.round(ciAnnualMWh * 20 / 1000)
    scenarios.push({
      id: 'ci_default',
      label: 'Offtaker default (yr 5)',
      override: { ixDifficulty: ixDifficulty },
      precedent: 'Industry trend: re-contracting takes 3–6 mo · 5–10% rate concession',
      detail: `Offtaker default in year 5 means re-contracting the remaining output. Re-contracting typically takes 3–6 months and may require a 5–10% rate concession. Credit risk is the #1 C&I concern — underwrite tenant creditworthiness before signing the PPA.`,
      revenueImpact: `Re-contracting concession: 5–10% rate haircut`,
      timelineImpact: `Re-contracting takes 3–6 months · ~${ciDefaultGWh.toLocaleString()} GWh exposed`,
      tone: 'negative',
    })
  }

  // BESS scenarios
  if (technology === 'BESS') {
    const bessCapDropPerYear = Math.round(mwNum * 1000 * 65 * 0.30) // 30% of $65/kW-yr
    scenarios.push({
      id: 'bess_cap_drop',
      label: 'Capacity prices −30%',
      override: { ixDifficulty: ixDifficulty },
      precedent: 'PJM 2024 BRA: capacity prices swung 30–60% between cycles',
      detail: `A 30% capacity market decline reduces the largest BESS revenue stream significantly. PJM's 2024 base residual auction showed capacity prices can swing 40–60% between cycles, and ISO-NE has seen similar volatility. If capacity revenue drops, demand charge reduction and arbitrage must carry the project — stress-test your pro forma with floor-case capacity pricing.`,
      revenueImpact: `Capacity revenue: -$${bessCapDropPerYear.toLocaleString()}/yr`,
      timelineImpact: `Persists through next ISO auction cycle (3 years)`,
      tone: 'negative',
    })
    scenarios.push({
      id: 'bess_degrade',
      label: 'Degradation 3%/yr (vs 2.5% pro forma)',
      override: { ixDifficulty: ixDifficulty },
      precedent: 'Industry empirical: real-world cells 3% vs assumed 2.5%',
      detail: `At 3% annual degradation vs the typical 2.5% assumption, you lose ~8% more throughput by year 10 and ~15% by year 15. Real-world Tesla Megapack and CATL deployments have shown closer to 3% than the 2.5% modeled in most pro formas. This directly impacts arbitrage revenue and may trigger warranty-related capacity shortfalls.`,
      revenueImpact: `~15% throughput loss by year 15`,
      timelineImpact: `Warranty risk inflection: years 8–10`,
      tone: 'negative',
    })
    const bessDemandUpside = Math.round(mwNum * 1000 * 12)
    scenarios.push({
      id: 'bess_demand_up',
      label: 'Demand charges rise',
      override: { ixDifficulty: ixDifficulty },
      precedent: 'CA IOUs 2020–2023: 3–8% annual demand charge increase',
      detail: `Rising demand charges are the BESS upside case. CA IOUs (PG&E, SCE, SDG&E) have raised commercial demand charges 3–8% annually from 2020–2023. This trend favors behind-the-meter BESS economics.`,
      revenueImpact: `Upside: +$${bessDemandUpside.toLocaleString()}/yr per $1/kW-mo increase`,
      timelineImpact: `Compounds over 25-year asset life`,
      tone: 'positive',
    })
  }

  // Hybrid scenarios
  if (technology === 'Hybrid') {
    const hybridITCLoss = Math.round(mwNum * 0.5 * 4 * 1000 * 380 * 0.10)
    scenarios.push({
      id: 'hybrid_itc_drop',
      label: 'What if storage ITC drops to 30%?',
      override: { ixDifficulty: ixDifficulty },
      detail: `Losing the 10% co-location bonus reduces ITC value on the storage component. The co-location bonus under IRA Section 48 requires the storage to be placed in service with the solar facility — timeline delays that decouple the assets risk this adder.`,
      revenueImpact: `One-time ITC loss: -$${hybridITCLoss.toLocaleString()}`,
      timelineImpact: `Risk window: any decoupling of solar/storage COD`,
      tone: 'negative',
    })
    scenarios.push({
      id: 'hybrid_clip',
      label: 'What if solar clipping is 8%+?',
      override: { ixDifficulty: ixDifficulty },
      precedent: 'Industry convention (NREL PVWatts / PVsyst design defaults)',
      detail: `Solar clipping above 8% means the inverter is curtailing more generation than expected — reducing both bill credit revenue and the energy available for storage charging. The 3–5% revenue reduction figure is an industry rule-of-thumb (NREL PVWatts and PVsyst design defaults), not a state-specific Tractova value — your actual loss depends on the project's irradiance profile, DC/AC ratio, storage dispatch strategy, and inverter clipping curve. Typical hybrid designs target 3–5% clipping.`,
      revenueImpact: `~3–5% revenue reduction (industry rule-of-thumb)`,
      timelineImpact: `Mitigated via DC/AC ratio + storage duration tuning`,
      tone: 'negative',
    })
  }

  return scenarios.slice(0, 4)
}

// ── Chip color tokens (used by MarketIntelligenceSummary signal chips) ──────
export const CHIP_COLORS = {
  green:  { bg: '#DCFCE7', text: '#14532D', dot: '#16A34A' },
  teal:   { bg: '#CCFBF1', text: '#134E4A', dot: '#0D9488' },
  amber:  { bg: '#FEF3C7', text: '#78350F', dot: '#D97706' },
  yellow: { bg: '#FEF9C3', text: '#713F12', dot: '#CA8A04' },
  orange: { bg: '#FFEDD5', text: '#7C2D12', dot: '#EA580C' },
  red:    { bg: '#FEE2E2', text: '#7F1D1D', dot: '#DC2626' },
  gray:   { bg: '#F3F4F6', text: '#374151', dot: '#9CA3AF' },
}
