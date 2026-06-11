# F-01 — Data-Tiering Implementation Design

> **Status:** design only. READ-ONLY analysis. Migrations are WRITTEN here, **APPLIED by Aden manually**.
> The dangerous `REVOKE` is its **own** migration, applied only **after** the SPA repoint is confirmed live on prod.
> **Order of operations (non-negotiable):** additive view + grant + `is_pro()` helper first → SPA repoint deploys & verified on prod → `REVOKE`/policy-tighten last.
> Author: Claude (Fable 5), 2026-06-11. Owner: Aden. Evidence cited as `path:line` throughout.

---

## 0 — The exposure, in one sentence

Every synthesized/market table is bulk-readable by the Postgres `anon` role today via `... for select using (true)` (or an explicit `anon` policy), and the SPA talks to Supabase **directly** with the anon key (`src/lib/supabase.js:19-22` — one client, anon key, JWT auto-forwarded once signed in). The React preview is a **UI paywall over an open data tap**: a scraper hitting `…/rest/v1/<table>?select=*` with the public anon key gets the entire IP corpus. Migrations 058/059/082 only ever touched **write** policies — every public **read** policy is still live and unmodified (verified: `058_rls_role_based_hardening.sql:26-42` lists exactly which write tables it touched; `082_…nmtc_rls.sql:40-52` only swapped `nmtc_lic_tracts` write policies).

---

## 1 — Recommendation

### Chosen architecture: **B (full-gate) with a hybrid coarse seam for the 3 genuine preview surfaces.**

Gate **all** synthesized tables from `anon` (drop anon read; authenticated reads gated by a new `is_pro()` helper where appropriate). Keep the public preview alive through the **smallest possible coarse seam**: exactly **two** narrow `_public` views (`state_programs_public`, `state_programs_snapshots_public`) exposing only bucket-coarse columns, plus making the existing aggregate-only RPC `get_dashboard_metrics()` `SECURITY DEFINER` so it keeps returning counts after the base read is revoked. `news_feed` stays anon-readable as-is (public .gov-style headlines — no synthesized IP; out of the IP set per the inventory). Everything else faces anon through **nothing**.

**Why (one paragraph):** Aden's stance is MAX security / bare-minimum anon exposure and explicit anti-scrape. Architecture A (a preview view per IP table) creates *N* standing surfaces that must be re-audited on every schema change — each added column is a new leak path, and because `computeFeasibilityScore` ships in the client bundle (`programData.js:96`, "Computed — never stored"), leaking the *coarse inputs* of the score effectively leaks the score. Architecture B sends anon **none** of the scoring inputs and reduces the entire anon attack surface to **three reviewed seams** (two coarse views + one aggregate RPC) instead of ~17 tables. The funnel barely suffers: the preview is *already* JSX-gated down to a choropleth + a feasibility number + news, and a coarse `cs_status`/bucket view keeps the map visually alive while removing the numeric IP.

### Honest leak-risk callout (Aden asked to be told this)

**Yes — keeping ANY public preview meaningfully increases leak risk, on two specific axes:**

1. **`state_programs_public` is the irreducible risk.** Even reduced to `cs_status` + `capacity_mw` (no score, no `ix_difficulty`, no `enrollment_rate`), those two columns are *inputs* to the client-side `computeFeasibilityScore`. A determined scraper who pulls the coarse view for all 51 states + reads the (public, minified-but-readable) formula in the bundle can **partially reconstruct** the relative score ranking. The only way to eliminate this is to drop `state_programs` from the public surface entirely (Aden's stated "shrink to one chart" direction). **Recommendation: ship the coarse view now; when you next shrink the preview, this view is the first thing to delete.**
2. **Every anon seam is a standing maintenance liability.** Two views + one DEFINER RPC must be re-reviewed on every schema/column change. Zero anon seams (no preview at all) is the only configuration with no standing leak surface. If the funnel value of the live map is ever judged lower than the scrape risk, **collapse to zero anon seams** — the design below makes that a one-line change (drop the two views, drop anon EXECUTE on the RPC).

**Bottom line:** B-with-coarse-seam is the most secure option that still renders a working public map. If Aden wants *true* zero-exposure, the same migrations support it — just don't create the two `_public` views and leave `get_dashboard_metrics` SECURITY INVOKER (it'll return zeros for anon, and the preview shows an empty/CTA state).

---

## 2 — Per-table plan

19 tables in scope (17 audit-named + `state_programs_snapshots` + `substations`). `news_feed` and `puc_dockets` are listed for completeness (anon-critical, **not** synthesized IP → stay public).

