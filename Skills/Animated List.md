# Animated List (native JSX port)

Staggered entrance for a list of items — each child fades/springs up once on
mount, cascading by a per-item delay. JSX port of the Magic UI "Animated List"
pattern, re-themed for our stack (Vite + JSX, `motion/react`, reduced-motion
safe). The Magic UI original cycles a notification stream; we use it as a clean
ENTRANCE cascade for feed/reveal lists.

**Component:** `src/components/ui/AnimatedList.jsx`
**Deps:** `motion/react` (already in the project).

## Usage

```jsx
import AnimatedList from '@/components/ui/AnimatedList'

<AnimatedList className="divide-y divide-[var(--cards-border)]" delay={0.06}>
  {items.map((it) => (
    <li key={it.id}>{/* row content */}</li>
  ))}
</AnimatedList>
```

## Props

| Prop | Default | Notes |
|---|---|---|
| `children` | — | List items (each gets the stagger variant) |
| `className` | `''` | passed to the container |
| `delay` | `0.07` | seconds between each item's entrance |
| `as` | `'ul'` | container tag (`ul`/`ol`/`div`) |

## Notes

- Entrance-once on mount (container drives `staggerChildren`); does not re-fire
  on data updates — avoids the "every row jumps" feel on live feeds.
- `prefers-reduced-motion` → renders the plain list, no motion.
- In use: `IntelligenceFeedCard` (feed rows cascade in).

> The original Magic UI demo (looping notification stream with
> `AnimatePresence`) is preserved conceptually here but adapted to an entrance
> cascade — the use-case we actually have on the dashboard.
