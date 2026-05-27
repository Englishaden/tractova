import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
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

function IconPlusMinus({ open }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-white/15 shrink-0 transition-colors" style={{ background: open ? 'rgba(20,184,166,0.18)' : 'transparent' }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
        {open
          ? <line x1="5" y1="12" x2="19" y2="12"/>
          : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
      </svg>
    </span>
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

// ── hero preview card — simulated dashboard snapshot (preserved from V3) ─────
function DashboardPreview({ activeCount, metrics }) {
  const sampleStates = [
    { id: 'IL', name: 'Illinois',      score: 78, status: 'active'  },
    { id: 'CO', name: 'Colorado',      score: 75, status: 'active'  },
    { id: 'MN', name: 'Minnesota',     score: 72, status: 'active'  },
    { id: 'MD', name: 'Maryland',      score: 70, status: 'active'  },
    { id: 'VA', name: 'Virginia',      score: 67, status: 'active'  },
    { id: 'MA', name: 'Massachusetts', score: 45, status: 'limited' },
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
    <div className="flex items-center gap-2">
      <span className="w-1 h-1 rounded-full" style={{ background: dark ? '#5EEAD4' : '#14B8A6' }} />
      <span className="eyebrow-mono" style={{ color: dark ? '#5EEAD4' : '#0F766E' }}>{children}</span>
      <span className="w-1 h-1 rounded-full" style={{ background: dark ? '#5EEAD4' : '#14B8A6' }} />
    </div>
  )
}

function ButtonPrimary({ to, href, children, className = '' }) {
  const inner = (
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
  )
  if (to) return <Link to={to}>{inner}</Link>
  return <a href={href}>{inner}</a>
}

function CounterBlock({ target, suffix = '', label, sub, delay = 0 }) {
  const [value, ref] = useCountUp(target)
  return (
    <div ref={ref} className={`reveal-on-scroll reveal-delay-${delay}`}>
      <div className="text-5xl lg:text-6xl font-bold tabular-nums" style={{ fontFamily: 'Geist, system-ui, sans-serif', letterSpacing: '-0.035em', color: '#0F1A2E' }}>
        {value}{suffix && <span className="text-3xl text-gray-400">{suffix}</span>}
      </div>
      <div className="text-sm font-semibold text-gray-800 mt-2">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── 5-pillar accordion ───────────────────────────────────────────────────────
const PILLARS = [
  {
    id: 'offtake',
    number: '001',
    title: 'Offtake',
    weight: '25%',
    description: 'Where the revenue actually comes from. Program capacity remaining, monetization structure (Net Metering / Net Billing / Community Solar / C&I), and the full export-rate haircut for every active state. Sourced from DSIRE + state PUC orders.',
    tags: ['Program capacity', 'NM / NB export rates', 'LMI subscriber rules', 'CS / C&I structure'],
  },
  {
    id: 'ix',
    number: '002',
    title: 'Interconnection',
    weight: '25%',
    description: 'The most differentiated layer in the platform. Distribution-DG queue saturation, utility ease scores, average study timelines, and ISA withdrawal rates — built per-state because nobody else has done this cleanly for sub-20MW developers.',
    tags: ['Distribution-DG queues', 'Utility ease score', 'Study timelines', 'Queue saturation'],
  },
  {
    id: 'incentives',
    number: '003',
    title: 'Incentives',
    weight: '20%',
    description: 'The IRA bonus stack. ITC adders, energy community designation, low-income community premiums, domestic content. Combined with state-level REC / SREC market rates into one revenue ladder.',
    tags: ['IRA ITC adders', 'Energy community', 'LIC bonus', 'REC / SREC rates'],
  },
  {
    id: 'site',
    number: '004',
    title: 'Site',
    weight: '20%',
    description: 'What land is actually buildable. USDA prime-farmland classification, USFWS wetlands, county-level land-use restrictions. Know if a site is developable before you spend a dollar on site control.',
    tags: ['USDA farmland', 'USFWS wetlands', 'Brownfields / landfills', 'County land use'],
  },
  {
    id: 'policy',
    number: '005',
    title: 'Policy & Timing',
    weight: '10%',
    description: "What's about to change. Comment deadlines, rate cases, program rule revisions, queue reform rulings. The signal that catches a developer before the rules shift, not after.",
    tags: ['Comment windows', 'Rate cases', 'Program revisions', 'Queue reform'],
  },
]

function PillarAccordion() {
  const [openIdx, setOpenIdx] = useState(0)
  return (
    <div className="border-t border-white/10">
      {PILLARS.map((p, i) => {
        const isOpen = openIdx === i
        return (
          <div key={p.id} className={`lp-accordion-row border-b border-white/10 ${isOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? -1 : i)}
              className="w-full text-left py-7 grid grid-cols-[6rem_1fr_auto] items-center gap-6 group"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-mono text-white/40 tabular-nums">{p.number}</span>
              <h4 className="lp-h4 text-white">{p.title}</h4>
              <IconPlusMinus open={isOpen} />
            </button>
            <div className="lp-accordion-body">
              <div className="lp-accordion-inner pl-[6rem] pr-12 pb-8">
                <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-start">
                  <p className="text-base lg:text-lg text-white/65 leading-relaxed max-w-xl">{p.description}</p>
                  <div className="lg:text-right">
                    <div className="text-xs font-mono uppercase tracking-[0.18em] text-white/40 mb-2">Signal weight</div>
                    <div className="lp-h3 text-white" style={{ color: '#5EEAD4' }}>{p.weight}</div>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="text-xs font-mono uppercase tracking-[0.18em] text-white/40 mr-2 self-center">Data sources</span>
                  {p.tags.map(t => (
                    <span key={t} className="text-xs px-3 py-1.5 rounded-full text-white/70 border border-white/15 bg-white/[0.03]">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: 'Who is Tractova actually for?',
    a: "Independent community-solar developers — typically 1 to 100-person shops — who have real projects but no in-house policy, interconnection, or incentive-research staff. If you're a 5-person developer trying to cover 12 states with one analyst, Tractova is the team you can't afford to hire.",
  },
  {
    q: 'How is this different from spreadsheet research or PowerLot / EnergyAcuity?',
    a: "The big platforms are priced for IPPs with $100k+ data budgets. Spreadsheets get stale the day you save them. Tractova sits in between: live federal + state data refreshed weekly, opinionated scoring for the sub-20MW distribution-DG market, $29.99/mo. Built specifically for the developer who is simultaneously in site control, queue applications, and a program-window race.",
  },
  {
    q: 'Where does the data come from?',
    a: 'Every score traces back to a .gov source: DSIRE for incentives, EIA for retail rates, NREL for solar resource, USFWS for wetlands, USDA for farmland, HUD for IRA bonus zones, the relevant ISO/RTO for IX queues, and state PUC dockets for program orders. We do not fabricate. We do not extrapolate without disclosure.',
  },
  {
    q: 'How often is the data refreshed?',
    a: "Weekly via scheduled jobs. Policy alerts surface as soon as a state portal updates. We don't claim real-time — we claim consistently fresh and consistently honest.",
  },
  {
    q: 'What does the platform cost?',
    a: 'Free dashboard access — see every active CS program in the country, no card required. Pro is $29.99/mo for the full Lens (per-project intelligence runs), Library (project pipeline tracking), and policy alerts. 14-day free trial on Pro.',
  },
  {
    q: 'How do I get started?',
    a: "Create a free account. You get the market dashboard immediately. Run one Lens on a real project of yours — that's the moment you'll know if the time-savings claim is real for your workflow.",
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
              className="w-full text-left py-5 flex items-center justify-between gap-6"
              aria-expanded={isOpen}
            >
              <span className="text-base lg:text-lg font-semibold" style={{ color: '#0F1A2E', fontFamily: 'Geist, system-ui, sans-serif', letterSpacing: '-0.02em' }}>{item.q}</span>
              <IconFaqPlusMinus open={isOpen} />
            </button>
            <div className="lp-accordion-body">
              <div className="lp-accordion-inner pb-6 pr-12">
                <p className="text-sm lg:text-base text-gray-600 leading-relaxed max-w-2xl">{item.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── reveal helper component ──────────────────────────────────────────────────
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

      {/* ── 1. Hero (dark) ─────────────────────────────────────────────── */}
      <section className="text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}>
        <div className="lp-accent-rail" />
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 py-20 lg:py-32 grid lg:grid-cols-2 gap-16 items-center">

          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-8" style={{ background: 'rgba(20,184,166,0.10)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(20,184,166,0.25)' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#14B8A6' }} />
                Community Solar Market Intelligence · v1.0
              </div>
            </Reveal>

            <Reveal delay={100}>
              <h1 className="lp-h1 text-white mb-7">
                The intelligence edge<br />
                most small developers{' '}
                <span style={{ color: '#5EEAD4' }}>don't have.</span>
              </h1>
            </Reveal>

            <Reveal delay={200}>
              <p className="text-lg lg:text-xl text-white/65 leading-relaxed mb-9 max-w-xl">
                Site control constraints, interconnection queue status, incentive stack, and offtake program capacity — one platform, five pillars, refreshed weekly. Built for shops competing against teams with dedicated research staff.
              </p>
            </Reveal>

            <Reveal delay={300}>
              <div className="flex flex-wrap items-center gap-5 mb-10">
                <ButtonPrimary to="/signup">Get started free</ButtonPrimary>
                <Link to="/preview" className="text-sm font-medium text-white/65 hover:text-white transition-colors">
                  Preview live data →
                </Link>
              </div>
              <span className="text-xs font-mono text-white/30">Pro $29.99/mo · 14-day free trial · no card required</span>
            </Reveal>

            <Reveal delay={400}>
              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/50">
                {['Free dashboard', 'No credit card', 'Live federal data'].map(t => (
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

      {/* ── 2. Data sources strip — Nixtio "Our Clients" pattern ────────── */}
      <section className="bg-white border-b border-gray-200 py-14 lg:py-20">
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9">
          {fetchError && (
            <div className="mb-6">
              <ApiErrorBanner
                message={fetchError.message}
                detail={fetchError.detail}
                onRetry={() => loadHero(true)}
                retrying={retrying}
              />
            </div>
          )}
          <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-4">
            <Reveal className="lg:w-[17.4rem] shrink-0">
              <h3 className="text-base font-medium" style={{ color: '#0F1A2E', fontFamily: 'Geist, system-ui, sans-serif', letterSpacing: '-0.025em' }}>
                Our data sources
              </h3>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed max-w-[16rem]">
                Every score traces to a verified .gov source. No black-box, no scraped consultant decks.
              </p>
            </Reveal>
            <Reveal delay={100} className="flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-6">
                {[
                  { label: 'DSIRE',         sub: 'incentives · NM / NB' },
                  { label: 'EIA',           sub: 'retail rates · capacity' },
                  { label: 'NREL',          sub: 'PVWatts · cost index' },
                  { label: 'LBNL',          sub: 'spec yield · IX studies' },
                  { label: 'USFWS NWI',     sub: 'wetlands' },
                  { label: 'USDA SSURGO',   sub: 'prime farmland' },
                  { label: 'HUD QCT / DDA', sub: 'IRA bonus zones' },
                  { label: 'ISO / RTO',     sub: 'distribution-DG queues' },
                ].map(s => (
                  <div key={s.label}>
                    <div className="font-mono text-sm font-semibold tabular-nums" style={{ color: '#0F1A2E' }}>{s.label}</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 3. Platform stats counters ──────────────────────────────────── */}
      <section className="bg-paper border-b border-gray-200 py-20 lg:py-28">
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9">
          <div className="flex flex-col lg:flex-row lg:items-end gap-10 mb-14">
            <Reveal className="lg:w-[17.4rem] shrink-0">
              <Eyebrow>The platform, in numbers</Eyebrow>
              <h2 className="lp-h3 mt-4" style={{ color: '#0F1A2E' }}>What's live<br/>right now</h2>
            </Reveal>
            <Reveal delay={100} className="max-w-xl">
              <p className="text-lg text-gray-600 leading-relaxed">
                Not a roadmap. Not a pitch deck. These are the platform's current footprint — every count refreshes on the dashboard the moment a new state ships.
              </p>
            </Reveal>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            <CounterBlock target={typeof activeCount === 'number' ? activeCount : 0} suffix="" label="Active CS Programs" sub="across the United States" />
            <CounterBlock target={typeof metrics?.utilitiesWithIXHeadroom === 'number' ? metrics.utilitiesWithIXHeadroom : 0} suffix="+" label="Utilities with IX Headroom" sub="scored on the ease index" delay={100} />
            <CounterBlock target={statesMapped || 0} suffix="" label="States Fully Mapped" sub="site · IX · offtake · incentives" delay={200} />
            <CounterBlock target={5} suffix="" label="Intelligence Pillars" sub="every score is decomposable" delay={300} />
          </div>
        </div>
      </section>

      {/* ── 4. Five-pillar accordion (dark) — services-style Nixtio pattern */}
      <section className="text-white relative" style={{ background: '#0A132A' }}>
        <div className="lp-accent-rail" />
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 py-20 lg:py-32">
          <div className="flex flex-col lg:flex-row lg:items-end gap-10 mb-14">
            <Reveal className="lg:w-[17.4rem] shrink-0">
              <Eyebrow dark>What we cover</Eyebrow>
              <h2 className="lp-h2 mt-4 text-white">
                Five pillars.<br/>
                <span className="text-white/60">Every signal traceable.</span>
              </h2>
            </Reveal>
            <Reveal delay={100} className="max-w-xl">
              <p className="text-lg text-white/65 leading-relaxed">
                Community solar lives or dies on five questions. Tractova scores each one independently — so when a state's signal moves, you know which pillar moved it.
              </p>
            </Reveal>
          </div>

          <Reveal delay={150}>
            <PillarAccordion />
          </Reveal>

          <Reveal delay={200} className="mt-10">
            <span className="text-xs font-mono text-white/40">Total composite signal: 100% · individual weights set by the 2026-05-25 5-pillar audit</span>
          </Reveal>
        </div>
      </section>

      {/* ── 5. Time-saved comparison ────────────────────────────────────── */}
      <section className="bg-paper border-b border-gray-200 py-20 lg:py-28">
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9">
          <div className="text-center mb-14">
            <Reveal>
              <Eyebrow>Why developers switch</Eyebrow>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="lp-h2 mt-4 max-w-3xl mx-auto" style={{ color: '#0F1A2E' }}>
                The same county research — in 2 minutes<br/>
                instead of 4 hours.
              </h2>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
            <Reveal className="rounded-xl border border-gray-200 bg-white p-6 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold text-gray-400">Manual research</span>
                <span className="text-gray-300">/</span>
                <span className="text-[10px] text-gray-400">per county</span>
              </div>
              <div className="text-4xl font-bold font-mono tabular-nums mb-1" style={{ color: '#0F1A2E' }}>~4 hrs</div>
              <ul className="text-[11px] text-gray-500 space-y-1.5 mt-3 flex-1">
                <li>• State CS program portal navigation (15 min)</li>
                <li>• ISO/RTO queue check + utility filings (90 min)</li>
                <li>• Census ACS pull for LMI, parcel research (45 min)</li>
                <li>• NWI wetland mapping (30 min)</li>
                <li>• Stitch into a one-pager (45 min)</li>
              </ul>
            </Reveal>

            <Reveal delay={100} className="rounded-xl p-6 flex flex-col relative overflow-hidden" >
              <div className="absolute inset-0 -z-10" style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)', border: '1px solid rgba(20,184,166,0.30)', borderRadius: '0.75rem' }} />
              <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.85) 50%, transparent 100%)' }} />
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold" style={{ color: '#5EEAD4' }}>Tractova Lens</span>
                <span style={{ color: 'rgba(94,234,212,0.4)' }}>/</span>
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.55)' }}>per county</span>
              </div>
              <div className="text-4xl font-bold font-mono tabular-nums mb-1 text-white">~2 min</div>
              <ul className="text-[11px] space-y-1.5 mt-3 flex-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <li className="flex items-start gap-1.5"><span style={{ color: '#5EEAD4' }}>✓</span> Pre-fetched program + IX + LMI + wetland data</li>
                <li className="flex items-start gap-1.5"><span style={{ color: '#5EEAD4' }}>✓</span> Live ISO queue signal where available</li>
                <li className="flex items-start gap-1.5"><span style={{ color: '#5EEAD4' }}>✓</span> AI brief with recommended next actions</li>
                <li className="flex items-start gap-1.5"><span style={{ color: '#5EEAD4' }}>✓</span> Saves directly to your project pipeline</li>
              </ul>
            </Reveal>

            <Reveal delay={200} className="rounded-xl border border-gray-200 bg-white p-6 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-[9px] uppercase tracking-[0.20em] font-semibold mb-3" style={{ color: '#0F766E' }}>Net effect</span>
              <div className="text-6xl font-bold tabular-nums" style={{ fontFamily: 'Geist, system-ui, sans-serif', letterSpacing: '-0.04em', color: '#0F1A2E' }}>
                120<span className="text-3xl text-gray-400">×</span>
              </div>
              <p className="text-xs text-gray-500 mt-3 leading-snug">faster per county.<br/>Run 50 counties in the time it took to research one.</p>
            </Reveal>
          </div>

          <Reveal delay={250} className="mt-10 text-center">
            <p className="text-xs text-gray-400 max-w-xl mx-auto">
              One analyst on Tractova covers the same research surface area as a small team. For a 5-person shop, that's the labor cost of one FTE returned.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 6. Who it's for (Nexamp/Ameresco mention removed) ───────────── */}
      <section className="bg-white py-20 lg:py-28 border-b border-gray-100">
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 grid lg:grid-cols-2 gap-16 items-center">

          <Reveal>
            <Eyebrow>Built for who, exactly</Eyebrow>
            <h2 className="lp-h2 mt-4 mb-6" style={{ color: '#0F1A2E' }}>
              The under-100-person shop.<br />
              <span className="text-gray-500">Real projects. No research team.</span>
            </h2>
            <p className="text-gray-600 leading-relaxed mb-5 text-base lg:text-lg">
              Large IPPs have entire teams pulling interconnection queue data, monitoring state program capacity, and flagging policy changes. You don't. <strong className="text-gray-900">Tractova is the team you can't afford to hire.</strong>
            </p>
            <p className="text-gray-600 leading-relaxed mb-8 text-base">
              Built for developers who are simultaneously in site-control negotiations, navigating a MISO interconnection application, and watching an ILSFA block fill — all without dedicated policy or finance staff.
            </p>
            <ButtonPrimary to="/signup">Create a free account</ButtonPrimary>
          </Reveal>

          <Reveal delay={150} className="space-y-4">
            <div className="rounded-xl border p-7" style={{ background: 'rgba(20,184,166,0.04)', borderColor: 'rgba(20,184,166,0.2)' }}>
              <div className="text-xs font-semibold uppercase tracking-[0.15em] mb-4" style={{ color: '#0F766E' }}>Tractova is for</div>
              <ul className="space-y-3">
                {[
                  'Independent and mid-sized solar developers (under 100 people)',
                  'C&I solar developers expanding into community solar',
                  'Project finance professionals evaluating new state markets',
                  'Developers tracking multiple projects across states',
                ].map(t => (
                  <li key={t} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="mt-0.5 shrink-0" style={{ color: '#0F766E' }}><IconCheck /></span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-200 p-7">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500 mb-4">Not designed for</div>
              <ul className="space-y-3">
                {[
                  'Large IPPs with in-house intelligence teams',
                  'Utility-scale developers (>50MW projects)',
                  'Residential solar installers',
                  'EPC or procurement teams',
                ].map(t => (
                  <li key={t} className="flex items-start gap-3 text-sm text-gray-500">
                    <span className="mt-0.5 shrink-0 text-gray-300">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
      </section>

      {/* ── 7. How it works ─────────────────────────────────────────────── */}
      <section className="bg-paper py-20 lg:py-28 border-b border-gray-100">
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9">
          <div className="flex flex-col lg:flex-row lg:items-end gap-10 mb-14">
            <Reveal className="lg:w-[17.4rem] shrink-0">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="lp-h2 mt-4" style={{ color: '#0F1A2E' }}>From address<br/>to intelligence<br/>in two minutes.</h2>
            </Reveal>
            <Reveal delay={100} className="max-w-xl">
              <p className="text-lg text-gray-600 leading-relaxed">
                No setup. No connectors. Type a state + county, get a five-pillar signal report. Save the ones worth tracking.
              </p>
            </Reveal>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 lg:gap-10">
            {[
              { step: '01', title: 'Search your project', body: 'Enter state, county, project size, development stage, and technology type. Tractova Lens pulls the relevant intelligence for that exact context — not a one-size dashboard.' },
              { step: '02', title: 'Read the five-pillar report', body: 'Offtake, IX, Incentives, Site, Policy — each scored independently with the underlying data sources cited inline. AI brief surfaces the two or three signals that actually matter for this project.' },
              { step: '03', title: 'Track your pipeline', body: "Save projects to your library. Get alerts when program capacity drops, queue status changes, or policy shifts in your project's state. Catch what changed; you don't have to watch it." },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 100} className="rounded-xl border border-gray-200 bg-white p-7">
                <div className="font-mono text-sm tabular-nums mb-5" style={{ color: '#0F766E' }}>{s.step}</div>
                <h3 className="lp-h5 mb-3" style={{ color: '#0F1A2E' }}>{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. FAQ ──────────────────────────────────────────────────────── */}
      <section className="bg-white py-20 lg:py-28">
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9">
          <div className="grid lg:grid-cols-[24rem_1fr] gap-12 lg:gap-20">
            <Reveal>
              <h2 className="lp-h2-big" style={{ color: '#0F1A2E' }}>FAQ</h2>
              <p className="text-base lg:text-lg text-gray-500 mt-6 max-w-[24rem] leading-relaxed">
                The questions developers actually ask before signing up. If yours isn't here, the contact form below goes straight to the founder.
              </p>
            </Reveal>
            <Reveal delay={100}>
              <FaqAccordion />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 9. The Adder callout ────────────────────────────────────────── */}
      <section className="bg-paper border-y border-gray-200 py-14 lg:py-16">
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <Reveal>
            <Eyebrow>From the same team</Eyebrow>
            <h3 className="lp-h3 mt-3 mb-2" style={{ color: '#0F1A2E' }}>The Adder Newsletter</h3>
            <p className="text-sm text-gray-500 max-w-lg leading-relaxed">
              A bi-weekly newsletter covering community solar policy, interconnection trends, and market moves for independent developers. Free and opinionated.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <a
              href="https://theadder.substack.com"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-lg transition-colors"
              style={{ border: '1px solid #14B8A6', color: '#0F766E' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#14B8A6'; e.currentTarget.style.color = '#FFFFFF' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent';  e.currentTarget.style.color = '#0F766E' }}
            >
              Read The Adder ↗
            </a>
          </Reveal>
        </div>
      </section>

      {/* ── 10. Footer CTA (dark) ──────────────────────────────────────── */}
      <section className="text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #050A1A 100%)' }}>
        <div className="lp-accent-rail" />
        <div className="max-w-[75.5rem] mx-auto px-6 lg:px-9 py-20 lg:py-32">

          <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 mb-16">
            <Reveal>
              <h2 className="lp-h2-big text-white mb-8">
                Start<br/>building<br/>smarter.
              </h2>
              <p className="text-lg lg:text-xl text-white/65 leading-relaxed mb-10 max-w-lg">
                <strong className="text-white">Free dashboard access</strong> — see every active CS program in the country, no card required. Upgrade to Pro when you're ready to run real projects through the Lens.
              </p>

              <div className="h-px w-full mb-10" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.18) 0%, transparent 100%)' }} />

              <div className="grid sm:grid-cols-2 gap-8">
                {[
                  { title: 'Free to start', body: 'Dashboard + 50-state coverage out of the box. No credit card.', icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9"/><polyline points="9 12 11 14 15 10"/>
                    </svg>
                  ) },
                  { title: 'Live data', body: 'Federal + state sources refreshed weekly via scheduled jobs.', icon: (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9"/><polyline points="3 4 3 10 9 10"/>
                    </svg>
                  ) },
                ].map(f => (
                  <div key={f.title}>
                    <div className="mb-3" style={{ color: '#5EEAD4' }}>{f.icon}</div>
                    <h3 className="lp-h5 text-white mb-2">{f.title}</h3>
                    <p className="text-sm text-white/55 leading-relaxed">{f.body}</p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="rounded-2xl border p-8 lg:p-10" style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.1)' }}>
                <h3 className="lp-h3 text-white mb-2">Have a question <span className="text-white/40">in mind?</span></h3>
                <p className="text-sm text-white/55 mb-8">The contact form goes straight to the founder. Replies within one business day.</p>

                <div className="space-y-5">
                  <ButtonPrimary to="/signup" className="w-full justify-center">Create your free account</ButtonPrimary>

                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span className="flex-1 h-px bg-white/10" />
                    <span>or</span>
                    <span className="flex-1 h-px bg-white/10" />
                  </div>

                  <Link to="/preview" className="block w-full text-center px-6 py-3 rounded-lg text-sm font-semibold border transition-colors text-white/85 hover:text-white" style={{ borderColor: 'rgba(255,255,255,0.18)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}>
                    Preview live data →
                  </Link>

                  <p className="text-xs text-center text-white/40 pt-2">
                    Existing user? <Link to="/signin" className="underline hover:text-white">Sign in</Link>
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

    </div>
  )
}
