import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import ScenarioHistoryList from './ScenarioHistoryList'

// ── Scenarios view (Library tab) ────────────────────────────────────────────
// Replaces the project grid when the user toggles to the Scenarios tab.
// Renders ALL of the user's scenarios — including "exploration" scenarios
// (project_id null, saved during Lens exploration before committing the
// project) — grouped by Lens context (state + county + tech). Exploration
// groups display a "Save as project" CTA that deep-links into Search.jsx
// with the context pre-filled; once the user saves the project there,
// Search.jsx auto-promotes them (attaches their project_id), and on next
// Library load they migrate from this Scenarios view to the Projects view.
// (Internally we still call them "orphan" — UI-facing word is "exploration"
// because "orphan" reads cold/clinical for a developer-product workflow.)
export default function ScenariosView({ scenariosMap, orphanScenarios, projects, onScenarioDelete }) {
  // Build groups by composite key state||county||tech. Project-linked
  // groups carry the project name + id; orphan groups carry just the
  // context. We iterate orphans separately so they're visually distinct.
  const groups = useMemo(() => {
    const projectGroups = []
    for (const project of projects) {
      const scenarios = scenariosMap[project.id] || []
      if (!scenarios.length) continue
      // Take context from first scenario in the group; fall back to
      // project columns if scenario context isn't populated for some
      // historical reason.
      const head = scenarios[0]
      projectGroups.push({
        key: `p::${project.id}`,
        kind: 'project',
        project,
        state: head?.state_id || project.state,
        county: head?.county_name || project.county,
        technology: head?.technology || project.technology,
        scenarios,
      })
    }
    // Group orphans by state+county+tech composite key.
    const orphanByKey = {}
    for (const snap of orphanScenarios) {
      const key = `o::${snap.state_id}::${snap.county_name || ''}::${snap.technology || ''}`
      if (!orphanByKey[key]) {
        orphanByKey[key] = {
          key,
          kind: 'orphan',
          state: snap.state_id,
          county: snap.county_name || '',
          technology: snap.technology || '',
          scenarios: [],
        }
      }
      orphanByKey[key].scenarios.push(snap)
    }
    const orphanGroups = Object.values(orphanByKey)
    // Sort: orphans first (so the "save these" prompt is unmissable),
    // then project groups by most-recent scenario.
    orphanGroups.sort((a, b) => new Date(b.scenarios[0]?.created_at || 0) - new Date(a.scenarios[0]?.created_at || 0))
    projectGroups.sort((a, b) => new Date(b.scenarios[0]?.created_at || 0) - new Date(a.scenarios[0]?.created_at || 0))
    return [...orphanGroups, ...projectGroups]
  }, [scenariosMap, orphanScenarios, projects])

  if (groups.length === 0) {
    return (
      <div className="rounded-xl px-8 py-10 mt-2 text-center" style={{ background: 'rgba(20,184,166,0.04)', border: '1px solid rgba(20,184,166,0.20)' }}>
        <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-2" style={{ color: '#0F766E' }}>
          ◆ No scenarios saved yet
        </p>
        <h2 className="font-serif text-xl font-semibold text-ink mb-2">Run a Lens query and save your first scenario</h2>
        <p className="text-[13px] text-gray-500 max-w-md mx-auto leading-relaxed mb-4">
          Each Lens result has a Scenario Studio. Drag sliders or hit ◆ Best case to model alternative deal envelopes; saved scenarios show up here.
        </p>
        <Link
          to="/search"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded-lg transition-colors"
          style={{ background: '#0F1A2E' }}
        >
          Open Lens →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <ScenarioGroupCard
          key={g.key}
          group={g}
          onScenarioDelete={onScenarioDelete}
        />
      ))}
    </div>
  )
}

function ScenarioGroupCard({ group, onScenarioDelete }) {
  const isOrphan = group.kind === 'orphan'
  const baselineRev = group.scenarios[0]?.baseline_inputs ? null : null  // baseline rev unknown without recompute; skip delta for now in Library view
  // Deep-link to Lens with the context pre-filled. The first scenario's
  // systemSizeMW becomes the mw param so re-running gives a comparable
  // result. From there the user can hit Save Project; the orphan
  // promotion in Search.jsx will sweep these into the new project.
  const headSize = group.scenarios[0]?.scenario_inputs?.systemSizeMW
                || group.scenarios[0]?.baseline_inputs?.systemSizeMW
                || 5
  const lensHref = `/search?state=${group.state}&county=${encodeURIComponent(group.county)}&mw=${headSize}&technology=${encodeURIComponent(group.technology || '')}`

  return (
    <div className="rounded-xl bg-white" style={{ border: isOrphan ? '1px solid rgba(245,158,11,0.40)' : '1px solid #E2E8F0' }}>
      <div
        className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ background: isOrphan ? 'rgba(245,158,11,0.04)' : 'rgba(15,26,46,0.02)', borderBottom: '1px solid #E2E8F0', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {isOrphan ? (
            <span
              className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold px-2 py-0.5 rounded-sm"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#92400E', border: '1px solid rgba(245,158,11,0.40)' }}
            >
              ◆ Exploration · not yet in Library
            </span>
          ) : (
            <span
              className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold px-2 py-0.5 rounded-sm"
              style={{ background: 'rgba(20,184,166,0.12)', color: '#0F766E' }}
            >
              ◆ {group.project.name}
            </span>
          )}
          <span className="text-[12px] font-semibold text-ink">
            {group.county || '—'}, {group.state} · {group.technology || 'Tech ?'}
          </span>
          <span className="text-[10px] text-gray-500 font-mono tabular-nums">
            · {group.scenarios.length} scenario{group.scenarios.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOrphan && (
            <Link
              to={lensHref}
              className="cursor-pointer text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors"
              style={{ background: '#0F1A2E', color: 'white' }}
            >
              Open in Lens to save →
            </Link>
          )}
          {!isOrphan && (
            <Link
              to={lensHref}
              className="cursor-pointer text-[11px] font-medium text-teal-700 hover:text-teal-900"
            >
              Re-open in Lens →
            </Link>
          )}
        </div>
      </div>
      <div className="px-5 py-4">
        <ScenarioHistoryList
          scenarios={group.scenarios}
          onDelete={(snap) => onScenarioDelete && onScenarioDelete(snap)}
          baselineRevenue={baselineRev}
          emptyText="—"
        />
      </div>
    </div>
  )
}
