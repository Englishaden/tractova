import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import { supabase } from '../lib/supabase'

function Field({ label, value }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value || '—'}</p>
    </div>
  )
}

function ManageBillingButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const handlePortal = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ returnUrl: window.location.href }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Something went wrong')
      window.location.href = json.url
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}
      <button
        onClick={handlePortal}
        disabled={loading}
        className="text-sm font-medium text-primary hover:text-primary-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Loading…' : 'Manage subscription →'}
      </button>
    </div>
  )
}

export default function Profile() {
  const { user } = useAuth()
  const { isPro, tier, status } = useSubscription()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [projectCount, setProjectCount] = useState(null)

  useEffect(() => {
    if (user) {
      supabase.from('projects').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count }) => setProjectCount(count))
    }
  }, [user])

  if (!user) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-sm text-gray-500">
          <Link to="/signin" className="text-primary hover:underline">Sign in</Link> to view your profile.
        </p>
      </div>
    )
  }

  const fullName    = user.user_metadata?.full_name || '—'
  const email       = user.email
  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-16">
        <div className="mt-6 max-w-lg">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
            <p className="text-sm text-gray-500 mt-1">Your account details.</p>
          </div>

          {/* Account card */}
          <div className="bg-white border border-gray-200 rounded-lg px-6 py-2">
            <Field label="Full name"    value={fullName} />
            <Field label="Email"        value={email} />
            <Field label="Member since" value={memberSince} />
          </div>

          {/* Subscription card */}
          <div className="mt-5 bg-white border border-gray-200 rounded-lg px-6 py-2">
            <div className="py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Plan</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isPro ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-primary-50 border border-primary-200 rounded-full text-xs font-semibold text-primary">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        Pro
                      </span>
                      <span className="text-sm text-gray-500">$9.99 / month</span>
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-gray-100 border border-gray-200 rounded-full text-xs font-semibold text-gray-500">
                      Free
                    </span>
                  )}
                </div>
                {isPro ? (
                  <ManageBillingButton />
                ) : (
                  <Link
                    to="/search"
                    className="text-sm font-medium text-primary hover:text-primary-700 transition-colors"
                  >
                    Upgrade to Pro →
                  </Link>
                )}
              </div>
            </div>
            {status && (
              <div className="py-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Status</p>
                <p className="text-sm text-gray-900 capitalize">{status.replace('_', ' ')}</p>
              </div>
            )}
          </div>

          {/* Usage card */}
          <div className="mt-5 bg-white border border-gray-200 rounded-lg px-6 py-2">
            <Field label="Projects saved" value={projectCount != null ? String(projectCount) : '—'} />
          </div>

          {/* Actions */}
          <div className="mt-5 flex items-center justify-between">
            <Link to="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← Back to dashboard</Link>
            <button
              onClick={async () => {
                setSigningOut(true)
                await supabase.auth.signOut()
                navigate('/')
              }}
              disabled={signingOut}
              className="text-xs font-medium text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
