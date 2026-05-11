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

function CollapsibleSubsection({ title, glossaryTerm, description, defaultOpen = false, count, empty = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const header = glossaryTerm
    ? <GlossaryLabel term={glossaryTerm} displayAs={title} className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold text-ink" />
    : <span className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold text-ink">{title}</span>

  return (
    <div className="bg-white rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-baseline gap-3 flex-wrap">
          {header}
          <span className="text-[11px] text-gray-500">
            {description}
            {count != null && <span> · <span className="font-mono">{count}</span></span>}
            {empty && <span className="font-mono text-[10px] ml-1.5" style={{ color: '#94A3B8' }}>(no data yet)</span>}
          </span>
        </div>
        <span className="text-[10px] text-gray-500">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          {children}
        </div>
      )}
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <p className="text-[11px] text-gray-500 leading-relaxed">{message}</p>
  )
}

export default function LensComparablesSection({ state, stateName, mw, technology }) {
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

    // Operating Projects (cs_projects)
    getCsMarketSnapshot(state).then(snap => {
      if (cancelled) return
      setCsMarket(snap && snap.projectCount > 0 ? snap : false)
    }).catch(() => { if (!cancelled) setCsMarket(false) })

    // Comparable Deals (curated + cs_projects merged)
    Promise.all([
      getCsProjectsAsComparables({ state, technology, mwRange }).catch(() => []),
      getComparableDeals({ state, technology, mwRange }).catch(() => []),
    ]).then(([cs, curated]) => {
      if (cancelled) return
      const total = (cs?.length || 0) + (curated?.length || 0)
      setComparables(total > 0 ? { total, cs, curated } : false)
    }).catch(() => { if (!cancelled) setComparables(false) })

    // Market Benchmarks (cs_specific_yield)
    getSpecificYieldLineage(state).then(snap => {
      if (cancelled) return
      setSpecificYield(snap && snap.total_count >= 3 ? snap : false)
    }).catch(() => { if (!cancelled) setSpecificYield(false) })

    return () => { cancelled = true }
  }, [state, technology, mw])

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
        <CollapsibleSubsection
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
        </CollapsibleSubsection>

        <CollapsibleSubsection
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
        </CollapsibleSubsection>

        <CollapsibleSubsection
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
        </CollapsibleSubsection>
      </div>
    </>
  )
}
