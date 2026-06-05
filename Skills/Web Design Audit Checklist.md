# 🔍 Web Design Audit Checklist

**Skill Name:** `web-design-audit`
**Trigger:** When auditing or building any Tractova surface (Home, Analytics, Markets & Policy, Lens, Glossary, Library) — or when Aden says "audit the page / continue the audit / design pass / a11y check."
**Purpose:** Run a first-principles UX/UI audit using the 20 web-design concepts every page should satisfy, and keep a running ledger so the dashboard audit carries forward into the Lens → Glossary → Library makeover.

> Source: distilled from *"Every Web Design Concept Explained in Under 13 Minutes."* The video gives the vocabulary; this file turns each concept into a concrete **check** (Concept → Question → Pass bar) and continues the live audit trail.
>
> **Honesty note (Tractova data tenet):** the video quotes WCAG contrast minimums loosely. The *correct* standard values are in #18. Where the video and the standard disagree, the standard wins.

---

## 🧭 How to run a pass

1. Pick the surface under audit (e.g. a Lens form, a ChartCard, the Home hero).
2. Walk the **20 checks** below in order.
3. Triage every finding: **P1** (real bug / broken behaviour) · **P2** (cleanup / polish) · **Proposal** (feature, not a defect) — same triage used on the dashboard pass.
4. Fix P1s, batch P2s, log Proposals. Append the result to the **Audit Ledger** at the bottom.
5. `npm run verify` (build + Playwright smoke) before any push for visible changes.

---

## 1️⃣ Foundations — what you're building

**1 · UX vs UI** — *feel vs look.* UX = how it is to use (navigation, getting what you came for). UI = how it looks (colour, type, buttons, layout). Restaurant analogy: UX is the service, UI is the decor + menu. Both matter; not the same.
→ **Check:** tag each finding as a UX defect (flow/behaviour) or UI defect (appearance). **Pass:** both layers pass independently.

**2 · Wireframe** — the black-and-white sketch of layout/structure before any visual design; decides where everything goes and how the page flows.
→ **Check:** for a new surface, is layout/flow settled before styling? **Pass:** the information architecture is intentional, not emergent.

**3 · Mock-up** — the wireframe with design applied (colour, typography, imagery); a static, non-interactive picture of the final look.
→ **Check:** the still reads as finished and on-brand. **Pass:** colours/type/imagery are resolved before wiring interactions.

**4 · Prototype** — the clickable, interactive version; you navigate, click buttons, simulate the real experience before building. (Figma/InVision; AI tools now compress wireframe→mock→prototype.)
→ **Check:** every interactive element does the *one* thing its affordance promises (toggles, expand/collapse, filters). This is where the dashboard P1s lived. **Pass:** no surprising interaction behaviour.

---

## 2️⃣ On-page concepts

**5 · Above the fold** — everything visible before scrolling; the most valuable real estate. Decides whether people stay or leave.
→ **Check:** does the first viewport (desktop AND mobile) earn the scroll? **Pass:** a first-timer isn't lost in the first screen.

**6 · Hero section** — the large, prominent first section (usually full-screen, usually above the fold): headline, sub-headline, image/video, CTA. Must answer in 3 seconds: **What is this? Who is it for? Why should I care?**
→ **Check:** Home/Landing hero carries headline + sub-head + a clear next step. **Pass:** the next action is obvious without scrolling past the hero.

**7 · Call to action (CTA)** — every page prompts one specific action. Weak = "click here / learn more." Strong = tells the user exactly what they get ("Run a Lens", "Get your free strategy call").
→ **Check:** every page/section has a specific CTA **and it actually works** (the dashboard "View all" was a *dead* CTA → P1; now routes to `?tab=markets`). **Pass:** specific label + no no-ops.

**8 · Visual hierarchy** — size, colour, contrast, spacing, position tell the eye what matters. Headline most dominant, fine print least. *"If everything is loud, nothing stands out."*
→ **Check:** the most important element is visually dominant; the least is quietest. **Pass:** squint at the page and you still know where to look first.

**9 · White space** — intentional empty space around/between elements. **Not** wasted space — it improves readability and reads premium. Cheap sites cram; premium sites breathe. Cluttered? Add space.
→ **Check:** dense surfaces (coverage tracker, dense policy feed) aren't crammed. **Pass:** spacing is deliberate and consistent (8px rhythm).

