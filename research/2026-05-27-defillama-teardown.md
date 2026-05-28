# Site Teardown: DefiLlama

**URL:** https://defillama.com
**Built by:** Defillama team (open-source crypto analytics; no agency byline)
**Platform:** Next.js + Tailwind CSS v4
**Date analyzed:** 2026-05-27
**Why we're studying it:** It's the "real dashboard" reference Aden flagged when calling out that the Tractova Dashboard reads as "well-formatted data" instead of an intelligence terminal. Defillama runs the same shape of problem — dense state/protocol grid, sparklines per row, hover-rich tooltips, dotted-underline data cells — at a much higher density and with an interaction vocabulary that earns the "intelligence platform" feel.

## Tech Stack (Confirmed from Source)

| Technology | Evidence | Purpose |
|---|---|---|
| **Next.js (Pages Router)** | `data-next-head=""` on every meta tag; `/_next/static/chunks/` asset paths | App framework |
| **Tailwind CSS v4** | `bg-(--cards-bg)` parentheses syntax (v4-style CSS variable references); `group/metric` named groups; `data-[active=true]:` attribute variants | Utility-first styling |
| **D3** | `d3` referenced 3× in HTML; inline `<svg viewBox=…>` charts (no Recharts grid markup) | Custom SVG charts |
| **Inter variable + JetBrains Mono** | `@font-face` declarations; same font pairing Tractova adopted 2026-05-27 (Geist is the Inter successor) | UI typography + numeric tabular |
| **RainbowKit** | One of the two CSS files is `rk-` prefixed | Wallet connection (irrelevant to Tractova) |
| **Cookie-driven theme** | First inline script reads `defillama-theme` cookie before paint; sets `<html>` class to `dark` or `light` to prevent FOUC | SSR-safe dark/light toggle |
| **Announcement-dismissal cookie** | `defillama-dismissed-announcements` cookie + dynamic `<style>` injection hides dismissed banners on first paint | Server-render-friendly UI state |

## Design System

### Colors — Light Theme (`:root`)
| Token | Hex | Role |
|---|---|---|
| `--app-bg` | `#f7f7f7` | Outer page background |
| `--cards-bg` | `#fff` | Card surface |
| `--cards-border` | `#dedede` | Card hairline |
| `--bg-main` | `#fafafa` | Section background |
| `--bg-input` | `#eee` | Input fill |
| `--primary` | `#445ed0` | Brand blue (light variant) |
| `--success` | `#018a13` | Positive deltas |
| `--error` | `#e60d02` | Negative deltas |
| `--warning` | `#d97708` | Caution |
| `--text-primary` | `#1f1f1f` | Body |
| `--text-label` | `#484848` | Tabular cells |
| `--link` | `#2c71d2` | Hyperlinks |
| `--link-active-bg` | `#1e68d2` | Tab active fill |

### Colors — Dark Theme (`html.dark`)
| Token | Hex | Role |
|---|---|---|
| `--app-bg` | `#090b0c` | **Near-black page bg — much darker than Tractova's navy** |
| `--cards-bg` | `#131516` | Card surface (only ~10 lightness lift from page) |
| `--cards-border` | `#222324` | Hairline (very subtle) |
| `--bg-surface` | `#17181c` | Elevated panel |
| `--bg-input` | `#2a2c2e` | Input fill |
| `--primary` | `#2172e5` | Brand blue (dark variant) |
| `--old-blue` | `#2172e5` | Tab active fill |
| `--success` | `#3eb84f` | Positive |
| `--error` | `#e24a42` | Negative |
| `--warning` | `#f4b941` | Caution |
| `--text-primary` | `#fafafa` | Body |
| `--text-label` | `#ccc` | Tabular cells |
| `--link` | `#3689ff` | Hyperlinks |
| `--link-bg` | `#141d29` | Pill background |
| `--divider` | `#2b2b2b6f` | Row divider with alpha |

