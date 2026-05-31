import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { getStatePrograms, getNewsFeed } from '../../lib/programData'
import SectionHeader from '../ui/SectionHeader'
import StateMarketTable from './StateMarketTable'
import CsViabilityRadar from './charts/CsViabilityRadar'
import SubscriptionMixChart from './charts/SubscriptionMixChart'
import PolicyTimeline from './PolicyTimeline'
import DensePolicyFeed from './DensePolicyFeed'
import StateDetailPanel from '../StateDetailPanel'

// MarketsPolicyTab — Ship 2.2.
//
// A deeper read on the CS market than the Home hero gives: which programs
// are accepting capacity (State Program Grid), who markets the deployed
// projects (Subscription Channel Mix), how state scores move week-to-week
// (Feasibility Score Movement — national top movers), and the full policy
// conversation (dense, paginated Policy Feed).
//
// Clicking any state card opens the canonical StateDetailPanel in a modal
// overlay — same component the Home tab docks into its right rail.

function MarketsPolicySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md dash-shimmer" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)', minHeight: '260px' }} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-md dash-shimmer" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)', minHeight: '320px' }} />
        ))}
      </div>
      <div className="rounded-md dash-shimmer" style={{ background: 'var(--cards-bg)', border: '1px solid var(--cards-border)', minHeight: '360px' }} />
    </div>
  )
}

// Expand/meld machinery — same pattern as AnalyticsTab's bento.
const SPRING = { type: 'spring', stiffness: 130, damping: 24, mass: 1 }

export default function MarketsPolicyTab() {
  const reduced = useReducedMotion()
  const LAYOUT = reduced ? false : 'position'
  const [programs, setPrograms] = useState([])
  const [news, setNews] = useState([])
  const [ready, setReady] = useState(false)
  const [selectedStateId, setSelectedStateId] = useState(null)
  const [expandedKeys, setExpandedKeys] = useState(() => new Set())

  const isOpen = (k) => expandedKeys.has(k)
  const toggle = (k) => setExpandedKeys((prev) => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k); else next.add(k)
    return next
  })
  const span = (k, base) => (isOpen(k) ? 'lg:col-span-8' : base)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getStatePrograms().catch(() => []),
      getNewsFeed().catch(() => []),
    ]).then(([progs, feed]) => {
      if (cancelled) return
      setPrograms(progs || [])
      setNews(feed || [])
      setReady(true)
    })
    return () => { cancelled = true }
  }, [])

  const stateProgramMap = useMemo(
    () => Object.fromEntries(programs.map((s) => [s.id, s])),
    [programs],
  )
  const selectedState = selectedStateId ? stateProgramMap[selectedStateId] : null

  // Escape closes the detail modal.
  useEffect(() => {
    if (!selectedStateId) return
    const onKey = (e) => { if (e.key === 'Escape') setSelectedStateId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedStateId])

  if (!ready) return <MarketsPolicySkeleton />

  return (
    <div className="flex flex-col gap-3">
      {/* ── MARKETS ── program viability + who markets the deployed capacity.
          12-col motion bento: table + radar share a row and meld on expand
          (col-span 6→8, sibling reflows); sub-mix spans full width below. */}
      <SectionHeader label="Markets" hint="program viability · channel mix" />
      <motion.div layout={LAYOUT} transition={SPRING} className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch">
        <motion.div layout={LAYOUT} transition={SPRING} className={span('table', 'lg:col-span-6')}>
          <StateMarketTable
            programs={programs}
            onSelectState={setSelectedStateId}
            expandable isExpanded={isOpen('table')} onToggleExpand={() => toggle('table')}
          />
        </motion.div>
        <motion.div layout={LAYOUT} transition={SPRING} className={span('radar', 'lg:col-span-6')}>
          <CsViabilityRadar
            programs={programs}
            expandable isExpanded={isOpen('radar')} onToggleExpand={() => toggle('radar')}
          />
        </motion.div>
        <motion.div layout={LAYOUT} transition={SPRING} className="lg:col-span-12">
          <SubscriptionMixChart />
        </motion.div>
      </motion.div>

      {/* ── POLICY ── regulatory milestones + the policy signal stream.
          Scoped to policy-alert signals (type), distinct from Home's all-signal
          glance — the news_feed pillar field is offtake/ix/site only. */}
      <SectionHeader label="Policy" hint="milestones · regulatory signals" />
      <PolicyTimeline />
      <DensePolicyFeed news={news.filter((n) => n.type === 'policy-alert')} hideTabs />

      {/* State detail modal overlay */}
      {selectedState && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto"
          style={{ background: 'rgba(7,12,20,0.72)', backdropFilter: 'blur(3px)' }}
          onClick={() => setSelectedStateId(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-[440px] mt-4 sm:mt-10 mb-6"
            style={{ height: 'min(720px, 85vh)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <StateDetailPanel
              state={selectedState}
              news={news}
              onClose={() => setSelectedStateId(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
