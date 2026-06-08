# EIA-861 commercial retail rates — offtake anchor source

On-disk sourcing for the C&I / Net-Metering **offtake** anchor (`CI_OFFTAKE_SCORES`
in `src/lib/scoreEngine.js`). Mirrors `docs/dsire-net-billing/` but as **one file**
(`commercial-retail-rates.json`) because every state's rate comes from a single
EIA table, not per-state program pages.

## Two-layer honesty
- **Observed:** `commercial_cents_kwh` — the EIA-published commercial-sector retail
  rate, cited to EIA Electric Power Monthly Table 5.6.B (Form EIA-861M).
- **Synthesis (disclosed):** `score` — Tractova's 0-100 offtake signal, derived by
  the documented formula below. It is editorial, not published by EIA.

## Calibration (the synthesis layer)
```
score = clamp(round(34 + 1.8 × commercial_cents_per_kWh), 45, 72)
```
The 2026-06 audit added this cohort (the 32 legacy states pre-date it). The legacy
scores blend rate with **per-state deep-market boosts** (e.g. TX 62 and FL 72 on
huge industrial/PPA volume despite modest rates; MI 74 on its auto-industry C&I
depth). This new cohort gets **no such boost** — they are thin / non-ISO markets
where the retail rate is the honest dominant offtake signal, so a transparent
rate-anchored base is more defensible than inventing per-state depth I can't source.
The formula was sanity-checked against same-table legacy comparators (WA 12.01¢→52,
OR 10.52¢→56, MN 11.54¢→55, MO 9.88¢→54, VA 11.52¢→58) so the new states interleave
sensibly rather than contradicting an existing neighbor.

## AK / HI — deliberately gated
Both have real, high EIA commercial rates but markets where rate→offtake-depth
breaks down (AK remote/islanded/no-ISO; HI per-island grids + gated export tariff).
They are left on the `55` fallback (which already surfaces the "limited coverage —
directional only" caption) rather than fabricate a deep-market score. See the
`gated` block in the JSON for the per-state rationale.

## Freshness / CI
`review_due` (annual) is enforced by `scripts/audit-check.mjs` — CI fails once it
passes, forcing a re-source against the then-current EIA vintage and a recalibration
review. To refresh: re-fetch Table 5.6.B, update the rates + `vintage` +
`fetched` + `review_due`, recompute scores via the formula, and update
`CI_OFFTAKE_SCORES`.
