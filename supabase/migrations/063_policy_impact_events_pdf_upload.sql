-- Migration 063: extend policy_impact_events.discovered_via enum with 'pdf_upload'
--
-- 2026-05-13 evening shipped PDF intake on PolicyImpactTab (Anthropic native
-- PDF document blocks → Haiku 4.5 → policy_impact_events draft). At ship time
-- the CHECK constraint on discovered_via didn't include 'pdf_upload', so the
-- handler in api/handlers/_lens-policy-classify.js writes
-- discovered_via='manual' and stamps source_type='pdf_upload' inside
-- discovery_metadata as a lineage workaround.
--
-- PDF intake is now a recurring source (utility orders, PUC press releases,
-- bill PDFs from legislatures that don't post HTML). Promote it to a
-- first-class enum value so admin queries can filter by source_type without
-- jsonb path expressions, and so the lineage is visible at the column level.
--
-- ── Safety ────────────────────────────────────────────────────────────────
-- Non-destructive: loosening a CHECK constraint cannot reject existing rows.
-- Existing rows continue to satisfy the new constraint (all current values
-- remain in the allow-list). No data migration required.
--
-- Reversible: dropping 'pdf_upload' back out is safe as long as no rows
-- carry that value yet. After this migration is applied AND the handler is
-- switched to write discovered_via='pdf_upload', rollback requires a data
-- backfill (UPDATE ... SET discovered_via='manual' WHERE discovered_via='pdf_upload')
-- before re-tightening the constraint.

alter table public.policy_impact_events
  drop constraint if exists policy_impact_events_discovered_via_check;

alter table public.policy_impact_events
  add constraint policy_impact_events_discovered_via_check
  check (discovered_via in (
    'manual',
    'news_ai_suggest',
    'docket_ai_suggest',
    'user_report',
    'pdf_upload'
  ));
