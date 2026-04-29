/**
 * V3 design tokens — single source of truth for app-wide colors.
 *
 * Use these constants instead of hardcoding hex values or duplicating
 * STAGE_COLORS / TECH_COLORS arrays per page. When the brand evolves,
 * change here and every consumer updates.
 *
 * Tailwind tokens (bg-paper, text-ink, etc.) live in tailwind.config.js
 * and are the preferred way to style chrome and text. This file is for
 * cases where Tailwind's static-class extraction can't reach (inline
 * styles, conditional gradients, JS-driven palettes).
 */

// ── Brand chrome ────────────────────────────────────────────────────────────
export const BRAND = {
  navy:        '#0F1A2E',  // primary chrome / hero gradient start
  navyDeep:    '#0A132A',  // hero gradient end
  teal:        '#14B8A6',  // V3 brand accent (primary CTAs, brand mark)
  tealDeep:    '#0F766E',  // hover state, links, dark teal text
  tealLight:   '#5EEAD4',  // teal-300 — hero accents on navy
  paper:       '#FAFAF7',  // page background
  ink:         '#0A1828',  // primary text
  inkMuted:    '#5A6B7A',  // secondary text
  borderSub:   '#E2E8F0',  // hairlines
}

// ── Pillar palette (offtake / IX / site / cross-cutting) ────────────────────
// Used by NewsFeed, RegulatoryActivityPanel, OfftakeCard, etc.
export const PILLAR = {
  offtake:        { color: '#0F766E', bg: 'rgba(20, 184, 166, 0.10)', border: 'rgba(15, 118, 110, 0.32)', label: 'Offtake' },
  ix:             { color: '#D97706', bg: 'rgba(245, 158, 11, 0.10)', border: 'rgba(245, 158, 11, 0.36)', label: 'Interconnection' },
  site:           { color: '#2563EB', bg: 'rgba(37, 99, 235, 0.08)',  border: 'rgba(37, 99, 235, 0.30)',  label: 'Site Control' },
  'cross-cutting':{ color: '#5A6B7A', bg: 'rgba(90, 107, 122, 0.08)', border: 'rgba(90, 107, 122, 0.22)', label: 'Cross-cutting' },
}

// ── Caution palette ─────────────────────────────────────────────────────────
export const CAUTION = {
  amber:    '#F59E0B',  // V3 caution (IX warnings, runway flags)
  amberDeep:'#B45309',  // amber-700 text on amber backgrounds
  red:      '#DC2626',  // critical / urgent only
  success:  '#059669',  // positive deltas
}

// ── Stage palette (development progression) ─────────────────────────────────
// Maps to project stage in Library / Profile portfolio stats. V3 uses the
// teal feasibility ramp (light -> dark) so progression reads as deepening
// commitment / completeness.
export const STAGE_COLORS = {
  'Prospecting':             '#99F6E4',  // teal-200 — earliest, lightest
  'Site Control':            '#5EEAD4',  // teal-300
  'Pre-Development':         '#2DD4BF',  // teal-400
  'Development':             '#14B8A6',  // teal-500 — V3 brand
  'NTP (Notice to Proceed)': '#0D9488',  // teal-600
  'Construction':            '#0F766E',  // teal-700 — V3 deep
  'Operational':             '#0A1828',  // ink — fully realized, terminal state
}

// ── Technology palette (tech-type differentiator) ──────────────────────────
// Used for legend / chart colors when grouping by technology type.
// Each tech gets a distinctive hue (no two tech types share teal/amber
// territory with pillars or stages).
export const TECH_COLORS = {
  'Community Solar': '#0F766E',  // V3 teal-deep (was V2 emerald)
  'C&I Solar':       '#2563EB',  // blue-600
  'BESS':            '#7C3AED',  // violet-600
  'Hybrid':          '#DB2777',  // pink-600 (combo tech, distinct hue)
}

// ── Feasibility ramp (5 buckets, single-hue teal) ──────────────────────────
// Used by USMap choropleth + Library card backgrounds + score ranges.
export const FEASIBILITY_RAMP = {
  1: '#F0FDFA',  // teal-50 — non-viable (<25)
  2: '#99F6E4',  // teal-200 — weak (25-44)
  3: '#2DD4BF',  // teal-400 — moderate (45-59)
  4: '#14B8A6',  // teal-500 — viable (60-74)
  5: '#0F766E',  // teal-700 — strong (75+)
}

// ── Coverage tier palette (V3 Strategy A) ──────────────────────────────────
// Aligned with components/CoverageBadge.jsx. Single source so badge,
// tooltip, map stroke, and legend stay in lockstep.
export const COVERAGE_TIER = {
  full:  { color: '#0F766E', bg: 'rgba(20, 184, 166, 0.10)', border: 'rgba(15, 118, 110, 0.32)', label: 'Full',  short: 'Full',  strokeWidth: 1.5 },
  mid:   { color: '#B45309', bg: 'rgba(245, 158, 11, 0.10)', border: 'rgba(245, 158, 11, 0.36)', label: 'Mid',   short: 'Mid',   strokeWidth: 1.2 },
  light: { color: '#5A6B7A', bg: 'rgba(90, 107, 122, 0.08)', border: 'rgba(90, 107, 122, 0.22)', label: 'Light', short: 'Light', strokeWidth: 0.7 },
}
