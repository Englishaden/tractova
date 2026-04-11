import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function SignUp() {
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState(null)
  const [success,  setSuccess]  = useState(false)
  const [loading,  setLoading]  = useState(false)

  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })

    if (error) {
      setError(humanizeError(error.message))
      setLoading(false)
      return
    }

    // If email confirmation is disabled in Supabase, session is returned immediately
    if (data.session) {
      navigate('/')
    } else {
      // Email confirmation required — show success screen
      setSuccess(true)
      setLoading(false)
    }
  }

  // ── Success / email confirmation screen ──────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center px-4 pt-14">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Check your email</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            We sent a confirmation link to{' '}
            <span className="font-medium text-gray-700">{email}</span>.
            Click the link to activate your account.
          </p>
          <Link
            to="/signin"
            className="inline-block mt-6 text-sm text-primary font-medium hover:underline"
          >
            Back to Sign In →
          </Link>
        </div>
      </div>
    )
  }

  // ── Sign up form ─────────────────────────────────────────────────────────────
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
          <h1 className="text-base font-bold text-gray-900">Create your account</h1>
          <p className="text-xs text-gray-500 mt-1 mb-6">
            Dashboard access is free, no credit card required.
          </p>

          {error && (
            <div className="mb-5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Full name
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aden Walker"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm placeholder-gray-400
                           focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-10
                           transition-colors"
              />
            </div>

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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm placeholder-gray-400
                           focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-10
                           transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              {loading ? 'Creating account…' : 'Get started'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500 mt-5">
          Already have an account?{' '}
          <Link to="/signin" className="text-primary font-medium hover:underline">
            Sign in →
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
  if (msg.toLowerCase().includes('already registered')) return 'An account with this email already exists.'
  if (msg.toLowerCase().includes('password')) return 'Password must be at least 6 characters.'
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
