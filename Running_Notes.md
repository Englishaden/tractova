# Tractova — Build Queue

---

## Core Design Principle — Database-Ready Architecture

**Every UI/UX decision from this point forward must be designed to connect seamlessly to the live database (Iteration 5).**

This means:
- All data fields displayed in the UI must have a clear mapping to a future Supabase column or scraped field. Don't hardcode values that will later come from the DB without a clear swap-out path.
- Components that today consume `statePrograms.js` or `countyData.js` must be written so the data source can be swapped to a Supabase query without restructuring the component.
- Any new field added to the UI (e.g., runway months, IX ease score, LMI %, program notes) should be noted here alongside its intended future DB source so it's easy to wire up during Iteration 5.
- Enrollment rate, program capacity, and queue status data displayed as "estimated" / seeded today should render identically when sourced from the live `program_rules` table — the component shouldn't care where the data comes from.
- Design for AI-ready content zones in Market Intelligence — text areas should comfortably hold 2–3 sentences of richer AI-generated insight without layout changes when Claude API integration is added.

**Future DB field mapping (current seed → intended source):**
| UI Field | Current Source | Future Source |
|---|---|---|
| csStatus, csProgram, capacityMW | statePrograms.js | program_rules table |
| lmiRequired, lmiPercent | statePrograms.js | program_rules table |
| ixDifficulty, ixNotes | statePrograms.js | program_rules table (utility-level) |
| enrollmentRateMWPerMonth | statePrograms.js (seeded) | program_rules table |
| programNotes | statePrograms.js | program_rules table |
| siteControl, interconnection | countyData.js | county_data table |
| revenueStack | countyData.js | revenue_stack table |
| feasibilityScore | statePrograms.js (computed) | computed server-side from program_rules |

---

## ✅ Completed

- Priority 1: Tractova Lens — state context map on results
- Priority 2: Remove project confirmation dialog
- Priority 3: Search form visual redesign + field dropdown polish
- Priority 4: Glossary — 7 dev stages + 5 industry terms + Dev Stages filter
- Iteration 3a: Supabase project persistence (Library + Search save flow migrated from localStorage)
- Iteration 3b — Priority 1: Auth gating (Lens + Library behind auth; Glossary + Dashboard public)
- Iteration 3b — Priority 2: Data expansion to 18 states (countyData.js)
- Iteration 3b — Priority 3: Landing / marketing page (Landing.jsx)
- Iteration 4 — Stripe Pro subscription ($9.99/mo): checkout, portal, webhook, real-time tier sync
- Iteration 4 — Paywall on Lens + Library (UpgradePrompt + wrapper gate pattern)
- Iteration 4 — Alert badges on project cards (getAlerts, AlertChip, urgent/warning/info)
- Iteration 4 — Resend transactional email: weekly digest + policy alert emails via Vercel cron
- Iteration 4 — Glossary header redesign: dark teal gradient banner, amber glow, monospace decoration
- Iteration 4 — Library header redesign: Deal Tracker label, stat strip (projects, MW, alerts)
- Iteration 4 — Project cards: expandable inline panel with score arc gauge, pipeline progress bar, market intelligence, auto-saving notes field
- Iteration 4 — Dashboard: urgency tags on news feed, "Open in Lens" CTA in StateDetailPanel
- Session Apr 13: News feed pagination, StateDetailPanel CTA to header, ?state= query param, feasibilityScore rename, Comparison Tray, inline stage editing, structured note prompts, CSV export, Glossary related terms + anchor links
- Professional Tools — 1: Market Intelligence Summary (generateMarketSummary, verdict pill, signal chips, analyst sentence)
- Professional Tools — 2: Sensitivity Analysis chips (computeScoreDelta, buildSensitivityScenarios, scenario mode on Market Intel card)
- Professional Tools — 3: Project Summary PDF export (react-pdf, lazy-loaded, one-pager with score bar, pipeline viz, notes)
- Professional Tools — 4: Program Runway field (enrollmentRateMWPerMonth seeded for 5 states, getRunway(), RunwayBadge in Lens + Dashboard)
- UI/UX Revamp — Step 1: Lens form fields fully self-contained (FieldSelect + CountyCombobox own their white boxes + labels; pointer cursor, chevron rotation, full-box click)
- UI/UX Revamp — Step 2: USMap dark card redesign (deep forest-green base, aurora mesh gradient, vivid state fills on dark, glass tooltip, teal glow shadow) — shade balance still being tuned

