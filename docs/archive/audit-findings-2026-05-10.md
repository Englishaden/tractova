# Pre-Onboarding Full-Site Audit — Findings

**Date:** 2026-05-10
**Scope:** Lens API across state×tech matrix + UI surfaces (Dashboard, Library, Profile, StateDetailPanel, Search/Lens, Glossary)
**Outcome:** **PASS with caveats.** Two findings to fix before onboarding work begins; one polish item to defer.

---

## Headline numbers

| Audit | Result | Notes |
|---|---|---|
| Lens API matrix (n=32) | **29/32 valid (90.6%)** | Just clears the 90% pass threshold |
| Lens extras (sensitivity, portfolio, compare) | **7/7 valid** | Sensitivity 5/5, portfolio 1/1, compare 1/1 |
| UI audit suite (`tests/audit-ui.spec.js`) | **9/9 pass** | New suite, all green |
| Existing pro-smoke (`tests/pro-smoke.spec.js`) | **6/7 pass** | One stale-copy regression caught by audit |
| **Combined** | **51/55 ≈ 92.7%** | |
| Lens API cost | **$1.34** | Well under $5 cap |

---

## Lens API matrix — full breakdown

**Configuration:** 32 verdict calls hit prod (`https://www.tractova.com`). 5 tier-1 states × 4 tech = 20 + 5 tier-2 × 2 tech = 10 + 2 edge cases = 32. MW varied in 0.13 increments (4.50–6.06) to dodge the 6h Supabase response cache. Cache hit rate: **0/32**, confirming all 32 hit the live Anthropic path.

### Aggregate

| Metric | Value |
|---|---|
| Valid responses (≥5/6 fields) | 29 / 32 (90.6%) |
| HTTP 200 responses | 31 / 32 |
| Latency p50 | 21.5 s |
| Latency p95 | **25.5 s** ← at function timeout |
| Cache hit rate | 0% |
| Estimated cost | $1.24 (verdict) + $0.10 (extras) = $1.34 |

### By state

| State | Valid | Mean latency | Notes |
|---|---|---|---|
| CA | 4/4 | 22.5 s | clean |
| IL | 4/4 | 21.3 s | clean |
| **MA** | **2/4** | 23.9 s | C&I Solar + Hybrid both timed out at 25.5s |
| NY | 4/4 | 22.1 s | clean |
| TX | 4/4 | 21.7 s | clean |
| **NJ** | **1/2** | 24.3 s | Community Solar HTTP 500 (Vercel platform error) |
| MD | 2/2 | 20.8 s | clean |
| PA | 2/2 | 21.1 s | clean |
| CO | 2/2 | 22.5 s | clean |
| AZ | 2/2 | 19.2 s | clean |
| AL (edge, cs_status=none) | 1/1 | 19.0 s | graceful — context says "no CS program" |
| MI (edge, cs_status=pending) | 1/1 | 19.4 s | clean |

### By technology

| Tech | Valid | Notes |
|---|---|---|
| Community Solar | 11/12 | NJ failure |
| BESS | 10/10 | clean |
| C&I Solar | 4/5 | MA timeout |
| Hybrid | 4/5 | MA timeout |

### Failures detail

1. **MA × C&I Solar** — 25.5s, fallback `api_error: Request was aborted` (Anthropic call hit the 25s function timeout in `api/lens-insight.js:340`). Sonnet 4.6 didn't finish.
2. **MA × Hybrid** — 25.5s, same timeout pattern.
3. **NJ × Community Solar** — HTTP 500 from Vercel. Raw body: `{"error":{"code":"500","id":"Km3kJS5xteMB3ETumYJawjxI3VFDxGJA","message":"Internal Server Error"}}`. The request ID is grep-able in Vercel runtime logs for diagnosis.

---

## UI audit — full breakdown

