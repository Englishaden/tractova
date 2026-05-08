// V3.1: Bloomberg-style run-id masthead at the top of every Lens result.
// Signals research-grade character: this analysis ran at a specific moment,
// in a specific region, with a specific input set. Reads instantly to anyone
// who's used a real intelligence terminal.
export default function RunIdMasthead({ form }) {
  if (!form) return null
  const now = new Date()
  const dateCode = now.toISOString().slice(2, 10).replace(/-/g, '.')      // 26.04.30
  const tsCode   = now.toISOString().slice(0, 16).replace('T', ' ')        // 2026-04-30 19:47
  const stateCode  = (form.state || 'XX').toUpperCase()
  const countyCode = (form.county || '').replace(/\s+/g, '').slice(0, 3).toUpperCase().padEnd(3, 'X')
  const techCode   = (form.technology || 'CS').replace(/\s+/g, '').toUpperCase()
  const runId = `LX-${dateCode}-${stateCode}${countyCode}`

  return (
    <div
      className="flex items-center justify-between gap-4 mb-4 px-4 py-2 rounded-md flex-wrap"
      style={{
        background: 'linear-gradient(90deg, #0F1A2E 0%, #0A132A 100%)',
        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
        <span
          className="text-[9px] font-bold uppercase tracking-[0.30em] shrink-0"
          style={{ color: '#5EEAD4' }}
        >
          ◆ Run · {runId}
        </span>
        <span className="text-[9px] hidden sm:inline" style={{ color: 'rgba(255,255,255,0.30)' }}>·</span>
        <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {tsCode} UTC
        </span>
        <span className="text-[9px] hidden md:inline" style={{ color: 'rgba(255,255,255,0.30)' }}>·</span>
        <span
          className="text-[9px] hidden md:inline"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          {techCode}
        </span>
      </div>
      <span
        className="text-[9px] font-medium tracking-[0.20em] uppercase shrink-0"
        style={{ color: 'rgba(94,234,212,0.65)' }}
      >
        Tractova · Lens v3
      </span>
    </div>
  )
}
