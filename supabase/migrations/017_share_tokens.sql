-- Migration 017: share_tokens
--
-- Token-based read-only links for Deal Memo. Developer clicks "Share" in
-- Library, server generates an opaque token, recipient hits /memo/:token
-- (no auth required) and sees a frozen snapshot of the memo + project
-- as it existed at share time.
--
-- Self-expiring (90 days default) and view-capped (100 views) so leaked
-- tokens have bounded blast radius.

create table if not exists share_tokens (
  token       text primary key default replace(gen_random_uuid()::text, '-', ''),
  project_id  uuid not null references projects(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  memo        jsonb,                                            -- frozen AI memo + project snapshot
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '90 days'),
  view_count  int not null default 0,
  max_views   int not null default 100
);

create index if not exists share_tokens_user_id_created_at_idx
  on share_tokens (user_id, created_at desc);
create index if not exists share_tokens_project_id_idx
  on share_tokens (project_id);

alter table share_tokens enable row level security;

-- Owner can read their own tokens (e.g. show "shared X times" in UI later).
drop policy if exists "owner can read own tokens" on share_tokens;
create policy "owner can read own tokens" on share_tokens
  for select using (auth.uid() = user_id);

-- Owner can insert their own (the API route also uses service-role; either path works).
drop policy if exists "owner can insert own tokens" on share_tokens;
create policy "owner can insert own tokens" on share_tokens
  for insert with check (auth.uid() = user_id);

-- Owner can revoke their own (delete).
drop policy if exists "owner can delete own tokens" on share_tokens;
create policy "owner can delete own tokens" on share_tokens
  for delete using (auth.uid() = user_id);

-- No public read policy. The /memo/:token endpoint uses service-role to
-- look up tokens and increment view_count, then returns sanitized memo.
-- That keeps the table itself private.

notify pgrst, 'reload schema';
