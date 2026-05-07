/**
 * Display labels for CS program status + IX difficulty taxonomy.
 *
 * Single source of truth for the chips / pills / table rows that
 * render `csStatus` or `ixDifficulty` values. Consumers (Library,
 * Compare, Project cards, exports) all import from here to keep
 * label phrasing in sync — previously these maps were duplicated
 * inline in 4-5 places, and a phrasing change required hunting
 * each one down.
 *
 * Server-side mirror: `api/lib/_alertClassifier.js` exports the
 * same maps for the email + alert paths. Keep them in sync — the
 * values are byte-identical and verified by both Plan D Sprint 2.8
 * (alert classifier extraction) and D.3 (this consolidation).
 *
 * NOT included: rank / ordering maps. Each consumer needs different
 * sort semantics (alertHelpers.js detects "got worse" by ranking
 * easiest-first; Search.jsx peer-comparison ranks easiest-highest
 * for tone). Those rank constants stay local to each file with a
 * comment explaining the sort direction.
 *
 * NOT included: ProjectPDFExport's verbose CS_STATUS_LABEL
 * ('Limited Capacity', 'Pending Launch', 'No Program'). Those are
 * intentionally PDF-specific user-facing copy and stay local.
 */

/** CS program status — short labels for chips, table cells, etc. */
export const CS_STATUS_LABEL = {
  active:  'Active',
  limited: 'Limited',
  pending: 'Pending',
  none:    'Closed',
}

/** IX difficulty — short labels for chips, table cells, etc. */
export const IX_LABEL = {
  easy:      'Easy',
  moderate:  'Moderate',
  hard:      'Hard',
  very_hard: 'Very Hard',
}
