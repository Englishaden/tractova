// Revenue projection engine for community solar projects.
// Uses state-level rate data to estimate annual $/MW revenue from each stream.
// Data sources: NREL benchmarks, Illinois Shines REC prices, NYSERDA VDER,
// MA SMART, MN VOS, CO community solar tariffs. Updated 2026-04.

const STATE_REVENUE_DATA = {
  IL: {
    billCreditCentsKwh: 8.2,
    recPerMwh: 71.50,
    itcPct: 30,
    itcAdderPct: 10,
    capacityFactorPct: 17.5,
    installedCostPerWatt: 1.65,
    degradationPct: 0.5,
    label: 'Illinois (ComEd territory)',
    notes: 'Bill credit = supply + transmission (~8.2¢/kWh ComEd). REC via Illinois Shines (~$71.50/REC). ITC 30% + 10% LMI adder if qualifying.',
  },
  NY: {
    billCreditCentsKwh: 10.5,
    recPerMwh: 0,
    itcPct: 30,
    itcAdderPct: 10,
    capacityFactorPct: 16.0,
    installedCostPerWatt: 1.80,
    degradationPct: 0.5,
    label: 'New York (ConEd territory)',
    notes: 'Value Stack compensation (~10.5¢/kWh blended LBMP + ICAP + E + DRV). No separate SREC market. ITC 30% + Community Adder where available.',
  },
  MA: {
    billCreditCentsKwh: 12.8,
    recPerMwh: 35.00,
    itcPct: 30,
    itcAdderPct: 10,
    capacityFactorPct: 16.5,
    installedCostPerWatt: 1.75,
    degradationPct: 0.5,
    label: 'Massachusetts (SMART 3.0)',
    notes: 'Net metering credit ~12.8¢/kWh. SMART 3.0 adder varies by tranche. SREC-II traded ~$35/MWh. ITC 30% + LMI adder potential.',
  },
  MN: {
    billCreditCentsKwh: 9.5,
    recPerMwh: 4.50,
    itcPct: 30,
    itcAdderPct: 0,
    capacityFactorPct: 16.0,
    installedCostPerWatt: 1.60,
    degradationPct: 0.5,
    label: 'Minnesota (Xcel Energy)',
    notes: 'Value-of-Solar rate ~9.5¢/kWh (Xcel). Minimal REC market (~$4.50/MWh). ITC 30% base, no state adder currently.',
  },
  CO: {
    billCreditCentsKwh: 8.8,
    recPerMwh: 3.00,
    itcPct: 30,
    itcAdderPct: 0,
    capacityFactorPct: 20.0,
    installedCostPerWatt: 1.55,
    degradationPct: 0.5,
    label: 'Colorado (Xcel Energy)',
    notes: 'Bill credit ~8.8¢/kWh. Minimal REC value (~$3/MWh). Strong irradiance drives higher capacity factor (~20%). ITC 30%.',
  },
  NJ: {
    billCreditCentsKwh: 11.0,
    recPerMwh: 85.00,
    itcPct: 30,
    itcAdderPct: 10,
    capacityFactorPct: 16.5,
    installedCostPerWatt: 1.70,
    degradationPct: 0.5,
    label: 'New Jersey (SREC-II / SuSI)',
    notes: 'Net metering ~11¢/kWh. SREC-II / SuSI market ~$85/MWh — one of the strongest REC markets. ITC 30% + LMI adder.',
  },
  ME: {
    billCreditCentsKwh: 9.0,
    recPerMwh: 8.00,
    itcPct: 30,
    itcAdderPct: 0,
    capacityFactorPct: 15.5,
    installedCostPerWatt: 1.70,
    degradationPct: 0.5,
    label: 'Maine',
    notes: 'Bill credit ~9¢/kWh. Modest REC value. ITC 30%.',
  },
  MD: {
    billCreditCentsKwh: 9.5,
    recPerMwh: 55.00,
    itcPct: 30,
    itcAdderPct: 10,
    capacityFactorPct: 17.0,
    installedCostPerWatt: 1.65,
    degradationPct: 0.5,
    label: 'Maryland',
    notes: 'Bill credit ~9.5¢/kWh. SREC market ~$55/MWh. ITC 30% + LMI adder. Community Solar Pilot Program.',
  },
}

