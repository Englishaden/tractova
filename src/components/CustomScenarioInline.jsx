import { useState, useRef, useEffect } from 'react'

// V3 §7.5: Inline custom scenario builder. Drives the same activeScenario state
// so toggling a custom override updates the gauge above just like preset scenarios.
// V3.1: Peer-state mode replaces the previous two-dropdown "Custom" builder.
// Instead of free-form IX/CS overrides (abstract, not market-anchored), the
// user picks another real state and the scenario applies that state's full
// profile to the current view. Reads as: "What would this market look like
// if it adopted California's NEM 3.0? Massachusetts SMART? Illinois LMI
// requirements?" -- the same precedent-anchored framing used by the preset
// chips, just with the user choosing the precedent instead of us proposing it.
export default function CustomScenarioInline({ stateProgram, technology, activeScenario, setActiveScenario, programMap }) {
  const isActive = activeScenario?.id === 'custom'
  const peerStateId = isActive ? (activeScenario.peerStateId || '') : ''
  // V3.1: native <select> rendered as the OS chrome list (white,
  // unstyled, system-default). Replaced with a custom popup list so
  // each option can show the peer's program/IX/LMI as styled mono
  // captions and the open list matches the rest of the app.
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef(null)

  useEffect(() => {
    if (!pickerOpen) return
    const onClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setPickerOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  // Eligible peers: any state with a real CS program, excluding self.
  const peerOptions = Object.values(programMap || {})
    .filter(s => s.id && s.id !== stateProgram?.id)
    .filter(s => s.csStatus && s.csStatus !== 'none')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  const selectedPeer = peerStateId ? programMap?.[peerStateId] : null

  const handlePick = (peerId) => {
    if (!peerId) {
      if (isActive) setActiveScenario(null)
      return
    }
    const peer = programMap?.[peerId]
    if (!peer || !stateProgram) return

    const override = {
      ixDifficulty: peer.ixDifficulty,
      csStatus:     peer.csStatus,
      lmiRequired:  peer.lmiRequired,
      lmiPercent:   peer.lmiPercent,
      capacityMW:   peer.capacityMW,
    }

    // Structured diff: each row keeps {field, from, to, tone} so the UI
    // can render a proper labeled comparison row instead of a plain string
    // bullet list. Tone is teal when the shift is generally favorable to
    // the operator (looser CS, lower LMI, easier IX, more capacity), amber
    // otherwise. Used downstream in the diff readout component.
    const IX_RANK = { easy: 4, moderate: 3, hard: 2, very_hard: 1 }
    const CS_RANK = { active: 4, limited: 3, pending: 2, none: 1 }
    const fmtIX = (v) => v ? v.replace('_', ' ') : '—'
    const fmtMW = (v) => v ? (v >= 1000 ? `${(v / 1000).toFixed(1)} GW` : `${Math.round(v)} MW`) : '—'

    const diffs = []
    if (peer.ixDifficulty && peer.ixDifficulty !== stateProgram.ixDifficulty) {
      const tone = (IX_RANK[peer.ixDifficulty] || 0) >= (IX_RANK[stateProgram.ixDifficulty] || 0) ? 'good' : 'bad'
      diffs.push({ field: 'IX Difficulty', from: fmtIX(stateProgram.ixDifficulty), to: fmtIX(peer.ixDifficulty), tone })
    }
    if (peer.csStatus && peer.csStatus !== stateProgram.csStatus) {
      const tone = (CS_RANK[peer.csStatus] || 0) >= (CS_RANK[stateProgram.csStatus] || 0) ? 'good' : 'bad'
      diffs.push({ field: 'CS Status', from: stateProgram.csStatus || '—', to: peer.csStatus, tone })
    }
    if ((peer.lmiPercent || 0) !== (stateProgram.lmiPercent || 0)) {
      // Lower LMI = easier subscriber sourcing for the developer
      const tone = (peer.lmiPercent || 0) < (stateProgram.lmiPercent || 0) ? 'good' : 'bad'
      diffs.push({ field: 'LMI Carveout', from: `${stateProgram.lmiPercent || 0}%`, to: `${peer.lmiPercent || 0}%`, tone })
    }
    if ((peer.capacityMW || 0) !== (stateProgram.capacityMW || 0)) {
      const tone = (peer.capacityMW || 0) > (stateProgram.capacityMW || 0) ? 'good' : 'bad'
      diffs.push({ field: 'Program Capacity', from: fmtMW(stateProgram.capacityMW), to: fmtMW(peer.capacityMW), tone })
    }

    // Compact prose summary for the active-scenario overlay panel below.
    const diffSummary = diffs.length > 0
      ? diffs.map(d => `${d.field} ${d.from} → ${d.to}`).join('; ')
      : ''

    setActiveScenario({
      id: 'custom',
      peerStateId: peerId,
      label: `Peer profile · ${peer.name}`,
      override,
      precedent: `${peer.name} profile${peer.csProgram ? ` (${peer.csProgram})` : ''} applied to ${stateProgram.name || 'this market'}`,
      detail: diffs.length > 0
        ? `What if ${stateProgram.name || 'this market'} adopted ${peer.name}'s policy + IX profile? ${diffs.length} key shift${diffs.length === 1 ? '' : 's'}: ${diffSummary}. Useful for benchmarking how a peer state's regulatory environment would reshape this county's feasibility.`
        : `${peer.name}'s policy and IX profile is identical to this state on the dimensions our model tracks -- no score impact expected.`,
      revenueImpact: peer.csProgram ? `Adopt ${peer.csProgram} program rules` : null,
      timelineImpact: peer.ixDifficulty
        ? `Adopt ${peer.name}-equivalent IX cluster timing`
        : null,
      diffs,
    })
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <p className="font-mono text-[9px] uppercase tracking-[0.20em] text-ink-muted">
          Compare to peer state
        </p>
        <p className="font-mono text-[9px] text-gray-400">
          {peerOptions.length} states with active programs
        </p>
      </div>
      {/* Styled custom dropdown — open list matches the rest of the app's
          field selectors (FieldSelect, CountyCombobox). Each option is
          a 2-line row: state name on top, mono-caps caption with the
          peer's program / IX / LMI shape underneath. */}
      <div ref={pickerRef} className="relative">
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-expanded={pickerOpen}
          aria-haspopup="listbox"
          className="w-full bg-white border border-gray-200 rounded-lg px-3.5 py-2.5 text-left transition-colors focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 hover:border-gray-300"
        >
          <div className="flex items-center justify-between gap-2">
            {selectedPeer ? (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink leading-tight truncate">
                  {selectedPeer.name}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted truncate mt-0.5">
                  {[
                    selectedPeer.csProgram,
                    selectedPeer.ixDifficulty && `IX ${selectedPeer.ixDifficulty.replace('_', ' ')}`,
                    (selectedPeer.lmiPercent || 0) > 0 && `${selectedPeer.lmiPercent}% LMI`,
                  ].filter(Boolean).join(' · ')}
                </p>
              </div>
            ) : (
              <span className="text-sm text-gray-400 italic">Select a peer state to mirror its profile…</span>
            )}
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={`shrink-0 transition-transform duration-150 ${pickerOpen ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </button>

        {pickerOpen && (
          <ul
            role="listbox"
            className="absolute z-50 left-0 top-full mt-1.5 w-full bg-white border border-gray-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)' }}
          >
            {/* Clear option, only when something is selected */}
            {peerStateId && (
              <li
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); handlePick(''); setPickerOpen(false) }}
                className="px-3.5 py-2 text-[11px] uppercase font-mono tracking-[0.18em] text-gray-400 hover:bg-gray-50 hover:text-gray-600 cursor-pointer transition-colors border-b border-gray-100"
              >
                ✕ Clear peer comparison
              </li>
            )}
            {peerOptions.map((s) => {
              const isCurrent = s.id === peerStateId
              return (
                <li
                  key={s.id}
                  role="option"
                  aria-selected={isCurrent}
                  onMouseDown={(e) => { e.preventDefault(); handlePick(s.id); setPickerOpen(false) }}
                  className={`flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                    isCurrent ? 'bg-teal-50/70' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-teal-700' : 'text-transparent'}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-tight truncate ${isCurrent ? 'font-semibold text-teal-800' : 'font-medium text-ink'}`}>
                      {s.name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted truncate mt-0.5">
                      {[
                        s.csProgram,
                        s.ixDifficulty && `IX ${s.ixDifficulty.replace('_', ' ')}`,
                        (s.lmiPercent || 0) > 0 && `${s.lmiPercent}% LMI`,
                      ].filter(Boolean).join(' · ') || 'Active CS · profile shape unavailable'}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Live diff readout once a peer is selected. Each row is a structured
          field/from/to comparison rendered as a labeled grid -- field name on
          the left in mono caps, before-value in muted ink, an arrow keyed to
          the tone (teal for favorable shifts, amber for unfavorable), then the
          after-value. Replaces the previous bullet-list-of-strings render. */}
      {isActive && Array.isArray(activeScenario?.diffs) && activeScenario.diffs.length > 0 && (
        <div
          className="mt-3 rounded-lg overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(20,184,166,0.04) 0%, rgba(20,184,166,0.08) 100%)',
            border: '1px solid rgba(20,184,166,0.22)',
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-1.5"
            style={{ borderBottom: '1px solid rgba(20,184,166,0.18)' }}
          >
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.20em]" style={{ color: '#0F766E' }}>
              Profile shifts
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gray-500 tabular-nums">
              {activeScenario.diffs.length} change{activeScenario.diffs.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="px-3 py-2 space-y-1.5">
            {activeScenario.diffs.map((d) => {
              const arrowColor = d.tone === 'good' ? '#0F766E' : '#B45309'
              const toBg       = d.tone === 'good' ? 'rgba(15,118,110,0.10)' : 'rgba(180,83,9,0.10)'
              const toBorder   = d.tone === 'good' ? 'rgba(15,118,110,0.28)' : 'rgba(180,83,9,0.28)'
              const toText     = d.tone === 'good' ? '#0F766E' : '#92400E'
              return (
                <div
                  key={d.field}
                  className="grid items-center gap-2"
                  style={{ gridTemplateColumns: 'minmax(0, 110px) minmax(0, 1fr) 14px minmax(0, 1fr)' }}
                >
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] font-semibold text-ink-muted whitespace-nowrap">
                    {d.field}
                  </span>
                  <span className="text-[11px] font-mono text-gray-500 truncate">
                    {d.from}
                  </span>
                  <span aria-hidden className="flex items-center justify-center" style={{ color: arrowColor }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                  <span
                    className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-sm justify-self-start truncate"
                    style={{ color: toText, background: toBg, border: `1px solid ${toBorder}` }}
                  >
                    {d.to}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {isActive && Array.isArray(activeScenario?.diffs) && activeScenario.diffs.length === 0 && (
        <p className="mt-2 text-[11px] text-ink-muted italic">
          Peer profile matches this state on every dimension we model — no shift to evaluate.
        </p>
      )}

      <p className="font-mono text-[9px] text-ink-muted mt-2 leading-snug">
        Applies the peer state's IX difficulty, CS status, LMI carveout, and program cap. Index updates live in the gauge above.
      </p>
    </div>
  )
}
