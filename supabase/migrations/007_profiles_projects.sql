-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles & Projects — codifying tables that exist in Supabase but were
-- created via dashboard/auth triggers rather than migration files.
--
-- Safe to run on existing databases — uses IF NOT EXISTS and won't modify
-- existing data or columns.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles ────────────────────────────────────────────────────────────────
-- Created by Supabase auth trigger on user signup. Stores subscription state
-- and Stripe customer linkage.

create table if not exists profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id    text,
  subscription_tier     text default 'free',         -- free | pro
  subscription_status   text default 'none',         -- none | active | trialing | past_due | canceled
  full_name             text,
  updated_at            timestamptz default now()
);

alter table profiles enable row level security;

-- Policies use DO blocks because CREATE POLICY has no IF NOT EXISTS
do $$ begin
  create policy "users read own profile"
    on profiles for select
    using (auth.uid() = id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users update own profile"
    on profiles for update
    using (auth.uid() = id);
exception when duplicate_object then null;
end $$;

-- ── projects ────────────────────────────────────────────────────────────────
-- User-saved project analyses from the Search/Lens tool.
-- Each row is a saved feasibility analysis with snapshot data at save time.

create table if not exists projects (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  state                 text,
  state_name            text,
  county                text,
  mw                    numeric,
  stage                 text,                         -- prospecting | due_diligence | loi | under_contract | ntp | cod
  technology            text,                         -- Community Solar | C&I Solar | BESS | Hybrid
  cs_program            text,
  cs_status             text,
  serving_utility       text,
  ix_difficulty         text,
  opportunity_score     numeric,
  notes                 text,
  saved_at              timestamptz default now()
);

alter table projects enable row level security;

-- Users can CRUD their own projects
do $$ begin
  create policy "users read own projects"
    on projects for select
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users insert own projects"
    on projects for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users update own projects"
    on projects for update
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users delete own projects"
    on projects for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- Index for user-scoped queries (Library, Profile pages)
create index if not exists idx_projects_user_id on projects(user_id);
create index if not exists idx_projects_saved_at on projects(saved_at desc);
