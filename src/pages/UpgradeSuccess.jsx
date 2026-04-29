import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSubscription } from '../hooks/useSubscription'

export default function UpgradeSuccess() {
  const { isPro, loading } = useSubscription()
  const navigate = useNavigate()
  const [seconds, setSeconds] = useState(8)

  // Auto-redirect once the webhook has fired and DB is updated
  useEffect(() => {
    if (!loading && isPro) {
      const t = setTimeout(() => navigate('/search'), 2500)
      return () => clearTimeout(t)
    }
  }, [isPro, loading, navigate])

  // Countdown ticker (shows progress while waiting for webhook)
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-14">
      <div className="max-w-md w-full text-center">

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-6">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              This takes a few seconds. You'll be redirected to Tractova Lens automatically.
            </p>
          </div>
        ) : (
          // Webhook fired — confirmed Pro
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-6 mb-6">
            <p className="text-sm font-semibold text-primary mb-1">Account activated</p>
            <p className="text-xs text-primary-700">
              Redirecting to Tractova Lens in a moment…
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
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

        <p className="mt-6 text-xs text-gray-400">
          Manage your subscription anytime from{' '}
          <Link to="/profile" className="underline hover:text-gray-600">Profile</Link>
        </p>
      </div>
    </div>
  )
}
