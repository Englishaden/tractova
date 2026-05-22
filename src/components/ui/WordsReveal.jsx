import { useContext, useEffect } from 'react'
import { motion, useMotionValue, useTransform, useReducedMotion, animate } from 'motion/react'
import { AssembleContext } from './ScrollAssemble'

// Headline reveal — each word rises + sharpens (blur → 0) in sequence, the
// "words open up" beat Aden flagged from the Huly hero. When rendered inside a
// ScrollAssemble it rides that shared progress (words re-gather on scroll in
// lockstep with the panel); standalone, it plays a one-shot intro on mount.
// Reduced-motion renders the plain text.
export default function WordsReveal({ text, className }) {
  const reduce = useReducedMotion()
  const ctxMV = useContext(AssembleContext)
  const localMV = useMotionValue(reduce ? 1 : 0)

  useEffect(() => {
    if (reduce || ctxMV) return
    const c = animate(localMV, 1, { duration: 1.2, ease: [0.16, 1, 0.3, 1] })
    return () => c.stop()
  }, [reduce, ctxMV, localMV])

  if (reduce) return <span className={className}>{text}</span>

  const mv = ctxMV || localMV
  const words = String(text).split(' ').filter(Boolean)
  return (
    <span className={className} style={{ display: 'inline-block' }}>
      {words.map((w, i) => (
        <Word key={`${w}-${i}`} word={w} index={i} total={words.length} mv={mv} />
      ))}
    </span>
  )
}

function Word({ word, index, total, mv }) {
  // Stagger: each word trails the last; all finish within the first ~55% of
  // the assemble so the headline is settled well before the panel.
  const span = 0.45
  const start = total > 1 ? (index / total) * (1 - span) : 0
  const p = useTransform(mv, [start, start + span], [0, 1], { clamp: true })
  const y = useTransform(p, [0, 1], ['0.5em', '0em'])
  const filter = useTransform(p, (v) => `blur(${(1 - v) * 7}px)`)
  return (
    <motion.span
      style={{ display: 'inline-block', opacity: p, y, filter, marginRight: '0.28em', willChange: 'transform, filter' }}
    >
      {word}
    </motion.span>
  )
}
