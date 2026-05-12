-- Migration 062: saved_comparisons — persisted Compare flow.
--
-- Backs Phase 2C of TRACTOVA-UX-001 (Library cockpit rebuild). The Compare
-- tray was localStorage-only until now: the user drafted a comparison set
-- in-session, opened the modal, and lost it on next reload. Phase 2C
-- promotes Compare from a throwaway viewer into a re-openable artifact —
-- save a comparison by name, surface it in the Library + Cmd-K, export it
-- to PDF for an IC packet.
--
-- ── Why snapshot jsonb instead of joining live tables ──────────────────────
-- A "saved comparison" is a research artifact, not a live join. The
-- developer saved their take on five candidate states at a moment in time;
-- the comparison should render IDENTICALLY months later even if the
-- underlying state_programs / county data has drifted. We freeze the
-- compare items (with sub-scores, geospatial pcts, capacity, etc.) into
-- the snapshot column at save time. The Compare modal's existing drift-
-- detection (refreshed score vs at-save score) still works: the modal
-- re-fetches live state/county on open and shows a delta when the saved
-- snapshot diverges from current data.
--
-- ── item_ids vs snapshot ───────────────────────────────────────────────────
-- item_ids is denormalized for cheap "is this project in any saved comp?"
-- lookups (future feature: badge on ProjectCard). snapshot is the source
-- of truth for rendering the comparison itself.
--
-- ── RLS ────────────────────────────────────────────────────────────────────
-- Standard own-rows-only (matches projects + scenario_snapshots). Saved
-- comparisons are private to the user; sharing is out of scope for Phase 2C
-- and would live in a separate share_tokens-style table if added later.

create table if not exists saved_comparisons (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  item_ids              text[] not null,
  snapshot              jsonb not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists saved_comparisons_user_idx
  on saved_comparisons (user_id, created_at desc);

create trigger saved_comparisons_updated_at
before update on saved_comparisons
for each row execute function touch_updated_at();

alter table saved_comparisons enable row level security;

do $$ begin
  create policy "users read own saved comparisons"
    on saved_comparisons for select
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users insert own saved comparisons"
    on saved_comparisons for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users update own saved comparisons"
    on saved_comparisons for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users delete own saved comparisons"
    on saved_comparisons for delete
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
