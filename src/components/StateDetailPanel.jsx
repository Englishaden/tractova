import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import * as RadixTabs from '@radix-ui/react-tabs'
import { motion } from 'motion/react'
import { supabase } from '../lib/supabase'
import TractovaLoader from './ui/TractovaLoader'
import { useSubscription } from '../hooks/useSubscription'
import { getPucDockets, getLmiData } from '../lib/programData'
import RegulatoryActivityPanel from './RegulatoryActivityPanel'
import CoverageBadge from './CoverageBadge'
import PreviewSignupGate from './PreviewSignupGate'

// Module-level cache: per-state AI summary, 24h TTL. Survives page-internal
// remounts so flipping between states + back doesn't re-spend tokens.
// Keyed by `${stateId}::${YYYY-MM-DD}` so the day rolls forward automatically.
const _stateNewsSummaryCache = new Map()
const todayKey = () => new Date().toISOString().slice(0, 10)

function formatRelativeDate(date) {
  const now = new Date()
  const diffMs = now - date
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Updated today'
  if (diffDays === 1) return 'Updated yesterday'
  if (diffDays < 7)  return `Updated ${diffDays} days ago`
  if (diffDays < 30) return `Updated ${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`
  return `Updated ${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`
}

// Dark-surface chip palette (2026-05-27 dashboard revamp). Teal/amber/red
// transparency-on-dark instead of the light pastels — reads on the
// #131C2C cards-bg without the "light pill on dark panel" mismatch.
const STATUS_CONFIG = {
  active:  { label: 'Active Program',   cls: 'bg-[rgba(20,184,166,0.15)] text-[#5EEAD4] border border-[rgba(20,184,166,0.35)]' },
  limited: { label: 'Limited Capacity', cls: 'bg-[rgba(251,191,36,0.12)] text-[#FBBF24] border border-[rgba(251,191,36,0.32)]' },
  pending: { label: 'Pending Launch',   cls: 'bg-[rgba(251,191,36,0.08)] text-[#FBBF24] border border-[rgba(251,191,36,0.25)]' },
  none:    { label: 'No Program',       cls: 'bg-[var(--bg-surface)] text-[var(--text-label)] border border-[var(--cards-border)]' },
}

const IX_CONFIG = {
  easy:      { label: 'Easy',      cls: 'text-[#5EEAD4] bg-[rgba(20,184,166,0.12)] border-[rgba(20,184,166,0.30)]' },
  moderate:  { label: 'Moderate',  cls: 'text-[#FBBF24] bg-[rgba(251,191,36,0.10)] border-[rgba(251,191,36,0.28)]' },
  hard:      { label: 'Hard',      cls: 'text-[#FB923C] bg-[rgba(251,146,60,0.10)] border-[rgba(251,146,60,0.28)]' },
  very_hard: { label: 'Very Hard', cls: 'text-[#F87171] bg-[rgba(248,113,113,0.10)] border-[rgba(248,113,113,0.28)]' },
}

function ScoreBar({ score }) {
  const pct = Math.max(0, Math.min(100, score))
  // V3: align fill color with the choropleth ramp
  let barColor = '#F0FDFA'
  if (pct >= 75) barColor = '#0F766E'
  else if (pct >= 60) barColor = '#14B8A6'
  else if (pct >= 45) barColor = '#2DD4BF'
  else if (pct >= 25) barColor = '#99F6E4'

  return (
    <div>
      <div className="flex items-end gap-2 mb-1">
        <span className="text-3xl font-bold font-mono text-[var(--text-primary)] tabular-nums">{pct}</span>
        <span className="text-sm text-[var(--text-muted)] mb-1">/ 100</span>
        <span className="text-xs text-[var(--text-muted)] mb-1 ml-1">feasibility index</span>
      </div>
      <div className="w-full h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  )
}

function StatRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--cards-border)] last:border-0">
      <span className="text-xs text-[var(--text-label)]">{label}</span>
      <span className={`text-xs font-semibold font-mono tabular-nums`} style={{ color: highlight ? 'var(--link, #5EEAD4)' : 'var(--text-primary)' }}>{value}</span>
    </div>
  )
}

