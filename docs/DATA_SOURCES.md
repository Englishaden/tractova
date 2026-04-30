# Tractova Data Sources

Auditable map of every data layer in the product → its source → API endpoint → cadence → last refresh status.

The bar: **every datum a customer sees in Tractova traces to a verifiable .gov or audited public source.** No hardcoded estimates that can't be audited; no "trust me" numbers.

---

## Status legend

| Symbol | Meaning |
|---|---|
| ✅ | Live-pulled from authoritative source via cron + admin trigger |
| 🔄 | Manual admin curation (with documented source); migration to live-pull queued |
| ⏸ | Deferred — feature dormant or low priority until subscriber count justifies |
| ❌ | Hardcoded estimate (data accuracy issue) — must be migrated |

---

## Data layers

### ✅ Live-pulled (verified sources)

| Table | Source | API endpoint | Cadence | Cron file |
|---|---|---|---|---|
| `lmi_data` (state-level) | US Census ACS 2018-2022 5-year | `api.census.gov/data/2022/acs/acs5` | Weekly (Sun 7am UTC) | `api/refresh-data.js?source=lmi` |
| `county_acs_data` (~3,142 US counties) | US Census ACS 2018-2022 5-year (county-level) | `api.census.gov/data/2022/acs/acs5?for=county:*` | Weekly (Sun 7am UTC) | `api/refresh-data.js?source=county_acs` |
| `state_programs.dsire_*` (verification fields) | DSIRE (NCSU + DOE) | `programs.dsireusa.org/api/v2/programs` | Weekly (Sun 7am UTC) | `api/refresh-data.js?source=state_programs` |
| `revenue_stacks.dsire_*` (verification fields) | DSIRE (NCSU + DOE) | `programs.dsireusa.org/api/v2/programs` | Weekly (Sun 7am UTC) | `api/refresh-data.js?source=revenue_stacks` |
| `revenue_rates.capacity_factor_pct` | NREL PVWatts API v8 | `developer.nrel.gov/api/pvwatts/v8.json` | Quarterly (1st of Jan/Apr/Jul/Oct) | `api/refresh-capacity-factors.js` |
| `revenue_rates.ci_retail_rate_cents_kwh` | EIA Electricity Retail Sales | `api.eia.gov/v2/electricity/retail-sales` | Quarterly (with capacity factors) | `api/refresh-capacity-factors.js` |
| `substations` | EIA Form 860 (Generator-level Plant Data) | `api.eia.gov/v2/electricity/operating-generator-capacity` | Monthly (1st of month, 6am UTC) | `api/refresh-substations.js` |
| `ix_queue_data` | MISO + PJM + NYISO + ISO-NE public queue reports | (ISO-specific scrapers) | Weekly (Sun 6am UTC) | `api/refresh-ix-queue.js` |
| `news_feed` (auto-classified rows) | PV Magazine USA + Solar Industry Mag + Utility Dive + Solar Power World RSS, AI-filtered via Claude Haiku 4.5 | RSS feeds + Anthropic API | Weekly (Sun 7am UTC) | `api/refresh-data.js?source=news` |
| `energy_community_data` (IRA §45/§48 +10% ITC bonus) | DOE NETL EDX — Treasury-recognized Energy Community boundaries (2024 release) | `arcgis.netl.doe.gov/.../2024_MSAs_NonMSAs_that_are_Energy_Communities/FeatureServer/0` + `2024_Coal_Closure_Energy_Communities/FeatureServer/0` | Weekly (Sun 7am UTC) | `api/refresh-data.js?source=energy_community` |

> **Note on `state_programs` partial automation:** DSIRE provides program identity, status, summary text, and the canonical URL — those fields ARE live-pulled. The Tractova-curated fields (`csStatus`, `capacityMW`, `lmiPercent`, `ixDifficulty`, `enrollmentRateMWPerMonth`) are NOT in DSIRE and remain admin-curated. The DSIRE pull adds a verification timestamp + canonical-source link rather than replacing curated values.

> **Note on `news_feed` partial automation:** Manual admin curation continues to work unchanged. Auto-classified rows are tagged `auto_classified=true` with a `relevance_score` (0-100) and `dedupe_hash` so re-runs are idempotent. The classifier inserts only items scoring ≥60. Each article keeps its original outlet (PV Magazine, Utility Dive, etc.) as `source` and the canonical article URL — Tractova does not republish content, only points at the verified source.

> **Note on `energy_community_data` scope:** Two of the three IRA Energy Community qualification paths are covered — Coal Closure Communities (per-tract aggregated to county counts) and MSA / Non-MSA Statistical Areas (per-county boolean). **Brownfield qualification is per-site point data and not covered here**; users see a "verify per-site at energycommunities.gov" link in the Lens revenue stack. A county qualifying via either covered path triggers the +10% ITC bonus credit.

### 🔄 Manual curation pending automation

These are admin-curated today with documented sources. Migration to live-pull is queued but not yet built.

