import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'

// About Tractova — "Surveyor's Field Notes" walkthrough.
//
// The page is structured as a survey baseline with five numbered stations.
// Click (or auto-advance) walks the visitor between stations; each station
// reveals a dark navy card with a hand-drawn technical-drawing illustration
// on the right — groma, triangulation, coverage map, field notebook.
//
// Brand tokens: canonical teal #0F766E + accent #14B8A6 only — no
// bg-primary/text-primary utilities (the --color-primary CSS token is the
// legacy #0f6e56 ramp; see docs/audit-findings-2026-05-19.md). Honors
// useReducedMotion: auto-advance and path-draw animations disable in that
// mode but the content remains fully usable.
//
// Background described by function only — no current or prior employer is
// named here. Any narrow data-citation disclosure stays in the Privacy Policy.

const TEAL = '#0F766E'
const TEAL_BRIGHT = '#14B8A6'
const TEAL_GLOW = '#2DD4BF'
const TEAL_LIGHT = '#5EEAD4'
const NAVY = '#0F1A2E'
const NAVY_GRADIENT = 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)'
const TEAL_RAIL =
  'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.6) 30%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.6) 70%, transparent 100%)'

const AUTO_ADVANCE_MS = 9000

// ─── Station data ────────────────────────────────────────────────────────────
// Single source of truth for both the desktop walkthrough and the mobile
// stacked layout. Each station owns: its position on the baseline (01..05),
// short label, headline, body paragraphs, and the SVG component to render.

const STATIONS = [
  {
    n: '01',
    label: 'The gap',
    headline: 'Small developers get the short end of the stick.',
    body: [
      'Two and a half years in renewable-energy project finance — underwriting utility-scale solar and storage portfolios, sale-leasebacks, construction debt, and tax-equity structures — makes one pattern impossible to miss: almost nothing in this industry gets done without a stack of expensive opinions.',
      'Legal fees. Independent-engineer costs to underwrite the design so a bank can underwrite its own opinion of that design. Financing costs layered on top. Each one shaves the return — and that\'s after you\'ve spent years building relationships in banking and tax equity that make the deal possible at all.',
      'Large, vertically integrated developers absorb that. Small developers don\'t. They\'re asked to spend tens to hundreds of thousands of dollars on early development — site control, leases, interconnection applications, permitting — just to find out whether a project was ever viable.',
    ],
    illustration: 'gap',
  },
  {
    n: '02',
    label: 'The name',
    headline: 'From tractus — a stretch of land.',
    body: [
      'Tractova comes from the Latin tractus — a tract, a stretch of land — and the Roman practice of staking out land parcels for survey. It\'s also a quiet play on words: a place to track your projects.',
      'A Roman surveyor staked out those parcels with a groma — an upright staff with a sighting cross, used to lay straight lines and true right angles before a single stone was placed. Tractova\'s mark keeps the idea: measure the ground first.',
    ],
    illustration: 'groma',
  },
  {
    n: '03',
    label: 'The method',
    headline: 'One decision. Three pillars.',
    body: [
      'Every early-stage call comes down to the same question — is this a go or a no-go? — and in community solar, the answer rests on three things.',
      'Offtake — the revenue structure, usually a function of state policy. Interconnection — whether the grid can take the project. Site control — whether the land is buildable. Get those three wrong and no amount of later diligence saves the project.',
      'Tractova triangulates the three first, before the expensive part begins.',
    ],
    illustration: 'triangulation',
  },
  {
    n: '04',
    label: 'The limits',
    headline: 'Eighty percent. Never the last twenty.',
    body: [
      'No screening tool can tell you a project is financeable, and Tractova doesn\'t pretend to. What it does is cover roughly the eighty percent of early-stage diligence that\'s knowable from public data — the federal, state, and ISO/RTO record.',
      'The last twenty percent — title work, environmental studies, a real interconnection application, legal review — still belongs to the specialists. Tractova\'s job is to tell you whether it\'s worth paying them.',
      'And it\'s honest about its own data. Where a state\'s sample is thin, or its incentive design leaves no paper trail, Tractova labels the estimate as an estimate. Screening decisions deserve numbers you can audit.',
    ],
    illustration: 'coverage',
  },
  {
    n: '05',
    label: 'The operator',
    headline: 'One person. Building something worth owning.',
    body: [
      'Tractova is built and run by Aden Walker — a renewable-energy project finance analyst, based in Boston. The years spent underwriting utility-scale solar and storage deals are where the gap that Tractova fills first became obvious.',
      'It\'s deliberately independent. Tractova isn\'t venture-backed and isn\'t chasing an exit. It\'s built by one person who wants to own something — and who will put in the hours, because the ethics of smaller-scale renewable development are worth the work.',
      'Tractova starts with U.S. community solar. The ambition, over time, is wider: emerging markets, energy access, and the early-stage decisions that decide whether projects there ever break ground.',
    ],
    illustration: 'notebook',
  },
]

// ─── Main page ───────────────────────────────────────────────────────────────

