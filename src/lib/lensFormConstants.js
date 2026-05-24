// Form data shared by the Lens form on /search and the inline Lens form
// in the Cmd-K palette. Extracted from src/pages/Search.jsx so the
// palette form doesn't import a page module (anti-pattern) and so a
// future state-list update (e.g. adding DC or US territories) propagates
// to both consumers from a single source.

export const ALL_STATES = [
  { id: 'AL', name: 'Alabama' }, { id: 'AK', name: 'Alaska' },
  { id: 'AZ', name: 'Arizona' }, { id: 'AR', name: 'Arkansas' },
  { id: 'CA', name: 'California' }, { id: 'CO', name: 'Colorado' },
  { id: 'CT', name: 'Connecticut' }, { id: 'DE', name: 'Delaware' },
  { id: 'FL', name: 'Florida' }, { id: 'GA', name: 'Georgia' },
  { id: 'HI', name: 'Hawaii' }, { id: 'ID', name: 'Idaho' },
  { id: 'IL', name: 'Illinois' }, { id: 'IN', name: 'Indiana' },
  { id: 'IA', name: 'Iowa' }, { id: 'KS', name: 'Kansas' },
  { id: 'KY', name: 'Kentucky' }, { id: 'LA', name: 'Louisiana' },
  { id: 'ME', name: 'Maine' }, { id: 'MD', name: 'Maryland' },
  { id: 'MA', name: 'Massachusetts' }, { id: 'MI', name: 'Michigan' },
  { id: 'MN', name: 'Minnesota' }, { id: 'MS', name: 'Mississippi' },
  { id: 'MO', name: 'Missouri' }, { id: 'MT', name: 'Montana' },
  { id: 'NE', name: 'Nebraska' }, { id: 'NV', name: 'Nevada' },
  { id: 'NH', name: 'New Hampshire' }, { id: 'NJ', name: 'New Jersey' },
  { id: 'NM', name: 'New Mexico' }, { id: 'NY', name: 'New York' },
  { id: 'NC', name: 'North Carolina' }, { id: 'ND', name: 'North Dakota' },
  { id: 'OH', name: 'Ohio' }, { id: 'OK', name: 'Oklahoma' },
  { id: 'OR', name: 'Oregon' }, { id: 'PA', name: 'Pennsylvania' },
  { id: 'RI', name: 'Rhode Island' }, { id: 'SC', name: 'South Carolina' },
  { id: 'SD', name: 'South Dakota' }, { id: 'TN', name: 'Tennessee' },
  { id: 'TX', name: 'Texas' }, { id: 'UT', name: 'Utah' },
  { id: 'VT', name: 'Vermont' }, { id: 'VA', name: 'Virginia' },
  { id: 'WA', name: 'Washington' }, { id: 'WV', name: 'West Virginia' },
  { id: 'WI', name: 'Wisconsin' }, { id: 'WY', name: 'Wyoming' },
]

export const STAGES = [
  'Prospecting',
  'Site Control',
  'Pre-Development',
  'Development',
  'NTP (Notice to Proceed)',
  'Construction',
  'Operational',
]

// Tech list. The '---' divider is rendered by FieldSelect on the Lens
// form as a section break between CS-family and the rest; the palette
// form uses a flat list so we strip dividers downstream when needed.
export const TECHNOLOGIES = ['Community Solar', 'Hybrid', '---', 'C&I Solar', 'BESS']
export const TECHNOLOGIES_FLAT = TECHNOLOGIES.filter(t => t !== '---')

// ── Monetization-structure filter (capture-all-DG, scope decision 2026-05-23) ──
// A DISCOVERY filter that scopes the IX-context view by monetization structure
// (metering_type tag — single source of truth: api/scrapers/_meteringType.js).
// 'All structures' = every tag. This is NOT an offtake-scoring input — Technology
// still drives the score; structure decides which interconnection/monetization
// slice of the live IX queue you're looking at (discovery in the Lens; program
// economics live in Scenario Studio). CS is the wedge, so a CS specialist can pin
// structure=Community Solar and it sticks (localStorage).
export const STRUCTURE_OPTIONS = ['All structures', 'Community Solar', 'Net Metering', 'Net Billing', 'C&I behind-the-meter']
export const STRUCTURE_DEFAULT = 'All structures'

