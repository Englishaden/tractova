-- Migration 059: policy_impact_events
--
-- Stores enacted state-level policies with admin-curated quantified financial
-- impact ($/MW capex, IRR basis points, ongoing fees, revenue haircut) plus
-- applicability filters (safe-harbor cutoffs, FEOC flags, MW ranges, tech).
--
-- Designed so the Lens AI context (api/lens-insight.js buildContext) can
-- inject the relevant policy events for a state into the analyst-brief
-- prompt without requiring a separate UI card.
--
-- ── Why this is separate from puc_dockets (migration 020) ──────────────────
-- puc_dockets tracks PROCEEDINGS (active filings, comment deadlines, dockets
-- in flight). policy_impact_events tracks ENACTED bills + their downstream
-- financial impact on developer projects. Different mental model, different
-- query shape — Lens looks up "what enacted policies hit this state" rather
-- than "what's currently being decided at the PUC." Could be linked via
-- discovery_metadata jsonb (e.g., the docket that became the bill).
--
-- ── AI never sets the dollar/IRR numbers ───────────────────────────────────
-- The hybrid model the user picked: AI can DISCOVER candidate events from
-- news_feed and propose drafts (event_type, pillar, applicability), but the
-- capex_impact_per_mw_usd / irr_impact_bps / ongoing_fee / revenue_haircut
-- fields are admin-curated only. Honest data freshness: speculative AI
-- numbers don't sneak in as "Tractova-verified."

create table if not exists policy_impact_events (
  id                  uuid primary key default gen_random_uuid(),

  -- ── Identity ─────────────────────────────────────────────────────────────
  state               text not null,                               -- 'ME', 'NY', etc. (2-letter)
  event_name          text not null,                               -- 'LD 1777', 'VDER Tranche 6'
  event_type          text not null check (event_type in
                        ('enacted_bill','puc_order','tariff_change','rule_filing','executive_order')),
  effective_date      date,
  status              text not null check (status in
                        ('pending','enacted','partially_effective','overturned','expired'))
                      default 'enacted',
  pillar              text not null check (pillar in
                        ('offtake','ix','site','cross-cutting')),

  -- ── Quantified impact (admin-curated; AI never writes these) ─────────────
  capex_impact_per_mw_usd        numeric,   -- one-time per-MW capex delta (+ = cost, - = savings)
  irr_impact_bps                 numeric,   -- equity IRR delta in basis points (signed)
  ongoing_fee_per_mw_yr_usd      numeric,   -- recurring annual fee (grid-services charge, etc.)
  revenue_haircut_pct            numeric,   -- % reduction in headline revenue
  impact_confidence              text check (impact_confidence in ('high','medium','low')),
  impact_methodology             text,      -- analyst note: how the numbers were derived

  -- ── Applicability ────────────────────────────────────────────────────────
  applies_to_new_applications    boolean not null default true,
  applies_to_existing_queue      boolean not null default false,
  applies_to_operating_projects  boolean not null default false,
  safe_harbor_eligible           boolean not null default false,
  safe_harbor_cutoff_date        date,
  safe_harbor_notes              text,
  feoc_compliance_required       boolean not null default false,
  feoc_notes                     text,
  min_mw_ac                      numeric,
  max_mw_ac                      numeric,
  applicable_technologies        text[],
  applicable_stages              text[],

  -- ── Sourcing / curation provenance ───────────────────────────────────────
  summary                        text not null,                      -- 1-2 sentence why-this-matters
  analyst_note                   text,                               -- longer rationale + caveats
  source_url                     text not null,                      -- bill text / PUC order
  discovered_via                 text not null default 'manual'
                                 check (discovered_via in
                                        ('manual','news_ai_suggest','docket_ai_suggest','user_report')),
  discovery_metadata             jsonb,
  review_status                  text not null default 'published'
                                 check (review_status in
                                        ('draft','pending_admin_review','published','rejected')),

  -- ── Standard ─────────────────────────────────────────────────────────────
  is_active                      boolean not null default true,
  verified_at                    timestamptz,                       -- last admin verification
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now()
);

create index if not exists pie_state_idx              on policy_impact_events (state);
create index if not exists pie_active_published_idx
  on policy_impact_events (state, is_active)
  where is_active = true and review_status = 'published';
create index if not exists pie_review_status_idx      on policy_impact_events (review_status)
  where review_status in ('draft','pending_admin_review');
create index if not exists pie_verified_at_idx        on policy_impact_events (state, verified_at desc)
  where is_active = true and review_status = 'published';

-- updated_at autotouch (mirrors puc_dockets pattern from migration 020).
create or replace function touch_pie_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists policy_impact_events_touch_updated_at on policy_impact_events;
create trigger policy_impact_events_touch_updated_at
  before update on policy_impact_events
  for each row execute function touch_pie_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table policy_impact_events enable row level security;

-- Published rows are publicly readable (the Lens prompt fetches them
-- server-side via service-role anyway, but public read also lets anonymous
-- preview surfaces show policy context without elevated auth).
drop policy if exists "policy_impact_events public read" on policy_impact_events;
create policy "policy_impact_events public read"
  on policy_impact_events for select
  using (is_active = true and review_status = 'published');

-- Admin write: role-based (mirror migration 058 pattern). Service-role
-- bypasses RLS entirely for cron-inserted drafts.
drop policy if exists "policy_impact_events admin write" on policy_impact_events;
create policy "policy_impact_events admin write"
  on policy_impact_events for all
  to authenticated
  using (exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ))
  with check (exists (
    select 1 from profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  ));

notify pgrst, 'reload schema';
