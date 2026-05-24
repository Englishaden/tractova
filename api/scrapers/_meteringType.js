/**
 * Canonical monetization-structure ("metering type") vocabulary.
 *
 * The capture-all-DG scope decision (2026-05-23) splits the old conflated
 * "tech type" into two orthogonal axes; this file owns the MONETIZATION-STRUCTURE
 * axis as observed in distribution-interconnection feeds. It is the single source
 * of truth for the tag stored in ix_queue_data.metering_type (migration 068) and,
 * later, the Lens structure filter.
 *
 * Tags (retail/program structures = in-scope; non-retail captured but parked):
 *   community_solar — CS subscription program (a program riding a virtual-NM mechanism)
 *   net_metering    — net metering, incl. remote/aggregated net metering
 *   net_billing     — net billing / NEM-successor export-credit tariffs (e.g. CA NEM 3.0)
 *   ci_btm          — C&I behind-the-meter self-supply / PPA (rarely stated in IX feeds;
 *                     a vocabulary member for the offtake/Lens side, not auto-detected here)
 *   on_bill         — on-bill financing / on-bill tariff
 *   other           — a structure the SOURCE named but that sits outside the retail-
 *                     monetization vocabulary (PURPA/QF, cogen, backup, load-offset).
 *                     Distinct from `unknown`: here the source told us, we just don't
 *                     bucket it as a retail product.
 *   unknown         — the source provides NO structure indicator at all (e.g. a
 *                     fuel-type-only queue). Honest absence, never fabricated.
 *
 * `other` vs `unknown` is a deliberate honesty split: a user filtering `unknown`
 * should see only source-silent rows, not wholesale QF rows we happen to recognize.
 *
 * Verified against real NJ EDC files (scripts/spike-nj-structures.mjs, 2026-05-24):
 * JCP&L/PSE&G expose values {Net Metering, Community Solar, Offset Load, PURPA,
 * Back-up, Cogen - Non-Export, PEP}; RECO uses separate Yes/No boolean columns.
 */

export const MT = {
  COMMUNITY_SOLAR: 'community_solar',
  NET_METERING:    'net_metering',
  NET_BILLING:     'net_billing',
  CI_BTM:          'ci_btm',
  ON_BILL:         'on_bill',
  OTHER:           'other',
  UNKNOWN:         'unknown',
}

// Every allowed value, for migration CHECK-comments, tests, and the Lens filter.
export const METERING_TYPE_VALUES = Object.values(MT)

/**
 * Map a raw source string (a metering/interconnection-type cell value) to a
 * canonical tag. Order matters: check the more specific phrases first
 * ("net billing" contains "net"; "remote net metering" contains "net metering").
 *
 * Returns 'unknown' for blank/empty input (source-silent) and 'other' for a
 * non-empty value that names something outside the retail-monetization vocab.
 *
 * @param {string} raw
 * @returns {string} one of METERING_TYPE_VALUES
 */
export function normalizeMeteringType(raw) {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!s) return MT.UNKNOWN
  if (/community solar/.test(s)) return MT.COMMUNITY_SOLAR
  if (/net billing/.test(s)) return MT.NET_BILLING
  if (/net metering|net-metering|remote net|aggregat\w* net/.test(s)) return MT.NET_METERING
  if (/on.?bill/.test(s)) return MT.ON_BILL
  // Named, but outside the retail-monetization vocabulary (wholesale QF, cogen,
  // backup, load-offset, utility-specific codes). Captured honestly as `other`.
  return MT.OTHER
}
