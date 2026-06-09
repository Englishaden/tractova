# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-06-08 (eve·3) — PHASE 2 KEYSTONE: address→census-tract LIC lookup shipped + LIVE (main `66ca515`; 080 applied + seeded) · ⏭ Aden prod-eyeball

**STATUS:** The roadmap keystone — an OPTIONAL site address → census tract → **precise per-tract §48(e) LIC yes/no** (vs the county-binary that read eligible in ~88% of counties). Shipped + pushed; verify-green (225 unit / 8 smoke / build / lints). Independently adversarial-verified (honesty + SSRF + graceful-fallback + no-regression + score↔UI agreement; 1 cross-tab inconsistency caught → fixed). **✅ LIVE — migration 080 applied + seeded 2026-06-09 (34,992 tracts; counties re-synced, 0 flips); end-to-end validated (the geocode→tract→isLicTract path: the verified DC/MD sample address resolves to tract 24033802405, which is in the table as LIC).** ⏭ Aden prod-eyeball with a real site address.

**Honesty (hard constraints, all met):** it's the census TRACT the address geocodes to (a neighborhood, NOT the parcel) — every string says so; a green "qualifies" carries "screens eligibility, NOT the official IRS determination — verify with tax counsel." ONLY LIC is tract-resolved; Energy Community + flood + wetland STAY county-level (different geographies / parcel-delineation needed).

**Architecture:**
- **`nmtc_lic_tracts` (migration 080)** — the 34,992 qualifying tracts (geoid PK), seeded from the same DOE/CDFI Excel (`seed-nmtc-lic.mjs` extended; county artifact stays scalars-only). Static.
- **Geocoder proxy** `api/handlers/_tract-resolve.js` via the `lens-insight` multiplexer (fn-cap 12/12 → no new top-level file). US Census Geocoder (no CORS + flaky) → server-side, fixed host + URL-encoded address (no SSRF), `redirect:'error'`, 10s timeout. Any miss/timeout/down → `{ok:false}` → graceful county fallback. Pure parser `_tractGeoid.js` + 4 tests.
- **scoreEngine** `computeIncentiveScore` gains opt `licTractResolved` (true|false|null): exact tract overrides the county-binary when present; null → county fallback; ≤5MW cap unchanged. 4 tests incl. the discrimination win (resolved=false withholds the +25 even in an LIC-containing county).
- **Lens:** optional "Site address" field (never blocks Run; build flag `VITE_LIC_TRACT_LOOKUP=off` hides it — optional default-on PUBLIC flag, documented in-code, not a secret). Search.jsx calls the proxy in parallel with the AI verdict; threads into the score (gauge + verdict agree) + the IncentiveStackPanel/IncentivesDetail/OfftakeCard tract-level display.

**Census Geocoder caveat:** free, no SLA, ~500/day shared limit, frequent downtime → optional + degrades gracefully to county-level. Paid geocoder (Geocodio) is the reliability upgrade if usage warrants — deferred.

**⏭ Roadmap remainder:** Phase 3 = slope (USGS 3DEP, verified-live) + protected-land (PAD-US, endpoint needs re-probe) — each needs Aden's penalty-weight sign-off. Phase 4 = IX manual-upload (~5 states) + EIA offtake auto-refresh (⚠ unify with the existing `refresh-substations.js` EIA pipeline, don't duplicate). HUD-QCT tract-resolution = near-free follow-on (`qct_tract_geoids` already populated; context-only). Loose end: glossary 'Offtake' "12 high-rate states" still stale (Wave-3 offtake is all-50) — left, not re-verified.

---

## 🟢 Pickup — 2026-06-08 (eve·2) — PHASE 1 DATA-HONESTY CLEANUP shipped (main `a85ffa8`) · ⏭ Aden prod-eyeball