---

## 🔨 Active — UI/UX Revamp (Current Sprint)

Design philosophy: make it feel like a Bloomberg Terminal crossed with a modern intelligence briefing. Data-dense but not overwhelming. Every paid feature should feel comforting and catered to the individual developer, not a generic dashboard.

Color system going forward:
- Teal `#0F6E56` — primary / positive market signal
- Amber `#BA7517` — caution / watch
- Violet `#7C3AED` — proprietary intelligence features (score, AI insights, scenario analysis)
- Dark card surface for USMap: `#0B2018` base, teal-dominant aurora gradient, violet + amber accents

### Step 2 — Dashboard: USMap dark card ⚠️ NEEDS SHADE TUNING
Current state (commit 37d11f9):
- Base: `linear-gradient(145deg, #0B2018, #0F2A1E, #0C2219)` — deep forest teal
- Aurora: teal upper-right + lower-left dominant, violet upper-left whisper, amber lower-right warmth
- State fills: `#4DE8A8` (score ≥75) down to `#2D5040` (no program)
- Selected: `#8B5CF6` violet | Hover: `#F59E0B` amber | Borders: `rgba(white, 0.08)`
- Feedback: previous attempt (violet/indigo base) felt too contrasted vs green nav. Current attempt feels slightly too dark overall. Next tweak: try lifting base lightness one more step (e.g. `#0E2D22`) and/or boosting aurora opacity slightly so glow reads without needing pure darkness for contrast.

### Step 3 — Lens: Replace state map with Market Position Panel
- Current map is too small to read, adds zero analytical value, elongated horizontally
- Replace ResultsStateMap entirely with a Market Position Panel:
  - Left: State name + program name + status badge (large, confident)
  - Center: Three mini horizontal bars for Offtake / IX / Site Control sub-scores
    (Offtake 40%, IX 35%, Site 25% — same weights as score popover)
  - Right: Market rank ("Ranked #X of Y active CS markets"), feasibility score as arc gauge
  - Dark teal gradient header band matching search form aesthetic
- DB-ready: sub-scores and rank will be computed from program_rules table in Iteration 5

### Step 4 — Lens: Market Intelligence Summary redesign
- Elevate to visual centerpiece of the Lens results page
- Structure:
  - Dark header band (`#0A5240`) with "TRACTOVA INTELLIGENCE" in monospace small caps left, large verdict badge right
  - 3px left-side accent bar that color-matches the verdict (animates on scenario change)
  - Primary insight zone: analyst sentence in `text-base` (larger), key terms highlighted inline (state name bold, program name teal, risk terms amber)
  - Signal tiles: structured grid (icon + label + value) replacing small floating pills — more visual weight
  - Subtle off-white surface `#F7FAF8` to distinguish from rest of page
- Scenario Analysis upgrade (real developer scenarios):
  - "If my study returns major upgrade requirements" → IX very_hard + estimated cost range ($150K–$400K) + timeline (+6–12 months)
  - "If program fills before I reach NTP" → csStatus limited/none + interpretation of what that means for this project
  - "If LMI requirement increases to 50%" → lmiPercent 50 + subscriber sourcing complexity note
  - "If I need to downsize to 2MW" → recalculates capacity %, runway impact, score delta
  - Visual: before/after score comparison on activation, not just sentence change
  - Accent bar and verdict badge animate to new state
- DB-ready: AI insight zone sized for 2–3 sentences of Claude API output when added later

### Step 5 — Lens: Pillar cards (SC / IX / REV) redesign
- Redesign to match visual language established in Steps 3 & 4
- Each card: colored header band at reduced opacity per pillar (teal=offtake, blue=ix, amber=site)
- Most important signal per card promoted to visual dominance:
  - Site Control: wetland risk flag (red/green, large) above secondary data
  - IX: Ease score meter prominent, queue status badge large
  - Offtake: Program status + runway as the hero, revenue stack secondary
- Add subtle hover state: border glow `rgba(15,110,86,0.15)`
- DB-ready: all fields already map to future DB columns per the field mapping table above

