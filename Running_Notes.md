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

---

## UI/UX Backlog — 4 Tabs (do before live data)

### Priority 1 — Dashboard
- [x] News feed urgency hierarchy: "Policy Alert" vs "Market Update" type tag on each item
- [x] StateDetailPanel: "Open in Lens →" CTA button in panel footer (passes ?state=XX in URL)
- [x] News feed pagination or carousel: feed scrolls too far — add "See more / See less" toggle
      or left/right arrow mini-pagination so the panel stays compact (e.g. 4 items visible, arrows to page through)
- [x] Dashboard page header redesign: match Glossary/Library intelligence aesthetic (teal banner or stat strip)

### Priority 1b — Lens (Search) — state pre-fill from Dashboard
- [x] Read ?state= query param on Search page load and auto-select that state in the form
      — currently the URL is passed (?state=IL) but Search.jsx doesn't read it yet
      — use useSearchParams() from react-router-dom, set initial state value from param on mount
- [ ] Consider moving "Search in Lens" CTA higher in StateDetailPanel — currently in footer,
      could sit next to the state name in the header for faster discoverability
      — use discretion: header may be too crowded, footer placement is clean but easy to miss

### Priority 2 — Lens (Search)
- [ ] Score explainer: "How is this scored?" tooltip or expandable 3-bullet breakdown on results
      — developers distrust a number they don't understand; trust = retention
- [ ] Compare mode: pin two state results side by side (IL vs MN), avoids mental tab-switching
- [ ] Search history: "Last searched [date]" timestamp surfaced on saved Library projects
      — shows whether conditions changed since original search

### Priority 3 — Library (My Projects)
- [ ] Inline stage editing: clicking the stage badge in expanded panel lets user update it
      — projects stuck at "Prospecting" forever are useless as a deal tracker
- [ ] Structured note prompts: placeholder text in notes field like
      "Landowner · Queue position · Key dates · ISA deposit" to guide input
- [ ] CSV export: one-click export of all saved projects with market data columns
      — high value for pipeline reporting to investors or partners

### Priority 4 — Glossary
- [ ] Related terms links: bottom of each definition links to 2-3 related terms
      (e.g. ISA → IX Queue, Interconnection Agreement)
      — makes it feel like real reference documentation, not a flat list
- [ ] Anchor links per term: clicking a term name updates URL to /glossary#isa
      so developers can share specific definitions with colleagues

---

## Professional Tools — Future Functionality Roadmap

### Inspired by Wood Mackenzie / Enverus
- [ ] Executive summary sentence on Lens results: one plain-English line above the score
      e.g. "Illinois is an active CS market with moderate IX difficulty — strong for LMI-heavy projects under 2MW."
      This is the insight the developer needs before the data.
- [ ] Program runway field: estimated months of remaining program capacity at current enrollment pace
      — forward-looking signal that none of the cheap tools provide
      — requires enrollment rate data from scrapers (Iteration 5+)

### Inspired by Aurora Energy Research
- [ ] Sensitivity chips on Lens results: "What if IX gets harder?" or "What if LMI drops to 30%?"
      — re-runs the score with a modified input and shows delta
      — buildable without a full model, just re-invoke the score function with toggled params
      — high perceived sophistication, relatively low build complexity

### Inspired by Energy Toolbase
- [ ] Project Summary PDF export from Library expanded panel
      — pulls market data, deal details, notes into a clean one-pager
      — developers use this for investor decks and partner handoffs
      — highest retention value item on this list: once a dev exports a Tractova summary,
        they won't switch tools
      — requires a PDF generation library (e.g. react-pdf or a server-side Puppeteer endpoint)

### Replacing DSIRE (free tier reference — currently ugly and slow)
- [ ] Per-state program summary pages: dedicated readable page per active CS state
      — goes deeper than the StateDetailPanel: full program rules, adder structure,
        REC price history, utility territory map
      — positions Tractova as the place developers go instead of DSIRE
      — requires live data layer (Iteration 5) to be trustworthy

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
