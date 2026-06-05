-- Migration 074: projects.follow_up_at + follow_up_note — next-action tracking.
--
-- ── Why this exists ────────────────────────────────────────────────────────
-- The second leg of the Library Pass 5 cockpit. A deal tracker you return to
-- daily needs to answer "what's due?" — not just "what do I own?". `follow_up_at`
-- is a per-project next-action date; `follow_up_note` is the one-line "what" for
-- that action ("call the utility", "submit ISA deposit"). The Library card shows
-- a "Due in 3d" / amber "Overdue" chip, the Portfolio Intelligence drawer rolls
-- up a "due this week" list, and the card list gains a `followup` sort.
--
-- ── Shape ──────────────────────────────────────────────────────────────────
-- A nullable timestamptz + nullable text on the existing projects row — a
-- project has at most one open next-action, so no separate table. A full
-- task/reminder system (recurring, multiple open actions, notifications) is out
-- of scope; this is the minimum that makes Library a place you come back to.
--
-- ── RLS / writes ───────────────────────────────────────────────────────────
-- No policy change. Same column-agnostic projects UPDATE policy as tags (072).
--
-- ── Degradation ────────────────────────────────────────────────────────────
-- Idempotent. Until applied, `normalize()` reads null, no chip renders, the
-- "due this week" list is empty, and the `followup` sort falls back to the
-- date tiebreak. Writes PostgREST-error silently. Safe to re-run.

alter table projects
  add column if not exists follow_up_at   timestamptz,
  add column if not exists follow_up_note text;

-- Partial index — only rows with an open next-action are ever scanned by the
-- "due" roll-up / sort; keeps the index tiny (most projects have no follow-up).
create index if not exists idx_projects_follow_up_at
  on projects (user_id, follow_up_at)
  where follow_up_at is not null;

notify pgrst, 'reload schema';
