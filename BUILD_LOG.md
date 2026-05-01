# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it appends the latest commit, flips backlog items to shipped, and updates the migration list. No more juggling Running_Notes / V3_Plan / V2_Plan / Prop_Plan — those are archived in `docs/archive/`.

---

## 🟢 Pickup — User actions to light Path B up on prod

**Session ended 2026-05-01. One large commit on `main` (`7c49c5c`) ships
the entire Path B build (wetlands + farmland data layers — all 50 states /
3,142 counties).** Pre-work probes done first to validate the approach:

```
7c49c5c  Path B: county_geospatial_data — wetlands + farmland for all 50 states
```

**To light it up on prod, three actions in this order:**

1. **Run migration 039** in Supabase SQL editor (paste
   `supabase/migrations/039_county_geospatial_data.sql`). Inert until rows
   exist — does not change scoring behavior.
2. **Trigger the SSURGO ingest** via the admin Refresh button (or wait for
   Sunday 7:45 cron). Populates ~3,000 counties with `prime_farmland_pct`
   in ~5s. After this, `availableLand` is live for all 50 states (where
   SSURGO has soil-survey coverage — AK skipped per migration comment).
3. **Run the NWI seed locally** when convenient — takes ~1.5h with 4x
   parallelism:
   ```
   node scripts/seed-county-geospatial-nwi.mjs
   ```
   Idempotent + resumable. After completion, `wetlandWarning` is live for
   all 3,142 counties and the **Site · Live** pill renders in the Lens
   eyebrow strip for any county query.

Quarterly NWI refresh: `node scripts/seed-county-geospatial-nwi.mjs --refresh`
(skips counties whose `wetland_last_updated` is < 90 days old).

**Visual verification on prod after step 3:**
- Lens results eyebrow now shows a small teal **"Site · Live"** pill (next
  to IX · Live where applicable) for ANY county in any state — not just the
  18 with curated `county_intelligence` rows. Hover opens a structured Radix
  tooltip explaining inputs (NWI / SSURGO) and thresholds.
- Site sub-score for the 32 previously-fallback states (TX, GA, NC, AZ, etc.)
  now reflects real wetland + farmland data instead of the 60 placeholder.

**Next pickup options (priority-ordered for retention vs effort):**

- **Drill-down geospatial detail in the Site Control card** — when a user
  expands the Site Control card, surface the actual `wetland_coverage_pct`,
  `wetland_category`, `prime_farmland_pct` numbers + sources (NWI / SSURGO)
  alongside the existing land-use bullets. ~1-2h.
- **Activate §48(e) / HUD layers in Lens scoring UI** — data live (3,144
  NMTC + 1,801 HUD rows). Needs to flow into the offtake panel as ITC-
  bonus indicators. ~3-4h.
- **Expand IX scrapers to missing CS-active states** (CA, FL, WA, HI, NM,
  CT, RI, MI, WI, OR, VA) — would grow IX · Live from 8 → 19. Multi-
  session per-ISO scraper work.
- **Path-toward-50-states-fully-live**: see
  [memory: 50-state live coverage roadmap](../../memory/...). Order
  implied: site (✅ this session) → IX (scraper expansion) → utility
  serving (EIA Form 861) → offtake (EIA retail rates).

**Earlier pickup state superseded by this session:**

```
e4c6666  Lens loader: asymptotic halo fill — never stalls, always creeps forward
7d474e1  IX · Live pill: structured Radix tooltip matching the methodology popover
e9506a7  IX score live-blend: ix_queue_data signals on top of curated ixDifficulty
4702b98  BUILD_LOG: flip migrations 034-037 to ✅ + add live-DB probe script
b27dfa0  Library WoW deltas + freshness signal
5b6a7a0  Pro-flow smoke tests: authed regression net for the white-screen class
```

---

## ✅ Shipped 2026-05-01 — Path B: county_geospatial_data (`7c49c5c`)

**Single large commit closing out a multi-session estimate in one session.**
Pre-work probes (in `scripts/probe-fips-conventions.mjs` and
`scripts/probe-geospatial.mjs`) validated the approach before touching
production code: confirmed all 4 county-keyed tables share `county_fips`
text PK with leading zeros, validated the USFWS NWI ArcGIS outStatistics
query against `Wetlands.ACRES` table-qualified, validated the USDA SSURGO
T-SQL aggregate of `farmlndcl IN (...)` returning whole-state prime-farmland
percentages in <100ms.

**`7c49c5c` — Path B build.** Replaces the silent `site=60` fallback for the
32 states that lack a `county_intelligence` default row with derived
signals from authoritative federal sources, covering all 3,142 counties.

