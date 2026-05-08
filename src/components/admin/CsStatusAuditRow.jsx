// Extracted from src/pages/Admin.jsx in Plan E Sprint E.2 (2026-05-07).
// Renders the cs_status accuracy audit findings inside the DataHealth
// MissionControl. Compares curated state_programs.cs_status against
// observed operational MW from cs_projects (NREL Sharing the Sun).

export default function CsStatusAuditRow({ audit }) {
  if (!audit || !audit.available || !audit.findings || audit.findings.length === 0) return null

  const flagStyle = {
    DEAD_MARKET:           { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.30)', dot: '#DC2626', label: 'DEAD' },
    STRONG_MARKET:         { bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.30)', dot: '#DC2626', label: 'STRONG' },
    MISSING_STATUS:        { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.30)', dot: '#D97706', label: 'MISSING' },
    MISSING_FROM_CURATION: { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.30)', dot: '#D97706', label: 'UNCURATED' },
    STALE_MARKET:          { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.30)', dot: '#D97706', label: 'STALE' },
  }

  const high = audit.findings.filter((f) => f.severity === 'high')
  const med  = audit.findings.filter((f) => f.severity === 'medium')

  return (
    <div className="border-t border-gray-100 px-5 pt-4 pb-3 bg-white">
      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold text-red-800">
            ◆ cs_status accuracy
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
            curated label vs operational MW (NREL Sharing the Sun, vintage {audit.latest_vintage})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {high.length > 0 && (
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold" style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.30)' }}>
              {high.length} high
            </span>
          )}
          {med.length > 0 && (
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold" style={{ background: 'rgba(217,119,6,0.08)', color: '#D97706', border: '1px solid rgba(217,119,6,0.30)' }}>
              {med.length} medium
            </span>
          )}
        </div>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed mb-2.5">
        States flagged where <span className="font-mono">state_programs.cs_status</span> doesn't match operational deployment.
        DEAD = active label, &lt;{audit.thresholds?.dead_mw ?? 5}MW operational.
        STRONG = limited label, &gt;{audit.thresholds?.strong_mw ?? 500}MW operational.
        MISSING = no curated status, &gt;{audit.thresholds?.missing_mw ?? 50}MW operational.
        Hover for evidence; fix via <span className="font-mono">/admin → State Programs</span>.
      </p>
      <div className="space-y-1.5">
        {audit.findings.map((f) => {
          const sty = flagStyle[f.flag] || flagStyle.STALE_MARKET
          return (
            <div
              key={f.state}
              title={`${f.name} (${f.state}) · cs_status='${f.cs_status}' · ${f.total_projects} projects · ${f.total_operational_mw} MW · vintage range latest ${f.latest_install_year || '—'} · curated capacity_mw: ${f.capacity_mw_curated ?? '—'}`}
              className="flex items-center gap-2 text-[11px] flex-wrap"
            >
              <span
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-md shrink-0"
                style={{ background: sty.bg, color: sty.dot, border: `1px solid ${sty.border}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sty.dot }} />
                <span className="font-bold">{f.state}</span>
                <span className="font-normal opacity-70">{sty.label}</span>
              </span>
              <span className="font-mono text-[10px] text-gray-500 tabular-nums shrink-0">
                cs_status=<span className="font-semibold">{f.cs_status}</span> · {f.total_projects}p · {f.total_operational_mw} MW
              </span>
              <span className="text-[11px] text-gray-700 leading-snug min-w-0 flex-1">{f.suggestion}</span>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-gray-400 leading-snug mt-3">
        Source: <span className="font-mono">cs_projects</span> ({audit.cs_projects_count} rows from NREL Sharing the Sun).
        Re-run the audit by re-loading the Data Health page; re-seed via <span className="font-mono">node scripts/seed-cs-projects.mjs</span>.
      </p>
    </div>
  )
}
