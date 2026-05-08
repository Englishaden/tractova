export default function RevenueStackBar({ revenueStack }) {
  const segments = [
    { label: 'ITC Base',  value: revenueStack.itcBase,          color: '#1D4ED8' },
    { label: 'ITC Adder', value: revenueStack.itcAdder,         color: '#D97706' },
    { label: 'IREC',      value: revenueStack.irecMarket,       color: '#7C3AED' },
    { label: 'Net Meter', value: revenueStack.netMeteringStatus, color: '#059669' },
  ]
  // Parse leading number from string like "30%" or "26%"
  const parse = (v) => { const m = String(v || '').match(/(\d+(\.\d+)?)/) ; return m ? parseFloat(m[1]) : null }
  const nums = segments.map(s => parse(s.value))
  const total = nums.reduce((a, b) => a + (b || 0), 0)
  if (total === 0) return null
  const widths = nums.map(n => ((n || 0) / total) * 100)

  return (
    <div className="mb-3">
      <div className="h-3 rounded-full overflow-hidden flex">
        {segments.map((s, i) => (
          <div key={s.label} style={{ width: `${widths[i]}%`, background: s.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-[10px] text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
