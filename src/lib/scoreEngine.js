export const STAGE_MODIFIERS = {
  'Prospecting':              [  0,   0,   0 ],
  'Site Control':             [  0, +10, +15 ],
  'Pre-Development':          [  0,   0, +20 ],
  'Development':              [ +5,   0, +25 ],
  'NTP (Notice to Proceed)':  [ +8,  -5, +25 ],
  'Construction':             [+10,  -8, +25 ],
  'Operational':              [+10, +10, +25 ],
}

export function computeSubScores(stateProgram, countyData, stage = '') {
  if (!stateProgram) return { offtake: 0, ix: 0, site: 0 }

  const csBase = { active: 80, limited: 52, pending: 25, none: 8 }
  let offtake = csBase[stateProgram.csStatus] ?? 8
  if (stateProgram.csStatus === 'active' && stateProgram.capacityMW > 500) offtake += 8
  if (stateProgram.lmiRequired && stateProgram.lmiPercent >= 40) offtake -= 10
  else if (stateProgram.lmiRequired && stateProgram.lmiPercent >= 25) offtake -= 5

  let ix = { easy: 88, moderate: 65, hard: 38, very_hard: 14 }[stateProgram.ixDifficulty] ?? 50

  let site = 60
  if (countyData?.siteControl) {
    const { availableLand, wetlandWarning } = countyData.siteControl
    if (availableLand && !wetlandWarning)  site = 82
    else if (availableLand && wetlandWarning)  site = 56
    else if (!availableLand && !wetlandWarning) site = 42
    else site = 26
  }

  const [dOft, dIX, dSite] = STAGE_MODIFIERS[stage] ?? [0, 0, 0]
  offtake = Math.max(0, Math.min(100, offtake + dOft))
  ix      = Math.max(0, Math.min(100, ix      + dIX))
  site    = Math.max(0, Math.min(100, site    + dSite))

  return { offtake, ix, site }
}

export function computeDisplayScore(offtake, ix, site) {
  return Math.round(offtake * 0.40 + ix * 0.35 + site * 0.25)
}
