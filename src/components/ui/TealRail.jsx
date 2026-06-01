// TealRail — the brand's signature top-edge hairline accent, in one place.
//
// This is the "card DNA" that ties every single-panel Lens result section
// (Market Position, Analyst Brief, Dev Feasibility, Structure Comparison) to
// the same family the dashboard tiles carry. Previously each panel hand-rolled
// its own rail (or diverged — e.g. a left-edge border), so the canonical
// gradient lived in several copies. One source now; change it here, every
// section follows.
//
// The parent must be `relative overflow-hidden` so the 2px rail pins to the
// top edge and clips to the card's rounded corners.
export default function TealRail() {
  return (
    <div
      aria-hidden="true"
      className="absolute top-0 left-0 right-0 h-[2px]"
      style={{ background: 'linear-gradient(90deg, transparent 0%, #14B8A6 30%, #14B8A6 70%, transparent 100%)' }}
    />
  )
}
