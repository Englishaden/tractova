import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip'
import { alertStyleFor } from '../lib/alertHelpers'

export default function AlertChip({ alert }) {
  const s = alertStyleFor(alert)
  const e = alert.evidence
  // V3: Radix Tooltip portal -- prevents clipping inside flex/grid containers
  // (the chip lives inside the alert strip which has overflow contexts).
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold cursor-default ${s.chip}`} style={{ lineHeight: 1 }}>
          <span
            className={s.dot}
            style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '9999px', flexShrink: 0 }}
          />
          {alert.pillar && <span className="opacity-60">{alert.pillar}</span>}
          {alert.label}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[320px]">
        <div className="space-y-1.5">
          <p className="font-semibold leading-snug">{alert.detail}</p>
          {e && (
            <div className="pt-1.5 mt-1.5 border-t border-white/10 space-y-1 font-mono text-[10px] tabular-nums">
              {e.field && (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="opacity-60 uppercase tracking-wider text-[9px]">field</span>
                  <span>{e.field}</span>
                </div>
              )}
              {e.before !== undefined && e.after !== undefined && (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="opacity-60 uppercase tracking-wider text-[9px]">change</span>
                  <span><span className="opacity-60">{String(e.before)}</span> → <span className="font-semibold">{String(e.after)}</span></span>
                </div>
              )}
              {e.beforeLabel && (
                <div className="opacity-70 text-[9px] leading-snug">{e.beforeLabel} → {e.afterLabel}</div>
              )}
              {e.sourceLabel && (
                <div className="pt-1 border-t border-white/10 text-[9px] leading-snug opacity-80">
                  {e.sourceUrl ? (
                    <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      {e.sourceLabel} ↗
                    </a>
                  ) : (
                    <span>{e.sourceLabel}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
