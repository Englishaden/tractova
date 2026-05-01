-- Migration 042: cancellation_feedback — exit-intent capture before users
-- click through to the Stripe billing portal to cancel.
--
-- The Stripe portal is hosted on Stripe's domain so we can't intercept the
-- actual cancel click. Instead, the Profile page surfaces a separate
-- "Cancel subscription" link (distinct from "Manage subscription") that
-- routes through a modal capturing reason + free-text feedback BEFORE
-- handing off to the portal. Submission is voluntary — users can skip
-- straight to Stripe — so capture rate will be partial, but every row
-- is high-signal because it's self-identified pre-cancel intent.
--
-- Deliberately denormalized: we capture the user's email + tier at submit
-- time so the row stays meaningful even after the user is downgraded /
-- deleted from auth.users. Used by the founder for manual win-back
-- outreach in the first 100-customer phase before automated retention
-- flows are worth building.

create table if not exists cancellation_feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  user_email      text,                                  -- snapshot at submit time
  tier_at_submit  text,                                  -- 'pro' | 'trialing' | etc
  reason_category text not null,                         -- 'pricing' | 'missing_feature' | 'wrong_fit' | 'just_exploring' | 'other'
  free_text       text,                                  -- nullable, user-provided context
  destination     text not null default 'stripe_portal', -- 'stripe_portal' | 'staying' (clicked I'll stay)
  created_at      timestamptz not null default now()
);

create index if not exists cancellation_feedback_user_idx
  on cancellation_feedback (user_id, created_at desc);

create index if not exists cancellation_feedback_created_idx
  on cancellation_feedback (created_at desc);

alter table cancellation_feedback enable row level security;

-- Users can read their own submissions (transparency).
do $$ begin
  create policy "users read own cancellation feedback"
    on cancellation_feedback for select
    using (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- Users can insert their own. The API also writes via service-role for
-- the email + tier snapshot fields, but this lets the UI write directly
-- without a server round-trip if needed.
do $$ begin
  create policy "users insert own cancellation feedback"
    on cancellation_feedback for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

-- No update / delete policy — feedback is append-only. Founder reviews
-- via direct DB query during the manual-outreach phase.

notify pgrst, 'reload schema';
