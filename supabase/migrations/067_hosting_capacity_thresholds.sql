-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 067: hosting_capacity_data — CS-relevant threshold buckets
--
-- Community solar is mostly 1-5 MW (sub-10 MW). A single ≥5MW "sites with
-- capacity" count is the UPPER end of CS and undercounts sites usable for the
-- typical smaller CS project. Instead we pre-compute, per utility, the count of
-- grid sites that can host ≥ each CS-relevant threshold, so the Lens can show
-- the count matching the developer's actual project MW (match-threshold-to-use-
-- case). Stored as JSONB { "1": n, "2": n, "3": n, "5": n, "10": n } — MW → site count.
--
-- Additive. The existing cells_with_capacity (the ≥5MW count) stays for
-- back-compat / fallback until the next refresh populates sites_by_threshold.
-- ─────────────────────────────────────────────────────────────────────────────

alter table hosting_capacity_data
  add column if not exists sites_by_threshold jsonb;

comment on column hosting_capacity_data.sites_by_threshold is
  'CS-relevant site counts keyed by MW threshold, e.g. {"1":1200,"2":900,"3":600,"5":300,"10":40} — # of grid units that can host >= that many MW of new DG. Lens picks the bucket nearest the developer''s project size.';
