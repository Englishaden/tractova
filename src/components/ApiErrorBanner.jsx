/**
 * ApiErrorBanner — dismissible amber notice surfacing transient API failures.
 *
 * Background: previously, several data fetches across the app silently
 * caught errors (Dashboard's getStateProgramMap/getNewsFeed, Comparable
 * Deals, Regulatory Activity, etc.) which left users staring at frozen
 * UI with no signal that anything went wrong. This banner gives them a
 * clear "something didn't load" message + a Retry button so they can
 * recover without a full page reload.
 *
 * Usage:
 *   const [error, setError] = useState(null)
 *   <ApiErrorBanner
 *     message="Market data temporarily unavailable."
 *     onRetry={loadData}
 *     onDismiss={() => setError(null)}
 *   />
 */
export default function ApiErrorBanner({ message, detail, onRetry, onDismiss, retrying = false }) {
  if (!message) return null
  return (
    <div
      role="status"
      className="rounded-lg flex items-start gap-3 px-4 py-3 mb-4"
      style={{
        background: 'rgba(217,119,6,0.06)',
        border: '1px solid rgba(217,119,6,0.30)',
        borderLeft: '3px solid #D97706',
      }}
    >
      <svg
        width="16" height="16" viewBox="0 0 24 24"
        fill="none" stroke="#D97706" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        className="shrink-0 mt-0.5"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold leading-tight" style={{ color: '#92400E' }}>
          {message}
        </p>
        {detail && (
          <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'rgba(146,64,14,0.78)' }}>
            {detail}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="text-[10px] font-mono uppercase tracking-[0.18em] font-semibold px-2.5 py-1 rounded-sm transition-colors disabled:opacity-50"
            style={{ color: '#92400E', border: '1px solid rgba(146,64,14,0.30)', background: 'rgba(255,255,255,0.55)' }}
          >
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-[14px] font-bold leading-none transition-colors"
            style={{ color: 'rgba(146,64,14,0.55)' }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}
