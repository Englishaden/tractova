-- Migration 020: puc_dockets
--
-- V3 Wave 2 -- PUC Docket Tracker MVP. Surfaces active state public utility
-- commission proceedings that materially shape community-solar program rules
-- (capacity allocations, REC value adjustments, IX tariff revisions, net-
-- metering reform, etc.). For a CS / Hybrid developer, knowing about a
-- comment-open docket two weeks before competitors is the difference between
-- filing comments / pre-positioning project applications and reacting late.
--
-- This is exactly the kind of "weekly-use, decision-critical" intelligence
-- layer the V3 plan calls out as defensible -- public dockets aren't easy
-- to aggregate manually across 50+ PUC e-filing systems.
--
-- MVP scope: schema + admin curation + Lens / Dashboard surfacing. Future
-- iterations will add automated PUC scrapers, comment-deadline reminder
-- emails, and per-user docket alerts when filings hit a state where the
-- user has saved projects.
--
-- Public read (any signed-in user can see). Writes are admin-only via the
-- service role.

create table if not exists puc_dockets (
  id                uuid primary key default gen_random_uuid(),
  state             text not null,
  puc_name          text not null,                                -- e.g. "Illinois Commerce Commission"
  docket_number    text not null,                                -- e.g. "23-0066" or "Case 15-E-0751"
  title             text not null,
  status            text not null check (status in ('comment_open', 'pending_decision', 'filed', 'closed')),
  pillar            text not null check (pillar in ('offtake', 'ix', 'site', 'cross-cutting')),
  impact_tier       text not null check (impact_tier in ('high', 'medium', 'low')),
  filed_date        date,
  comment_deadline  date,
  decision_target   date,
  summary           text not null,                                -- 1-2 sentence Tractova-curated why-this-matters
  source_url        text,                                         -- link to official PUC e-filing entry
  is_active         boolean not null default true,
  last_updated      timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists puc_dockets_state_idx       on puc_dockets (state);
create index if not exists puc_dockets_status_idx      on puc_dockets (status);
create index if not exists puc_dockets_filed_date_idx  on puc_dockets (filed_date desc);
create index if not exists puc_dockets_active_idx      on puc_dockets (is_active) where is_active = true;

alter table puc_dockets enable row level security;

drop policy if exists "puc_dockets public read" on puc_dockets;
create policy "puc_dockets public read"
  on puc_dockets for select
  using (true);

-- Writes via service role (admin route) only -- no public insert/update/delete policy.

notify pgrst, 'reload schema';
