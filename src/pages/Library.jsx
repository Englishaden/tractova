import { Link } from 'react-router-dom'

export default function Library() {
  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-dashboard mx-auto px-6 pt-28 pb-10 flex flex-col items-center justify-center text-center">
        <div className="max-w-md">
          <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">My Projects</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Your personal deal tracker. Save projects from search, track their three-pillar status, and receive automatic alerts when program conditions change.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 bg-accent-50 text-accent-700 text-sm font-medium px-4 py-2 rounded-lg border border-accent-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Coming in Iteration 3
          </div>
          <p className="text-xs text-gray-400 mt-4">
            Requires login and Pro subscription. &nbsp;
            <Link to="/" className="text-primary hover:underline">Return to Dashboard →</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
