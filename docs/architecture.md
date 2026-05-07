# Architecture

> One canonical view of how Tractova is laid out in source — pages,
> components, hooks, library code, API handlers, migrations, cron
> schedules. Last reviewed: 2026-05-06 (post Plan C Phase 2).
>
> **Updated whenever a sprint adds or moves a major module.** If this
> file's last-modified date is more than ~30 days behind HEAD on a
> sprint-touching branch, treat it as drifted and refresh.

---

## Top-level layout

```
tractova/
├── api/                     # Vercel serverless functions
│   ├── _admin-auth.js       # Bearer JWT → profiles.role admin check (mig 057)
│   ├── _cors.js             # Allow-listed CORS reflector
│   ├── _rate-limit.js       # Sliding-window per-user quota (api_call_log)
│   ├── lib/
│   │   └── _aiCacheLayer.js # buildCacheKey, cacheGet, cacheSet, dataVersionFor
│   ├── prompts/             # 9 LLM prompt templates (one file per action)
│   ├── scrapers/
│   │   ├── _scraperBase.js  # supabaseAdmin, censusFetch, applyStaleTolerance, logCronRun, normalizeCountyName, fetchArcgisPaged, FIPS_TO_USPS, BRACKET_*
│   │   └── _refresh-*.js    # 10 single-source scrapers (lmi, news, hud, nmtc, geo, etc.)
│   ├── refresh-data.js      # Thin orchestrator — auth + CORS + dispatch to scrapers
│   ├── refresh-substations.js
│   ├── refresh-ix-queue.js
│   ├── refresh-capacity-factors.js
│   ├── lens-insight.js      # Anthropic-backed Lens / Compare / digest router
│   ├── send-alerts.js       # Resend transactional alerts (cron + admin test mode)
│   ├── send-digest.js       # Resend weekly portfolio digest
│   ├── data-health.js       # Mission Control + freshness summary
│   ├── check-staleness.js   # Cron-triggered stale-tolerance probe
│   ├── webhook.js           # Stripe webhook + idempotency (mig 060)
│   ├── create-checkout-session.js
│   └── create-portal-session.js
│
├── src/
│   ├── pages/               # Top-level routes (BrowserRouter children)
│   │   ├── Dashboard.jsx    # Public landing — USMap + KPI strip
│   │   ├── Search.jsx       # Lens form + 6 result panels (decomposed in 2.3)
│   │   ├── Library.jsx      # Saved projects + scenarios (decomposed in 2.4)
│   │   ├── Admin.jsx        # 6 curation tabs + Data Health (decomposed in 2.5)
│   │   ├── Profile.jsx      # Subscription / preferences / cancel flow
│   │   ├── Glossary.jsx     # Tier definitions + glossary terms
│   │   ├── MemoView.jsx     # Token-gated frozen-memo public viewer
│   │   ├── Privacy.jsx, Terms.jsx, Landing.jsx
│   │   ├── SignIn.jsx, SignUp.jsx, UpdatePassword.jsx, UpgradeSuccess.jsx
│   ├── components/
│   │   ├── (shared / mixed)
│   │   │   ├── ApiErrorBanner.jsx, CommandPalette.jsx, CompareTray.jsx,
│   │   │   ├── CoverageBadge.jsx, DataLimitationsModal.jsx, Footer.jsx,
│   │   │   ├── IntelligenceBackground.jsx, KeyboardShortcuts.jsx,
│   │   │   ├── LensTour.jsx, LoadingScreen.jsx, ScrollToTop.jsx,
│   │   │   ├── Toast.jsx, USMap.jsx, UpgradePrompt.jsx, WelcomeCard.jsx,
│   │   │   ├── (Pre-2026-05 panels) ComparableDealsPanel, CsMarketPanel,
│   │   │   │   RegulatoryActivityPanel, SpecificYieldPanel, StateDetailPanel
│   │   │   └── (Sprint 2.3 panels) ArcGauge, MarketPositionPanel,
│   │   │       SiteControlCard, InterconnectionCard, OfftakeCard,
│   │   │       MarketIntelligenceSummary
│   │   │   └── (Sprint 2.4 cards) AlertChip, ProjectAuditTimeline,
│   │   │       ScenariosView, ProjectCard, YourDealSection
│   │   ├── admin/           # Sprint 2.5 — Admin tab files
│   │   │   ├── StateProgramsTab.jsx, CountiesTab.jsx, RevenueRatesTab.jsx,
│   │   │   ├── NewsFeedTab.jsx, PucDocketsTab.jsx, DataHealthTab.jsx
│   │   └── ui/              # Radix-based primitives (Tooltip, Tabs, Toast)
│   │
│   ├── hooks/
│   │   └── useSubscription.js   # Pro-tier gating
│   │
│   ├── lib/                 # Pure functions + engine layer
│   │   ├── scoreEngine.js   # Sub-score logic + safeScore wrapper
│   │   ├── revenueEngine.js # CS + C&I + BESS + Hybrid revenue projections
│   │   ├── scenarioEngine.js # Slider config + scenario math
│   │   ├── ixQueueEngine.js, substationEngine.js
│   │   ├── programData.js   # Supabase-backed data accessors
│   │   ├── glossaryDefinitions.js, techDefinitions.js, pucPortals.js
│   │   ├── cronLatencyMonitor.js
│   │   ├── projectEvents.js
│   │   ├── supabase.js, utils.js, v3Tokens.js
│   │   ├── (Sprint 2.3 helper) lensHelpers.js
│   │   └── (Sprint 2.4 helpers) alertHelpers.js, exportHelpers.js,
│   │       formatters.js, markdownRender.jsx
│   │   └── (Sprint 2.5 helper) adminHelpers.js
│   │
│   ├── contexts/            # AuthContext, CompareContext
│   ├── App.jsx              # BrowserRouter + ScrollToTop + Routes
│   └── main.jsx             # createRoot mount
│
├── supabase/
│   └── migrations/          # 60 numbered SQL files (001 .. 060)
│
├── scripts/
│   ├── lint-api.mjs         # Recursive node --check on api/**/*.js
│   ├── lint-citations.mjs   # Heuristic: every $X.YZ/W traceable to migration or allowlist
│   ├── lint-secrets.mjs     # Single source of truth for pre-commit + CI secret scan
│   ├── audit-check.mjs      # npm audit wrapper, allowlist-aware
│   ├── lint-locs.mjs        # File-size budgets, allowlist-aware  ← Sprint 2.6
│   ├── citations.allowlist.json
│   ├── audit-allowlist.json
│   ├── locs-allowlist.json  # ← Sprint 2.6
│   ├── dump-supabase-snapshot.mjs   # JSON snapshot to backups/<date>/
│   ├── restore-from-snapshot.mjs    # Dry-run-by-default loader
│   ├── export-auth-users.mjs
│   ├── check-migrations.mjs, probe-*.mjs (15+ live-DB probes)
│   ├── _git-hooks/pre-commit, install-git-hooks.mjs
│   └── (seed scripts) seed-*.mjs
│
├── tests/
│   ├── unit/                # Vitest — engine layer + helpers
│   ├── auth.setup.js        # Playwright — saves authed state for Pro tests
│   ├── smoke.spec.js, mobile.spec.js, mobile-pro.spec.js,
│   ├── pro-smoke.spec.js
│
├── docs/
│   ├── DATA_SOURCES.md      # Per-source provenance + refresh cadence
│   ├── PUC_CURATION_GUIDE.md
│   ├── architecture.md      ← THIS FILE (Sprint 2.6)
│   ├── data-trust-audit.md
│   ├── secrets-manifest.md
│   ├── SECURITY_ROTATION_LOG.md
│   ├── runbooks/
│   │   ├── observability.md
│   │   └── restore-from-snapshot.md
│   └── archive/             # Old V3_Plan, Running_Notes, etc.
│
├── BUILD_LOG.md             # Single source of truth — chronological session log
├── CLAUDE.md                # Project safety net (loaded into every Claude session)
├── package.json             # `verify` script wires every gate
├── vercel.json              # Function maxDuration + cron schedules + HTTP headers + CSP
├── playwright.config.js, vite.config.js, vitest.config.js
└── README.md
```

