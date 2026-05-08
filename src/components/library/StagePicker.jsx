import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { logProjectEvent } from '../../lib/projectEvents'
import { PIPELINE_STAGES } from './PipelineProgress.jsx'

// ── Stage / tech badge styles ────────────────────────────────────────────────
const STAGE_BADGE = {
  'Prospecting':            'bg-gray-100 text-gray-600 border-gray-200',
  'Site Control':           'bg-blue-50 text-blue-700 border-blue-200',
  'Pre-Development':        'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Development':            'bg-teal-50 text-teal-800 border-teal-200',
  'NTP (Notice to Proceed)':'bg-purple-50 text-purple-700 border-purple-200',
  'Construction':           'bg-accent-50 text-accent-700 border-accent-200',
  'Operational':            'bg-teal-50 text-teal-800 border-teal-200',
}

// ── Inline stage picker ───────────────────────────────────────────────────────
export default function StagePicker({ stage, projectId, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = async (newStage) => {
    setOpen(false)
    if (newStage === stage) return
    const previous = stage || '(unset)'
    await supabase.from('projects').update({ stage: newStage }).eq('id', projectId)
    onChange(newStage)
    // Audit log -- silent on failure (migration may not be applied yet).
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await logProjectEvent({
        projectId,
        userId: user.id,
        kind: 'stage_change',
        detail: `Stage advanced: ${previous} → ${newStage}`,
        meta: { previous, next: newStage },
      })
    }
  }

  const stageCls = STAGE_BADGE[stage] || 'bg-gray-100 text-gray-600 border-gray-200'

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v) }}
        aria-label="Edit project stage"
        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm border font-medium transition-opacity hover:opacity-80 ${stageCls}`}
      >
        {stage}
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <ul
          // V3: z-100 to definitively sit above adjacent project cards.
          // Parent card now drops overflow-hidden when collapsed so the
          // dropdown can extend below the card boundary.
          className="absolute z-100 top-full mt-1 left-0 rounded-lg overflow-hidden min-w-[210px]"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 12px 36px rgba(0,0,0,0.18)' }}
        >
          {PIPELINE_STAGES.map((s) => (
            <li key={s}>
              <button
                onMouseDown={(e) => { e.preventDefault(); handleSelect(s) }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                style={s === stage
                  ? { fontWeight: 600, background: 'rgba(20,184,166,0.08)', color: '#0F766E' }
                  : { color: '#374151' }}
                onMouseEnter={(e) => { if (s !== stage) e.currentTarget.style.background = '#F9FAFB' }}
                onMouseLeave={(e) => { if (s !== stage) e.currentTarget.style.background = 'transparent' }}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: s === stage ? '#0F766E' : '#D1D5DB' }}
                />
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
