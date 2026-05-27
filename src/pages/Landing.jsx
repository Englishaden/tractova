import { useState, useEffect, useCallback, useRef, cloneElement } from 'react'
import { Link } from 'react-router-dom'
import * as RadixTabs from '@radix-ui/react-tabs'
import { getStatePrograms, getDashboardMetrics } from '../lib/programData'
import ApiErrorBanner from '../components/ApiErrorBanner'
import { useRevealOnScroll, useCountUp } from '../hooks/useLandingMotion'

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

function ButtonPrimary({ to, children, className = '' }) {
  return (
    <Link to={to}>
      <span className={`lp-btn-swap inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white transition-colors ${className}`}
            style={{ background: '#14B8A6', boxShadow: '0 8px 24px rgba(20,184,166,0.25)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#0F766E' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#14B8A6' }}>
        <span className="lp-btn-swap__stack">
          <span className="lp-btn-swap__text">{children}</span>
          <span className="lp-btn-swap__text" aria-hidden="true">{children}</span>
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
        </svg>
      </span>
    </Link>
  )
}

// TextReveal — word-by-word fade-up on enter viewport. Lightweight version
// of the Text Reveal skill: each word has its own CSS transition delay;
// the wrapper element gets .is-revealed from useRevealOnScroll once it
// intersects. No framer-motion, no 200vh scroll-scrubbed container — page
// stays dense.
//
// Handles nested React children (e.g. a coloured <span> for the accent
// portion of the headline, an inline <br /> for the line break) by
// cloning each non-text node with its children processed in place. A
// closure counter (wordIndex) gives every word a sequential delay
// regardless of how deeply nested it is.
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
    // React element. If it has children, recurse; otherwise clone as-is
    // (handles void elements like <br />).
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

// LightCard — interactive card optimized for light backgrounds. Uses
// `.lp-light-card` from index.css which combines: a soft teal sheen
// from the top-left + hover-lift + a hairline teal edge that appears
// on hover. The user noted SpotlightCard's teal glow disappears on
// white — this is the alternative.
function LightCard({ className = '', children }) {
  return <div className={`lp-light-card p-7 ${className}`}>{children}</div>
}

// SpotlightCard — cursor-tracking gradient. KEPT for dark-bg surfaces
// (the teal glow reads against navy). Sets --mx / --my on mousemove;
// rendered via the .lp-spotlight ::before in index.css.
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

function CounterBlock({ target, suffix = '', label, sub, dark = false }) {
  const [value, ref] = useCountUp(target)
  return (
    <div ref={ref} className="reveal-on-scroll">
      <div className={`lp-h2 tabular-nums ${dark ? 'text-white' : ''}`}
           style={dark ? { textShadow: '0 1px 24px rgba(0,0,0,0.4)' } : { color: '#0F1A2E' }}>
        {value}{suffix && <span className={`${dark ? 'text-white/40' : 'text-gray-400'}`}>{suffix}</span>}
      </div>
      <div className={`lp-h6 mt-1.5 ${dark ? 'text-white/85' : 'text-gray-800'}`}>{label}</div>
      {sub && <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-400'}`}>{sub}</div>}
    </div>
  )
}

// ── Data sources marquee ────────────────────────────────────────────────────
const DATA_SOURCES = [
  { label: 'DSIRE',          sub: 'incentives' },
  { label: 'EIA',            sub: 'retail rates' },
  { label: 'NREL',           sub: 'PVWatts · cost' },
  { label: 'LBNL',           sub: 'spec yield' },
  { label: 'USFWS NWI',      sub: 'wetlands' },
  { label: 'USDA SSURGO',    sub: 'farmland' },
  { label: 'HUD QCT / DDA',  sub: 'IRA bonus' },
  { label: 'FERC',           sub: 'IX queues' },
  { label: 'EPA',            sub: 'brownfields' },
  { label: 'NOAA',           sub: 'climate' },
  { label: 'Census ACS',     sub: 'demographics · LMI' },
  { label: 'ISO / RTO',      sub: 'distribution-DG' },
]

function SourcesMarquee() {
  const doubled = [...DATA_SOURCES, ...DATA_SOURCES]
  return (
    <div className="lp-marquee" style={{ '--marquee-duration': '45s' }}>
      <div className="lp-marquee__track py-2">
        {doubled.map((s, i) => (
          <div key={`${s.label}-${i}`} className="flex items-center gap-3 px-6 lg:px-9 shrink-0">
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
  { id: 'offtake',    title: 'Offtake',         weight: '25%',
    description: 'Where the revenue actually comes from. Program capacity remaining, monetization structure (NM / NB / Community Solar / C&I), and the full export-rate haircut for every active state.',
    sources: ['DSIRE', 'State PUC orders', 'Utility tariff books', 'NEEC export rates'],
    metrics: [['12', 'NB states sourced'], ['CA · AZ · UT · ID · AR · IN · LA · MI · NC · OH · KY · SC', null]] },
  { id: 'ix',         title: 'Interconnection', weight: '25%',
    description: 'The most differentiated layer in the platform. Distribution-DG queue saturation, utility ease scores, average study timelines, and ISA withdrawal rates — built per-state because nobody else has done this cleanly for sub-20MW developers.',
    sources: ['ISO/RTO queues', 'State distribution dockets', 'FERC Form 1', 'Utility IRPs'],
    metrics: [['7', 'States with distribution-DG feeds'], ['NY · NJ · MA · VA · WI · CA · MD', null]] },
  { id: 'incentives', title: 'Incentives',      weight: '20%',
    description: 'The IRA bonus stack. ITC adders, energy-community designation, low-income community premiums, domestic content. Combined with state-level REC / SREC market rates into one revenue ladder.',
    sources: ['IRS § 48 / 48E', 'HUD QCT / DDA', 'Treasury energy-community', 'State REC markets'],
    metrics: [['4', 'IRA bonus zones tracked'], ['Energy community · LIC · Domestic content · QCT / DDA', null]] },
  { id: 'site',       title: 'Site',            weight: '20%',
    description: "What land is actually buildable. USDA prime-farmland classification, USFWS wetlands, county-level land-use restrictions. Know if a site is developable before you spend a dollar on site control.",
    sources: ['USDA SSURGO', 'USFWS NWI', 'EPA brownfields', 'County land use'],
    metrics: [['3,143', 'U.S. counties indexed'], ['Path B — complete', null]] },
  { id: 'policy',     title: 'Policy & Timing', weight: '10%',
    description: "What's about to change. Comment deadlines, rate cases, program rule revisions, queue reform rulings. The signal that catches a developer before the rules shift, not after.",
    sources: ['PUC dockets', 'FERC rulemakings', 'State legislation', 'ISO queue reforms'],
    metrics: [['Weekly', 'Refresh cadence'], ['Surface alerts in-app', null]] },
]

function PillarTabs() {
  return (
    <RadixTabs.Root defaultValue={PILLARS[0].id} className="w-full">
      <RadixTabs.List className="flex flex-wrap gap-2 mb-8">
        {PILLARS.map(p => (
          <RadixTabs.Trigger key={p.id} value={p.id} className="lp-tab-trigger">
            {p.title}
            <span className="text-[11px] font-mono opacity-60">{p.weight}</span>
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
                {p.metrics.map(([val, lbl], i) => (
                  <div key={i}>
                    {lbl
                      ? <>
                          <div className="lp-h2 tabular-nums" style={{ color: '#5EEAD4', textShadow: '0 0 32px rgba(94,234,212,0.25)' }}>{val}</div>
                          <div className="lp-h6 text-white/60 mt-1.5">{lbl}</div>
                        </>
                      : <div className="text-xs font-mono text-white/45 leading-relaxed">{val}</div>}
                  </div>
                ))}
              </div>
            </div>
          </SpotlightCard>
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  )
}

// ── Net Effect card — 120× w/ count-up + bar comparison + sparkle dots ──────
function NetEffectCard() {
  // Trigger reveal + count-up on enter viewport. useCountUp returns its own
  // ref; the same ref controls the bar-fill animation via `.is-revealed`,
  // so we reveal the whole card together by re-using useRevealOnScroll on a
  // wrapper that contains everything.
  const wrapperRef = useRevealOnScroll()
  const [value, counterRef] = useCountUp(120, 1800)

  // Combine refs — useCountUp manages an IntersectionObserver internally,
  // so we attach its ref to the inner number element and useRevealOnScroll
  // separately to the wrapper for the bars + sparkles.
  const sparkles = [
    { top: '12%', left: '18%', delay: '0s'   },
    { top: '24%', left: '74%', delay: '0.6s' },
    { top: '46%', left: '88%', delay: '1.2s' },
    { top: '62%', left: '8%',  delay: '0.4s' },
    { top: '78%', left: '32%', delay: '1.8s' },
    { top: '32%', left: '52%', delay: '2.4s' },
    { top: '8%',  left: '60%', delay: '1.0s' },
    { top: '88%', left: '70%', delay: '2.0s' },
  ]

  return (
    <div
      ref={wrapperRef}
      className="reveal-on-scroll rounded-2xl p-7 relative overflow-hidden h-full flex flex-col"
      style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}
    >
      {/* teal hairline top */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(94,234,212,0.85) 50%, transparent 100%)' }} />

      {/* sparkle layer */}
      <div className="lp-sparkles">
        {sparkles.map((s, i) => (
          <span key={i} className="lp-sparkle" style={{ top: s.top, left: s.left, animationDelay: s.delay }} />
        ))}
      </div>

      {/* content */}
      <span className="eyebrow-mono mb-3" style={{ color: '#5EEAD4' }}>● Net effect</span>

      <div ref={counterRef} className="flex items-baseline gap-1 mb-1">
        <span
          className="tabular-nums text-white"
          style={{
            fontFamily: 'Geist, system-ui, sans-serif',
            fontSize: 'clamp(3rem, 6vw, 4.5rem)',
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            textShadow: '0 0 40px rgba(94,234,212,0.32), 0 1px 24px rgba(0,0,0,0.4)',
          }}
        >
          {value}
        </span>
        <span className="lp-h3 text-white/40">×</span>
      </div>
      <div className="lp-h6 text-white/55 mb-5">faster per county research</div>

      {/* Comparison bars */}
      <div className="mt-auto space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="eyebrow-mono text-white/40">Manual</span>
            <span className="text-xs font-mono text-white/65 tabular-nums">~4 hrs</span>
          </div>
          <span className="lp-cmp-bar" style={{ background: 'linear-gradient(90deg, #B45309 0%, #EA580C 100%)' }} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="eyebrow-mono" style={{ color: '#5EEAD4' }}>Tractova</span>
            <span className="text-xs font-mono tabular-nums" style={{ color: '#5EEAD4' }}>~2 min</span>
          </div>
          {/* Width ratio: 2 min / 240 min ≈ 0.83% → use 1.5% so it's visible. */}
          <span className="lp-cmp-bar block" style={{ background: '#5EEAD4', width: '2.5%' }} />
        </div>
      </div>
    </div>
  )
}

// ── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: 'Who is Tractova actually for?',
    a: "Independent community-solar developers — 1 to 100-person shops — with real projects but no in-house policy, interconnection, or incentive-research staff. If you're a 5-person developer covering 12 states with one analyst, Tractova is the team you can't afford to hire.",
  },
  {
    q: 'How is this different from EnergyAcuity or spreadsheet research?',
    a: 'The big platforms are priced for IPPs with $100k+ data budgets. Spreadsheets get stale the day you save them. Tractova sits in between: live federal + state data refreshed weekly, opinionated scoring for the sub-20MW market, $29.99/mo.',
  },
  {
    q: 'Where does the data come from?',
    a: 'Every score traces back to a .gov source: DSIRE for incentives, EIA for retail rates, NREL for solar resource, USFWS for wetlands, USDA for farmland, HUD for IRA bonus zones, the relevant ISO/RTO for IX queues, and state PUC dockets for program orders.',
  },
  {
    q: 'How often is the data refreshed?',
    a: "Weekly via scheduled jobs. Policy alerts surface as soon as a state portal updates. We don't claim real-time — we claim consistently fresh and consistently honest.",
  },
  {
    q: 'What does the platform cost?',
    a: 'Free dashboard access — see every active CS program in the country, no card required. Pro is $29.99/mo for the full Lens, Library, and policy alerts. 14-day free trial on Pro.',
  },
  {
    q: 'How do I get started?',
    a: "Create a free account. The market dashboard is yours immediately. Run one Lens on a real project of yours — that's the moment you'll know if the time-savings claim is real for your workflow.",
  },
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

// ── reveal helper ────────────────────────────────────────────────────────────
function Reveal({ delay = 0, className = '', children, as: Tag = 'div' }) {
  const ref = useRevealOnScroll()
  const delayCls = delay ? ` reveal-delay-${delay}` : ''
  return <Tag ref={ref} className={`reveal-on-scroll${delayCls} ${className}`}>{children}</Tag>
}

// ── Cursor-grid section wrapper. Tracks the cursor inside the dark section
// and exposes --cursor-x / --cursor-y CSS vars + --grid-spotlight-opacity.
// The .lp-hero-grid--cursor layer masks itself to a circle around those
// coordinates. ─────────────────────────────────────────────────────────────
function CursorGridSection({ children, className = '', style }) {
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
    <section ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
             className={`text-white relative overflow-hidden ${className}`} style={style}>
      {children}
    </section>
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
                <ButtonPrimary to="/signup">Get started free</ButtonPrimary>
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
                <span className="text-xs text-gray-400 hidden sm:inline">Every score traces to a verified .gov source.</span>
              </div>
              <span className="eyebrow-mono text-gray-400">Refreshed weekly</span>
            </div>
          </div>

          <SourcesMarquee />
        </div>
      </section>

      {/* ── 3. Five-pillar tabs + stats counters ───────────────────────── */}
      <section className="text-white relative" style={{ background: '#0A132A' }}>
        <div className="lp-accent-rail" />
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 py-16 lg:py-20">

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

      {/* ── 4. Bento — who-for + how-it-works + 120× ───────────────────── */}
      <section className="bg-paper py-16 lg:py-20 border-b border-gray-200">
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9">

          <div className="text-center mb-10 lg:mb-12">
            <Reveal>
              <Eyebrow>How it works · Who it&apos;s for · What you get back</Eyebrow>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="lp-h2 mt-4 max-w-3xl mx-auto" style={{ color: '#0F1A2E' }}>
                The same county research,<br/>
                in 2 minutes instead of 4 hours.
              </h2>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-3 gap-4 lg:gap-5">

            {/* "Tractova is for" — 2-col, top-left */}
            <Reveal className="md:col-span-2">
              <LightCard className="h-full">
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
              </LightCard>
            </Reveal>

            {/* Net Effect 120× — top-right */}
            <Reveal delay={100}>
              <NetEffectCard />
            </Reveal>

            {/* 3 step cells — middle row */}
            {[
              { step: '01', title: 'Search your project', body: 'State, county, size, stage, technology. Tractova pulls the relevant intelligence for that exact context.' },
              { step: '02', title: 'Read the five-pillar report', body: 'Each pillar scored independently with cited sources. AI brief surfaces the two or three signals that actually matter.' },
              { step: '03', title: 'Track your pipeline', body: 'Save projects to your library. Get alerts when capacity drops, queue status changes, or policy shifts.' },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 100}>
                <LightCard className="h-full">
                  <div className="font-mono text-sm tabular-nums mb-3" style={{ color: '#0F766E' }}>{s.step}</div>
                  <h3 className="lp-h4 mb-2.5" style={{ color: '#0F1A2E' }}>{s.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
                </LightCard>
              </Reveal>
            ))}

            {/* "Not designed for" — bottom-left */}
            <Reveal>
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

            {/* Mid-page CTA — bottom-right, 2-col */}
            <Reveal delay={100} className="md:col-span-2">
              <LightCard className="h-full flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div>
                  <h3 className="lp-h4 mb-1" style={{ color: '#0F1A2E' }}>Try it on one of your projects.</h3>
                  <p className="text-sm text-gray-500">14-day Pro trial. No card required. The first Lens run tells you if this fits your workflow.</p>
                </div>
                <ButtonPrimary to="/signup">Get started free</ButtonPrimary>
              </LightCard>
            </Reveal>

          </div>
        </div>
      </section>

      {/* ── 5. FAQ + sidebar ───────────────────────────────────────────── */}
      <section className="bg-white py-16 lg:py-20">
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 grid lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-16">

          <Reveal>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="lp-h2 mt-3 mb-2" style={{ color: '#0F1A2E' }}>Common questions.</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-lg">
              The questions developers actually ask before signing up. If yours isn&apos;t here, sign up free and message the founder directly.
            </p>
            <FaqAccordion />
          </Reveal>

          <Reveal delay={100} className="lg:sticky lg:top-24 self-start space-y-4">
            <LightCard>
              <Eyebrow>Why now</Eyebrow>
              <h3 className="lp-h4 mt-3 mb-3" style={{ color: '#0F1A2E' }}>The window is open — briefly.</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                IRA bonus tiers are still being claimed. State CS programs are still opening blocks. Queue reform is reshaping which utilities are buildable. <strong className="text-gray-900">The next 24 months are when small developers either gain market share or get crowded out.</strong>
              </p>
            </LightCard>

            <LightCard>
              <Eyebrow>Methodology</Eyebrow>
              <h3 className="lp-h4 mt-3 mb-3" style={{ color: '#0F1A2E' }}>Every score is decomposable.</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">
                Click any state on the dashboard, expand any pillar, and you&apos;ll see the inputs. No black box. No proprietary "AI score" — just sourced data with a transparent weighting.
              </p>
              <Link to="/glossary" className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: '#0F766E' }}>
                Read the glossary →
              </Link>
            </LightCard>
          </Reveal>
        </div>
      </section>

      {/* ── 6. Final CTA — dark, cursor-following grid ─────────────────── */}
      <CursorGridSection style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #050A1A 100%)' }}>
        <div className="lp-accent-rail" />
        <div className="lp-hero-grid" />
        <div className="lp-hero-grid lp-hero-grid--cursor" />
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 py-16 lg:py-20 relative grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16 items-center">

          <Reveal>
            <h2 className="lp-h1 text-white mb-6 lp-text-shadow-glow">
              Start building<br/>smarter.
            </h2>
            <p className="lp-h5 text-white/65 leading-relaxed mb-8 max-w-lg" style={{ fontWeight: 400 }}>
              <strong className="text-white">Free dashboard access</strong> — see every active CS program in the country, no card required. Upgrade to Pro when you&apos;re ready to run real projects through the Lens.
            </p>
            <div className="flex flex-wrap gap-4">
              <ButtonPrimary to="/signup">Create your free account</ButtonPrimary>
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
      </CursorGridSection>

    </div>
  )
}
