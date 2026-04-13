# Tractova — Build Queue

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
- Iteration 4 — Project cards: expandable inline panel with score arc gauge, pipeline progress bar,
  market intelligence (CS status, IX difficulty, LMI, program notes), auto-saving notes field
- Iteration 4 — Bug fixes: score gauge clip, expanded state preserved on window focus/alt-tab
- Iteration 4 — Dashboard: urgency tags on news feed, "Open in Lens" CTA in StateDetailPanel

### Session: April 13, 2026
- [x] Dashboard — News feed pagination: 4 items per page, prev/next arrows, item count display
- [x] Dashboard — StateDetailPanel: "Search in Lens" CTA moved to panel header (next to close button)
- [x] Lens — Read ?state= query param on load, auto-select state in form (useSearchParams)
- [x] Platform-wide rename: opportunityScore → feasibilityScore in all JS/JSX
      (statePrograms.js, MetricsBar, USMap, StateDetailPanel, Library, Search, Glossary)
      DB column (opportunity_score) intentionally unchanged
- [x] Lens — Score popover: fixed upward clipping, now opens downward (top-full mt-2)
- [x] Lens — Score label renamed "Opportunity score" → "Feasibility score" in popover
- [x] Library — Timestamp format: changed to exact date M/D/YYYY (was short month/year)
- [x] Lens — Replaced Pin/ComparisonStrip with full Comparison Tray:
        · CompareContext (localStorage, max 5, add/remove/clear/isInCompare)
        · CompareTray: floating bottom bar with project chips + Compare button
        · CompareModal: projects as columns, rows for Feasibility Score (bar), CS Status,
          IX Difficulty, Size, Technology, Stage, Source (Saved date vs Live)
        · "Add to Compare" button on Lens results header
        · Compare icon chip on Library project card right controls
        · CompareProvider + CompareTray wired into App.jsx (persists across pages)
- [x] Library — Inline stage editing: stage badge is now a StagePicker dropdown
      (both in collapsed header and expanded panel), updates Supabase on select,
      pipeline progress bar re-renders immediately
- [x] Library — Structured note prompts: hint chips (Landowner, Queue position, Key dates,
      ISA deposit, Site notes) appear above empty notes field; clicking pre-fills textarea header;
      placeholder updated to "Landowner · Queue position · Key dates · ISA deposit"
- [x] Library — CSV export: "Export CSV" button in header downloads all projects as
      tractova-projects-YYYY-MM-DD.csv with all key fields
- [x] Glossary — Related terms: "See also:" links at bottom of each definition,
      curated 2–4 per term, click scrolls and highlights target card
- [x] Glossary — Anchor links: each card has an id slug; hovering term name shows
      link icon; click copies shareable URL to clipboard
- [x] Glossary — Deep-linking: /glossary#slug auto-scrolls on page load;
      typeahead selections update URL hash

---

## UI/UX Backlog — 4 Tabs (do before live data)

### Priority 1 — Dashboard ✅ DONE
- [x] News feed urgency hierarchy: "Policy Alert" vs "Market Update" type tag on each item
- [x] StateDetailPanel: "Open in Lens →" CTA button in panel footer (passes ?state=XX in URL)
- [x] News feed pagination or carousel: 4 items visible, prev/next arrows
- [x] Dashboard page header redesign (reverted — duplicated MetricsBar; original header kept)

### Priority 1b — Lens (Search) ✅ DONE
- [x] Read ?state= query param on Search page load and auto-select state in form
- [x] "Search in Lens" CTA moved to StateDetailPanel header

### Priority 2 — Lens (Search) ✅ DONE
- [x] Feasibility Score explainer popover (3-pillar breakdown, opens downward)
- [x] Comparison Tray (replaced Pin/ComparisonStrip — see session notes above)
- [x] Search history: exact date timestamp on Library project cards

### Priority 3 — Library ✅ DONE
- [x] Inline stage editing: StagePicker dropdown on stage badge, saves to Supabase
- [x] Structured note prompts: hint chips + updated placeholder
- [x] CSV export: one-click download of all saved projects

### Priority 4 — Glossary ✅ DONE
- [x] Related terms links: "See also:" row at bottom of each definition
- [x] Anchor links: id per card, copy-link on term name click, deep-link on mount

---

## Next Up — Professional Tools Roadmap

These are the high-value items from the "Inspired by Wood Mackenzie / Enverus / Aurora" section.
Pick up here next session. Suggested order:

### 1. Executive Summary Sentence (Lens results) — HIGH VALUE, LOW EFFORT
  - One plain-English line above the feasibility score on Lens results
  - e.g. "Illinois is an active CS market with moderate IX difficulty — strong for LMI-heavy projects under 2MW."
  - Build as a pure mapping function in statePrograms.js or generate from csStatus + ixDifficulty + score
  - No external dependencies — entirely client-side

### 2. Sensitivity Chips (Lens results) — MEDIUM EFFORT, HIGH PERCEIVED SOPHISTICATION
  - "What if IX gets harder?" / "What if LMI drops to 30%?" chips on score display
  - Re-runs feasibility score with toggled param, shows delta vs current score
  - Buildable without a model — just re-invoke the score function with modified inputs

### 3. Project Summary PDF Export (Library) — HIGH RETENTION VALUE
  - One-click export from expanded Library card → clean one-pager PDF
  - Pulls market intelligence, deal details, notes into a structured layout
  - Requires: react-pdf or Puppeteer endpoint
  - Highest retention item: once a dev exports a Tractova summary, they won't switch tools
  - Build react-pdf version first (client-side, no server needed)

### 4. Program Runway Field (Lens + Dashboard) — REQUIRES DATA WORK
  - Estimated months of remaining program capacity at current enrollment pace
  - Forward-looking signal nobody else provides cheaply
  - Requires enrollment rate data — seed manually for top 5 states first, flag as "estimated"

---

## Proposed: Web Scraping & Database Architecture

Goal: live-updated program rules and constraints, pulling from state regs and incentive programs
(MA SMART 3.0, IL ABP SHINES 2.0, etc.) 1-2x per week.

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

---

## Long-term Backlog

- RFP Tracker (public PUC data)
- IRA Energy Community map layer (DOE API)
- Utility Report Card (standalone profile page per utility)
- Document Vault with AI summarization
- Project Summary PDF export (see Professional Tools section)
- Per-state deep program pages (replacing DSIRE)
