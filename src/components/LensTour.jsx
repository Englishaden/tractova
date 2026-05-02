import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'

// Post-confirmation tutorial trigger. First-time Pro users land on the
// staged Will County, IL demo via UpgradeSuccess (or WelcomeCard). Both
// link constructions append `?onboarding=1` so the live Lens result page
// can detect "this is the user's first time looking at a Lens panel"
// and walk them through the four anchors that matter:
//
//   1. Composite Feasibility Index gauge (MarketPositionPanel)
//   2. Pillar Diagnostics navy band (Offtake / IX / Site Control)
//   3. Scenario Studio (the killer differentiator)
//   4. Save as Project button (pipeline + alerts)
//
// Persistence is localStorage-only — re-doing a 30-second tour on a new
// device is not worth a migration. Skip / ESC dismisses without firing
// again. Anchors are `data-tour-id` attributes threaded into Search.jsx.

const STORAGE_KEY = 'tractova_lens_tour_completed_at'

const STEPS = [
  {
    id: 'composite',
    title: 'Your Feasibility Index',
    body: '0–100 across three pillars: Site Control, Interconnection, and Offtake. Drawn from federal and ISO data — every number is auditable down to the source.',
    placement: 'top',
  },
  {
    id: 'pillars',
    title: 'The three pillars, in detail',
    body: "Each card unpacks why the composite landed there. Pills marked 'Live' pull directly from the underlying source (NWI, SSURGO, ISO queues); the others are curated baselines we deepen weekly.",
    placement: 'top',
  },
  {
    id: 'scenario',
    title: 'Stress-test the deal',
    body: 'Flex 9 inputs — capex, capacity factor, REC price, opex, discount rate — and watch IRR, payback, NPV, and DSCR move live. Save scenarios to attach to the project.',
    placement: 'top',
  },
  {
    id: 'save',
    title: 'Save it to your Library',
    body: 'When you save, this report joins your pipeline. Tractova re-scores it on every refresh and alerts you when state programs shift.',
    placement: 'bottom',
  },
]

