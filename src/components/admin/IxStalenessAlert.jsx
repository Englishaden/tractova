// Extracted from src/pages/Admin.jsx in Plan E Sprint E.2 (2026-05-07).
// IX scraper staleness alert — flags ISOs frozen past the 7-day
// freshness window, surfaced inside DataHealthTab. Reads ix_queue_data
// for worst-case fetched_at per ISO and reports any > 7 days.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function IxStalenessAlert() {
  const [state, setState] = useState({ loading: true, stale: [], totalIsos: 0 })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('ix_queue_data')
        .select('state_id, iso, utility_name, fetched_at')
      if (cancelled) return
      if (error || !data) {
        setState({ loading: false, stale: [], totalIsos: 0 })
        return
      }
      // Worst-case fetched_at per ISO.
      const byIso = {}
      for (const row of data) {
        if (!row.fetched_at) continue
        const ts = new Date(row.fetched_at).getTime()
        if (!byIso[row.iso] || ts < byIso[row.iso].oldest) {
          byIso[row.iso] = { oldest: ts, fetched_at: row.fetched_at }
        }
      }
      const now = Date.now()
      const stale = Object.entries(byIso)
        .map(([iso, v]) => ({
          iso,
          ageDays: Math.floor((now - v.oldest) / (1000 * 60 * 60 * 24)),
          fetchedAt: v.fetched_at,
        }))
        .filter((r) => r.ageDays > 7)
        .sort((a, b) => b.ageDays - a.ageDays)
      setState({ loading: false, stale, totalIsos: Object.keys(byIso).length })
    })()
    return () => { cancelled = true }
  }, [])

  if (state.loading || state.stale.length === 0) return null

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid rgba(217,119,6,0.30)', borderLeft: '3px solid #D97706' }}
    >
      <div
        className="px-4 py-2.5 flex items-baseline justify-between gap-2 border-b border-amber-100"
        style={{ background: 'rgba(217,119,6,0.05)' }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold text-amber-800">
          ◆ IX scraper staleness · {state.stale.length} of {state.totalIsos} ISOs frozen
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
          7-day window
        </span>
      </div>
      <div className="px-4 py-3 bg-white">
        <p className="text-[11px] text-amber-900 leading-relaxed mb-2">
          The following ISO queue scrapers haven't returned fresh data in &gt;7 days. The Lens IX · Live pill flips amber + "stale Nd" for affected states. Repair likely requires finding new public download URLs (PJM Cycles reform, NYISO portal moves, ISO-NE iRTT URL changes).
        </p>
        <div className="space-y-1.5">
          {state.stale.map((s) => (
            <div
              key={s.iso}
              className="flex items-center justify-between text-[12px] px-2.5 py-1.5 rounded-md"
              style={{ background: 'rgba(217,119,6,0.06)' }}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] font-bold text-amber-800">{s.iso}</span>
                <span className="text-amber-900">last fresh pull {s.ageDays} day{s.ageDays === 1 ? '' : 's'} ago</span>
              </div>
              <span className="text-[10px] text-gray-500 font-mono tabular-nums">
                {new Date(s.fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
