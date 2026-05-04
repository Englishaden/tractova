import { useState, useEffect } from 'react'
import { getSpecificYieldLineage } from '../lib/programData'
import { LoadingDot } from './ui'

// Specific Yield panel — observed AC/DC capacity factor from CS-developer
// public fleet data (Nexamp + SR Energy + Catalyze). Surfaced as data
// lineage / cross-check next to PVWatts modeled (which the engine continues
// reading as the primary capacity factor).
//
// Three confidence tiers mirror the cost-lineage tier ladder from Phase E:
//   Strong (n≥40)    — full p25/p75 interquartile range shown
//   Modest (n=10–39) — median + caveat
//   Thin   (n=3–9)   — median only + amber-tinged treatment + mandatory caveat
//   Hidden (n<3)     — no panel rendered (caller's MaybeSpecificYieldPanel suppresses)
//
// Capacity-basis split is honest: AC observations (Nexamp) and DC observations
// (SR Energy/Catalyze) appear in separate sub-rows, never averaged across.

const SOURCE_LABELS = {
  NEXAMP_PUBLIC:  'Nexamp',
  SR_ENERGY_PUBLIC: 'SR Energy',
  CATALYZE_PUBLIC: 'Catalyze',
}

function tierFor(n) {
  if (n >= 40) return 'strong'
  if (n >= 10) return 'modest'
  if (n >= 3)  return 'thin'
  return null
}

export default function SpecificYieldPanel({ state, stateName, mw }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!state) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    getSpecificYieldLineage(state)
      .then(snap => {
        if (cancelled) return
        setData(snap)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) { setData(null); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [state])

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <LoadingDot /> Loading observed capacity factors for {stateName || state}…
        </div>
      </div>
    )
  }

  if (!data || data.total_count < 3) return null

  // Pick the dominant capacity-basis summary for the headline tier.
  // (We render BOTH if both exist, but use the larger sample to set tier.)
  const acN = data.ac_summary?.count || 0
  const dcN = data.dc_summary?.count || 0
  const dominantN = Math.max(acN, dcN)
  const tier = tierFor(dominantN)
  if (!tier) return null  // safety net (already filtered by total_count>=3 above)

  const isThin = tier === 'thin'
  const isModest = tier === 'modest'
  const isStrong = tier === 'strong'

  const containerStyle = isThin
    ? { borderColor: 'rgba(15,118,110,0.30)', background: 'rgba(217,119,6,0.04)' }
    : { borderColor: 'rgba(15,118,110,0.30)', background: 'rgba(15,118,110,0.04)' }
  const badgeStyle = isThin
    ? { background: 'rgba(217,119,6,0.10)', color: '#0F766E', border: '1px solid rgba(217,119,6,0.30)' }
    : { background: 'rgba(15,118,110,0.10)', color: '#0F766E', border: '1px solid rgba(15,118,110,0.30)' }
  const badgeLabel = isStrong ? 'Tier A · observed capacity factor'
                   : isModest ? 'Tier A · observed capacity factor (modest sample)'
                   : 'Tier A · observed capacity factor (thin sample)'

  const sourceList = (data.sources_in_use || []).map(s => SOURCE_LABELS[s] || s).join(' + ')

  return (
    <div className="rounded-lg border bg-white overflow-hidden" style={{ borderColor: 'rgba(15,118,110,0.25)', borderLeft: '3px solid #0F766E' }}>
      <div className="px-4 py-3" style={{ background: 'rgba(15,118,110,0.04)' }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold" style={{ color: '#0F766E' }}>
              Observed Capacity Factor · {stateName || state}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Source: {sourceList || 'fleet data'} · cross-check vs NREL PVWatts modeled
            </p>
          </div>
          <span className="font-mono text-[8px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold shrink-0" style={badgeStyle}>
            {badgeLabel}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3" style={containerStyle}>
        {data.ac_summary && (
          <BasisRow basis="AC" summary={data.ac_summary} />
        )}
        {data.dc_summary && (
          <BasisRow basis="DC" summary={data.dc_summary} />
        )}

        {isModest && (
          <p className="text-[10px] text-gray-600 italic border-t border-gray-200 pt-2">
            Sample is below the n≥40 statistical-significance threshold; treat the median as directional. Single-developer/three-source bias disclosed in Privacy.
          </p>
        )}
        {isThin && (
          <p className="text-[10px] text-gray-600 italic border-t border-amber-200/60 pt-2">
            Thin sample (n&lt;10). Median is best-available observed signal but a single project can move it materially. Use as anchor, not as ground truth. Three-developer-fleet bias disclosed in Privacy.
          </p>
        )}
      </div>

      {data.sample && data.sample.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-gray-500 mb-1.5">
            Largest operating projects in the sample
          </p>
          <div className="space-y-1">
            {data.sample.map(p => {
              const cap = p.system_size_kw_ac || p.system_size_kw_dc
              const basis = p.capacity_basis
              return (
                <div key={p.project_id} className="flex items-baseline justify-between gap-3 text-[11px]">
                  <div className="truncate flex-1 min-w-0">
                    <span className="font-semibold text-gray-800 truncate">{p.project_name}</span>
                    <span className="text-gray-400 ml-1.5">· {SOURCE_LABELS[p.source] || p.source}</span>
                  </div>
                  <div className="shrink-0 flex items-center gap-2 tabular-nums">
                    <span className="font-semibold text-gray-700">{cap >= 1000 ? `${(cap / 1000).toFixed(1)} MW` : `${Math.round(cap)} kW`} {basis}</span>
                    <span className="text-gray-400 text-[10px]">CF {Number(p.observed_capacity_factor_pct).toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/50">
        <p className="text-[9px] text-gray-400 leading-relaxed">
          Three-developer fleet (Nexamp + SR Energy + Catalyze public project listings). Bias caveat: three developers' design philosophies (tilt, racking, panels) are over-represented vs the broader CS industry. Engine math continues to use NREL PVWatts modeled capacity factor — observed SY is data lineage / cross-check, not engine input. Tractova has a professional relationship with Nexamp; cited under the same standard as any public source.
        </p>
      </div>
    </div>
  )
}

function BasisRow({ basis, summary }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-gray-700">
          {basis}-basis · n={summary.count}
        </span>
        <span className="text-[10px] text-gray-500">
          mean SY <span className="font-semibold tabular-nums">{summary.mean_sy} kWh/kWp/yr</span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-gray-100">
        <KpiCell label="Mean CF" value={`${summary.mean_cf.toFixed(2)}%`} />
        <KpiCell label="Median CF" value={`${summary.median_cf.toFixed(2)}%`} />
        <KpiCell label={summary.count >= 10 ? 'p25–p75 range' : 'Min–max SY'}
                 value={summary.count >= 10
                   ? `${summary.p25_cf.toFixed(1)}–${summary.p75_cf.toFixed(1)}%`
                   : `${summary.min_sy}–${summary.max_sy}`} />
      </div>
    </div>
  )
}

function KpiCell({ label, value }) {
  return (
    <div className="bg-white px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-bold tabular-nums text-gray-800">{value}</p>
    </div>
  )
}
