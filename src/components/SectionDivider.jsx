export default function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-5">
      {label && (
        <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-primary-600 whitespace-nowrap font-mono shrink-0">
          {label}
        </span>
      )}
      <div
        className="flex-1 h-px"
        style={{
          background: label
            ? 'linear-gradient(90deg, rgba(15,110,86,0.55) 0%, rgba(15,110,86,0.18) 55%, transparent 100%)'
            : 'linear-gradient(90deg, transparent 0%, rgba(15,110,86,0.20) 30%, rgba(15,110,86,0.20) 70%, transparent 100%)',
        }}
      />
    </div>
  )
}
