import { useState, useRef, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getStateProgramMap, getCountyData, getRevenueStack, getEnergyCommunity, getHudQctDda, getNmtcLic, getPolicyImpactEvents } from '../lib/programData'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import UpgradePrompt from '../components/UpgradePrompt'
import SectionDivider from '../components/SectionDivider'
import { useLensReveal } from '../lib/useLensReveal'
import MarketPositionPanel from '../components/MarketPositionPanel.jsx'
import OfftakeCardSummary from '../components/lens/OfftakeCardSummary.jsx'
import InterconnectionCardSummary from '../components/lens/InterconnectionCardSummary.jsx'
import SiteControlCardSummary from '../components/lens/SiteControlCardSummary.jsx'
import IncentivesCardSummary from '../components/lens/IncentivesCardSummary.jsx'
import PolicyTimingCardSummary from '../components/lens/PolicyTimingCardSummary.jsx'
import PillarDetailModal from '../components/lens/PillarDetailModal.jsx'
import MarketIntelligenceSummary from '../components/MarketIntelligenceSummary.jsx'
import LensComparablesSection from '../components/LensComparablesSection.jsx'
import { useToast } from '../components/ui/Toast'

// 2026-05-07 cleanup: dropped 16 leftover Search.jsx imports that
// became orphans after Sprint 2.3 extracted the panels (each panel
// now imports its own scoreEngine / revenueEngine helpers directly).
// Kept only the helpers Search.jsx itself still references.

import { getIXQueueSummary, getHostingCapacity } from '../lib/programData'
import DevFeasibilityView from '../components/scenario/DevFeasibilityView'
import StructureComparison from '../components/lens/StructureComparison'
import ReRunDriftCallout from '../components/lens/ReRunDriftCallout'
import { denormalizeTech } from '../lib/scenarioEngine'
import { computeSubScores, safeScore } from '../lib/scoreEngine'
import LensTour from '../components/LensTour'
import DataLimitationsModal from '../components/DataLimitationsModal'
import IntelligenceBackground from '../components/IntelligenceBackground'
import RunIdMasthead from '../components/RunIdMasthead'
import CollapsibleSection from '../components/CollapsibleSection'
import LensOverlay, { LENS_OVERLAY_STYLES } from '../components/LensOverlay'
import FieldSelect from '../components/FieldSelect'
import CountyCombobox from '../components/CountyCombobox'
import HoverBorderGradient from '../components/ui/HoverBorderGradient'
import TealRail from '../components/ui/TealRail'
import AddToCompareButton from '../components/AddToCompareButton'
import LensRegulatoryWatchSection from '../components/LensRegulatoryWatchSection.jsx'

import { getNearestSubstations } from '../lib/substationEngine'

// Sprint F.2 — helpers (getMarketRank, STATUS_CFG, sanitizeBrief, presentational
// primitives, CHIP_COLORS) moved to src/lib/searchShared.jsx to break the
// import cycle with child components that previously re-imported these from
// this page.
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
  CHIP_COLORS,
} from '../lib/searchShared.jsx'

// AnimatedScoreText + ArcGauge moved to src/components/ArcGauge.jsx (Sprint 2.3).
// SubScoreBar moved to src/components/SubScoreBar.jsx (Sprint E.3).
// MarketPositionPanel moved to src/components/MarketPositionPanel.jsx (Sprint 2.3).

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
// ALL_STATES + STAGES + TECHNOLOGIES moved to src/lib/lensFormConstants.js
// so the Cmd-K palette's inline Lens form can share the same source of
// truth. Re-imported here.
import { ALL_STATES, STAGES, ARCHITECTURE_OPTIONS, STRUCTURE_OPTIONS, STRUCTURE_TO_TAG, STRUCTURE_DEFAULT, ARCHITECTURE_DEFAULT, structureLabelFromTag, composeTechnology, axesFromTechnology, getStickyStructure, setStickyStructure, getStickyArchitecture, setStickyArchitecture } from '../lib/lensFormConstants.js'

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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
  if (type === 'ix') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
  if (type === 'offtake') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

// BriefDrilldown moved to src/components/BriefDrilldown.jsx (Sprint E.3).

// MarketIntelligenceSummary moved to src/components/MarketIntelligenceSummary.jsx (Sprint 2.3).

