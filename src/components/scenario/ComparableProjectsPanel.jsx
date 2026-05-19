// Comparable projects panel — pulls operating CS projects from cs_projects
// (NREL Sharing the Sun) for the current state, optionally narrowed by
// MW range. Splits the result into two sub-sections when the user's
// serving utility is known:
//   - "Same utility · N" (top 3) — most relevant comparables since they
//     share IX queue, rate base, regulatory environment
//   - "Statewide · N" (top 3) — broader benchmark, excluding the same-
//     utility rows above to avoid duplicates
//
// Honest empty states for each bucket. Falls back to a single statewide
// list when servingUtility is unknown.

import { useEffect, useState, useMemo } from 'react'
import { getCsProjectsAsComparables } from '../../lib/programData'
import LoadingDot from '../ui/LoadingDot'

// Utility name matching tolerates the naming drift between
// county_intelligence (interconnection.servingUtility, short form like
// "ComEd") and cs_projects.utility_name (NREL formal name, "Commonwealth
// Edison Company"). Substring match in either direction after
// normalization is the safest cheap approach; a curated alias table
// would be more precise but is overkill for a screening panel.
function normalizeUtility(s) {
  if (!s) return ''
  return String(s).toLowerCase().replace(/\s+/g, ' ').trim()
}

function utilityMatch(rowUtility, target) {
  if (!rowUtility || !target) return false
  const a = normalizeUtility(rowUtility)
  const b = normalizeUtility(target)
  if (!a || !b) return false
  return a.includes(b) || b.includes(a)
}

export default function ComparableProjectsPanel({ state, stateName, technology, mw, servingUtility = null }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    if (!state) return

    // Narrow to ±50% MW band so the comparables are project-shape relevant.
    // Wider on the low end since small CS projects are common; tighter at the
    // top since large CS rollups are rarer.
    const mwLo = mw != null ? Math.max(0.1, mw * 0.5) : 0.1
    const mwHi = mw != null ? mw * 2.0 : 100

    getCsProjectsAsComparables({ state, technology, mwRange: [mwLo, mwHi] })
      .then((data) => {
        if (cancelled) return
        // Sort by vintage desc (most recent first). Cap done downstream
        // per-bucket so the same-utility list isn't crowded out by
        // unrelated rows.
        const sorted = [...data].sort((a, b) => {
          const aYear = a.filingDate ? parseInt(a.filingDate.slice(0, 4), 10) : 0
          const bYear = b.filingDate ? parseInt(b.filingDate.slice(0, 4), 10) : 0
          return bYear - aYear
        })
        setRows(sorted)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e?.message || 'Failed to load comparables')
        setRows([])
      })

    return () => { cancelled = true }
  }, [state, technology, mw])

  const isCS = technology === 'Community Solar' || technology === 'Hybrid'

  // Bucket rows: same-utility rows surface first; statewide remainder
  // excludes them to avoid dupes. Memoized so the user dragging MW
  // doesn't thrash the sort on every keystroke.
  const { sameUtility, statewide } = useMemo(() => {
    if (!rows) return { sameUtility: [], statewide: [] }
    if (!servingUtility) return { sameUtility: [], statewide: rows.slice(0, 5) }
    const matched = []
    const other = []
    for (const r of rows) {
      if (utilityMatch(r.servingUtility, servingUtility)) {
        matched.push(r)
      } else {
        other.push(r)
      }
    }
    return { sameUtility: matched.slice(0, 3), statewide: other.slice(0, 3) }
  }, [rows, servingUtility])

  if (!isCS) {
    return (
      <div className="rounded-md px-4 py-3" style={{ background: 'rgba(15,26,46,0.04)', border: '1px solid #E2E8F0' }}>
        <div className="eyebrow-mono text-gray-500 mb-1">Comparable Projects</div>
        <div className="text-[11px] text-gray-600">
          NREL Sharing the Sun tracks community-solar projects only. {technology} comparables aren't in this dataset.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-md px-4 py-3 bg-white" style={{ border: '1px solid #E2E8F0' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="eyebrow-mono text-gray-500">
          Comparable Projects · {stateName || state}
        </div>
        <span className="text-[10px] font-mono text-gray-400">
          NREL Sharing the Sun
        </span>
      </div>

      {rows == null ? (
        <LoadingDot message="Loading comparables" />
      ) : rows.length === 0 ? (
        <div className="text-[11px] text-gray-600">
          No operating comparable CS projects in {stateName || state} match this size band (±50% MW). Try widening the project size lever.
        </div>
      ) : (
        <div className="space-y-3">
          {servingUtility && (
            <ComparableBucket
              header="Same utility"
              subhead={servingUtility}
              rows={sameUtility}
              emptyCopy={`No operating CS projects at ${servingUtility} match this size band yet — adjacent comparables shown below.`}
            />
          )}
          <ComparableBucket
            header={servingUtility ? 'Statewide' : `Statewide · ${stateName || state}`}
            subhead={servingUtility ? `Other utilities in ${stateName || state}` : null}
            rows={statewide}
            emptyCopy={`No additional comparable CS projects statewide match this size band.`}
          />
        </div>
      )}

      {error && (
        <div className="mt-2 text-[10px] text-amber-700">
          {error}
        </div>
      )}
    </div>
  )
}

function ComparableBucket({ header, subhead, rows, emptyCopy }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="eyebrow-mono text-gray-500">{header} · {rows.length}</span>
        {subhead && (
          <span className="text-[10px] text-gray-400 truncate max-w-[280px]">{subhead}</span>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="text-[10px] text-gray-500 italic leading-snug">{emptyCopy}</div>
      ) : (
        <table className="w-full text-[11px] tabular-nums">
          <thead>
            <tr className="text-left text-[9px] font-mono uppercase tracking-[0.16em] text-gray-500">
              <th className="py-1 pr-2 font-semibold">Project</th>
              <th className="py-1 pr-2 font-semibold">MW</th>
              <th className="py-1 pr-2 font-semibold">COD</th>
              <th className="py-1 pr-2 font-semibold">Utility</th>
              <th className="py-1 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className="py-1 pr-2 text-ink font-medium truncate max-w-[200px]"
                  title={r.name && r.name !== r.id ? `${r.name} · ${r.id}` : r.id}>
                  {r.name || r.id}
                </td>
                <td className="py-1 pr-2 text-ink">{r.mw != null ? r.mw.toFixed(1) : '—'}</td>
                <td className="py-1 pr-2 text-gray-600">
                  {r.filingDate ? r.filingDate.slice(0, 4) : '—'}
                </td>
                <td className="py-1 pr-2 text-gray-600 truncate max-w-[140px]">
                  {r.servingUtility || '—'}
                </td>
                <td className="py-1 text-gray-500 text-[10px] truncate max-w-[200px]">
                  {r.notes || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
