// Compact USD formatter for the saved-scenarios chip + picker. Mirrors the
// shape used inside ScenarioStudio so the same numbers read identically
// across the studio and the project card. Pure / module-scope.
export function formatLargeUSD(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return Math.round(n).toLocaleString()
}
