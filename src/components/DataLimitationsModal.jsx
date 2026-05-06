import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from './ui/Dialog'

// DataLimitationsModal — refreshed 2026-05-05 against current data state
// post Phases B/D/E (LBNL solar_cost_index 10 states, n>=3 tier ladder),
// Phase C-pivoted (cs_projects 4,280 NREL Sharing the Sun rows backing
// Comparable Deals), Phase G paused, NREL ATB 2024 BESS anchor, and
// the cs_status accuracy audit.
//
// Discoverable from the Lens result disclaimer block. Caveats target
// developer-critical numbers a CS dev is likely to act on. Each entry:
//   - Names the limitation in plain language
//   - Quantifies the real-world risk
//   - Points the developer at how to verify before committing capital
//
// Tier system reference: A = observed ground truth, B = regional analog
// (Tractova editorial), C = editorial product methodology. See
// /privacy § 06 + Glossary for full taxonomy.

const CAVEATS = [
  {
    n: '01',
    title: 'Hand-curated state program capacity may drift',
    body: 'Remaining program capacity (the number that drives Runway and the Feasibility Index) is curated, not auto-refreshed from program administrators. If a state\'s CS block fills 50 MW between two updates, your "MW remaining" is overstated. The Footer\'s "Data refreshed [date]" stamp is the verification anchor — confirm program-block fill status with the state\'s program administrator before committing capital.',
    severity: 'high',
  },
  {
    n: '02',
    title: 'state_programs.cs_status may not match operational reality',
    body: 'Curated cs_status (active / limited / pending / none) is hand-set per state. The cs_status accuracy audit (admin Mission Control) joins curated status against operational MW from cs_projects (NREL Sharing the Sun); flagged states are surfaced for manual triage but corrections lag. Cross-check the curated label against the per-state Operating CS Projects panel below the Lens — large mismatches (e.g., "limited" with 1,000+ MW operational) indicate the curated label is stale.',
    severity: 'high',
  },
  {
    n: '03',
    title: 'BESS revenue rates anchored on ISO auctions + NREL ATB capex — refresh is annual',
    body: 'Capacity revenue uses 2025/26 ISO clearing prices (PJM RPM, NYISO ICAP, ISO-NE FCM, CAISO RA) × 4-hour accreditation. Capex anchors on NREL ATB 2024. ISO auctions clear annually; ATB refreshes each Q1. Demand-charge + arbitrage components remain seeded synthesis. The "as of" stamp on the BESS revenue panel is the vintage anchor — for projects clearing more than 6 months past that date, verify with your ISO\'s most recent capacity auction before committing.',
    severity: 'medium',
  },
  {
    n: '04',
    title: 'Solar $/W coverage is uneven by state — Tier system disclosed inline',
    body: 'For 10 states (CA / MA / NY / AZ / MN / TX + WI / RI / CO / UT) we publish observed LBNL Tracking the Sun percentiles with explicit n disclosure (Tier A · strong / modest / thin). The remaining 7 active CS states ride a Tier B regional-analog × $2.45/W national 2026 anchor. Five of those (IL / PA / OR / DE / WA) are structural — their per-MWh REC incentive design produces no LBNL paper trail regardless of program maturity. The Lens panel labels every state\'s tier inline. Treat Tier B as directional, not anchored.',
    severity: 'medium',
  },
  {
    n: '05',
    title: 'IRR / Equity-IRR / DSCR use industry-typical defaults',
    body: 'Default assumptions: 8% discount rate, 70/30 debt/equity, 6.5% all-in debt rate, 18-year amortization, 25-year project life. Real deals diverge — a single notch of credit quality changes debt rate 100+ bps; tax-equity deals don\'t follow this capital stack at all. Scenario Studio sliders override every default; treat outputs as decision-support, not a pro forma your bank can underwrite.',
    severity: 'medium',
  },
  {
    n: '06',
    title: 'IX queue data may be stale during ISO scraper outages',
    body: 'When an ISO\'s public queue download URL changes (PJM Cycles reform, NYISO portal moves) or adds a session-cookie handshake, our scraper silently falls behind until repair. The "IX · Live" pill flips amber + adds "stale Nd" so you can see the freshness in real time — never act on a queue snapshot that\'s flagged stale without confirming current conditions with the serving utility. **PJM** live coverage is permanently disclosed-as-curated under their Data Miner 2 redistribution license terms. **ISO-NE** is currently disclosed-as-stale: as of 2026-05-05, their public queue export endpoint added an ASP.NET session-cookie handshake that our scraper doesn\'t yet handle; CT / MA / ME / NH / RI / VT states will show amber IX freshness until we ship the cookie-aware repair. **MISO + NYISO** are working as of the most recent weekly cron run.',
    severity: 'medium',
  },
  {
    n: '07',
    title: 'Comparable Deals merges real operating data + curated benchmarks',
    body: 'Backed by 4,280 individual operating CS projects from NREL Sharing the Sun (state, utility, developer, capacity, vintage, LMI attribution per project) merged with a smaller curated benchmarks layer (capex disclosure, FERC filings, status proposed/under-construction). Real operating data is observed; curated benchmarks add richer financial metadata for selected deals. Sample skews toward institutional developers in the curated layer; the operating-fleet layer is comprehensive. Capex per project is not consistently published — when shown, it\'s self-reported and not normalized for project complexity.',
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
            Audit refreshed 2026-05-05 · 7 caveats
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
