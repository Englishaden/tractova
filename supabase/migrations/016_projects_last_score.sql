-- Migration 016: projects.last_observed_score
--
-- Tracks the most recently computed display-score for each saved project so
-- the Library load handler can detect material score shifts (>= 5 points)
-- and log them as 'score_change' events on the audit trail.
--
-- Set initial value from the project's saved opportunity_score so existing
-- projects don't trigger a flood of false-positive events on first load
-- after migration.

alter table projects
  add column if not exists last_observed_score numeric;

-- Backfill: anything currently null gets set to the saved opportunity_score
-- (or null stays null if that's null too -- those projects just won't fire
-- score_change events until they're observed once).
update projects
   set last_observed_score = opportunity_score
 where last_observed_score is null
   and opportunity_score is not null;

notify pgrst, 'reload schema';
