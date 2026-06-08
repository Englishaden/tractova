import { Link } from 'react-router-dom'
import IntelligenceBackground from '../components/IntelligenceBackground'
import WalkingTractovaMark from '../components/WalkingTractovaMark'
import TealRail from '../components/ui/TealRail'
import MountReveal from '../components/ui/MountReveal'
import CountUp from '../components/ui/CountUp'
import AnimatedList from '../components/ui/AnimatedList'
import SpotlightCard from '../components/ui/SpotlightCard'
import { DATA_SOURCES, dataSourcesByPillar, METHODOLOGY_DISCLOSURE } from '../lib/dataSources'

// ── /methodology — public data-source citation map ──────────────────────────
// The trust surface promised in the 2026-06 data audit (Wave 2). Renders the
// SAME registry (src/lib/dataSources.js) the XLSX export's Methodology sheet
// uses, so the two can't drift. Every row shows the two-layer split the platform
// is built on: what the SOURCE publishes (observed) vs what Tractova SYNTHESIZES
// on top. Public (no auth) — it's the page we point a skeptical developer or
// investor at. Mirrors the Glossary's visual language (navy hero · TealRail ·
// aurora · SpotlightCard rows) so the reference surfaces read as one family.

// Pillar accent — matches the Lens pillar palette (offtake teal, IX amber,
// incentives green, site blue, policy slate; composite/cross-pillar navy).
const PILLAR_ACCENT = {
  'Composite':        { dot: '#0F1A2E', text: '#0F1A2E', weight: '' },
  'Offtake':          { dot: '#0F766E', text: '#0F766E', weight: '25%' },
  'Interconnection':  { dot: '#D97706', text: '#B45309', weight: '25%' },
  'Incentives':       { dot: '#15803D', text: '#15803D', weight: '20%' },
  'Site':             { dot: '#2563EB', text: '#1D4ED8', weight: '20%' },
  'Policy & Timing':  { dot: '#475569', text: '#475569', weight: '10%' },
  'Cross-pillar':     { dot: '#0F1A2E', text: '#5A6B7A', weight: '' },
}

// Tier badge — A/A-/B+/B = sourced (teal/green); C = Tractova-editorial (amber);
// D = placeholder (red). Matches the data-trust-audit tier framework.
function tierStyle(tier) {
  const t = (tier || '').replace(/[-+]/g, '')
  if (t === 'A') return { bg: 'rgba(15,118,110,0.10)', color: '#0F766E', border: 'rgba(15,118,110,0.25)' }
  if (t === 'B') return { bg: 'rgba(37,99,235,0.10)', color: '#1D4ED8', border: 'rgba(37,99,235,0.22)' }
  if (t === 'C') return { bg: 'rgba(217,119,6,0.10)', color: '#B45309', border: 'rgba(217,119,6,0.25)' }
  return { bg: 'rgba(220,38,38,0.10)', color: '#DC2626', border: 'rgba(220,38,38,0.25)' }
}

