// SectionHeader — a lightweight band that bifurcates the Markets & Policy tab
// into clear "MARKETS" / "POLICY" zones WITHOUT wrapping everything in yet
// another bordered card (the box-in-box repetition we're moving away from).
// Mono eyebrow + a teal hairline rule that fills the remaining width.
//
// Usage: <SectionHeader label="Markets" hint="program viability + channel mix" />

export default function SectionHeader({ label, hint }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="font-mono text-[12px] uppercase tracking-[0.28em] font-bold" style={{ color: 'var(--link, #5EEAD4)' }}>
          {label}
        </span>
        {hint && (
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
            {hint}
          </span>
        )}
      </div>
      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, var(--hairline-teal, rgba(20,184,166,0.45)) 0%, transparent 100%)' }} />
    </div>
  )
}
