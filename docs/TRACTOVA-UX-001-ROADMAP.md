# TRACTOVA-UX-001 — Bloomberg Terminal Overhaul Roadmap

> **Unified resume doc** — read this file + `docs/design-vocabulary.md` after `/clear` and you can pick up Phase 1 instantly. Companion to `BUILD_LOG.md` (chronological log) and `~/.claude/plans/if-the-dsire-api-dreamy-anchor.md` (mirror of this content).

**Last updated:** 2026-05-12
**Project owner:** Aden (englishaden / aden.walker67@gmail.com)
**Status:** Phases 0, 1, 2A, 2B, 2C + UI/UX-audit five-pass cleanup all shipped. Resume at Phase 3 (Lens polish + a11y).

---

## 0 · TL;DR — Resume in 30 seconds

1. Read `docs/design-vocabulary.md` for aesthetic discipline.
2. Read the **Pickup section at the bottom of this file** for exactly what comes next.
3. Phase 1 = Cmd-K becomes the nav spine (`:lens ME 5 CS` is the unforgettable moment).
4. Plan file (mirror): `~/.claude/plans/if-the-dsire-api-dreamy-anchor.md`.

## 0.1 · 🛑 DO-NOT-REPEAT LESSONS (from the Phase 0 OOM debug saga)

Three OOM crashes happened during Phase 0. Read these BEFORE writing motion code on the Lens page:

- **NEVER wrap all Routes in `<PageTransition>`** (AnimatePresence + motion.div keyed by pathname). The Lens results tree is too dense — IntelligenceBackground + 5 sections + ScenarioStudio + CompareTray + CommandPalette all under one motion parent blows Chrome's per-tab memory budget. Per-page scoped use OR CSS-only fade is fine. Incident: revert `238169a`.
- **NEVER use `motion.div animate={{ height: 'auto' }}` to wrap heavy content.** motion has to synchronously measure all children. Inside `CollapsibleSubsection` that wrapped 22+ policy events + CsMarketPanel + ComparableDealsPanel, the cascade cost OOM. Use plain `{open && <div>}` conditional render instead. Chevron rotation animation is fine (small SVG transform, cheap). Incident: revert `ddc9173`.
- **§ 05 (LensComparablesSection) is currently gated off** in `Search.jsx` behind `{false &&}`. CsMarketPanel + `getCsMarketSnapshot` triggers OOM on heavy-rowcount states (MA 374, IL 261, NY 1351 cs_projects rows). Not from any single component — cumulative memory pressure with the rest of the Lens tree. **Re-enable in Phase 2A** with the paginated Table view + Library cockpit migration (Operating Projects moves to Library where it belongs). Incident: disable `4b183d0`.
- **The 3 main pillar cards (Offtake/IX/Site) still use `CollapsibleCard` with `height: auto` motion.** They haven't OOM'd because the cards are heavy-but-bounded. Phase 4 should evaluate migrating them — with caution, since changing the main pillars is broader blast radius.
- **Bisect strategy that worked:** disable both new sections → confirm Lens loads → re-enable one at a time → narrow to the offender. Use `bisectOnly` prop pattern in `LensComparablesSection.jsx` for sub-component isolation. Don't try to fix OOMs by reading code alone; bisect with deploys.

---

## 1 · The Big Idea

**Tractova becomes the Bloomberg Terminal a small CS developer wishes they could afford.** Keyboard-driven, mono-rich, ambient-alive, surgical color. Editorial research-note typography crossed with Bloomberg-class density and Linear-class motion polish. The Library is the trading floor. Cmd-K is the spine. Motion is a first-class design material. Mobile is a streamlined reader, not a feature peer.

**User direction (locked):**
1. Reference spirit: **Bloomberg Terminal**
2. First priority surface: **Library / Portfolio cockpit**
3. Visual ambition: **Push expressive motion**
4. Form factor: **Desktop-first, mobile-functional**

**Total effort estimate:** 93–129 hours across 6 phases.

---

## 2 · Audit findings (the why behind the plan)

### Lens page (mature, polish gaps)
- Hand-rolled modals (no `aria-controls`)
- § 05 collapsibles used hand-rolled buttons (fixed in Phase 0 — now using `CollapsibleSubsection`)
- Responsive typography doesn't scale on mobile
- Scenario "✓ Saved" silently reverts after 2.5s

### Library (BIGGEST functional gap)
- No map view
- No pagination (100+ projects breaks the page)
- "Select all" hidden — only appears when `selectedIds.size === 0 && displayProjects.length > 1`
- No persistent compare (localStorage-only)
- No PDF export from compare modal
- StagePicker dropdown can escape card bounds
- "Updated" + "State ±X pt" chips disappear on expand
- Orphan scenarios disconnected from projects (no "convert to project" CTA)
- No "Re-run with latest data" button inside cards

