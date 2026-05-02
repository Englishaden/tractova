import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// Relative-time formatter for the "Data refreshed" caption. Resolves to:
//   <60s          → "just now"
//   <60min        → "Nm ago"
//   <24h          → "Nh ago"
//   <14d          → "Nd ago"
//   ≥14d          → falls back to absolute date
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
  // Source: /api/data-health?action=last-refresh — public endpoint that
  // returns max(cron_runs.finished_at WHERE status='success'). This is the
  // genuine "when did data last refresh" timestamp. No DB migration needed
  // (cron_runs is already populated by every cron + manual admin Refresh).
  // Falls back gracefully if the endpoint fails (renders just "—").
  const [refreshAt, setRefreshAt] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/data-health?action=last-refresh')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return
        if (data?.finishedAt) setRefreshAt(data.finishedAt)
      })
      .catch(err => {
        // Footer caption is a nice-to-have; degrade silently to no value.
        console.warn('[Footer] last-refresh fetch failed:', err)
      })
    return () => { cancelled = true }
  }, [])

  // Auto-tick every 30s so a long-open tab doesn't drift to stale-looking
  // labels (e.g. stays at "5m ago" instead of updating to "1h ago").
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!refreshAt) return
    const t = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [refreshAt])

  const relativeLabel = refreshAt ? formatRelativeTime(refreshAt) : null
  const absoluteIso   = refreshAt ? new Date(refreshAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : null
  const ageMs         = refreshAt ? Date.now() - new Date(refreshAt).getTime() : null
  const isStale       = ageMs != null && ageMs > 7 * 86400000

  return (
    <footer className="border-t border-gray-200 bg-white mt-10 relative z-10">
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
            title={absoluteIso ? `Data refreshed: ${absoluteIso}` : undefined}
          >
            Data refreshed: {relativeLabel ?? '—'}
          </span>
          <a
            href="https://theadder.substack.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            The Adder Newsletter ↗
          </a>
          <Link to="/privacy" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
            Privacy
          </Link>
          <Link to="/terms" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
            Terms
          </Link>
          <span className="text-xs font-mono text-gray-300">© {new Date().getFullYear()} Tractova</span>
        </div>
      </div>
    </footer>
  )
}
