-- Migration 014: project_events
--
-- Append-only audit log per saved project. Drives the "Audit" tab in the
-- Library expanded card -- reverse-chrono timeline of stage changes, score
-- shifts, alert triggers, and note updates. The capital-partner-facing
-- artifact ("show me everything that's happened on this deal").
--
-- Append-only by convention (no UPDATE in app code; DELETE only via cascade
-- when the parent project is removed).

create table if not exists project_events (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in (
    'created',
    'stage_change',
    'score_change',
    'alert_triggered',
    'note_updated'
  )),
  detail      text not null,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists project_events_project_id_created_at_idx
  on project_events (project_id, created_at desc);

alter table project_events enable row level security;

-- Owner read
drop policy if exists "owner can read events" on project_events;
create policy "owner can read events" on project_events
  for select using (auth.uid() = user_id);

-- Owner insert
drop policy if exists "owner can insert events" on project_events;
create policy "owner can insert events" on project_events
  for insert with check (auth.uid() = user_id);

-- No update / no delete (cascade handles removal).

notify pgrst, 'reload schema';
