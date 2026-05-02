import { useState, useMemo, useEffect, useCallback } from 'react'
import { applyScenario, getSliderConfig, formatScenarioSummary, SCENARIO_DISCLAIMER, SCENARIO_PRESETS } from '../lib/scenarioEngine'
import { supabase } from '../lib/supabase'
import { useToast } from './ui/Toast'
import GlossaryLabel from './ui/GlossaryLabel'
import ScenarioHistoryList from './ScenarioHistoryList'

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
  // Linger state — when set, the Save button morphs into "✓ Saved" for
  // ~2.5s so the persistence is impossible to miss. Resets via a timer.
  const [justSavedName, setJustSavedName] = useState(null)
  // Auto-expand the AI commentary panel on the just-saved row so the
  // value of saving (the analyst note explaining what the scenario means)
  // is visible without an extra click. Cleared after a few seconds so
  // re-renders don't keep re-firing the auto-expand.
  const [justSavedId, setJustSavedId] = useState(null)

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
      .limit(25)
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

  function handlePreset(key) {
    const preset = SCENARIO_PRESETS[key]
    if (!preset) return
    const overrides = preset.apply(baseline.inputs)
    // Merge — undefined/null values from preset don't override (e.g. REC
    // for a state with no REC market stays at 0 baseline, not null).
    const next = { ...baseline.inputs }
    for (const [k, v] of Object.entries(overrides)) {
      if (v != null) next[k] = v
    }
    setSliders(next)
    if (!savedName) setSavedName(preset.label)
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
    // .select() so we get the inserted row's id back — passed to the
    // history list as autoExpandId so the new row auto-opens its
    // analyst-note panel post-save.
    const { data: inserted, error } = await supabase
      .from('scenario_snapshots')
      .insert({
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
      .select('id')
      .maybeSingle()
    setSaving(false)
    if (error) {
      showToast(`Save failed: ${error.message}`, 'error')
      return
    }
    const savedAs = savedName.trim()
    showToast(`Scenario "${savedAs}" saved`, 'success')
    setSavedName('')
    setNaming(false)
    setJustSavedName(savedAs)
    setTimeout(() => setJustSavedName(null), 2500)
    if (inserted?.id) {
      // Refresh BEFORE setting justSavedId so the row is already in the list
      // when the auto-expand effect runs. Eliminates the race where the
      // 4s magic-number timer could fire before async loadSavedScenarios
      // returned (slow networks / DB latency), leaving the new row
      // permanently un-expanded.
      await loadSavedScenarios()
      setJustSavedId(inserted.id)
      // Tighter hold (1.5s) — the row is already in the list and the
      // ScenarioHistoryList effect has already enqueued the fetch on the
      // same tick. The hold only keeps the parent's "auto-expand intent"
      // alive long enough that any incidental list re-renders don't
      // re-trigger expansion. ScenarioHistoryList's expandedIds Set
      // persists locally after first auto-expand, so the row stays open
      // even after justSavedId clears.
      setTimeout(() => setJustSavedId(null), 1500)
    } else {
      loadSavedScenarios()
    }
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
        {/* Left: presets + sliders (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Preset chips — one-tap "what if it goes well / wrong" envelopes.
              Applies modest 15-30% multipliers to the helpful sliders so the
              user can quickly see a reasonable upside vs. downside without
              learning the slider semantics first. */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-mono uppercase tracking-[0.20em] text-gray-500 font-bold mr-1">
              Try
            </span>
            <button
              type="button"
              onClick={() => handlePreset('best')}
              className="cursor-pointer text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all hover:brightness-110 hover:-translate-y-px"
              style={{ background: 'rgba(20,184,166,0.15)', color: '#0F766E', border: '1px solid rgba(20,184,166,0.45)' }}
            >
              ◆ Best case
            </button>
            <button
              type="button"
              onClick={() => handlePreset('worst')}
              className="cursor-pointer text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all hover:brightness-110 hover:-translate-y-px"
              style={{ background: 'rgba(217,119,6,0.15)', color: '#92400E', border: '1px solid rgba(217,119,6,0.45)' }}
            >
              ▼ Worst case
            </button>
            {isDirty && (
              <button
                type="button"
                onClick={handleReset}
                className="cursor-pointer text-[10px] font-medium px-2 py-1 transition-colors text-gray-500 hover:text-ink"
              >
                Reset
              </button>
            )}
          </div>

          {sliderConfig.map((cfg) => (
            <SliderRow
              key={cfg.key}
              cfg={cfg}
              value={sliders[cfg.key] ?? cfg.baseline}
              onChange={(v) => handleSliderChange(cfg.key, v)}
            />
          ))}
        </div>

        {/* Right: output card (2 cols) — 8 metrics in 2x4 grid + structured
            input-deltas section + save flow. Tightened padding + gap to
            reduce the dark expanse the user flagged; the input deltas now
            fill what was previously empty space. */}
        <div className="lg:col-span-2">
          <div
            className="rounded-lg p-3.5 h-full flex flex-col gap-2.5"
            style={{ background: '#0F1A2E', color: 'white' }}
          >
            <div className="grid grid-cols-2 gap-2.5">
              <MetricCell
                term="Year 1 Revenue"
                value={`$${formatLarge(out.year1Revenue)}`}
                suffix="/ yr"
                delta={out.revenueDelta != null && Math.abs(out.revenueDelta) > 100 ? out.revenueDeltaPct : null}
                format="pct"
                primary
              />
              <MetricCell
                term="Simple Payback"
                value={out.paybackYears != null ? `${out.paybackYears}` : '—'}
                suffix="yr"
                delta={out.paybackDelta != null && Math.abs(out.paybackDelta) > 0.1 ? -out.paybackDelta : null}
                format="years"
              />
              <MetricCell
                term="IRR"
                value={out.irr != null ? `${(out.irr * 100).toFixed(1)}%` : '—'}
                suffix="project"
                delta={out.irrDelta != null && Math.abs(out.irrDelta) > 0.001 ? out.irrDelta : null}
                format="irrPct"
              />
              <MetricCell
                term="Equity IRR"
                value={out.equityIrr != null ? `${(out.equityIrr * 100).toFixed(1)}%` : '—'}
                suffix="70/30 lev"
                delta={out.equityIrrDelta != null && Math.abs(out.equityIrrDelta) > 0.001 ? out.equityIrrDelta : null}
                format="irrPct"
              />
              <MetricCell
                term="NPV"
                value={out.npv != null ? `$${formatLarge(out.npv)}` : '—'}
                suffix={`@ ${(((sliders.discountRate ?? baseline.inputs.discountRate) || 0.08) * 100).toFixed(1)}%`}
                delta={out.npvDelta != null && Math.abs(out.npvDelta) > 1000 ? out.npvDelta / Math.max(Math.abs(baseline.outputs.npv) || 1, 1) : null}
                format="pct"
              />
              <MetricCell
                term="DSCR"
                value={out.dscr != null ? `${out.dscr.toFixed(2)}x` : '—'}
                suffix={out.dscr != null && out.dscr < 1.20 ? 'tight' : out.dscr != null && out.dscr >= 1.30 ? 'healthy' : ''}
                delta={out.dscrDelta != null && Math.abs(out.dscrDelta) > 0.02 ? out.dscrDelta : null}
                format="dscr"
              />
              <MetricCell
                term="LCOE"
                value={out.lcoe != null ? `$${out.lcoe.toFixed(0)}` : '—'}
                suffix="/ MWh"
                delta={out.lcoeDelta != null && Math.abs(out.lcoeDelta) > 0.5 ? -out.lcoeDelta : null}
                format="lcoe"
              />
              <MetricCell
                term="Lifetime Rev"
                value={out.lifetimeRevenue != null ? `$${formatLarge(out.lifetimeRevenue)}` : '—'}
                suffix="total"
              />
            </div>

            {/* Modified inputs as structured pill chips. One pill per
                slider that diverges from the baseline; clicking a pill
                resets just that input back to baseline. Replaces the old
                dot-separated summary string ("6.5 MW · $1.40/W capex"),
                which got hard to scan with more than 2 changes. */}
            <ModifiedInputsRow
              sliders={sliders}
              baselineInputs={baseline.inputs}
              sliderConfig={sliderConfig}
              onResetOne={(key) => setSliders((prev) => ({ ...prev, [key]: baseline.inputs[key] }))}
            />

            <div className="mt-auto pt-2 flex items-center gap-2 flex-wrap">
              {justSavedName ? (
                <div
                  className="text-[10px] font-semibold px-2.5 py-1.5 rounded-md flex-1 flex items-center justify-center gap-1.5"
                  style={{ background: 'rgba(16,185,129,0.20)', color: '#34D399', border: '1px solid rgba(16,185,129,0.45)' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Saved "{justSavedName}"
                </div>
              ) : !naming ? (
                <button
                  type="button"
                  onClick={() => setNaming(true)}
                  className="cursor-pointer text-[10px] font-semibold px-2.5 py-1.5 rounded-md transition-colors flex-1 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: 'rgba(20,184,166,0.20)', color: '#5EEAD4', border: '1px solid rgba(20,184,166,0.40)' }}
                  disabled={!user || !isDirty}
                >
                  {!user ? 'Sign in to save' : !isDirty ? 'Drag a slider to save' : '◆ Save this scenario'}
                </button>
              ) : (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    type="text"
                    autoFocus
                    value={savedName}
                    onChange={(e) => setSavedName(e.target.value)}
                    placeholder="Name it (e.g. Cheaper IX)"
                    className="flex-1 min-w-0 bg-transparent text-[10px] px-2 py-1 rounded-md text-white placeholder-gray-500"
                    style={{ border: '1px solid rgba(255,255,255,0.20)' }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave()
                      if (e.key === 'Escape') { setNaming(false); setSavedName('') }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !savedName.trim()}
                    className="cursor-pointer text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
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

      {/* Saved scenarios — vertical history list. Each row shows the
          scenario name + relative timestamp + headline metrics + a
          delta-vs-baseline chip so two saves with the same preset name
          are still visually distinct. Click any row to load it back
          into the sliders; trash icon deletes. Reused from
          ScenarioHistoryList so the Library Scenarios tab shows the
          same shape. */}
      {savedList.length > 0 && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.20em] text-gray-500 font-bold">
              Saved Scenarios
            </span>
            <span className="font-mono text-[9px] text-gray-400">
              ({savedList.length}{savedList.length === 25 ? ' most recent' : ''})
            </span>
          </div>
          <ScenarioHistoryList
            scenarios={savedList}
            onLoad={loadScenario}
            onDelete={(snap) => deleteSnapshot(snap.id, { stopPropagation: () => {} })}
            baselineRevenue={baseline.outputs?.year1Revenue ?? null}
            autoExpandId={justSavedId}
          />
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
  let value
  if (format === 'pct')        value = `${positive ? '+' : ''}${(delta * 100).toFixed(1)}%`
  else if (format === 'years') value = `${positive ? '+' : ''}${delta.toFixed(1)} yr`
  else if (format === 'irrPct') value = `${positive ? '+' : ''}${(delta * 100).toFixed(1)} pp`
  else if (format === 'lcoe')   value = `${positive ? '+' : ''}$${Math.abs(delta).toFixed(0)}`
  else if (format === 'dscr')   value = `${positive ? '+' : ''}${delta.toFixed(2)}x`
  else                          value = `${positive ? '+' : ''}${delta}`
  return (
    <span
      className="text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-sm"
      style={{
        background: positive ? 'rgba(16,185,129,0.20)' : 'rgba(220,38,38,0.20)',
        color: positive ? '#10B981' : '#FCA5A5',
      }}
    >
      {value}
    </span>
  )
}

// Compact metric cell for the 2x3 output grid. Shows the label, the big
// number, and a delta chip when the scenario diverges materially from
// the baseline. `primary` flag bumps the value font size for the
// headline metric (Year 1 Revenue).
function MetricCell({ term, glossaryTerm, value, suffix, delta, format, primary = false }) {
  const labelTerm = glossaryTerm || term
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <GlossaryLabel
          term={labelTerm}
          displayAs={term}
          className="font-mono text-[8px] uppercase tracking-[0.18em] font-bold text-gray-400 truncate"
        />
        {delta != null && <DeltaChip delta={delta} format={format} />}
      </div>
      <div className="font-bold tabular-nums" style={{ fontSize: primary ? '20px' : '16px', lineHeight: 1.15 }}>
        {value}
        {suffix && (
          <span className="text-[10px] font-normal text-gray-400 ml-1">{suffix}</span>
        )}
      </div>
    </div>
  )
}

function formatLarge(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toLocaleString()
}

// Pill-chip row showing modified inputs only (slider value diverges from
// baseline). Each chip is a button — click to revert that input to its
// baseline. Empty when nothing's been modified yet (caller still renders
// the slot so the navy card layout doesn't jump). Replaces the legacy
// "6.5 MW · $1.40/W capex · REC +15%" dot-separated string per Aden's
// feedback that the format was hard to scan.
function ModifiedInputsRow({ sliders, baselineInputs, sliderConfig, onResetOne }) {
  const modified = sliderConfig.filter((cfg) => {
    if (cfg.disabled) return false
    const cur = sliders[cfg.key]
    const base = cfg.baseline
    if (cur == null || base == null) return false
    return Math.abs(cur - base) > 1e-9
  })
  if (modified.length === 0) {
    return (
      <div className="text-[10px] text-gray-500 italic px-1">
        Drag any slider above to model an alternative scenario.
      </div>
    )
  }
  return (
    <div>
      <p className="font-mono text-[8px] uppercase tracking-[0.20em] font-bold text-gray-400 mb-1.5">
        Modified · {modified.length} input{modified.length === 1 ? '' : 's'}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {modified.map((cfg) => {
          const cur = sliders[cfg.key]
          const base = cfg.baseline
          // Direction-aware coloring (mirrors slider colors).
          let palette = { bg: 'rgba(255,255,255,0.08)', fg: '#E5E7EB', delta: '#94A3B8' }
          if (cfg.direction && cfg.direction !== 'neutral') {
            const delta = cur - base
            const better = (cfg.direction === 'higher-better' && delta > 0) || (cfg.direction === 'lower-better' && delta < 0)
            palette = better
              ? { bg: 'rgba(16,185,129,0.18)', fg: '#34D399', delta: '#34D399' }
              : { bg: 'rgba(217,119,6,0.18)',  fg: '#FCD34D', delta: '#FCD34D' }
          }
          // Compute the % delta for the badge text. Most inputs use a
          // percentage delta; system-size MW uses absolute MW since
          // percentages on small numbers feel weird.
          const pctDelta = base !== 0 ? (cur - base) / Math.abs(base) : 0
          const badgeText = cfg.key === 'systemSizeMW'
            ? `${cur > base ? '+' : ''}${(cur - base).toFixed(1)} MW`
            : `${pctDelta > 0 ? '+' : ''}${(pctDelta * 100).toFixed(0)}%`
          return (
            <button
              key={cfg.key}
              type="button"
              onClick={() => onResetOne(cfg.key)}
              className="cursor-pointer group/pill flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-md transition-all hover:brightness-125"
              style={{ background: palette.bg, border: `1px solid ${palette.fg}40`, color: palette.fg }}
              title="Click to reset this input to baseline"
            >
              <span className="font-semibold">{cfg.label}</span>
              <span className="font-bold tabular-nums">{cfg.format(cur)}</span>
              <span className="font-mono tabular-nums opacity-80" style={{ color: palette.delta }}>
                {badgeText}
              </span>
              <span className="opacity-0 group-hover/pill:opacity-100 transition-opacity text-[8px]">↺</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
