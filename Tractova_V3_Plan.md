# Tractova V3 — Build Plan

> Reviewer: Opus 4.7 (high effort)
> Last updated: 2026-04-29 (Day 4 late-evening — Wave 2 Utility Outreach Kit + AI response cache)
> Supersedes: `Tractova_V2_Plan.md` for Phases 2-7. Phase 1 of V2 is shipped — no rework.
> Companion strategic critique: `~/.claude/plans/read-tractova-v3-prop-plan-md-file-functional-penguin.md`

---

## ⚡ Status Snapshot — Where We Left Off (2026-04-29 Day 3 LATE EOD)

**V2-Refactored Steps 0-7 all SHIPPED.**
**V3 Wave 1 — Items 1.1, 1.2, 1.3, 1.5 SHIPPED.** (1.4 deferred — needs accumulated snapshot data.)
**V3 §4.3 Status Thread (Project Audit Log) — fully SHIPPED with all 4 event kinds.**
**V3 §4.7 Deal Memo Shareable URL — SHIPPED.**

### 🟢 Audit log is feature-complete
All four kinds now log automatically:
- `created` — fires on save (Search.jsx)
- `stage_change` — fires when StagePicker changes stage
- `score_change` — fires on Library load OR immediately after stage change (paired)
- `alert_triggered` — fires on Library load when a new alert appears (deduped to last 30 days)

### 🟢 Deal Memo Shareable URL is live
- Click "Share Link" on any Library project → AI memo generates → token created → URL copied to clipboard → toast confirms
- Recipient hits `/memo/:token` → no sign-in → frozen snapshot of memo + project → V3 brand chrome
- 90-day expiry, 100-view cap per token
- Server-side via `api/lens-insight.js` with new public `memo-view` action and auth'd `memo-create` action — no new function added (still 11/12)

### Day 3 long-session deliverables (FINAL — full session)

This was a **22-commit session**, the most productive single day on the V3 build.

**Foundation (UI primitives + animation):**
- `2dae05c` Motion installed (animation library, tree-shaken until used)
- `07f3977` Radix-based UI primitives wrapped in V3 styling: Tabs / Dialog / Tooltip
  (chose this over shadcn after scoping a Tailwind v3→v4 migration: 76 utility-class
  hits across 18 files; default border/ring color changes globally — wrong time)
- `58722c0` Global Toast primitive (Radix Toast + Motion) — replaces hand-rolled
  SaveToast in Search; navy chrome + kind-colored accent rail + serif title

**Surface restructures:**
- `8d21feb` Library expanded card → Tabs (Overview / Diligence / Notes); solves the
  "giant scroll" issue per V3 §4.3
- `1bb31d2` Motion wired to Lens ArcGauge (spring-animated score readout +
  strokeDashoffset arc tween) + Tabs cross-fade + methodology tooltip ported
  to portal-rendered Radix Tooltip
- `2c5755c` StateDetailPanel → Radix Tabs + per-state cached AI news pulse
  (state-scoped Market Pulse, ~1 token call per user/state/day)

**New product features:**
- `1e28963` Project audit log (V3 §4.3): migration 014 + `lib/projectEvents.js`
  helper + 4th "Audit" tab in Library + `created` and `stage_change` events
  + Library remove modal ported to Radix Dialog
- `3534b65` Markets on the Move strip on Dashboard (V3 §4.1) — top 3 recently
  active CS states with score + click-to-drill
- `4d9db79` / `0a68a65` Cmd-K command palette (V3 Wave 3 brought forward) — power-user
  shortcut indexing states + counties + saved projects + nav routes; ⌘K hint in Nav
- `e7a2d2f` XLSX export (Library) — sheetjs lazy-loaded; column widths,
  frozen header, USD format on revenue
- `ff33f72` score_change audit events — migration 016; Library load detects
  shifts >=5 pts vs last_observed_score and logs to the Audit tab

