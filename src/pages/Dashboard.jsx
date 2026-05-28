import { useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import WelcomeCard from '../components/WelcomeCard'
import ApiErrorBanner from '../components/ApiErrorBanner'
import DashboardSidebar from '../components/dashboard/DashboardSidebar'
import HomeTab from '../components/dashboard/HomeTab'
import AnalyticsTab from '../components/dashboard/AnalyticsTab'
import MarketsPolicyTab from '../components/dashboard/MarketsPolicyTab'
import { useAuth } from '../context/AuthContext'
import { useDataRefresh } from '../lib/useDataRefresh'

// Dashboard — thin tab orchestrator (v2.5).
//
// Reads `?tab=home|analytics|markets` from the URL (default home),
// renders the matching tab content + the persistent left sidebar +
// the page header. Each tab module owns its own data fetching so
// switching tabs doesn't double-load shared state — the trade-off
// is that each tab's data is independent (which matches their actual
// content: Analytics charts use different sources than the Home map).
//
// Page-level concerns kept here:
//   • dashboard-dark scope class (every page-internal surface inherits)
//   • Page header (Market Dashboard + freshness pill)
//   • WelcomeCard (authed users, first-run)
//   • /preview banner (signed-out preview-mode visitors)
//   • ApiErrorBanner (currently only wired to HomeTab's data load —
//     Analytics/Markets handle their own errors inline)

export default function Dashboard({ previewMode = false }) {
  const [searchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'home'
  const { user } = useAuth()
  const effectivePreviewMode = previewMode && !user

  const [dashboardError, setDashboardError] = useState(null)

  // Freshness pill (preserved from earlier ships)
  const refreshAt = useDataRefresh()
  const lastRefresh = useMemo(() => {
    if (!refreshAt) return null
    const ageDays = Math.floor((Date.now() - new Date(refreshAt).getTime()) / 86400000)
    return {
      date:    new Date(refreshAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      ageDays,
      isStale: ageDays > 14,
    }
  }, [refreshAt])

  const handleDataError = useCallback((msg) => setDashboardError(msg), [])

  // Tab content — only the active tab is rendered (lazy by default).
  // Each tab is self-contained re: data fetching.
  let tabContent
  if (activeTab === 'analytics')      tabContent = <AnalyticsTab />
  else if (activeTab === 'markets')   tabContent = <MarketsPolicyTab />
  else                                 tabContent = <HomeTab effectivePreviewMode={effectivePreviewMode} onDataError={handleDataError} />

  return (
    <div className="min-h-screen relative dashboard-dark">
      {effectivePreviewMode && (
        <div
          className="sticky top-14 z-30 flex items-center justify-between px-6 py-2.5"
          style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)', borderBottom: '1px solid rgba(20,184,166,0.22)' }}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: '#5EEAD4' }}>◆ Live Preview</span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>
              You're seeing the same intelligence Pro users get. Create a free account to drill into states, save projects, and run Tractova Lens AI analysis.
            </span>
          </div>
          <a
            href="/signup"
            className="shrink-0 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: '#14B8A6' }}
          >
            Create free account →
          </a>
        </div>
      )}

      <main className="relative max-w-dashboard mx-auto px-6 pt-16 pb-6">
        {user && !effectivePreviewMode && <WelcomeCard />}

        {/* Page header */}
        <div className="mt-2 mb-2">
          <h1 className="text-xl font-serif font-semibold" style={{ letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Market Dashboard
          </h1>
          <div className="mt-1 flex items-baseline gap-2 flex-wrap">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Community solar program status, interconnection conditions, and policy alerts — refreshed weekly.
            </p>
            {lastRefresh && (
              <span
                className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em]"
                style={{ color: lastRefresh.isStale ? '#FBBF24' : '#5EEAD4' }}
                title={lastRefresh.isStale
                  ? `Data is ${lastRefresh.ageDays} days old — last refresh missed at least one weekly cycle.`
                  : `Last weekly refresh ${lastRefresh.ageDays === 0 ? 'today' : `${lastRefresh.ageDays} day${lastRefresh.ageDays === 1 ? '' : 's'} ago`}.`}
              >
                <span className="relative flex w-1.5 h-1.5 shrink-0" aria-hidden="true">
                  {!lastRefresh.isStale && (
                    <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping" style={{ background: '#14B8A6' }} />
                  )}
                  <span
                    className="relative inline-flex rounded-full h-1.5 w-1.5"
                    style={{
                      background: lastRefresh.isStale ? '#FBBF24' : '#14B8A6',
                      boxShadow: lastRefresh.isStale ? '0 0 6px rgba(251,191,36,0.5)' : '0 0 6px rgba(20,184,166,0.6)',
                    }}
                  />
                </span>
                <span>Refreshed {lastRefresh.date}</span>
              </span>
            )}
          </div>
        </div>

        <ApiErrorBanner
          message={dashboardError}
          onRetry={() => window.location.reload()}
          onDismiss={() => setDashboardError(null)}
        />

        {/* Sidebar + tab content layout. Sidebar is vertical on lg+,
            horizontal strip on mobile. Tab content takes the remaining
            width. */}
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-3 mt-2">
          <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-120px)]">
            <DashboardSidebar />
          </div>
          <div className="min-w-0">
            {tabContent}
          </div>
        </div>
      </main>
    </div>
  )
}
