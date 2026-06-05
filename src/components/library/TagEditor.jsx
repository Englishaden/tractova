import { useState } from 'react'

// ── TagEditor — add/remove custom labels on a project (Pass 5, Wave 2) ───────
// Presentational + controlled: the parent (ProjectCard) owns the tags array,
// persistence, and the live bubble up to Library. This just renders the chips
// and the add-input and calls onChange(nextTags). Tags organise a deal beyond
// the fixed pipeline `stage` — "hot", a partner name, "Q3 target".
//
// Rules: trim, dedupe case-insensitively, cap length + count so the chip row
// stays sane and the text[] column stays small.

const MAX_TAGS = 12
const MAX_LEN = 24

export default function TagEditor({ tags = [], onChange }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const t = draft.trim().slice(0, MAX_LEN)
    if (!t) return
    if (tags.length >= MAX_TAGS) { setDraft(''); return }
    if (tags.some(x => x.toLowerCase() === t.toLowerCase())) { setDraft(''); return }
    onChange([...tags, t])
    setDraft('')
  }
  const remove = (t) => onChange(tags.filter(x => x !== t))

  return (
    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Tags</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full pl-2 pr-1 py-0.5 border"
            style={{ background: 'rgba(20,184,166,0.10)', color: '#0F766E', borderColor: 'rgba(20,184,166,0.30)' }}
          >
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              aria-label={`Remove tag ${t}`}
              className="text-teal-700/60 hover:text-red-600 transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </span>
        ))}
        {tags.length < MAX_TAGS && (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
              if (e.key === 'Backspace' && !draft && tags.length) remove(tags[tags.length - 1])
            }}
            onBlur={add}
            placeholder={tags.length ? 'Add…' : 'Add a tag…'}
            maxLength={MAX_LEN}
            aria-label="Add a tag"
            className="text-[10px] rounded-full px-2.5 py-1 bg-white border border-gray-200 text-ink placeholder:text-gray-400 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500/20 focus:border-teal-300 w-24 transition-colors"
          />
        )}
      </div>
    </div>
  )
}
