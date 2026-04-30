-- Migration 028: news_feed automation columns
--
-- Extends news_feed with the fields needed for automated RSS+AI ingest
-- (refresh-data.js?source=news). Manual admin curation continues to work
-- unchanged -- the new fields are nullable, populated only by the cron.
--
-- dedupe_hash: SHA-256(url + normalized_title), first 16 hex chars.
--   Unique constraint prevents re-inserting the same article on
--   subsequent cron runs.
-- auto_classified: true if inserted by the RSS+AI cron, false (or null)
--   if admin-curated. Lets the news-feed UI optionally tag automated
--   items differently (or not -- design choice).
-- relevance_score: 0-100 from the AI classifier. Below threshold (~60)
--   we skip insert; above we keep. Stored for post-hoc tuning.
-- last_seen_at: most recent time we saw this article in an RSS feed.
--   Lets us detect stale-but-still-listed articles (vs new ones).

alter table news_feed
  add column if not exists dedupe_hash       text,
  add column if not exists auto_classified   boolean not null default false,
  add column if not exists relevance_score   int,
  add column if not exists last_seen_at      timestamptz;

create unique index if not exists news_feed_dedupe_hash_uq
  on news_feed (dedupe_hash)
  where dedupe_hash is not null;

create index if not exists news_feed_auto_classified_idx
  on news_feed (auto_classified) where auto_classified = true;

notify pgrst, 'reload schema';
