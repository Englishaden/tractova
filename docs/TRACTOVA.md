# TRACTOVA — Project Brief
> Read this entire document before writing any code or making any decisions.
> This is the single source of truth for the Tractova platform.
> Update this document as the product evolves.

---

## 1. What is Tractova

Tractova (pronounced **Track-toe-vah**) is a market intelligence and deal screening SaaS platform for small, independent community solar and renewable energy project developers in the United States.

**The name:** Latin *tractus* (a surveyed tract of land) + *nova* (new). Works on three levels:
- Roman land surveying root — directly relevant to site control
- Developer language — a "tract" is a unit of land they think in daily
- Layman intuition — "track" your projects, gain traction

**Domain:** tractova.com (registered, owned)
**GitHub:** github.com/englishaden/tractova
**Brand family:** Connected to The Adder (theadder.substack.com), a bi-weekly newsletter targeting the same audience

---

## 2. The Problem We Solve

Small community solar developers (1–10 person shops) have no dedicated tool for early-stage project intelligence. They currently:
- Manually check state PUC websites for interconnection queue data
- Google for policy updates across dozens of state programs
- Use spreadsheets to track project pipelines
- Spend hours per project doing research that larger firms (Nexamp, Ameresco, etc.) have entire teams for

Tractova automates that research layer and delivers it as a structured, always-updated dashboard. Target users are developers who have real projects but no in-house policy or finance intelligence capability.

---

## 3. Target User

- **Who:** Small independent community solar developers, 1–10 person shops
- **What they do:** Develop community solar, C&I solar, and BESS projects
- **What they lack:** In-house policy, interconnection, and market intelligence teams
- **What they have:** Real projects, real capital decisions, real time pressure
- **NOT targeting:** Large developers like Nexamp, Ameresco, or utility-scale IPPs
- **Geography:** United States, initially focused on states with active community solar programs

---

## 4. The Three Intelligence Pillars

Every project in community solar development moves through three phases. Tractova is organized around these three pillars:

### Pillar 1 — Site Control
Understanding what land is available, usable, and developable.

**Sub-components:**
- **Policy & land use** — farmland protection acts, USDA prime agricultural designation, state solar siting rules, land preservation restrictions
- **Land mapping** — EPA National Wetlands Inventory (NWI), brownfields, landfills, contaminated sites (EPA), existing solar project footprints (NREL Tracking the Sun), available acreage by county
- **Competitive land** — existing lease areas, developer activity by county (partially public, scraped from interconnection queue filings and county assessor data)

**Key data sources:** USDA, EPA NWI, NREL, EIA, county GIS databases, state interconnection queue filings

**Data availability:** Mostly public, GIS-heavy, most technically complex pillar — build last

### Pillar 2 — Interconnection (IX)
Understanding utility capacity, queue status, and ease of interconnection.

**Sub-components:**
- **Queue status by utility** — open vs. saturated queues, MW capacity available, co-op and small utility opportunities, underserved territories
- **Utility ease scoring** — process rigor/leniency, upgrade requirements, average study timelines, ISA withdrawal rates, design standards — this is a proprietary scoring layer Tractova builds on top of public data. Nobody has built this cleanly for developers. It is the most differentiated feature in the platform.
- **Opportunity mapping** — underdeveloped utility territories, co-ops with headroom, geographic opportunity zones

**Key data sources:** FERC Form 1, ISO/RTO queue data (MISO, PJM, CAISO, NYISO, ISO-NE, SPP, ERCOT), utility Integrated Resource Plans (IRPs), state PUC filings

**Data availability:** Public but messy, requires parsing — build second

### Pillar 3 — Offtake
Understanding revenue potential, program status, and market structure.

**Sub-components:**
- **Program status by state** — community solar program existence, capacity remaining, ease of acceptance, subscriber requirements
- **LMI & residential allocations** — required low-to-moderate income allocations, residential subscriber minimums by program
- **Revenue stack** — state incentive layers, ITC/adder eligibility (IRA), SREC/REC market rates, net metering rules
- **Case studies** — successful project profiles by state × utility combination (user-submitted + scraped)

**Key data sources:** DSIRE (Database of State Incentives for Renewables & Efficiency — dsireusa.org), NCSL, state PUC websites, DOE, EIA

**Data availability:** Cleanest and most structured public data in the stack — **build first**

---

## 5. Product Architecture — Three Surfaces

