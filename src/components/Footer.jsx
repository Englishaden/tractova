import { Link } from 'react-router-dom'
import { useDataRefresh } from '../lib/useDataRefresh'

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
  // Shared freshness signal (max(cron_runs.finished_at WHERE status='success')
  // via /api/data-health?action=last-refresh). The hook fetches on mount and
  // re-fetches on the admin Refresh broadcast / window focus / poll, and ticks
  // every 30s so the relative label keeps aging. Renders "—" until it resolves.
  const refreshAt = useDataRefresh()

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
          <Link to="/about" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
            About
          </Link>
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
