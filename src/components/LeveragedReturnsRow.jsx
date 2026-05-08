// Project finance row — surfaces IRR (project), IRR (equity, leveraged),
// and DSCR (year 1) on the OfftakeCard tech panels. Reads
// scenarioEngine.computeLifecycleMetrics outputs (passed in via props) so
// there's a single source of truth: same numbers the Scenario Studio + PDF
// export + shared memos all show.
//
// Capital structure assumed: 70/30 debt:equity, 6.5% all-in rate, 18-yr
// amortization (typical IPP project finance norms — documented in
// scenarioEngine.js INDUSTRY_BASELINE).
//
// Display rule: any IRR ≤ 0 renders as '—'. A negative or zero return on
// the headline panel is noise — underwriters care about whether the deal
// pencils, not by how much it doesn't. The Scenario Studio still shows
// raw negative values because there the user is sensitivity-testing
// directional impact and "−5% from baseline" is a real signal.
export default function LeveragedReturnsRow({ outputs, accentColor = '#0F766E' }) {
  if (!outputs) return null
  const { irr, equityIrr, dscr } = outputs
  if (irr == null && equityIrr == null && dscr == null) return null

  const fmtPct  = (v) => (v == null || v <= 0 ? '—' : `${(v * 100).toFixed(1)}%`)
  const fmtDscr = (v) => (v == null ? '—' : `${v.toFixed(2)}x`)
  // Lender threshold convention: <1.20 = tight, >=1.30 = healthy.
  const dscrColor = dscr == null ? accentColor : dscr < 1.20 ? '#DC2626' : dscr >= 1.30 ? '#059669' : '#D97706'
  const dscrSuffix = dscr == null ? '' : dscr < 1.20 ? ' tight' : dscr >= 1.30 ? ' healthy' : ''

  return (
    <div className="px-4 py-2.5 bg-white border-t border-gray-100">
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Project Finance</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-gray-500">IRR · project</p>
          <p className="text-sm font-bold tabular-nums mt-0.5" style={{ color: accentColor }}>{fmtPct(irr)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500">IRR · equity <span className="text-gray-400">(70/30 lev)</span></p>
          <p className="text-sm font-bold tabular-nums mt-0.5" style={{ color: accentColor }}>{fmtPct(equityIrr)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500">DSCR · year 1</p>
          <p className="text-sm font-bold tabular-nums mt-0.5" style={{ color: dscrColor }}>
            {fmtDscr(dscr)}<span className="text-[10px] font-normal text-gray-400 ml-1">{dscrSuffix}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
