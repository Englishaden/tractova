-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 045 — revenue_rates: C&I $/W re-anchored on NREL Q1 2023 CS MMP
-- (less $0.05 C&I premium) + LBNL TTS 2024 state ratios + Tractova
-- 2023→2026 forward (supersedes any earlier C&I capex values)
--
-- Triggered by data-trust-audit (2026-05-04, docs/data-trust-audit.md):
-- CI_REVENUE_DATA installedCostPerWatt was Tier C high-risk — same Lazard-feel
-- synthesis pattern that was just fixed for CS. This migration applies the
-- same NREL+LBNL methodology to C&I commercial $/W per state.
--
-- ── Sources, separated literal-from-synthesis ──────────────────────────────
--
-- PRIMARY ANCHOR — NREL Q1 2023 Cost Benchmark, CS-specific MMP:
--   - 3-MWdc CS PV-only Modeled Market Price: $1.76/Wdc
--   - C&I premium offset: -$0.05/Wdc (NREL Q1 2023 documents the CS premium
--     over commercial PV at ~$0.05/Wdc, driven by subscriber acquisition.
--     C&I projects are single-offtaker PPA — no subscriber acquisition, no
--     LMI compliance overhead. So C&I is ~$0.05 cheaper than CS at same scale.)
--
-- STATE-LEVEL DIFFERENTIATOR — LBNL TTS 2024 + public TTS CSV:
--   - LBNL TTS 2024 "large non-residential" bracket (>500 kW) — this bracket
--     covers BOTH CS and C&I projects, so the same state ratios that
--     differentiate state cost levels for CS apply to C&I.
--   - State medians from TTS public CSV (non-residential, 0.5-5 MW DC,
--     install years 2022-2024):
--       NY: $1.58/W (n=183), MA: $2.64/W (n=84), CA: $1.87/W (n=468)
--       National TTS median: $1.91/W (n=839)
--
-- TRACTOVA SYNTHESIS — explicit 2023 → 2026 forward:
--   National 2023 anchor: $1.71/Wdc (NREL CS MMP $1.76 - $0.05 C&I offset)
--   Same forward layers as CS (NREL +22% YoY 2023→2024 + FEOC + reshoring +
--     oil-logistics):
--   National 2026 C&I anchor: $2.40/Wdc (CS anchor $2.45 - $0.05 offset)
--
-- STATE MULTIPLIERS (same as CS — TTS large non-res blends CS + C&I):
--   Tier A: NY 0.83, MA 1.38, CA 0.98 (state TTS median ÷ TTS national $1.91)
--   Tier B: ISO-NE high (CT) 1.30, ISO-NE mid (RI) 1.20, ISO-NE rural (ME)
--     1.10, PJM mature (IL/NJ) 1.10, PJM mid (MD) 1.00, PJM south (VA) 0.90,
--     MISO Upper Midwest (MN) 0.90, Pacific NW (OR/WA) 0.95, SE non-RTO
--     (FL) 0.85, SPP/Mountain (CO) 0.90, WECC low (NM) 0.85, HI island 1.55
--
-- NOT TOUCHED IN THIS MIGRATION:
--   - ci_ppa_rate_cents_kwh: Tier C synthesis (state retail rate × ~50-60%
--     discount). Refresh path is LevelTen PPA Index — separate work.
--   - ci_retail_rate_cents_kwh: Tier A on EIA Form 861 2024 — already cited.
--     Last refreshed 2025-06; due for next EIA Form 861 release.
--   - ci_escalator_pct, ci_itc_pct, ci_degradation_pct: industry-standard
--     consensus values, not state-allocated.
--
-- All forward magnitudes + Tier B multipliers are Tractova editorial.
-- Safe to re-run — UPDATE only touches ci_installed_cost_per_watt + ci_label.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tier A (TTS observed n≥40, 0.5-5 MW LBNL large non-residential bracket)
update revenue_rates set ci_installed_cost_per_watt = 1.99 where state_id = 'NY';
update revenue_rates set ci_installed_cost_per_watt = 3.31 where state_id = 'MA';
update revenue_rates set ci_installed_cost_per_watt = 2.35 where state_id = 'CA';

-- Tier B (regional analog × $2.40/W national 2026 C&I anchor)
update revenue_rates set ci_installed_cost_per_watt = 2.64 where state_id = 'IL';
update revenue_rates set ci_installed_cost_per_watt = 2.16 where state_id = 'MN';
update revenue_rates set ci_installed_cost_per_watt = 2.16 where state_id = 'CO';
update revenue_rates set ci_installed_cost_per_watt = 2.64 where state_id = 'NJ';
update revenue_rates set ci_installed_cost_per_watt = 2.64 where state_id = 'ME';
update revenue_rates set ci_installed_cost_per_watt = 2.40 where state_id = 'MD';
update revenue_rates set ci_installed_cost_per_watt = 2.04 where state_id = 'FL';
update revenue_rates set ci_installed_cost_per_watt = 3.12 where state_id = 'CT';
update revenue_rates set ci_installed_cost_per_watt = 3.72 where state_id = 'HI';
update revenue_rates set ci_installed_cost_per_watt = 2.04 where state_id = 'NM';
update revenue_rates set ci_installed_cost_per_watt = 2.28 where state_id = 'OR';
update revenue_rates set ci_installed_cost_per_watt = 2.88 where state_id = 'RI';
update revenue_rates set ci_installed_cost_per_watt = 2.16 where state_id = 'VA';
update revenue_rates set ci_installed_cost_per_watt = 2.28 where state_id = 'WA';
