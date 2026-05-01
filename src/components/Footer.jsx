import { useState, useEffect } from 'react'
import { getDashboardMetrics } from '../lib/programData'

// Relative-time formatter for the "Data refreshed" caption. Resolves to:
//   <60s          → "just now"
//   <60min        → "Nm ago"
//   <24h          → "Nh ago"
//   <14d          → "Nd ago"
//   ≥14d          → falls back to absolute date (the relative time stops
//                    being intuitive past two weeks; a date is clearer)
function formatRelativeTime(iso) {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return null
  const seconds = Math.floor((Date.now() - then) / 1000)
  if (seconds < 60)         return 'just now'
  if (seconds < 60 * 60)    return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 60 * 60 * 24) return `${Math.floor(seconds / 3600)}h ago`
  const days = Math.floor(seconds / 86400)
  if (days < 14)            return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Footer() {
  // lastRefreshAt is the genuine "data last refreshed" timestamp — sourced
  // from cron_runs.finished_at (most recent successful run across any
  // source). Pre-migration-040 this field is undefined and we fall back to
  // the legacy lastUpdated (state_programs.last_verified) which is less
  // accurate but at least non-null.
  const [refreshAt, setRefreshAt] = useState(null)
  const [legacyDate, setLegacyDate] = useState(null)

  useEffect(() => {
    getDashboardMetrics().then(m => {
      setRefreshAt(m?.lastRefreshAt || null)
      setLegacyDate(m?.lastUpdated || null)
    }).catch(err => {
      // Footer "data refreshed" caption is a nice-to-have; degrades to no
      // caption rather than blocking footer render.
      console.warn('[Footer] getDashboardMetrics failed:', err)
    })
  }, [])

  // Relative-time display refreshes every 30s so a long-open tab doesn't
  // drift to "stale-looking" labels (e.g. stays at "5m ago" instead of
  // updating to "1h ago"). Only ticks if we have a real refreshAt to update.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!refreshAt) return
    const t = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [refreshAt])

  // Compute display values. tick is in deps so the relative-time updates.
  const relativeLabel = refreshAt ? formatRelativeTime(refreshAt) : null
  const absoluteIso   = refreshAt ? new Date(refreshAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : null
  const ageMs         = refreshAt ? Date.now() - new Date(refreshAt).getTime() : null
  const isStale       = ageMs != null && ageMs > 7 * 86400000  // amber when >7 days

  // Honest copy. If we have a real refresh timestamp from cron_runs, show
  // it. If migration 040 isn't applied yet, fall back to the legacy
  // last_verified date with the legacy "last updated" wording.
  const displayValue = relativeLabel ?? (legacyDate ?? '—')
  const displayLabel = refreshAt ? 'Data refreshed' : 'Data last updated'
  void tick  // referenced so eslint doesn't flag the dep-only state

  return (
    <footer className="border-t border-gray-200 bg-white mt-10">
      <div className="max-w-dashboard mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-6">
        <div className="flex items-center gap-3 md:gap-6 flex-wrap">
          <span className="text-base font-serif font-semibold tracking-tight text-ink" style={{ letterSpacing: '-0.02em' }}>Tractova</span>
          <span className="text-xs text-gray-400">
            Intelligence for the moment that matters.
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap">
          <span
            className="text-xs font-mono tabular-nums"
            style={{ color: isStale ? '#B45309' : '#9CA3AF' }}
            title={absoluteIso ? `${displayLabel}: ${absoluteIso}` : undefined}
          >
            {displayLabel}: {displayValue}
          </span>
          <a
            href="https://theadder.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            The Adder Newsletter ↗
          </a>
          <span className="text-xs font-mono text-gray-300">© {new Date().getFullYear()} Tractova</span>
        </div>
      </div>
    </footer>
  )
}
