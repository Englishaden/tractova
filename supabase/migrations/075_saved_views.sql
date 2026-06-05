-- Migration 075: saved_views — named Library filter presets (Pass 5 navigation).
--
-- ── Why this exists ────────────────────────────────────────────────────────
-- Library filters (state / structure / stage / tags / search / sort) reset on
-- every load. A developer who repeatedly checks the same slice ("NY active CS
-- >5MW", "everything tagged hot") has to rebuild it each time. saved_views lets
-- them name a filter combo and recall it in one click from the command bar.
--
-- ── Shape ──────────────────────────────────────────────────────────────────
-- Mirrors saved_comparisons (062): own-rows-only, a jsonb blob for the preset.
-- `filters` jsonb holds { filterState, filterStructure, filterStage, tags,
-- search, sortBy } — a snapshot of the view-state, not a live join. Storing the
-- whole shape as jsonb (vs columns) keeps the schema stable as the command bar
-- gains controls; the client validates keys on restore and ignores unknowns.
--
-- ── RLS ────────────────────────────────────────────────────────────────────
-- Standard own-rows-only — identical 4-policy block to saved_comparisons /
-- scenario_snapshots. Saved views are private; no sharing surface.
--
-- ── Degradation ────────────────────────────────────────────────────────────
-- Idempotent. Until applied, the SavedViewsMenu fetch PostgREST-errors and the
-- component renders its empty state (same silent-fail pattern as
-- SavedComparisonsList). The rest of Library is unaffected. Safe to re-run.

create table if not exists saved_views (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  filters     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists saved_views_user_idx
  on saved_views (user_id, created_at desc);

-- touch_updated_at() is the shared trigger fn used by saved_comparisons (062).
-- `create or replace` (PG14+) keeps this migration genuinely re-runnable.
create or replace trigger saved_views_updated_at
before update on saved_views
for each row execute function touch_updated_at();

alter table saved_views enable row level security;

do $$ begin
  create policy "users read own saved views"
    on saved_views for select
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users insert own saved views"
    on saved_views for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users update own saved views"
    on saved_views for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users delete own saved views"
    on saved_views for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
