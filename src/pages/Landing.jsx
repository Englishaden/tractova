import { useState, useEffect, useCallback, useRef, cloneElement } from 'react'
import { Link } from 'react-router-dom'
import * as RadixTabs from '@radix-ui/react-tabs'
import { getStatePrograms, getDashboardMetrics } from '../lib/programData'
import ApiErrorBanner from '../components/ApiErrorBanner'
import { useRevealOnScroll } from '../hooks/useLandingMotion'

import { NumberTicker }        from '../components/ui/landing/NumberTicker'
import { HoverBorderGradient } from '../components/ui/landing/HoverBorderGradient'
import { MagicCard }           from '../components/ui/landing/MagicCard'
import { AnimatedTooltip }     from '../components/ui/landing/AnimatedTooltip'
import { Compare }             from '../components/ui/landing/Compare'
import { BackgroundBeams }     from '../components/ui/landing/BackgroundBeams'
import { AuroraBackground }    from '../components/ui/landing/AuroraBackground'
import { LampContainer }       from '../components/ui/landing/LampContainer'

// ── icons ────────────────────────────────────────────────────────────────────
function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

function IconFaqPlusMinus({ open }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 transition-colors" style={{ background: '#0F1A2E' }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {open
          ? <line x1="5" y1="12" x2="19" y2="12"/>
          : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
      </svg>
    </span>
  )
}

