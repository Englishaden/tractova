// ── Score arc gauge ───────────────────────────────────────────────────────────
export default function ScoreGauge({ score }) {
  if (score == null) return null
  const r    = 34
  const cx   = 50
  const cy   = 48
  const circ = Math.PI * r
  // arc fill uses dasharray on a full-semicircle path (always 0 large-arc, sweep=1)
  const pct  = Math.max(0, Math.min(score / 100, 1))
  const ex   = cx - r * Math.cos(Math.PI * pct)
  const ey   = cy - r * Math.sin(Math.PI * pct)
  const arcD = pct > 0.01 ? `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex} ${ey}` : ''
  const color = score >= 70 ? '#34D399' : score >= 50 ? '#FCD34D' : '#F87171'
  const label = score >= 70 ? 'Strong' : score >= 50 ? 'Moderate' : 'Weak'

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 64" className="w-28">
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none" stroke="#E5E7EB" strokeWidth="7" strokeLinecap="round"
        />
        {arcD && (
          <path d={arcD} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
        )}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="20" fontWeight="800" fill="#111827">{score}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="7.5" fill="#9CA3AF">out of 100</text>
      </svg>
      <span className="text-[10px] font-semibold mt-0.5" style={{ color }}>{label} market</span>
    </div>
  )
}