export default function LensTour({ resultsReady }) {
  const [searchParams] = useSearchParams()
  const wantsOnboarding = searchParams.get('onboarding') === '1'

  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [rect, setRect] = useState(null)

  // Lazy start: only after results have rendered, the URL says onboarding,
  // and the user hasn't completed the tour before.
  useEffect(() => {
    if (!wantsOnboarding || !resultsReady || active || done) return
    let already = false
    try { already = !!window.localStorage.getItem(STORAGE_KEY) } catch {}
    if (already) return
    const t = setTimeout(() => setActive(true), 600)
    return () => clearTimeout(t)
  }, [wantsOnboarding, resultsReady, active, done])

  // Measure the active step's anchor + scroll into view + re-measure on
  // resize/scroll. If the anchor is missing, skip forward — the tour
  // shouldn't strand the user on an empty step if a panel was renamed.
  useEffect(() => {
    if (!active || done) return
    if (step >= STEPS.length) return
    const id = STEPS[step].id
    const el = document.querySelector(`[data-tour-id="${id}"]`)
    if (!el) {
      // Anchor missing — skip ahead so a stale data-tour-id never strands the user.
      const t = setTimeout(() => {
        if (step < STEPS.length - 1) setStep((s) => s + 1)
        else setDone(true)
      }, 100)
      return () => clearTimeout(t)
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const settle = setTimeout(() => setRect(el.getBoundingClientRect()), 450)
    const remeasure = () => setRect(el.getBoundingClientRect())
    window.addEventListener('resize', remeasure)
    window.addEventListener('scroll', remeasure, true)
    return () => {
      clearTimeout(settle)
      window.removeEventListener('resize', remeasure)
      window.removeEventListener('scroll', remeasure, true)
    }
  }, [active, step, done])

  // Keyboard nav.
  useEffect(() => {
    if (!active || done) return
    const onKey = (e) => {
      if (e.key === 'Escape') finish()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, done])

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1)
    else setDone(true)
  }
  const prev = () => {
    if (step > 0) setStep((s) => s - 1)
  }
  const finish = () => {
    try { window.localStorage.setItem(STORAGE_KEY, new Date().toISOString()) } catch {}
    setActive(false)
  }

  if (!active) return null

  // Closing card — no anchor, centered modal.
  if (done) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
        <div className="absolute inset-0" style={{ background: 'rgba(15,26,46,0.55)' }} onClick={finish} />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-label="Tour complete"
          className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 overflow-hidden"
        >
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg, #0F1A2E 0%, #14B8A6 100%)' }}
          />
          <p
            className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold mb-2"
            style={{ color: '#0F766E' }}
          >
            ◆ You're set
          </p>
          <h3
            className="font-serif text-xl font-semibold text-ink mb-2"
            style={{ letterSpacing: '-0.02em' }}
          >
            Now run your own analysis.
          </h3>
          <p className="text-sm text-gray-600 leading-relaxed mb-5">
            Pick a state, county, and MW from the Lens form above. Tractova
            scores all 50 states with deepening live coverage every week.
          </p>
          <div className="flex items-center justify-end">
            <button
              onClick={finish}
              autoFocus
              className="text-[12px] font-mono uppercase tracking-[0.18em] font-semibold text-white px-4 py-2 rounded-lg transition-colors"
              style={{ background: '#14B8A6' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#0F766E')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#14B8A6')}
            >
              Got it
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  const current = STEPS[step]
  const tip = computeTooltipPosition(rect, current.placement)

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      {/* Click-blocker so users can't fight with the underlying UI mid-tour. */}
      <div className="absolute inset-0 pointer-events-auto" />
      {/* Spotlight ring + outside dim via inverted box-shadow trick. */}
      {rect && (
        <motion.div
          initial={false}
          animate={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute rounded-xl pointer-events-none"
          style={{
            boxShadow: '0 0 0 9999px rgba(15, 26, 46, 0.55)',
            outline: '2px solid #14B8A6',
            outlineOffset: '4px',
          }}
        />
      )}
      {/* Tooltip — keyed on step so it animates in cleanly each transition. */}
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        role="dialog"
        aria-label={current.title}
        className="absolute pointer-events-auto bg-white rounded-xl shadow-2xl p-5 overflow-hidden"
        style={tip}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: 'linear-gradient(90deg, #0F1A2E 0%, #14B8A6 100%)' }}
        />
        <div className="flex items-center justify-between mb-2">
          <p
            className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold"
            style={{ color: '#0F766E' }}
          >
            ◆ Step {step + 1} of {STEPS.length}
          </p>
          <button
            onClick={finish}
            className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Skip tour"
          >
            Skip
          </button>
        </div>
        <h3
          className="font-serif text-base font-semibold text-ink mb-1.5"
          style={{ letterSpacing: '-0.01em' }}
        >
          {current.title}
        </h3>
        <p className="text-[13px] text-gray-600 leading-relaxed mb-4">
          {current.body}
        </p>
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={prev}
            disabled={step === 0}
            className="text-[12px] font-mono uppercase tracking-[0.16em] text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={next}
            autoFocus
            className="inline-flex items-center gap-2 text-[12px] font-mono uppercase tracking-[0.18em] font-semibold text-white px-3.5 py-2 rounded-lg transition-colors"
            style={{ background: '#14B8A6' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#0F766E')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#14B8A6')}
          >
            {step === STEPS.length - 1 ? 'Finish →' : 'Next →'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// Place the tooltip relative to the target rect with viewport clamping.
// Estimated tooltip dimensions are conservative; the clamp ensures we
// never paint off-screen even on small viewports.
function computeTooltipPosition(rect, placement) {
  const W = 320
  const H = 220
  const m = 16
  if (typeof window === 'undefined' || !rect) {
    return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: W }
  }
  const vw = window.innerWidth
  const vh = window.innerHeight
  let left
  let top
  if (placement === 'right') {
    left = rect.right + m
    top = rect.top + rect.height / 2 - H / 2
    if (left + W > vw - m) left = rect.left - W - m
  } else if (placement === 'bottom') {
    left = rect.left + rect.width / 2 - W / 2
    top = rect.bottom + m
    if (top + H > vh - m) top = rect.top - H - m
  } else {
    // 'top' (preferred) — fall back to bottom when there isn't room.
    left = rect.left + rect.width / 2 - W / 2
    top = rect.top - H - m
    if (top < m) top = rect.bottom + m
  }
  left = Math.max(m, Math.min(left, vw - W - m))
  top = Math.max(m, Math.min(top, vh - H - m))
  return { left, top, width: W }
}
