import { createContext, useContext, useState, useEffect } from 'react'
import { computeSubScores } from '../lib/scoreEngine'

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
  const sub = sp ? computeSubScores(sp, results.countyData, results.form.stage, results.form.technology, results.ixQueueSummary) : null
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
    // Sub-score breakdown (added 2026-05-03 per site-walk review).
    subOfftake:       sub?.offtake ?? null,
    subIx:            sub?.ix ?? null,
    subSite:          sub?.site ?? null,
    // Path B geospatial percentages (USFWS NWI + USDA SSURGO).
    wetlandPct:       geo?.wetlandCoveragePct ?? null,
    farmlandPct:      geo?.primeFarmlandPct ?? null,
  }
}

// Normalize a Library project into a compare item. `stateProgram` is optional;
// when provided we capture the snapshot fields (capacity / LMI) the modal
// renders alongside the project's own saved data.
export function libraryProjectToCompareItem(project, stateProgram = null) {
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
    csProgram:        project.csProgram || stateProgram?.csProgram || null,
    feasibilityScore: project.feasibilityScore || null,
    ixDifficulty:     project.ixDifficulty || stateProgram?.ixDifficulty || null,
    capacityMW:       stateProgram?.capacityMW || null,
    lmiRequired:      stateProgram?.lmiRequired ?? null,
    lmiPercent:       stateProgram?.lmiPercent ?? null,
    savedAt:          project.savedAt,
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

  const add = (item) => {
    if (items.length >= MAX_ITEMS) return false
    if (isInCompare(item.id)) return false
    setItems((prev) => [...prev, item])
    return true
  }

  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id))

  const clear = () => setItems([])

  return (
    <CompareContext.Provider value={{ items, add, remove, clear, isInCompare, MAX_ITEMS }}>
      {children}
    </CompareContext.Provider>
  )
}

export function useCompare() {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used inside CompareProvider')
  return ctx
}