### Profile
- No billing history view
- No inline stage editing (must bounce to Library)

### Compare flow
- No save/share/PDF — localStorage-only modal
- AI ranking collapsible easy to miss

### Navigation
- No persistent sidebar; users rely on footer links + browser back
- Top nav exists but auth-conditional content area is narrow
- Mobile UX gets one squished row of links
- Cmd-K palette exists but isn't promoted as the spine

### Landing
- Feels like a different product than the in-app aesthetic — large serif emotional hero vs in-app utilitarian data feel

---

## 3 · What's shipped (✅)

### PIE-001 — Policy Impact Ecosystem (pre-overhaul)
Complete end-to-end:
- URL paste → AI classifier (tool-use, tier-aware) → multi-tier `policy_impact_events` rows
- Scenario Studio base IRR adjusts for active high-confidence policies (Phase B)
- State feasibility composite includes 10% `policy_climate` sub-score (Phase C)
- Pillar cards (Offtake/IX/Site) chip routing (Phase D — later removed in UX cleanup)
- § 04 shadow-pillar collapsible (`LensPolicyClimateSection`)
- Glossary tooltips on all new terms
- 90/90 unit tests + scalability discipline locked

### § 05 — Comparable Deals & Benchmarks (DISABLED — see § 4 Phase 2A)
- Component lives at `src/components/LensComparablesSection.jsx`
- Currently gated off in `Search.jsx` behind `{false &&}` (commit `4b183d0`)
- Bisect confirmed it triggers Chrome OOM on heavy-rowcount states (MA 374, IL 261, NY 1351 cs_projects rows)
- Defer the live re-enable to **Phase 2A** which re-architects this surface with paginated Table view + moves Operating Projects to the Library cockpit