### Surface 1: Market Dashboard (Browse Mode)
**The free tier. No login required.**

The entry point. A developer opens this on Monday morning to get a pulse on the market.

**Layout (desktop-first, 1280px+ optimized):**
- **Top nav:** Tractova logo/wordmark, nav links (Dashboard | Search | My Projects), auth buttons (Sign In / Get Started)
- **Metrics bar:** 4–5 key numbers across the top — states with open CS programs, utilities with IX headroom, policy alerts this week, etc.
- **Main panel (left ~60%):** US choropleth map, states colored by opportunity score. Click a state → opens state detail panel. Filter by pillar (site / IX / offtake). Color intensity = composite opportunity score.
- **Side panel (right ~40%):** Live policy and news feed. Auto-scraped, tagged by pillar and state, linked to source, date-stamped. User can flag an article to a saved project.
- **State detail panel:** Opens on state click. Shows that state's offtake program status, IX queue summary, key policy flags, and relevant case studies.

### Surface 2: Catered Search (Find Mode)
**Paid tier. Requires login and subscription.**

A developer has a specific site in mind and wants targeted intelligence.

**Inputs:**
- State + county
- Project size (MW AC/DC)
- Development stage (concept / site control / interconnection / offtake)
- Technology type (community solar / C&I solar / BESS / hybrid)

**Output:**
- Map zooms to county with utility territory overlay
- Site pillar: available acreage, wetland flags, land use restrictions
- IX pillar: serving utility, queue status, ease score, avg study timeline
- Offtake pillar: active CS program, capacity remaining, revenue stack breakdown
- Similar case studies surfaced automatically
- One-click save as tracked project

### Surface 3: Project Library (Track Mode)
**Paid tier. The stickiest feature — drives retention.**

A developer's personal deal tracker. Every saved project lives here and auto-updates.

**Project card shows:**
- Project name (user-defined, e.g. "Champaign 5MW Concept")
- County, state, MW, development stage
- Three-pillar status snapshot with color coding
- Last updated timestamp
- Alert badges (policy change / IX update / offtake capacity change)

**Alert engine:**
- Policy change in project's state → email + in-app flag
- IX queue status change for serving utility → alert
- CS program capacity drop → urgent flag
- Weekly digest email per tracked project
- User can flag news articles from the dashboard feed to specific projects

---

## 6. Monetization Model

### Freemium Structure
| Tier | Price | Access |
|------|-------|--------|
| Free | $0 | Market dashboard (browse only, no login required) |
| Pro | $99–199/month | Catered search + project library + alerts |
| Premium (future) | $299–499/month | Deal screener + financial snapshot (go/no-go tool) |

### Future: Deal Screener (Phase 3)
Once a developer has preliminary designs, offtake proposed, and site control term sheet, they move into the deal screener — a quick financial snapshot / go-no-go tool. This is a separate paid module, priced as a premium add-on or per-use. Not in scope for current build.

### Payment Infrastructure
- **Stripe** for subscription billing and payment processing
- Freemium → paid conversion happens at the search input screen
- No credit card required for dashboard browse

---

## 7. Tech Stack

### Frontend
- **React** (with Vite as build tool)
- **Tailwind CSS** for styling
- **React Router** for navigation between the three surfaces
- **Recharts or D3** for data visualization
- **react-simple-maps** or **Mapbox GL** for the US choropleth map

### Backend (when needed — Iteration 3+)
- **Supabase** for database, authentication, and real-time updates
- Supabase handles: user accounts, saved projects, alert preferences, project data storage

### Payments (Iteration 4)
- **Stripe** for subscription management
- Stripe Checkout for payment flow
- Webhooks to update Supabase user tier on payment events

### Email/Alerts (Iteration 4)
- **Resend** for transactional email (project alerts, weekly digests, auth emails)

### Hosting & Deployment
- **Vercel** for hosting (free hobby tier initially)
- **GitHub** (englishaden/tractova) as the code repository
- Auto-deploy on every push to main branch
- Custom domain: tractova.com (registered on Namecheap, DNS pointed to Vercel)

### Data Sources (scraped/integrated)
- **DSIRE** (dsireusa.org) — state incentive program data, primary offtake source
- **FERC** — interconnection queue filings
- **ISO/RTO portals** — MISO, PJM, CAISO, NYISO, ISO-NE, SPP, ERCOT queue data
- **EIA** — utility territory data, electricity rates, generation data
- **EPA NWI** — National Wetlands Inventory for site control
- **NREL** — Tracking the Sun dataset for existing project locations
- **USDA** — farmland classification data
- **State PUC websites** — program-specific data, rate cases

