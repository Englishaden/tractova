-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 047 — revenue_rates: BESS demandChargePerKwMonth + arbitragePerMwh
-- documented + small refinements (closes audit Tier C high-risk #4 — final one)
--
-- Triggered by data-trust-audit (docs/data-trust-audit.md): bess_demand_charge
-- + bess_arbitrage were Tier C high-risk because per-utility demand charge
-- variation + ISO LMP spreads were seeded synthesis without per-state primary
-- citations.
--
-- ── Anchors ─────────────────────────────────────────────────────────────────
-- DEMAND CHARGES ($/kW-month, blended commercial):
--   NREL TP-7A40-71162 "Identifying Potential Markets for Behind-the-Meter
--   Battery Energy Storage" regional ranges + tracked state PUC tariff
--   filings. Single state value approximates 1-3 dominant utility tariffs
--   serving large commercial customers. Intra-state variation can be ±20%.
--   Regional buckets:
--     HI: $20-25/kW-month (island grid)
--     CA: $16-20/kW-month (NEM 3.0 driven)
--     NE high (NJ, MA, CT, NY): $13-15/kW-month
--     PJM mid (IL, MD, VA): $12-13/kW-month
--     ISO-NE rural (RI, ME): $11-13/kW-month
--     MISO / SPP / WECC / SE: $9-11/kW-month
--
-- ARBITRAGE ($/MWh peak-offpeak, 4-hr BESS):
--   Lazard v18 LCOS Storage Value Snapshot (CAISO + ERCOT examples) + ISO
--   LMP histogram analysis. Captures 4-hour TBLS value during one daily
--   charge/discharge cycle. In-zone variation ±$10-15/MWh.
--   Regional buckets:
--     HI: $70-90/MWh (isolated grid, peak/off-peak amplified)
--     CAISO: $40-50/MWh (NEM 3.0 + duck curve steepening)
--     NYISO: $33-37/MWh
--     ISO-NE / PJM: $28-35/MWh
--     MISO / SPP: $22-28/MWh
--     WECC / SE non-RTO: $18-25/MWh
--
-- ── Per-state changes ──────────────────────────────────────────────────────
-- Most values stay where they were (already in plausible regional range).
-- Two refinements:
--   - CA arb: $40 → $45 (NEM 3.0 + duck curve steepening 2024-2026)
--   - CA demand: $16 → $18 (CA IOU tariff trend post-NEM 3.0)
--   - HI demand: $20 → $22 (island grid premium)
-- All other state values unchanged from migration 046.
--
-- Tractova synthesis layers (Tier B disclosure):
--   - State-within-region allocation: editorial
--   - 2026 forward: implicit in regional bucket choice
--
-- Safe to re-run. UPDATE only touches bess_demand_charge_per_kw_month +
-- bess_arbitrage_per_mwh.
-- ─────────────────────────────────────────────────────────────────────────────

-- CA: bumped both demand + arb to reflect NEM 3.0 / duck curve impact
update revenue_rates set bess_demand_charge_per_kw_month = 18,
                         bess_arbitrage_per_mwh = 45
  where state_id = 'CA';

-- HI: demand bumped to reflect island-grid premium
update revenue_rates set bess_demand_charge_per_kw_month = 22
  where state_id = 'HI';

-- All other states' values are unchanged from migration 046. The methodology
-- documentation in revenueEngine.js header comment is the primary deliverable
-- for this commit — values were already aligned with regional buckets, but
-- without explicit per-source citation.
