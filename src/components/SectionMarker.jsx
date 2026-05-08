// V3.1: Editorial section marker. Mono "§ NN · Label" on the left, a hairline
// rule fills the middle, optional mono sublabel on the right. Replaces flat
// SectionDivider lines in the results flow with research-note typography.
export default function SectionMarker({ index, label, sublabel, compact = false }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? 'mb-3' : 'mt-8 mb-4'}`}>
      <span
        className="text-[11px] font-bold tracking-[0.20em] uppercase shrink-0"
        style={{ color: '#0F1A2E', fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}
      >
        § {String(index).padStart(2, '0')} · {label}
      </span>
      <div className="flex-1 h-px" style={{ background: '#E2E8F0' }} />
      {sublabel && (
        <span
          className="text-[10px] tracking-[0.18em] uppercase shrink-0"
          style={{ color: '#94A3B8', fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}
        >
          {sublabel}
        </span>
      )}
    </div>
  )
}
