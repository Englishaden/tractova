-- Migration 058: role-based RLS policies on admin-write tables.
--
-- ── Why this exists ────────────────────────────────────────────────────────
-- Migration 057 added profiles.role enum + replaced application-layer email
-- gates with role-based checks via api/_admin-auth.js. But the SUPABASE
-- ROW-LEVEL SECURITY policies on admin-write tables still used hardcoded
-- email checks (e.g. `WITH CHECK (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')`).
--
-- This migration installs role-based RLS as defense-in-depth. Even if the
-- application layer is bypassed (raw Supabase client + leaked JWT, direct
-- REST endpoint hit), the database itself enforces role.
--
-- ── Safer-rollout pattern ──────────────────────────────────────────────────
-- We do NOT drop the existing email-based policies in this migration.
-- PostgreSQL evaluates multiple permissive RLS policies with OR logic — so
-- adding a NEW role-based policy alongside the existing email policy means
-- BOTH paths work during the transition. If the role policy has a typo or
-- profiles.role isn't yet populated for the admin user, the legacy email
-- path still permits the admin's writes. No lockout risk.
--
-- After this migration is verified live (admin can write via /admin >
-- State Programs editor; cron jobs continue to work; no permission errors
-- in logs), a follow-up migration 0XX_drop_legacy_email_rls.sql will drop
-- the original email-based policies, leaving only role-based.
--
-- ── Tables affected (11) ───────────────────────────────────────────────────
--   021  puc_dockets            (insert / update / delete)
--   023  comparable_deals        (insert / update / delete)
--   025  lmi_data                (insert / update)
--   027  county_acs_data         (insert / update)
--   032  energy_community_data   (insert / update)
--   034  hud_qct_dda_data        (insert / update)
--   036  nmtc_lic_data           (insert / update)
--   039  county_geospatial_data  (insert / update)
--   048  solar_cost_index        (insert / update)
--   050  cs_projects             (insert / update)
--   053  cs_specific_yield       (insert / update)
--
-- (state_programs / county_intelligence / news_feed / revenue_rates /
-- ix_queue_data / substations have public-read RLS but no admin-RLS at
-- table level — writes are service-role-only from cron handlers.
-- admin_audit_log (057) was already shipped with role-based RLS.)
--
-- ── is_admin() helper ──────────────────────────────────────────────────────
-- Centralizes the role check + legacy fallback so individual policies stay
-- simple. STABLE function (deterministic per session). Returns true when
-- the JWT subject's profiles.role = 'admin' OR (legacy fallback) the JWT
-- email is the original admin email.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer  -- needed so the function can read profiles even if
                  -- the calling user's RLS policies on profiles would
                  -- restrict the read. profiles already has "users read
                  -- own profile" so this is normally fine, but defining
                  -- security definer makes the helper robust against
                  -- future RLS tightening on profiles.
