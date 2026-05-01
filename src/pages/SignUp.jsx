import { useState, useEffect } from 'react'
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
    return <CheckYourEmailScreen email={email} />
  }

  // ── Sign up form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 pt-14">
      <div className="w-full max-w-sm">

        {/* Wordmark — V3 serif */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <TractovaMark />
          <span className="text-2xl font-serif font-semibold tracking-tight text-ink" style={{ letterSpacing: '-0.02em' }}>Tractova</span>
        </div>

        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-xl px-8 py-8 shadow-xs">
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
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm placeholder-gray-400
                           focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15
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
                           focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15
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
                           focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15
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
                           focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15
                           transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white text-sm font-medium py-2.5 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: '#14B8A6' }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#0F766E' }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#14B8A6' }}
            >
              {loading ? 'Creating account…' : 'Get started'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500 mt-5">
          Already have an account?{' '}
          <Link to="/signin" className="font-medium hover:underline" style={{ color: '#0F766E' }}>
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

// Post-signup confirmation screen with a Resend link. Address the audit gap:
// previously this screen had no recovery path if the email was slow / lost
// in spam / typo'd. The user just sat staring at "Check your email" with
// no obvious next step. Now: 60s rate-limited Resend button + Back to Sign In.
function CheckYourEmailScreen({ email }) {
  const [resendState, setResendState] = useState('idle')  // idle | sending | sent | error | cooldown
  const [cooldown, setCooldown] = useState(0)
  const [resendError, setResendError] = useState(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  const handleResend = async () => {
    if (cooldown > 0 || resendState === 'sending') return
    setResendState('sending')
    setResendError(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) {
      setResendError(humanizeError(error.message))
      setResendState('error')
      return
    }
    setResendState('sent')
    setCooldown(60)  // Supabase rate-limits ~1/min for resend
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 pt-14">
      <div className="w-full max-w-sm text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(20,184,166,0.10)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

        {resendState === 'sent' && (
          <div className="mt-5 px-3 py-2 rounded-md text-xs" style={{ background: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.30)', color: '#0F766E' }}>
            New confirmation email sent. Check your inbox + spam folder.
          </div>
        )}
        {resendState === 'error' && resendError && (
          <div className="mt-5 px-3 py-2 rounded-md text-xs bg-red-50 border border-red-200 text-red-600">
            {resendError}
          </div>
        )}

        <p className="mt-5 text-xs text-gray-500">
          Didn't get it?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resendState === 'sending'}
            className="font-medium hover:underline disabled:no-underline disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: '#0F766E' }}
          >
            {resendState === 'sending' ? 'Sending…'
              : cooldown > 0   ? `Resend in ${cooldown}s`
              : 'Resend the email'}
          </button>
        </p>

        <Link
          to="/signin"
          className="inline-block mt-4 text-sm font-medium hover:underline"
          style={{ color: '#0F766E' }}
        >
          ← Back to Sign In
        </Link>
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
      <rect width="26" height="26" rx="5" fill="#0F1A2E" />
      <rect x="5" y="7" width="16" height="2.5" rx="1.25" fill="#14B8A6" />
      <rect x="11.75" y="9.5" width="2.5" height="10" rx="1.25" fill="#14B8A6" />
      <rect x="6" y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6" opacity="0.6" />
      <rect x="19.2" y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6" opacity="0.6" />
    </svg>
  )
}
