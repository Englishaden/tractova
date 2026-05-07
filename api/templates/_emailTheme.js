/**
 * Shared email theme tokens — V3 design system.
 *
 * Centralizes the color palette, font stacks, and brand-level constants
 * (APP_URL) used across alert + opportunity + digest email templates.
 * Matches the values used by send-digest.js for cross-template consistency.
 *
 * Mirrors the helper-module convention used by api/lib/_aiCacheLayer.js:
 * ESM imports, JSDoc-style file header, leading underscore in the
 * filename to flag this as an internal helper. Named exports only.
 */

// V3 design tokens — matched with send-digest.js for cross-template consistency
export const BRAND_NAVY = '#0F1A2E'
export const TEAL = '#14B8A6'
export const TEAL_DEEP = '#0F766E'
export const TEAL_LIGHT = '#5EEAD4'
export const AMBER = '#D97706'
export const AMBER_LIGHT = '#FCD34D'
export const URGENT = '#DC2626'
export const INK = '#0A1828'
export const INK_MUTED = '#5A6B7A'
export const PAPER = '#FAFAF7'
export const BORDER = '#E2E8F0'

export const FONT_SERIF = `'Source Serif 4', 'Source Serif Pro', Georgia, 'Times New Roman', serif`
export const FONT_SANS  = `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
export const FONT_MONO  = `'JetBrains Mono', 'SF Mono', Menlo, Consolas, 'Courier New', monospace`

// Brand URL — used for CTA links and footer "manage notifications" links.
// Lives here (rather than in send-alerts.js) so templates can pull it
// alongside their theme tokens in a single import.
export const APP_URL = 'https://tractova.com'
