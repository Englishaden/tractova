# Tractova V3 — Build Plan

> Reviewer: Opus 4.7 (high effort)
> Last updated: 2026-04-28 (end of Day 1 build)
> Supersedes: `Tractova_V2_Plan.md` for Phases 2-7. Phase 1 of V2 is shipped — no rework.
> Companion strategic critique: `~/.claude/plans/read-tractova-v3-prop-plan-md-file-functional-penguin.md`

---

## ⚡ Status Snapshot — Where We Left Off (2026-04-28 EOD)

**V2-Refactored Steps 0-5 + Step 6 + Step 7 (Sessions A & B) all SHIPPED to production.**
**V3 Wave 1 — Items 1.1 (queue history) + 1.2 (branded emails) SHIPPED.**

Latest commits on `origin/main`:
- `45d1e91` V3 Wave 1.1+1.2 — IX queue snapshots + V3-branded weekly digest & alert emails
- `e76e14e` Hybrid placeholder copy fix (Alaska/unseeded states)
- `eae38f1` Library follow-ups (alerts chip legibility, StagePicker dropdown clipping, pipeline labels)
- `1da46f6` Step 7 Session B — Glossary + Library + Admin V3 pass
- `9ea468e` ArcGauge spacing
- `c05f055` SubScoreBar overflow fix
- `4c7d903` Step 7 Session A — Lens form chrome + bug fixes + sensitivity-on-gauge architecture
- `2c1a048` Lens redesign (Editorial Intelligence)

**Action items pending — run in Supabase SQL editor:**
1. `010_alert_positive.sql` — enables Profile "good-news alerts" toggle persistence
2. `011_projects_columns_backfill.sql` — restores all Library columns (save handler self-heals via app-level fallback if not run)
3. `012_ix_queue_snapshots.sql` — enables IX queue history accumulation (foundational for V3 Wave 2 Forecaster)

**Surfaces are 100% V3-cohesive:** Dashboard, Lens (form + results), Library, Glossary, Profile, Compare, Sign-in/up, Upgrade, Landing, Admin, Email templates (digest + alerts).

### 🚀 Next-Session Pickup Options (priority-ranked)

**P1 — V3 Wave 1 remainder (recurring engagement):**
- **1.3 Slack alerts** — webhook-based push from existing alert engine. ~2h, no new functions (extend `send-alerts.js`).
- **1.4 Derived metrics** — IX Velocity Index + Program Saturation Index. Computed from `ix_queue_snapshots` once we have ≥4 weeks of data. Mostly query work; surfaces in Lens + Library. ~3-4h.
- **1.5 "Markets-on-the-move" digest section** — top 3 portfolio states with score deltas this week. Adds the V3 §3.6 enrichment to the now-V3-branded weekly email. ~2h.

**P2 — V3 deferred items from Step 7:**
- **7.9 Form component extraction** (Input/Select/Button) — structural debt cleanup. ~2h.
- **Lens Zone A/B/C/D structural refactor** — polish on already-working code. ~5-7h.
- **Deal Memo shareable URL** — token-based read-only memo links. Needs `share_tokens` table. ~3h.
- **Status thread audit log** — append-only project event log. Needs `project_events` table. ~3h.

**P3 — V3 Wave 2 (defensible data layer):**
- **IX Queue Forecaster** — needs ≥12 weekly snapshots (so realistically Q3 launch). When we get there: P50/P90 study completion modeling.
- Comparable Deals DB, PUC Docket Tracker MVP, Utility Outreach Kit.

---

---

## Context

