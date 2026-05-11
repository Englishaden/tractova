# Tractova Design Vocabulary

> Companion doc to `~/.claude/plans/if-the-dsire-api-dreamy-anchor.md` (TRACTOVA-UX-001).
> The plan tells you WHAT to build per phase. This doc tells you HOW it should LOOK + FEEL
> as you build it. Both are required reading before opening any UI file in the overhaul.

---

## The Big Idea — One Sentence

**Tractova is the Bloomberg Terminal a small CS developer wishes they could afford — a research-grade financial terminal that reads like an institutional analyst note, sounds like a keyboard-driven trading desk, and feels alive without being noisy.**

The aesthetic direction is **terminal-class research note**: the visual heft of an institutional research publication (Lazard, Goldman GIR, Morgan Stanley Research) crossed with the keyboard-first density of Bloomberg. Not 1990s green-on-black retro. Not Vercel-dashboard glow. Editorial typography, mono-rich chrome, ambient calm, surgical color.

---

## 1 · Typography

### Current commitments (preserve, do not invent new)

| Role | Family | Notes |
|---|---|---|
| Display / Card titles | `font-serif` (system serif → Bitstream-vera fallback) | Used for "MA Community Solar" card titles, hero headlines |
| Mono eyebrows / chrome | `JetBrains Mono` → ui-monospace fallback | Section markers, panel labels, status badges, command palette |
| Body / data rows | System sans (Tailwind default → Inter inherited) | Cards bodies, table rows, prose |

### The commitment

**Three voices, no more.** Every text element belongs to one of these three families. No fourth typeface. Ever.

### Type scale (canonical sizes)

```
text-[8px]   eyebrow-mono on <md         — tightest chrome (mobile)
text-[9px]   eyebrow-mono on ≥md         — § markers, panel labels
text-[10px]  caption / secondary label
text-[11px]  body in cards / data rows
text-[12px]  emphasized body / chip labels
text-base    standalone body prose (rare)
text-lg      sub-headers
text-xl      card titles (serif)
text-2xl     section heroes
text-4xl+    landing hero only
```

**Use the `.eyebrow-mono` utility** from `src/index.css` everywhere a mono eyebrow appears. It encodes the responsive scaling (8→9px) and tracking (0.18→0.24em) so you never have to think about it again. **Phase 3 sweeps the codebase to convert 60+ inline call sites to this utility.**

### Tracking (letter-spacing) discipline

| Tracking | When to use |
|---|---|
| `tracking-[0.24em]` | Primary § markers — chapter-like importance |
| `tracking-[0.20em]` | Sub-section eyebrows — within a § |
| `tracking-[0.18em]` | Mobile eyebrows + medium-importance chrome |
| `tracking-[0.16em]` | Small chips, badges, count labels |
| `tracking-wider` | Form labels, inline prose chrome (0.05em — subtle) |

**Never** mix two trackings on the same horizontal row of related elements. If § 01 uses `0.24em`, the sublabel beside it should use `0.18em` so they read as a hierarchical pair, not a clash.

### Font weight discipline

- `font-bold` (700) — eyebrows, navigation, section markers (high authority signal)
- `font-semibold` (600) — card titles, primary action buttons, emphasized data values
- `font-medium` (500) — body emphasis, secondary buttons, dropdown active items
- Default (400) — body prose, table cells, captions

**Italics are reserved for the AI analyst-note voice** — when Sonnet's verdict prose is displayed, italics signal "this is the AI talking." Don't use italics for emphasis elsewhere.

---

## 2 · Color

### Current commitments

| Role | Color | Use |
|---|---|---|
| Brand primary (Tractova teal) | `#0F766E`, `#14B8A6`, `#5EEAD4` | Buttons, links, focus states, Offtake pillar |
| Brand ink (navy) | `#0F1A2E`, `#0A132A` | Display text, masthead, brand surfaces |
| IX pillar (amber) | `#D97706`, `#B45309`, `#92400E`, `#F59E0B` | Interconnection card, queue congestion |
| Site pillar (blue) | `#2563EB`, `#7C3AED` | Site Control card, suburban/urban markers |
| Severity red | `#DC2626`, `#B91C1C` | Cancelled, FEOC, critical |
| Neutrals | `#E2E8F0`, `#F3F4F6`, `#94A3B8`, `#6B7280` | Dividers, borders, secondary text |
| Surface paper | `bg-paper` (cream off-white) | Page backgrounds |

