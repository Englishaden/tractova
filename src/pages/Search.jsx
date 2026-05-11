import { useState, useRef, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getStateProgramMap, getCountyData, getRevenueStack, getRevenueRates, getEnergyCommunity, getHudQctDda, getNmtcLic, getPolicyImpactEvents } from '../lib/programData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import UpgradePrompt from '../components/UpgradePrompt'
import SectionDivider from '../components/SectionDivider'
import MarketPositionPanel from '../components/MarketPositionPanel.jsx'
import SiteControlCard from '../components/SiteControlCard.jsx'
import InterconnectionCard from '../components/InterconnectionCard.jsx'
import OfftakeCard from '../components/OfftakeCard.jsx'
import MarketIntelligenceSummary from '../components/MarketIntelligenceSummary.jsx'
import { useToast } from '../components/ui/Toast'

// 2026-05-07 cleanup: dropped 16 leftover Search.jsx imports that
// became orphans after Sprint 2.3 extracted the panels (each panel
// now imports its own scoreEngine / revenueEngine helpers directly).
// Kept only the helpers Search.jsx itself still references.

import { getIXQueueSummary } from '../lib/programData'
import { TECH_FILTER_TOOLTIPS } from '../lib/techDefinitions'
import ScenarioStudio from '../components/ScenarioStudio'
import { computeBaseline as computeScenarioBaseline, denormalizeTech } from '../lib/scenarioEngine'
import LensTour from '../components/LensTour'
import DataLimitationsModal from '../components/DataLimitationsModal'
import IntelligenceBackground from '../components/IntelligenceBackground'
import RunIdMasthead from '../components/RunIdMasthead'
import SectionMarker from '../components/SectionMarker'
import LensScenarioRow from '../components/LensScenarioRow'
import LensOverlay, { LENS_OVERLAY_STYLES } from '../components/LensOverlay'
import FieldSelect from '../components/FieldSelect'
import CountyCombobox from '../components/CountyCombobox'
import AddToCompareButton from '../components/AddToCompareButton'
import {
  MaybeRegulatoryPanel,
  MaybeSpecificYieldPanel,
  MaybeCsMarketPanel,
  MaybeComparableDealsPanel,
} from '../components/MaybeLensPanels'

import { getNearestSubstations } from '../lib/substationEngine'

// Sprint F.2 — helpers (getMarketRank, STATUS_CFG, sanitizeBrief, presentational
// primitives, computeScoreDelta, buildSensitivityScenarios, CHIP_COLORS)
// moved to src/lib/searchShared.jsx to break the import cycle with child
// components that previously re-imported these from this page.
//
// Search.jsx defines them no longer; both the page and the child components
// now import from the shared module. Re-exported below as a kindness to any
// caller that was relying on `import ... from '../pages/Search.jsx'` —
// callsites have been migrated, but this keeps the module backwards-compatible
// in case a missed reference slips through.
export {
  getMarketRank,
  STATUS_CFG,
  sanitizeBrief,
  SectionLabel,
  DataRow,
  EaseArcGauge,
  QueueBadge,
  RunwayBadge,
  CSStatusBadge,
  computeScoreDelta,
  buildSensitivityScenarios,
  CHIP_COLORS,
} from '../lib/searchShared.jsx'

// AnimatedScoreText + ArcGauge moved to src/components/ArcGauge.jsx (Sprint 2.3).
// SubScoreBar moved to src/components/SubScoreBar.jsx (Sprint E.3).
// MarketPositionPanel moved to src/components/MarketPositionPanel.jsx (Sprint 2.3).

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ALL_STATES = [
  { id: 'AL', name: 'Alabama' }, { id: 'AK', name: 'Alaska' },
  { id: 'AZ', name: 'Arizona' }, { id: 'AR', name: 'Arkansas' },
  { id: 'CA', name: 'California' }, { id: 'CO', name: 'Colorado' },
  { id: 'CT', name: 'Connecticut' }, { id: 'DE', name: 'Delaware' },
  { id: 'FL', name: 'Florida' }, { id: 'GA', name: 'Georgia' },
  { id: 'HI', name: 'Hawaii' }, { id: 'ID', name: 'Idaho' },
  { id: 'IL', name: 'Illinois' }, { id: 'IN', name: 'Indiana' },
  { id: 'IA', name: 'Iowa' }, { id: 'KS', name: 'Kansas' },
  { id: 'KY', name: 'Kentucky' }, { id: 'LA', name: 'Louisiana' },
  { id: 'ME', name: 'Maine' }, { id: 'MD', name: 'Maryland' },
  { id: 'MA', name: 'Massachusetts' }, { id: 'MI', name: 'Michigan' },
  { id: 'MN', name: 'Minnesota' }, { id: 'MS', name: 'Mississippi' },
  { id: 'MO', name: 'Missouri' }, { id: 'MT', name: 'Montana' },
  { id: 'NE', name: 'Nebraska' }, { id: 'NV', name: 'Nevada' },
  { id: 'NH', name: 'New Hampshire' }, { id: 'NJ', name: 'New Jersey' },
  { id: 'NM', name: 'New Mexico' }, { id: 'NY', name: 'New York' },
  { id: 'NC', name: 'North Carolina' }, { id: 'ND', name: 'North Dakota' },
  { id: 'OH', name: 'Ohio' }, { id: 'OK', name: 'Oklahoma' },
  { id: 'OR', name: 'Oregon' }, { id: 'PA', name: 'Pennsylvania' },
  { id: 'RI', name: 'Rhode Island' }, { id: 'SC', name: 'South Carolina' },
  { id: 'SD', name: 'South Dakota' }, { id: 'TN', name: 'Tennessee' },
  { id: 'TX', name: 'Texas' }, { id: 'UT', name: 'Utah' },
  { id: 'VT', name: 'Vermont' }, { id: 'VA', name: 'Virginia' },
  { id: 'WA', name: 'Washington' }, { id: 'WV', name: 'West Virginia' },
  { id: 'WI', name: 'Wisconsin' }, { id: 'WY', name: 'Wyoming' },
]

