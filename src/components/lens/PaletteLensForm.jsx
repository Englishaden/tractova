// Structured Lens form rendered inside the Cmd-K palette. Replaces the
// position-argument grammar (:lens MA 5 CS — hard to memorize, token
// order matters) with the same labeled-card vocabulary used by the
// full Lens form on /search. The colon shorthand still works as a
// quick-fill — when typed, the parsed args pre-fill these fields and
// focus jumps to the first empty one (typically County, since the
// shorthand doesn't carry it).
//
// Field chrome matches src/pages/Search.jsx exactly:
//   - State / Stage / Technology use FieldSelect (white card + internal
//     mono label + chevron + dropdown list with option tooltips).
//   - County uses CountyCombobox (searchable; same card chrome).
//   - MW uses a hand-rolled labeled card with a number input — same
//     pattern as the MW field on /search line 818.
//
// Submit dispatches back to the palette, which navigates to
// /search?state=...&county=...&mw=...&technology=...&stage=... — the
// signature-tracked auto-submit effect in Search.jsx then re-fires
// the analysis with the new params.

import { useEffect, useRef, useState } from 'react'
import { ALL_STATES, STAGES, TECHNOLOGIES } from '../../lib/lensFormConstants'
import FieldSelect from '../FieldSelect'
import CountyCombobox from '../CountyCombobox'

const STATE_OPTIONS = ALL_STATES.map(s => s.name)

// Field-card chrome matches /search MW input pattern (Search.jsx:818).
const FIELD_CARD_CLS = 'bg-white rounded-lg border border-gray-200 px-3.5 pt-2.5 pb-2 shadow-xs transition-all focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/15'
const LABEL_CLS = 'block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5 flex items-center gap-1.5'
const INNER_INPUT_CLS = 'w-full text-sm bg-transparent border-0 outline-hidden px-0 py-0 text-gray-900 placeholder-gray-400 appearance-none'

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

  const mwRef = useRef(null)
  const submitRef = useRef(null)

  // Auto-focus the first empty field on mount. If state pre-filled (via
  // colon shorthand), skip directly to whichever field comes next —
  // usually County, occasionally MW.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!mw && stateId) {
        mwRef.current?.focus()
      } else if (!stateId) {
        // No reliable ref into FieldSelect's internal display — rely on
        // browser focus order: Tab from here lands on the first FieldSelect.
      } else if (stateId && county && mw) {
        submitRef.current?.focus()
      }
    }, 60)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && isComplete) {
      // Enter from any input submits when the form is complete.
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="px-4 py-3 space-y-2.5 bg-white"
      aria-label="Lens — quick run"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold" style={{ color: '#0F766E' }}>
          Lens — Quick Run
        </span>
        <span className="text-[10px] text-gray-400 italic">structured form · Tab cycles fields · ↵ to run</span>
      </div>

      {/* Two-column grid on wider palette viewports; single-column stack
          on narrow. Mirrors the /search form's information density without
          inheriting its 5-col compression. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* State — FieldSelect (matches /search:797) */}
        <FieldSelect
          label="State"
          labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
          value={stateName}
          onChange={(name) => {
            const s = ALL_STATES.find(s => s.name === name)
            setStateId(s?.id || '')
            // Clear county whenever state changes — county options are
            // state-scoped (matches /search:803 behavior).
            if (s?.id !== stateId) setCounty('')
          }}
          options={STATE_OPTIONS}
          placeholder="Select state…"
          required
        />

        {/* County — CountyCombobox (matches /search:811). Renders its
            own labeled-card chrome; no external wrapper needed. */}
        <CountyCombobox
          stateId={stateId}
          value={county}
          onValueChange={setCounty}
        />

        {/* MW — labeled card with number input (matches /search:818) */}
        <div className={FIELD_CARD_CLS}>
          <label className={LABEL_CLS} style={{ color: 'var(--color-primary-700, #0F766E)' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Project Size (MW AC)
          </label>
          <input
            ref={mwRef}
            type="number"
            min="0.1"
            step="0.1"
            value={mw}
            onChange={(e) => setMw(e.target.value)}
            placeholder="e.g. 5"
            required
            className={INNER_INPUT_CLS}
          />
        </div>

        {/* Tech — FieldSelect (matches /search:847) */}
        <FieldSelect
          label="Technology"
          labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>}
          value={tech}
          onChange={setTech}
          options={TECHNOLOGIES}
          placeholder="Select type…"
          required
        />

        {/* Stage — FieldSelect (matches /search:836) */}
        <div className="sm:col-span-2">
          <FieldSelect
            label="Development Stage"
            labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
            value={stage}
            onChange={setStage}
            options={STAGES}
            placeholder="Select stage…"
            required
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t" style={{ borderColor: '#E2E8F0' }}>
        <span className="text-[10px] font-mono text-gray-400 truncate">
          {isComplete
            ? `Ready · ${stateName} · ${county} · ${mw} MW · ${tech} · ${stage.split(' (')[0]}`
            : 'Fill all fields to enable Run Lens'}
        </span>
        <div className="flex items-center gap-2 shrink-0">
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