- **Migration 039** — `county_geospatial_data` table keyed on `county_fips`,
  fields `wetland_coverage_pct`, `wetland_category`, `prime_farmland_pct`,
  separate `*_last_updated` timestamps because the two sources refresh at
  different cadences. Wetland category is bucketed (minimal/moderate/
  significant/severe) since raw NWI % can exceed 100% from polygon overlap
  + water inclusion (calibrated thresholds in the migration comment).
- **SSURGO refresh** — wired into the multiplexed `refresh-data.js` as
  `?source=geospatial_farmland`. Single T-SQL aggregate query covers the
  whole US in ~5s. New 7:45 Sunday cron entry. AK skipped (137 NRCS
  regions vs 30 boroughs); CT/RI handled as statewide single-area
  assignments to all counties via `county_acs_data`.
- **NWI seed** — `scripts/seed-county-geospatial-nwi.mjs`. Runs locally
  with 4x parallelism (~1.5h for 3,142 counties — too long for the 300s
  Vercel ceiling). Idempotent + resumable via `--refresh` flag (skips
  counties updated within 90 days).
- **scoreEngine** — three-layer site sub-score: live geospatial → curated
  `county_intelligence` → `site=60` baseline. Backward-compatible — when
  geospatial row is absent, the curated path runs with no behavior change.
  `coverage.site = 'live'|'researched'|'fallback'` exposed.
- **programData.getCountyData** — augmented to fetch `county_geospatial_data`
  via `county_fips` (resolved through `county_acs_data`, same FIPS bridge
  as `getNmtcLic`/`getHudQctDda`) and merge as `countyData.geospatial`.
  No frontend changes required — the data block just gets richer.
- **lens-insight context** — when geospatial is present, the AI prompt
  receives live numeric inputs (prime farmland %, wetland coverage %,
  NWI feature count) and an explicit `COVERAGE: live geospatial` line so
  the dossier reasons honestly about authoritative sources.
- **UI** — small teal **"Site · Live"** pill in the Lens result eyebrow,
  mirroring the IX · Live treatment. Radix tooltip explains inputs +
  thresholds. Absent (honest signal) for counties without a geospatial row.

`npm run verify` green (build + 7 smoke tests, ~12s).

---

## ✅ Shipped 2026-04-30 — IX score live-blend + Lens loader polish

Three commits closing out the long evening session. Together they shift
the IX sub-score from purely curated to a calibrated blend of curated +
live ISO/RTO queue signals, surface that honestly in the UI, and fix
the Lens loader stall.

**`e9506a7` — IX score live-blend.** `computeSubScores` now optionally
accepts an `ixQueueSummary` arg. When present + non-empty, applies a
clamped (±10) adjustment based on `avg_study_months` and total
`mw_pending`. Thresholds calibrated from the actual `ix_queue_data`
distribution (probe: `scripts/probe-ix-queue.mjs`):
- avg_study_months: <14mo +5 / 14-19 0 / 20-23 -3 / 24+ -8
- total mw_pending: <500 +3 / 500-999 0 / 1000-1499 -3 / 1500+ -6

New `coverage.ix = 'live' | 'curated'` flag. Library + Profile call
sites pass 4 args (no ixQueueSummary), so they stay on curated path.
Search.jsx passes the already-fetched `results.ixQueueSummary` →
Lens-only live blend, no regression elsewhere. Coverage today: 8 of
50 states (CO/IL/MA/MD/ME/MN/NJ/NY) — concentrated on the highest-
volume CS markets.

**`7d474e1` — IX · Live tooltip polish.** Replaced the native browser
`title` attribute with a Radix portal tooltip styled to match the
methodology popover at `Search.jsx:479` — dark navy bg, teal border,
structured headings + INPUTS / CLAMP / coverage-policy footnote.
Reads as research-note documentation, matching the Lens chrome
convention.

**`e4c6666` — Lens loader asymptote.** Halo arc was `p = (elapsed/14s)*88`
linear-then-stop, which produced a visible stall at 88% on every run.
Replaced with `p = 95 * (1 - exp(-elapsed/8s))` and removed the RAF
exit guard. Result: motion never freezes (sub-pixel asymptotic creep
even on 60s outliers), and the snap-to-100% on completion always has
5+ points of headroom for a clean landing.

---

## ✅ Shipped 2026-04-30 — Library WoW + freshness signal

Two retention-driving surfaces added on the Library page in parallel
to the Dashboard hero indicator (`e2c8b48`):

**Freshness signal** — small mono "Data refreshed [date]" caption with
teal breathing dot under the hero meta line. Amber when underlying
program data is >14d old. Tooltip explains scores are recomputed from
this snapshot on every load. Same retention rationale as the Dashboard
version: Library is the daily-driver surface, so the live-data promise
needs to stay visible on the user's main return loop.

