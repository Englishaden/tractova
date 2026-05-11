import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import IntelligenceBackground from '../components/IntelligenceBackground'
import WalkingTractovaMark from '../components/WalkingTractovaMark'
// Glossary data moved to src/data/glossaryTerms.js so CommandPalette
// (eager-mounted in App.jsx) doesn't have to static-import this page
// module — that was forcing the whole Glossary chunk into the main
// bundle. Re-exported below so existing inbound import paths continue
// to work.
import { GLOSSARY_TERMS, toSlug } from '../data/glossaryTerms'
export { GLOSSARY_TERMS, toSlug }


// Local alias preserved so the rest of the file (filter/search/render
// logic) keeps reading from `terms` without churn.
const terms = GLOSSARY_TERMS

// V3: pillar badges aligned to V3 palette — teal for offtake, amber for IX
// (semantic caution per V3 §7.4), blue for site, slate-navy for stage, gray for all.
const PILLAR_BADGE = {
  offtake: 'bg-teal-50 text-teal-800 border-teal-200',
  ix:      'bg-amber-50 text-amber-800 border-amber-200',
  site:    'bg-blue-50 text-blue-700 border-blue-200',
  stage:   'bg-slate-100 text-slate-700 border-slate-200',
  all:     'bg-gray-100 text-gray-600 border-gray-200',
}

const PILLAR_LABEL = {
  offtake: 'Offtake',
  ix:      'Interconnection',
  site:    'Site Control',
  stage:   'Dev Stage',
  all:     'All Pillars',
}

// Highlight the matching substring in a suggestion label
function MatchHighlight({ text, query }) {
  if (!query) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <span className="font-bold" style={{ color: '#0F766E' }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </span>
  )
}

const PILLAR_FILTERS = [
  { key: 'offtake', label: 'Offtake' },
  { key: 'ix',      label: 'Interconnection' },
  { key: 'site',    label: 'Site Control' },
  { key: 'stage',   label: 'Dev Stages' },
]

// V3: active pillar filter button styles — teal/amber/blue/navy aligned with V3 palette
const PILLAR_ACTIVE = {
  offtake: 'bg-teal-600 text-white border-teal-700',
  ix:      'bg-amber-600 text-white border-amber-700',
  site:    'bg-blue-600 text-white border-blue-700',
  stage:   'bg-brand text-white border-brand',
}