| table | verdict | anon gets | Pro / authed gets | mechanism |
|---|---|---|---|---|
| `state_programs` | **preview-view** | `state_programs_public` view: `id, name, cs_status, cs_program, capacity_mw, lmi_required, lmi_percent, data_source, last_verified` (NO `ix_difficulty`, `ix_notes`, `program_notes`, `enrollment_rate_mw_per_month`) | full row | base SELECT → `authenticated`; coarse VIEW granted anon |
| `state_programs_snapshots` | **preview-view** | `state_programs_snapshots_public` view: `id, state_id, cs_status, capacity_mw, lmi_required, lmi_percent, snapshot_at` (NO `feasibility_score`, NO `ix_difficulty`) | full row | base SELECT → `authenticated`; coarse VIEW granted anon |
| `news_feed` | **stays public** | unchanged (`select *` where `is_active`) | unchanged | no change — public .gov-style headlines, no synthesized IP |
| `get_dashboard_metrics()` (RPC) | **preview-RPC** | aggregate counts/sums only | same | make `SECURITY DEFINER` so counts survive base REVOKE; keep anon EXECUTE |
| `revenue_rates` | **fully-gate** | nothing | full row | base SELECT → `authenticated` + `is_pro()`; REVOKE anon |
| `solar_cost_index` | **fully-gate** | nothing | full row | base SELECT → `authenticated` + `is_pro()`; REVOKE anon |
| `county_geospatial_data` | **fully-gate** | nothing | full row | base SELECT → `authenticated`; REVOKE anon |
| `nmtc_lic_tracts` | **fully-gate** | nothing | full row | base SELECT → `authenticated`; REVOKE anon |
| `nmtc_lic_data` | **fully-gate** | nothing | full row | base SELECT → `authenticated`; REVOKE anon |
| `ix_queue_data` | **fully-gate** | nothing | full row | base SELECT → `authenticated` + `is_pro()`; REVOKE anon |
| `cs_projects` | **fully-gate** | nothing | full row | base SELECT → `authenticated`; REVOKE anon |
| `cs_specific_yield` | **fully-gate** | nothing | full row | base SELECT → `authenticated`; REVOKE anon |
| `comparable_deals` | **fully-gate** | nothing | full row | base SELECT → `authenticated` + `is_pro()`; REVOKE anon |
| `hosting_capacity_data` | **fully-gate** | nothing | full row | base SELECT → `authenticated` + `is_pro()`; REVOKE anon |
| `county_intelligence` | **fully-gate** | nothing | full row | base SELECT → `authenticated`; REVOKE anon |
| `county_acs_data` | **fully-gate** | nothing | full row | base SELECT → `authenticated`; REVOKE anon |
| `revenue_stacks` | **fully-gate** | nothing | full row | base SELECT → `authenticated` + `is_pro()`; REVOKE anon |
| `substations` | **fully-gate** | nothing | full row | base SELECT → `authenticated`; REVOKE anon (no anon reader; gating is free) |
| `lmi_data` | **fully-gate** | nothing | full row | base SELECT → `authenticated`; REVOKE anon — **NB: `LmiDivergingLollipop.jsx:42-44` is a DIRECT anon read; must be repointed/dropped before REVOKE (see §4)** |
| `energy_community_data` | **fully-gate** | nothing | full row | base SELECT → `authenticated`; REVOKE anon |
| `hud_qct_dda_data` | **fully-gate** | nothing | full row | base SELECT → `authenticated`; REVOKE anon |
| `policy_impact_events` | **fully-gate** | nothing | full row (published) | base SELECT → `authenticated` + `is_pro()`; REVOKE anon |
| `puc_dockets` | **stays public (full row)** | **whole row** (`using(true)`, migration 020) | unchanged | `StateDetailPanel.jsx:529` fires `getPucDockets({state})` for a tab-badge count in preview, **but RLS is row-level so anon can `select *`** — it's a full-row anon read, not just a count. Not synthesized-rate IP (regulatory docket metadata), so left public this pass; **coarsen to a count RPC or a `_public` view when the preview shrinks** (tracked, not gated now) |

