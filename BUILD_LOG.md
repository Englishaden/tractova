# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it appends the latest commit, flips backlog items to shipped, and updates the migration list. No more juggling Running_Notes / V3_Plan / V2_Plan / Prop_Plan — those are archived in `docs/archive/`.

---

## 🔴 Active issues — pick up tomorrow first

### NMTC LIC handler still failing with same wildcard error

**Symptom (last seen 2026-04-29 ~10:38 PM):**

```
multiplexed · 8 sources · PARTIAL
  ✓ lmi · state_programs · county_acs · news · revenue_stacks
    energy_community · hud_qct_dda
  ✗ nmtc_lic — Census tract 400: error: wildcard not allowed
    for 'state' in geography hierarchy
substations / ix_queue / capacity → all OK ✓
```

**What's already done:**

- Commit `9ba2086` rewrote the handler to iterate state-by-state (explicit
  FIPS like `in=state:01`) instead of the wildcard `in=state:*`. The old
  code definitely had the wildcard; the new code definitely does not.
- Build is clean.

**Most likely cause when retesting:**

1. **Vercel hadn't deployed `9ba2086` yet** when the user clicked Refresh.
   Vercel deploys take 1-3 min after push. The error message is identical
   to the pre-fix version, suggesting the old code was still live.

**First step tomorrow:**

1. Confirm the live deploy includes `9ba2086` — Vercel dashboard → latest
   deployment → check commit hash matches `9ba2086` (or newer).
2. If yes, click Refresh again. NMTC should show ✓ with new fields:
   `counties_with_lic`, `total_qualifying_tracts`, `states_pulled_successfully`.
3. If still ✗ with the same error, the fix has a remaining bug. Investigate:
   - Open `api/refresh-data.js` → `refreshNmtcLic` → confirm the URL string
     interpolates a real FIPS, not `*`. The relevant line should read:
     `&for=tract:*&in=state:${stateFips}` where `stateFips` comes from
     iterating `Object.keys(FIPS_TO_USPS)`.
   - Worst case, log the actual URL string before the fetch to confirm
     what's being sent to Census API.
4. If a specific state's call 400s for a different reason, the new
   `state_fetch_errors[]` array will surface it (first 10 errors shown in
   the cron summary panel — Copy report button gives the full payload).

**Related context:**

- Substations / IX queue / capacity factors all OK now — the
  `.catch`-on-builder bug (commit `4016fca`) is fully resolved.
- Migrations 034 (HUD QCT/DDA) + 036 (NMTC LIC) status: probably applied
  since `hud_qct_dda` shows ✓ in the multiplexed run. Verify in Supabase.

---

## Status snapshot

- **Branch:** `main` · last commit: `9ba2086` Fix: NMTC LIC handler — iterate tract pulls per-state
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
- **Multiplexed cron:** Sunday 7am UTC `/api/refresh-data?source=all` fans out 8 sub-sources. Plus 3 separate cron functions for substations / IX queue / capacity factors (Hobby 12-function cap).
- **Admin manual refresh:** `/admin > Data Health > Refresh data from sources` parallel-fans-out to all 4 endpoints with admin JWT auth.

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
| `9ba2086` | Fix: NMTC LIC handler — iterate tract pulls per-state (Census wildcard fix) ⚠ verify next session |
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
- **Search.jsx form inputs → ui/* primitives** — largest unrefactored surface; deferred to natural touches per V3 plan.
- **Tailwind v3 → v4 + Vite 5 → 8 upgrade** — dedicated session, ~3-5h, unlocks shadcn permanently.
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
| `vite` / `esbuild` | mod ×2 | Both dev-server-only vulns. Production ships pre-built static assets — runtime never touches vite/esbuild. | Resolved by the **Vite 5→8** P2 backlog item. |

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
