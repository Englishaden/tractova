// Structured Lens form rendered inside the Cmd-K palette. Replaces the
// position-argument grammar (:lens MA 5 CS) with discrete labeled fields
// so the user doesn't have to memorize token order or which tech codes
// map to which technology. The colon shorthand still works — when typed,
// the parsed args pre-fill these fields and focus jumps to the first
// empty one (typically County, since the shorthand doesn't carry it).
//
// Submit dispatches a navigation event back to the palette, which closes
// the dialog and navigates to /search?state=...&county=...&mw=...&tech=...
// The auto-submit effect in Search.jsx (signature-tracked, post 4546426)
// then re-fires the analysis with the new params.
//
// Tab order: State → County → MW → Tech → Stage → Run. Enter on Tech or
// Stage chip selects; Enter on any other input submits if all fields are
// complete. Esc cancels (returns palette to normal mode).

import { useEffect, useRef, useState } from 'react'
import { ALL_STATES, STAGES, TECHNOLOGIES_FLAT } from '../../lib/lensFormConstants'
import CountyCombobox from '../CountyCombobox'

const FIELD_LABEL_CLS = 'font-mono text-[9px] uppercase tracking-[0.18em] font-semibold text-gray-500'
const INPUT_BASE_CLS = 'w-full text-sm bg-white border border-gray-200 rounded-md px-3 py-2 text-ink placeholder-gray-400 outline-hidden focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500/15'

export default function PaletteLensForm({
  initial = {},
  onSubmit,
  onCancel,
}) {
  // Local form state — separate from the palette's query input so the
  // colon-shorthand pre-fill (which arrives via the `initial` prop) and
  // user edits don't fight each other.
  const [stateId, setStateId] = useState(initial.stateId || '')
  const [county, setCounty] = useState(initial.county || '')
  const [mw, setMw] = useState(initial.mw || '')
  const [tech, setTech] = useState(initial.tech || '')
  const [stage, setStage] = useState(initial.stage || '')

  const stateRef = useRef(null)
  const countyRef = useRef(null)
  const mwRef = useRef(null)
  const submitRef = useRef(null)

  // Auto-focus first empty field on mount. If state is pre-filled (via
  // colon shorthand), jump to County which is almost always empty.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!stateId) stateRef.current?.focus()
      else if (!county) countyRef.current?.focus()
      else if (!mw) mwRef.current?.focus()
      else submitRef.current?.focus()
    }, 60)
    return () => clearTimeout(t)
  // Intentionally empty deps — focus once on mount; subsequent edits
  // are user-driven and shouldn't re-yank focus.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clear county when state changes — county options are state-scoped.
  useEffect(() => {
    setCounty(prev => {
      // Only clear if the new state is genuinely different and the
      // previous county wasn't carried in from `initial`.
      if (prev && !initial.county) return ''
      return prev
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateId])

  const isComplete = Boolean(stateId && county && mw && tech && stage)
  const stateName = ALL_STATES.find(s => s.id === stateId)?.name || ''

  function handleSubmit(e) {
    e?.preventDefault?.()
    if (!isComplete) return
    onSubmit?.({ stateId, stateName, county, mw, tech, stage })
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel?.()
    } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
      // Enter from a text input / select submits if complete.
      e.preventDefault()
      if (isComplete) handleSubmit()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="px-4 py-3 space-y-3 bg-white"
      aria-label="Lens — quick run"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold" style={{ color: '#0F766E' }}>
          Lens — Quick Run
        </span>
        <span className="text-[10px] text-gray-400 italic">structured form replaces :lens shorthand · Tab cycles fields</span>
      </div>

      <FieldRow label="State">
        <select
          ref={stateRef}
          value={stateId}
          onChange={(e) => setStateId(e.target.value)}
          className={INPUT_BASE_CLS}
          required
        >
          <option value="">Select state…</option>
          {ALL_STATES.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </FieldRow>

      <FieldRow label="County">
        <div ref={countyRef}>
          <CountyComboboxWrap
            stateId={stateId}
            value={county}
            onValueChange={setCounty}
          />
        </div>
      </FieldRow>

      <FieldRow label="Size (MW AC)">
        <input
          ref={mwRef}
          type="number"
          min="0.1"
          step="0.1"
          value={mw}
          onChange={(e) => setMw(e.target.value)}
          placeholder="e.g. 5"
          className={INPUT_BASE_CLS}
          required
        />
      </FieldRow>

      <FieldRow label="Technology">
        <div className="flex flex-wrap gap-1.5">
          {TECHNOLOGIES_FLAT.map(t => (
            <ChipButton
              key={t}
              active={tech === t}
              onClick={() => setTech(t)}
              ariaPressed={tech === t}
            >
              {t}
            </ChipButton>
          ))}
        </div>
      </FieldRow>

      <FieldRow label="Stage">
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map(s => (
            <ChipButton
              key={s}
              active={stage === s}
              onClick={() => setStage(s)}
              ariaPressed={stage === s}
            >
              {s.split(' (')[0]}
            </ChipButton>
          ))}
        </div>
      </FieldRow>

      <div className="flex items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: '#E2E8F0' }}>
        <span className="text-[10px] font-mono text-gray-400">
          {isComplete
            ? `Ready · ${stateName} · ${county} · ${mw} MW · ${tech} · ${stage.split(' (')[0]}`
            : 'Fill all fields to enable Run Lens'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="font-mono text-[10px] uppercase tracking-[0.16em] font-semibold px-3 py-1.5 text-gray-500 hover:text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            ref={submitRef}
            type="submit"
            disabled={!isComplete}
            className="font-mono text-[10px] uppercase tracking-[0.16em] font-semibold px-4 py-1.5 rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
            style={{
              background: isComplete ? '#0F766E' : '#94A3B8',
              color: 'white',
            }}
          >
            Run Lens →
          </button>
        </div>
      </div>
    </form>
  )
}

function FieldRow({ label, children }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
      <span className={FIELD_LABEL_CLS}>{label}</span>
      <div>{children}</div>
    </div>
  )
}

function ChipButton({ active, onClick, ariaPressed, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ariaPressed}
      className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] font-semibold px-2.5 py-1 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40"
      style={
        active
          ? { background: '#0F766E', color: 'white', border: '1px solid #0F766E' }
          : { background: 'white', color: '#475569', border: '1px solid #E2E8F0' }
      }
    >
      {children}
    </button>
  )
}

// CountyCombobox renders its own inputs; wrap it in the same border+pad
// shell as the native inputs so the form has consistent chrome.
function CountyComboboxWrap({ stateId, value, onValueChange }) {
  return (
    <div
      className="w-full text-sm bg-white border border-gray-200 rounded-md px-3 py-1.5 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/15 transition-colors"
      style={{ minHeight: 38 }}
    >
      <CountyCombobox stateId={stateId} value={value} onValueChange={onValueChange} />
    </div>
  )
}
