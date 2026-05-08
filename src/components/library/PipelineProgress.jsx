export const PIPELINE_STAGES = [
  'Prospecting',
  'Site Control',
  'Pre-Development',
  'Development',
  'NTP (Notice to Proceed)',
  'Construction',
  'Operational',
]

export const PIPELINE_SHORT = [
  'Prospect',
  'Site Ctrl',
  'Pre-Dev',
  'Dev',
  'NTP',
  'Construct',
  'Operating',
]

// ── Pipeline progress ────────────────────────────────────────────────────────
export default function PipelineProgress({ stage }) {
  const activeIdx = PIPELINE_STAGES.indexOf(stage)
  return (
    <div>
      <div className="flex items-center">
        {PIPELINE_STAGES.map((s, i) => {
          const done    = i < activeIdx
          const current = i === activeIdx
          return (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full border-2 shrink-0 transition-colors ${
                    done    ? 'bg-teal-700 border-teal-700' :
                    current ? 'border-teal-700 ring-2 ring-teal-700/30' :
                              ''
                  }`}
                  style={(!done && !current) ? { background: '#F3F4F6', borderColor: '#D1D5DB' } :
                         current             ? { background: 'rgba(15,118,110,0.15)' } : {}}
                />
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-0.5 ${done ? 'bg-teal-700' : ''}`}
                  style={!done ? { background: '#E5E7EB' } : {}}
                />
              )}
            </div>
          )
        })}
      </div>
      <div className="flex mt-1.5">
        {PIPELINE_SHORT.map((label, i) => {
          const current = i === activeIdx
          return (
            <div
              key={label}
              className={`flex-1 last:flex-none text-center text-[8.5px] leading-tight font-medium truncate px-0.5 ${current ? 'text-teal-700 font-bold' : ''}`}
              style={!current ? { color: '#9CA3AF' } : {}}
            >
              {label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
