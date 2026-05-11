import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { supabase } from '../../lib/supabase'
import { logProjectEvent } from '../../lib/projectEvents'
import { PIPELINE_STAGES } from './PipelineProgress.jsx'

// Phase 2A · TRACTOVA-UX-001 — StagePicker migrated from a hand-rolled
// absolute-positioned dropdown to Radix Popover. The previous version
// rendered the menu inside the card with `position: absolute`, which
// meant the menu could escape card bounds — a documented design-vocab
// anti-pattern (`docs/design-vocabulary.md` § anti-patterns). Radix
// Popover portals the menu to <body>, which means:
//   - No clipping by card overflow / containment.
//   - Correct z-index without ad-hoc `z-100` overrides.
//   - Outside-click + Esc + focus-trap come from the library, not from
//     a hand-rolled mousedown listener.
//   - Keyboard navigation through menu items is built-in.
//
// Behaviour is otherwise unchanged: clicking the badge opens the menu,
// selecting a stage writes to Supabase + fires the `stage_change`
// project_events audit log, and the parent receives the new value via
// `onChange`.

const STAGE_BADGE = {
  'Prospecting':            'bg-gray-100 text-gray-600 border-gray-200',
  'Site Control':           'bg-blue-50 text-blue-700 border-blue-200',
  'Pre-Development':        'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Development':            'bg-teal-50 text-teal-800 border-teal-200',
  'NTP (Notice to Proceed)':'bg-purple-50 text-purple-700 border-purple-200',
  'Construction':           'bg-accent-50 text-accent-700 border-accent-200',
  'Operational':            'bg-teal-50 text-teal-800 border-teal-200',
}

export default function StagePicker({ stage, projectId, onChange }) {
  const [open, setOpen] = useState(false)

  const handleSelect = async (newStage) => {
    setOpen(false)
    if (newStage === stage) return
    const previous = stage || '(unset)'
    await supabase.from('projects').update({ stage: newStage }).eq('id', projectId)
    onChange(newStage)
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
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Edit project stage"
          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm border font-medium transition-opacity hover:opacity-80 ${stageCls}`}
        >
          {stage}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="rounded-lg min-w-[210px] z-50"
          style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', boxShadow: '0 12px 36px rgba(0,0,0,0.18)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <ul role="listbox" aria-label="Project stage">
            {PIPELINE_STAGES.map((s) => {
              const active = s === stage
              return (
                <li key={s} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleSelect(s) }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                    style={active
                      ? { fontWeight: 600, background: 'rgba(20,184,166,0.08)', color: '#0F766E' }
                      : { color: '#374151' }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#F9FAFB' }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: active ? '#0F766E' : '#D1D5DB' }}
                    />
                    {s}
                  </button>
                </li>
              )
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