**WoW score-delta chip** — when a saved project's state has moved
week-over-week in `state_programs_snapshots`, a "State ±N pt" pill
renders in the project-card chip row. Teal up / amber down. Honestly
labeled "State" because the source is state-level program snapshots,
not per-project history; tooltip explains the project's blended score
may differ. Falls back to silent when delta is null/zero — no visual
noise pre-data. Lights up automatically once history accrues (~2 weeks
post-migration-038).

**One file changed:** `src/pages/Library.jsx` (~50 LOC). No new RPC,
no new migration, no new dependency — piggybacks on the existing
`getStateProgramDeltas()` already shipped for Markets on the Move
(`5c30369`). Verified via `npm run verify:full` (14 tests green).

---

## ✅ Shipped 2026-04-30 — Pro-flow smoke tests (`5b6a7a0`)

Five files changed:

- `tests/auth.setup.js` (new) — drives `/signin` with creds from `.env.local`,
  saves storage state to `tests/.auth/pro-user.json`
- `tests/pro-smoke.spec.js` (new) — 6 tests covering home (Dashboard
  resolution), Search past paywall, Library past paywall, Library
  empty-state preview, Profile + Pro-badge, /preview when authed
- `playwright.config.js` — added `setup` + `pro-chromium` projects with
  glob testMatch
- `package.json` scripts — `test:smoke` now unauth-only; new
  `test:smoke:pro`, `test:smoke:all`, `verify:full`. `npm run verify`
  unchanged (build + unauth smoke).
- `.gitignore` += `tests/.auth/`. `.env.example` += test-account setup
  instructions.

**Before committing — one-time setup the user must do:**

1. **Create the test account** in the live app (sign up via UI, e.g.
   `smoke-test@tractova.com` with any password).
2. **Flip it to Pro** via Supabase SQL editor:
   ```sql
   update profiles
      set subscription_tier='pro',
          subscription_status='active'
    where id = (select id from auth.users where email='smoke-test@tractova.com');
   ```
3. **Drop creds in `.env.local`:**
   ```
   TEST_USER_EMAIL=smoke-test@tractova.com
   TEST_USER_PASSWORD=<the password>
   ```
4. **Run `npm run test:smoke:pro`** — should pass 6 tests in ~10-15s.
5. **Then `npm run verify:full`** to confirm the full suite is green
   before committing.

**`npm run verify` keeps working with no creds set.** It runs build +
unauth smoke (the existing 7 tests). Use `verify:full` once Pro creds
are in place.

**No live API calls in any test.** Lens form submissions are deliberately
not exercised — the smoke is render-and-watch-for-console-errors. Cost
per run: $0.

**Deferred items, in priority order (unchanged from prior session):**
- **Library WoW score deltas + freshness signal** (parallel to
  Dashboard hero) — ~2 hours, retention-driving.
- **Expand curated economic coverage to top-10 solar markets**
  (CA, TX, FL, NC, AZ, GA, NV, NM) — biggest single-move leverage.
  EIA Form 861 + ISO capacity markets publicly sourced. ~4-8h/state.
- **Apply pending migrations 034-037** (HUD QCT/DDA + NMTC LIC) in
  Supabase SQL editor.
- **Wetlands + farmland data layers** — 3-4 day R&D + spatial join.

**Coverage gap (unchanged):** only 18 of 50 states have a `default`
county_intelligence row. Missing: AK, AL, AR, AZ, DE, GA, IA, ID, IN,
KS, KY, LA, MO, MS, MT, NC, ND, NE, NH, NV, OH, OK, PA, SC, SD, TN,
TX, UT, VT, WI, WV, WY.

**Run `npm run verify` before pushing any visible-feature change.**

---

## ✅ Shipped 2026-04-30 — Score honesty pass (`596de4b` + `d4061d2`)

**Two layered fixes** addressing the same trust-erosion class:
silent baseline fallbacks in the Lens scoring engine that produced
research-grade-looking numbers from placeholder values.

### `596de4b` — offtake coverage
**The bug.** Customer could pick BESS/C&I/Hybrid for any of 50
states in `/search`. `CI_OFFTAKE_SCORES` (12 states) and
`BESS_OFFTAKE_SCORES` (10 states) silently fell back to 55/45 for
uncovered states. The revenue panel honestly said "model not
available" but the feasibility number looked researched.

**The fix.** `computeSubScores` returns `coverage: { offtake }`.
`MarketPositionPanel` renders a "Limited offtake coverage" caption
listing curated states. `api/lens-insight.js` adds a `COVERAGE
NOTE` instructing the AI to speak directionally for uncovered
geographies (no fabricated $/kW or PPA cents/kWh).

### `d4061d2` — site coverage (parallel)
**The bug.** Only 18 of 50 states have a `default`
county_intelligence row seeded. For the other 32 states, the Site
Control sub-score silently defaults to 60. Same trust issue.