### The commitment

**Three pillar colors. One brand color. One severity color. Everything else is neutral.** Total expressive vocabulary: **5 hues.** Anything else is wrong.

### Color usage philosophy

- **80% neutrals.** White surfaces, grey hairlines, navy ink text.
- **15% accent rails.** Pillar colors as 2-3px left borders, eyebrow text, gauge fills.
- **5% expressive.** Saturated accents reserved for the moments that matter — Lens score reveal, policy adjustment chips, save confirmation.

The IntelligenceBackground floating dots are the major exception — those use all four hues at low opacity in motion, but live BEHIND content. The foreground stays disciplined.

### Status / severity scale

The user's UX sweep already locked this monotonically across the amber family:

| Level | Hex | Use |
|---|---|---|
| Calm / Healthy | `#92400E` | Low congestion, modeled-in-financials chips |
| Caution / Mid | `#D97706` | Moderate congestion, medium confidence |
| Warning / Severe | `#B45309` | High congestion, headwind policy |
| Critical | `#DC2626` | FEOC, cancelled, hard-stop signals |

**Never** use green for "good." Tractova's "good" is calm amber + teal. Green washes out against the brand-navy + teal palette and reads as generic SaaS.

---

## 3 · Motion

### The five primitives (Phase 0 — shipped)

Every motion in the app composes from these. No ad-hoc animations after Phase 0.

| Primitive | Vocabulary | Where |
|---|---|---|
| `<PageTransition>` | Fade + 8px slide, 220ms | **Per-page scoped only** — DO NOT wrap all routes globally; that caused OOM on the Lens tree (incident 2026-05-11, reverted `238169a`). Use on lighter pages (Profile / Glossary) or replace with CSS-only fade on Suspense fallback in Phase 4. |

### ⚠ Hard rule on height: auto animations

`motion.div animate={{ height: 'auto' }}` is **forbidden** in collapsibles that wrap heavy content (policy event lists, cs_projects panels, comparable deal grids). It forces synchronous measurement of every child on mount, which blew memory on Lens (incident 2026-05-11, fix `ddc9173`). Plain `{open && <div>}` conditional render is the correct pattern for nested collapsibles around large subtrees. Chevron rotation animation on the toggle button is fine and stays.

The existing `CollapsibleCard` (used by the 3 main pillar cards) currently still uses `height: auto`. It hasn't OOM'd because the pillar cards are heavy-but-bounded. Phase 4 should evaluate whether to migrate it too — but with caution, since changing the 3 main pillar collapsibles is broader blast radius.
| `<RevealOnScroll>` | Fade + 12px lift, 380ms | Section reveals on first viewport entry |
| `<HoverLift>` | translateY -2px + shadow deepen, 180ms | Cards, chips, buttons |
| `<CountUp>` | RAF + cubic-easing | Score numerals, MW totals |
| `<GaugeFill>` | SVG dashoffset interpolation, 900ms | All gauges (ArcGauge, ScoreGauge, MiniArcGauge) |

Plus the **ambient layer**: `IntelligenceBackground` (already shipped) provides floating accent dots + the Tractova T easter egg. **Foreground motion layers on TOP of this without competing.**

### Motion philosophy

- **Honor reduced-motion.** Every primitive short-circuits to its final state when `prefers-reduced-motion: reduce`. Tested in Phase 0.
- **One orchestrated reveal per page > scattered micro-interactions.** Lens results page: pillar gauges fill in sequence with 80ms stagger, composite CountUps over 700ms, then section reveals on scroll. That's the moment. Everything else is calm.
- **Motion that doesn't say anything = noise.** Hover lifts on cards: yes (signals "interactable"). Hover lifts on every span of text: no.
- **Easing: `[0.16, 1, 0.3, 1]` for entrances; `[0.22, 1, 0.36, 1]` for fills.** Both are decelerating cubic curves — confident landing, no oscillation, no bounce. **Never use bounce easing.** Bounces read as playful; Tractova is serious analyst software.

