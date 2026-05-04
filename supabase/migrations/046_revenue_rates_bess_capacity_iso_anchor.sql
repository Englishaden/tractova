-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 046 — revenue_rates: BESS capacityPerKwYear re-anchored on
-- 2024-2025 ISO clearing prices × 4-hr BESS accreditation factor + 2026 forward
--
-- Triggered by data-trust-audit (docs/data-trust-audit.md): BESS_REVENUE_DATA
-- capacityPerKwYear was Tier B HIGH-RISK because ISO clearing prices swing
-- 2-9× year over year and the prior 2026-04 vintage values were aggressively
-- high (especially ISO-NE / NY / CA states), not reflecting the substantial
-- accreditation discount ISOs apply to short-duration storage.
--
-- ── Anchors ──────────────────────────────────────────────────────────────────
-- PJM RPM 2025/26 BRA: $269.92/MW-day = $98.5/kW-yr (cleared 2024) × 60%
--   accreditation for 4-hr BESS → $59/kW-yr base + LDA premium (NJ EMAAC
--   highest, MD/VA mid)
-- NYISO ICAP 2024-2025: $30-50/kW-yr by zone × 50-60% accreditation; NY-
--   specific VDER + ICAP zone stack pushes paired-storage to ~$50/kW-yr
-- ISO-NE FCM 2025/26 FCA: cleared $80-90/kW-yr × 60% accreditation =
--   $48-54/kW-yr effective; high zones (MA/CT) +10%
-- CAISO RA 2024 bilateral: $40-80/kW-yr × 70% accreditation → $30-55
-- MISO PRA 2025/26 zonal: ~$50/kW-yr × 70% accreditation → $35
-- SPP / WECC / SE non-RTO: bilateral $20-40/kW-yr range
-- HECO: no capacity market — bilateral PPA captures revenue, value=0
--
-- ── Tractova synthesis layers (Tier B disclosure) ───────────────────────────
-- - Accreditation factor 60-70% for 4-hr BESS: ISO-specific, evolving as
--   ISOs revise methodologies (PJM 2024 cuts, CAISO 2024 cuts).
-- - State-within-LDA: editorial (PJM 6+ LDAs, ISO-NE 8 zones; state ≠ zone).
-- - 2026 forward: +5-10% on 2025/26 clearing reflects load growth + data-
--   center demand surge + reserve margin tightening.
--
-- ── Per-state changes ───────────────────────────────────────────────────────
-- ISO-NE / NY / CA come DOWN 25-30% to reflect realistic 4-hr BESS economics
-- after accreditation. PJM stays roughly the same (slight tweaks per LDA).
-- MISO/SPP/WECC modestly down. HI unchanged at 0 (no capacity market).
--
-- Hybrid (PV+storage) IRRs in MA/NY/CA/CT will be modestly lower as a result.
-- The new numbers more accurately reflect what storage projects actually
-- receive in capacity revenue.
--
-- Safe to re-run. UPDATE only touches bess_capacity_per_kw_year + bess_label.
-- ─────────────────────────────────────────────────────────────────────────────

-- PJM (2025/26 BRA cleared $98.5/kW-yr × 60% accreditation = $59 + LDA premium)
update revenue_rates set bess_capacity_per_kw_year = 65, bess_label = 'Illinois (PJM ComEd)' where state_id = 'IL';
update revenue_rates set bess_capacity_per_kw_year = 68, bess_label = 'New Jersey (PJM EMAAC)' where state_id = 'NJ';
update revenue_rates set bess_capacity_per_kw_year = 62 where state_id = 'MD';
update revenue_rates set bess_capacity_per_kw_year = 62 where state_id = 'VA';

-- NYISO (NY-specific VDER+ICAP stack)
update revenue_rates set bess_capacity_per_kw_year = 50 where state_id = 'NY';

-- ISO-NE (2025/26 FCA $80-90/kW-yr × 60% = $48-54)
update revenue_rates set bess_capacity_per_kw_year = 60 where state_id = 'MA';
update revenue_rates set bess_capacity_per_kw_year = 60 where state_id = 'CT';
update revenue_rates set bess_capacity_per_kw_year = 58 where state_id = 'RI';
update revenue_rates set bess_capacity_per_kw_year = 55 where state_id = 'ME';

-- CAISO (RA bilateral × 70% accreditation)
update revenue_rates set bess_capacity_per_kw_year = 65 where state_id = 'CA';

-- MISO (2025/26 PRA × 70% accreditation)
update revenue_rates set bess_capacity_per_kw_year = 35 where state_id = 'MN';

-- SPP / WECC / SE non-RTO (bilateral)
update revenue_rates set bess_capacity_per_kw_year = 30 where state_id = 'CO';
update revenue_rates set bess_capacity_per_kw_year = 40 where state_id = 'NM';
update revenue_rates set bess_capacity_per_kw_year = 35 where state_id = 'OR';
update revenue_rates set bess_capacity_per_kw_year = 30 where state_id = 'WA';
update revenue_rates set bess_capacity_per_kw_year = 30 where state_id = 'FL';

-- HECO (no capacity market — bilateral PPA captures revenue)
update revenue_rates set bess_capacity_per_kw_year = 0 where state_id = 'HI';