export default function About() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [autoPlay, setAutoPlay] = useState(true)
  const reduce = useReducedMotion()

  // Manual interaction (clicking a station node or the Next button) takes
  // over: auto-advance stops for the rest of the visit so the walkthrough
  // never shifts out from under the user's control.
  const goTo = (i) => { setAutoPlay(false); setActive(i) }
  const advance = () => { setAutoPlay(false); setActive((i) => (i + 1) % STATIONS.length) }

  // Auto-advance until the first manual interaction (and never under
  // reduced-motion or while hovering the card). Pause-on-hover matches
  // Palantir's homepage carousel and avoids ripping content out mid-read.
  useEffect(() => {
    if (reduce || paused || !autoPlay) return
    const id = setInterval(() => {
      setActive((i) => (i + 1) % STATIONS.length)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(id)
  }, [reduce, paused, autoPlay])

  return (
    <div className="pt-14">

      {/* ── Hero — compact survey title page ────────────────────────────── */}
      <section className="text-white relative" style={{ background: NAVY_GRADIENT }}>
        <div className="absolute top-0 left-0 right-0 h-px z-10" style={{ background: TEAL_RAIL }} />
        <div className="max-w-dashboard mx-auto px-6 py-16 lg:py-20">
          <div className="max-w-3xl">
            <p
              className="font-mono text-[10px] uppercase tracking-[0.32em] font-bold mb-5"
              style={{ color: TEAL_LIGHT }}
            >
              ◆ About Tractova · Field notes
            </p>
            <h1
              className="text-4xl lg:text-5xl font-serif font-semibold leading-[1.1] tracking-tight mb-6"
              style={{ letterSpacing: '-0.02em' }}
            >
              The intelligence big developers take for granted.{' '}
              <span style={{ color: TEAL_GLOW }}>Built for the shops that can&apos;t afford it.</span>
            </h1>
            <p className="text-base lg:text-lg text-white/70 leading-relaxed max-w-2xl">
              Five stations along a survey baseline: why Tractova exists, where the
              name comes from, how it works, what it won&apos;t claim, and who runs it.
              Walk them in order, or jump around.
            </p>
          </div>
        </div>
      </section>

      {/* ── Walkthrough — desktop (baseline + station card) ─────────────── */}
      <section className="bg-paper border-b border-gray-200">
        <div className="max-w-dashboard mx-auto px-6 pt-16 pb-20">

          {/* Desktop: the survey baseline with five station nodes. */}
          <div className="hidden lg:block">
            <BaselineNav active={active} onPick={goTo} />
            <StationCard
              station={STATIONS[active]}
              activeIndex={active}
              onHoverChange={setPaused}
              onAdvance={advance}
              reduce={reduce}
            />
          </div>

          {/* Mobile: stations stack vertically, each its own self-contained
              card. Auto-advance is disabled implicitly because the desktop
              <StationCard> isn't mounted. */}
          <div className="lg:hidden space-y-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] font-bold mb-2" style={{ color: TEAL }}>
              ◆ Stations 01 → 05
            </p>
            {STATIONS.map((s) => (
              <MobileStation key={s.n} station={s} />
            ))}
          </div>

        </div>
      </section>

      {/* ── Field notes — The Adder ──────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-200 py-14">
        <div className="max-w-dashboard mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div>
            <div
              className="text-xs font-mono font-semibold uppercase tracking-[0.24em] mb-2"
              style={{ color: TEAL }}
            >
              ◆ From the same desk
            </div>
            <h3
              className="text-xl lg:text-2xl font-serif font-semibold text-ink mb-2"
              style={{ letterSpacing: '-0.02em' }}
            >
              The Adder Newsletter
            </h3>
            <p className="text-sm text-gray-500 max-w-lg leading-relaxed">
              Notes on community solar policy and the market forces that move it — built
              so developers can stay ahead of the regulation that decides their projects.
              Free, and opinionated.
            </p>
          </div>
          <a
            href="https://theadder.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors"
            style={{ border: `1px solid ${TEAL_BRIGHT}`, color: TEAL }}
            onMouseEnter={(e) => { e.currentTarget.style.background = TEAL_BRIGHT; e.currentTarget.style.color = '#FFFFFF' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = TEAL }}
          >
            Read The Adder ↗
          </a>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="text-white py-20 relative" style={{ background: NAVY_GRADIENT }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: TEAL_RAIL }} />
        <div className="max-w-dashboard mx-auto px-6 text-center">
          <h2 className="text-3xl lg:text-4xl font-serif font-semibold mb-4" style={{ letterSpacing: '-0.02em' }}>
            See it before you commit a dollar.
          </h2>
          <p className="text-white/60 text-lg mb-8 max-w-md mx-auto">
            Free access to the market dashboard. No credit card required.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/signup"
              className="px-8 py-3 text-white font-semibold rounded-lg transition-colors"
              style={{ background: TEAL_BRIGHT, boxShadow: '0 8px 24px rgba(20,184,166,0.25)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = TEAL }}
              onMouseLeave={(e) => { e.currentTarget.style.background = TEAL_BRIGHT }}
            >
              Create Free Account
            </Link>
            <Link
              to="/preview"
              className="px-8 py-3 border border-white/20 hover:border-white/40 text-white/70 hover:text-white font-semibold rounded-lg transition-colors"
            >
              Preview the platform →
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}

// ─── Baseline nav (desktop) ──────────────────────────────────────────────────
// The horizontal teal line spanning the section is the "survey baseline."
// Five circular numbered nodes sit on it, evenly spaced. The active node
// fills with teal; inactive nodes are outlined. A subtle "you are here"
// downward chevron uses layoutId to slide between active nodes.

function BaselineNav({ active, onPick }) {
  return (
    <div className="relative mb-10">

      {/* Section eyebrow */}
      <div className="flex items-center justify-between mb-7">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.24em] font-bold"
          style={{ color: TEAL }}
        >
          ◆ Survey baseline
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.20em] text-gray-400">
          Station {STATIONS[active].n} / {STATIONS[STATIONS.length - 1].n}
        </p>
      </div>

      {/* The baseline itself + station nodes. Positioned via CSS grid so the
          tick spacing is identical regardless of label length. */}
      <div className="relative">

        {/* Horizontal teal baseline. inset-x-[6%] keeps the line from
            running past the outermost nodes — surveyor's lines don't
            extend beyond their markers. */}
        <div
          className="absolute left-[6%] right-[6%] top-[18px] h-px"
          style={{
            background: `linear-gradient(90deg, ${TEAL} 0%, ${TEAL_BRIGHT} 50%, ${TEAL} 100%)`,
          }}
        />
        {/* Decorative end-caps: tiny vertical strokes at each end of the
            baseline, like the rangepoles on a survey line. */}
        <div className="absolute left-[6%] top-[12px] w-px h-[13px]" style={{ background: TEAL }} />
        <div className="absolute right-[6%] top-[12px] w-px h-[13px]" style={{ background: TEAL }} />

        {/* The five station nodes */}
        <div className="grid grid-cols-5 gap-2">
          {STATIONS.map((s, i) => (
            <StationNode
              key={s.n}
              station={s}
              isActive={i === active}
              onPick={() => onPick(i)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function StationNode({ station, isActive, onPick }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="group flex flex-col items-center focus-visible:outline-none"
      aria-label={`Station ${station.n}: ${station.label}`}
      aria-current={isActive ? 'step' : undefined}
    >
      {/* The node circle. Active = filled navy with teal border + small
          teal core; inactive = white background with teal border. */}
      <div className="relative flex items-center justify-center" style={{ width: 36, height: 36 }}>
        {/* Active-state pulse halo */}
        {isActive && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 rounded-full"
            style={{ background: 'rgba(20,184,166,0.18)' }}
          />
        )}
        <div
          className="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: isActive ? NAVY : '#FFFFFF',
            border: `1.5px solid ${isActive ? TEAL_BRIGHT : TEAL}`,
            boxShadow: isActive
              ? '0 0 0 4px rgba(20,184,166,0.10), 0 8px 18px rgba(15,26,46,0.18)'
              : '0 1px 2px rgba(15,26,46,0.06)',
          }}
        >
          <span
            className="font-mono text-[11px] font-bold tabular-nums"
            style={{ color: isActive ? TEAL_LIGHT : TEAL }}
          >
            {station.n}
          </span>
        </div>
      </div>

      {/* "You are here" indicator — a small chevron sliding to the active
          node via layoutId. */}
      <div className="h-2 mt-1 w-full flex justify-center">
        {isActive && (
          <motion.span
            layoutId="here-indicator"
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="block"
            style={{
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: `6px solid ${TEAL_BRIGHT}`,
            }}
          />
        )}
      </div>

      {/* Label beneath the node */}
      <span
        className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors"
        style={{
          color: isActive ? NAVY : '#94A3B8',
          fontWeight: isActive ? 700 : 500,
        }}
      >
        {station.label}
      </span>
    </button>
  )
}

// ─── Station card (desktop) ──────────────────────────────────────────────────
// Dark navy card with two columns: left = text content, right = a hand-drawn
// technical-drawing SVG illustration. Crossfades between stations with motion.

function StationCard({ station, activeIndex, onHoverChange, onAdvance, reduce }) {
  const isLast = activeIndex === STATIONS.length - 1
  return (
    <div className="relative">
      {/* Connector — a down-chevron in the gap above the card, aligned to
          the active station and sliding as it changes. Lives OUTSIDE the
          card's overflow-hidden box so it is never clipped. */}
      <div className="relative h-4 mb-2" aria-hidden="true">
        <span
          className="absolute block transition-all duration-500 ease-out"
          style={{
            top: 0,
            left: `calc(${(activeIndex + 0.5) * (100 / STATIONS.length)}% - 7px)`,
            width: 0,
            height: 0,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderTop: `8px solid ${TEAL_BRIGHT}`,
          }}
        />
      </div>

      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: NAVY_GRADIENT,
          border: '1px solid rgba(20,184,166,0.18)',
          minHeight: 440,
        }}
        onMouseEnter={() => onHoverChange(true)}
        onMouseLeave={() => onHoverChange(false)}
      >
        {/* Top teal rail (the baseline visually "enters" the card). */}
        <div className="absolute top-0 left-0 right-0 h-px z-10" style={{ background: TEAL_RAIL }} />

        {/* Corner survey marks — L-shaped reference brackets. */}
        <CornerMarks />

        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 px-10 lg:px-14 py-10 lg:py-12 relative">
          {/* Left — crossfading content + a persistent clickable advance. */}
          <div className="relative flex flex-col">
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={station.n}
                  initial={reduce ? { opacity: 1 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 1 } : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p
                    className="font-mono text-[10px] uppercase tracking-[0.32em] font-bold mb-4 flex items-center gap-3"
                    style={{ color: TEAL_LIGHT }}
                  >
                    <span>Station {station.n}</span>
                    <span style={{ color: 'rgba(94,234,212,0.4)' }}>/</span>
                    <span>{station.label}</span>
                  </p>

                  <h2
                    className="text-3xl lg:text-[2.4rem] font-serif font-semibold text-white leading-[1.1] tracking-tight mb-6"
                    style={{ letterSpacing: '-0.02em' }}
                  >
                    {station.headline}
                  </h2>

                  <div className="space-y-4 text-[15px] text-white/70 leading-relaxed max-w-xl">
                    {station.body.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Persistent advance control — a real button. Advancing from
                the card's bottom means no scrolling back up to the baseline
                to reach the next station. */}
            <button
              type="button"
              onClick={onAdvance}
              aria-label={isLast ? 'Restart the walkthrough' : 'Go to the next station'}
              className="group mt-8 inline-flex items-center gap-3 self-start rounded-full pl-4 pr-3 py-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2DD4BF]"
              style={{ border: '1px solid rgba(20,184,166,0.35)', background: 'rgba(20,184,166,0.06)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(20,184,166,0.16)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(20,184,166,0.06)' }}
            >
              <span
                className="font-mono text-[10px] uppercase tracking-[0.24em] font-bold"
                style={{ color: TEAL_LIGHT }}
              >
                {isLast ? 'Walk again' : 'Next station'}
              </span>
              {isLast ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={TEAL_BRIGHT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              ) : (
                <motion.span
                  animate={reduce ? {} : { x: [0, 4, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ color: TEAL_BRIGHT, display: 'inline-flex' }}
                >
                  <svg width="16" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="2" y1="9" x2="20" y2="9" />
                    <polyline points="14 3 20 9 14 15" />
                  </svg>
                </motion.span>
              )}
            </button>
          </div>

          {/* Right — SVG illustration. Re-keyed on station so paths re-draw. */}
          <div className="relative flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={station.n + '-art'}
                initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="w-full"
              >
                <StationArt kind={station.illustration} reduce={reduce} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

// L-shaped marker brackets in each corner of the card.
function CornerMarks() {
  const stroke = 'rgba(94,234,212,0.42)'
  const len = 16
  const off = 14
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width="100%"
      height="100%"
      style={{ overflow: 'visible' }}
      aria-hidden="true"
    >
      {/* top-left */}
      <line x1={off} y1={off} x2={off + len} y2={off} stroke={stroke} strokeWidth="1" />
      <line x1={off} y1={off} x2={off} y2={off + len} stroke={stroke} strokeWidth="1" />
      {/* top-right */}
      <line x1={`calc(100% - ${off}px)`} y1={off} x2={`calc(100% - ${off + len}px)`} y2={off} stroke={stroke} strokeWidth="1" />
      <line x1={`calc(100% - ${off}px)`} y1={off} x2={`calc(100% - ${off}px)`} y2={off + len} stroke={stroke} strokeWidth="1" />
      {/* bottom-left */}
      <line x1={off} y1={`calc(100% - ${off}px)`} x2={off + len} y2={`calc(100% - ${off}px)`} stroke={stroke} strokeWidth="1" />
      <line x1={off} y1={`calc(100% - ${off}px)`} x2={off} y2={`calc(100% - ${off + len}px)`} stroke={stroke} strokeWidth="1" />
      {/* bottom-right */}
      <line x1={`calc(100% - ${off}px)`} y1={`calc(100% - ${off}px)`} x2={`calc(100% - ${off + len}px)`} y2={`calc(100% - ${off}px)`} stroke={stroke} strokeWidth="1" />
      <line x1={`calc(100% - ${off}px)`} y1={`calc(100% - ${off}px)`} x2={`calc(100% - ${off}px)`} y2={`calc(100% - ${off + len}px)`} stroke={stroke} strokeWidth="1" />
    </svg>
  )
}

// ─── Mobile station ──────────────────────────────────────────────────────────
function MobileStation({ station }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-xl overflow-hidden"
      style={{
        background: NAVY_GRADIENT,
        border: '1px solid rgba(20,184,166,0.18)',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: TEAL_RAIL }} />
      <div className="px-6 py-7">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.28em] font-bold mb-3 flex items-center gap-2"
          style={{ color: TEAL_LIGHT }}
        >
          <span>Station {station.n}</span>
          <span style={{ color: 'rgba(94,234,212,0.4)' }}>/</span>
          <span>{station.label}</span>
        </p>
        <h2
          className="text-2xl font-serif font-semibold text-white leading-tight mb-5"
          style={{ letterSpacing: '-0.02em' }}
        >
          {station.headline}
        </h2>
        <div className="space-y-3 text-[14px] text-white/70 leading-relaxed">
          {station.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-6 flex justify-center opacity-70">
          <div className="w-full max-w-[240px]">
            <StationArt kind={station.illustration} reduce={true} compact />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Illustration router ─────────────────────────────────────────────────────
function StationArt({ kind, reduce, compact = false }) {
  switch (kind) {
    case 'gap': return <GapArt reduce={reduce} compact={compact} />
    case 'groma': return <GromaArt reduce={reduce} compact={compact} />
    case 'triangulation': return <TriangulationArt reduce={reduce} compact={compact} />
    case 'coverage': return <CoverageArt reduce={reduce} compact={compact} />
    case 'notebook': return <NotebookArt reduce={reduce} compact={compact} />
    default: return null
  }
}

// Animation primitive — a path that draws itself from 0 to full length.
function drawProps(reduce, delay = 0, duration = 0.9) {
  if (reduce) return { initial: { pathLength: 1, opacity: 1 }, animate: { pathLength: 1, opacity: 1 } }
  return {
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration, delay, ease: [0.22, 1, 0.36, 1] },
  }
}
function fadeProps(reduce, delay = 0) {
  if (reduce) return { initial: { opacity: 1 }, animate: { opacity: 1 } }
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.6, delay, ease: 'easeOut' },
  }
}

