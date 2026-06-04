# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it prepends a CONDENSED pickup, flips migration/backlog state, and keeps this file LEAN (~one screen of recent state, not a full diary). The complete pre-2026-05-25 history — 40+ pickups + shipped entries back to 2026-04-30 — is archived in `docs/archive/BUILD_LOG-history-2026-05-25.md`.

---

## 🟢 Pickup — 2026-06-04 — Glossary revamp DONE + reviewed ✓ · NEXT SESSION = LIBRARY REVAMP

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

- **072** `projects_update_with_check.sql` — adds `WITH CHECK (auth.uid()=user_id)` to the projects UPDATE policy (C1-class RLS-sweep fix; blocks ownership reassignment). ✅ applied 2026-06-01 (Aden).
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
