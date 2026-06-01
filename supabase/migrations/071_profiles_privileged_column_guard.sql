-- Migration 071: guard privileged columns on profiles (C1 fix).
--
-- ── Why this exists ────────────────────────────────────────────────────────
-- The 2026-05-31 security audit (finding C1) flagged a privilege-escalation +
-- payment-bypass gap in the profiles RLS. The only UPDATE policy on profiles
-- is migration 007's:
--
--     create policy "users update own profile" on profiles
--       for update using (auth.uid() = id);   -- no WITH CHECK, no column scope
--
-- With WITH CHECK omitted, PostgreSQL reuses the USING expression, so the new
-- row only has to keep `id = auth.uid()`. NOTHING restricts WHICH columns the
-- user changes. profiles holds privileged columns set ONLY by the server
-- (Stripe webhook) or by an admin/migration:
--
--     role                 -- admin gate: is_admin() (058), isAdminFromBearer
--                             (api/_admin-auth.js), Admin.jsx all trust this
--     subscription_tier    -- Pro gate: lens-insight.js, useSubscription.js
--     subscription_status  -- Pro gate (active | trialing)
--     stripe_customer_id   -- billing identity: create-portal-session.js lists
--                             invoices + opens the billing portal for whatever
--                             customer id is on the row (IDOR if user-settable)
--
-- A logged-in non-admin could therefore run, via the public anon-key client:
--     supabase.from('profiles').update({ role:'admin',
--       subscription_tier:'pro', subscription_status:'active' }).eq('id', uid)
-- granting themselves full admin AND free Pro.
--
-- ── Why a trigger (not a WITH CHECK / column REVOKE) ───────────────────────
-- RLS WITH CHECK can only inspect the NEW row — it cannot compare NEW vs OLD,
-- so it cannot express "the role column did not change." Column-level REVOKE
-- would work but requires enumerating EVERY user-updatable column and re-
-- GRANTing them (full_name, alert_*, slack_webhook_url, welcome_dismissed_at,
-- updated_at), which is brittle: a future column would silently become non-
-- updatable. A BEFORE UPDATE trigger is the surgical, correct mechanism — it
-- can compare OLD vs NEW and is consistent with the trigger style already used
-- across these migrations (e.g. the *_updated_at triggers).
--
-- ── Trust model ────────────────────────────────────────────────────────────
-- Server writes use the service-role key -> PostgREST runs them as the
-- `service_role` Postgres role. Direct dashboard SQL / migrations run as
-- `postgres` / `supabase_admin`. Those roles are trusted and bypass the guard.
-- User/anon writes run as `authenticated` / `anon` and are blocked from
-- touching the privileged columns. Role assignment stays an explicit
-- server/SQL action (matches migration 057's design — there is intentionally
-- no client path to change a role).
--
-- SECURITY INVOKER so current_user reflects the role that issued the UPDATE
-- (authenticated / service_role); the function only compares OLD/NEW + reads
-- current_user, so it needs no elevated privileges. Trigger functions execute
-- regardless of the invoking user's EXECUTE privilege, so authenticated users
-- still fire it.
--
-- Idempotent. Safe to re-run.

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Trusted writers: server (service_role key) + direct DB / migrations.
  if current_user in ('service_role', 'postgres', 'supabase_admin', 'supabase_auth_admin') then
    return new;
  end if;

  -- Everyone else (authenticated / anon via PostgREST): privileged columns are
  -- immutable. `is distinct from` handles NULLs (stripe_customer_id is
  -- nullable) correctly.
  if new.role                 is distinct from old.role
     or new.subscription_tier   is distinct from old.subscription_tier
     or new.subscription_status is distinct from old.subscription_status
     or new.stripe_customer_id  is distinct from old.stripe_customer_id then
    raise exception
      'profiles: privileged columns (role, subscription_tier, subscription_status, stripe_customer_id) cannot be modified by role %', current_user
      using errcode = '42501';  -- insufficient_privilege
  end if;

  return new;
end$$;

comment on function public.profiles_guard_privileged_columns() is
  'C1 fix (migration 071): blocks authenticated/anon UPDATEs from changing privileged profiles columns (role, subscription_tier, subscription_status, stripe_customer_id). service_role/postgres bypass. See migration header.';

drop trigger if exists profiles_guard_privileged_columns on profiles;
create trigger profiles_guard_privileged_columns
  before update on profiles
  for each row
  execute function public.profiles_guard_privileged_columns();

-- ── Verification (run manually after applying) ─────────────────────────────
--   -- As an ordinary user (authenticated role), this must now RAISE:
--   --   update profiles set role='admin' where id = auth.uid();
--   --   ERROR:  profiles: privileged columns ... cannot be modified by role authenticated
--   -- A benign preference update must still SUCCEED:
--   --   update profiles set alert_urgent = false where id = auth.uid();
--   -- The Stripe webhook (service_role) must still be able to set tier/status.
--
--   -- Confirm the trigger is attached:
--   select tgname, tgenabled from pg_trigger
--   where tgrelid = 'public.profiles'::regclass and not tgisinternal;

notify pgrst, 'reload schema';
