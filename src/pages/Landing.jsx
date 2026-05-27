import { useState, useEffect, useCallback, useRef } from 'react'
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

// ── small layout primitives ──────────────────────────────────────────────────
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

// Spotlight card — cursor-tracking gradient. Sets CSS vars --mx, --my on
// the card; the gradient is rendered via the .lp-spotlight ::before in
// index.css. Doesn't require framer-motion or any external dep.
function SpotlightCard({ className = '', children, dark = false }) {
  const ref = useRef(null)
  const onMove = (e) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`)
    el.style.setProperty('--my', `${e.clientY - rect.top}px`)
  }
  const base = dark
    ? 'bg-white/[0.03] border-white/10 hover:border-white/25 text-white'
    : 'bg-white border-gray-200 hover:border-gray-300'
  return (
    <div ref={ref} onMouseMove={onMove}
         className={`lp-spotlight rounded-2xl border p-7 transition-colors ${base} ${className}`}>
      {children}
    </div>
  )
}

function CounterBlock({ target, suffix = '', label, sub, dark = false }) {
  const [value, ref] = useCountUp(target)
  return (
    <div ref={ref} className="reveal-on-scroll">
      <div className={`text-4xl lg:text-5xl font-bold tabular-nums ${dark ? 'text-white' : ''}`}
           style={{ fontFamily: 'Geist, system-ui, sans-serif', letterSpacing: '-0.035em', color: dark ? undefined : '#0F1A2E' }}>
        {value}{suffix && <span className={`text-2xl ${dark ? 'text-white/40' : 'text-gray-400'}`}>{suffix}</span>}
      </div>
      <div className={`text-sm font-semibold mt-1.5 ${dark ? 'text-white/85' : 'text-gray-800'}`}>{label}</div>
      {sub && <div className={`text-xs mt-0.5 ${dark ? 'text-white/40' : 'text-gray-400'}`}>{sub}</div>}
    </div>
  )
}

// ── Data sources for the marquee. Wordmark-only ("logo" lookalikes built
// in JetBrains Mono — clean, brand-appropriate, no licensing concerns). ─────
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
  // Duplicate the list so the -50% translate wraps seamlessly.
  const doubled = [...DATA_SOURCES, ...DATA_SOURCES]
  return (
    <div className="lp-marquee" style={{ '--marquee-duration': '45s' }}>
      <div className="lp-marquee__track py-2">
        {doubled.map((s, i) => (
          <div key={`${s.label}-${i}`} className="flex items-center gap-3 px-6 lg:px-9 shrink-0">
            <span className="font-mono text-base lg:text-lg font-semibold tracking-tight" style={{ color: '#0F1A2E' }}>{s.label}</span>
            <span className="text-[11px] text-gray-400 leading-tight max-w-[7rem]">{s.sub}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300 ml-3" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 5-pillar tabs (Radix). Pill-style triggers, denser than the accordion. ─
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
            <span className="text-[10px] font-mono opacity-60">{p.weight}</span>
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>

      {PILLARS.map(p => (
        <RadixTabs.Content key={p.id} value={p.id} className="outline-hidden">
          <SpotlightCard dark className="!p-8 lg:!p-10">
            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12">
              <div>
                <p className="text-lg lg:text-xl text-white/75 leading-relaxed">{p.description}</p>

                <div className="mt-7">
                  <div className="text-xs font-mono uppercase tracking-[0.18em] text-white/40 mb-3">Data sources</div>
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
                          <div className="font-bold tabular-nums" style={{ fontFamily: 'Geist, system-ui, sans-serif', letterSpacing: '-0.035em', fontSize: 'clamp(2rem, 4vw, 3rem)', color: '#5EEAD4', lineHeight: 1.02 }}>{val}</div>
                          <div className="text-xs text-white/55 mt-1.5">{lbl}</div>
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
              <span className="text-base font-semibold" style={{ color: '#0F1A2E', fontFamily: 'Geist, system-ui, sans-serif', letterSpacing: '-0.02em' }}>{item.q}</span>
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

      {/* ── 1. Hero (dark) — denser, no marketing pill ────────────────────── */}
      <section className="text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}>
        <div className="lp-accent-rail" />
        <div className="lp-hero-grid" />
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 py-14 lg:py-24 relative grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">

          <div>
            <Reveal>
              <h1 className="lp-h1 text-white mb-6">
                The intelligence edge<br />
                small developers{' '}
                <span style={{ color: '#5EEAD4' }}>don't have.</span>
              </h1>
            </Reveal>

            <Reveal delay={100}>
              <p className="text-lg text-white/65 leading-relaxed mb-8 max-w-xl">
                Site, interconnection, incentives, offtake, policy — one platform, five pillars, refreshed weekly. Built for shops competing against teams with dedicated research staff.
              </p>
            </Reveal>

            <Reveal delay={200}>
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

          <Reveal delay={200}>
            <DashboardPreview activeCount={activeCount} metrics={metrics} />
          </Reveal>
        </div>
      </section>

      {/* ── 2. Data sources — infinite-scroll marquee ─────────────────────── */}
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
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400">Refreshed weekly</span>
            </div>
          </div>

          <SourcesMarquee />
        </div>
      </section>

      {/* ── 3. Five-pillar tabs + stats counters — combined dense section ── */}
      <section className="text-white relative" style={{ background: '#0A132A' }}>
        <div className="lp-accent-rail" />
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 py-16 lg:py-24">

          {/* Top: section intro + 4 stat counters on the right */}
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 mb-12 items-end">
            <Reveal>
              <Eyebrow dark>What we cover · The platform, in numbers</Eyebrow>
              <h2 className="lp-h2 mt-4 text-white">
                Five pillars.<br/>
                <span className="text-white/55">Every signal traceable.</span>
              </h2>
              <p className="mt-5 text-base lg:text-lg text-white/65 leading-relaxed max-w-lg">
                Community solar lives or dies on five questions. Tractova scores each one independently — when a state's signal moves, you know which pillar moved it.
              </p>
            </Reveal>

            <Reveal delay={150} className="grid grid-cols-2 gap-8 lg:gap-10">
              <CounterBlock dark target={typeof activeCount === 'number' ? activeCount : 0} label="Active CS Programs" sub="across the U.S." />
              <CounterBlock dark target={typeof metrics?.utilitiesWithIXHeadroom === 'number' ? metrics.utilitiesWithIXHeadroom : 0} suffix="+" label="Utilities w/ IX Headroom" sub="scored on ease" />
              <CounterBlock dark target={statesMapped || 0} label="States Fully Mapped" sub="site · IX · offtake" />
              <CounterBlock dark target={5} label="Intelligence Pillars" sub="every score decomposable" />
            </Reveal>
          </div>

          {/* Pillar tabs */}
          <Reveal delay={200}>
            <PillarTabs />
          </Reveal>
        </div>
      </section>

      {/* ── 4. Bento — who-for + how-it-works + time-saved (3 sections → 1) ─ */}
      <section className="bg-paper py-16 lg:py-24 border-b border-gray-200">
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9">

          <div className="text-center mb-10 lg:mb-14">
            <Reveal>
              <Eyebrow>How it works · Who it's for · What you get back</Eyebrow>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="lp-h2 mt-4 max-w-3xl mx-auto" style={{ color: '#0F1A2E' }}>
                The same county research,<br/>
                in 2 minutes instead of 4 hours.
              </h2>
            </Reveal>
          </div>

          {/* Bento grid — 6 cells, 3-column layout. Top row: built-for (2-wide)
              + 120× callout (1). Middle row: 3 step cells. Bottom row: not-for
              (1) + final CTA pair (2-wide). */}
          <div className="grid md:grid-cols-3 gap-4 lg:gap-5">

            {/* "Tractova is for" — 2-column span, top-left */}
            <Reveal className="md:col-span-2">
              <SpotlightCard className="h-full !bg-white">
                <div className="flex items-center justify-between mb-5">
                  <Eyebrow>Built for who, exactly</Eyebrow>
                  <span className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: '#0F766E' }}>Tractova is for</span>
                </div>
                <h3 className="lp-h3 mb-4" style={{ color: '#0F1A2E' }}>
                  The under-100-person shop. Real projects.<br/>
                  <span className="text-gray-500">No research team.</span>
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-5 max-w-2xl">
                  Large IPPs have entire teams pulling queue data, monitoring program capacity, and flagging policy changes. You don't. <strong className="text-gray-900">Tractova is the team you can't afford to hire.</strong>
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
              </SpotlightCard>
            </Reveal>

            {/* 120× callout — top-right */}
            <Reveal delay={100}>
              <div className="rounded-2xl p-7 flex flex-col justify-center text-center h-full relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}>
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.85) 50%, transparent 100%)' }} />
                <span className="font-mono text-[10px] uppercase tracking-[0.20em] mb-3" style={{ color: '#5EEAD4' }}>Net effect</span>
                <div className="text-6xl lg:text-7xl font-bold tabular-nums text-white" style={{ fontFamily: 'Geist, system-ui, sans-serif', letterSpacing: '-0.045em', lineHeight: 1 }}>
                  120<span className="text-3xl text-white/40">×</span>
                </div>
                <p className="text-xs text-white/55 mt-3 leading-snug">faster per county.<br/>50 counties in the time it took to research one.</p>
              </div>
            </Reveal>

            {/* 3 step cells — middle row */}
            {[
              { step: '01', title: 'Search your project', body: 'State, county, size, stage, technology. Tractova pulls the relevant intelligence for that exact context.' },
              { step: '02', title: 'Read the five-pillar report', body: 'Each pillar scored independently with cited sources. AI brief surfaces the two or three signals that actually matter.' },
              { step: '03', title: 'Track your pipeline', body: 'Save projects to your library. Get alerts when capacity drops, queue status changes, or policy shifts.' },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 100}>
                <SpotlightCard className="h-full !bg-white">
                  <div className="font-mono text-sm tabular-nums mb-3" style={{ color: '#0F766E' }}>{s.step}</div>
                  <h3 className="lp-h5 mb-2.5" style={{ color: '#0F1A2E' }}>{s.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
                </SpotlightCard>
              </Reveal>
            ))}

            {/* "Not designed for" — bottom-left */}
            <Reveal>
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-7 h-full">
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500 mb-4">Not designed for</div>
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

            {/* Mid-page CTA cell — bottom-right, spans 2 cols */}
            <Reveal delay={100} className="md:col-span-2">
              <div className="rounded-2xl border border-gray-200 bg-white p-7 h-full flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div>
                  <h3 className="lp-h5 mb-1" style={{ color: '#0F1A2E' }}>Try it on one of your projects.</h3>
                  <p className="text-sm text-gray-500">14-day Pro trial. No card required. The first Lens run tells you if this fits your workflow.</p>
                </div>
                <ButtonPrimary to="/signup">Get started free</ButtonPrimary>
              </div>
            </Reveal>

          </div>
        </div>
      </section>

      {/* ── 5. FAQ + Adder callout combined — 2-column ────────────────────── */}
      <section className="bg-white py-16 lg:py-24">
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 grid lg:grid-cols-[1.4fr_1fr] gap-12 lg:gap-16">

          <Reveal>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="lp-h2 mt-3 mb-2" style={{ color: '#0F1A2E' }}>Common questions.</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-lg">
              The questions developers actually ask before signing up. If yours isn't here, the form below goes straight to the founder.
            </p>
            <FaqAccordion />
          </Reveal>

          <Reveal delay={100} className="lg:sticky lg:top-24 self-start space-y-4">
            <SpotlightCard className="!bg-paper">
              <Eyebrow>From the same team</Eyebrow>
              <h3 className="lp-h4 mt-3 mb-2" style={{ color: '#0F1A2E' }}>The Adder Newsletter</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-5">
                Bi-weekly newsletter on community-solar policy, IX trends, and market moves for independent developers. Free and opinionated.
              </p>
              <a
                href="https://theadder.substack.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
                style={{ border: '1px solid #14B8A6', color: '#0F766E' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#14B8A6'; e.currentTarget.style.color = '#FFFFFF' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent';  e.currentTarget.style.color = '#0F766E' }}
              >
                Read The Adder ↗
              </a>
            </SpotlightCard>

            <SpotlightCard className="!bg-paper">
              <Eyebrow>Why now</Eyebrow>
              <h3 className="lp-h5 mt-3 mb-3" style={{ color: '#0F1A2E' }}>The window is open — briefly.</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                IRA bonus tiers are still being claimed. State CS programs are still opening blocks. Queue reform is reshaping which utilities are buildable. <strong className="text-gray-900">The next 24 months are when small developers either gain market share or get crowded out.</strong>
              </p>
            </SpotlightCard>
          </Reveal>
        </div>
      </section>

      {/* ── 6. Final CTA (dark) — tightened ───────────────────────────────── */}
      <section className="text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #050A1A 100%)' }}>
        <div className="lp-accent-rail" />
        <div className="lp-hero-grid" />
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 py-16 lg:py-24 relative grid lg:grid-cols-[1.2fr_1fr] gap-10 lg:gap-16 items-center">

          <Reveal>
            <h2 className="lp-h2-big text-white mb-6">
              Start building<br/>smarter.
            </h2>
            <p className="text-lg text-white/65 leading-relaxed mb-8 max-w-lg">
              <strong className="text-white">Free dashboard access</strong> — see every active CS program in the country, no card required. Upgrade to Pro when you're ready to run real projects through the Lens.
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
              <SpotlightCard key={f.title} dark className="!p-5">
                <div className="font-mono text-xs uppercase tracking-[0.18em] mb-3" style={{ color: '#5EEAD4' }}>{f.kpi}</div>
                <h3 className="text-base font-semibold text-white mb-1.5" style={{ fontFamily: 'Geist, system-ui, sans-serif', letterSpacing: '-0.02em' }}>{f.title}</h3>
                <p className="text-xs text-white/55 leading-relaxed">{f.body}</p>
              </SpotlightCard>
            ))}
          </Reveal>
        </div>
      </section>

    </div>
  )
}