**Security + cost protection:**
- `64c3f09` Security headers in vercel.json (HSTS / X-Frame-Options /
  X-Content-Type-Options / Referrer-Policy / Permissions-Policy / X-Robots-Tag
  on /api/*) + cybersec & IP plan track at top of this file
- `e621dc1` Rate limiting on lens-insight.js (migration 015) — per-user
  burst limit (10/min) + sustained limit (60/hr) prevents Anthropic spend abuse

**Bug fixes + quality polish:**
- `5626a00` Library sort-by-score parity (was using bare-state score; now uses
  same county-aware liveScore as the visible card) + immediate score_change
  on stage change (don't wait for next reload)
- `b79bd9d` Auto-fire AI Portfolio Insight on Library load (cached per
  user-per-day; mirrors news-pulse pattern)
- `5be7e1b` alert_triggered audit events with 30-day dedupe — completes the
  V3 §4.3 audit log spec
- `e4d412f` Library AlertChip → Radix Tooltip (portal-rendered, no clipping)

**Big product feature:**
- `991ebcc` **Deal Memo Shareable URL** (V3 §4.7) — most-requested item:
  - Public `memo-view` action in lens-insight.js (no auth)
  - Auth'd `memo-create` action freezes a snapshot
  - Migration 017 share_tokens (90-day expiry, 100 view cap)
  - New /memo/:token public route + MemoView page with V3 brand chrome
  - Share Link button in Library expanded card → clipboard copy + Toast
  - Toast component listens for window-dispatched `tractova:toast` events

### Tooling decisions made this session
- **Motion** (motion/react) — installed; drives Lens gauge + tab cross-fades.
- **Radix UI primitives** (`@radix-ui/react-{tabs,dialog,tooltip}`) — installed; wrapped
  in `src/components/ui/{Tabs,Dialog,Tooltip}.jsx` with V3 tokens baked in. The
  durable long-run answer instead of shadcn (whose preset system assumes v4).
- **shadcn** — skipped. Components we need are wrappers over Radix anyway.
- **Tailwind v4 upgrade** — deferred to a dedicated future session. Not blocking V3.
- **Claude Design** — reserved for the actual logo file when ready.

Latest commits on `origin/main` (Day 3):
- `1e28963` Project audit log (V3 §4.3 status thread)
- `2c5755c` StateDetailPanel: Radix tabs + per-state AI news pulse
- `1bb31d2` Motion on Lens gauge + Tabs; methodology tooltip → Radix portal
- `8d21feb` Library expanded card → Tabs
- `07f3977` Radix V3 UI primitives
- `2dae05c` Motion install
- `6e688fa` PDF score parity fix + button consolidation

Day 2 commits (`0024705 a685d54 e4f64bf`) and Day 1 commits remain on each surface.

**Action items pending — run in Supabase SQL editor:**

✅ Already run (per user confirmation):
- `010_alert_positive.sql` — Opportunity alerts toggle
- `011_projects_columns_backfill.sql` — Library save columns
- `012_ix_queue_snapshots.sql` — IX history accumulation
- `013_profile_slack.sql` — Slack webhook + toggle
- `014_project_events.sql` — **CONFIRMED RUN** — audit log populates ✅
- `015_api_call_log.sql` — **CONFIRMED RUN** — rate limiter live on `lens-insight.js` ✅
- `016_projects_last_score.sql` — **CONFIRMED RUN** — `score_change` audit events fire ✅
- `017_share_tokens.sql` — **CONFIRMED RUN** — Deal Memo Share Link fully live ✅

⏳ **Pending — run to activate AI response cache:**
- `019_ai_response_cache.sql` — AI response cache table (Day 4 cost-discipline pass). Until run, `cacheGet` returns null on every call and Sonnet runs fresh on each request — no regression, just no savings.

(`018_project_events_shared.sql` already applied alongside the share-trio.)

> Note on the "destructive" warning Supabase shows on 014/017: false positive. The `drop policy if exists` lines are the standard idempotent pattern for RLS — Supabase's own docs use them. Your data is not at risk.

**Surfaces 100% V3-cohesive:** Dashboard · Lens (form + results) · Library · Glossary · Profile · Compare · Sign-in/up · Upgrade · Landing · Admin · Email templates (digest + alerts) · Slack alerts.

### 🚀 Next-Session Pickup Options (priority-ranked)

**P1 — V3 Wave 1 remainder:**
- **1.4 Derived metrics** — IX Velocity Index + Program Saturation Index. Needs ≥4 weeks of `ix_queue_snapshots` (so accumulate first; revisit late May / early June). Mostly query work; surfaces in Lens + Library. ~3-4h when data exists.

**P2 — V3 deferred polish + product extension:**
- **Markets on the Move → real score deltas** — currently ranks by recency. When `dashboard_metrics` history accumulates ≥4 weeks, swap to true week-over-week delta ranking. ~2h.
- **Trend chips on KPIs** (V3 §7.2) — "↑ +3 (7d)" next to every metric. Same blocker as Markets on the Move (needs history).
- **Refactor existing surfaces to use ui/* primitives** — as surfaces are naturally touched. Gradual. Remaining candidate: Search.jsx form inputs (deferred — biggest surface, most recently churned). Profile toggles + Admin Field/SaveBar + MetricsBar KPI tooltips ✅ shipped Day 4.
- ✅ **MemoView "Open in Library" CTA for owner viewers** — shipped Day 4 (`3d96822`).
- ✅ **Per-user "shared X times" pill in Library** — shipped Day 4 (`3d96822`).
- ✅ **Audit log shows who shared / when** — shipped Day 4 (`3d96822` for the event, `ae65af2` for the recipient view-count pill on the timeline).
- ✅ **MetricsBar KPI tooltips** — shipped Day 4 late-evening (`34e0136`).
- **Tailwind v3 → v4 upgrade** — dedicated future session (~2-4h: 76 utility-class hits, default border/ring color changes). Unlocks shadcn permanently and matches V3 token philosophy better. **Trigger: V3 Wave 3 Deal Calendar** (needs shadcn Calendar primitive).
- **Cybersec quick wins from the §Security plan track** (top of this file):
  - GitHub Dependabot + Secret Scanning + Push Protection (5 min, free)
  - Supabase 2FA on your own account (2 min)
  - Privacy Policy + ToS before first paid customer (Termly ~$15/mo)
- **IP track:**
  - File USPTO trademark for "Tractova" wordmark (Class 9 + 42; ~$500-800 with flat-fee attorney)
  - Defensive domain registrations (.io / .app / .ai / common typos; ~$50/yr)

**P3 — V3 Wave 2 (defensible data layer):**
- **IX Queue Forecaster** — needs ≥12 weekly snapshots (Q3 launch). P50/P90 study completion modeling.
- ✅ **Utility Outreach Kit** — shipped Day 4 late-evening. New `'utility-outreach'` action through `lens-insight.js` (multiplexed, 11/12 function count holds). Generates a tailored pre-application email + utility context (study process / queue wait / tariff schedule) + attachments checklist + 30/60/90-day follow-up playbook + phone talking points + state-specific gotcha note. Renders in a Radix Dialog with per-section + entire-kit copy actions. Pro-gated.
- Remaining: Comparable Deals DB, PUC Docket Tracker MVP, Subscriber Acquisition Intel.

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

## 🔒 Security + IP — Future Track (added 2026-04-29)

User asked to consider this in parallel with V3 buildout. Not blocking the
roadmap; track these items as a separate workstream and slot them in when
there's a natural break.

### Free / cheap security wins (concrete tools)

**Already in place (verified):**
- Supabase Row-Level Security on `projects`, `profiles`, `project_events`
- Server-only Anthropic / Resend / Stripe / service-role keys via Vercel env vars
- HTTPS enforced by Vercel default
- Security headers in `vercel.json` (HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, X-Robots-Tag on /api/*)

**Quick wins to ship (ranked by leverage):**
1. **GitHub Dependabot** — flip on in repo Settings → Security; auto-PRs for
   vulnerable npm deps. **Free. 1-click. Highest ROI.**
2. **GitHub Secret Scanning + Push Protection** — same Settings page; blocks
   pushes containing detected API keys. **Free. Should be on now.**
3. **GitHub CodeQL** — Settings → Code security; SAST runs on every PR.
   **Free for public repos / orgs. Non-trivial signal-to-noise but worth the
   default scan.**
4. **Vercel BotID** — public beta product (per knowledge update). Bot
   detection on `/api/lens-insight.js` to prevent Anthropic-key abuse via
   scraping. **~$0 unless you hit the paid tier.**
5. **Rate limiting on `lens-insight.js`** — currently zero. A user with auth
   could burn the Anthropic budget. Add per-user rolling window (e.g. 30
   calls / 10 min) using Supabase as state. **~30 min build. Real cost
   protection.**
6. **Snyk free tier** — alternative to Dependabot+CodeQL with better DX.
   **Free for personal repos. Pick this OR GitHub-native — not both.**
7. **GitGuardian free tier** — secret-scanning across full git history (catches
   keys committed years ago). **Free. One-time scan worth running.**
8. **CSP (Content-Security-Policy) header** — restrict where scripts can load
   from. Tricky to get right with Stripe + Resend + Anthropic; defer until
   we have time to whitelist all third-party origins.
9. **Supabase 2FA on your own account** — protects the database. Settings →
   Account. **Free. Do today.**
10. **Stripe radar (default)** — already on if using Stripe. Verify in Stripe
    dashboard.

**Larger items (paid or significant effort):**
- WAF rules (Vercel paid tier) — wait until traffic justifies
- Penetration test (HackerOne / external) — ~$3-10K; defer to post-product-market-fit
- SOC 2 Type 1 — only when enterprise customers ask; ~$15-30K + months of audit prep
- Privacy policy + Terms of Service — **legal requirement once you take paying
  users**; Termly / Iubenda generators are ~$10-30/mo. **Ship before first paid
  customer.**

### IP / Trademark / Brand protection

**Tier 1 — Do soon (low cost, high protection):**
- **USPTO trademark for "Tractova"** wordmark. ~$250-350 application fee per
  class. File **Class 9** (downloadable software) AND **Class 42** (SaaS /
  Software as a Service). Use a service like LegalZoom (~$200 + filing fees)
  or a flat-fee trademark attorney (~$500-800 all-in). Timeline: 8-12 months
  to registration. **The earlier you file, the stronger your priority date.**
- **Domain defensive registrations** — already own `tractova.com`?
  Pick up `.io`, `.app`, `.ai`, `.co`, common typos (e.g. `tractovaa.com`).
  ~$50-100/year for the bundle. Cloudflare or Namecheap.
- **Logo trademark** — once the mark is finalized via Claude Design (currently
  placeholder), file as a separate USPTO class application or as a combined
  word+design mark. ~$250-350 additional.

**Tier 2 — Defer until revenue:**
- **Trade-secret protection** for the scoring methodology + curated state
  data. No filing required; just don't publish the formulas externally. Add
  internal NDA template for any future contractor / contributor. Free.
- **Provisional patent** for novel work like the IX Queue Forecaster
  algorithm (Wave 2). $130 filing fee, gives 12-month priority. Probably
  not worth pursuing — algorithmic patents are weakening, defensibility
  comes from data + execution, not patent walls.
- **Copyright registration** for the codebase. Automatic at creation; formal
  registration ($65/work) only matters if you ever need to sue someone.
  Defer indefinitely.

**Tier 3 — Critical legal items separate from IP:**
- Privacy Policy + Terms of Service (see security #11 above) — **before first
  paid customer**.
- Form an LLC or C-Corp if not already — Stripe-friendly, liability-limiting,
  IP-holding entity. Stripe Atlas (~$500), Clerky, or local incorporation
  service. **Before significant revenue.**
- DMCA agent registration with the US Copyright Office — required for safe
  harbor if user-generated content ever appears (e.g. shared deal memos). $6
  filing fee, 3-year renewal.

### Accepted dependency risks (audited 2026-04-29)

After `npm audit fix` cleared the safe portion (postcss 8.5.9 → 8.5.12 patch),
8 advisories remain. Reviewed and explicitly accepted for now:

1. **`xlsx@0.18.5`** — Prototype Pollution + ReDoS, severity high, **no fix
   available**. SheetJS removed their package from npm in 2023 and now
   distribute via their own CDN (cdn.sheetjs.com). The version on npm is the
   last public release and is permanently stuck.
   - **Risk in our context: low.** Used only for owner-controlled portfolio
     export in Library — the user's own saved projects, no untrusted input.
   - **Future fix path:** swap to SheetJS's CDN distribution, or migrate to
     `exceljs` if the bundle-size hit is acceptable.

2. **`react-simple-maps@3.0.0`** (transitive d3-color < 3.1.0 ReDoS) —
   severity high, **no upstream fix**. Library hasn't released past 3.0.0;
   npm's "fix" is a downgrade to 1.0.0 (breaking API change).
   - **Risk in our context: low.** USMap renders state colors from a fixed
     teal ramp on controlled state data; no user-supplied color strings flow
     into d3-color parsing functions.
   - **Future fix path:** evaluate alternatives (`react-vis-leaflet`,
     `topojson` direct, or a hand-rolled SVG choropleth) when we redo the
     dashboard map for the Wave 2 IX Forecaster overlay.

3. **`vite@5.4.21`** (with transitive `esbuild <= 0.24.2`) — severity
   moderate, dev-only. The esbuild advisory says any website can send
   requests to the **local dev server** and read the response. Production
   builds are unaffected.
   - **Risk in our context: low for prod, moderate for local dev.** Mitigate
     by not running `npm run dev` while browsing untrusted sites.
   - **Future fix path:** Vite 5 → 8 jump pairs naturally with the deferred
     **Tailwind v3 → v4** upgrade (already on the V3 backlog as a dedicated
     tooling session). Tackle them together — both are major refactors that
     touch build chrome.

GitHub Dependabot is on; will re-flag if any of these get an upstream patch.

### Recommended sequencing

**This month:**
- GitHub Dependabot + Secret Scanning + Push Protection (5 min)
- Supabase 2FA on your own account (2 min)
- Add rate-limiting to `lens-insight.js` (30 min — the most concrete cost
  exposure today)
- File USPTO trademark for "Tractova" word mark (or hire flat-fee attorney
  to file)

**Before first paid customer:**
- Privacy Policy + Terms of Service
- LLC formation if not already

**Pre-Wave-2:**
- BotID on `/api/*` once Anthropic spend grows
- Reconsider CSP header

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

### V3 Wave 1 — Mostly complete
- ✅ **1.1** IX queue history accumulation — migration 012 + cron append snapshots (foundational for Wave 2 Forecaster)
- ✅ **1.2** Weekly digest + policy alert emails — V3-branded with navy/teal, Source Serif 4 wordmark, JetBrains Mono numerics, portfolio meta strip
- ✅ **1.3** Slack alert integration — migration 013 + Block Kit messages + Profile webhook config + dual-deliver in `send-alerts.js`
- ⬜ 1.4 Derived metrics (IX Velocity Index, Program Saturation Index) — **deferred until ≥4 weeks of snapshot data accumulates**
- ✅ **1.5** Markets-in-Motion section in weekly digest — top 3 portfolio states by activity (news + data updates) past 7 days

### V3 Step 7.9 — Form primitives extracted
- ✅ **7.9** Shared V3 ui primitives — `src/components/ui/{Button,Input,Select}.jsx` + barrel index. Existing surfaces not bulk-rewritten; future surfaces auto-inherit V3 chrome via these.

### Pre-V3 Foundation (Verified shipped, not re-touched)
- V2 Phase 1 (tech reorder, automated freshness, ESC handlers, "Library" rename)
- Compare Tray "Best For" + "Open in Lens"
- Profile portfolio stats + alert preferences

---

## What's NOT Shipped (Deferred — see "Next-Session Pickup" above)

- **Markets on the Move with TRUE score deltas** — ships v1 with recency ranking; awaits ≥4 weeks of dashboard_metrics history for week-over-week delta ranking
- **Trend chips on KPIs** (V3 §7.2) — same blocker as above
- **V3 Wave 2** — Forecaster, Comparable Deals DB, PUC Docket Tracker, Utility Outreach Kit, Subscriber Acquisition Intel (waits on accumulated history)
- **V3 Wave 3** — Capital Stack Pre-Flight, Deal Calendar, multi-county batch Lens
- **Tailwind v4 upgrade** — dedicated future session (trigger: Wave 3 Deal Calendar needing shadcn Calendar primitive)
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
- ✅ Utility Outreach Kit (`action: 'utility-outreach'`) — shipped Day 4 late-evening
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
