# Tractova — Build Queue

---

## Core Design Principle — Database-Ready Architecture



### Step 7 — Lens: Loading / analysis animation ✅ COMPLETE


### Step 8 — Claude API: AI Insights in Market Intelligence card ✅ COMPLETE

### Step 9 — Library UI refresh + site-wide bug fixes ✅ COMPLETE (commit 46f08dd)

**Library page UI — "Dark Done Right":**
- Page bg #080C14 → #0C1220 (less crushing, richer dark blue)
- Expanded panel: solid #0F1A2E — distinct tonal separation from collapsed card
- All section label text lifted 0.45 → 0.60 opacity
- Secondary meta text (county · MW · tech) 0.52 → 0.68 — scannable at a glance
- Card borders stronger (0.20 → 0.28 collapsed, 0.40 → 0.45 expanded)
- Page subtitle, stat strip sub-labels, footer hint text all lifted
- Your Deal section boxes: bg 0.04 → 0.06, borders 0.07 → 0.11
- Notes textarea: bg black → semi-white, teal border brightened
- Chevron/delete icons lifted from 0.20–0.25 → 0.35

**Bug fixes:**
- Search.jsx: `results.countyData` null crash → added `?.` guard on SiteControl + Interconnection props
- Library.jsx: debounced notes save inner `setTimeout` not cleared on unmount → stored in `idleTimerRef`, cleared in cleanup

**Known deferred (not bugs, planned work):**
- STRIPE_WEBHOOK_SECRET placeholder in .env.local → needs real secret from Stripe dashboard
- CRON_SECRET missing from .env.local → needs value added before cron jobs go live
- Missing `enrollmentRateMWPerMonth` on most states → data entry task for Iteration 5
- LMI ITC stacking logic in lens-insight.js → Iteration 5 feature

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
- ~~Strip AI debug line from Market Intelligence card~~ ✅ COMPLETE
