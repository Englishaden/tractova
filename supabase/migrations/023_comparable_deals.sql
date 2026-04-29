-- Migration 023: comparable_deals
--
-- V3 Wave 2 -- Comparable Deals DB. The defensible-data play per the V3 plan
-- 'Moat' section. Anonymized record of recently-completed / under-construction /
-- proposed CS / DER projects, sourced primarily from public FERC Form 1
-- interconnection filings, EIA Form 860 plant data, state PUC docket
-- approvals, and Tractova-curated industry news.
--
-- Lets a developer scanning a county / state / tech see realistic comps:
-- 'IL community solar at 5 MW, what other projects are in flight here?'
-- 'Are 5 MW deals routinely closing at this offtake rate, or are we high?'
-- That benchmark is what's not findable on DSIRE / individual state PUC
-- portals without 20+ hours of manual aggregation.
--
-- Public read (any signed-in user). Writes admin-only via service role
-- (mirrors the puc_dockets pattern from migrations 020/021).

create table if not exists comparable_deals (
  id                       uuid primary key default gen_random_uuid(),
  state                    text not null,
  county                   text,                                                              -- nullable -- some FERC filings only list state
  technology               text not null check (technology in ('Community Solar', 'C&I Solar', 'BESS', 'Hybrid')),
  mw                       numeric not null check (mw > 0),
  status                   text not null check (status in ('proposed', 'under_construction', 'operational', 'cancelled')),
  developer                text,                                                              -- 'Anonymous' / 'Tier-1 IPP' / actual name -- we anonymize at query time when needed
  estimated_capex_per_w    numeric,                                                           -- $/W AC
  offtake_summary          text,                                                              -- free-text summary of offtake structure (PPA rate range, REC mechanism, etc.)
  ix_difficulty            text check (ix_difficulty in ('easy', 'moderate', 'hard', 'very_hard')),
  serving_utility          text,
  source                   text not null,                                                     -- 'FERC Form 1' / 'EIA 860' / 'PUC docket' / 'Tractova analyst' / etc.
  source_url               text,
  filing_date              date,                                                              -- when entered queue / filed / announced
  cod_target               date,                                                              -- target commercial operation date
  notes                    text,                                                              -- 1-2 sentence Tractova analyst note (why this comp matters)
  is_active                boolean not null default true,
  last_updated             timestamptz not null default now(),
  created_at               timestamptz not null default now()
);

create index if not exists comparable_deals_state_idx       on comparable_deals (state);
create index if not exists comparable_deals_technology_idx  on comparable_deals (technology);
create index if not exists comparable_deals_county_idx      on comparable_deals (county);
create index if not exists comparable_deals_status_idx      on comparable_deals (status);
create index if not exists comparable_deals_filing_date_idx on comparable_deals (filing_date desc);
create index if not exists comparable_deals_active_idx      on comparable_deals (is_active) where is_active = true;
-- Composite for the most common Lens query: matching state + tech + size
create index if not exists comparable_deals_lookup_idx      on comparable_deals (state, technology, mw) where is_active = true;

alter table comparable_deals enable row level security;

drop policy if exists "comparable_deals public read" on comparable_deals;
create policy "comparable_deals public read"
  on comparable_deals for select
  using (true);

drop policy if exists "comparable_deals admin insert" on comparable_deals;
create policy "comparable_deals admin insert"
  on comparable_deals for insert
  with check (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "comparable_deals admin update" on comparable_deals;
create policy "comparable_deals admin update"
  on comparable_deals for update
  using       (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')
  with check  (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "comparable_deals admin delete" on comparable_deals;
create policy "comparable_deals admin delete"
  on comparable_deals for delete
  using (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

notify pgrst, 'reload schema';