### Timing budget

- **Micro-interactions (hover, focus): 120-180ms**
- **Reveals (section, card mount): 320-420ms**
- **Score / gauge fills: 700-900ms**
- **Page transitions: 200-240ms**

If something feels slow, it's usually too long, not too short. Audit on real devices, not just localhost.

---

## 4 · Interaction Grammar

### Cmd-K is the spine (Phase 1)

Every action a power user takes more than three times in a session should be a Cmd-K verb. This is the Bloomberg commitment: keyboard-first, command-grammar second.

**Reserved verb prefixes** (Phase 1 lands these):

| Verb | Action |
|---|---|
| `:lens <STATE> [<MW>] [<TECH>]` | Run Lens analysis |
| `:portfolio` | Open Library |
| `:scenarios` | Library → Scenarios tab |
| `:compare` | Open CompareTray modal |
| `:rerun <project>` | Re-run Lens for saved project |
| `:gloss <TERM>` | Glossary deep-link |
| `:state <ID>` | State-level snapshot |
| `:new` | New Lens analysis (clear form) |
| `:help` | Verb reference |

**Two keystrokes = primary navigation.** This is the unforgettable habit.

### Secondary affordances

- **Hover** lifts cards 2px + shadow deepens. Signals interactability.
- **Click expand** for any collapsible (CollapsibleCard or CollapsibleSubsection). Chevron rotates 180° with the 250ms ease. ARIA-controlled.
- **Right-click / long-press** is reserved (Phase 6+) — not used now.
- **Drag** is reserved for Scenario Studio sliders only — anywhere else it should feel surprising.

### Empty states

Curation-gated panels (`Maybe*` wrappers) currently disappear silently. Per the audit, Phase 2A + 2C make them visible with empty-state messaging. **Every empty state must:**
1. Name what's missing in this state ("No comparable deals curated for ME yet")
2. Tell the user what action would populate it ("Paste a news article URL in the Comparable Deals admin tab")
3. Stay calm — empty is not a failure state; it's an opportunity signal

### Keyboard navigation

Every interactive element reachable by Tab. Every collapsible toggleable by Space/Enter. Cmd-K opens the palette anywhere. Esc closes any modal or palette. Arrow keys navigate palette results. Phase 3 ships the a11y sweep that locks this.

---

## 5 · Spatial Composition

### Section rhythm (§ N · Title · sublabel)

Tractova's signature structural element. Treat § markers as chapter breaks in a research note:

```
§ 01 · Market Position           composite feasibility · sensitivity scenarios
§ 02 · Analyst Brief             claude · sonnet 4.6
§ 03 · Scenario Studio           sensitivity · year-1 revenue + payback
§ 04 · Pillar Diagnostics        offtake · interconnect · site · policy climate
§ 05 · Comparable Deals & Benchmarks   operating projects · per-deal comps · market aggregates
```

**Sub-rules:**
- § N numbers are MONOTONIC. No § 04.5. No skipping. Renumber if you insert.
- Sub-elements within a § share the § number's identity. The Policy Climate "shadow pillar" lives INSIDE § 04, not as § 05.
- `SectionDivider` separates § N from § N+1. Margin alone isn't enough.

### Grid + asymmetry

- **3-column grids** for pillar cards (§ 04). Equal-weight, equal-height — these read as peers.
- **Asymmetric 5:7 split** for hero panels (MarketPositionPanel gauge on left, identity + sub-scores on right). Communicates hierarchy through proportion.
- **Full-width** for shadow pillar and § 05 subsections. Cross-cutting content gets the breathing room.
- **Don't center-stack everything.** Asymmetry is a Tractova signature. Editorial design > generic SaaS design.

### Density

Bloomberg-class. Numbers per square inch matter. But density without hierarchy is brutalism. Hierarchy comes from typography (size, weight, tracking) — not from extra whitespace. **Adding more padding to solve a layout problem is usually the wrong fix.** The right fix is usually to make the eyebrows tighter and the data values louder.

---

## 6 · The Unforgettable Thing

