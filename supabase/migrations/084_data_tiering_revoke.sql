-- Migration 084: F-01 data-tiering — REVOKE half (Stage 3 of 3).
--
-- ⚠⚠ DESTRUCTIVE TO ANON READ ACCESS. APPLY ONLY AFTER:
--   1. Migration 083 is applied (is_pro() + the two _public views exist).
--   2. The Stage-2 SPA repoint is deployed to prod AND verified:
--      • logged-out /preview Home renders (map/news/ticker from the coarse views);
--      • /preview?tab=analytics and ?tab=markets show the signup gate, no errors;
--      • logged in as Pro, /search + /library still load every panel.
--   Until all three hold, do not apply this — it removes anon's base read.
--
-- What it does: replaces every `using(true)` (or anon) SELECT policy on the 20
-- synthesized/market tables with a gated one. anon now reads ONLY the two
-- coarse _public views + the DEFINER dashboard RPC + news_feed + puc_dockets.
--
-- Robust drop: rather than naming each live policy (a missed name would leave
-- the permissive policy alive alongside the new one — a silent leak, since
-- Postgres ORs permissive policies), the DO block below drops EVERY SELECT
-- policy on each listed table dynamically. Write policies (insert/update/delete,
-- incl. the migration-058 admin-role policies) are a different cmd and are NOT
-- touched. Service-role (cron + seed) bypasses RLS entirely and is unaffected.
--
-- House rule: Claude writes migrations, Aden applies. Idempotent — safe to re-run.
-- Design + staged rollout: security-audit/F01-data-tiering-design.md §3/§5.

-- ── (1) Drop every SELECT policy on the gated tables (name-independent) ──────
do $$
declare
  _t text;
  _p record;
  _tables text[] := array[
    -- highest-value calibrated/synthesized IP → Pro-only
    'revenue_rates','solar_cost_index','comparable_deals','hosting_capacity_data','revenue_stacks',
    -- Pro IP that an admin widget also reads → Pro OR admin
    'ix_queue_data','policy_impact_events',
    -- .gov-derived / processed → any signed-in user (closes the anon bulk scrape)
    'county_geospatial_data','nmtc_lic_tracts','nmtc_lic_data','cs_projects','cs_specific_yield',
    'county_intelligence','county_acs_data','substations','lmi_data','energy_community_data',
    'hud_qct_dda_data',
    -- preview-view tables: base → authenticated; anon reads the coarse _public view
    'state_programs','state_programs_snapshots'
  ];
begin
  foreach _t in array _tables loop
    for _p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = _t and cmd = 'SELECT'
    loop
      execute format('drop policy if exists %I on public.%I', _p.policyname, _t);
    end loop;
  end loop;
end $$;

-- ── (2) Re-create one gated SELECT policy per table ─────────────────────────

-- Pro-only (calibrated rates / percentile bands / scores — the crown-jewel IP)
create policy "revenue_rates pro read"        on revenue_rates        for select using (public.is_pro());
create policy "solar_cost_index pro read"     on solar_cost_index     for select using (public.is_pro());
create policy "comparable_deals pro read"     on comparable_deals     for select using (public.is_pro());
create policy "hosting_capacity_data pro read" on hosting_capacity_data for select using (public.is_pro());
create policy "revenue_stacks pro read"       on revenue_stacks       for select using (public.is_pro());

-- Pro OR admin (admin reads these outside a Pro context: the IX staleness
-- widget at src/components/admin/IxStalenessAlert.jsx, and policy-event curation)
create policy "ix_queue_data pro read"        on ix_queue_data        for select using (public.is_pro() or public.is_admin());
create policy "policy_impact_events pro read" on policy_impact_events for select using (public.is_pro() or public.is_admin());

-- Any signed-in user (re-hosted public .gov data + processed project facts).
-- Removes the anonymous bulk-scrape path while keeping free-authed county data.
create policy "county_geospatial_data authed read" on county_geospatial_data for select using (auth.role() = 'authenticated');
create policy "nmtc_lic_tracts authed read"        on nmtc_lic_tracts        for select using (auth.role() = 'authenticated');
create policy "nmtc_lic_data authed read"          on nmtc_lic_data          for select using (auth.role() = 'authenticated');
create policy "cs_projects authed read"            on cs_projects            for select using (auth.role() = 'authenticated');
create policy "cs_specific_yield authed read"      on cs_specific_yield      for select using (auth.role() = 'authenticated');
create policy "county_intelligence authed read"    on county_intelligence    for select using (auth.role() = 'authenticated');
create policy "county_acs_data authed read"        on county_acs_data        for select using (auth.role() = 'authenticated');
create policy "substations authed read"            on substations            for select using (auth.role() = 'authenticated');
create policy "lmi_data authed read"               on lmi_data               for select using (auth.role() = 'authenticated');
create policy "energy_community_data authed read"  on energy_community_data  for select using (auth.role() = 'authenticated');
create policy "hud_qct_dda_data authed read"       on hud_qct_dda_data       for select using (auth.role() = 'authenticated');

-- preview-view tables: base table → authenticated; anon goes through the
-- security_invoker=off _public views created in 083 (owner-rights read).
create policy "state_programs authed read"           on state_programs           for select using (auth.role() = 'authenticated');
create policy "state_programs_snapshots authed read" on state_programs_snapshots for select using (auth.role() = 'authenticated');

-- news_feed + puc_dockets: intentionally UNCHANGED — public, non-IP.
-- (puc_dockets remains a full-row anon read; coarsen to a count later if desired.)

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────
-- Verification (run after applying):
--   set role anon;
--   select count(*) from state_programs;             -- 0  (base revoked)
--   select count(*) from state_programs_public;      -- ~51 (view still open)
--   select count(*) from revenue_rates;              -- 0
--   select count(*) from cs_projects;                -- 0
--   select count(*) from ix_queue_data;              -- 0
--   select public.get_dashboard_metrics();           -- counts non-zero (DEFINER)
--   reset role;
-- Then on PROD: anon /preview still renders; log in as Pro → /search+/library
-- load; log in as a FREE user → county panels load, Pro-IP panels show clean
-- empty states (not crashes).
--
-- Rollback (fast): re-add a permissive read per table, e.g.
--   create policy "tmp public read" on revenue_rates for select using (true);
-- (or restore from the pre-084 pg_policies dump). Stage-2 SPA shipped first, so
-- the app keeps working against either source during a rollback.
-- ─────────────────────────────────────────────────────────────────────────