**The fix.** `coverage.site` = `'researched' | 'fallback'`. The
caption block consolidated into one "Limited coverage — directional
only" panel with per-pillar bullets (offtake, site) so common-case
where both fire stays visually clean.

**What this didn't change.** All 50 states still receive full Lens
analysis on the data side. State programs all 50, IX difficulty all
50, IRA/HUD/NMTC overlays all 50. Only the **economic** and
**county-level site** layers honestly signal coverage now.

---

## ✅ Shipped 2026-04-30 — Tailwind v4 + Vite 8 + shadcn integration

Cleaner than the BUILD_LOG plan estimated (~1.5h vs 3-5h budgeted)
because the codebase had **zero `@apply` usage**, no Tailwind plugins,
and a simple custom palette — the official codemod handled almost
everything mechanically.

**Three commits, merged to main as `475a095`:**

- `3e7df8e` — Tailwind v3.4.6 → v4.2.4, Vite 5.3.4 → 8.0.10. Codemod
  migrated 35 files. JS config (`tailwind.config.js`) replaced by
  CSS-first `@theme` block in `src/index.css`. Class-name renames:
  `flex-shrink-0` → `shrink-0`, `focus:outline-none` →
  `focus:outline-hidden`, `rounded` → `rounded-sm`, `rounded-sm` →
  `rounded-xs`. Border-color compat shim added (v4 default changed
  from gray-200 to currentcolor). autoprefixer dropped (v4 has its
  own). Build time 22s → 4s thanks to Rolldown.

- `55f3fc7` — shadcn/ui integrated, scoped to its own directory at
  `src/components/shadcn/ui/` so primitives never collide with our
  existing custom UI in `src/components/ui/`. Pruned shadcn's
  universal CSS overrides (Geist font import, `* { @apply
  border-border }`, body/html @applies, `--font-sans` /
  `--color-primary` / `--color-accent` overrides in @theme inline).
  shadcn primitives now inherit our brand (teal primary, amber
  accent, Inter font) automatically. Smoke-test components: `card`,
  `badge`. Added `jsconfig.json` + `vite.config.js` `@/*` alias.

- `475a095` — merge commit.

**Audit impact:** vite + esbuild moderate vulns cleared (confirmed
locally). Remaining 6 high are all pre-documented accepted-risks
(`xlsx` + `react-simple-maps` / d3-color chain).

---

## ✅ Resolved 2026-04-30 — refresh pipeline + Census 503 saga

The data refresh that started yesterday with the NMTC wildcard bug is
now fully shipped. Diagnostic endpoint (`/api/refresh-data?debug=1`,
auth-bypass, fully redacted) confirmed Census API + key + Vercel
egress are all healthy: HTTP 200 in ~470ms with valid ACS data. User
clicked Refresh → **5/5 endpoints OK in 20.7s**, all 8 sub-sources ✓.

The remaining work was the durability layer — **stale-tolerance** for
the three Census handlers (`d8be8ef`). When Census 503s and our last
successful pull is <90 days old, the panel goes amber with a
`stale-ok · last good Nd ago` badge instead of red. ACS publishes
annually so this is the right semantics. Server keeps `ok: false` on
the actual failure so `cron_runs` records honestly and the next
stale-check finds the real last-good run.

---

## Status snapshot

- **Branch:** `main` · last commit: pending — visual polish + landing alignment
- **Live data layers (all .gov / authoritative-source verified):**
  - `lmi_data` (state-level Census ACS)
  - `county_acs_data` (3,142 counties Census ACS)
  - `state_programs` + DSIRE verification
  - `revenue_stacks` + DSIRE verification
  - `news_feed` (RSS + Claude Haiku 4.5 classifier)
  - `energy_community_data` (DOE NETL EDX — IRA §45/§48 +10% ITC)
  - `hud_qct_dda_data` (HUD User — LIHTC LMI overlay)
  - `nmtc_lic_data` (Census ACS + CDFI methodology — IRA §48(e) Cat 1 +10% ITC)
  - `ix_queue_data` (ISO/RTO weekly scrapers)
  - `substations` (EIA Form 860 monthly)
  - `revenue_rates` (NREL PVWatts + EIA quarterly)
- **Multiplexed cron:** Two staggered Sunday runs to fit Hobby gateway window — `?source=fast` at 07:00 (7 quick sources) + `?source=nmtc_lic` at 07:30 (NMTC alone, ~50-70s due to 51-state iteration). Plus 3 separate cron functions for substations / IX queue / capacity factors (Hobby 12-function cap).
- **Admin manual refresh:** `/admin > Data Health > Refresh data from sources` parallel-fans-out to all **5 endpoints** (fast bundle + NMTC + substations + ix_queue + capacity) with admin JWT auth. Each endpoint has its own gateway window so a slow source can't drag the rest.

