// ── KPI Card 1: NWI coverage gauge ──
export default function NwiCoverageCard({ data }) {
  const pct = data?.pct ?? 0
  const populated = data?.populated ?? 0
  const total = data?.total ?? 0
  // Goal is 95%+. Color the gauge by tier.
  const tier = pct >= 95 ? 'good' : pct >= 85 ? 'watch' : 'warn'
  const colorMap = {
    good:  { stroke: '#0F766E', label: 'Goal met',  bg: 'rgba(15,118,110,0.06)', dot: '#10B981' },
    watch: { stroke: '#D97706', label: 'Approaching', bg: 'rgba(217,119,6,0.06)', dot: '#D97706' },
    warn:  { stroke: '#DC2626', label: 'Below goal', bg: 'rgba(220,38,38,0.06)', dot: '#DC2626' },
  }
  const c = colorMap[tier]
  // Circular gauge — same construction as the Lens composite for visual continuity.
  const R = 32
  const C = 2 * Math.PI * R
  const filled = (pct / 100) * C

  return (
    <div className="rounded-lg bg-white border border-gray-200 px-4 py-4 flex flex-col">
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold" style={{ color: '#0F766E' }}>
          ◆ NWI coverage
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold"
          style={{ background: c.bg, color: c.stroke, border: `1px solid ${c.stroke}40` }}
        >
          {c.label}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
            <circle cx="40" cy="40" r={R} stroke="#F3F4F6" strokeWidth="6" fill="none" />
            <circle
              cx="40" cy="40" r={R}
              stroke={c.stroke} strokeWidth="6" fill="none"
              strokeDasharray={`${filled} ${C}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute font-mono text-xl font-bold tabular-nums text-ink">
            {pct}<span className="text-xs text-gray-400">%</span>
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-gray-700 leading-snug">
            <span className="font-bold tabular-nums">{populated.toLocaleString()}</span> of <span className="tabular-nums">{total.toLocaleString()}</span> counties
          </p>
          <p className="text-[10px] text-gray-400 leading-snug mt-0.5">
            USFWS NWI wetlands · USDA SSURGO farmland
          </p>
          <p className="text-[10px] text-gray-400 leading-snug mt-0.5">
            Goal: <span className="font-semibold text-gray-600">95%+</span>
          </p>
        </div>
      </div>
    </div>
  )
}