---

## 8. Build Sequence — Strict Iteration Order

**Do not skip ahead. Complete each iteration, test it as a real user, fix what's broken, then proceed.**

### Iteration 1 — Dashboard Shell (CURRENT)
**Goal:** A working, real-data-populated market dashboard. No auth, no search, no database.

Deliverables:
- React + Vite project scaffold
- Tractova branding (nav, logo wordmark, color system)
- US choropleth map with states colored by CS program status
- Metrics bar with real numbers
- Right-side policy/news feed (seeded with real recent data, manually curated initially)
- State click → basic state detail panel
- Deployed to Vercel at tractova.vercel.app
- tractova.com pointed at the deployment

**Test criteria:** Aden opens it on his laptop, uses it like a real developer on a Monday morning, identifies what's missing or broken.

### Iteration 2 — Catered Search
**Goal:** Working search input → county-level intelligence output. Still no auth.

Deliverables:
- Search form (state, county, MW, stage, technology)
- Map drill-down to county level
- Three-pillar output panel populated with real data
- Utility territory overlay on map
- Case study surfacing (seeded initially)
- "Save project" button (saves to localStorage for now, no database yet)

**Test criteria:** Aden inputs a real project he knows well, verifies the output is accurate and useful.

### Iteration 3 — Auth + Project Library
**Goal:** Real user accounts, saved projects, persistent data.

Deliverables:
- Supabase project setup
- Email/password auth + Google OAuth
- Project library UI — saved project cards
- Projects persist in Supabase database
- Basic alert preferences per project
- Freemium gating — search requires login, library requires login

**Test criteria:** Aden creates an account, saves 3 projects, logs out, logs back in, confirms projects persist.

### Iteration 4 — Payments + Alerts
**Goal:** Real revenue, real notifications.

Deliverables:
- Stripe integration — Pro subscription ($99/month to start)
- Paywall on search and library for non-subscribers
- Resend integration for transactional email
- Weekly project digest emails
- In-app alert badges for policy/IX/offtake changes
- tractova.com fully live with SSL

**Test criteria:** Aden completes a real payment flow end-to-end, receives a real alert email.

### Iteration 5 — Data Automation
**Goal:** Dashboard data updates automatically without manual curation.

Deliverables:
- Scrapers for DSIRE, FERC queue data, EIA utility data
- Scheduled jobs (Vercel cron or Supabase edge functions)
- Admin panel for Aden to review and approve scraped data
- Data freshness indicators in the UI

---

## 9. Design System

### Brand
- **Name:** Tractova
- **Pronunciation:** Track-toe-vah
- **Tagline (working):** "Intelligence for the moment that matters."
- **Brand story:** Named for the Roman land surveyors (*agrimensores*) who used *tractus* to define and claim territory. Tractova does the same for modern solar developers — mapping, measuring, and illuminating the landscape before capital is committed.

