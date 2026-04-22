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