const STAGES = ['Prospecting', 'Site Control', 'Pre-Development', 'Development', 'NTP (Notice to Proceed)', 'Construction', 'Operational']
const TECHNOLOGIES = ['Community Solar', 'Hybrid', '---', 'C&I Solar', 'BESS']

// ─────────────────────────────────────────────────────────────────────────────
// Small UI helpers
// ─────────────────────────────────────────────────────────────────────────────
// RunIdMasthead moved to src/components/RunIdMasthead.jsx (Sprint E.3).
// SectionMarker moved to src/components/SectionMarker.jsx (Sprint E.3).
// CollapsibleCard moved to src/components/CollapsibleCard.jsx (Sprint E.3).
// CardDrilldown moved to src/components/CardDrilldown.jsx (Sprint E.3).
// SectionLabel / DataRow / EaseArcGauge / QueueBadge / RunwayBadge /
// CSStatusBadge moved to src/lib/searchShared.jsx (Sprint F.2).

function PillarIcon({ type }) {
  if (type === 'site') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
  if (type === 'ix') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
  if (type === 'offtake') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  )
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Pillar Cards
// ─────────────────────────────────────────────────────────────────────────────
// SiteControlCard moved to src/components/SiteControlCard.jsx (Sprint 2.3).

// InterconnectionCard moved to src/components/InterconnectionCard.jsx (Sprint 2.3).

// RevenueStackBar moved to src/components/RevenueStackBar.jsx (Sprint E.3).
// RevenueProjectionSection moved to src/components/RevenueProjectionSection.jsx (Sprint E.3).
// SolarCostLineagePanel moved to src/components/SolarCostLineagePanel.jsx (Sprint E.3).

// OfftakeCard moved to src/components/OfftakeCard.jsx (Sprint 2.3).

// generateMarketSummary moved to src/lib/lensHelpers.js (Sprint 2.3).

// ─────────────────────────────────────────────────────────────────────────────
// Sensitivity analysis — score delta + scenario builder
// computeScoreDelta + buildSensitivityScenarios moved to src/lib/searchShared.jsx
// (Sprint F.2). Re-exported at the top of this file for back-compat.
// ─────────────────────────────────────────────────────────────────────────────
// BriefDrilldown moved to src/components/BriefDrilldown.jsx (Sprint E.3).

// MarketIntelligenceSummary moved to src/components/MarketIntelligenceSummary.jsx (Sprint 2.3).

// LensScenarioRow moved to src/components/LensScenarioRow.jsx (Sprint E.3).

// CustomScenarioInline moved to src/components/CustomScenarioInline.jsx (Sprint E.3).
// CustomScenarioBuilder moved to src/components/CustomScenarioBuilder.jsx (Sprint E.3).

// ─────────────────────────────────────────────────────────────────────────────
// LENS_OVERLAY_STYLES + LensOverlay moved to src/components/LensOverlay.jsx (Sprint E.3).

// ─────────────────────────────────────────────────────────────────────────────
// Shared style constant (used by Search form's MW input)
// ─────────────────────────────────────────────────────────────────────────────
const inputCls = "w-full text-sm bg-transparent border-0 outline-hidden px-0 py-0 text-gray-900 placeholder-gray-400 appearance-none"

// FieldSelect moved to src/components/FieldSelect.jsx (Sprint E.3).
// CountyCombobox moved to src/components/CountyCombobox.jsx (Sprint E.3).
// AddToCompareButton moved to src/components/AddToCompareButton.jsx (Sprint E.3).