| Table | Should pull from | Cadence (target) | Effort to automate |
|---|---|---|---|
| `state_programs` (CS programs, status, capacity) | DSIRE database (NCSU, federally funded) — `programs.dsireusa.org` | Weekly | ~3h dedicated |
| ✅ `revenue_stacks.dsire_*` (verification layer NEW) | Live-pulled via DSIRE API | Weekly | (already shipped — see above) |
| `revenue_stacks` curated values (REC $/MWh, ITC adders, net-metering rules) | Admin curation backed by DSIRE summary text + state PUC tariff filings | Manual | (admin-only, DSIRE summary aids verification) |
| `county_intelligence` — site-control narrative + IX context | Manual today; needs admin curation per county | Manual | (admin-only)
| ✅ `county_acs_data` — population + LMI density (NEW) | Live-pulled via Census ACS county-level | Weekly | (already shipped — see above) |
| `county_intelligence` — wetland coverage | EPA NWI (National Wetlands Inventory) | Annual | ~3h (multi-API + spatial join) |
| `county_intelligence` — agricultural/farmland | USDA Web Soil Survey | Annual | ~3h |
| ✅ `news_feed` — auto-classified articles (NEW) | RSS + Claude Haiku 4.5 classifier | Weekly | (already shipped — see above) |

### ⏸ Deferred

| Table | Why deferred | Reactivation trigger |
|---|---|---|
| `puc_dockets` | Bespoke per-state PUC e-filing portals; high curation cost; no free unified API | ~30+ paying Pro users justify the build |
| `comparable_deals` | Manual curation only at present; FERC + EIA Form 860 source pipeline doable but ~4-6h | Same trigger as `puc_dockets` |

### Self-populated (no external source)

| Table | Notes |
|---|---|
| `dashboard_metrics` | Computed from above tables via `get_dashboard_metrics()` Postgres RPC |
| `cron_runs` | Logging table for every cron execution |
| `data_updates` | Audit log of admin edits + cron writes |
| `ai_response_cache` | Server-side AI response cache, 6h-24h TTL |
| `share_tokens` | User-generated (Deal Memo Share Link) |
| `project_events` | User-generated (audit log per project) |
| `api_call_log` | Per-user API call rate-limit log |
| `profiles` / `projects` | User-owned; created on signup / save |

---

## Cron schedule (Vercel)

| Endpoint | Cron expression | Description |
|---|---|---|
| `/api/refresh-ix-queue` | `0 6 * * 0` | Sunday 6am UTC — ISO/RTO queue scrape |
| `/api/refresh-data?source=all` | `0 7 * * 0` | Sunday 7am UTC — Multiplexed live-source refresh (`lmi` + `state_programs` + `county_acs` + `news` + `revenue_stacks` + `energy_community`) |
| `/api/check-staleness` | `0 8 * * 1` | Monday 8am UTC — Staleness alert email to admin |
| `/api/send-alerts` | `0 14 * * 1,4` | Mon/Thu 2pm UTC — Project alerts |
| `/api/send-digest` | `0 14 * * 1` | Monday 2pm UTC — Weekly digest |
| `/api/refresh-substations` | `0 6 1 * *` | 1st of month, 6am UTC — EIA Form 860 |
| `/api/refresh-capacity-factors` | `0 7 1 1,4,7,10 *` | Quarterly — NREL PVWatts + EIA retail rates |

Vercel Hobby cap: 12 functions. Currently using 12.

---

## Manual trigger

The Admin panel's **Data Health** tab has a "Refresh data from sources" button that POSTs to `/api/refresh-data?source=all` with admin JWT auth. Use this when:

- The cron lagged (e.g. Sunday cron failed silently)
- Census ACS published new data and you want it now
- Validating a new source after deploy

The button shows live status: which sources refreshed, row counts, total duration. Errors surface inline.

For source-specific refresh (e.g. just LMI): hit `/api/refresh-data?source=lmi` with admin JWT.

---

## Auditing a specific value

Want to confirm where a specific number came from? Process:

1. Open `/admin > Data Health` → look at "Cron History" section. Last 20 cron runs with status + summary.
2. Open the relevant table directly in Supabase SQL editor: `select source, last_updated from {table} where state = 'IL';`
3. The `source` field on every row records the live attribution.

Every row in tables with live-pull also has a `last_updated` timestamp. If it's older than the cron cadence + 50% buffer, something's wrong.

---

## Required env vars

For full live-pull functionality, set these in Vercel project env (matching the existing pattern):

| Var | Required for | Source |
|---|---|---|
| `EIA_API_KEY` | substations + retail rates | https://www.eia.gov/opendata/register.php (free) |
| `NREL_API_KEY` | capacity factors | https://developer.nrel.gov/signup/ (free) |
| `CENSUS_API_KEY` | LMI (optional — works without key at low volume) | https://api.census.gov/data/key_signup.html (free) |
| `ANTHROPIC_API_KEY` | news_feed RSS classifier (Haiku 4.5) | https://console.anthropic.com — already configured for `lens-insight.js` |
| `CRON_SECRET` | (optional) extra auth on cron endpoints | Generate yourself; matches `Authorization: Bearer X` |

If a key is missing, the cron logs a warning and skips — never crashes.

---

## When something looks wrong

If a customer reports "this number looks wrong":

1. Check `last_updated` on the row. Stale data → trigger refresh from Admin > Data Health.
2. Check `cron_runs` for the most recent run of the relevant cron. Failed → see error message.
3. Open the source API directly with the same query the cron uses (URL is in the cron file). If it returns different numbers, our cron logic has a bug — debug + fix.
4. If the source itself is wrong, file an issue with the source agency. We don't second-guess Census ACS / EIA / NREL.

The principle: **Tractova doesn't compute or estimate primary data; it pulls verified data and synthesizes.** Bugs in our pulls are our problem; disagreements with a Census number are between the customer and Census.
