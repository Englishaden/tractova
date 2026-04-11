import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SignIn() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const navigate = useNavigate()
  const location = useLocation()

  const redirectMessage = location.state?.message
  const from = location.state?.from?.pathname ?? '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(humanizeError(error.message))
      setLoading(false)
    } else {
      navigate(from, { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4 pt-14">
      <div className="w-full max-w-sm">

        {/* Wordmark */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <TractovaMark />
          <span className="text-xl font-semibold tracking-tight text-gray-900">tractova</span>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-xl px-8 py-8 shadow-sm">
          <h1 className="text-base font-bold text-gray-900">Sign in to your account</h1>
          <p className="text-xs text-gray-500 mt-1 mb-6">Welcome back.</p>

          {/* Redirect message (e.g. "Sign in to access Catered Search") */}
          {redirectMessage && (
            <div className="mb-5 px-3 py-2.5 bg-accent-50 border border-accent-200 rounded-md">
              <p className="text-xs text-accent-700">{redirectMessage}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mb-5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm placeholder-gray-400
                           focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-10
                           transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm placeholder-gray-400
                           focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-10
                           transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white text-sm font-medium py-2.5 rounded-md
                         hover:bg-primary-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500 mt-5">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary font-medium hover:underline">
            Get started free →
          </Link>
        </p>

        <p className="text-center text-xs text-gray-400 mt-3">
          <Link to="/" className="hover:text-gray-600 transition-colors">
            ← Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  )
}

function humanizeError(msg) {
  if (!msg) return 'Something went wrong. Try again.'
  if (msg.toLowerCase().includes('invalid login')) return 'Invalid email or password.'
  if (msg.toLowerCase().includes('email not confirmed')) return 'Please confirm your email before signing in.'
  return msg
}

function TractovaMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="26" height="26" rx="5" fill="#0F6E56" />
      <rect x="5" y="7" width="16" height="2.5" rx="1.25" fill="white" />
      <rect x="11.75" y="9.5" width="2.5" height="10" rx="1.25" fill="white" />
    </svg>
  )
}