### Chart Color Ramp (categorical, 7-color)
Defined under `--sub-chart-N`:
1. `--sub-chart-1`: brand blue (var)
2. `--sub-chart-2`: `#22c55e` (green)
3. `--sub-chart-3`: `#f59e0b` (amber)
4. `--sub-chart-4`: `#38bdf8` (sky)
5. `--sub-chart-5`: `#f97316` (orange)
6. `--sub-chart-6`: `#a855f7` (purple)
7. `--sub-chart-7`: `#14b8a6` (**teal — exactly Tractova's brand color**)
8. `--sub-chart-others`: `#64748b` (slate)

Cross-cutting chart helpers:
- `--sub-chart-axis: var(--sub-border-slate-100)` light / `var(--sub-border-strong)` dark
- `--sub-chart-split: #0000000f` light / `#ffffff0f` dark (very faint gridlines)
- `--sub-chart-tooltip-bg: var(--sub-surface-dark)` (always dark, even in light mode)
- `--sub-chart-tooltip-border: var(--sub-border-strong)`

### Typography

```css
@font-face {
  font-family: "Inter var";
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(/fonts/inter.woff2) format("woff2");
}

@font-face {
  font-family: "JetBrains Mono";
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url(/fonts/jetbrains.ttf) format("truetype");
}

/* Plus an Inter-fallback for FOUT-prevention */
@font-face {
  font-family: Inter-fallback;
  size-adjust: 107%;
  src: local(Arial);
}
```

**Validates Tractova's font pairing.** Defillama uses exactly the same Inter (variable, 100–900) + JetBrains Mono pairing we just landed (Geist replaces Inter on our side). The fact that the highest-density crypto-analytics dashboard on the web uses this exact pairing is strong validation for our typography decisions made 2026-05-27 (`027f489`).

### Border-Radius Scale
`0.125 / 0.25 / 0.375 / 0.5 / 0.75 / 1 / 1.5` rem (= 2/4/6/8/12/16/24 px). Cards almost universally `rounded-md` (6px). Lozenges `rounded-lg` (8px). Buttons `rounded-md`.

### Spacing
Base unit `0.25rem` (4px), used as Tailwind's spacing scale.

## Animation Library — STEAL THIS

Defillama defines 18+ `@keyframes` in CSS. These are the ones we'd actually use:

```css
@keyframes wiggle {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-3deg); }
  75% { transform: rotate(3deg); }
}
/* Used for the AI/promo button (their "llamaai-glow" element) — subtle attention grab without being annoying */

@keyframes marquee-animation {
  from { transform: translateX(0); }
  to { transform: translateX(-100%); }
}
/* Their .marquee class wraps this with --gap, --speed, --direction CSS vars
   for prop-style customization. Pattern is gold for our "Markets on the
   Move" ticker — convert from static row to scrolling marquee with deltas. */

@keyframes linebeat {
  0%, 100% { height: 100%; }
  50% { height: 50%; }
}
/* Vertical bar pulse — use as "live data" affordance on the eyebrow strip */

@keyframes ai-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(31, 103, 210, 0.5); }
  50% { box-shadow: 0 0 40px rgba(31, 103, 210, 0.8); }
}
/* The radial glow they use on the LlamaAI promo button. Adapt to teal
   for Tractova's "Run a Lens" CTA in the same Dashboard slot. */

@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
/* Skeleton loading shimmer — better than our current animate-pulse rectangles */

@keyframes spotlight-enter {
  from { opacity: 0; clip-path: polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%); }
  to { opacity: 1; clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%); }
}
/* Powerful — like a flashlight uncovering content from the center.
   Could replace the MountReveal fade-and-rise on the StateDetailPanel. */

@keyframes slidein {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
/* Same as our MountReveal — validates the pattern */

@keyframes tooltip-enter-above / tooltip-enter-below {
  from { opacity: 0; transform: translateY(±8px); }
  to { opacity: 1; transform: translateY(0); }
}
/* Directional tooltip entrances based on side — we already have Radix
   Tooltip which handles this; flag the timing curve as a tuning ref */

@keyframes alertPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
/* Use for the freshness pill in the header when stale */
```

## Layout & Interaction Patterns — STEAL THESE

### 1. Disclosure Metric Card (inline expand, not modal)

```html
<details class="group/metric">
  <summary class="flex flex-wrap justify-start gap-4 border-b border-(--cards-border) py-1
                  group-last/metric:border-none
                  group-open/metric:border-none
                  group-open/metric:font-semibold">
    <span>Total Value Locked</span>
    <svg class="relative top-0.5 -ml-3 transition-transform duration-100
                 group-open/metric:rotate-180">...</svg>
    <span class="font-jetbrains text-(--success)">$95.4B</span>
  </summary>
  <!-- Expanded content: dashed-border sub-rows -->
  <div class="group flex flex-wrap justify-start gap-4 border-b border-dashed border-(--cards-border) py-1 last:border-none">
    <span>Ethereum</span><span>$52.1B</span>
  </div>
  <div class="group flex flex-wrap justify-start gap-4 border-b border-dashed border-(--cards-border) py-1 last:border-none">
    <span>Solana</span><span>$10.3B</span>
  </div>
</details>
```

**Why this beats our current click-to-modal pattern**: zero context switch. The user sees the metric, opens it in place, sub-rows reveal below, click again to collapse. Tailwind named groups (`group/metric`) let the chevron rotate without JS state. This is the single most copyable pattern for the MetricsBar revamp.

### 2. Dotted-Underline Tabular Cells

```html
<span class="flex shrink-0 items-center overflow-hidden text-ellipsis whitespace-nowrap
             text-(--text-label) underline decoration-dotted">
  Curve Finance
</span>
<span class="font-jetbrains text-ellipsis underline decoration-dotted text-(--success)">
  +12.4%
</span>
```

Used **everywhere** in their tables. The dotted underline says "hover for context" — every cell becomes a Bloomberg-terminal-style info-rich surface without buttons. `text-(--text-label)` (dark gray, NOT pure white) keeps the table calm; only positive/negative deltas use `text-(--success)` / `text-(--error)`.

### 3. Data-Attribute Tabs (no JS toggling)

```html
<button class="inline-flex items-center justify-center shrink-0 px-3 py-1.5 whitespace-nowrap
               hover:bg-(--link-hover-bg)
               focus-visible:bg-(--link-hover-bg)
               disabled:hover:bg-transparent
               data-[active=true]:bg-(--old-blue)
               data-[active=true]:text-white"
        data-active="true">
  1d
</button>
```

The `data-active` attribute drives styling via `data-[active=true]:` variants. Same pattern works for our NewsFeed filter tabs — drop the `bg-primary text-white` conditional string, switch to data attributes.

### 4. The 5-Lozenge KPI Strip (instead of 5 tall cards)

```html
<div class="isolate grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
  <!-- One hero card spanning 2 columns -->
  <div class="col-span-2 ... rounded-md border border-(--cards-border) bg-(--cards-bg) p-2 xl:col-span-1">...</div>
  <!-- Five 64px-max lozenges, each min 270px -->
  <div class="relative flex max-h-[64px] w-full max-w-[70vw] min-w-[270px] flex-1
              items-center gap-2.5 overflow-hidden
              rounded-lg border border-(--cards-bg) bg-(--cards-bg) p-2.5">
    <!-- Icon at left, metric stack center, sparkline right -->
  </div>
  <!-- ×5 -->
</div>
```

**Vertical density is the trick.** Our current MetricsBar uses tall 196px cards (5×196 = ~1000px of vertical real estate). Defillama uses 64px lozenges (5×64 = 320px) and packs MORE information in them via the icon-stack-sparkline horizontal layout.

### 5. Hover-Reveal "See Details" Affordance

```html
<a class="invisible text-xs font-medium text-(--link) underline
          group-hover:visible group-focus-visible:visible">
  Show breakdown →
</a>
```

Resting-state invisible, hover-state visible. Lets a card carry a CTA without crowding the data when nobody's looking. **We'd use this on the StateDetailPanel rows.**

### 6. The Marquee Pattern

```css
.marquee {
  --gap: 20px;
  --speed: 25s;
  --direction: forwards;
  width: max-content;
  animation: marquee-animation linear infinite;
  animation-duration: var(--speed);
  animation-direction: var(--direction);
  padding-left: var(--gap);
  gap: var(--gap);
  display: flex;
}
.marquee-container { overflow: clip; }
```

CSS-vars-as-props pattern. Tractova's `<MarketsOnTheMove>` strip is static — converting it to a marquee with directional reversal on hover would land a strong "live" feel. Already in our Skills/Marquee.md.

### 7. Custom Thin Scrollbar (everywhere)

```css
.thin-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--bg-border) transparent;
}
.thin-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
.thin-scrollbar::-webkit-scrollbar-thumb { background: var(--bg-border); border-radius: 3px; }
.thin-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--bg-muted); }
```

Applied to every overflow surface (the sidebar, dropdowns, modal bodies). Tractova already has scrollbars but no thin-bar utility class.

## What This Reveals About Tractova's Current Dashboard

| Defillama pattern | Tractova current | Gap |
|---|---|---|
| Dark-on-dark unified surface (cards #131516 on bg #090b0c) | Dark cards (#0F1A2E) on CREAM page (#FAF5EE-ish) | The dark cards on a light page read as "stuck-in modules," not a unified intelligence surface |
| 5× 64px KPI lozenges + sparklines | 5× 196px tall cards, icon-as-decoration | 3× the vertical real estate for ½ the information |
| Inline disclosure-metric expand | Click-to-modal | Context-switch tax on every metric drill-in |
| Dotted-underline cells with `--text-label` (dark gray) | Plain text in tables | Misses the "every cell is hover-rich" Bloomberg feel |
| `data-[active=true]:` styled tabs | Conditional className strings | Works but uglier |
| Hover-reveal CTAs (invisible at rest) | Always-visible "Details" arrow | Crowds the resting state |
| Marquee with `--gap`/`--speed`/`--direction` CSS vars | Static `<MarketsOnTheMove>` row | Loses the "live" affordance |
| Custom `thin-scrollbar` utility everywhere | Default browser scrollbars | Cosmetic but cumulative — feels less polished |

## Notes — What NOT to Copy

- **D3 for charts** — we'd rebuild every chart from scratch. Recharts (already in `package.json`) gives us 80% of Defillama's visual range with 5% of the work. The Skills/ folder has 50+ Recharts variants pre-bundled.
- **RainbowKit / wallet connect** — irrelevant to Tractova
- **Their LlamaAI sidebar overlay** — we have the CommandPalette which serves the same "AI access from anywhere" need
- **Their announcement-cookie system** — Tractova has no banner-dismissal need yet; defer
- **Their inline `<details>` element for disclosure** — works, but our Radix-based components are more accessible; keep the visual *pattern* (chevron rotation, dashed-border sub-rows) but use Radix Accordion / Collapsible primitives we already have

## Cross-Reference: Dashboard Examples 1–3

| Pattern from images | Closest Defillama match | Notes |
|---|---|---|
| **Ex 1: Left sidebar nav** (Dashboard, Markets, Policy, Reports, Settings) | Defillama's `desktop-nav-shell col-span-1` sidebar with `sticky top-0 h-screen` | Both are vertical nav rails. Ex 1's is narrower and icon-first; Defillama's has labels. |
| **Ex 1: Center "Intelligence Hub" with pillar gauges** | Defillama hero card (`col-span-2 xl:col-span-1`) at top of grid | One spanning card carrying the hero metric set, smaller cards around. |
| **Ex 1 + 2 + 3: Right "Intelligence Feed" rail** | Defillama doesn't have this exact pattern; closest is their `Sticky Sidebar Right` in some sub-pages | This is more our existing NewsFeed than a Defillama steal. |
| **Ex 2: Left filter sidebar (State / Utility / Project Stage / Scope MW)** | Defillama's filter popovers (`thin-scrollbar h-[calc(100dvh-80px)]`) but EXPANDED inline instead of popover | Persistent filter rail = Tractova-specific; not a Defillama pattern. |
| **Ex 3: Top map hero + overlaid filters (Region/Reach/Coverage)** | Defillama doesn't have geographic map; closest is their chain-card grid | Ex 3 is the boldest concept — Tractova's USMap becomes the page hero, filters overlay it, KPI row sits below. |
| **Ex 3: 5× KPI cards WITH sparklines** below map | Defillama's 5-lozenge KPI strip + sparklines | **Direct copy candidate** |
| **Ex 1/2 dark "Intelligence Terminal" treatment** | Defillama dark theme (`--app-bg: #090b0c`) | **The biggest brand question — see Open Questions** |

## Open Question Before Plan Lands

**Dark theme or no?** Examples 1, 2, 3 all show a DARK dashboard surface — like Defillama's dark mode (or like Bloomberg/TradingView terminals). Tractova's current Dashboard is dark CARDS on a CREAM page. That mismatch is the single biggest "feels generic" signal. Three options:

- **A (smallest move): Keep cream page, redesign cards** to be Defillama-light-theme style (white card surface, hairline borders, dotted-underline rows). Loses the "terminal" feel from Examples 1-3 but preserves the existing brand surface.
- **B (biggest move): Dashboard becomes a dark surface** (matches Examples 1-3 + Defillama dark theme + every intelligence terminal in the world). All other Tractova pages stay cream. Dashboard becomes the "control room"; Library/Lens/About stay editorial.
- **C (hybrid): Dark hero strip** (map + market brief + KPI lozenges) layered into the existing cream page; cream takes over for NewsFeed + StateDetailPanel below. Lets us test-drive the dark treatment in one slot without committing the whole page.

**Recommendation: B**, with a fallback to C if A feels too inconsistent within the same brand. Examples 1-3 are unambiguous about wanting dark. Defillama's success at the same problem (dense data + intelligence framing) is dark. The Lens result page already has dark moments. Going dark on the Dashboard sharpens "this is the intelligence surface; everything else is editorial context."

## Build Plan — Maps to Tractova Surfaces

See companion doc: `research/2026-05-27-dashboard-revamp-plan.md` (next step — entering plan mode for sign-off before any code lands).
