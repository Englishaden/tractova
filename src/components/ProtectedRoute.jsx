import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, message }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Don't redirect while the initial session check is in flight
  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#14B8A6' }} />
          Loading
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/signin"
        state={{ from: location, message: message ?? 'Sign in to continue.' }}
        replace
      />
    )
  }

  return children
}