set search_path = public, auth
as $$
  select coalesce(
    (select role = 'admin' from profiles where id = auth.uid()),
    false
  )
  or (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');
$$;

comment on function public.is_admin() is
  'Returns true if the current JWT subject is admin (profiles.role=admin) with legacy email fallback. Used by RLS policies on admin-write tables (migration 058).';

-- Idempotent. Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────
-- Add role-based policies alongside existing email policies, per table.
-- ─────────────────────────────────────────────────────────────────────────

-- 021 puc_dockets
drop policy if exists "puc_dockets admin role insert" on puc_dockets;
create policy "puc_dockets admin role insert"
  on puc_dockets for insert
  with check (public.is_admin());
drop policy if exists "puc_dockets admin role update" on puc_dockets;
create policy "puc_dockets admin role update"
  on puc_dockets for update
  using (public.is_admin())
  with check (public.is_admin());
drop policy if exists "puc_dockets admin role delete" on puc_dockets;
create policy "puc_dockets admin role delete"
  on puc_dockets for delete
  using (public.is_admin());

-- 023 comparable_deals
drop policy if exists "comparable_deals admin role insert" on comparable_deals;
create policy "comparable_deals admin role insert"
  on comparable_deals for insert
  with check (public.is_admin());
drop policy if exists "comparable_deals admin role update" on comparable_deals;
create policy "comparable_deals admin role update"
  on comparable_deals for update
  using (public.is_admin())
  with check (public.is_admin());
drop policy if exists "comparable_deals admin role delete" on comparable_deals;
create policy "comparable_deals admin role delete"
  on comparable_deals for delete
  using (public.is_admin());

-- 025 lmi_data
drop policy if exists "lmi_data admin role insert" on lmi_data;
create policy "lmi_data admin role insert"
  on lmi_data for insert
  with check (public.is_admin());
drop policy if exists "lmi_data admin role update" on lmi_data;
create policy "lmi_data admin role update"
  on lmi_data for update
  using (public.is_admin())
  with check (public.is_admin());

-- 027 county_acs_data
drop policy if exists "county_acs_data admin role insert" on county_acs_data;
create policy "county_acs_data admin role insert"
  on county_acs_data for insert
  with check (public.is_admin());
drop policy if exists "county_acs_data admin role update" on county_acs_data;
create policy "county_acs_data admin role update"
  on county_acs_data for update
  using (public.is_admin())
  with check (public.is_admin());

-- 032 energy_community_data
drop policy if exists "energy_community_data admin role insert" on energy_community_data;
create policy "energy_community_data admin role insert"
  on energy_community_data for insert
  with check (public.is_admin());
drop policy if exists "energy_community_data admin role update" on energy_community_data;
create policy "energy_community_data admin role update"
  on energy_community_data for update
  using (public.is_admin())
  with check (public.is_admin());

-- 034 hud_qct_dda_data
drop policy if exists "hud_qct_dda_data admin role insert" on hud_qct_dda_data;
create policy "hud_qct_dda_data admin role insert"
  on hud_qct_dda_data for insert
  with check (public.is_admin());
drop policy if exists "hud_qct_dda_data admin role update" on hud_qct_dda_data;
create policy "hud_qct_dda_data admin role update"
  on hud_qct_dda_data for update
  using (public.is_admin())
  with check (public.is_admin());

-- 036 nmtc_lic_data
drop policy if exists "nmtc_lic_data admin role insert" on nmtc_lic_data;
create policy "nmtc_lic_data admin role insert"
  on nmtc_lic_data for insert
  with check (public.is_admin());
drop policy if exists "nmtc_lic_data admin role update" on nmtc_lic_data;
create policy "nmtc_lic_data admin role update"
  on nmtc_lic_data for update
  using (public.is_admin())
  with check (public.is_admin());

-- 039 county_geospatial_data
drop policy if exists "county_geospatial admin role insert" on county_geospatial_data;
create policy "county_geospatial admin role insert"
  on county_geospatial_data for insert
  with check (public.is_admin());
drop policy if exists "county_geospatial admin role update" on county_geospatial_data;
create policy "county_geospatial admin role update"
  on county_geospatial_data for update
  using (public.is_admin())
  with check (public.is_admin());

-- 048 solar_cost_index
drop policy if exists "solar_cost_index admin role insert" on solar_cost_index;
create policy "solar_cost_index admin role insert"
  on solar_cost_index for insert
  with check (public.is_admin());
drop policy if exists "solar_cost_index admin role update" on solar_cost_index;
create policy "solar_cost_index admin role update"
  on solar_cost_index for update
  using (public.is_admin())
  with check (public.is_admin());

-- 050 cs_projects
drop policy if exists "cs_projects admin role insert" on cs_projects;
create policy "cs_projects admin role insert"
  on cs_projects for insert
  with check (public.is_admin());
drop policy if exists "cs_projects admin role update" on cs_projects;
create policy "cs_projects admin role update"
  on cs_projects for update
  using (public.is_admin())
  with check (public.is_admin());

-- 053 cs_specific_yield
drop policy if exists "cs_specific_yield admin role insert" on cs_specific_yield;
create policy "cs_specific_yield admin role insert"
  on cs_specific_yield for insert
  with check (public.is_admin());
drop policy if exists "cs_specific_yield admin role update" on cs_specific_yield;
create policy "cs_specific_yield admin role update"
  on cs_specific_yield for update
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- Verification queries (commented — run manually after applying):
--
--   -- Confirm helper works for the admin user:
--   set role authenticated;
--   select public.is_admin();   -- should be true if your JWT is the admin's
--   reset role;
--
--   -- List all role-based policies (sanity check post-migration):
--   select schemaname, tablename, policyname
--   from pg_policies
--   where policyname like '%admin role%'
--   order by tablename, policyname;
--
-- After this migration is verified live, run:
--   supabase/migrations/059_drop_legacy_email_rls.sql  (NOT YET WRITTEN)
-- to drop the original email-based policies. Keep them active until the
-- role-based path is proven (admin /admin write succeeds; cron handlers
-- continue to work via service-role; no permission denied errors in logs).
-- ─────────────────────────────────────────────────────────────────────────

notify pgrst, 'reload schema';