// ── C&I Solar revenue data (PPA-based model) ─────────────────────────────────
const CI_REVENUE_DATA = {
  IL: { ppaRateCentsKwh: 7.0, escalatorPct: 2.0, installedCostPerWatt: 2.20, itcPct: 30, capacityFactorPct: 17.5, degradationPct: 0.5, retailRateCentsKwh: 12.5, label: 'Illinois (C&I PPA)' },
  NY: { ppaRateCentsKwh: 8.0, escalatorPct: 2.0, installedCostPerWatt: 2.40, itcPct: 30, capacityFactorPct: 16.0, degradationPct: 0.5, retailRateCentsKwh: 18.5, label: 'New York (C&I PPA)' },
  MA: { ppaRateCentsKwh: 8.5, escalatorPct: 1.5, installedCostPerWatt: 2.35, itcPct: 30, capacityFactorPct: 16.5, degradationPct: 0.5, retailRateCentsKwh: 22.0, label: 'Massachusetts (C&I PPA)' },
  MN: { ppaRateCentsKwh: 6.5, escalatorPct: 2.0, installedCostPerWatt: 2.10, itcPct: 30, capacityFactorPct: 16.0, degradationPct: 0.5, retailRateCentsKwh: 11.0, label: 'Minnesota (C&I PPA)' },
  CO: { ppaRateCentsKwh: 6.0, escalatorPct: 2.5, installedCostPerWatt: 2.00, itcPct: 30, capacityFactorPct: 20.0, degradationPct: 0.5, retailRateCentsKwh: 12.0, label: 'Colorado (C&I PPA)' },
  NJ: { ppaRateCentsKwh: 7.5, escalatorPct: 2.0, installedCostPerWatt: 2.30, itcPct: 30, capacityFactorPct: 16.5, degradationPct: 0.5, retailRateCentsKwh: 16.0, label: 'New Jersey (C&I PPA)' },
  ME: { ppaRateCentsKwh: 6.5, escalatorPct: 1.5, installedCostPerWatt: 2.15, itcPct: 30, capacityFactorPct: 15.5, degradationPct: 0.5, retailRateCentsKwh: 15.5, label: 'Maine (C&I PPA)' },
  MD: { ppaRateCentsKwh: 7.0, escalatorPct: 2.0, installedCostPerWatt: 2.20, itcPct: 30, capacityFactorPct: 17.0, degradationPct: 0.5, retailRateCentsKwh: 13.5, label: 'Maryland (C&I PPA)' },
}

