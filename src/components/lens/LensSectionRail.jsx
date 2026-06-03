import { useState, useEffect } from 'react'

// LensSectionRail — a fixed scrollspy index for the Lens report (§01–§05).
// Quiet dots pinned to the right gutter on wide screens; the active section's
// dot fills teal and its label slides in. Clicking a dot jumps to the section.
//
// Desktop-only (xl+): on narrower screens the report is single-column and the
// rail would overlap content, so it's hidden — the collapsible section headers
// are the navigation there. Reduced-motion: the jump is instant (no smooth
// scroll) and the label/dot changes are plain colour swaps.
//
// `sections`: [{ id, label }] — `id` must match a rendered section element.
export default function LensSectionRail({ sections }) {
  const [active, setActive] = useState(sections[0]?.id)

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean)
    if (!els.length) return
    // rootMargin biases "active" to the section crossing the upper third of the
    // viewport, so the highlight tracks what you're reading, not what's barely
    // peeking in at the bottom.
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (!visible.length) return
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        setActive(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [sections])

  const go = (id) => {
    const el = document.getElementById(id)
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    <nav
      aria-label="Lens report sections"
      className="hidden xl:flex flex-col gap-2.5 fixed right-3 top-1/2 -translate-y-1/2 z-30"
    >
      {sections.map((s) => {
        const on = active === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => go(s.id)}
            aria-current={on ? 'true' : undefined}
            className="group flex items-center justify-end gap-2 cursor-pointer"
          >
            <span
              className="font-mono text-[9px] uppercase tracking-[0.16em] font-semibold whitespace-nowrap rounded-sm px-1.5 py-0.5 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 motion-reduce:transition-none"
              style={{ background: 'rgba(15,26,46,0.92)', color: on ? '#5EEAD4' : 'rgba(255,255,255,0.75)' }}
            >
              {s.label}
            </span>
            <span
              className="rounded-full transition-all duration-200 motion-reduce:transition-none"
              style={{
                width: on ? 10 : 7,
                height: on ? 10 : 7,
                background: on ? '#14B8A6' : 'transparent',
                border: on ? '1px solid #14B8A6' : '1.5px solid #CBD5E1',
                boxShadow: on ? '0 0 8px rgba(20,184,166,0.6)' : 'none',
              }}
            />
          </button>
        )
      })}
    </nav>
  )
}
