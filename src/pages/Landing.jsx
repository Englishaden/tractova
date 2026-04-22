import { Link } from 'react-router-dom'
import statePrograms from '../data/statePrograms'
import metrics from '../data/metrics'

// ─── derived stats from real data ────────────────────────────────────────────
const activeCount  = statePrograms.filter(s => s.csStatus === 'active').length
const limitedCount = statePrograms.filter(s => s.csStatus === 'limited').length

// ─── icons ───────────────────────────────────────────────────────────────────
function IconSite() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
}

function IconIX() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

function IconOfftake() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

// ─── hero preview card — simulated dashboard snapshot ─────────────────────────
function DashboardPreview() {
  const sampleStates = [
    { id: 'IL', name: 'Illinois',    score: 78, status: 'active'  },
    { id: 'CO', name: 'Colorado',    score: 75, status: 'active'  },
    { id: 'MN', name: 'Minnesota',   score: 72, status: 'active'  },
    { id: 'MD', name: 'Maryland',    score: 70, status: 'active'  },
    { id: 'VA', name: 'Virginia',    score: 67, status: 'active'  },
    { id: 'MA', name: 'Massachusetts', score: 45, status: 'limited' },
  ]

  return (
    <div className="relative w-full max-w-md ml-auto">
      {/* Outer glow */}
      <div className="absolute -inset-1 bg-primary/20 rounded-xl blur-xl" />

      <div className="relative bg-[#0a2f25] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
        {/* Simulated browser bar */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10 bg-white/5">
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="ml-3 text-xs text-white/30 font-mono">tractova.com</span>
        </div>

        {/* Simulated metrics bar */}
        <div className="grid grid-cols-3 gap-px bg-white/5 border-b border-white/10">
          {[
            { label: 'Active CS Programs', value: activeCount },
            { label: 'IX Headroom', value: `${metrics.utilitiesWithIXHeadroom}+` },
            { label: 'Policy Alerts', value: metrics.policyAlertsThisWeek },
          ].map(m => (
            <div key={m.label} className="bg-[#0a2f25] px-4 py-3">
              <div className="text-2xl font-bold text-white tabular-nums">{m.value}</div>
              <div className="text-[10px] text-white/40 mt-0.5 leading-tight">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Simulated state list */}
        <div className="px-4 py-3">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
            Top Opportunity States
          </div>
          <div className="space-y-1.5">
            {sampleStates.map(s => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-xs font-mono text-white/50 w-5">{s.id}</span>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${s.score}%`,
                      backgroundColor: s.status === 'active' ? '#0F6E56' : '#BA7517',
                    }}
                  />
                </div>
                <span className="text-xs text-white/60 w-6 text-right">{s.score}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Simulated alert feed */}
        <div className="border-t border-white/10 px-4 py-3">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
            Recent Policy Alerts
          </div>
          <div className="space-y-2">
            {[
              { tag: 'Offtake', state: 'IL', text: 'Illinois Shines capacity expanded under new CEJA rules' },
              { tag: 'IX',      state: 'MN', text: 'Xcel Solar Garden queue moving — new block open' },
            ].map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0 ${
                  a.tag === 'IX' ? 'bg-accent/20 text-accent-300' : 'bg-primary/30 text-primary-200'
                }`}>
                  {a.tag}
                </span>
                <p className="text-[10px] text-white/50 leading-tight">{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── main component ───────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="pt-14">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-[#063629] text-white">
        <div className="max-w-dashboard mx-auto px-6 py-20 lg:py-28 grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-white/70 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Community Solar Market Intelligence
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight mb-6">
              The intelligence edge most small developers{' '}
              <span className="text-accent">don't have.</span>
            </h1>

            <p className="text-lg text-white/70 leading-relaxed mb-8 max-w-lg">
              Site control constraints, interconnection queue status, and offtake program
              capacity — all in one platform. Built for the 1–10 person shop competing
              against teams with dedicated research staff.
            </p>

            <div className="flex flex-wrap items-center gap-4 mb-10">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-400 text-white font-semibold rounded-lg transition-colors text-sm shadow-lg shadow-accent/20"
              >
                Get Started Free
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                  <polyline points="12 5 19 12 12 19"/>
                </svg>
              </Link>
              <Link
                to="/preview"
                className="text-sm font-medium text-white/60 hover:text-white transition-colors"
              >
                Preview live data →
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-sm text-white/50">
              {[
                'Free dashboard access',
                'No credit card required',
                'Real state program data',
              ].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <IconCheck />
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right — dashboard preview */}
          <DashboardPreview />
        </div>
      </section>

      {/* ── Metrics strip ────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-dashboard mx-auto px-6 py-10 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { value: activeCount,                        label: 'Active CS Programs',           sub: 'across the U.S.' },
            { value: `${metrics.utilitiesWithIXHeadroom}+`, label: 'Utilities with IX Headroom', sub: 'tracked and scored'  },
            { value: activeCount + limitedCount,         label: 'States Fully Mapped',          sub: 'site, IX & offtake'   },
            { value: '3',                                label: 'Intelligence Pillars',         sub: 'site · IX · offtake'  },
          ].map(m => (
            <div key={m.label} className="text-center lg:text-left">
              <div className="text-3xl font-bold text-primary">{m.value}</div>
              <div className="text-sm font-semibold text-gray-800 mt-1">{m.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Three pillars ────────────────────────────────────────────────── */}
      <section className="bg-surface py-20">
        <div className="max-w-dashboard mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Three pillars. Every project stage covered.
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Community solar development lives or dies on three questions. Tractova is
              organized to answer all three before you commit capital.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {[
              {
                icon: <IconSite />,
                number: '01',
                title: 'Site Control',
                color: 'text-primary',
                bg: 'bg-primary-50',
                border: 'border-primary-100',
                description:
                  'Land availability, USDA farmland classification, wetland flags, and land use restrictions — by county. Know if a site is buildable before you spend a dollar on site control.',
                bullets: [
                  'Wetland & floodplain risk flags',
                  'Prime farmland designation alerts',
                  'County-level land use notes',
                ],
              },
              {
                icon: <IconIX />,
                number: '02',
                title: 'Interconnection',
                color: 'text-accent',
                bg: 'bg-accent-50',
                border: 'border-accent-100',
                description:
                  'Queue status, ease scores (1–10), and average study timelines for utilities across every active CS state. The most differentiated data layer in the platform — built because nobody has done this cleanly.',
                bullets: [
                  'Utility ease scores (1–10)',
                  'Queue saturation status',
                  'Avg study timeline by utility',
                ],
              },
              {
                icon: <IconOfftake />,
                number: '03',
                title: 'Offtake',
                color: 'text-[#1A6B9A]',
                bg: 'bg-blue-50',
                border: 'border-blue-100',
                description:
                  'Program capacity remaining, LMI subscriber requirements, and the full revenue stack (state incentive + IRA ITC adders) for every active and limited community solar state.',
                bullets: [
                  'Program capacity & status',
                  'LMI allocation requirements',
                  'IRA ITC adder eligibility',
                ],
              },
            ].map(p => (
              <div key={p.title} className={`bg-white border ${p.border} rounded-xl p-8`}>
                <div className="flex items-start justify-between mb-6">
                  <div className={`p-2.5 ${p.bg} ${p.color} rounded-lg`}>
                    {p.icon}
                  </div>
                  <span className="text-4xl font-bold text-gray-100">{p.number}</span>
                </div>
                <h3 className={`text-lg font-bold ${p.color} mb-3`}>{p.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-5">{p.description}</p>
                <ul className="space-y-2">
                  {p.bullets.map(b => (
                    <li key={b} className="flex items-center gap-2 text-sm text-gray-500">
                      <span className={`${p.color} flex-shrink-0`}><IconCheck /></span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────────────────────── */}
      <section className="bg-white py-20 border-t border-gray-100">
        <div className="max-w-dashboard mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — copy */}
          <div>
            <div className="text-xs font-semibold text-primary uppercase tracking-widest mb-4">
              Built for who, exactly
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-5">
              The 1–10 person shop.<br />
              The developer who has real projects<br />
              and no research team.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-6">
              Nexamp, Ameresco, and the large IPPs have entire teams pulling interconnection
              queue data, monitoring state program capacity, and flagging policy changes.
              You don't. Tractova is the team you can't afford to hire.
            </p>
            <p className="text-gray-500 leading-relaxed mb-8">
              We built Tractova for developers who are simultaneously in site control
              negotiations, navigating a MISO interconnection application, and watching
              an ILSFA block fill — all without dedicated policy or finance staff.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Create a free account
            </Link>
          </div>

          {/* Right — not-for list */}
          <div className="space-y-4">
            <div className="rounded-xl bg-primary-50 border border-primary-100 p-6">
              <div className="text-sm font-semibold text-primary mb-3">Tractova is for</div>
              <ul className="space-y-2.5">
                {[
                  'Independent community solar developers (1–10 people)',
                  'C&I solar developers expanding into community solar',
                  'Project finance professionals evaluating new state markets',
                  'Developers tracking multiple projects across states',
                ].map(t => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <span className="text-primary mt-0.5 flex-shrink-0"><IconCheck /></span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl bg-gray-50 border border-gray-200 p-6">
              <div className="text-sm font-semibold text-gray-500 mb-3">Not designed for</div>
              <ul className="space-y-2.5">
                {[
                  'Large IPPs with in-house intelligence teams',
                  'Utility-scale developers (>50MW projects)',
                  'Residential solar installers',
                  'EPC or procurement teams',
                ].map(t => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-gray-400">
                    <span className="mt-0.5 flex-shrink-0 text-gray-300">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="bg-surface py-20 border-t border-gray-100">
        <div className="max-w-dashboard mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">How it works</h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              From a raw site address to a three-pillar intelligence report in under two minutes.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden lg:block absolute top-8 left-1/3 right-1/3 h-px bg-gray-200" />

            {[
              {
                step: '1',
                title: 'Search your project',
                body: 'Enter state, county, project size, development stage, and technology type. Tractova Lens pulls the relevant intelligence for that exact context.',
              },
              {
                step: '2',
                title: 'Get targeted intelligence',
                body: 'A three-pillar report populates instantly — site control flags, serving utility and ease score, offtake program status, and full revenue stack.',
              },
              {
                step: '3',
                title: 'Track your pipeline',
                body: 'Save projects to your library. Get alerts when program capacity drops, interconnection queue status changes, or policy shifts in your project\'s state.',
              },
            ].map((s, i) => (
              <div key={i} className="relative flex flex-col items-center text-center lg:items-start lg:text-left">
                <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold mb-5 relative z-10 shadow-lg shadow-primary/20">
                  {s.step}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Adder callout ─────────────────────────────────────────────── */}
      <section className="bg-white border-t border-gray-100 py-14">
        <div className="max-w-dashboard mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div>
            <div className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">
              From the same team
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">The Adder Newsletter</h3>
            <p className="text-sm text-gray-500 max-w-lg">
              A bi-weekly newsletter covering community solar policy, interconnection trends, and
              market moves for independent developers. Free and opinionated.
            </p>
          </div>
          <a
            href="https://theadder.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 border border-accent text-accent hover:bg-accent hover:text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Read The Adder ↗
          </a>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="bg-[#063629] text-white py-20">
        <div className="max-w-dashboard mx-auto px-6 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Start building smarter.
          </h2>
          <p className="text-white/60 text-lg mb-8 max-w-md mx-auto">
            Free access to the market dashboard. No credit card required.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/signup"
              className="px-8 py-3 bg-accent hover:bg-accent-400 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-accent/20"
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