**10 · Typography hierarchy** — H1 (page title/context) → H2 (section heads) → H3 (subsections) → body. Bad hierarchy makes everything one weight = unreadable = bounce.
→ **Check:** heading levels reflect real importance, not styling; one logical H1; no skipped levels. (Also a11y — see #17.) **Pass:** readable at a glance.

---

## 3️⃣ Responsiveness & performance

**11 · Responsive design** — adapts to desktop / tablet / mobile (rearrange, resize, reformat). >60% of traffic is mobile (2026). Non-negotiable.
→ **Check:** test every surface at mobile width, not just desktop. **Pass:** no horizontal scroll, no clipped charts/tables, usable tap targets.

**12 · Mobile-first design** — design for the phone first, then scale up. Forces prioritising only what matters; Google indexes mobile first (SEO impact).
→ **Check:** when building new (Lens makeover), start from the mobile constraint. **Pass:** mobile isn't an afterthought-degradation of desktop.

**13 · Grid system** — invisible 12-column framework keeping content aligned (the lined paper under the tracing paper). Most platforms use 12 columns.
→ **Check:** bento layouts snap to the 12-col grid; no eyeballed one-off offsets. **Pass:** everything lines up to a shared grid.

**16 · Loading speed** — every 1s delay ≈ **−7% conversions**; also an SEO factor. Culprits: uncompressed images, too many plugins, heavy code.
→ **Check:** bundle size, image weight, avoidable re-renders/re-inits (we removed a dead `topStateCoords` that forced a globe re-init). **Pass:** no avoidable churn; assets compressed. *(Proposal on file: a CI bundle-size guard.)*

---

## 4️⃣ Measurement — did it work

**14 · Bounce rate** — % who land and leave without interacting. High = page isn't doing its job. Caveat: single-purpose pages (blog/landing) legitimately bounce 70–90%; a homepage >80% is a red flag.
→ **Check:** judge a surface against its *job*, not a universal number. **Pass:** bounce expectation matches the page type.

**15 · Conversion rate** — % who take the intended action. `conversions / visitors × 100`. ~2–3% decent; 10%+ for focused landers / free sign-ups.
→ **Check:** each surface has a defined conversion action and a clear path to it. **Pass:** the intended action is unambiguous and unobstructed.

---

## 5️⃣ Trust, access & brand

**17 · Accessibility** — usable by people with visual / auditory / motor / cognitive disabilities; increasingly a legal requirement. Practical: alt text (screen readers), sufficient contrast, keyboard-navigable menus, logical heading order (#10).
→ **Check:** alt text present; sane focus order; keyboard-operable; no `cursor: not-allowed` dead-ends (we removed stop-sign cursors). **Pass:** a keyboard-only + screen-reader user can complete the core flow. *(Proposal on file: add `eslint-plugin-jsx-a11y` — deferred as a deliberate follow-up, not a drive-by install.)*

**18 · Colour theory & contrast** — colours communicate (blue→trust, red→urgency, green→health/money); contrast = readability. High contrast (white on dark) reads easily; low contrast strains the eye.
**WCAG (authoritative — overrides the video's loose numbers):**
- **AA:** 4.5:1 normal text · 3:1 large text (≥18pt / 14pt bold) & UI components.
- **AAA:** 7:1 normal text · 4.5:1 large text.
→ **Check:** measure contrast of text and meaningful UI (active chips, borders). The Analytics active-chip fix — a teal border because `bg == border` left no contrast — is exactly this. **Pass:** all text meets AA; aim AAA where cheap.

**19 · Social proof** — testimonials, reviews, client logos, case studies, trust badges, awards. One of the highest-leverage homepage additions; people buy what others trust.
→ **Check:** public/marketing surfaces carry credible, truthful proof. **Tractova caveat:** never name Nexamp/Ameresco — describe Aden's background by function only. **Pass:** trust signals present and honest.

**20 · Landing page vs homepage** — homepage = front door, for everyone, whole brand. Landing page = one action, one audience, no nav, no distractions. Send ad traffic to landers, never the homepage.
→ **Check:** don't overload the homepage with a single-audience pitch; build focused landers per action/audience. **Pass:** each page has one job and the chrome matches it.

---

## ✅ Quick scorecard (copy per surface)

| # | Concept | UX/UI | ✓/✗ | Note |
|---|---------|-------|-----|------|
| 5 | Above the fold | UX | ⬜ | |
| 6 | Hero answers what/who/why | UX/UI | ⬜ | |
| 7 | CTA specific + working | UX | ⬜ | no dead CTAs |
| 8 | Visual hierarchy | UI | ⬜ | one dominant element |
| 9 | White space | UI | ⬜ | not crammed |
| 10 | Type hierarchy | UI/a11y | ⬜ | one H1, no skipped levels |
| 11 | Responsive | UX | ⬜ | test mobile width |
| 13 | Grid alignment | UI | ⬜ | snaps to 12-col |
| 16 | Loading speed | UX | ⬜ | no dead re-inits |
| 17 | Accessibility | UX | ⬜ | alt / keyboard / focus |
| 18 | Contrast (AA ≥4.5:1) | UI/a11y | ⬜ | borders + text |
| 4 | Interactions behave | UX | ⬜ | toggles do one thing |

---

## 📒 Audit Ledger (living trail)

### Pass 1 — Dashboard (Home / Analytics / Markets & Policy) — 2026-05-31 — ✅ CLOSED

**P1 (real bugs) — all fixed:**
- **Dead "View all" CTA** → Home Intelligence Feed now navigates to Markets & Policy (`?tab=markets`) where the full paginated feed lives. No more no-op. *(#7)*
- **Radar first-click** → clicking a pre-selected chip now removes it; toggle bases on the effective active selection, not the empty initial `selected`. *(#4)*
- **KPI card collapse-on-click** → clicking inside an expanded reveal no longer closes the card; only the header/number/sparkline toggles. Tooltip updates ("Click the header to collapse."). *(#4 / #8)*
- **SortableTable crash guard** → `toggleSort` no longer dereferences `rows[0]` on an empty table; dead branch removed. *(#4)*

**P2 (cleanup / efficiency) — fixed:**
- **Globe** — removed dead `topStateCoords` (forced a re-init when state data loaded) + its unused `useMemo` import. *(#16)*
- **Projects-dot tooltip** — MW now rounded (cross-chart consistency). *(unify/standardize)*
- **Analytics filter chips** — active chip gets a teal border (was `bg == border`, no contrast). *(#18)*

**Intentionally left (proposals, not defects):**
- ChartCard's unused collapsible path — a legitimate optional API on shared chrome; not worth the risk to rip out.
- Bigger UX features — URL/localStorage view persistence · unified cross-surface filter context · Skeleton standardisation.
- Plugin installs — `eslint-plugin-jsx-a11y` + a CI bundle-size guard; both surface a backlog to triage → deliberate follow-up, not a drive-by install. *(#17, #16)*

**Outcome:** dashboard audited and clean across all three sub-tabs — no known bugs.

### Pass 2 — Landing page (`src/pages/Landing.jsx`, 1019 lines) — 2026-05-31

Anon marketing front door. Sections: (1) dark hero w/ live `DashboardPreview` card · (2) 12-source `.gov` marquee · (3) 5-pillar Radix tabs + live stat counters · (4) bento: Compare slider + "120×" card + built-for/not-for + 3 steps + mid-CTA · (5) FAQ + sidebar · (6) Lamp final CTA. Auth-aware throughout (signed-in vs anon branches).

> **Process note:** an earlier draft of this entry listed fabricated findings ("1,200+ data points", "Join the developers/investors" copy, an auto-rotating carousel) drafted against a misread of the file before it was actually read. None exist in the real file. Corrected below. (Hallucination-guard failure — logged so it isn't repeated.)

**✅ Passes (genuinely good — including model behaviour to keep):**
- **#10 Type hierarchy** — exactly one semantic `<h1>` (hero); the final-CTA headline is `<h2 class="lp-h1">` (styled big, semantically h2). Sections h2, cards h3. Clean.
- **#7 CTA** — every CTA is a real `<Link>`; no dead/no-op CTAs found. Auth-aware destinations (`/signup`·`/preview` anon, `/`·`/search` signed-in).
- **#19 Trust / data honesty — exemplary in two places:** (a) the **12-agency `.gov` source marquee** is strong authority proof; (b) the **"120×" stat is explicitly footnoted** "Tractova internal estimate… No published industry per-county benchmark exists" (`:756`, `:801-806`), and the Compare panel header was already softened `~4 hrs → ~½ day` for the same honesty reason (`:440-447`). This is the data tenet done right.
- **#4 Interactions** — FAQ accordion (`aria-expanded`, can close all), Compare hover-slider, Radix pillar tabs, live `DashboardPreview` w/ loading fallback — all behave.
- **Pillar counts are sourced** — `3143` US counties (verifiable), `12` NB states, `7` IX distribution-feed states (match the listed `NY·NJ·MA·VA·WI·CA·MD`), `4` IRA zones. Trace to real data, not invented.

**P2 / honesty — FIXED this pass:**
- **Hardcoded "Recent Policy Alerts" under a LIVE / "Updated weekly" frame** (`DashboardPreview`). Was: top-3 stats + top-states live, but the two alert rows (CEJA / Xcel) hardcoded under an "Updated weekly" label. → **Wired live**: `Landing` now fetches `getNewsFeed(6)` (the same `news_feed` source the dashboard `IntelligenceFeedCard` uses), maps `category → tag`, shows newest 2; the two curated rows remain only as a loading/empty fallback (mirrors the existing `sampleStates` pattern). News fetch failure is non-fatal — preview falls back, hero error banner stays gated on programs+metrics. "Updated weekly" is now honest. *(#19 / data honesty)*

**P2 — contrast MEASURED (`#18`, computed WCAG ratios via `.audit-contrast.mjs`, not eyeballed):**

| Token | On | Ratio | AA (4.5 norm / 3.0 large·UI) |
|---|---|---|---|
| `text-gray-400` #9CA3AF | white / paper `#fafaf7` | 2.54 / 2.39 | **FAIL** |
| `text-gray-500` #6B7280 | white / paper | 4.83 / 4.56 | PASS |
| `text-gray-600` #4B5563 | white | 7.56 | PASS (AAA) |
| `text-white/65` | navy `#0F1A2E` / `#0A132A` | 7.90 / 8.12 | PASS |
| `text-white/55` | navy | 6.00 / 6.15 | PASS |
| `text-white/45` | navy | 4.44 / 4.47 | fail-norm / **ok-large·UI** |
| `text-white/40` | navy | 3.80 | fail-norm / **ok-large·UI** |
| `text-white/30` | navy | 2.70 | **FAIL** |
| `text-white/25` | navy | 2.25 | **FAIL** |

→ Net: the dark-ground muted text is in better shape than feared (`white/55`+ all PASS; `/45`–`/40` ok for large/decorative). The clear failures are **`text-gray-400` on light grounds** (body captions — marquee subs `:288`, etc.) and **`text-white/30`–`/25`** (very-faint meta like the `tractova.com` URL `:90`).
→ **Recommended swaps (not yet applied — user opted to *measure* first per the question text):** `text-gray-400` → `text-gray-500` wherever it's *readable* body text (keep gray-400 only for `·` separators / dots / genuinely decorative); leave `/30`–`/25` only on truly decorative chrome. A focused restyle is the right follow-up — it touches the deliberately-muted palette, so do it intentionally, not as a drive-by.

**Proposals — partly actioned:**
- **Decorative inline SVGs** (`IconCheck`, CTA arrow, FAQ ±, ✕) — **FIXED**: added `aria-hidden="true"`. *(#17)*
- **CTA label drift** — **FIXED**: final-CTA "Create your free account" → "Get started free"; now consistent with hero/mid ("Get started free") and the global nav ("Get started"). *(#7 / unify)*
- **Marquee agency full-names hover-only** (`AnimatedTooltip`) — left: abbreviations + visible `sub` text carry meaning; low priority. *(#17)*
- **Main bundle 1,024 kB** (266 kB gzip) trips the 600 kB warning — pre-existing, covered by the on-file "CI bundle-size guard" proposal. *(#16)*

**No P1s found.** No broken behaviour, no dead CTAs, no fabricated numbers in the live file.

**Verify:** `npm run build` ✓ clean (live-alerts + CTA + aria-hidden edits compile).

### Pass 3 — Lens → Glossary → Library makeover — 🔵 IN PROGRESS (Lens)

Carry the dashboard's polish/skill language across (ChartCard meld, SortableTable, AnimatedList, CountUp, HoverBorderGradient, tasteful motion). Run all 20 checks on each surface as it's reworked, **mobile-first (#12)**, and append findings here.
Pre-decided proposals to revisit during this phase: view persistence (URL/localStorage) · unified filter context · Skeleton standardisation · `eslint-plugin-jsx-a11y` · CI bundle-size guard.

**Lens — wave-based (sequence: correctness → microinteractions → mobile). Each wave verify-green + pushed.**

- **Wave 1 — polish primitives (commit `e43b9b1`):** "Run Lens Analysis" CTA melded with the dashboard Run-a-Lens language (teal gradient + glow + `HoverBorderGradient` sheen, only when `isFormValid && !analyzing`). *(#7)* · Verified `CountUp` was already satisfied by `ArcGauge`/`SubScoreBar` (same `[0.22,1,0.36,1]` curve) — left untouched, no churn. · Removed a duplicated `focus-within:ring` on the MW field.
- **Wave 2 — section/meld unification (commit `96438d7`):** the four single-panel sections had drifted (§01/§02 top rail · §03 plain · §04 left-3px border). Extracted one canonical `src/components/ui/TealRail.jsx` and applied it across §01–§04 so they share the dashboard tiles' card DNA. §05 grid / §06 regulatory-watch left (multi-part, not single panels). *(#8 hierarchy / unify)*
- **Wave 3 — correctness & a11y (this commit):**
  - **#17 a11y — `aria-hidden` on decorative icons:** Search.jsx 16/16, MarketPositionPanel 3/3, MarketIntelligenceSummary 1/1 (were 0). Pillar-card shells are real `<button>`s (`SummaryShell`) → keyboard-operable; CollapsibleSection headers are buttons too. No `cursor:not-allowed` dead-ends on the Lens.
  - **#18 contrast — `text-gray-400`→`gray-500`** (gray-400 on white = 2.54:1, **fails AA** per Pass 2): swapped 6 readable instances in Search.jsx + 2 in PaletteLensForm + 3 column headers in StructureComparison. **Left** the 3 `·` separator dots (decorative) and the gated/"not modeled" StructureComparison row (intentional disabled affordance — WCAG exempts inactive UI, and it carries an explicit "not modeled" label).
  - **#10 type hierarchy — PASS:** Search.jsx = 1×h1, 2×h2, 2×h3; no skipped levels.
- **Wave 4 — microinteractions — ✅ DONE (commits `17ec147` 4a, `+4b`).** All reduced-motion-safe.
  - **4a:** (a) pillar cards — stronger hover-lift + teal border/glow on `SummaryShell`. (b) §05 grid staggers in on expand — `AnimatedList` gained an `itemAs` prop so it wraps a card grid with valid markup. (e) `AddToCompareButton` morphs to a check + "Added" on the false→true edge. (g) new reusable `ui/CopyButton.jsx` → Run-ID copies with inline "Copied" feedback.
  - **4b:** (c) `lens/LensSectionRail.jsx` — fixed scrollspy dots (§01–§05) at the right gutter (xl+), IntersectionObserver-driven active highlight, click-to-jump (sections got `id`s + `scroll-mt-24`). (d) `lens/StickyQueryBar.jsx` — once the form scrolls out, a bar slides in under the nav (top-14) with the query summary + Edit↑ + Re-run (`formRef.requestSubmit()`).
  - Reusable primitives created for Glossary/Library reuse: `CopyButton`, `AnimatedList` (`itemAs`), and the rail/sticky-bar patterns.
- **Wave 5 — mobile-first responsive (#11/#12) — ✅ DONE (code-level; build-verified, NOT screenshot-verified — Pro-gated).** Form fields `grid-cols-2`→`grid-cols-1 sm:grid-cols-2 md:grid-cols-3` (the long-label selects "System Architecture"/"Monetization Structure" get full width on phones). Results header `flex`→`flex-col sm:flex-row` so the title stacks above the action buttons on mobile; action-button row `flex-wrap`. `StructureComparison` header strip `flex-wrap` so the `state · MW · PV` meta wraps below the title instead of pinching. Already-mobile-first + left as-is: pillar grid (`grid-cols-1` base), MarketPositionPanel (`grid-cols-1 md:grid-cols-12`), RunIdMasthead (`flex-wrap`), CollapsibleSection sublabel (`hidden sm:inline`), the new rail (`hidden xl:`).

- **Wave 6 — prod-review redesign (2026-06-03, commits `c430c96`→`d00ba12`).** From Aden's prod screenshots. North star: **each section fits one viewport at 100%** (he felt 100% too large / "better at ~85%"). NOT YET visually verified by Aden.
  - **Fix:** §03 Levers dropdowns were clipped by Wave 2's `overflow-hidden` — `TealRail` now self-clips (`rounded-t-[inherit]`), dropped the overflow-hidden. (`c430c96`)
  - **6a:** Comparables→§06, Regulatory→§07 (labels + rail; rail self-hides dots for gated sections not in DOM). §01 density pass (py-7→py-5, headline 34→28px) as the calibration reference. (`66a1f85`)
  - **6b:** §03 Dev Feasibility de-dup — stripped the duplicate 5-pillar grid (dup'd §05 + the verdict's own readout); §03 = lean Verdict + Levers. −258 lines. (`92b6cb8`)
  - **6c:** §02 Analyst Brief drill-downs (4 stacked accordions) → one tabbed panel via shared `ui/Tabs`; density-tightened. `BriefDrilldown.jsx` now orphaned (git-rm deny-listed; left as dead code). (`2e6e4ad`)
  - **6d:** new reusable `ui/SpotlightCard` (cursor-follow glow, light-surface retune of the skill, reduced-motion-safe) on the §03 Verdict tile + §01 Policy&Timing alert (the two "bland" elements). (`d00ba12`)
  - **6e (`6653344`):** §04 Structure Comparison density cuts (header/column/row padding — already a tight table) + §05 pillar-card height 150→134 / py-3.5→py-3 (same ratio as §01–§03). Masthead left (already thin).
  - **⏭ OPEN:** §01 white-space fill (Aden undecided — density done, layout fill not). Needs his prod read on the density level before it's locked.

**→ Lens Waves 1–6 done. Then: Glossary (Pass 4 below), Library (later) — carry the banked primitives (`CopyButton`, `AnimatedList(itemAs)`, `TealRail`, `SpotlightCard`, `ui/Tabs`, rail/sticky-bar).**

### Pass 4 — Glossary revamp — ✅ DONE (2026-06-04, commit `1c034b0`)

Public surface (screenshot-verifiable on prod, unlike the Pro-gated Lens). Plan: `.claude/plans/okay-do-the-full-smooth-chipmunk.md`.

- **IA (#20) — demoted from primary nav.** Glossary was a co-equal top-level tab among the daily tools; it's a *reference* surface, so it moved into the account dropdown's "Resources" group alongside **About** (which had no nav link at all). Primary nav = Dashboard / Lens / Library. Inline `GlossaryLabel` tooltips (26 files) + the route + ⌘K `:gloss` all unchanged.
- **Organization (#8 hierarchy, #5 above-fold):** flat list → **A–Z letter groups** + a fixed right-gutter **A–Z jump rail** (`GlossaryJumpRail`, adapted from `LensSectionRail`; IntersectionObserver active-highlight, xl+ only, self-hides absent letters). Every card stays in the DOM → deep-links + ⌘K intact.
- **Microinteractions (reduced-motion-safe):** hero `.lp-aurora` wash + `TealRail` + `MountReveal` text-reveal + `CountUp` term count · per-letter `AnimatedList` stagger · `SpotlightCard` cursor-glow + hover-lift + hover-only `TealRail` on cards · see-also hover-previews (`SeeAlsoLink` via shared `Tooltip`) · existing search match-highlight + copy feedback + deep-link flash kept.
- **#17 a11y:** decorative SVGs `aria-hidden`, search `aria-label`, real `<h2>` letter headings, rail `<nav aria-label>` + `aria-current`. **#11/#12 mobile:** rail hidden, single column, chips wrap. **#18:** aurora confined to hero; cards stay solid white (glow is faint, text contrast holds).
- New: `TealRail` gained an optional `className` (hover-fade on cards). 2 new components (`GlossaryJumpRail`, `SeeAlsoLink`). `BriefDrilldown.jsx` from Lens 6c still orphaned (git-rm deny-listed).
- **⏭ Aden:** prod eyeball (public URL). **Library = separate plan, later.**

### Pass 5 — Library revamp ("the big one") — 🔵 IN PROGRESS (2026-06-04)

Pro-gated daily-driver deal-tracker. Plan: `.claude/plans/idempotent-prancing-harp.md`. Unlike Glossary, Library is **feature-mature** (16 components, 3 layouts, 3 tabs) but **heavily accreted** (V3 + Phase 2A/2B/2C + Phase 4) and predates the Lens/Glossary motion bar. Aden's four-pain diagnosis → revamp = *workflow elevation* (CRM-lite cockpit) + *hard consolidation* + *visual pass*. Scope locked via Q&A: kanban board · follow-up dates · custom tags · saved views · desktop search · consolidate-hard. Wave-based, verify-green per slice.

**20-check findings (audit drives the wave plan):**
- **#9 White space / #8 hierarchy — the headline defect.** Five stacked blocks sit above the first project (stat strip → Pipeline Distribution → "Recent Updates" banner → `WeeklySummaryCard` → filter/sort strip). Three surface *overlapping* signals (counts / MW / alerts / what-changed). → **Wave 1** collapses them into one sticky command bar + one collapsible "Portfolio Intelligence" drawer.
- **#4 Interactions / weak-as-daily-tool.** Organising a deal stops at the 7-value `stage` enum + free-text notes; no custom labels, no "what's due", no recallable filter combos, no pipeline board. → **Waves 2–4** (tags, follow-up dates, kanban board, saved views).
- **#11/#12 Responsive.** Desktop has no text search (mobile does); the top stack is especially crammed at mobile width. → search added Wave 1; mobile-first sweep Wave 5.
- **#8 / unify — two score gauges** (`ScoreGauge` large + `MiniArcGauge` 44×44) and a bespoke `WeeklySummaryCard` animation set (`health-grid`/`health-scan`/`health-ring` keyframes) never unified with the banked motion vocabulary. → **Wave 5** parametric-unifies the gauges + applies `SpotlightCard`/`TealRail`/`AnimatedList`.
- **#18 contrast / palette.** Stray hardcoded color triples in `ProjectCard` (legacy rgba vs canonical teal-700) — already partly consolidated (V3.1 note in-file); finish in Wave 5.
- **#16 loading speed — PASS (keep).** Map + Table already lazy-split; gauges use `motion.js` `animate()` not RAF loops. Don't regress this when adding the board.
- **#17 a11y — carry the bar.** Existing cards are keyboard-operable (role=button headers, Radix dialogs/popovers). New board DnD needs a keyboard path (stage dropdown fallback) + the new controls need `aria-label`s.

**Schema (Wave 0, migration FILES — Aden applies; all reads null-safe):** `073` projects.tags text[] · `074` projects.follow_up_at + follow_up_note · `075` saved_views table (mirrors `saved_comparisons` 062 RLS). projects UPDATE policy (072) is column-agnostic → no policy change for the new columns.

- **Wave 0 — ✅ migrations 073/074/075 written; `normalize()` extended (tags/followUpAt/followUpNote, null-safe); this ledger entry opened.**
- **⏭ Waves 1–5** per plan. Carry banked primitives (`SpotlightCard`, `TealRail`, `AnimatedList(itemAs)`, `CopyButton`, `ui/Tabs`, scrollspy-rail/sticky-bar). `BriefDrilldown.jsx` orphan still carried.

---

## 🛡️ Tractova guardrails this skill respects

- **Data honesty is the product** — never fabricate numbers/sources; cite file:line.
- **Verify before push** — `npm run verify` for visible-feature changes; auto-push origin/main after.
- **Unify, don't duplicate** — one canonical source per value.
- **Glossary** — new industry terms in UI copy get a `glossaryDefinitions.js` entry + pillar registration.
- **No employer naming** on public surfaces (#19).
- **Design/colour** — professional intelligence-platform palette: teal primary, amber accent, slate data, data-first (#8, #18).
