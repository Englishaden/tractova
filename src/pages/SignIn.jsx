import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AuthShell } from './SignUp'

// view: 'signin' | 'reset' | 'reset_sent'
export default function SignIn() {
  const [view,     setView]     = useState('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const navigate  = useNavigate()
  const location  = useLocation()
  const redirectMessage = location.state?.message
  const from = location.state?.from?.pathname ?? '/'

  const handleSignIn = async (e) => {
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

  const handleReset = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    })
    setLoading(false)
    if (error) {
      setError(humanizeError(error.message))
    } else {
      setView('reset_sent')
    }
  }

  const switchToReset  = () => { setError(null); setView('reset') }
  const switchToSignIn = () => { setError(null); setView('signin') }

  // ── Three view variants share the AuthShell wrapper. The dark-panel
  // copy adapts to which view we're in so the auth flow stays visually
  // continuous with the new landing page. ─────────────────────────────
  const shellProps = {
    signin: {
      eyebrow: 'Sign in',
      title: 'Welcome back.',
      subtitle: 'The market dashboard is exactly where you left it. The Lens, your library, your alerts — all there.',
    },
    reset: {
      eyebrow: 'Reset password',
      title: 'Forgot your password?',
      subtitle: "No problem. Enter the email on your account and we'll send you a reset link. Takes about a minute.",
    },
    reset_sent: {
      eyebrow: 'Reset sent',
      title: 'Check your email.',
      subtitle: 'A password reset link is on its way. Click it within an hour to set a new password.',
    },
  }[view]

  return (
    <AuthShell {...shellProps}>

      {/* Reset-sent confirmation */}
      {view === 'reset_sent' && (
        <div className="text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(20,184,166,0.10)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <h1 className="lp-h4 mb-2" style={{ color: '#0F1A2E' }}>Check your email</h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            We sent a password reset link to{' '}
            <span className="font-medium text-gray-700">{email}</span>.
            Click the link in the email to set a new password.
          </p>
          <button
            onClick={switchToSignIn}
            className="mt-6 text-sm font-medium hover:underline"
            style={{ color: '#0F766E' }}
          >
            ← Back to sign in
          </button>
        </div>
      )}

      {/* Sign in */}
      {view === 'signin' && (
        <>
          <h1 className="lp-h4 mb-1" style={{ color: '#0F1A2E' }}>Sign in to your account</h1>
          <p className="text-xs text-gray-500 mb-6">Welcome back.</p>

          {redirectMessage && (
            <div className="mb-5 px-3 py-2.5 rounded-md" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.30)' }}>
              <p className="text-xs" style={{ color: '#B45309' }}>{redirectMessage}</p>
            </div>
          )}

          {error && (
            <div className="mb-5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <Field label="Email address">
              <input
                type="email" required autoComplete="email" autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={INPUT_CLASS}
              />
            </Field>

            <Field
              label="Password"
              hint={
                <button
                  type="button"
                  onClick={switchToReset}
                  className="text-xs hover:underline"
                  style={{ color: '#0F766E' }}
                >
                  Forgot your password?
                </button>
              }
            >
              <input
                type="password" required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={INPUT_CLASS}
              />
            </Field>

            <button
              type="submit" disabled={loading}
              className="w-full text-white text-sm font-semibold py-3 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: '#14B8A6', boxShadow: '0 8px 24px rgba(20,184,166,0.18)' }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#0F766E' }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#14B8A6' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium hover:underline" style={{ color: '#0F766E' }}>
              Get started free →
            </Link>
          </p>
        </>
      )}

      {/* Reset password */}
      {view === 'reset' && (
        <>
          <h1 className="lp-h4 mb-1" style={{ color: '#0F1A2E' }}>Reset your password</h1>
          <p className="text-xs text-gray-500 mb-6">Enter your email and we'll send you a reset link.</p>

          {error && (
            <div className="mb-5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-4">
            <Field label="Email address">
              <input
                type="email" required autoComplete="email" autoFocus
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={INPUT_CLASS}
              />
            </Field>

            <button
              type="submit" disabled={loading}
              className="w-full text-white text-sm font-semibold py-3 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: '#14B8A6', boxShadow: '0 8px 24px rgba(20,184,166,0.18)' }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#0F766E' }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#14B8A6' }}
            >
              {loading ? 'Sending…' : 'Send reset email'}
            </button>

            <button
              type="button" onClick={switchToSignIn}
              className="w-full text-xs text-gray-500 hover:text-gray-700 transition-colors pt-1"
            >
              ← Back to sign in
            </button>
          </form>
        </>
      )}
    </AuthShell>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-gray-700 tracking-wide">{label}</label>
        {hint && <span>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

const INPUT_CLASS = "w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm placeholder-gray-400 focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-colors"

function humanizeError(msg) {
  if (!msg) return 'Something went wrong. Try again.'
  if (msg.toLowerCase().includes('invalid login')) return 'Invalid email or password.'
  if (msg.toLowerCase().includes('email not confirmed')) return 'Please confirm your email before signing in.'
  return msg
}
