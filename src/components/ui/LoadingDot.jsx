/**
 * LoadingDot — V3 standard loading affordance.
 *
 * Pattern: animated teal dot + mono-caps message in ink-muted.
 * Used wherever the surface is waiting on data and a button-style
 * spinner would feel out of place. For inline button spinners,
 * keep the existing border-spin pattern.
 *
 * Variants:
 *   size 'sm' (default, 8px dot, 11px text)
 *   size 'md'                (10px dot, 12px text)
 *
 * Props:
 *   message: the caption text (e.g. 'Loading audit trail').
 *            No trailing ellipsis -- the pulse animation is the
 *            "in progress" signal already.
 */
export default function LoadingDot({ message = 'Loading', size = 'sm', className = '' }) {
  const dotSize = size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2'
  const textSize = size === 'md' ? 'text-[12px]' : 'text-[11px]'
  return (
    <div className={`flex items-center gap-2 font-mono ${textSize} uppercase tracking-[0.18em] text-ink-muted ${className}`}>
      <span className={`${dotSize} rounded-full animate-pulse`} style={{ background: '#14B8A6' }} />
      {message}
    </div>
  )
}
