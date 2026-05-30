import { forwardRef } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import * as Lucide from 'lucide-react'

// AnimatedIcon — a native JSX wrapper that gives ANY lucide-react icon a
// tasteful hover animation, without pulling in the lucide-animated TSX
// registry (our repo is JSX, shadcn tsx:false). Same effect, our stack.
//
// Usage:
//   <AnimatedIcon name="ChevronDown" size={16} animation="bob" />
//   <AnimatedIcon name="RefreshCw" animation="spin" trigger="hover" />
//
// The wrapper renders <motion.span> around a Lucide icon and drives the
// animation via a `whileHover` (or `animate`) variant. Reduced-motion
// renders the static icon. Pass-through props (className, color, strokeWidth,
// onClick, aria-label) go to the Lucide icon.
//
// `name` is any PascalCase lucide-react export (e.g. 'Map', 'Bell', 'Search',
// 'Maximize2', 'ChevronRight'). Invalid names render nothing (dev-warn).

// Motion variants — one per animation kind. Each is { rest, active }.
const VARIANTS = {
  // gentle vertical bob — good for chevrons / expand affordances
  bob:   { rest: { y: 0 },                 active: { y: [0, 2, 0] } },
  // nudge right — "go / next / open"
  nudge: { rest: { x: 0 },                 active: { x: [0, 3, 0] } },
  // one full spin — refresh / sync
  spin:  { rest: { rotate: 0 },            active: { rotate: 360 } },
  // pulse scale — live / alert
  pulse: { rest: { scale: 1 },             active: { scale: [1, 1.18, 1] } },
  // wiggle — bell / attention
  wiggle:{ rest: { rotate: 0 },            active: { rotate: [0, -12, 10, -6, 0] } },
  // pop — generic press feedback
  pop:   { rest: { scale: 1 },             active: { scale: [1, 1.25, 1] } },
}

const DURATIONS = { bob: 0.5, nudge: 0.4, spin: 0.6, pulse: 0.5, wiggle: 0.5, pop: 0.35 }

const AnimatedIcon = forwardRef(function AnimatedIcon(
  {
    name,
    animation = 'bob',
    trigger = 'hover',      // 'hover' | 'always' | 'none'
    size = 16,
    strokeWidth = 2,
    className = '',
    spanClassName = '',
    color,
    'aria-label': ariaLabel,
    onClick,
    ...rest
  },
  ref
) {
  const reduced = useReducedMotion()
  const Icon = Lucide[name]
  if (!Icon) {
    if (import.meta.env?.DEV) console.warn(`[AnimatedIcon] unknown lucide icon: "${name}"`)
    return null
  }

  const variant = VARIANTS[animation] || VARIANTS.bob
  const transition = { duration: DURATIONS[animation] || 0.5, ease: 'easeInOut' }

  // Reduced-motion or trigger 'none' → static icon, no motion wrapper.
  if (reduced || trigger === 'none') {
    return (
      <span ref={ref} className={spanClassName} onClick={onClick}>
        <Icon size={size} strokeWidth={strokeWidth} className={className} color={color} aria-label={ariaLabel} {...rest} />
      </span>
    )
  }

  const motionProps =
    trigger === 'always'
      ? { animate: 'active', initial: 'rest', transition: { ...transition, repeat: Infinity, repeatDelay: 1.2 } }
      : { initial: 'rest', whileHover: 'active', transition }

  return (
    <motion.span
      ref={ref}
      className={`inline-flex ${spanClassName}`}
      variants={variant}
      onClick={onClick}
      style={{ lineHeight: 0 }}
      {...motionProps}
    >
      <Icon size={size} strokeWidth={strokeWidth} className={className} color={color} aria-label={ariaLabel} {...rest} />
    </motion.span>
  )
})

export default AnimatedIcon
