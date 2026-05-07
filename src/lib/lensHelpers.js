/**
 * Composes the headline + verdict + 3-bullet rationale block shown in
 * MarketIntelligenceSummary. Pure function — same input always produces
 * the same output, so the AI insight panel can fall back to this when
 * the Anthropic call hasn't returned yet.
 *
 * Extracted from Search.jsx in Plan C Sprint 2.3 for reuse and to keep
 * the page component focused on composition rather than copy generation.
 *
 * @param {{stateProgram:object, countyData:object, form:{mw, technology, stage, county}}} args
 * @returns {{verdict:string, headline:string, bullets:string[]}|null}
 */
export function generateMarketSummary({ stateProgram, countyData, form }) {
  if (!stateProgram) return null

  const { csStatus, csProgram, capacityMW, lmiRequired, lmiPercent, ixDifficulty, feasibilityScore } = stateProgram
  const queueStatus = countyData?.interconnection?.queueStatusCode || 'unknown'
  const { mw, technology, stage, county } = form
  const mwNum = parseFloat(mw) || 0

  // ── Verdict ────────────────────────────────────────────────────────────────
  let verdict, verdictBg, verdictText
  if (feasibilityScore >= 70 && csStatus === 'active' && (ixDifficulty === 'easy' || ixDifficulty === 'moderate')) {
    verdict = 'STRONG FIT';      verdictBg = '#DCFCE7'; verdictText = '#14532D'
  } else if (feasibilityScore >= 55 && (csStatus === 'active' || csStatus === 'limited') && ixDifficulty !== 'very_hard') {
    verdict = 'VIABLE';          verdictBg = '#D1FAE5'; verdictText = '#065F46'
  } else if (feasibilityScore >= 38 || csStatus === 'pending') {
    verdict = 'PROCEED WITH CAUTION'; verdictBg = '#FEF3C7'; verdictText = '#78350F'
  } else if (feasibilityScore >= 18) {
    verdict = 'HIGH FRICTION';   verdictBg = '#FFEDD5'; verdictText = '#7C2D12'
  } else {
    verdict = 'NOT RECOMMENDED'; verdictBg = '#FEE2E2'; verdictText = '#7F1D1D'
  }

  // ── Headline sentence ───────────────────────────────────────────────────────
  let headline = ''
  const stateName = stateProgram.name

  if (csStatus === 'active') {
    if (ixDifficulty === 'easy' && feasibilityScore >= 70) {
      headline = `${stateName} is running an active ${csProgram} with easy interconnection access — among the most developer-friendly markets in the country right now.`
    } else if (ixDifficulty === 'easy') {
      headline = `${stateName} has an active ${csProgram} and easy IX conditions — a clean market for a ${mw}MW project.`
    } else if (ixDifficulty === 'moderate' && feasibilityScore >= 65) {
      headline = `${stateName} combines an active ${csProgram} with moderate IX conditions — strong fundamentals for experienced developers willing to manage queue timelines.`
    } else if (ixDifficulty === 'moderate') {
      headline = `${stateName} has an active ${csProgram}. IX is moderate here — manageable, but budget for study delays and potential upgrade costs.`
    } else if (ixDifficulty === 'hard') {
      headline = `${stateName} has a strong CS program, but interconnection is the limiting factor in ${county} County. Extended study timelines and upgrade costs are real risks — underwrite them before committing.`
    } else {
      headline = `${stateName} has an active ${csProgram}, but IX conditions here are severely constrained. Only projects with exceptional economics can absorb the interconnection risk.`
    }
  } else if (csStatus === 'limited') {
    if (ixDifficulty === 'easy' || ixDifficulty === 'moderate') {
      headline = `Program capacity is tightening in ${stateName} — ${capacityMW}MW remaining in ${csProgram}. IX is workable, but move quickly before the current block closes.`
    } else {
      headline = `${stateName} has limited program capacity (${capacityMW}MW remaining) and difficult IX conditions — a double constraint that demands careful underwriting.`
    }
  } else if (csStatus === 'pending') {
    headline = `No active CS program in ${stateName} yet — legislation is in place but program rules are still being developed at the PUC. Early-mover positioning has value, but there is no live offtake path today.`
  } else {
    if (technology === 'Community Solar') {
      headline = `No community solar framework exists in ${stateName}. This market is not viable for CS development without a policy change — monitor for legislative activity.`
    } else {
      headline = `${stateName} has no community solar program, but ${technology} projects may still find a path through direct utility contracts or virtual PPAs depending on the county.`
    }
  }

  // ── Project-specific qualifier ──────────────────────────────────────────────
  let qualifier = ''
  if (csStatus === 'active' && capacityMW > 0 && mwNum > 0) {
    const pct = ((mwNum / capacityMW) * 100)
    if (pct < 0.5) {
      qualifier = ` At ${mw}MW, your project is a negligible draw on the ${capacityMW.toLocaleString()}MW remaining — no capacity risk.`
    } else if (pct < 3) {
      qualifier = ` At ${mw}MW, you'd represent ${pct.toFixed(1)}% of remaining capacity — a small, low-risk position.`
    } else if (pct < 10) {
      qualifier = ` At ${mw}MW, your project consumes ${pct.toFixed(1)}% of remaining capacity — meaningful exposure to program fluctuations worth monitoring.`
    } else {
      qualifier = ` At ${mw}MW, your project would take ${pct.toFixed(1)}% of remaining capacity — significant concentration risk if the program contracts or pauses enrollment.`
    }
  }

  // ── LMI note ────────────────────────────────────────────────────────────────
  let lmiNote = ''
  if (technology === 'Community Solar' && lmiRequired) {
    if (lmiPercent >= 50) {
      lmiNote = ` The ${lmiPercent}% LMI requirement is a real execution constraint — subscriber sourcing complexity will affect your timeline and cost structure.`
    } else if (lmiPercent >= 30) {
      lmiNote = ` LMI allocation at ${lmiPercent}% is required — factor in subscriber program costs and sourcing timelines.`
    } else {
      lmiNote = ` ${lmiPercent}% LMI allocation required — manageable with the right subscriber program partner.`
    }
  }

  // ── Stage note ──────────────────────────────────────────────────────────────
  let stageNote = ''
  if (stage === 'Pre-Development' && (ixDifficulty === 'hard' || ixDifficulty === 'very_hard')) {
    stageNote = ` In active interconnection here, model upgrade costs before your next milestone — the ease score is a leading indicator.`
  } else if ((stage === 'Prospecting' || stage === 'Site Control') && csStatus === 'limited') {
    stageNote = ` At this stage, confirm program availability directly with your state PUC before committing resources to site control.`
  } else if (stage === 'Prospecting' && csStatus === 'pending') {
    stageNote = ` Early pipeline positioning makes sense, but don't commit capital until program rules are finalized.`
  }

  const summary = headline + qualifier + lmiNote + stageNote

  // ── Signal chips ─────────────────────────────────────────────────────────────
  // V3: cut signals that restate the header status badge, IX card badge, or score
  // gauge. Only emit signals that add context not visible elsewhere on the page.
  const signals = []

  // Capacity-as-percentage of remaining program capacity (unique — not in any card)
  if (csStatus === 'active' && capacityMW > 0 && mwNum > 0) {
    const pct = (mwNum / capacityMW) * 100
    if (pct >= 10) {
      signals.push({ label: `${pct.toFixed(1)}% of remaining capacity`, color: 'red' })
    } else if (pct >= 3) {
      signals.push({ label: `${pct.toFixed(1)}% of remaining capacity`, color: 'amber' })
    }
  }

  // Limited program with concrete MW left (urgency signal not in header)
  if (csStatus === 'limited' && capacityMW > 0) {
    signals.push({ label: `${capacityMW.toLocaleString()}MW left in program`, color: 'amber' })
  }

  // Pending program — urgency signal
  if (csStatus === 'pending') {
    signals.push({ label: 'No live offtake path yet', color: 'yellow' })
  }

  // Queue (only when status differs from IX difficulty signal — adds dimension)
  if (queueStatus !== 'unknown') {
    const qLabel = { open: 'Queue Open', limited: 'Queue Limited', saturated: 'Queue Saturated' }
    const qColor = { open: 'green', limited: 'amber', saturated: 'red' }
    if (qLabel[queueStatus]) {
      signals.push({ label: qLabel[queueStatus], color: qColor[queueStatus] || 'gray' })
    }
  }

  // LMI subscriber count derivative (concrete number — more useful than the % alone)
  if (technology === 'Community Solar' && lmiRequired && lmiPercent > 0 && mwNum > 0) {
    const lmiMW = mwNum * (lmiPercent / 100)
    const approxSubscribers = Math.round(lmiMW * 1000 / 2)
    const color = lmiPercent >= 40 ? 'orange' : 'amber'
    signals.push({ label: `~${approxSubscribers.toLocaleString()} LMI subscribers to source`, color })
  }

  return { verdict, verdictBg, verdictText, summary, signals }
}
