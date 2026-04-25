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
      if (!session?.access_token) throw new Error('Please sign in again')
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
        {loading ? 'Loading...' : 'Manage subscription →'}
      </button>
    </div>
  )
}

function getInitials(name) {
  if (!name || name === '—') return '?'
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(dateStr) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  const days = Math.floor(diff / 86400)
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function Profile() {
  const { user } = useAuth()
  const { isPro, tier, status } = useSubscription()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [projectCount, setProjectCount] = useState(null)
  const [recentProjects, setRecentProjects] = useState([])

  useEffect(() => {
    if (user) {
      supabase.from('projects').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count }) => setProjectCount(count))

      supabase.from('projects')
        .select('id, project_name, state, county, saved_at')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false })
        .limit(5)
        .then(({ data }) => setRecentProjects(data || []))
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
  const initials    = getInitials(fullName)
  const memberSince = new Date(user.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-16">
        <div className="mt-6 max-w-lg">

          {/* Profile banner */}
          <div className="rounded-xl overflow-hidden mb-6" style={{ background: 'linear-gradient(135deg, #0A3D2E 0%, #0C1220 100%)' }}>
            <div className="px-6 py-6 flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #0F6E56 0%, #0A4D3A 100%)', boxShadow: '0 4px 12px rgba(15,110,86,0.3)' }}
              >
                {initials}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-white truncate">{fullName}</h1>
                <div className="flex items-center gap-2 mt-1">
                  {isPro ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(15,110,86,0.3)', color: '#34D399', border: '1px solid rgba(52,211,153,0.25)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Pro
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      Free
                    </span>
                  )}
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Member since {memberSince}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Account card */}
          <div className="bg-white border border-gray-200 rounded-lg px-6 py-2">
            <Field label="Email" value={email} />
            <Field label="Projects saved" value={projectCount != null ? String(projectCount) : '—'} />
          </div>

          {/* Subscription card */}
          <div className="mt-4 bg-white border border-gray-200 rounded-lg px-6 py-2">
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

          {/* Recent activity card */}
          {recentProjects.length > 0 && (
            <div className="mt-4 bg-white border border-gray-200 rounded-lg px-6 py-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Activity</p>
              <div className="space-y-2.5">
                {recentProjects.map(p => (
                  <div key={p.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: 'rgba(15,110,86,0.08)', color: '#0F6E56' }}>
                        {p.state || '—'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 font-medium truncate">{p.project_name || `${p.state} ${p.county || ''}`}</p>
                        {p.county && <p className="text-[10px] text-gray-400">{p.county} County</p>}
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">{timeAgo(p.saved_at)}</span>
                  </div>
                ))}
              </div>
              <Link to="/library" className="block mt-3 pt-3 border-t border-gray-100 text-xs font-medium text-primary hover:text-primary-700 transition-colors">
                View all projects →
              </Link>
            </div>
          )}

          {/* Admin access — only visible to admin */}
          {email === 'aden.walker67@gmail.com' && (
            <Link
              to="/admin"
              className="mt-4 flex items-center justify-between bg-white border border-gray-200 rounded-lg px-6 py-3 hover:border-primary/30 hover:bg-primary-50/20 transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">Data Admin</p>
                <p className="text-[10px] text-gray-400">Edit live market intelligence data</p>
              </div>
              <span className="text-xs text-gray-300 group-hover:text-primary transition-colors">Open →</span>
            </Link>
          )}

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
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
