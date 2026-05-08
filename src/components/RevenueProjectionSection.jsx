import { computeRevenueProjection, hasRevenueData } from '../lib/revenueEngine'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip'
import { SectionLabel } from '../lib/searchShared.jsx'
import LeveragedReturnsRow from './LeveragedReturnsRow'

export default function RevenueProjectionSection({ stateId, mw, rates, lifecycleOutputs = null }) {
  const proj = computeRevenueProjection(stateId, mw, rates)
  if (!proj) {
    if (!hasRevenueData(stateId)) return null
    return (
      <div>
        <SectionLabel>Revenue Projection</SectionLabel>
        <p className="text-xs text-gray-400 italic">Enter project MW above to see estimated annual revenue.</p>
      </div>
    )
  }

  const fmt = (n) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : `$${n.toLocaleString()}`
  const streams = [
    { label: 'Bill Credits', value: proj.billCreditRevenue, color: '#059669', detail: `${proj.billCreditCentsKwh}¢/kWh` },
    { label: 'REC / SREC',   value: proj.recRevenue,        color: '#7C3AED', detail: proj.recPerMwh > 0 ? `$${proj.recPerMwh}/MWh` : 'N/A' },
    { label: 'ITC (ann.)',    value: proj.itcAnnualized,     color: '#2563EB', detail: `${proj.itcTotalPct}% over 6yr` },
  ]
  const total = proj.annualGrossRevenue

  return (
    <div>
      <SectionLabel>Revenue Projection</SectionLabel>
      <div
        className="rounded-lg overflow-hidden"
        style={{ border: '1px solid rgba(20,184,166,0.25)', borderLeft: '3px solid #0F766E' }}
      >
        {/* Headline */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(20,184,166,0.06)' }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Est. Annual Revenue</p>
            <p className="text-xl font-bold text-gray-900 tabular-nums mt-0.5">{fmt(total)}<span className="text-xs font-normal text-gray-400 ml-1">/ year</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Per MW</p>
            <p className="text-lg font-bold tabular-nums mt-0.5" style={{ color: '#0F766E' }}>{fmt(proj.revenuePerMW)}</p>
          </div>
        </div>

        {/* Stream breakdown bar */}
        <div className="px-4 py-2" style={{ background: 'rgba(20,184,166,0.03)' }}>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
            {streams.map(s => s.value > 0 && (
              <div
                key={s.label}
                className="rounded-full"
                style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-2">
            {streams.map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-[10px] text-gray-500">{s.label}</span>
                <span className="text-[10px] font-semibold text-gray-700 tabular-nums">{fmt(s.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detail rows */}
        <div className="px-4 py-2.5 space-y-1.5 bg-white">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Annual generation</span>
            <span className="font-semibold text-gray-700 tabular-nums">{proj.annualMWh.toLocaleString()} MWh</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-gray-500 cursor-help inline-flex items-center gap-1">
                  Capacity factor
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">
                <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>NREL PVWatts state average</p>
                <p>Capacity factor varies materially by state — fixed-tilt PV in CO (~20%) vs MA (~16.5%) vs MN (~16%). We seed per-state averages from NREL PVWatts and refresh quarterly.</p>
                <p className="mt-1.5 text-gray-400">Site-specific factors (tilt, orientation, soiling, snow loss) can shift this ±2 pts. A real PVsyst run on the candidate parcel is the bankable number.</p>
              </TooltipContent>
            </Tooltip>
            <span className="font-semibold text-gray-700 tabular-nums">{proj.capacityFactor}% <span className="font-normal text-gray-400 text-[10px]">· NREL PVWatts</span></span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Installed cost (est.)</span>
            <span className="font-semibold text-gray-700 tabular-nums">{fmt(proj.installedCostTotal)} <span className="font-normal text-gray-400">@ ${proj.installedCostPerWatt}/W</span></span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">ITC value (one-time)</span>
            <span className="font-semibold tabular-nums" style={{ color: '#2563EB' }}>{fmt(proj.itcValueOneTime)}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-gray-100">
            <span className="text-gray-500">25-year NPV <span className="text-gray-400">(8% discount)</span></span>
            <span className="font-bold text-gray-900 tabular-nums">{fmt(proj.npv25)}</span>
          </div>
        </div>

        <LeveragedReturnsRow outputs={lifecycleOutputs} accentColor="#0F766E" />

        {/* Source note */}
        <div className="px-4 py-2 border-t border-gray-100">
          <p className="text-[9px] text-gray-400 leading-relaxed">{proj.notes}</p>
          <p className="text-[9px] text-gray-300 mt-0.5">Estimates only — actual revenue depends on contracted rates, PPA terms, and market conditions.</p>
        </div>
      </div>
    </div>
  )
}
