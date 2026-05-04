import { useState, useEffect } from 'react'
import { getCsMarketSnapshot } from '../lib/programData'
import { LoadingDot } from './ui'

// Operating CS Projects panel — real ground-truth from NREL Sharing the Sun.
//
// Surfaces the state's actual operating CS market: project count, total
// operational MW, vintage range, recent activity (last 5 years), top
// developers, utility-type mix, LMI penetration, and a sample of nearest-MW
// projects to the user's target.
//
// This is hard signal vs synthesized comparable_deals — 3,800+ real
// projects with utility/developer attribution.

function fmtMW(n) {
  if (n == null) return '—'
  if (n >= 1000) return `${Math.round(n).toLocaleString()}`
  if (n >= 100) return `${n.toFixed(0)}`
  if (n >= 10) return n.toFixed(1)
  return n.toFixed(2).replace(/\.?0+$/, '')
}

export default function CsMarketPanel({ state, stateName, mw }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    if (!state) { setLoading(false); setEmpty(true); return }
    let cancelled = false
    setLoading(true)
    const targetMw = parseFloat(mw)
    getCsMarketSnapshot(state, { sampleMwTarget: !isNaN(targetMw) && targetMw > 0 ? targetMw : null })
      .then(snap => {
        if (cancelled) return
        if (!snap || snap.projectCount === 0) {
          setEmpty(true)
        } else {
          setData(snap)
        }
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setEmpty(true)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [state, mw])

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <LoadingDot /> Loading operating CS projects in {stateName || state}…
        </div>
      </div>
    )
  }

  if (empty) return null

  const targetMw = parseFloat(mw)
  const showTargetBand = !isNaN(targetMw) && targetMw > 0

  return (
    <div className="rounded-lg border bg-white overflow-hidden" style={{ borderColor: 'rgba(15,118,110,0.25)', borderLeft: '3px solid #0F766E' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(15,118,110,0.04)' }}>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold" style={{ color: '#0F766E' }}>
            Operating CS Projects · {stateName || state}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            NREL Sharing the Sun {data.sourceRelease ? `(${data.sourceRelease})` : ''} · ground truth
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums" style={{ color: '#0F766E' }}>{data.projectCount.toLocaleString()}</p>
          <p className="text-[9px] uppercase tracking-wider text-gray-400">projects</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-100">
        <KpiCell label="Operational MW" value={`${fmtMW(data.totalOperationalMwAc)} MW-AC`} />
        <KpiCell label="Median Size" value={data.medianSizeMwAc != null ? `${fmtMW(data.medianSizeMwAc)} MW` : '—'} />
        <KpiCell label="Vintage Range" value={data.vintageMin != null ? `${data.vintageMin}–${data.vintageMax}` : '—'} />
        <KpiCell label="Last 5 yrs" value={`${data.recentInstallsLast5y} new`} />
      </div>

      {(data.topDevelopers.length > 0 || data.utilityTypeMix.length > 0) && (
        <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
          {data.topDevelopers.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-gray-500 mb-1.5">Top developers</p>
              <ul className="space-y-1">
                {data.topDevelopers.map(d => (
                  <li key={d.name} className="flex items-center justify-between gap-2">
                    <span className="text-gray-700 truncate">{d.name}</span>
                    <span className="font-semibold tabular-nums text-gray-500 shrink-0">{d.projectCount}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.utilityTypeMix.length > 0 && (
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-gray-500 mb-1.5">Utility mix</p>
              <ul className="space-y-1">
                {data.utilityTypeMix.slice(0, 4).map(u => (
                  <li key={u.type} className="flex items-center justify-between gap-2">
                    <span className="text-gray-700 truncate">{u.type}</span>
                    <span className="font-semibold tabular-nums text-gray-500 shrink-0">{u.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {data.lmiRequiredCount > 0 && (
        <div className="px-4 py-2 border-t border-gray-100 text-[11px] text-gray-700">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-gray-500">LMI penetration</span>{' '}
          <span className="tabular-nums font-semibold">{data.lmiRequiredCount}</span>
          {' '}of <span className="tabular-nums">{data.projectCount}</span> projects have an LMI subscription requirement
          {data.lmiAvgPct != null && (
            <> · avg LMI portion <span className="tabular-nums font-semibold">{data.lmiAvgPct.toFixed(0)}%</span></>
          )}
        </div>
      )}

      {data.sample.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-gray-500 mb-1.5">
            {showTargetBand ? `Closest to your ${targetMw} MW target` : 'Largest operating projects'}
          </p>
          <div className="space-y-1.5">
            {data.sample.map(p => (
              <div key={p.project_id} className="flex items-baseline justify-between gap-3 text-[11px]">
                <div className="truncate flex-1 min-w-0">
                  <span className="font-semibold text-gray-800 truncate">{p.project_name}</span>
                  {p.city && <span className="text-gray-400 ml-1.5">· {p.city}</span>}
                </div>
                <div className="shrink-0 flex items-center gap-2 tabular-nums">
                  <span className="font-semibold text-gray-700">{fmtMW(p.system_size_mw_ac)} MW</span>
                  <span className="text-gray-400 text-[10px]">{p.vintage_year}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
        <p className="text-[9px] text-gray-400 leading-relaxed">
          Source: NREL "Sharing the Sun: Community Solar Project Data" {data.sourceRelease ? `(${data.sourceRelease})` : ''} — operating projects only. Per-project utility &amp; developer attribution from EIA Form 861. Ingestion via <code className="text-[9px]">scripts/seed-cs-projects.mjs</code>.
        </p>
      </div>
    </div>
  )
}

function KpiCell({ label, value }) {
  return (
    <div className="bg-white px-3 py-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
      <p className="text-sm font-bold tabular-nums text-gray-800">{value}</p>
    </div>
  )
}
