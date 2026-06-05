-- Migration 073: projects.tags — user-defined labels (Library Pass 5 cockpit).
--
-- ── Why this exists ────────────────────────────────────────────────────────
-- Library Pass 5 elevates the saved-deals list into a deal-management cockpit.
-- Today a project can only be organised by pipeline `stage` (a fixed 7-value
-- enum) and free-text `notes`. Developers asked to group deals by their own
-- dimensions — "hot", a capital-partner name, "Q3 target", a portfolio bucket.
-- `tags` is a free-form text[] the user edits in the Library card; the command
-- bar filters on it.
--
-- ── Shape ──────────────────────────────────────────────────────────────────
-- text[] (not a join table): tags are a small, user-private, denormalised set
-- read on every Library load alongside the row — a join would cost a round-trip
-- for no benefit. A GIN index keeps `tags @> ARRAY[...]` / `&&` filters cheap if
-- we ever push the filter server-side (today it's client-side over the already-
-- fetched rows, same as the state/structure/stage filters).
--
-- ── RLS / writes ───────────────────────────────────────────────────────────
-- No policy change needed. The projects UPDATE policy (migration 072) is
-- column-agnostic: `using (auth.uid() = user_id) with check (auth.uid() =
-- user_id)`. A user editing their own row's tags passes the check; only a
-- user_id reassignment is blocked. Server writes use the service-role key.
--
-- ── Degradation ────────────────────────────────────────────────────────────
-- Idempotent. Until applied, `normalize()` reads `row.tags ?? []`, the editor
-- shows an empty set, and writes PostgREST-error silently (same pattern as
-- share_tokens / scenario_snapshots). The app keeps working. Safe to re-run.

alter table projects
  add column if not exists tags text[] not null default '{}';

create index if not exists idx_projects_tags on projects using gin (tags);

notify pgrst, 'reload schema';
