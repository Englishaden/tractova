// Pure ranking for the "which structure monetizes best here" comparison.
// Kept out of the component file so it's unit-testable without pulling in
// React / Radix. The component builds the rows (via computeSubScores) then
// hands them here.
//
// Post the 2026-05 $-layer removal this ranks on the OFFTAKE signal (0-100),
// not on synthesized Year-1 revenue. Each row:
//   { structure, offtake:number|null, available:boolean }
// `available` = the structure has a curated monetization model for this state
// (offtake coverage !== 'fallback'). Available rows rank by offtake desc;
// gated / un-modeled structures (e.g. Net Billing — no export-credit data)
// sink to the bottom so the section reads as a deliberate honesty stance.
export function rankStructureRows(rows) {
  const list = Array.isArray(rows) ? rows : []
  const available = list.filter((r) => r.available && Number.isFinite(r.offtake))
  const gated = list.filter((r) => !(r.available && Number.isFinite(r.offtake)))
  available.sort((a, b) => b.offtake - a.offtake)
  return {
    ranked: [...available, ...gated],
    bestKey: available[0]?.structure ?? null,
  }
}