export default function Glossary() {
  const [query, setQuery]           = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [pillar, setPillar]         = useState(null)   // null = all
  const [highlighted, setHighlighted] = useState(null) // term name briefly flashing
  const location = useLocation()

  const searchRef = useRef(null)
  const cardRefs  = useRef({})  // { [termName]: DOM element }

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // Deep-link: scroll to hashed term on mount AND on subsequent hash changes.
  // The CommandPalette emits /glossary#<slug> navigations that don't remount
  // the page (react-router stays on the same component), so we watch the
  // hash via useLocation and re-fire the scroll-to-card flow each time.
  useEffect(() => {
    const hash = location.hash.slice(1)
    if (!hash) return
    const match = terms.find(t => toSlug(t.term) === hash)
    if (!match) return
    setTimeout(() => {
      const el = cardRefs.current[match.term]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlighted(match.term)
        setTimeout(() => setHighlighted(null), 1400)
      }
    }, 200)
  }, [location.hash])

  // Typeahead: match term names only
  const suggestions = query.trim()
    ? terms.filter((t) => t.term.toLowerCase().includes(query.toLowerCase()))
    : []

  // Main list: apply pillar filter + text search (name or definition)
  const filtered = terms.filter((t) => {
    const matchesPillar = !pillar || t.pillar === pillar || t.pillar === 'all'
    const q = query.trim().toLowerCase()
    const matchesQuery = !q ||
      t.term.toLowerCase().includes(q) ||
      t.definition.toLowerCase().includes(q)
    return matchesPillar && matchesQuery
  })

  const scrollToTerm = (termName) => {
    setQuery('')
    setShowDropdown(false)
    setPillar(null)
    window.location.hash = toSlug(termName)
    setTimeout(() => {
      const el = cardRefs.current[termName]
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setHighlighted(termName)
        setTimeout(() => setHighlighted(null), 1400)
      }
    }, 50)
  }

  const handleSuggestionClick = (termName) => scrollToTerm(termName)

  // Tracks the most recently copied term + outcome so the term button can
  // flash a "Copied" / "Copy failed" indicator. Previously the silent
  // .catch(() => {}) left users uncertain whether the click did anything.
  const [copyState, setCopyState] = useState({ term: null, status: null })
  const copyAnchorLink = async (termName) => {
    const url = `${window.location.origin}${window.location.pathname}#${toSlug(termName)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopyState({ term: termName, status: 'ok' })
    } catch {
      setCopyState({ term: termName, status: 'error' })
    }
    setTimeout(() => setCopyState({ term: null, status: null }), 1500)
  }

  const handleQueryChange = (e) => {
    setQuery(e.target.value)
    setShowDropdown(true)
  }

  const clearQuery = () => {
    setQuery('')
    setShowDropdown(false)
  }

  return (
    <div className="min-h-screen bg-paper relative">
      {/* Ambient intelligence layer + occasional Tractova mark cameo —
          mirrors the Profile page treatment so the platform feels alive
          end-to-end. WalkingTractovaMark uses sessionGate so it fires at
          most once per session (Glossary is a reference surface users
          may revisit; recurring cameos would annoy). */}
      <IntelligenceBackground />
      <WalkingTractovaMark triggerProbability={0.30} sessionGate={true} />

      <main className="relative max-w-dashboard mx-auto px-6 pt-20 pb-16">
        {/* V3 hero — brand navy with teal accent rail; replaces legacy emerald-on-amber */}
        <div className="mt-6 mb-8">
          <div className="relative rounded-xl px-8 py-7 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 100%)' }}>
            {/* Top teal accent rail */}
            <div className="absolute top-0 left-0 right-0 h-px"
              style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.55) 30%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.55) 70%, transparent 100%)' }} />
            {/* Subtle grid texture (kept) */}
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'repeating-linear-gradient(0deg,#fff 0px,#fff 1px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,#fff 0px,#fff 1px,transparent 1px,transparent 32px)' }} />
            {/* Teal accent glow (was amber) */}
            <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full blur-3xl"
              style={{ background: 'rgba(20,184,166,0.20)' }} />

            <div className="relative flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  {/* Pulsing dot mirrors the Library "data refreshed" treatment —
                      visual signal that this is a live, growing surface. */}
                  <span className="relative inline-flex w-1.5 h-1.5 shrink-0">
                    <span
                      className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping"
                      style={{ background: '#14B8A6' }}
                    />
                    <span
                      className="relative inline-flex rounded-full h-1.5 w-1.5"
                      style={{ background: '#14B8A6', boxShadow: '0 0 6px rgba(20,184,166,0.65)' }}
                    />
                  </span>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em]"
                    style={{ color: '#5EEAD4' }}>Reference</span>
                  <span className="w-px h-3" style={{ background: 'rgba(20,184,166,0.40)' }} />
                  <span className="font-mono text-[10px] tracking-wider"
                    style={{ color: 'rgba(255,255,255,0.55)' }}>{terms.length} TERMS</span>
                </div>
                <h1 className="font-serif text-3xl font-semibold text-white tracking-tight"
                  style={{ letterSpacing: '-0.02em' }}>Industry Glossary</h1>
                <p className="text-sm mt-2 leading-relaxed max-w-xl"
                  style={{ color: 'rgba(255,255,255,0.65)' }}>
                  Definitions for every key term used across Tractova — from program structures and dev stages to interconnection mechanics. Built for practitioners, not generalists.
                </p>
              </div>
              {/* Decorative monospace tag — V3 teal */}
              <div className="hidden sm:block shrink-0 text-right">
                <div className="font-mono text-[10px] leading-5 select-none"
                  style={{ color: 'rgba(94,234,212,0.40)' }}>
                  <div>offtake · ix · site</div>
                  <div>stage · program</div>
                  <div style={{ color: 'rgba(20,184,166,0.55)' }}>v{new Date().getFullYear()}.1</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search input + typeahead dropdown */}
        <div ref={searchRef} className="relative max-w-sm mb-6">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={handleQueryChange}
            onFocus={() => { if (query.trim()) setShowDropdown(true) }}
            placeholder="Search terms..."
            className="w-full pl-9 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
          />
          {query && (
            <button
              onClick={clearQuery}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}

          {/* Typeahead dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <ul className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((t) => (
                <li key={t.term} className="border-b border-gray-50 last:border-0">
                  <button
                    onMouseDown={(e) => { e.preventDefault(); handleSuggestionClick(t.term) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-teal-50 flex items-center justify-between gap-3 transition-colors"
                  >
                    <MatchHighlight text={t.term} query={query} />
                    <span className={`text-xs px-1.5 py-0.5 rounded-sm border font-medium shrink-0 ${PILLAR_BADGE[t.pillar]}`}>
                      {PILLAR_LABEL[t.pillar]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pillar filter buttons */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xs text-gray-400 font-medium mr-1">Pillar:</span>
          <button
            onClick={() => setPillar(null)}
            className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
              pillar === null
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-gray-100 text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-800'
            }`}
          >
            All
          </button>
          {PILLAR_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPillar(pillar === key ? null : key)}
              className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
                pillar === key
                  ? PILLAR_ACTIVE[key]
                  : PILLAR_BADGE[key] + ' hover:opacity-80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Term list */}
        {filtered.length > 0 ? (
          <div className="grid gap-4">
            {filtered.map((t) => (
              <div
                key={t.term}
                id={toSlug(t.term)}
                ref={(el) => { cardRefs.current[t.term] = el }}
                className={`bg-white border rounded-lg px-6 py-5 transition-all duration-700 ${
                  highlighted === t.term
                    ? 'border-teal-500 ring-2 ring-teal-500/25 bg-teal-50/40'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        onClick={() => copyAnchorLink(t.term)}
                        title="Copy link to this term"
                        className="group flex items-center gap-1.5 font-serif text-lg font-semibold text-ink hover:text-teal-700 transition-colors"
                        style={{ letterSpacing: '-0.015em' }}
                      >
                        {t.term}
                        <svg
                          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          className="opacity-0 group-hover:opacity-40 transition-opacity shrink-0"
                        >
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                      </button>
                      <span className={`text-xs px-1.5 py-0.5 rounded-sm border font-medium ${PILLAR_BADGE[t.pillar]}`}>
                        {PILLAR_LABEL[t.pillar]}
                      </span>
                      {copyState.term === t.term && (
                        <span
                          className="font-mono text-[9px] uppercase tracking-[0.18em] font-semibold transition-opacity"
                          style={{ color: copyState.status === 'ok' ? '#0F766E' : '#B45309' }}
                        >
                          {copyState.status === 'ok' ? 'Copied' : 'Copy failed'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">{t.definition}</p>

                    {/* Related terms */}
                    {t.related?.length > 0 && (
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-gray-100">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.20em] text-ink-muted">See also</span>
                        {t.related.map((r) => (
                          <button
                            key={r}
                            onClick={() => scrollToTerm(r)}
                            className="text-xs hover:underline transition-colors py-2 -my-1.5 px-1 -mx-0.5"
                            style={{ color: '#0F766E' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#0A1828' }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#0F766E' }}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400 italic">
            No terms match &ldquo;{query}&rdquo;
            {pillar && <span> in <span className="font-medium">{PILLAR_LABEL[pillar]}</span></span>}
          </div>
        )}
      </main>
    </div>
  )
}
