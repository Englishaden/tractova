-- ─────────────────────────────────────────────────────────────────────────────
-- V3 Step 4: positive event alerts (good news)
-- Capacity additions, new CS program launches, score improvements >10pts.
-- Defaults to true — opt-out model, consistent with existing alert preferences.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles
  add column if not exists alert_positive boolean default true;
