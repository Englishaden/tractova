import { Link, useLocation } from 'react-router-dom'
import { useDataRefresh } from '../lib/useDataRefresh'
import CmdKHint from './CmdKHint'

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

  // Route-aware theming — mirrors Nav.jsx. The Dashboard route (`/`) renders
  // on the dark `dashboard-dark` scope, so the footer needs to match or the
  // cream footer reads as a giant white slab beneath a dark page (Aden
  // 2026-05-28: "the bottom of the dashboard tab is white and contrasts too
  // much"). Every other page stays on the cream brand surface.
  const location = useLocation()
  const isDashboardRoute = location.pathname === '/'

  const scope = isDashboardRoute ? {
    bg:         '#0B1623',
    border:     '#1F2A3D',
    brand:      '#F5F7FA',  // --text-primary
    tagline:    '#6C7A91',  // --text-muted
    refreshFg:  isStale ? '#FBBF24' : '#98A4B6',
    linkBase:   '#98A4B6',  // --text-label
    linkHover:  '#5EEAD4',
    copyright:  '#4A5468',  // --text-disabled
  } : {
    bg:         '#FFFFFF',
    border:     '#E5E7EB',
    brand:      '#0A1828',
    tagline:    '#9CA3AF',
    refreshFg:  isStale ? '#B45309' : '#9CA3AF',
    linkBase:   '#9CA3AF',
    linkHover:  '#374151',
    copyright:  '#D1D5DB',
  }

  return (
    <footer
      className="border-t mt-10 relative z-10 transition-colors"
      style={{ background: scope.bg, borderColor: scope.border }}
    >
      {/* ⌘K cue — static, parked in the margin gap just above the footer's
          top border on the right, over the © cluster (Aden 2026-05-29). */}
      <div className="max-w-dashboard mx-auto px-6 relative">
        <CmdKHint />
      </div>
      <div className="max-w-dashboard mx-auto px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-6">
        <div className="flex items-center gap-3 md:gap-6 flex-wrap">
          <span className="text-base font-serif font-semibold tracking-tight" style={{ letterSpacing: '-0.02em', color: scope.brand }}>Tractova</span>
          <span className="text-xs" style={{ color: scope.tagline }}>
            Intelligence for the moment that matters.
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-6 flex-wrap">
          <span
            className="text-xs font-mono tabular-nums transition-colors"
            style={{ color: scope.refreshFg }}
            title={absoluteIso ? `Data refreshed: ${absoluteIso}` : undefined}
          >
            Data refreshed: {relativeLabel ?? '—'}
          </span>
          <FooterLink to="/about"   scope={scope}>About</FooterLink>
          <FooterLink to="/privacy" scope={scope}>Privacy</FooterLink>
          <FooterLink to="/terms"   scope={scope}>Terms</FooterLink>
          <span className="text-xs font-mono" style={{ color: scope.copyright }}>© {new Date().getFullYear()} Tractova</span>
        </div>
      </div>
    </footer>
  )
}

// Small helper — inline-styled link with hover transition driven by scope.
function FooterLink({ to, scope, children }) {
  return (
    <Link
      to={to}
      className="text-xs transition-colors"
      style={{ color: scope.linkBase }}
      onMouseEnter={(e) => { e.currentTarget.style.color = scope.linkHover }}
      onMouseLeave={(e) => { e.currentTarget.style.color = scope.linkBase }}
    >
      {children}
    </Link>
  )
}
