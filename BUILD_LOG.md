# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it appends the latest commit, flips backlog items to shipped, and updates the migration list. No more juggling Running_Notes / V3_Plan / V2_Plan / Prop_Plan — those are archived in `docs/archive/`.

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

- **Branch:** `main` · last commit: `475a095` Merge: Tailwind v4 + Vite 8 + shadcn
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

✅ Applied through 033 per user confirmation as of 2026-04-29.
⏳ **Pending — apply to activate the §48(e) and HUD layers in production:**

| # | File | What it does | Status |
|---|------|--------------|--------|
| 028 | `news_feed_auto.sql` | RSS+AI ingest columns | ✅ |
| 029 | `revenue_stacks_dsire.sql` | DSIRE verification columns | ✅ |
| 030 | `data_freshness_rpc.sql` | RPC v1 | ✅ |
| 031 | `data_freshness_cron_driven.sql` | RPC reads cron_runs | ✅ |
| 032 | `energy_community_data.sql` | Energy Community table | ✅ |
| 033 | `freshness_energy_community.sql` | RPC +energy_community | ✅ |
| 034 | `hud_qct_dda_data.sql` | HUD QCT/DDA table | ⏳ |
| 035 | `freshness_hud_qct_dda.sql` | RPC +hud_qct_dda | ⏳ |
| 036 | `nmtc_lic_data.sql` | NMTC LIC table | ⏳ |
| 037 | `freshness_nmtc_lic.sql` | RPC +nmtc_lic | ⏳ |

---

## Recent builds (most recent first)

| Commit | Subject |
|--------|---------|
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

### P1 — Unblocks once data history accumulates
- **Wave 1.4 derived metrics** — IX Velocity Index + Program Saturation Index. Needs ≥4 weeks of `ix_queue_snapshots`. Accumulation began 2026-04-28; readiness recheck **scheduled for 2026-06-03** via /loop agent.
- **Markets on the Move → real WoW deltas** — same data-history blocker.
- **Trend chips on KPIs** (V3 §7.2) — same.

### P2 — Engineering-ready
- **Search.jsx form inputs → ui/* primitives** — largest unrefactored surface. shadcn now available; can compose new primitives from `src/components/shadcn/ui/` as the refactor proceeds.
- **Wetlands + farmland data layers** (EPA NWI / USDA WSS) — deferred for spatial-join complexity; revisit if Lens Site Control needs more depth.

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
