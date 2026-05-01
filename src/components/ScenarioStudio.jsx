import { useState, useMemo, useEffect, useCallback } from 'react'
import { applyScenario, getSliderConfig, formatScenarioSummary, SCENARIO_DISCLAIMER } from '../lib/scenarioEngine'
import { supabase } from '../lib/supabase'
import { useToast } from './ui/Toast'
import GlossaryLabel from './ui/GlossaryLabel'

// Scenario Studio — interactive sensitivity layer over an "achievable
// baseline." Lives inside the Lens result panel right after the Analyst
// Brief. Powers the deal-structuring use case the audit identified as
// the highest-leverage missing workflow.
//
// Inputs:
//   - baseline: from scenarioEngine.computeBaseline(). null = unsupported
//     state/tech (we render a graceful empty state so the section doesn't
//     just disappear silently).
//   - user: from useAuth(). When null, save controls are disabled with
//     a "sign in to save" cue.
//   - projectId: optional — when this Lens result is tied to a saved
//     project, persisted scenarios link to it so the Library card can
//     surface a "Scenarios: N" chip.
//   - countyName: free-text from the Lens form input.
//
// Output side effects:
//   - Inserts into scenario_snapshots on save (RLS-scoped to user_id).
//   - Reloads the saved-scenarios chip row from Supabase post-save.
//
// All compute is pure + synchronous (scenarioEngine.applyScenario), so
// dragging a slider is microsecond-fast — no debouncing needed.
export default function ScenarioStudio({ baseline, user, projectId = null, countyName = '' }) {
  const { showToast } = useToast()
  const [sliders, setSliders] = useState(() => baseline ? { ...baseline.inputs } : {})
  const [savedName, setSavedName] = useState('')
  const [naming, setNaming] = useState(false)
  const [savedList, setSavedList] = useState([])
  const [saving, setSaving] = useState(false)

  // Reset sliders whenever baseline changes (new Lens result loaded).
  useEffect(() => {
    if (baseline) setSliders({ ...baseline.inputs })
  }, [baseline?.stateId, baseline?.technology, baseline?.inputs?.systemSizeMW])

  // Live recompute. Pure function — no API calls.
  const scenario = useMemo(() => baseline ? applyScenario(baseline, sliders) : null, [baseline, sliders])
  const sliderConfig = useMemo(() => getSliderConfig(baseline), [baseline])

  // Load saved scenarios for this state + tech (+ project if linked).
  // Scoped at this granularity so a user only sees "their relevant"
  // scenarios for the current Lens context — not every scenario ever
  // saved.
  const loadSavedScenarios = useCallback(async () => {
    if (!user || !baseline) return
    let query = supabase
      .from('scenario_snapshots')
      .select('id, name, scenario_inputs, outputs, project_id, created_at')
      .eq('user_id', user.id)
      .eq('state_id', baseline.stateId)
      .eq('technology', baseline.technology)
      .order('created_at', { ascending: false })
      .limit(8)
    if (projectId) query = query.eq('project_id', projectId)
    const { data } = await query
    setSavedList(data || [])
  }, [user, baseline?.stateId, baseline?.technology, projectId])

  useEffect(() => { loadSavedScenarios() }, [loadSavedScenarios])

  if (!baseline) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 px-6 py-5 mt-2">
        <p className="text-[12px] text-gray-500">
          Scenario Studio isn't available for this state + tech combination yet.
          We need per-state revenue rates to anchor the baseline; coverage is
          live for IL · NY · MA · MN · CO · NJ · ME · MD today.
        </p>
      </div>
    )
  }

  const out = scenario?.outputs || baseline.outputs
  const isDirty = sliderConfig.some((s) => Math.abs((sliders[s.key] ?? 0) - (baseline.inputs[s.key] ?? 0)) > 1e-9)
  const summaryLine = scenario ? formatScenarioSummary(scenario, baseline) : ''

  function handleSliderChange(key, value) {
    setSliders((prev) => ({ ...prev, [key]: Number(value) }))
  }

  function handleReset() {
    setSliders({ ...baseline.inputs })
    setNaming(false)
    setSavedName('')
  }

  async function handleSave() {
    if (!user) {
      showToast('Sign in to save scenarios', 'error')
      return
    }
    if (!savedName.trim()) {
      showToast('Give your scenario a name first', 'error')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('scenario_snapshots').insert({
      user_id: user.id,
      project_id: projectId,
      state_id: baseline.stateId,
      county_name: countyName || null,
      technology: baseline.technology,
      name: savedName.trim(),
      baseline_inputs: baseline.inputs,
      scenario_inputs: scenario.inputs,
      outputs: scenario.outputs,
    })
    setSaving(false)
    if (error) {
      showToast(`Save failed: ${error.message}`, 'error')
      return
    }
    showToast(`Scenario "${savedName.trim()}" saved`, 'success')
    setSavedName('')
    setNaming(false)
    loadSavedScenarios()
  }

  function loadScenario(snap) {
    setSliders({ ...baseline.inputs, ...snap.scenario_inputs })
  }

  async function deleteSnapshot(id, e) {
    e.stopPropagation()
    const { error } = await supabase.from('scenario_snapshots').delete().eq('id', id)
    if (error) {
      showToast(`Delete failed: ${error.message}`, 'error')
      return
    }
    setSavedList((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <article
      className="mb-6 bg-white rounded-lg overflow-hidden relative"
      style={{ border: '1px solid #E2E8F0' }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #F59E0B 30%, #F59E0B 70%, transparent 100%)' }} />

      <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-gray-100 flex-wrap gap-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <GlossaryLabel
            term="Scenario Studio"
            className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold text-ink"
          />
          <GlossaryLabel
            term="Achievable Baseline"
            displayAs="◆ Industry Baseline"
            className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5"
            as="span"
          />
        </div>
        {isDirty && (
          <span
            className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5"
            style={{ background: 'rgba(245,158,11,0.10)', color: '#92400E', border: '1px solid rgba(245,158,11,0.30)' }}
          >
            Modified
          </span>
        )}
      </div>

      <div className="px-6 py-5 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: sliders (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {sliderConfig.map((cfg) => (
            <SliderRow
              key={cfg.key}
              cfg={cfg}
              value={sliders[cfg.key] ?? cfg.baseline}
              onChange={(v) => handleSliderChange(cfg.key, v)}
            />
          ))}
        </div>

        {/* Right: output card (2 cols) */}
        <div className="lg:col-span-2">
          <div
            className="rounded-lg p-4 h-full flex flex-col gap-3"
            style={{ background: '#0F1A2E', color: 'white' }}
          >
            <div className="flex items-center justify-between gap-2">
              <GlossaryLabel
                term="Year 1 Revenue"
                className="font-mono text-[9px] uppercase tracking-[0.22em] font-bold"
              />
              {out.revenueDelta != null && Math.abs(out.revenueDelta) > 100 && (
                <DeltaChip delta={out.revenueDeltaPct} format="pct" />
              )}
            </div>
            <div className="font-bold tabular-nums" style={{ fontSize: '26px', lineHeight: 1.1 }}>
              ${formatLarge(out.year1Revenue)}<span className="text-xs font-normal text-gray-400 ml-1">/ year</span>
            </div>
            {out.revenueDelta != null && Math.abs(out.revenueDelta) > 100 && (
              <div className="text-[10px] text-gray-400 tabular-nums">
                {out.revenueDelta > 0 ? '+' : ''}${formatLarge(out.revenueDelta)} vs baseline
              </div>
            )}

            <div className="h-px my-1" style={{ background: 'rgba(255,255,255,0.10)' }} />

            <div className="flex items-center justify-between gap-2">
              <GlossaryLabel
                term="Simple Payback"
                className="font-mono text-[9px] uppercase tracking-[0.22em] font-bold"
              />
              {out.paybackDelta != null && Math.abs(out.paybackDelta) > 0.1 && (
                <DeltaChip delta={-out.paybackDelta} format="years" />
              )}
            </div>
            <div className="font-bold tabular-nums" style={{ fontSize: '22px', lineHeight: 1.1 }}>
              {out.paybackYears != null ? `${out.paybackYears} yr` : '—'}
            </div>
            {out.paybackDelta != null && Math.abs(out.paybackDelta) > 0.1 && (
              <div className="text-[10px] text-gray-400 tabular-nums">
                {out.paybackDelta > 0 ? '+' : ''}{out.paybackDelta} yr vs baseline
              </div>
            )}

            {summaryLine && (
              <div className="mt-1 text-[10px] text-gray-400 leading-relaxed">
                {summaryLine}
              </div>
            )}

            <div className="mt-auto pt-2 flex items-center gap-2 flex-wrap">
              <button
                onClick={handleReset}
                className="text-[10px] font-semibold px-2 py-1 rounded-md transition-colors"
                style={{ color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.15)' }}
                disabled={!isDirty}
              >
                Reset
              </button>
              {!naming ? (
                <button
                  onClick={() => setNaming(true)}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors flex-1"
                  style={{ background: 'rgba(20,184,166,0.20)', color: '#5EEAD4', border: '1px solid rgba(20,184,166,0.40)' }}
                  disabled={!user || !isDirty}
                  title={!user ? 'Sign in to save scenarios' : !isDirty ? 'Drag a slider first' : ''}
                >
                  Save scenario
                </button>
              ) : (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    type="text"
                    autoFocus
                    value={savedName}
                    onChange={(e) => setSavedName(e.target.value)}
                    placeholder="e.g. 10MW + cheaper IX"
                    className="flex-1 min-w-0 bg-transparent text-[10px] px-2 py-1 rounded-md text-white"
                    style={{ border: '1px solid rgba(255,255,255,0.20)' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave()
                      if (e.key === 'Escape') { setNaming(false); setSavedName('') }
                    }}
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving || !savedName.trim()}
                    className="text-[10px] font-semibold px-2 py-1 rounded-md transition-colors"
                    style={{ background: '#14B8A6', color: 'white' }}
                  >
                    {saving ? '…' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Saved scenarios chip row */}
      {savedList.length > 0 && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.20em] text-gray-500 font-bold">
              Saved Scenarios
            </span>
            <span className="font-mono text-[9px] text-gray-400">({savedList.length})</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {savedList.map((snap) => (
              <button
                key={snap.id}
                onClick={() => loadScenario(snap)}
                className="group/chip flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md transition-colors"
                style={{ background: 'rgba(20,184,166,0.08)', color: '#0F766E', border: '1px solid rgba(20,184,166,0.25)' }}
              >
                <span className="font-semibold">{snap.name}</span>
                <span className="text-[9px] tabular-nums text-gray-500">
                  ${formatLarge(snap.outputs?.year1Revenue || 0)}
                </span>
                <span
                  onClick={(e) => deleteSnapshot(snap.id, e)}
                  className="opacity-0 group-hover/chip:opacity-100 transition-opacity hover:text-red-600 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`Delete scenario ${snap.name}`}
                  onKeyDown={(e) => { if (e.key === 'Enter') deleteSnapshot(snap.id, e) }}
                >
                  ✕
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 pb-4 pt-1">
        <div
          className="rounded-md px-3 py-2 flex items-start gap-2"
          style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.20)' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-[10px] leading-snug" style={{ color: '#78350F' }}>
            {SCENARIO_DISCLAIMER}
          </p>
        </div>
      </div>
    </article>
  )
}

// Color tokens for the three directional slider states. Equal-to-baseline is
// a slate-blue (no judgment, just "this is the starting point"). Better is
// teal (the platform's positive accent). Worse is amber (softer than red,
// matches the existing "Modified" badge so it doesn't read as a critical
// failure — just a directional cost). Sliders flagged direction:'neutral'
// (e.g. system size MW, where the financial impact is mixed) always use
// the baseline palette regardless of position.
const SLIDER_STATES = {
  baseline: { bg: 'rgba(15,26,46,0.06)', fg: '#475569', track: '#64748B' },  // slate
  better:   { bg: 'rgba(20,184,166,0.18)', fg: '#0F766E', track: '#14B8A6' }, // teal
  worse:    { bg: 'rgba(217,119,6,0.18)',  fg: '#92400E', track: '#D97706' }, // amber
}

function getSliderState(value, baseline, direction) {
  if (baseline == null || direction === 'neutral' || !direction) return 'baseline'
  const delta = value - baseline
  if (Math.abs(delta) < 1e-9) return 'baseline'
  if (direction === 'higher-better') return delta > 0 ? 'better' : 'worse'
  if (direction === 'lower-better')  return delta > 0 ? 'worse'  : 'better'
  return 'baseline'
}

function SliderRow({ cfg, value, onChange }) {
  const baseline = cfg.baseline
  const isModified = baseline != null && Math.abs(value - baseline) > 1e-9
  const state = getSliderState(value, baseline, cfg.direction)
  const palette = SLIDER_STATES[state]
  const fillPct = ((value - cfg.min) / (cfg.max - cfg.min)) * 100
  return (
    <div className={cfg.disabled ? 'opacity-50 pointer-events-none' : ''}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <GlossaryLabel
            term={cfg.label}
            className="text-[11px] font-semibold text-ink"
          />
          {cfg.unit && <span className="text-[10px] text-gray-500 font-mono">{cfg.unit}</span>}
        </div>
        <div className="flex items-center gap-2">
          {isModified && (
            <span className="text-[9px] font-mono text-gray-400 tabular-nums">
              base: {cfg.format(baseline)}
            </span>
          )}
          <span
            className="text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-sm transition-colors"
            style={{ background: palette.bg, color: palette.fg }}
          >
            {cfg.format(value)}
          </span>
        </div>
      </div>
      <input
        type="range"
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer scenario-slider"
        style={{
          background: `linear-gradient(to right, ${palette.track} 0%, ${palette.track} ${fillPct}%, #E2E8F0 ${fillPct}%, #E2E8F0 100%)`,
        }}
      />
    </div>
  )
}

function DeltaChip({ delta, format }) {
  if (delta == null) return null
  const positive = delta > 0
  const value = format === 'pct'
    ? `${positive ? '+' : ''}${(delta * 100).toFixed(1)}%`
    : `${positive ? '+' : ''}${delta} yr`
  return (
    <span
      className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-sm"
      style={{
        background: positive ? 'rgba(16,185,129,0.20)' : 'rgba(220,38,38,0.20)',
        color: positive ? '#10B981' : '#FCA5A5',
      }}
    >
      {value}
    </span>
  )
}

function formatLarge(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}