---

## Pending Supabase migrations

User runs these manually in Supabase SQL editor. Mark applied here when done.

✅ All migrations through 038 applied as of 2026-04-30 (verified via
`scripts/check-migrations.mjs` against the live DB — hud_qct_dda_data
has 1,801 rows, nmtc_lic_data has 3,144 rows, freshness RPC includes
both blocks).

| # | File | What it does | Status |
|---|------|--------------|--------|
| 028 | `news_feed_auto.sql` | RSS+AI ingest columns | ✅ |
| 029 | `revenue_stacks_dsire.sql` | DSIRE verification columns | ✅ |
| 030 | `data_freshness_rpc.sql` | RPC v1 | ✅ |
| 031 | `data_freshness_cron_driven.sql` | RPC reads cron_runs | ✅ |
| 032 | `energy_community_data.sql` | Energy Community table | ✅ |
| 033 | `freshness_energy_community.sql` | RPC +energy_community | ✅ |
| 034 | `hud_qct_dda_data.sql` | HUD QCT/DDA table | ✅ |
| 035 | `freshness_hud_qct_dda.sql` | RPC +hud_qct_dda | ✅ |
| 036 | `nmtc_lic_data.sql` | NMTC LIC table | ✅ |
| 037 | `freshness_nmtc_lic.sql` | RPC +nmtc_lic | ✅ |
| 038 | `state_programs_snapshots.sql` | Wave 1.4: append-only feasibility-score history table for WoW deltas + Markets on the Move trends | ✅ |
| 039 | `county_geospatial_data.sql` | Path B: per-county wetland coverage % (NWI) + prime farmland % (SSURGO) for all 3,142 counties — closes Site Control gap | ⏳ |

> **Verification protocol going forward:** before asking the user to
> re-run any migration, run `node scripts/check-migrations.mjs` (or
> a similar live-DB probe). The build-log state can drift from the
> live state when migrations are applied out-of-band.

---

## Recent builds (most recent first)

