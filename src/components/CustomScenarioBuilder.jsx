import { useState } from 'react'
import { computeScoreDelta } from '../pages/Search.jsx'

// ── Custom Scenario Builder ─────────────────────────────────────────────────
export default function CustomScenarioBuilder({ stateProgram, technology }) {
  const [open, setOpen] = useState(false)
  const [customIX, setCustomIX] = useState(stateProgram?.ixDifficulty || 'moderate')
  const [customCS, setCustomCS] = useState(stateProgram?.csStatus || 'active')

  if (!stateProgram) return null

  const override = {}
  if (customIX !== stateProgram.ixDifficulty) override.ixDifficulty = customIX
  if (customCS !== stateProgram.csStatus) override.csStatus = customCS
  const hasChange = Object.keys(override).length > 0
  const delta = hasChange ? computeScoreDelta(stateProgram, override) : 0

  return (
    <div className="mt-3 rounded-lg" style={{ border: '1px dashed rgba(107,114,128,0.25)' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span className="text-[10px] font-semibold text-gray-500">Custom Scenario</span>
        </div>
        <svg
          className={`transition-transform duration-200 text-gray-400 ${open ? 'rotate-180' : ''}`}
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(107,114,128,0.12)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">IX Difficulty</label>
              <select
                value={customIX}
                onChange={e => setCustomIX(e.target.value)}
                className="w-full text-xs px-2 py-1.5 rounded-sm border border-gray-200 bg-white text-gray-700 focus:ring-1 focus:ring-blue-300 focus:border-blue-300 outline-hidden"
              >
                <option value="easy">Easy</option>
                <option value="moderate">Moderate</option>
                <option value="hard">Hard</option>
                <option value="very_hard">Very Hard</option>
              </select>
            </div>
            {technology === 'Community Solar' && (
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 block mb-1">CS Program Status</label>
                <select
                  value={customCS}
                  onChange={e => setCustomCS(e.target.value)}
                  className="w-full text-xs px-2 py-1.5 rounded-sm border border-gray-200 bg-white text-gray-700 focus:ring-1 focus:ring-blue-300 focus:border-blue-300 outline-hidden"
                >
                  <option value="active">Active</option>
                  <option value="limited">Limited</option>
                  <option value="pending">Pending</option>
                  <option value="none">None</option>
                </select>
              </div>
            )}
          </div>

          {hasChange && (
            <div className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: delta > 0 ? 'rgba(15,118,110,0.06)' : delta < 0 ? 'rgba(220,38,38,0.04)' : 'rgba(107,114,128,0.04)' }}>
              <span className={`text-xs font-bold tabular-nums ${delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-700' : 'text-gray-500'}`}>
                Index impact: {delta > 0 ? '+' : ''}{delta} pts
              </span>
              <span className="text-[10px] text-gray-400">vs. current base case</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