---

## Cron schedules (`vercel.json` `crons`)

| Schedule | Path | What it does |
|---|---|---|
| `0 14 * * 1` | `/api/send-digest` | Weekly portfolio digest, Monday 9am ET |
| `0 14 * * 1,4` | `/api/send-alerts` | Mon + Thu 9am ET — score-drop / data-refresh / capacity-limited |
| `0 6 * * 0` | `/api/refresh-ix-queue` | Sunday 1am ET — ISO IX-queue scrapes (MISO + NYISO) |
| `0 6 1 * *` | `/api/refresh-substations` | Monthly EIA Form 860 substation refresh |
| `0 8 * * 1` | `/api/check-staleness` | Monday 3am ET — stale-tolerance probe |
| `0 7 1 1,4,7,10 *` | `/api/refresh-capacity-factors` | Quarterly NREL PVWatts pull |
| `0 7 * * 0` | `/api/refresh-data?source=all` | Sunday 2am ET — fan-out to all 10 scrapers |
| `0 8 1 11 *` | `/api/refresh-data?source=solar_costs` | Annual Nov 1 — LBNL TTS heavyweight pull |

---

## CI / verify gate

`npm run verify` runs (in order):

1. `lint:api` — `node --check` on every file in `api/**/*.js` (36 files)
2. `lint:citations` — heuristic walk for unverified `$X.YZ/W` numbers
3. `lint:secrets` — pattern scan (Stripe / Anthropic / Resend / AWS / JWT / etc.)
4. `lint:audit` — `npm audit` wrapper, fails on NEW high+ vulns or overdue allowlist rows
5. `lint:locs` — file-size budgets (allowlist-aware)
6. `test:unit` — Vitest, ~51 tests on engine layer
7. `build` — Vite production build
8. `test:smoke` — Playwright (Chromium), 7 smoke tests on the public flows

