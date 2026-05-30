# Bar List — native JSX port (Tractova)

The Tremor `BarList` (Skills/Tremor/Bar List/Bar List 1–7) ships as a
`@tremor/react` component. We did NOT add the dependency — instead ported the
core visual (label on a proportional value bar + right-aligned value) to JSX,
re-themed to our dark teal tokens.

**Component:** `src/components/ui/BarListRows.jsx`
**Deps:** none new (uses our `AnimatedList` for a staggered entrance).

## Which iteration we used + why

- **Bar List 1 / 5** — the clean `label-on-bar + value` layout. ✅ Adopted.
- Bar List 2 / 3 / 4 — add a search `Dialog` + "show more" modal over the full
  dataset. ❌ Skipped: our KPI-card reveal is already a compact disclosure, so
  modal machinery is overkill there.
- Bar List 6 / 7 — grouped/positive-negative variants. ❌ Not needed yet.

## Usage

```jsx
import BarListRows from '@/components/ui/BarListRows'

<BarListRows
  rows={[{ name: 'New York', value: 1320 }, { name: 'Illinois', value: 980 }]}
  valueFormatter={(r) => `${(r.value).toLocaleString()} MW`}
  sub="Top 4 by remaining capacity"
/>
```

In use: `MetricsBar` KPI-card reveals (CS Coverage / Avg Capacity / Pipeline
Load top-states lists). Bar width = value / max in the set.
