import { createContext, useContext, useState, useEffect } from 'react'
import { scoreSavedProject } from '../lib/scoreEngine'

const CompareContext = createContext(null)

const STORAGE_KEY = 'tractova_compare'
const MAX_ITEMS = 5

// Normalize a Lens result into a compare item.
// Captures sub-scores + Path B geospatial percentages so the comparison
// modal can show the offtake / IX / site breakdown alongside the composite,
// plus the actual NWI wetland and SSURGO farmland coverage. These are the
// highest-leverage decision signals — Aden's review pass flagged the
// "where does each state shine vs lag" gap explicitly.
export function lensResultToCompareItem(results) {
  const sp = results.stateProgram
  // Full 5-pillar feed (mirrors Search.jsx lensSubs) so a Lens-added compare row
  // carries the same sub-scores as the Lens panel — and matches a Library-added
  // row for the identical project once the modal refresh runs.
  const codYear = results.form?.codYear ? Number(results.form.codYear) : null
  const incentives = (results.energyCommunity || results.nmtcLic || results.hudQctDda)
    ? { energyCommunity: results.energyCommunity, nmtcLic: results.nmtcLic, hudQctDda: results.hudQctDda }
    : null
  const { subs: sub } = sp
    ? scoreSavedProject(
        { stage: results.form.stage, technology: results.form.technology, mw: results.form.mw, codTargetYear: codYear },
        sp, results.countyData,
        { incentives, policyEvents: results.policyEvents, ixQueueSummary: results.ixQueueSummary },
      )
    : { subs: null }
  const geo = results.countyData?.geospatial
  return {
    id:               `lens-${results.form.state}-${results.form.county.replace(/\s+/g, '-')}`,
    source:           'lens',
    name:             `${results.form.county} Co., ${sp?.name || results.form.state}`,
    state:            results.form.state,
    stateName:        sp?.name || results.form.state,
    county:           results.form.county,
    mw:               results.form.mw,
    technology:       results.form.technology,
    stage:            results.form.stage,
    csStatus:         sp?.csStatus || 'none',
    csProgram:        sp?.csProgram || null,
    feasibilityScore: sp?.feasibilityScore || null,
    ixDifficulty:     sp?.ixDifficulty || null,
    capacityMW:       sp?.capacityMW || null,
    // Captured at compare-add time so the modal can render rows that
    // would otherwise need a per-render state program lookup.
    lmiRequired:      sp?.lmiRequired ?? null,
    lmiPercent:       sp?.lmiPercent ?? null,
    // Target COD year — feeds the Policy & Timing pillar on the modal's refresh
    // recompute (was dropped, so Lens-added rows lost the federal-cliff signal).
    codTargetYear:    codYear,
    // Sub-score breakdown — all 5 pillars (added 2026-05-03, extended to 5 in the
    // 2026-06 parity wiring).
    subOfftake:       sub?.offtake ?? null,
    subIx:            sub?.ix ?? null,
    subSite:          sub?.site ?? null,
    subIncentives:    sub?.incentives ?? null,
    subPolicyTiming:  sub?.policyTiming ?? null,
    // Path B geospatial percentages (USFWS NWI + USDA SSURGO).
    wetlandPct:       geo?.wetlandCoveragePct ?? null,
    farmlandPct:      geo?.primeFarmlandPct ?? null,
    // 2026-05-05 (C5): timestamp the moment the user added this. CompareModal
    // re-fetches fresh state/county on open + computes a delta so the user
    // can see if scores have drifted since they queued the comparison.
    addedAt:          new Date().toISOString(),
  }
}

// Normalize a Library project into a compare item. `stateProgram` and
// `countyData` are optional; when provided we capture sub-scores +
// geospatial pcts so the Library compare shows the same depth as the Lens
// compare. Without this parity the Compare modal renders blank cells for
// Offtake/IX/Site sub-scores + Wetland/Farmland % when the user adds
// projects from Library — Aden flagged this 2026-05-04 as a regression
// from Session 4's compare-row expansion.
export function libraryProjectToCompareItem(project, stateProgram = null, countyData = null, incentives = null, policyEvents = null) {
  const sp = stateProgram
  // Route through the canonical helper so a Library-added row scores identically
  // to its card. Incentives/policy are optional at add-time (the bulk-add path
  // may not have them) — the modal's refresh re-fetches + recomputes the full
  // 5-pillar composite on open regardless.
  const { subs: sub } = sp ? scoreSavedProject(project, sp, countyData, { incentives, policyEvents }) : { subs: null }
  const geo = countyData?.geospatial
  return {
    id:               `lib-${project.id}`,
    source:           'library',
    name:             project.name,
    state:            project.state,
    stateName:        project.stateName || project.state,
    county:           project.county,
    mw:               project.mw,
    technology:       project.technology,
    stage:            project.stage,
    csStatus:         project.csStatus || 'none',
    csProgram:        project.csProgram || sp?.csProgram || null,
    feasibilityScore: project.feasibilityScore || null,
    ixDifficulty:     project.ixDifficulty || sp?.ixDifficulty || null,
    capacityMW:       sp?.capacityMW || null,
    lmiRequired:      sp?.lmiRequired ?? null,
    lmiPercent:       sp?.lmiPercent ?? null,
    // Target COD year — so the modal refresh recomputes the Policy & Timing
    // pillar (federal cliff) for this row too.
    codTargetYear:    project.codTargetYear ?? null,
    // Sub-score breakdown — same helper + 5-pillar shape as lensResultToCompareItem
    // so a Library compare row matches a Lens compare row exactly when both point
    // at the same state+county+technology+stage.
    subOfftake:       sub?.offtake ?? null,
    subIx:            sub?.ix ?? null,
    subSite:          sub?.site ?? null,
    subIncentives:    sub?.incentives ?? null,
    subPolicyTiming:  sub?.policyTiming ?? null,
    // Path B geospatial percentages (USFWS NWI + USDA SSURGO).
    wetlandPct:       geo?.wetlandCoveragePct ?? null,
    farmlandPct:      geo?.primeFarmlandPct ?? null,
    savedAt:          project.savedAt,
    addedAt:          new Date().toISOString(),
  }
}

export function CompareProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const isInCompare = (id) => items.some((i) => i.id === id)

  // Functional updater for the guard checks too — fixes the closure bug
  // where a tight loop of add() calls (e.g. Library's bulk "Add to
  // Compare" button) would see stale items.length on every call. Without
  // this, the MAX_ITEMS cap leaks past 5 when users bulk-add fast.
  const add = (item) => {
    let added = false
    setItems((prev) => {
      if (prev.length >= MAX_ITEMS) return prev
      if (prev.some((i) => i.id === item.id)) return prev
      added = true
      return [...prev, item]
    })
    return added
  }

  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id))

  const clear = () => setItems([])

  // Hydrate the tray from a saved comparison snapshot. Replaces the
  // current draft items wholesale — the user is opening a research
  // artifact, not appending to their current draft. The Modal's
  // existing drift-refresh on open then reconciles each snapshot row
  // against live state/county data.
  const load = (snapshotItems) => {
    if (!Array.isArray(snapshotItems)) return false
    setItems(snapshotItems.slice(0, MAX_ITEMS))
    return true
  }

  return (
    <CompareContext.Provider value={{ items, add, remove, clear, load, isInCompare, MAX_ITEMS }}>
      {children}
    </CompareContext.Provider>
  )
}

export function useCompare() {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used inside CompareProvider')
  return ctx
}
