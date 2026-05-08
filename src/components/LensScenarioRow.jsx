import { useState } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip'
import { buildSensitivityScenarios } from '../pages/Search.jsx'
import CustomScenarioInline from './CustomScenarioInline'

// V3 §7.4: Scenario toggle row — sits directly under MarketPositionPanel.
// Toggling a scenario lifts the override into shared state so the gauge above
// re-renders with the new score in place. No more scroll-up to see impact.
export default function LensScenarioRow({ stateProgram, technology, mw, activeScenario, setActiveScenario, countyData, formForApi, programMap }) {
  const [customOpen, setCustomOpen] = useState(false)
  if (!stateProgram) return null
  const scenarios = buildSensitivityScenarios(stateProgram, technology, mw)
  const isCustomActive = activeScenario?.id === 'custom'
  if (scenarios.length === 0 && !stateProgram) return null

  return (
    <div className="mb-6 bg-white rounded-lg border border-gray-200 px-5 py-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-y-2">
        <div className="flex items-center gap-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5A6B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
          <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold text-ink">
            What If — Sensitivity Scenarios
          </p>
        </div>
        {activeScenario && (
          <button
            onClick={() => { setActiveScenario(null); setCustomOpen(false) }}
            className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold px-2 py-0.5 rounded-sm transition-colors"
            style={{ color: '#0F766E' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(20,184,166,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sensitivity scenarios">
        {scenarios.map(scn => {
          const isActive = activeScenario?.id === scn.id
          const button = (
            <button
              key={scn.id}
              onClick={() => setActiveScenario(isActive ? null : scn)}
              aria-pressed={isActive}
              aria-label={`Sensitivity scenario: ${scn.label}`}
              className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold px-3 py-1.5 rounded-sm transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500"
              style={isActive
                ? { background: '#0F1A2E', color: '#5EEAD4', border: '1px solid #14B8A6' }
                : { background: 'white', color: '#0A1828', border: '1px solid #E2E8F0' }}
              onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.borderColor = '#14B8A6'; e.currentTarget.style.color = '#0F766E' } }}
              onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#0A1828' } }}
            >
              {scn.label.replace('What if ', '').replace('?', '')}
            </button>
          )
          // Wrap in tooltip when there's a precedent so hover surfaces the
          // real-world anchor without requiring a click. Plain button for
          // legacy scenarios without precedent (e.g. ad-hoc custom).
          return scn.precedent ? (
            <Tooltip key={scn.id}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="text-[10px] max-w-xs">
                <p className="font-bold mb-1" style={{ color: '#FBBF24' }}>Precedent</p>
                <p className="text-gray-300">{scn.precedent}</p>
              </TooltipContent>
            </Tooltip>
          ) : button
        })}
        {/* + Peer state toggle — opens inline state-mirror picker.
            Replaces the previous "+ Custom" two-dropdown overrider, which
            was abstract and felt useless next to the precedent-anchored
            preset chips. Now: pick another state, the scenario applies
            its full profile and surfaces a concrete diff. */}
        <button
          onClick={() => { setCustomOpen(o => !o); if (isCustomActive) setActiveScenario(null) }}
          aria-expanded={customOpen}
          aria-pressed={isCustomActive}
          aria-label="Compare this market to a peer state"
          className="font-mono text-[10px] uppercase tracking-[0.12em] font-semibold px-3 py-1.5 rounded-sm transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500"
          style={isCustomActive
            ? { background: '#0F1A2E', color: '#5EEAD4', border: '1px solid #14B8A6' }
            : { background: 'white', color: '#0A1828', border: '1px dashed #94A3B8' }}
        >
          {customOpen || isCustomActive ? '− Peer state' : '+ Peer state'}
        </button>
      </div>

      {/* Inline peer-state picker — drives the same lifted activeScenario state */}
      {customOpen && (
        <CustomScenarioInline
          stateProgram={stateProgram}
          technology={technology}
          activeScenario={activeScenario}
          setActiveScenario={setActiveScenario}
          programMap={programMap}
        />
      )}
    </div>
  )
}
