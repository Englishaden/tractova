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

// ── Two-axis project model (scope decision 2026-05-23; full rename 2026-05-24) ──
// The old single "Technology" select conflated two orthogonal axes. A project is
// now (1) a SYSTEM ARCHITECTURE × (2) a MONETIZATION STRUCTURE. Both are required
// project attributes (real columns; `technology` is kept as a derived mirror via
// composeTechnology for legacy/display call sites).
//
// AXIS 1 — system architecture (what's physically built). Standalone BESS is a
// LEGACY data value only (merchant storage is out of scope per the scope line) —
// preserved for existing saved projects + scored, but NOT offered for new ones.
export const ARCHITECTURE_OPTIONS = ['Standalone PV', 'PV + Storage']
export const ARCHITECTURE_DEFAULT = 'Standalone PV'

// AXIS 2 — monetization structure (how electrons are monetized). Drives the
// offtake sub-score + scopes the live IX-queue view. CS is the wedge (sticky
// default). Net Metering / Net Billing are scored as 'limited' coverage and have
// no Scenario-Studio revenue model yet (honest gate, not a CS default).
export const STRUCTURE_OPTIONS = ['Community Solar', 'Net Metering', 'Net Billing', 'C&I behind-the-meter']
export const STRUCTURE_DEFAULT = 'Community Solar'

// Label ⇄ metering_type tag (api/scrapers/_meteringType.js). Drives the IX-view
// scope. Labels with no live source coverage yet (net_billing, ci_btm) show an
// honest "no IX data tagged for this structure" state until a source tags them.
export const STRUCTURE_TO_TAG = {
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

// ── technology mirror (derived) ⇄ axes ─────────────────────────────────────────
// `technology` is a single composed label kept for back-compat (saved-project
// display, exports, PDF, alerts, scenario dispatch). composeTechnology builds it
// from the two axes; axesFromTechnology recovers the axes from any legacy/derived
// technology string (the canonical fallback for the ~25 call sites still reading
// `project.technology`). Round-trips for every form-producible combination.
const TECH_LABEL = {
  'Standalone PV|Community Solar':       'Community Solar',
  'Standalone PV|C&I behind-the-meter':  'C&I Solar',
  'Standalone PV|Net Metering':          'Net Metering Solar',
  'Standalone PV|Net Billing':           'Net Billing Solar',
  'PV + Storage|Community Solar':        'Community Solar + Storage',
  'PV + Storage|C&I behind-the-meter':   'C&I Solar + Storage',
  'PV + Storage|Net Metering':           'Net Metering + Storage',
  'PV + Storage|Net Billing':            'Net Billing + Storage',
}
export function composeTechnology(architecture, structure) {
  return TECH_LABEL[`${architecture}|${structure}`] || structure || architecture || STRUCTURE_DEFAULT
}

// Recover { architecture, structure } from a legacy or derived technology string
// (also handles engine slugs like 'community-solar'). Legacy standalone BESS →
// { architecture: 'Standalone BESS', structure: null } (merchant, preserved).
export function axesFromTechnology(technology) {
  const t = String(technology || '').toLowerCase()
  if (/bess|battery/.test(t) && !/solar|community|c&i|commercial|industrial|net /.test(t)) {
    return { architecture: 'Standalone BESS', structure: null }
  }
  const architecture = /\+\s*storage|hybrid|storage/.test(t) ? 'PV + Storage' : 'Standalone PV'
  let structure = 'Community Solar'
  if (/c&i|commercial|industrial/.test(t)) structure = 'C&I behind-the-meter'
  else if (/net billing/.test(t)) structure = 'Net Billing'
  else if (/net metering/.test(t)) structure = 'Net Metering'
  return { architecture, structure }
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

const ARCHITECTURE_PREF_KEY = 'tractova_lens_architecture'
export function getStickyArchitecture() {
  try {
    const v = localStorage.getItem(ARCHITECTURE_PREF_KEY)
    return ARCHITECTURE_OPTIONS.includes(v) ? v : ARCHITECTURE_DEFAULT
  } catch { return ARCHITECTURE_DEFAULT }
}
export function setStickyArchitecture(label) {
  try { if (ARCHITECTURE_OPTIONS.includes(label)) localStorage.setItem(ARCHITECTURE_PREF_KEY, label) } catch { /* ignore */ }
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