// ── BESS revenue data (capacity market + demand charge + arbitrage) ───────────
const BESS_REVENUE_DATA = {
  IL:  { isoRegion: 'PJM',    capacityPerKwYear: 65, demandChargePerKwMonth: 12, arbitragePerMwh: 30, installedCostPerKwh: 380, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Illinois (PJM)' },
  NY:  { isoRegion: 'NYISO',  capacityPerKwYear: 70, demandChargePerKwMonth: 14, arbitragePerMwh: 35, installedCostPerKwh: 400, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'New York (NYISO)' },
  MA:  { isoRegion: 'ISO-NE', capacityPerKwYear: 80, demandChargePerKwMonth: 13, arbitragePerMwh: 32, installedCostPerKwh: 410, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Massachusetts (ISO-NE)' },
  MN:  { isoRegion: 'MISO',   capacityPerKwYear: 40, demandChargePerKwMonth: 10, arbitragePerMwh: 22, installedCostPerKwh: 360, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Minnesota (MISO)' },
  CO:  { isoRegion: 'SPP',    capacityPerKwYear: 35, demandChargePerKwMonth: 11, arbitragePerMwh: 25, installedCostPerKwh: 350, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Colorado (SPP)' },
  NJ:  { isoRegion: 'PJM',    capacityPerKwYear: 70, demandChargePerKwMonth: 15, arbitragePerMwh: 32, installedCostPerKwh: 390, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'New Jersey (PJM)' },
  ME:  { isoRegion: 'ISO-NE', capacityPerKwYear: 75, demandChargePerKwMonth: 11, arbitragePerMwh: 28, installedCostPerKwh: 400, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Maine (ISO-NE)' },
  MD:  { isoRegion: 'PJM',    capacityPerKwYear: 60, demandChargePerKwMonth: 13, arbitragePerMwh: 28, installedCostPerKwh: 375, roundTripEfficiency: 0.87, annualDegradationPct: 2.5, itcPct: 30, label: 'Maryland (PJM)' },
}

const HOURS_PER_YEAR = 8760

export function getRevenueData(stateId) {
  return STATE_REVENUE_DATA[stateId] ?? null
}

export function hasRevenueData(stateId) {
  return stateId in STATE_REVENUE_DATA
}

export function getSupportedStates() {
  return Object.entries(STATE_REVENUE_DATA).map(([id, d]) => ({ id, label: d.label }))
}

export function computeRevenueProjection(stateId, mwAC) {
  const data = STATE_REVENUE_DATA[stateId]
  if (!data || !mwAC || mwAC <= 0) return null

  const mw = parseFloat(mwAC)
  const cf = data.capacityFactorPct / 100
  const annualMWh = mw * HOURS_PER_YEAR * cf
  const annualKWh = annualMWh * 1000

  // Bill credit revenue (annual)
  const billCreditRevenue = annualKWh * (data.billCreditCentsKwh / 100)

  // REC/SREC revenue (annual)
  const recRevenue = annualMWh * data.recPerMwh

  // ITC value (one-time, amortized over 6 years for display)
  const installedCostTotal = mw * 1000000 * data.installedCostPerWatt
  const itcTotalPct = data.itcPct + data.itcAdderPct
  const itcValueOneTime = installedCostTotal * (itcTotalPct / 100)
  const itcAnnualized = itcValueOneTime / 6

  // Totals
  const annualGrossRevenue = billCreditRevenue + recRevenue + itcAnnualized
  const revenuePerMW = annualGrossRevenue / mw

  // 25-year NPV at 8% discount rate
  const discountRate = 0.08
  let npv25 = 0
  for (let year = 1; year <= 25; year++) {
    const degradation = Math.pow(1 - data.degradationPct / 100, year - 1)
    const yearBillCredit = billCreditRevenue * degradation
    const yearREC = recRevenue * degradation
    const yearITC = year <= 6 ? itcAnnualized : 0
    const yearTotal = yearBillCredit + yearREC + yearITC
    npv25 += yearTotal / Math.pow(1 + discountRate, year)
  }

  return {
    stateId,
    stateLabel: data.label,
    mw,
    capacityFactor: data.capacityFactorPct,
    annualMWh: Math.round(annualMWh),
    billCreditRevenue: Math.round(billCreditRevenue),
    recRevenue: Math.round(recRevenue),
    itcValueOneTime: Math.round(itcValueOneTime),
    itcAnnualized: Math.round(itcAnnualized),
    itcTotalPct,
    annualGrossRevenue: Math.round(annualGrossRevenue),
    revenuePerMW: Math.round(revenuePerMW),
    npv25: Math.round(npv25),
    installedCostPerWatt: data.installedCostPerWatt,
    installedCostTotal: Math.round(installedCostTotal),
    notes: data.notes,
    billCreditCentsKwh: data.billCreditCentsKwh,
    recPerMwh: data.recPerMwh,
  }
}

// ── C&I Solar projection (PPA-based) ─────────────────────────────────────────
export function getCIRevenueData(stateId) {
  return CI_REVENUE_DATA[stateId] ?? null
}

export function hasCIRevenueData(stateId) {
  return stateId in CI_REVENUE_DATA
}

export function computeCIRevenueProjection(stateId, mwAC) {
  const data = CI_REVENUE_DATA[stateId]
  if (!data || !mwAC || mwAC <= 0) return null

  const mw = parseFloat(mwAC)
  const cf = data.capacityFactorPct / 100
  const annualMWh = mw * HOURS_PER_YEAR * cf
  const annualKWh = annualMWh * 1000

  const ppaRevenue = annualKWh * (data.ppaRateCentsKwh / 100)
  const installedCostTotal = mw * 1000000 * data.installedCostPerWatt
  const itcValueOneTime = installedCostTotal * (data.itcPct / 100)
  const itcAnnualized = itcValueOneTime / 6

  const annualGrossRevenue = ppaRevenue + itcAnnualized
  const savingsPercent = Math.round((1 - data.ppaRateCentsKwh / data.retailRateCentsKwh) * 100)

  const discountRate = 0.08
  let npv25 = 0
  for (let year = 1; year <= 25; year++) {
    const degradation = Math.pow(1 - data.degradationPct / 100, year - 1)
    const escalator = Math.pow(1 + data.escalatorPct / 100, year - 1)
    const yearPPA = ppaRevenue * degradation * escalator
    const yearITC = year <= 6 ? itcAnnualized : 0
    npv25 += (yearPPA + yearITC) / Math.pow(1 + discountRate, year)
  }

  return {
    stateId,
    stateLabel: data.label,
    mw,
    capacityFactor: data.capacityFactorPct,
    annualMWh: Math.round(annualMWh),
    ppaRevenue: Math.round(ppaRevenue),
    ppaRateCentsKwh: data.ppaRateCentsKwh,
    retailRateCentsKwh: data.retailRateCentsKwh,
    savingsPercent,
    escalatorPct: data.escalatorPct,
    itcPct: data.itcPct,
    itcValueOneTime: Math.round(itcValueOneTime),
    itcAnnualized: Math.round(itcAnnualized),
    annualGrossRevenue: Math.round(annualGrossRevenue),
    revenuePerMW: Math.round(annualGrossRevenue / mw),
    npv25: Math.round(npv25),
    installedCostPerWatt: data.installedCostPerWatt,
    installedCostTotal: Math.round(installedCostTotal),
  }
}

// ── BESS projection (capacity market + demand charge + arbitrage) ─────────────
export function getBESSRevenueData(stateId) {
  return BESS_REVENUE_DATA[stateId] ?? null
}

export function hasBESSRevenueData(stateId) {
  return stateId in BESS_REVENUE_DATA
}

export function computeBESSProjection(stateId, mwAC, durationHrs = 4) {
  const data = BESS_REVENUE_DATA[stateId]
  if (!data || !mwAC || mwAC <= 0) return null

  const mw = parseFloat(mwAC)
  const kw = mw * 1000
  const mwh = mw * durationHrs

  const capacityRevenue = kw * data.capacityPerKwYear
  const demandChargeRevenue = kw * data.demandChargePerKwMonth * 12
  const arbitrageRevenue = mwh * data.arbitragePerMwh * 365 * data.roundTripEfficiency
  const annualGrossRevenue = capacityRevenue + demandChargeRevenue + arbitrageRevenue

  const installedCostTotal = mwh * 1000 * data.installedCostPerKwh
  const itcValueOneTime = installedCostTotal * (data.itcPct / 100)
  const itcAnnualized = itcValueOneTime / 6

  const discountRate = 0.08
  let npv15 = 0
  for (let year = 1; year <= 15; year++) {
    const degradation = Math.pow(1 - data.annualDegradationPct / 100, year - 1)
    const yearRevenue = (capacityRevenue + demandChargeRevenue + arbitrageRevenue * degradation)
    const yearITC = year <= 6 ? itcAnnualized : 0
    npv15 += (yearRevenue + yearITC) / Math.pow(1 + discountRate, year)
  }

  const paybackYears = annualGrossRevenue > 0 ? Math.round((installedCostTotal - itcValueOneTime) / annualGrossRevenue * 10) / 10 : null

  return {
    stateId,
    stateLabel: data.label,
    mw,
    durationHrs,
    mwh,
    isoRegion: data.isoRegion,
    capacityRevenue: Math.round(capacityRevenue),
    demandChargeRevenue: Math.round(demandChargeRevenue),
    arbitrageRevenue: Math.round(arbitrageRevenue),
    annualGrossRevenue: Math.round(annualGrossRevenue),
    revenuePerMW: Math.round(annualGrossRevenue / mw),
    itcPct: data.itcPct,
    itcValueOneTime: Math.round(itcValueOneTime),
    itcAnnualized: Math.round(itcAnnualized),
    npv15: Math.round(npv15),
    installedCostPerKwh: data.installedCostPerKwh,
    installedCostTotal: Math.round(installedCostTotal),
    paybackYears,
    capacityPerKwYear: data.capacityPerKwYear,
    demandChargePerKwMonth: data.demandChargePerKwMonth,
    arbitragePerMwh: data.arbitragePerMwh,
  }
}

// ── Hybrid projection (solar + storage) ──────────────────────────────────────
export function computeHybridProjection(stateId, solarMW, storageMW, durationHrs = 4) {
  const csProj = computeRevenueProjection(stateId, solarMW)
  const bessProj = computeBESSProjection(stateId, storageMW, durationHrs)
  if (!csProj && !bessProj) return null

  const solarAnnual = csProj?.annualGrossRevenue || 0
  const storageAnnual = bessProj?.annualGrossRevenue || 0
  const storageItcBonus = bessProj ? Math.round(bessProj.installedCostTotal * 0.10) : 0
  const annualGrossRevenue = solarAnnual + storageAnnual
  const totalMW = (parseFloat(solarMW) || 0) + (parseFloat(storageMW) || 0)

  return {
    stateId,
    stateLabel: csProj?.stateLabel || bessProj?.stateLabel,
    solarMW: parseFloat(solarMW) || 0,
    storageMW: parseFloat(storageMW) || 0,
    durationHrs,
    solarAnnualRevenue: Math.round(solarAnnual),
    storageAnnualRevenue: Math.round(storageAnnual),
    annualGrossRevenue: Math.round(annualGrossRevenue),
    revenuePerMW: totalMW > 0 ? Math.round(annualGrossRevenue / totalMW) : 0,
    coLocationItcBonus: storageItcBonus,
    solarNpv25: csProj?.npv25 || 0,
    storageNpv15: bessProj?.npv15 || 0,
    solarInstalledCost: csProj?.installedCostTotal || 0,
    storageInstalledCost: bessProj?.installedCostTotal || 0,
    totalInstalledCost: (csProj?.installedCostTotal || 0) + (bessProj?.installedCostTotal || 0),
  }
}
