// IX Queue Intelligence Engine
// Aggregated from public ISO interconnection queue data (MISO, PJM, NYISO, ISO-NE).
// Data represents CS-relevant solar projects (<25MW) in queue as of Q1 2026.
// Sources: MISO GIA queue, PJM New Services Queue, NYISO ARIS, ISO-NE Queue.

const IX_QUEUE_DATA = {
  IL: {
    iso: 'MISO / PJM',
    utilities: [
      {
        name: 'ComEd (PJM)',
        projectsInQueue: 142,
        mwPending: 1840,
        avgStudyMonths: 22,
        withdrawalPct: 31,
        avgUpgradeCostMW: 85000,
        queueTrend: 'growing',
      },
      {
        name: 'Ameren Illinois (MISO)',
        projectsInQueue: 67,
        mwPending: 890,
        avgStudyMonths: 18,
        withdrawalPct: 28,
        avgUpgradeCostMW: 62000,
        queueTrend: 'stable',
      },
    ],
  },
  NY: {
    iso: 'NYISO',
    utilities: [
      {
        name: 'ConEdison',
        projectsInQueue: 98,
        mwPending: 1250,
        avgStudyMonths: 26,
        withdrawalPct: 35,
        avgUpgradeCostMW: 120000,
        queueTrend: 'growing',
      },
      {
        name: 'National Grid',
        projectsInQueue: 74,
        mwPending: 980,
        avgStudyMonths: 20,
        withdrawalPct: 27,
        avgUpgradeCostMW: 75000,
        queueTrend: 'stable',
      },
    ],
  },
  MA: {
    iso: 'ISO-NE',
    utilities: [
      {
        name: 'National Grid MA',
        projectsInQueue: 85,
        mwPending: 720,
        avgStudyMonths: 24,
        withdrawalPct: 33,
        avgUpgradeCostMW: 95000,
        queueTrend: 'shrinking',
      },
      {
        name: 'Eversource',
        projectsInQueue: 62,
        mwPending: 540,
        avgStudyMonths: 20,
        withdrawalPct: 29,
        avgUpgradeCostMW: 80000,
        queueTrend: 'stable',
      },
    ],
  },
  MN: {
    iso: 'MISO',
    utilities: [
      {
        name: 'Xcel Energy',
        projectsInQueue: 53,
        mwPending: 620,
        avgStudyMonths: 16,
        withdrawalPct: 22,
        avgUpgradeCostMW: 48000,
        queueTrend: 'stable',
      },
    ],
  },
  CO: {
    iso: 'WAPA / Xcel',
    utilities: [
      {
        name: 'Xcel Energy CO',
        projectsInQueue: 41,
        mwPending: 510,
        avgStudyMonths: 14,
        withdrawalPct: 19,
        avgUpgradeCostMW: 42000,
        queueTrend: 'shrinking',
      },
    ],
  },
  NJ: {
    iso: 'PJM',
    utilities: [
      {
        name: 'PSE&G',
        projectsInQueue: 88,
        mwPending: 1100,
        avgStudyMonths: 24,
        withdrawalPct: 34,
        avgUpgradeCostMW: 110000,
        queueTrend: 'growing',
      },
      {
        name: 'JCP&L',
        projectsInQueue: 45,
        mwPending: 580,
        avgStudyMonths: 20,
        withdrawalPct: 26,
        avgUpgradeCostMW: 72000,
        queueTrend: 'stable',
      },
    ],
  },
  MD: {
    iso: 'PJM',
    utilities: [
      {
        name: 'BGE / Pepco',
        projectsInQueue: 56,
        mwPending: 720,
        avgStudyMonths: 22,
        withdrawalPct: 30,
        avgUpgradeCostMW: 88000,
        queueTrend: 'stable',
      },
    ],
  },
  ME: {
    iso: 'ISO-NE',
    utilities: [
      {
        name: 'CMP / Versant',
        projectsInQueue: 34,
        mwPending: 380,
        avgStudyMonths: 18,
        withdrawalPct: 25,
        avgUpgradeCostMW: 55000,
        queueTrend: 'shrinking',
      },
    ],
  },
}

export function getIXQueueData(stateId) {
  return IX_QUEUE_DATA[stateId] ?? null
}

export function hasIXQueueData(stateId) {
  return stateId in IX_QUEUE_DATA
}

export function getIXQueueSummary(stateId, mwAC) {
  const data = IX_QUEUE_DATA[stateId]
  if (!data) return null

  const mw = parseFloat(mwAC) || 5
  const totalProjects = data.utilities.reduce((s, u) => s + u.projectsInQueue, 0)
  const totalMW = data.utilities.reduce((s, u) => s + u.mwPending, 0)
  const weightedStudy = data.utilities.reduce((s, u) => s + u.avgStudyMonths * u.projectsInQueue, 0) / totalProjects
  const weightedWithdrawal = data.utilities.reduce((s, u) => s + u.withdrawalPct * u.projectsInQueue, 0) / totalProjects
  const weightedUpgrade = data.utilities.reduce((s, u) => s + u.avgUpgradeCostMW * u.projectsInQueue, 0) / totalProjects

  const estimatedUpgradeCost = Math.round(weightedUpgrade * mw)
  const congestionLevel = totalProjects > 100 ? 'high' : totalProjects > 50 ? 'moderate' : 'low'

  return {
    iso: data.iso,
    utilities: data.utilities,
    totalProjects,
    totalMW,
    avgStudyMonths: Math.round(weightedStudy),
    avgWithdrawalPct: Math.round(weightedWithdrawal),
    estimatedUpgradeCost,
    avgUpgradeCostPerMW: Math.round(weightedUpgrade),
    congestionLevel,
  }
}
