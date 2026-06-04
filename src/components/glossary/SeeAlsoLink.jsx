import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/Tooltip'
import { GLOSSARY_DEFINITIONS } from '../../lib/glossaryDefinitions'

// SeeAlsoLink — a "see also" related-term link that previews the target term's
// definition on hover/focus (reusing the canonical GLOSSARY_DEFINITIONS — no new
// data). Clicking still scrolls to the term. Falls back to a bare button when
// the target has no definition entry, so it's safe for any related term.
export default function SeeAlsoLink({ term, onClick }) {
  const def = GLOSSARY_DEFINITIONS[term]
  const btn = (
    <button
      type="button"
      onClick={onClick}
      className="text-xs transition-colors py-2 -my-1.5 px-1 -mx-0.5 rounded hover:underline focus-visible:outline-2 focus-visible:outline-teal-600 focus-visible:outline-offset-2"
      style={{ color: '#0F766E' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#0A1828' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = '#0F766E' }}
    >
      {term}
    </button>
  )

  const preview = def?.long || def?.short
  if (!preview) return btn

  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="top" className="text-[10px] max-w-xs">
        <p className="font-bold mb-1" style={{ color: '#5EEAD4' }}>{def.title || term}</p>
        <p className="leading-relaxed">{preview}</p>
      </TooltipContent>
    </Tooltip>
  )
}
