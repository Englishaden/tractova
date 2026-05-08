import { useCompare, libraryProjectToCompareItem } from '../../context/CompareContext'

// ── Compare chip (icon-only button, sits in card right controls) ─────────────
export default function CompareChip({ project, stateProgram = null, countyData = null }) {
  const { add, remove, isInCompare, items, MAX_ITEMS } = useCompare()
  const item = libraryProjectToCompareItem(project, stateProgram, countyData)
  const inCompare = isInCompare(item.id)
  const atLimit = !inCompare && items.length >= MAX_ITEMS

  const handleClick = (e) => {
    e.stopPropagation()
    if (inCompare) { remove(item.id); return }
    add(item)
  }

  const tooltipText = inCompare ? 'Remove from compare' : atLimit ? `Compare tray full (max ${MAX_ITEMS})` : 'Add to compare'

  return (
    <button
      onClick={handleClick}
      disabled={atLimit}
      aria-label={tooltipText}
      className={`group relative p-1 transition-colors ${
        inCompare
          ? 'text-teal-700'
          : atLimit
            ? 'text-gray-200 cursor-not-allowed'
            : 'text-gray-300 hover:text-teal-700'
      }`}
    >
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-sm bg-gray-900 text-white text-[9px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-75 z-10">
        {tooltipText}
      </span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    </button>
  )
}
