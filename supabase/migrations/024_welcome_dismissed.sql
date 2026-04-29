-- Migration 024: profiles.welcome_dismissed_at
--
-- V3-extension -- per-user persistence for the first-run WelcomeCard
-- dismissal so the onboarding card doesn't reappear when a user switches
-- browsers or devices. Previously stored in localStorage only (per-device).
--
-- NULL  = user has not dismissed; show the card on Dashboard.
-- valid = timestamp of dismissal; never show again.
--
-- Backfill all existing users with now() so they don't get re-welcomed
-- after this migration ships. To re-trigger the card for testing:
--   update profiles set welcome_dismissed_at = null where id = '<your uid>';
-- ...and clear localStorage key 'tractova_welcome_dismissed'.

alter table profiles
  add column if not exists welcome_dismissed_at timestamptz;

-- Backfill existing users: they've already seen the product, no need to
-- present the welcome card on their next sign-in.
update profiles
set welcome_dismissed_at = now()
where welcome_dismissed_at is null;

notify pgrst, 'reload schema';