| Commit | Subject |
|--------|---------|
| `7c49c5c` | Path B: county_geospatial_data — wetland coverage (NWI) + prime farmland (SSURGO) for all 50 states / 3,142 counties; closes Site Control gap; migration 039 + scoreEngine 3-layer fallback + Site · Live pill |
| `e4c6666` | Lens loader: asymptotic halo fill — replaces linear-stall-then-jump with `p = 95 * (1 - exp(-elapsed/8s))`; RAF loop never exits while overlay visible so the halo physically can't freeze on slow runs; cleaner snap-to-100 landing on completion |
| `7d474e1` | IX · Live pill: structured Radix tooltip matching the methodology popover (dark navy + teal border); replaces native browser `title` with INPUTS / CLAMP / coverage-policy box |
| `e9506a7` | IX score live-blend: scoreEngine.computeSubScores now optionally blends ix_queue_data quantitative signals (mw_pending, avg_study_months) on top of curated ixDifficulty baseline; coverage.ix = 'live'\|'curated' flag exposed; teal "IX · Live" pill in Lens eyebrow when blend fired (8 top-CS-market states today); Library/Profile call sites unchanged → no regression |
| `4702b98` | BUILD_LOG: flip migrations 034-037 to ✅ + add live-DB probe script |
| `b27dfa0` | Library WoW + freshness signal: "Data refreshed [date]" hero caption (teal breathing dot, amber if >14d) + "State ±N pt" chip on project cards when state_programs_snapshots show movement; piggybacks on getStateProgramDeltas already shipped for Markets on the Move |
| `5b6a7a0` | Pro-flow smoke tests: auth.setup.js + pro-smoke.spec.js (6 tests, ~10-15s, $0/run) — covers Search/Library/Profile/Dashboard past the paywall, catches the white-screen class on the authed surface that smoke.spec.js can't reach |
| `4fb24b6` | Landing onboarding: items-baseline on the simulated alert feed so chip + text share a typographic baseline; reverted "— lines / dots / solid" addendum from map legend |
| `8a7f2ea` | Visual polish: gauge labels (25/50/75), shimmer flow (real CSS bug — animate 0%→100% not 0%→50%), legend visibility, baseline symmetry sweep across NewsFeed / Comparable / Regulatory |
| `e2c8b48` | Dashboard: surface "data refreshed [date]" caption on hero — makes the live-data promise provable on first impression with teal breathing dot (fresh) or amber (>14d stale) |
| `26b86b0` | BUILD_LOG: capture site-coverage fix + state-level coverage gaps |
| `d4061d2` | Score honesty: site sub-score also signals fallback when county_intelligence row missing (only 18 of 50 states seeded — caption now consolidates both pillars in one block) |
| `9b0d96c` | BUILD_LOG: capture score-honesty fix + new pickup priorities |
| `596de4b` | Score honesty: surface "limited coverage" caption + AI COVERAGE NOTE when offtake falls back to baseline (BESS/CI/Hybrid outside curated 8-12 states) |
| `1474c3d` | BUILD_LOG: capture full audit / fix / smoke-suite stretch + post-break pickup |
| `79bfb08` | Smoke tests: Playwright suite catches runtime bugs that pass build (7 tests, ~20s) — `npm run verify` is the new pre-push gate |
| `318930e` | Two visual fixes: CSS-keyframe shimmer (replaces motion's keyframes that produced loop-boundary discontinuity) + ticks moved OUTSIDE the gauge arc |
| `09304d5` | useSubscription: unique channel name per hook instance — **fixes white-screen on dashboard state click** (Supabase realtime channel collision when WelcomeCard + StateDetailPanel both mounted the hook) |
| `eea8d78` | Dashboard: defensive Map check on deltaMap (preventative; speculative diagnosis of the white-screen, real fix was `09304d5`) |
| `5c30369` | Wave 1.4: state_programs_snapshots history + Markets on the Move WoW deltas (migration 038 — needs to be applied) |
| `53625e3` | Two refinements: tiled-gradient shimmer (still had loop discontinuity, superseded by `318930e`) + bigger gauge ticks |
| `d3af13c` | Three follow-up fixes: peer-state dropdown becomes styled custom popup (not native select), dual-shimmer attempt, gauge merge into single object |
| `dae9e65` | Three fixes: audit log dedupe + 8-row cap with "Show N earlier" expansion, peer-state diff list redesigned as labeled grid (was bullet list of strings), sub-score shimmer flow (1.4s repeatDelay removed) |
| `c709a29` | BUILD_LOG: close out queue items with explicit status |
| `1780fbd` | Library: tighter mobile padding/gap on project card collapsed header |
| `5bd249c` | Color audit: consolidate legacy primary teal #0F6E56 → canonical #0F766E across all surfaces (Library / Profile / Search / ProjectPDFExport / SectionDivider / UpgradeSuccess) |
| `bcc65d9` | Compare modal: teal-tinted slim scrollbar (.scrollbar-dark utility) |
| `2b14b83` | Library: `?preview=empty` URL flag to view empty-state onboarding without deleting projects |
| `f02704e` | Onboarding: subscription-aware WelcomeCard + contextual UpgradePrompt (URL params surface as "Lens analysis staged for you") |
| `41c91eb` | Compare: TractovaLoader on AI synthesis (replaces gradient skeleton) |
| `b3cb940` | MemoView: real conversion CTA for non-owner share-link viewers |
| `6dc21ab` | Markets on the Move: live-pulse indicator + overflow count + chip tooltips |
| `79390c1` | Compare: enrich items + group rows into §01 Composite / §02 Project sections (Program Capacity + LMI Carveout rows added) |
| `b45b359` | Lens: rewrite Custom scenario as Peer-State picker (apply any state's profile, see live diff) |
| `1780fbd` | Library: tighter mobile padding/gap on project card collapsed header |
| `5bd249c` | Color audit: consolidate legacy primary teal #0F6E56 → canonical #0F766E |
| `2b14b83` | Library: `?preview=empty` URL flag to view empty-state onboarding without deleting projects |
| `d2aa9a1` | BUILD_LOG: capture audit-cycle commits + UX/Lens redesign sweep |
| `31247ae` | Loaders: TractovaLoader on NewsFeed Market Pulse, scenario rationale, Admin Data Health |
| `e447a7e` | Hygiene + polish: drop `iad1` from masthead, delete TopoBackground, fix scroll-into-view ordering, gitignore scratch txt |
| `1eda205` | Library: upgrade empty-state into a 3-value-prop onboarding card |
| `0ca8b7a` | UX: surface API failures with retry instead of swallowing — new ApiErrorBanner across Dashboard / Comparable / Regulatory |
| `6b17f40` | Lens: research-desk masthead + §-numbered section markers + dossier band wrapping the 3 cards |
| `6a25073` | Revert: remove TopoBackground from Lens (lines felt too literal) |
| `2c58e4b` | (later reverted) Lens: subtle topographic background on results panel |
| `e63a0c3` | Library: project-bar redesign — mini arc gauge + accent rail + score-tinted gradient |
| `c88629e` | Loaders: branded TractovaLoader + Library Portfolio AI summary uses it |
| `eab8492` | Lens: cards collapsed by default — prompt user interaction |
| `4eff1e9` | Lens: full-card collapse on the 3 main cards + grid alignment fix |
| `3d69237` | Lens: click-to-expand drilldowns on the 3 main cards (SC / IX / Offtake) |
| `6733480` | Lens: precedent-anchored scenarios + brief feedback loop (smooth scroll + pulse) |
| `db92ccb` | Lens: shimmer constant on sub-score bars + fold Federal LIHTC into Offtake stack |
| `3d57820` | Lens: redesign sub-score bars (Offtake / IX / Site Control) — animated arcs + spring counters |
| `2fb04db` | Admin: surface Census diagnostic in Data Health UI (`Run Census diagnostic` button) |
| `475a095` | Merge: Tailwind v4 + Vite 8 + shadcn |
| `55f3fc7` | Integrate shadcn/ui (scoped, brand-preserving) |
| `3e7df8e` | Upgrade Tailwind v3 → v4 and Vite 5 → 8 |
| `d8be8ef` | Refresh: stale-tolerance for Census ACS sources (90-day window, amber-OK badge) |
| `4285c1a` | Refresh: make `?debug=1` auth-bypass + fully redact key |
| `0cab89f` | BUILD_LOG: capture diagnostic plan + clear pickup steps |
| `beaac11` | Refresh: Census `?debug=1` diagnostic mode + descriptive User-Agent |
| `2d974cd` | BUILD_LOG: capture today's multiplex refactor + UI polish |
| `875aa88` | Admin: color-code the 10 tabs for at-a-glance scanning |
| `8012250` | Profile: move Data Admin link to top of page |
| `d28956c` | Refresh: inline `keyed=` flag into Census error strings (UI visibility) |
| `6011cab` | Refresh: surface `keyed` flag on Census handler errors (env-var diagnostic) |
| `503aec7` | Refresh: split NMTC into its own HTTP call to fit Hobby gateway ceiling |
| `341410f` | Refresh: kill 503-retry storm + add 310s client-side timeout |
| `4ed7f3b` | Refresh: serialize Census handlers + retry on 503 (later refined by 341410f) |
| `0baad56` | Bump `@anthropic-ai/sdk` 0.88 → 0.91.1 (dependabot moderate) + accepted-risk doc |
| `ebf3deb` | Tune Census fetch budget for parallel multiplexed runs |
| `3d9f978` | Fix: multiplexed refresh hitting 60s gateway timeout (`maxDuration` 60→300, `Promise.all`) |
| `9ba2086` | Fix: NMTC LIC handler — iterate tract pulls per-state (Census wildcard fix) ✓ verified |
| `f2fdb6c` | Docs: consolidate planning trail into single BUILD_LOG.md |
| `ad67356` | Data layer: NMTC LIC tracts → IRA §48(e) Cat 1 +10% ITC bonus per county |
| `fe2b108` | Data layer: HUD QCT/DDA federal LIHTC overlay per county |
| `71d7456` | Data layer: IRA Energy Community (+10% ITC bonus) per-county eligibility |
| `4016fca` | Crons: kill `.catch`-on-builder bug + redesigned refresh status panel |
| `c3aaecb` | Crons: surface uncaught exceptions as JSON instead of generic 500 |
| `26202d3` | Cron observability: stop swallowing failures, fix cron_runs schema bug |
| `604d345` | Admin: better diagnostics + fallback for partial-refresh failures |
| `acceb1a` | Admin: every Refresh click verifies every source — panel reflects it |
| `6485ed9` | Admin: wire cron-driven updates into Data Health freshness + cache flush |
| `b628866` | Data pipeline: news_feed RSS+AI ingest + revenue_stacks DSIRE verification |
| `3ae35dd` | Data pipeline: county-level Census ACS — 3,142 counties live-pulled |
| `27d9b4f` | Data pipeline: DSIRE verification layer for state_programs |
| `6e1c6f4` | Data pipeline: live Census ACS pull + multiplexed refresh-data + admin trigger |

> Older entries are in `docs/archive/Running_Notes.md` (Day 1-4 V3 build log preserved verbatim).

---

## Backlog (priority-ranked)

### P1 — Scaffolding shipped 2026-04-30; lights up automatically as data history accrues
- **Markets on the Move WoW deltas** — ✅ scaffolding shipped (`5c30369`). Migration 038 (`state_programs_snapshots`) appends a row per active-CS state on every `state_programs` cron run. UI pulls the deltas via `getStateProgramDeltas()` and renders ↑/↓ pt arrows when ≥2 snapshots exist per state. Falls back to the recency sort + "Xd ago" caption until then. Data accrues automatically; first deltas appear ~2 weeks after migration 038 lands.
- **Library project-card WoW chip** — ✅ scaffolding shipped (this session). Same data source as Markets on the Move; renders a "State ±N pt" pill on each card whose state has moved between weekly snapshots. Honestly labeled "State" because deltas are state-program-level, not per-project. Silent until snapshot history accrues.
- **IX Velocity Index + Program Saturation Index** (Wave 1.4 derived metrics) — `ix_queue_snapshots` accumulating since 2026-04-28 (migration 012 already shipped). Computation logic is the only piece pending; once we have ≥4 weeks of history we'll add an RPC and a chip on the IX card. Readiness recheck **scheduled for 2026-06-03** via /loop agent.
- **Trend chips on KPIs (MetricsBar)** — same pattern: needs `dashboard_metrics_snapshots` history. Revisit when prioritized; the same scaffolding template (migration + cron hook + delta helper) used for `state_programs_snapshots` applies here.

### P2 — Closed: existing solution is correct
- ~~**Search.jsx form inputs → ui/* primitives**~~ — **Reviewed 2026-04-30, deliberately not refactored.** Search.jsx already uses clean `FieldSelect`, `CountyCombobox` field components with shared `labelCls`/`inputCls` Tailwind classes. The grid layout is intentionally dense (5-column on desktop) and forcing the project's `Input.jsx` primitive (designed for stacked-label layout) would degrade not improve. The "deferred to natural touches" guideline in the V3 plan is the right call — substitute incrementally as new fields are added, not as a bulk rewrite.

### P2 — Engineering-ready (real work)
- **Cron-runs latency monitor** — recurring agent (weekly cron or `/schedule`) that scans `cron_runs.duration_ms` p95s for each `cron_name` and flags any source whose p95 exceeds 70% of its function `maxDuration`. Surfaces in admin Data Health (or via PR/email). Catches the *next* `refresh-substations`-class 504 before it ships — the structural class of bug ("sequential per-state calls under a tight function budget") is invisible to syntax/smoke checks; it only shows up under upstream slowness, by which point users see a red panel. Implementation sketch: a `/api/check-cron-latency` endpoint that selects the last 8 successful runs per `cron_name` and computes p95 vs the corresponding vercel.json `maxDuration`; exits with a structured warning summary the admin UI can render. Estimated 2-3h. Pairs naturally with the existing `cron_runs` telemetry already populated by every refresh handler.
- **Wetlands + farmland data layers** (EPA NWI / USDA WSS) — ✅ shipped 2026-05-01 as Path B (`7c49c5c`).

### P3 — Pre-revenue legal / IP (non-engineering, no monthly subscriptions per user preference)
- Hand-roll **Privacy Policy + Terms of Service** (avoiding Termly/Iubenda monthly).
- **LLC formation** before significant revenue.
- **USPTO trademark filing** for "Tractova" wordmark (~$500 flat-fee attorney).
- **Defensive domain registrations** (.io / .app / .ai / typos).

### Accepted dependency risks (dependabot will keep flagging — context here)

| Package | Severity | Why we accept | Resolution path |
|---|---|---|---|
| `xlsx` | high (proto pollution + ReDoS) | Vulns require **parsing** malicious workbooks. We only **write** xlsx (Library export). No npm patch — SheetJS left npm in 2023. | Replace with `exceljs` only if we add xlsx import. Otherwise indefinite. |
| `react-simple-maps` chain (`d3-color` ReDoS) | high ×4 | ReDoS needs user-controlled color strings; we pass static us-atlas topojson. Library abandoned at v3; npm flags downgrade to v1 as the only "fix". | Swap for `@nivo/geo` or similar if the map needs new features. |
| ~~`vite` / `esbuild`~~ | ~~mod ×2~~ | ~~Dev-server-only vulns.~~ | ✅ **Resolved 2026-04-30** by Vite 5→8 upgrade (`3e7df8e`). |

### Deferred until paying-user traction
- **IX Queue Forecaster** (Wave 2 — needs ≥12 weekly snapshots, Q3 launch).
- **Comparable Deals DB** (~30+ Pro users justify build).
- **PUC dockets full crawl** (per-state portals, high curation cost).
- **OpenEI URDB integration** (utility tariff schedules — scale + utility-territory mapping issue).
- **§48(e) Categories 2-4** (Indian Land + low-income residential + economic benefit) — Cat 1 covers most CS projects; 2-4 require additional data layers.

---

## How to update this file

When the user says **"update build log"**, **"log this"**, **"save what we did"**, or similar, Claude should:

1. Run `git log --oneline -5` (or check session memory for new commits) and **prepend** any new commits to the Recent builds table.
2. Update **Pending migrations** — if a new `03X` SQL file was created, add it as ⏳; if user confirmed they ran SQL, flip the relevant row(s) to ✅.
3. Update **Status snapshot** — bump last-commit hash + subject; update the live-data-layers list if a new one shipped or one was removed.
4. Move any **Backlog** items that just shipped into Recent builds (delete from backlog).
5. Add new backlog items if the session generated them.
6. Keep the file concise — if Recent builds exceeds ~25 rows, move the bottom 5 to a "older builds" section or trim into `docs/archive/Running_Notes.md`.

That's the entire protocol. No other planning docs to maintain.
