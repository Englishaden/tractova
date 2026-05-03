import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from './ui/Dialog'

// DataLimitationsModal — shipped 2026-05-02 after the data-trust audit
// (see plan: what-are-some-caveats-cached-kite.md).
//
// Discoverable from the Lens result disclaimer block. The audit identified
// 5 developer-critical caveats that ToS Section 06 covers legally but that
// users won't read in ToS — they need to be 1 click away from the actual
// numbers a developer is about to act on.
//
// Each entry:
//   - Names the limitation in plain language
//   - Quantifies the actual real-world risk
//   - Points the developer at how to verify before committing capital
//
// Trust = transparency. The audit's grading rubric (0-100) is summarized
// at the top of the modal so the developer sees the platform's own
// assessment of where the data is rock-solid vs. where they should hedge.

const CAVEATS = [
  {
    n: '01',
    title: 'Hand-curated state program capacity may drift',
    body: 'Remaining program capacity (the number that drives Runway and the Feasibility Index) is curated, not auto-refreshed from program administrators. If a state\'s CS block fills 50 MW between two updates, your "MW remaining" is overstated. The Footer\'s "Data refreshed [date]" stamp is the verification anchor — confirm program-block fill status with the state\'s program administrator before committing capital.',
    severity: 'high',
  },
  {
    n: '02',
    title: 'BESS revenue rates are seeded constants, not refreshed',
    body: 'ISO capacity payments swing 2–9× year over year (PJM RPM, NYISO ICAP, ISO-NE FCM). Our values are good as of the seed date stamped on the BESS revenue panel; they may be very wrong this year. Treat BESS Y1 revenue, payback, and IRR as illustrative — your own ISO\'s most recent capacity-auction results are the ground truth.',
    severity: 'high',
  },
  {
    n: '03',
    title: 'IRR / Equity-IRR / DSCR use industry-typical defaults',
    body: 'Default assumptions: 8% discount rate, 70/30 debt/equity, 6.5% all-in debt rate, 18-year amortization, 25-year project life. Real deals diverge — a single notch of credit quality changes debt rate 100+ bps; tax-equity deals don\'t follow this capital stack at all. Scenario Studio sliders override every default; treat outputs as decision-support, not a pro forma your bank can underwrite.',
    severity: 'medium',
  },
  {
    n: '04',
    title: 'IX queue data may be stale during ISO scraper outages',
    body: 'When an ISO\'s public queue download URL changes (PJM Cycles reform, NYISO portal moves), our scraper silently falls behind until repair. The "IX · Live" pill flips amber + adds "stale Nd" so you can see the freshness in real time — never act on a queue snapshot that\'s flagged stale without confirming current conditions with the serving utility.',
    severity: 'medium',
  },
  {
    n: '05',
    title: '"Comparable Deals" is a curated sample, not a market census',
    body: 'Roughly 20–50 representative deals, hand-curated from press releases and industry filings. CAPEX/W is self-reported and not normalized for project complexity, BOS pricing, or financing structure. Sample skews toward institutional developers; smaller deal shops underrepresented. Useful directional benchmark, not a comp-set for appraisal.',
    severity: 'medium',
  },
]

const SEVERITY_STYLE = {
  high:   { bg: 'rgba(220,38,38,0.06)',  border: 'rgba(220,38,38,0.30)', dot: '#DC2626', label: 'HIGH'   },
  medium: { bg: 'rgba(217,119,6,0.06)',  border: 'rgba(217,119,6,0.30)', dot: '#D97706', label: 'MEDIUM' },
}

export default function DataLimitationsModal({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
          <p
            className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold"
            style={{ color: '#0F766E' }}
          >
            ◆ Data limitations
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-gray-400">
            Audit 2026-05-02 · 5 caveats
          </p>
        </div>

        <DialogTitle className="text-xl mb-1.5" style={{ letterSpacing: '-0.018em' }}>
          What this Lens result can and can't tell you
        </DialogTitle>

        <DialogDescription className="mb-5">
          Tractova synthesizes federal, state, and ISO data into a single intelligence
          report. Some inputs are pulled live from authoritative sources; others are
          curated and may drift. Before you commit capital on the back of any number
          here, read the limitation that applies.
        </DialogDescription>

        <div className="space-y-3 mb-5">
          {CAVEATS.map((c) => {
            const sty = SEVERITY_STYLE[c.severity] || SEVERITY_STYLE.medium
            return (
              <div
                key={c.n}
                className="rounded-lg px-4 py-3"
                style={{ background: sty.bg, border: `1px solid ${sty.border}`, borderLeft: `3px solid ${sty.dot}` }}
              >
                <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
                  <span
                    className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold"
                    style={{ color: sty.dot }}
                  >
                    § {c.n}
                  </span>
                  <span
                    className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold"
                    style={{ background: 'white', color: sty.dot, border: `1px solid ${sty.dot}40` }}
                  >
                    {sty.label}
                  </span>
                  <h3 className="font-serif text-[15px] font-semibold text-ink leading-tight">
                    {c.title}
                  </h3>
                </div>
                <p className="text-[12px] text-gray-700 leading-relaxed">
                  {c.body}
                </p>
              </div>
            )
          })}
        </div>

        <p
          className="text-[11px] text-gray-500 leading-relaxed pt-3 border-t border-gray-100"
        >
          For the full data-source list (every federal, state, and ISO publication
          we synthesize, with refresh cadence) see the{' '}
          <a href="/privacy" className="underline hover:text-gray-700">Privacy Policy § 06</a>.
          For the full risk-allocation language and disclaimer see the{' '}
          <a href="/terms" className="underline hover:text-gray-700">Terms of Service § 06</a>.
        </p>

        <div className="flex items-center justify-end mt-5">
          <DialogClose asChild>
            <button
              type="button"
              className="text-[12px] font-mono uppercase tracking-[0.18em] font-semibold text-white px-4 py-2 rounded-lg transition-colors"
              style={{ background: '#14B8A6' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#0F766E')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#14B8A6')}
            >
              Got it
            </button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
