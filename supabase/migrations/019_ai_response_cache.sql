-- Migration 019: ai_response_cache
--
-- Cross-user, time-bounded cache for expensive AI generations on
-- /api/lens-insight. Keyed by a deterministic SHA-256 of the prompt-
-- relevant inputs so identical requests across DIFFERENT users
-- collapse to a single Sonnet call.
--
-- Three actions cache: verdict (6h TTL), deal-memo (24h), utility-
-- outreach (24h). Cached payloads invalidate automatically when the
-- underlying state-program lastUpdated date advances (the date is
-- baked into the cache key), so admin edits propagate without needing
-- manual invalidation.
--
-- Expected impact: ~30% drop in Anthropic spend per Pro user
-- (COGS ~$1.51/mo -> ~$1.10/mo) by collapsing repeat queries on the
-- same project + same data-update window into one round-trip.
--
-- Service-role only -- the API route reads/writes via supabaseAdmin
-- in /api/lens-insight.js. No public RLS policy needed; with RLS on
-- and zero policies, anon/authenticated access is denied by default.

create table if not exists ai_response_cache (
  cache_key  text primary key,
  action     text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists ai_response_cache_expires_at_idx
  on ai_response_cache (expires_at);
create index if not exists ai_response_cache_action_idx
  on ai_response_cache (action);

alter table ai_response_cache enable row level security;

-- (Intentionally no policies. RLS-enabled-with-no-policies = service
-- role only, which is exactly the access pattern we want.)

notify pgrst, 'reload schema';
