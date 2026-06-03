import { useState, useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useCompare, lensResultToCompareItem } from '../context/CompareContext'

// ─────────────────────────────────────────────────────────────────────────────
// Add-to-compare button (wired to CompareContext)
// On a fresh add, the bar-chart glyph briefly morphs to a checkmark + "Added"
// (a satisfying success microinteraction) before settling into the persistent
// "In Compare" state. Reduced-motion users get the same content swap without
// the pop animation.
// ─────────────────────────────────────────────────────────────────────────────
export default function AddToCompareButton({ results }) {
  const { add, remove, isInCompare, items, MAX_ITEMS } = useCompare()
  const reduced = useReducedMotion()
  const item = lensResultToCompareItem(results)
  const inCompare = isInCompare(item.id)
  const atLimit = !inCompare && items.length >= MAX_ITEMS

  // Transient "just added" flash — fires only on the false→true edge.
  const [justAdded, setJustAdded] = useState(false)
  const prev = useRef(inCompare)
  const timer = useRef(null)
  useEffect(() => {
    if (inCompare && !prev.current) {
      setJustAdded(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setJustAdded(false), 1200)
    }
    prev.current = inCompare
  }, [inCompare])
  useEffect(() => () => clearTimeout(timer.current), [])

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
      {justAdded ? (
        <motion.svg
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          initial={reduced ? false : { scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 17 }}
        >
          <polyline points="20 6 9 17 4 12" />
        </motion.svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      )}
      {justAdded ? 'Added' : inCompare ? 'In Compare' : 'Add to Compare'}
    </button>
  )
}
