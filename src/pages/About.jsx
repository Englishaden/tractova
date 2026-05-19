import { Link } from 'react-router-dom'

// About Tractova
//
// Founder-led narrative page. Matches the Landing visual language (navy hero,
// teal accent rails, serif headings, mono eyebrows) so the marketing surfaces
// read as one family. Copy is grounded in verifiable positioning — background
// is described by function only; no current or prior employer is named here.
// Any narrow data-citation disclosure stays in the Privacy Policy.

const TEAL = '#14B8A6'
const TEAL_DEEP = '#0F766E'
const NAVY_GRADIENT = 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)'
const TEAL_RAIL =
  'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.6) 30%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.6) 70%, transparent 100%)'

export default function About() {
  return (
    <div className="pt-14">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="text-white relative" style={{ background: NAVY_GRADIENT }}>
        <div className="absolute top-0 left-0 right-0 h-px z-10" style={{ background: TEAL_RAIL }} />
        <div className="max-w-dashboard mx-auto px-6 py-20 lg:py-28">
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] font-bold mb-5" style={{ color: '#5EEAD4' }}>
              ◆ About Tractova
            </p>
            <h1 className="text-4xl lg:text-5xl font-serif font-semibold leading-tight tracking-tight mb-6" style={{ letterSpacing: '-0.02em' }}>
              The intelligence big developers take for granted.{' '}
              <span style={{ color: '#2DD4BF' }}>Built for the shops that can't afford it.</span>
            </h1>
            <p className="text-lg text-white/70 leading-relaxed">
              Tractova answers the one question every developer has to answer before
              spending real money on a project — <em>is this a go or a no-go?</em> —
              in minutes, from public data, at a price an independent shop can actually pay.
            </p>
          </div>
        </div>
      </section>

      {/* ── Why Tractova exists ──────────────────────────────────────────── */}
      <section className="bg-paper border-b border-gray-200 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <Eyebrow>Why Tractova exists</Eyebrow>
          <h2 className="text-2xl lg:text-3xl font-serif font-semibold text-ink mb-6" style={{ letterSpacing: '-0.02em' }}>
            Small developers get the short end of the stick.
          </h2>
          <div className="space-y-5 text-[15px] text-gray-600 leading-relaxed">
            <p>
              Tractova was built by someone who watched it happen from the finance side.
              Two and a half years in renewable-energy project finance — underwriting
              utility-scale solar and storage portfolios, sale-leasebacks, construction
              debt, and tax-equity structures — makes one pattern impossible to miss:
              <strong className="text-ink"> almost nothing in this industry gets done without
              a stack of expensive opinions.</strong>
            </p>
            <p>
              Legal fees. Independent-engineer costs to underwrite the design so a bank can
              underwrite its own opinion of that design. Financing costs layered on top.
              Each one shaves the return — and that's <em>after</em> you've spent years
              building relationships in banking and tax equity that make the deal possible
              at all.
            </p>
            <p>
              Large, vertically integrated developers absorb that. They have in-house
              finance, legal, design, and operations. Small developers don't. They're lean
              shops — often raising local capital at high rates, often just trying to
              originate, flip, or run turnkey work. And they're asked to spend tens to
              hundreds of thousands of dollars on early development — site control, leases,
              interconnection applications, permitting — <strong className="text-ink">just to
              find out whether a project was ever viable.</strong>
            </p>
            <p>
              They don't have the team to build investment-bank-grade models, or to pay a
              consultant to opine on FEOC exposure, domestic content, or prevailing wage.
              They run on spreadsheets, word of mouth, and relationships built before the
              IRA reshaped the math. And too often the only way to get a project financed
              is to partner with a large firm — and watch ownership of the thing they
              originated slip away.
            </p>
            <p className="text-ink font-medium">
              Tractova exists to move the go/no-go decision earlier, and make it cost a
              fraction of what it costs today.
            </p>
          </div>
        </div>
      </section>

      {/* ── The name ─────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-200 py-16">
        <div className="max-w-3xl mx-auto px-6">
          <Eyebrow>The name</Eyebrow>
          <h2 className="text-2xl font-serif font-semibold text-ink mb-5" style={{ letterSpacing: '-0.02em' }}>
            From <span className="italic">tractus</span> — a stretch of land.
          </h2>
          <div className="space-y-4 text-[15px] text-gray-600 leading-relaxed">
            <p>
              <strong className="text-ink">Tractova</strong> comes from the Latin{' '}
              <span className="italic">tractus</span> — a tract, a stretch of land — and the
              Roman practice of staking out land parcels for survey. It's also a quiet play
              on words: a place to <strong className="text-ink">track</strong> your projects.
            </p>
            <p>
              The brand mark carries it through — a surveyor's baseline with tick marks, a
              nod to the Roman <span className="italic">tractus</span> who measured ground
              before anything was built on it. That's the job: measure the ground first.
            </p>
          </div>
        </div>
      </section>

      {/* ── What Tractova does ───────────────────────────────────────────── */}
      <section className="bg-paper border-b border-gray-200 py-20">
        <div className="max-w-dashboard mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <Eyebrow>What it does</Eyebrow>
            <h2 className="text-2xl lg:text-3xl font-serif font-semibold text-ink mb-4" style={{ letterSpacing: '-0.02em' }}>
              One decision. Three pillars.
            </h2>
            <p className="text-[15px] text-gray-600 leading-relaxed">
              Every early-stage call comes down to the same question — <em>is this a go or
              a no-go?</em> — and in community solar, the answer rests on three things.
              Tractova is organized around all three.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                n: '01',
                title: 'Offtake',
                body: 'The revenue structure — usually a function of state policy. Is the program open, is capacity left, what does the incentive stack actually pay, and can you meet the LMI requirements to enter at all?',
              },
              {
                n: '02',
                title: 'Interconnection',
                body: 'Whether the grid can take the project. Queue saturation, utility ease scores, and study timelines — the layer most likely to quietly kill a project after the money is spent.',
              },
              {
                n: '03',
                title: 'Site control',
                body: 'Whether the land is buildable. Wetlands, prime-farmland classification, and land-use constraints — the difference between a parcel worth optioning and one that never had a chance.',
              },
            ].map((p) => (
              <div key={p.n} className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="font-mono text-[11px] font-bold" style={{ color: TEAL_DEEP }}>{p.n}</span>
                  <h3 className="text-base font-bold text-ink">{p.title}</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>

          <p className="text-[13px] text-gray-500 leading-relaxed mt-8 max-w-2xl">
            Get those three wrong — a structurally weak incentive, a capped queue, wetlands
            across the parcel — and no amount of later diligence saves the project. Tractova
            surfaces them first, before the expensive part begins.
          </p>
        </div>
      </section>

      {/* ── Honest by design ─────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-200 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <Eyebrow>Honest about what it is</Eyebrow>
          <h2 className="text-2xl lg:text-3xl font-serif font-semibold text-ink mb-6" style={{ letterSpacing: '-0.02em' }}>
            Tractova covers the 80%. It will never claim the last 20%.
          </h2>
          <div className="space-y-5 text-[15px] text-gray-600 leading-relaxed">
            <p>
              No screening tool can tell you a project is financeable, and Tractova doesn't
              pretend to. What it does is cover roughly the{' '}
              <strong className="text-ink">80% of early-stage diligence that's knowable from
              public data</strong> — the federal, state, and ISO/RTO record — and surface the
              handful of things most likely to end a project before you've committed capital.
            </p>
            <p>
              The last 20% — title work, environmental studies, a real interconnection
              application, legal review — still belongs to the specialists. Tractova's job is
              to tell you whether it's worth paying them.
            </p>
            <p>
              And it's honest about its own data. Every number traces back to a verifiable
              source. Where a state's sample is thin, or its incentive design leaves no paper
              trail, Tractova labels the estimate as an estimate rather than dressing it up as
              fact. Screening decisions deserve numbers you can audit — not a confident guess.
            </p>
          </div>
        </div>
      </section>

      {/* ── Who's behind it ──────────────────────────────────────────────── */}
      <section className="bg-paper border-b border-gray-200 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <Eyebrow>Who's behind it</Eyebrow>
          <h2 className="text-2xl lg:text-3xl font-serif font-semibold text-ink mb-6" style={{ letterSpacing: '-0.02em' }}>
            One person, building something worth owning.
          </h2>
          <div className="space-y-5 text-[15px] text-gray-600 leading-relaxed">
            <p>
              Tractova is built and run by <strong className="text-ink">Aden Walker</strong> —
              a renewable-energy project finance analyst, based in Boston. The two and a half
              years spent underwriting utility-scale solar and storage deals — sale-leasebacks,
              construction debt, tax-equity structures, IRA compliance — are where the gap that
              Tractova fills first became obvious.
            </p>
            <p>
              It's a deliberately independent project. Tractova isn't venture-backed and isn't
              chasing an exit. It's built by one person who wants to <em>own</em> something —
              and who will put in as many hours as it takes, because the ethics of smaller-scale
              renewable development are genuinely worth the work.
            </p>
            <p>
              Cheap, fast, early-stage screening sounds like a small thing. But making it
              easier to learn whether a clean-energy project can happen compounds — and
              resilient, accessible electricity is one of the highest-leverage things a
              developer can build. Tractova starts with U.S. community solar. The ambition,
              over time, is wider: emerging markets, energy access, and the early-stage
              decisions that decide whether projects there ever break ground.
            </p>
          </div>
        </div>
      </section>

      {/* ── The Adder ────────────────────────────────────────────────────── */}
      <section className="bg-white border-b border-gray-200 py-14">
        <div className="max-w-dashboard mx-auto px-6 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: TEAL_DEEP }}>
              From the same desk
            </div>
            <h3 className="text-xl font-serif font-semibold text-ink mb-2" style={{ letterSpacing: '-0.02em' }}>
              The Adder Newsletter
            </h3>
            <p className="text-sm text-gray-500 max-w-lg">
              Notes on community solar policy and the market forces that move it — built so
              developers can stay ahead of the regulation that decides their projects. Free,
              and opinionated.
            </p>
          </div>
          <a
            href="https://theadder.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors"
            style={{ border: `1px solid ${TEAL}`, color: TEAL_DEEP }}
            onMouseEnter={(e) => { e.currentTarget.style.background = TEAL; e.currentTarget.style.color = '#FFFFFF' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = TEAL_DEEP }}
          >
            Read The Adder ↗
          </a>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
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
              style={{ background: TEAL, boxShadow: '0 8px 24px rgba(20,184,166,0.25)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = TEAL_DEEP }}
              onMouseLeave={(e) => { e.currentTarget.style.background = TEAL }}
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

// ── Tiny presentation helper ─────────────────────────────────────────────────
function Eyebrow({ children }) {
  return (
    <p
      className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold mb-3"
      style={{ color: TEAL_DEEP }}
    >
      {children}
    </p>
  )
}
