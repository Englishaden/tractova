import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip'
import { TECH_DEFINITIONS } from '../../lib/techDefinitions'

// TechLabel — renders a technology name (Community Solar / C&I Solar /
// BESS / Hybrid) wrapped in a Radix tooltip that surfaces the canonical
// definition + Tractova's data inputs for that technology.
//
// Mirrors the IX · Live tooltip treatment from Search.jsx (dark navy bg,
// teal border via Tooltip primitive defaults). When the tech name doesn't
// match a known definition, renders the bare label as a fallback so the
// component is safe to drop in anywhere a tech-type string appears.
//
// Usage:
//   <TechLabel tech={project.technology} />
//   <TechLabel tech={project.technology} className="text-ink-muted" as="span" />
export default function TechLabel({ tech, className = '', as: Tag = 'span' }) {
  const def = TECH_DEFINITIONS[tech]
  if (!tech) return null
  if (!def) {
    return <Tag className={className}>{tech}</Tag>
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Tag
          className={`cursor-help underline decoration-dotted decoration-gray-300 underline-offset-2 hover:decoration-teal-400 transition-colors ${className}`}
          tabIndex={0}
        >
          {tech}
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
