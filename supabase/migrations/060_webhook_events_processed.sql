-- Migration 060 — Stripe webhook idempotency.
--
-- Stripe retries failed webhooks (5min, 1hr, 6hr, 1d, etc.). If our
-- handler succeeds at the side effect (DB write) but the response
-- doesn't reach Stripe (timeout, network, edge), Stripe retries with
-- the SAME event.id and we re-process. For most events this is
-- idempotent (an upsert that does the same thing), but two race
-- conditions matter:
--
--   1. checkout.session.completed: between the first attempt
--      reading profile and writing stripe_customer_id, a different
--      session for a different user could land. The retry would then
--      link the wrong user.
--
--   2. customer.subscription.updated/.deleted: similar — between
--      lookup-by-customer and update, a customer ID swap could occur
--      and the retry pins the wrong tier.
--
-- This table holds processed event IDs so the handler can short-circuit
-- on retry. Single column PK = automatic dedup. RLS allows nobody;
-- only the service-role webhook handler reads/writes.
--
-- Apply via Supabase SQL editor. Idempotent.

create table if not exists webhook_events_processed (
  event_id   text primary key,
  source     text not null default 'stripe',
  created_at timestamptz not null default now()
);

comment on table webhook_events_processed is
  'Idempotency ledger for inbound webhook events. INSERT on successful processing; SELECT to check before processing. Stripe today; Resend / others future.';

-- Optional cleanup index — let us prune old rows easily.
create index if not exists webhook_events_processed_created_at_idx
  on webhook_events_processed (created_at desc);

-- RLS: lock down. Service-role bypasses RLS; this is belt-and-suspenders
-- against a future role grant. No anon / authenticated read or write.
alter table webhook_events_processed enable row level security;

drop policy if exists "webhook_events_processed deny all" on webhook_events_processed;
create policy "webhook_events_processed deny all"
  on webhook_events_processed
  for all
  using (false)
  with check (false);

-- Optional: a maintenance function to prune events older than 90 days.
-- Stripe doesn't retry past 3 days, so 90 is generous; keeps the table
-- small enough for negligible query cost.
create or replace function public.prune_webhook_events_older_than_days(days int default 90)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - (days || ' days')::interval;
  deleted int;
begin
  delete from webhook_events_processed where created_at < cutoff;
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

comment on function public.prune_webhook_events_older_than_days is
  'Maintenance: delete webhook idempotency rows older than N days (default 90). Run periodically.';
