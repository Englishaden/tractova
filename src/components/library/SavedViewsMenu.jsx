import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

// ── SavedViewsMenu — named filter presets (Pass 5, Wave 4) ───────────────────
// Lives in the LibraryCommandBar's savedViewsSlot. Snapshots the current
// filter combo ({state, structure, stage, tags, search, sort}) into the
// saved_views table (migration 075) under a name, and restores it in one click.
// Mirrors SavedComparisonsList's silent-RLS-fail pattern: if the table is
// missing (migration unapplied) the fetch errors and the menu just shows its
// empty state — the rest of the command bar is unaffected.

export default function SavedViewsMenu({ currentView, onApply, canSave }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [views, setViews] = useState([])
  const [draftName, setDraftName] = useState('')
  const [saving, setSaving] = useState(false)
  const ref = useRef(null)

  const fetchViews = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('saved_views')
        .select('id, name, filters')
        .order('created_at', { ascending: false })
      if (!error && data) setViews(data)
    } catch { /* table missing / RLS — silent, empty menu */ }
  }, [user])

  useEffect(() => { fetchViews() }, [fetchViews])

  // Close on outside-click / Esc.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onEsc) }
  }, [open])

  const save = async () => {
    const name = draftName.trim().slice(0, 60)
    if (!name || !user || saving) return
    setSaving(true)
    try {
      const { data, error } = await supabase
        .from('saved_views')
        .insert({ user_id: user.id, name, filters: currentView })
        .select('id, name, filters')
        .single()
      if (!error && data) setViews(v => [data, ...v])
      setDraftName('')
    } catch { /* silent */ } finally { setSaving(false) }
  }

  const remove = async (id) => {
    setViews(v => v.filter(x => x.id !== id))
    try { await supabase.from('saved_views').delete().eq('id', id) } catch { /* silent */ }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Saved views"
        className={`flex items-center gap-1.5 text-[11px] font-medium rounded-lg px-2.5 py-1.5 cursor-pointer transition-colors bg-white border focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500/20 ${
          views.length ? 'text-teal-700 border-teal-200 hover:border-teal-300' : 'text-gray-500 border-gray-200 hover:border-gray-300'
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
        <span>Views{views.length ? ` · ${views.length}` : ''}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-gray-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute z-50 left-0 top-full mt-1.5 w-64 bg-white border border-gray-200 rounded-lg overflow-hidden"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)' }}
        >
          {views.length > 0 ? (
            <ul className="max-h-60 overflow-y-auto py-1">
              {views.map((v) => (
                <li key={v.id} className="group flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-primary-50 transition-colors">
                  <button
                    type="button"
                    onClick={() => { onApply(v.filters || {}); setOpen(false) }}
                    className="flex-1 text-left text-[11px] font-medium text-gray-700 group-hover:text-primary-700 truncate"
                  >
                    {v.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(v.id)}
                    aria-label={`Delete view ${v.name}`}
                    className="shrink-0 text-gray-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-[10px] text-gray-400 leading-relaxed">No saved views yet. Set up filters, then save the combo below to recall it in one click.</p>
          )}

          {/* Save-current row */}
          <div className="border-t border-gray-100 p-2 flex items-center gap-1.5">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save() }}
              placeholder={canSave ? 'Name this view…' : 'Apply a filter first'}
              disabled={!canSave}
              maxLength={60}
              aria-label="Name for the current view"
              className="flex-1 min-w-0 text-[11px] rounded-md px-2 py-1.5 bg-white border border-gray-200 text-ink placeholder:text-gray-400 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500/20 focus:border-teal-300 transition-colors disabled:bg-gray-50"
            />
            <button
              type="button"
              onClick={save}
              disabled={!canSave || !draftName.trim() || saving}
              className="shrink-0 text-[11px] font-semibold px-2.5 py-1.5 rounded-md text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#0F766E' }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
