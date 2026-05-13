import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { getStateProgramMap, getCountyData, getStateProgramDeltas } from '../../lib/programData'
import { computeSubScores, safeScore } from '../../lib/scoreEngine'
import { logProjectEvent } from '../../lib/projectEvents'
import ProjectCard from '../ProjectCard.jsx'

// MobileLibrary — Phase 6 (TRACTOVA-UX-001).
//
// Cards-only mobile view of the user's saved projects. Strips out
// everything desktop Library.jsx ships for a power user (toolbar, bulk
// select, view-mode toggle, map, table, pagination, comparisons tab,
// scenarios tab, weekly summary, pipeline distribution) and renders the
// stack of ProjectCard components a phone screen can actually use.
//
// Lives behind useIsMobile() inside Library.jsx so the route stays /library
// for the same URL on every device — bookmarks and shared links resolve to
// whatever fits the viewport.
//
// Data: re-runs the three queries Library.jsx runs (projects,
// stateProgramMap, stateDeltas). Re-fetching is fine — Supabase caches at
// the edge, and the mobile user is on a separate session from desktop.
// No countyData prefetch; ProjectCard falls back to its local fetch when
// the map is empty (already-shipped degraded-but-working path).

function normalize(row) {
  return {
    id:               row.id,
    state:            row.state || row.state_id || '',
    county:           row.county || row.county_name || '',
    projectName:      row.project_name || row.name || 'Untitled project',
    technology:       row.technology || row.tech_type || 'Community Solar',
    capacityMw:       Number(row.capacity_mw ?? row.system_size_mw ?? 0) || 0,
    stage:            row.stage || '',
    notes:            row.notes || '',
    savedAt:          row.saved_at || row.created_at,
    score:            row.score ?? null,
    score_breakdown:  row.score_breakdown || null,
    inputs:           row.inputs || null,
  }
}