const RUNWAY_COLORS = {
  strong:   { bg: '#DCFCE7', text: '#14532D' },
  moderate: { bg: '#FEF3C7', text: '#78350F' },
  watch:    { bg: '#FFEDD5', text: '#7C2D12' },
  urgent:   { bg: '#FEE2E2', text: '#7F1D1D' },
}

// Brighter fills for the runway-pressure bar (the RUNWAY_COLORS.text shades
// are dark, tuned for text-on-light, and read muddy as a bar). More runway
// remaining = fuller, calmer bar; a short red bar = act now.
const RUNWAY_BAR = {
  strong:   '#14B8A6',
  moderate: '#F59E0B',
  watch:    '#F97316',
  urgent:   '#DC2626',
}

const TABS = [
  { id: 'program',     label: 'Program' },
  { id: 'market',      label: 'Market' },
  { id: 'subscribers', label: 'Subscribers' },
  { id: 'news',        label: 'News' },
  { id: 'regulatory',  label: 'Regulatory' },
]

// V3: Radix-driven tab trigger with mono uppercase eyebrow + teal underline.
// Same visual language as Library tabs and Lens AI commentary -- one shared
// editorial pattern across data surfaces.
function StateTabTrigger({ value, label, count }) {
  return (
    <RadixTabs.Trigger
      value={value}
      className="relative px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-label)] transition-colors hover:text-[var(--text-primary)] data-[state=active]:text-[var(--text-primary)] data-[state=active]:after:absolute data-[state=active]:after:left-2 data-[state=active]:after:right-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-[2px] data-[state=active]:after:rounded-t data-[state=active]:after:bg-[#0F766E] outline-hidden focus-visible:bg-[var(--bg-surface)]"
    >
      <span>{label}</span>
      {count != null && count > 0 && (
        <span className="ml-1.5 text-[9px] text-[var(--text-muted)] font-mono normal-case tracking-normal">({count})</span>
      )}
    </RadixTabs.Trigger>
  )
}

function StateTabContent({ value, children }) {
  return (
    <RadixTabs.Content value={value} className="outline-hidden">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </RadixTabs.Content>
  )
}