### Step 6 — Library: Full dark mode + intelligence redesign
- Full dark theme for Library page only (purposeful mode shift into "deal war room")
  - Page bg: `#070D0B`, card bg: `#0F1A16`, card border: `#1C2E27`
  - Primary text: `#F0FAF7`, secondary: `#6B9E8A`, muted: `#3D5E52`
- Three-color signal system on dark: teal (positive), amber (caution), violet (intelligence)
- Topographic SVG background (same as Dashboard, very faint) — brand consistency
- Collapsed card improvements:
  - Score bubble → mini arc gauge (even in collapsed state)
  - Pipeline stage shown as a mini progress bar under project name
  - Hover: card border glow, subtle scale transform
- Expanded panel:
  - Dark header band with project name large and white
  - Teal dividers, glowing score arc gauge
  - Alert strips in amber/red on dark surface
  - Notes field styled as terminal input (monospace, dark surface)
  - Pipeline dots glow on dark
- Header stat strip: numbers large and glowing on dark surface
- Empty state: beautiful dark empty state with Tractova brand + CTA to run first Lens search
- Export PDF button: styled for dark surface

### Step 7 — Lens: Loading / analysis animation ✅ COMPLETE
- Fullscreen cinematic overlay with sun-fill progress animation
- Arc fills smoothly via requestAnimationFrame (60fps, zero React re-renders during animation)
- Caps at 88% while API is in flight, completes via CSS transition when results arrive
- Single pass only — never loops
- "TRACTOVA LENS" label + "Analyzing {State} · {County} County"

### Step 8 — Claude API: AI Insights in Market Intelligence card ✅ COMPLETE
- `api/lens-insight.js` — Vercel serverless function calling Claude Sonnet 4.6
- System prompt: senior community solar analyst persona, 11 directive rules
- `buildContext()` pre-computes project % of remaining capacity + approx LMI subscriber count before sending to Claude
- Output: `{ brief, primaryRisk, topOpportunity, immediateAction }` — strict JSON, 3-tier parser fallback
- Market Intelligence card shows "AI Analysis" badge (violet) + brief replaces rule-based summary
- Two spotlight tiles: Primary Risk (red) + Top Opportunity (green)
- Immediate Action block (violet, lightning bolt) below tiles
- Graceful degradation: if API fails or times out → rule-based summary renders silently, no error state
- Function timeout: 30s maxDuration in vercel.json, 25s AbortController internally
- DB-ready: `buildContext()` receives data objects as params — swap `stateById`/`countyData.js` for Supabase queries in `handleSubmit` and AI insights automatically reflect live DB data

---

## Proposed: Web Scraping & Database Architecture (Iteration 5)

Goal: live-updated program rules and constraints, pulling from state regs and incentive programs (MA SMART 3.0, IL ABP SHINES 2.0, etc.) 1–2x per week.

Approach:
- Single Supabase table `program_rules`: one row per state/program/utility
- Key fields: LMI min/max %, bill applicability, net crediting, credit structure notes, key risks
- Populate manually first (MA, VA, IL) — validate schema before scaling
- Scrapers write to `program_rules_staging` → human review in admin panel → approve to prod
- Add `valid_from` date per row for versioning and alert detection
- LLM-in-the-loop extraction: feed raw page content + schema to Claude API, extract structured fields

Recommended build order:
1. `program_rules` table + manual population for 3 states
2. Wire Lens to query it (supplement or replace statePrograms.js)
3. Admin staging/review UI
4. Targeted scrapers per source, one at a time

---

## Backlog — Iteration 5

- Data scrapers: DSIRE, FERC queue data, EIA utility territory
- Scheduled refresh jobs (Vercel cron or Supabase edge functions)
- Admin panel for reviewing / approving scraped data before it hits prod
- Data freshness indicators in the UI
- `program_rules` Supabase table (see web scraping section above)
- Wire all UI components off statePrograms.js → Supabase queries (per field mapping table above)

---

## Long-term Backlog

- RFP Tracker (public PUC data)
- IRA Energy Community map layer (DOE API)
- Utility Report Card (standalone profile page per utility)
- Document Vault with AI summarization
- Per-state deep program pages (replacing DSIRE)
- Scenario Analysis — real cost/timeline estimates per IX upgrade tier
- Strip AI debug line from Market Intelligence card (small `ai: ...` note — temporary diagnostic, commit 723a684)