| Test | Status | Notes |
|---|---|---|
| Dashboard 30-state click matrix | ✅ PASS | All 30 states clicked cleanly, no console errors, no NaN/undefined in DOM. Required `force: true` clicks + ESC-between-iterations to bypass the open-panel-blocks-map issue (see #3 below). |
| Library populated path | ✅ PASS | No bad text, no errors |
| Library empty state (`?preview=empty`) | ✅ PASS | Onboarding card renders cleanly |
| Profile (animated portfolio gauge) | ✅ PASS | Mesh+scan+pulse rings render, no NaN |
| StateDetailPanel — 5 states with tab switching | ✅ PASS | CA, IL, NY, MA, TX × tab cycling — no errors |
| StateDetailPanel — Alabama (cs_status='none') | ✅ PASS | "No program" path renders gracefully |
| Search/Lens form | ✅ PASS | (audit caught stale copy in pro-smoke — fixed in audit-ui) |
| Glossary | ✅ PASS | Clean |

**Custom assertion** — every test scans the live DOM for visible `NaN` / `undefined` / `null` text. **Zero hits across all 9 tests.**

---

## Findings ranked by severity

### 🔴 Finding 1 — Lens latency + reliability is at the threshold (BLOCKER for onboarding)

**Severity:** High
**Symptom A:** p95 latency = 25.5s, exactly at the 25s `api/lens-insight.js:340` Anthropic call timeout. Two MA calls (C&I Solar, Hybrid) timed out and returned `fallback: true` instead of usable insight.
**Symptom B:** One Vercel HTTP 500 on NJ/Community Solar (request ID `Km3kJS5xteMB3ETumYJawjxI3VFDxGJA`). Opaque — needs Vercel runtime log inspection to diagnose.

**Why this is onboarding-blocking:** Lens is the headline feature. A new user runs their first feasibility report and ~10% of the time gets either a timeout fallback or a 500. First impressions are unforgiving.

**Recommended fixes:**
1. **Investigate the timeout pattern.** MA × C&I Solar + MA × Hybrid both timed out — coincidence, or is MA's revenue stack data triggering a longer prompt? Dump the prompt sizes for those calls, and consider either:
   - Bump the function timeout from 25s → 45s (Vercel default is 300s, we're well within it)
   - Truncate the prompt context for tech types that don't need full revenue stack detail
2. **Diagnose the NJ 500.** Search Vercel runtime logs for request ID `Km3kJS5xteMB3ETumYJawjxI3VFDxGJA`. Could be a one-off; could be deterministic.
3. **Re-run the audit** after fixes to confirm > 95% success rate.

### 🟡 Finding 2 — pro-smoke.spec.js is silently broken (immediate fix)

**Severity:** Medium
**Detail:** `tests/pro-smoke.spec.js:66` asserts `'Run a targeted feasibility report'` — but Search.jsx:620 was changed to `'Run a targeted intelligence report'` at some point. The pro-smoke test has been failing since that copy change. The unauth smoke (`smoke.spec.js`) isn't affected, so `npm run verify` (which only runs the chromium project) wouldn't catch it.

**Why this matters:** pro-smoke is the safety net for the entire authenticated surface. If it's silently broken, regressions on /search, /library, /profile won't be caught before they hit prod.

**One-line fix:** Update the assertion text in `pro-smoke.spec.js:66`. Re-run via `npm run test:smoke:pro` to verify.

**Prevention:** Consider adding `npm run test:smoke:pro` to the same git-hook/CI gate that runs `npm run verify`.

### 🟢 Finding 3 — Open StateDetailPanel can intercept map clicks (defer / polish)

**Severity:** Low (UX nuance, not a crash)
**Detail:** When a user clicks a state and the StateDetailPanel slides in from the right, the panel covers the map's right side. Clicking another state in the covered region requires first dismissing the panel via ESC or close button. The audit had to insert ESC presses between state clicks to navigate the matrix.

**Why low:** Real users don't click 30 states in a row. They click one state, read the panel, ESC out, click another. The flow works.

**Optional polish:**
- Auto-close the panel when the user clicks a *different* state on the map (panel content swaps to the new state instead)
- Or: make the panel slide narrower / off-screen when not focused

**Defer until after onboarding ships** unless user testing flags it.

---

## Surfaces NOT covered by this audit

These are out of scope for the pre-onboarding audit but worth noting:

- **Mobile responsiveness** — separate `tests/mobile.spec.js` + `tests/mobile-pro.spec.js` exist; recommended to run before onboarding ships
- **Signup → email confirm → first login** — full new-user flow, manual or separate Playwright work
- **DSIRE-coupled UI gates** — earlier today verified that `StateDetailPanel:182` and `OfftakeCard:256` are null-gated and don't render. No regression risk.
- **Stripe checkout / billing** — Pro upgrade flow not exercised
- **Memo share token flow** — `MemoView` smoke covers invalid token; valid token + frozen memo not exercised

---

## Recommendation: pre-onboarding fix list

**Before starting onboarding work:**
1. Fix Finding 2 (pro-smoke staleness) — 1 line, no risk
2. Investigate Finding 1 (Lens timeouts + NJ 500) — likely a few hours; may require prompt changes or function timeout bump

**Ship with onboarding (acceptable):**
3. Finding 3 (panel-blocks-map) — defer to UX polish phase

**Re-run audit after fixes:**
- `node scripts/audit-lens-matrix.mjs` — should now show ≥95% success rate
- `npx playwright test --project=audit-ui` — should still be 9/9
- `npm run test:smoke:pro` — should now be 7/7

---

## Reproducibility

**Audit harness:**
- `scripts/audit-lens-matrix.mjs` — Lens API matrix (cost cap $5, hits prod)
- `tests/audit-ui.spec.js` — Playwright UI suite (run via `npx playwright test --project=audit-ui`)
- `playwright.config.js` — added `audit-ui` project (depends on `setup`)

**Raw outputs:**
- `.audit/lens-matrix-2026-05-10T19-14-33.json` — full per-call detail (gitignored)
- `test-results/` — Playwright traces + screenshots for the run

**Re-run command sequence:**
```bash
node scripts/audit-lens-matrix.mjs           # ~6 min, ~$1.50
npx playwright test --project=setup --project=audit-ui   # ~50s
```
