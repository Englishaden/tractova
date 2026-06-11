/**
 * Caps on client-supplied prompt inputs (audit F-03).
 *
 * The lens AI handlers concatenate client arrays/strings verbatim into the
 * Sonnet prompt. Without bounds, one request can be sized just under Sonnet's
 * 200K context and billed at full input-token cost, repeatable up to the
 * per-user rate limit — an Anthropic-spend amplifier. These shared caps keep
 * portfolio / compare / sensitivity consistent (one source, per the
 * "unify and standardize" house rule) so a future copy can't silently lose
 * a bound the way `_lens-portfolio.js` had vs `_lens-news-summary.js`.
 */

// Max projects accepted by portfolio/compare before a 400. Heavy real
// portfolios are well under this; beyond it is abuse, not use.
export const MAX_PROJECTS = 25

// Max key/value pairs folded from a sensitivity `override` object.
export const MAX_OVERRIDE_ENTRIES = 30

/**
 * Coerce to string and hard-truncate. Null/undefined → ''. Used on every
 * client field that lands in a prompt line.
 *
 * @param {*} v
 * @param {number} [n=120] — max characters kept.
 * @returns {string}
 */
export function clampStr(v, n = 120) {
  return String(v ?? '').slice(0, n)
}