// What-If sensitivity scenarios (LensScenarioRow + CustomScenario* + the
// buildSensitivityScenarios/computeScoreDelta helpers) were removed in the
// 2026-05 wave-3 cleanup — §03 Dev Feasibility's signal levers are now the
// sole sensitivity surface (no synthesized $).

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

// MaybeSpecificYieldPanel / MaybeCsMarketPanel / MaybeComparableDealsPanel
// moved to src/components/MaybeLensPanels.jsx (Sprint E.3). MaybeRegulatoryPanel
// absorbed into § 06 (LensRegulatoryWatchSection) on 2026-05-13 — PUC dockets
// now render as the "Active Proceedings" subsection under Regulatory Watch.

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
  // Two-axis project model. URL precedence: explicit ?architecture=/?structure=
  // win; else a legacy ?technology= is decomposed into axes; else the user's
  // sticky prefs (architecture→Standalone PV, structure→Community Solar). A
  // legacy Standalone BESS technology degrades to the sticky architecture (BESS
  // isn't offered for new projects). technology is the derived composed mirror.
  const [initialArchitecture, initialStructure] = (() => {
    const urlArch = searchParams.get('architecture')
    const urlStructTag = searchParams.get('structure')
    const urlTech = searchParams.get('technology')
    if (urlArch || urlStructTag) {
      return [
        ARCHITECTURE_OPTIONS.includes(urlArch) ? urlArch : getStickyArchitecture(),
        urlStructTag ? structureLabelFromTag(urlStructTag) : getStickyStructure(),
      ]
    }
    if (urlTech) {
      const ax = axesFromTechnology(denormalizeTech(urlTech))
      return [
        ax.architecture === 'Standalone BESS' ? getStickyArchitecture() : ax.architecture,
        ax.structure || getStickyStructure(),
      ]
    }
    return [getStickyArchitecture(), getStickyStructure()]
  })()
  const initialTechnology = composeTechnology(initialArchitecture, initialStructure)

  const [form, setForm] = useState({
    state: initialState,
    county: initialCounty,
    mw: initialMW,
    stage: initialStage,
    architecture: initialArchitecture,
    structure: initialStructure,
    technology: initialTechnology,
    codYear: '',   // target commercial-operation year — drives the Policy & Timing pillar
  })

  // Phase 2C — `?fromProject=<id>` deep-link. The Cmd-K `:rerun <project>`
  // verb and the Library "Re-run with latest data" CTA both route here.
  // Three things happen on top of pre-fill:
  //   1. AUTO-KICKOFF: the form auto-submits once it's been hydrated, so
  //      the user lands directly on fresh results without an extra click.
  //   2. DRIFT: results land with a banner comparing the new composite +
  //      sub-scores against the project's saved baseline. Pulled into one
  //      callout the user can read in 2 seconds.
  //   3. SAVE BACK: a button on the drift banner writes the new scores
  //      back to the projects row (opportunity_score, last_observed_score,
  //      cs_status, ix_difficulty) and logs a score_change audit event.
  // The reRunOf state captures the baseline so steps 2+3 don't have to
  // re-fetch every render.
  const fromProjectId = searchParams.get('fromProject')
  const [reRunOf, setReRunOf] = useState(null)
  useEffect(() => {
    if (!fromProjectId || !user) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, name, state, county, mw, stage, technology, architecture, structure, saved_at, opportunity_score, last_observed_score, cs_status, ix_difficulty')
          .eq('id', fromProjectId)
          .eq('user_id', user.id)
          .single()
        if (cancelled || error || !data) return
        setReRunOf({
          id: data.id,
          name: data.name,
          savedAt: data.saved_at,
          // Use last_observed_score when present (most recent audit
          // baseline); fall back to opportunity_score (save-time value).
          baselineScore: data.last_observed_score ?? data.opportunity_score ?? null,
          baselineSavedScore: data.opportunity_score ?? null,
          baselineCsStatus: data.cs_status ?? null,
          baselineIxDifficulty: data.ix_difficulty ?? null,
        })
        const ax = (data.architecture || data.structure)
          ? { architecture: data.architecture, structure: data.structure }
          : axesFromTechnology(data.technology)
        setForm({
          state: data.state || '',
          county: data.county || '',
          mw: String(data.mw || ''),
          stage: data.stage || '',
          architecture: ax.architecture || ARCHITECTURE_DEFAULT,
          structure: ax.structure || STRUCTURE_DEFAULT,
          technology: data.technology || composeTechnology(ax.architecture || ARCHITECTURE_DEFAULT, ax.structure || STRUCTURE_DEFAULT),
        })
      } catch { /* silent — user may not have access; fall back to empty form */ }
    })()
    return () => { cancelled = true }
  }, [fromProjectId, user])

  // Auto-kickoff: once reRunOf is loaded AND the form is fully hydrated,
  // submit the Lens analysis automatically. Guarded by autoSubmitFired
  // (declared below near the form ref) so this only fires once per page
  // visit even across re-renders.
  // NOTE: the existing autoSubmitFired effect (right below the form ref)
  // gates on URL params (initialState + initialCounty + initialMW). The
  // ?fromProject path has none of those — the form hydrates async, after
  // the project fetch. This effect runs in lockstep with that hydration.
  const [programMap, setProgramMap]   = useState(null)
  const [results, setResults]         = useState(null)
  const [analyzing, setAnalyzing]     = useState(false)
  // Scroll-linked reveal for the § sections once a report is on screen (JS so
  // it works in every browser; see useLensReveal). Re-binds when results swap.
  useLensReveal(!!results)
  // Live MW lever — shared across Scenario Studio (Dev Feasibility tab)
  // and the §04 Pillar Diagnostics cards so the user dragging "Project
  // Size" in the Studio gets reactive recompute everywhere instead of
  // a frozen-search snapshot. Initialized to results.form.mw whenever
  // a new Lens search completes; user can revert via the "Searched at
  // X MW · Reset" caption when it diverges.
  const [liveMw, setLiveMw] = useState(null)
  useEffect(() => {
    if (results?.form?.mw != null) {
      const n = parseFloat(results.form.mw)
      if (Number.isFinite(n) && n > 0) setLiveMw(n)
    }
  }, [results?.form?.mw])
  // NaN-safe MW resolution. parseFloat('') / parseFloat(undefined) returns
  // NaN which is NOT caught by ?? (only nullish is). Number.isFinite is
  // the explicit guard.
  const searchMwRaw = parseFloat(results?.form?.mw)
  const searchMw = Number.isFinite(searchMwRaw) && searchMwRaw > 0 ? searchMwRaw : null
  const effectiveMw = Number.isFinite(liveMw) && liveMw > 0 ? liveMw : searchMw
  const mwDiverged = effectiveMw != null && searchMw != null && Math.abs(effectiveMw - searchMw) > 0.01

  // Canonical 5-pillar composite — ONE computation feeding the §01 gauge, the
  // §02 Analyst Brief verdict, the §05 pillar cards, and the pillar detail
  // modal. Previously each recomputed independently (the brief used a partial
  // 3-pillar call, so its verdict could disagree with the gauge); this is the
  // single source of truth. Recomputes when the live MW lever or inputs change.
  // computeSubScores is a cheap pure fn, so an inline compute per render is fine.
  const lensSubs = results
    ? computeSubScores(
        results.stateProgram, results.countyData, results.form.stage, results.form.technology,
        results.ixQueueSummary, results.policyEvents, effectiveMw,
        {
          incentives: { energyCommunity: results.energyCommunity, nmtcLic: results.nmtcLic, hudQctDda: results.hudQctDda },
          codYear: results.form.codYear ? Number(results.form.codYear) : null,
        },
      )
    : null
  const lensScore = lensSubs ? safeScore(lensSubs) : null
  // §04 Pillar Detail Modal — single mount, active pillar drives which tab
  // body renders. null = modal closed.
  const [activePillar, setActivePillar] = useState(null)
  // Look up the most recent saved project matching the current Lens
  // context (state + county + tech). When found, scenarios saved from
  // the Studio attach to that project_id so the Library card can show
  // the "Scenarios: N" chip. Falls back to null = ad-hoc scenario.
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
  // Signature-tracked auto-submit. Previous boolean ref blocked all
  // re-runs after the first auto-submit — meaning :lens MA 5 from the
  // command palette did nothing if the user already had a Lens result
  // open. Signature tracking lets a NEW set of URL params unlock the
  // auto-submit again while still preventing double-fire on the SAME
  // params.
  const lastAutoSubmitKey = useRef('')
  const formRef = useRef(null)

  // URL-param-driven sync: when the command palette navigates to a new
  // /search?state=...&mw=... URL, the form's useState init values are
  // stale (init runs once at mount). This effect syncs form state +
  // clears the previous result when a NEW URL signature appears, so a
  // palette-dispatched lens command actually overrides the visible page.
  // Auto-submit fires when the new URL is complete enough (state +
  // county + mw); otherwise the form populates and waits for the user
  // to fill the missing fields.
  useEffect(() => {
    if (!programMap) return
    const urlKey = `${initialState}|${initialCounty}|${initialMW}|${initialStage}|${initialArchitecture}|${initialStructure}`
    // First mount or repeat — don't redo work
    if (lastAutoSubmitKey.current === urlKey) return
    // Ignore the empty-URL case (user landed on /search with no params).
    // The initial-render guard distinguishes "no URL" from "new URL".
    if (!initialState && !initialCounty && !initialMW) return

    // Mark this signature processed BEFORE setForm + submit so re-renders
    // triggered by setForm don't loop back here.
    lastAutoSubmitKey.current = urlKey

    // Sync visible form to the new URL. Without this, requestSubmit
    // would re-fire with the OLD form values from the first render.
    setForm({
      state:        initialState        || '',
      county:       initialCounty       || '',
      mw:           initialMW           || '',
      stage:        initialStage        || '',
      architecture: initialArchitecture || ARCHITECTURE_DEFAULT,
      structure:    initialStructure    || STRUCTURE_DEFAULT,
      technology:   initialTechnology   || composeTechnology(ARCHITECTURE_DEFAULT, STRUCTURE_DEFAULT),
    })
    // Clear stale result so the user isn't reading old data while the
    // new search dispatches (or while they fill in missing fields).
    setResults(null)

    // Auto-submit only when the new URL is fully complete. Defer one
    // tick so setForm flushes into form state before handleSubmit
    // reads from it.
    if (initialState && initialCounty && initialMW) {
      setTimeout(() => formRef.current?.requestSubmit(), 0)
    }
  }, [programMap, initialState, initialCounty, initialMW, initialStage, initialArchitecture, initialStructure])

  // Phase 2C auto-kickoff: ?fromProject= hydrates the form async (the
  // useEffect above fetches the projects row + calls setForm). Once
  // both the project + form + program map are loaded, fire the run.
  // Uses the same lastAutoSubmitKey signature ref to coordinate with
  // the URL-param path — same key never double-fires.
  useEffect(() => {
    if (!programMap || !reRunOf) return
    if (!form.state || !form.county || !form.mw || !form.stage || !form.technology) return
    const formKey = `${form.state}|${form.county}|${form.mw}|${form.stage}|${form.technology}`
    if (lastAutoSubmitKey.current === formKey) return
    lastAutoSubmitKey.current = formKey
    formRef.current?.requestSubmit()
  }, [programMap, reRunOf, form.state, form.county, form.mw, form.stage, form.technology])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setResults(null)
    setAnalyzing(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token ?? ''

      const [stateProgram, countyData, revenueStack, ixQueueSummary, substations, energyCommunity, hudQctDda, nmtcLic, policyEvents, hostingCapacity] = await Promise.all([
        programMap?.[form.state] ?? getStateProgramMap().then(m => m[form.state] ?? null),
        getCountyData(form.state, form.county),
        getRevenueStack(form.state),
        getIXQueueSummary(form.state, form.mw, STRUCTURE_TO_TAG[form.structure] ?? 'all'),
        getNearestSubstations(form.state, form.county),
        getEnergyCommunity(form.state, form.county),
        getHudQctDda(form.state, form.county),
        getNmtcLic(form.state, form.county),
        getPolicyImpactEvents({ state: form.state }),
        getHostingCapacity(form.state),
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

      setResults({ form: { ...form }, stateProgram, countyData, revenueStack, ixQueueSummary, substations, energyCommunity, hudQctDda, nmtcLic, policyEvents, hostingCapacity, aiInsight })
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
        architecture:     results.form.architecture || null,
        structure:        results.form.structure || null,
        cod_target_year:  results.form.codYear ? Number(results.form.codYear) : null,
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
    const arch = getStickyArchitecture(), struct = getStickyStructure()
    setForm({ state: '', county: '', mw: '', stage: '', architecture: arch, structure: struct, technology: composeTechnology(arch, struct) })
    setResults(null)
    setConfirmClear(false)
    sessionStorage.removeItem('tractova_lens_form')
    sessionStorage.removeItem('tractova_lens_results')
  }

  const isFormValid = form.state && form.county.trim() && form.mw && form.stage && form.architecture && form.structure
  // architecture/structure/technology are always defaulted (sticky), so they don't
  // count as "input" for the Clear-All affordance — only user-entered fields do.
  const hasAnyInput = form.state || form.county || form.mw || form.stage || results

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

        {/* Re-run pill — surfaced when ?fromProject= is in the URL.
            The form is pre-filled from the project's saved values
            (state/county/MW/stage/tech) so the user can immediately
            generate a fresh report. Phase 2C will add the auto-run
            kickoff + drift comparison + "Save updates back to project"
            CTA on top of this baseline. */}
        {reRunOf && (
          <div className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.22)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#0F766E' }} />
            <span className="eyebrow-mono" style={{ color: '#0F766E' }}>Re-run</span>
            <span className="text-xs font-medium text-ink truncate">
              Re-run of <span className="font-semibold">{reRunOf.name}</span>
              {reRunOf.savedAt && (
                <span className="text-gray-500 ml-1">
                  · last saved {(() => {
                    const days = Math.floor((Date.now() - new Date(reRunOf.savedAt).getTime()) / 86_400_000)
                    return days < 1 ? 'today' : days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`
                  })()}
                </span>
              )}
            </span>
          </div>
        )}

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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="#5EEAD4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

          {/* Fields — V3 paper background, no longer green-tinted. Two rows of
              three on md+ (location+size / stage+architecture+structure): the
              longer two-axis labels ("System Architecture", "Monetization
              Structure") need the column width to stay on one line — a 6-up row
              wrapped them and dropped their controls out of alignment. */}
          <div className="px-5 py-5 bg-paper rounded-b-xl">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

              {/* State */}
              <FieldSelect
                label="State"
                labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}
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
              <div className="bg-white rounded-lg border border-gray-200 px-3.5 pt-2.5 pb-2 shadow-xs transition-all focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/15">
                <label className={labelCls + ' flex items-center gap-1.5'}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
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
                labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>}
                value={form.stage}
                onChange={(val) => setForm((f) => ({ ...f, stage: val }))}
                options={STAGES}
                placeholder="Select stage…"
                required
              />

              {/* System architecture (axis 1) — what's physically built. Drives
                  the IX/site modifier. Standalone BESS dropped (merchant out of
                  scope); storage is in-scope only as PV + Storage. Sticky pref. */}
              <FieldSelect
                label="System Architecture"
                labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>}
                value={form.architecture}
                onChange={(val) => { setForm((f) => ({ ...f, architecture: val, technology: composeTechnology(val, f.structure) })); setStickyArchitecture(val) }}
                options={ARCHITECTURE_OPTIONS}
                placeholder="Select architecture…"
                required
              />

              {/* Monetization structure (axis 2) — how electrons are monetized.
                  Drives the offtake sub-score + scopes the live IX-queue view.
                  CS is the wedge (sticky default). Required project attribute. */}
              <FieldSelect
                label="Monetization Structure"
                labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                value={form.structure}
                onChange={(val) => { setForm((f) => ({ ...f, structure: val, technology: composeTechnology(f.architecture, val) })); setStickyStructure(val) }}
                options={STRUCTURE_OPTIONS}
                placeholder="Select structure…"
                required
              />

              {/* Target COD year (optional) — drives the Policy & Timing pillar's
                  federal tax-credit cliff assessment (§48E/§45Y start-of-
                  construction + placed-in-service windows). Not required: absent
                  → timing falls back to the stage-only read. */}
              <FieldSelect
                label="Target COD"
                labelIcon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                value={form.codYear || 'Not set'}
                onChange={(val) => setForm((f) => ({ ...f, codYear: val === 'Not set' ? '' : val }))}
                options={['Not set', '2026', '2027', '2028', '2029', '2030', '2031', '2032']}
                placeholder="Target COD year…"
              />
            </div>
          </div>

          {/* Submit row */}
          <div className="bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 mt-2">
            <p className="text-xs text-gray-500 hidden sm:block flex-1">
              Intelligence is generated from seeded state + county data — verify with your utility and PUC before committing capital.
            </p>
            <div className="flex items-center gap-3 ml-auto shrink-0">
              {/* Clear All — two-step inline confirm */}
              {hasAnyInput && !confirmClear && (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="text-xs text-gray-500 hover:text-red-500 transition-colors px-2.5 py-1.5 rounded-lg border border-gray-200 hover:border-red-200"
                >
                  Clear All
                </button>
              )}
              {confirmClear && (
                <div className="flex items-center gap-2 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                  <span className="text-gray-600">Clear all inputs?</span>
                  <button type="button" onClick={handleClearAll} className="font-semibold text-red-600 hover:underline">Yes, clear</button>
                  <button type="button" onClick={() => setConfirmClear(false)} className="text-gray-500 hover:text-gray-600">Cancel</button>
                </div>
              )}
              {(() => {
                // Carry the dashboard's Run-a-Lens CTA language onto the Lens's
                // own primary action: teal gradient + glow, plus the
                // HoverBorderGradient sheen — but only when the run is actually
                // available. Wrapping a disabled button would spin the border on
                // hover and imply an interactivity that isn't there.
                const readyToRun = isFormValid && !analyzing
                const submitBtn = (
                  <button
                    type="submit"
                    disabled={!isFormValid || analyzing}
                    className="flex items-center gap-2 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 min-w-[160px] justify-center"
                    style={readyToRun
                      ? { background: 'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)', boxShadow: '0 4px 16px -4px rgba(20,184,166,0.55)' }
                      : { background: '#0F766E' }}
                  >
                    {analyzing ? (
                      <>
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0" />
                        Analyzing…
                      </>
                    ) : (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                        Run Lens Analysis
                      </>
                    )}
                  </button>
                )
                return readyToRun
                  ? <HoverBorderGradient containerClassName="shrink-0" radius={10}>{submitBtn}</HoverBorderGradient>
                  : submitBtn
              })()}
            </div>
          </div>
        </form>

        {/* Results panel */}
        {results && (
          <div ref={resultsRef}>
            {/* Bloomberg-style run-id masthead — research-grade character */}
            <RunIdMasthead form={results.form} />
            <SectionDivider />

            {/* Phase 2C — Re-run drift callout. Renders only when this run is
                anchored to an existing project (?fromProject= path). The
                new sub-scores recompute against live state/county data;
                composite is compared against the project's stored baseline
                (last_observed_score, or opportunity_score if never re-
                observed). The "Save updates back" button writes the new
                composite + cs_status + ix_difficulty to the projects row
                and logs a score_change audit event. */}
            {reRunOf && (
              <ReRunDriftCallout reRunOf={reRunOf} setReRunOf={setReRunOf} results={results} user={user} />
            )}

            {/* Results header + §01 Market Position. Every § is wrapped in
                .lens-reveal — a native scroll-driven fade+rise that reverses on
                scroll up/down (see index.css). */}
            <div className="lens-reveal">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {results.form.county} County, {results.stateProgram?.name || results.form.state}
                  <span className="text-gray-400 font-normal mx-2">·</span>
                  <span className="text-gray-600">
                    {effectiveMw != null ? effectiveMw.toFixed(1) : results.form.mw} MW AC
                  </span>
                  <span className="text-gray-400 font-normal mx-2">·</span>
                  <span className="text-gray-600">{results.form.technology}</span>
                  <span className="text-gray-400 font-normal mx-2">·</span>
                  <span className="text-gray-600">{results.form.stage}</span>
                </h2>
                {mwDiverged && searchMw != null && (
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-500 mt-0.5 flex items-center gap-2">
                    <span>Searched at {searchMw.toFixed(1)} MW</span>
                    <button
                      type="button"
                      onClick={() => setLiveMw(searchMw)}
                      className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-ink transition-colors"
                    >
                      Reset
                    </button>
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  Save as Project
                </button>
              </div>
            </div>

            {/* §01 Market Position — the composite feasibility gauge. Collapsible
                like every other section but defaultOpen (it's the headline read).
                keepMounted: the gauge + sub-score bars are animation-heavy, so we
                keep them in the DOM across collapse rather than re-mounting (and
                re-firing every entrance animation) on each re-open. */}
            <CollapsibleSection index={1} label="Market Position" sublabel="composite feasibility index" defaultOpen keepMounted>
            <div data-tour-id="composite">
              <MarketPositionPanel
                stateProgram={results.stateProgram}
                programMap={programMap}
                technology={results.form.technology}
                ixQueueSummary={results.ixQueueSummary}
                subs={lensSubs}
              />
            </div>
            </CollapsibleSection>
            </div>

            {/* Market Intelligence Summary */}
            <div className="lens-reveal">
            <CollapsibleSection index={2} label="Analyst Brief" sublabel="claude · sonnet 4.6">
            <MarketIntelligenceSummary
              stateProgram={results.stateProgram}
              countyData={results.countyData}
              form={results.form}
              aiInsight={results.aiInsight ?? null}
              score={lensScore}
            />
            </CollapsibleSection>
            </div>

            {/* §03 Dev Feasibility — the go/no-go scorecard. The 5-pillar
                verdict + pillar cards + Feasibility Levers (Project Size / COD
                year / Subscription / IX assumption) that let the user see
                "what moves the score." Replaced the old Scenario Studio (the
                synthesized $ revenue/payback sensitivity) in the 2026-05
                signal pivot — no dollars; this is signal sensitivity. */}
            <div className="lens-reveal">
            <CollapsibleSection index={3} label="Dev Feasibility" sublabel="go/no-go scorecard · pillar levers" dataTourId="scenario">
            <div className="bg-white rounded-lg relative overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
              <TealRail />
              <DevFeasibilityView
                stateProgram={results.stateProgram}
                countyData={results.countyData}
                ixQueueSummary={results.ixQueueSummary}
                policyEvents={results.policyEvents || []}
                incentives={{ energyCommunity: results.energyCommunity, nmtcLic: results.nmtcLic, hudQctDda: results.hudQctDda }}
                technology={results.form.technology}
                stage={results.form.stage || null}
                stateName={results.stateProgram?.name || results.form.state}
                countyName={results.form.county || ''}
                mw={effectiveMw}
                searchMw={searchMw}
                onMwChange={setLiveMw}
              />
            </div>
            </CollapsibleSection>
            </div>

            {/* §04: Structure Comparison — "which monetization structure
                monetizes best for this site." Ranks the structures by their
                offtake signal (no $) from the same engine as the Feasibility
                Index. Compared at Standalone PV. */}
            <div className="lens-reveal">
            <CollapsibleSection index={4} label="Structure Comparison" sublabel="which structure monetizes best · offtake signal">
            <StructureComparison
              stateProgram={results.stateProgram}
              countyData={results.countyData}
              stage={results.form.stage || ''}
              mw={effectiveMw}
              selectedStructure={results.form.structure}
              ixQueueSummary={results.ixQueueSummary}
              policyEvents={results.policyEvents || []}
              userArchitecture={results.form.architecture}
              stateName={results.stateProgram?.name || results.form.state}
            />
            </CollapsibleSection>
            </div>

            {/* Pillar Diagnostics — same SectionMarker treatment as the other
                § sections (Market Position / Analyst Brief / Scenario Studio)
                so the sections read as a single typographic family on a
                consistent white surface. items-stretch: every card in a row
                shares the tallest card's height (footers align). */}
            <div className="lens-reveal">
            <CollapsibleSection index={5} label="Pillar Diagnostics" sublabel="offtake · interconnect · incentives · site · policy" dataTourId="pillars">
            <div className="space-y-5">
            {(() => {
              // §05 pillar cards read the canonical composite computed once
              // above (lensSubs) — same object the §01 gauge + Analyst Brief use.
              const sub = lensSubs
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-stretch">
                  <OfftakeCardSummary
                    stateProgram={results.stateProgram}
                    score={sub.offtake}
                    coverage={sub.coverage?.offtake}
                    technology={results.form.technology}
                    onOpen={() => setActivePillar('offtake')}
                  />
                  <InterconnectionCardSummary
                    interconnection={results.countyData?.interconnection}
                    score={sub.ix}
                    coverage={sub.coverage?.ix}
                    onOpen={() => setActivePillar('ix')}
                  />
                  <IncentivesCardSummary
                    score={sub.incentives}
                    coverage={sub.coverage?.incentives}
                    adders={sub.incentiveDetail}
                    onOpen={() => setActivePillar('incentives')}
                  />
                  <SiteControlCardSummary
                    geospatial={results.countyData?.geospatial}
                    county={results.form.county}
                    stateName={results.stateProgram?.name || results.form.state}
                    score={sub.site}
                    coverage={sub.coverage?.site}
                    onOpen={() => setActivePillar('site')}
                  />
                  <PolicyTimingCardSummary
                    score={sub.policyTiming}
                    coverage={sub.coverage?.policyTiming}
                    policyDetail={sub.policyDetail}
                    onOpen={() => setActivePillar('policyTiming')}
                  />
                </div>
              )
            })()}

            {/* §04 is the full 5-pillar diagnostics row (offtake / IX /
                incentives / site / policy & timing). All five cards open the
                PillarDetailModal — each pillar has its own tab + deep-dive body. */}
            </div>
            </CollapsibleSection>
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
            {/* § 05 (Comparable Deals & Benchmarks) re-enabled 2026-05-13
                (path A). Original disable 2026-05-11 attributed OOM to
                CsMarketPanel + getCsMarketSnapshot — but that bisect ran
                with a recursive wrapper bug in LensComparableSubsection
                (Phase 0 typo, fixed in commit e60882f). Any bisectOnly
                value would have stack-overflowed regardless of the actual
                memory pressure, so the CsMarketPanel attribution is on
                shaky evidence. Flipping the gate to let prod tell us
                whether the OOM is real now that the confound is removed.
                If heavy-rowcount states (MA 374 / IL 261 / NY 1351 cs_projects)
                still crash, revert this and pivot to path B (paginated Table
                view + Operating Projects → Library cockpit). */}
            <div className="lens-reveal">
            <LensComparablesSection
              state={results.stateProgram?.id || results.form.state}
              stateName={results.stateProgram?.name || results.form.state}
              technology={results.form.technology}
              mw={effectiveMw}
            />
            </div>

            {/* § 06 Regulatory Watch — chronological feed of policy_impact_events
                + curation-gated Active Proceedings (puc_dockets). Reuses
                results.policyEvents (already fetched, no new query) — same
                source of truth as § 04 (Policy Climate), different cut. */}
            <div className="lens-reveal">
            <LensRegulatoryWatchSection
              state={results.stateProgram?.id || results.form.state}
              stateName={results.stateProgram?.name || results.form.state}
              policyEvents={results.policyEvents || []}
            />
            </div>

            {/* First-time-Pro guided tour. Inert unless `?onboarding=1` is in
                the URL AND localStorage doesn't show prior completion. The
                anchors above (data-tour-id="composite|pillars|scenario|save")
                are the four spotlights it walks through. */}
            <LensTour resultsReady={!!results} />

            {/* Bottom CTA / disclaimer */}
            <div className="mt-5 flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-5 py-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
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

      {/* §04 Pillar Detail Modal — Bloomberg-style fullscreen overlay
          driven by the five summary cards in §04. One mount covers all five
          pillars via the tab strip; analyst hops Offtake → IX → Incentives →
          Site → Policy & Timing without closing. Mounted at root so the focus
          trap and backdrop sit above the result panel correctly. */}
      {results && (() => {
        // Pillar detail modal reads the same canonical composite (lensSubs) as
        // the §04/§05 cards + §01 gauge — one source of truth.
        const pSub = lensSubs
        return (
        <PillarDetailModal
          activePillar={activePillar}
          onClose={() => setActivePillar(null)}
          onPillarChange={setActivePillar}
          pillarProps={{
            stateProgram:    results.stateProgram,
            countyData:      results.countyData,
            revenueStack:    results.revenueStack,
            technology:      results.form.technology,
            mw:              effectiveMw,
            energyCommunity: results.energyCommunity,
            nmtcLic:         results.nmtcLic,
            hudQctDda:       results.hudQctDda,
            county:          results.form.county,
            interconnection: results.countyData?.interconnection,
            geospatial:      results.countyData?.geospatial,
            siteControl:     results.countyData?.siteControl,
            stateId:         results.stateProgram?.id,
            stateName:       results.stateProgram?.name || results.form.state,
            substations:     results.substations,
            queueSummary:    results.ixQueueSummary,
            hostingCapacity: results.hostingCapacity,
            policyEvents:    results.policyEvents || [],
            // 5-pillar signal detail
            incentivesScore:  pSub.incentives,
            policyTimingScore: pSub.policyTiming,
            policyDetail:     pSub.policyDetail,
          }}
        />
        )
      })()}

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
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                <p className="text-xs text-gray-500 mb-4">You can edit the name before saving.</p>
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
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
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