export default function Methodology() {
  const groups = dataSourcesByPillar()

  return (
    <div className="min-h-screen bg-paper relative">
      <IntelligenceBackground />
      <WalkingTractovaMark triggerProbability={0.30} sessionGate={true} />

      <main className="relative max-w-dashboard mx-auto px-6 pt-20 pb-16">
        {/* Hero — navy with teal rail + aurora (matches Glossary) */}
        <div className="mt-6 mb-8">
          <div className="relative rounded-xl px-8 py-7 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}>
            <TealRail />
            <div className="absolute inset-0 opacity-[0.04]" aria-hidden="true" style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0px,#fff 1px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,#fff 0px,#fff 1px,transparent 1px,transparent 32px)' }} />
            <div className="absolute inset-0 lp-aurora opacity-60 pointer-events-none" aria-hidden="true" />

            <div className="relative flex items-start justify-between gap-6">
              <MountReveal>
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="relative inline-flex w-1.5 h-1.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping" style={{ background: '#14B8A6' }} />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.65)' }} />
                  </span>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: '#5EEAD4' }}>Data Methodology</span>
                  <span className="w-px h-3" style={{ background: 'rgba(20,184,166,0.40)' }} />
                  <span className="font-mono text-[10px] tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <CountUp value={DATA_SOURCES.length} /> SOURCES
                  </span>
                </div>
                <h1 className="font-serif text-3xl font-semibold text-white tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                  Sources &amp; Methodology
                </h1>
                <p className="text-sm mt-2 leading-relaxed max-w-2xl" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Every number in Tractova traces to a source. This is the full citation map — grouped by scoring pillar, each row split into what the source <span className="text-white/90 font-medium">publishes</span> and what Tractova <span className="text-white/90 font-medium">synthesizes</span> on top. The same registry powers the Methodology sheet in every Excel export.
                </p>
              </MountReveal>
              <div className="hidden sm:block shrink-0 text-right" aria-hidden="true">
                <div className="font-mono text-[10px] leading-5 select-none" style={{ color: 'rgba(94,234,212,0.40)' }}>
                  <div>observed · synthesized</div>
                  <div>tier A → D</div>
                  <div style={{ color: 'rgba(20,184,166,0.55)' }}>v{new Date().getFullYear()}.1</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Standing disclosure — the honest preamble (also leads the XLSX sheet) */}
        <MountReveal delay={0.06}>
          <div className="mb-8 rounded-lg border px-5 py-4 flex items-start gap-3"
            style={{ background: 'rgba(217,119,6,0.05)', borderColor: 'rgba(217,119,6,0.20)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="#B45309" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: '#92400E' }}>How to read this</p>
              <p className="text-[13px] leading-relaxed" style={{ color: '#78350F' }}>{METHODOLOGY_DISCLOSURE}</p>
            </div>
          </div>
        </MountReveal>

        {/* Tier legend */}
        <MountReveal delay={0.1}>
          <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Source tier</span>
            {[
              { t: 'A', label: 'Primary · live' },
              { t: 'B', label: 'Primary · static' },
              { t: 'C', label: 'Tractova editorial' },
              { t: 'D', label: 'Placeholder' },
            ].map(({ t, label }) => {
              const s = tierStyle(t)
              return (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-sm border" style={{ background: s.bg, color: s.color, borderColor: s.border }}>{t}</span>
                  <span className="text-[11px] text-gray-500">{label}</span>
                </span>
              )
            })}
          </div>
        </MountReveal>

        {/* Pillar-grouped source rows */}
        <div className="space-y-9">
          {groups.map((group) => {
            const accent = PILLAR_ACCENT[group.pillar] || PILLAR_ACCENT['Cross-pillar']
            return (
              <section key={group.pillar}>
                <h2 className="font-serif text-2xl font-semibold mb-3 flex items-center gap-3" style={{ color: '#5A6B7A' }}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: accent.dot }} />
                  <span style={{ color: accent.text }}>{group.pillar}</span>
                  {accent.weight && (
                    <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: 'rgba(15,26,46,0.05)', color: accent.text }}>{accent.weight}</span>
                  )}
                  <span className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">{group.rows.length}</span>
                </h2>
                <AnimatedList as="div" itemAs="div" delay={0.04} className="grid gap-4">
                  {group.rows.map((s) => {
                    const ts = tierStyle(s.tier)
                    return (
                      <SpotlightCard
                        key={`${group.pillar}-${s.component}`}
                        glow="rgba(20,184,166,0.12)"
                        size={300}
                        className="group rounded-lg border border-gray-200 bg-white px-6 py-5 overflow-hidden transition-all duration-300 motion-reduce:transition-none hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:border-teal-300 hover:shadow-[0_12px_30px_-12px_rgba(20,184,166,0.22)]"
                      >
                        <TealRail className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 motion-reduce:transition-none" />
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="min-w-0">
                            <h3 className="font-serif text-base font-semibold text-ink" style={{ letterSpacing: '-0.01em' }}>{s.component}</h3>
                            <p className="text-[12px] font-medium mt-0.5" style={{ color: accent.text }}>{s.source}</p>
                          </div>
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-sm border shrink-0" style={{ background: ts.bg, color: ts.color, borderColor: ts.border }} title="Source tier">
                            Tier {s.tier}
                          </span>
                        </div>

                        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                          <div className="rounded-md px-3 py-2.5" style={{ background: 'rgba(15,118,110,0.04)', border: '1px solid rgba(15,118,110,0.12)' }}>
                            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: '#0F766E' }}>Source publishes</p>
                            <p className="text-[12px] leading-relaxed text-gray-700">{s.provides}</p>
                          </div>
                          <div className="rounded-md px-3 py-2.5" style={{ background: 'rgba(217,119,6,0.05)', border: '1px solid rgba(217,119,6,0.14)' }}>
                            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: '#B45309' }}>Tractova synthesizes</p>
                            <p className="text-[12px] leading-relaxed text-gray-700">{s.synthesis}</p>
                          </div>
                        </div>

                        {s.url && (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-3 font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-sm border border-gray-200 text-gray-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                          >
                            View source
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        )}
                      </SpotlightCard>
                    )
                  })}
                </AnimatedList>
              </section>
            )
          })}
        </div>

        {/* Footer CTA — connect the reference surfaces (Methodology ↔ Glossary ↔ About) */}
        <div className="mt-10">
          <SpotlightCard
            glow="rgba(20,184,166,0.14)"
            size={360}
            className="group relative rounded-lg border border-gray-200 bg-white px-6 py-5 overflow-hidden flex items-center justify-between gap-4 flex-wrap"
          >
            <TealRail className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 motion-reduce:transition-none" />
            <div>
              <p className="font-serif text-base font-semibold text-ink">Want the definitions too?</p>
              <p className="text-sm text-gray-500 mt-0.5">
                The <Link to="/glossary" className="text-teal-700 hover:text-teal-800 font-medium">Glossary</Link> explains every term used across the platform — or read the <Link to="/about" className="text-teal-700 hover:text-teal-800 font-medium">story behind Tractova</Link>.
              </p>
            </div>
            <Link
              to="/glossary"
              className="shrink-0 inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:border-primary hover:text-primary transition-colors"
            >
              Open Glossary →
            </Link>
          </SpotlightCard>
        </div>
      </main>
    </div>
  )
}