// Label ⇄ metering_type tag. 'All structures' → 'all' (every structure; maps to
// getIXQueueSummary's view=null). Labels that have no live source coverage yet
// (net_billing, ci_btm) are offered as a product statement — the IX card shows an
// honest "no IX data tagged for this structure" state until a source tags them.
export const STRUCTURE_TO_TAG = {
  'All structures':       'all',
  'Community Solar':      'community_solar',
  'Net Metering':         'net_metering',
  'Net Billing':          'net_billing',
  'C&I behind-the-meter': 'ci_btm',
}
export const STRUCTURE_FROM_TAG = Object.fromEntries(
  Object.entries(STRUCTURE_TO_TAG).map(([label, tag]) => [tag, label]),
)

// Resolve a URL/?structure= value (a tag) to its display label; falls back to the
// default when absent or unrecognized.
export function structureLabelFromTag(tag) {
  return STRUCTURE_FROM_TAG[tag] || STRUCTURE_DEFAULT
}

// Display nouns per structure tag — for honest IX-card copy (the card used to
// hardcode "CS projects" even for net-metering / fuel-type-only queues). `short`
// goes in "{n} {short} projects"; `label` heads the section.
const STRUCTURE_NOUN = {
  community_solar: { short: 'CS',                label: 'Community-Solar' },
  net_metering:    { short: 'net-metering',      label: 'Net-Metering' },
  net_billing:     { short: 'net-billing',       label: 'Net-Billing' },
  ci_btm:          { short: 'C&I BTM',           label: 'C&I Behind-the-Meter' },
  on_bill:         { short: 'on-bill',           label: 'On-Bill' },
  other:           { short: 'other-structure',   label: 'Other-Structure' },
  unknown:         { short: 'DG',                label: 'Distribution-DG' },
}
const DG_NOUN = { short: 'DG', label: 'Distribution-DG' }

// Resolve the display noun for an IX summary view. An explicit single-structure
// view names that structure; the 'all' view (view==null) names the lone structure
// when there's only one, else the generic "DG" (mixed structures).
export function structureNoun(view, availableStructures = []) {
  if (view && STRUCTURE_NOUN[view]) return STRUCTURE_NOUN[view]
  const tags = (availableStructures || []).map(s => s.meteringType)
  if (tags.length === 1 && STRUCTURE_NOUN[tags[0]]) return STRUCTURE_NOUN[tags[0]]
  return DG_NOUN
}

// Sticky structure preference (localStorage). Guarded so it's safe in node/SSR
// (returns the default when localStorage is unavailable).
const STRUCTURE_PREF_KEY = 'tractova_lens_structure'
export function getStickyStructure() {
  try {
    const v = localStorage.getItem(STRUCTURE_PREF_KEY)
    return STRUCTURE_OPTIONS.includes(v) ? v : STRUCTURE_DEFAULT
  } catch { return STRUCTURE_DEFAULT }
}
export function setStickyStructure(label) {
  try { if (STRUCTURE_OPTIONS.includes(label)) localStorage.setItem(STRUCTURE_PREF_KEY, label) } catch { /* ignore */ }
}

// Resolve a state input — accepts either a 2-letter id ('MA') or a full
// name ('Massachusetts'). Returns the matching ALL_STATES row or null.
// Case-insensitive. Used by the palette form to hydrate from parsed
// :lens shorthand args.
export function findState(input) {
  if (!input) return null
  const needle = String(input).trim().toUpperCase()
  if (!needle) return null
  if (needle.length === 2) {
    return ALL_STATES.find(s => s.id === needle) || null
  }
  const lower = needle.toLowerCase()
  return ALL_STATES.find(s => s.name.toLowerCase() === lower) || null
}
