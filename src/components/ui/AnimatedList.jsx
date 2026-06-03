import { Children, useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'

// AnimatedList — staggered entrance for a list of items. JSX port of the
// Magic UI "Animated List" pattern (Skills/Animated List.md), re-themed for
// our stack: plain children, motion/react, reduced-motion safe.
//
// Unlike the Magic-UI demo (which cycles a notification stream), this is an
// ENTRANCE animation: each child springs/fades up once on mount, staggered by
// `delay` per item. Good for feed cards / reveal lists where you want the rows
// to cascade in rather than pop all at once. Re-renders don't re-fire it
// (mount-once via the variants on the container).
//
// Usage:
//   <AnimatedList className="..." delay={0.06}>
//     {items.map((it) => <li key={it.id}>...</li>)}
//   </AnimatedList>
//
// For a non-list container (e.g. a card grid), pass matching tags so the markup
// stays valid — `<li>` inside a `<div>` is invalid:
//   <AnimatedList as="div" itemAs="div" className="grid ..." delay={0.06}>
export default function AnimatedList({ children, className = '', delay = 0.07, as: Tag = 'ul', itemAs = 'li' }) {
  const reduced = useReducedMotion()
  const items = useMemo(() => Children.toArray(children), [children])

  if (reduced) {
    return <Tag className={className}>{children}</Tag>
  }

  const MotionTag = motion[Tag] || motion.ul
  const MotionItem = motion[itemAs] || motion.li

  return (
    <MotionTag
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: delay } },
      }}
    >
      {items.map((child, i) => (
        <MotionItem
          key={child.key ?? i}
          variants={{
            hidden: { opacity: 0, y: 8 },
            show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 30 } },
          }}
          style={{ listStyle: 'none' }}
        >
          {child}
        </MotionItem>
      ))}
    </MotionTag>
  )
}