// ─── Illustration: Station 01 — THE GAP ──────────────────────────────────────
// "The short end of the stick." One stick split unequally: the big, integrated
// players hold the long end; the lean shop holds the short end. Tractova's
// bright wedge extends the short end toward — but not all the way to — parity
// (it narrows the gap; it doesn't pretend a one-person shop becomes an IPP).
// Lengths are illustrative, NOT quantified — no numbers asserted.
function GapArt({ reduce }) {
  const W = 360
  const H = 280
  const x0 = 40        // shared left start of both pieces
  const longEnd = 300  // the big players' reach
  const youEnd = 150   // your unaided reach — the short end
  const wedgeEnd = 272 // your reach with Tractova — near, not at, parity
  const yLong = 104
  const yYou = 188
  const beam = 20

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-hidden="true">
      {/* Parity reference — faint dashed line at the big players' reach, so the
          residual gap (wedge end → here) stays visible and honest. */}
      <motion.line
        x1={longEnd} y1={yLong - 26} x2={longEnd} y2={yYou + 26}
        stroke="rgba(94,234,212,0.28)" strokeWidth="1" strokeDasharray="3 4"
        {...fadeProps(reduce, 1.3)}
      />

      {/* Long end — the big, integrated players (dim: the status quo). */}
      <motion.text
        x={x0} y={yLong - 18} fill="rgba(255,255,255,0.85)" fontSize="9"
        fontFamily="ui-monospace,Menlo,monospace" letterSpacing="0.12em" fontWeight="700"
        {...fadeProps(reduce, 0.2)}
      >
        BIG, INTEGRATED PLAYERS
      </motion.text>
      <motion.line
        x1={x0} y1={yLong} x2={longEnd} y2={yLong}
        stroke="rgba(20,184,166,0.40)" strokeWidth={beam} strokeLinecap="round"
        {...drawProps(reduce, 0.15, 0.7)}
      />
      <motion.text
        x={x0} y={yLong + 24} fill="rgba(148,163,184,0.7)" fontSize="7"
        fontFamily="ui-monospace,Menlo,monospace" letterSpacing="0.10em"
        {...fadeProps(reduce, 0.5)}
      >
        in-house finance · legal · design
      </motion.text>

      {/* Short end — you (solid), extended by the Tractova wedge (bright). */}
      <motion.text
        x={x0} y={yYou - 18} fill="rgba(255,255,255,0.85)" fontSize="9"
        fontFamily="ui-monospace,Menlo,monospace" letterSpacing="0.12em" fontWeight="700"
        {...fadeProps(reduce, 0.45)}
      >
        YOU
      </motion.text>
      <motion.line
        x1={x0} y1={yYou} x2={youEnd} y2={yYou}
        stroke={TEAL} strokeWidth={beam} strokeLinecap="round"
        {...drawProps(reduce, 0.4, 0.55)}
      />
      {/* Tractova wedge — grows in last; the payoff beat. */}
      <motion.line
        x1={youEnd} y1={yYou} x2={wedgeEnd} y2={yYou}
        stroke={TEAL_BRIGHT} strokeWidth={beam} strokeLinecap="round"
        {...drawProps(reduce, 1.0, 0.7)}
      />
      <motion.text
        x={x0} y={yYou + 24} fill="rgba(148,163,184,0.7)" fontSize="7"
        fontFamily="ui-monospace,Menlo,monospace" letterSpacing="0.10em"
        {...fadeProps(reduce, 0.7)}
      >
        a lean shop
      </motion.text>
      <motion.text
        x={(youEnd + wedgeEnd) / 2} y={yYou + 5} fill="#06231f" fontSize="7.5"
        fontFamily="ui-monospace,Menlo,monospace" letterSpacing="0.14em" fontWeight="700"
        textAnchor="middle"
        {...fadeProps(reduce, 1.55)}
      >
        + TRACTOVA
      </motion.text>

      {/* Caption */}
      <motion.text
        x={x0} y={H - 14} fill="rgba(255,255,255,0.5)" fontSize="9"
        fontFamily="ui-monospace,Menlo,monospace" letterSpacing="0.18em"
        {...fadeProps(reduce, 1.65)}
      >
        CLOSING THE GAP
      </motion.text>
    </svg>
  )
}

