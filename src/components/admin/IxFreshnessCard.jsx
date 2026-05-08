// ── KPI Card 2: IX freshness pills per ISO ──
export default function IxFreshnessCard({ freshness }) {
  const list = freshness || []
  const staleCount = list.filter((f) => f.stale).length
  const totalCount = list.length

  return (
    <div className="rounded-lg bg-white border border-gray-200 px-4 py-4 flex flex-col">
      <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold" style={{ color: '#0F766E' }}>
          ◆ IX scrapers
        </span>
        <span
          className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold"
          style={{
            background: staleCount === 0 ? 'rgba(15,118,110,0.06)' : 'rgba(217,119,6,0.06)',
            color:      staleCount === 0 ? '#0F766E' : '#92400E',
            border: `1px solid ${staleCount === 0 ? '#0F766E40' : '#D9770640'}`,
          }}
        >
          {staleCount} of {totalCount} stale
        </span>
      </div>
      {list.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic">No IX queue data loaded.</p>
      ) : (
        <div className="space-y-1.5 flex-1">
          {list.map((f) => {
            const sty = f.stale
              ? { bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.30)', text: '#92400E', dot: '#D97706' }
              : { bg: 'rgba(15,118,110,0.06)', border: 'rgba(15,118,110,0.25)', text: '#0F766E', dot: '#10B981' }
            return (
              <div
                key={f.iso}
                className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-md"
                style={{ background: sty.bg, border: `1px solid ${sty.border}` }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sty.dot }} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] font-bold" style={{ color: sty.text }}>
                    {f.iso}
                  </span>
                </div>
                <span className="font-mono text-[10px] tabular-nums" style={{ color: sty.text }}>
                  {f.ageDays}d ago
                </span>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-[10px] text-gray-400 leading-snug mt-2 pt-2 border-t border-gray-100">
        Stale = oldest fetched_at &gt; 7d
      </p>
    </div>
  )
}
