import { useState } from 'react'

// V3 §9.3 — Site-walk Session 5 (review item #12, option A).
// Collapsible drill-down row for the Analyst Brief sub-sections (Primary Risk,
// Top Opportunity, Stage Guidance, Competitive Context). The brief and
// Immediate Action stay always-visible above; everything else collapses behind
// a chevron so the brief reads at a glance instead of as a wall of text.
// Closed-state still shows the topic eyebrow + accent rule so users can see
// what's available without clicking. ~12 LOC component, no new dependencies.
export default function BriefDrilldown({ label, accent, eyebrowColor, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pl-4 mt-2" style={{ position: 'relative' }}>
      <div className="absolute left-0 top-2 bottom-0 w-[2px]" style={{ background: accent }} />
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 py-1.5 w-full text-left transition-opacity hover:opacity-80"
        aria-expanded={open}
      >
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke={eyebrowColor}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 200ms', flexShrink: 0 }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <p className="font-mono text-[9px] uppercase tracking-[0.24em] font-bold m-0" style={{ color: eyebrowColor }}>
          {label}
        </p>
      </button>
      {open && (
        <div className="pb-2 pt-0.5 ml-[17px]">
          {children}
        </div>
      )}
    </div>
  )
}
