# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-05-31 (latest) — Markets & Policy rework + Analytics polish (v2.17→2.19)

**Shipped — `npm run verify` green on every push (api+citations+secrets+audit+locs+175 unit+build+7/7 smoke):**
- **Markets & Policy tab REWORKED (v2.19 · `c843879`)** — bifurcated into **MARKETS** + **POLICY** (new `SectionHeader` divider, not nested cards). Markets = `StateMarketTable` (sortable per-state table on new generic `SortableTable.jsx` — Kibo pattern ported, no `@tanstack` dep — **replaces + retires `StateProgramGrid`** box-of-cards) + `CsViabilityRadar` (recharts 3-state compare). Policy = `PolicyTimeline` (horizontal milestone rail from `policy_impact_events`, 27 rows/23 published probed live, severity-colored) + `DensePolicyFeed` now **10/page** & `hideTabs`. `SubscriptionMixChart` kept; `FeasibilityScoreDeltas` dropped from M&P (already on Analytics).
  - **Data honesty:** radar axes are normalized 0–100 from REAL curated fields (program status · IX difficulty · capacity tier · runway) — **no fabricated "Site" axis** (state-level `computeSubScores` returns a flat fake 60); footer discloses. **Finding:** `news_feed.pillar` = offtake/ix/site only (0 'policy'); policy content = `type==='policy-alert'` (24 items) → that's the M&P feed scope, de-duped from Home's all-signal top-5.
- **Analytics polish (v2.18 · `c8d96c4`)** — CS Coverage tracker shows legible blocks for program-states only + a "+N" no-program cap (was ~50 slivers); IX Headroom tiers are click-to-expand → the states in each tier (honest: `ix_difficulty` is per-state, no per-utility data); LMI + 3 other chart subtitles condensed to one-liners (pts / CS / Δ).
- **KPI reveals made distinct (v2.17 · `555582a`)** — Coverage = status tracker · Avg Capacity = distribution-vs-avg (centered on the headline avg, unified) · Pipeline = composition/concentration. No card ranks by MW anymore. LMI axis: clean integer ticks + unit.
- *(prior session, v2.16 `e4b4588`/`0fd75c3`)* — KPI Bar List visibility + sidebar Run-a-Lens AnimatedIcon.

### ⏭ DO NEXT
1. **Verify `state_programs.capacity_mw`** vs DSIRE / state-PUC + add per-row `source`/`last_updated` (citation honest; numbers still need a pass).
2. **MarketBrief re-enable** (commented in `HomeTab.jsx`) · **Net Billing sourcing** (per-state PUC tariffs — DSIRE paid as of May 2026).
3. **M&P follow-ups if wanted:** radar 5th axis (LMI accessibility) · timeline true time-scaling · table all-50 toggle.

**Loose end (cosmetic):** an early commit `e4b4588` carries a stray `@` subject (here-string slip), now buried in history — harmless; force-push deny rule blocks an in-session squash.

<details><summary>Analytics-tab arc v2.10→2.15 (all 2026-05-30, superseded by v2.16) — commits 60a22ff→b0117e9</summary>

Dashboard = tab terminal (Home / Analytics / Markets via `?tab=`). Analytics tab built out + 5 review rounds:
- **v2.10** — bento layout (12-col, KPI strip + collapsible filter + ChartCard `h-full`); honest two-layer citations on all 7 charts (DSIRE/Census/LBNL/ISO-RTO/RSS); LMI → diverging lollipop, Projects → dot plot; de-numbered eyebrows → semantic tags.
- **v2.11** — live KPI `MetricsBar` moved Home→Analytics top; click-to-expand bento (compact top-7 default, motion `layout` reflow, multi-open); removed all in-card scroll.
- **v2.12** — globe renders LIVE library dots only; sidebar hover-tooltips removed; header-click expand (whole header `role=button`); removed Lin/Log toggle (KISS).
- **v2.13** — `AnimatedIcon.jsx` native JSX wrapper (motion hover variants, not the lucide-animated TSX registry); LMI label-overlap killed; expand distortion fixed (`layout="position"`); density condense.
- **v2.14** — LMI de-elongated both axes (data-fitted x-domain, top-20 cap); expand spring slowed/smoothed; "meld-around" reflow (col-span-8, clicked chart stays anchored).
- **v2.15** — first 2nd-wave Skills applied as JSX ports: `AnimatedList.jsx` (Intelligence Feed entrance cascade), `BarListRows.jsx` (Tremor Bar List iter 1/5 for KPI reveals), `AnimatedIcon` on feed "View all" ArrowRight. No new deps, no TSX.
</details>

