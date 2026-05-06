-- Migration 057: profiles.role enum + admin_audit_log table.
--
-- ── Why this exists ────────────────────────────────────────────────────────
-- The full-site audit (2026-05-05) flagged the hardcoded
-- `user.email === 'aden.walker67@gmail.com'` check across 9+ files as a
-- structural debt. Single point of compromise; no audit trail for admin
-- writes; can't escalate or revoke admin without a code change.
--
-- This migration installs the SCHEMA layer:
--   1. profiles.role enum ('admin' | 'curator' | 'user') with default 'user'
--   2. admin_audit_log table for tracking admin write actions
--   3. Backfill: aden.walker67@gmail.com gets role='admin'
--
-- The CODE layer (replace email checks with role lookups) ships in the
-- same commit but as a separate concern. Full RLS policy migration on
-- admin-write tables is deferred to a follow-up — it carries lockout risk
-- and needs rollback testing.
--
-- Idempotent. Safe to re-run.

-- ── 1. profiles.role column ───────────────────────────────────────────────
alter table profiles
  add column if not exists role text not null default 'user';

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles
  add constraint profiles_role_check
  check (role in ('admin', 'curator', 'user'));

create index if not exists profiles_role_idx on profiles (role) where role != 'user';

-- ── 2. Backfill existing admin email → role='admin' ──────────────────────
-- The auth.users table holds emails; profiles.id references auth.users.id.
-- Find the admin user by email and update their profile row.
update profiles
  set role = 'admin'
  where id = (
    select id from auth.users where email = 'aden.walker67@gmail.com' limit 1
  )
  and role != 'admin';

-- ── 3. admin_audit_log table ──────────────────────────────────────────────
-- Tracks admin write events: who did what, when, against which row. Read
-- access is admin-only; writes go through application code.
create table if not exists admin_audit_log (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid not null references auth.users(id) on delete set null,
  actor_email     text,                                    -- snapshot at write time
  action          text not null,                           -- 'update' | 'insert' | 'delete' | 'role_change' | …
  target_table    text not null,                           -- 'state_programs' | 'revenue_rates' | …
  target_id       text,                                    -- the row's primary key as text (varies per table)
  details         jsonb,                                   -- per-action payload (before/after diff, reason, etc.)
  created_at      timestamptz not null default now()
);

create index if not exists admin_audit_log_actor_idx on admin_audit_log (actor_id, created_at desc);
create index if not exists admin_audit_log_target_idx on admin_audit_log (target_table, target_id, created_at desc);

alter table admin_audit_log enable row level security;

drop policy if exists "admin_audit_log admin read" on admin_audit_log;
create policy "admin_audit_log admin read"
  on admin_audit_log for select
  using (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "admin_audit_log admin insert" on admin_audit_log;
create policy "admin_audit_log admin insert"
  on admin_audit_log for insert
  with check (
    (select role from profiles where id = auth.uid()) = 'admin'
  );

-- Updates / deletes intentionally not allowed — audit log is append-only.

notify pgrst, 'reload schema';
