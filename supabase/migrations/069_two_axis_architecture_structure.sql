-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 069: two-axis project model — architecture + structure columns
--
-- Why: the scope decision (memory project_scope_and_tech_taxonomy) splits the
-- conflated single `technology` field into two orthogonal axes:
--   - architecture  (system: 'Standalone PV' | 'PV + Storage' | legacy 'Standalone BESS')
--   - structure     (monetization: 'Community Solar' | 'Net Metering' | 'Net Billing' | 'C&I behind-the-meter')
--
-- `technology` is KEPT as a derived mirror (a composed label, e.g.
-- 'Community Solar + Storage') so the long-tail display/read sites keep working;
-- the new columns are the canonical attributes the Lens form + scoreEngine use.
-- Single source of truth for the mapping: src/lib/lensFormConstants.js
-- (axesFromTechnology / composeTechnology). This backfill mirrors axesFromTechnology.
--
-- Standalone BESS is a LEGACY value only (merchant storage is out of scope) —
-- preserved for existing saved projects (structure stays NULL), not offered for
-- new ones. Pure additive columns + a one-time backfill — safe + reversible.
-- ─────────────────────────────────────────────────────────────────────────────

alter table projects            add column if not exists architecture text;
alter table projects            add column if not exists structure    text;
alter table comparable_deals    add column if not exists architecture text;
alter table comparable_deals    add column if not exists structure    text;
alter table scenario_snapshots  add column if not exists architecture text;
alter table scenario_snapshots  add column if not exists structure    text;

comment on column projects.architecture is
  'System architecture (two-axis model, migration 069): Standalone PV | PV + Storage | Standalone BESS (legacy). SSOT: src/lib/lensFormConstants.js. technology is the derived composed-label mirror.';
comment on column projects.structure is
  'Monetization structure (two-axis model): Community Solar | Net Metering | Net Billing | C&I behind-the-meter (NULL for legacy Standalone BESS). Drives the offtake sub-score + IX-view scope.';

-- ── Backfill (mirrors axesFromTechnology). Only rows missing the new columns. ──
-- Legacy standalone BESS: technology names a battery but no solar/program word.
-- Order matters: BESS special-case → storage→PV+Storage → else Standalone PV;
-- structure: BESS→NULL → C&I → Net Billing (before Net Metering) → Net Metering → CS.

do $$
declare t text;
begin
  foreach t in array array['projects','comparable_deals','scenario_snapshots']
  loop
    execute format($f$
      update %I set
        architecture = case
          when technology ilike '%%bess%%' and technology !~* 'solar|community|c&i|commercial|industrial|net ' then 'Standalone BESS'
          when technology ~* '\+\s*storage|hybrid|storage' then 'PV + Storage'
          else 'Standalone PV'
        end,
        structure = case
          when technology ilike '%%bess%%' and technology !~* 'solar|community|c&i|commercial|industrial|net ' then null
          when technology ~* 'c&i|commercial|industrial' then 'C&I behind-the-meter'
          when technology ~* 'net billing' then 'Net Billing'
          when technology ~* 'net metering' then 'Net Metering'
          else 'Community Solar'
        end
      where architecture is null
    $f$, t);
  end loop;
end $$;
