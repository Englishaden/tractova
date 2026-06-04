import { useState, useEffect } from 'react'

// GlossaryJumpRail — fixed A–Z index in the right gutter (adapted from the Lens
// LensSectionRail pattern). Click a letter to jump to its group; the letter for
// the group currently in view highlights teal (IntersectionObserver). Desktop
// only (xl+) — on narrower screens the page is single-column and the rail would
// overlap content. Reduced-motion: the jump is instant. `groups` is the list of
// currently-rendered letter groups [{ id, label }], so filtered-out letters
// never produce a dead jump target.
export default function GlossaryJumpRail({ groups }) {
  const [active, setActive] = useState(groups[0]?.id)

  useEffect(() => {
    const els = groups.map((g) => document.getElementById(g.id)).filter(Boolean)
    if (!els.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting)
        if (!vis.length) return
        vis.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        setActive(vis[0].target.id)
      },
      { rootMargin: '-15% 0px -75% 0px', threshold: 0 }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [groups])

  const go = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  if (!groups.length) return null

  return (
    <nav
      aria-label="Jump to letter"
      className="hidden xl:flex flex-col items-center gap-0.5 fixed right-3 top-1/2 -translate-y-1/2 z-30"
    >
      {groups.map((g) => {
        const on = active === g.id
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => go(g.id)}
            aria-current={on ? 'true' : undefined}
            className="w-5 h-5 flex items-center justify-center rounded font-mono text-[10px] font-bold transition-all duration-150 motion-reduce:transition-none cursor-pointer"
            style={on
              ? { color: '#0F766E', background: 'rgba(20,184,166,0.12)' }
              : { color: '#94A3B8', background: 'transparent' }}
            onMouseEnter={(e) => { if (!on) e.currentTarget.style.color = '#0F766E' }}
            onMouseLeave={(e) => { if (!on) e.currentTarget.style.color = '#94A3B8' }}
          >
            {g.label}
          </button>
        )
      })}
    </nav>
  )
}
