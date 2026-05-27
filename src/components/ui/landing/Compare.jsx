import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

/**
 * Compare — before/after slider with a vertical divider that follows
 * the cursor (hover mode) or drags (drag mode). Supports both image
 * sources AND arbitrary React children (the "first" / "second" props
 * accept either).
 *
 * For the Tractova landing we use the children variant — left side is
 * the "manual research" panel (text-heavy one-pager mock), right side
 * is the "Tractova Lens" panel (sleek dashboard mock). slideMode is
 * 'hover' so casual visitors get the effect without needing to drag.
 *
 * Props:
 *   - first / second        — content for each side (string URL OR JSX)
 *   - firstClassName / secondClassName — applied to the inner panels
 *   - slideMode             — 'hover' (default) | 'drag'
 *   - initial               — starting % position 0–100 (default 50)
 *   - className             — applied to the outer container
 */
export function Compare({
  first,
  second,
  firstClassName,
  secondClassName,
  slideMode = 'hover',
  initial = 50,
  className,
}) {
  const containerRef = useRef(null)
  const [pos, setPos] = useState(initial)
  const [dragging, setDragging] = useState(false)

  const moveTo = (clientX) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    const next = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setPos(next)
  }

  // Drag handlers
  useEffect(() => {
    if (slideMode !== 'drag') return
    if (!dragging) return
    const onMove = (e) => moveTo(e.clientX ?? e.touches?.[0]?.clientX)
    const onUp = () => setDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }
  }, [slideMode, dragging])

  const onContainerMove = (e) => {
    if (slideMode === 'hover') moveTo(e.clientX)
  }

  // Deliberate: NO onMouseLeave snap-back. The user-reported issue was
  // the divider jumping to center the moment the cursor exited — that's
  // jarring, especially mid-drag. Leaving the divider at its last
  // position is the expected behavior for a "scrub on hover" interaction.

  const renderPanel = (value, klass) => {
    if (typeof value === 'string') {
      return (
        <img
          src={value}
          alt=""
          className={cn('h-full w-full object-cover select-none pointer-events-none', klass)}
          draggable={false}
        />
      )
    }
    return <div className={cn('h-full w-full', klass)}>{value}</div>
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={onContainerMove}
      className={cn('relative overflow-hidden select-none', className)}
      style={{ touchAction: slideMode === 'drag' ? 'none' : undefined }}
    >
      {/* First (left) — always full-width underneath */}
      <div className="absolute inset-0">
        {renderPanel(first, firstClassName)}
      </div>

      {/* Second (right) — clipped to (100 - pos)% from the right */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      >
        {renderPanel(second, secondClassName)}
      </div>

      {/* Divider + handle */}
      <div
        className="absolute top-0 bottom-0 z-20 pointer-events-none"
        style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
      >
        <span className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/40" />
        <button
          type="button"
          aria-label="Drag to compare"
          onMouseDown={() => slideMode === 'drag' && setDragging(true)}
          onTouchStart={() => slideMode === 'drag' && setDragging(true)}
          className={cn(
            'pointer-events-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
            'flex h-8 w-8 items-center justify-center rounded-full',
            'bg-white text-[#0F1A2E] shadow-lg ring-2 ring-white/30',
            slideMode === 'drag' && 'cursor-ew-resize',
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 6 9 12 15 18"/>
            <polyline points="9 6 15 12 9 18"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