// ─── Illustration: Station 02 — THE NAME (Groma) ─────────────────────────────
// A Roman surveyor's groma, CENTERED: vertical staff + horizontal crossarm with
// plumb-bobs on top, sighting straight down to a staked parcel grid (the tract)
// directly below it. Everything is centered on cx so the instrument reads as the
// hero. Labeled ROMAN GROMA (top) and TRACTUS · A TRACT OF LAND (bottom).
function GromaArt({ reduce }) {
  const W = 360
  const H = 300
  const cx = 180        // centered
  const top = 50        // top of staff
  const armY = 74       // crossarm height
  const armLen = 60     // half-width of crossarm
  const staffBottom = 150
  // Tract grid below the instrument, centered on cx
  const gCell = 24, gCols = 5, gRows = 3
  const gW = gCols * gCell
  const gx = cx - gW / 2 // 120
  const gy = 190
  const gridRight = gx + gW
  const gridBottom = gy + gRows * gCell
  // staked parcel = the centered cell
  const px = cx - gCell / 2
  const py = gy + gCell

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-hidden="true">
      {/* Instrument label, top-centered (kept clear of the sight lines). */}
      <motion.text
        x={cx} y={30} fill="rgba(255,255,255,0.55)" fontSize="8"
        fontFamily="ui-monospace,Menlo,monospace" letterSpacing="0.22em" textAnchor="middle"
        {...fadeProps(reduce, 0.9)}
      >
        ROMAN GROMA
      </motion.text>

      {/* Tract grid (the surveyed land) below the instrument. */}
      <motion.g {...fadeProps(reduce, 0.05)}>
        {Array.from({ length: gCols + 1 }).map((_, i) => (
          <line key={`gv-${i}`} x1={gx + i * gCell} y1={gy} x2={gx + i * gCell} y2={gridBottom} stroke="rgba(20,184,166,0.15)" strokeWidth="0.6" />
        ))}
        {Array.from({ length: gRows + 1 }).map((_, i) => (
          <line key={`gh-${i}`} x1={gx} y1={gy + i * gCell} x2={gridRight} y2={gy + i * gCell} stroke="rgba(20,184,166,0.15)" strokeWidth="0.6" />
        ))}
        {/* the staked parcel */}
        <rect x={px} y={py} width={gCell} height={gCell} fill="rgba(20,184,166,0.18)" stroke="rgba(20,184,166,0.55)" strokeWidth="0.9" />
        {[[px, py], [px + gCell, py], [px, py + gCell], [px + gCell, py + gCell]].map(([x, y], i) => (
          <g key={`pc-${i}`}>
            <line x1={x - 3} y1={y} x2={x + 3} y2={y} stroke={TEAL_BRIGHT} strokeWidth="1.4" />
            <line x1={x} y1={y - 3} x2={x} y2={y + 3} stroke={TEAL_BRIGHT} strokeWidth="1.4" />
          </g>
        ))}
      </motion.g>

      {/* Sight lines: crossarm ends plumb straight down to the staked cell. */}
      {[[cx - armLen, px], [cx + armLen, px + gCell]].map(([sx, tx], i) => (
        <motion.line key={`sight-${i}`} x1={sx} y1={armY} x2={tx} y2={py} stroke={TEAL_LIGHT} strokeWidth="0.7" strokeDasharray="3 3" {...drawProps(reduce, 0.95 + i * 0.1, 0.6)} />
      ))}

      {/* Crossarm + staff */}
      <motion.line x1={cx - armLen} y1={armY} x2={cx + armLen} y2={armY} stroke={TEAL_BRIGHT} strokeWidth="2" {...drawProps(reduce, 0.05, 0.5)} />
      <motion.line x1={cx} y1={top} x2={cx} y2={staffBottom} stroke={TEAL_BRIGHT} strokeWidth="2" {...drawProps(reduce, 0.15, 0.55)} />

      {/* Plumb-bobs from the arm ends (the groma's defining feature) */}
      {[-armLen, armLen].map((dx, i) => (
        <g key={`bob-${i}`}>
          <motion.line x1={cx + dx} y1={armY} x2={cx + dx} y2={armY + 32} stroke={TEAL_LIGHT} strokeWidth="1" {...drawProps(reduce, 0.4 + i * 0.1, 0.45)} />
          <motion.circle cx={cx + dx} cy={armY + 32} r={4} fill={TEAL_BRIGHT} {...fadeProps(reduce, 0.7 + i * 0.1)} />
        </g>
      ))}
      {/* intermediate bobs → suggests the 4-bob 3D form */}
      {[-armLen / 2, armLen / 2].map((dx, i) => (
        <g key={`bob2-${i}`} opacity={0.6}>
          <motion.line x1={cx + dx} y1={armY} x2={cx + dx} y2={armY + 24} stroke={TEAL_LIGHT} strokeWidth="0.7" strokeDasharray="2 2" {...drawProps(reduce, 0.55 + i * 0.08, 0.4)} />
          <motion.circle cx={cx + dx} cy={armY + 24} r={2.5} fill={TEAL_LIGHT} {...fadeProps(reduce, 0.85 + i * 0.08)} />
        </g>
      ))}
      {/* Crossarm hub */}
      <motion.circle cx={cx} cy={armY} r={4} fill={NAVY} stroke={TEAL_BRIGHT} strokeWidth="1.5" {...fadeProps(reduce, 0.5)} />

      {/* Short ground line + ticks where the staff stands. */}
      <motion.line x1={cx - 18} y1={staffBottom} x2={cx + 18} y2={staffBottom} stroke={TEAL} strokeWidth="1" {...drawProps(reduce, 0.3, 0.4)} />
      {[-12, 0, 12].map((dx, i) => (
        <motion.line key={`tick-${i}`} x1={cx + dx} y1={staffBottom} x2={cx + dx} y2={staffBottom + 4} stroke={TEAL} strokeWidth="1" {...drawProps(reduce, 0.45 + i * 0.05, 0.3)} />
      ))}

      {/* Tract label, bottom-centered */}
      <motion.text
        x={cx} y={gridBottom + 22} fill={TEAL_LIGHT} fontSize="7.5"
        fontFamily="ui-monospace,Menlo,monospace" letterSpacing="0.14em" textAnchor="middle"
        {...fadeProps(reduce, 1.0)}
      >
        TRACTUS · A TRACT OF LAND
      </motion.text>
    </svg>
  )
}