`.github/workflows/verify.yml` runs steps 1–7 on every PR + push to
main (smoke runs locally as the pre-push gate; CI smoke would need
Supabase secrets which we keep in Vercel only).

---

## Where to look for what

| If you need to… | Look here |
|---|---|
| Add a new data source (scraper) | `api/scrapers/_refresh-<source>.js` + dispatch row in `api/refresh-data.js` |
| Tune a Lens prompt | `api/prompts/<action>.js` |
| Change feasibility scoring | `src/lib/scoreEngine.js` (esp. `computeSubScores`, `safeScore`) |
| Change BESS or revenue math | `src/lib/revenueEngine.js` |
| Change scenario slider ranges | `src/lib/scenarioEngine.js` (`getSliderConfig`) |
| Change a Lens result panel | `src/components/{MarketPosition,SiteControl,Interconnection,Offtake,MarketIntelligenceSummary}.jsx` |
| Change a Library card | `src/components/{ProjectCard,ProjectAuditTimeline,ScenariosView,YourDealSection,AlertChip}.jsx` |
| Change an Admin tab | `src/components/admin/<Foo>Tab.jsx` |
| Change a database column | New migration in `supabase/migrations/0XX_<name>.sql` (Aden applies manually in SQL editor) |
| Probe live DB state | `scripts/probe-*.mjs` (15+ existing examples) |
| Investigate a 3am page | `docs/runbooks/observability.md` |
| Restore from a snapshot | `docs/runbooks/restore-from-snapshot.md` |

---

## Decomposition history (Plan C Phase 2)

| Sprint | Source file | Before | After | Δ | Date |
|---|---|---|---|---|---|
| 2.1 | `api/refresh-data.js` | 2,493 | 163 | -93% | 2026-05-06 |
| 2.2 | `api/lens-insight.js` | 1,366 | 1,003 | -27% | 2026-05-06 |
| 2.3 | `src/pages/Search.jsx` | 5,105 | 3,038 | -40% | 2026-05-06 |
| 2.4 | `src/pages/Library.jsx` | 4,379 | 2,703 | -38% | 2026-05-06 |
| 2.5 | `src/pages/Admin.jsx` | 3,425 | 1,914 | -44% | 2026-05-06 |
| **Total** | **5 mega-files** | **16,768** | **8,821** | **-47%** |  |

Each sprint shipped behavior-identical extractions (function bodies
character-for-character; smoke 7/7 each time). Allowlist in
`scripts/locs-allowlist.json` documents the remaining over-budget
files with explicit decomposition targets so the ratchet only
tightens.

---

## Companion docs

- `BUILD_LOG.md` — chronological session log
- `CLAUDE.md` — project safety net + STOP-and-ask list
- `docs/data-trust-audit.md` — quarterly methodology audit
- `docs/secrets-manifest.md` + `docs/SECURITY_ROTATION_LOG.md` — env-var inventory + rotation
- `docs/runbooks/observability.md` + `docs/runbooks/restore-from-snapshot.md`