### Prior recent arcs (full detail → `docs/archive/BUILD_LOG-history-2026-05-25.md`)
- **2026-05-30 (dashboard v2.6–2.9)** — Markets&Policy tab BUILT (StateProgramGrid · SubscriptionMixChart · FeasibilityScoreDeltas · DensePolicyFeed); Home UX rds 1–5 (KPI multi-open, real Policy Pulse dual-line, 2-D status×feasibility map fill, ⌘K bounce fix, globe-disappears + AK/HI bugs fixed, collapsible icon rail). Commits `6b74e49`→`1816a86`.
- **2026-05-28 (dashboard v2.5)** — tab IA (sidebar Home/Analytics/Markets, `?tab=`); thin Dashboard.jsx router; 7 Analytics charts + ChartCard; KPI card-specific reveals; globe live markers. `7bfa841`→`3976e67`.
- **2026-05-27 (dashboard v1)** — MarketBrief + Hobby fn-cap fix (multiplexer); dark scope + unified d3-canvas globe + filters + IntelligenceFeedCard + dark StateDetailPanel + Run-a-Lens CTA. `a548d6a`→`dc07edb`. Plus NB waves 2–4 data slice + Geist sans.
- **2026-05-25** — 5-pillar signal pivot COMPLETE; revenueEngine + Scenario $-layer removed; ScenarioStudio → DevFeasibilityView.
- **2026-05-24** — two-axis Architecture × Structure rename (migration 069); capture-all-DG (migration 068).
- **2026-05-23** — IX distribution-queue coverage closed (+VA/WI/NJ/CA/MD); county-resolver fix.

---

## Supabase migrations (current)

> **Source of truth = `node scripts/check-migrations.mjs` against the live DB.** This note drifts; always probe before asking Aden to re-run anything.

- **070** `cod_year_and_policy_severity.sql` — `projects.cod_target_year` + `policy_impact_events.impact_severity`/`impact_probability` — ✅ applied 2026-05-25 (Aden).
- **069** two-axis architecture/structure · **068** capture-all-DG `ix_queue_data` — ✅ applied (2026-05-24).
- **≤067** — applied earlier; full historical migration table in the archive file. Probe the live DB to confirm exact state.
- **Pending:** none known.

---

## Backlog (priority-ranked)

### P1 — next data/product work
- **Net Billing economics** — source per-state export-credit basis (avoided-cost / ACC schedules), curated state-by-state starting with states that publish it (CA NEM 3.0 ACC). Until then Net Billing stays honestly gated (offtake fallback baseline, "not modeled"). DSIRE is paid as of May 2026, so sourcing is per-state PUC tariff filings.
- **Manual-data IX ingest pipeline** for the gated states (NJ ACE, ME CMP, MN Xcel, HI HECO, OR OASIS) — upload → Supabase Storage → parse → `ix_queue_data`.

### Accepted dependency risks (dependabot keeps flagging — rationale here)
| Package | Severity | Why accepted | Resolution path |
|---|---|---|---|
| `xlsx` | high (proto-pollution + ReDoS) | Vulns require **parsing** malicious workbooks; we only **write** xlsx (Library export). SheetJS left npm 2023 (no patch). | Replace with `exceljs` only if we add xlsx import. |
| `react-simple-maps` chain (`d3-color` ReDoS) | high ×4 | ReDoS needs user-controlled color strings; we pass static us-atlas topojson. Library abandoned at v3. | Swap for `@nivo/geo` if the map needs new features. |

### P3 — pre-revenue legal / IP (non-engineering)
- Hand-rolled Privacy + Terms (avoid Termly/Iubenda monthly) · LLC formation before significant revenue · USPTO "Tractova" wordmark · defensive domain registrations.

### Deferred until paying-user traction
- IX Queue Forecaster (needs ≥12 weekly snapshots) · Comparable Deals DB · PUC dockets full crawl · OpenEI URDB tariffs · §48(e) Categories 2-4.

---

## How to update this file

When Aden says **"update build log"** / **"log this"** / **"save what we did"**:

1. **Prepend a CONDENSED pickup** at the top (latest first): what shipped, commit hashes, verification, and a short DO-NEXT. Keep it to ~one screen — do NOT write a 50-line diary entry.
2. Roll the previous "(latest)" pickup into the **Prior recent arcs** one-liner list; when that list grows past ~6 entries, move the oldest into `docs/archive/BUILD_LOG-history-*.md`.
3. Update **Supabase migrations** — add new `0NN` files; flip to ✅ when Aden confirms applied (probe live DB first).
4. Move shipped **Backlog** items out; add new ones the session generated.
5. **Keep this file lean.** Full history lives in the archive; this file is the working-memory snapshot, not the permanent record.
