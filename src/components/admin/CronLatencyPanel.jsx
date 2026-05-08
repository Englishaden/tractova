// Extracted from src/pages/Admin.jsx in Plan E Sprint E.2 (2026-05-07).
// Cron Latency Panel — surfaces handlers approaching their function
// ceiling. Surfaced inside DataHealthTab. Reads cron_runs (30-day
// window) and reports p95 vs maxDuration per cron.

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { analyzeCronLatency } from '../../lib/cronLatencyMonitor'

export default function CronLatencyPanel() {
  const [state, setState] = useState({ loading: true, error: null, data: null })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const result = await analyzeCronLatency(supabase, 30)
      if (cancelled) return
      if (!result.ok) setState({ loading: false, error: result.error, data: null })
      else setState({ loading: false, error: null, data: result })
    })()
    return () => { cancelled = true }
  }, [])

  const fmtMs = (ms) => {
    if (ms == null) return '—'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60_000).toFixed(1)}m`
  }

  const SEVERITY_STYLE = {
    warn:  { bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.30)', dot: '#DC2626', label: 'WARN'  },
    watch: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.30)',dot: '#D97706', label: 'WATCH' },
    ok:    { bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.20)',dot: '#10B981', label: 'OK'    },
  }

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <h3 className="text-sm font-bold text-gray-900">Cron Latency</h3>
        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-gray-400">
          p95 vs maxDuration · 30-day window
        </span>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
        Catches the next 504 before users do. Any handler whose p95 exceeds
        70% of its function ceiling needs structural attention — sequential
        per-state calls, slow upstream sources, or a missing parallelization
        pass. The original <span className="font-mono">refresh-substations</span> 504
        (commit <span className="font-mono">bbc9543</span>) would have surfaced
        here weeks earlier.
      </p>

      {state.loading && (
        <div className="flex items-center gap-2 text-[11px] text-gray-400">
          <span className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
          Loading latency rollup…
        </div>
      )}

      {state.error && (
        <div className="text-[11px] text-red-500">
          Failed to load cron latency: {state.error}
        </div>
      )}

      {state.data && state.data.rows.length === 0 && (
        <p className="text-[11px] text-gray-400 italic">
          No successful cron runs in the last {state.data.windowDays} days.
        </p>
      )}

      {state.data && state.data.rows.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-[10px] font-mono uppercase tracking-[0.16em] text-gray-500">
                <th className="px-3 py-2 font-bold">Cron Name</th>
                <th className="px-3 py-2 font-bold text-right">Runs</th>
                <th className="px-3 py-2 font-bold text-right">p95</th>
                <th className="px-3 py-2 font-bold text-right">Max</th>
                <th className="px-3 py-2 font-bold text-right">Avg</th>
                <th className="px-3 py-2 font-bold text-right">Ceiling</th>
                <th className="px-3 py-2 font-bold text-right">Headroom</th>
                <th className="px-3 py-2 font-bold">Severity</th>
              </tr>
            </thead>
            <tbody>
              {state.data.rows.map((r) => {
                const sty = SEVERITY_STYLE[r.severity] || SEVERITY_STYLE.ok
                return (
                  <tr key={r.cron_name} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 font-mono text-gray-700">{r.cron_name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.sample_count}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900">{fmtMs(r.p95_ms)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtMs(r.max_ms)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtMs(r.avg_ms)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{fmtMs(r.ceiling_ms)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.headroom_pct}%</td>
                    <td className="px-3 py-2">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-[0.14em] font-bold"
                        style={{ background: sty.bg, color: sty.dot, border: `1px solid ${sty.border}` }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sty.dot }} />
                        {sty.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
