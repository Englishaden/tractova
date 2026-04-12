# Tractova — Build Queue

## ✅ Completed
- Priority 1: Tractova Lens — state context map on results
- Priority 2: Remove project confirmation dialog
- Priority 3: Search form visual redesign + field dropdown polish
- Priority 4: Glossary — 7 dev stages + 5 industry terms + Dev Stages filter
- Iteration 3a: Supabase project persistence (Library + Search save flow migrated from localStorage)

---

## Current: Iteration 3 — Remaining

### Priority 1: Freemium Gating
Gate Tractova Lens behind authentication.
- Unauthenticated users who try to run a Lens search see a prompt to sign in / create account instead of results
- My Projects already shows a sign-in prompt — Lens needs the same treatment on form submit
- Dashboard remains fully public — no gate on the map or news feed
- Keep it a soft gate: show a clear value prop, not just a hard block

### Priority 2: Data Expansion — Seed More States
The county data layer (countyData.js) only has full data for a handful of states.
- Expand to cover all 18+ states with active/limited CS programs
- Each state needs: siteControl, interconnection, and offtake data (county-level or state-level fallback)
- Priority states: IL, MN, NY, MA, MD, CO, NJ, ME, OR, WA, VA, CT, RI, NM, HI
- Directly improves Lens usefulness before any paywall goes up

### Priority 3: Landing / Marketing Page
tractova.com currently drops visitors straight into the dashboard — no context for first-time visitors.
- Build a proper homepage for logged-out users
- Above the fold: headline, tagline, strong CTA (Get Started / Sign Up)
- Below fold: three pillars explained briefly, who it's for, preview of the dashboard
- Nav should reflect logged-out state cleanly

---

## Backlog — Iteration 4

- Stripe Pro subscription ($99/mo)
- Paywall on Lens + Library for non-subscribers (upgrade prompt, not hard block)
- Resend transactional email — weekly project digest, policy alerts
- In-app alert badges on project cards (policy change / IX update / program capacity drop)

---

## Backlog — Iteration 5

- Data scrapers: DSIRE, FERC queue data, EIA utility territory
- Scheduled refresh jobs (Vercel cron or Supabase edge functions)
- Admin panel for reviewing / approving scraped data
- Data freshness indicators in the UI

---

## Long-term Backlog

- RFP Tracker (public PUC data)
- IRA Energy Community map layer (DOE API)
- Utility Report Card (standalone profile page per utility)
- Document Vault with AI summarization
