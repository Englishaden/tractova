import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Reset-password landing — Supabase emails users a one-time link of the form
//   {origin}/update-password#access_token=...&refresh_token=...&type=recovery
// The supabase-js client picks up the URL fragment and emits a 'PASSWORD_RECOVERY'
// auth event, putting us in a temporary "the user can update their own password"
// session. We confirm we're in that state, then call updateUser({ password }).
//
// Failure mode handled: link expired / invalid (no recovery session arrives) —
// surface a clear error + link back to /signin to request another reset.
export default function UpdatePassword() {
  const [ready,    setReady]    = useState(false)   // recovery session detected
  const [linkErr,  setLinkErr]  = useState(null)    // link invalid/expired
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    // Subscribe BEFORE any other auth interaction so we don't miss the event.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })

    // Fallback: getSession a tick after mount in case the event already fired
    // before our listener attached. The supabase client parses the URL hash
    // synchronously on import, so by now the session should be in place if
    // the link is valid.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getSession()
      if (data?.session) setReady(true)
      else if (!ready) setLinkErr('This reset link is invalid or has expired. Please request a new one.')
    }, 800)

    return () => {
      sub?.subscription?.unsubscribe?.()
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateErr) {
      setError(humanizeError(updateErr.message))
      return
    }

    // Sign the recovery session out so the user explicitly signs in with the
    // new password — clearer mental model than an automatic redirect into the
    // app under a session that started as "recovery".
    setSuccess(true)
    await supabase.auth.signOut()
    setTimeout(() => {
      navigate('/signin', { state: { message: 'Password updated. Sign in with your new password.' } })
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-4 pt-14">
      <div className="w-full max-w-sm">

        {/* Wordmark — matches SignIn/SignUp */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <TractovaMark />
          <span className="text-2xl font-serif font-semibold tracking-tight text-ink" style={{ letterSpacing: '-0.02em' }}>Tractova</span>
        </div>

        {/* ── Success ─────────────────────────────────────────────────────── */}
        {success ? (
          <div className="bg-white border border-gray-200 rounded-xl px-8 py-8 shadow-xs text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(20,184,166,0.10)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 className="text-base font-bold text-gray-900 mb-1">Password updated</h2>
            <p className="text-xs text-gray-500 leading-relaxed">Redirecting you to sign in…</p>
          </div>

        /* ── Invalid / expired link ───────────────────────────────────────── */
        ) : linkErr ? (
          <div className="bg-white border border-gray-200 rounded-xl px-8 py-8 shadow-xs">
            <h1 className="text-base font-bold text-gray-900">Reset link expired</h1>
            <p className="text-xs text-gray-500 mt-1 mb-5 leading-relaxed">{linkErr}</p>
            <Link
              to="/signin"
              className="inline-flex items-center justify-center w-full text-white text-sm font-medium py-2.5 rounded-md transition-colors"
              style={{ background: '#14B8A6' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#0F766E'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#14B8A6'}
            >
              Request a new reset link →
            </Link>
          </div>

        /* ── Update form ──────────────────────────────────────────────────── */
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl px-8 py-8 shadow-xs">
            <h1 className="text-base font-bold text-gray-900">Set a new password</h1>
            <p className="text-xs text-gray-500 mt-1 mb-6">
              Choose a new password for your Tractova account.
            </p>

            {error && (
              <div className="mb-5 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {!ready && (
              <div className="mb-5 px-3 py-2.5 rounded-md" style={{ background: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.30)' }}>
                <p className="text-xs" style={{ color: '#0F766E' }}>Verifying reset link…</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">New password</label>
                <input
                  type="password" required autoComplete="new-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm placeholder-gray-400
                             focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Confirm new password</label>
                <input
                  type="password" required autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm placeholder-gray-400
                             focus:outline-hidden focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition-colors"
                />
              </div>

              <button
                type="submit" disabled={loading || !ready}
                className="w-full text-white text-sm font-medium py-2.5 rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: '#14B8A6' }}
                onMouseEnter={(e) => { if (!loading && ready) e.currentTarget.style.background = '#0F766E' }}
                onMouseLeave={(e) => { if (!loading && ready) e.currentTarget.style.background = '#14B8A6' }}
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </div>
        )}

        {!success && (
          <p className="text-center text-xs text-gray-400 mt-5">
            <Link to="/signin" className="hover:text-gray-600 transition-colors">← Back to sign in</Link>
          </p>
        )}
      </div>
    </div>
  )
}

function humanizeError(msg) {
  if (!msg) return 'Something went wrong. Try again.'
  if (msg.toLowerCase().includes('same')) return 'New password must differ from your current password.'
  if (msg.toLowerCase().includes('weak')) return 'Password is too weak. Try a longer one.'
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
