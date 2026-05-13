import { useState, useCallback, useRef, useEffect } from 'react'

// Owns bulk-selection state for a list of items keyed by `id`. Returns
// the selected-id Set, toggle / clear / selectAll callbacks, an
// `allSelected` derived flag, and the bulk-delete confirm modal pair
// (so a page can route the modal through this hook rather than threading
// a second piece of state).
//
// The selectAll callback uses a ref to the latest items array so it
// stays referentially stable across filter changes — useful when it's
// passed to a child button (no re-render on every filter tweak).
//
// Bulk *handlers* (delete, export, addToCompare) stay in the caller —
// they need too much external context (supabase, exportXLSX,
// useCompare, etc.) to live in a generic selection hook.
export function useBulkSelection(items) {
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkConfirm, setBulkConfirm] = useState(false) // bulk-delete confirm modal

  const itemsRef = useRef(items)
  useEffect(() => { itemsRef.current = items }, [items])

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(itemsRef.current.map((it) => it.id)))
  }, [])

  const allSelected = items.length > 0 && selectedIds.size >= items.length

  return {
    selectedIds,
    setSelectedIds,
    toggleSelect,
    clearSelection,
    selectAll,
    allSelected,
    bulkConfirm,
    setBulkConfirm,
  }
}