// ── hero preview card — simulated dashboard snapshot (preserved) ─────────────
function DashboardPreview({ activeCount, metrics }) {
  const sampleStates = [
    { id: 'IL', score: 78, status: 'active'  },
    { id: 'CO', score: 75, status: 'active'  },
    { id: 'MN', score: 72, status: 'active'  },
    { id: 'MD', score: 70, status: 'active'  },
    { id: 'VA', score: 67, status: 'active'  },
    { id: 'MA', score: 45, status: 'limited' },
  ]

  return (
    <div className="relative w-full max-w-md ml-auto">
      <div className="absolute -inset-1 rounded-xl blur-xl" style={{ background: 'rgba(20,184,166,0.25)' }} />
      <div className="relative border rounded-xl overflow-hidden shadow-2xl" style={{ background: '#0F1A2E', borderColor: 'rgba(20,184,166,0.15)' }}>
        <div className="absolute top-0 left-0 right-0 h-px z-10" style={{ background: 'linear-gradient(90deg, rgba(20,184,166,0.4) 0%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.4) 100%)' }} />
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10 bg-white/5">
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="ml-3 text-xs text-white/30 font-mono">tractova.com</span>
        </div>
        <div className="grid grid-cols-3 gap-px bg-white/5 border-b border-white/10">
          {[
            { label: 'Active CS Programs', value: activeCount },
            { label: 'IX Headroom',        value: `${metrics?.utilitiesWithIXHeadroom ?? '—'}+` },
            { label: 'Policy Alerts',      value: metrics?.policyAlertsThisWeek ?? '—' },
          ].map(m => (
            <div key={m.label} className="px-4 py-3" style={{ background: '#0F1A2E' }}>
              <div className="text-2xl font-bold font-mono text-white tabular-nums">{m.value}</div>
              <div className="text-[10px] text-white/40 mt-0.5 leading-tight">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">Top Opportunity States</div>
          <div className="space-y-1.5">
            {sampleStates.map(s => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-xs font-mono text-white/50 w-5">{s.id}</span>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.score}%`, backgroundColor: s.status === 'active' ? '#14B8A6' : '#F59E0B' }} />
                </div>
                <span className="text-xs font-mono tabular-nums text-white/60 w-6 text-right">{s.score}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">Recent Policy Alerts</span>
            <span className="text-[8px] text-white/25 uppercase tracking-wider">Updated weekly</span>
          </div>
          <div className="space-y-2">
            {[
              { tag: 'Offtake', text: 'Illinois Shines capacity expanded under new CEJA rules' },
              { tag: 'IX',      text: 'Xcel Solar Garden queue moving — new block open' },
            ].map((a, i) => (
              <div key={i} className="flex items-baseline gap-2">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm shrink-0 leading-tight" style={a.tag === 'IX'
                  ? { background: 'rgba(245,158,11,0.18)', color: '#FCD34D' }
                  : { background: 'rgba(20,184,166,0.20)', color: '#5EEAD4' }}>
                  {a.tag}
                </span>
                <p className="text-[10px] text-white/55 leading-snug">{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── primitives ───────────────────────────────────────────────────────────────
function Eyebrow({ children, dark = false }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="w-1 h-1 rounded-full" style={{ background: dark ? '#5EEAD4' : '#14B8A6' }} />
      <span className="eyebrow-mono" style={{ color: dark ? '#5EEAD4' : '#0F766E' }}>{children}</span>
      <span className="w-1 h-1 rounded-full" style={{ background: dark ? '#5EEAD4' : '#14B8A6' }} />
    </div>
  )
}

// Primary CTA — now wrapped in HoverBorderGradient so the conic-gradient
// border spins around the button. Keeps the text-swap on hover from the
// previous design (the two-stacked spans). Renders as a Link via the
// outer wrapper.
function CtaPrimary({ to, children, className = '' }) {
  return (
    <Link to={to} className="inline-flex">
      <HoverBorderGradient
        as="span"
        containerClassName="rounded-lg"
        className={`lp-btn-swap inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white ${className}`}
        style={{ background: '#14B8A6' }}
      >
        <span className="lp-btn-swap__stack">
          <span className="lp-btn-swap__text">{children}</span>
          <span className="lp-btn-swap__text" aria-hidden="true">{children}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </HoverBorderGradient>
    </Link>
  )
}

// Counter block — switched to NumberTicker so the count-up animation is
// driven by a single self-contained component (no ref/state threading).
function CounterBlock({ target, suffix = '', label, sub, dark = false }) {
  return (
    <div>
      <NumberTicker
        value={target}
        suffix={suffix}
        className={`lp-h2 ${dark ? 'text-white' : ''}`}
        style={dark ? { textShadow: '0 1px 24px rgba(0,0,0,0.4)' } : { color: '#0F1A2E' }}
      />
      <div className={`lp-h6 mt-1.5 ${dark ? 'text-white/85' : 'text-gray-800'}`}>{label}</div>
      {sub && <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-400'}`}>{sub}</div>}
    </div>
  )
}

// TextReveal — word-by-word fade-up on enter viewport. (Same as before.)
function TextReveal({ as: Tag = 'h1', className = '', children, baseDelay = 55, style }) {
  const ref = useRevealOnScroll()
  let wordIndex = 0

  const process = (node, keyBase) => {
    if (node == null || typeof node === 'boolean') return null
    if (typeof node === 'string' || typeof node === 'number') {
      const parts = String(node).split(/(\s+)/)
      return parts.map((part, i) => {
        if (!part) return null
        if (/^\s+$/.test(part)) return <span key={`${keyBase}-ws-${i}`}>{part}</span>
        const delay = wordIndex * baseDelay
        wordIndex += 1
        return (
          <span key={`${keyBase}-w-${i}`} className="lp-word" style={{ transitionDelay: `${delay}ms` }}>
            {part}
          </span>
        )
      })
    }
    if (Array.isArray(node)) {
      return node.map((c, i) => process(c, `${keyBase}-${i}`))
    }
    if (node.props) {
      const kids = node.props.children
      if (kids == null) return cloneElement(node, { key: keyBase })
      return cloneElement(node, { key: keyBase }, process(kids, `${keyBase}-c`))
    }
    return null
  }

  return (
    <Tag ref={ref} className={`lp-text-reveal ${className}`} style={style}>
      {process(children, 'r')}
    </Tag>
  )
}

// SpotlightCard — kept for dark-bg surfaces (pillar tab content panel).
function SpotlightCard({ className = '', children }) {
  const ref = useRef(null)
  const onMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }
  return (
    <div ref={ref} onMouseMove={onMove}
         className={`lp-spotlight rounded-2xl border p-7 transition-colors bg-white/[0.03] border-white/10 hover:border-white/25 text-white ${className}`}>
      {children}
    </div>
  )
}

// ── Data sources marquee with hover tooltips ────────────────────────────────
const DATA_SOURCES = [
  { label: 'DSIRE',          sub: 'incentives',           name: 'Database of State Incentives for Renewables & Efficiency' },
  { label: 'EIA',            sub: 'retail rates',         name: 'U.S. Energy Information Administration' },
  { label: 'NREL',           sub: 'PVWatts · cost',       name: 'National Renewable Energy Laboratory' },
  { label: 'LBNL',           sub: 'spec yield',           name: 'Lawrence Berkeley National Laboratory' },
  { label: 'USFWS NWI',      sub: 'wetlands',             name: 'USFWS National Wetlands Inventory' },
  { label: 'USDA SSURGO',    sub: 'farmland',             name: 'USDA Soil Survey Geographic Database' },
  { label: 'HUD QCT / DDA',  sub: 'IRA bonus',            name: 'HUD Qualified Census Tracts / DDAs' },
  { label: 'FERC',           sub: 'IX queues',            name: 'Federal Energy Regulatory Commission' },
  { label: 'EPA',            sub: 'brownfields',          name: 'Environmental Protection Agency' },
  { label: 'NOAA',           sub: 'climate',              name: 'National Oceanic & Atmospheric Admin' },
  { label: 'Census ACS',     sub: 'demographics · LMI',   name: 'U.S. Census American Community Survey' },
  { label: 'ISO / RTO',      sub: 'distribution-DG',      name: 'Independent System Operators / RTOs' },
]

function SourcesMarquee() {
  const doubled = [...DATA_SOURCES, ...DATA_SOURCES]
  return (
    // Native `title` attributes for the per-item hover affordance — the
    // marquee's overflow:hidden would clip a real Tooltip pop-up. The
    // AnimatedTooltip primitive is reserved for the pillar weight chips
    // (in PillarTabs) where overflow isn't constrained.
    <div className="lp-marquee" style={{ '--marquee-duration': '45s' }}>
      <div className="lp-marquee__track py-2">
        {doubled.map((s, i) => (
          <div
            key={`${s.label}-${i}`}
            title={`${s.name} — ${s.sub}`}
            className="flex items-center gap-3 px-6 lg:px-9 shrink-0"
          >
            <span className="lp-h4 tabular-nums" style={{ color: '#0F1A2E' }}>{s.label}</span>
            <span className="text-xs text-gray-400 leading-tight max-w-[7rem]">{s.sub}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300 ml-3" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 5-pillar tabs ────────────────────────────────────────────────────────────
const PILLARS = [
  { id: 'offtake',    title: 'Offtake',         weight: 25,  weightTooltip: 'Highest-weighted pillar. Revenue source (NM / NB / CS / C&I) + export-rate haircut.',
    description: 'Where the revenue actually comes from. Program capacity remaining, monetization structure (NM / NB / Community Solar / C&I), and the full export-rate haircut for every active state.',
    sources: ['DSIRE', 'State PUC orders', 'Utility tariff books', 'NEEC export rates'],
    primary: { value: 12, label: 'NB states sourced' },
    secondary: 'CA · AZ · UT · ID · AR · IN · LA · MI · NC · OH · KY · SC' },
  { id: 'ix',         title: 'Interconnection', weight: 25,  weightTooltip: 'Highest-weighted pillar. Queue saturation + utility ease + study timelines.',
    description: 'The most differentiated layer in the platform. Distribution-DG queue saturation, utility ease scores, average study timelines, and ISA withdrawal rates — built per-state because nobody else has done this cleanly for sub-20MW developers.',
    sources: ['ISO/RTO queues', 'State distribution dockets', 'FERC Form 1', 'Utility IRPs'],
    primary: { value: 7, label: 'States w/ distribution-DG feeds' },
    secondary: 'NY · NJ · MA · VA · WI · CA · MD' },
  { id: 'incentives', title: 'Incentives',      weight: 20,  weightTooltip: 'IRA bonus stack: ITC adders + energy-community + LIC + domestic content.',
    description: 'The IRA bonus stack. ITC adders, energy-community designation, low-income community premiums, domestic content. Combined with state-level REC / SREC market rates into one revenue ladder.',
    sources: ['IRS § 48 / 48E', 'HUD QCT / DDA', 'Treasury energy-community', 'State REC markets'],
    primary: { value: 4, label: 'IRA bonus zones tracked' },
    secondary: 'Energy community · LIC · Domestic content · QCT / DDA' },
  { id: 'site',       title: 'Site',            weight: 20,  weightTooltip: 'Buildability: farmland classification + wetlands + county land-use.',
    description: "What land is actually buildable. USDA prime-farmland classification, USFWS wetlands, county-level land-use restrictions. Know if a site is developable before you spend a dollar on site control.",
    sources: ['USDA SSURGO', 'USFWS NWI', 'EPA brownfields', 'County land use'],
    primary: { value: 3143, label: 'U.S. counties indexed' },
    secondary: 'Path B — complete' },
  { id: 'policy',     title: 'Policy & Timing', weight: 10,  weightTooltip: 'What\'s changing: comment deadlines, rate cases, queue reform, program revisions.',
    description: "What's about to change. Comment deadlines, rate cases, program rule revisions, queue reform rulings. The signal that catches a developer before the rules shift, not after.",
    sources: ['PUC dockets', 'FERC rulemakings', 'State legislation', 'ISO queue reforms'],
    primary: { value: null, label: 'Refresh cadence' },
    secondary: 'Surface alerts in-app' },
]

function PillarTabs() {
  return (
    <RadixTabs.Root defaultValue={PILLARS[0].id} className="w-full">
      <RadixTabs.List className="flex flex-wrap gap-2 mb-8">
        {PILLARS.map(p => (
          <RadixTabs.Trigger key={p.id} value={p.id} className="lp-tab-trigger">
            {p.title}
            <AnimatedTooltip label={`${p.title} — ${p.weight}% of composite signal`} sublabel={p.weightTooltip}>
              <span className="text-[11px] font-mono opacity-60 cursor-help">{p.weight}%</span>
            </AnimatedTooltip>
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>

      {PILLARS.map(p => (
        <RadixTabs.Content key={p.id} value={p.id} className="outline-hidden">
          <SpotlightCard className="!p-8 lg:!p-10">
            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12">
              <div>
                <p className="text-base lg:text-lg text-white/75 leading-relaxed" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.3)' }}>{p.description}</p>

                <div className="mt-7">
                  <div className="eyebrow-mono mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>Data sources</div>
                  <div className="flex flex-wrap gap-2">
                    {p.sources.map(s => (
                      <span key={s} className="text-xs px-3 py-1.5 rounded-full text-white/75 border border-white/15 bg-white/[0.03]">{s}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:border-l lg:border-white/10 lg:pl-12 space-y-6">
                <div>
                  {p.primary.value !== null ? (
                    <NumberTicker
                      value={p.primary.value}
                      className="lp-h2"
                      style={{ color: '#5EEAD4', textShadow: '0 0 32px rgba(94,234,212,0.25)' }}
                    />
                  ) : (
                    <div className="lp-h2" style={{ color: '#5EEAD4', textShadow: '0 0 32px rgba(94,234,212,0.25)' }}>Weekly</div>
                  )}
                  <div className="lp-h6 text-white/60 mt-1.5">{p.primary.label}</div>
                </div>
                <div className="text-xs font-mono text-white/45 leading-relaxed">{p.secondary}</div>
              </div>
            </div>
          </SpotlightCard>
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  )
}

// ── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ = [
  { q: 'Who is Tractova actually for?',
    a: "Independent community-solar developers — 1 to 100-person shops — with real projects but no in-house policy, interconnection, or incentive-research staff. If you're a 5-person developer covering 12 states with one analyst, Tractova is the team you can't afford to hire." },
  { q: 'How is this different from EnergyAcuity or spreadsheet research?',
    a: 'The big platforms are priced for IPPs with $100k+ data budgets. Spreadsheets get stale the day you save them. Tractova sits in between: live federal + state data refreshed weekly, opinionated scoring for the sub-20MW market, $29.99/mo.' },
  { q: 'Where does the data come from?',
    a: 'Every score traces back to a .gov source: DSIRE for incentives, EIA for retail rates, NREL for solar resource, USFWS for wetlands, USDA for farmland, HUD for IRA bonus zones, the relevant ISO/RTO for IX queues, and state PUC dockets for program orders.' },
  { q: 'How often is the data refreshed?',
    a: "Weekly via scheduled jobs. Policy alerts surface as soon as a state portal updates. We don't claim real-time — we claim consistently fresh and consistently honest." },
  { q: 'What does the platform cost?',
    a: 'Free dashboard access — see every active CS program in the country, no card required. Pro is $29.99/mo for the full Lens, Library, and policy alerts. 14-day free trial on Pro.' },
  { q: 'How do I get started?',
    a: "Create a free account. The market dashboard is yours immediately. Run one Lens on a real project of yours — that's the moment you'll know if the time-savings claim is real for your workflow." },
]

function FaqAccordion() {
  const [openIdx, setOpenIdx] = useState(0)
  return (
    <div>
      {FAQ.map((item, i) => {
        const isOpen = openIdx === i
        return (
          <div key={i} className={`lp-accordion-row border-t border-gray-200 ${i === FAQ.length - 1 ? 'border-b' : ''} ${isOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? -1 : i)}
              className="w-full text-left py-4 lg:py-5 flex items-center justify-between gap-6"
              aria-expanded={isOpen}
            >
              <span className="lp-h5" style={{ color: '#0F1A2E' }}>{item.q}</span>
              <IconFaqPlusMinus open={isOpen} />
            </button>
            <div className="lp-accordion-body">
              <div className="lp-accordion-inner pb-5 pr-8">
                <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">{item.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Compare panels — manual research mock vs Tractova Lens mock ─────────────
function ManualResearchPanel() {
  return (
    <div className="h-full p-6 lg:p-8 flex flex-col" style={{ background: '#F4F2EC' }}>
      <div className="flex items-baseline justify-between mb-5">
        <div className="eyebrow-mono text-gray-400">Manual research</div>
        <div className="text-xs font-mono text-gray-500 tabular-nums">~4 hrs / county</div>
      </div>
      <h3 className="lp-h4 text-gray-900 mb-4">Spreadsheet workflow</h3>
      <ul className="text-xs lg:text-sm text-gray-500 space-y-2.5 flex-1">
        {[
          ['00:15', 'State CS portal navigation — find the right program docket'],
          ['01:45', 'ISO/RTO queue check + utility filings — manual scrape'],
          ['02:30', 'Census ACS pull for LMI thresholds + parcel research'],
          ['03:00', 'NWI wetland mapping — USFWS viewer, screenshot, annotate'],
          ['03:45', 'Stitch into a one-pager — Excel, Word, copy-paste'],
        ].map(([t, line]) => (
          <li key={t} className="flex items-start gap-3">
            <span className="font-mono text-[10px] text-gray-400 tabular-nums shrink-0 w-9 pt-0.5">{t}</span>
            <span className="leading-relaxed">{line}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 pt-4 border-t border-gray-300/60">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow-mono text-gray-400">Result</span>
          <span className="text-xs text-gray-500">Stale by next week. No alerts when it changes.</span>
        </div>
      </div>
    </div>
  )
}

function TractovaLensPanel() {
  return (
    <div className="h-full p-6 lg:p-8 flex flex-col relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(94,234,212,0.85) 50%, transparent 100%)' }} />
      <div className="flex items-baseline justify-between mb-5 relative">
        <div className="eyebrow-mono" style={{ color: '#5EEAD4' }}>Tractova Lens</div>
        <div className="text-xs font-mono tabular-nums" style={{ color: '#5EEAD4' }}>~2 min / county</div>
      </div>
      <h3 className="lp-h4 text-white mb-4">5-pillar signal report</h3>
      <div className="space-y-2.5 flex-1">
        {[
          { name: 'Offtake',         pct: 78, weight: '25%' },
          { name: 'Interconnection', pct: 64, weight: '25%' },
          { name: 'Incentives',      pct: 91, weight: '20%' },
          { name: 'Site',            pct: 58, weight: '20%' },
          { name: 'Policy & Timing', pct: 72, weight: '10%' },
        ].map(p => (
          <div key={p.name} className="flex items-center gap-3">
            <span className="text-xs text-white/70 w-32">{p.name}</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: 'linear-gradient(90deg, #14B8A6 0%, #5EEAD4 100%)' }} />
            </div>
            <span className="text-xs font-mono text-white/70 tabular-nums w-7 text-right">{p.pct}</span>
            <span className="text-[10px] font-mono text-white/30 w-9 text-right">{p.weight}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 pt-4 border-t border-white/10">
        <div className="flex items-baseline justify-between gap-4">
          <span className="eyebrow-mono" style={{ color: '#5EEAD4' }}>AI brief</span>
          <span className="text-xs text-white/55 text-right leading-snug">Strong incentive stack (91). Watch IX — Q3 queue reform pending.</span>
        </div>
      </div>
    </div>
  )
}

// ── reveal helper ────────────────────────────────────────────────────────────
function Reveal({ delay = 0, className = '', children, as: Tag = 'div' }) {
  const ref = useRevealOnScroll()
  const delayCls = delay ? ` reveal-delay-${delay}` : ''
  return <Tag ref={ref} className={`reveal-on-scroll${delayCls} ${className}`}>{children}</Tag>
}

// CursorGridSection — tracks the cursor inside the dark section and exposes
// --cursor-x / --cursor-y CSS vars + --grid-spotlight-opacity. The
// .lp-hero-grid--cursor layer masks itself to a circle around those coords.
function CursorGridSection({ children, className = '', style, as: Tag = 'section' }) {
  const ref = useRef(null)
  const onMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--cursor-x', `${e.clientX - rect.left}px`)
    el.style.setProperty('--cursor-y', `${e.clientY - rect.top}px`)
    el.style.setProperty('--grid-spotlight-opacity', '1')
  }
  const onLeave = () => {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--grid-spotlight-opacity', '0')
  }
  return (
    <Tag ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
         className={`text-white relative overflow-hidden ${className}`} style={style}>
      {children}
    </Tag>
  )
}

// ── main component ───────────────────────────────────────────────────────────
export default function Landing() {
  const [programs, setPrograms]     = useState([])
  const [metrics, setMetrics]       = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [retrying, setRetrying]     = useState(false)

  const loadHero = useCallback(async (isRetry = false) => {
    if (isRetry) setRetrying(true)
    const [progRes, metRes] = await Promise.allSettled([
      getStatePrograms(),
      getDashboardMetrics(),
    ])
    if (progRes.status === 'fulfilled') setPrograms(progRes.value)
    if (metRes.status === 'fulfilled')  setMetrics(metRes.value)
    if (progRes.status === 'rejected' && metRes.status === 'rejected') {
      setFetchError({
        message: 'Live market data temporarily unavailable.',
        detail: 'Hero counts may be incomplete. The platform itself is unaffected.',
      })
    } else {
      setFetchError(null)
    }
    if (isRetry) setRetrying(false)
  }, [])

  useEffect(() => { loadHero(false) }, [loadHero])

  const activeCount   = programs.filter(s => s.csStatus === 'active').length
  const limitedCount  = programs.filter(s => s.csStatus === 'limited').length
  const statesMapped  = activeCount + limitedCount

  return (
    <div className="pt-14">

      {/* ── 1. Hero — dark, cursor-following grid ──────────────────────── */}
      <CursorGridSection style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}>
        <div className="lp-accent-rail" />
        <div className="lp-hero-grid" />
        <div className="lp-hero-grid lp-hero-grid--cursor" />
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 py-14 lg:py-20 relative grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">

          <div>
            <TextReveal as="h1"
                        className="lp-h1 text-white mb-6 lp-text-shadow-glow"
                        baseDelay={55}>
              The intelligence edge<br />
              small developers <span style={{ color: '#5EEAD4' }}>don&apos;t have.</span>
            </TextReveal>

            <Reveal delay={300}>
              <p className="lp-h5 text-white/65 leading-relaxed mb-8 max-w-xl" style={{ fontWeight: 400 }}>
                Site, interconnection, incentives, offtake, policy — one platform, five pillars, refreshed weekly. Built for shops competing against teams with dedicated research staff.
              </p>
            </Reveal>

            <Reveal delay={400}>
              <div className="flex flex-wrap items-center gap-5 mb-5">
                <CtaPrimary to="/signup">Get started free</CtaPrimary>
                <Link to="/preview" className="text-sm font-medium text-white/65 hover:text-white transition-colors">
                  Preview live data →
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/45">
                <span className="font-mono">Pro $29.99/mo · 14-day trial</span>
                <span className="text-white/20">·</span>
                {['Free dashboard', 'No card required', 'Live federal data'].map(t => (
                  <span key={t} className="flex items-center gap-1.5">
                    <span style={{ color: '#5EEAD4' }}><IconCheck /></span>
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal delay={350}>
            <DashboardPreview activeCount={activeCount} metrics={metrics} />
          </Reveal>
        </div>
      </CursorGridSection>

      {/* ── 2. Data sources marquee ─────────────────────────────────────── */}
      <section className="bg-white border-y border-gray-200 py-8 lg:py-10">
        <div className="max-w-[95rem] mx-auto">
          {fetchError && (
            <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 mb-6">
              <ApiErrorBanner
                message={fetchError.message}
                detail={fetchError.detail}
                onRetry={() => loadHero(true)}
                retrying={retrying}
              />
            </div>
          )}

          <div className="px-6 lg:px-9 mb-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Eyebrow>Our data sources</Eyebrow>
                <span className="text-xs text-gray-400 hidden sm:inline">Hover any source to see the full agency name.</span>
              </div>
              <span className="eyebrow-mono text-gray-400">Refreshed weekly</span>
            </div>
          </div>

          <SourcesMarquee />
        </div>
      </section>

      {/* ── 3. Five-pillar tabs + stats — w/ Background Beams ─────────── */}
      <section className="text-white relative isolate overflow-hidden" style={{ background: '#0A132A' }}>
        <div className="lp-accent-rail" />
        <BackgroundBeams />
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 py-16 lg:py-20 relative">

          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 mb-12 items-end">
            <Reveal>
              <Eyebrow dark>What we cover · The platform, in numbers</Eyebrow>
              <h2 className="lp-h2 mt-4 text-white lp-text-shadow-soft">
                Five pillars.<br/>
                <span className="text-white/55">Every signal traceable.</span>
              </h2>
              <p className="mt-5 lp-h5 text-white/65 leading-relaxed max-w-lg" style={{ fontWeight: 400 }}>
                Community solar lives or dies on five questions. Tractova scores each one independently — when a state&apos;s signal moves, you know which pillar moved it.
              </p>
            </Reveal>

            <Reveal delay={150} className="grid grid-cols-2 gap-8 lg:gap-10">
              <CounterBlock dark target={typeof activeCount === 'number' ? activeCount : 0} label="Active CS Programs" sub="across the U.S." />
              <CounterBlock dark target={typeof metrics?.utilitiesWithIXHeadroom === 'number' ? metrics.utilitiesWithIXHeadroom : 0} suffix="+" label="Utilities w/ IX Headroom" sub="scored on ease" />
              <CounterBlock dark target={statesMapped || 0} label="States Fully Mapped" sub="site · IX · offtake" />
              <CounterBlock dark target={5} label="Intelligence Pillars" sub="every score decomposable" />
            </Reveal>
          </div>

          <Reveal delay={200}>
            <PillarTabs />
          </Reveal>
        </div>
      </section>

      {/* ── 4. Bento — Compare on top, then who-for + steps + CTA ─────── */}
      <section className="bg-paper py-16 lg:py-20 border-b border-gray-200">
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9">

          <div className="text-center mb-10 lg:mb-12">
            <Reveal>
              <Eyebrow>Same county research · in 2 minutes · instead of 4 hours</Eyebrow>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="lp-h2 mt-4 max-w-3xl mx-auto" style={{ color: '#0F1A2E' }}>
                See it side-by-side.
              </h2>
              <p className="mt-3 text-sm text-gray-500 max-w-xl mx-auto">
                Hover anywhere on the panel below — the divider follows your cursor.
              </p>
            </Reveal>
          </div>

          {/* Compare slider — full bento width */}
          <Reveal>
            <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm mb-6">
              <Compare
                first={<ManualResearchPanel />}
                second={<TractovaLensPanel />}
                slideMode="hover"
                initial={48}
                className="h-[420px] lg:h-[480px]"
              />
            </div>
          </Reveal>

          {/* 120× caption row */}
          <Reveal delay={100}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 mb-10 lg:mb-12">
              <div className="flex items-baseline gap-3">
                <NumberTicker
                  value={120}
                  className="tabular-nums"
                  style={{
                    fontFamily: 'Geist, system-ui, sans-serif',
                    fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
                    fontWeight: 600,
                    letterSpacing: '-0.04em',
                    color: '#0F1A2E',
                    lineHeight: 1,
                  }}
                />
                <span className="lp-h3 text-gray-400">× faster</span>
                <span className="text-sm text-gray-500 ml-2">per county. 50 counties in the time it took to research one.</span>
              </div>
              <CtaPrimary to="/signup">Run a Lens</CtaPrimary>
            </div>
          </Reveal>

          {/* Bento row 2: built-for (2-col) + not-for (1-col) */}
          <div className="grid md:grid-cols-3 gap-4 lg:gap-5 mb-4 lg:mb-5">
            <Reveal className="md:col-span-2">
              <MagicCard gradientColor="#5EEAD4" gradientOpacity={0.22} className="lp-light-card h-full">
                <div className="p-7">
                  <div className="flex items-center justify-between mb-5">
                    <Eyebrow>Built for who, exactly</Eyebrow>
                    <span className="eyebrow-mono" style={{ color: '#0F766E' }}>Tractova is for</span>
                  </div>
                  <h3 className="lp-h3 mb-4" style={{ color: '#0F1A2E' }}>
                    The under-100-person shop. Real projects.<br/>
                    <span className="text-gray-500">No research team.</span>
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-5 max-w-2xl">
                    Large IPPs have entire teams pulling queue data, monitoring program capacity, and flagging policy changes. You don&apos;t. <strong className="text-gray-900">Tractova is the team you can&apos;t afford to hire.</strong>
                  </p>
                  <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
                    {[
                      'Independent solar devs (under 100ppl)',
                      'C&I expanding into community solar',
                      'Project-finance evaluating new markets',
                      'Devs tracking multiple state projects',
                    ].map(t => (
                      <li key={t} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-0.5 shrink-0" style={{ color: '#0F766E' }}><IconCheck /></span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              </MagicCard>
            </Reveal>

            <Reveal delay={100}>
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-7 h-full">
                <div className="eyebrow-mono mb-4 text-gray-500">Not designed for</div>
                <ul className="space-y-2.5">
                  {[
                    'Large IPPs w/ intelligence teams',
                    'Utility-scale (>50MW)',
                    'Residential installers',
                    'EPC / procurement teams',
                  ].map(t => (
                    <li key={t} className="flex items-start gap-2.5 text-sm text-gray-500">
                      <span className="mt-0.5 shrink-0 text-gray-300">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          {/* Bento row 3: 3 step cells */}
          <div className="grid md:grid-cols-3 gap-4 lg:gap-5 mb-4 lg:mb-5">
            {[
              { step: '01', title: 'Search your project', body: 'State, county, size, stage, technology. Tractova pulls the relevant intelligence for that exact context.' },
              { step: '02', title: 'Read the five-pillar report', body: 'Each pillar scored independently with cited sources. AI brief surfaces the two or three signals that actually matter.' },
              { step: '03', title: 'Track your pipeline', body: 'Save projects to your library. Get alerts when capacity drops, queue status changes, or policy shifts.' },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 100}>
                <MagicCard gradientColor="#5EEAD4" gradientOpacity={0.18} className="lp-light-card h-full">
                  <div className="p-7">
                    <div className="font-mono text-sm tabular-nums mb-3" style={{ color: '#0F766E' }}>{s.step}</div>
                    <h3 className="lp-h4 mb-2.5" style={{ color: '#0F1A2E' }}>{s.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
                  </div>
                </MagicCard>
              </Reveal>
            ))}
          </div>

          {/* Bento row 4: full-width mid-CTA */}
          <Reveal>
            <MagicCard gradientColor="#5EEAD4" gradientOpacity={0.20} className="lp-light-card">
              <div className="p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div>
                  <h3 className="lp-h4 mb-1" style={{ color: '#0F1A2E' }}>Try it on one of your projects.</h3>
                  <p className="text-sm text-gray-500">14-day Pro trial. No card required. The first Lens run tells you if this fits your workflow.</p>
                </div>
                <CtaPrimary to="/signup">Get started free</CtaPrimary>
              </div>
            </MagicCard>
          </Reveal>
        </div>
      </section>

      {/* ── 5. FAQ + sidebar — wrapped in AuroraBackground ────────────── */}
      <AuroraBackground className="bg-white py-16 lg:py-20">
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 grid lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-16 relative">

          <Reveal>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="lp-h2 mt-3 mb-2" style={{ color: '#0F1A2E' }}>Common questions.</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-lg">
              The questions developers actually ask before signing up. If yours isn&apos;t here, sign up free and message the founder directly.
            </p>
            <FaqAccordion />
          </Reveal>

          <Reveal delay={100} className="lg:sticky lg:top-24 self-start space-y-4">
            <MagicCard gradientColor="#5EEAD4" gradientOpacity={0.16} className="lp-light-card">
              <div className="p-7">
                <Eyebrow>Why now</Eyebrow>
                <h3 className="lp-h4 mt-3 mb-3" style={{ color: '#0F1A2E' }}>The window is open — briefly.</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  IRA bonus tiers are still being claimed. State CS programs are still opening blocks. Queue reform is reshaping which utilities are buildable. <strong className="text-gray-900">The next 24 months are when small developers either gain market share or get crowded out.</strong>
                </p>
              </div>
            </MagicCard>

            <MagicCard gradientColor="#5EEAD4" gradientOpacity={0.16} className="lp-light-card">
              <div className="p-7">
                <Eyebrow>Methodology</Eyebrow>
                <h3 className="lp-h4 mt-3 mb-3" style={{ color: '#0F1A2E' }}>Every score is decomposable.</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">
                  Click any state on the dashboard, expand any pillar, and you&apos;ll see the inputs. No black box. No proprietary &quot;AI score&quot; — just sourced data with a transparent weighting.
                </p>
                <Link to="/glossary" className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: '#0F766E' }}>
                  Read the glossary →
                </Link>
              </div>
            </MagicCard>
          </Reveal>
        </div>
      </AuroraBackground>

      {/* ── 6. Final CTA — Lamp Container ────────────────────────────── */}
      <LampContainer className="text-white" >
        <div style={{ background: 'linear-gradient(180deg, #0F1A2E 0%, #050A1A 100%)' }}>
          <div className="lp-accent-rail" />
          <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 py-20 lg:py-28 relative grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16 items-center">

            <Reveal>
              <h2 className="lp-h1 text-white mb-6 lp-text-shadow-glow">
                Start building<br/>smarter.
              </h2>
              <p className="lp-h5 text-white/65 leading-relaxed mb-8 max-w-lg" style={{ fontWeight: 400 }}>
                <strong className="text-white">Free dashboard access</strong> — see every active CS program in the country, no card required. Upgrade to Pro when you&apos;re ready to run real projects through the Lens.
              </p>
              <div className="flex flex-wrap gap-4">
                <CtaPrimary to="/signup">Create your free account</CtaPrimary>
                <Link to="/preview" className="px-6 py-3 rounded-lg text-sm font-semibold border text-white/85 hover:text-white transition-colors" style={{ borderColor: 'rgba(255,255,255,0.18)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}>
                  Preview live data →
                </Link>
              </div>
              <p className="text-xs text-white/40 mt-6">
                Existing user? <Link to="/signin" className="underline hover:text-white">Sign in</Link>
              </p>
            </Reveal>

            <Reveal delay={150} className="grid sm:grid-cols-2 gap-4">
              {[
                { kpi: 'Free',     title: 'Free to start',   body: 'Dashboard + 50-state coverage. No card.' },
                { kpi: 'Weekly',   title: 'Live data',       body: 'Federal + state sources refreshed weekly.' },
                { kpi: '2 min',    title: 'Per Lens run',    body: '4-hour county research, condensed.' },
                { kpi: '$29.99',   title: 'Pro / month',     body: 'Full Lens, Library, policy alerts. 14-day trial.' },
              ].map(f => (
                <SpotlightCard key={f.title} className="!p-5">
                  <div className="eyebrow-mono mb-3" style={{ color: '#5EEAD4' }}>{f.kpi}</div>
                  <h3 className="lp-h5 text-white mb-1.5">{f.title}</h3>
                  <p className="text-xs text-white/55 leading-relaxed">{f.body}</p>
                </SpotlightCard>
              ))}
            </Reveal>
          </div>
        </div>
      </LampContainer>

    </div>
  )
}