export default function MobileLibrary() {
  const { user, loading: authLoading } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stateProgramMap, setStateProgramMap] = useState({})
  const [countyDataMap, setCountyDataMap] = useState({})
  const [stateDeltaMap, setStateDeltaMap] = useState(new Map())
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('saved') // saved | score | mw
  const [confirmRemove, setConfirmRemove] = useState(null)

  useEffect(() => { getStateProgramMap().then(setStateProgramMap).catch(() => {}) }, [])
  useEffect(() => { getStateProgramDeltas().then(setStateDeltaMap).catch(() => {}) }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
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

  // Centralized county data fetch so ProjectCard doesn't fan out N fetches.
  useEffect(() => {
    if (!projects.length) return
    const seen = new Set()
    const pending = []
    for (const p of projects) {
      if (!p.state || !p.county) continue
      const key = `${p.state}::${p.county}`
      if (seen.has(key) || countyDataMap[key]) continue
      seen.add(key)
      pending.push(getCountyData(p.state, p.county).then(d => [key, d]).catch(() => null))
    }
    if (!pending.length) return
    Promise.all(pending).then(results => {
      const updates = {}
      for (const r of results) { if (r) updates[r[0]] = r[1] }
      if (Object.keys(updates).length) setCountyDataMap(prev => ({ ...prev, ...updates }))
    })
  }, [projects.length])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let rows = projects
    if (q) {
      rows = rows.filter(p =>
        p.projectName.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q) ||
        p.county.toLowerCase().includes(q)
      )
    }
    const sorted = [...rows]
    if (sortBy === 'score') {
      sorted.sort((a, b) => {
        const sa = safeScore(computeSubScores(a, stateProgramMap[a.state], countyDataMap[`${a.state}::${a.county}`]).composite)
        const sb = safeScore(computeSubScores(b, stateProgramMap[b.state], countyDataMap[`${b.state}::${b.county}`]).composite)
        return (sb ?? -1) - (sa ?? -1)
      })
    } else if (sortBy === 'mw') {
      sorted.sort((a, b) => (b.capacityMw || 0) - (a.capacityMw || 0))
    }
    // 'saved' is the default order from Supabase (already desc).
    return sorted
  }, [projects, search, sortBy, stateProgramMap, countyDataMap])

  const handleStageChange = async (projectId, nextStage) => {
    const prev = projects.find(p => p.id === projectId)?.stage || ''
    setProjects(rows => rows.map(p => p.id === projectId ? { ...p, stage: nextStage } : p))
    const { error } = await supabase.from('projects').update({ stage: nextStage }).eq('id', projectId)
    if (error) {
      // Rollback on failure so the UI stays honest.
      setProjects(rows => rows.map(p => p.id === projectId ? { ...p, stage: prev } : p))
      return
    }
    logProjectEvent({ projectId, eventType: 'stage_change', payload: { from: prev, to: nextStage } }).catch(() => {})
  }

  const handleRequestRemove = (project) => setConfirmRemove(project)
  const confirmRemoveProject = async () => {
    if (!confirmRemove) return
    const id = confirmRemove.id
    setConfirmRemove(null)
    setProjects(rows => rows.filter(p => p.id !== id))
    await supabase.from('projects').delete().eq('id', id)
  }

  return (
    <main className="min-h-screen pt-14 px-4 pb-12" style={{ background: '#F8F7F4' }}>
      <header className="pt-5 pb-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.24em] mb-1.5" style={{ color: '#0F766E' }}>
          Tractova · Library
        </p>
        <h1 className="font-serif text-[24px] leading-tight font-semibold" style={{ color: '#0F1A2E' }}>
          Saved projects
        </h1>
        <p className="text-[12px] mt-1.5" style={{ color: 'rgba(15,26,46,0.62)' }}>
          {projects.length} project{projects.length === 1 ? '' : 's'} · cards-only mobile view.
          Use a desktop for the full Lens analysis, compare tray, and scenario studio.
        </p>
      </header>

      <div className="flex gap-2 mb-4">
        <input
          type="search"
          placeholder="Search by name, state, county…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 text-[13px] rounded-md px-3 py-2 bg-white border focus:outline-hidden focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500 transition-colors"
          style={{ borderColor: 'rgba(15,26,46,0.12)', color: '#0F1A2E', minHeight: 40 }}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-[12px] font-mono uppercase tracking-[0.12em] rounded-md px-2 bg-white border focus:outline-hidden focus:ring-2 focus:ring-teal-500/15"
          style={{ borderColor: 'rgba(15,26,46,0.12)', color: '#0F1A2E', minHeight: 40 }}
          aria-label="Sort by"
        >
          <option value="saved">Recent</option>
          <option value="score">Score</option>
          <option value="mw">MW</option>
        </select>
      </div>

      {loading && (
        <div className="space-y-3" aria-label="Loading projects">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-24 rounded-lg bg-white animate-pulse" style={{ border: '1px solid rgba(15,26,46,0.08)' }} />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md px-4 py-3 text-[13px]" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#991B1B' }}>
          Failed to load projects: {error}
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div className="rounded-lg px-5 py-8 text-center" style={{ background: 'white', border: '1px solid rgba(15,26,46,0.08)' }}>
          <p className="text-[14px] mb-2" style={{ color: '#0F1A2E' }}>
            No saved projects yet.
          </p>
          <p className="text-[12px]" style={{ color: 'rgba(15,26,46,0.55)' }}>
            Tractova Lens analysis is desktop-only — open the site on a laptop
            to run your first intelligence report and save the result here.
          </p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && projects.length > 0 && (
        <p className="text-[13px] italic mt-6" style={{ color: 'rgba(15,26,46,0.55)' }}>
          No projects match “{search}”.
        </p>
      )}

      <div className="grid gap-3">
        {filtered.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            stateProgramMap={stateProgramMap}
            countyDataMap={countyDataMap}
            stateDelta={stateDeltaMap.get?.(p.state) || null}
            onRequestRemove={handleRequestRemove}
            onStageChange={handleStageChange}
          />
        ))}
      </div>

      {confirmRemove && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-confirm-remove-title"
          className="fixed inset-0 z-50 flex items-end px-4 pb-6"
          style={{ background: 'rgba(15,26,46,0.55)' }}
          onClick={() => setConfirmRemove(null)}
        >
          <div
            className="w-full rounded-lg p-5"
            style={{ background: 'white', boxShadow: '0 24px 60px -20px rgba(15,26,46,0.45)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="mobile-confirm-remove-title" className="font-serif text-[18px] font-semibold mb-2" style={{ color: '#0F1A2E' }}>
              Remove this project?
            </h2>
            <p className="text-[13px] mb-4" style={{ color: 'rgba(15,26,46,0.62)' }}>
              {confirmRemove.projectName} — {confirmRemove.state}, {confirmRemove.county}. This can't be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmRemove(null)}
                className="flex-1 font-mono text-[10px] uppercase tracking-[0.18em] font-semibold rounded-sm transition-colors"
                style={{ background: 'transparent', color: 'rgba(15,26,46,0.62)', border: '1px solid rgba(15,26,46,0.18)', minHeight: 44 }}
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveProject}
                className="flex-1 font-mono text-[10px] uppercase tracking-[0.18em] font-semibold rounded-sm transition-colors"
                style={{ background: '#DC2626', color: 'white', minHeight: 44 }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-center mt-8" style={{ color: 'rgba(15,26,46,0.40)' }}>
        Need bulk actions, the map, or compare tray? <Link to="/" className="underline">Open Tractova on desktop.</Link>
      </p>
    </main>
  )
}