### Color Palette (to be finalized in Iteration 1)
- **Primary:** Deep teal/green — energy, land, growth (suggest #0F6E56 or similar)
- **Accent:** Warm amber — the flash of intelligence, opportunity signal (#BA7517 or similar)
- **Neutral:** Clean grays for UI chrome
- **Background:** Near-white, professional, not stark white
- **Danger/Alert:** Standard red for urgent flags
- **Success:** Green for positive signals

### Typography
- Clean, professional sans-serif (Inter or similar)
- Not startup-cute, not enterprise-stuffy — serious B2B intelligence tool feel
- Think Bloomberg Terminal meets modern SaaS

### UI Philosophy
- Desktop-first (1280px primary viewport)
- Mobile responsive comes in a later iteration
- Data-dense but not overwhelming — hierarchy matters
- Every element earns its place — no decorative fluff
- Feels like a tool developers trust with real capital decisions

---

## 10. File Structure (Target for Iteration 1)

```
tractova/
├── public/
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── Nav.jsx
│   │   ├── MetricsBar.jsx
│   │   ├── USMap.jsx
│   │   ├── NewsFeed.jsx
│   │   ├── StateDetailPanel.jsx
│   │   └── Footer.jsx
│   ├── data/
│   │   ├── statePrograms.js       ← CS program status by state
│   │   ├── newsFeed.js            ← Seeded policy/news items
│   │   └── metrics.js             ← Dashboard metric numbers
│   ├── pages/
│   │   ├── Dashboard.jsx          ← Surface 1
│   │   ├── Search.jsx             ← Surface 2 (Iteration 2)
│   │   └── Library.jsx            ← Surface 3 (Iteration 3)
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── TRACTOVA.md                    ← This file
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

---

## 11. Data Seeding — Iteration 1

For Iteration 1 the data is manually curated and hardcoded in the `/src/data/` files. This is intentional — we validate the UI and UX before building scrapers.

### statePrograms.js — Community Solar Status by State
Each state object contains:
```javascript
{
  id: "IL",                          // state abbreviation
  name: "Illinois",
  csStatus: "active",                // active | limited | inactive | none
  csProgram: "Illinois Shines",      // program name
  capacityMW: 450,                   // remaining program capacity in MW
  lmiRequired: true,                 // LMI allocation required
  lmiPercent: 50,                    // % of capacity for LMI subscribers
  ixDifficulty: "moderate",          // easy | moderate | hard | very_hard
  opportunityScore: 78,              // 0-100 composite score (drives map color)
  lastUpdated: "2025-03-15"
}
```

States with active community solar programs to seed initially:
Illinois, Minnesota, New York, Massachusetts, Maryland, Colorado, New Jersey, Maine, Oregon, Washington, Hawaii, New Mexico, Virginia, Connecticut, Rhode Island, California, Florida (limited), Michigan (pending)

### newsFeed.js — Policy & News Items
Each item contains:
```javascript
{
  id: 1,
  headline: "Illinois Shines capacity expands by 300MW under new CEJA rules",
  source: "IL Commerce Commission",
  url: "https://...",
  date: "2025-04-01",
  tags: ["offtake", "IL", "policy"],
  pillar: "offtake"                  // site | ix | offtake
}
```

### metrics.js — Dashboard Header Numbers
```javascript
{
  statesWithActiveCS: 18,
  utilitiesWithIXHeadroom: 34,
  policyAlertsThisWeek: 7,
  avgCSCapacityRemaining: "62%",
  lastUpdated: "2025-04-11"
}
```

---

## 12. Key Decisions Already Made

- **Build order:** Offtake first (cleanest data), Interconnection second (most differentiated), Site Control third (most complex GIS)
- **Freemium line:** Dashboard browse = free, Search + Library = paid
- **Map library:** Evaluate react-simple-maps (simpler) vs Mapbox GL (more powerful) in Iteration 1
- **No mobile yet:** Desktop-first, responsive comes later
- **No scraping yet:** Manual seed data in Iteration 1, automated scrapers in Iteration 5
- **Supabase not yet:** No database until Iteration 3, use localStorage as interim
- **Stripe not yet:** No payments until Iteration 4

---

## 13. What Tractova Is NOT

- Not a solar design tool (Aurora, HelioScope do that)
- Not a project management tool (Scoop, Monday do that)
- Not targeting residential solar or large utility-scale IPPs
- Not an EPC or procurement tool
- Not a financial modeling tool (yet — deal screener is Phase 3)
- Not trying to replace DSIRE — it aggregates and contextualizes DSIRE data

---

## 14. Context on the Builder

- **Builder:** Aden Walker, 24, project finance professional with hands-on community solar development experience
- **GitHub:** englishaden
- **Vercel workspace:** englishaden
- **Domain registrar:** Namecheap
- **Vibe coding approach:** Aden describes domain logic and product intent in plain English. Claude writes and iterates the code. Aden tests as a real user and flags what's broken.
- **Claude Code is the primary coding tool** — this brief is the persistent memory that replaces chat context between sessions
- **Strategic decisions** happen in Claude.ai chat (claude.ai) — this is where product direction, business model, and design are defined
- **Code execution** happens in Claude Code via Git Bash terminal

---

## 15. How to Start Each Claude Code Session

Begin every Claude Code session with:

```
Read TRACTOVA.md completely. This is our project brief and source of truth. 
We are currently on Iteration [X]. 
Today's task is [specific task].
Do not make assumptions outside this brief without asking first.
```

---

## 16. Current Status

We are on either iteration 3 or 4. Reference Running_Notes.MD for further updated details of each task to come, i will keep that up to date. Use this as a general project outline / overview, but not as a to-do list. 
---

*Last updated: April 12, 2026*
