-- Migration 079: CHECK constraint on state_programs.ix_difficulty
-- (2026-06 audit, Wave 3 — IX pillar data integrity).
--
-- The audit (A1) flagged that state_programs.ix_difficulty (text, default
-- 'moderate') has NO DB CHECK — a curation typo ('moderatte', 'med', '') would
-- silently fall through scoreEngine's `{easy/moderate/hard/very_hard}[v] ?? 50`
-- to the 50 baseline, mis-scoring the IX pillar with no signal that the value
-- is junk. comparable_deals.ix_difficulty (migration 023) already constrains the
-- same four values; this brings the canonical scoring table in line.
--
-- Added NOT VALID so applying NEVER fails on a pre-existing dirty row — the
-- constraint enforces on every future write immediately (catching bad curation
-- at the source), and existing rows are checked on demand. Aden: after confirming
-- the live values are clean, run
--   ALTER TABLE state_programs VALIDATE CONSTRAINT state_programs_ix_difficulty_chk;
-- to extend enforcement to the existing rows. (If VALIDATE errors, a row holds a
-- non-enum value — fix it via /admin → State Programs, then re-validate.)
--
-- Idempotent guard; Aden applies.

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'state_programs_ix_difficulty_chk'
  ) then
    alter table state_programs
      add constraint state_programs_ix_difficulty_chk
      check (ix_difficulty is null or ix_difficulty in ('easy', 'moderate', 'hard', 'very_hard'))
      not valid;
  end if;
end $$;

notify pgrst, 'reload schema';