// ─── Illustration: Station 03 — THE METHOD (Triangulation) ───────────────────
// Equilateral triangle with three labeled vertices (Offtake / IX / Site);
// faint sight-lines extending outward from each vertex; a center dot
// labeled GO / NO-GO; tick marks along each triangle edge.
function TriangulationArt({ reduce }) {
  const W = 360
  const H = 320
  const cx = 180
  const cy = 175
  const r = 110
  // Three vertices of an equilateral triangle, point-up
  const A = { x: cx,         y: cy - r,         label: 'OFFTAKE' }
  const B = { x: cx - r * 0.866, y: cy + r * 0.5, label: 'IX' }
  const C = { x: cx + r * 0.866, y: cy + r * 0.5, label: 'SITE' }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-hidden="true">
      {/* Faint outward sight-lines from each vertex — like survey sightings
          into the landscape beyond the triangle. */}
      {[A, B, C].map((v, i) => {
        const dx = v.x - cx
        const dy = v.y - cy
        const norm = Math.hypot(dx, dy)
        const ex = v.x + (dx / norm) * 40
        const ey = v.y + (dy / norm) * 40
        return (
          <motion.line
            key={`sight-${i}`}
            x1={v.x}
            y1={v.y}
            x2={ex}
            y2={ey}
            stroke="rgba(94,234,212,0.35)"
            strokeWidth="0.7"
            strokeDasharray="3 3"
            {...drawProps(reduce, 0.7 + i * 0.08, 0.45)}
          />
        )
      })}

      {/* Triangle edges */}
      {[
        [A, B], [B, C], [C, A],
      ].map(([p, q], i) => (
        <motion.line
          key={`edge-${i}`}
          x1={p.x}
          y1={p.y}
          x2={q.x}
          y2={q.y}
          stroke={TEAL_BRIGHT}
          strokeWidth="1.5"
          {...drawProps(reduce, 0.05 + i * 0.18, 0.6)}
        />
      ))}

      {/* Tick marks along each edge (3 per edge) */}
      {[[A, B], [B, C], [C, A]].map(([p, q], i) =>
        [0.25, 0.5, 0.75].map((t, j) => {
          const mx = p.x + (q.x - p.x) * t
          const my = p.y + (q.y - p.y) * t
          // perpendicular short tick (4px)
          const dx = q.x - p.x
          const dy = q.y - p.y
          const len = Math.hypot(dx, dy)
          const px = -dy / len
          const py = dx / len
          return (
            <motion.line
              key={`tick-${i}-${j}`}
              x1={mx - px * 3}
              y1={my - py * 3}
              x2={mx + px * 3}
              y2={my + py * 3}
              stroke={TEAL}
              strokeWidth="1"
              {...drawProps(reduce, 0.55 + i * 0.05 + j * 0.03, 0.25)}
            />
          )
        })
      )}

      {/* Vertex markers + labels */}
      {[A, B, C].map((v, i) => (
        <g key={`vx-${i}`}>
          <motion.circle
            cx={v.x}
            cy={v.y}
            r={6}
            fill={NAVY}
            stroke={TEAL_BRIGHT}
            strokeWidth="1.5"
            {...fadeProps(reduce, 0.8 + i * 0.08)}
          />
          <motion.text
            x={v.x}
            y={v === A ? v.y - 14 : v.y + 22}
            fill={TEAL_LIGHT}
            fontSize="10"
            fontFamily="ui-monospace,Menlo,monospace"
            letterSpacing="0.20em"
            fontWeight="700"
            textAnchor="middle"
            {...fadeProps(reduce, 0.95 + i * 0.08)}
          >
            {v.label}
          </motion.text>
        </g>
      ))}

      {/* Center: GO/NO-GO marker */}
      <motion.circle
        cx={cx}
        cy={cy}
        r={26}
        fill="rgba(20,184,166,0.10)"
        stroke="rgba(20,184,166,0.35)"
        strokeWidth="0.8"
        {...fadeProps(reduce, 1.1)}
      />
      <motion.circle
        cx={cx}
        cy={cy}
        r={3}
        fill={TEAL_BRIGHT}
        {...fadeProps(reduce, 1.2)}
      />
      <motion.text
        x={cx}
        y={cy - 34}
        fill="rgba(255,255,255,0.7)"
        fontSize="8"
        fontFamily="ui-monospace,Menlo,monospace"
        letterSpacing="0.22em"
        textAnchor="middle"
        {...fadeProps(reduce, 1.25)}
      >
        GO / NO-GO
      </motion.text>

      {/* Cross-bearing lines from center to each vertex (very faint) */}
      {[A, B, C].map((v, i) => (
        <motion.line
          key={`bearing-${i}`}
          x1={cx}
          y1={cy}
          x2={v.x}
          y2={v.y}
          stroke="rgba(94,234,212,0.18)"
          strokeWidth="0.6"
          strokeDasharray="2 4"
          {...drawProps(reduce, 1.0 + i * 0.05, 0.5)}
        />
      ))}
    </svg>
  )
}

