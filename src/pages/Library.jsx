import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSubscription } from '../hooks/useSubscription'
import UpgradePrompt from '../components/UpgradePrompt'

const STAGE_BADGE = {
  'Prospecting':            'bg-gray-100 text-gray-600 border-gray-200',
  'Site Control':           'bg-blue-50 text-blue-700 border-blue-200',
  'Pre-Development':        'bg-yellow-50 text-yellow-700 border-yellow-200',
  'Development':            'bg-primary-50 text-primary-700 border-primary-200',
  'NTP (Notice to Proceed)':'bg-purple-50 text-purple-700 border-purple-200',
  'Construction':           'bg-accent-50 text-accent-700 border-accent-200',
  'Operational':            'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const TECH_BADGE = {
  'Community Solar': 'bg-primary-50 text-primary-700 border-primary-200',
  'C&I Solar':       'bg-blue-50 text-blue-700 border-blue-200',
  'BESS':            'bg-accent-50 text-accent-700 border-accent-200',
  'Hybrid':          'bg-purple-50 text-purple-700 border-purple-200',
}

// Normalize Supabase snake_case row → camelCase shape the card expects
function normalize(row) {
  return {
    id:               row.id,
    name:             row.name,
    state:            row.state,
    stateName:        row.state_name,
    county:           row.county,
    mw:               row.mw,
    stage:            row.stage,
    technology:       row.technology,
    csProgram:        row.cs_program,
    csStatus:         row.cs_status,
    servingUtility:   row.serving_utility,
    opportunityScore: row.opportunity_score,
    savedAt:          row.saved_at,
  }
}

function Badge({ label, map }) {
  const cls = map[label] || 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cls}`}>{label}</span>
  )
}

function ProjectCard({ project, onRequestRemove }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-6 py-5 flex flex-col gap-3">
      {/* Name + remove */}
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-sm font-bold text-gray-900 leading-snug">{project.name}</h2>
        <button
          onClick={() => onRequestRemove(project.id, project.name)}
          title="Remove project"
          className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors mt-0.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>

      {/* Key details row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          {project.county} County, {project.stateName || project.state}
        </span>
        <span className="flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          {project.mw} MW AC
        </span>
        <span className="text-gray-300">·</span>
        <Badge label={project.stage} map={STAGE_BADGE} />
        <Badge label={project.technology} map={TECH_BADGE} />
      </div>

      {/* Saved date */}
      <p className="text-[11px] text-gray-400">
        Saved {new Date(project.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
    </div>
  )
}

// Paywall gate
export default function Library() {
  const { isPro, loading: subLoading } = useSubscription()
  if (subLoading) return <div className="min-h-screen bg-surface" />
  if (!isPro)     return <UpgradePrompt feature="My Projects" />
  return <LibraryContent />
}

function LibraryContent() {
  const { user, loading: authLoading } = useAuth()
  const [projects, setProjects]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(null) // { id, name } | null

  // Fetch projects whenever the logged-in user changes
  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }

    setLoading(true)
    supabase
      .from('projects')
      .select('*')
      .order('saved_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) { setError(error.message); setLoading(false); return }
        setProjects((data || []).map(normalize))
        setLoading(false)
      })
  }, [user, authLoading])

  const handleRequestRemove = (id, name) => setConfirmRemove({ id, name })

  const handleConfirmRemove = async () => {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', confirmRemove.id)

    if (!error) setProjects((prev) => prev.filter((p) => p.id !== confirmRemove.id))
    setConfirmRemove(null)
  }

  // ── Render states ────────────────────────────────────────────────────────────

  // Still resolving auth session
  if (authLoading) return null

  // Not signed in
  if (!user) {
    return (
      <div className="min-h-screen bg-surface">
        <main className="max-w-dashboard mx-auto px-6 pt-20 pb-16">
          <div className="mt-4 mb-6">
            <h1 className="text-xl font-bold text-gray-900">My Projects</h1>
            <p className="text-sm text-gray-500 mt-0.5">Your saved deals. Add projects from Tractova Lens results.</p>
          </div>
          <div className="flex flex-col items-center justify-center text-center py-24">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">Sign in to view your projects</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Your saved projects are tied to your account and sync across devices.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <Link
                to="/signin"
                className="text-sm font-semibold text-white bg-primary px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="text-sm font-medium text-gray-600 border border-gray-200 bg-white px-4 py-2 rounded-lg hover:border-gray-300 transition-colors"
              >
                Create Account
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-16">

        {/* Page header */}
        <div className="mt-4 mb-6">
          <h1 className="text-xl font-bold text-gray-900">My Projects</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Your saved deals. Add projects from Tractova Lens results.
          </p>
        </div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-lg px-6 py-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg px-5 py-4 text-sm text-red-700">
            Failed to load projects: {error}
          </div>
        ) : projects.length > 0 ? (
          <div className="grid gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onRequestRemove={handleRequestRemove} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">No saved projects yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Run a search in Tractova Lens, then click <span className="font-medium text-gray-600">Save as Project</span> to add it here.
            </p>
            <Link
              to="/search"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white bg-primary px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Open Tractova Lens
            </Link>
          </div>
        )}
      </main>

      {/* Remove confirmation modal */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmRemove(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </div>
              <h3 className="text-sm font-bold text-gray-900">Remove project?</h3>
            </div>
            <p className="text-xs text-gray-500 mb-1 leading-relaxed">
              Are you sure you want to remove{' '}
              <span className="font-semibold text-gray-700">{confirmRemove.name}</span>?
            </p>
            <p className="text-xs text-gray-400 mb-5">This cannot be undone.</p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmRemove(null)}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg transition-colors"
              >
                No, keep it
              </button>
              <button
                onClick={handleConfirmRemove}
                className="flex items-center gap-2 bg-red-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
              >
                Yes, remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