**`is_pro()` distinction:** tables marked "`+ is_pro()`" carry calibrated rates / percentile bands / offtake $ (the highest-value IP — `revenue_rates`, `solar_cost_index`, `ix_queue_data`, `comparable_deals`, `hosting_capacity_data`, `revenue_stacks`, `policy_impact_events`). For these, free-authed users get **nothing** (Pro-only). The rest use plain `authenticated` (free-authed may read; they're county/.gov-derived and already only fire from `/search`/`/library` behind `ProtectedRoute`). Aden's call — if MAX-security means "free-authed gets nothing either," make **all** fully-gate tables `+ is_pro()` (trivial: same predicate everywhere).

**Verdict bucket counts:** **2 preview-view** (`state_programs`, `state_programs_snapshots`) · **17 fully-gate** · **3 stay-public** (`news_feed`, `puc_dockets`, `get_dashboard_metrics` RPC).

**Reconciliation note (one inventory conflict resolved against the source):** the §2 anon-model analysis claimed `state_programs_snapshots` SELECT is authenticated-only and anon "silently gets an empty Map." **That is wrong** — `038_state_programs_snapshots.sql:52-57` defines an **explicit `anon users read` policy** alongside the authenticated one (permissive policies OR together), so anon **can** read snapshots today, including `feasibility_score`. The SPA-read inventory (which marks the snapshot reads PUBLIC/anon-critical) is correct; the per-table inventory verdict (`preview-view`) is correct. The Stage-2 REVOKE must drop **both** snapshot SELECT policies and re-add an authenticated-only one. Confirmed at `038:43-57`.

---

## 3 — Exact SQL

Split into **Migration X (additive, safe anytime)** and **Migration Y (REVOKE, only after SPA live)**. Idempotent, `notify pgrst` at the end of each, per house pattern (058/082).

### Migration X — `083_data_tiering_additive.sql` ✅ BUILT (ADDITIVE — safe to apply anytime, zero prod risk)

Creates the `is_pro()` helper, the two coarse `_public` views, and flips the dashboard RPC to `SECURITY DEFINER`. **Adds nothing that removes access** — anon still reads base tables until Migration Y. Building + applying this alone changes no current behavior. **The authoritative file is `supabase/migrations/083_data_tiering_additive.sql`** (verified against the live schema). Two corrections vs the draft below, both folded into the shipped file:

1. **The RPC is flipped with `ALTER FUNCTION`, not `CREATE OR REPLACE`.** The draft reproduced the `schema.sql:145` body — but that is the **stale 005 body**; the live definition is **migration 040** (adds `lastRefreshAt = max(cron_runs.finished_at)`). Re-creating from the draft would have dropped `lastRefreshAt` and regressed the footer's freshness caption. `ALTER FUNCTION public.get_dashboard_metrics() security definer set search_path = public;` flips the mode + pins search_path while leaving the live body untouched.
2. **`security_invoker = off` comment corrected** — the draft's "PG < 15 / PG15+" claim was an unverified version assertion (fails CLAUDE.md §3). The shipped comment states the behavior we *set explicitly* (owner-rights read; anon needs SELECT on the view only; the coarse projection is the guard) with no version claim.

Draft SQL (superseded by the shipped file — kept for review):

```sql
-- Migration 083: F-01 data-tiering, ADDITIVE half.
-- Creates is_pro() helper + coarse public views + DEFINER dashboard RPC.
-- REMOVES NOTHING. Anon retains base-table read until migration 084 (REVOKE).
-- House rule: Claude writes, Aden applies. Idempotent — safe to re-run.

-- ── (a) is_pro() — mirrors is_admin() (058:50-67): STABLE SECURITY DEFINER ───
create or replace function public.is_pro()
returns boolean
language sql
stable
security definer            -- read profiles even under tightened RLS, like is_admin()
set search_path = public, auth
as $$
  select coalesce(
    (select subscription_tier = 'pro'
            and subscription_status in ('active', 'trialing')
       from profiles
      where id = auth.uid()),
    false
  );
$$;

comment on function public.is_pro() is
  'True if current JWT subject is a paid Pro (profiles.subscription_tier=pro AND subscription_status in active/trialing). Mirrors is_admin() (058). Used by RLS SELECT policies on IP tables (F-01).';

-- ── (b) coarse public VIEWS — only preview-OK columns, NO synthesized IP ─────
-- state_programs_public: drops ix_difficulty / ix_notes / program_notes /
-- enrollment_rate_mw_per_month (all Tractova-curated synthesis).
create or replace view public.state_programs_public as
  select id, name, cs_status, cs_program, capacity_mw,
         lmi_required, lmi_percent, data_source, last_verified
    from public.state_programs;

-- state_programs_snapshots_public: drops feasibility_score + ix_difficulty (IP).
create or replace view public.state_programs_snapshots_public as
  select id, state_id, cs_status, capacity_mw,
         lmi_required, lmi_percent, snapshot_at
    from public.state_programs_snapshots;

-- Views run with the VIEW OWNER's privileges by default (non-SECURITY_INVOKER
-- in PG < 15 behavior; on Supabase PG15+ set security_invoker=off explicitly so
-- the view can read the base table even after base RLS excludes anon).
alter view public.state_programs_public            set (security_invoker = off);
alter view public.state_programs_snapshots_public  set (security_invoker = off);

grant select on public.state_programs_public           to anon, authenticated;
grant select on public.state_programs_snapshots_public to anon, authenticated;

-- ── (c) dashboard RPC → SECURITY DEFINER so aggregate counts survive REVOKE ──
-- get_dashboard_metrics() (schema.sql:145) is SECURITY INVOKER today; once anon
-- loses base SELECT on state_programs/ix_queue_data/news_feed, an INVOKER RPC
-- returns zeros for anon. DEFINER keeps the aggregate-only counts working.
-- (Body unchanged from schema.sql:145-167 — counts/sums only, no row leakage.)
create or replace function public.get_dashboard_metrics()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'statesWithActiveCS',
      (select count(*) from state_programs where cs_status = 'active'),
    'statesWithAnyCS',
      (select count(*) from state_programs where cs_status in ('active','limited','pending')),
    'utilitiesWithIXHeadroom',
      (select count(distinct utility_name) from ix_queue_data),
    'policyAlertsThisWeek',
      (select count(*) from news_feed where is_active = true
        and published_at >= current_date - interval '7 days'),
    'avgCSCapacityRemaining',
      concat((select round(avg(capacity_mw)) from state_programs where cs_status = 'active'), ' MW avg'),
    'totalMWInPipeline',
      (select coalesce(sum(capacity_mw),0) from state_programs where cs_status in ('active','limited')),
    'lastUpdated',
      (select to_char(max(last_verified), 'YYYY-MM-DD') from state_programs)
  );
$$;

revoke all on function public.get_dashboard_metrics() from public;
grant execute on function public.get_dashboard_metrics() to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- Verification (run after apply):
--   select public.is_pro();                                   -- false for anon
--   select * from public.state_programs_public limit 1;        -- coarse cols only
--   select count(*) from public.state_programs_snapshots_public;
--   select public.get_dashboard_metrics();                     -- counts non-zero
```

> **Live-probe requirement before Migration Y (CLAUDE.md §3 / verify-live-state) — MANDATORY:** confirmed-from-source names (safe to use as-is): `"public read state_programs"` (`schema.sql:181`), `"public read county_intelligence"` (`schema.sql:184`), `"public read revenue_stacks"` (`schema.sql:187`), `"public read news_feed"` (`schema.sql:190`, stays), and the snapshot pair `"authenticated users read state_programs_snapshots"` + `"anon users read state_programs_snapshots"` (`038:44,53`). All OTHER tables' SELECT-policy names (`revenue_rates` 003, `ix_queue_data` 002, `substations` 004, and the per-table `*_public read` policies in 020/023/025/027/032/034/036/039/048/050/053/061) **must be read from `pg_policies` before writing `drop policy`** — if a real live name is missed, the old `using(true)` policy **survives** alongside the new one (permissive OR) and anon read is NOT revoked: a silent leak. The Stage-3 verify (`set role anon; select count(*) … → 0`) is the mandatory catch — do not skip it. The block below is a **template**; fill real names from the probe.

### Migration Y — `084_data_tiering_revoke.sql` ✅ WRITTEN (REVOKE — apply ONLY after SPA confirmed live on prod)

> **The shipped `supabase/migrations/084_data_tiering_revoke.sql` supersedes the placeholder template below.** It does NOT depend on knowing live policy names: a `DO` block drops **every** SELECT policy on each of the 20 gated tables dynamically (querying `pg_policies` inside the migration), then re-creates one gated policy per table — eliminating the "missed name = silent leak" risk the adversarial review flagged (better than the probe-then-drop-by-name approach). Predicates: Pro-only on the 5 calibrated-IP tables (`revenue_rates`, `solar_cost_index`, `comparable_deals`, `hosting_capacity_data`, `revenue_stacks`); `is_pro() OR is_admin()` on `ix_queue_data` + `policy_impact_events`; `authenticated` on the 11 .gov-derived tables + the 2 preview-view base tables. Write policies (different `cmd`) are untouched. The template below is retained for reference.

```sql
-- Migration 084: F-01 data-tiering, REVOKE half. DESTRUCTIVE TO ANON ACCESS.
-- ⚠ APPLY ONLY AFTER the SPA repoint (§4) is deployed to prod AND verified:
--   anon /preview renders from *_public views, no console RLS errors,
--   Pro /search + /library still load every panel.
-- Rollback = re-GRANT anon (see §5). House rule: Claude writes, Aden applies.

-- ── For each IP table: drop the using(true)/anon SELECT policy, add a gated one
-- ── Policy NAMES below are PLACEHOLDERS — replace from the pg_policies probe.

-- ===== fully-gate, plain authenticated =====
drop policy if exists "<live name>" on county_geospatial_data;
create policy "county_geospatial_data authed read" on county_geospatial_data
  for select using (auth.role() = 'authenticated');

drop policy if exists "<live name>" on nmtc_lic_tracts;
create policy "nmtc_lic_tracts authed read" on nmtc_lic_tracts
  for select using (auth.role() = 'authenticated');

drop policy if exists "<live name>" on nmtc_lic_data;
create policy "nmtc_lic_data authed read" on nmtc_lic_data
  for select using (auth.role() = 'authenticated');

drop policy if exists "<live name>" on cs_projects;
create policy "cs_projects authed read" on cs_projects
  for select using (auth.role() = 'authenticated');

drop policy if exists "<live name>" on cs_specific_yield;
create policy "cs_specific_yield authed read" on cs_specific_yield
  for select using (auth.role() = 'authenticated');

drop policy if exists "public read county_intelligence" on county_intelligence;  -- schema.sql:184
create policy "county_intelligence authed read" on county_intelligence
  for select using (auth.role() = 'authenticated');

drop policy if exists "<live name>" on county_acs_data;
create policy "county_acs_data authed read" on county_acs_data
  for select using (auth.role() = 'authenticated');

drop policy if exists "<live name>" on substations;
create policy "substations authed read" on substations
  for select using (auth.role() = 'authenticated');

drop policy if exists "<live name>" on lmi_data;
create policy "lmi_data authed read" on lmi_data
  for select using (auth.role() = 'authenticated');

drop policy if exists "<live name>" on energy_community_data;
create policy "energy_community_data authed read" on energy_community_data
  for select using (auth.role() = 'authenticated');

drop policy if exists "<live name>" on hud_qct_dda_data;
create policy "hud_qct_dda_data authed read" on hud_qct_dda_data
  for select using (auth.role() = 'authenticated');

-- ===== fully-gate, Pro-only (highest-value calibrated/synthesized IP) =====
drop policy if exists "<live name>" on revenue_rates;
create policy "revenue_rates pro read" on revenue_rates
  for select using (public.is_pro());

drop policy if exists "<live name>" on solar_cost_index;
create policy "solar_cost_index pro read" on solar_cost_index
  for select using (public.is_pro());

drop policy if exists "<live name>" on ix_queue_data;   -- 002:31 region — confirm via pg_policies probe
create policy "ix_queue_data pro read" on ix_queue_data
  for select using (public.is_pro() or public.is_admin());   -- admin staleness widget (IxStalenessAlert.jsx:16) — admin may not be Pro

drop policy if exists "<live name>" on comparable_deals;
create policy "comparable_deals pro read" on comparable_deals
  for select using (public.is_pro());

drop policy if exists "<live name>" on hosting_capacity_data;
create policy "hosting_capacity_data pro read" on hosting_capacity_data
  for select using (public.is_pro());

drop policy if exists "public read revenue_stacks" on revenue_stacks;  -- schema.sql:187
create policy "revenue_stacks pro read" on revenue_stacks
  for select using (public.is_pro());

drop policy if exists "<live name>" on policy_impact_events;
create policy "policy_impact_events pro read" on policy_impact_events
  for select using (public.is_pro() and is_active = true and review_status = 'published');

-- ===== preview-view tables: base → authenticated; anon goes through the view =====
drop policy if exists "public read state_programs" on state_programs;  -- schema.sql:181
create policy "state_programs authed read" on state_programs
  for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated users read state_programs_snapshots" on state_programs_snapshots;  -- 038:44
drop policy if exists "anon users read state_programs_snapshots"          on state_programs_snapshots;  -- 038:53
create policy "state_programs_snapshots authed read" on state_programs_snapshots
  for select using (auth.role() = 'authenticated');

-- news_feed + puc_dockets: intentionally UNCHANGED (public, non-IP).

notify pgrst, 'reload schema';

-- Verification (run after apply):
--   set role anon;
--   select count(*) from state_programs;            -- expect 0 (RLS blocks)
--   select count(*) from state_programs_public;     -- expect 51 (view still open)
--   select count(*) from revenue_rates;             -- expect 0
--   select public.get_dashboard_metrics();          -- counts still non-zero (DEFINER)
--   reset role;
```

---

## 4 — SPA repoint list

> **✅ STAGE 2 IMPLEMENTED (2026-06-11, commit pending) — with one deliberate simplification.** Instead of surgically gating the 5 IP charts individually (which would leave *other* charts on the same tabs rendering DEGRADED anon data — e.g. `IxDifficultyDonut` showing all-"moderate" once the view drops `ix_difficulty`), the **Analytics + Markets tabs are gated whole** for anon via the existing `PreviewSignupGate` (`Dashboard.jsx`, keyed on `effectivePreviewMode = previewMode && !user`). This is cleaner, removes the degraded-chart problem, and matches Aden's stated "shrink the preview toward just Home" direction. The Home tab stays the rich public preview. Net SPA changes actually shipped: **`programData.js`** — `getStatePrograms` auth-branch (anon→`state_programs_public`, authed→base), `getStateProgramDeltas` anon-empty, `getDashboardMetricsHistory` → `state_programs_snapshots_public`; **`Dashboard.jsx`** — tab gate; **`tests/smoke.spec.js`** — new anon-tab-gate test. The `IxStalenessAlert`/`ix_queue_data` admin fix is deferred to Migration Y (predicate `is_pro() OR is_admin()`), not a Stage-2 SPA change. Verified: 9 smoke + full verify green. **Free-authed UX note for Stage 3:** once 084 gates the synthesized tables on `is_pro()`, free *logged-in* users lose those panels in `/search`+`/library` (they currently see them — an existing free-sees-Pro-data gap the REVOKE also closes). Intended tiering, but eyeball `/search` as a free authed user post-084 to confirm graceful empty states, not crashes.

The original per-site plan (below) is retained for reference / Stage 3 cross-checking.

All reads are centralized in **`src/lib/programData.js`** (the single data layer; ~95% of reads). The repoint is mostly **one file** — swap the `.from('<base>')` target inside the relevant `get*` fetchers; consumers receive the same normalized camelCase shapes and need no edits. Three components read Supabase directly and bypass the layer — two are anon-critical and MUST be handled before the REVOKE.

### Reads to REPOINT to the coarse `_public` views (anon-critical — break under REVOKE otherwise)

| file:line | function | change |
|---|---|---|
| `programData.js:103-111` | `getStatePrograms` | `.from('state_programs')` → `.from('state_programs_public')`. The view omits `ix_difficulty`/`enrollment_rate_mw_per_month`/`*_notes`; `normalize()`/`computeFeasibilityScore` (`:96`) must tolerate those being absent for anon. **Decision:** for an authed user keep reading the **base** `state_programs` (full row, so the Pro score stays accurate); for anon read the view. Branch on `useAuth().user` (pass a flag, or read session in the layer). Simplest: the layer checks `supabase.auth.getSession()` once and picks the source. |
| `programData.js:448-452` | `getStateProgramDeltas` | reads `feasibility_score` — **IP, must NOT reach anon.** The `_public` snapshot view omits `feasibility_score`, so this function **cannot** serve anon "Markets on the Move" as-is. **Decision (recommended): drop the score-delta movers from the anon preview** (Aden's "shrink the preview" direction). For authed users, keep reading base `state_programs_snapshots`. For anon, return an empty Map (the UI already handles empty → no movers). |
| `programData.js:525-528` | `getDashboardMetricsHistory` (snapshots half) | reads `state_id, cs_status, capacity_mw, snapshot_at` — all coarse → repoint `.from('state_programs_snapshots')` → `.from('state_programs_snapshots_public')`. News half (`:529-534`) unchanged (news_feed stays public). |
| `programData.js:986` | `getDashboardMetrics` (RPC) | no code change — RPC becomes DEFINER in Migration X, stays anon-callable. |
| `programData.js:796-803` | `getNewsFeed` | no change — `news_feed` stays public. |
| `programData.js:827` | `getPucDockets` | no change — `puc_dockets` stays public (badge count). |

### Direct-read components (bypass the layer) — anon-critical, MUST change before REVOKE

| file:line | reads | fix |
|---|---|---|
| `LmiDivergingLollipop.jsx:42-44` | `lmi_data` → `lmi_pct, lmi_households, total_households, median_household_income` (IP) | **Anon Analytics tab.** `lmi_data` is fully-gated → this breaks for anon under REVOKE. **Decision: remove this chart from the anon preview** (gate behind `user`/`isPro`), OR route through a new coarse `lmi_data_public` view if Aden wants it to stay. Recommended: drop from preview (it's per-state LMI %, IP-class). |
| `FeasibilityScoreDeltas.jsx:34-38` | `state_programs_snapshots` → `feasibility_score` (IP) | **Anon Analytics tab.** Same as `getStateProgramDeltas`: `feasibility_score` is IP. **Decision: gate this chart behind `user`** (remove from anon preview). The `_public` snapshot view deliberately omits the score, so there is no anon-safe source for it. |
| `IxStalenessAlert.jsx` | `ix_queue_data` (`state_id, iso, utility_name, fetched_at`) | **Admin-only surface (DataHealthTab), not anon.** `ix_queue_data` is Pro-gated; admin JWT satisfies `authenticated` so it survives if read predicate is `authenticated`, but it's `is_pro()`-gated in the plan. Admin ≠ Pro. **Fix: either (a) add `or public.is_admin()` to the `ix_queue_data` SELECT policy, or (b) repoint this admin component through a service-role `/api/` path.** Flagged — admin staleness widget would break under a pure `is_pro()` gate. |

### Pro deep-dive reads — LEAVE on base tables (no change)

All of these fire **only** from `/search` (Lens) or `/library` behind `ProtectedRoute`, or `/admin` — never for anon. They keep reading base tables; `is_pro()`/`authenticated` RLS lets a Pro/authed user through. No repoint needed: `getCountyData` (`:142,151`), `resolveCountyFips` (`:207,215`), `fetchCountyGeospatial` (`:229`), `getRevenueStack` (`:301`), `getEnergyCommunity` (`:340`), `getNmtcLic` (`:377`), `getHudQctDda` (`:412`), `getComparableDeals` (`:868`), `getLmiData` (`:913`), `getCountyAcsData` (`:954`), `getIXQueueData` (`:1102`), `getHostingCapacity` (`:1253`), `fetchSolarCostLineage` (`:1311`), `fetchAllSolarCostLineage` (`:1327`), `getRevenueRates` (`:1344`), `getAllRevenueRates` (`:1364`), `getSpecificYieldLineage` (`:1405`), `getCsMarketSnapshot` (`:1474`), `getCsProjectsAsComparables` (`:1587`), `getAllIXQueueData` (`:1631`), `getSubstations` (`:1644`), `getAllCountyData` (`:1664`), `getPolicyImpactEvents` (`:1785`).

### Anon-critical reads that WOULD break and need a per-function decision (the watch list)

These fire for logged-out `/preview` and hit a **fully-gate** table → they return empty under REVOKE unless handled:

- `getCsProjectsAggByState` (`programData.js:703`) — `OperatingCsProjectsDot` (Analytics). `cs_projects` fully-gated. **Decision: gate the chart behind `user`** (drop from anon preview) — there's no coarse view for it and per-project aggregates are IP-adjacent.
- `getCsSubscriptionMixByState` (`programData.js:751`) — `SubscriptionMixChart` (Markets). Same call → same decision (drop from anon preview or add a coarse `cs_projects` view; recommended: drop).
- `getTopCsStatesByActivity` (`programData.js:670`) — **ORPHANED** (no caller). No action; safe.

**Central module to touch: `src/lib/programData.js` (one file for the layer repoints) + the 2 anon-critical direct-read charts (`LmiDivergingLollipop.jsx`, `FeasibilityScoreDeltas.jsx`) + 2 anon-critical chart consumers (`OperatingCsProjectsDot`, `SubscriptionMixChart`) gated behind `user`.** The `IxStalenessAlert.jsx` admin fix is the only non-anon repoint.

### SPA read-site repoint count

- **Repoint to `_public` view:** **3** (`getStatePrograms`, `getDashboardMetricsHistory` snapshot half, + auth-branch in the layer for `getStateProgramDeltas`).
- **Gate behind `user` / drop from anon preview:** **5** (`getStateProgramDeltas` movers, `LmiDivergingLollipop.jsx`, `FeasibilityScoreDeltas.jsx`, `OperatingCsProjectsDot`/`getCsProjectsAggByState`, `SubscriptionMixChart`/`getCsSubscriptionMixByState`).
- **Admin policy/repoint fix:** **1** (`IxStalenessAlert.jsx` / `ix_queue_data` admin-vs-Pro).
- **No change:** RPC, `news_feed`, `puc_dockets`, all ~23 Pro deep-dive reads.

**Total read sites that must change before/at REVOKE: 9** (3 repoint + 5 gate/drop + 1 admin).

---

## 5 — Staged rollout order (with verify gate + per-stage rollback)

Everything is **additive and reversible** until Stage 3. Stages 1–2 carry **zero anon-access risk** (anon still reads base tables throughout).

### Stage 1 — Apply Migration X (additive DB) — *zero prod risk, ship immediately*
- **Build:** write `083_data_tiering_additive.sql` (§3). Aden applies it manually.
- **What changes:** `is_pro()` exists; two `_public` views exist + granted; `get_dashboard_metrics` is now DEFINER. **No access removed.** The live SPA keeps reading base tables exactly as today.
- **Verify gate:** run the §3 verification block — `is_pro()` returns false for anon, both views return rows, RPC still returns non-zero counts. Confirm `npm run build` is green (no app change yet, so this is just hygiene).
- **Rollback:** `drop view state_programs_public, state_programs_snapshots_public; drop function is_pro();` and re-create `get_dashboard_metrics` as the original SECURITY INVOKER body (`schema.sql:145`). Pure additive — rollback removes only the new objects.

### Stage 2 — SPA repoint deploy (§4) — *anon still has base read; repoint is safe*
- **Build:** edit `programData.js` (repoint `getStatePrograms` + `getDashboardMetricsHistory` to the views with an auth branch; make `getStateProgramDeltas` anon-empty) + gate the 5 anon charts behind `user` + fix `IxStalenessAlert`/`ix_queue_data` admin path.
- **Ship:** `npm run verify` (build + Playwright smoke) → `git push origin main` → Vercel prod.
- **Verify gate (the critical one):** on **prod**, logged-out: (1) `/preview` renders the map from `state_programs_public`, metrics tiles from the DEFINER RPC, news from `news_feed`; (2) **`/preview?tab=analytics` AND `/preview?tab=markets` explicitly** — the IP charts (`LmiDivergingLollipop`, `FeasibilityScoreDeltas`, `OperatingCsProjectsDot`, `SubscriptionMixChart`) are reachable by URL param (`Dashboard.jsx:68-69` reads `tab` from `searchParams` with no preview gate), so confirm each shows its gated/CTA state, **not a crash and not live data**. **No console RLS/empty errors** on any tab. Logged-in **Pro** `/search` + `/library` load every panel (still reading base tables — RLS not yet tightened, so this proves the *repoint* independent of the *gate*). **Do not proceed to Stage 3 until all of this is confirmed live.**
- **Rollback:** `git revert` the SPA commit + push. Base tables are still anon-readable, so reverting fully restores the prior preview. No DB change to undo.

### Stage 3 — Apply Migration Y (REVOKE) — *the one irreversible-feeling step; rollback = re-GRANT*
- **Build:** write `084_data_tiering_revoke.sql` (§3) **after** probing live `pg_policies` for the real policy names. Aden applies it manually (his step).
- **What changes:** anon loses base read on all 19 IP tables; reads now go through `is_pro()`/`authenticated` (Pro/authed) or the `_public` views (anon).
- **Verify gate:** run the §3 anon-role verification (`set role anon; select count(*) from state_programs` → 0; from `state_programs_public` → 51; from `revenue_rates` → 0; RPC counts non-zero). Then re-confirm prod anon `/preview` still renders and Pro `/search`/`/library` still load.
- **Rollback (fast, safe):** re-add the permissive base policies — `create policy "<name> public read" on <table> for select using (true);` per table (or restore from the pre-084 `pg_policies` dump). Re-granting `using(true)` instantly restores anon read. Because Stage 2 shipped first, even a partial rollback leaves the SPA working (it can read either source).

---

## 6 — Breakage analysis (per stage, per audience)

| stage | anon (logged-out `/preview`) | free (logged-in) | Pro | admin |
|---|---|---|---|---|
| **1 (Migration X)** | no change — still reads base tables | no change | no change | no change |
| **2 (SPA repoint)** | reads coarse views + DEFINER RPC; 5 IP charts now gated/CTA (intended). **No break** — base read still permitted, so even un-repointed paths work | no change (still reads base) | no change (still reads base) | `IxStalenessAlert` fix lands here; no break | 
| **3 (REVOKE)** | only `_public` views + RPC + `news_feed`/`puc_dockets` resolve; everything else returns empty by RLS — but the SPA already stopped requesting those for anon in Stage 2, so **nothing visibly breaks** | loses base read on `is_pro()` tables (Pro-only) and gets `authenticated` tables; free-authed isn't a rich data tier today (§ anon-model analysis) so impact is limited to Lens panels they couldn't use anyway (Lens AI is 403-gated server-side at `api/lens-insight.js`) | unaffected — `is_pro()` + `authenticated` both pass for an active Pro JWT (JWT reaches Postgres, confirmed via `useSubscription.js:53-57` round-trip) | `ix_queue_data` admin staleness widget survives **only if** the Stage-2 admin fix (add `or public.is_admin()` or service-role path) shipped — otherwise it breaks. This is why the admin fix is in Stage 2, not 3 |

**Why the order avoids breakage:** the SPA stops *requesting* gated tables for anon (Stage 2, while base read is still allowed and verifiable) **before** the DB stops *serving* them (Stage 3). At no point is there a window where the SPA asks anon for a table the DB has already locked — Stage 2 is verified live on prod before Stage 3 is even written. Pro paths never change source, so they're insulated throughout.

---

## 7 — Residual risk & limits (honest)

1. **Minified client JS is still readable.** Gating the *data* does not hide the *code*. The bundle still ships `computeFeasibilityScore` (`programData.js:96`) and `scoreEngine.js`, and `/methodology` publishes the methodology. A scraper can read the formula; they just can't pull the proprietary **inputs** anymore (calibrated rates, percentile bands, per-county synthesis). This fix protects the **dataset** (the IP that matters), not the algorithm.
2. **Server-side scoring is OUT OF SCOPE (Aden's call).** Moving `scoreEngine.js` / the Lens context-assembly behind the API so the methodology + inputs never ship client-side is a separate, larger project (would require re-routing reads through `api/` against the 12-function cap, and there's no server-side re-fetch of Lens context tables today — `api/lens-insight.js` receives `stateProgram/countyData/revenueStack/ixQueue` in the **request body** from the Pro client, which still reads them via `is_pro()` RLS after this fix, so Lens keeps working). **Flagged, not built here.**
3. **The `state_programs_public` view is the irreducible anon leak (see §1 callout).** `cs_status` + `capacity_mw` are score inputs; combined with the public formula they enable partial score reconstruction. The mitigation is to delete the view when the preview shrinks further — the design makes that a one-line change.
4. **Column-level vs row-level RLS caveat.** Postgres RLS is **row**-level, not column-level. We cannot say "anon may read `state_programs` but only these columns" at the policy layer — hence the **view** mechanism for the 2 preview tables (a view is the standard Postgres column-projection tool). Every column a view exposes is a deliberate, audited choice; adding a column to a `_public` view is a security decision, not a cosmetic one. Keep the views minimal.
5. **`is_pro()` is SECURITY DEFINER and reads `profiles`** — same trust model as the shipped `is_admin()` (`058:50-67`); a `search_path` pin (`set search_path = public, auth`) prevents search-path hijack. No new attack surface beyond what `is_admin()` already accepts.
6. **Free-authed remains a thin data tier.** This fix doesn't create a rich "free logged-in" data tier; it just removes anon's bulk read. If Aden later wants free-authed to see *less* than now, flip the `authenticated`-only tables to `is_pro()` too (one-line predicate swap per policy).
7. **View ownership / `security_invoker`.** The `_public` views must be owned by a role that retains base-table read (the migration runner / postgres), and `security_invoker = off` is set explicitly so the view reads the base table with the owner's rights even after anon loses direct base SELECT. Verify on the live Supabase PG version that `security_invoker = off` is the effective default for these two views post-apply (the §3 verification `select count(*) from state_programs_public as anon` covers this).
