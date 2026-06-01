# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-05-31 (latest) — Dashboard CLOSEOUT (v2.16→2.25, commits `e4b4588`→`bb0b553`)

**Dashboard phases DONE. NEXT MAJOR = Lens → Glossary → Library UI makeover** (carry the dashboard's polish/skill language across). Every push verify-green (api+citations+secrets+audit+locs+175 unit+build+7/7 smoke).

- **Markets & Policy** — bifurcated **MARKETS / POLICY** (lightweight `SectionHeader`, no nested cards). Markets = `StateMarketTable` (sortable; generic `SortableTable.jsx` w/ upgraded headers; retired `StateProgramGrid`) + `CsViabilityRadar` (4 honest normalized axes, **no fake "Site"**) + `SubscriptionMixChart` (now a **filterable donut** — "All"/per-state chips, teal·sky·amber·slate). Table+radar = collapsible 12-col motion bento that melds like Analytics. Policy = `PolicyTimeline` (click-stepped, site-Tooltip hover detail, no scrollbars, severity nodes) + `DensePolicyFeed` (policy-alerts only, 10/page).
- **Analytics polish** — CS Coverage tracker de-densified (+N cap); IX Headroom tiers click→expand to states; verbose subtitles condensed; 3 KPI reveals made distinct (no MW-rank dupes); LMI axis ticks+unit.
- **Cross-tab** — `HoverBorderGradient` sheen on Run-a-Lens CTA; no shadow-box cursors; no stop-sign (not-allowed) cursors.
- **LIVE-DATA (Aden's #1):** Policy FEED fully scraper-live (`_refresh-news.js` → `news_feed`). Policy TIMELINE **publish-gated by design** — `_scan-policy-candidates.js` (weekly) drafts; timeline shows `review_status='published'` only ($-impact fields AI must not set unverified). Dump → Feed instant; Timeline → live on 1-click admin publish. **Decision: keep the gate.**

### ⏭ DO NEXT
1. **Lens → Glossary → Library UI makeover** — the next major phase; apply the dashboard's polish/skill language (ChartCard meld, SortableTable, AnimatedList, CountUp, HoverBorderGradient, tasteful motion) across these surfaces.
2. **Verify `state_programs.capacity_mw`** vs DSIRE / state-PUC + add per-row `source`/`last_updated` (citation honest; numbers still need a pass).
3. **MarketBrief re-enable** (commented in `HomeTab.jsx`) · **Net Billing sourcing** (per-state PUC tariffs — DSIRE paid as of May 2026).
4. **Optional dashboard follow-ups:** admin "scan policy now" button · radar 5th axis (LMI) · timeline true time-scaling · table all-50 toggle · deeper Home/Analytics skill pass.

**Loose end (cosmetic):** an early commit `e4b4588` carries a stray `@` subject (here-string slip), now buried in history — harmless; force-push deny rule blocks an in-session squash.

### Landing-page audit (2026-05-31) — new `Skills/Web Design Audit Checklist.md`
New reusable instrument: 20 web-design concepts → Concept/Question/Pass-bar checks + a living ledger (continues the dashboard audit). Ran it on `src/pages/Landing.jsx`.
- **Fixed:** hero `DashboardPreview` "Recent Policy Alerts" now **live** — `getNewsFeed()` (same `news_feed` source as dashboard), maps `pillar→tag`, newest 2; the 2 curated rows are loading/empty fallback only (so "Updated weekly" is now honest). News failure non-fatal (banner stays on programs+metrics). · CTA label unified (final "Create your free account" → "Get started free"). · `aria-hidden` on decorative inline SVGs.
- **Measured, not applied — contrast (#18, real WCAG):** `text-gray-400` on light = 2.54/2.39 **FAIL**; `text-white/30`–`/25` on navy ≤2.70 **FAIL**; `white/40`–`/45` ok-large; `white/55`+ & `gray-500`+ PASS. Swap recs logged in the skill ledger — focused restyle is the follow-up (deliberately-muted palette).
- **Passed as-is:** one semantic `<h1>`; no dead CTAs; "120×" honestly footnoted as a Tractova estimate; 12-agency `.gov` marquee = real authority proof; pillar counts trace to data. No P1s.
- **Process note:** an early draft of the findings was hallucinated against a misread of the file (before it was read) — caught, discarded, corrected; logged in the skill ledger. `npm run build` ✓.

### Prior recent arcs (full detail → `docs/archive/BUILD_LOG-history-2026-05-25.md`)
- **2026-05-30 (Analytics tab v2.10–2.15)** — bento (12-col, expandable meld) + honest two-layer citations; LMI diverging lollipop · Projects dot plot; KPI MetricsBar moved to Analytics; globe live-dots only; `AnimatedIcon`/`AnimatedList`/`BarListRows` JSX skill ports. Commits `60a22ff`→`b0117e9`.
- **2026-05-30 (dashboard v2.6–2.9)** — Markets&Policy tab BUILT (StateProgramGrid · SubscriptionMixChart · FeasibilityScoreDeltas · DensePolicyFeed); Home UX rds 1–5 (KPI multi-open, real Policy Pulse dual-line, 2-D status×feasibility map fill, ⌘K bounce fix, globe-disappears + AK/HI bugs fixed, collapsible icon rail). Commits `6b74e49`→`1816a86`.
- **2026-05-28 (dashboard v2.5)** — tab IA (sidebar Home/Analytics/Markets, `?tab=`); thin Dashboard.jsx router; 7 Analytics charts + ChartCard; KPI card-specific reveals; globe live markers. `7bfa841`→`3976e67`.
- **2026-05-27 (dashboard v1)** — MarketBrief + Hobby fn-cap fix (multiplexer); dark scope + unified d3-canvas globe + filters + IntelligenceFeedCard + dark StateDetailPanel + Run-a-Lens CTA. `a548d6a`→`dc07edb`. Plus NB waves 2–4 data slice + Geist sans.
- **2026-05-25** — 5-pillar signal pivot COMPLETE; revenueEngine + Scenario $-layer removed; ScenarioStudio → DevFeasibilityView.
- **2026-05-24** — two-axis Architecture × Structure rename (migration 069); capture-all-DG (migration 068).
- **2026-05-23** — IX distribution-queue coverage closed (+VA/WI/NJ/CA/MD); county-resolver fix.

---

## Supabase migrations (current)

> **Source of truth = `node scripts/check-migrations.mjs` against the live DB.** This note drifts; always probe before asking Aden to re-run anything.

- **072** `projects_update_with_check.sql` — adds `WITH CHECK (auth.uid()=user_id)` to the projects UPDATE policy (C1-class RLS-sweep fix; blocks ownership reassignment). ⏳ **written, NOT yet applied** — Aden to apply + run the verify snippet in the header.
- **071** `profiles_privileged_column_guard.sql` — BEFORE-UPDATE trigger blocking `authenticated`/`anon` from writing `role`/`subscription_tier`/`subscription_status`/`stripe_customer_id` (security audit C1 — the Pro-paywall + admin self-grant hole). ✅ applied 2026-05-31 (Aden).
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