// ─── Illustration: Station 04 — THE LIMITS (Coverage map) ────────────────────
// A rectangle divided into ~80% solid (knowable from public data) and ~20%
// dashed-outline (specialist work). Annotation arrows + "TRACTOVA ENDS HERE"
// marker at the boundary.
function CoverageArt({ reduce }) {
  const W = 360
  const H = 320
  const x0 = 30
  const y0 = 80
  const totalW = 290
  const totalH = 160
  const splitX = x0 + totalW * 0.8

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-hidden="true">
      {/* Survey grid underneath the rectangle (very faint) */}
      <motion.g {...fadeProps(reduce, 0.05)}>
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={`vg-${i}`} x1={x0 + i * (totalW / 14)} y1={y0} x2={x0 + i * (totalW / 14)} y2={y0 + totalH} stroke="rgba(20,184,166,0.08)" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`hg-${i}`} x1={x0} y1={y0 + i * (totalH / 8)} x2={x0 + totalW} y2={y0 + i * (totalH / 8)} stroke="rgba(20,184,166,0.08)" strokeWidth="0.5" />
        ))}
      </motion.g>

      {/* Solid 80% region — filled with a subtle teal hatch */}
      <motion.rect
        x={x0}
        y={y0}
        width={splitX - x0}
        height={totalH}
        fill="rgba(20,184,166,0.18)"
        stroke={TEAL_BRIGHT}
        strokeWidth="1.2"
        initial={reduce ? { opacity: 1 } : { opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: `${x0}px ${y0 + totalH / 2}px` }}
      />
      {/* Diagonal hatch lines inside the solid region */}
      <motion.g {...fadeProps(reduce, 0.6)}>
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(94,234,212,0.25)" strokeWidth="0.7" />
          </pattern>
        </defs>
        <rect x={x0} y={y0} width={splitX - x0} height={totalH} fill="url(#hatch)" />
      </motion.g>

      {/* Dashed 20% region — outline only */}
      <motion.rect
        x={splitX}
        y={y0}
        width={totalW - (splitX - x0)}
        height={totalH}
        fill="none"
        stroke="rgba(94,234,212,0.55)"
        strokeWidth="1.2"
        strokeDasharray="5 4"
        initial={reduce ? { opacity: 1 } : { opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.7, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: `${splitX}px ${y0 + totalH / 2}px` }}
      />

      {/* Boundary marker — a vertical dotted line + small triangle */}
      <motion.line
        x1={splitX}
        y1={y0 - 10}
        x2={splitX}
        y2={y0 + totalH + 10}
        stroke={TEAL_LIGHT}
        strokeWidth="0.8"
        strokeDasharray="2 3"
        {...drawProps(reduce, 0.9, 0.4)}
      />
      <motion.polygon
        points={`${splitX - 4},${y0 - 14} ${splitX + 4},${y0 - 14} ${splitX},${y0 - 6}`}
        fill={TEAL_BRIGHT}
        {...fadeProps(reduce, 1.05)}
      />

      {/* Region labels */}
      <motion.text
        x={x0 + (splitX - x0) / 2}
        y={y0 - 16}
        fill={TEAL_LIGHT}
        fontSize="9"
        fontFamily="ui-monospace,Menlo,monospace"
        letterSpacing="0.20em"
        fontWeight="700"
        textAnchor="middle"
        {...fadeProps(reduce, 0.7)}
      >
        80% · PUBLIC DATA
      </motion.text>
      <motion.text
        x={splitX + (totalW - (splitX - x0)) / 2}
        y={y0 + totalH + 22}
        fill="rgba(255,255,255,0.6)"
        fontSize="9"
        fontFamily="ui-monospace,Menlo,monospace"
        letterSpacing="0.20em"
        fontWeight="700"
        textAnchor="middle"
        {...fadeProps(reduce, 0.95)}
      >
        20% · SPECIALISTS
      </motion.text>

      {/* "TRACTOVA ENDS HERE" marker pointing at the boundary */}
      <motion.text
        x={splitX}
        y={y0 + totalH + 36}
        fill={TEAL_LIGHT}
        fontSize="8"
        fontFamily="ui-monospace,Menlo,monospace"
        letterSpacing="0.24em"
        fontWeight="700"
        textAnchor="middle"
        {...fadeProps(reduce, 1.2)}
      >
        ◆ TRACTOVA ENDS HERE
      </motion.text>

      {/* Sub-labels inside the solid block */}
      {['STATE PROGRAMS', 'IX QUEUES', 'WETLANDS', 'FARMLAND'].map((t, i) => (
        <motion.text
          key={t}
          x={x0 + 14}
          y={y0 + 28 + i * 28}
          fill="rgba(94,234,212,0.65)"
          fontSize="8"
          fontFamily="ui-monospace,Menlo,monospace"
          letterSpacing="0.14em"
          {...fadeProps(reduce, 0.8 + i * 0.05)}
        >
          {t}
        </motion.text>
      ))}
      {/* Sub-labels in the dashed block */}
      {['TITLE', 'IE', 'LEGAL'].map((t, i) => (
        <motion.text
          key={t}
          x={splitX + 10}
          y={y0 + 32 + i * 28}
          fill="rgba(255,255,255,0.45)"
          fontSize="8"
          fontFamily="ui-monospace,Menlo,monospace"
          letterSpacing="0.14em"
          {...fadeProps(reduce, 1.05 + i * 0.05)}
        >
          {t}
        </motion.text>
      ))}
    </svg>
  )
}

