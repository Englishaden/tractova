# Animated Icons (native JSX wrapper)

Hover-animated Lucide icons for Tractova — same effect as the `lucide-animated`
registry, but built natively for our stack (Vite + **JSX**, `motion/react`,
`lucide-react`) instead of pulling ~435 `.tsx` files via the shadcn CLI.

**Component:** `src/components/ui/AnimatedIcon.jsx`
**Deps:** `lucide-react` + `motion/react` (both already in the project).

## Why this over the lucide-animated CLI

- Our repo is JSX (`components.json` → `tsx:false`); the registry ships TSX.
- One wrapper covers **every** Lucide icon — no per-icon install, no 435 files.
- Honors `prefers-reduced-motion` (renders the static icon).
- Same hover-to-animate feel; consistent with our existing `motion` usage.

## Usage

```jsx
import AnimatedIcon from '@/components/ui/AnimatedIcon'

// hover to animate (default)
<AnimatedIcon name="ChevronDown" animation="bob" size={16} />

// always-looping (e.g. a "live" indicator)
<AnimatedIcon name="Activity" animation="pulse" trigger="always" />

// refresh button
<button onClick={refetch}>
  <AnimatedIcon name="RefreshCw" animation="spin" /> Refresh
</button>
```

## Props

| Prop | Default | Notes |
|---|---|---|
| `name` | — | Any PascalCase `lucide-react` export (`Map`, `Bell`, `Search`, `Maximize2`, `ChevronRight`…). Unknown → renders null + dev-warn. |
| `animation` | `'bob'` | `bob` · `nudge` · `spin` · `pulse` · `wiggle` · `pop` |
| `trigger` | `'hover'` | `hover` (whileHover) · `always` (loops) · `none` (static) |
| `size` | `16` | px |
| `strokeWidth` | `2` | |
| `className` | `''` | passed to the Lucide icon |
| `spanClassName` | `''` | passed to the wrapping `motion.span` |
| `color`, `onClick`, `aria-label`, …rest | — | forwarded to the icon |

## Animation map (what fits where)

- **bob** → chevrons / expand affordances (the dashboard chart headers, accordion toggles)
- **nudge** → "next / open / go" links and CTAs
- **spin** → refresh / sync / re-run buttons
- **pulse** → live-data / "this is updating" indicators
- **wiggle** → bell / alert / notification icons
- **pop** → generic press / add-to-something feedback

## Adding a new animation

Add a `{ rest, active }` entry to `VARIANTS` and a duration to `DURATIONS` in
`AnimatedIcon.jsx`. Keep them subtle — this is an intelligence platform, not a
toy; motion should read as "responsive", never "bouncy".

> If we ever genuinely need a specific hand-tuned `lucide-animated` icon, pull
> that ONE via `npx shadcn add "https://lucide-animated.com/r/<icon>.json"`
> into `src/components/icons/` — but default to this wrapper.
