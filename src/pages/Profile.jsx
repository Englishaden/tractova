import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Field({ label, value }) {
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-gray-900">{value || '—'}</p>
    </div>
  )
}

export default function Profile() {
  const { user } = useAuth()

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
            <h1 className="text-xl font-bold text-gray-900">Profile</h1>
            <p className="text-sm text-gray-500 mt-1">Your account details.</p>
          </div>

          {/* Account card */}
          <div className="bg-white border border-gray-200 rounded-lg px-6 py-2">
            <Field label="Full name"    value={fullName} />
            <Field label="Email"        value={email} />
            <Field label="Member since" value={memberSince} />
          </div>

          {/* Stub notice */}
          <div className="mt-5 px-4 py-3 bg-accent-50 border border-accent-200 rounded-lg">
            <p className="text-xs text-accent-700 font-medium">More coming in Iteration 3</p>
            <p className="text-xs text-accent-600 mt-0.5">
              Saved projects, alert preferences, and subscription management will appear here.
            </p>
          </div>

          <p className="mt-5 text-xs text-gray-400">
            <Link to="/" className="hover:text-gray-600 transition-colors">← Back to dashboard</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
