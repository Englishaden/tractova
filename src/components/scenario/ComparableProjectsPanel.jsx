// Comparable projects panel — pulls operating CS projects from cs_projects
// (NREL Sharing the Sun) for the current state, optionally narrowed by
// MW range. Honest empty state when the table has no rows for the state
// (most non-CS-active states).
//
// Uses the existing getCsProjectsAsComparables helper — no new endpoint,
// no new query path. The helper already shapes rows for comparable_deals
// rendering so we reuse the data shape here.

import { useEffect, useState } from 'react'
import { getCsProjectsAsComparables } from '../../lib/programData'

export default function ComparableProjectsPanel({ state, stateName, technology, mw }) {
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
        // Sort by vintage desc (most recent first); cap at 5 for readability.
        const sorted = [...data].sort((a, b) => {
          const aYear = a.filingDate ? parseInt(a.filingDate.slice(0, 4), 10) : 0
          const bYear = b.filingDate ? parseInt(b.filingDate.slice(0, 4), 10) : 0
          return bYear - aYear
        }).slice(0, 5)
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
        <div className="eyebrow-mono text-gray-500">Comparable Projects · {stateName || state}</div>
        <span className="text-[10px] font-mono text-gray-400">
          NREL Sharing the Sun
        </span>
      </div>

      {rows == null ? (
        <div className="text-[11px] text-gray-500 italic">Loading comparables…</div>
      ) : rows.length === 0 ? (
        <div className="text-[11px] text-gray-600">
          No operating comparable CS projects in {stateName || state} match this size band (±50% MW). Try widening the project size lever.
        </div>
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
                <td className="py-1 pr-2 text-ink font-medium truncate max-w-[180px]">
                  {r.id}
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

      {error && (
        <div className="mt-2 text-[10px] text-amber-700">
          {error}
        </div>
      )}
    </div>
  )
}
