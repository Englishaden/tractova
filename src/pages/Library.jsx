import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

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

export default function Library() {
  const [projects, setProjects] = useState([])
  const [confirmRemove, setConfirmRemove] = useState(null) // { id, name } | null

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('tractova_projects') || '[]')
    setProjects(stored)
  }, [])

  const handleRequestRemove = (id, name) => {
    setConfirmRemove({ id, name })
  }

  const handleConfirmRemove = () => {
    const updated = projects.filter((p) => p.id !== confirmRemove.id)
    setProjects(updated)
    localStorage.setItem('tractova_projects', JSON.stringify(updated))
    setConfirmRemove(null)
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

        {/* Amber info banner */}
        <div className="flex items-start gap-3 bg-accent-50 border border-accent-200 rounded-lg px-4 py-3 mb-8">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-sm text-accent-700">
            <span className="font-semibold">Coming in Iteration 3:</span>{' '}
            Your saved projects will appear on an interactive US map with clickable county markers.
          </p>
        </div>

        {/* Project cards or empty state */}
        {projects.length > 0 ? (
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
