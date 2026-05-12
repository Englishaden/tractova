import { useEffect, useState } from 'react'
import { listSavedComparisons, deleteSavedComparison, renameSavedComparison } from '../../lib/savedComparisons'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/Dialog'
import { useToast } from '../ui/Toast'

// ── SavedComparisonsList ─────────────────────────────────────────────────────
// Phase 2C of TRACTOVA-UX-001 — Library tab for re-opening / renaming /
// deleting persisted comparisons (migration 062). Opens straight into the
// Compare modal by hydrating CompareContext from the snapshot column.
//
// The hosting view (Library) keeps the data plumbing local; this component
// owns its own fetch since the list is small and the user is unlikely to
// open this tab on every Library visit. Surfaces an empty state CTA so
// new users know how to get here.
export default function SavedComparisonsList() {
  const [rows, setRows] = useState(null)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    listSavedComparisons().then((data) => {
      if (!cancelled) setRows(data)
    })
    return () => { cancelled = true }
  }, [])

  const reload = async () => {
    const data = await listSavedComparisons()
    setRows(data)
  }

  const openInModal = (row) => {
    if (!Array.isArray(row?.snapshot) || row.snapshot.length === 0) {
      toast.error('Could not open comparison', { description: 'The saved snapshot is empty or malformed.' })
      return
    }
    // Single-click flow: dispatch `tractova:load-compare` with the
    // snapshot directly. CompareTray's listener hydrates items AND
    // opens the modal atomically. The older two-step (load + dispatch
    // tractova:open-compare) required two clicks because the
    // tractova:open-compare listener closed over a stale items.length=0
    // until the load() setItems propagated through a re-render.
    try {
      window.dispatchEvent(new CustomEvent('tractova:load-compare', { detail: { snapshot: row.snapshot } }))
    } catch { /* SSR-safe */ }
  }

  if (rows === null) {
    // Initial load — keep it light, no fullscreen overlay; this tab is
    // a side-trip, not a primary workflow surface.
    return (
      <div className="rounded-xl px-8 py-10 mt-2 text-center" style={{ background: 'rgba(15,118,110,0.03)', border: '1px solid #E2E8F0' }}>
        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-ink-muted">Loading saved comparisons…</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl px-8 py-10 mt-2 text-center" style={{ background: 'rgba(20,184,166,0.04)', border: '1px solid rgba(20,184,166,0.20)' }}>
        <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold mb-2" style={{ color: '#0F766E' }}>
          ◆ No saved comparisons yet
        </p>
        <h2 className="font-serif text-xl font-semibold text-ink mb-2">Stack two projects and save the comparison</h2>
        <p className="text-[13px] text-gray-500 max-w-md mx-auto leading-relaxed">
          Add projects to Compare from Library or Lens results, open the tray's <span className="font-mono text-[11px]">Compare</span> button, then hit <span className="font-mono text-[11px]">Save as…</span> to keep the side-by-side analysis as a re-openable artifact. Saved comparisons surface here and in <span className="font-mono text-[11px]">⌘K → :compare</span>.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const ageDays = Math.floor((Date.now() - new Date(row.updated_at).getTime()) / 86_400_000)
        const ageLabel = ageDays < 1 ? 'today' : ageDays < 7 ? `${ageDays}d ago` : `${Math.floor(ageDays / 7)}w ago`
        const count = row.item_ids?.length || 0
        const states = Array.isArray(row.snapshot)
          ? Array.from(new Set(row.snapshot.map(it => it?.state).filter(Boolean))).slice(0, 5).join(' · ')
          : ''
        return (
          <div
            key={row.id}
            className="rounded-xl bg-white flex items-center justify-between gap-3 px-5 py-3"
            style={{ border: '1px solid #E2E8F0' }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold px-2 py-0.5 rounded-sm"
                  style={{ background: 'rgba(20,184,166,0.12)', color: '#0F766E' }}
                >
                  ◆ {count} project{count === 1 ? '' : 's'}
                </span>
                <span className="font-serif text-[14px] font-semibold text-ink truncate">{row.name}</span>
              </div>
              <p className="text-[11px] text-gray-500 mt-1 truncate">
                {states ? <>{states}</> : <span className="italic">No state info in snapshot</span>}
                <span className="text-gray-400"> · last updated {ageLabel}</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => openInModal(row)}
                className="cursor-pointer text-[11px] font-semibold text-white px-3 py-1.5 rounded-md transition-colors"
                style={{ background: '#0F766E' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#115E59'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#0F766E'}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => { setRenameTarget(row); setRenameName(row.name) }}
                className="cursor-pointer text-[10px] font-mono uppercase tracking-widest text-ink-muted hover:text-ink px-2 py-1.5 rounded-md transition-colors"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(row)}
                className="cursor-pointer text-gray-300 hover:text-red-500 transition-colors p-1.5 rounded-md"
                aria-label={`Delete comparison ${row.name}`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          </div>
        )
      })}

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) setRenameTarget(null) }}>
        <DialogContent>
          <DialogTitle>Rename comparison</DialogTitle>
          <DialogDescription>Pick a name that'll make sense weeks from now.</DialogDescription>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!renameTarget || !renameName.trim()) return
              const updated = await renameSavedComparison(renameTarget.id, renameName)
              if (updated) {
                toast.success('Comparison renamed')
                setRenameTarget(null)
                reload()
              } else {
                toast.error('Rename failed')
              }
            }}
            className="mt-4"
          >
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              autoFocus
              maxLength={120}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-ink outline-hidden focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-500/30"
            />
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="cursor-pointer text-sm text-ink-muted hover:text-ink px-3 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!renameName.trim()}
                className="cursor-pointer text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                style={{ background: '#0F766E' }}
              >
                Save
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}>
        <DialogContent>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(220,38,38,0.08)' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </div>
            <DialogTitle>Delete "{confirmDelete?.name}"?</DialogTitle>
          </div>
          <DialogDescription>
            Removes the saved snapshot. Your project list and Lens analyses are untouched. This can't be undone.
          </DialogDescription>
          <div className="flex items-center justify-end gap-2 mt-5">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="cursor-pointer text-sm text-ink-muted hover:text-ink px-3 py-2 rounded-lg transition-colors"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={async () => {
                const target = confirmDelete
                if (!target) return
                const ok = await deleteSavedComparison(target.id)
                if (ok) {
                  setConfirmDelete(null)
                  setRows((r) => r.filter(x => x.id !== target.id))
                  toast.success('Comparison deleted')
                  // Library listens for this event to refresh the
                  // Comparisons tab badge count.
                  try { window.dispatchEvent(new CustomEvent('tractova:saved-comparisons-changed')) } catch { /* SSR-safe */ }
                } else {
                  toast.error('Delete failed')
                }
              }}
              className="cursor-pointer text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              style={{ background: '#DC2626' }}
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
