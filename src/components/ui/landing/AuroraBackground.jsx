import { cn } from '@/lib/utils'

/**
 * AuroraBackground — soft animated aurora gradient behind a content
 * panel. Built from a stacked set of huge blurred radial gradients
 * with slow CSS keyframe motion. Designed for light-bg sections that
 * feel too plain (the §5 FAQ surface).
 *
 * Structure note: the mask sits on a STATIC parent and the animated
 * aurora layer is its child. If both were on the same element, the
 * mask would translate with the transform and the visible "hole"
 * would drift around the section — wrong behavior. With nesting, only
 * the painted gradients move; the clip stays anchored.
 *
 * Color palette stays in the Tractova brand range — teal at low
 * saturation + amber accent, mostly pastel so the aurora doesn't
 * compete with foreground text. Respects prefers-reduced-motion via
 * .lp-aurora rules in index.css.
 *
 * Props:
 *   - className   — applied to the wrapper section (height, padding, bg)
 *   - showRadialMask — clip the aurora to a centered radial mask
 *   - children    — the section content rendered above the aurora
 */
export function AuroraBackground({ className, showRadialMask = true, children }) {
  return (
    <div className={cn('relative isolate overflow-hidden', className)}>
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 -z-10 pointer-events-none',
          showRadialMask && '[mask-image:radial-gradient(ellipse_at_center,_black_40%,_transparent_85%)]',
        )}
      >
        <div className="absolute inset-0 lp-aurora" />
      </div>
      {children}
    </div>
  )
}
