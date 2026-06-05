// ── FollowUpControl — set the next-action date + note (Pass 5, Wave 2) ───────
// Presentational + controlled: ProjectCard owns followUpAt/followUpNote, the
// persistence, and the bubble to Library's "due this week" roll-up. This renders
// a native date input + a one-line "what" note and calls onChange(atISO, note).
// Native <input type="date"> keeps it dependency-free and keyboard/mobile-friendly.

function relLabel(at) {
  if (!at) return null
  const days = Math.round((new Date(at).getTime() - Date.now()) / 86400000)
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, overdue: true }
  if (days === 0) return { text: 'due today', overdue: false }
  if (days === 1) return { text: 'due tomorrow', overdue: false }
  return { text: `due in ${days}d`, overdue: false }
}

export default function FollowUpControl({ followUpAt, followUpNote = '', onChange }) {
  const dateValue = followUpAt ? new Date(followUpAt).toISOString().slice(0, 10) : ''
  const rel = relLabel(followUpAt)

  const setDate = (yyyymmdd) => {
    // Anchor to local noon so the saved instant doesn't slip a day across TZs.
    const at = yyyymmdd ? new Date(`${yyyymmdd}T12:00:00`).toISOString() : null
    onChange(at, yyyymmdd ? followUpNote : '')
  }

  return (
    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Next Action</p>
        {rel && (
          <span
            className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-sm"
            style={rel.overdue ? { background: 'rgba(220,38,38,0.10)', color: '#DC2626' } : { background: 'rgba(15,118,110,0.10)', color: '#0F766E' }}
          >
            {rel.text}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={dateValue}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Next-action due date"
          className="text-[11px] rounded-lg px-2.5 py-1.5 bg-white border border-gray-200 text-ink focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500/20 focus:border-teal-300 transition-colors"
        />
        <input
          type="text"
          value={followUpNote}
          onChange={(e) => onChange(followUpAt, e.target.value)}
          disabled={!followUpAt}
          placeholder={followUpAt ? 'What needs doing?' : 'Pick a date first'}
          maxLength={120}
          aria-label="Next-action note"
          className="flex-1 min-w-[160px] text-[11px] rounded-lg px-2.5 py-1.5 bg-white border border-gray-200 text-ink placeholder:text-gray-400 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500/20 focus:border-teal-300 transition-colors disabled:bg-gray-50 disabled:text-gray-400"
        />
        {followUpAt && (
          <button
            type="button"
            onClick={() => onChange(null, '')}
            className="text-[10px] font-semibold text-gray-400 hover:text-red-600 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}
