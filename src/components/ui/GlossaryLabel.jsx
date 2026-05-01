import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip'
import { GLOSSARY_DEFINITIONS } from '../../lib/glossaryDefinitions'

// GlossaryLabel — wraps any domain-specific term in a Radix tooltip that
// surfaces the canonical definition + Tractova's data inputs for that term.
//
// Mirrors the IX · Live tooltip treatment from Search.jsx (dark navy bg,
// teal border via Tooltip primitive defaults). When the term doesn't match
// a known definition in GLOSSARY_DEFINITIONS, renders the bare label as a
// fallback so the component is safe to drop in anywhere.
//
// Usage:
//   <GlossaryLabel term="Site Control" />
//   <GlossaryLabel term="LMI Carveout" className="text-amber-700" as="span" />
//
// `term` must match a key in GLOSSARY_DEFINITIONS exactly. To display
// different text but use a specific term's definition, pass `displayAs`.
export default function GlossaryLabel({ term, displayAs, className = '', as: Tag = 'span' }) {
  if (!term) return null
  const def = GLOSSARY_DEFINITIONS[term]
  const visible = displayAs || term
  if (!def) {
    return <Tag className={className}>{visible}</Tag>
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Tag
          className={`cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2 hover:decoration-teal-400 transition-colors ${className}`}
          tabIndex={0}
        >
          {visible}
        </Tag>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="text-[10px] max-w-xs">
        <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>{def.title}</p>
        <p className="leading-relaxed">{def.long}</p>
        {def.inputs && (
          <p className="mt-1.5 text-gray-400">
            <span className="text-teal-300 font-mono">INPUTS</span> — {def.inputs}
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
