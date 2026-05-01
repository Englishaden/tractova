import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// Pre-filled Lens demo for first-time Pro users — high-feasibility IL CS
// project. Search.jsx auto-submits the form when all 5 URL params are present,
// so the user lands directly on a real Lens result. Same href used by the
// anonymous-visitor onboarding card (src/components/WelcomeCard.jsx) for
// brand consistency: "the demo" is one specific, knowable example.
const DEMO_HREF = '/search?state=IL&county=Will&mw=5&stage=Prospecting&technology=Community%20Solar'

export default function UpgradeSuccess() {
  const { isPro, loading } = useSubscription()
  const { user } = useAuth()
  const navigate = useNavigate()

  // First-time Pro detection: query projects.count for this user. The post-
  // payment dead-end in the previous version (blank Lens form, no example)
  // was the single biggest conversion leak in the audit. Branching on
  // "saved-projects > 0" so returning Pro users (e.g., re-subscribing) get
  // the original direct-to-Lens flow without a tutorial.
  const [firstTime, setFirstTime] = useState(null)  // null = unknown, true/false once resolved

  useEffect(() => {
    if (!user) return
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count, error }) => {
        if (error) {
          // If the count query fails, fall back to the returning-user path
          // — better to skip the tutorial than to show it inappropriately.
          setFirstTime(false)
          return
        }
        setFirstTime((count ?? 0) === 0)
      })
  }, [user])

  // Auto-redirect once the webhook fires AND we know the project count. For
  // first-time users that destination is the pre-filled demo so they land on
  // a real Lens report. For returning users it's the bare /search page.
  useEffect(() => {
    if (loading || !isPro || firstTime === null) return
    const target = firstTime ? DEMO_HREF : '/search'
    const t = setTimeout(() => navigate(target), 2500)
    return () => clearTimeout(t)
  }, [isPro, loading, firstTime, navigate])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-14">
      <div className="max-w-md w-full text-center">

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">You're on Pro.</h1>
        <p className="text-gray-500 text-sm mb-8">
          Welcome to Tractova Pro. Your subscription is active and all features are unlocked.
        </p>

        {loading || !isPro ? (
          // Webhook hasn't fired yet — show processing state
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-3">
              <svg className="animate-spin text-primary" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Activating your account…
            </div>
            <p className="text-xs text-gray-400">
              This takes a few seconds. You'll be redirected automatically.
            </p>
          </div>
        ) : firstTime === true ? (
          // First-time Pro — show the guided first-action card. Replaces the
          // previous "Open Lens / Go to Library" generic CTA pair which dumped
          // users onto a blank form with no guidance (audit's #1 finding).
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.20em] font-semibold mb-3" style={{ color: '#0F766E' }}>
              Your first Lens report
            </p>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              We've staged a real example for you — <strong className="text-gray-900">Will County, IL</strong>:
              a 5 MW community solar project at the Prospecting stage. Run it
              now to see how Tractova scores site control, interconnection,
              and offtake feasibility from live federal + ISO data.
            </p>

            {/* 3-step compact rail */}
            <div className="flex items-center gap-2 mb-5 text-[10px] font-mono uppercase tracking-[0.16em] text-gray-400">
              <span><span style={{ color: '#0F766E' }}>1</span> Pick a state</span>
              <span className="text-gray-300">·</span>
              <span><span style={{ color: '#0F766E' }}>2</span> Run analysis</span>
              <span className="text-gray-300">·</span>
              <span><span style={{ color: '#0F766E' }}>3</span> Save to Library</span>
            </div>

            <Link
              to={DEMO_HREF}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-6 text-white font-semibold rounded-lg text-sm transition-colors"
              style={{ background: '#14B8A6' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#0F766E'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#14B8A6'}
            >
              Run the example →
            </Link>
            <p className="text-center text-[11px] text-gray-400 mt-3">
              or <Link to="/search" className="hover:underline" style={{ color: '#0F766E' }}>start with a blank Lens form</Link>
            </p>
          </div>
        ) : (
          // Returning Pro user — confirmed activation, original direct path.
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-6 mb-6">
            <p className="text-sm font-semibold text-primary mb-1">Account activated</p>
            <p className="text-xs text-primary-700">Redirecting to Tractova Lens in a moment…</p>
            <div className="flex flex-col gap-2 mt-4">
              <Link
                to="/search"
                className="py-2.5 px-6 bg-primary hover:bg-primary-700 text-white font-semibold rounded-lg text-sm transition-colors"
              >
                Open Tractova Lens →
              </Link>
              <Link
                to="/library"
                className="py-2.5 px-6 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 font-medium rounded-lg text-sm transition-colors"
              >
                Go to Library
              </Link>
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400">
          Manage your subscription anytime from{' '}
          <Link to="/profile" className="underline hover:text-gray-600">Profile</Link>
        </p>
      </div>
    </div>
  )
}