### UX sweep (2026-05-11)
- IX Low Congestion text color #92400E (was identical to Moderate)
- Shadow pillar ink left-bar (#0A1828)
- § 05 subsection icons aligned to ◆ Tractova standard mark
- SectionDivider between § 04 and § 05
- Glossary tooltips on `Active Policy`, `Policy Climate`, `Modeled in financials`, `Qualitative — not modeled`

### ⚠ Phase 0 incident chain — THREE OOM fixes (commits `238169a` + `ddc9173` + `4b183d0`)

The OOM crash on the Lens results page took THREE fixes:

1. **Fix 1 — PageTransition revert (`238169a`).** Wrapping all Routes in `<PageTransition>` (AnimatePresence + motion.div keyed by pathname) was the first offender. The Lens tree is too heavy (IntelligenceBackground + 5 sections + ScenarioStudio + CompareTray + CommandPalette) for a global AnimatePresence parent.

2. **Fix 2 — `CollapsibleSubsection` height animation dropped (`ddc9173`).** After (1) deployed, Lens STILL crashed. The remaining offender was `CollapsibleSubsection`'s `motion.div animate={{ height: 'auto' }}` wrapping § 04 shadow pillar (22+ policy events from batch seed) + § 05 Operating Projects (CsMarketPanel with hundreds of cs_projects rows). motion's height animation forces synchronous measurement of all children, which cascaded during the loading-screen → results-render swap. Replaced motion.div body with plain `{open && <div>}` conditional render — same end state, no measurement pass. Chevron rotation animation kept.

3. **Fix 3 — § 05 fully gated off (`4b183d0`).** After (1) and (2) deployed, Lens STILL crashed. Bisect chain proved: shadow pillar alone works; § 05 with even just Operating Projects subsection crashes on heavy-rowcount states (MA 374, IL 261, NY 1351 cs_projects rows). Root cause is cumulative memory pressure: the Lens results tree is already heavy, and the cs_projects fetch + `CsMarketPanel` render tips it over Chrome's per-tab budget. Math doesn't add up to OOM on any individual component, but the combination does. Deferred § 05 to Phase 2A (Library cockpit rebuild), which will re-architect this surface with pagination + move Operating Projects to the Library where it belongs.

**Lessons:**
1. Page-level motion must be **per-page scoped or CSS-only**. Global AnimatePresence wraps are not safe on dense pages.
2. `height: auto` motion animations are **forbidden** in collapsibles wrapping heavy subtrees. Use plain conditional render. See `design-vocabulary.md § Motion` for the hard rule.

Phase 4 (motion rollout) revisits page transitions with CSS fade on Suspense fallback or scoped wraps for lighter pages (Profile / Glossary), and evaluates whether `CollapsibleCard` (still uses height: auto) needs the same treatment — caution flagged.

### Phase 0 — Foundations + Motion Primitives — commit `cfce269` (with revert `238169a`)
**This is the chassis for everything in Phases 1–6.**

New files:
- `src/components/motion/MotionPrimitives.jsx` — 5 primitives:
  - `<PageTransition>` (fade + 8px slide on route change)
  - `<RevealOnScroll>` (IntersectionObserver entry reveal)
  - `<HoverLift>` (translateY -2px + shadow deepen)
  - `<CountUp>` (RAF numeric animation, tabular-nums)
  - `<GaugeFill>` (svg stroke-dashoffset interpolation)
- `src/components/motion/Skeleton.jsx` — `<SkeletonCard>`, `<SkeletonRow>`, `<SkeletonGauge>`, `<SkeletonText>`
- `src/components/CollapsibleSubsection.jsx` — standardized lightweight collapsible

Modifications:
- `src/components/LensComparablesSection.jsx` — migrated off hand-rolled toggle
- `src/components/LensPolicyClimateSection.jsx` — migrated off hand-rolled toggle
- `src/App.jsx` — PageTransition wrap REVERTED 2026-05-11 after OOM (see incident note above). Routes back to plain Suspense.
- `src/index.css` — `@keyframes skeleton-shimmer` + `.eyebrow-mono` responsive utility class

All primitives honor `prefers-reduced-motion: reduce`.
Build: clean. Unit tests: 90/90 green. PIE-001 tests still pass.

### Design Vocabulary — commit `59a6b30`
- `docs/design-vocabulary.md` — typography / color / motion / interaction / composition discipline + anti-patterns list + reference platforms

---

## 4 · The 6-phase plan (what's next)

Each phase's killer feature + dependencies. See `~/.claude/plans/if-the-dsire-api-dreamy-anchor.md` for full detail.

### Phase 1 — Cmd-K becomes the nav spine (~10–14h)
**Killer feature:** `:lens ME 5 CS` lands you on Lens results in two keystrokes.

**Scope:**
- Command syntax parser in `src/lib/commandParser.js` — `:` triggers verb mode
- Reserved verbs: `:lens <STATE> [<MW>] [<TECH>]`, `:portfolio`, `:scenarios`, `:compare`, `:gloss <TERM>`, `:state <ID>`, `:new`, `:rerun <project>`, `:help`
- Recent-actions footer in CommandPalette (last 5 from localStorage, scoped to user.id)
- `<CmdKHint>` — fixed bottom-right floating ⌘K cue on every page, fades on idle
- `Cmd+Enter` opens in new tab, `Tab` autocompletes state IDs
- Active-route §-style underline in `Nav.jsx`
- **Decision: no persistent left sidebar. Cmd-K IS the spine.**

**New files:**
- `src/lib/commandParser.js`
- `src/components/CmdKHint.jsx`
- `tests/unit/commandParser.spec.js`

**Modify:**
- `src/components/CommandPalette.jsx`
- `src/components/Nav.jsx`
- `src/App.jsx` (mount CmdKHint)

**Risks:**
- Don't intercept `:` mid-search-query — gate verb path on `query.startsWith(':')` strictly
- iOS Safari has no Cmd — expose tap-to-open via bottom hint
- Cap localStorage recent-actions at 10 entries per user

**Verification:** Unit suite for parser (verb shapes, malformed inputs, MA vs MD ambiguity, case-insensitivity). Playwright: open palette, type `:lens ME 5`, assert URL. Manual: navigate whole app using only palette for a full session.

### Phase 2 — Library rebuilt as a portfolio cockpit (~37–49h) **CENTERPIECE**

Ships in three sub-waves. Each independently deployable.

#### Phase 2A — View modes + Table view (~12–15h)
**Killer feature:** Table view shows 50 projects in one screen. Real portfolio density.

**Important — re-enable § 05 here.** § 05 (Comparable Deals & Benchmarks) is currently gated off in `Search.jsx` due to the OOM incident chain. Phase 2A's new Table view + pagination naturally bounds the row count, which should resolve the underlying memory pressure. Move Operating Projects display from § 05 → Library cockpit (it belongs there anyway; developers compare across pipeline in Library, not while underwriting a single deal in Lens). Or: re-enable a lighter version of § 05 in Lens with a 6-row cap on `CsMarketPanel`'s sample, no row fetch beyond aggregate KPIs.

**Scope:**
- View-mode toggle in Library hero: Cards | Table | Map. Persist per user in localStorage (`tractova_library_view`)
- Lift top-level state from `{tab}` to `{tab, layout}`
- Bloomberg grid Table view: sticky header, mono numerics, 24px `<MiniArcGauge>` per row, single-dot alerts. Row click expands inline (CSS grid not `<table>` so expansion doesn't break columns)
- Sticky filter rail (`<LibraryFilterRail>`)
- Cursor-based pagination on `saved_at`, 25/50/100 page size + hidden "Load all"
- Bulk-select earlier — visible whenever >1 projects (not only after one selected). Add Shift-click range select
- Replace StagePicker absolute-positioned dropdown with Radix Popover
- Lift "Updated" + "State ±X pt" chips to persistent header (visible expanded + collapsed across Cards + Table)

**New files:**
- `src/components/library/LibraryToolbar.jsx`
- `src/components/library/ProjectTable.jsx`
- `src/components/library/ProjectTableRow.jsx`
- `src/components/library/Pagination.jsx`

**Modify:** `src/pages/Library.jsx`, `src/components/library/StagePicker.jsx`

**Risk:** `Library.jsx` is large + central. Lift view-mode first PR, hide current Cards behind `layout==='cards'`. Don't refactor Cards in 2A.

#### Phase 2B — Map view (~10–14h)
**Killer feature:** US map of your own pipeline. The screenshot developers will share.

**Scope:**
- Reuse `react-simple-maps` + `us-atlas` (already in deps via `USMap.jsx`)
- `<LibraryMap>` — states colored by MW-weighted aggregate score; project pins at county centroids
- Ship `data/county_centroids.json` (generate from us-atlas at build time if absent)
- Click pin → `<ProjectDrawer>` slide-in from right (480px)
- Click state → filters Library to that state
- Empty state: full US map with "Save a project from Lens to populate the map" CTA

**New files:**
- `src/components/library/LibraryMap.jsx`
- `src/components/library/ProjectDrawer.jsx`
- `src/data/county_centroids.json` (or build script)

**Modify:** `src/pages/Library.jsx`

**Risk:** 100+ pins = SVG-node load. First cut up to 200 pins; above 200 cluster by state with count badge + drill-in. Test on 100-pin synthetic fixture before merge.

#### Phase 2C — Saved compare + PDF export + Re-run + Scenarios→Projects (~15–20h)
**Killer feature:** Save a comparison, share a link, export as PDF for IC. Compare flow stops being throwaway.

**Scope:**
- **Migration FILE `062_saved_comparisons.sql`** (Aden applies in Supabase SQL editor per CLAUDE.md §1.1)

  ```sql
  saved_comparisons (
    id uuid pk, user_id uuid fk auth.users not null,
    name text not null, item_ids text[] not null,
    snapshot jsonb not null,
    created_at timestamptz, updated_at timestamptz
  )
  ```
  RLS: `user_id = auth.uid()` for select/insert/update/delete

- `lib/savedComparisons.js` — `save(name)`, `load(savedId)`, `list()`. `CompareContext.jsx` extended: localStorage = "draft" layer, Supabase = "saved" layer
- CompareModal header gets "Save as…" → Radix Dialog input. Saved comps surface in `:compare` Cmd-K + new Library tab
- **PDF export from Compare** — new `CompareReportPDF` doc using `@react-pdf/renderer` (already in stack via `ProjectPDFExport.jsx`). In-browser generation, no API roundtrip
- **Re-run with latest data** — button in `ProjectCard.jsx` (both Cards + Table) + `:rerun <name>` Cmd-K verb. Routes to `/search?fromProject=<id>`. `Search.jsx` handles `?fromProject=` by auto-running + "Re-run of Cumberland ME (last run 23d ago)" pill + "Save updates back to project" action
- **Orphan scenarios → projects** — "Convert to project" CTA on each orphan in `ScenariosView.jsx`. Creates `projects` row with stage='Prospecting', sets `scenario_snapshots.project_id = newProjectId`, logs via `logProjectEvent`

**New files:**
- `supabase/migrations/062_saved_comparisons.sql` (FILE only)
- `src/lib/savedComparisons.js`
- `src/components/CompareReportPDF.jsx`
- `src/components/library/SavedComparisonsList.jsx`
- `scripts/probe-saved-comparisons.mjs`

**Modify:** `src/context/CompareContext.jsx`, `src/components/CompareTray.jsx`, `src/components/ProjectCard.jsx`, `src/components/ScenariosView.jsx`, `src/components/CommandPalette.jsx`, `src/pages/Search.jsx`

**Risks:**
- **Migration application is danger zone per CLAUDE.md §1.1.** File only. Aden applies. Probe script for post-apply verification
- Snapshot drift between save + load — reuse `CompareTray.jsx:71–121` drift handling pattern
- Re-run with `?fromProject=` must NOT silently overwrite. Show diff between old + new sub-scores before confirmation

**Phase 2 overall verification:** `npm run verify` per sub-wave. New audit-ui tests: switch Table/Map/Cards, scores match across views; save comparison → log out → log in → see in saved list; export PDF blob non-empty; convert orphan scenario; assert `scenario_snapshots.project_id` populated.

### Phase 3 — Lens polish + accessibility (~10–14h)
**Killer feature:** A11y compliance + visual consistency. Product stops feeling like five generations bolted together.

**Scope:**
- Convert remaining § collapsibles to Phase-0 `<CollapsibleSubsection>` (most already done, audit complete)
- All hand-rolled save/confirm dialogs → Radix Dialog. CompareTray `CompareModal` currently uses `<div role="dialog">` — replace
- "✓ Saved" persistence in `ScenarioStudio.jsx` — toast-driven via `ui/Toast.jsx`; button stays "Saved" until user edits
- `aria-controls` sweep across all collapsibles + new Cmd-K
- Responsive typography sweep — convert 60+ inline `text-[9px]` and `text-[10px]` mono-cap callouts to the Phase-0 `.eyebrow-mono` utility
- Add `?fromProject=` handler to `Search.jsx` (Phase 2C dependency)

**Modify:** `src/components/LensComparablesSection.jsx`, `src/components/LensPolicyClimateSection.jsx`, `src/components/ScenarioStudio.jsx`, `src/components/CompareTray.jsx`, `src/components/ProjectCard.jsx`, `src/pages/Search.jsx`, broad eyebrow sweep

**Verification:** axe-core run in `tests/audit-ui.spec.js` — 0 critical violations on Lens/Library/Profile/Glossary. Manual: tab-cycle through Lens with keyboard only.

### Phase 4 — Motion layer rollout (~8–12h)
**Killer feature:** Three pillar gauges fill in sequence on first Lens open. Developer immediately understands this is intelligence-grade software.

**Scope:**
- Gauge fill animations — replace static fills in `ArcGauge.jsx`, `ScoreGauge.jsx`, `MiniArcGauge.jsx` with `<GaugeFill>`. Trigger on first viewport entry via IntersectionObserver (not every render)
- Score `<CountUp>` — animate composite 0 → final over 700ms on first reveal. Profile health gauge same treatment
- `<RevealOnScroll>` on Lens §1–§5, Library stat cards, Profile sections. 12px lift + opacity fade. Stagger children 60ms
- Hover micro-interactions — project cards lift 2px + shadow deepen. Chips scale 1 → 1.03. Buttons get `translateY(-1px)` on hover
- Replace bare loading dots in Library/Search/Profile with Phase-0 skeleton variants matched to final layout (no layout shift on load)
- Audit `IntelligenceBackground.jsx` z-index — new motion layers ON TOP, not competing

**Modify:** `src/components/ArcGauge.jsx`, `src/components/library/ScoreGauge.jsx`, `src/components/library/MiniArcGauge.jsx`, `src/pages/Search.jsx`, `src/pages/Library.jsx`, `src/pages/Profile.jsx`, `src/pages/Glossary.jsx`

**Risk:** Performance on low-end machines. IntersectionObserver to defer below-the-fold. Lighthouse perf score must not drop below baseline.

### Phase 5 — Cross-surface coherence (~10–14h)
**Killer feature:** Product reads as one cohesive thing from marketing site through paid app.

**Scope:**
- **Landing tightening** — keep editorial hero; tighten typography scale toward in-app; replace static value-prop cards with "live data shapes" (6-state heatmap chip, mini IX queue strip, sample Compare row). Extends existing `DashboardPreview` (`Landing.jsx:41-50`)
- **Profile inline stage editing** — surface `StagePicker.jsx` in Profile portfolio table; edits write straight to Supabase
- **Profile billing history** — new section fetching Stripe `invoices.list` via new `api/billing-history.js` serverless endpoint. Read-only list with hosted invoice URLs
- **Glossary tooltips everywhere** — sweep app to wrap every defined term mention (LMI, ITC, IRR, DSIRE, IX queue) with `<GlossaryLabel>`. Most in `Search.jsx`, `Library.jsx`, panel components, `CompareTray.jsx` row labels
- Tooltip footers reference Cmd-K (`⌘K → :gloss IRR for full definition`)

**New files:** `api/billing-history.js`

**Modify:** `src/pages/Landing.jsx`, `src/pages/Profile.jsx`, broad sweep across panel components

**Risks:** Stripe `customer` id mapping must exist in user metadata before shipping billing history. Glossary sweep is high-touch — review with screenshot diffs.

### Phase 6 — Polish + audit-ui hardening (~6–10h)
**Killer feature:** Regression-proof test suite. Keeps the new surface durable as we keep moving.

**Scope:**
- audit-ui expansion — Cmd-K nav (10 commands), view-mode toggling, persistent compare round-trip, PDF blob, re-run flow, orphan conversion, glossary tooltip hover
- **Mobile streamlined view** — soften `MobileGate.jsx` so Library + Profile + alerts are mobile-functional in cards-only view. Lens/Studio/Compare stay gated with clearer "open on desktop" + "send myself a link" affordance. New `<MobileLibrary>` (cards-only)
- Code-split `LibraryMap.jsx` + `ProjectTable.jsx` via `React.lazy` — Cards users don't pay for other layouts on first paint
- Cron-runs latency monitor stub — audit-ui suite probes `cron_runs` p95 (closes `project_cron_latency_monitor` memory note)
- Cross-browser sweep — Safari + Firefox + Chrome on motion layer + map

**New files:** `src/components/library/MobileLibrary.jsx`

**Modify:** `tests/audit-ui.spec.js`, `src/components/MobileGate.jsx`, `src/pages/Library.jsx`, `playwright.config.js`

---

## 5 · Sequencing dependencies

- **Phase 0 before everything** — gate every other phase (✅ shipped)
- **Phase 1 before Phase 2C** — `:rerun` verb depends on Cmd-K parser
- **Phase 2A before 2B/2C** — view-mode infrastructure first
- **Phase 3 before Phase 4** — a11y semantics before motion adds visual layers
- **Phase 5 after Phase 2** — Landing borrows from polished Library components
- **Phase 6 always last** — verification scaffolding closes the loop

## 6 · Cross-phase risks (call-outs)

1. **Library refactor scope** — Library.jsx is large + central. Sub-waves (2A→2B→2C) each independently deployable. Never ship in half-state
2. **Map performance** — clustering strategy tested with 200-project synthetic fixture before 2B merges
3. **`saved_comparisons` migration** — FILE written, Aden applies per CLAUDE.md §1.1. Probe script for post-apply verification
4. **PDF export memory** — `@react-pdf/renderer` is heavy. Lazy-load only on click
5. **Cmd-K syntax discoverability** — `:help` + recent-actions footer ship together in Phase 1; not optional
6. **Mobile gate softening** — exposed features must actually be good or it backfires

---

## 7 · Design vocabulary (compressed reference)

> Full version: `docs/design-vocabulary.md`. This is the essentials.

### Typography — three voices, no more
- Display / card titles: **`font-serif`** (system serif)
- Mono eyebrows / chrome: **`JetBrains Mono`** (with ui-monospace fallback)
- Body / data: **system sans**

Use the `.eyebrow-mono` utility from `src/index.css` for every eyebrow. Responsive — 8px tracking-[0.18em] under md, 9px tracking-[0.24em] at ≥md.

### Color — 5 hues + neutrals
- **Teal** `#0F766E` `#14B8A6` `#5EEAD4` (brand primary, Offtake)
- **Navy** `#0F1A2E` `#0A132A` (display ink, masthead)
- **Amber** `#D97706` `#B45309` `#92400E` (IX pillar, severity scale)
- **Blue** `#2563EB` (Site pillar)
- **Red** `#DC2626` (critical / FEOC)

80% neutrals, 15% accent rails, 5% expressive. **Never use green for good.**

### Severity scale (monotonic across amber family)
- Calm / Healthy: `#92400E`
- Caution / Mid: `#D97706`
- Warning / Severe: `#B45309`
- Critical: `#DC2626`

### Motion vocabulary — 5 primitives shipped (Phase 0)
- `<PageTransition>` (fade + 8px slide, 220ms)
- `<RevealOnScroll>` (12px lift, 380ms)
- `<HoverLift>` (-2px + shadow, 180ms)
- `<CountUp>` (RAF, ease-out cubic)
- `<GaugeFill>` (dashoffset, 900ms)

Easing: `[0.16, 1, 0.3, 1]` for entrances, `[0.22, 1, 0.36, 1]` for fills. **Never bounce.**

### Spatial composition
- **§ N section markers** are monotonic. Don't insert § 4.5; renumber instead
- Sub-elements within § N share that § number's identity
- `<SectionDivider>` separates § N from § N+1; margin alone isn't enough
- Asymmetric 5:7 splits for hero panels with gauges
- Density through hierarchy (size/weight/tracking), not through removing whitespace

### Interaction grammar
- **Cmd-K is the spine.** Every repeated power-user action gets a verb
- Hover lifts on cards, not on every span
- Empty states name what's missing + what action would populate
- Every collapsible toggleable by Space/Enter
- Esc closes any modal or palette

### What's NOT Tractova (anti-patterns — reject in review)
❌ Purple → pink gradients · Glassmorphism · Neumorphism · Inter typeface · Space Grotesk · Green for "good" · Bounce easing · Card grids with 8+ visible cards (use Table) · Center-stacked hero with massive CTA · Loading spinners (use Skeleton) · Toast for critical info · AI-generated stock illustrations · Dropdowns that escape parent bounds

### Reference platforms (priority order for tie-breaks)
1. **Bloomberg Terminal** — keyboard density, color discipline, mono chrome
2. **Linear** — motion polish, transition timing
3. **Goldman GIR / Lazard publications** — editorial typography, § markers
4. **Vercel Dashboard** — gradient discipline (not the gradients themselves)
5. **Stripe Press** — typography respect, density-without-clutter
6. **Pitchbook / Crunchbase** — table density, deal-flow rows

### The unforgettable thing
**`:lens ME 5 CS`** — two keystrokes, Lens result lands with motion. Phases 1–6 all service this moment.

---

## 8 · Pickup — Resume after `/clear`

**Read these 3 files in this order:**
1. **This file** (`docs/TRACTOVA-UX-001-ROADMAP.md`) — status + plan
2. **`docs/design-vocabulary.md`** — aesthetic discipline
3. **`BUILD_LOG.md`** — most recent session entry (always SSOT for project state)

Plus the original plan file mirror at `~/.claude/plans/if-the-dsire-api-dreamy-anchor.md` if needed.

### Where we are
- **✅ Phase 0 shipped** (commit `cfce269`) — foundations + motion primitives + standardized collapsible
- **✅ Design vocabulary shipped** (commit `59a6b30`) — taste calibration doc
- **✅ Phase 1 shipped** — Cmd-K verb grammar (`commandParser.js` + 37 unit tests), verb-mode CommandPalette, `CmdKHint.jsx`, recents footer, `:compare` event-wired to CompareTray.
- **✅ Phase 2A + 2B shipped** — Library Table + Map (incl. ProjectDrawer, county-centroid pins, state-cluster > 200, pulse + halo gating). Five-pass audit cleanup landed alongside.
- **✅ Phase 2C shipped** — Saved Comparisons (migration 062 FILE — Aden applies), CompareReportPDF lazy-loaded, SavedComparisonsList Library tab, Cmd-K `:compare` enumerates saved + filters by name fragment, Re-run with latest data on every saved project (auto-kickoff + drift banner + Save-back), orphan-scenarios → projects conversion (Library handler + `lib/orphanConversion.js` helper).
- **🟢 NEXT: Phase 3** — Lens polish + accessibility. See § 4 Phase 3.

### Resume command
After `/clear`, tell Claude:

```
Resume TRACTOVA-UX-001 Phase 3. Read docs/TRACTOVA-UX-001-ROADMAP.md § 4 Phase 3,
then implement: hand-rolled save/confirm dialogs → Radix, CompareTray modal → Radix
Dialog, "✓ Saved" persistence in ScenarioStudio, aria-controls sweep, responsive
typography sweep (eyebrow-mono utility on inline mono-cap callouts). axe-core
target: 0 critical violations on Lens/Library/Profile/Glossary.
```

Claude will pick up exactly where this session ended.

### Phase 1 — Shipped (deliverables)

- `src/lib/commandParser.js` — verb grammar, pure data-in/data-out
- `tests/unit/commandParser.spec.js` — 37 cases (verb gate, prefix match, lens MW+tech, MA/MD/ME ambiguity, case-insensitivity, glossary/rerun/state/static-verb runners)
- `src/components/CommandPalette.jsx` — extended with verb-mode rendering, mono `:>` prompt indicator in verb mode (vs magnifier icon in fuzzy mode), top-bar accent swap (teal → navy), Bloomberg-style status-line hint/error banner with left-bar accent, recents footer, Tab-autocomplete, Cmd+Enter new-tab, `:compare` action dispatches `tractova:open-compare`
- `src/components/CmdKHint.jsx` — bottom-right floating ⌘K chip, idle fade to 32% after 5s, platform-aware label (⌘K / Ctrl K / TAP), auth-gated
- `src/components/CompareTray.jsx` — listens for `tractova:open-compare` and opens its modal if items > 0
- `src/App.jsx` — mounts `<CmdKHint />`
- `src/components/Nav.jsx` — unchanged (existing 2px teal `border-bottom` already satisfies the §-style underline spec)

**Verification at Phase 1 close:**
- `npm run test:unit` — 127/127 green (90 prior + 37 new)
- `npm run build` — clean (1.55s)
- `npm run test:smoke` — 7/7 green
- `npm run lint:api / lint:secrets / lint:locs` — all clean

---

## 9 · Living tracking — phase status

| Phase | Status | Commit(s) | Notes |
|---|---|---|---|
| 0 — Foundations + motion primitives | ✅ Shipped | `cfce269` | + design doc `59a6b30` |
| 1 — Cmd-K nav spine | ✅ Shipped | (this commit) | parser + tests + CmdKHint + verb-mode palette |
| 2A — Library Table view | ✅ Shipped | (prior commits) | Slice 1: view-mode toggle + Bloomberg Table + bulk-select earlier. Slice 2: StagePicker → Radix Popover + client-side pagination (10/25/50/100, `?all=1` escape) + persistent chips banner. |
| 2B — Library Map view | ✅ Shipped | `0e5cdfa` + map QA passes through 2026-05-12 | LibraryMap (MW-weighted choropleth + county-centroid pins + state-cluster >200, with SMIL pulse + navy-glow contrast). ProjectDrawer right slide-in (480px, Radix Dialog). Single-click filters, double-click filters + Table. Esc clears. Flicker on zoom/scroll fixed 2026-05-12 (SVG filter removed, gradient backdrop simplified, transition-colors only, GPU layer promotion). |
| Audit cleanup — 5 passes | ✅ Shipped | `277cee4` + `b309e8e` + `f186f2a` + `fa02fbe` + `f397340` (2026-05-12) | UI/UX + perf audits closed: brand vocab (Inter, green-for-good, glassmorphism, violet), perf wins (lazy LibraryMap −27 KB gzip on Library, glossary split), animation discipline (useSpring → cubic), structural (Radix dropdown, sticky-stack, valid HTML), Phase 2C `?fromProject=` prereq + focus rings. |
| 2C — Saved compare + PDF + Re-run + Scenarios→Projects | ✅ Shipped | (this commit) | Migration 062 FILE + savedComparisons lib + CompareReportPDF + SavedComparisonsList tab + Cmd-K saved-comp surface + drift banner + Save-back + orphan→project |
| 3 — Lens polish + a11y | ⏳ Queued | — | ~10–14h |
| 4 — Motion layer rollout | ⏳ Queued | — | ~8–12h |
| 5 — Cross-surface coherence | ⏳ Queued | — | ~10–14h |
| 6 — Polish + audit-ui hardening | ⏳ Queued | — | ~6–10h |

**As phases ship, update this table with commit refs.** This is the canonical "where are we" view.

## 10 · Out of scope (deferred)

- Native mobile app (Tractova stays web-only)
- Real-time collaboration / shared cursors
- Custom domain whitelisting per user
- AI-generated UI variants
- Internationalization (en-US stays the standard)
- A persistent left sidebar (Cmd-K replaces it by design choice)

---

## Quick file map

```
Tractova/
├── BUILD_LOG.md                          ← chronological session log (SSOT)
├── CLAUDE.md                             ← safety net + protocols
├── docs/
│   ├── TRACTOVA-UX-001-ROADMAP.md        ← THIS FILE (overhaul roadmap)
│   ├── design-vocabulary.md              ← aesthetic taste calibration
│   ├── architecture.md
│   ├── DATA_SOURCES.md
│   ├── data-trust-audit.md
│   ├── secrets-manifest.md
│   └── ...
├── src/components/
│   ├── motion/                           ← Phase 0 motion primitives
│   │   ├── MotionPrimitives.jsx          (PageTransition, RevealOnScroll, HoverLift, CountUp, GaugeFill)
│   │   └── Skeleton.jsx                  (branded loading states)
│   ├── CollapsibleCard.jsx               ← heavy collapsible (3 main pillar cards)
│   ├── CollapsibleSubsection.jsx         ← lightweight collapsible (Phase 0)
│   ├── LensComparablesSection.jsx        ← § 05 wrapper
│   ├── LensPolicyClimateSection.jsx      ← § 04 shadow pillar
│   └── CommandPalette.jsx                ← Phase 1 extends this
└── ~/.claude/plans/if-the-dsire-api-dreamy-anchor.md   ← mirror of this plan (local)
```
