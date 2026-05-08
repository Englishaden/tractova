// ── Curation drift row — surfaces state_programs entries past warn threshold ──
export default function CurationDriftRow({ drift, thresholds }) {
  if (!drift || drift.length === 0) return null
  const sevStyle = {
    warn:   { bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.30)', dot: '#D97706', label: 'WATCH' },
    urgent: { bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.30)', dot: '#DC2626', label: 'STALE' },
  }
  const urgentCount = drift.filter((d) => d.severity === 'urgent').length
  const warnCount   = drift.filter((d) => d.severity === 'warn').length

  return (
    <div className="border-t border-gray-100 px-5 pt-4 pb-3 bg-white">
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold text-amber-800">
            ◆ Curation drift
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
            state_programs not refreshed in &gt;{thresholds.warn_days}d
          </span>
        </div>
        <div className="flex items-center gap-2">
          {urgentCount > 0 && (
            <span
              className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold"
              style={{ background: sevStyle.urgent.bg, color: sevStyle.urgent.dot, border: `1px solid ${sevStyle.urgent.border}` }}
            >
              {urgentCount} stale
            </span>
          )}
          {warnCount > 0 && (
            <span
              className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold"
              style={{ background: sevStyle.warn.bg, color: sevStyle.warn.dot, border: `1px solid ${sevStyle.warn.border}` }}
            >
              {warnCount} watch
            </span>
          )}
        </div>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed mb-2.5">
        Hand-curated capacity, LMI %, IX difficulty, and enrollment rate drift over time.{' '}
        State_programs older than {thresholds.warn_days}d turn amber; older than {thresholds.urgent_days}d turn red.
        Active-CS states sort first.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {drift.map((d) => {
          const sty = sevStyle[d.severity] || sevStyle.warn
          const fields = []
          if (!d.has_capacity) fields.push('capacity null')
          if (!d.has_enrollment_rate) fields.push('enrollment null')
          const tooltip = [
            `${d.name} (${d.state_id})`,
            `Last verified: ${new Date(d.latest_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
            `Age: ${d.age_days} days`,
            d.cs_status ? `Status: ${d.cs_status}` : null,
            ...fields,
          ].filter(Boolean).join(' · ')
          return (
            <span
              key={d.state_id}
              title={tooltip}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-md"
              style={{ background: sty.bg, color: sty.dot, border: `1px solid ${sty.border}` }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sty.dot }} />
              <span className="font-bold">{d.state_id}</span>
              <span className="font-normal opacity-70 tabular-nums">{d.age_days}d</span>
              {(!d.has_capacity || !d.has_enrollment_rate) && (
                <span className="font-normal opacity-70">⚠</span>
              )}
            </span>
          )
        })}
      </div>
      <p className="text-[10px] text-gray-400 leading-snug mt-2">
        Click <span className="font-mono">/admin → State Programs</span> to refresh values. ⚠ flag = capacity_mw or enrollment_rate_mw_per_month is null (silently breaks Runway).
      </p>
    </div>
  )
}
