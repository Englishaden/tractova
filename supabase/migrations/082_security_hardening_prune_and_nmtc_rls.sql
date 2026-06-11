-- Migration 082: security hardening from the 2026-06-10 full-spectrum audit.
--
-- Two independent, low-risk corrections batched into one apply step so Aden
-- runs a single SQL session. Neither touches row data; both are pure
-- grant/policy corrections. Service-role (cron + seed scripts) bypasses RLS
-- and retains EXECUTE explicitly below, so no data-pipeline path breaks.
--
--   §A (F-02, High→Med) — REVOKE EXECUTE on the webhook-prune SECURITY DEFINER
--     function from anon/authenticated. As shipped (migration 060) Postgres
--     granted EXECUTE to PUBLIC by default, so a caller holding only the public
--     anon key could RPC `prune_webhook_events_older_than_days(0)` and wipe the
--     Stripe idempotency ledger (webhook_events_processed), re-opening the
--     checkout/subscription replay races. Pruning is maintenance-only and runs
--     as service-role, which is regranted EXECUTE explicitly.
--
--   §B (F-08, Low/regression) — Replace the two hardcoded admin-email RLS write
--     policies on nmtc_lic_tracts (migration 080) with public.is_admin(), the
--     canonical admin gate from migration 058. Migration 059 had swept every
--     other email-literal policy; 080 (written later, this Phase-2 cycle)
--     reintroduced the pattern. This restores the single-source admin model.
--
-- House rule: Claude writes migrations, Aden applies. Idempotent — safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────
-- §A — F-02: lock the webhook-prune maintenance function to service-role
-- ─────────────────────────────────────────────────────────────────────────
revoke all on function public.prune_webhook_events_older_than_days(int)
  from public, anon, authenticated;

-- Keep the maintenance path working: service-role bypasses RLS but still needs
-- an explicit EXECUTE grant once the default PUBLIC grant is revoked.
grant execute on function public.prune_webhook_events_older_than_days(int)
  to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- §B — F-08: nmtc_lic_tracts admin writes → public.is_admin()
-- ─────────────────────────────────────────────────────────────────────────
-- Drop the legacy email-literal policies (names from migration 080) and
-- recreate the canonical role-based pair, matching migration 058's pattern.
drop policy if exists "nmtc_lic_tracts admin insert"      on nmtc_lic_tracts;
drop policy if exists "nmtc_lic_tracts admin update"      on nmtc_lic_tracts;
drop policy if exists "nmtc_lic_tracts admin role insert" on nmtc_lic_tracts;
drop policy if exists "nmtc_lic_tracts admin role update" on nmtc_lic_tracts;

create policy "nmtc_lic_tracts admin role insert"
  on nmtc_lic_tracts for insert
  with check (public.is_admin());

create policy "nmtc_lic_tracts admin role update"
  on nmtc_lic_tracts for update
  using      (public.is_admin())
  with check (public.is_admin());

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────
-- Verification (run manually after applying):
--
--   -- §A: anon/authenticated must NOT appear; service_role may.
--   select proname, proacl from pg_proc
--   where proname = 'prune_webhook_events_older_than_days';
--
--   -- §B: both write policies should reference is_admin(), no email literal.
--   select policyname, cmd, qual, with_check from pg_policies
--   where tablename = 'nmtc_lic_tracts' order by policyname;
-- ─────────────────────────────────────────────────────────────────────────
