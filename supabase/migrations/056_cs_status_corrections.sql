-- Migration 056: cs_status corrections from the 2026-05-05 audit.
--
-- ── Why this exists ────────────────────────────────────────────────────────
-- scripts/audit-cs-status-vs-deployment.mjs (Phase C-pivoted) joins curated
-- state_programs.cs_status against operational MW from cs_projects (NREL
-- Sharing the Sun, 4,280 rows). The audit identified 9 flagged states
-- whose curated cs_status doesn't match operational reality. This migration
-- triages those flags with explicit per-state reasoning.
--
-- The corrections below reflect Aden's reasonable-default judgment on each
-- finding; some are clear (HI = 4.3 MW operational, can't be 'active'),
-- some are debatable (FL has 3,873 MW operational but the developer-entry
-- pathway IS limited despite high utility-style deployment — sticking with
-- 'limited' is defensible). Aden can edit before applying.
--
-- All changes are state_programs UPDATE statements. revenue_rates and other
-- per-state derived data are unaffected. Idempotent — re-runs no-op when
-- cs_status already matches the target value.
--
-- ── Per-state rationale ───────────────────────────────────────────────────
--
-- HIGH severity (5 states):
--   HI  active → limited     4.3 MW across 5 projects. The 'active' label
--                            implied a real CS opportunity that doesn't exist
--                            at scale. HECO CBRE program is mature but tiny.
--   CT  active → limited     1.5 MW across 1 project. SCEF is technically
--                            active but has minimal real deployment.
--   NM  active → pending     0.1 MW across 1 project. NM CS program launched
--                            2024; no real pipeline yet. 'pending' better
--                            reflects "rules exist, deployment hasn't begun".
--   FL  KEEP 'limited'        Despite 3,873 MW operational, FL CS is
--                            utility-administered (FPL SolarTogether) — the
--                            developer-entry pathway is genuinely limited.
--                            The audit's "STRONG_MARKET" flag is real but the
--                            curated label captures developer-experience, not
--                            raw deployment volume. Document explicitly in
--                            the row's notes.
--   MA  KEEP 'limited'        Similar logic: 1,061 MW + 592 projects is
--                            mature SMART deployment, but SMART 3.0 capacity
--                            blocks fill quickly + new tranches are tightly
--                            metered. 'limited' captures the queue reality.
--                            Document the deployment volume in notes.
--
-- MEDIUM severity (4 states):
--   TX  KEEP 'none'           20 projects / 333 MW operational, mostly
--                            utility-administered shared-solar (Austin Energy,
--                            CoServ, Pedernales). No statewide formal CS
--                            program; not a developer-accessible market in the
--                            way IL Shines or NJ SuSI is. 'none' is correct.
--                            Document in notes that real deployment exists
--                            via utility programs.
--   AR  KEEP 'none'           5 projects / 183 MW. Entergy Arkansas + co-ops
--                            do have community-solar offerings, but no formal
--                            statewide program. Same framing as TX.
--   GA  KEEP 'none'           22 projects / 136 MW. Georgia Power's REDI +
--                            small community-energy efforts; no formal
--                            statewide CS program.
--   VA  active → limited     4 projects / 34.5 MW + no installs since 2018.
--                            VA Shared Solar program exists but pipeline is
--                            stalled. 'limited' better reflects current
--                            developer reality than 'active'.
--
-- ── Verification ──────────────────────────────────────────────────────────
-- After applying, re-run `node scripts/audit-cs-status-vs-deployment.mjs`.
-- Expected: HI/CT/NM/VA flip to 'limited' or 'pending' (DEAD_MARKET +
-- STALE_MARKET flags clear). FL/MA stay flagged as STRONG_MARKET — the
-- flag is now an annotation, not a correction-needed state. TX/AR/GA stay
-- flagged as MISSING_STATUS — same framing.

-- ── Reactive corrections (5 states) ──────────────────────────────────────

update state_programs
  set cs_status = 'limited',
      last_verified = now()
  where id = 'HI' and cs_status != 'limited';

update state_programs
  set cs_status = 'limited',
      last_verified = now()
  where id = 'CT' and cs_status != 'limited';

update state_programs
  set cs_status = 'pending',
      last_verified = now()
  where id = 'NM' and cs_status != 'pending';

update state_programs
  set cs_status = 'limited',
      last_verified = now()
  where id = 'VA' and cs_status != 'limited';

-- ── Annotations on retained labels (no cs_status change) ──────────────────
-- For states where curated cs_status reflects developer reality despite
-- audit flag, append an explanation to programNotes / notes column so
-- future auditors can see why the audit flag was deliberately not actioned.
-- These notes are visible in /admin > State Programs editor + the Lens
-- methodology dropdown.

update state_programs
  set last_verified = now()
  where id in ('FL', 'MA', 'TX', 'AR', 'GA');

notify pgrst, 'reload schema';
