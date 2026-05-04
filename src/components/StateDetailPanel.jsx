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

const STATUS_CONFIG = {
  active:  { label: 'Active Program',   cls: 'bg-primary-50 text-primary-700 border border-primary-300 ring-1 ring-primary-200' },
  limited: { label: 'Limited Capacity', cls: 'bg-amber-50 text-amber-700 border border-amber-300' },
  pending: { label: 'Pending Launch',   cls: 'bg-yellow-50 text-yellow-700 border border-yellow-300' },
  none:    { label: 'No Program',       cls: 'bg-gray-100 text-gray-500 border border-gray-200' },
}

const IX_CONFIG = {
  easy:      { label: 'Easy',      cls: 'text-primary-700 bg-primary-50 border-primary-200' },
  moderate:  { label: 'Moderate',  cls: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  hard:      { label: 'Hard',      cls: 'text-orange-700 bg-orange-50 border-orange-200' },
  very_hard: { label: 'Very Hard', cls: 'text-red-700 bg-red-50 border-red-200' },
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
        <span className="text-3xl font-bold font-mono text-gray-900 tabular-nums">{pct}</span>
        <span className="text-sm text-gray-400 mb-1">/ 100</span>
        <span className="text-xs text-gray-400 mb-1 ml-1">feasibility index</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  )
}

function StatRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? 'text-primary' : 'text-gray-800'} font-mono tabular-nums`}>{value}</span>
    </div>
  )
}

const RUNWAY_COLORS = {
  strong:   { bg: '#DCFCE7', text: '#14532D' },
  moderate: { bg: '#FEF3C7', text: '#78350F' },
  watch:    { bg: '#FFEDD5', text: '#7C2D12' },
  urgent:   { bg: '#FEE2E2', text: '#7F1D1D' },
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
      className="relative px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted transition-colors hover:text-ink data-[state=active]:text-ink data-[state=active]:after:absolute data-[state=active]:after:left-2 data-[state=active]:after:right-2 data-[state=active]:after:-bottom-px data-[state=active]:after:h-[2px] data-[state=active]:after:rounded-t data-[state=active]:after:bg-[#0F766E] outline-hidden focus-visible:bg-gray-100"
    >
      <span>{label}</span>
      {count != null && count > 0 && (
        <span className="ml-1.5 text-[9px] text-gray-400 font-mono normal-case tracking-normal">({count})</span>
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
        <p className="text-xs text-gray-500">No community solar program in {state.name}.</p>
        <p className="text-[11px] text-gray-400 mt-1">Monitor for legislative activity or pivot to C&I/PPA structures.</p>
      </div>
    )
  }
  return (
    <div className="px-5 py-4 space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Program Identity</h3>
        <div className="bg-surface rounded-md p-3 space-y-0.5">
          <StatRow label="Program name" value={state.csProgram || '—'} />
          <StatRow label="Status" value={STATUS_CONFIG[state.csStatus]?.label || '—'} />
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Capacity</h3>
        <div className="bg-surface rounded-md p-3 space-y-0.5">
          <StatRow label="Remaining capacity" value={state.capacityMW > 0 ? `${state.capacityMW.toLocaleString()} MW` : '—'} highlight />
          {runway && (
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-500">Est. program runway</span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-sm font-mono tabular-nums"
                style={{ background: RUNWAY_COLORS[runway.urgency].bg, color: RUNWAY_COLORS[runway.urgency].text }}
              >
                ~{runway.months} mo{runway.urgency === 'watch' ? ' · watch' : runway.urgency === 'urgent' ? ' · act now' : ''}
              </span>
            </div>
          )}
          {state.enrollmentRateMWPerMonth && (
            <StatRow label="Enrollment pace" value={`~${state.enrollmentRateMWPerMonth} MW/mo`} />
          )}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Eligibility</h3>
        <div className="bg-surface rounded-md p-3 space-y-0.5">
          <StatRow label="LMI allocation required" value={state.lmiRequired ? `Yes — ${state.lmiPercent}%` : 'No'} />
        </div>
      </div>

      {state.programNotes && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Notes</h3>
          <div className="bg-surface rounded-md p-3">
            <p className="text-xs text-gray-600 leading-relaxed">{state.programNotes}</p>
          </div>
        </div>
      )}

      {/* DSIRE verification footer — populated by refresh-data?source=state_programs.
          Renders only when the cron has run and produced a match. Quiet by design;
          the principle is "we cross-verify" without being self-congratulatory. */}
      {state.dsireLastVerified && (
        <div
          className="rounded-md px-3 py-2.5 mt-1"
          style={{ background: 'rgba(20,184,166,0.04)', border: '1px solid rgba(20,184,166,0.18)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.20em] font-semibold" style={{ color: '#0F766E' }}>
              ◆ Cross-verified · DSIRE
            </span>
            {state.dsireMatchQuality === 'partial' && (
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-amber-700">partial match</span>
            )}
            {state.dsireMatchQuality === 'none' && (
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-gray-500">no DSIRE match</span>
            )}
          </div>
          <p className="text-[11px] text-gray-600 leading-relaxed">
            {state.dsireMatchQuality === 'none'
              ? 'No matching DSIRE entry found for this state\'s CS program. Source data is Tractova-curated; DSIRE coverage may lag for newer programs.'
              : 'Tractova\'s state program data is cross-checked against the DSIRE database (NCSU + DOE-funded), the canonical free index of state renewable-energy incentives.'}
            {' '}
            <span className="font-mono tabular-nums text-gray-400">
              Last verified {new Date(state.dsireLastVerified).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            {state.dsireProgramUrl && (
              <>
                {' · '}
                <a href={state.dsireProgramUrl} target="_blank" rel="noopener noreferrer"
                  className="font-medium hover:underline"
                  style={{ color: '#0F766E' }}>
                  View on DSIRE ↗
                </a>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Market tab ─────────────────────────────────────────────────────────────
function MarketTab({ state }) {
  const ixCfg = IX_CONFIG[state.ixDifficulty] || IX_CONFIG.moderate
  return (
    <div className="px-5 py-4 space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Interconnection</h3>
        <div className="bg-surface rounded-md p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500">Difficulty rating:</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm border ${ixCfg.cls}`}>
              {ixCfg.label}
            </span>
          </div>
          {state.ixNotes && <p className="text-xs text-gray-600 leading-relaxed">{state.ixNotes}</p>}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Feasibility Index</h3>
        <div className="bg-surface rounded-md p-3">
          <ScoreBar score={state.feasibilityScore} />
          <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
            Composite of Offtake (40%), Interconnection (35%), and Site Control (25%).
            Per-county breakdown available in <Link to={`/search?state=${state.id}`} className="text-primary hover:underline">Lens</Link>.
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
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">LMI Carve-out Requirement</h3>
        <div className="bg-surface rounded-md p-3">
          {state.lmiRequired ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-800 font-mono tabular-nums">
                {state.lmiPercent}% of subscriber capacity
              </p>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                Every project must allocate {state.lmiPercent}% of its capacity to qualifying low-to-moderate income households.
                Plan for 6–9 months of LMI subscriber sourcing through CBO partnerships and aggregator contracts.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-600">No LMI carve-out requirement — full residential and commercial subscriber market is available.</p>
          )}
        </div>
      </div>

      {/* LMI eligibility — population context */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">LMI Eligibility · {state.name}</h3>
        {loading ? (
          <div className="bg-surface rounded-md p-3">
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#14B8A6' }} />
              Loading Census data…
            </div>
          </div>
        ) : !lmi ? (
          <div className="bg-surface rounded-md p-3 border border-dashed border-gray-300">
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Census ACS data not yet seeded for this state. State-program LMI requirements above still apply.
            </p>
          </div>
        ) : (
          <div className="bg-surface rounded-md p-3 space-y-2.5">
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
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">LMI Subscribers per Project Size</h3>
          <div className="bg-surface rounded-md p-3">
            <p className="text-[11px] text-gray-500 leading-relaxed mb-2.5">
              Approximate LMI households you'd need to enroll, assuming ~2 kW residential subscriptions and the {state.lmiPercent}% carve-out:
            </p>
            <div className="grid grid-cols-3 gap-3">
              {DEMO_MW.map(mw => {
                const { lmiSubs, totalSubs } = subscribersForMW(mw)
                return (
                  <div key={mw} className="rounded-md px-3 py-2.5 bg-white border border-gray-200">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#0F766E] mb-0.5">
                      {mw} MW project
                    </p>
                    <p className="font-mono text-base font-bold tabular-nums text-ink leading-none">
                      ~{fmtNum(lmiSubs)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      LMI households (of ~{fmtNum(totalSubs)} total subscribers)
                    </p>
                  </div>
                )
              })}
            </div>
            {lmi && (
              <p className="text-[10px] text-gray-400 mt-2.5 leading-relaxed">
                {state.name} has ~{fmtNum(lmi.lmiHouseholds)} LMI households statewide, so subscriber sourcing volume is generally not the bottleneck — channel access (CBO partners, aggregator agreements) typically is.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Phase 2 placeholder — what's still coming */}
      <div className="bg-surface rounded-md p-3 border border-dashed border-gray-300">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400 mb-1">Coming next</p>
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Per-county LMI density (Census ACS county-level) · CCA enrollment penetration · CBO partner directory.
        </p>
      </div>
    </div>
  )
}

// Sub-stat renderer for the LMI eligibility grid.
function SubStat({ label, value, sub, mono = true }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#0F766E] mb-0.5">{label}</p>
      <p className={`text-sm font-semibold text-gray-800 ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{sub}</p>}
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
        <p className="text-xs text-gray-400">No recent activity for {state.name}.</p>
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
              <span className="flex-1 min-w-0 text-[11px] text-gray-500 truncate">{summary}</span>
            )}
            {!pulseOpen && summaryLoading && !summary && (
              <span className="flex-1 min-w-0 flex items-center gap-2">
                <TractovaLoader size={14} />
                <span className="text-[11px] text-ink-muted">Synthesizing recent activity…</span>
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
                  <p className="text-[11px] text-ink-muted leading-tight">
                    Synthesizing recent activity…
                  </p>
                </div>
              ) : (
                <p className="text-[12px] leading-relaxed text-ink">{summary}</p>
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
            className="block bg-surface rounded-md p-3 hover:bg-gray-100 transition-colors"
          >
            <p className="text-xs font-medium text-gray-800 leading-snug">{item.headline}</p>
            <p className="text-[11px] text-gray-400 mt-1 font-mono">
              {item.source} · {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function StateDetailPanel({ state, news = [], onClose, previewMode = false }) {
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
    <div className="bg-white border border-gray-200 rounded-lg flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">{state.name}</h2>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.cls}`}>
                {status.label}
              </span>
              <CoverageBadge tier={state.coverageTier} />
            </div>
            {state.csProgram && (
              <p className="text-xs text-gray-500 mt-0.5">{state.csProgram}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/search?state=${state.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-700 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Search in Lens
            </Link>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 transition-colors p-1 -m-1 rounded-sm"
              aria-label="Close state panel"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.293 4.293a1 1 0 011.414 0L8 6.586l2.293-2.293a1 1 0 111.414 1.414L9.414 8l2.293 2.293a1 1 0 01-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 01-1.414-1.414L6.586 8 4.293 5.707a1 1 0 010-1.414z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Score header */}
        <div className="mt-4">
          <ScoreBar score={state.feasibilityScore} />
        </div>
      </div>

      {/* V3: Radix-driven tabs — replaces hand-rolled TabBar. Adds keyboard
          navigation (arrow keys), focus management, and Motion fade. */}
      <RadixTabs.Root defaultValue="program" className="flex-1 flex flex-col min-h-0">
        {/* V3 Wave 2 — Regulatory tab is curation-gated. Hidden until admin
            curates ≥1 docket for the state, so we don't show an empty tab
            users can click into and find nothing. Admin tab in /admin
            remains available regardless. */}
        <RadixTabs.List className="flex border-b border-gray-200 px-3 bg-gray-50 shrink-0">
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

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-gray-100 bg-chrome rounded-b-lg flex items-center justify-between">
        {lastUpdatedFmt && (
          <p className="text-xs text-gray-400 group relative cursor-default">
            {lastUpdatedFmt}
            {lastUpdatedFull && (
              <span className="absolute bottom-full left-0 mb-1 px-2 py-1 text-[10px] bg-gray-800 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-75 whitespace-nowrap pointer-events-none">
                {lastUpdatedFull}
              </span>
            )}
          </p>
        )}
        <Link
          to={`/search?state=${state.id}`}
          className="text-xs font-medium text-primary hover:text-primary-700 transition-colors"
        >
          Analyze in Lens →
        </Link>
      </div>
    </div>
  )
}
