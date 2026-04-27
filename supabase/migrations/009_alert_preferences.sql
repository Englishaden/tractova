-- ─────────────────────────────────────────────────────────────────────────────
-- Alert preferences columns on profiles
-- Defaults: digest on, urgent alerts on — opt-out model
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles
  add column if not exists alert_digest  boolean default true,
  add column if not exists alert_urgent  boolean default true;