// ─────────────────────────────────────────────────────────────────────────────
// AI Insight fetch helper — calls /api/lens-insight, returns insight or null
// ─────────────────────────────────────────────────────────────────────────────
async function fetchAIInsight({ form, stateProgram, countyData, revenueStack, runway, ixQueue, accessToken, signal }) {
  const body = JSON.stringify({
    state:        form.state,
    county:       form.county,
    mw:           form.mw,
    stage:        form.stage,
    technology:   form.technology,
    stateProgram,
    countyData,
    revenueStack,
    runway,
    ixQueue,
  })
  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${accessToken}`,
  }
  // Single retry on 5xx — protects against transient Vercel platform errors
  // (cold-start glitches, edge-node hiccups). The 2026-05-10 audit caught a
  // ~3% rate of one-off 500s that didn't reproduce on second call. The
  // Anthropic call itself is idempotent + cached, so retry is safe.
  // 4xx is NOT retried (auth/rate-limit/validation errors don't self-heal).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('/api/lens-insight', { method: 'POST', headers, signal, body })
      if (res.ok) {
        const data = await res.json()
        return { insight: data.insight ?? null, reason: data.reason ?? (data.insight ? 'ok' : 'null_insight') }
      }
      if (res.status >= 500 && attempt === 0) {
        // Brief backoff so we don't slam the same edge node again
        await new Promise(r => setTimeout(r, 800))
        continue
      }
      return { insight: null, reason: `http_${res.status}` }
    } catch (err) {
      if (err.name === 'AbortError') throw err
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 800))
        continue
      }
      return { insight: null, reason: `fetch_error: ${err.message}` }
    }
  }
  return { insight: null, reason: 'http_5xx_after_retry' }
}

// ─────────────────────────────────────────────────────────────────────────────
// Paywall gate — renders UpgradePrompt until subscription is confirmed Pro
export default function Search() {
  const { isPro, loading: subLoading } = useSubscription()
  if (subLoading) return <div className="min-h-screen bg-surface" />
  if (!isPro)     return <UpgradePrompt feature="Tractova Lens" />
  return <SearchContent />
}

// MaybeRegulatoryPanel / MaybeSpecificYieldPanel / MaybeCsMarketPanel /
// MaybeComparableDealsPanel moved to src/components/MaybeLensPanels.jsx (Sprint E.3).

// ─────────────────────────────────────────────────────────────────────────────
// Main Search content (only mounts when user is confirmed Pro)
// ─────────────────────────────────────────────────────────────────────────────
function SearchContent() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const initialState = (() => {
    const param = searchParams.get('state')?.toUpperCase()
    return param && ALL_STATES.some(s => s.id === param) ? param : ''
  })()
  const initialCounty = searchParams.get('county') || ''
  const initialMW = searchParams.get('mw') || ''
  const initialStage = searchParams.get('stage') || ''
  // Denormalize incoming engine-slug values ("community-solar" → "Community
  // Solar") so the dropdown can match against TECHNOLOGIES list. Pass-through
  // when already a display label. Handles legacy slug-format scenarios +
  // any external links / bookmarks using the slug form.
  const initialTechnology = denormalizeTech(searchParams.get('technology') || '')

  const [form, setForm] = useState({
    state: initialState,
    county: initialCounty,
    mw: initialMW,
    stage: initialStage,
    technology: initialTechnology,
  })
  const [programMap, setProgramMap]   = useState(null)
  const [results, setResults]         = useState(null)
  const [analyzing, setAnalyzing]     = useState(false)
  // Look up the most recent saved project matching the current Lens
  // context (state + county + tech). When found, scenarios saved from
  // the Studio attach to that project_id so the Library card can show
  // the "Scenarios: N" chip. Falls back to null = ad-hoc scenario.
  const [matchingProjectId, setMatchingProjectId] = useState(null)
  const toast = useToast()
  const [saveModal, setSaveModal] = useState(null) // { defaultName } | null
  const [dataLimitationsOpen, setDataLimitationsOpen] = useState(false)
  const [saveName, setSaveName]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)

  // ESC closes save modal + confirm-clear modal — both are hand-rolled
  // (not Radix Dialog) so they need explicit keyboard handling for parity
  // with the rest of the app's modal accessibility.
  useEffect(() => {
    if (!saveModal && !confirmClear) return
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return
      if (saveModal) setSaveModal(null)
      if (confirmClear) setConfirmClear(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [saveModal, confirmClear])
  // V3 §7.4: lift sensitivity scenario state to SearchContent so both
  // MarketPositionPanel (gauge) and MarketIntelligenceSummary (rationale) read the same live state.
  // Toggling a scenario re-renders the gauge in place — no scroll-up needed.
  const [activeScenario, setActiveScenario] = useState(null)
  const [scenarioRationale, setScenarioRationale] = useState(null)
  const [rationaleLoading, setRationaleLoading] = useState(false)
  // Reset scenario on a new analysis
  useEffect(() => { setActiveScenario(null); setScenarioRationale(null) }, [results?.form?.state, results?.form?.county, results?.form?.mw, results?.form?.stage, results?.form?.technology])
  const resultsRef = useRef(null)
  const abortRef = useRef(null)

  // ESC to cancel analysis
  useEffect(() => {
    if (!analyzing) return
    const handler = (e) => { if (e.key === 'Escape') abortRef.current?.abort() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [analyzing])

  // Load live state program map on mount — used for market rank + handleSubmit
  useEffect(() => {
    getStateProgramMap().then(setProgramMap).catch(console.error)
  }, [])

  // Match Lens results → existing saved project so saved scenarios
  // attach to the project_id (Library chip flow). Re-runs each time
  // the Lens context changes. Most-recent match wins.
  useEffect(() => {
    if (!user || !results?.form?.state || !results?.form?.county) {
      setMatchingProjectId(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .eq('state', results.form.state)
        .eq('county', results.form.county)
        .eq('technology', results.form.technology || '')
        .order('saved_at', { ascending: false })
        .limit(1)
      if (cancelled) return
      setMatchingProjectId(data?.[0]?.id ?? null)
    })()
    return () => { cancelled = true }
  }, [user, results?.form?.state, results?.form?.county, results?.form?.technology])

  // Restore from sessionStorage on mount (URL param takes priority)
  useEffect(() => {
    if (initialState) return
    try {
      const savedForm = sessionStorage.getItem('tractova_lens_form')
      if (savedForm) setForm(JSON.parse(savedForm))
      const savedResults = sessionStorage.getItem('tractova_lens_results')
      if (savedResults) setResults(JSON.parse(savedResults))
    } catch { /* ignore parse errors */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync form to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('tractova_lens_form', JSON.stringify(form))
  }, [form])

  // Sync results to sessionStorage
  useEffect(() => {
    if (results) sessionStorage.setItem('tractova_lens_results', JSON.stringify(results))
    else sessionStorage.removeItem('tractova_lens_results')
  }, [results])

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  // Auto-submit when the URL carries enough context to run the analysis
  // (state + county + mw). Used by:
  //   - Library card "Re-Analyze in Lens" link
  //   - Library Scenarios tab "Open in Lens to save →" link (exploration scenarios)
  //   - Direct URL share / bookmark
  // Stage + technology are optional — the analysis still computes without
  // them (stage defaults to "no modifier", technology defaults to CS).
  // Removing those from the gate eliminates a class of "I clicked the
  // link but it didn't run" footguns when context is incomplete.
  const autoSubmitFired = useRef(false)
  useEffect(() => {
    if (autoSubmitFired.current || !programMap) return
    if (initialState && initialCounty && initialMW) {
      autoSubmitFired.current = true
      formRef.current?.requestSubmit()
    }
  }, [programMap]) // eslint-disable-line react-hooks/exhaustive-deps

  const formRef = useRef(null)

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setResults(null)
    setAnalyzing(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token ?? ''

      const [stateProgram, countyData, revenueStack, ixQueueSummary, substations, revenueRates, energyCommunity, hudQctDda, nmtcLic, policyEvents] = await Promise.all([
        programMap?.[form.state] ?? getStateProgramMap().then(m => m[form.state] ?? null),
        getCountyData(form.state, form.county),
        getRevenueStack(form.state),
        getIXQueueSummary(form.state, form.mw),
        getNearestSubstations(form.state, form.county),
        getRevenueRates(form.state),
        getEnergyCommunity(form.state, form.county),
        getHudQctDda(form.state, form.county),
        getNmtcLic(form.state, form.county),
        getPolicyImpactEvents({ state: form.state }),
      ])
      const runway = stateProgram?.runway ?? null

      abortRef.current = new AbortController()
      let aiInsight = null
      try {
        const [aiResult] = await Promise.all([
          fetchAIInsight({ form, stateProgram, countyData, revenueStack, runway, ixQueue: ixQueueSummary, accessToken, signal: abortRef.current.signal }),
          new Promise(resolve => setTimeout(resolve, 800)),
        ])
        aiInsight = aiResult?.insight ?? null
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('[Lens] AI insight failed, showing analysis without it:', err.message)
        // AbortError or other AI failure → fall through with aiInsight=null;
        // analysis is still useful without the AI verdict.
      }

      setResults({ form: { ...form }, stateProgram, countyData, revenueStack, ixQueueSummary, substations, revenueRates, energyCommunity, hudQctDda, nmtcLic, policyEvents, aiInsight })
    } catch (err) {
      // Any uncaught error in data fetching used to leave analyzing=true forever
      // (the white-screen loading hang). Surface it to the user instead.
      console.error('[Lens] analysis failed:', err)
      toast.error('Analysis failed', { description: err?.message?.slice(0, 200) || 'Please try again. If the issue persists, check your connection.' })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = () => {
    if (!results) return
    const defaultName = `${results.form.county} ${results.form.mw}MW ${results.form.technology}`
    setSaveName(defaultName)
    setSaveError(null)
    setSaveModal({ defaultName })
  }

  const handleSaveConfirm = async () => {
    if (!results) return
    setSaving(true)
    setSaveError(null)
    try {
      // Re-fetch the live session at click time. The `user` from context can be
      // stale if the supabase auth session expired silently while the tab was idle.
      const { data: { session } } = await supabase.auth.getSession()
      const liveUser = session?.user
      if (!liveUser) {
        setSaveError('Your session expired. Please sign in again.')
        setSaving(false)
        return
      }

      const mwNum = parseFloat(results.form.mw)
      const payload = {
        user_id:          liveUser.id,
        name:             saveName.trim() || `${results.form.county} ${results.form.mw}MW ${results.form.technology}`,
        state:            results.form.state,
        state_name:       results.stateProgram?.name || results.form.state,
        county:           results.form.county,
        mw:               isNaN(mwNum) ? null : mwNum,
        stage:            results.form.stage,
        technology:       results.form.technology,
        cs_program:       results.stateProgram?.csProgram || null,
        cs_status:        results.stateProgram?.csStatus || 'none',
        serving_utility:  results.countyData?.interconnection?.servingUtility || null,
        ix_difficulty:    results.stateProgram?.ixDifficulty || null,
        opportunity_score: results.stateProgram?.feasibilityScore ?? null,
      }

      // Schema-cache-resilient insert: if the production projects table is
      // missing a column (e.g. migration 011 hasn't been run yet), PostgREST
      // returns a "Could not find the 'X' column" error. We detect that,
      // strip the offending column from the payload, and retry. Worst case
      // we save the bare-minimum core fields (user_id, name, state, county,
      // mw, stage) and log which fields were dropped so we know what to
      // backfill once the migration runs.
      const droppedFields = []
      let attempt = { ...payload }
      // Cap retries so we can't loop forever on a different error class
      for (let i = 0; i < 12; i++) {
        const { data: insertedRows, error } = await supabase
          .from('projects')
          .insert(attempt)
          .select('id')
        if (!error) {
          setSaving(false)
          setSaveModal(null)
          toast.success('Project saved to Library', {
            eyebrow: '◆ Saved',
            description: `${payload.name} · ${payload.county} County, ${payload.state}`,
          })
          if (droppedFields.length) {
            console.warn('[Save to Library] saved without these fields (run migration 011 in Supabase to enable):', droppedFields)
          }
          // Audit log: emit a 'created' event so the Library Audit tab has
          // a record of project birth. Silent on failure.
          const newId = insertedRows?.[0]?.id
          if (newId) {
            try {
              const { logProjectEvent } = await import('../lib/projectEvents')
              await logProjectEvent({
                projectId: newId,
                userId: user.id,
                kind: 'created',
                detail: `Project saved: ${payload.name} · ${payload.county} County, ${payload.state} · ${payload.mw} MW · ${payload.stage || 'no stage'}`,
                meta: { stage: payload.stage, mw: payload.mw, score: payload.opportunity_score },
              })
            } catch (_err) { /* audit failure must not block save */ }

            // Auto-promote orphan scenarios. If the user explored several
            // scenarios in the Studio before deciding to save the project,
            // those rows have project_id=null and would otherwise be
            // invisible in the Library card. Sweep up any orphans that
            // match this exact Lens context (state + county + tech) and
            // were saved within the last 7 days, attaching them to the
            // newly-created project. The 7-day window prevents truly
            // stale orphans from getting linked retroactively. Failure
            // here must NOT block the save flow — it's a courtesy attach.
            try {
              const since = new Date(Date.now() - 7 * 86400000).toISOString()
              const { data: promoted } = await supabase
                .from('scenario_snapshots')
                .update({ project_id: newId })
                .eq('user_id', liveUser.id)
                .is('project_id', null)
                .eq('state_id', payload.state)
                .eq('county_name', payload.county)
                .eq('technology', payload.technology)
                .gte('created_at', since)
                .select('id')
              if (promoted?.length) {
                toast.success(`${promoted.length} scenario${promoted.length === 1 ? '' : 's'} attached to this project`, {
                  eyebrow: '◆ Scenarios linked',
                })
              }
            } catch (err) { console.warn('[Save to Library] orphan auto-promote failed:', err.message) }
          }
          return
        }
        // Match BOTH the PostgREST schema-cache error and the native PG missing-column error
        const m = error.message?.match(/['"]([^'"]+)['"]\s+column/i)
                 || error.message?.match(/column\s+['"]?([a-z_]+)['"]?\s+(?:of relation|does not exist)/i)
        if (m && Object.prototype.hasOwnProperty.call(attempt, m[1])) {
          droppedFields.push(m[1])
          delete attempt[m[1]]
          continue
        }
        // Different error -- surface it
        console.error('[Save to Library] insert failed:', error)
        setSaving(false)
        setSaveError(error.message || 'Could not save project. Please try again.')
        return
      }
      // Hit the retry cap without success
      setSaving(false)
      setSaveError('Save failed after multiple attempts. Please refresh and try again.')
    } catch (err) {
      console.error('[Save to Library] unexpected error:', err)
      setSaving(false)
      setSaveError(err?.message || 'Unexpected error. Please try again.')
    }
  }

  const handleClearAll = () => {
    setForm({ state: '', county: '', mw: '', stage: '', technology: '' })
    setResults(null)
    setConfirmClear(false)
    sessionStorage.removeItem('tractova_lens_form')
    sessionStorage.removeItem('tractova_lens_results')
  }

  const isFormValid = form.state && form.county.trim() && form.mw && form.stage && form.technology
  const hasAnyInput = form.state || form.county || form.mw || form.stage || form.technology || results

  // V3: form labels use ink-muted for institutional feel (was text-primary-700 emerald)
  const labelCls = "block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5"

  return (
    <div className="min-h-screen bg-surface relative">
      <style>{LENS_OVERLAY_STYLES}</style>
      {/* Ambient intelligence layer (no Tractova mark cameo on Lens —
          result panel is content-dense and a cameo crossing mid-read
          would pull focus from Feasibility Index / Analyst Brief /
          Scenario Studio. The ambient z-0 layer sits behind the white
          result cards + navy form panel without competing for attention. */}
      <IntelligenceBackground />
      <LensOverlay
        visible={analyzing}
        stateName={ALL_STATES.find(s => s.id === form.state)?.name || ''}
        countyName={form.county}
        onCancel={() => abortRef.current?.abort()}
      />
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-16">

        {/* Page header */}
        <div className="mt-4 mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Tractova Lens</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Enter a specific project to get targeted site control, interconnection, and offtake intelligence.
          </p>
        </div>

        {/* Search form */}
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="rounded-xl border border-gray-200/80"
          style={{ boxShadow: '0 2px 12px rgba(20,184,166,0.08), 0 1px 3px rgba(0,0,0,0.06)' }}
        >
          {/* V3: Brand-navy header band (was old dark-emerald). Matches Library banner / MetricsBar. */}
          <div
            className="px-6 py-5 flex items-center gap-4 rounded-t-xl relative"
            style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}
          >
            {/* Top teal accent rail — V3 brand signature */}
            <div className="absolute top-0 left-0 right-0 h-px rounded-t-xl"
              style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.55) 30%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.55) 70%, transparent 100%)' }} />

            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(20,184,166,0.18)', border: '1px solid rgba(20,184,166,0.32)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5EEAD4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.24em] leading-none mb-1.5"
                style={{ color: '#5EEAD4' }}>
                Tractova Lens · New Analysis
              </p>
              <h2 className="font-serif text-lg font-semibold text-white leading-tight" style={{ letterSpacing: '-0.01em' }}>
                Run a targeted intelligence report
              </h2>
            </div>

            {/* Required field hint */}
            <p className="font-mono text-[10px] shrink-0 hidden lg:block uppercase tracking-[0.16em]"
              style={{ color: 'rgba(255,255,255,0.40)' }}>
              All fields required
            </p>
          </div>

          {/* Fields — V3 paper background, no longer green-tinted */}
          <div className="px-5 py-5 bg-paper rounded-b-xl">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">

              {/* State */}
              <FieldSelect
                label="State"
                labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
                value={ALL_STATES.find(s => s.id === form.state)?.name || ''}
                onChange={(name) => {
                  const s = ALL_STATES.find(s => s.name === name)
                  setForm((f) => ({ ...f, state: s?.id || '', county: '' }))
                }}
                options={ALL_STATES.map(s => s.name)}
                placeholder="Select state…"
                required
              />

              {/* County */}
              <CountyCombobox
                stateId={form.state}
                value={form.county}
                onValueChange={(val) => setForm((f) => ({ ...f, county: val }))}
              />

              {/* MW */}
              <div className="bg-white rounded-lg border border-gray-200 px-3.5 pt-2.5 pb-2 shadow-xs transition-all focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/15 focus-within:ring-2 focus-within:ring-primary/10">
                <label className={labelCls + ' flex items-center gap-1.5'}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Project Size (MW AC)
                </label>
                <input
                  type="number"
                  value={form.mw}
                  onChange={set('mw')}
                  placeholder="e.g. 5"
                  min="0.1"
                  step="0.1"
                  required
                  className={inputCls + ' w-full'}
                />
              </div>

              {/* Development stage */}
              <FieldSelect
                label="Development Stage"
                labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                value={form.stage}
                onChange={(val) => setForm((f) => ({ ...f, stage: val }))}
                options={STAGES}
                placeholder="Select stage…"
                required
              />

              {/* Technology */}
              <FieldSelect
                label="Technology Type"
                labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>}
                value={form.technology}
                onChange={(val) => setForm((f) => ({ ...f, technology: val }))}
                options={TECHNOLOGIES}
                placeholder="Select type…"
                optionTooltips={TECH_FILTER_TOOLTIPS}
                required
              />
            </div>
          </div>

          {/* Submit row */}
          <div className="bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 mt-2">
            <p className="text-xs text-gray-400 hidden sm:block flex-1">
              Intelligence is generated from seeded state + county data — verify with your utility and PUC before committing capital.
            </p>
            <div className="flex items-center gap-3 ml-auto shrink-0">
              {/* Clear All — two-step inline confirm */}
              {hasAnyInput && !confirmClear && (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-red-200"
                >
                  Clear All
                </button>
              )}
              {confirmClear && (
                <div className="flex items-center gap-2 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                  <span className="text-gray-600">Clear all inputs?</span>
                  <button type="button" onClick={handleClearAll} className="font-semibold text-red-600 hover:underline">Yes, clear</button>
                  <button type="button" onClick={() => setConfirmClear(false)} className="text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              )}
              <button
                type="submit"
                disabled={!isFormValid || analyzing}
                className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-primary-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed min-w-[160px] justify-center"
              >
                {analyzing ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    Run Lens Analysis
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Results panel */}
        {results && (
          <div ref={resultsRef}>
            {/* Bloomberg-style run-id masthead — research-grade character */}
            <RunIdMasthead form={results.form} />
            <SectionDivider />
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {results.form.county} County, {results.stateProgram?.name || results.form.state}
                  <span className="text-gray-400 font-normal mx-2">·</span>
                  <span className="text-gray-600">{results.form.mw} MW AC</span>
                  <span className="text-gray-400 font-normal mx-2">·</span>
                  <span className="text-gray-600">{results.form.technology}</span>
                  <span className="text-gray-400 font-normal mx-2">·</span>
                  <span className="text-gray-600">{results.form.stage}</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Intelligence as of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {(() => {
                    const sp = results.stateProgram
                    const v = sp?.lastVerified ? new Date(sp.lastVerified) : null
                    const u = sp?.updatedAt    ? new Date(sp.updatedAt)    : null
                    const latest = (v && u) ? (v > u ? v : u) : (v || u)
                    if (!latest) return null
                    const diffDays = Math.floor((Date.now() - latest) / (1000 * 60 * 60 * 24))
                    const rel = diffDays === 0 ? 'today' : diffDays === 1 ? 'yesterday' : diffDays < 7 ? `${diffDays}d ago` : diffDays < 30 ? `${Math.floor(diffDays / 7)}w ago` : `${Math.floor(diffDays / 30)}mo ago`
                    const full = latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    return <span className="group relative cursor-default"> · Data verified {rel}<span className="absolute bottom-full left-0 mb-1 px-2 py-1 text-[10px] bg-gray-800 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-75 whitespace-nowrap pointer-events-none">{full}</span></span>
                  })()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Add to Compare */}
                <AddToCompareButton results={results} />

                {/* Save as Project */}
                <button
                  onClick={handleSave}
                  data-tour-id="save"
                  className="flex items-center gap-2 bg-white border border-gray-200 text-sm font-medium text-gray-700 px-4 py-2 rounded-lg hover:border-primary hover:text-primary transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Save as Project
                </button>
              </div>
            </div>

            <SectionMarker index={1} label="Market Position" sublabel="composite feasibility · sensitivity scenarios" />

            <div data-tour-id="composite">
              <MarketPositionPanel
                stateProgram={results.stateProgram}
                countyData={results.countyData}
                programMap={programMap}
                stage={results.form.stage}
                technology={results.form.technology}
                activeScenario={activeScenario}
                ixQueueSummary={results.ixQueueSummary}
              />
            </div>

            {/* §7.4: Scenario toggle row — sits with the gauge so toggling updates the gauge in place */}
            <LensScenarioRow
              stateProgram={results.stateProgram}
              technology={results.form.technology}
              mw={results.form.mw}
              activeScenario={activeScenario}
              setActiveScenario={setActiveScenario}
              countyData={results.countyData}
              formForApi={results.form}
              programMap={programMap}
            />

            {/* Market Intelligence Summary */}
            <SectionMarker index={2} label="Analyst Brief" sublabel="claude · sonnet 4.6" />
            <MarketIntelligenceSummary
              stateProgram={results.stateProgram}
              countyData={results.countyData}
              form={results.form}
              aiInsight={results.aiInsight ?? null}
              activeScenario={activeScenario}
              scenarioRationale={scenarioRationale}
              setScenarioRationale={setScenarioRationale}
              rationaleLoading={rationaleLoading}
              setRationaleLoading={setRationaleLoading}
              ixQueueSummary={results.ixQueueSummary}
            />

            {/* §2.5: Scenario Studio — interactive sensitivity layer over an
                "achievable baseline." Phase 2 launch feature. Sits between
                Analyst Brief (qualitative) and Pillar Diagnostics (atomized
                signals) so the user moves: AI narrative → quantitative
                sensitivity → component scores. Pre-computed baseline reuses
                revenueEngine via scenarioEngine.computeBaseline. */}
            <SectionMarker index={3} label="Scenario Studio" sublabel="sensitivity · year-1 revenue + payback" />
            <div data-tour-id="scenario">
              <ScenarioStudio
                baseline={computeScenarioBaseline({
                  stateId: results.stateProgram?.id || results.form.state,
                  technology: results.form.technology,
                  mw: results.form.mw,
                  rates: results.revenueRates,
                  policies: results.policyEvents || [],
                  stage: results.form.stage || null,
                })}
                user={user}
                projectId={matchingProjectId}
                countyName={results.form.county || ''}
              />
            </div>

            {/* Pillar Diagnostics — same SectionMarker treatment as the other
                § sections (Market Position / Analyst Brief / Scenario Studio)
                so the four sections read as a single typographic family on a
                consistent white surface. items-start: cards size independently. */}
            <SectionMarker index={4} label="Pillar Diagnostics" sublabel="offtake · interconnect · site" />
            <div
              data-tour-id="pillars"
              className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start"
            >
              <OfftakeCard
                stateProgram={results.stateProgram}
                revenueStack={results.revenueStack}
                technology={results.form.technology}
                mw={results.form.mw}
                rates={results.revenueRates}
                energyCommunity={results.energyCommunity}
                nmtcLic={results.nmtcLic}
                hudQctDda={results.hudQctDda}
                county={results.form.county}
              />
              <InterconnectionCard
                interconnection={results.countyData?.interconnection}
                stateProgram={results.stateProgram}
                stateId={results.stateProgram?.id}
                mw={results.form.mw}
                queueSummary={results.ixQueueSummary}
              />
              <SiteControlCard
                siteControl={results.countyData?.siteControl}
                interconnection={results.countyData?.interconnection}
                geospatial={results.countyData?.geospatial}
                stateName={results.stateProgram?.name || results.form.state}
                county={results.form.county}
                stateId={results.stateProgram?.id}
                mw={results.form.mw}
                substations={results.substations}
              />
            </div>

            {/* Federal LIHTC moved into the OfftakeCard's federal-bonus stack
                so all three geographic-designation incentives (Energy
                Community, §48(e) NMTC LIC, HUD QCT/DDA) live in one panel. */}

            {/* V3 Wave 2 — curation-gated panels.
                Regulatory + Comparable Deals are dormant until admin
                curates content. The wrappers below hide both panel
                AND its preceding divider until at least one row exists
                for that state -- avoiding empty-state UI while we're
                pre-revenue and curation cadence is light. Admin tab
                stays available so curation infrastructure is ready
                when we have paying users to justify the labor. */}
            <MaybeRegulatoryPanel
              state={results.stateProgram?.id || results.form.state}
              stateName={results.stateProgram?.name || results.form.state}
            />
            <MaybeSpecificYieldPanel
              state={results.stateProgram?.id || results.form.state}
              stateName={results.stateProgram?.name || results.form.state}
              mw={results.form.mw}
            />
            <MaybeCsMarketPanel
              state={results.stateProgram?.id || results.form.state}
              stateName={results.stateProgram?.name || results.form.state}
              mw={results.form.mw}
            />
            <MaybeComparableDealsPanel
              state={results.stateProgram?.id || results.form.state}
              stateName={results.stateProgram?.name || results.form.state}
              technology={results.form.technology}
              mw={results.form.mw}
            />

            {/* First-time-Pro guided tour. Inert unless `?onboarding=1` is in
                the URL AND localStorage doesn't show prior completion. The
                anchors above (data-tour-id="composite|pillars|scenario|save")
                are the four spotlights it walks through. */}
            <LensTour resultsReady={!!results} />

            {/* Bottom CTA / disclaimer */}
            <div className="mt-5 flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-5 py-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-700">Tractova intelligence is a research accelerator, not a substitute for site-specific due diligence.</span>{' '}
                Verify interconnection conditions with the serving utility, confirm wetland boundaries with a site survey, and validate program capacity with your state PUC before committing capital.
                Data is updated regularly but may not reflect the latest queue changes.{' '}
                <button
                  type="button"
                  onClick={() => setDataLimitationsOpen(true)}
                  className="inline-flex items-center gap-1 underline font-medium hover:text-gray-700 transition-colors cursor-pointer"
                  style={{ color: '#0F766E' }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  Data limitations →
                </button>
              </p>
            </div>
          </div>
        )}
      </main>

      {/* V3: SaveToast replaced by global ToastProvider (Radix Toast +
          Motion). Removed import of legacy SaveToast component below. */}

      {/* Data limitations modal — surfaces the top 5 audit-identified
          caveats one click away from the Lens disclaimer. Opens on
          "Data limitations →" click in the bottom CTA block. */}
      <DataLimitationsModal open={dataLimitationsOpen} onOpenChange={setDataLimitationsOpen} />

      {/* Save modal — sign-in prompt if not authed, name input if authed */}
      {saveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSaveModal(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">

            {!user ? (
              /* ── Not signed in ── */
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">Sign in to save projects</h3>
                </div>
                <p className="text-xs text-gray-500 mb-5 leading-relaxed">
                  Create a free account to save projects and access them from any device.
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSaveModal(null)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <Link
                    to="/signup"
                    onClick={() => setSaveModal(null)}
                    className="flex-1 text-center text-sm font-semibold text-white bg-primary px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Create Account
                  </Link>
                  <Link
                    to="/signin"
                    onClick={() => setSaveModal(null)}
                    className="flex-1 text-center text-sm font-medium text-gray-700 border border-gray-200 px-4 py-2 rounded-lg hover:border-gray-300 transition-colors"
                  >
                    Sign In
                  </Link>
                </div>
              </>
            ) : (
              /* ── Signed in: name the project ── */
              <>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Name this project</h3>
                <p className="text-xs text-gray-400 mb-4">You can edit the name before saving.</p>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveConfirm() }}
                  autoFocus
                  className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors mb-4"
                />
                {saveError && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-xs text-red-700 font-medium">Save failed</p>
                    <p className="text-xs text-red-600 mt-0.5 leading-snug">{saveError}</p>
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setSaveModal(null)}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveConfirm}
                    disabled={!saveName.trim() || saving}
                    className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    {saving ? 'Saving…' : 'Save Project'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
