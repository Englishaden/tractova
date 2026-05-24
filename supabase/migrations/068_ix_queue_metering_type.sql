-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 068: ix_queue_data — monetization-structure tag (capture-all-DG)
--
-- Why: the capture-all-DG scope decision (2026-05-23, memory
-- project_scope_and_tech_taxonomy) stops the scrapers filtering to Community Solar
-- and instead captures EVERY distribution-DG project, tagged by MONETIZATION
-- STRUCTURE. CS is a program riding a (virtual) net-metering mechanism — not a tech
-- type — so structure is its own axis. This 50–100×'s the dataset (NJ alone: ~165
-- CS rows → ~11k projects across net-metering / CS / other) and serves net-metering
-- developers, with ~no new scraping.
--
-- Storage model (Aden's call, "row per structure"): one ix_queue_data row per
-- (state, utility, metering_type). Aggregation = SUM over rows; the Lens structure
-- filter = WHERE metering_type. Row growth is tiny (the table is ~16 rows; full
-- rollout is ~25–30). The unique key moves from (state_id, utility_name) to
-- (state_id, utility_name, metering_type) — the cron's upsert onConflict moves with
-- it (api/refresh-ix-queue.js).
--
-- Vocabulary (single source of truth: api/scrapers/_meteringType.js):
--   community_solar | net_metering | net_billing | ci_btm | on_bill | other | unknown
--   other   = source named a non-retail-monetization category (PURPA/QF, cogen,
--             backup, load-offset) — captured honestly, not bucketed as a product.
--   unknown = source exposes NO structure indicator (e.g. fuel-type-only queues).
--
-- Backfill of existing 16 rows (verified live 2026-05-24, scripts/probe-ix-queue.mjs):
--   nyserda_cdg(7), nj_ic_queue(2), md_mea_cs(4)  → community_solar (all CS-filtered)
--   va_dominion_queue(1), wi_alliant_queue(1), ca_pge_queue(1) → unknown (fuel-type only)
--
-- Pure additive column + a constraint swap + a snapshot index swap — reversible.
-- The IX SCORE is unaffected (still the curated baseline; structure is CONTEXT +
-- the future Lens discovery filter, never blended).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ix_queue_data ────────────────────────────────────────────────────────────
alter table ix_queue_data
  add column if not exists metering_type text not null default 'unknown';

comment on column ix_queue_data.metering_type is
  'Monetization structure (single source of truth: api/scrapers/_meteringType.js): community_solar | net_metering | net_billing | ci_btm | on_bill | other | unknown. other=source named a non-retail category (PURPA/cogen/backup/offset); unknown=source gave no structure indicator. One row per (state_id,utility_name,metering_type).';

-- Backfill existing CS-filtered sources; fuel-type-only queues keep the 'unknown' default.
update ix_queue_data
  set metering_type = 'community_solar'
  where data_source in ('nyserda_cdg', 'nj_ic_queue', 'md_mea_cs');

-- Swap the uniqueness grain: (state,utility) → (state,utility,structure).
alter table ix_queue_data
  drop constraint if exists ix_queue_data_state_id_utility_name_key;
alter table ix_queue_data
  add constraint ix_queue_data_state_util_mt_key
  unique (state_id, utility_name, metering_type);

-- ── ix_queue_snapshots ───────────────────────────────────────────────────────
-- Append-only time series carries the same dimension so per-structure trends are
-- meaningful. No unique constraint here — just the column + a wider lookup index.
alter table ix_queue_snapshots
  add column if not exists metering_type text not null default 'unknown';

comment on column ix_queue_snapshots.metering_type is
  'Monetization structure of the snapshotted (state,utility) row. Same vocabulary as ix_queue_data.metering_type.';

drop index if exists idx_ix_queue_snapshots_lookup;
create index if not exists idx_ix_queue_snapshots_lookup
  on ix_queue_snapshots(state_id, utility_name, metering_type, snapshot_at desc);
