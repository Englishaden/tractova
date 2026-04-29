-- Migration 015: api_call_log
--
-- Per-user invocation log for AI endpoints. Drives rate-limiting in
-- api/lens-insight.js to bound Anthropic spend in case a user (or stolen
-- token) hammers the endpoint. Also feeds future per-tier usage analytics.
--
-- Service-role-only access. The app never reads or writes this directly.

create table if not exists api_call_log (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  action      text not null,
  model       text,
  called_at   timestamptz not null default now()
);

create index if not exists api_call_log_user_called_idx
  on api_call_log (user_id, called_at desc);

alter table api_call_log enable row level security;

-- No client policies. service_role bypasses RLS by default; that's the only
-- caller. Without policies, RLS denies all anon/authenticated roles by default.

notify pgrst, 'reload schema';