> What's the ONE thing a developer remembers and tells their friend about Tractova?

Three candidates were evaluated:

| Candidate | Verdict |
|---|---|
| The IntelligenceBackground dots + Tractova T easter egg | Memorable, but ambient — discoverable only over time |
| The pillar gauge fill sequence on Lens results | High impact, but happens once per analysis |
| **The Cmd-K verb syntax** | **WINNER** — used dozens of times per session, social-shareable ("type `:lens ME 5 CS`") |

**The unforgettable thing is `:lens ME 5 CS`.**

That's the moment a developer types two keystrokes, sees the Lens result land with a fade-and-slide, watches three pillar gauges fill in sequence, reads the analyst brief with policy adjustments highlighted, and thinks: "this is what software for me is supposed to feel like."

**Everything in Phases 1-6 services this moment.** Phase 1 builds it. Phase 4 makes it look extraordinary. Phase 2 gives them a portfolio to come back to. Phase 5 connects it to a coherent marketing story.

---

## Implementation Checklist (per phase)

Before merging each phase, gut-check against this doc:

- [ ] **Typography:** All eyebrows use `.eyebrow-mono` utility. Three voices max (serif/mono/sans). No new typefaces.
- [ ] **Color:** Uses one of the 5 canonical hues OR a neutral. No purple gradients. No green. No glassmorphism.
- [ ] **Motion:** Composes from the 5 primitives. Honors reduced-motion. Easing curves match the spec. No bounce.
- [ ] **Interaction:** New power-user actions have a Cmd-K verb. Hover affordances are deliberate. Empty states say what's missing + how to populate.
- [ ] **Composition:** Uses § N markers if it's a new section. Asymmetric where it earns its keep. Density is achieved through hierarchy, not whitespace removal.
- [ ] **Soul check:** Does this feel like a Bloomberg-class research terminal, or like generic SaaS? If the latter, what would Goldman GIR do?

---

## What's NOT Tractova

These are explicit anti-patterns. Reject them in review:

- ❌ Purple → pink gradients
- ❌ Glassmorphism (frosted panels)
- ❌ Neumorphism (soft shadows + highlights)
- ❌ Inter typeface (use system sans or our serif)
- ❌ Space Grotesk (banned per design discipline)
- ❌ Green for "good" (we use calm amber + teal)
- ❌ Bounce easing on any animation
- ❌ Card grids with 8+ visible cards (use Table view instead)
- ❌ Center-stacked hero with massive CTA button (we're not a landing page generator)
- ❌ Mock-data screenshots as hero imagery (we ARE the data — show real)
- ❌ Animated emoji as decoration
- ❌ Loading spinners (use Skeleton primitives)
- ❌ Toasts that auto-dismiss critical info (use them only for confirmations)
- ❌ "Coming soon" badges without a tangible date or affordance
- ❌ AI-generated stock illustrations
- ❌ Dropdowns that exceed their parent card bounds (Radix Popover only — Phase 2A fixes StagePicker)

---

## Reference platforms

When you're stuck on a design decision, look at what these do — in order of priority:

1. **Bloomberg Terminal** — keyboard density, color discipline, mono chrome
2. **Linear** — motion polish, transition timing, hover micro-interactions
3. **Goldman GIR / Lazard / McKinsey publications** — editorial typography, § markers, asymmetric layouts
4. **Vercel Dashboard** — gradient surfaces, soft shadows, transition coherence (not gradients themselves — the discipline)
5. **Stripe Press** — typography respect, restraint, density-without-clutter
6. **Pitchbook / Crunchbase** — table density, deal-flow row patterns (Phase 2A)

Avoid drawing from: any AI-tool dashboard (Notion AI, Vercel AI), any "modern SaaS" landing page generator, any product whose primary visual is a 3D-rendered hero scene.

---

## Living document

Update this when:
- A new typeface enters the codebase (almost certainly: don't)
- A new color is added to the palette (justify against the 5-hue commitment)
- A new motion primitive ships (Phase 4 adds composition patterns; document them here)
- A reference platform changes our minds about something (note the date + decision)

Edited dates:
- 2026-05-11 — Initial draft (post-Phase 0, pre-Phase 1)
