import { useState, useEffect } from 'react'
import {
  getComparableDeals,
  getCsProjectsAsComparables,
  getCsMarketSnapshot,
  getSpecificYieldLineage,
} from '../lib/programData'
import SectionMarker from './SectionMarker'
import ComparableDealsPanel from './ComparableDealsPanel'
import CsMarketPanel from './CsMarketPanel'
import SpecificYieldPanel from './SpecificYieldPanel'
import GlossaryLabel from './ui/GlossaryLabel'
import CollapsibleSubsection from './CollapsibleSubsection'

// § 05 · Comparable Deals & Benchmarks
//
// Groups three previously-standalone curation-gated panels under one
// SectionMarker so the developer reads point-estimate ("similar projects")
// + statistical ("market median") views in one place. Each sub-element is
// a collapsible that hides entirely when its dataset has no rows for the
// state — keeps empty-state UX tight pre-revenue.
//
// Members:
//   - Operating Projects (cs_projects, NREL Sharing the Sun seed) —
//     ground truth: what's actually been built. Per-project examples
//     plus state-level aggregates (count, total MW, vintage range,
//     top developers).
//   - Comparable Deals (comparable_deals + cs_projects merged) —
//     point-estimate examples filtered by ±50%/+200% of project MW.
//     Future: URL-paste classifier for news-sourced rows.
//   - Market Benchmarks (cs_specific_yield) — observed kWh/kW
//     specific-yield lineage from operating projects in the state,
//     used to validate the modeled production assumption.
//
// Section hides entirely if all three datasets are empty for the state.

// Wrapper around the shared CollapsibleSubsection so the existing call
// sites here can keep their `glossaryTerm` / `count` / `empty` props
// without changing shape. Glossary tooltip + count badge + (no data
// yet) hint are local concerns; the shared component handles motion +
// a11y.
//
// 2026-05-13 — fixed: the original Phase 0 migration (commit cfce269)
// had the return body recursing into LensComparableSubsection instead
// of CollapsibleSubsection, which would stack-overflow on render. The
// bug was masked by Search.jsx's `{false &&}` gate (commit 4b183d0),
// so it never fired in prod after the OOM debug — but it may have
// confounded the OOM bisect that concluded "CsMarketPanel is the
// cause." § 05 re-enabled later the same day (path A, commit 933237e);
// prod-validated on NY (1351 rows), MA (374), and IL (261) without OOM,
// confirming the wrapper recursion was the real culprit all along.
function LensComparableSubsection({ title, glossaryTerm, description, defaultOpen = false, count, empty = false, children }) {
  const header = glossaryTerm
    ? <GlossaryLabel term={glossaryTerm} displayAs={title} className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold text-ink shrink-0" />
    : <span className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold text-ink shrink-0">{title}</span>

  const descNode = (
    <>
      {description}
      {count != null && <> · <span className="font-mono">{count}</span></>}
      {empty && <span className="font-mono text-[10px] ml-1.5" style={{ color: '#94A3B8' }}>(no data yet)</span>}
    </>
  )

  return (
    <CollapsibleSubsection
      title={header}
      description={descNode}
      defaultOpen={defaultOpen}
    >
      {children}
    </CollapsibleSubsection>
  )
}

function EmptyState({ message }) {
  return (
    <p className="text-[11px] text-gray-500 leading-relaxed">{message}</p>
  )
}

