-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 064: ix_queue_data — community-DG pipeline context columns
--
-- Why: the original ix_queue_data model assumed ISO transmission-queue data
-- (projects_in_queue / avg_study_months / withdrawal_pct / avg_upgrade_cost).
-- We verified empirically (scripts/probe-iso-counts.mjs, 2026-05-22) that ISO
-- transmission queues contain almost NO community-scale solar (<25MW) — CS
-- interconnects at the DISTRIBUTION level, which ISO queues don't see. The
-- real, redistribution-safe distribution-level CS signal for NY is the NYSERDA
-- "Solar Electric Programs" open-data feed (community_distributed_generation
-- flag), which is a DEPLOYMENT-PIPELINE signal (projects in Pipeline vs
-- Complete), NOT a study-depth queue. It carries no study-months / withdrawal /
-- upgrade-cost — so those columns stay NULL for nyserda_cdg rows (we do not
-- fabricate them; the IX SCORE stays on the curated ixDifficulty baseline and
-- this data is shown as live CONTEXT only).
--
-- This migration adds two additive columns to carry the "deployed" half of the
-- signal (the existing projects_in_queue / mw_pending now hold the "active
-- pipeline" half for nyserda_cdg rows). Pure ADD COLUMN — safe + reversible.
--
-- New data_source value introduced (no enum to alter — column is free text):
--   'nyserda_cdg'  — NYSERDA Solar Electric Programs, CDG=Yes, distribution-level
-- ─────────────────────────────────────────────────────────────────────────────

alter table ix_queue_data
  add column if not exists completed_projects integer,
  add column if not exists completed_mw        numeric;

comment on column ix_queue_data.projects_in_queue is
  'queue_depth rows: projects in ISO study queue. cs_pipeline (nyserda_cdg) rows: CS projects in active development pipeline (project_status=Pipeline).';
comment on column ix_queue_data.mw_pending is
  'queue_depth rows: MW pending in queue. cs_pipeline rows: MWdc of active-pipeline CS projects.';
comment on column ix_queue_data.completed_projects is
  'cs_pipeline (nyserda_cdg) rows only: CS projects energized to date (project_status=Complete). NULL for queue_depth rows.';
comment on column ix_queue_data.completed_mw is
  'cs_pipeline (nyserda_cdg) rows only: MWdc of energized CS projects. NULL for queue_depth rows.';
comment on column ix_queue_data.data_source is
  'seed | scraper | manual | nyserda_cdg. nyserda_cdg = distribution-level CS deployment-pipeline signal (study-months/withdrawal/upgrade columns stay NULL).';
