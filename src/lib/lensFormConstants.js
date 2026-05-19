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
