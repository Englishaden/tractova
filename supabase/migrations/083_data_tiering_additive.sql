-- Migration 083: F-01 data-tiering — ADDITIVE half (Stage 1 of 3).
--
-- Closes the High finding: every synthesized/market table is bulk-readable by
-- the anon key today (`... for select using (true)`), so a scraper with the
-- public anon key can pull the entire IP corpus. This migration is the SAFE,
-- ADDITIVE first step — it REMOVES NOTHING. Anon keeps reading the base tables
-- exactly as today until migration 084 (the REVOKE half) is applied, which
-- happens only AFTER the SPA repoint is confirmed live on prod.
--
-- Builds three things the locked-down surface will need:
--   (a) is_pro()   — the Pro-tier gate for the highest-value IP tables.
--   (b) two coarse `_public` views — the minimal anon preview seam.
--   (c) get_dashboard_metrics() flipped to SECURITY DEFINER — so the aggregate
--       dashboard counts survive once anon loses base read (084).
--
-- House rule: Claude writes migrations, Aden applies. Idempotent — safe to re-run.
-- Design + staged rollout: security-audit/F01-data-tiering-design.md

-- ── (a) is_pro() — mirrors is_admin() (058:50-67): STABLE, SECURITY DEFINER, ──
-- ──     search_path pinned. True only for a paying, active/trialing Pro.    ──
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
  'True if the current JWT subject is a paid Pro (profiles.subscription_tier=pro AND subscription_status in active/trialing). Mirrors is_admin() (058). Used by SELECT RLS on the highest-value IP tables (F-01, migration 084).';

-- ── (b) coarse public VIEWS — only preview-OK columns, NO synthesized IP ─────
-- state_programs_public drops the curated synthesis: ix_difficulty, ix_notes,
-- program_notes, enrollment_rate_mw_per_month. (Columns confirmed against
-- supabase/schema.sql:20-36.)
create or replace view public.state_programs_public as
  select id, name, cs_status, cs_program, capacity_mw,
         lmi_required, lmi_percent, data_source, last_verified
    from public.state_programs;

-- state_programs_snapshots_public drops feasibility_score + ix_difficulty (IP).
-- (Columns confirmed against migration 038:20-30.)
create or replace view public.state_programs_snapshots_public as
  select id, state_id, cs_status, capacity_mw,
         lmi_required, lmi_percent, snapshot_at
    from public.state_programs_snapshots;

-- security_invoker = off (the default): the view executes with its OWNER's
-- rights, so it can still read the base table after migration 084 removes anon's
-- direct base SELECT. Set explicitly for clarity and to stay robust against any
-- future default change. anon needs SELECT on the VIEW only (granted below),
-- never on the base table. Because each view projects ONLY coarse columns,
-- owner-rights execution cannot leak an IP column — the projection IS the guard.
alter view public.state_programs_public            set (security_invoker = off);
alter view public.state_programs_snapshots_public  set (security_invoker = off);

grant select on public.state_programs_public           to anon, authenticated;
grant select on public.state_programs_snapshots_public to anon, authenticated;

-- ── (c) dashboard RPC → SECURITY DEFINER so aggregate counts survive REVOKE ──
-- get_dashboard_metrics() is SECURITY INVOKER today (latest body = migration
-- 040, which added lastRefreshAt). Once anon loses base SELECT on
-- state_programs / ix_queue_data / news_feed (084), an INVOKER RPC would return
-- zeros for anon. Flip to DEFINER so it reads as owner and keeps returning the
-- aggregate-only counts. We ALTER (not CREATE OR REPLACE) deliberately: it flips
-- the security mode + pins search_path WITHOUT touching the body, so the live
-- 040 definition (incl. lastRefreshAt) is preserved exactly — no risk of
-- regressing the footer's freshness caption. The body is counts/sums only; no
-- row-level data leaves the function.
alter function public.get_dashboard_metrics()
  security definer
  set search_path = public;

-- Tighten EXECUTE: drop the broad PUBLIC grant, re-grant to the named roles
-- the SPA + cron actually use (anon preview still calls it).
revoke all     on function public.get_dashboard_metrics() from public;
grant  execute on function public.get_dashboard_metrics() to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────
-- Verification (run after applying — NONE of this removes current access):
--   set role anon;
--   select public.is_pro();                                  -- false (no JWT)
--   select count(*) from public.state_programs_public;        -- ~51 (view open)
--   select count(*) from public.state_programs_snapshots_public;  -- > 0
--   select public.get_dashboard_metrics();                    -- counts non-zero
--   select count(*) from public.state_programs;               -- still works (base
--                                                             --   read NOT yet revoked — that's migration 084)
--   reset role;
-- ─────────────────────────────────────────────────────────────────────────
