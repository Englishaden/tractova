import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, message }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Don't redirect while the initial session check is in flight
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading…</div>
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
