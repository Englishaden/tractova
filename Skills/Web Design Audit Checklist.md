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

### Pass 3 — Lens → Glossary → Library makeover — ⏭ QUEUED (next major phase)

Carry the dashboard's polish/skill language across (ChartCard meld, SortableTable, AnimatedList, CountUp, HoverBorderGradient, tasteful motion). Run all 20 checks on each surface as it's reworked, **mobile-first (#12)**, and append findings here.
Pre-decided proposals to revisit during this phase: view persistence (URL/localStorage) · unified filter context · Skeleton standardisation · `eslint-plugin-jsx-a11y` · CI bundle-size guard.

---

## 🛡️ Tractova guardrails this skill respects

- **Data honesty is the product** — never fabricate numbers/sources; cite file:line.
- **Verify before push** — `npm run verify` for visible-feature changes; auto-push origin/main after.
- **Unify, don't duplicate** — one canonical source per value.
- **Glossary** — new industry terms in UI copy get a `glossaryDefinitions.js` entry + pillar registration.
- **No employer naming** on public surfaces (#19).
- **Design/colour** — professional intelligence-platform palette: teal primary, amber accent, slate data, data-first (#8, #18).
