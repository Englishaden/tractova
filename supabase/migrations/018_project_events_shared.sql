-- Migration 018: add 'shared' to project_events.kind check constraint
--
-- Extends the audit log so that every Deal Memo share-link mint surfaces in
-- the project's Audit tab alongside stage / score / alert events. Inserted
-- by api/lens-insight.js during handleMemoCreate, after the share_tokens
-- row is written.
--
-- Idempotent: drops & re-adds the named check constraint so re-running this
-- migration is safe.

alter table project_events
  drop constraint if exists project_events_kind_check;

alter table project_events
  add constraint project_events_kind_check
  check (kind in (
    'created',
    'stage_change',
    'score_change',
    'alert_triggered',
    'note_updated',
    'shared'
  ));

notify pgrst, 'reload schema';
