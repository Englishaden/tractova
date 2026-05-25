// Pure ranking for the "which structure pays best here" comparison.
// Kept out of the component file so it's unit-testable without pulling in
// React / Radix. The component builds the rows (via computeSubScores +
// computeBaseline) then hands them here.
//
// Each row: { structure, offtake:number|null, year1:number|null, payback:number|null, modeled:boolean }
//
// Rank modeled rows (real Year-1 revenue) by revenue desc, gated rows last.
// When NO structure has revenue data for the state (no rate coverage), fall
// back to ranking by offtake so the section is still useful instead of empty.
export function rankStructureRows(rows) {
  const list = Array.isArray(rows) ? rows : []
  const modeled = list.filter((r) => r.modeled && Number.isFinite(r.year1))
  const gated = list.filter((r) => !(r.modeled && Number.isFinite(r.year1)))
  if (modeled.length) {
    modeled.sort((a, b) => b.year1 - a.year1)
    return { ranked: [...modeled, ...gated], bestKey: modeled[0].structure, bestBy: 'revenue' }
  }
  const byOfftake = [...list].sort((a, b) => (b.offtake ?? -1) - (a.offtake ?? -1))
  return { ranked: byOfftake, bestKey: byOfftake.find((r) => Number.isFinite(r.offtake))?.structure ?? null, bestBy: 'offtake' }
}