export default function LensComparablesSection({ state, stateName, mw, technology, bisectOnly = null }) {
  // Per-subsection visibility flags. Each subsection probes its data
  // source; collapsible only renders when count > 0.
  const [csMarket, setCsMarket]               = useState(null)   // null = loading, {} = data, false = empty
  const [comparables, setComparables]         = useState(null)
  const [specificYield, setSpecificYield]     = useState(null)

  useEffect(() => {
    if (!state) {
      setCsMarket(false); setComparables(false); setSpecificYield(false)
      return
    }
    let cancelled = false
    const targetMW = parseFloat(mw)
    const mwRange = targetMW > 0 ? [Math.max(0.1, targetMW * 0.5), targetMW * 2.0] : undefined

    // OOM-bisect gating: skip fetches for subsections we're not rendering.
    if (!bisectOnly || bisectOnly === 'operating') {
      getCsMarketSnapshot(state).then(snap => {
        if (cancelled) return
        setCsMarket(snap && snap.projectCount > 0 ? snap : false)
      }).catch(() => { if (!cancelled) setCsMarket(false) })
    } else {
      setCsMarket(false)
    }

    if (!bisectOnly || bisectOnly === 'comparable') {
      Promise.all([
        getCsProjectsAsComparables({ state, technology, mwRange }).catch(() => []),
        getComparableDeals({ state, technology, mwRange }).catch(() => []),
      ]).then(([cs, curated]) => {
        if (cancelled) return
        const total = (cs?.length || 0) + (curated?.length || 0)
        setComparables(total > 0 ? { total, cs, curated } : false)
      }).catch(() => { if (!cancelled) setComparables(false) })
    } else {
      setComparables(false)
    }

    if (!bisectOnly || bisectOnly === 'benchmarks') {
      getSpecificYieldLineage(state).then(snap => {
        if (cancelled) return
        setSpecificYield(snap && snap.total_count >= 3 ? snap : false)
      }).catch(() => { if (!cancelled) setSpecificYield(false) })
    } else {
      setSpecificYield(false)
    }

    return () => { cancelled = true }
  }, [state, technology, mw, bisectOnly])

  // Section is always visible when the user has a valid state in scope.
  // Each subsection shows an empty state if its dataset is sparse — keeps
  // the § 05 structure discoverable even before all three layers are
  // fully seeded.
  if (!state) return null

  const csMarketCount   = csMarket && csMarket !== false ? csMarket.projectCount : null
  const comparablesTotal = comparables && comparables !== false ? comparables.total : null
  const specificCount   = specificYield && specificYield !== false ? specificYield.total_count : null

  return (
    <>
      <SectionMarker index={5} label="Comparable Deals & Benchmarks" sublabel="operating projects · per-deal comps · market aggregates" />
      <div className="space-y-3">
        {(!bisectOnly || bisectOnly === 'operating') && (
          <LensComparableSubsection
            title="◆ Operating Projects"
            glossaryTerm="Operating Projects"
            description={`NREL Sharing the Sun · ground-truth ${stateName} operating CS`}
            count={csMarketCount != null ? `${csMarketCount} project${csMarketCount !== 1 ? 's' : ''}` : null}
            empty={csMarket === false}
            defaultOpen={!!csMarket}
          >
            {csMarket
              ? <CsMarketPanel state={state} stateName={stateName} mw={mw} />
              : <EmptyState message={`No operating community-solar projects seeded for ${stateName} yet. NREL Sharing the Sun is loaded for the highest-volume CS markets; states with light operational deployment may not have rows here yet.`} />
            }
          </LensComparableSubsection>
        )}

        {(!bisectOnly || bisectOnly === 'comparable') && (
          <LensComparableSubsection
            title="◆ Comparable Deals"
            glossaryTerm="Comparable Deals"
            description="point-estimate examples · sized ±50% to 2× of your project"
            count={comparablesTotal != null ? `${comparablesTotal} comp${comparablesTotal !== 1 ? 's' : ''}` : null}
            empty={comparables === false}
          >
            {comparables
              ? <ComparableDealsPanel state={state} stateName={stateName} technology={technology} mw={mw} />
              : <EmptyState message={`No comparable deals curated for ${stateName} yet. Paste news article URLs into the Comparable Deals admin tab to seed rows (admin curation flow — coming soon).`} />
            }
          </LensComparableSubsection>
        )}

        {(!bisectOnly || bisectOnly === 'benchmarks') && (
          <LensComparableSubsection
            title="◆ Market Benchmarks"
            glossaryTerm="Market Benchmarks"
            description="observed kWh/kW yield from operating CS projects · ground truth for the modeled assumption"
            count={specificCount != null ? `n=${specificCount}` : null}
            empty={specificYield === false}
          >
            {specificYield
              ? <SpecificYieldPanel state={state} stateName={stateName} mw={mw} />
              : <EmptyState message={`No specific-yield observations for ${stateName} yet. Need at least 3 operating projects with reported kWh/kW for a meaningful state benchmark.`} />
            }
          </LensComparableSubsection>
        )}
      </div>
    </>
  )
}
