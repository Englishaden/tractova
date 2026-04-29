-- ─────────────────────────────────────────────────────────────────────────────
-- V3 Wave 1.3: Slack alert integration
--
-- Adds two columns to profiles so users can opt into Slack-delivered policy
-- alerts in addition to (or instead of) email. Idempotent ALTER TABLE ADD
-- COLUMN IF NOT EXISTS for both — safe to re-run.
--
--   slack_webhook_url  : the user's Slack incoming webhook (created in their
--                        own Slack workspace via apps.slack.com/build).
--                        Tractova never holds OAuth credentials; the user
--                        controls revocation entirely on their side.
--   alert_slack        : opt-in toggle. Defaults FALSE so existing users
--                        aren't surprised by a Slack post they didn't ask for.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles
  add column if not exists slack_webhook_url text,
  add column if not exists alert_slack       boolean default false;

notify pgrst, 'reload schema';
