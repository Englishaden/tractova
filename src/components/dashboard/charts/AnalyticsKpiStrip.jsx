import { useEffect, useState, useMemo } from 'react'
import { getCsProjectsAggByState } from '../../../lib/programData'
import KPISparkline from '../../charts/KPISparkline'
import CountUp from '../../ui/CountUp'

// AnalyticsKpiStrip — compact KPI summary row that anchors the Analytics tab
// (the "overview always visible" pattern). Big mono number + inline sparkline.
//
// Filter-aware: the headline figures recompute from the selected states. The
// sparklines show the NATIONAL 8-week trend (the real series we have); to stay
// honest, a sparkline only renders when no filter is active — under a filter we
// show a "n selected" note instead of implying the national trend matches the
// subset.
//
// Data: programs (state_programs) + cs_projects agg + getDashboardMetricsHistory.

function KpiTile({ label, value, suffix = '', decimals = 0, series, sparkColor, tag, note }) {
  const showSpark = Array.isArray(series) && series.length >= 2
  return (
    <div
      className="relative overflow-hidden rounded-md px-3 py-2.5 flex flex-col justify-between"
      style={{ background: 'var(--cards-bg, #131C2C)', border: '1px solid var(--cards-border, #1F2A3D)', minHeight: 92 }}
    >
      <div className="h-px absolute top-0 left-0 right-0" style={{ background: 'linear-gradient(90deg, transparent 0%, var(--hairline-teal, rgba(20,184,166,0.45)) 50%, transparent 100%)' }} />
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold truncate" style={{ color: 'var(--text-label, #98A4B6)' }}>
          {label}
        </span>
        {tag && (
          <span className="font-mono text-[8px] uppercase tracking-[0.14em] px-1 py-px rounded shrink-0" style={{ color: 'var(--text-muted, #6C7A91)', border: '1px solid var(--cards-border, #1F2A3D)' }}>
            {tag}
          </span>
        )}
      </div>
      <div className="mt-1">
        <span className="font-mono text-[22px] leading-none font-bold" style={{ color: 'var(--text-primary, #F5F7FA)' }}>
          <CountUp value={Number(value) || 0} decimals={decimals} />
        </span>
        {suffix && <span className="font-mono text-[10px] ml-1" style={{ color: 'var(--text-muted, #6C7A91)' }}>{suffix}</span>}
      </div>
      <div className="mt-1.5 h-[26px]">
        {showSpark
          ? <KPISparkline data={series} color={sparkColor} height={26} compact ariaLabel={`${label} trend`} />
          : <span className="font-mono text-[9px]" style={{ color: 'var(--text-muted, #6C7A91)' }}>{note || ''}</span>}
      </div>
    </div>
  )
}

export default function AnalyticsKpiStrip({ programs = [], filterStates = [], history = null }) {
  const [csRows, setCsRows] = useState([])

  useEffect(() => {
    let cancelled = false
    getCsProjectsAggByState()
      .then((d) => { if (!cancelled) setCsRows(d || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const m = useMemo(() => {
    const set = new Set(filterStates)
    const inFilter = (id) => set.size === 0 || set.has(id)
    const fp = programs.filter((p) => inFilter(p.id))
    const activeCS = fp.filter((p) => p.csStatus === 'active').length
    const anyCS = fp.filter((p) => p.csStatus && p.csStatus !== 'none').length
    const totalMW = fp
      .filter((p) => p.csStatus === 'active' || p.csStatus === 'limited')
      .reduce((s, p) => s + (p.capacityMW || 0), 0)
    const projects = csRows.filter((r) => inFilter(r.stateId)).reduce((s, r) => s + (r.count || 0), 0)
    const pulse = history?.policyPulseByPillar || []
    const lastWk = pulse[pulse.length - 1]
    const signals = lastWk ? (lastWk.offtake || 0) + (lastWk.ix || 0) + (lastWk.site || 0) + (lastWk.policy || 0) : 0
    return { activeCS, anyCS, totalMW, projects, signals }
  }, [programs, filterStates, csRows, history])

  const unfiltered = filterStates.length === 0
  const nSel = filterStates.length
  const selNote = unfiltered ? '' : `${nSel} state${nSel === 1 ? '' : 's'} selected`

  const csCoverage = unfiltered ? (history?.csCoverage || []) : []
  const pipelineLoad = unfiltered ? (history?.pipelineLoad || []) : []
  const policySeries = unfiltered
    ? (history?.policyPulseByPillar || []).map((w) => ({ week: w.week, value: (w.offtake || 0) + (w.ix || 0) + (w.site || 0) + (w.policy || 0) }))
    : []

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      <KpiTile label="Active CS States" value={m.activeCS} series={csCoverage} sparkColor="#14B8A6" note={selNote || '8-week trend'} />
      <KpiTile label="Authorized MW" value={m.totalMW} suffix="MW" series={pipelineLoad} sparkColor="#FBBF24" note={selNote || '8-week trend'} />
      <KpiTile label="Operating Projects" value={m.projects} tag="LBNL Q4 ’24" note={selNote || 'deployment ground truth'} />
      <KpiTile label="States w/ Any Program" value={m.anyCS} suffix="states" note={selNote || 'active · limited · pending'} />
      <KpiTile label="Signals / Week" value={m.signals} tag="NATL" series={policySeries} sparkColor="#A78BFA" note="latest ISO week" />
    </div>
  )
}