// ── Program tab ────────────────────────────────────────────────────────────
function ProgramTab({ state, runway }) {
  if (state.csStatus === 'none') {
    return (
      <div className="px-5 py-6 text-center">
        <p className="text-xs text-[var(--text-label)]">No community solar program in {state.name}.</p>
        <p className="text-[11px] text-[var(--text-muted)] mt-1">Monitor for legislative activity or pivot to C&I/PPA structures.</p>
      </div>
    )
  }
  return (
    <div className="px-5 py-4 space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Program Identity</h3>
        <div className="bg-[var(--bg-surface)] rounded-md p-3 space-y-0.5">
          <StatRow label="Program name" value={state.csProgram || '—'} />
          <StatRow label="Status" value={STATUS_CONFIG[state.csStatus]?.label || '—'} />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Capacity</h3>
        <div className="bg-[var(--bg-surface)] rounded-md p-3 space-y-0.5">
          <StatRow label="Remaining capacity" value={state.capacityMW > 0 ? `${state.capacityMW.toLocaleString()} MW` : '—'} highlight />
          {runway && (
            <div className="py-1.5 border-b border-[var(--cards-border)] last:border-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[var(--text-label)]">Est. program runway</span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-sm font-mono tabular-nums"
                  style={{ background: RUNWAY_COLORS[runway.urgency].bg, color: RUNWAY_COLORS[runway.urgency].text }}
                >
                  ~{runway.months} mo{runway.urgency === 'watch' ? ' · watch' : runway.urgency === 'urgent' ? ' · act now' : ''}
                </span>
              </div>
              {/* Runway-pressure bar: fill = months against a 24-mo reference
                  (illustrative, not a % of capacity — we don't store original
                  total). A short red bar = act now; a fuller teal bar = headroom. */}
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.max(4, Math.min(100, Math.round((runway.months / 24) * 100)))}%`,
                    background: RUNWAY_BAR[runway.urgency] || '#14B8A6',
                  }}
                />
              </div>
            </div>
          )}
          {state.enrollmentRateMWPerMonth && (
            <StatRow label="Enrollment pace" value={`~${state.enrollmentRateMWPerMonth} MW/mo`} />
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Eligibility</h3>
        <div className="bg-[var(--bg-surface)] rounded-md p-3 space-y-0.5">
          <StatRow label="LMI allocation required" value={state.lmiRequired ? `Yes — ${state.lmiPercent}%` : 'No'} />
        </div>
      </div>

      {state.programNotes && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Notes</h3>
          <div className="bg-[var(--bg-surface)] rounded-md p-3">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{state.programNotes}</p>
          </div>
        </div>
      )}

      {/* DSIRE verification footer removed 2026-05-11. The integration
          never produced a row across cron_runs history (DSIRE moved to
          paid licensing); state_program data is Tractova-curated from
          state PUC program-administrator portals. */}
    </div>
  )
}

// ── Market tab ─────────────────────────────────────────────────────────────
function MarketTab({ state }) {
  const ixCfg = IX_CONFIG[state.ixDifficulty] || IX_CONFIG.moderate
  return (
    <div className="px-5 py-4 space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Interconnection</h3>
        <div className="bg-[var(--bg-surface)] rounded-md p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-[var(--text-label)]">Difficulty rating:</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm border ${ixCfg.cls}`}>
              {ixCfg.label}
            </span>
          </div>
          {state.ixNotes && <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{state.ixNotes}</p>}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">Feasibility Index</h3>
        <div className="bg-[var(--bg-surface)] rounded-md p-3">
          <ScoreBar score={state.feasibilityScore} />
          <p className="text-[11px] text-[var(--text-muted)] mt-2 leading-relaxed">
            Composite of Offtake (40%), Interconnection (35%), and Site Control (25%).
            Per-county breakdown available in <Link to={`/search?state=${state.id}`} className="underline decoration-dotted underline-offset-2 hover:no-underline" style={{ color: 'var(--link, #5EEAD4)' }}>Lens</Link>.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Subscribers tab — Subscriber Acquisition Intel slice (Wave 2) ──────────
// Fetches state-level LMI intel from migration 025's `lmi_data` table and
// renders a directive subscriber-sourcing analysis. State-level v1; per-
// county density + CBO directory deferred to Phase 2.
function SubscribersTab({ state }) {
  const [lmi, setLmi] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getLmiData(state.id).then(rows => {
      if (!cancelled) { setLmi(rows); setLoading(false) }
    }).catch(() => { if (!cancelled) { setLmi(null); setLoading(false) } })
    return () => { cancelled = true }
  }, [state.id])

  // Useful demo MWs for the carve-out calculator. The first MW that
  // triggers a non-zero subscriber requirement is what most early-stage
  // CS developers actually plan around.
  const DEMO_MW = [2, 5, 10]
  const subscribersForMW = (mw) => {
    // Same formula used by api/lens-insight.js: ~2 kW per residential
    // subscription, lmi_percent of total capacity must be carved out.
    const totalSubs = Math.round((mw * 1000) / 2)
    const lmiSubs   = Math.round(totalSubs * (state.lmiPercent / 100))
    return { totalSubs, lmiSubs }
  }

  const fmtNum = (n) => n == null ? '—' : n.toLocaleString()
  const fmtUSD = (n) => n == null ? '—' : `$${n.toLocaleString()}`

  return (
    <div className="px-5 py-4 space-y-4">
      {/* LMI carve-out requirement */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">LMI Carve-out Requirement</h3>
        <div className="bg-[var(--bg-surface)] rounded-md p-3">
          {state.lmiRequired ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--text-primary)] font-mono tabular-nums">
                {state.lmiPercent}% of subscriber capacity
              </p>
              <p className="text-[11px] text-[var(--text-label)] leading-relaxed">
                Every project must allocate {state.lmiPercent}% of its capacity to qualifying low-to-moderate income households.
                Plan for 6–9 months of LMI subscriber sourcing through CBO partnerships and aggregator contracts.
              </p>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">No LMI carve-out requirement — full residential and commercial subscriber market is available.</p>
          )}
        </div>
      </div>

      {/* LMI eligibility — population context */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">LMI Eligibility · {state.name}</h3>
        {loading ? (
          <div className="bg-[var(--bg-surface)] rounded-md p-3">
            <div className="flex items-center gap-2 text-[11px] text-[var(--text-label)]">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#14B8A6' }} />
              Loading Census data…
            </div>
          </div>
        ) : !lmi ? (
          <div className="bg-[var(--bg-surface)] rounded-md p-3 border border-dashed border-[var(--cards-border)]">
            <p className="text-[11px] text-[var(--text-label)] leading-relaxed">
              Census ACS data not yet seeded for this state. State-program LMI requirements above still apply.
            </p>
          </div>
        ) : (
          <div className="bg-[var(--bg-surface)] rounded-md p-3 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SubStat label="LMI households (≤80% AMI)" value={fmtNum(lmi.lmiHouseholds)} sub={`${lmi.lmiPct.toFixed(0)}% of all ${state.name} households`} />
              <SubStat label="Total households (statewide)" value={fmtNum(lmi.totalHouseholds)} sub="2018-2022 ACS 5-yr estimate" />
              <SubStat label="Median household income" value={fmtUSD(lmi.medianHouseholdIncome)} sub={`80% AMI: ${fmtUSD(lmi.ami80Pct)}`} />
              <SubStat label="Source" value="US Census ACS" sub="2018-2022 5-year" mono={false} />
            </div>
          </div>
        )}
      </div>

      {/* Subscriber-count calculator — only when there's a carve-out to plan around */}
      {state.lmiRequired && state.lmiPercent > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">LMI Subscribers per Project Size</h3>
          <div className="bg-[var(--bg-surface)] rounded-md p-3">
            <p className="text-[11px] text-[var(--text-label)] leading-relaxed mb-2.5">
              Approximate LMI households you'd need to enroll, assuming ~2 kW residential subscriptions and the {state.lmiPercent}% carve-out:
            </p>
            <div className="grid grid-cols-3 gap-3">
              {DEMO_MW.map(mw => {
                const { lmiSubs, totalSubs } = subscribersForMW(mw)
                return (
                  <div key={mw} className="rounded-md px-3 py-2.5 bg-[var(--cards-bg)] border border-[var(--cards-border)]">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#0F766E] mb-0.5">
                      {mw} MW project
                    </p>
                    <p className="font-mono text-base font-bold tabular-nums text-[var(--text-primary)] leading-none">
                      ~{fmtNum(lmiSubs)}
                    </p>
                    <p className="text-[10px] text-[var(--text-label)] mt-0.5">
                      LMI households (of ~{fmtNum(totalSubs)} total subscribers)
                    </p>
                  </div>
                )
              })}
            </div>
            {lmi && (
              <p className="text-[10px] text-[var(--text-muted)] mt-2.5 leading-relaxed">
                {state.name} has ~{fmtNum(lmi.lmiHouseholds)} LMI households statewide, so subscriber sourcing volume is generally not the bottleneck — channel access (CBO partners, aggregator agreements) typically is.
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  )
}

// Sub-stat renderer for the LMI eligibility grid.
function SubStat({ label, value, sub, mono = true }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#0F766E] mb-0.5">{label}</p>
      <p className={`text-sm font-semibold text-[var(--text-primary)] ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-label)] mt-0.5 leading-relaxed">{sub}</p>}
    </div>
  )
}

// ── News tab ───────────────────────────────────────────────────────────────
function NewsTab({ state, news }) {
  const cacheKey = `${state.id}::${todayKey()}`
  const cachedSummary = _stateNewsSummaryCache.get(cacheKey) ?? null
  const [summary, setSummary] = useState(cachedSummary)
  // Initial summaryLoading mirrors cache state — same fix pattern as
  // NewsFeed.jsx so the TractovaLoader is visible from first paint when a
  // fresh fetch is going to happen, not flash briefly mid-flight.
  const [summaryLoading, setSummaryLoading] = useState(!cachedSummary)
  // Collapsible (default closed) — matches the dashboard NewsFeed Market
  // Pulse pattern so users get consistent AI-summary disclosure.
  const [pulseOpen, setPulseOpen] = useState(false)

  // Fetch a state-scoped AI pulse the first time the user lands on this tab.
  // Cached per-state per-day so revisiting is free; one paragraph synthesizing
  // the recent items into "what matters for this state's developers."
  useEffect(() => {
    if (summary) { setSummaryLoading(false); return }
    if (news.length === 0) return  // pulseLoading stays true until news arrives
    if (_stateNewsSummaryCache.has(cacheKey)) {
      setSummary(_stateNewsSummaryCache.get(cacheKey))
      setSummaryLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) { setSummaryLoading(false); return }
        const items = news.slice(0, 12).map(n => ({
          headline: n.headline,
          summary: n.summary,
          pillar: n.pillar,
          source: n.source,
        }))
        const res = await fetch('/api/lens-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'news-summary', items, state: state.name }),
        })
        if (cancelled) return
        if (!res.ok) { setSummaryLoading(false); return }
        const json = await res.json()
        if (!cancelled && json.summary) {
          _stateNewsSummaryCache.set(cacheKey, json.summary)
          setSummary(json.summary)
        }
        setSummaryLoading(false)
      } catch {
        if (!cancelled) setSummaryLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [cacheKey, news.length])

  if (news.length === 0) {
    return (
      <div className="px-5 py-6 text-center">
        <p className="text-xs text-[var(--text-muted)]">No recent activity for {state.name}.</p>
        <p className="text-[11px] text-gray-300 mt-1">Check back as policy developments are tracked.</p>
      </div>
    )
  }

  return (
    <div className="px-5 py-4">
      {/* AI pulse — state-scoped synthesis (Pro only; free users silently skip).
          Collapsible with chevron toggle, default closed. While loading, the
          TractovaLoader is shown inline whether collapsed or expanded so the
          user sees the brand loader instead of a generic dot. */}
      {(summary || summaryLoading) && (
        <div
          className="mb-4 rounded-md overflow-hidden"
          style={{ background: 'rgba(15,118,110,0.05)', border: '1px solid rgba(15,118,110,0.18)' }}
        >
          <button
            type="button"
            onClick={() => setPulseOpen(o => !o)}
            className="w-full px-3 py-2 flex items-center gap-2 text-left transition-colors hover:brightness-95"
            aria-expanded={pulseOpen}
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.20em]" style={{ color: '#0F766E' }}>
              ◆ Market Pulse · {state.name}
            </span>
            {/* Inline preview when collapsed */}
            {!pulseOpen && summary && (
              <span className="flex-1 min-w-0 text-[11px] text-[var(--text-label)] truncate">{summary}</span>
            )}
            {!pulseOpen && summaryLoading && !summary && (
              <span className="flex-1 min-w-0 flex items-center gap-2">
                <TractovaLoader size={14} />
                <span className="text-[11px] text-[var(--text-label)]">Synthesizing recent activity…</span>
              </span>
            )}
            <svg
              width="11" height="11" viewBox="0 0 24 24"
              fill="none" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="shrink-0 transition-transform"
              style={{ transform: pulseOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {pulseOpen && (
            <div className="px-3 pb-2.5 -mt-0.5">
              {summaryLoading && !summary ? (
                <div className="flex items-center gap-3 py-1">
                  <TractovaLoader size={32} />
                  <p className="text-[11px] text-[var(--text-label)] leading-tight">
                    Synthesizing recent activity…
                  </p>
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed text-[var(--text-primary)]">{summary}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {news.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-[var(--bg-surface)] rounded-md p-3 hover:bg-[var(--bg-surface)] transition-colors"
          >
            <p className="text-xs font-medium text-[var(--text-primary)] leading-snug">{item.headline}</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-1 font-mono">
              {item.source} · {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function StateDetailPanel({ state, news = [], onClose, previewMode = false, delta = null }) {
  // V3 Wave 2 — fetch live PUC docket count for the regulatory tab badge
  // and the panel content. Cached at the data-layer (1h TTL) so flipping
  // states + back is free.
  const [docketCount, setDocketCount] = useState(null)
  const { isPro } = useSubscription()

  useEffect(() => {
    if (!state?.id) { setDocketCount(null); return }
    let cancelled = false
    getPucDockets({ state: state.id }).then(rows => {
      if (!cancelled) setDocketCount((rows || []).length)
    }).catch(() => { if (!cancelled) setDocketCount(0) })
    return () => { cancelled = true }
  }, [state?.id])

  if (!state) return null

  const status = STATUS_CONFIG[state.csStatus] || STATUS_CONFIG.none
  const runway = state.runway ?? null

  const relatedNews = news.filter(
    (item) => (item.stateIds ?? item.tags ?? []).includes(state.id)
  ).slice(0, 6)

  const latestDate = (() => {
    const v = state.lastVerified ? new Date(state.lastVerified) : null
    const u = state.updatedAt   ? new Date(state.updatedAt)   : null
    if (v && u) return v > u ? v : u
    return v || u
  })()
  const lastUpdatedFmt = latestDate ? formatRelativeDate(latestDate) : null
  const lastUpdatedFull = latestDate
    ? latestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="bg-[var(--cards-bg)] border border-[var(--cards-border)] rounded-lg flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--cards-border)] shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{state.name}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.cls}`}>
                {status.label}
              </span>
              <CoverageBadge tier={state.coverageTier} />
              {/* WoW score-movement chip — mirrors the map pulse + Markets-on-
                  the-Move strip. Only shown when this state actually moved. */}
              {Number.isFinite(delta) && delta !== 0 && (
                <span
                  className="text-xs font-semibold font-mono tabular-nums px-2 py-0.5 rounded-full inline-flex items-center gap-0.5"
                  style={{
                    color: delta > 0 ? '#0F766E' : '#DC2626',
                    background: delta > 0 ? 'rgba(15,118,110,0.08)' : 'rgba(220,38,38,0.08)',
                    border: `1px solid ${delta > 0 ? 'rgba(15,118,110,0.25)' : 'rgba(220,38,38,0.25)'}`,
                  }}
                  title={`Feasibility score ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)} point${Math.abs(delta) === 1 ? '' : 's'} week-over-week`}
                >
                  {delta > 0 ? '▲' : '▼'}{Math.abs(delta)} pts this week
                </span>
              )}
            </div>
            {state.csProgram && (
              <p className="text-xs text-[var(--text-label)] mt-0.5">{state.csProgram}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1 -m-1 rounded-sm shrink-0"
            aria-label="Close state panel"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        </div>

        {/* Score header */}
        <div className="mt-4">
          <ScoreBar score={state.feasibilityScore} />
        </div>

        {/* BIG Run a Lens CTA — Aden 2026-05-27: "Run lens should be bigger
            as its a centerpiece to the next phase of our product." Promoted
            from a small top-right pill to a full-width gradient button below
            the score; takes the user from "this market's vital signs" to
            "deep-dive analysis for a specific project in this state." */}
        <Link
          to={`/search?state=${state.id}`}
          className="dash-ai-glow mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-md font-bold text-sm transition-all hover:brightness-110 group"
          style={{
            background: 'linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)',
            color: '#FFFFFF',
            boxShadow: '0 6px 20px -6px rgba(20,184,166,0.55)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/>
            <line x1="20" y1="20" x2="16.65" y2="16.65"/>
          </svg>
          <span>Run a Lens on {state.id}</span>
          <span className="ml-1 text-base leading-none transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
        <p className="mt-1.5 text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
          Single-project deep-dive · 60 sec to a feasibility verdict
        </p>
      </div>

      {/* V3: Radix-driven tabs — replaces hand-rolled TabBar. Adds keyboard
          navigation (arrow keys), focus management, and Motion fade. */}
      <RadixTabs.Root defaultValue="program" className="flex-1 flex flex-col min-h-0">
        {/* V3 Wave 2 — Regulatory tab is curation-gated. Hidden until admin
            curates ≥1 docket for the state, so we don't show an empty tab
            users can click into and find nothing. Admin tab in /admin
            remains available regardless. */}
        <RadixTabs.List className="flex border-b border-[var(--cards-border)] px-3 bg-[var(--bg-surface)] shrink-0">
          <StateTabTrigger value="program"     label="Program" />
          <StateTabTrigger value="market"      label="Market" />
          <StateTabTrigger value="subscribers" label="Subscribers" />
          <StateTabTrigger value="news"        label="News" count={relatedNews.length} />
          {(docketCount ?? 0) > 0 && (
            <StateTabTrigger value="regulatory"  label="Regulatory" count={docketCount} />
          )}
        </RadixTabs.List>

        <div className="flex-1 overflow-y-auto">
          <StateTabContent value="program"><ProgramTab state={state} runway={runway} /></StateTabContent>
          <StateTabContent value="market">
            {previewMode
              ? <div className="px-5 py-5"><PreviewSignupGate message={`Market intelligence for ${state.name} — interconnection difficulty, serving utilities, sub-score breakdowns. Sign up free to explore.`} /></div>
              : <MarketTab state={state} />}
          </StateTabContent>
          <StateTabContent value="subscribers">
            {previewMode
              ? <div className="px-5 py-5"><PreviewSignupGate message={`Subscriber-acquisition intelligence for ${state.name} — LMI density, CCA penetration, CBO partner directory. Sign up free to explore.`} /></div>
              : <SubscribersTab state={state} />}
          </StateTabContent>
          <StateTabContent value="news">
            {previewMode
              ? <div className="px-5 py-5"><PreviewSignupGate message={`Recent ${state.name} policy & market news with AI-summarized market pulse. Sign up free to read all the items.`} /></div>
              : <NewsTab state={state} news={relatedNews} />}
          </StateTabContent>
          {(docketCount ?? 0) > 0 && (
            <StateTabContent value="regulatory">
              <RegulatoryActivityPanel
                state={state.id}
                stateName={state.name}
                isPro={isPro}
                mode="tab"
              />
            </StateTabContent>
          )}
        </div>
      </RadixTabs.Root>

      {/* Footer — dark-themed (was bg-chrome / legacy cream brand) */}
      <div
        className="px-4 py-2 border-t border-[var(--cards-border)] rounded-b-lg flex items-center justify-between shrink-0"
        style={{ background: 'var(--bg-surface)' }}
      >
        {lastUpdatedFmt && (
          <p className="text-[10px] text-[var(--text-muted)] group relative cursor-default font-mono uppercase tracking-[0.16em]">
            {lastUpdatedFmt}
            {lastUpdatedFull && (
              <span
                className="absolute bottom-full left-0 mb-1 px-2 py-1 text-[10px] rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-75 whitespace-nowrap pointer-events-none"
                style={{ background: 'var(--cards-bg)', color: 'var(--text-primary)', border: '1px solid var(--cards-border)' }}
              >
                {lastUpdatedFull}
              </span>
            )}
          </p>
        )}
        <Link
          to={`/search?state=${state.id}`}
          className="text-[11px] font-mono uppercase tracking-[0.18em] font-semibold transition-colors underline decoration-dotted underline-offset-2 hover:no-underline"
          style={{ color: 'var(--link, #5EEAD4)' }}
        >
          Analyze in Lens →
        </Link>
      </div>
    </div>
  )
}
