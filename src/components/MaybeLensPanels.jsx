import { useState, useEffect } from 'react'
import { getPucDockets, getComparableDeals, getCsProjectsAsComparables, getCsMarketSnapshot, getSpecificYieldLineage } from '../lib/programData'
import SectionDivider from './SectionDivider'
import RegulatoryActivityPanel from './RegulatoryActivityPanel'
import ComparableDealsPanel from './ComparableDealsPanel'
import CsMarketPanel from './CsMarketPanel'
import SpecificYieldPanel from './SpecificYieldPanel'

// ─────────────────────────────────────────────────────────────────────────────
// Curation-gated panel wrappers — hide both panel AND its preceding divider
// until at least one row exists for that state. Avoids empty-state UI while
// curation cadence is light (pre-revenue). Admin tabs stay available so
// curation infrastructure is preserved for when Pro user count justifies it.
// Both wrappers piggyback on programData's withCache so the duplicate fetch
// is free after the panel itself fetches.
// ─────────────────────────────────────────────────────────────────────────────
export function MaybeRegulatoryPanel({ state, stateName }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!state) { setShow(false); return }
    let cancelled = false
    getPucDockets({ state }).then(rows => {
      if (!cancelled) setShow((rows || []).length > 0)
    }).catch(err => {
      // Curation-gated panel: hide on error (matches "no rows" behavior so
      // the user doesn't see an error chip for a panel that may legitimately
      // be empty pre-revenue). Log for devtools visibility.
      console.warn('[MaybeRegulatoryPanel] getPucDockets failed:', err)
    })
    return () => { cancelled = true }
  }, [state])
  if (!show) return null
  return (
    <>
      <SectionDivider />
      <RegulatoryActivityPanel state={state} stateName={stateName} mode="lens" />
    </>
  )
}

export function MaybeSpecificYieldPanel({ state, stateName, mw }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!state) { setShow(false); return }
    let cancelled = false
    getSpecificYieldLineage(state).then(snap => {
      if (!cancelled) setShow(!!snap && snap.total_count >= 3)
    }).catch(err => {
      // cs_specific_yield table may not exist yet (migration 053 pending).
      // Hide gracefully — matches the "no data" empty case.
      console.warn('[MaybeSpecificYieldPanel] getSpecificYieldLineage failed:', err)
    })
    return () => { cancelled = true }
  }, [state])
  if (!show) return null
  return (
    <>
      <SectionDivider />
      <SpecificYieldPanel state={state} stateName={stateName} mw={mw} />
    </>
  )
}

export function MaybeCsMarketPanel({ state, stateName, mw }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!state) { setShow(false); return }
    let cancelled = false
    getCsMarketSnapshot(state).then(snap => {
      if (!cancelled) setShow(!!snap && snap.projectCount > 0)
    }).catch(err => {
      // cs_projects table may not exist yet (migration 050 pending). Hide
      // gracefully — matches the "no projects" empty case.
      console.warn('[MaybeCsMarketPanel] getCsMarketSnapshot failed:', err)
    })
    return () => { cancelled = true }
  }, [state])
  if (!show) return null
  return (
    <>
      <SectionDivider />
      <CsMarketPanel state={state} stateName={stateName} mw={mw} />
    </>
  )
}

export function MaybeComparableDealsPanel({ state, stateName, technology, mw }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!state) { setShow(false); return }
    let cancelled = false
    const targetMW = parseFloat(mw)
    const mwRange = targetMW > 0 ? [Math.max(0.1, targetMW * 0.5), targetMW * 2.0] : undefined
    // 2026-05-05 (option 3): panel now backed by cs_projects + curated. Check
    // BOTH for visibility — panel renders if either source has matches. The
    // panel's own merge dedupes when both have overlapping rows.
    Promise.all([
      getCsProjectsAsComparables({ state, technology, mwRange }).catch(() => []),
      getComparableDeals({ state, technology, mwRange }).catch(() => []),
    ]).then(([cs, curated]) => {
      if (!cancelled) setShow((cs?.length || 0) + (curated?.length || 0) > 0)
    }).catch(err => {
      console.warn('[MaybeComparableDealsPanel] merged probe failed:', err)
    })
    return () => { cancelled = true }
  }, [state, technology, mw])
  if (!show) return null
  return (
    <>
      <SectionDivider />
      <ComparableDealsPanel state={state} stateName={stateName} technology={technology} mw={mw} />
    </>
  )
}
