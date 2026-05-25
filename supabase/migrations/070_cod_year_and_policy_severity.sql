-- 070 — 5-pillar pivot data model (Phase 1)
--
-- Two additive, non-destructive changes supporting the Policy & Timing pillar:
--   1. projects.cod_target_year — the project's target commercial-operation
--      year. Drives the federal tax-credit TIMING risk signal (OBBBA §48E/§45Y
--      start-of-construction cutoff + placed-in-service deadline, FEOC, safe
--      harbor). Nullable: legacy rows + projects where the dev hasn't set a
--      target degrade to the stage-only timing assessment.
--   2. policy_impact_events.impact_severity + impact_probability — the
--      severity-tier reframe (Severe / Medium / Small × probability) that
--      replaces synthesized IRR-bps for scoring. Nullable: until the admin
--      (AI-proposed, human-confirmed) sets them, the engine bridges from the
--      legacy irr_impact_bps magnitude, so nothing breaks pre-backfill.
--
-- Both are pure ADD COLUMN — safe to apply on a live table, no data loss.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS cod_target_year integer;

COMMENT ON COLUMN projects.cod_target_year IS
  'Target commercial-operation year (e.g. 2027). Drives the Policy & Timing pillar federal tax-credit cliff assessment. Nullable.';

ALTER TABLE policy_impact_events
  ADD COLUMN IF NOT EXISTS impact_severity text
    CHECK (impact_severity IN ('severe', 'medium', 'small')),
  ADD COLUMN IF NOT EXISTS impact_probability text
    CHECK (impact_probability IN ('high', 'medium', 'low'));

COMMENT ON COLUMN policy_impact_events.impact_severity IS
  '5-pillar Policy & Timing severity tier (severe/medium/small). AI-proposed, admin-confirmed. Until set, scoring bridges from |irr_impact_bps|.';
COMMENT ON COLUMN policy_impact_events.impact_probability IS
  'Probability the policy actually hits the project (high/medium/low) — scales the severity penalty. Defaults to "assumed likely" in the engine when null.';