**STATUS:** First slice of the data-gap roadmap (the "fix what's wrong on screen" phase, from the gap-bridging research `wf_625bacea`). Shipped + pushed; verify-green (217 unit / 8 smoke / build / lints). Independently adversarial-verified (an agent re-swept + caught 3 survivors I'd missed → fixed). **Copy/comments only — NO scoring change.**

**Ground truth re-probed (live DB, 3,143 counties):** wetland (NWI) **3,143/3,143 COMPLETE** · SSURGO farmland **2,405/3,143** · FEMA flood 3,143/3,143 · IX queue live in **6 states** (CA/MD/NJ/NY/VA/WI), hosting-capacity ~10 · IX live feeds are CONTEXT (ixLiveAdjustment=0 → score stays on curated ixDifficulty for all 50).

**Fixed (stale claims, grep-driven across src/api/docs):**
- **Wetland was wrongly labeled "partial / seeded ~700" — it's COMPLETE** (we were UNDER-claiming). Corrected in CoverageChip, SiteControlCard, MarketPositionPanel, dataSources (/methodology; NWI tier C→B-), glossary 'Site · Live', NWI cron header, scoreEngine comments, DataHealthTab.
- **SSURGO "49 states" → "2,405 of 3,143 counties"** (old copy had wetland/SSURGO inverted).
- **IX "8 states / CO,IL,MA,…" → real 6 queue states**, and killed every "live data blends/drives the IX score" overclaim (it's CONTEXT; score is curated). glossary 'IX' + 'IX · Live', MarketPositionPanel tooltips+comments, CoverageChip, scoreEngine comments.

**New — event-driven freshness:** `scripts/check-data-vintages.mjs` (`npm run check:vintages`) probes publishers for a NEWER vintage (LIC date-stamped Excel = verified working against data.nlr.gov; EIA API key-gated) vs the docs/*.json sidecar → flags a re-source when one actually ships, not on the guessed review_due date. Detect-only, fail-open, OUT of `verify`. (Wire to a weekly cron/Action later; EIA probe skips unless EIA_API_KEY is in `.env.local` — it's in Vercel only.)

**Investigated → deferred (honest):** SSURGO backfill — the 738 farmland nulls are a systematic SSURGO areasymbol→county mapping gap (738 across 33 states incl CA/GA/KY), NOT AK-only; raising coverage needs a USDA areasymbol crosswalk = a separate track. Copy now honestly says 2,405.

**⏭ Roadmap remainder (gap research `wf_625bacea`):** Phase 2 = keystone (optional address→census-**tract** lookup; tax-credit bonuses LIC/HUD only, NOT flood/wetland — geocoder gives tract not parcel) · Phase 3 = slope (USGS 3DEP, verified-live) + protected-land (PAD-US, endpoint needs re-probe), each needs Aden's penalty-weight sign-off · Phase 4 = IX manual-upload (~5 states) + EIA offtake auto-refresh (⚠ an EIA pipeline ALREADY exists in `refresh-substations.js` — unify, don't duplicate). Structurally impossible (don't chase): full-50 IX (7 states no redistribution-safe feed); true-parcel (vs tract); live-IX-scoring.
**Loose end (not this sweep):** glossary 'Offtake' long still says "EIA Form 861 (curated for 12 high-rate states)" — stale vs the Wave-3 all-50 offtake; left untouched (didn't re-verify offtake coverage this session).

---

## 🟢 Pickup — 2026-06-08 (eve) — CDFI/NMTC §48(e) Cat 1 LIC ACCURACY UPGRADE shipped (Wave 3, IX) · ⏭ Aden: apply LIC data + prod-review

**STATUS:** §48(e) Cat 1 Low-Income-Community eligibility now comes from the **authoritative DOE/CDFI published file**, not Tractova's re-derivation. Code shipped + pushed (main `5bbcd23`; verify-green: 217 unit / 8 smoke / build / lint api+secrets+audit). **✅ DB applied + probe-confirmed** (3144 rows, all ACS 2016-2020 vintage, 0 stale 2018-22 rows, CO/Broomfield now eligible). ⏭ Aden: prod-eyeball when convenient.

**Why (2 real accuracy gaps in the old derive):** it used ACS **2018-22** + a **state-MFI-only** approximation of the CDFI two-prong rule → (1) wrong vintage (§48(e) Cat 1 = NMTC LIC, which CDFI locks to **ACS 2016-2020**), (2) **metro LIC under-count** (CDFI uses greater-of state/MSA MFI). Replaced with the **DOE "IRA §48(e) Bonus Credit Program Layers"** Excel — its Category-1 column IS the CDFI CIMS NMTC LIC determination (ACS 2016-2020, greater-of-state/MSA + special provisions baked in). data.gov-cataloged (publisher DOE). Raw xlsx in `data/cdfi-lic/` (gitignored; re-dl from data.nlr.gov/submissions/222) → parsed → committed `src/data/nmtcLicCounties.js` (the artifact the prod handler imports).

**Impact (dry-run vs live DB, 3144 rows):** **161 counties newly ELIGIBLE** (the metro uplift — flagship: **CO/Broomfield**, a high-MFI Denver-metro county the state-MFI rule missed), **86 newly INELIGIBLE** (vintage shift). ~8% flip, no implausible swing.

**Architecture — nmtc_lic is now a STATIC source** (mirrors `solar_costs`): added to `BUNDLE_EXCLUDED` + removed from `CENSUS_SERIAL` (no Census); staleness 21/60→400/540 (`check-staleness`); dropped from `FRESHNESS_PILLAR_CRONS` (`data-health`) + health cadence 8→400 (`_health-summary`); DataHealthTab `live`→`seeded` — so going static does NOT false-alarm the Wave-2 freshness monitors. Handler `_refresh-nmtc-lic.js` now imports the committed artifact + upserts (no xlsx-in-prod); admin Refresh `nmtc_lic` re-syncs DB from it. New `_nmtcLic.js` pure helper + 11 unit tests. **No migration** (reuses `nmtc_lic_data`; legacy `via_*`/`state_mfi` set 0/null). Citation tier **B-→A** (`dataSources.js` → /methodology + XLSX); glossary updated + the stale "HUD QCT grants the LIC adder" copy fixed. Freshness CI gate `docs/cdfi-lic/lic-source.json` (review_due 2027-06-01) + `audit-check`.

**✅ APPLIED 2026-06-08** (`node scripts/seed-nmtc-lic.mjs --apply`, probe-confirmed). Re-sync anytime via that command or admin Refresh `nmtc_lic`. ⏭ Aden: prod-eyeball the Incentives panel ("N of M tracts qualify") + /methodology §48(e) row. **Heads-up:** the per-tract `via poverty / via MFI` sub-line is gone (the published source isn't split by reason — expected).

**⏭ Remaining queued (Aden's earlier picks):** GIS/site layers (slope/DEM · PAD-US — raster-heavy, each needs a penalty-weight call) · IX live-blend runway metric (needs a design sign-off). CDFI LIC (Aden's pick) = ✅ this track.

---

## 🟢 Pickup — 2026-06-08 — DATA AUDIT WAVES 1+2 DONE · WAVE 3 (offtake all-50 · NWI cron · FEMA flood) DONE · ⏭ Aden prod-review + re-run refresh

**STATUS:** Audit plan `~/.claude/plans/ok-we-should-move-dynamic-charm.md` — **Waves 1 + 2 DONE; Wave 3 tracks shipped: offtake all-50, NWI wetland cron, FEMA flood (both slices).** Migrations **076 + 077 APPLIED** (Aden); **078 pending.** All verify-green; Library + scrapers are **Pro-gated / verify-on-prod → NOT screenshot-verified.** ⏭ **NEXT = Aden prod-review + re-run the data refresh** to confirm the two scraper fixes below are green, then apply 078.

**Two prod-refresh fixes (`c7e6a9c`, `daacb3d`):** Aden's refreshes surfaced 3 real scraper failures (the Wave-2 freshness fix is what *un-masked* them — not my changes):
- `geospatial_farmland` (1st run): "got 1000" — un-paginated canonical-FIPS query hit PostgREST's 1000-row cap → tripped the `<3000` abort. **Fixed `c7e6a9c`** (paginate).
- `geospatial_farmland` (2nd run, post-fix): "Only 2405 mapped from 3360 SSURGO areas; expected ~3,000+" — a SEPARATE stale guard. SSURGO areas aren't 1:1 with counties (~28% are non-county special areas the validFips gate strips); 2405 is the real post-gate count + the `<2500`/"~3,000+" guard was a relic from before that filter. **Fixed `daacb3d`** (floor→2000 + honest message + inline skipped breakdown; merge-upsert never NULLs unmapped counties, so it's safe).
- `ix_queue` 504 (twice, 4/4 ISOs stale ~15d): `refresh-ix-queue.js` runs 6 external scrapers under `maxDuration:60`; per-scraper failures are caught, so an endpoint-504 = the function timing out. **Fixed `daacb3d`** (maxDuration 60→300, matching refresh-data). ⏰ **Re-run to confirm both green.**

**Wave 3 track 2 — Site layers / NWI cron (`2111dce`):** NWI wetland was a one-time local seed stuck at ~700/3,142 counties (full pass ~1.5h ≫ 300s cron + NWI server throttles a bulk run). Built a **throttle-safe incremental refresh** (`api/scrapers/_refresh-geospatial-wetland.js` + pure `_nwiWetland.js` helpers, 7 unit tests): each weekly run nibbles the stalest ~80 counties at PARALLEL=2 under a 230s budget, merge-upserts only the wetland columns (SSURGO untouched), resumable. Wired as `refresh-data?source=geospatial_wetland` (excluded from `all`/`fast`), own **Wed-6am cron**. Bulk backfill stays the local seed (now unblocked by the FIPS fix). ⚠️ **DEPLOY WATCH: this is the 10th vercel.json cron** — 9 deploy fine so low-risk, but if Vercel rejects on a cron-count limit, drop that one entry (source still works via admin Refresh). Verified-on-prod (external + DB-write); worst case = logged failed cron, never bad data.

**Wave 3 track 2b — FEMA flood = third site constraint (`23489fe` foundation → `0c1cc20` ingest, DONE):** `computeSiteSubScore` is now land × wetland × flood — a flat 12-pt penalty when the county's FEMA NRI flood rating is `relatively_high`/`very_high` (matrix preserved; unknown→no penalty; clamps ≥0). **Slice 2 = FEMA NRI** (Aden's pick over NFHL — clean county data, no GIS math): endpoint + fields confirmed live from ArcGIS metadata (`National_Risk_Index_Counties/FeatureServer/0`; STCOFIPS · **IFLD**_RISKR/S inland · CFLD_RISKR/S coastal — note IFLD not RFLD). `_floodNri.js` pure helpers (worst-of-inland+coastal, rating→token, 14 tests) + `_refresh-flood-nri.js` (paginated, FIPS-gated, merge-upsert flood cols only) wired into the weekly **`all` bundle — no new cron** (NRI is fast). Migration **078** retunes the empty 077 SFHA cols → `flood_risk_score`/`flood_risk_rating` (⏳ pending apply; ingest no-ops until then). Honesty copy live: /methodology Site "Flood risk" row + SiteControlCard flood line + FEMA NRI chip.

**Wave 3 track 1 — Offtake all-50 (`632d41b`):** extended `CI_OFFTAKE_SCORES` 32 → 49 entries (48 states + DC). Sourced 19 states' commercial ¢/kWh from **real EIA EPM 5.6.B (Mar-2026, Form EIA-861M)**, recorded on disk `docs/eia-861/commercial-retail-rates.json` (mirrors `docs/dsire-net-billing/`). 17 continental states encoded via a **transparent disclosed formula** `clamp(round(34 + 1.8·¢/kWh),45,72)` (no deep-market boost — thin/non-ISO; sanity-checked vs same-table legacy comparators). **AK + HI deliberately gated** (real high rates but islanded/atypical offtake → stay on 55 fallback, documented). New **CI freshness gate**: `audit-check.mjs` fails when a sourced dataset's `review_due` passes (offtake review_due 2027-06-01) — aging data now fails CI like the npm allowlist. Two-layer honesty throughout (rate sourced · score disclosed).

**Data refresh — ALL GREEN (5/5 OK, Aden confirmed).** Three failures surfaced + fixed across the session: `geospatial_farmland` (FIPS-pagination `c7e6a9c` + stale 2405-guard `daacb3d`), `ix_queue` 504 (maxDuration 60→300 `daacb3d`), `flood_nri` NOT-NULL `state` (a bug I introduced — dropped `state` from the merge-upsert; fixed `38736c7` by deriving it from FIPS). Pipeline healthy; all Wave-3 ingests operational.

**⏭ Wave 3 remaining (Aden to steer):** **CDFI published LIC list** (replace the NMTC state-MFI approximation — accuracy-critical to the Incentives pillar, needs a careful sourcing pass; my recommended next track); more **Site layers** (slope/DEM · PAD-US — but raster/GIS-heavy + each needs a penalty-weight call); **IX live-blend runway metric** (needs a design sign-off — cs_pipeline is deliberately NOT blended today).

**⏰ Waiting on Aden:** (1) **apply migration 079** (ix_difficulty CHECK, NOT VALID/safe); (2) **prod-review** the Pro-gated Library work when convenient (Aden confirmed the 5-pillar parity landed on prod). Everything else is green + live.

**Wave 1 — PARITY WIRING (main `1fd536f`→`856ec19`, then `f421673`):** the Library scored saved projects on 3 pillars (no incentives/policy) so the SAME project differed Library-vs-Lens. Now **one project = one 5-pillar score everywhere.** `f421673` = the centerpiece: new canonical `scoreProjectFromMaps(project, maps)` (`scoreEngine.js`); `Library.jsx`+`MobileLibrary.jsx` batch-fetch an incentivesMap (`state::county`) + policyEventsMap (state) and thread to every surface (ProjectCard/Table/Board/Map/sort/Drawer/Compare/export/alerts/PortfolioAnalytics); ProjectCard "Index Breakdown" → 5 pillars; 5-pillar XLSX export (+live composite, killed a stale Revenue col); fixed 2 latent bugs (codYear field undefined on normalized projects; score-drop alert false-firing on a 3-vs-5-pillar mismatch). Earlier Wave-1 commits: stale 40/35/25 labels killed, `scoreSavedProject` helper + parity tests, site axis inverted, §48(e) ≤5MW LIC cap.

**Wave 2 — TRUST SURFACES (main `c1e37ce`→`ee2dab6`):**
- **`c1e37ce`** — public **`/methodology`** page + shared **`src/lib/dataSources.js`** (single registry consumed by the page AND the XLSX sheet — unified, can't drift). Added the missing Policy pillar + LBNL/NREL-CS-MMP/specific-yield rows; corrected labels (DOE NETL, USFWS NWI, Form-861-vs-EPM, IRS/Treasury-primary). Two-layer (observed vs Tractova-synthesis) per row + weight-disclosure block. About teaser + smoke check.
- **`480880c`** — **freshness truth (A5):** `last-refresh` now = OLDEST latest-success among weekly-cadence pillars (not global MAX), so a stalled pillar drags the caption + trips the stale flag. `check-staleness` THRESHOLDS 6→15 tables + a NEW failed-cron alert (status='failed', not just age). **Migration 076** adds `county_geospatial_data` + `hosting_capacity_data` to `get_data_freshness` RPC — ⚠️ **pending Aden's apply** (everything else works without it).
- **`ee2dab6`** — **policy guardrails (A6):** AI prompt now confidence-gated to match the score (Bug B); `dataVersionFor` folds event count so removing an event busts the AI cache (Bug A); `computeStatePolicyRiskScore` returns `coverage:'none'|'live'` (no-data ≠ clean). **NWI honesty (A4.5):** killed the "all 3,142 counties" live over-claim (NWI is seeded/partial; SSURGO live 49 states), EPA→USFWS, dropped the never-ingested NLCD citation, AND fixed a stale inverted `availableLand ≥ 25%` label (favorable = <25% farmland).

**2 policy decisions — RESOLVED 2026-06-08 (Aden):** (a) **HUD QCT §48e pathway → REMOVED** (`020f8e8`) — NMTC-only now; QCT-only counties drop 25 pts on Incentives (intended). This also fixed a score-vs-UI mismatch (IncentiveStackPanel already called QCT a LIHTC instrument that doesn't stack into the ITC ceiling — only the score over-granted). (b) **Policy-severity bridge → BACKFILL-THEN-RETIRE** — the bps→severity bridge STAYS until Aden human-sets `impact_severity` on the ~27 rows; no code change yet (retire lands after his backfill). Also shipped: **ix_difficulty DB CHECK** (`6676283`, migration 079, NOT VALID — audit A1).

**Wave 3 fuller backlog (beyond the two tracks above — see plan PART B):** more site layers (slope/DEM, transmission proximity, PAD-US, NLCD-for-real), CDFI published LIC list (retire the state-MFI NMTC approximation), ix_difficulty DB CHECK constraint. (EIA-861 all-50 offtake — ✅ done `632d41b`.) Wire NWI cron before stacking site layers.

---

## 🟢 Pickup — 2026-06-07 — LIBRARY PASS-6 POLISH reviewed on prod ✓ + react-router patch · ⏭ Aden broad prod review

**STATUS (Aden 2026-06-07):** Pass 6 Library **reviewed on prod by Aden — "looks good and better"** ✓ (hero + board screenshots). The deferred **motion/breathing polish is DONE** (no longer a loose end). Paused here for a **broad prod review across the whole Library** (+ confirm the react-router bump behaves) before the next substantive slice. Open product fork (not started, Aden to pick): **coverage expansion (IX/offtake states)** vs **retention mechanics (score-move / due-follow-up digest)**. Mobile remains a separate future major redesign.

**Library polish pass — 4 commits, all verify-green + pushed (main `834de32`→`543286e`):**
- **`834de32`** — hero slimmed (py-5→3.5 · items-center · drop populated-state subline, kept for empty state) + unified to design tokens (inline navy hex → `var(--color-brand-600/700)`; hand-rolled rail → existing `.lp-accent-rail`; eyebrow/CTAs → `feasibility`/`primary` utilities; deleted imperative onMouse hover handlers).
- **`fb77192`** — portfolio numbers (projects · MW · alerts · due) folded into the hero's dead right-half; **`LibraryStatusRibbon` deleted** (computation relocated to a `portfolioStats` useMemo in Library). One glanceable top-line; deep analytics stay in the Intelligence tab.
- **`3e8bb19`** — board deal-names were truncated to ~7 chars: `StagePicker` gained a `compact` prop (chevron-only; stage still cued by badge color — the column header already names the stage); board name `truncate`→`line-clamp-2`. Shared label variant (Table/Card/Drawer) unchanged.
- **`543286e`** — entrance-motion parity: Board + Comparisons wrapped in `MountReveal` (Cards already had it; Intelligence has its own scroll-reveal). Closes the motion loose end.

**Security — `dcb65fb` (Dependabot triage of the 4 advisories):**
- **FIXED:** `react-router-dom` 6.30.3→6.30.4 (manifest floor → `^6.30.4`), patching the moderate open-redirect (`//` protocol-relative reinterpretation). npm audit moderate 2→0; smoke green across routes.
- **ACCEPTED (unchanged):** the 6 highs = d3-color ReDoS chain + xlsx — both not-exposed, allowlisted, `review_due 2026-08-06`. **GitHub's Dependabot banner still shows 3 high BY DESIGN** (it ignores `audit-allowlist.json`); our `lint:audit` gate is the source of truth (green, 3/3 allowlisted, current).
- **Recorded:** react-simple-maps@4.0.0-beta.6 is still pre-release AND still declares d3-zoom@^2 → the d3 "4.x upgrade" mitigation is a confirmed DEAD END (logged in the allowlist rationale).

---

## 🟢 Pickup — 2026-06-05 — LIBRARY RE-ARCHITECTURE (Pass 6) DONE: sub-tabs + Lens sections + mobile · ⏭ Aden review deferred (new chat)

**STATUS (Aden 2026-06-05):** migrations **073/074/075 APPLIED** ✓ (cockpit features live). Aden is **holding review** of the Pass 6 Library for now — will **start a NEW CHAT** to go over Library-tab changes. **Mobile is a separate FUTURE major redesign** (the Pass 6 mobile sub-tabs shipped, but a full mobile rethink is its own future effort). Only loose end: a deferred breathing-room/motion polish pass on the new surfaces (optional).

**Library re-architected into sub-tabs (main `f8c30c7`→`5b9d03e`).** Prod review: too packed/tall, nested-dup "Portfolio Intelligence". Fix = marry Dashboard sub-tabs + Lens section-breakouts. Direction via 8-question Q&A: hybrid · **board-first** · intelligence own tab · 3 tabs · horizontal strip · slim ribbon · map in both. Plan `~/.claude/plans/idempotent-prancing-harp.md`; audit ledger Pass 6. Pro-gated → build + 174-unit + 7-smoke + eslint-no-undef green every commit, but **NOT screenshot-verified — needs Aden prod-eyeball (incl. a phone for the mobile sub-tabs + fixed cards).**

- **New:** `LibrarySubNav` (Pipeline · Intelligence · Comparisons, URL `?view=`), `LibraryStatusRibbon` (slim Pipeline stats), `LibraryIntelligence` (Lens-style §01 Pipeline · §02 Analytics · §03 Map — `CollapsibleSection` + `LensSectionRail` scrollspy + `useLensReveal`; funnel/map drill → filtered Pipeline). `useLibraryLayout`: `viewMode` pipeline/intelligence/comparisons + `?view=` sync; **board-first** default layout. Toggle now Board · Cards · Table · Map.
- **Deleted:** `PortfolioIntelligence.jsx` (drawer → ribbon + Intelligence tab). `PortfolioAnalytics` reused as §02.
- **Quick fixes:** board "1 alert" blob (whitespace-nowrap); command-bar dead gap (search grows flush-right); empty-state clear resets search+tags. Dashboard Market-Filters State group defaults collapsed (`901b7b4`).
- **Command bar (`031d768`):** rebuilt into two clean rows (Row 1 find & filter · Row 2 sort & view) — killed the dead white-space under search.
- **Mobile sub-tabs (`5b9d03e`):** `MobileLibrary` now carries the same Pipeline · Intelligence · Comparisons sub-nav (Intelligence stacks; scrollspy rail is xl-only so §-headers are the mobile nav). **Unified `normalizeProject`** (`src/lib/normalizeProject.js`) — fixed a latent bug where MobileLibrary's drifted normalize produced projectName/capacityMw while ProjectCard + analytics read name/mw/tags (mobile cards/search/sort were mismatched). Also surfaces `structure` (desktop normalize had dropped it).

---

## 🟢 Pickup — 2026-06-04 (eve) — LIBRARY REVAMP (Pass 5) code-complete: Waves 0–5 · ⏭ APPLY MIGRATIONS 073/074/075 + prod-eyeball

**Prod-review polish (2026-06-05, from Aden's screenshots):** killed redundancy + raised the visual bar. (1) Portfolio Intelligence: dropped the 3 KPI tiles (dup of the summary line) + the "Recent Updates" bar (dup of alerts; unique updated/moved signals folded into the summary line); pipeline distribution → one compact **stacked-bar funnel** (CsProgramStatusBar idiom, div-based, click-to-filter + stale dot kept). (2) Command bar → `SpotlightCard` glow + `TealRail`; dropped the redundant "N projects" count; folded the standalone "Select all" row into the bar; fixed the harsh black focus outline on the layout toggle (→ teal ring). (3) Hero subline trimmed (numbers now owned by Portfolio Intelligence — no triple-count). (4) LibraryMap → static aurora wash behind the canvas. **(5, 2026-06-05 — 3-agent dedupe re-audit):** killed the nested **duplicate "Portfolio Intelligence"** — `WeeklySummaryCard` carried its OWN navy "Portfolio Intelligence" header + collapse chevron nested inside the same-named drawer (MW shown ~4×, projects ~3×). Gutted it to header-less `PortfolioAnalytics` (Health + Risk · Tech + Geo · AI insight) rendered directly in the single drawer; dropped the redundant "Total Capacity" MW tile; `WeeklySummaryCard.jsx` deleted. One intelligence surface, one title, one set of numbers. Build + 174 unit + 7 smoke + eslint no-undef gate green.

**Library Pass 5 — "the big one" — shipped + pushed (main `ed3c873`→HEAD).** Plan `~/.claude/plans/idempotent-prancing-harp.md`; audit ledger Pass 5. Pro-gated → smoke stops at the paywall, so every wave is build + 175-unit + 7-smoke green but **NOT screenshot-verified**. Scope set via Q&A with Aden: full overhaul (all 4 pains), **Cards primary**, keep 3 tabs, bigger than Glossary.

**⚠️ APPLY FIRST — features are DARK until the migrations land (all reads null-safe, app works without them):** **073** `projects.tags text[]` · **074** `projects.follow_up_at` + `follow_up_note` · **075** `saved_views` table. projects UPDATE policy (072) is column-agnostic → no policy change needed.

Waves (each verify-green + pushed):
- **0 `ed3c873`** — migrations 073/074/075 + `normalize()` surfaces them + Pass 5 ledger opened.
- **1 `ed3c873`** — **hard consolidation:** the 5-block top stack → ONE `LibraryCommandBar` (desktop search + filters + tag filter + sort + layout) + ONE collapsible `PortfolioIntelligence` drawer (KPIs + pipeline distribution + recent-updates + due-this-week + weekly summary). `useLibraryLayout` += search / tag-filter (AND) / 'Due' sort / allTags / activeFilterCount.
- **2 `011cec1`** — **CRM-lite:** `TagEditor` + `FollowUpControl`; ProjectCard header Due/Overdue + tag chips; Notes-tab editors; persistence + bubble to Library; threaded through ProjectTable/ProjectDrawer; MobileLibrary inherits via ProjectCard.
- **3 `8c8bff2`** — **kanban `PipelineBoard`** 4th layout (native HTML5 DnD across stage columns → `handleStageChange`; per-card StagePicker = keyboard/touch a11y path; desktop-only; un-paginated like Map). Toggle now Cards | Table | Map | Board.
- **4 `570021c`** — **`SavedViewsMenu`** (snapshot/restore {filters, tags, search, sort} via `saved_views`; silent-RLS-fail like SavedComparisonsList).
- **5 (this commit)** — **polish:** `SpotlightCard` glow on KPI tiles + `TealRail` on the intelligence drawer; command-bar search full-width on phones. **Deferred:** ScoreGauge/MiniArcGauge parametric unification (both work; risk > value).

**Scenarios feature removed (2026-06-04, follow-on):** financial/scenario modeling is out of the product (it stays behind the scenes in policy/card feasibility calcs). Pulled the Library "Scenarios" tab + fetch/state, the ProjectCard scenario badge/picker/delete-modal, the PDF + share-memo + MemoView scenario embedding, the `:scenarios` command/shortcut, and the Lens-save orphan auto-promotion. **Kept:** `DevFeasibilityView` + `leverAdjustments` (Lens levers — NOT financials), `scoreEngine` weight scenarios, `denormalizeTech`, the **Comparisons** tab, and the `scenario_snapshots` **table** (no data drop — Aden's call). Toggle is now Projects · Comparisons. Build + 174 unit + 7 smoke green.
**Orphan cleanup DONE (2026-06-04):** deleted the four dead files — `BriefDrilldown.jsx`, `ScenariosView.jsx`, `ScenarioHistoryList.jsx`, `orphanConversion.js`. (`scenarioEngine.js` kept — still exports `denormalizeTech`/`formatScenarioSummary`.) No remaining carried loose ends.
**⏭ Next:** Aden applies the 3 migrations → prod-eyeball the Library as a Pro user (board DnD, tag/follow-up chips, saved views, due-this-week roll-up). Tag/follow-up edits bubble live from Cards + Table + Drawer (all threaded). Optional follow-up: ScoreGauge/MiniArcGauge parametric unification (deferred — both work).

---

## 🟢 Pickup — 2026-06-04 — Glossary revamp DONE + reviewed ✓ · LIBRARY REVAMP = DONE (see pickup above)

**Surfaces closed out: Dashboard · Lens (Waves 1–6) · Glossary.** Glossary reviewed on prod by Aden 2026-06-04 — **looks good, no major comments.** §01 Lens white-space fill = dropped/closed. **NEXT MAJOR = Library revamp (its own explore→audit→plan flow; Aden says it needs a lot of work).**

Glossary revamp shipped (commit `1c034b0`; plan `.claude/plans/okay-do-the-full-smooth-chipmunk.md`; audit ledger Pass 4):
- **Demoted from primary nav:** reference surface, not a daily tool → out of the top-level signed-in nav (now **Dashboard / Lens / Library**), grouped with **About** under a "Resources" block in the account dropdown (`Nav.jsx`). Route + 26 `GlossaryLabel` consumers + ⌘K `:gloss` untouched.
- **Page (`src/pages/Glossary.jsx`):** A–Z groups + fixed A–Z `GlossaryJumpRail`; hero `.lp-aurora` + `TealRail` + `MountReveal` + `CountUp`; `SpotlightCard` cursor-glow cards + hover-lift + `AnimatedList` stagger; `SeeAlsoLink` hover-previews; footer CTA. Reduced-motion-safe; a11y + mobile done; cards stay in DOM → deep-links + ⌘K intact. New: `src/components/glossary/{GlossaryJumpRail,SeeAlsoLink}.jsx`; `TealRail` gained optional `className`.

### ⏭ NEXT SESSION — Library revamp (not started)
Apply the same playbook as Lens/Glossary: **(1)** explore the Library surface (`src/pages/Library.jsx` — large; `ProjectCard.jsx`, `CompareTray.jsx`, `LibraryToolbar.jsx`, `MiniArcGauge`, etc.; it's Pro-gated like the Lens, so smoke can't screenshot it). **(2)** run the 20-check `web-design-audit` (mobile-first) → log Pass 5. **(3)** plan → approve → wave-based build, verify-green per slice. **Carry the banked primitives:** `SpotlightCard`, `CopyButton`, `AnimatedList(itemAs)`, `TealRail`, `ui/Tabs`, `MountReveal`, `CountUp`, `SortableTable`, scrollspy-rail / sticky-bar patterns. Aden flagged Library "needs a ton of work" — expect a bigger scope than Glossary; get his priorities up front.
**Carried loose end:** `src/components/BriefDrilldown.jsx` orphaned since Lens 6c (dead code; removal needs `git rm`, deny-listed — clear when convenient).

---

## 🟢 Pickup — 2026-06-03 — Lens Wave 6 (prod-review redesign) · 6a–6d done, 6e + prod-eyeball pending

**From Aden's prod screenshots.** North star he set: **each section fits one viewport at 100%** (felt 100% too large, "better at ~85%"). All verify-green + pushed; **NOT yet visually verified by Aden** — the density level was calibrated on §01 and propagated; wants his eyeball before 6e.

- **Clipping fix (`c430c96`):** §03 Levers dropdowns were clipped by Wave 2's `overflow-hidden` (regression). `TealRail` now self-clips via `rounded-t-[inherit]`; dropped the overflow-hidden.
- **6a (`66a1f85`):** Comparables→**§06**, Regulatory→**§07** (labels + scrollspy rail; rail self-hides dots for gated sections not rendered). §01 density pass (py-7→py-5, headline 34→28px) = calibration reference.
- **6b (`92b6cb8`):** §03 Dev Feasibility **de-dup** — stripped the duplicate 5-pillar grid (it dup'd §05 + the verdict's own OFFT/IX/INC/SITE/P&T readout); §03 = lean **Verdict + Levers**. **−258 lines.**
- **6c (`2e6e4ad`):** §02 Analyst Brief drill-downs (4 stacked accordions) → one **tabbed** panel (shared `ui/Tabs`) + density. `BriefDrilldown.jsx` now orphaned (left as dead code — `git rm` deny-listed).
- **6d (`d00ba12`):** new reusable **`ui/SpotlightCard`** (cursor-follow glow, light-surface retune, reduced-motion-safe) on the §03 Verdict tile + §01 Policy&Timing alert (the two "bland" elements).

- **6e (`6653344`):** §04 Structure Comparison density cuts + §05 pillar-card height 150→134 (same ratio as §01–§03). Masthead left (already thin).

### ⏭ Lens — only OPEN item: §01 white-space fill
Density is done across §01–§05; the §01 Target-State white-space *layout fill* is still Aden's call (he was undecided). Locked pending his prod read of the density level. **Then: Glossary → Library** (carry banked primitives: `CopyButton`, `AnimatedList(itemAs)`, `TealRail`, `SpotlightCard`, `ui/Tabs`, scrollspy-rail / sticky-bar).

---

## 🟢 Pickup — 2026-06-03 — Lens makeover (Waves 1–5) — superseded by Wave 6 above

Makeover of the **Lens → Glossary → Library** surfaces via the `web-design-audit` skill (Pass 3 ledger in `Skills/Web Design Audit Checklist.md`). All on the Lens (`src/pages/Search.jsx`, ~1.4k lines — already a mature, designed surface), wave-based, each verify-green + pushed. **Key finding:** the Lens was already well-polished, so value came from closing specific gaps + adding microinteractions, NOT bulk restyling. Every assumption was grounded by reading the code first (caught 2 survey errors: scores already animate; §02 already had the rail).

**⚠️ Visual-verification caveat:** the Lens is Pro-gated, so Playwright smoke stops at the paywall — Waves 1/2/4 are build- + code-verified but NOT screenshot-verified. **Aden: eyeball on Vercel prod** (run a Lens) — especially the Wave 4 microinteractions (scrollspy rail, sticky query bar, card stagger/lift).

- **Wave 3 — a11y + contrast correctness (commit `4ff8b5f`):** `aria-hidden` on all decorative SVGs (Search 16, MarketPosition 3, MarketIntelligence 1); `text-gray-400`→`gray-500` on readable body (Search ×6, PaletteLensForm ×2, StructureComparison ×3) — left the 3 `·` separators + the gated "not modeled" row (WCAG-exempt disabled). Type hierarchy verified clean.
- **Wave 4 — microinteractions (commits `17ec147` 4a, `28f6c41` 4b):** (a) pillar-card hover-lift + teal glow · (b) §05 grid staggers in (`AnimatedList` + new `itemAs` prop) · (c) `LensSectionRail` scrollspy dots §01–§05 (xl+, IntersectionObserver) · (d) `StickyQueryBar` (form scrolls out → bar w/ summary + Edit↑ + Re-run) · (e) Add-to-Compare check-morph · (g) new reusable `ui/CopyButton` on the Run-ID. All reduced-motion-safe. **Reusable primitives banked for Glossary/Library:** `CopyButton`, `AnimatedList(itemAs)`, the rail + sticky-bar patterns.

- **Wave 5 — mobile-first responsive (#11/#12) (commit below):** form fields → `grid-cols-1 sm:grid-cols-2 md:grid-cols-3` (long-label selects get phone width); results header stacks title above actions (`flex-col sm:flex-row`) + action row `flex-wrap`; `StructureComparison` header strip `flex-wrap`. Already-mobile-first surfaces left as-is. **Code-level / build-verified, NOT screenshot-verified (Pro-gated).**

### ⏭ NEXT — Glossary makeover (then Library)
Lens Pass 3 is done. Apply the same audit + microinteraction language to the **Glossary**, reusing the banked primitives: `CopyButton`, `AnimatedList(itemAs)`, `TealRail`, and the scrollspy-rail / sticky-bar patterns. Run all 20 web-design checks mobile-first; log to the Pass 3 ledger.

### Wave 2 — section/meld unification (card-DNA)
**Finding (verified by reading, not assuming):** the Lens results were already ~80% unified with the dashboard; the real gap was *intra-Lens* card-chrome drift on the single-panel sections. §01 + §02 had a top teal-hairline rail; §03 was plain; §04 used a divergent left-3px-teal border.
- **New canonical primitive `src/components/ui/TealRail.jsx`** — the brand top-edge hairline in ONE place (was hand-rolled in ≥2 copies). Parent needs `relative overflow-hidden`.
- Refactored §01 `MarketPositionPanel` + §02 `MarketIntelligenceSummary` to use it (single source); added it to §03 (Dev Feasibility wrapper in Search.jsx); **converted §04 `StructureComparison`'s left-border accent to the top rail** so all four single-panel sections share one card DNA. §05 pillar-grid + §06 regulatory-watch left alone (multi-part, not single panels — a top rail doesn't fit).

### Wave 1 — polish primitives

- **Primary CTA melded with the dashboard's Run-a-Lens language** — the "Run Lens Analysis" submit button now carries the teal gradient + glow + `HoverBorderGradient` sheen, **but only when the run is available** (`isFormValid && !analyzing`); a disabled button stays a quiet muted teal (wrapping it would spin the border on hover and fake interactivity). Pattern matched from `DashboardSidebar.jsx:199`.
- **Verified, NOT re-done — `CountUp` on scores was already satisfied.** The §01 composite (`ArcGauge`'s `AnimatedScoreText`) and the sub-score rows (`SubScoreBar` motion value) already tween 0→value on the *exact same curve as `CountUp`* (`[0.22,1,0.36,1]`). Swapping in the literal component would be redundant churn (and impossible for the SVG gauge text). Left untouched. *(The earlier survey claim that "nothing animates" was wrong — confirmed by reading the components.)*
- **Action buttons left as-is** — `AddToCompareButton` + "Save as Project" already share one on-brand secondary treatment (`bg-white border-gray-200 … hover:border-primary`); no divergent dashboard standard to match, so no churn.
- **Quick fix:** removed a duplicated `focus-within:ring-2 …ring-primary/10` on the MW field.

**Motion decision (Aden):** keep `.lens-reveal` (bidirectional scroll-reveal is distinctive) — only harmonize easing/stagger with the dashboard feel; do NOT replace with framer-motion. Deferred to a later wave.

### ⏭ Lens makeover — remaining waves (not yet started)
- **Wave 2 — section/meld unification:** align `CollapsibleSection` typography + motion with the dashboard's `ChartCard` family so the two surfaces read as one.
- **Wave 3 — form pass:** field grouping, sticky-prefs UX, run flow.
- **Then:** Glossary + Library surfaces. Run all 20 web-design checks per surface (mobile-first), append to `Skills/Web Design Audit Checklist.md` Pass 3 ledger.

---

## 🟢 Pickup — 2026-06-01 — Housekeeping (folder reorg + settings hardening)

Two queued items closed; **NEXT MAJOR is unchanged = Lens → Glossary → Library UI makeover** (see DO NEXT #1 below).

- **Folder reorg — DONE (scoped).** The root looked cluttered but most of it is already **gitignored** (`claude.exe`, `dist/`, `test-results/`, `.logs/`, `.audit/`, `inspiration/`, `research/`, `backups/`, `data/`, + the 2 marketing notes). The only *tracked* loose doc was `TRACTOVA.md` → moved to `docs/TRACTOVA.md` (100% rename, nothing referenced it; build green; commit `909e494`). `Skills/` left in place (referenced by 6 src files). Gitignored loose notes left at root by choice (invisible to git anyway). No further reorg pending.
- **`.claude/settings.local.json` hardened** (the §below "flagged, your call" item — done). Removed exec-wildcard allows that let an agent bypass the deny list via another binary: `node:*`, `python *`, `python3 -c ' *`, `pip install *`, `curl:*`, `claude:*`. Removed secret-read allows: `cat .env.local`, the `awk -F= …/.env.local` + `grep …/.env*`. Added to **deny**: `git restore *`, `git rm *` (uncommitted-work / file-deletion gaps the deny list didn't shadow). Specific node/python/pdftotext invocations already in the file kept — new ones just prompt once. File is gitignored (local only); JSON re-validated (375 allow / 20 deny).

---

## 🟢 Pickup — 2026-05-31 — Dashboard CLOSEOUT (v2.16→2.25, commits `e4b4588`→`bb0b553`)

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

### Security audit — COMPLETE (2026-05-31)
Two-part security pass (cowork dispatch findings C1–L3, then a multi-agent completion sweep). Posture: strong / launch-ready. All prior fixes verified holding (C1/071, RLS sweep/072, I1 SSRF, C4 cron, A1/A2, app-side HIBP, C3 CORS, L1/L2/D1/L3, headers/CSP). New findings fixed this pass:
- **SSRF (Medium, the one real exploit)** — `profiles.slack_webhook_url` was POSTed server-side in `send-alerts.js` without a guard; a Pro user could point it at an internal address. Fixed: `sendSlack()` now requires `https://hooks.slack.com` exact-host + `redirect:'manual'`; `Profile.jsx` validates on write too.
- **Low/hygiene fixed:** recipient email → `profile.id` in send-alerts log (PII); generic client 500s on portal/checkout/digest (verbose-error leak), admin test diagnostics kept; `markdownRender.jsx` href scheme allowlist (http/https/mailto/relative only — XSS defense-in-depth); `audit-allowlist.json` d3-color rationale corrected (recharts 2nd root + DashboardGlobe 2nd consumer).
- **Left for Aden (not code):** confirm Supabase console toggles (confirm-email obfuscation, auth/email rate limits, CAPTCHA, recovery redirect allowlist) + apply migration 072; rotate live creds in local `.env.local`. ~~**Flagged, your call:** `.claude/settings.local.json` wildcard auto-allows undercut the deny rules~~ → **DONE 2026-06-01** (see top pickup).
- Decision recorded: leaked-pw server-side enforcement deliberately deferred (disproportionate — self-harm-only threat). Full report in workflow run `wf_c1bc154c-242`.

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

- **080** `nmtc_lic_tracts.sql` — NEW table: the §48(e) Cat 1 LIC tracts (geoid PK · county_fips · state · nmtc_pct) for the Phase-2 address→tract lookup. Additive (CREATE TABLE + public-read RLS). ✅ applied + seeded 2026-06-09 (Aden applied the migration; `seed-nmtc-lic.mjs --apply` run + probe-confirmed = **34,992 tracts**).
- **079** `ix_difficulty_check.sql` — CHECK on `state_programs.ix_difficulty` (enum), `NOT VALID`. ✅ applied 2026-06-08 (Aden-confirmed this session). Optional follow-up: `VALIDATE CONSTRAINT` after a clean-data check.
- **078** `flood_nri_retune.sql` — renames the (empty) 077 flood cols to NRI's metric: `flood_sfha_pct`→`flood_risk_score`, `flood_category`→`flood_risk_rating`, drops unused `flood_sfha_acres`. ✅ applied 2026-06-08 (Aden).
- **077** `county_geospatial_flood.sql` — ADD flood columns on `county_geospatial_data` (Wave 3 FEMA flood). Additive/nullable. ✅ applied 2026-06-08 (Aden). (Cols renamed by 078.)
- **076** `freshness_geospatial_hosting.sql` — adds `county_geospatial_data` + `hosting_capacity_data` to the `get_data_freshness` RPC (A5). ✅ applied 2026-06-08 (Aden).
- **072** `projects_update_with_check.sql` — adds `WITH CHECK (auth.uid()=user_id)` to the projects UPDATE policy (C1-class RLS-sweep fix; blocks ownership reassignment). ✅ applied 2026-06-01 (Aden).
- **071** `profiles_privileged_column_guard.sql` — BEFORE-UPDATE trigger blocking `authenticated`/`anon` from writing `role`/`subscription_tier`/`subscription_status`/`stripe_customer_id` (security audit C1 — the Pro-paywall + admin self-grant hole). ✅ applied 2026-05-31 (Aden).
- **070** `cod_year_and_policy_severity.sql` — `projects.cod_target_year` + `policy_impact_events.impact_severity`/`impact_probability` — ✅ applied 2026-05-25 (Aden).
- **069** two-axis architecture/structure · **068** capture-all-DG `ix_queue_data` — ✅ applied (2026-05-24).
- **≤067** — applied earlier; full historical migration table in the archive file. Probe the live DB to confirm exact state.
- **Pending:** none.

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
