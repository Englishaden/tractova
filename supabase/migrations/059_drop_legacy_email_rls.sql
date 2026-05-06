-- Migration 059 — Drop legacy email-based RLS policies.
--
-- Migration 058 (Sprint 6) added role-based RLS policies alongside the
-- existing email-based policies installed across migrations 021–053. The
-- two-step rollout deliberately kept BOTH active so admin-write paths
-- never broke during the role-population window.
--
-- 059 closes the loop: drop every legacy email-based policy. After this
-- migration, the only RLS path to admin writes is via
-- `public.is_admin()` → `profiles.role = 'admin'`. The legacy email
-- fallback in is_admin() (line `or (auth.jwt() ->> 'email' = ...)`)
-- stays in place as belt-and-suspenders, but it's no longer load-bearing
-- for any policy.
--
-- ── Apply only after verifying ────────────────────────────────────────
-- 1. profiles.role = 'admin' is set for the production admin user.
--    Query: select id, email, role from profiles where role = 'admin';
-- 2. A test admin write through /admin succeeds (e.g., editing a
--    state_program row).
-- 3. cron_runs in the last 24 hours show successful writes from the
--    service-role-key cron handlers (RLS bypassed by service-role,
--    but verifies the role-based path doesn't break the cron loop).
--
-- ── Reversibility ─────────────────────────────────────────────────────
-- This migration drops policies but does NOT drop the is_admin() helper
-- nor the role-based policies from 058. To roll back: re-apply the
-- relevant section of the original migration (021 / 023 / 025 / etc.)
-- to recreate the email policy. Alternatively, the role-based path
-- (058) covers admin writes on its own — rollback is not required for
-- functionality, only for defense-in-depth parity.
--
-- ── Pattern ───────────────────────────────────────────────────────────
-- Uses pg_catalog query to find any policy whose qual/with_check
-- contains the literal admin email. Drops all matches in one DO block.
-- More resilient than enumerating each policy name (the legacy names
-- vary across the originating migrations).

do $$
declare
  pol record;
  drop_count int := 0;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '')        like '%aden.walker67@gmail.com%'
        or coalesce(with_check, '') like '%aden.walker67@gmail.com%'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
    drop_count := drop_count + 1;
    raise notice 'Dropped legacy email policy: %.% / %',
      pol.schemaname, pol.tablename, pol.policyname;
  end loop;

  raise notice 'Migration 059 complete. Dropped % legacy email policies.', drop_count;
end$$;

-- Verification query (run after migration to confirm clean state):
--
--   select schemaname, tablename, policyname
--   from pg_policies
--   where schemaname = 'public'
--     and (qual like '%email%' or with_check like '%email%');
--
-- Expected: zero rows (all admin writes now flow through is_admin()
-- which references profiles.role, not auth.jwt() ->> 'email').