V2 was authored by Opus 4.6 as a UX polish pass. Useful, but it confused polish with value: 28 of 32 line-items were layout/color/copy work; only 4 added new data or AI surface area. V2 had no data-moat strategy, no monetization decision, and stopped at the analysis (it never extends Tractova into the developer's actual workflow).

V3 builds on V2 but reorganizes around three principles:

1. **Decision cockpit, not research dump.** Every surface answers a question on first paint.
2. **Workflow artifacts, not just analysis.** The product produces things developers send to investors, utilities, and subscribers.
3. **Data moat first, polish second.** Snapshots, comparables, and derived metrics are reversible only one way (you can polish a UI in a week; you can't backfill 12 weeks of queue history).

Pricing is anchored to the **CS/Hybrid origination buyer at a 1-10 person shop** — not Aurora/ETB territory. Free / Pro $14.99 / Premium $39 (only when Wave 2 ships).

---

## What's Already Shipped (Verified through 2026-04-28)

### V2-Refactored — All Complete
- ✅ **Step 0** — V3 plan committed to repo (this file)
- ✅ **Step 1 (V2-A)** — Lens AI sensitivity action + signal cleanup + scenario quantification + form chrome navy + bug fixes + pillar order reflow + sensitivity-on-gauge architecture
- ✅ **Step 2 (V2-B)** — Dashboard tabbed StateDetailPanel (Program/Market/Subscribers/News) + 5-bucket teal choropleth + Market Pulse AI summary
- ✅ **Step 3 (V2-C)** — Library polish: Risk Concentration widget, pipeline filter-on-click, weeks-in-stage stale flag, CSV → 18 cols, Deal Memo Generator
- ✅ **Step 4 (V2-D)** — Profile two-column + good-news toggle + Glossary 10 platform terms
- ✅ **Step 5a/b/c** — Design tokens + brand rollout across Nav/Footer/MetricsBar/USMap + Library institutional depth + auth surface palette
- ✅ **Step 6** — Save-to-Library bug fix (migration 011 + app-level fallback) + Landing How-it-works connector + Lens theme rollout
- ✅ **Step 7 Session A** — Lens form chrome navy/teal, ArcGauge clipping fix, SubScoreBar overflow fix, methodology tooltip clamp, sensitivity scenarios moved to gauge surface, CustomScenarioBuilder rewired
- ✅ **Step 7 Session B** — Glossary full V3 revamp + Library legacy cleanup (filter bar, pipeline ramp, project card serifs) + Admin V3 pass
- ✅ **Step 7 Library follow-ups** — alerts chip legibility, StagePicker dropdown clipping fix, pipeline label readability
- ✅ **Hybrid placeholder copy** — distinguishes "MW missing" from "state has no seeded model"

### V3 Wave 1 — In Progress
- ✅ **1.1** IX queue history accumulation — migration 012 + cron append snapshots (foundational for Wave 2 Forecaster)
- ✅ **1.2** Weekly digest + policy alert emails — V3-branded with navy/teal, Source Serif 4 wordmark, JetBrains Mono numerics, portfolio meta strip
- ⬜ 1.3 Slack alert integration
- ⬜ 1.4 Derived metrics (IX Velocity Index, Program Saturation Index)
- ⬜ 1.5 "Markets-on-the-move" digest enrichment

### Pre-V3 Foundation (Verified shipped, not re-touched)
- V2 Phase 1 (tech reorder, automated freshness, ESC handlers, "Library" rename)
- Compare Tray "Best For" + "Open in Lens"
- Profile portfolio stats + alert preferences

---

## What's NOT Shipped (Deferred — see "Next-Session Pickup" above)

- **Lens Zone A/B/C/D structural refactor** — deferred polish on already-working code
- **Deal Memo shareable URL** — needs `share_tokens` table
- **Status thread audit log per project** — needs `project_events` table
- **XLSX export with formulas** — extra dependency, low ROI vs CSV
- **Form component extraction** (`src/components/ui/Input.jsx` etc.) — structural debt
- **V3 Wave 1.3-1.5** — Slack, derived metrics, briefing enrichment
- **V3 Wave 2** — Forecaster, Comparable Deals DB, PUC Docket Tracker, Utility Outreach Kit (waits on accumulated history)
- **V3 Wave 3** — Subscriber Acquisition Intel, Capital Stack Pre-Flight, Deal Calendar, Cmd-K
- **Mobile UI** — email + PDF responsive is sufficient for now

---

## V2-Refactored — 3-Week Build

### Step 0 — Write this plan ✅
Convert critique into `Tractova_V3_Plan.md` (this file). Source of truth.

### Step 5a — Design tokens (foundational, ~half day)
**File:** `tailwind.config.js`, optionally `src/index.css`

Add design tokens. Apply incrementally as each step touches a surface.

**Color tokens:**
```
paper:        #FAFAF7   (page background)
surface:      #FFFFFF   (card background)
ink:          #0A1828   (primary text)
ink-muted:    #5A6B7A   (secondary text)
border-subtle:#E2E8F0   (hairlines)
brand:        #0F1A2E   (deep navy — chrome, primary buttons)
accent:       #14B8A6   (teal — links, selected state, positive)
accent-deep:  #0F766E   (accent hover)
caution:      #F59E0B   (IX warnings, runway flags — reserved)
critical:     #DC2626   (urgent only)
success:      #059669   (positive deltas)
```

**Choropleth ramp** (5 buckets, single-hue, replaces V2 2A's 7-color attempt):
```
F0FDFA → 99F6E4 → 2DD4BF → 14B8A6 → 0F766E
```

**Typography:**
- Wordmark + display: **Source Serif 4** (load via Google Fonts)
- UI body: **Inter** (already loaded)
- Numerics: **JetBrains Mono** (load via Google Fonts) — apply via `font-mono` to KPI tiles, scores, MW values, dates

### Step 1 — V2-A: Lens Cockpit Refactor (5-7 days)
**Files:** `src/pages/Search.jsx`, `api/lens-insight.js`

Reorganize the Lens output into 4 zones:

**Zone A — Verdict (above the fold, ~320px tall):**
- Big numeric Feasibility Index + 3 sub-score bars
- One-line AI verdict (existing `brief` truncated to first sentence)
- Three CTAs: `Run sensitivity` | `Generate deal memo` (gated on Premium) | `Save to Library`

**Zone B — Three pillar cards in a collapsible row:**
- Headline KPI on the collapsed card. Examples:
  - Offtake collapsed: "Active program · 14-mo runway"
  - IX collapsed: "Hard · ~18 mo study"
  - Site collapsed: "Available land · low wetland risk"
- All three can expand simultaneously (NOT V2's accordion-only-one).
- Solves the "depth before breadth" issue.

**Zone C — Inline sensitivity (NOT a slide-over):**
- Side-by-side base/scenario score block. Toggle chips above.
- Custom builder always visible.
- Quantify each scenario in **$$ + months** (e.g., "Score impact: -8 pts | Est. cost +$425K | Timeline +8 mo").
- AI rationale inline, prefetched.

**Zone D — AI commentary (2-column grid, ALL 6 fields visible):**
- Don't accordion the differentiator. The 6 fields ARE what the user pays for.
- Eyebrow labels in `ink-muted`, body in `ink`.

**Cuts from current Lens:** redundant signal tiles flagged in V2 3C (verified low-info-density).

**New API action:** `action: 'sensitivity'` in `lens-insight.js` returning 1-2 sentence rationale per scenario. Sonnet 4.6, max_tokens 200.

### Step 2 — V2-B: Dashboard Tabbed Panel (4-5 days)
**Files:** `src/components/StateDetailPanel.jsx`, `src/components/USMap.jsx`, `src/components/NewsFeed.jsx`, `api/lens-insight.js`, `src/lib/programData.js`

**StateDetailPanel becomes 4 tabs:**
- **Program** — capacity, runway, eligibility, incentive widgets (V2 2B spec)
- **Market** — IX difficulty, serving utilities, sub-score bars
- **Subscribers** — LMI density (Census ACS), CCA penetration, CBO partners (V3 new — ship empty placeholder + populate as data lands in Wave 1/2)
- **News** — existing filtered news + cached AI summary

**USMap fixes:**
- Apply 5-bucket teal ramp (replaces current scheme)
- Fix `getStateColor()` thresholds vs legend label mismatch (real bug)
- Legend: 5 swatches with numeric ranges

**New API action:** `action: 'news-summary'` returning 2-3 sentence per-state summary. Cached at state level for 24h via Supabase or in-memory cache. One call serves all viewers per day.

**Markets-on-the-move strip** above the map: top 3 states with score deltas this week (auto-derived).

### Step 3 — V2-C: Library Polish + Deal Memo (6-8 days)
**Files:** `src/pages/Library.jsx`, `src/components/ProjectPDFExport.jsx`, `api/lens-insight.js`, new `src/lib/dealMemo.js`

**Portfolio Intelligence cleanup:**
- Drop Avg Score widget (verified mathematically redundant with Health gauge)
- Drop Risk Spread widget (low value — Health already conveys this)
- Add **Portfolio Risk Concentration** widget: % of portfolio MW exposed to single utility / single program / single state

**Pipeline distribution:**
- Click-to-filter
- Add "weeks-in-stage" indicator — projects stuck in Pre-Development for 8+ months get a stale flag

**Deal Memo Generator (the big one):**
- New API action: `action: 'deal-memo'` returns structured JSON: `{ opportunity, threePillarDiligence: {site, ix, offtake}, revenueProjection, topRisks: [...], next30Days }`
- Sonnet 4.6 for V2-Refactored. Reserve Opus 4.7 for future Premium.
- Generate as 2-page PDF via existing `ProjectPDFExport.jsx` pipeline + new `src/lib/dealMemo.js` for JSON-to-PDF mapping
- **Shareable read-only URL** — token-based, no auth required (existing `share_tokens` pattern if it exists, or new table)

**CSV expansion to 18 cols** (V2 4F spec) + new XLSX export with NPV/payback formulas preserved.

**Status thread** per project — append-only audit log of stage changes, score changes, alert triggers. New table `project_events`.

### Step 4 — V2-D: Profile + Glossary cleanup (1-2 days)
**Files:** `src/pages/Profile.jsx`, `src/pages/Glossary.jsx`, possibly migration

- Fix toggle dot overflow at `Profile.jsx:122` — change `translate-x-4` on `w-9` to `translate-x-[18px]` or container to `w-10`
- Two-column layout: `max-w-2xl` + grid lg:grid-cols-2
- Third "positive events" toggle on `AlertPreferences` — wire to new `profiles.alert_positive` column (migration 010)
- Glossary additions: 7 V2 platform terms + 3 V3 terms (Deal Memo, Comparable Project, Subscriber Acquisition)
- **Cut V2 6C** — no Landing About section

### Step 5b — Brand rollout (interspersed with above)

Apply tokens surface-by-surface:
- Nav + Footer chrome
- MetricsBar dark-emerald → `brand` deep navy
- Wordmark in Nav: Source Serif 4
- All KPIs, scores, MW values: `font-mono`
- USMap choropleth ramp swap
- Card borders: `border-subtle`
- Page background: `paper`

---

## V3 Advanced (Post-V2-Refactored)

Only after V2-Refactored ships and at least 20-50 Pro users are paying.

### Wave 1 — Recurring engagement (4-6 weeks)
- Weekly Briefing Email (Monday 7am, via Resend)
- Slack alert integration
- IX queue history accumulation (stop overwriting — 1 PR)
- IX Velocity Index, Program Saturation Index (derived metrics)

### Wave 2 — Defensible data layer (8-10 weeks)
- IX Queue Forecaster (needs ≥12 weekly snapshots)
- Comparable Deals DB (anonymized; ISO IX + EIA Form 860)
- PUC Docket Tracker MVP
- Utility Outreach Kit (`action: 'utility-outreach'`)
- **Premium tier $39 launches when Wave 2 ships**

### Wave 3 — Workflow layer (8-12 weeks)
- Subscriber Acquisition Intelligence (LMI map + CBO directory)
- Capital Stack Pre-Flight
- Deal Calendar (iCal export)
- Cmd-K command palette
- Multi-county batch Lens

### Wave 4 — Enterprise hooks (when revenue justifies)
- API access, multi-seat, white-glove onboarding, CRM webhooks

---

## Infrastructure Constraints (Stay on Free Tiers)

- **Vercel Hobby (no upgrade).** Cap = 12 functions; current = 11/12. All new AI actions multiplex through `api/lens-insight.js` (existing pattern). Crons collapse via `?source=...` if a slot is ever needed.
- **Supabase Free** until ≥100 paying users.
- **Anthropic Sonnet 4.6** for everything in V2-Refactored + Wave 1. Opus 4.7 reserved for Premium-tier Deal Memo only.
- **Resend Free** (3K/mo) covers ~750 weekly briefings.

**Net infra cost increase: $0/mo.**

---

## Pricing (Locked)

| Tier | Price | Trigger |
|---|---|---|
| Free | $0 | Today |
| **Pro** | **$14.99/mo** ($149/yr) | Today |
| **Premium** | **$39/mo** ($390/yr) | Launch only when V3 Wave 2 ships, with ≥50 Pro users |

Add-on credits:
- **$9 Deal Memo pack** (3 memos) — converts free users via use-case
- **$19 deep-state report** — one-shot premium analysis without subscribing

No Enterprise tier until 200+ paying users.

**Unit economics at $14.99 Pro:** ~$1.20 COGS/user/mo → **~92% gross margin.**

---

## Design System (Locked Direction)

Positioning: Bloomberg Terminal × Linear × Stripe Docs. Cartographic, institutional, data-first. Reject the "solar = green leaves" cliché and the "consumer fintech bright" cliché.

See Step 5a above for tokens, ramp, fonts.

**Logo direction (for Claude Design refinement):**
- Wordmark "Tractova" in Source Serif 4 600, letter-spacing -0.02em, ink color
- Mark concept (recommended): **stylized parcel outline with corner marker** — a quadrilateral evoking a surveyed plot. Directly references *tractus* etymology.
- Alt concepts: T monogram with survey-baseline tick marks, or simplified compass rose

**UI motion:** functional only. No decorative animations. No parallax.

**Iconography:** Lucide.

---

## Verification

After each Step:
1. `npx vite build` clean
2. `ls api/*.js | wc -l` ≤ 12 (Hobby cap — should stay at 11)
3. Golden path: `IL/Will/5MW/Prospecting/Community Solar` — verify each modified surface
4. Edge case: `KS/Sedgwick/3MW/Site Control/Hybrid` — verify low-data placeholders don't break

Specific checks:
- Step 1: Lens cockpit zones render. Sensitivity AI rationale fires on toggle. Scenario shows $ + months.
- Step 2: All 4 tabs render in StateDetailPanel. Map color matches legend.
- Step 3: Generate Deal Memo → produces 2-page PDF → shareable URL works in incognito.
- Step 4: Profile toggle dot inside container. Two-col layout on ≥1024px.

After Wave 1:
- Receive Monday briefing email at 7am local — verify accuracy
- Slack alert fires on capacity drop within 5 min of cron

---

## Key Files

| File | Steps |
|---|---|
| `tailwind.config.js` | 5a |
| `src/pages/Search.jsx` | 1 |
| `src/components/StateDetailPanel.jsx` | 2 |
| `src/components/USMap.jsx` | 2, 5b |
| `src/components/NewsFeed.jsx` | 2 |
| `src/pages/Library.jsx` | 3 |
| `src/components/ProjectPDFExport.jsx` | 3 |
| `src/pages/Profile.jsx` | 4 |
| `src/pages/Glossary.jsx` | 4 |
| `src/components/Nav.jsx` | 5b |
| `src/components/MetricsBar.jsx` | 5b |
| `api/lens-insight.js` | 1, 2, 3 |
| `src/lib/programData.js` | 2 |
| `src/lib/dealMemo.js` (new) | 3 |

---

## Decision Log

1. Keep light theme on Library. V2's "war room" framing pulls product downmarket.
2. Keep all 6 AI fields visible. Don't accordion the differentiator.
3. Inline sensitivity, not slide-over. Context loss outweighs discoverability.
4. 5-bucket single-hue teal map. 7 buckets across 5 hues fail color theory.
5. PDF is a Deal One-Pager / IC Memo, not a "summary." It's a sales artifact.
6. Cut Landing About section.
7. Pricing: $14.99 Pro / $39 Premium-later. No Enterprise. Don't anchor to Aurora/ETB.
8. Specialized AI agents per task, not one monolithic call.
9. Ship the data moat (queue history + comparables) before the visual polish.
10. No mobile UI yet. Email + PDF responsive is enough.
11. Vercel Hobby + multiplex through `lens-insight.js`. No paid upgrades.
12. Sonnet 4.6 everywhere. Opus 4.7 reserved for Premium tier.
13. Brand: deep navy + teal + serif wordmark + JetBrains Mono numerics.
14. **Sensitivity scenarios on the gauge surface, not in the AI panel** — toggling updates the score in place; no scroll-up. Custom scenario popover drives the same lifted state.
15. **Editorial Intelligence aesthetic over "polished SaaS dashboard"** — Bloomberg/Linear/Stripe direction. Mono eyebrow → serif title → mono caption pattern across every surface. Drop-cap on AI commentary.
16. **Pillar order = reading order** — Offtake → IX → Site Control left-to-right (was Site → IX → Offtake). Maps to the actual decision sequence: viable market? → IX feasible? → site buildable?
17. **Migration `if not exists` lesson** — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for changes to existing tables. `CREATE TABLE IF NOT EXISTS` silently no-ops if the table exists, stranding column additions.
18. **Save handler is schema-cache-resilient** — detects PostgREST "column not found" errors and retries without that field. Decouples save UX from migration timing.
19. **Hybrid/C&I/BESS placeholder copy** distinguishes "MW missing" from "state not seeded" — names the gap honestly, signals it's a roadmap item.
20. **Append-only IX snapshots over upsert** — `ix_queue_data` stays as the "latest" UI table, `ix_queue_snapshots` accumulates history. The Wave 2 Forecaster needs ≥12 weeks of trajectory; cheapest data-moat investment in the plan.
