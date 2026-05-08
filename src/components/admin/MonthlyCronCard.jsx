// ── KPI Card 3: monthly-data-refresh latency bar ──
export default function MonthlyCronCard({ run }) {
  const ceilingMs = 60_000
  const durationMs = run?.duration_ms ?? null
  const pct = durationMs != null ? Math.min(100, (durationMs / ceilingMs) * 100) : 0
  const headroomPct = durationMs != null ? Math.max(0, Math.round((1 - durationMs / ceilingMs) * 100)) : null
  const tier = headroomPct == null ? 'unknown' : headroomPct >= 50 ? 'good' : headroomPct >= 30 ? 'watch' : 'warn'
  const colorMap = {
    good:    { fill: '#0F766E', label: 'Healthy',    bg: 'rgba(15,118,110,0.06)' },
    watch:   { fill: '#D97706', label: 'Watch',      bg: 'rgba(217,119,6,0.06)' },
    warn:    { fill: '#DC2626', label: 'Drifting',   bg: 'rgba(220,38,38,0.06)' },
    unknown: { fill: '#94A3B8', label: 'No data',    bg: 'rgba(148,163,184,0.06)' },
  }
  const c = colorMap[tier]
  const fmtMs = (ms) => ms == null ? '—' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  const finishedAgo = run?.finished_at
    ? Math.floor((Date.now() - new Date(run.finished_at).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="rounded-lg bg-white border border-gray-200 px-4 py-4 flex flex-col">
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold" style={{ color: '#0F766E' }}>
          ◆ Substations cron
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold"
          style={{ background: c.bg, color: c.fill, border: `1px solid ${c.fill}40` }}
        >
          {c.label}
        </span>
      </div>
      <div className="mb-2">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-gray-700">Last run duration</span>
          <span className="font-mono text-sm font-bold tabular-nums" style={{ color: c.fill }}>
            {fmtMs(durationMs)}
          </span>
        </div>
        {/* Latency bar with ceiling marker */}
        <div className="relative h-2 rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full transition-all"
            style={{ width: `${pct}%`, background: c.fill }}
          />
          {/* 70% threshold tick — where WATCH would flip */}
          <div className="absolute top-0 bottom-0 w-px bg-gray-300" style={{ left: '70%' }} />
        </div>
        <div className="flex items-baseline justify-between mt-1 text-[9px] font-mono text-gray-400 tabular-nums">
          <span>0s</span>
          <span style={{ color: '#6B7280' }}>ceiling 60s</span>
        </div>
      </div>
      <p className="text-[10px] text-gray-500 leading-snug mt-1">
        {durationMs != null
          ? <>{headroomPct}% headroom · last successful run {finishedAgo == null ? 'unknown' : finishedAgo === 0 ? 'today' : `${finishedAgo}d ago`}</>
          : 'No successful run found yet.'}
      </p>
      <p className="text-[10px] text-gray-400 leading-snug mt-2 pt-2 border-t border-gray-100">
        api/refresh-substations · monthly cadence
      </p>
    </div>
  )
}
