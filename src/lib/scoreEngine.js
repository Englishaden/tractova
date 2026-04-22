export const STAGE_MODIFIERS = {
  'Prospecting':              [  0,   0,   0 ],
  'Site Control':             [  0, +10, +15 ],
  'Pre-Development':          [  0,   0, +20 ],
  'Development':              [ +5,   0, +25 ],
  'NTP (Notice to Proceed)':  [ +8,  -5, +25 ],
  'Construction':             [+10,  -8, +25 ],
  'Operational':              [+10, +10, +25 ],
}

// Retail rate tiers for C&I offtake scoring (higher rates = better C&I economics)
const CI_OFFTAKE_SCORES = {
  NY: 82, MA: 85, NJ: 78, CT: 80,  // High-rate states
  IL: 65, MD: 64, CO: 60, ME: 68,  // Medium-rate states
  MN: 55, VA: 58, OR: 56, WA: 52,  // Lower-rate states
}

// ISO capacity market tiers for BESS offtake scoring
const BESS_OFFTAKE_SCORES = {
  MA: 80, ME: 78,                   // ISO-NE
  IL: 75, NJ: 75, MD: 70,          // PJM
  NY: 72,                           // NYISO
  MN: 55, CO: 50,                   // MISO / SPP
}

export function computeSubScores(stateProgram, countyData, stage = '', technology = 'Community Solar') {
  if (!stateProgram) return { offtake: 0, ix: 0, site: 0 }

  let offtake, ix, site

  // ── Offtake sub-score (varies by tech type) ──
  if (technology === 'C&I Solar') {
    offtake = CI_OFFTAKE_SCORES[stateProgram.id] ?? 55
  } else if (technology === 'BESS') {
    offtake = BESS_OFFTAKE_SCORES[stateProgram.id] ?? 45
  } else if (technology === 'Hybrid') {
    const csBase = { active: 80, limited: 52, pending: 25, none: 8 }
    const csOfftake = csBase[stateProgram.csStatus] ?? 8
    const bessOfftake = BESS_OFFTAKE_SCORES[stateProgram.id] ?? 45
    offtake = Math.min(85, Math.round((csOfftake + bessOfftake) / 2))
  } else {
    // Community Solar (default)
    const csBase = { active: 80, limited: 52, pending: 25, none: 8 }
    offtake = csBase[stateProgram.csStatus] ?? 8
    if (stateProgram.csStatus === 'active' && stateProgram.capacityMW > 500) offtake += 8
    if (stateProgram.lmiRequired && stateProgram.lmiPercent >= 40) offtake -= 10
    else if (stateProgram.lmiRequired && stateProgram.lmiPercent >= 25) offtake -= 5
  }

  // ── IX sub-score (adjusted by tech type) ──
  ix = { easy: 88, moderate: 65, hard: 38, very_hard: 14 }[stateProgram.ixDifficulty] ?? 50
  if (technology === 'BESS') ix += 5          // Storage typically has faster IX studies
  else if (technology === 'Hybrid') ix -= 5   // Combined resources = more complex IX

  // ── Site sub-score (adjusted by tech type) ──
  site = 60
  if (countyData?.siteControl) {
    const { availableLand, wetlandWarning } = countyData.siteControl
    if (technology === 'BESS') {
      // BESS needs much less land (1-2 acres/MW vs 5-7 for solar)
      if (!wetlandWarning) site = 78
      else site = 58
    } else {
      if (availableLand && !wetlandWarning)  site = 82
      else if (availableLand && wetlandWarning)  site = 56
      else if (!availableLand && !wetlandWarning) site = 42
      else site = 26
    }
  }

  // ── Stage modifiers ──
  const [dOft, dIX, dSite] = STAGE_MODIFIERS[stage] ?? [0, 0, 0]
  offtake = Math.max(0, Math.min(100, offtake + dOft))
  ix      = Math.max(0, Math.min(100, ix      + dIX))
  site    = Math.max(0, Math.min(100, site    + dSite))

  return { offtake, ix, site }
}

export function computeDisplayScore(offtake, ix, site) {
  return Math.round(offtake * 0.40 + ix * 0.35 + site * 0.25)
}
