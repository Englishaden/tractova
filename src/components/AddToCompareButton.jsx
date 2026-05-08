import { useCompare, lensResultToCompareItem } from '../context/CompareContext'

// ─────────────────────────────────────────────────────────────────────────────
// Save confirmation toast
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Add-to-compare button (wired to CompareContext)
// ─────────────────────────────────────────────────────────────────────────────
export default function AddToCompareButton({ results }) {
  const { add, remove, isInCompare, items, MAX_ITEMS } = useCompare()
  const item = lensResultToCompareItem(results)
  const inCompare = isInCompare(item.id)
  const atLimit = !inCompare && items.length >= MAX_ITEMS

  const handleClick = () => {
    if (inCompare) { remove(item.id); return }
    add(item)
  }

  return (
    <button
      onClick={handleClick}
      disabled={atLimit}
      title={atLimit ? `Compare tray full (max ${MAX_ITEMS})` : undefined}
      className={`flex items-center gap-2 border text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
        inCompare
          ? 'border-primary bg-primary-50 text-primary'
          : atLimit
            ? 'bg-white border-gray-200 text-gray-300 cursor-not-allowed'
            : 'bg-white border-gray-200 text-gray-700 hover:border-primary hover:text-primary'
      }`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
      {inCompare ? 'In Compare' : 'Add to Compare'}
    </button>
  )
}