// ─── Illustration: Station 05 — THE OPERATOR (Field notebook) ────────────────
// An open field notebook spread: left page = layered data lines (annotated
// OFFTAKE / IX / SITE / POLICY), right page = a stamped seal + signature
// loops. A pencil rests on the right page.
function NotebookArt({ reduce }) {
  const W = 360
  const H = 320
  // Notebook bounds
  const nb = { x: 30, y: 60, w: 300, h: 200 }
  const spine = nb.x + nb.w / 2

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" aria-hidden="true">
      {/* Notebook outer rectangle */}
      <motion.rect
        x={nb.x}
        y={nb.y}
        width={nb.w}
        height={nb.h}
        rx={4}
        fill="rgba(15,26,46,0.6)"
        stroke={TEAL_BRIGHT}
        strokeWidth="1.2"
        {...drawProps(reduce, 0.05, 0.7)}
      />
      {/* Center spine line */}
      <motion.line
        x1={spine}
        y1={nb.y}
        x2={spine}
        y2={nb.y + nb.h}
        stroke="rgba(94,234,212,0.45)"
        strokeWidth="0.8"
        strokeDasharray="2 3"
        {...drawProps(reduce, 0.5, 0.4)}
      />

      {/* Left page — labeled data traces. The endpoint dot is placed on the
          path's ACTUAL last point (line + dot share the same jittered y) so
          they always line up. */}
      {['OFFTAKE', 'IX', 'SITE', 'POLICY'].map((label, i) => {
        const y = nb.y + 30 + i * 38
        const baseX = nb.x + 18
        const endX = spine - 16
        const pts = []
        for (let k = 0; k <= 8; k++) {
          const x = baseX + (k * (endX - baseX)) / 8
          const seed = (i * 7 + k * 3) % 9
          const dy = ((seed % 5) - 2) * 2
          pts.push({ x, y: y + dy })
        }
        const d = pts.map((p, k) => `${k === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
        const last = pts[pts.length - 1]
        return (
          <g key={label}>
            <motion.text
              x={baseX}
              y={y - 9}
              fill="rgba(94,234,212,0.65)"
              fontSize="7"
              fontFamily="ui-monospace,Menlo,monospace"
              letterSpacing="0.20em"
              fontWeight="700"
              {...fadeProps(reduce, 0.3 + i * 0.08)}
            >
              {label}
            </motion.text>
            <motion.path
              d={d}
              fill="none"
              stroke={TEAL_BRIGHT}
              strokeWidth="1.2"
              {...drawProps(reduce, 0.4 + i * 0.1, 0.6)}
            />
            <motion.circle
              cx={last.x}
              cy={last.y}
              r={2.4}
              fill={TEAL_LIGHT}
              {...fadeProps(reduce, 0.9 + i * 0.1)}
            />
          </g>
        )
      })}

      {/* Right page — a survey-drawing title block (replaces the badge,
          which read as generic clip-art). Label/value rows like the corner
          of an engineering drawing: authentic to the surveyor theme. */}
      {(() => {
        const bx = 196, by = 92, bw = 118, titleH = 22, fieldH = 32
        const fields = [
          { label: 'OPERATOR', value: 'Boston, MA' },
          { label: 'SCOPE',    value: 'Community Solar' },
          { label: 'STATUS',   value: 'Independent' },
        ]
        const bh = titleH + fields.length * fieldH
        return (
          <motion.g {...fadeProps(reduce, 0.9)}>
            {/* block outline + title cell */}
            <rect x={bx} y={by} width={bw} height={bh} rx={3} fill="rgba(15,26,46,0.5)" stroke="rgba(20,184,166,0.5)" strokeWidth="1" />
            <rect x={bx} y={by} width={bw} height={titleH} fill="rgba(20,184,166,0.10)" />
            <rect x={bx + 9} y={by + titleH / 2 - 2.5} width={5} height={5} fill={TEAL_BRIGHT} transform={`rotate(45 ${bx + 11.5} ${by + titleH / 2})`} />
            <text x={bx + 20} y={by + titleH / 2 + 3} fill={TEAL_LIGHT} fontSize="8" fontFamily="ui-monospace,Menlo,monospace" letterSpacing="0.18em" fontWeight="700">FIELD NOTES</text>
            {/* label / value rows */}
            {fields.map((f, i) => {
              const cy = by + titleH + i * fieldH
              return (
                <g key={f.label}>
                  <line x1={bx} y1={cy} x2={bx + bw} y2={cy} stroke="rgba(94,234,212,0.20)" strokeWidth="0.6" />
                  <text x={bx + 10} y={cy + 13} fill="rgba(94,234,212,0.6)" fontSize="6" fontFamily="ui-monospace,Menlo,monospace" letterSpacing="0.18em" fontWeight="700">{f.label}</text>
                  <text x={bx + 10} y={cy + 25} fill="rgba(255,255,255,0.85)" fontSize="8.5" fontFamily="ui-monospace,Menlo,monospace" letterSpacing="0.04em">{f.value}</text>
                </g>
              )
            })}
          </motion.g>
        )
      })()}
    </svg>
  )
}
