# Tractova Build Log

> **Single source of truth.** Tell Claude **"update build log"** and it appends the latest commit, flips backlog items to shipped, and updates the migration list. No more juggling Running_Notes / V3_Plan / V2_Plan / Prop_Plan — those are archived in `docs/archive/`.

---

## 🟢 Pickup — 2026-05-21 (audit arc CLOSED — Glossary + F1 fixed, audit tool shipped)

**Continuation of the About/audit arc. Aden gave blanket "allow all changes" autonomy to finish the audit + to-do while stepping away. Outcome: the visual-audit tool is shipped + enhanced, the full authed audit ran clean, and both real findings (Glossary duplicate keys, F1 primary-teal drift) are fixed and pushed. The audit-cleanup arc is now closed; the only carried-forward item is the onboarding revamp.**

**What's live on prod (Vercel auto-deployed from main):**
- **`/about`** — "Surveyor's Field Notes" animated walkthrough (5 station nodes on a survey baseline, crossfading navy cards, hand-drawn SVG illustrations, useReducedMotion-aware, mobile-stacked). Clickable Next/Walk-again button; auto-advance stops on interaction. No employer named; Aden Walker named in the founder station. **Aden reviewed all 5 stations across several rounds:** 02 groma (parcel labeled), 03 triangulation, 04 coverage, 05 notebook (survey title block) all approved. **Station 01 "The Gap" took 4 takes** (% bars → bars/track → diligence gauntlet → final: **"short end of the stick"** — long dim beam = big integrated players, short solid beam = YOU, bright `+ TRACTOVA` wedge extends it toward a dashed parity line; no numbers). Awaiting Aden's final look on the 4th take.
- **`/glossary`** — duplicate-key React warnings GONE (was 2 console.errors/load).
- **Primary teal consolidated** — `bg-primary`/`text-primary` now render canonical `#0F766E` everywhere (matched the literals).

**Commits since marathon close (b703fdc):**
- `8d4fe9f` About v1 · `7009fe7` audit-findings-2026-05-19 · `bc51804` scrub employer comment · `348a029` About v2 walkthrough
- `b96dd92` BUILD_LOG · `c2b9de3` audit:visual script · `ea95822` BUILD_LOG
- `fbe6e1b` Glossary dup-key + primary-teal fixes · `6f785a5` audit:visual HTTP capture + findings · `f97eb1a` BUILD_LOG
- `8970348` About review tweaks (clickable Next, chevron, gap/groma/notebook clarity, fit-one-screen)
- `35588be` About: honest gap (no fake %) + notebook title block
- `1aa79a9` **About: "The Gap" = short end of the stick (4th take, current)**

**Audit arc — DONE:**
- **`npm run audit:visual`** — standalone headless audit tool (any `--url`, `--auth`, desktop+mobile, screenshots + console + HTTP-failure capture → `.audit/visual-<ts>/findings.md`). Gitignored artifacts.
- **Full audit ran:** 12 routes × desktop+mobile authed = 24 checks, **all clean post-fix.** Public routes also walked on prod.
- **F-G1 Glossary dup keys → FIXED** (dedup by term in `glossaryTerms.js`).
- **F1 `--color-primary` drift → FIXED** (`index.css`: primary + 600 = `#0F766E`, 700 = `#115E59`; light steps 50-300 intentionally left).
- **F-D1 `/api/lens-insight` 404** on Dashboard/preview = **dev-only** (Vite doesn't run Vercel functions; prod clean). NOT a bug. Optional polish: guard the prefetch with `import.meta.env.PROD` like the Footer does.
- Findings doc: `docs/audit-findings-2026-05-21.md`.

**Open items for next session:**
1. **Confirm Station 01 "short end of the stick"** reads right for Aden (4th take). If yes, the About page is fully closed.
2. **Huly screen-recording shot-list** — Aden plans to record the platform Huly-style for the onboarding revamp. Offered to turn the Huly plan's asset list into a precise capture checklist (URLs, viewport, what to click, stills vs video loops). Not built yet.
3. **Onboarding revamp (Huly plan)** — the main feature item. Plan at `~/.claude/plans/huly-onboarding-revamp.md` (carries the ⚠ no-employer-naming standing rule). The finished animated `/about` is the in-house style reference.
4. *(optional)* F-D1 dev-console polish; the `.env.local`-into-worktree auto-copy for `scripts/session-pickup.mjs` (still unconfirmed by Aden).

**Standing rules (in auto-memory):**
- **No employer naming on public surfaces** (`feedback_no_employer_naming.md`) — never name Nexamp or Ameresco on About / Landing / onboarding / marketing copy. Background described by function only. Only the Privacy Policy's narrow "professional relationship" line stays. Confirmed by Aden 2026-05-19.
- **No browser popups** (`feedback_no_browser_popups.md`) — don't invoke Playwright MCP `browser_navigate` etc. without an explicit ask; verify smoke configs are headless before running; never `start`/`open` URLs.

**Workflow gap surfaced (worth fixing in a future session):**
- **Worktree sessions don't inherit `.env.local`.** It's gitignored, lives only in the main repo dir, so the dev server falls back to `placeholder.supabase.co` and smoke tests fail with ERR_NAME_NOT_RESOLVED. Aden gave one-time permission this session to copy it manually; future sessions hit the same wall. **Proposed fix:** `scripts/session-pickup.mjs` should auto-copy `.env.local` from main repo into the worktree if missing. Aden hasn't confirmed yet — flag this when relevant.

**Test suite:** 158/158 unit, 7/7 smoke. Auth audit storage at `tests/.auth/pro-user.json` (regenerate with `npm run test:smoke:pro`). Worktree `.env.local` still needs manual copy per session until the auto-copy fix lands.

**Resume command:** `Continue from BUILD_LOG 2026-05-21 pickup. About page + audit arc done (all 5 stations shipped; Station 01 is the 4th-take "short end of the stick"; prod /about + /glossary 0-error). Next: build the Huly screen-recording shot-list, then the onboarding revamp per ~/.claude/plans/huly-onboarding-revamp.md (animated /about is the style reference). Standing rules: no employer naming on public surfaces, no browser popups, every UI-copy term gets a Glossary entry.`

**Workflow note:** This pickup block is auto-injected at every session start by the `SessionStart` hook in `.claude/settings.json` (runs `scripts/session-pickup.mjs`) — no manual handover paste needed. Keep this section tight and current; it is the first thing every new session sees. Claude owns all git / worktree / merge plumbing end-to-end. Standing rules live in CLAUDE.md + auto-memory.

---

### Twelve arcs shipped today — high-level

**Arc 1 — Scenario Studio dev-pivot** (`a575c8b → 2a90287 → 3b062f6 → 59fb613`, morning):

Tenor cap 30→40 yr (solar; BESS untouched at 20). Lineage chips next to every slider input (Synth · 2026 extrap / Industry avg / Observed · NREL / User input) so devs see which baselines are observed vs synthesized. Directional-sensitivity banner relocated to panel header. Dev Feasibility becomes the default Studio tab; Financial Sensitivity demoted to its own tab. Migration 063 handler swap (PDF lineage → first-class `discovered_via='pdf_upload'` column). Eyebrow-mono sweep closed as no-action.

**Arc 2 — Polish + UI/UX audit follow-up** (`3abf64b → ff2d423 → 82899b6 → a03d785 → 6e3f6e6`):

Radix tooltips on coverage / lineage chips replacing native `title` strings. FieldSelect dropdowns replacing native `<select>` for Target COD and IX Assumption — matching the /search form vocabulary. Subscription dropdown replaced with a 0–100% slider. Verdict-threshold tooltip discloses Go ≥70 / Caution 50-69 / No-Go <50 as Tractova editorial (not empirically anchored). Slider track fill alignment fixed (locked-zone band for LMI floor). Shared CoverageChip extracted between §03 + §04. mw.toFixed crash fixed (Search.jsx form state holds mw as string; coerced via parseFloat in DevFeasibilityView). ErrorBoundary "Copy diagnostics" button now has visible Copied/Failed feedback.

**Arc 3 — MW lever lifted + same-utility comparables** (`623f8db → 743ff5b`):

`liveMw` state lifted to Search.jsx so dragging MW in the Studio updates §04 pillar scores reactively. "Searched at X.X MW · Reset" caption when liveMw diverges from search MW. NaN-safe guards across the chain. ComparableProjectsPanel now splits results into "Same utility · N" + "Statewide · N" buckets when `countyData.interconnection.servingUtility` is known; tolerant utility-name matching handles "ComEd" ↔ "Commonwealth Edison Company" naming drift.

**Arc 4 — LMI floor + levers move composite** (`7024916 → 137b5df`):

Subscription slider refuses to drag below the state's `lmiPercent` (NY 20%, IL 50%, NJ 51%, MD 40%, CO 25%); locked zone visualized as a dimmed slate band on the left of the track + navy tick marker at the floor. New `src/lib/leverAdjustments.js` + 17 new unit tests make the Subscription / COD / IX Assumption levers actually shift composite scores (bounded ±5 / ±10 per pillar, capped per-pillar at ±10 total). Disclosed via "Lever impact" caption on the verdict tile + dotted-underline tooltip listing each lever's delta.

**Arc 5 — §04 Pillar Detail Modal + summary cards** (`03c9a5d`):

§04 row goes from 3 tall vertical cards to 3 compact summary cards (gauge + status + 1-line caption + "Open detail →"). Click any → Bloomberg-style fullscreen modal with tab strip across the three pillars, accent rail flips color per active pillar, lazy-mounted tab bodies (no OOM landmine — opacity+scale entrance only, no `layoutId`, no `height: auto`). Refactored OfftakeCard / InterconnectionCard / SiteControlCard to drop their CollapsibleCard wrappers (eliminated the 2026-05-11 OOM landmine in this surface).

**Arc 6 — Cmd-K palette rebuild** (`4546426 → a46d58e → 0673e05 → 9d6f21b → b3e0d84`):

Bug fix: `:lens MA 5` from the palette now correctly overrides an open Lens result (was a silent no-op due to a stale `autoSubmitFired` ref + a `useState` init that ran once). Signature-tracked auto-submit + URL→form sync + stale-result clear.

New UX: Verb chip strip at the top of the palette ([Lens] [Library] [Glossary] + ? help). Clicking Lens (or typing `:lens`) opens a **structured form** inside the palette — State, County, MW, Tech, Stage with FieldSelect dropdowns matching the /search vocabulary. Cmd-Shift-L hotkey opens the palette pre-focused on the Lens form (Cmd-L would conflict with the browser address bar). All commands documented in a new "Cmd-K commands" tab of the KeyboardShortcuts dialog, openable via ? button in the palette header.

Removed: Re-run last lens chip (deprecated per Aden), then the entire Compare chip + `:compare` verb (Compare lives in Lens + Library exclusively now).

**Arc 7 — Compare bug fix + removal from palette** (`fb15419 → 6e5b5d2`):

Compare tray was a silent dead button when items=0 — listener guarded on `items.length > 0`. Plus `CompareContext.add()` had a closure bug where bulk-adding from Library could leak past the 5-item MAX cap. Both fixed. Then per Aden's call ("just don't see the value in pulling it up via the command center"), removed Compare from the Cmd-K palette entirely. Compare invocation now lives only in Lens (Add to Compare button) + Library (chip + bulk + Comparisons tab).

**Arc 8 — Branded loaders + caption polish** (`ad40429`):

Lever Impact caption shortened from "Lever impact: +5 pts on composite — Subscription · Distribution fast-track" to "Lever impact: +5" (tooltip already discloses the breakdown). Branded TractovaLoader / LoadingDot replace plain "Loading…" text across OfftakeCard federal-bonus tiles, §03 comparables panel, Admin auth gate, MissionControl initial-load.

**Arc 9 — §04 grew to 4 pillars + Scenario Studio collapses** (`572a381`):

LensPolicyClimateSection no longer renders standalone below the pillars (Aden flagged as "thrown behind"). Folded into the §04 grid as the 4th pillar card (Offtake / IX / Site / Policy, violet accent #5B21B6), opens into the PillarDetailModal at the new Policy tab. ScenarioStudio gains a chevron toggle in its header — click to collapse the entire body, sessionStorage-persists across Lens re-runs. Pure conditional render (no `height: auto` motion).

**Arc 10 — LibraryMap color scheme refresh + size cap** (`2b6e233 → 74a3226`):

Map canvas swapped from pale teal gradient (`#F4FAFA → #E0F0EE`) to cool slate (`#ECF1F6 → #C8D3DF → #9FB0C2`) — pale-teal canvas had been blending into the light-teal state polygons. Warm-paper empty-state fills (`#F5F2EA`) create deliberate cool/warm category contrast — saved-portfolio states (teal/amber/red) read as one cluster, no-data states as a distinct neutral cluster. Map container capped at `maxWidth: 1100px mx-auto` (was filling `max-w-dashboard` 1440px); projection scale reduced 1000 → 920 for more atmospheric breathing room. Header band swapped from teal-tint to navy-tint.

**Arc 11 — Backlog close-out: wetland tooltip + actionable verdict + phase bar + tests** (`8e6704c`):

Four formal-plan backlog items shipped in one commit. (1) Wetland Section-404 caption tooltip discloses the "≥25% county coverage" proxy framing — Section 404 actually applies to parcel-level fill, not county coverage. (2) `verdictRationale` upgraded from generic score-reading ("Site is weakest at 41/100") to pillar-specific actionable diligence steps ("Norfolk County wetland 38% — screen adjacent counties or commit to Section 404 review"). Per-pillar friction descriptions read CS-status / capacity / LMI / IX queue months / cluster-study tier / wetland % / farmland % / curated availability / top headwind event. (3) `PhaseBar` component renders horizontal timeline (IX Study / Permitting / Construction / Energization) with widths proportional to month duration + COD-target marker; segment + marker tooltips disclose data sources. (4) New `tests/unit/devFeasibilityVerdict.spec.js` with 14 tests covering classifyVerdict bands + per-pillar friction cases + go-verdict framing + graceful fallback when metadata missing.

**Arc 12 — Glossary expansion + standing "always add" rule** (`1e268ca`):

Section 404 added to Glossary at Aden's prompt ("Yes always add to Glossary"). Subsequent thorough scan surfaced 15+ industry-specific terms appearing in UI copy but missing from the Glossary — exactly the gap the Glossary exists to close. Added: Section 404, COD, PPA, Bill Credit, Offtaker, CCA, IX Queue, Study Window, NWI, SSURGO, ISO/RTO, Confidence Tier (Tier A/B), Safe Harbor, NTP, p50/p90. Glossary now: 55 entries (was 40). Pattern: every definition added to `src/lib/glossaryDefinitions.js` (canonical tooltip source) + `GLOSSARY_PILLAR_MAP` in `src/data/glossaryTerms.js` (Glossary-page promotion). Standing rule saved to feedback memory: every new domain term introduced in UI copy must follow this two-file process.

---

### Earlier in the day (already-documented arcs above, full detail in commits)

**Earlier `Slice 1 — Tenor cap 30→40 yr (solar) + financial-input lineage honest-up` detail** (`a575c8b`)
- `scenarioEngine.js:271` — solar tenor cap raised 30→40 yr. IL community-solar programs underwrite to 40-yr terms; banks finance against them. BESS stays capped at 20 yr (battery-degradation envelope unchanged). Tests updated in `tests/unit/scenarioEngine.spec.js`.
- `ScenarioStudio.jsx` — new `SLIDER_LINEAGE` map + `LINEAGE_PALETTE` renders a small `.eyebrow-mono` chip next to each slider label: Capex "Synth · 2026 extrap" (amber), IX "Industry avg" (amber), Opex "Industry avg" (amber), REC "Observed" (teal), CF "Observed · NREL" (teal), Discount / Tenor / Size "User input" (slate). Each chip carries a hover tooltip explaining the tone.
- Directional-sensitivity banner relocated to the panel header (was buried at bottom of the panel). "Directional" eyebrow chip + tight punch line. Bottom block deleted. Long-form `SCENARIO_DISCLAIMER` constant retained in scenarioEngine.js for ProjectPDFExport.

**Slice 2 — Dev Feasibility tab as the default view** (`2a90287`)
- Tab nav under the panel header: **Dev Feasibility** (default) | **Financial Sensitivity**. Bloomberg-y rectangular tabs, navy bottom rail on active, sessionStorage-persistent so toggling during a session survives Lens re-runs. `aria-selected` + role="tab".
- New `src/components/scenario/DevFeasibilityView.jsx` (~310 LOC) composes `computeSubScores` + `safeScore` outputs into a verdict tile (Go ≥70 / Caution 50–69 / No-Go <50 with weakest-pillar rationale), 4 pillar cards (Offtake / IX / Site / Policy reading directly from scoreEngine), feasibility levers (MW slider live-rescores pillars; COD year, subscription target CS-only, IX assumption informational), timeline-to-COD narrative (composes IX queue months, wetland Section-404 risk at ≥25% coverage, policy headwind count, target-year runway).
- New `src/components/scenario/ComparableProjectsPanel.jsx` (~95 LOC) wraps `getCsProjectsAsComparables` (existing helper) with ±50% MW band + top-5-by-vintage table. Honest empty state when no rows. BESS / C&I return empty (NREL Sharing the Sun is CS-only) with a name-the-reason caption.
- `Search.jsx` prop fan-out — passes stateProgram, countyData, ixQueueSummary, policyEvents, technology, stage, stateName, mw through to ScenarioStudio. All data already in `results.*` from the single Promise.all batch; no new query path.
- Architecture discipline: no new endpoints (Vercel Hobby 12-function cap stays maxed), no scenarioEngine.js math changes, per-tech dispatch on Offtake card + comparables panel.

**Slice 3 — Migration 063 handler swap (PDF lineage → discovered_via column)** (`3b062f6`)
- Migration 063 applied in Supabase (extended `policy_impact_events.discovered_via` CHECK to accept `'pdf_upload'`). `api/handlers/_lens-policy-classify.js:469` now writes `discovered_via = isPdfMode ? 'pdf_upload' : 'manual'` instead of always-'manual'. The redundant `source_type: 'pdf_upload'` double-stamp inside `discovery_metadata` is gone; `pdf_filename` stays (per-upload metadata, not lineage). Cache key bumped v=7→v=8 to invalidate ~24h of legacy-shape cached responses.
- No UI surface currently filters or renders `discovered_via`, so the swap is purely on the write path. Future admin filters / freshness queries can now `WHERE discovered_via = 'pdf_upload'` directly instead of jsonb gymnastics.

**Slice 4 — Eyebrow-mono sweep closed** (this commit)
- Pilot retained in §06 (3 chip-tag spans on EventRow — utility class applied). Broader sweep DEFERRED INDEFINITELY. Per the inline-candidate audit: ~48 candidate sites across 10 admin pages vary in size (8 / 9 / 10 px), tracking (0.14–0.24em) and font-weight (sometimes omitted). A blanket replace would visibly regress some of them. Address per-file only when touching those files for other reasons.

**Resume command:** `Continue from BUILD_LOG pickup. Scenario Studio dev-pivot arc shipped 4 commits today: tenor cap 30→40 yr + lineage honest-up (a575c8b), Dev Feasibility tab default (2a90287), migration 063 handler swap (3b062f6), eyebrow-mono sweep closed (this commit). Aden to verify on prod: (1) IL CS Lens → Scenario Studio tenor slider goes to 40; (2) NY / MA / IL CS Lens → Dev Feasibility tab is default, verdict tile + 4 pillar cards render, comparables panel populates from cs_projects; (3) admin drop a test PDF on PolicyImpactTab → row should have discovered_via='pdf_upload' (probe Supabase). Remaining backlog: Landing tightening (design-subjective), §04 / §06 visual-redundancy review (gated on curated events going live across more states), audit-ui parallel-pressure flakes (Dashboard click matrix + Profile gauge — not in verify chain), 2x Dev Feasibility view follow-ups likely after Aden tests on prod (timeline-narrative phrasing, lever copy, verdict thresholds).`

---

### Session 2026-05-13 (evening) — §05 path-A validated + §06 Regulatory Watch promoted

Two related slices on a single evening: the §05 prod-bisect concluded (path A succeeded — the wrapper recursion was the real OOM source after all), and the un-numbered PUC-dockets panel got promoted to §06 with a broader Regulatory Watch framing tied to the existing `policy_impact_events` table.

**§05 Comparable Deals — path-A re-enable** (commit `933237e` — `src/pages/Search.jsx`)

- Flipped `{false &&}` gate in `Search.jsx` (line 1176) so `<LensComparablesSection>` renders on Lens results again. Stale "DISABLED 2026-05-11" comment block replaced with a path-A rationale: the original CsMarketPanel/OOM attribution was made with the recursive wrapper bug present in `LensComparableSubsection`, so any `bisectOnly` value would have stack-overflowed regardless of which subsection was active. Fix `e60882f` removed the confound; this commit re-enables the section to let prod tell us whether the OOM was real.
- Prod validation (Aden, manual, real Chrome tabs):
  - **NY** — 1,351 cs_projects rows. Loaded clean. The worst case from the original bisect comment.
  - **MA** — 374 rows. Loaded clean.
  - **IL** — 261 rows. Loaded clean.
  - Three-for-three across the original heavy-rowcount states. The 2026-05-11 attribution was wrong; the wrapper recursion was the OOM source all along. CsMarketPanel + getCsMarketSnapshot are not the problem they were thought to be.
- Comment in `LensComparablesSection.jsx` updated to reflect path-A validation (was "Re-enabling § 05 still requires a fresh prod bisect now that the recursive wrapper isn't a confound" → now records the prod-bisect outcome).

**§06 Regulatory Watch — new section** (this commit — `src/components/LensRegulatoryWatchSection.jsx` new; `src/pages/Search.jsx`, `src/components/MaybeLensPanels.jsx`, `src/lib/glossaryDefinitions.js` modified)

- **Architecture decision:** §06 reuses the existing `policy_impact_events` table (migration 061) — the same data source §04 (Policy Climate) aggregates into a pillar sub-score. §04 = pillar-grouped diagnostic view; §06 = chronological feed sliced by recency. Same source of truth, complementary views. No new table, no migration.
- **Content design — `LensRegulatoryWatchSection.jsx`:**
  - Top-level `<SectionMarker index={6} label="Regulatory Watch" sublabel="pending bills · enacted events · active proceedings" />`.
  - Subsection 1 (◆ Pending & Recent Events): chronological feed from `results.policyEvents` (already fetched by Search.jsx — no new query). Events bucketed by recency: **Pending & Upcoming** (`status='pending'` OR `effectiveDate > today`), **Recent** (last 90 days), and **Earlier on the books** (collapsed `<details>` since older events are reference material, not action items). Each event row renders compact: event_type tag (Bill / PUC Order / Tariff Change / Rule Filing / Exec Order), status badge (Pending / Enacted / Partial / Overturned / Expired), pillar chip in pillar color, FEOC + Safe Harbor mini-flags when applicable, event name, summary (line-clamp-2), relative date ("in 47 days" / "23 days ago" / "5 mo ago"). Click row to expand methodology + analyst note + source ↗ link. Click target only active when there's detail to show.
  - Subsection 2 (◆ Active Proceedings): existing `RegulatoryActivityPanel` rendered inside a `CollapsibleSubsection`. Curation-gated by `getPucDockets({ state })` probe — hides entirely when no `puc_dockets` rows exist for the state (most states today). When dockets are seeded, they appear inline under §06 instead of as a separate un-numbered panel.
  - Empty state honest: "No regulatory events tracked for {stateName} yet. Admin curation surfaces enacted bills, PUC orders, tariff changes, rule filings, and executive orders here as they're sourced from policy articles or pasted PDF text." Names the next-curation-step explicitly.
- **Search.jsx wiring:** replaced `<MaybeRegulatoryPanel>` (line 1191) with `<LensRegulatoryWatchSection state={...} stateName={...} policyEvents={results.policyEvents || []} />` preceded by a `<SectionDivider />`. Import swap at line 39. Stale "MaybeRegulatoryPanel moved to..." comment block at line 238 updated to note the absorption into §06.
- **`MaybeLensPanels.jsx`:** `MaybeRegulatoryPanel` export removed (orphaned after §06 absorbed it). `getPucDockets` import dropped. `RegulatoryActivityPanel` import dropped. Block comment notes the migration date. Clean-code discipline per `feedback_clean_code_practices` — no orphan exports left behind.
- **Glossary additions** (`src/lib/glossaryDefinitions.js`):
  - **"Regulatory Watch"** — distinguishes §06 from §04 ("§04 aggregates policy_impact_events into a pillar sub-score, §06 takes the same table and slices it by TIME"). Names the curation funnel (article URLs + AI classification + PDF-text paste).
  - **"Active Proceedings"** — explains why this subsection is curation-gated even though it lives inside §06 ("per-state PUC interfaces are archaic and manual transcription is high-friction"). Frames `policy_impact_events` as the workhorse and PUC dockets as the optional sidecar.

**Why this matters strategically:** Aden's curation labor is asymmetric — sourcing policy articles is leverageable (RSS, news aggregators, Utility Dive); manual PUC docket transcription per-state is brutal (every state PUC has its own archaic CMS, no API). §06 reuses the `policy_impact_events` table whose `discovered_via` enum already supports `news_ai_suggest` and `docket_ai_suggest` — so the curation funnel matches the labor reality. PDF intake (next slice) widens the funnel further.

**§06 EventRow expand affordance** (commit `5f2c229` — `src/components/LensRegulatoryWatchSection.jsx`)

- Live feedback during prod QA: §06 event rows (LD 1777 test case) didn't read as clickable — admins didn't realize they could open the row to see methodology + source.
- Three layered cues added: (1) explicit "View methodology & source ▾" / "Hide details ▴" mono caption inside the row body below the summary (the unmissable layer); (2) animated chevron in the upper-right of the row that rotates 180° on open (matches the existing `CollapsibleSubsection` chevron pattern); (3) row border color darkens from `#E2E8F0` → `#CBD5E1` on open as a subtle active-state signal.
- All three cues are gated on `hasDetail` (`impactMethodology || analystNote || sourceUrl`). Rows without expandable content (rare — most events have at least a sourceUrl) stay non-interactive with default cursor; `aria-expanded` stays unset on those.

**PDF intake path for `policy_impact_events`** (this commit — `api/handlers/_lens-policy-classify.js` + `src/components/admin/PolicyImpactTab.jsx`)

- **Architecture call: native PDF document blocks via Anthropic, not client-side text extraction.** Anthropic SDK 0.95.1 + Haiku 4.5 natively accept PDF documents as content blocks (`{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: <base64> } }`). This beats client-side pdfjs-dist on three counts: zero new deps (no ~90 KB gzipped library on the admin chunk), no multi-column / OCR-fidelity issues (Anthropic reads the PDF as the model would read it natively), and one round-trip instead of two-step extract-then-classify.
- **Server changes (`_lens-policy-classify.js`):** body destructure adds `pdfBase64` + `pdfFilename`. Early branch on `isPdfMode = typeof pdfBase64 === 'string' && pdfBase64.length > 0`. PDF mode skips `expandIfUrl` + text-length guards (the document is the input). 6 MB base64 cap (`MAX_PDF_BYTES_BASE64`) returns 413 with a clear "split or excerpt" message. Cache key bumped to `v=7`; key uses SHA256 of pdfBase64 (truncated to 32 chars) for PDF mode, raw text for text mode — both 24h-cached. The Anthropic `messages` payload becomes an array of content blocks in PDF mode (document + text-with-hints) vs a string in text mode (unchanged). Tier loop stamps `discovery_metadata.source_type = 'pdf_upload'` + `pdf_filename` on every emitted draft (preserves per-tier metadata via spread). Response includes `pdfFilename` for the client to display.
- **Client changes (`PolicyImpactTab.jsx`):** new state hooks for `pdfBase64`, `pdfFilename`, `pdfSize`, `pdfDragOver`, `pdfError`. `handlePdfFile(file)` validates MIME / extension, reads `FileReader.readAsDataURL`, strips the data-URL prefix, enforces the 6 MB base64 cap client-side (matches server cap), and sets the staged state. Drop zone above the textarea: dashed border idle, teal background + solid border when a PDF is staged, animated hover state on drag-over. Filename + size + "PDF Ready" indicator inside the zone once staged; Remove button clears the staged PDF. Textarea below becomes disabled with a "PDF staged above — text input ignored at submit" placeholder when a PDF is present (PDF wins at submit time, matching the server branch).
- **Submit flow:** `callPolicyClassify` accepts `pdfBase64` + `pdfFilename`, forwards both. `handleClassify` sets `hasPdf = !!pdfBase64`; the auto-publish branch passes an empty `fallbackSourceUrl` in PDF mode (admin fills source_url during the next edit pass — visible in the row list so it's discoverable). Clear button resets both text and PDF state.
- **Lineage:** the table-level `discovered_via` enum is constrained to `('manual','news_ai_suggest','docket_ai_suggest','user_report')` and adding `'pdf_upload'` would require a migration FILE that Aden applies. Skipped that for now — PDF lineage lives inside `discovery_metadata` jsonb (`source_type: 'pdf_upload'`, `pdf_filename: 'X.pdf'`). If PDF intake becomes a recurring lineage worth surfacing in admin filters or the freshness card, a follow-up migration extends the enum.

**Findings worth surfacing (not blocking):**

- **§04 / §06 do show overlapping events.** When `MA` has 22 active policy_impact_events, all 22 appear in §04 (grouped by pillar with full collapsible detail) AND in §06 (organized chronologically with compact rows). This is intentional — Bloomberg-style precedent: a security has both a Fundamentals page (analytical) and a News page (chronological). Different jobs, different visual designs, same underlying data. Worth eyeballing in prod to confirm the §04 vs §06 visual distinction is sharp enough that users don't read them as redundant.
- **`policy_impact_events.event_type='puc_order'` overlaps semantically with `puc_dockets`.** A PUC order in policy_impact_events is the OUTCOME of a docket (enacted decision with quantified impact). A puc_dockets row is the ACTIVE proceeding (filings, comment windows). They're related but distinct life-cycle stages. §06 surfaces both — chronological feed for outcomes, Active Proceedings subsection for in-flight dockets. Long-term, `discovery_metadata.docket_id` could link a policy_impact_events row back to the puc_docket it came from, but no need to wire that now.
- **PDF intake shipped this same session** (see below). Three design decisions resolved: (a) no new endpoint — extended the existing `_lens-policy-classify.js` handler, staying under the Vercel Hobby 12-function cap (we're still at 12); (b) no enum migration — PDF lineage rides in `discovery_metadata` jsonb; (c) extended the existing Policy Impact Quick-Add card rather than adding a new tab. Native PDF document blocks via Anthropic eliminated the need for pdfjs-dist client-side.

**Verification (close of session, all four slices):**
- `npm run lint:api / lint:secrets / lint:locs` — clean
- `npm run test:unit` — 129/129 green
- `npm run build` — clean (3.08s on the PDF intake commit; 3.44s on §06 promotion; 3.93s on expand fix)
- `npm run test:smoke` — 7/7 green
- §05 re-enable commit (`933237e`) shipped + prod-validated on NY/MA/IL.
- §06 promotion (`de13907`) + expand fix (`5f2c229`) live on Vercel; PDF intake shipping next.

---

### Session 2026-05-13 — Post-arc backlog slices 1–3

Three slices landed on a single trajectory: structural cleanup (Library hooks), a11y migration (LensTour), latent-bug correctness (§05 wrapper). Each shipped as its own commit with the full verify chain.

**Library.jsx → useLibraryLayout + useBulkSelection** (commit `9a489d7` — `src/pages/Library.jsx`, `src/hooks/useLibraryLayout.js`, `src/hooks/useBulkSelection.js`)

- `src/hooks/useLibraryLayout.js` (new, ~155 LOC) owns the page's view-state stack: `sortBy`, `filterState/Tech/Stage`, `pipelineExpanded`, `viewMode` (Projects/Scenarios/Comparisons), `layout` (cards/table/map) with localStorage persistence, `drawerProject` for the map slide-in, `pageSize`/`page` with persistence + filter-change reset + size-shrink clamp, `?preview=empty` + `?all=1` + `?tab=` URL flags, the Esc-clears-state-filter-in-map keyboard effect, and the `displayProjects` (filtered + sorted) + `pagedProjects` (windowed) memos. Takes `projects`, `stateProgramMap`, `countyDataMap` from the caller; returns state + setters + derived values.
- `src/hooks/useBulkSelection.js` (new, ~50 LOC) owns selection state: `selectedIds` Set, `toggleSelect/clearSelection/selectAll` with the select-all-ref pattern internalized so `selectAll` stays referentially stable across filter changes, `allSelected` derived flag, and the `bulkConfirm` modal pair. Bulk *handlers* (delete/export/compare) stay in Library.jsx because they need too much external context (supabase, exportXLSX, useCompare) to belong in a generic selection hook.
- `src/pages/Library.jsx` shrinks from 1517 → 1399 LOC. Concerns now clean-cut: data-state (projects, scenarios, share counts) in the page; view-state in `useLibraryLayout`; bulk-state in `useBulkSelection`. The page consumes the hooks at the top and uses their state/derived values directly.

**LensTour → Radix Dialog primitives** (commit `f1f3825` — `src/components/LensTour.jsx`)

- Pre-migration LensTour hand-rolled both the per-step anchored tooltip and the closing "Tour complete" card with `role="dialog"` + `aria-label` — but no focus trap, no aria-modal, no aria-labelledby/aria-describedby wiring, and a window keydown listener that double-fired Escape against the dialog state.
- Both surfaces now use raw Radix Dialog primitives (`RadixDialog.Root` + `Portal` + `Overlay` + `Content` + `Title` + `Description`). Screen readers get the full WAI-ARIA dialog contract; keyboard users get a real focus trap + focus restoration on close; Esc routes through Radix's `onOpenChange` callback so it no longer fights the arrow-key navigation handler.
- Per-step tooltip keeps its bespoke `computeTooltipPosition` (placement: top/bottom/right with viewport clamping) by applying the computed `tip` style directly to `Content`. The inverted-box-shadow spotlight ring renders as a sibling of `Dialog` (z-201) so it sits between Overlay (z-200) and Content (z-202). `onOpenAutoFocus` is overridden to focus the primary "Next →" button via a `data-tour-primary` attribute — Radix's default would focus the Skip button (first in DOM order) which isn't the primary action.
- Closing "Tour complete" card uses centered modal positioning + `RadixDialog.Title` for the heading + `RadixDialog.Description` for the body. Gradient accent rail and ◆ "You're set" eyebrow preserved verbatim.

**LensComparablesSection — fix recursive wrapper bug** (commit `e60882f` — `src/components/LensComparablesSection.jsx`)

- Phase 0 (commit `cfce269`, 2026-05-11 15:53) migrated `LensComparableSubsection` off its hand-rolled toggle. The migration imported `CollapsibleSubsection` (line 13) but the return body recursed into `LensComparableSubsection` itself instead. Any actual render would have stack-overflowed.
- The bug was masked by Search.jsx's `{false &&}` gate around §05 (commit `4b183d0`, 16:24), which followed Phase 0 by 31 minutes. After the gate landed, §05 has been dead code from then through today.
- The OOM bisect that concluded "CsMarketPanel + getCsMarketSnapshot is the OOM source" (commit `a709d8b`, 16:21) ran with the recursive wrapper present. The bisect's step 2 used `bisectOnly='operating'` and still crashed — but any `bisectOnly` value would have stack-overflowed from the recursion regardless of which subsection was active. The CsMarketPanel conclusion is on shaky evidence in retrospect; the actual OOM source is unverified.
- Fix is dead-code correctness: `<LensComparableSubsection>` → `<CollapsibleSubsection>` at the return inside the wrapper (lines 55-62). Gate stays `{false &&}`. Future §05 re-enable now isn't blocked on a hidden bug, and a fresh prod bisect (without the recursion confound) can give a clean read on whether the OOM is real or whether the bisect was misled.

**Drive-by — audit-ui cron-latency skip-gate race** (`tests/audit-ui.spec.js`)

- Phase 6 added a cron-latency probe that skips gracefully when the test user isn't admin (`/admin` renders "Access denied"). The skip-gate used `await page.getByText('Access denied').count() > 0` after `waitForLoadState('networkidle')` — but Admin.jsx's role-check fetch can resolve AFTER networkidle, so the count check returned 0 while the gate copy was about to render. Test would time out trying to click "Data Health".
- Replaced with `Promise.race` between "Access denied" appearing and the Data Health tab appearing — whichever paints first decides the path. Verified stable across 3 repeats (3/3 consistent skips). Full audit-ui suite now passes the cron-latency test reliably.

**Findings worth surfacing (not blocking) — 2026-05-13:**

- **§05 re-enable strategy still needs your call.** Paths A / B / C: (A) ship the wrapper bug fix [done — commit `e60882f`] then a second commit that flips the gate and lets prod tell us if the OOM is really gone; (B) do the original plan (migrate Operating Projects to Library, multi-slice); (C) defer entirely. The wrapper fix has unblocked future work — choosing between A/B/C is now a strategic call.
- **Long-tail eyebrow-mono sweep is lower-ROI than the BUILD_LOG estimate suggested.** 181 inline sites across 69 files match the `font-mono uppercase tracking-[0.18em or 0.24em]` pattern — but most sampled sites in admin/* aren't clean `.eyebrow-mono` candidates (different sizes, weights, pill/button contexts). A bulk find-replace would risk visual regressions across low-frequency surfaces. Worth a tight admin-only commit on a deliberate slice rather than a 69-file sweep.
- **Pre-existing audit-ui parallel-pressure flakes.** Dashboard click matrix + Profile gauge tests time out on full-suite parallel runs (Vite single-server + 4 workers + heavy audit pages overload networkidle). Pass cleanly in isolation. Phase 6 verification only ran `-g "axe|Cron Latency"` which skipped these. Not in verify chain; surfaces only on opt-in full audit runs.

**Verification (close of session):**
- `npm run build` — clean (4.32s on the §05 fix commit; 3.55s on the Library decomp commit; 3.44s on the LensTour commit)
- `npm run test:unit` — 129/129 green across all three commits
- `npm run test:smoke` — 7/7 green
- `npm run test:smoke:pro` — 7/7 green (Library + Lens both exercised the new hooks/dialogs)
- `npx playwright test --project=setup --project=audit-ui -g "axe|Cron Latency"` — 5/5 + 1 skip (cron-latency skip-gate now race-safe)
- `npm run lint:api / lint:locs / lint:secrets / lint:audit` — clean across all three commits

---

### Session 2026-05-12 (continued) — TRACTOVA-UX-001 Phase 6 shipped

Phase 6 ships the verification scaffolding that closes the V3 arc. New tests + the structural a11y/perf fixes they uncovered. Five pieces landed; two real bugs found by the axe sweep got fixed in-line.

**axe-core wiring** (`tests/audit-ui.spec.js` + `package.json`)
- Installed `@axe-core/playwright@^4.11.3` as a devDep.
- Added four `axe — <surface> has 0 critical violations` tests covering Lens (`/search`), Library (`/library`), Profile (`/profile`), Glossary (`/glossary`). Each test runs `AxeBuilder` with the WCAG 2.1 A+AA tag set and asserts on `impact === 'critical'` rows. `serious` and below are not gated yet — Phase 7 tightening can elevate them once the design is locked.
- Added a `summarizeViolations()` helper that formats axe results as a one-line-per-rule summary including impact, rule id, selector, and node count — so failures land readable in CI logs.
- **Real bugs caught + fixed:** `src/components/FieldSelect.jsx` and `src/components/CountyCombobox.jsx` both ship hidden `<input type="text" required className="sr-only" tabIndex={-1}>` for HTML5 form validation. Axe flagged them as critical (no implicit/explicit label, no `aria-label`, no `aria-labelledby`, no `placeholder`, no `title`). Fix: added `aria-label={label}` to FieldSelect's input + `aria-label="County"` to CountyCombobox's input. The hidden input is still non-interactive (`tabIndex={-1}`); the new aria-label gives it an accessible name when AT walks the form and the visible parent label sits above it for sighted users. Without the axe sweep these would have stayed silent — every Lens form session was rendering 4-5 unlabeled inputs.

**MobileGate softening — route-aware** (`src/components/MobileGate.jsx` + `src/hooks/useIsMobile.js` + `src/components/library/MobileLibrary.jsx`)
- `MobileGate.jsx` now uses `useLocation()` and consults a `GATED_PATHS = ['/search', '/admin']` allowlist via `pathname === p || pathname.startsWith(p + '/')`. Every other route passes through on mobile. Pre-Phase-6 the gate fired on every authed route — a phone user couldn't even read their saved Library or check Profile away from a laptop. After: Library/Profile/Glossary/Dashboard/Privacy/Terms all work; only the Lens form (dense desktop tool) and Admin (data-health admin) gate.
- Gate copy updated: heading is now "This view needs a laptop" and points at the specific surface (`Lens · Intelligence Report` vs `Admin · Data Health`) rather than a generic "use desktop." New "Email myself this link" primary CTA generates a `mailto:?subject=…&body=…` with the current URL pre-filled — the "send myself a desktop link" affordance called out in the roadmap. The fallback "Continue to mobile site (limited)" button stays but moves down to secondary.
- `src/hooks/useIsMobile.js` — small new hook that mirrors MobileGate's `(max-width: 767px)` matchMedia threshold so multiple call sites (MobileGate, Library, CompareTray) share one definition.
- `src/components/library/MobileLibrary.jsx` — new cards-only Library view. Fetches projects + state_programs + state_deltas + per-(state,county) county data using the same Supabase queries the desktop Library runs. Renders a stack of `ProjectCard` components with a search input + sort dropdown (Recent / Score / MW). Stage edits and project removal still work; bulk-actions, view-mode toggle, map, table, comparisons tab, and scenarios tab are intentionally absent. Footer copy points the user back to desktop. Mounted from `Library.jsx`'s outer paywall gate: `if (isMobile) return <MobileLibrary />` runs immediately after the Pro check so the heavy `LibraryContent` desktop body never mounts on a phone.
- `src/components/CompareTray.jsx` — `useIsMobile()` guard added to short-circuit `return null` on mobile. The compare modal is a wide table grid that won't collapse cleanly under 768px; rather than ship a half-rendered tray, hide it.

**Code-split ProjectTable** (`src/pages/Library.jsx`)
- ProjectTable join LibraryMap as a `React.lazy(() => import(...))` chunk. The default `'cards'` layout means a fresh-arrived user no longer pays for ProjectTable's per-row chrome (StagePicker + ShareButton + scenario chips) on first paint. Build now emits a separate `ProjectTable-DImpCM5K.js` chunk; previously it was bundled into the Library entry. The existing Suspense fallback pattern (skeleton with `animate-pulse`) is reused for symmetry with the Map layout.

**Cross-browser sweep — Playwright** (`playwright.config.js`)
- Added `audit-ui-firefox` and `audit-ui-webkit` projects that point at the same `tests/audit-ui.spec.js`, depend on `setup` (for the saved Pro session), and use `devices['Desktop Firefox']` / `devices['Desktop Safari']` respectively. Opt-in via `npx playwright test --project=audit-ui-firefox` so default CI runs stay cheap. First run requires `npx playwright install firefox webkit`.

**Cron-runs latency monitor — audit-ui probe** (`tests/audit-ui.spec.js`)
- New test that navigates to `/admin → Data Health` and asserts the existing CronLatencyPanel (`src/components/admin/CronLatencyPanel.jsx`, shipped earlier with the analyzer at `src/lib/cronLatencyMonitor.js`) renders without error. Soft-skips when the audit user isn't admin (Admin.jsx role gate). Logs any `warn`-severity rows (p95 ≥ 70% of the function's `maxDuration`) as CI output without failing — engineering responds to those structurally, gates aren't the right enforcement layer.

**Deferred (intentional, called out in roadmap):**
- **Long-tail eyebrow-mono sweep** — ~200 inline `text-[9px] font-mono uppercase tracking-[0.18em]` call sites still remain in `admin/*` + Lens detail panels (CsMarketPanel, RegulatoryActivityPanel, SolarCostLineagePanel). The Phase 3 sweep landed everywhere a Pro user spends meaningful time; the remainder is mostly admin/internal and lower-frequency Lens panels. Future incremental work.
- **`Library.jsx` decomposition** — page is 1500+ LOC after Phase 2C's Comparisons tab + 2D's saved-count fetcher. Extract `useBulkSelection` + `useLibraryLayout` hooks. Out of scope for Phase 6 (verification-focused phase, not a refactor).
- **Landing tightening** — Phase 5.x follow-up; deferred again.

**Verification (close of session):**
- `npm run test:unit` — 129/129 green
- `npm run build` — clean (3.33s)
- `npm run test:smoke` — 7/7 green
- `npm run test:mobile` — 10/10 green
- `npm run test:mobile:pro` — 6/6 green (exercises MobileLibrary + the route-aware gate)
- `npx playwright test --project=setup --project=audit-ui -g "axe|Cron Latency"` — 5/5 passed, 1 skipped (cron-latency skips when test user isn't admin)
- `npm run lint:locs / lint:api / lint:secrets` — clean

---

### Session 2026-05-12 (continued) — TRACTOVA-UX-001 Phase 5 shipped

Phase 5 closes the cross-surface coherence gaps. Three landed pieces, one deferred:

**Profile inline stage editing** (`src/pages/Profile.jsx`)
- Imported the existing `StagePicker` and dropped it into the Recent Activity rows. The stage is no longer rendered as static text — it's a Radix-Popover dropdown that writes to Supabase + logs a `stage_change` audit event (the StagePicker handles all that internally). The onChange callback updates Profile's local `allProjects` state so the row reflects the new stage immediately. Saves users a Library detour every time they want to advance a project stage.

**Profile billing history** (`api/create-portal-session.js` + `src/pages/Profile.jsx`)
- New `BillingHistory` component on the left-column Pro section. Fetches `GET /api/create-portal-session?action=invoices` on mount, renders a read-only list of Stripe invoices (status pill, amount, date, hosted-URL "View →" link).
- The endpoint that previously only created portal sessions (`POST /api/create-portal-session`) now also handles a `GET ?action=invoices` branch. Single file, dual purpose — kept here rather than spinning up a sibling `api/billing-history.js` because we're at Vercel Hobby's 12-function cap. The endpoint header comment documents both routes. Sanitized payload: only id / number / status / amount / currency / created / period_end / hosted_invoice_url / invoice_pdf / first-line description — no raw Stripe internals leak to the browser.
- Empty state: when `profile.stripe_customer_id` is null (free tier or never subscribed), the endpoint returns `[]` and the UI shows an italic "No invoices yet" hint.
- Skeleton loading: 3 pulsed bars while in-flight.

**Glossary tooltips sweep — targeted** (`src/components/CompareTray.jsx` + `src/components/ProjectCard.jsx`)
- CompareTray `MetricRow` now accepts an optional `term` prop; when present, the label renders inside a `<GlossaryLabel term={term} displayAs={label}>` so hovering surfaces the canonical glossary definition + Tractova data inputs. Wrapped: Feasibility Index · Offtake · IX · Site Control · LMI Carveout · Wetland Warning · Prime Farmland.
- ProjectCard expanded diligence tab: "IX Difficulty" wraps `IX` and "LMI Required" wraps `LMI Carveout` with display-as overrides so the visible label stays familiar while the tooltip pulls the canonical definition.
- ScenarioStudio already had glossary tooltips on the slider labels from prior work; left intact.

**Deferred (intentional, called out in roadmap):**
- **Landing tightening** — the hero already runs on live `getStatePrograms` + `getDashboardMetrics` data. The "Three Pillars" bullet cards are next to tighten but the design is subjective enough to deserve a standalone commit with screenshot diffs. Tracked as a Phase 5.x follow-up.
- **Glossary tooltips on the long tail** — only the highest-leverage surfaces (CompareTray rows, ProjectCard data labels) got wrapped this pass. ~200 inline mono-cap labels across the Lens panels (OfftakeCard / InterconnectionCard / SiteControlCard / MarketIntelligenceSummary / ScenarioStudio sliders) + admin/* are Phase 6 batch work.

**Verification (close of session):**
- `npm run test:unit` — 129/129 green
- `npm run build` — clean (3.47s)
- `npm run test:smoke` — 7/7 green
- `npm run lint:locs / lint:api / lint:secrets` — clean

---

### Session 2026-05-12 (continued) — TRACTOVA-UX-001 Phase 4 shipped

Phase 4 ships the motion layer that anchors the Lens results page emotionally — gauges fill on first reveal and the developer sees an instrument reading itself. The work is concentrated in the three gauge components + a small new hook in MotionPrimitives so the motion primitive layer stays the single source of truth for IntersectionObserver-based reveal patterns.

**New primitive:**
- `useFirstVisible(ref, options)` in `src/components/motion/MotionPrimitives.jsx` — IntersectionObserver wrapper that flips visible=true once when the element enters the viewport, then disconnects. Used by all three gauges so the entry animation only fires once per scroll (subsequent re-renders / score changes don't re-trigger the dramatic 0→score fill). Honors `prefers-reduced-motion`.

**Gauge animations:**
- `src/components/ArcGauge.jsx` — Lens composite tachometer. Previously animated on every value change with `initial={false}` (no entry fill). Now the SVG carries a `svgRef` + `useFirstVisible` flag; the motion.path strokeDashoffset target swaps from `arcLength` (empty) to `arcLength * (1 - pct)` (filled) once visible. The number readout (`AnimatedScoreText`) takes a `visible` prop and tweens 0 → score on first reveal via `animate()` + cubic-bezier. Score changes after first reveal animate normally.
- `src/components/library/MiniArcGauge.jsx` — Library project bar gauge. Same pattern: `wrapRef` + `useFirstVisible` gates both the strokeDasharray fill animation and the number readout's `animate()` tween. Reduced-motion users get final state immediately (no 0 frame).
- `src/components/library/ScoreGauge.jsx` — Library expanded project card gauge. Was static (no animation at all). Rewrote to use motion.path strokeDashoffset over the full semicircle (`circ * (1 - pct)` target) with cubic-bezier 0.9s tween, plus a new `ScoreDigits` component that runs an inline RAF loop on `visible` toggle to count 0 → score over 700ms. Severity colors swapped from emerald/yellow/red to the canonical teal/amber/red palette so the gauge matches the rest of the V3 vocabulary.

**Hover polish:**
- `src/components/ProjectCard.jsx` — collapsed card now lifts 2px + deepens shadow on hover via `motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg`. CSS approach (not motion-wrapped) so dense Library lists stay cheap. Hover lift is skipped while expanded so the open card stays anchored. Reduced-motion users skip the transform via the `motion-safe:` prefix.

**Deferred (intentional, called out in roadmap):**
- **RevealOnScroll on Lens sections** — the §0.1 DO-NOT-REPEAT lessons explicitly warn against page-level motion wrapping on the Lens results tree (OOM history with PageTransition + CollapsibleSubsection height: auto). The killer-feature trio is already shipped via the gauges; section-level reveals are polish that fits Phase 6's cross-browser sweep where each reveal can be tested individually.
- **Skeleton variant audit** — Library already uses `animate-pulse` skeletons for projects + map loading; the remaining bare-spinner cases are covered by LensOverlay during analysis. Full Skeleton variant sweep deferred to Phase 6 polish.
- **Chip + button micro-interactions** — applied selectively (ProjectCard hover) rather than blanket-applied. Adding `hover:scale-1.03` across every chip risks visual noise on dense panels; reserved for Phase 6 audit-ui hardening once the patterns are tested side-by-side.

**Verification (close of session):**
- `npm run test:unit` — 129/129 green
- `npm run build` — clean (3.05s)
- `npm run test:smoke` — 7/7 green
- `npm run lint:locs / lint:api / lint:secrets` — clean

---

### Session 2026-05-12 (continued) — TRACTOVA-UX-001 Phase 3 shipped

Phase 3 ships the structural accessibility wins: Radix dialogs replace hand-rolled modals, the ARIA combobox pattern lights up Cmd-K, every collapsible toggle now points at its panel via aria-controls, and the eyebrow-mono utility sweep starts moving the codebase off scattered inline mono-cap variants. ScenarioStudio's "✓ Saved" finally stays saved.

**Modifications:**
- `src/components/ScenarioStudio.jsx` — drop the 2.5s `setTimeout` that reverted `justSavedName` to null. Saved state now persists until the user actually edits something (slider drag, reset, preset apply). The toast still fires for the save event itself; the button state stays accurate to what's persisted in the DB.
- `src/components/CompareTray.jsx` — Compare modal migrated from `<div role="dialog">` + manual ESC handler + manual focus management to full Radix Dialog primitives (`RadixDialog.Root` / `Portal` / `Overlay` / `Content` + `Title` + `Description`). Esc closes, outside-click closes, focus traps inside the modal, aria-modal is set, all for free. The visible UI (navy chrome, teal accent rail, sticky column headers, sub-dialog Save-as) is unchanged. AI panel toggle inside the modal gets `aria-controls` + `id="compare-ai-panel"` + `role="region"` linkage.
- `src/components/CollapsibleCard.jsx` — adds `useId`-generated panel + heading ids, paired `aria-controls` from the button and `aria-labelledby` on the panel + the outer `<section>`. The 3 main Lens pillar cards (Site Control / Interconnection / Offtake) now announce as "Site Control – feasibility sub-score, button, expanded" to screen readers.
- `src/components/CommandPalette.jsx` — input gets `role="combobox"` + `aria-autocomplete="list"` + `aria-expanded` + `aria-controls` (pointing at the result list) + `aria-activedescendant` (pointing at the currently active option) + `aria-label`. Result list gets `role="listbox"` + an id. Each option gets `role="option"` + `aria-selected={active}` + `tabIndex={-1}` (so Tab doesn't move focus into individual options — arrow keys handle navigation as the combobox pattern dictates). Now matches the WAI-ARIA combobox grouping pattern.

**Eyebrow-mono sweep — focused, 47 swaps across the Lens + Library surfaces:**
- `ProjectCard.jsx` (10), `OfftakeCard.jsx` (11), `InterconnectionCard.jsx` (5), `SiteControlCard.jsx` (2), `MarketPositionPanel.jsx` (5), `MarketIntelligenceSummary.jsx` (3), `ComparableDealsPanel.jsx` (3), `MetricsBar.jsx` (2), `ScenariosView.jsx` (2), `ScenarioStudio.jsx` (2), `SavedComparisonsList.jsx` (1), `LibraryMap.jsx` (2)
- All replace the canonical inline pattern (`text-[9px] font-mono uppercase tracking-[0.18em]` or `font-mono text-[9px] uppercase tracking-[0.18em]`) with the `.eyebrow-mono` utility. Per design-vocabulary.md, the utility renders 8px / tracking-0.18em on mobile, 9px / tracking-0.24em at md+. Net effect: responsive scaling + bolder (700) weight that reads more on-brand.

**locs allowlist:** `src/pages/Library.jsx` bumped to a 1600-line ceiling with a Phase 6 decomposition target (extract a `useBulkSelection` hook + `useLibraryLayout` hook). The page is 1508 LOC after Phase 2C's Comparisons tab + 2D's saved-count fetcher; orphan conversion already lives in `lib/orphanConversion.js` so the remaining bulk is the bulk-ops handlers.

**Deferred (intentional, called out in roadmap):**
- **LensTour `role="dialog"` migration** — the two hand-rolled "dialogs" in LensTour.jsx are genuinely anchored tooltips, not true modals. Radix Dialog would break the anchor positioning. Better aria props could be added in Phase 6 alongside the broader audit-ui sprint.
- **axe-core test wiring** — installing `@axe-core/playwright` + writing the 4-page assertion is meaty enough to belong in Phase 6's audit-ui hardening sprint, where it can be added alongside the cron-runs latency monitor and the cross-browser sweep.
- **~200 remaining eyebrow patterns** — admin/*, marketing/static pages, lower-frequency Lens panels (CsMarketPanel, RegulatoryActivityPanel, SolarCostLineagePanel, etc.). The sweep landed everywhere a user spends meaningful time; the long tail is a Phase 6 batch-replace task.

**Verification (close of session):**
- `npm run test:unit` — 129/129 green
- `npm run build` — clean (2.92s)
- `npm run test:smoke` — 7/7 green
- `npm run lint:locs / lint:api / lint:secrets` — clean

---

### Session 2026-05-12 (continued) — TRACTOVA-UX-001 Phase 2C shipped

Phase 2C closes the Library cockpit rebuild. Save the comparison, share the PDF, re-run with one click and write the new scores back, convert exploration scenarios into projects without a Lens detour.

**Migration (FILE only — Aden applies):**
- `supabase/migrations/062_saved_comparisons.sql` — `saved_comparisons (id, user_id, name, item_ids text[], snapshot jsonb, created_at, updated_at)` + `touch_updated_at()` trigger + four own-rows RLS policies (matches scenario_snapshots pattern from migration 041). Snapshot column freezes the compare items so the report renders identically months later even if state/county data drifts — the Modal's existing drift-refresh reconciles at open-time.

**New files:**
- `src/lib/savedComparisons.js` — save/list/load/rename/delete helpers around the new table. Fail-soft (returns null/[] when migration not applied yet or RLS denies) so saved-comp failures never break the draft (localStorage) layer of CompareContext.
- `src/lib/orphanConversion.js` — Supabase-side of orphan→project promotion. Computes the live composite the same way Library cards do, inserts the projects row, attaches every scenario in the group via `scenario_snapshots.project_id`, logs a `created` audit event.
- `src/components/CompareReportPDF.jsx` — `@react-pdf/renderer` doc, A4 landscape for 3+ projects (portrait for ≤ 2 to avoid whitespace). Mirrors the in-app Compare modal row groups (§ 01 Composite / § 02 Project) and best-for / AI-summary pull-blocks. Lazy-loaded by CompareTray on Export PDF click — bundle weight only paid by users who actually export.
- `src/components/library/SavedComparisonsList.jsx` — new Library tab. Lists saved comparisons newest-first, each with Open / Rename / Delete. Open hydrates CompareContext from the snapshot via `tractova:load-compare` and opens the modal.
- `scripts/probe-saved-comparisons.mjs` — diagnostic probe (mirror of `probe-policy-impact.mjs`). Confirms table existence, RLS policy presence, per-user distribution, and most-recent 5 rows. Aden runs this after applying migration 062 to verify live state.

**Modifications:**
- `src/context/CompareContext.jsx` — added `load(snapshotItems)` to hydrate the tray from a saved comparison snapshot wholesale (replaces the current draft instead of appending — a saved comparison is a research artifact, not a continuation).
- `src/components/CompareTray.jsx` — Modal header gets "Save as…" (Radix Dialog → POST to `saved_comparisons`) and "Export PDF" (lazy import of CompareReportPDF, blob download). Also listens for the new `tractova:load-compare` event so Cmd-K and Library can both hydrate the tray from a saved row.
- `src/lib/commandParser.js` — `:compare` verb now takes `savedComparisons` from ctx and emits a `load-compare` action per saved row (filterable by name fragment: `:compare bess` narrows to comparisons whose name contains "bess"). Tests cover the new shape (+2 cases, 129 total).
- `src/components/CommandPalette.jsx` — fetches saved comparisons on sign-in, threads them through parserCtx, and handles the new `load-compare` action by dispatching `tractova:load-compare` with the saved id.
- `src/pages/Search.jsx` — three Phase 2C layers on top of the Pass 5 `?fromProject=` baseline:
  - **Auto-kickoff**: once the project is fetched + form hydrated, the form auto-submits (shared `autoSubmitFired` ref with the URL-param path so we never double-fire).
  - **Drift banner**: above the results header, shows composite delta + CS/IX status changes vs the project's stored baseline (last_observed_score or opportunity_score). Color-codes by direction (teal up / amber down / navy steady).
  - **Save updates back**: button on the banner writes `opportunity_score`, `last_observed_score`, `cs_status`, `cs_program`, `ix_difficulty`, `serving_utility` to the projects row, logs a `score_change` audit event when |delta| ≥ 5, and flips the button to "✓ Saved back".
- `src/components/ProjectCard.jsx` — adds "Re-run with latest data" CTA next to "Re-Analyze in Lens" in the expanded card's action footer (Cards + Table view inherit). Routes to `/search?fromProject=<id>` which lights up the auto-kickoff + drift flow.
- `src/components/ScenariosView.jsx` — adds "Convert to project →" CTA on every orphan group. Calls back to Library which runs `convertOrphanGroupToProject()` + optimistic state migration (group moves from orphan list into the new project's scenarios map).
- `src/pages/Library.jsx` — third top-level tab (Projects | Scenarios | Comparisons), URL handler for `?tab=comparisons`, wires SavedComparisonsList + onConvertOrphan. Conversion handler kept tight (~10 lines) by delegating Supabase work to `lib/orphanConversion.js`.

**Verification (close of session):**
- `npm run test:unit` — 129/129 green (127 prior + 2 new for `:compare` saved-list shape)
- `npm run build` — clean (2.61s, no warnings; INEFFECTIVE_DYNAMIC_IMPORT resolved by moving `loadSavedComparison` to a static import in CompareTray)
- `npm run test:smoke` — 7/7 green
- `npm run lint:locs / lint:api / lint:secrets` — clean (Library.jsx stayed under the 1500 LOC budget because `orphanConversion.js` carries the heavy supabase logic)
- CompareReportPDF chunk: **10.7 KB gzipped** (lazy-loaded; only fetched on Export PDF click)

**Aden's manual follow-up (CLAUDE.md §1.1 — migrations are FILE-only for Claude):**
1. Open the Supabase SQL editor, paste `supabase/migrations/062_saved_comparisons.sql`, run.
2. `node scripts/probe-saved-comparisons.mjs` — verify the four RLS policies + zero rows.
3. Open the app, add 2–3 projects to Compare, click Save as… → enter a name → expect a Library tab "Comparisons" entry.
4. Try `⌘K → :compare`, then `⌘K → :compare <fragment>` for the filter narrowing.
5. From a saved Library project, click "Re-run with latest data" → expect the drift banner with the correct baseline (or "no material drift" if the state hasn't moved).

---

### Session 2026-05-12 — Audit-pass cleanup (5 passes shipped, post-Phase-2B QA)

After Phase 2A + 2B landed, ran two parallel agent audits (UI/UX consistency + Vercel perf) and shipped the punch-list as five thematic passes. Plus map polish based on real user feedback (pulse contrast, halo gating, flicker on zoom/scroll).

**Commits in chronological order:**

| Sha | What |
|---|---|
| `a9b8e7a` | Map pulse stays visible on same-color states (navy drop-shadow glow filter so teal pin on teal state still reads) |
| `277cee4` | Pin halo only on hover (was always-visible "stagnant pulse") + Pass 1 brand-vocab hygiene |
| `b309e8e` | Pass 2 perf wins: glossary data extracted, LibraryMap + IntelligenceBackground + WalkingTractovaMark lazy-loaded |
| `f186f2a` | Pass 3 animation discipline: useSpring → cubic-bezier tween in ArcGauge/MiniArcGauge/SubScoreBar; ProjectTable RAF → CSS transition + motion.animate; per-row score+alerts hoisted to useMemo |
| `fa02fbe` | Pass 4 structural: Nav dropdown → Radix DropdownMenu; sticky-stack collision (bulk toolbar offsets `top-[7rem]` in Table layout); ProjectTable row `<button>` → `<div role="button">` to fix nested-button HTML; pagination disabled-state cleanup; focus-visible rings |
| `f397340` | Pass 5 Phase 2C prereq + a11y: `?fromProject=` handler in Search.jsx (form pre-fill + "Re-run of X" pill) + CommandPalette input focus-visible ring |
| `(this commit)` | Map flicker fix: dropped `lib-map-state-shadow` SVG filter (SVG filters force CPU rasterization on every paint — primary flicker source on scroll/zoom); collapsed triple-stacked gradient backdrop → single linear gradient; Geography `transition-all` → `transition-colors` (transition-all was animating SVG transform on zoom); graticule `strokeDasharray="2 4"` → solid lines (dashed strokes at 0.5px shimmer on sub-pixel zoom); promoted map container to its own GPU compositor layer (`transform: translateZ(0)` + `willChange: transform`) |

**Bundle deltas across the audit passes (gzip):**
- Main `index`: 79.3 KB → 75.4 KB
- Library chunk: 65 KB → 38 KB (lazy LibraryMap was the big win)
- Glossary: inlined → 10 KB lazy chunk
- Build warning `INEFFECTIVE_DYNAMIC_IMPORT` resolved

**Verification baseline at audit-close:**
- `npm run test:unit` — 127/127 green
- `npm run build` — clean (~2.6s, no warnings)
- `npm run test:smoke` — 7/7 green
- `npm run lint:locs / lint:api / lint:secrets` — clean

---

### Audit punch list (closed)

#### Pass 1 — brand-vocab hygiene (`277cee4`)
- ✅ Inter font dropped from `--font-sans` and `html { font-family }`; replaced with system-sans stack (`system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`). The design-vocabulary.md anti-pattern banned Inter explicitly.
- ✅ Green-for-good chips in `MarketIntelligenceSummary.jsx:188, 215` → teal. Doc says "Never use green for 'good.'"
- ✅ Glassmorphism dropped on `CmdKHint.jsx` (was `backdropFilter: blur(6px)` + translucent white).
- ✅ Violet `#7C3AED` swapped for teal/navy/amber in 2 sites: `LibraryMap.jsx` filtered-state polygon + pill → deeper teal `#134E48`; `CommandPalette.jsx kindColor('glossary')` → amber-700 `#B45309`.
- ✅ Stale "2B" badge removed from LibraryToolbar Map button (Phase 2B shipped).
- ✅ Empty signed-out nav container wrapped in `{user && …}` (was creating a 28-44px gap between logo and sign-in buttons for anon visitors).

#### Pass 2 — perf wins (`b309e8e`)
- ✅ Glossary data extracted to `src/data/glossaryTerms.js`. Resolves the long-standing `INEFFECTIVE_DYNAMIC_IMPORT` build warning (CommandPalette was static-importing from `pages/Glossary`, forcing the page chunk into main).
- ✅ LibraryMap lazy-loaded via `React.lazy()` + Suspense fallback. Default layout is `'cards'` so the Map's heavy payload (react-simple-maps + topojson-client + 100KB centroids JSON) only loads when user picks Map. Library chunk **265 → 148 KB** (gzip **65 → 38 KB**).
- ✅ IntelligenceBackground + WalkingTractovaMark lazy-loaded. Both decorative; neither blocks Library hero LCP.

#### Pass 3 — animation discipline (`f186f2a`)
- ✅ `useSpring` swapped for `animate()` with cubic-bezier `[0.22, 1, 0.36, 1]` in:
  - `ArcGauge.jsx` (Lens composite gauge — number tween + fill curve, 900ms)
  - `MiniArcGauge.jsx` (Library Cards score readout, 850ms)
  - `SubScoreBar.jsx` (Lens panel sub-scores, 850ms)
  Design-vocabulary.md: "Never use bounce easing... [0.22, 1, 0.36, 1] for fills."
- ✅ `ProjectTable.jsx` TableScoreArc: hand-rolled RAF (~48 setStates × N rows = 2400+ React renders per mount) → CSS `transition: stroke-dasharray` (GPU compositor, zero React renders) for the arc + motion `animate()` for the number readout (one controller per row, motion batches across components).
- ✅ Per-row `computeSubScores` + `getAlerts` hoisted into `useMemo` in ProjectTable (was firing inline inside `.map()` on every render — now N×data-change instead of N×re-render).

#### Pass 4 — structural (`fa02fbe`)
- ✅ Nav user dropdown migrated to `@radix-ui/react-dropdown-menu ^2.1.16` (added explicit `package.json` peer). Was a hand-rolled `<div className="absolute ...">` with a mousedown outside-click listener — design-vocab anti-pattern. Radix portals to `<body>`, ships Esc + outside-click + focus-trap + keyboard nav.
- ✅ Sticky-stack collision: bulk-actions toolbar in Library.jsx and ProjectTable column header both targeted `top-14` → toolbar now offsets to `top-[7rem]` when `layout === 'table'`.
- ✅ ProjectTable row was `<button>` containing nested `<span role="checkbox">` — invalid HTML, screen readers only announced the outer button. Replaced row with `<div role="button" tabIndex={0}>` + explicit `onKeyDown` for Space/Enter.
- ✅ Pagination disabled state: removed generic `disabled:opacity-30`; the existing `color: atFirst ? '#9CA3AF' : '#0F1A2E'` branch already conveys disabled state in palette neutrals.
- ✅ `focus-visible:outline-2 outline-teal-600 outline-offset-2` added to Nav, Pagination chevrons, ProjectTable rows.

#### Pass 5 — Phase 2C prereq + a11y (`f397340`)
- ✅ `?fromProject=<id>` handler in `Search.jsx` — fetches the project (RLS-scoped), pre-fills form fields, shows a "Re-run of <name> · last saved Nd ago" pill above the form. The Cmd-K `:rerun` verb (Phase 1) and future Library "Re-run with latest data" button (Phase 2C) both land here. **The full Phase 2C scope (auto-run kickoff, drift comparison, "Save updates back to project" CTA) builds on top of this.**
- ✅ CommandPalette input got a focus-visible ring (was `outline-hidden` only).

#### Map QA fixes (across multiple commits, summarized)
- Pulse animation: SVG SMIL `<animate>` on `r` + `opacity` (motion-library scale shadowing was the original bug). Pulse renders on TOP of halo + dot. Cubic ease-out via `keySplines`.
- Pulse contrast: navy `feDropShadow` glow filter (`lib-pin-pulse-glow`) so the colored pulse stays visible even on same-color state fills.
- Halo gating: halo only renders when the pin is hovered (was always-visible, read as "stagnant pulse").
- Esc clears state filter when in Map view (and drawer isn't open).
- Double-click state = filter + switch to Table (force-set, not toggle — bypasses the two intermediate `onClick` events).
- Map background flicker (`this commit`): SVG filters removed from state polygons, gradient backdrop collapsed, Geography transition narrowed to colors only, graticule solidified, GPU layer promotion.

---

### Deferred (intentional, not in audit)
- **Eyebrow-mono utility sweep** — 60+ inline `text-[9px] uppercase tracking-[0.18em]` call sites flagged in audit P1 #8. The roadmap places this in Phase 3 (a11y + responsive sweep). Single-purpose diff worth its own session.
- **Server-side cursor pagination** — Perf audit #3. Only matters past ~500 projects per user. Client-side windowing already addresses the actual rendering pain; revisit if scale demands.
- **Sticky LibraryFilterRail** — Phase 2A leftover. Would collide with the sticky Table header at `top-14`. Filter strip is already adjacent to the list per earlier feedback so day-to-day value is low. Re-evaluate alongside Phase 3 a11y work.
- **`@react-pdf/renderer` bundle (1.4 MB / 483 KB gzip)** — lazy-loaded already. Perf audit's "honorable mention" was to consider server-side XLSX generation; out of scope until Phase 2C touches PDF/XLSX path.

**Phase 2B — shipped this session:**
- `scripts/generate-county-centroids.mjs` — one-time generator. Reads `node_modules/us-atlas/counties-10m.json`, converts each county feature via `topojson-client.feature`, computes area-weighted centroid via `d3-geo.geoCentroid`, writes `src/data/county_centroids.json` keyed by `${STATE}::${COUNTY}` → `[lon, lat]`. Spot-checked: 3,142 counties kept (3,136 after de-dupe of independent-city / county name collisions, mostly VA), 89 territories dropped, ~101 KB.
- `src/components/library/LibraryMap.jsx` — Bloomberg-style portfolio map. State coloring: **MW-weighted** average of saved-project live scores per state (distinct from Dashboard USMap's market-feasibility ramp; states without saved projects show muted slate). Pins at county centroids, colored by per-project score (teal ≥70 / amber ≥50 / red <50), sized by sqrt(MW) clamped 3.5–7.5px. **Clustering** above 200 pins by state-centroid bubble with sqrt-scaled radius + count label (keeps SVG node budget bounded). Hover tooltips for both states (count / MW / weighted-avg) and pins (name / location / score). Click state → filter + switch to Table. Click pin → open ProjectDrawer.
- `src/components/library/ProjectDrawer.jsx` — right-side slide-in (480px) using `@radix-ui/react-dialog`. Renders ProjectCard with `defaultExpanded` so the user lands on full project detail in one click. Motion: 220ms slide with `[0.16, 1, 0.3, 1]` ease-out, honors `useReducedMotion`. Esc + outside-click + X-button all close.
- `src/components/library/LibraryToolbar.jsx` — Map button unlocked (dropped the disabled + "2B" eyebrow).
- `src/pages/Library.jsx` — `layout` state extended to `'cards' | 'table' | 'map'`. `drawerProject` state for the slide-in. Pagination strip hidden in Map view (map shows all filtered projects regardless of page). State click in Map both filters and switches layout to Table so the user lands on the narrowed list.

**Sticky LibraryFilterRail deferred.** Would have collided with the sticky table header (both targeting `top-14`). Filter strip is already adjacent to the project list per earlier feedback, so the day-to-day value of sticky is low; the sticky table header is more useful. Deferred to a future phase rather than ship a fragile two-sticky-stack.

**Edge cases verified manually:**
- 0 projects → EmptyStateOnboarding renders (Map button isn't reachable; outer guard catches it).
- 1 project → 1 pin, 1 state lit. Single hover tooltip works.
- Filter narrows to 0 → "No projects match current filters" branch, Map doesn't try to render.
- Project with missing county → pin silently skipped (no off-map pin).
- Project in county not in centroids JSON → pin silently skipped.
- Click empty state (no projects) on map → no-op (gated on `hasProjects`).
- 200+ pins → clustering kicks in; each state shows one bubble with count.

**Verification baseline at Phase 2B close:**
- `npm run test:unit` — 127/127 green
- `npm run build` — clean (~4.6s)
- `npm run test:smoke` — 7/7 green
- `npm run lint:locs` — Library.jsx at 1404/1500 LOC, within budget
- `npm run lint:api / lint:secrets` — clean

**What's NEXT (Phase 2C — Saved comparisons + PDF + Re-run + Scenarios→Projects, ~15–20h):**
- Migration FILE `062_saved_comparisons.sql` (Aden applies in Supabase per CLAUDE.md §1.1)
- `lib/savedComparisons.js` — save/load/list; extends CompareContext (localStorage = draft, Supabase = saved)
- `CompareReportPDF` via `@react-pdf/renderer` (already in stack via ProjectPDFExport)
- `:rerun <project>` Cmd-K verb depends on this — Search.jsx needs `?fromProject=` handler
- "Convert to project" CTA on orphan scenarios in ScenariosView

---

## ARCHIVED Pickup — TRACTOVA-UX-001 Phase 2A SHIPPED (Slices 1 + 2) · resume Phase 2B (Library Map view)

**Resume command:** `Resume TRACTOVA-UX-001 Phase 2B. Read docs/TRACTOVA-UX-001-ROADMAP.md § 4 Phase 2B, then implement the Library Map view + sticky LibraryFilterRail.`

**Phase 2A Slice 2 — shipped this session (on top of Slice 1):**
- `src/components/library/StagePicker.jsx` — migrated from a hand-rolled `position: absolute` dropdown to `@radix-ui/react-popover`. Popover portals to <body> so the menu no longer clips against card bounds (design-vocab anti-pattern fixed). Outside-click, Esc, focus-trap, and keyboard nav now come from Radix.
- `package.json` — added `@radix-ui/react-popover ^1.1.15` (matches existing Radix peer versions). Already installed transitively via the `radix-ui` umbrella; now declared explicitly.
- `src/components/library/Pagination.jsx` — Bloomberg-styled pagination strip. Page-size selector (25 / 50 / 100), prev / next chevrons, "Showing X–Y of N" position indicator. Mono numerics + tabular-nums throughout.
- `src/pages/Library.jsx` — added client-side pagination of the rendered list. `displayProjects` (filter + sort result) is windowed via `pagedProjects = displayProjects.slice(...)`. Page-size persisted in localStorage as `tractova_library_page_size` (default 25). Page auto-resets on filter / sort change; clamps to last valid page when filter shrinks results below current window. Hidden `?all=1` URL flag bypasses pagination for power users.
- `src/components/ProjectCard.jsx` — removed `!expanded` guards on the "Updated" and "State ±X pt" chips so they persist when the card expands (previously dropped useful at-a-glance signals on expand).
- `src/pages/Library.jsx` — extended the "Recent Updates" portfolio banner to count state moves week-over-week in addition to existing updated-projects + alert counts. Banner is the portfolio-level roll-up of the per-card chips, visible in both Cards and Table layouts.

**Verification baseline at Slice 2 close:**
- `npm run test:unit` — 127/127 green
- `npm run build` — clean (~3.5s)
- `npm run test:smoke` — 7/7 green
- `npm run lint:locs` — within budget
- `npm run lint:api / lint:secrets` — clean

**Why no fetch-side cursor pagination?** Library's Pipeline Distribution + stat strip + score-change audit + bulk export all rely on having the full project set client-side. Server-side cursor pagination would have broken those portfolio-level signals. Client-side windowing of the *rendered* list addresses the actual perf pain (rendering 100+ cards/rows is slow) without breaking anything else. If users ever hit thousands of projects we can revisit with a server cursor + a separate aggregate-stats endpoint.

**What's NEXT (Phase 2B — Library Map view, ~10–14h):**
- `<LibraryMap>` using `react-simple-maps` + `us-atlas` — states colored by MW-weighted aggregate score; project pins at county centroids
- Build / ship `data/county_centroids.json` (generate from us-atlas)
- Click pin → `<ProjectDrawer>` slide-in from right (480px)
- Click state → filters Library to that state
- Sticky `<LibraryFilterRail>` (deferred from 2A — bigger restructure)
- Empty-state map with CTA when user has no projects
- Cluster pins above 200 with state-count badge

---

## ARCHIVED Pickup — TRACTOVA-UX-001 Phase 2A IN PROGRESS · Slice 1 shipped (view-mode toggle + Table) · Slice 2 next (pagination + filter rail + StagePicker Radix)

**Resume command:** `Resume TRACTOVA-UX-001 Phase 2A Slice 2. Read docs/TRACTOVA-UX-001-ROADMAP.md § 4 Phase 2A, then implement Slice 2 (pagination + sticky LibraryFilterRail + StagePicker Radix Popover migration + lifted "Updated" / "State ±X pt" chips).`

**Phase 2A Slice 1 — shipped this session:**
- `src/components/library/LibraryToolbar.jsx` — view-mode toggle (Cards | Table | Map). Map button visible but disabled with "2B" eyebrow + tooltip. Persistent count badge ("N projects").
- `src/components/library/ProjectTable.jsx` — Bloomberg-grid table. CSS-grid (not <table>) so row expansion preserves column widths. Sticky `top-14` navy header with mono caps. 28px static (non-motion) score arc per row. Single-dot amber alerts. Row click expands inline → renders existing ProjectCard (no Cards refactor). Bulk-select checkbox per row, stop-propagation on click. Tabular-nums on MW + Saved-relative date.
- `src/pages/Library.jsx` — `layout` state (`'cards' | 'table'`) persisted to localStorage as `tractova_library_view`. LibraryToolbar above the project list. Routes between Cards path (existing) and new ProjectTable based on `layout`. Bulk-select discoverability: per-card checkboxes now visible whenever `displayProjects.length > 1` (was: only after one already selected).

**Verification baseline at Slice 1 close:**
- `npm run test:unit` — 127/127 green
- `npm run build` — clean (~1.9s)
- `npm run test:smoke` — 7/7 green
- `npm run lint:locs` — Library.jsx still under 1,500 LOC budget
- `npm run lint:api / lint:secrets` — all clean

**What's NEXT (Phase 2A Slice 2):**
- Cursor pagination on `saved_at`, 25 / 50 / 100 page-size selector, hidden "Load all" (current Library fetches all projects at once — at 100+ rows this chokes)
- Sticky LibraryFilterRail (filters move from the current inline strip to a left rail that stays visible on scroll)
- StagePicker — replace hand-rolled absolute dropdown with `@radix-ui/react-popover` (currently can escape card bounds, design-vocab anti-pattern)
- Lift "Updated" + "State ±X pt" chips to a persistent header (visible expanded + collapsed across Cards + Table)
- Re-enable § 05 in Lens with bounded `CsMarketPanel` row sample (or move Operating Projects to Library cockpit)

---

## ARCHIVED Pickup — TRACTOVA-UX-001 Phase 1 SHIPPED (Cmd-K nav spine) · resume Phase 2A (Library cockpit)

**Read first after `/clear`:** `docs/TRACTOVA-UX-001-ROADMAP.md` § 0.1 DO-NOT-REPEAT LESSONS (critical motion-pattern gotchas from the OOM saga) + `docs/design-vocabulary.md` § Motion (height-auto hard rule). Plan mirror at `~/.claude/plans/if-the-dsire-api-dreamy-anchor.md`.

**Resume command:** `Resume TRACTOVA-UX-001 Phase 2A. Read docs/TRACTOVA-UX-001-ROADMAP.md including § 0.1 DO-NOT-REPEAT LESSONS, then implement Phase 2A per the plan.`

**Phase 1 — Cmd-K nav spine shipped this session:**
- `src/lib/commandParser.js` — verb grammar (`:lens <STATE> [<MW>] [<TECH>]`, `:portfolio`, `:scenarios`, `:compare`, `:gloss <TERM>`, `:state <ID>`, `:new`, `:rerun <project>`, `:help`). Pure module, 9 reserved verbs.
- `tests/unit/commandParser.spec.js` — 37 unit tests (verb gate, prefix match, MW+tech parsing, MA/MD/ME ambiguity, case-insensitivity, glossary/rerun/state/static-verb runners). All green.
- `CommandPalette.jsx` — verb-mode rendering, mono `:>` prompt indicator in verb mode, navy top-bar in verb mode (vs teal in fuzzy mode), Bloomberg status-line hint/error banner, per-user recents footer (last 5 from localStorage scoped to user.id, cap at 10), `Tab` autocompletes via `replaceQuery`, `Cmd+Enter` opens new tab.
- `CmdKHint.jsx` — fixed bottom-right ⌘K chip, idle fade to 32% after 5s, platform-aware label (`⌘K` / `Ctrl K` / `TAP`), auth-gated, 1px teal hairline. Mounted in App.jsx.
- `CompareTray.jsx` — listens for `tractova:open-compare` event (dispatched by `:compare` verb) and opens its modal when items > 0.
- Nav.jsx — audit confirmed existing 2px teal `border-bottom` on active route already satisfies §-style underline spec. No change.

**Verification baseline at Phase 1 close:**
- `npm run test:unit` — 127/127 green (90 prior + 37 new commandParser tests)
- `npm run build` — clean (1.55s); only pre-existing Glossary dynamic-import warning
- `npm run test:smoke` — 7/7 green
- `npm run lint:api / lint:secrets / lint:locs` — all clean

**What's NEXT (Phase 2A — Library Table view, ~12–15h):**
- View-mode toggle: Cards | Table | Map (persist in localStorage `tractova_library_view`)
- Bloomberg grid Table view, sticky filter rail, cursor pagination on `saved_at` (25/50/100)
- Re-enable § 05 in Lens with bounded `CsMarketPanel` row sample OR move Operating Projects to Library cockpit (where it belongs)
- Bulk-select visible whenever >1 projects; Shift-click range select
- Replace StagePicker absolute-positioned dropdown with Radix Popover
- Lift "Updated" / "State ±X pt" chips to persistent header

---

## ARCHIVED Pickup — TRACTOVA-UX-001 Phase 0 (3 OOM reverts)

**Read first after `/clear`:** `docs/TRACTOVA-UX-001-ROADMAP.md` § 0.1 DO-NOT-REPEAT LESSONS (critical motion-pattern gotchas from the OOM saga) + `docs/design-vocabulary.md` § Motion (height-auto hard rule). Plan mirror at `~/.claude/plans/if-the-dsire-api-dreamy-anchor.md`.

**Resume command:** `Resume TRACTOVA-UX-001 Phase 1. Read docs/TRACTOVA-UX-001-ROADMAP.md including § 0.1 DO-NOT-REPEAT LESSONS, then implement Phase 1 per the plan.`

**Phase 0 actual state (after revert chain):**
- ✅ `MotionPrimitives.jsx` — 5 primitives exported, NOT used anywhere (chassis only)
- ✅ `Skeleton.jsx` — branded loading states, NOT wired anywhere yet
- ✅ `CollapsibleSubsection.jsx` — standardized lightweight collapsible WITHOUT motion height animation (reverted to plain conditional render after OOM). Used by § 04 shadow pillar (the one visible adoption).
- ❌ PageTransition wrap on Routes — REVERTED (commit `238169a`). Caused OOM with the heavy Lens tree.
- ❌ § 05 Comparable Deals & Benchmarks — DISABLED (commit `4b183d0`). CsMarketPanel + heavy cs_projects rows triggered OOM.
- ✅ `.eyebrow-mono` CSS utility + `skeleton-shimmer` keyframe in `index.css` (CSS only, no consumers yet)
- ✅ `docs/design-vocabulary.md` + `docs/TRACTOVA-UX-001-ROADMAP.md` shipped

**Net user-visible from Phase 0:** subtle chevron animation on § 04 shadow pillar. Everything else is invisible chassis waiting for Phases 1-6.

**Session 2026-05-11 — PIE-001 completion + § 05 scaffolding + UI/UX overhaul plan + Phase 0 shipped.**

Major milestones this session:

1. **PIE-001 (Policy Impact Ecosystem) ships complete** — 7 phases across 10 commits. URL paste → AI classifier (tool-use, tier-aware) → multi-tier `policy_impact_events` rows; Scenario Studio base IRR adjusts for active high-conf policies; state feasibility composite includes 10% `policy_climate` sub-score; pillar card chips + § 04 shadow-pillar collapsible; 90 unit tests + scalability discipline locked.

2. **§ 05 Comparable Deals & Benchmarks** scaffolded — single SectionMarker banner with three subsections (◆ Operating Projects · ◆ Comparable Deals · ◆ Market Benchmarks). Always renders when state is valid; empty-state messages name what's missing.

3. **TRACTOVA-UX-001 plan locked + Phase 0 shipped** (commit `cfce269`):
   - 6 phases, ~93–129 hr total estimate
   - User direction (D-pad picks): Bloomberg Terminal spirit · Library cockpit first · push expressive motion · desktop-first
   - Phase 0 delivered: `MotionPrimitives.jsx` (PageTransition, RevealOnScroll, HoverLift, CountUp, GaugeFill — all reduced-motion-aware), `Skeleton.jsx` (branded loading states), `CollapsibleSubsection.jsx` (standardized lightweight collapsible), App.jsx Routes wrapped in PageTransition, index.css gets skeleton-shimmer keyframe + responsive `.eyebrow-mono` utility
   - LensComparablesSection + LensPolicyClimateSection migrated off hand-rolled toggles onto the shared CollapsibleSubsection
   - 90/90 unit tests still green

4. **Design vocabulary doc** (`docs/design-vocabulary.md`, commit `59a6b30`) — aesthetic taste calibration for Phases 1–6. Three voices (serif/mono/sans), 5 hue palette, 5 motion primitives, Cmd-K verb grammar, anti-patterns list, reference platforms ranked.

5. **Roadmap doc** (`docs/TRACTOVA-UX-001-ROADMAP.md`) — unified resume doc consolidating plan + design + status + pickup instructions.

**What's NEXT (Phase 1 — Cmd-K nav spine, ~10–14h):**
- `src/lib/commandParser.js` — `:lens <STATE> [<MW>] [<TECH>]`, `:portfolio`, `:scenarios`, `:compare`, `:gloss <TERM>`, `:state <ID>`, `:new`, `:rerun <project>`, `:help`
- `CmdKHint.jsx` — fixed bottom-right floating ⌘K cue on every page
- `CommandPalette.jsx` extended with verb parser + recent-actions footer
- `Nav.jsx` active-route gets §-style underline
- Killer feature: typing `:lens ME 5 CS` lands you on Lens results in two keystrokes

**Verification baseline at Phase 0 close:**
- `npm run build` clean
- `npm run test:unit` — 90/90 green
- audit-ui regression suite — 17/17 green (unchanged from PIE-001 close)

---

## ARCHIVED Pickup — Plan E COMPLETE: locs-allowlist EMPTY (Library + Admin + Search all under 1,500) + Axiom logging confirmed live → next: feature work (onboarding revamp queued)

**Sessions 2026-05-07 → 2026-05-08 (continuation through to early
morning, 11 commits).** Closed three open items end-to-end:

1. **Axiom HTTPS logging fully wired in production.** Diagnostic line
   surfaced in Vercel function logs → confirmed env vars were reaching
   functions. Root cause of "no events" was Vercel-serverless tearing
   down the function before the fire-and-forget fetch resolved. Made
   axiomLog awaitable + added `await` at all 10 callsites
   (`dfa36c3` + `c997fd6`). First production event landed
   2026-05-07 22:54:11; reliable thereafter. AXIOM_TOKEN row added
   to `docs/SECURITY_ROTATION_LOG.md` (annual cadence).

2. **Dependabot major-bump cleanup.** All 6 broken major-bump PRs
   auto-cleaned by Dependabot once `.github/dependabot.yml` blocked
   the wildcard major-version-bump pattern (`a7f99b5`). Merged the
   safe minor+patch group bump (`3127b6b`) — 6 deps bumped:
   anthropic-ai-sdk 0.91.1→0.95.1, react-pdf-renderer 4.4→4.5,
   supabase-js 2.103→2.105, stripe 22.0→22.1, postcss 8.4→8.5, vite
   8.0.10→8.0.11. All within-major; full verify chain green incl.
   smoke. npm-audit moderate count dropped 4 → 2 (one bumped dep
   cut a transitive ip-address chain branch).

3. **Plan E — final lint-locs ratchet.** All 3 page-level files
   tightened to under the 1,500 LOC global budget. Each sprint
   verified end-to-end (lint + locs + unit + build + smoke):

| Sprint | File | Before | After | Δ |
|---|---|---|---|---|
| E.1 (`7d11350`) | `src/pages/Library.jsx` | 2,704 | 1,215 | -55% |
| E.2 (`387834e`) | `src/pages/Admin.jsx`   | 1,914 | 603   | -69% |
| E.3 (`c08fed2`) | `src/pages/Search.jsx`  | 3,036 | 1,384 | -54% |
| **Total** | **3 page-level files** | **7,654** | **3,202** | **-58%** |

39 new component / helper files across `src/components/`,
`src/components/admin/`, `src/components/library/`.
**`scripts/locs-allowlist.json` `exceptions` array is now EMPTY** —
the entire codebase fits the global LOC budget without exceptions.
Future regressions get caught by `npm run lint:locs` in CI.

### What's in src/pages/ now (post Plan E)

| File | LOC | Notes |
|---|---|---|
| Search.jsx | 1,384 | Lens form + composite render; small inline helpers + page state |
| Library.jsx | 1,215 | Saved projects + Compare + scenarios tab |
| Admin.jsx | 603 | Tab router + shared inline helpers (Field, SaveBar, CopyButton, etc.) |
| Profile.jsx | ~720 | Subscription + cancel flow |
| Glossary.jsx | ~700 | Tier definitions + glossary terms |
| Landing.jsx | ~690 | Marketing |
| (others < 500) | | |

### Plan E summary — what was extracted

**Sprint E.1 → src/components/library/** (9 files):
ScoreGauge, PipelineProgress, StagePicker, CompareChip,
ShareDealMemoButton, UtilityOutreachButton (with private ContextRow
+ KitSection helpers), MiniArcGauge, WeeklySummaryCard,
EmptyStateOnboarding.

**Sprint E.2 → src/components/admin/** (12 files):
ComparableDealsTab, IXQueueTab, StagingTab, TestNotificationsTab
(the 4 inline tabs), MissionControl (with co-located UsageStat),
NwiCoverageCard, IxFreshnessCard, MonthlyCronCard, CurationDriftRow,
CsStatusAuditRow, IxStalenessAlert, CronLatencyPanel.

**Sprint E.3 → src/components/** (17 files):
SubScoreBar, RunIdMasthead, SectionMarker, CollapsibleCard,
CardDrilldown, RevenueStackBar, RevenueProjectionSection,
SolarCostLineagePanel, BriefDrilldown, LensScenarioRow,
CustomScenarioInline, CustomScenarioBuilder, LensOverlay (with
LENS_OVERLAY_STYLES const), FieldSelect, CountyCombobox,
AddToCompareButton, MaybeLensPanels (4 conditional wrappers
consolidated).

### Codebase health, end of arc

- **0 broken imports** (verified via `scripts/scan-bugs.mjs`)
- **0 orphan imports**
- **0 console.log drift in src/**
- **0 TODO/FIXME markers**
- **0 LOC budget breaches** — entire codebase fits the global rule
- **0 high-severity vulns** outside the 4 documented allowlisted CVEs
- **51 unit tests + 7 smoke + 16 mobile + 10 mobile-pro** all green
- **npm-audit moderate count: 2** (down from 4 at session start)

### Aden-side queue

**Empty.** Migration 060 applied; Vercel Log Drain (Axiom
equivalent) wired and confirmed; Dependabot major-bumps blocked +
cleaned up; minor/patch bumps merged.

### Resume-prompt suggestions

- *"Start the onboarding revamp per `~/.claude/plans/huly-onboarding-revamp.md`"* — the named feature item, deferred since Plan A/B closed
- *"Quarterly review of `scripts/audit-allowlist.json` (review_due 2026-08-06)"*
- *"Tighten api/lens-insight.js or send-alerts.js further"* — both already under their global 500 LOC budget but could go deeper

### Pre-existing pickup chain

(See prior pickup section below for the away-session fixes + Axiom debug arc.)

---

## Pickup (prior, 2026-05-07) — Away-session: mobile-UX tap targets fixed + 23 orphan imports removed → next: Vercel Log Drain debug (env var not reaching Production) or pick a feature direction

**Session 2026-05-07 (away-session, ~5 commits while Aden stepped
away).** Aden granted run-permission for diagnostics + safe fixes
explicitly excluding new code that breaks anything. Worked through:

### 1. Dependabot major-bump fix (`a7f99b5`)

Dependabot opened 7 PRs in the last cycle, 6 of which were breaking
major-version bumps (react 18→19, react-dom 18→19, react-router-dom
6→7, recharts 2→3, actions/checkout v3→v6, actions/setup-node v3→v6).
Each failed `npm install` and produced red preview deployments.

Updated `.github/dependabot.yml` with a wildcard
`update-types: ['version-update:semver-major']` ignore rule for
BOTH npm and github-actions update groups. Major upgrades now require
deliberate migration sprints, not drive-by Dependabot PRs.

### 2. Public → data folder move (`b0a44ed`)

Moved 28 raw research files (xlsx + pdf + csv) from `public/` to
gitignored `data/`. Verified zero URL references first (no
`<a href>`, `fetch()`, `<img src>` in src/). Updated 7 scripts
(probe-* + seed-cs-projects + seed-solar-cost-index + aggregate) to
read from `data/` instead. revenueEngine.js doc-comment paths
updated. Build dropped from 6.16s → 2.34s (Vite no longer scans
the 28 files in public/).

### 3. Axiom HTTPS-direct logging (`b752d11`)

NEW `api/lib/_axiomLog.js` (102 LOC) — fire-and-forget POST to
Axiom's HTTPS ingest API, silent fail-open if env vars not set.
Wired into 8 critical handler error paths (webhook, lens-insight,
4 cron handlers, send-alerts, send-digest, check-staleness).
Manual probe (`scripts/probe-axiom.mjs`) confirms Axiom-side
works (200 OK + event in Stream).

**KNOWN ISSUE (Aden side):** Vercel functions aren't yet reaching
Axiom — env var likely not scoped to Production environment, OR
the deploy needs a forced redeploy with cache off so the new
process.env.AXIOM_TOKEN value flows to running function instances.
Test via `curl -X POST https://www.tractova.com/api/webhook -H "stripe-signature: bogus" -d "test"` — should return
"Webhook Error: Unable to extract..." AND fire an axiom event
within 60s. If event doesn't appear, check Vercel → Settings →
Environment Variables → confirm both AXIOM_TOKEN + AXIOM_DATASET
are scoped to Production, then redeploy with "Use existing build
cache" UNchecked.

### 4. Mobile UX: 44px tap targets (`69aa3a2`)

NEW `tests/mobile-audit.spec.js` — deeper mobile audit beyond
overflow detection. Walks each route at 375px and reports tap
targets <44px (Apple HIG), fonts <12px (mobile readability),
text truncated without ellipsis. Saves screenshots to
`test-results/mobile-audit/` for visual review.

Initial audit found 60+ tap targets <44px on Landing/Preview, 186
on Glossary, 12 on Privacy/Terms. Fixed:
- Header (`src/components/Nav.jsx`) — Sign In + Get Started buttons
  bumped to explicit `min-h-[44px] inline-flex items-center`.
  Affects every route. Was 32px / 40px tall.
- Auth form submits (SignIn, SignUp, UpdatePassword) — `py-2.5` →
  `py-3` (40px → 44px tall).
- "Forgot your password?" inline link — added negative-margin'd
  vertical padding so hit area is 32×138px without changing the
  visible text size or layout.
- Glossary filter chips — `text-xs px-2.5 py-0.5` → `text-xs
  px-3 py-1.5` (22px → 32px tall).
- Glossary "see also" related-term buttons — added padding to
  expand hit area without disrupting inline-flex flow.

Remaining tap-target flags are mostly intentional design choices
(10px eyebrow labels on legal pages, inline body-text email links).
All 16 mobile + smoke + unit tests still green.

### 5. Static bug scan + 23 orphan imports removed (`1501988`)

NEW `scripts/scan-bugs.mjs` — read-only static scan flagging
broken imports, orphan imports, console.log drift, silent catches,
TODOs, useEffect with no dep array. Run via `node scripts/scan-bugs.mjs`.

Initial scan results:
- 0 broken imports ✓
- 0 console.log drift in src/ ✓
- 0 TODO/FIXME markers ✓
- 8 silent catches (verified intentional best-effort JSON parse
  patterns in AI-response handlers)
- 23 orphan imports — all leftovers from Sprint 2.3 decomposition

Removed all 23 orphans (verified by grep — each truly single-
occurrence in its file):
- `src/pages/Search.jsx` (16): CoverageBadge, TractovaLoader,
  motionAnimate, entire scoreEngine line (5 imports), 8 from
  revenueEngine line (kept computeRevenueProjection + hasRevenueData
  which are still referenced)
- `src/pages/Library.jsx` (1): TechLabel
- `src/components/shadcn/ui/{badge,card}.jsx` (2):
  `import * as React` — redundant under Vite + React 18 auto-JSX
- `src/components/ui/{Input,Select,Toggle}.jsx` (3): `import React`
- `src/components/WalkingTractovaMark.jsx` (1): useRef

Build dropped from 2.90s → 1.85s after the cleanup.

### Aden-side queue when back

1. **Axiom Log Drain** — debug Vercel-side env var scoping (likely
   AXIOM_TOKEN or AXIOM_DATASET not on Production environment, OR
   running function instances haven't been cold-restarted since env
   vars were added). Force redeploy with "Use existing build cache"
   UNchecked, then re-test via the curl above.
2. **Close 6 Dependabot major-bump PRs** in GitHub UI — comment
   `@dependabot close` or click "Close pull request". Future runs
   won't re-open them now that .github/dependabot.yml blocks
   major-version bumps wildcard.

### Resume-prompt suggestions

- *"Debug the Axiom env-var scoping then re-test"*
- *"Close the 6 dependabot major-bump PRs"*
- *"Start the onboarding revamp per ~/.claude/plans/huly-onboarding-revamp.md"*

### Pre-existing pickup chain

(See prior pickup section below for Plan D cleanup sweep.)

---

## Pickup (prior, 2026-05-06) — Plan D cleanup sweep DONE (post-Plan-C dedupe + dead code + file hygiene) → next: pick a feature direction (onboarding revamp, public/data folder cleanup, or new work)

**Session 2026-05-06 (continuation, post Plan C).** After Plan C
Phase 2 closed (5 mega-files decomposed + 4 API files tightened),
two read-only Explore agents scanned for leftover cleanup
opportunities. Headline: **data integrity 9.5/10** (zero schema
drift, zero migration issues, zero cron drift, allowlists in sync).
Cleanup wins were mostly dedupe / dead code / file hygiene —
shipped in 4 short commits.

### What shipped this continuation (4 commits)

**D.1 (`f01b425`)** — Per-state `console.log` spam removed from 2
cron handlers (refresh-capacity-factors logged 50× per quarterly run;
refresh-substations logged 50× per monthly run, no operational
signal). Aggregate completion logs preserved. Audit-agent A also
flagged unused `applyCors` imports + an "unused" `IX_LABEL` export,
but verification showed both claims false — no change there.

**D.2 (`bb160a3`)** — Consolidated `supabaseAdmin` instantiation.
18 inline `createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`
calls → 1 shared module. NEW `api/lib/_supabaseAdmin.js` (single
source). `api/lib/_aiCacheLayer.js` + `api/scrapers/_scraperBase.js`
re-export so callers that already imported from those base modules
keep working unchanged. 16 inline-instantiating files updated to
import from the new shared module. Net diff: -57 lines. Confirmed
`createClient(` no longer appears anywhere in `api/` outside the new
`_supabaseAdmin.js`. Behavior unchanged — Vercel Functions reuse
module instances under Fluid Compute, so consolidating to one client
per cold-start is the right shape (the 18 separate clients were
operationally equivalent).

**D.3 (`b7b5198`)** — Consolidated display labels. NEW
`src/lib/statusMaps.js` exporting `IX_LABEL` + `CS_STATUS_LABEL`,
the canonical chip-label maps. 5 src files updated:
`src/lib/exportHelpers.js`, `src/components/CompareTray.jsx`,
`src/components/ProjectPDFExport.jsx` drop their inline IX_LABEL
const + import from statusMaps. `src/pages/Library.jsx` replaces
two `export const X = {...}` with a single
`export { IX_LABEL, CS_STATUS_LABEL } from '../lib/statusMaps.js'`
re-export — ProjectCard.jsx imports from Library.jsx still resolve.
Local intentional deviations preserved + documented:
- ProjectPDFExport's verbose `CS_STATUS_LABEL` (`'Limited Capacity'`,
  `'Pending Launch'`, `'No Program'`) stays local — PDF-specific
  offline-readable copy.
- exportHelpers + CompareTray's `CS_LABEL` (uses `'None'` instead
  of canonical `'Closed'`) stays local — workbook + compare-tray
  brevity convention.
- Rank constants (`STATUS_RANK`, `IX_RANK`) stay local — each
  consumer needs different sort semantics (alertHelpers ranks
  easiest-first to detect "got worse"; Search.jsx peer-comparison
  ranks easiest-highest for "good vs bad" tone).

**D.4 (`5cc5db7`)** — File hygiene. 12 untracked files committed:
9 probe scripts (probe-atb, probe-cs-projects, probe-ix-staleness,
probe-phase-b, probe-sharing-the-sun, probe-sharing-the-sun-full,
probe-state-programs-stale, probe-status-state, probe-tts), plus
scripts/site-walk.mjs + docs/site-walk-checklist.md. Aden's product
review notes "Full Manual Site Review.md" archived to
`docs/archive/site-review-2026-05-03.md` alongside the V2/V3
plan archives. lint:secrets coverage: 226 → 307 tracked files.

### Out of scope (deferred per plan)

- **25 raw research files in `public/*.xlsx,pdf,csv`** (EIA-860,
  NREL ATB, Sharing the Sun, uspvdb, etc.) — moving to a gitignored
  `data/` folder would require a full-tree grep first to verify no
  `<a href="/EIA-860 Form.xlsx">`-style URL references. Skipped this
  sprint until verified. Vercel serves /public at root.
- **Email-frame builder consolidation** (would dedupe ~45 LOC
  across 3 production email paths — ROI lower than the wins above).
- **`daysSince()` cross-API/src dedupe** — architectural separation
  between api/ and src/ kept on purpose.

### Resume-prompt suggestions

- *"Verify public/*.xlsx aren't URL-referenced anywhere, then move them to a gitignored data/ folder"*
- *"Start the onboarding revamp per ~/.claude/plans/huly-onboarding-revamp.md"*
- *"Configure Vercel Log Drain destination per docs/runbooks/observability.md"*

### Pre-existing pickup chain

(See prior pickup section below for Plan C COMPLETE detail.)

---

## Pickup (prior, 2026-05-06 evening) — Plan C COMPLETE (Phase 0 + Phase 1 + all 6 Phase 2 sprints) → next: pick a follow-up direction (onboarding revamp, ratchet decomposition further, or new feature work)

**Session 2026-05-06 (full arc, day's work).** Plan A (8/8) + Plan B
(8/8) verified at session start; then closed the cheap-five audit
follow-ups; then proposed + executed Plan C end-to-end across this
single session. Final state: Security ~9.3 / Engineering ~9.0, every
claim tied to a verifiable signal.

### Plan C Sprint 2.6 (`1e5bad5`) — final sprint, three deliverables

(1) NEW `scripts/lint-locs.mjs` + `scripts/locs-allowlist.json` — CI
gate preventing file-size regressions on most-edited surfaces. Mirrors
the audit-check.mjs ratchet pattern: global budgets (1,500 LOC for
`src/pages/*.jsx`, 500 LOC for top-level `api/*.js`) + an allowlist of
7 documented exceptions with explicit ceilings + decomposition
targets. New files must stay under the global budget; allowlisted
files can't grow beyond their ceiling. Wired into `npm run verify`
and `.github/workflows/verify.yml`. 29 files checked, 7 allowlisted,
0 breaches.

(2) NEW `docs/architecture.md` (217 LOC) — one canonical view of the
module tree (api/, src/pages, src/components, src/components/admin,
src/lib, scripts, tests, docs) + Plan C Phase 2 decomposition history
table + cron schedule reference + verify-gate sequence + "where to
look for what" lookup table. Documented staleness rule at top so
future drift is visible.

(3) JSDoc on high-leverage exports — engine layer (scoreEngine,
revenueEngine, scenarioEngine entry points) + every new helper from
Sprints 2.3-2.5 (lensHelpers, alertHelpers, exportHelpers,
markdownRender, adminHelpers, formatters). Param + return shape now
hover-visible in any modern editor. Cheap halfway point to TS — no
runtime cost, big readability win.

### Plan C — full final state

| Phase | What | Result |
|---|---|---|
| 0 | Allowlist-aware audit + secret-scan parity + dependabot + rotation log | ✅ `1a9d1a8` |
| 1 | CSP + COOP/COEP/CORP + rate limits + webhook idempotency + observability + auth.users | ✅ `b8f5e5f` (+ `948d920` for the cdn.jsdelivr.net CSP fix on the dashboard map) |
| 2.1 | refresh-data.js → 10 scrapers | ✅ `5aa2b82` |
| 2.2 | lens-insight.js → 9 prompts + cache | ✅ `1640587` |
| 2.3 | Search.jsx → 6 panels + helper | ✅ `3aeb02d` |
| 2.4 | Library.jsx → 5 components + helpers | ✅ `1154913` |
| 2.5 | Admin.jsx → 6 tabs + helpers | ✅ `2ea5f3b` |
| 2.6 | Architecture docs + JSDoc + lint-locs | ✅ `1e5bad5` |

### Final rating

| Dimension | Start of session | End of session | Delta |
|---|---|---|---|
| Data security | 8.0 | **~9.3** | +1.3 — auth-bypass closed, CORS pinned, rate limits live, webhook idempotency, CSP + cross-origin headers, allowlist-aware audit, CI/pre-commit secret-scan parity, backup posture validated end-to-end including auth.users |
| Engineering | 6.5 | **~9.0** | +2.5 — 5 mega-files (16,768 LOC) decomposed to 8,821 LOC across api/scrapers/, api/prompts/, api/lib/, src/components/, src/components/admin/, src/lib/. 51 unit tests, 7 smoke tests, lint:locs CI gate, architecture map, JSDoc on hot exports |

**Total: 9 commits across this single session.** Every commit
verified end-to-end (lint + audit + secrets + locs + unit + build +
smoke). No regressions surfaced.

### Aden-side queue (carried; nothing new from Sprint 2.6)

1. Configure **Vercel Log Drain** destination per
   `docs/runbooks/observability.md` (~10 min in Vercel dashboard,
   free tier on Better Stack or Axiom). Record token in 1Password.
2. Re-install pre-commit hook on any fresh clone:
   `node scripts/install-git-hooks.mjs`.

### Possible next directions

- **Onboarding revamp** — original Plan A/B follow-up; in
  `~/.claude/plans/huly-onboarding-revamp.md`. Now natural to pick up
  given Plan C is done.
- **Ratchet decomposition further** — the 7 allowlisted files in
  `scripts/locs-allowlist.json` each have a target ceiling; tightening
  one per sprint keeps the file-size pressure visible.
- **Path-2 ground truthing** — money/relationship spend (LevelTen
  data, developer survey), not engineering. Separate plan.
- **New feature work** — clean foundation for whatever's next.

### Resume-prompt suggestions

- *"Configure Vercel Log Drain per the observability runbook, then
  start the onboarding revamp"*
- *"Tighten the lint-locs ceilings for the over-budget files
  (start with api/lens-insight.js — extract handlers to api/handlers/)"*
- *"Pick up [whatever feature you have queued]"*

### Pre-existing pickup chain

(See prior pickup section below for Sprints 2.1-2.5 detail.)

---

## Pickup (prior, 2026-05-06 evening) — Plan C Sprints 2.1–2.5 shipped (~16,000 LOC decomposed; +CSP-fix for dashboard map) → next: Sprint 2.6 (architecture docs + JSDoc + lint-locs budget gate) — last sprint of Phase 2

**Session 2026-05-06 (continuation, sprints 2.4 + 2.5).** Pushed two
more sprints + caught a real CSP regression Aden surfaced
("preview website dashboard map does not show up").

### What shipped this continuation (3 commits)

**Sprint 2.4 (`1154913`)** — `src/pages/Library.jsx` (4,379 LOC) → 5
components + 4 helper modules. Function bodies copied
character-for-character; smoke 7/7. NEW
`src/components/{AlertChip,ProjectAuditTimeline,ScenariosView,
ProjectCard,YourDealSection}.jsx`. NEW
`src/lib/{alertHelpers,exportHelpers,formatters}.js` + NEW
`src/lib/markdownRender.jsx` (.jsx because the helpers return JSX
elements; vite-plugin-react only transforms .jsx by default).
Library.jsx shrinks to 2,703 LOC (-38%). Several inline helpers
(StagePicker, CompareChip, ShareDealMemoButton, UtilityOutreachButton,
MiniArcGauge, ScoreGauge, PipelineProgress, plus IX/CS_STATUS style
constants) gained `export` keywords for the new components to import.
Side cleanup: stripped unused imports left over from earlier
refactors.

**Sprint 2.5 (`2ea5f3b`)** — `src/pages/Admin.jsx` (3,425 LOC) → 6
tabs + helpers. NEW `src/components/admin/{StateProgramsTab,
CountiesTab,RevenueRatesTab,NewsFeedTab,PucDocketsTab,DataHealthTab}.jsx`
in a dedicated subdirectory (more numerous than Search/Library
extractions, so a subdir is cleaner). NEW `src/lib/adminHelpers.js`
(69 LOC) with endpointStatus + buildReportText + daysSince +
freshnessColor pure helpers. Admin.jsx shrinks to 1,914 LOC (-44%).
ComparableDealsTab + IXQueueTab + StagingTab + TestNotificationsTab
left inline (their state shape is more interlinked; not worth
disturbing in this sprint). Inline helpers (Field, ReadOnlyCell,
SaveBar, Badge, plus all the DataHealth sub-cards) gained `export`
keywords for the tab files to import.

**CSP fix for dashboard map** (rolled into Sprint 2.5 commit):
Aden flagged that the preview-website Dashboard map wasn't
rendering. Root cause: the strict CSP shipped in Phase 1 (commit
`b8f5e5f`) locked `connect-src` to only Supabase / Anthropic /
Stripe / Resend — but `src/components/USMap.jsx:5` fetches its
topojson from `https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json`
via the react-simple-maps `<Geographies geography={url}>` flow, which
goes through `connect-src` (it's an XHR, not an `<img>` or
`<script>`). Added `https://cdn.jsdelivr.net` to the connect-src
allow-list in `vercel.json`. Will roll out on the next
deploy-to-prod via push to main.

### Updated rating — engineering progressing

| Dimension | Before continuation | After continuation | Evidence |
|---|---|---|---|
| Engineering | ~8.3 | **~8.7** | All 5 mega-files now decomposed (refresh-data 2,493→163, lens-insight 1,366→1,003, Search 5,105→3,038, Library 4,379→2,703, Admin 3,425→1,914 = 16,768 → 9,821 LOC across the page+API monoliths). Modules in `api/scrapers/`, `api/prompts/`, `api/lib/`, `src/components/admin/`, plus 7 new helpers in `src/lib/`. Sprint 2.6 (docs + JSDoc + lint-locs CI budget gate) is the last engineering work to claim 9. |
| Data security | ~9.3 | ~9.3 | CSP fix is restoration to intended behavior, not a posture change. Still allowlist-aware on `npm audit`; rate limits live; webhook idempotency live; CI/pre-commit secret-scan parity. |

### Phase 2 — remaining (one sprint)

| Sprint | Scope | Effort | Status |
|---|---|---|---|
| 2.1 | refresh-data.js → 10 scrapers | 1-2 days | ✅ |
| 2.2 | lens-insight.js → 9 prompts + cache | ~0.5 day | ✅ |
| 2.3 | Search.jsx → 5 panels + hook | 2-3 days | ✅ |
| 2.4 | Library.jsx → cards + helpers | 1 day | ✅ |
| 2.5 | Admin.jsx → 6 tabs + helpers | 1 day | ✅ |
| 2.6 | Architecture docs + JSDoc + lint-locs budget gate | ~1 day | ⏳ next |

### Resume-prompt suggestions

- *"Start Plan C Sprint 2.6 — architecture docs + JSDoc + lint-locs"*
- *"Configure Vercel Log Drain destination per docs/runbooks/observability.md, then continue Sprint 2.6"*

### Pre-existing pickup chain

(See prior pickup section below for Phase 0 + Phase 1 detail.)

---

## Pickup (prior, 2026-05-06 mid-day) — Plan C Sprints 2.1 + 2.2 + 2.3 shipped (8,964 LOC decomposed across 3 commits) → next: Sprint 2.4 (Library.jsx → cards + helpers)

**Session 2026-05-06 (continuation).** Aden applied migration 060 +
asked to move on. Pushed Plan C Phase 2 forward by three sprints in
one session — half the engineering decomposition arc complete.

### What shipped this continuation (3 commits)

**Sprint 2.1 (`5aa2b82`)** — `api/refresh-data.js` (2,493 LOC) → 10
scrapers + thin orchestrator. NEW `api/scrapers/_scraperBase.js` (211
LOC) holds the shared utilities (supabaseAdmin, censusFetch,
applyStaleTolerance, logCronRun, FIPS_TO_USPS, BRACKET_UPPER/LOWER,
normalizeCountyName, fetchArcgisPaged). Each scraper extracted to its
own `_refresh-{source}.js` file (lmi, state-programs, county-acs,
news, revenue-stacks, energy-community, hud-qct-dda, nmtc-lic,
geospatial-farmland, solar-costs). Private helpers stay local where
single-consumer (RSS parsing in news, ssurgoQuery in
geospatial-farmland, ttsAssignTier in solar-costs). Orchestrator
shrinks 2,493 → 163 LOC. Side win: `scripts/lint-api.mjs` upgraded to
recurse into `api/**/*.js` (was scanning top-level only) — 13 files →
26 files lint coverage.

**Sprint 2.2 (`1640587`)** — `api/lens-insight.js` (1,366 LOC) → 9
prompts + cache module + thin handler. NEW `api/prompts/{system,
portfolio,compare,sensitivity,scenario-commentary,news-summary,
deal-memo,utility-outreach,classify-docket}.js` — one file per
prompt template. Template literals copied byte-for-byte (whitespace +
line breaks matter for LLM-tuned prompts). NEW
`api/lib/_aiCacheLayer.js` (77 LOC) — buildCacheKey, cacheGet,
cacheSet, dataVersionFor; reusable for any future AI feature.
Scenario-shape helpers (SCENARIO_INPUT_UNITS, describeScenarioDeltas,
formatScenarioOutputs) co-located with the scenario-commentary
prompt. lens-insight.js shrinks 1,366 → 1,003 LOC; still holds the
10 routed handlers + buildContext + parseInsightResponse + the
two-tier rate-limit block from Phase 1.3.

**Sprint 2.3 (`3aeb02d`)** — `src/pages/Search.jsx` (5,105 LOC) → 6
panels + helper. The largest decomposition. Function bodies
character-for-character preserved. NEW
`src/components/ArcGauge.jsx` (149 LOC, AnimatedScoreText helper +
ArcGauge default export). NEW
`src/components/MarketPositionPanel.jsx` (374 LOC). NEW
`src/components/SiteControlCard.jsx` (307 LOC). NEW
`src/components/InterconnectionCard.jsx` (222 LOC). NEW
`src/components/OfftakeCard.jsx` (589 LOC — the largest). NEW
`src/components/MarketIntelligenceSummary.jsx` (339 LOC). NEW
`src/lib/lensHelpers.js` (142 LOC, generateMarketSummary). Search.jsx
shrinks 5,105 → 3,038 LOC (-40%). Several inline helpers
(CollapsibleCard, CardDrilldown, SectionLabel, DataRow, badges,
RevenueStackBar, RevenueProjectionSection, SolarCostLineagePanel,
BriefDrilldown) gained `export` keywords because the new panels
import them — circular import is safe (references are inside
function bodies, not module top-level). Verified by Playwright smoke
hitting the actual populated Lens flow: 7/7 pass in 13.5s.

### Updated rating — engineering progress measurable

| Dimension | Before continuation | After continuation | Evidence |
|---|---|---|---|
| Engineering | 7.5 | **~8.3** | API mega-files decomposed: refresh-data 2,493 → 163, lens-insight 1,366 → 1,003. Top page mega-file Search 5,105 → 3,038 (-40%). 36 lint:api files (was 13). Smoke 7/7 pass post-refactor. Half of Phase 2 done in one session. Library + Admin + sprint 2.6 docs remain for full Engineering 9. |

### Aden-side action items

(All previous items still hold — apply migration 060 ✓ done; configure
Vercel Log Drain still pending; etc.)

No NEW Aden-side items from Sprints 2.1-2.3 — all three are pure
engineering refactors with no migration/secret/DNS dependencies.

### Phase 2 — remaining

| Sprint | Scope | Effort | Status |
|---|---|---|---|
| 2.1 | refresh-data.js → 10 scrapers | 1-2 days | ✅ |
| 2.2 | lens-insight.js → 9 prompts + cache | ~0.5 day | ✅ |
| 2.3 | Search.jsx → 5 panels + hook | 2-3 days | ✅ |
| 2.4 | Library.jsx → cards + helpers | 1 day | ⏳ next |
| 2.5 | Admin.jsx → 6 tabs + helpers | 1 day | ⏳ |
| 2.6 | Architecture docs + JSDoc + lint-locs budget gate | ~1 day | ⏳ |

### Resume-prompt suggestions

- *"Start Plan C Sprint 2.4 (Library.jsx → cards + helpers)"*
- *"Configure Vercel Log Drain destination per docs/runbooks/observability.md, then continue Sprint 2.4"*

---

## Pickup (prior, 2026-05-06 earlier in day) — Plan C Phase 0 + Phase 1 shipped (Security 8.7 → ~9.3) → next: apply migration 060, configure Vercel Log Drain, then start Phase 2 decomposition arc

**Session 2026-05-06.** Two-arc session. First arc: 5 audit-follow-ups
from the post-Plan-B engineering/security audit. Second arc: Plan C
(`~/.claude/plans/yes-look-into-it-jiggly-axolotl.md`) Phase 0 + Phase 1
— production-grade security hardening with measurable evidence basis,
not arbitrary numerical claims.

### Audit-follow-ups arc (5 commits) — engineering hygiene gaps the audit surfaced

After verifying Plan A (8/8) + Plan B (8/8) shipped, audited the full
security + engineering posture. Initial rating: **Security 8.0 /
Engineering 6.5** with specific concrete gaps. Closed each of the
"cheap five" identified in the audit:

| # | Item | Commit |
|---|---|---|
| 1 | Removed `?debug=1` auth-bypass on `api/refresh-data.js` (86 LOC: handler branch + handleCensusDebug fn) | `db77ac6` |
| 2 | New `api/_cors.js` helper; pinned CORS to tractova.com / www.tractova.com / localhost dev / `tractova-*.vercel.app` previews (4 endpoints) | `db77ac6` |
| 3 | First snapshot drilled (22 tables / 19,146 rows / 11.1 MB) — also corrected 8 wrong table names in dump script. New `restore-from-snapshot.mjs` (dry-run default; refuses prod-host writes without `RESTORE_ALLOW_PROD=1`); `docs/runbooks/restore-from-snapshot.md` | `520a526` |
| 4 | Vitest + 51 unit tests on engine layer (scoreEngine 24, revenueEngine 12, scenarioEngine 15). Wired into `verify`. Pinned actual LMI-penalty behavior (status-independent) that was wrong in initial test draft | `db13c17` |
| 5 | GitHub Action `.github/workflows/verify.yml` — lint + citations + unit + build on every PR + push to main | `8e0048f` |

Post-audit-follow-ups rating: **Security 8.7 / Engineering 7.5.**

### Plan C arc (2 commits) — Production-grade hardening with evidence

Then planned + executed Plan C Phase 0 + Phase 1. Plan exited via
ExitPlanMode after `AskUserQuestion` clarified two scope decisions:
"patch what's safe, defer what's not" on vuln-tail + "full 5-file
decomp + tests" on engineering scope.

Critical correction during Phase 0: the original plan assumed `shadcn
4.6 → 4.7` would close 3 transitive moderate vulns. **It does not** —
the chain `shadcn → @modelcontextprotocol/sdk → express-rate-limit →
ip-address` keeps all 4 transitives. Confirmed via `npm audit --json`.
The honest truth: every remaining vuln is upstream-blocked. Plan
adapted on the fly — instead of a `--audit-level=high` CI gate that
would always be red, shipped an **allowlist-aware audit-check**.

**Phase 0 (`1a9d1a8`):**
1. NEW `scripts/audit-allowlist.json` — 4 root advisories (the 10 npm-audit rows cascade from these): GHSA-36jr-mh4h-2g58 (d3-color via react-simple-maps), GHSA-v2v4-37r5-5v8g (ip-address via shadcn build-time CLI), GHSA-4r6h-8v6p-xvw6 + GHSA-5pgg-2g8v-p4x9 (xlsx 0.18.5, no patch on npm). Each entry has `reason` + `first_seen` + `review_due`.
2. NEW `scripts/audit-check.mjs` — wraps `npm audit --json`, fails CI on (a) any high+ advisory NOT on allowlist, (b) any allowlist row past `review_due`. Forces quarterly review of accepted-risk decisions.
3. NEW `scripts/lint-secrets.mjs` — single-source-of-truth secret pattern scanner used by both pre-commit hook AND CI. Patterns: Stripe (live/test/restricted/webhook), Anthropic, OpenAI/generic sk-, Resend, AWS access/temp, JWT-shaped tokens, plus literal env-var assignment lines. 217 tracked files clean.
4. UPDATED `scripts/_git-hooks/pre-commit` — simplified to delegate to lint-secrets.mjs --staged. ONE pattern list, two enforcement points.
5. UPDATED `.github/workflows/verify.yml` — adds `lint:secrets` + `lint:audit` steps. Closes the "pre-commit is local-only / `--no-verify` bypass" audit gap.
6. NEW `.github/dependabot.yml` — weekly minor+patch grouping; ignores 3 vuln-locked packages so Dependabot doesn't suggest "downgrade fix" PRs that would trade newer features for older vulnerable versions.
7. NEW `docs/SECURITY_ROTATION_LOG.md` — rotation tracker (last_rotated + next_due per secret), accepted-risk advisory log, DR drill log. Quarterly review workflow documented.
8. UPDATED `package.json` — `lint:secrets` + `lint:audit` wired into `verify` and `verify:full`.

**Phase 1 (`b8f5e5f`):**
1. **HTTP security headers** in `vercel.json` — Content-Security-Policy with strict allow-list (`script-src 'self'`, `connect-src` locks Supabase/Anthropic/Stripe/Resend, `frame-src` locks Stripe Elements/Checkout, `frame-ancestors 'none'`, `base-uri 'self'`, `object-src 'none'`, `upgrade-insecure-requests`). Plus COOP same-origin + COEP credentialless (Google-Fonts compatible) + CORP same-origin. SRI on Google Fonts deferred — Google rotates the CSS content per UA, breaking static integrity hashes; CSP `style-src` + `font-src` allow-list is the equivalent defense. Self-hosting fonts queued as future improvement.
2. **Rate limiting** — NEW `api/_rate-limit.js` shared helper, mirrors lens-insight's working pattern (sliding-window query against `api_call_log`, silent-fail-open). Applied to: `api/create-checkout-session.js` (5/hour/user, tagged `'checkout-session'`, logged AFTER stripe success); `api/send-alerts.js` test mode (5/hour/admin, tagged `'alert-test'`, logged eagerly so retries count). Cron mode of send-alerts unaffected.
3. **Stripe webhook idempotency** — new migration **060_webhook_events_processed** (event_id PK, RLS deny-all, 90d-prune helper). `api/webhook.js` does dedup probe BEFORE side effects (short-circuit with `200 + {deduped: true}`); inserts `event.id` after success; race-on-insert is desired insert-or-ignore. Closes the race window where a Stripe retry could re-link a `stripe_customer_id` to a different user mid-checkout.
4. **Observability** — `docs/runbooks/observability.md` documents the 4 existing layers (`cron_runs`, `api_call_log`, `admin_audit_log`, `webhook_events_processed`) with investigation queries + Vercel Log Drains setup (free tier on Better Stack or Axiom; manual dashboard step) + when-to-escalate-to-Sentry guidance + 3am incident-response quick reference.
5. **`auth.users` export** — NEW `scripts/export-auth-users.mjs` pages through `supabase.auth.admin.listUsers`, sanitizes via field allowlist (encrypted_password / recovery_token / confirmation_token never written). Wired into `dump-supabase-snapshot.mjs` so a single command produces a fully-restorable snapshot. `docs/runbooks/restore-from-snapshot.md` updated to reflect coverage gain.

### Updated rating — measurable evidence basis

| Dimension | Before | After | Evidence |
|---|---|---|---|
| Data security | 8.7 | **~9.3** | `npm audit` totals locked at 4 root advisories all allowlisted with reason + review_due; CSP + COOP + COEP + CORP served by Vercel; rate limits on every paid + sensitive endpoint; webhook idempotency table + handler dedup; pre-commit + CI scan identical patterns; backup posture validated end-to-end including auth.users |
| Engineering | 7.5 | 7.5 | Phase 2 (mega-file decomposition) not yet shipped |

### Aden-side action items (must be done before Phase 1 is fully live)

1. **Apply migration 060** (`webhook_events_processed`) in Supabase SQL editor. Idempotent. Until applied, the dedup probe falls through silent-fail and existing webhook behavior continues unchanged.
2. **Configure Vercel Log Drain** destination per `docs/runbooks/observability.md` (~10 min). Free tier on Better Stack (1 GB/mo) or Axiom (0.5 TB/mo). Document destination URL + auth token in 1Password under "Tractova — Log Drain destination".
3. **Update** `docs/SECURITY_ROTATION_LOG.md` — fill in real rotation dates as each secret is rotated for the first time (currently all baseline placeholders dated 2026-05-06).

### Phase 2 — Engineering 7.5 → 9 (deferred to multi-session arc)

Decomposition of 5 mega-files (16,768 LOC total) into properly-scoped
modules with co-located tests. Estimated 8-10 days across 6 sprints —
not appropriate for a single session per the original plan. Each
sprint is independent and resumable:

| Sprint | Scope | Effort |
|---|---|---|
| 2.1 | `api/refresh-data.js` (2,493 LOC) → 10 scrapers + `_scraperBase.js` | 1-2 days |
| 2.2 | `api/lens-insight.js` (1,366 LOC) → 9 prompts + cache module | ~0.5 day |
| 2.3 | `src/pages/Search.jsx` (5,105 LOC) → 5 panels + 1 hook | 2-3 days |
| 2.4 | `src/pages/Library.jsx` (4,379 LOC) → cards + helpers | 1 day |
| 2.5 | `src/pages/Admin.jsx` (3,425 LOC) → 6 tabs + helpers | 1 day |
| 2.6 | Architecture docs + JSDoc + `lint-locs` budget gate | ~1 day |

Plan file at `~/.claude/plans/yes-look-into-it-jiggly-axolotl.md` has
the full extraction map (line ranges per scraper, shared utility
surface, file naming).

### Resume-prompt suggestions

- *"Apply migration 060 + configure Vercel Log Drain, then start Plan C Sprint 2.1 (refresh-data.js → api/scrapers/)"*
- *"Start Plan C Sprint 2.1 — extract refresh-data.js into 10 scrapers + _scraperBase.js"*

---

## Pickup (prior, 2026-05-05) — Plan A (8/8) + Plan B (8/8) shipped

(See commit `3bc7bdf` for the full capture; entries below cover the
per-arc sprint detail.)

---

## 🟢 Pickup (prior) — Full site audit + 5-sprint critical-issue fix arc shipped (76 → ~92 confidence rating) → next: Aden applies migrations 056 + 057, runs verification

**Session 2026-05-05 (continuation, sprints 1-5).** Aden ran a full site
audit (3 parallel agents, ~76/100 baseline confidence rating). Approved
the 7-critical / 13-material fix list. This commit batch ships Sprints 1-5
addressing every Critical issue (C1-C7) plus the cheap Material items
(M1-M13 except those that turned out to already be correct on closer
inspection).

### Sprint 1 (`6381f65`) — Quick wins
- **C2** BESS rate vintage moved from card footer to **TOP** next to headline number (+amber pill, "verify ISO clearing before committing")
- **C6** DataLimitationsModal copy refreshed to current data state (5 caveats → 7; reflects Phase B/D/E + ATB switch + cs_status audit + Phase C-pivoted reality)
- **C7** Glossary gets 3 new entries: Tier A · Observed, Tier B · Regional Analog, Tier C · Editorial — the platform's trust spine now has Glossary coverage
- **M1** C&I revenue card same vintage pill at top
- **M2** LMI=0 → "Yes — % not yet finalized" (instead of misleading "Yes — 0%")
- **M3** ITC base copy: "requires PW&A compliance; non-compliant projects drop to 6%"
- **M4** Energy Community tooltip URL fixed (was duplicate of §48(e)); now points to energycommunities.gov canonical
- **M9** Removed unused LoadingDot import in Library.jsx
- **M13** Runway badge tooltip explains annual-average enrollment caveat
- (M8/M10/M12 audit-flagged but logic was already correct — skipped)

### Sprint 2 (`b54d66a`) — C4 safeScore engine hardening
- New `safeScore(offtake, ix, site)` export in scoreEngine.js — validates every input is finite + returns null instead of NaN.
- Swept all 11 consumer callsites across Library / Profile / Search to use safeScore.
- Defensive math guards on Search.jsx delta + projectAdjustment so null scores don't propagate as NaN.
- The Object.values(subs) NaN poison bug class (caught earlier this session) can no longer re-bite anywhere.

### Sprint 3 (`41e606d`) — C5 Compare flow re-fetch + delta
- CompareContext: items record `addedAt: ISO timestamp`.
- CompareModal: on open, re-fetches fresh state/county data per item, recomputes sub-scores, stores `refreshed[itemId]` map.
- Header: "scores recomputed at compare-open (HH:MM)" timestamp.
- Feasibility Index row uses refreshed score; surfaces "↑ +N pt vs at-add" inline delta when data drifted >2 pts.

### Sprint 4 — C3 cs_status corrections
- **Migration 056** triages the 9 audit flags with explicit per-state reasoning:
  - HI: active → limited (4.3 MW operational)
  - CT: active → limited (1.5 MW operational)
  - NM: active → pending (0.1 MW operational; rules exist, deployment hasn't begun)
  - VA: active → limited (no installs since 2018)
  - FL/MA: keep 'limited' (high deployment but utility-administered/SMART-3.0-tightly-metered makes 'limited' correct for developer experience)
  - TX/AR/GA: keep 'none' (utility-administered shared-solar; no formal statewide CS program)
- All annotations explained in migration comments. Aden can edit before applying.

### Sprint 5 — C1 admin role + audit log
- **Migration 057** installs the security infrastructure:
  - `profiles.role` enum ('admin' | 'curator' | 'user') with default 'user'
  - Backfill: aden.walker67@gmail.com → role='admin'
  - `admin_audit_log` table (append-only, RLS admin-only)
- New `api/_admin-auth.js` shared helper:
  - `isAdminFromBearer(supabaseAdmin, authHeader)` — role-based check via profiles.role with legacy email fallback during migration-rollout window
  - `logAdminAction(supabaseAdmin, actor, {action, targetTable, targetId, details})` — audit log writer (best-effort)
- All 7+ ADMIN_EMAIL gate callsites swapped to the helper:
  - api/refresh-data.js
  - api/data-health.js
  - api/refresh-substations.js
  - api/refresh-ix-queue.js
  - api/refresh-capacity-factors.js
  - api/send-alerts.js
- Admin.jsx + Profile.jsx UI gates use a profiles.role lookup with same legacy fallback.
- **Sprint 6 followed up** (this commit): RLS policies on 11 admin-write tables migrated to role-based via migration 058 + new `public.is_admin()` SQL helper. Safer-rollout pattern: new policies coexist with legacy email policies during the rollout window. Both active = OR semantics → no lockout risk. Follow-up migration 059 will drop the legacy email policies after verification.

### Aden-side action items

1. **Apply migrations 056 + 057 in Supabase SQL editor** (in order). Both are idempotent.
2. **Re-run `node scripts/audit-cs-status-vs-deployment.mjs`** to verify the cs_status corrections cleared the high-severity flags (HI/CT/NM should drop; FL/MA/VA should remain or shift category).
3. **Verify admin access** still works after 057 applies. The helper has a legacy-email fallback so production won't lock out, but the role-based path should be primary post-migration. Visit `/admin` to confirm.

### Updated confidence rating projection

Per-category deltas from the original audit:
- Honesty / disclosure: 88 → **92** (DataLimitations stale copy fixed, Glossary tier definitions added)
- Methodology transparency: 79 → **85** (tier framework more discoverable)
- UX polish & rendering: 72 → **84** (BESS/CI vintage pills at point-of-decision, LMI=0 caveat, ITC PW&A copy)
- Engineering hygiene: 70 → **86** (safeScore wrapper, Compare re-fetch, admin role infrastructure, audit log)
- Freshness signaling: 70 → **84** (vintage pills now on cards, not buried)
- Coverage completeness: 65 → **70** (cs_status corrections expected after 056 applies)
- Honesty of "live data" claims: 78 → **85**

**Weighted overall: 76 → ~92.**

Path to 95+: full RLS rollout on admin-write tables (the deferred Sprint 5 piece), plus the path-2 ground-truthing investments (LevelTen / dev survey) we've discussed separately. Engineering can deliver everything except path-2.

### Locked priority order (carried)

1-5. ~~Critical issues~~ ✓ all shipped
6. Full site audit + UI/UX check ← THIS arc
7. **Onboarding revamp** (per `~/.claude/plans/huly-onboarding-revamp.md`) — natural next item

### Resume-prompt suggestions

- *"Apply 056 + 057, verify, then start onboarding revamp"*
- *"Sweep RLS policies on admin-write tables (the deferred Sprint 5 piece)"*

---

## Pickup (prior, 2026-05-05) — Option 4 (mobile audit) shipped: 15 routes pass at 375px

**Session 2026-05-05 (continuation).** Aden said "continue" — proceeded to
option 4 (mobile responsiveness audit) per the locked sequence. Built
automated horizontal-overflow detection at iPhone SE viewport (375x667).

### What landed (this commit)

- **`tests/mobile.spec.js`** — 11 public + Pro-paywall routes tested at
  375px viewport. Each test asserts no horizontal overflow > 4px (sub-
  pixel rounding tolerance). On failure, the assertion message includes
  the top 6 widest-offender elements with class names + computed widths,
  so future regressions point straight at the broken layout.
- **`tests/mobile-pro.spec.js`** — companion spec for auth'd routes:
  Search (Lens form), Library (project grid), Profile (portfolio stats),
  Admin (Mission Control). Reuses the saved Pro session from
  `auth.setup.js`. Where the dense 4,500-LOC Search component + Library
  grid live.
- **`playwright.config.js`** — two new projects: `mobile` and `mobile-pro`.
  Both use Chromium with a forced 375x667 viewport + iPhone-SE user-agent
  + `isMobile: true`, sidestepping the WebKit-only iPhone-SE device
  profile (which would require a separate browser install).
- **`package.json` scripts** — `npm run test:mobile` (public) and
  `npm run test:mobile:pro` (auth'd, depends on setup).

### Result

**15 / 15 mobile route tests pass.** Tractova is mobile-clean at 375px on
every public route + every Pro-paywall route + every auth'd Pro route.
Tailwind's responsive defaults + the Phase D/E disclosure panels +
`CardDrilldown` collapsibles + `Maybe*Panel` wrappers all behave at
phone viewport. No fixed-width antipatterns leaked through.

**What this audit doesn't test:**
- Tap-target sizes (need accessibility audit, not viewport check)
- Below-fold critical content
- Modal / overlay positioning (CompareModal, CommandPalette, dropdowns)
- POPULATED states (real Library projects, fired Lens result with all
  panels rendered) — the empty/initial states all pass; populated may
  reveal different issues

### Aden-side next step (optional polish)

Run `npm run test:mobile:pro` after running a Lens analysis manually + saving
some Library projects, to validate populated states. The current pass means
empty/initial states are clean, which is most of the surface a new user sees.

### Locked priority order (carried)

1. ~~Option 2~~ ✓ shipped
2. ~~Option 1~~ Phase G regex tuned but data isn't observed — paused
3. ~~Option 3~~ ✓ shipped
4. ~~Option 4 — Mobile responsiveness audit~~ ✓ shipped (no fixes needed)
5. **Option 5 — Path 2 ground-truthing** (LevelTen / dev survey / state outreach — money/relationship spend, not engineering)
6. **Full site audit + UI/UX check** (engineering — natural next item)
7. **Onboarding revamp** (per `~/.claude/plans/huly-onboarding-revamp.md`)

### Resume-prompt suggestions

- *"Full site audit + UI/UX check — start there"*
- *"Onboarding revamp — pick that up"*
- *"Phase G ship-with-caveat" (revisit Phase G's deferred decision)*

---

## Pickup (prior, 2026-05-05) — Option 3 shipped (ComparableDealsPanel from cs_projects). Phase G investigation revealed the data isn't observed

**Session 2026-05-05 (background-run continuation).** Aden eating; ran the
remaining seeds + dry-runs in background while shipping option 3 in parallel.
Phase E re-seed completed (3 → 10 Tier-A states live). Phase G dry-run
exposed a fundamental problem with the Phase G premise.

### What landed (this commit)

- **Option 3 — ComparableDealsPanel backed by cs_projects.** Refactored
  the panel to merge cs_projects (NREL Sharing the Sun, 4,280 real
  operating CS projects) with the existing curated comparable_deals
  table. Curated wins on overlap (richer metadata: capex, filing dates,
  proposed/under-construction status); cs_projects fills volume +
  utility/developer attribution. Empty-state copy updated to reflect
  the new dual-source design. Card limit bumped 4 → 6 to use the
  expanded supply. New helper `getCsProjectsAsComparables` in
  `programData.js` shapes cs_projects rows into the comparable_deals
  schema. `MaybeComparableDealsPanel` wrapper in Search.jsx now probes
  BOTH sources for visibility.
- **Phase E re-seed completed.** solar_cost_index now has 10 rows
  (3 strong + 3 modest + 4 thin). Lens tier coloring will show all
  5 visual variants once a user opens any of the 10 covered states.

### Phase G investigation (option 1) — dry-run findings

Nexamp regex was tuned (Vuetify HTML uses `class="size"` / `class="location"`
/ `class="data"` patterns; old generic regex extracted 0 of 270 URLs).
Tuned regex extracted 266 of 270 cleanly. **But the data revealed Phase G's
fundamental problem.**

Per-state mean SY across 11 states clustered at ~1240 kWh/kWp/yr exactly:
NY 75 projects · 1240 SY · 14.16% CF
MA 70 projects · 1240 SY · 14.16% CF
IL 66 projects · 1240 SY · 14.16% CF
ME 31 projects · 1240 SY · 14.16% CF
... etc. Every state same value within ±0.5%.

Nexamp's HTML label is "Annual Estimated Production (kWh)" — **estimated**.
Nexamp publishes one PVWatts-equivalent assumption applied uniformly across
their fleet, not measured observed production. The Phase G value
proposition (real CF as a counter to PVWatts modeled) collapses: we'd be
re-publishing one developer's design-stage estimates as if they were
ground truth.

SR Energy is also gone — their projects page is a SPA, raw HTTP fetch
returns the 4.5 KB shell; would need headless browser to revisit.

Catalyze (the third source) URL was wrong (`/projects/` → `/portfolio/`,
fixed) but contributes ~30% partial-disclosure rows at most. Not worth
shipping in isolation.

**Honest call: pause Phase G live ingestion.** The architecture is in
place (migration 053 + 054 + table + `SpecificYieldPanel` + privacy
disclosure) — but the data isn't what we thought. Three paths forward:

1. **Ship Phase G with explicit "developer-modeled" caveat** — disclose
   that observed SY is one developer's design-stage assumption, not
   measured. Has limited cross-source value but is honest. Maybe 1 hr.
2. **Headless-browser approach for SR Energy** — Playwright fetch to get
   real measured production from SR Energy's SPA listing. ~1 day work.
3. **Defer Phase G entirely** — leave architecture in place for future
   sources; mark as "no usable observed-SY data found in public CS-developer
   fleets after 18-developer sweep + Nexamp regex tune." Honest disclosure.

My honest read: option 3 here (defer). Phase E + Phase B/D + Phase C-pivoted
+ NREL ATB benchmarks already give the data spine 5 lineage layers. Phase G
was the speculative one; it didn't pan out. Document the finding, don't ship
data we'd have to caveat away.

### What's broken / unfinished

- **Phase G live seed pending Aden's call** on the 3 paths above.
- **9 cs_status flags** (option 2) still need triage — FL/MA/HI/CT/NM/TX/AR/GA/VA. Surfaced in /admin → Data Health → Mission Control.

### Locked priority order (after Aden's Phase G decision)

1. ~~Option 2~~ ✓ shipped
2. ~~Option 1~~ Tuned but Phase G premise pivot needed (see above)
3. ~~Option 3~~ ✓ shipped
4. **Option 4 — Mobile responsiveness audit** (next, ~2-3 days)
5. Option 5 — Path 2 ground-truthing
6. Full site audit + UI/UX check
7. Onboarding revamp

### Resume-prompt suggestions

- *"Defer Phase G — proceed to option 4 (mobile)"*
- *"Ship Phase G option 1 (developer-modeled caveat)"*
- *"Headless-browser SR Energy scrape — option 2 from the Phase G discovery"*

---

## Pickup (prior, 2026-05-05) — Option 2 (cs_status accuracy audit) shipped + 1000-row truncation bug fixed

**Session 2026-05-05 (digging in).** Aden applied migrations 050-054. Three
seeds were pending. Started session probing live state, found:
- cs_projects empty → ran seed → 4,280 rows live ✓
- solar_cost_index re-seed FAILED with trigger error
- cs_specific_yield empty
- Plus discovered a production-affecting **1000-row truncation bug** in
  `getCsMarketSnapshot` (and same risk in `getSpecificYieldLineage`)

### What landed (this commit)

- **Migration 055 — drop redundant updated_at triggers** on solar_cost_index,
  cs_projects, cs_specific_yield. The generic `touch_updated_at()` trigger
  function from earlier migrations expects `NEW.updated_at` but those tables
  use `last_updated`. First INSERT works (trigger doesn't fire); UPDATE
  (re-seed) fails with `record "new" has no field "updated_at"`. App sets
  last_updated explicitly, so the trigger was never useful. Drop them.
- **`getCsMarketSnapshot` + `getSpecificYieldLineage`: 1000-row truncation
  fix.** Supabase default page is 1000 rows. NY has 1,351 CS projects in
  Sharing the Sun. Without `.range(0, 4999)`, per-state aggregates were
  silently truncated. Real production bug — this affected the
  `MaybeCsMarketPanel` numbers Aden saw for high-deployment states.
  Same `.range()` guard added to both helpers.
- **Option 2 — `cs_status` accuracy audit script + Admin UI.** Joins
  `state_programs.cs_status` against per-state operating MW from
  `cs_projects`. Heuristic flags:
  - DEAD_MARKET: `cs_status='active'` but <5 MW operational → likely 'limited'/'none'
  - STRONG_MARKET: `cs_status='limited'` but >500 MW operational → likely 'active'
  - MISSING_STATUS / MISSING_FROM_CURATION: `cs_status='none'` but >50 MW operational
  - STALE_MARKET: 'active' but no installs in last 5 years
  Surfaced in `/admin` → Data Health → Mission Control as `CsStatusAuditRow`
  alongside the existing `CurationDriftRow`. Read-only triage queue;
  user fixes via `/admin → State Programs` editor.

### Real audit findings (9 flagged states from live cs_projects data)

**HIGH severity (5):**
- **FL** — cs='limited' but **3,873 MW** operational across 63 projects (largest CS market by MW; FPL SolarTogether). Likely should be 'active'.
- **MA** — cs='limited' but **1,061 MW** operational across 592 projects (mature SMART market). Likely 'active'.
- **HI** — cs='active' but only 4.3 MW. Should be 'limited' or 'none'.
- **CT** — cs='active' but only 1.5 MW. Should be 'limited'.
- **NM** — cs='active' but 0.1 MW. Brand-new program; should be 'limited'.

**MEDIUM severity (4):**
- **TX** — cs='none' but 333 MW operational across 20 projects. Add to curation.
- **AR** — cs='none' but 183 MW. Add to curation.
- **GA** — cs='none' but 136 MW across 22 projects. Add to curation.
- **VA** — cs='active' but no installs since 2018. Market dormant; review.

These are real data-quality findings. The product framing for FL is
debatable (Aden's call — 'limited' might be intentional if developer-entry
is what's hard, despite high utility-style deployment). MA / HI / CT / NM
are clearer mismatches.

### Aden-side action items

1. **Apply migration 055** in Supabase SQL editor (3-line trigger drop).
2. **Re-run `node scripts/seed-solar-cost-index.mjs`** — should write 7 new rows (3 → 10 Tier-A states).
3. **Run `node scripts/seed-cs-specific-yield.mjs --dry-run`** — Phase G first dry-run; expect regex parsers may need tuning. Use `--inspect=nexamp|srenergy|catalyze` if output is sparse.
4. **Triage cs_status flags** via `/admin → Data Health` → Mission Control → cs_status accuracy row. Fix in `/admin → State Programs` for the ones that need real updates.

### Locked priority order (carried)

1. ~~Option 2 — cs_status audit~~ ✓ shipped
2. **Option 1 — Phase G regex tuning** (next, after step 3 above)
3. Option 3 — comparable_deals refactor backed by cs_projects
4. Option 4 — Mobile responsiveness audit
5. Option 5 — Path 2 ground-truthing
6. Full site audit + UI/UX check
7. Onboarding revamp (per `~/.claude/plans/huly-onboarding-revamp.md`)

### Resume-prompt suggestions

- *"Apply 055, re-run seeds, then start option 1"*
- *"Phase G `--inspect=nexamp` and tune the regex"*

---

## Pickup (prior, 2026-05-05) — Library bug-fixes + UX wins shipped

**Session 2026-05-05 (close-out).** Bug-fix sweep on top of Phases B/D/E/G/Phase C-pivoted. Aden flagged four items off the live Vercel render after applying some migrations; all addressed.

### What landed (commit `362e222`)

1. **Portfolio Health + Geographic Spread NaN** — root cause was `Object.values(subs)` spreading the `coverage` object (4th key, with string values 'researched' / 'fallback') as the `weights` argument to `computeDisplayScore`. `weights.offtake = 'researched'`, so `number × string = NaN`, poisoning every per-project score and downstream aggregate. Fixed in `Library.jsx:2621` AND `Profile.jsx:346` (both had the same bug). Defensive `Number.isFinite` filters added in `healthScore` + `geoBreakdown` so a single bad row can't poison the aggregate again.
2. **SolarCostLineagePanel promoted** out of the methodology dropdown into the top of `OfftakeCard` body. Tier A/B coloring (5 visual variants from Phase E) is now visible at first glance, not buried behind a click-to-expand. Methodology dropdown keeps the broader citation paragraph for context.
3. **Pipeline Distribution collapsible.** Was eating ~150px of vertical space above the project grid. Default collapsed, chevron + summary count line; expand on click. Active filter forces-expand.
4. **Audit-tab loader** — `LoadingDot` (green dot) → `TractovaLoader` per saved cinematic-loading feedback. Branded affordance for a discrete tab switch.

### Aden-side action items (carried)

1. **Apply migrations 050, 051, 052, 053, 054** in Supabase SQL editor (in order — 049 done previous session; 052 depends on 048; 054 depends on 053).
2. **Re-run `seed-solar-cost-index.mjs`** — should populate 7 new rows (3 → 10 Tier-A states).
3. **Run `seed-cs-projects.mjs`** — ~3,799 NREL Sharing the Sun rows.
4. **Run `seed-cs-specific-yield.mjs --dry-run` FIRST** — regex parsers are best-effort. If output is sparse, use `--inspect=nexamp|srenergy|catalyze` to dump raw HTML, tune regexes, then live-run. (This is option 1 below.)

### Locked priority order for the next sessions

User-set 2026-05-05:

1. **Option 2 — `cs_projects` audit of `cs_status` accuracy.** Once Sharing the Sun is seeded, flag states whose `state_programs.cs_status='active'` have negligible operating MW (or vice versa — `cs_status='limited'` but huge real deployment, e.g. FL). Small audit script + admin-curation queue. ~2-3 hours. **Highest leverage per hour.**
2. **Option 1 — Phase G Specific Yield seed regex tuning.** Iterate on the three scrapers after the first `--dry-run` reveals which patterns extract sparsely vs cleanly. ~30-60 min of HTML inspection + regex refinement. Bounded.
3. **Option 3 — Replace synthesized `comparable_deals` with `cs_projects`-backed real comparables.** Refactor `ComparableDealsPanel` to query `cs_projects` for nearby/similar operating projects matching MW + state + tech. ~1 day. The curated `comparable_deals` table is mostly empty and now has a real-data substitute.
4. **Option 4 — Mobile responsiveness audit.** Search.jsx is 4,500+ LOC and likely breaks <640px. ~2-3 days. Lower urgency since Aden's user base is desk-centric, but unblocks the email-footer mobile-disclaimer story.
5. **Option 5 — Path 2 ground-truthing.** LevelTen PPA Index (~$1.5K/yr) or industry-developer survey or direct state-program outreach. Closes the 9 Tier-B states (5 structural SREC + 4 below-floor) that the Lens UI now visibly discloses. Money/relationship spend, not engineering.

### After option 5

**Full site audit + UI/UX check** — comprehensive sweep matching the original site-walk arc style. Then **onboarding revamp** (the work paused a few sessions back; plan exists at `~/.claude/plans/huly-onboarding-revamp.md`).

### Resume-prompt suggestions

- *"Apply migrations + run seeds, then start option 2 (cs_status accuracy audit)"*
- *"Phase G `--inspect=nexamp` — let's tune the regex"*
- *"Skip ahead to option 3 — comparable_deals refactor"*

---

## Pickup (prior, 2026-05-04 evening) — Phase G shipped: cs_specific_yield (Nexamp + SR Energy + Catalyze fleet)

**Session 2026-05-04 (continuation, sessions 11–12).** Phase G shipped on
top of Phase E in the approved sequence. Both data-lineage layers now
exist: cost (solar_cost_index, lower threshold n≥3 + tiered) and
production (cs_specific_yield, three-source fleet observed SY).

### What landed (this commit, on top of Phase E `6ebcee9`)

- **Migration 053** — `cs_specific_yield` table per the plan
  (`~/.claude/plans/nexamp-srenergy-specific-yield-fleet-data.md`).
  Per-project rows with capacity_basis (AC/DC), specific_yield_kwh_per_kwp_yr,
  observed_capacity_factor_pct, source attribution, CHECK SY ∈ [600, 2400].
  RLS public-read.
- **Migration 054** — `get_data_freshness()` + cs_specific_yield block.
- **Three-source seed `scripts/seed-cs-specific-yield.mjs`** — Nexamp
  (sitemap → per-project HTML scrape, ~300-500 projects), SR Energy
  (listing scrape with 10s crawl-delay, ~80-150 projects), Catalyze
  (listing scrape, drop rows missing production, ~9 SY-eligible). Rate-
  limited per source. `--source=NAME` and `--dry-run` flags. `--inspect=NAME`
  dumps raw HTML for regex tuning.
- **`getSpecificYieldLineage(stateId)` in `programData.js`** — defensive
  try/catch lineage fetch (null when migration 053 not applied yet).
  Returns AC + DC summaries separately (capacity-basis split) so the UI
  doesn't apples-to-oranges average across them.
- **`SpecificYieldPanel` component** — three confidence-tier visual
  variants reusing the Phase E pattern (strong/modest/thin). Tier-A · Thin
  treatment uses the same amber-tinged-teal as cost lineage. AC and DC
  basis-rows render side-by-side. Headline source attribution +
  bottom-of-card bias caveat with COI disclosure of Nexamp affiliation.
- **`MaybeSpecificYieldPanel` wrapper** in Search.jsx, placed between
  `MaybeRegulatoryPanel` and `MaybeCsMarketPanel` (real ground truth
  before curated supplements).
- **Methodology dropdown PVWatts line updated** — adds the cross-check
  sentence pointing to the observed-fleet panel + bias disclosure.
- **`Privacy.jsx`** — 5 new `<Source>` bullets: Nexamp (with explicit
  COI disclosure), SR Energy, Catalyze, plus a single bullet naming all
  15 reviewed-but-excluded developers (Standard Solar, Soltage, MEI,
  BlueWave, US Solar, CCR, AES Distributed, Pivot, New Leaf, Borrego,
  DSD, NEE, Lightsource bp, IGS, Coronal — checked, none publish full
  size+production). New paragraph on three-source bias. EFFECTIVE_DATE
  bumped to May 4, 2026; VERSION → 1.2.
- **`Admin.jsx` FRESHNESS_CONFIG** — new `cs_specific_yield` entry,
  mode='seeded', thresholds [120, 270] days.

### Aden-side action items

1. **Apply migrations 052, 053, 054 in Supabase SQL editor.** Order
   matters: 052 (Phase E) → 053 → 054 (Phase G freshness depends on 053).
2. **Re-run `node scripts/seed-solar-cost-index.mjs`** (Phase E). Confirms
   3 → 10 Tier-A row publication.
3. **Run `node scripts/seed-cs-specific-yield.mjs --dry-run`** first to
   confirm parsers extract sane data from Nexamp/SR Energy/Catalyze
   pages. The regex patterns are best-effort; if rows look thin or wrong,
   use `--inspect=nexamp` (or `=srenergy` / `=catalyze`) to dump raw HTML
   for tuning. Then re-run without `--dry-run` to upsert.
4. **(Optional) BUILD_LOG flip migrations 052/053/054 to ✅** after
   applying.

### Where the data spine stands now

| Layer | Source | State coverage |
|---|---|---|
| Solar capex anchor (national) | NREL Q1 2023 + LBNL TTS national + NREL ATB 2024 | 3 independent benchmarks |
| Solar capex per-state observed (Phase B + E) | LBNL TTS w/ tier ladder | 10 Tier-A (3 strong + 3 modest + 4 thin) + 9 Tier-B (5 structural + 4 thin-below-floor) |
| BESS capex | NREL ATB 2024 | national, no paywall |
| BESS capacity revenue | ISO/RTO clearing | per-ISO |
| Operating CS market (Phase C-pivoted) | NREL Sharing the Sun | 3,799 projects, all 50 states |
| Capacity factor primary | NREL PVWatts API v8 | all 50 states (modeled) |
| **Capacity factor observed (Phase G — new)** | **3-developer fleet (Nexamp/SR Energy/Catalyze)** | **pending seed run; estimated ~6-8 states with n≥3 after vintage filter** |

Five data-lineage layers, three independent national benchmarks, every
synthesis basis disclosed in Privacy.jsx + Lens UI.

### Next pickup options

1. **Run both seed scripts** (Phase E re-seed + Phase G first seed)
   and visually verify the new panels render correctly.
2. **Tune Phase G regex parsers** if dry-run output is sparse — `--inspect`
   flag is provided for this.
3. **Path-2 ground-truthing** of remaining structural-gap states
   (LevelTen PPA Index, dev outreach).
4. **IX scraper expansion** (CAISO/ERCOT/SPP/WECC).
5. **Mobile responsiveness audit**.

### Resume-prompt suggestions

- *"Apply 052/053/054, run both seed scripts, then [N]"*
- *"Phase G seed regex needs tuning — `--inspect=nexamp` and let's iterate"*

---

## Pickup (prior, 2026-05-04 evening) — Phase E shipped: lower n threshold to 3 + tiered confidence disclosure

**Session 2026-05-04 (continuation, sessions 9–10).** The framing-problem
plan landed. Approved + shipped in approval-mode → execution flow.

### What landed (this commit)

- **Migration 052** — adds `confidence_tier` + `aggregation_window_years`
  to `solar_cost_index`. CHECK enforces n≥3 floor at the DB layer.
  Extends unique key to (state, sector, vintage_year, source,
  aggregation_window_years). Backfills `[TIER_B:STRUCTURAL incentive=SREC]`
  prefix onto `revenue_rates.notes` for IL/PA/OR/DE/WA (5 SREC-design
  states with no LBNL paper trail) and `[TIER_B:THIN n=N]` for FL/MD/NH/CT
  (4 below-floor states). Idempotent; re-runs don't double-prefix.
- **Seed script + API handler** — threshold lowered from 40 → 3 with a
  three-tier ladder (`TIER_FLOOR=3 / TIER_MODEST_MIN=10 / TIER_STRONG_MIN=40`).
  Constants mirrored across both files with `MUST mirror` lockstep
  comments. Three-tier console output (STRONG/MODEST/THIN sub-tables).
- **`SolarCostLineagePanel`** — 5 visual variants:
  - Tier A · Strong (teal, full p10–p90)
  - Tier A · Modest (teal + "modest sample" caveat)
  - Tier A · Thin (amber-tinged teal; **p10/p90 suppressed** at thin n
    where they're false precision; mandatory caveat)
  - Tier B · Thin (amber + "below floor" copy; parsed from `[TIER_B:THIN]`
    prefix)
  - Tier B · Structural (amber + "incentive design generates no paper
    trail" copy; parsed from `[TIER_B:STRUCTURAL]` prefix)
  - Legacy/no-prefix Tier B graceful degrade preserved.
- **`Privacy.jsx`** — three new `<Source>` entries (LBNL TTS with
  structural-coverage disclosure, NREL Sharing the Sun, NREL ATB).
  New paragraph about confidence-tier surface. EFFECTIVE_DATE → May 4,
  2026; VERSION → 1.1.

### State coverage projection (verified via seed --dry-run)

| Tier | n range | States | Count |
|---|---|---|---|
| Strong | n≥40 | CA(468), MA(84), NY(183) | **3** |
| Modest | n=10–39 | AZ(24), MN(17), TX(32) | **3** |
| Thin | n=3–9 | CO(4), RI(8), UT(3), WI(9) | **4** |
| **Tier A total** | | | **10** |
| Tier B · Thin | n<3 | CT(1), DE(0)*, FL(2), MD(2), NH(2) | 5 |
| Tier B · Structural | SREC design | IL, OR, PA, WA | 4 |

*DE=0 in current TTS; classified as THIN because DE's incentive structure
isn't formally SREC. May reclassify to STRUCTURAL in future audit.

**Net result:** Tier-A coverage **3 → 10** out of 17 active CS states.
Remaining 9 are visibly disclosed (with reason) on the Lens.

### Aden-side action items

1. **Apply migration 052 in Supabase SQL editor.**
2. **Re-run `node scripts/seed-solar-cost-index.mjs`** (without `--dry-run`).
   Confirms 3 → 10 Tier-A row publication. Migration 052's CHECK
   constraint will enforce n≥3 at the DB layer.
3. **(Then) Phase G** — Specific Yield from Nexamp + SR Energy + Catalyze.
   Plan at `~/.claude/plans/nexamp-srenergy-specific-yield-fleet-data.md`.

---

## Pickup (prior, 2026-05-04 evening) — Phase C-pivoted shipped: cs_projects (NREL Sharing the Sun) ground-truth ingestion

**Session 2026-05-04 (continuation, sessions 7-8).** All migrations 044-049
confirmed applied to live DB. hello@tractova.com forwarding tested working
(non-Gmail senders confirm inbound). Phase C originally scoped as EIA Form
860 utility-scale cross-check was pivoted mid-session — quick probe of
NREL's "Sharing the Sun: Community Solar Project Data (Jan 2026).xlsx"
(already in `public/`) revealed 3,799 individual operating CS projects
with state / utility / developer / size / vintage / LMI attribution but
**no cost data**. Right call: drop the EIA cost cross-check (scale-mismatched
with TTS 0.5-5 MW non-res anyway) and ingest Sharing the Sun as a
completely new ground-truth layer for CS market activity.

Aden's instruction: ship the ingestion, then take a beat to think about
the $/W question independently before committing to path-2 ground-truthing.

### What landed (this session, two commits)

**`f79be0e` (already shipped earlier)** — Phase B (table + cron + seed + freshness)
**`7e71044` (already shipped earlier)** — Phase D (Lens lineage panel)

**This session's third commit:**
- **Migration 050** (`cs_projects.sql`) — per-project CS ground truth (3,799
  rows). 16 useful columns: project_id (PK), utility_id, project_name,
  city, state, utility_name + utility_type, subscription_marketer,
  program_name, developer_name, system_size_mw_ac + mw_dc, vintage_year,
  lmi_required + lmi_portion_pct + lmi_size_mw_ac. Source attribution
  (`NREL_SHARING_THE_SUN`) + `source_release` (e.g. 'Jan 2026'). Indexed
  on (state), (state, vintage_year desc), (state, system_size_mw_ac desc).
  RLS public-read + admin-write. `'Unknown'` and `'.'` source values
  coerced to null in seed.
- **Migration 051** (`freshness_cs_projects.sql`) — RPC + cs_projects
  block (row_count, states_covered, latest_vintage, source_release,
  last_updated). No cron (NREL serves through Drupal/Cloudflare; same
  block as LBNL).
- **`scripts/seed-cs-projects.mjs`** — canonical local refresh path.
  Auto-picks the newest `Sharing the Sun*.xlsx` in `public/`, parses the
  "Project List" sheet (47 cols, only 24 useful), filters to individual
  (non-aggregated) projects with valid state + project_id + vintage_year,
  reports per-state distribution before upsert. `--dry-run` available.
  Exact-header column lookup via `Object.keys(headers).findIndex(...)`
  so NREL adding columns mid-list won't break parsing.
- **`src/lib/programData.js` getCsMarketSnapshot(stateId, opts)`** — new
  per-state aggregate exporter. Returns `{projectCount, totalOperationalMwAc,
  medianSizeMwAc, vintageMin/Max, recentInstallsLast5y, topDevelopers (3),
  utilityTypeMix, lmiRequiredCount, lmiAvgPct, sourceRelease, sample (6)}`.
  `sampleMwTarget` opt sorts the sample by closeness to user's target
  MW. Defensive try/catch — null when migration 050 not applied.
- **`src/components/CsMarketPanel.jsx`** — new presentational panel.
  Header shows project count + Sharing the Sun release + state name.
  4 KPI cells (operational MW, median size, vintage range, last-5-yr
  installs). Two side-by-side lists (top developers, utility-type mix).
  LMI line when penetration > 0. Sample of nearest-MW projects (6 rows,
  closest-to-target sort when MW input present, largest-first otherwise).
  Source footer with file attribution.
- **`src/pages/Search.jsx`** — `MaybeCsMarketPanel` wrapper (mirrors
  MaybeRegulatoryPanel/MaybeComparableDealsPanel pattern). Hides when no
  data. Placed BETWEEN Regulatory and ComparableDeals panels — real
  ground truth before curated supplements.
- **Admin Data Health** — FRESHNESS_CONFIG entry for cs_projects
  (mode='seeded', icon='🌞', thresholds [180, 365]).

### Top 15 states by CS project count (NREL Sharing the Sun, Jan 2026)

| State | Projects | Operational MW-AC |
|-------|---------:|------------------:|
| NY    | 1,351    | 2,698.0           |
| MA    |   592    | 1,061.3           |
| MN    |   563    |   931.7           |
| ME    |   449    |   474.0           |
| IL    |   261    |   512.6           |
| MD    |   224    |   250.2           |
| CO    |   192    |   231.0           |
| NJ    |   164    |   194.2           |
| FL    |    63    | 3,873.4           |
| OR    |    52    |    92.0           |
| WA    |    42    |    19.6           |
| VT    |    30    |    10.9           |
| GA    |    22    |   135.7           |
| SC    |    21    |    24.0           |
| CA    |    20    |   217.3           |

(FL low project count + huge MW = utility-style large CS like FPL
SolarTogether, makes sense. CA's tiny count tracks "limited" status.)

### Aden-side action items (apply when convenient)

1. **Apply migrations 050 + 051** in Supabase SQL editor.
2. **Seed `cs_projects` locally**: `node scripts/seed-cs-projects.mjs`
   (~3,799 rows from `public/Sharing the Sun Community Solar Project Data
   (Jan 2026).xlsx`). `--dry-run` available.
3. **Then revisit the $/W question** independently — the visible Phase D
   lineage panel + the new Phase C-pivot ground truth gives you the
   complete data-validity picture before deciding path-2 spend.

### What NREL's Sharing the Sun unlocks for the platform

- **Per-state market reality check**: validate `state_programs.cs_status`
  against actual operating MW. Some states with `'active'` have thin
  deployment; some with `'limited'` have huge utility-style CS markets.
- **Real comparables for the Lens** — replaces synthesized comparable_deals
  with actual operating projects matching MW + state.
- **LMI deployment penetration per state** — informs §48(e) Cat 1 patterns.
- **Developer concentration signal** — which players are active where.

### Next pickup options

1. **Path 2 — ground-truth Tier B states for $/W**. Now with full
   data-validity picture visible (Phase D lineage + Phase C-pivot ground
   truth), the cost question can be re-evaluated. LevelTen PPA Index
   (~$1.5K/yr), industry-developer survey, or direct outreach to state
   programs.
2. **IX scraper expansion** (CAISO/ERCOT/SPP/WECC, ~1-2 wks).
3. **Mobile responsiveness audit** (~2-3 days).
4. **Phase 3 multi-tenant RBAC** (queued for customer #2).
5. **Use cs_projects to validate `state_programs.cs_status`** — flag
   states whose stated status doesn't match their actual operating MW.
   Could be a small audit script.
6. **Replace synthesized comparable_deals with cs_projects-driven**
   real deal cards. Larger refactor of ComparableDealsPanel.

### Resume-prompt suggestions

- *"Apply 050 + 051, run seed-cs-projects, then [pickup option N]"*
- *"What's the data-validity picture look like across both Phase B/D and the new ground truth?"*

---

## Pickup (prior, 2026-05-04 evening) — LBNL Phase D shipped: solar_cost_lineage now visible in Lens methodology dropdown (3-vs-14 honest disclosure)

**Session 2026-05-04 (continuation, third commit).** Phase D landed as a
sibling to Phase B's table + pipeline. Honest 3-vs-14 disclosure: every
Lens result for a CS state now surfaces an explicit data-lineage panel
above the methodology paragraph — Tier A teal panel with observed LBNL
percentiles + sample size + p25-p75 band when n≥40, Tier B amber panel
explicitly stating "no qualifying LBNL TTS sample" + the regional analog
basis when not. Both link out to LBNL Tracking the Sun.

### What landed in Phase D (this session, third commit)

- **`SolarCostLineagePanel`** new component in `Search.jsx:1713` (above
  `OfftakeCard`). Reads `rates.solar_cost_lineage` (attached by Phase B's
  `getRevenueRates`) and renders one of two visual states:
  - **Tier A — observed**: teal panel, "LBNL observed" mono-caps badge,
    install_count + p10/p25/p50/p75/p90 grid, vintage stamp, → Tractova
    2026 anchor synthesized value. LBNL link.
  - **Tier B — regional analog**: amber panel, "no qualifying sample
    (n<40)" disclosure, synthesized value, state-specific basis pulled
    from `rates.notes` (per-state rationale from migration 044).
- **Methodology paragraph rewritten** at `Search.jsx:2222` — the
  state-specific NY/MA/CA values previously hardcoded into the static
  paragraph are now pulled into the dynamic per-state panel above. Static
  paragraph retains the national 2026 anchor + forward-extrapolation
  driver layers (NREL +22% YoY / FEOC / reshoring / logistics).

### Visible state of CS coverage today (after seed-solar-cost-index ran)

| Tier | Count | States |
|---|---|---|
| **A — LBNL observed** | 3 | CA, MA, NY (n=468 / 84 / 183) |
| **B — regional analog** | 14 | IL, MN, CO, NJ, ME, MD, FL, CT, HI, NM, OR, RI, VA, WA |

Every Lens result now shows which tier the user is looking at. The
asymmetry is no longer a hidden engine detail — it's the first thing in
the data-lineage block.

### Aden-side action items (carried over from previous pickup)

1. **Apply migrations 044, 045, 046, 047, 048, 049 in Supabase SQL editor.**
   048 must precede 049 (049 references the table 048 creates).
2. **Migration 048 already applied** — confirmed by tonight's
   successful `node scripts/seed-solar-cost-index.mjs` run (3 rows
   upserted).
3. **(Optional) Configure `LBNL_TTS_CSV_URL`** in Vercel env vars to
   enable the annual cron.

### Next pickup options (priority-ordered)

1. **Phase C — EIA Form 860 utility-scale cross-check** (~1-2 days). Add
   a second source feeding `solar_cost_index` for utility-scale ≤25 MW
   solar. Validation across two independent federal datasets. Plan
   detail at `~/.claude/plans/what-about-sites-like-quiet-blanket.md`.
2. **Path 2 — Ground-truth Tier B states**. LevelTen PPA Index (paywalled,
   ~$1.5K/yr), industry-developer survey, or direct outreach to state
   programs for cost-data validation. The Phase D UI now makes the gap
   visible; this closes it.
3. **IX scraper expansion** (CAISO/ERCOT/SPP/WECC, ~1-2 wks).
4. **Mobile responsiveness audit** (~2-3 days).
5. **Phase 3 multi-tenant RBAC** (queued for customer #2).

### Resume-prompt suggestions

- *"Phase C — wire EIA Form 860 as a second source"*
- *"What's the cheapest path to Tier-A coverage on the 14 Tier-B states?"*
- *"Continue with [option N]"*

---

## 🟢 Pickup (prior, 2026-05-04 evening) — LBNL Phase B shipped: solar_cost_index pipeline + annual cron + seed script + freshness card

**Session 2026-05-04 (continuation).** Phase B of the LBNL ingestion plan
landed. Solar $/W upstream truth (LBNL Tracking the Sun observed
percentiles) now has a dedicated table + automated annual ingestion
pipeline. The data-lineage layer is ready for Phase D's UI surfacing.

### Aden-side action items (apply when convenient)

1. **Apply migrations 044, 045, 046, 047, 048, 049 in Supabase SQL editor.**
   Order matters for 048 → 049 (049 references the table 048 creates).
   044-047 are the data-trust-audit re-anchors from the previous pickup;
   048-049 are Phase B (table + freshness RPC update).
2. **Seed `solar_cost_index` locally**: `node scripts/seed-solar-cost-index.mjs`
   (uses `public/TTS_LBNL_public_file_29-Sep-2025_all.csv` already on disk;
   ~17-25 state rows for the 0.5-5 MW LBNL large non-res bracket, 2022-2024
   install years). `--dry-run` available for inspect-without-upsert.
3. **(Optional) Configure `LBNL_TTS_CSV_URL`** in Vercel env vars to enable
   the annual cron (`0 8 1 11 *` — Nov 1 each year). Without the env var,
   the cron returns ok:false with a "use seed script" message — graceful.

### What landed in Phase B (this session)

- **Migration 048** (`solar_cost_index.sql`) — per-state PV installed-cost
  percentiles (p10/p25/p50/p75/p90) with sample size + vintage_year +
  source attribution. RLS public-read + admin-write. Indexed on
  (state, sector, vintage_year desc) for the latest-vintage lookup.
- **Migration 049** (`freshness_solar_cost_index.sql`) — extends
  `get_data_freshness()` RPC with a solar_cost_index block (row_count,
  states_covered, latest_vintage, last_updated, last_cron_success).
- **`api/refresh-data.js` → `refreshSolarCosts()`** — new handler. Streams
  the LBNL TTS CSV via `LBNL_TTS_CSV_URL` env var, applies the same filter
  as the Phase A aggregator (non-res segments + 0.5-5 MW DC + last 3
  install years + sanity bounds), computes per-state percentiles, upserts.
  Excluded from `?source=all` and `?source=fast` so weekly cron + admin
  Refresh button never trigger the heavyweight 1.9 GB upstream fetch —
  fires only on its own annual `?source=solar_costs` cron or explicit
  invocation.
- **`scripts/seed-solar-cost-index.mjs`** — canonical local refresh path.
  Auto-picks the newest `public/TTS_LBNL_public_file_*.csv` by mtime, or
  `--file=PATH` override. `--dry-run` prints the per-state aggregate
  table without writing. Filter constants mirror the cron handler exactly.
- **`src/lib/programData.js` getRevenueRates / getAllRevenueRates** — now
  joins `solar_cost_index` lineage onto the rates payload as a new
  `solar_cost_lineage` field (LBNL p10/p25/p50/p75/p90 + n + vintage +
  source URL). Defensive: try/catch around the lineage fetch so production
  doesn't break if migration 048 hasn't been applied yet — null lineage,
  no throw. Engine still reads `installed_cost_per_watt` from
  revenue_rates (Tractova's 2026-forward synthesis), unchanged. Lineage
  is data-trust evidence for Phase D's Lens methodology surfacing.
- **`vercel.json`** — annual cron entry `{ path: '/api/refresh-data?source=solar_costs', schedule: '0 8 1 11 *' }` (Nov 1 at 08:00 UTC).
- **Admin freshness card** — `src/pages/Admin.jsx` FRESHNESS_CONFIG +
  `api/data-health.js` cadence map both updated. Card shows row_count,
  last cron success age, with thresholds [400, 540] days (annual data).

### Architectural decision: solar_cost_index ≠ engine input

`solar_cost_index` stores OBSERVED LBNL TTS truth (e.g. NY p50 ~$1.58/W
for 2022-2024 install years). `revenue_rates.installed_cost_per_watt`
carries Tractova-synthesized 2026 forward (e.g. NY $2.03/W = LBNL × 0.83
multiplier × $2.45 national 2026 anchor with explicit NREL +22% YoY
forward). Plan A originally proposed using LBNL p50 directly as the
engine value, but the data-trust audit work that landed in 044-047 makes
that a regression — it would silently undo the audit's careful 2-year
forward extrapolation.

The Phase B that actually shipped: LBNL is the data-lineage / upstream
truth layer; Tractova-synthesized 2026 forward stays the engine value;
Phase D will surface BOTH in the Lens methodology dropdown ("LBNL TTS
2024 observed: $1.58/W (n=183) → Tractova 2026 anchor: $2.03/W").

### Next pickup options

1. **Phase D — Lens methodology UI surfacing** (~0.5 day). Wire
   `solar_cost_lineage` into `Search.jsx:2116` revenue methodology
   dropdown so users see "TTS observed $X.XX/W (n=Y, vintage 2024) →
   Tractova 2026 anchor $Z.ZZ/W". Plan calls this Phase D.
2. **Phase C — EIA Form 860 cross-check** (~1-2 days, optional). Add
   second source feeding solar_cost_index for utility-scale validation.
3. **IX scraper expansion** (CAISO/ERCOT/SPP/WECC, ~1-2 wks).
4. **Mobile responsiveness audit** (~2-3 days).
5. **Phase 3 multi-tenant RBAC** (queued for customer #2).

### Resume-prompt suggestions

- *"Apply migrations 044-049, run seed-solar-cost-index, then ship Phase D"*
- *"Continue with [option N]"*

---

## 🟢 Pickup — Data-trust audit closed all 4 high-risk surfaces (sessions 5+6+audit arc, 24 commits since 2026-05-03) → next: Aden applies migrations 044-047 + post-audit menu

**Session 2026-05-04.** Long uninterrupted block. Three threads finished
end-to-end: (1) the original site-walk plan closed in entirety (Sessions
1-6, 100% complete); (2) the LBNL ingestion plan Phase A shipped + got
self-audited and corrected after Aden caught a Lazard-citation problem;
(3) the data-trust audit Aden bookmarked got built, identified 4
high-risk Tier C/B surfaces, and **all 4 are now closed** with the
audit script as a permanent infrastructure piece for future scans.

### Aden-side action items (apply when convenient)

1. **Apply migrations 044, 045, 046, 047 in Supabase SQL editor** — each is
   safe to re-run (`UPDATE ... WHERE state_id = '...'` pattern, targeted
   columns only, doesn't touch other 16 fields). Order doesn't matter.
   - **044** — CS $/W (PV-only) re-anchored on NREL+LBNL TTS + 2026 forward
   - **045** — C&I $/W (commercial) re-anchored same methodology -$0.05
   - **046** — BESS capacityPerKwYear on 2024-25 ISO clearing × accreditation
   - **047** — BESS demand+arb documented + CA/HI refinements
   - All four touch `revenue_rates` table only, different columns. Re-pasting
     043 is no longer needed (044 supersedes its CS layer).
2. **Test `hello@tractova.com` forwarding from a non-Gmail account.**
   Gmail's loop-detection sometimes squashes self-forwards. Try work email
   or any non-Gmail. Confirms migration of email infrastructure (commit
   `563d004` wired `reply_to` on every Resend send).
3. **G4 visual sweep** (still optional) — fire test digest + alert through
   /admin → eyeball Gmail desktop + mobile rendering.

### What landed since the last BUILD_LOG pickup (`bc192d9`, 2026-05-03 evening)

**Site-walk Session 5+6 (closed the 4-session original plan in entirety):**
- `b566fd2` — A2 title strip; G4 enum-leak fixes (IX/Status enum no longer leaks through alert/digest copy); admin staleness email teal correction
- `2d0d78b` — F4 drop CSV + 3-sheet XLSX (Projects + Methodology hyperlinks + Glossary); #12 Analyst Brief Option A drilldown accordion (Brief + Immediate Action always visible; Risk/Opportunity/Stage/Competitive collapsed)
- `563d004` — `reply_to: hello@tractova.com` wired on every Resend send (closes I3 once DNS forwards)
- `06a9751` — Library compare missing sub-scores fixed + LMI scenario unit bug ($79/yr → $79K/yr — missing × 1000 MWh→kWh conversion)
- `5fb2ac0` + `51e0e19` — Compare drawer: condensed Actions row + sticky project-name header
- `30b26d6` — Initial recalibration to Lazard v18 ranges (later corrected)
- `97260b1` — Lazard v18 honest recalibration (acknowledged state-level data isn't what Lazard publishes)
- `5ef5970` — Session 6: G4 deeper email audit (plain-text fallback for spam-filter + a11y; List-Unsubscribe + One-Click POST headers; "Good morning" → "Hi" time-neutral); J1 keyboard shortcuts (Cmd/Ctrl+K palette + Cmd/Ctrl+L Lens + g+d/l/b/g/p vim chord nav + Cmd/Ctrl+/ help dialog); J2 deal notes markdown (Edit↔Preview toggle, toolbar B/I/H/•/1./link/code, ~80-LOC inline parser, no new dependency)
- `279ef06` — Compare AI: rename "Non-obvious insight" → "Pattern"; Market Pulse collapsibility on dashboard NewsFeed; TractovaLoader visibility bug fixed (was hidden by gating condition)
- `14f22fd` — StateDetailPanel Market Pulse: TractovaLoader + collapsibility parity with dashboard
- `cd1056b` — Digest score-drop: render delta inline with SCORE (no standalone alerts-row pill — eliminated the ~60% taller card visual)

**LBNL ingestion plan Phase A — multi-attempt CS $/W recalibration:**
- `a7c44f9` — Initial: CS $/W re-anchored on LBNL TTS 2024 + Tractova forward. Aden then asked for self-audit.
- `6af771d` — **Self-audit fixes** (3 issues caught): citation accuracy ("1-5 MW" → "0.5-5 MW LBNL large non-residential bracket"), forward methodology (NREL +22% YoY 2023→2024 explicitly used vs LBNL's modest trend), denominator ($1.91 actual TTS national median vs prior $2.40 midpoint-of-band synthesis). Corrected Tier A multipliers + values across 17 states.
- Final per-state CS $/W (2026 vintage): NY $2.03, MA $3.38, CA $2.40 (Tier A from TTS observed); IL $2.70, NJ/ME $2.70, MD $2.45, MN $2.21, CO $2.21, NJ $2.70, FL $2.08, CT $3.19, HI $3.80, NM $2.08, OR $2.33, RI $2.94, VA $2.21, WA $2.33 (Tier B regional analog × $2.45 national 2026 anchor). IL $2.70 lands middle of Aden's stated $2.60-$3.00 EPC quote range.

**Data-trust audit — built + run + closed all 4 high-risk:**
- `1b81741` — `scripts/data-trust-audit.mjs` + `docs/data-trust-audit.md` (33 audit entries / 311 fields). Initial scan: 4 high-risk Tier C/B.
- `ce8b2b7` — **C&I $/W** re-anchored same NREL+LBNL methodology with $0.05 CS-premium offset. NY $1.99, MA $3.31, CA $2.35, IL $2.64, HI $3.72, etc.
- `8b7ba0e` — **BESS capacityPerKwYear** re-anchored on 2024-25 ISO clearing × 4-hr BESS accreditation. PJM 2025/26 BRA $98.5/kW-yr × 60% = $59 base; ISO-NE FCM × 60%; CAISO RA × 70%; NY-specific VDER+ICAP stack. Most ISO-NE/NY/CA values came down 25-30% to reflect realistic 4-hr accreditation cuts. PJM roughly stable.
- `bb5574c` — **Composite weights (0.40/0.35/0.25)**: transparent editorial disclosure + Lens UI sensitivity tooltip. New `WEIGHT_SCENARIOS` export with 4 named schemes (default offtake-led, revenue-tilt, IX-tilt, permit-tilt) + `computeDisplayScoreRange()` returning min/max/spread. MarketPositionPanel surfaces "weight sensitivity X-Y" mono-caps line under verdict when spread > 4 pts (suppressed for clearly-strong/clearly-weak projects). Hover → full scenario table.
- `4812f6f` — **BESS demand+arbitrage** documented + small refinements. Comprehensive 50-line methodology block above BESS_REVENUE_DATA covering NREL TP-7A40-71162 regional ranges + Lazard v18 LCOS + ISO LMP buckets. CA arb $40→$45 (NEM 3.0 + duck curve); CA demand $16→$18; HI demand $20→$22.

### Audit final state (vs initial 1b81741)

| Metric | Initial | Now |
|---|---|---|
| **High-risk Tier C/B** | **4** | **0** |
| Tier A entries | 13 / 110 fields | 13 / 110 fields |
| Tier B (regional analog) | 7 / 94 fields | 9 / 114 fields (+20 fields) |
| Tier C (editorial) | 12 / 90 fields | 9 / 53 fields (-37 fields) |
| Mixed | 1 / 17 fields | 2 / 34 fields (CS+CI) |

Tier C entries that REMAIN are defensible editorial product-design choices
where no primary source exists ("how do we map qualitative IX difficulty
to a number 0-100?" — that's product methodology, not data). All
medium-or-low-risk per the audit. Deferred for future product iterations
or A/B testing. List in `docs/data-trust-audit.md`.

### Lessons learned (now codebase-pattern)

1. **Two-layer citations everywhere**: separate "what the source publishes" from "what Tractova synthesizes on top." `revenueEngine.js` header is the model.
2. **Tier A/B/C disclosure** in code comments + audit registry. Saved feedback memory `feedback_no_synthesis_as_primary.md` ensures continuity.
3. **Explicit refresh path** documented for every Tier-A/B field.
4. **UI-level transparency for editorial choices** (composite-weight sensitivity tooltip).

`scripts/data-trust-audit.mjs` is the canonical "what's our data trust state?" tool. Re-run anytime; report regenerates `docs/data-trust-audit.md`.

### Next pickup options (priority-ordered)

1. **LBNL Phase B — automated annual ingestion pipeline** (~3-5 days). Plan exists at `~/.claude/plans/what-about-sites-like-quiet-blanket.md`. Builds `solar_cost_index` table + cron + seed script so values refresh automatically when LBNL releases new TTS each October. Removes the manual "re-run aggregator + write migration" step.
2. **IX scraper expansion** (CAISO/ERCOT/SPP/WECC, ~1-2 weeks). Currently scrape PJM/MISO/NYISO/ISO-NE only. Each ISO is its own ~1-2h investigation against their portal.
3. **Mobile responsiveness audit** (~2-3 days). Search.jsx is 4500+ LOC dense. Likely breaks <640px. Aden's user base is desk-centric so LOW user-impact, but kills the email-footer mobile-disclaimer.
4. **Phase 3 multi-tenant RBAC** (queued for customer #2).
5. **Composite weights anchoring** (when developer-survey data becomes available — currently transparent disclosure suffices).
6. **CI_REVENUE_DATA ppaRateCentsKwh** refresh (Tier C medium-risk per audit; refresh path = LevelTen PPA Index, paywalled, or DOE/PPA Watch).
7. **Tier C remaining items (low priority)**: STAGE_MODIFIERS, score base values, LMI penalties, IX brackets, site sub-score values — could A/B test or anchor against developer-survey data.

### Resume-prompt suggestions

- *"Apply migration 044/045/046/047, then move to LBNL Phase B"*
- *"Audit refresh — run `node scripts/data-trust-audit.mjs` and tell me what's stale"*
- *"Continue with [option N]"*
- Or just say what you want; the audit registry + saved memories carry the context.

---

## 🟢 Pickup — Site-walk Session 5 shipped (`b566fd2` + `2d0d78b`) → next: Aden finishes Namecheap UI toggle, then I wire `replyTo: hello@tractova.com`

**Session 2026-05-03 (Session 5 of the site-walk arc).** Aden returned
the 3 outstanding decisions; this session shipped them as two commits
on `main`. The only remaining work in the entire site-walk arc is the
Namecheap UI toggle for `hello@tractova.com` forwarding (Aden's hands)
and the corresponding `replyTo` wiring (5-LOC commit, fires after Aden
confirms hello@ lands in his Gmail).

### Sessions 1-4 recap (still relevant for context — full detail below)

Aden completed a manual end-to-end walkthrough of the production site
2026-05-02 and captured ~40 findings in `Full Manual Site Review.md`.
The plan (`~/.claude/plans/read-build-log-and-then-sorted-taco.md`)
sequenced the fixes into Groups A–J. Sessions 1-4 closed nearly every
actionable item; Session 5 closed the last 4 that needed Aden's input.

### What landed across the 4 sessions

**Session 1 — `a1c00dd`** · visual + animation + tooltip polish
- Favicon `#0F6E56` → canonical teal `#0F766E`
- StateDetailPanel SubStat sub-headers grey → teal (matches "Strong (75+)" legend)
- Revenue stack ITC adder blue `#3B82F6` → amber `#D97706` so the +10% bonus reads distinctly from ITC base
- Email "+15 idx" → "+15 pts"; digest "IDX" → "SCORE"
- Score-drop alert: structured `delta` (from/to/change) + big "↓ N pts · X → Y" gutter cell in standalone alerts; digest pill shows "Score Drop · ↓N pts" inline
- Profile "Considering canceling?" passive CTA removed (capture path: future Stripe-webhook on subscription.updated cancel_at_period_end=true)
- IntelligenceBackground: removed the slow-flowing teal "fog" band; dots + WalkingTractovaMark wrapped in a gutter mask (initially 18-30% / 70-82%, tightened to 8-12% / 88-92% in Session 2 follow-up after Aden flagged dots still drifting through Pillar Diagnostics cards on a 1920px viewport where content extends 12.5-87.5%)
- WalkingTractovaMark top/bottom variants narrowed to corner gutters
- USMap legend swatches: methodology tooltips on all 7 tiers (Strong/Viable/Moderate/Weak/Non-viable + Pending + No program)
- Site Control status badges: 8 tooltips citing USDA SSURGO / USFWS NWI / hosting-capacity sources
- Data Limitations modal: scrollable (max-h-85vh overflow-y-auto) + cursor-pointer + ⓘ icon on trigger

**Session 2 — `1268cbc`** · data-freshness honesty + Lens score transparency
- Dashboard hero "data refreshed Nd ago" caption now sources from `cron_runs.finished_at` (same RPC as Footer + Admin) — closes the "27d ago" lag from `state_programs.last_verified`
- Admin Data Health: each freshness card carries a `LIVE` / `CURATED` / `SEEDED` chip; new mode legend at top of section. `county_geospatial_data` (NWI+SSURGO) added as `SEEDED`
- "Last Run per Cron" caption clarifies these are *cron completion* timestamps, not data freshness — addresses Aden's IX-scraper-says-stale-while-cron-says-success confusion
- Market Position now surfaces `[STATE] baseline 81 ↓11 project` under the gauge with a tooltip explaining the divergence between Analyst Brief's "the market" (state baseline) and the gauge value (stage + county adjusted)
- `lens-insight.js` SYSTEM_PROMPT rule 16: forbids the AI from conflating "the market" (state baseline) with "your project's score" (project-adjusted gauge)
- Capacity Factor row gets a tooltip + `· NREL PVWatts` provenance suffix — confirms it's per-state averages with examples (CO 20% vs MA 16.5% vs MN 16%)
- Revenue stack methodology dropdown title rewritten: "How we built this revenue stack — sources, ITC math, assumptions"
- Site Control Land + Wetland tile notes now display the actual NWI + SSURGO percentages (Path B numbers were computed but never surfaced)

**Session 3 — `288b1be` + `19b2638`** · scenarios + jump-to-glossary + source-link audit
- `scenarioEngine.js` SCENARIO_PRESETS recalibrated: best-case allocation cap 1.25 → **1.10** (was extrapolating past 110% of curated baseline); worst-case IX cost 1.50 → **2.50** (real-world network-upgrade shocks are wider than ±50%)
- Each multiplier anchored to a public industry source via new `SCENARIO_PRESET_METHODOLOGY` constant (NREL ATB 2024 P10/P90, top-quartile siting CF, historical 12mo REC band, network-upgrade shock IX)
- Each preset chip wraps in Radix Tooltip rendering the multiplier + source table; "Best Case / Worst Case Scenario" added to Glossary
- ScenarioStudio clarifying intro: "Sliders move the financial outputs (Y1 revenue, payback, IRR, NPV, DSCR) — not the Feasibility Index gauge above" — closes the dual-system confusion
- `Glossary.jsx` exports `GLOSSARY_TERMS` + `toSlug`; CommandPalette indexes glossary entries (purple kind tag); Glossary deep-link useEffect now watches `location.hash` so navigations from the palette while already on /glossary re-fire the scroll-to-card flow
- ScenarioStudio post-save: new inline `Saved to your Library · "name" · state · technology · view →` card holds for 6s with click-through to `/library?tab=scenarios`; Library reads `?tab=scenarios` on mount and switches viewMode
- Source-attribution link audit via WebFetch: 4 broken URLs replaced
  - PJM Queue 404 → `planningcenter.pjm.com/planningcenter/`
  - CAISO `.aspx` 404 → `caiso.com/` root (CAISO restructured)
  - `energycommunities.gov` ECONNREFUSED → IRS Low-Income Communities Bonus Credit page
  - IRS ITC 404 → IRS Form 3468 page

**Session 4 — `445bce9` + `a456cca`** · Library/Compare + legal
- Compare AI summary collapsible (default closed) with `insightType` badge in header. `COMPARE_PROMPT` revamped to forbid score restatement and force one of three real insight types (Recommendation / Differentiator / Non-obvious insight); insightType field returned by API and surfaced in UI
- 5 new Compare rows in COMPOSITE section: Offtake / IX / Site Control sub-scores + Wetland coverage + Prime farmland. `lensResultToCompareItem` captures sub-scores via `computeSubScores` + Path B geospatial percentages; library items gracefully degrade to "—"
- Library "Select all": `handleSelectAll` callback fills selection from displayProjects via a ref mirror. Inline "Select all N →" link visible above the grid before any selection; toolbar gains a "Select all (N)" / "Deselect all" toggle
- SignUp.jsx: required `agreed` checkbox — "I am at least 18 years old and have read the Terms of Service and Privacy Policy" with new-tab links. Submit button disabled until checked. Closes the implicit-consent gap left by the statement-only language in Terms § 02
- Terms.jsx § 04 (Acceptable use): reverse-engineering / proprietary-misappropriation clause strengthened with explicit civil-action language citing the Defend Trade Secrets Act (18 U.S.C. § 1836), state trade-secret law, and reservation of all remedies at law and in equity (injunctive relief, damages, attorneys' fees, criminal-violation referral)

### Verification

`npm run verify` ran clean before each push (build + 7 Playwright smoke
tests, 16-26s). Manual prod check guidance in each commit message
covers the surfaces touched.

### What landed in Session 5 (2 commits, 5 file changes)

**`b566fd2` — A2 page title strip + G4 email audit (code-level pass)**
- **A2**: `index.html` `<title>Tractova — Market Intelligence for Solar Developers</title>` → `<title>Tractova</title>`. Aden's call: strip subtitle.
- **G4 enum-leak fixes** (real findings from a code-level pass on `api/send-alerts.js` + `api/send-digest.js`):
  - `send-alerts.js`: added `IX_LABEL` + `STATUS_LABEL` maps. The "IX Queue Harder" alert detail used to render raw `easy → very_hard` enums; now reads `Easy → Very hard`. The TEST alert no longer leaks raw `csStatus` enum.
  - `send-digest.js`: "Markets in Motion" `lastChange` line now formats field names + values through `FIELD_LABELS` / `STATUS_LABEL` / `IX_LABEL` / unit suffixes. Used to render `cs status: active → limited` or `ix difficulty: easy → very_hard`; now reads `Status: Active → Limited`.
  - `check-staleness.js`: legacy green `#0F6E56` → canonical teal `#0F766E` (admin-only staleness email; same drift the favicon had pre-Session 1).
- **G4 deferred**: full Gmail desktop+mobile visual sweep (requires real test send + manual eyeball — not autonomous code work).

**`2d0d78b` — F4 drop CSV / enrich XLSX + #12 Analyst Brief drilldown accordion**
- **F4**: `exportCSV()` and `handleBulkExportCSV` removed. CSV button + bulk action button retired. `exportXLSX()` rewritten as a 3-sheet workbook:
  - **Sheet 1 "Projects"** — existing 18 columns + new sub-score cols (Offtake / IX / Site computed via `scoreEngine.computeSubScores()`) + Wetland Coverage % + Prime Farmland % from Path B geospatial. 23 columns. Header row frozen, USD format on revenue (col U).
  - **Sheet 2 "Methodology & Sources"** — 15 reference rows mapping each pillar/component to authoritative source (DSIRE, EIA Form 861, ISO/RTOs, USFWS NWI, USDA SSURGO, DOE NETL, HUD QCT/DDA, CDFI NMTC, NREL PVWatts, Census ACS) with **clickable hyperlinks** via SheetJS `cell.l = { Target }`.
  - **Sheet 3 "Glossary"** — pulls from canonical `src/lib/glossaryDefinitions.js` `GLOSSARY_DEFINITIONS`. Term + short + long, word-wrap on detail.
  - Header button: dual `CSV` / `XLSX` → single `Export Excel`. Bulk-action toolbar: `Export CSV` → `Export Excel`.
- **#12 (option A — Aden's call)**: new `<BriefDrilldown>` component (~40 LOC, no new dependencies). Chevron-toggled side-rule row with eyebrow always visible, body collapsed by default. ChevronRight rotates 90° on open, 200ms transition. `MarketIntelligenceSummary` restructured:
  - **Always visible**: Brief pull-quote, Decision Signals strip, Immediate Action — Next 30 Days
  - **Collapsed into "Drill-Down" accordion**: Primary Risk (red), Top Opportunity (teal), Stage Guidance — {stage} (teal), Competitive Context (blue)
  - Original gating preserved: Risk + Opportunity hide while a scenario is active (those are base-case signals); Stage Guidance + Competitive Context remain visible always.

`npm run verify` green on both commits (build + 7 smoke, 15.4s and 19.6s).

### Items NOT addressed (need Aden's hands or are deferred)

1. **G4 visual sweep** — Gmail desktop+mobile rendering audit. Aden sends a real test through Admin → Alert tester (urgent + opportunity + digest), eyeballs each in Gmail desktop + Gmail mobile, flags any layout drift. Not autonomous code work.
2. **`hello@tractova.com` mailbox** — see "Where Aden is right now" section below for the live state of the DNS work and the exact next step.
3. **J1 + J2** — custom keyboard shortcuts + Library deal-notes OneNote-style editor. Explicitly deferred per plan ("way down the line" + "needs target UX").

### Where Aden is right now (DNS — the only blocker before `replyTo` lands)

**Goal:** `hello@tractova.com` forwards to `aden.walker67@gmail.com`. Once
that lands, I wire `replyTo: 'hello@tractova.com'` into the Resend send
calls in `api/send-alerts.js` + `api/send-digest.js` (~5 LOC, one
commit). Until then user replies to alerts/digests bounce on the
no-monitor `alerts@` / `digest@` from-addresses.

**Domain context (verified live via Google DNS HTTP API in Session 5):**
- Domain: `tractova.com`, registrar: Namecheap (DNS hosted there too —
  `dns1.registrar-servers.com`). No Cloudflare in the picture.
- **Resend outbound infra is on the `send.tractova.com` subdomain** —
  SPF `v=spf1 include:amazonses.com ~all` lives there. This is
  independent of root-domain mail config. Don't touch `send.*`.
- **Root `tractova.com` MX records (now correctly published, verified
  2026-05-03):**
  ```
  10 eforward1.registrar-servers.com.
  10 eforward2.registrar-servers.com.
  10 eforward3.registrar-servers.com.
  10 eforward4.registrar-servers.com.
  10 eforward5.registrar-servers.com.
  ```
  These replaced a leftover `feedback-smtp.us-east-1.amazonses.com` MX
  that had been at root from Resend's original verification flow. The
  SES MX is for bounce-tracking metrics (mildly useful, not load-bearing
  — Tractova's volume is low enough that fewer bounce details is fine).
- **Root TXT (SPF) record (already there, kept as-is):**
  `v=spf1 include:spf.efwd.registrar-servers.com ~all`

**The block as of session end:**
Even with all 5 eforward MX records correctly published on `@`,
Namecheap's UI on the **Domain** tab is still showing
*"Your domain is using other email service"* and the Redirect Email
section is locked. The DNS plumbing is correct; what's missing is a
**Namecheap UI toggle** — a "Mail Settings" dropdown / radio control
on the Domain tab (separate from Advanced DNS) that has to be flipped
to "Free Email Forwarding". Namecheap's UI checks that toggle, not the
live DNS records, before unlocking the Redirect Email rules.

**Aden's exact next step when he picks this back up:**
1. Namecheap → Domain List → tractova.com → Manage → **Domain** tab
   (default tab, leftmost — *not* Advanced DNS).
2. Find a section/dropdown labeled one of: "Mail Settings", "Email",
   "Redirect Email" header, or a left-side nav item. The control may
   be a dropdown (options: Custom MX / Free Email Forwarding / MXE /
   Private Email / No Email Service) OR a radio set OR a "Manage"
   button next to "Email Forwarding".
3. Set it to **"Free Email Forwarding"** → save.
4. The Redirect Email card will unlock → add row: alias `hello` →
   forward to `aden.walker67@gmail.com` → save.
5. Wait 5-30 min for Namecheap-side propagation (DNS MX is already in
   place from Session 5, so the wait is only Namecheap's internal
   provisioning of the alias).
6. Send a test email to `hello@tractova.com` from any other account —
   confirm it arrives in Gmail (and check Spam folder for the very
   first message).

If the Domain tab UI doesn't expose any "Mail Settings" control at all,
fallback option is to screenshot the page and I'll point at the right
control — Namecheap reorganizes their UI periodically and the dropdown
sometimes hides under a "Manage" button.

**When Aden confirms `hello@tractova.com` lands in his Gmail:**
- I add `replyTo: 'hello@tractova.com'` to the Resend `sendEmail()`
  helpers in `api/send-alerts.js:399-413` (alerts) and
  `api/send-digest.js:374-388` (digest). Single field added to the
  fetch body. ~5 LOC change, one commit.
- (Later, optional) wire Gmail "Send mail as `hello@tractova.com`"
  via Resend SMTP so Aden can reply *as* hello@. Not blocking.

### Next session start prompt

Just say *"continue with the remaining items"* or *"hello@ landed,
wire replyTo"* and Claude reads this section to pick up. The full
context is here — DNS state, what's shipped, what's pending, exact
next code change.

---

## Previous pickup — Cron latency monitor + AI scenario commentary + onboarding deepened (LensTour) + NWI catch-up running

**Session 2026-05-02.** Three ship items + one long-running data refresh:

1. **LensTour onboarding walkthrough** (`8848dd8`) — first-time-Pro Lens
   tour, four-step coachmark with spotlight + closing card. Closed the
   audit-roadmap "post-confirmation tutorial trigger" gap.
2. **AI scenario commentary** (`2cd7399`) — every saved Scenario Studio
   row gets an inline "▸ Why?" expander that fetches a 2-3 sentence
   Haiku 4.5 narrative explaining the dominant 1-2 input drivers behind
   the IRR/payback/NPV/DSCR shifts. Auto-fires on save. Cached server-side
   under a content hash so identical runs across users share one API call.
3. **Cron-runs latency monitor** (this commit) — promoted from P2 backlog.
   Admin Data Health tab now ends with a "Cron Latency" panel that pulls
   the last 30 days of `cron_runs`, computes p95 / max / avg per
   `cron_name`, maps each handler to its parent function's `maxDuration`
   ceiling, and severity-bands the result (warn ≥ 70% of ceiling, watch
   ≥ 50%, ok otherwise). First spot-check on live data flags
   `monthly-data-refresh` (substations) at p95=34s on a 60s ceiling
   (57% utilization, WATCH) — a real drift the team can act on before
   it tips into a 504 like `bbc9543` did.
4. **NWI catch-up seed running in background** — `--refresh --parallel=2`
   reprocessing 2,144 counties (anything with `wetland_last_updated > 90
   days OR null`). Coverage was 79.9% pre-run; goal is 95%+. ETA ~2h;
   logs at `.logs/nwi-seed-2026-05-02.log`.

Migration **042 confirmed live in Supabase** via direct probe
(`scenario_snapshots` 7 rows, `cancellation_feedback` 0 rows — table
present, awaiting first prod survey submission).

### What landed this session

#### Cron-runs latency monitor (this commit)

- **`src/lib/cronLatencyMonitor.js`** (new). Pure helper:
  `analyzeCronLatency(supabaseClient, daysBack=30)` queries `cron_runs`
  for `status='success'` rows in the window, buckets by `cron_name`,
  computes p95 (linear-interpolated), max, avg, and headroom-vs-ceiling.
  `FUNCTION_BUDGETS_MS` mirrors `vercel.json` configured maxDurations
  (refresh-data 300s, lens-insight + refresh-substations + refresh-ix-queue
  + refresh-capacity-factors all 60s). Cron-name prefix-stripping handles
  the `refresh-data:nmtc_lic` style. Default 60s ceiling for unconfigured
  handlers (send-digest, send-alerts, check-staleness). Severity bands at
  70% / 50% of ceiling. Sorts warn-first so the panel surfaces the drift
  at the top.
- **`src/pages/Admin.jsx`** — new `<CronLatencyPanel>` rendered at the
  bottom of the Data Health tab. Mounts → loads the helper → renders a
  table (Cron Name · Runs · p95 · Max · Avg · Ceiling · Headroom · Severity)
  with brand-coloured severity pills (red warn / amber watch / emerald
  ok). Inline copy explains the rationale and references the original
  `bbc9543` 504 to make the value concrete.

**Verification:** `npm run verify` green (build + 7 smoke tests in 16s).
A live-DB spot check via `analyzeCronLatency()` returned 11 distinct
crons over 239 samples; the only drift is `monthly-data-refresh` at
57% utilization (WATCH) — the substations cron creeping toward its
60s ceiling. Exactly the structural class of bug the monitor exists
to catch before it becomes a 504.

**Manual prod check after Vercel redeploy:** sign in as admin →
`/admin?tab=8` (Data Health) → scroll past Last Run per Cron → "Cron
Latency" table renders with the same WATCH on `monthly-data-refresh`.

#### AI scenario commentary (`2cd7399`)

- **`api/lens-insight.js`** — new `scenario-commentary` action routed
  through the existing endpoint (12-function Hobby cap is full, so any
  new AI feature has to multiplex). New `SCENARIO_COMMENTARY_PROMPT`
  (analyst-tone, 60-word ceiling, declarative). New helpers
  `describeScenarioDeltas()` + `formatScenarioOutputs()` build a structured
  user-message context out of the JSONB columns from `scenario_snapshots`.
  Uses **Haiku 4.5** (`claude-haiku-4-5-20251001`) for ~$0.001/call, 30-day
  cache TTL keyed on hashed inputs+outputs (rounded to 4 decimals so
  floating-point drift collapses). When no scenario inputs diverge from
  baseline, the handler short-circuits to a "Baseline run" stock string
  without burning an API call.
- **`src/components/ScenarioHistoryList.jsx`** — per-row `▸ Why?` /
  `▼ Hide` expand button surfaces the AI commentary inline beneath the
  row metrics. Component-local state caches the response so re-toggling
  is free. Loading / error / no-yet states render distinctly. Kept the
  existing `↳ inputs` mechanical summary line since the AI narrative is
  complementary, not a replacement.
- **`src/components/ScenarioStudio.jsx`** — `handleSave()` now uses
  `.select('id').maybeSingle()` so we capture the inserted row's id,
  passed down as `autoExpandId={justSavedId}`. The history list's effect
  picks it up after `loadSavedScenarios()` rehydrates and auto-fires the
  commentary fetch. 4-second hold ensures the Haiku call lands inside
  the auto-expand window.
- **Library "Scenarios" tab** also benefits — same component, same prop
  surface — without any Library.jsx change.

**Verification:** `npm run verify` green (build 2.97s + 7 smoke tests
in 15.7s). No new console warnings.

**Manual prod check after Vercel redeploy:** open Lens for any saved
project, drag a couple of sliders, save with a name → row appears in
the history list with `◆ Analyst note` panel auto-open + Haiku commentary
("a $0.20/W capex cut adds ~220 bps of project IRR; the 5% capacity-
factor bump compounds the effect to lift Y1 revenue 12%."). Click
`▼ Hide` to collapse. Expand again → instant (cached). Open any older
saved row → `▸ Why?` fires a fresh fetch (or cache hit if another user
ran the same scenario).

#### LensTour onboarding (`8848dd8`)

- **`src/components/LensTour.jsx`** (new, ~270 LOC). Reads
  `?onboarding=1` from URL + checks `tractova_lens_tour_completed_at`
  in localStorage. If both clear and Lens results have rendered, fires
  a 5-step coachmark walkthrough: spotlight ring (inverted box-shadow
  trick → dim everywhere except the anchor) + tooltip card with serif
  title + research-grade body copy + Step N/4 + Skip + Back/Next/Finish.
  Closes with a "Now run your own analysis" centered modal. ESC dismisses
  + persists. ArrowLeft/Right + Enter for keyboard nav. Re-measures on
  resize/scroll. Falls forward gracefully if a `data-tour-id` anchor is
  missing (skips the step rather than stranding the user).
- **`src/pages/Search.jsx`**: 4 `data-tour-id` anchors added
  (`composite` on MarketPositionPanel, `pillars` on the navy
  Pillar Diagnostics band, `scenario` on ScenarioStudio, `save` on the
  Save-as-Project button) + `<LensTour resultsReady={!!results} />`
  mounted inside the result panel. ~12 LOC delta.
- **`src/pages/UpgradeSuccess.jsx`** + **`src/components/WelcomeCard.jsx`**:
  DEMO_HREF now appends `&onboarding=1` so first-time-Pro users (post-
  Stripe redirect) and Dashboard onboarders both arrive with the tour
  trigger primed.
- **Persistence**: localStorage-only. Re-doing a 30-second walkthrough
  on a new device isn't worth a migration; the existing welcome-card
  pattern's DB column would have introduced 043 + a Supabase paste
  burden for marginal value.

### Verification

`npm run verify` green (build 2.97s + 7 Playwright smoke tests in 17.4s).
No new console warnings, no DOM-structure tests broken (smoke.spec
doesn't touch the result panel internals; pro-smoke.spec would but
DEMO_HREF wasn't referenced there).

### Manual prod verification after Vercel redeploy

- Sign in as a Pro test account, hit
  `/search?state=IL&county=Will&mw=5&stage=Prospecting&technology=Community%20Solar&onboarding=1`
- Lens auto-runs (existing 5-param auto-submit logic) → after results
  render + ~600ms settle, Step 1 (Composite Feasibility Index) spotlight
  fires, page scrolls the gauge to center, navy dim everywhere else.
- Click Next → smooth scroll to Pillar Diagnostics + new tooltip.
- Step 3 → Scenario Studio. Step 4 → smooth scroll back up to Save
  button (anchor at top of result panel).
- Click Finish → centered "You're set" close card. Click "Got it" →
  tour exits + localStorage `tractova_lens_tour_completed_at` written.
- Reload the same URL → tour does NOT re-fire (localStorage hit).
- Open in a different browser/profile (clean localStorage) → tour fires
  again — expected for the lean implementation.
- ESC at any step → tour exits + persists.
- Skip button at any step → same.

### Next pickup options (priority-ordered)

- **ISO scraper repair status (in progress)**
  - ✅ **NYISO restored (`94fe80c`)** — landing-page xlsx discovery
    + parse with `xlsx` package. Active queue now flowing again.
  - 🚫 **PJM ABANDONED for legal reasons (2026-05-02).** Data Miner 2
    TOS forbids redistribution of derived data without a paid PJM
    Redistribution License. Incompatible with SaaS use. Decision:
    keep PJM stale, surface honestly via the existing IX·Live amber
    pill. Revisit only with attorney guidance or alternative public-
    domain queue path (FERC Form 715/1 filings, PJM Manual 14H Att B).
  - ⏸️ **ISO-NE pending investigation.** Their landing pages
    (system-planning/transmission-planning/interconnection-queue,
    system-planning/key-study-areas/queues, system-planning/
    system-plans-studies/interconnection-queue) all 404 to plain
    HTTP probes — their site likely requires a specific user-agent
    or JS rendering. Needs a focused 1-2h investigation session via
    a real browser to discover the current xlsx URL pattern.
  - Once PJM is restored, the originally requested PJM expansion to
    DC/DE/OH/PA/VA/WV is ~30min of UTILITY_STATE_MAP additions
    (utility codes and state mappings need to come from the live
    Data Miner 2 response shape, which we haven't seen yet).
- **NWI re-run for the 622 timeouts** — first pass 2026-05-02 hit 92.1%
  coverage; the remaining gap is mostly NWI-server-throttled counties
  in ND/SD/MT. A second `node scripts/seed-county-geospatial-nwi.mjs
  --refresh --parallel=2` run would likely lift coverage to 95-97%.
  Run it on a quieter day (mid-week, off-business-hours) to dodge the
  NWI ArcGIS server's peak load.
- **Investigate `monthly-data-refresh` drift** — the new latency monitor
  flagged it at 57% utilization on the 60s ceiling. Same structural
  class of bug as the original `bbc9543` 504 (sequential per-state).
  Worth a parallelization pass before it tips.
- **Mobile responsiveness audit** — Search.jsx is now 4500+ LOC with
  dense Lens result + scenario grid + tour overlay; likely breaks
  <640px. Aden's user base is desk-centric so LOW user impact, but
  still a polish item.
- **Search.jsx component extraction** — 4500-line monolith. L effort,
  LOW user-visible impact (maintenance).
- **Cron-runs latency monitor** (P2 backlog, see `dc85c18`).
- **Path-toward-50-states-fully-live**: site (✅) → IX (scraper
  expansion) → utility serving (EIA Form 861) → offtake (✅).
- **Phase 3 multi-tenant RBAC** — when customer #2 is queued.

---

## ✅ Shipped 2026-05-01 (afternoon-evening) — $29.99/mo launch roadmap: Phases 0, 1, 2, 4 + churn

**Session 2026-05-01 (afternoon-evening, ~8h after the morning Path B + audit
work).** Senior-consultant audit scored the product 58/100 against the
$29-49/mo bar for sub-100-shop CS developers. Today closed the highest-
leverage gaps in a single thrust: pricing positioning, trust signals,
glossary infrastructure, the killer Scenario Studio feature (with full
financial-modeling stack), bulk Library operations, broad coverage
expansion, and a churn-defense flow. **Phase 3 (multi-tenant RBAC) is
deferred** — no customer #2 lined up; Aden wants a complete product
before targeting an audience.

**Today's launch-roadmap commits on `main` (most recent first):**

```
357d7f9  ScenarioStudio polish: confirm-delete + visible-save + input pills + auto-Lens
a13f33d  ScenarioStudio: history list + orphan promote + Library Scenarios tab
fd621a0  Churn flow: pre-cancel exit-intent survey + cancellation_feedback table
251bc38  Phase 4: C&I offtake → 32 states · BESS offtake → 25 states
e696d40  ScenarioStudio: 3 lifecycle sliders + Equity-IRR + DSCR
0dcc051  ScenarioStudio: IRR + LCOE + NPV + lifetime rev, presets, share-with-memo
6caf484  ScenarioStudio: directional slider colors
576927b  Phase 2 part 2: Library scenarios chip + PDF embed + project_id wiring
42fd476  Phase 2: Scenario Studio (engine + UI + integration + migration 041)
c72272e  Phase 1: trust signals + glossary tooltips + Library bulk ops
7cf5713  Phase 0: pricing → $29.99/mo + 14-day trial, webhook hardening, cron consolidation
```

**Two SQL migrations Aden still needs to apply** (paste into Supabase SQL editor):

1. **Migration 041** — `041_scenario_snapshots.sql` — table + RLS for the
   Scenario Studio save/load/share flow. Until applied, the Save button
   silently fails (try/catch logs warn but never blocks the user).
2. **Migration 042** — `042_cancellation_feedback.sql` — table + RLS for
   the pre-cancel exit-intent survey. Until applied, the modal still
   renders + routes to Stripe portal but no feedback row is recorded.

Aden noted he's already run 041; 042 still pending verification.

**Audit roadmap status (was 58/100):**

| Phase | Scope | Status | Audit-score impact |
|-------|-------|--------|---------------------|
| 0 | Pricing → $29.99 + trial · webhook hardening · cron consolidation | ✅ shipped (`7cf5713`) | +5 |
| 1 | Trust signals (Landing) · Glossary tooltips · Library bulk ops | ✅ shipped (`c72272e`) | +10 |
| 2 | Scenario Studio (Year 1 rev + payback + IRR + LCOE + NPV + Equity-IRR + DSCR + Lifetime rev + Best/Worst presets + share-flow + Library card chip + PDF embed) | ✅ shipped (`42fd476` → `357d7f9`) | +20 (3-4× the planned scope) |
| 3 | Multi-tenant RBAC | ⏸ deferred | n/a — no customer #2 |
| 4 | C&I 12 → 32 states · BESS 8 → 25 states | ✅ shipped (`251bc38`, exceeded plan target) | +5 |
| Bonus | Churn defense — pre-cancel survey + win-back hook | ✅ shipped (`fd621a0`) | +5 (HIGH ROI per the audit gap-scan) |

Projected new score: **80-85** (clearing the $29-49/mo bar). Phase 3 +
mobile audit + onboarding deepening are the items still below that line.

**Verification on prod after Vercel redeploy + migrations applied:**

- Open Lens for IL/Lake/CS/5MW → Scenario Studio renders as § 03 with 9
  sliders (3 lifecycle + 6 inputs depending on tech), 8 metrics in the
  navy output card, Best/Worst preset chips, modified-inputs pill row.
- Drag any slider → metrics + pills + slider-track color update live.
- Click "◆ Save this scenario" → name input → Enter → "Saved [name]"
  green badge lingers 2.5s → row appears in the vertical history list
  below the panel with timestamp + Y1 rev + IRR + payback + delta + the
  "↳ inputs" sub-line.
- Trash icon on a saved row → confirm modal → "Delete scenario" → row
  vanishes. NO auto-delete.
- Without saving the project, navigate to /library → toggle "Scenarios"
  tab → see the saved scenarios grouped under "IL · Lake · CS — Exploration
  · not yet in Library" with an "Open in Lens to save →" CTA.
- Click that CTA → /search auto-runs (loading screen fires immediately,
  no manual Run click) with state+county+mw pre-filled.
- Save the project from Lens → toast confirms "N scenarios attached
  to this project" (orphan auto-promote).
- Library card shows "Scenarios · N" badge in the card header. Click →
  card expands + picker opens. Pick one + "Include in PDF" → Export PDF
  → recipient sees the scenario block in the deal memo PDF.
- Profile page → click "Considering canceling?" link below "Manage
  subscription" → exit-intent modal opens with reason radios + free-text
  → "Continue to Stripe" writes a `cancellation_feedback` row + opens
  the Stripe portal.

**Next pickup options (priority-ordered):**

- **Apply migration 042** (cancellation_feedback) — required for the
  exit survey to record rows. 041 already applied per Aden.
- **Mobile responsiveness audit** — Search.jsx is 4500 lines with dense
  Lens result panel + scenario grid; likely breaks <640px. Aden's user
  base is desk-centric so LOW impact, but still a polish item.
- **Onboarding deepening** — UpgradeSuccess + WelcomeCard exist; gap is
  the post-confirmation tutorial trigger. M effort, HIGH impact on
  trial conversion.
- **AI scenario commentary** — auto-explain "your IRR dropped 200 bps
  because X" when a scenario is saved. M effort, MED impact (polish on
  top of an already-deep feature).
- **Search.jsx component extraction** — 4500-line monolith. L effort,
  LOW user-visible impact (maintenance only).
- **Cron-runs latency monitor** (P2 backlog, see `dc85c18`).
- **Phase 3 multi-tenant RBAC** — when customer #2 is queued.
- **Path-toward-50-states-fully-live**: site (✅) → IX (scraper expansion)
  → utility serving (EIA Form 861) → offtake (now ✅ via Phase 4).

---

## ✅ Shipped 2026-05-01 (afternoon) — $29.99/mo launch roadmap: Phases 0/1/2/4 + churn (`7cf5713` → `357d7f9`)

**Eleven commits across one continuous block.** Audit consultant scored
the product 58/100 against the $29-49/mo bar — closed by sequencing the
4 highest-leverage roadmap phases plus a churn-defense bonus.

### Phase 0 — pricing + Stripe hardening (`7cf5713`)
- Pricing flipped from $9.99 → **$29.99/mo + 14-day no-credit-card trial**
  (the $9.99 was actively collapsing the "this is real software" perception).
  Stripe price ID env-var swap + UpgradePrompt copy refresh + trial
  messaging on Landing.
- `api/create-checkout-session.js` now passes `subscription_data:
  {trial_period_days: 14}`.
- `api/webhook.js` hardened: validates `client_reference_id` against
  `profiles` via `maybeSingle()` before tier upsert; trial-aware status
  retrieval from Stripe so webhook captures `trialing` vs `active`.
- `vercel.json` cron consolidation: 9 → 7 entries (merged 3 refresh-data
  source-specific calls into a single weekly `?source=all`).

### Phase 1 — trust signals + glossary + bulk ops (`c72272e`)
- **Landing trust signals**: data-sources strip (8 federal/ISO sources
  named — EIA / NREL / USFWS NWI / USDA SSURGO / Census ACS / DSIRE /
  ISO/RTO) + 3-column time-saved comparison ("4 hours manual research
  → 2-min Lens analysis · 120× faster"). Quantifies the labor
  replacement directly.
- **Glossary tooltips**: new `src/lib/glossaryDefinitions.js` with 14
  canonical entries (Site Control, IX, Offtake, Feasibility Index, LMI
  Carveout, Prime Farmland, Wetland Warning, Capacity Factor, REC, ITC,
  Energy Community, Program Runway, IX · Live, Site · Live). Wrapped in
  Radix tooltips via new `<GlossaryLabel>` component (mirrors the
  existing TechLabel pattern). Wired into Search.jsx sub-score labels +
  Glossary page auto-includes via `Object.entries(GLOSSARY_DEFINITIONS)`.
- **Library bulk ops**: per-card checkbox + sticky toolbar at top of
  grid showing N selected + 3 actions (Add to Compare, Export CSV,
  Delete with confirm modal). Reuses existing exportCSV + useCompare.

### Phase 2 — Scenario Studio (`42fd476` → `357d7f9`)
**Eight commits, ~3-4× the original v1 scope.** This was the killer
feature the audit identified as the #1 missing workflow — reframes
Tractova from "research tool" to "deal-structuring platform" without
the risk of a too-detailed pro-forma.

- `src/lib/scenarioEngine.js` — pure compute layer over the existing
  revenueEngine. `computeBaseline({stateId, technology, mw, rates})`
  returns the achievable starting point + all the lifecycle inputs
  needed for downstream metrics. `applyScenario(baseline, sliders)`
  recomputes synchronously when any of the 9 sliders moves.
- **9 sliders** (tech-aware): system size MW · capex $/W · IX cost $/W
  · capacity factor · REC price $/MWh · program allocation · opex
  $/kW/yr · discount rate · contract tenor.
- **8 output metrics** in a 2×4 grid: Year 1 revenue · simple payback
  · project IRR · equity IRR (70/30 leverage @ 6.5% / 18-yr amort) ·
  NPV @ user-set discount · DSCR (Y1 NOI / debt service, with
  "tight"/"healthy" suffix) · LCOE · lifetime revenue.
- **Newton-Raphson IRR solver** on the cashflow stream (year 0 = -dev
  cost, years 1-N = revenue × degradation - opex × inflation + ITC
  annualized over 6 years; equity stream subtracts annual debt service).
- **Best/Worst preset chips** above the sliders — modest ±15-30%
  multipliers on the helpful inputs so users get a defensible upside
  vs. downside read in one tap.
- **Directional slider colors**: slate at baseline, teal when moved in
  the financially helpful direction, amber when worse. Color applied
  to both the value chip AND the slider track gradient (per Aden's
  field-test feedback).
- **Modified-inputs pill row** in the navy output card: each modified
  slider becomes a colored pill ([Capex $1.30/W -8%]) — click to reset
  just that one input. Replaces the unreadable dot-separated summary.
- **Save flow**: name input → insert into `scenario_snapshots` → green
  "Saved [name]" badge lingers 2.5s + toast.
- **Vertical history list** (new `<ScenarioHistoryList>` component
  reused in Studio + Library Scenarios tab) showing each saved
  scenario with timestamp + 4 metrics + delta-vs-baseline + a "↳
  inputs" sub-line so two saves with the same preset name are
  immediately distinguishable. Confirm modal on delete (no auto-delete).
- **Project-link wiring**: Search.jsx looks up matching saved project
  by state+county+technology and threads the project_id into save.
- **Orphan auto-promote**: when user saves a project from Lens, any
  pre-existing scenarios with matching context (within last 7 days)
  auto-attach to the new project. Toast confirms "N scenarios attached".
- **Library "Scenarios" tab** alongside "Projects" — groups all of the
  user's scenarios by Lens context (state + county + tech). Exploration
  groups (project_id null) get an amber "Exploration · not yet in
  Library" badge + "Open in Lens to save →" CTA that auto-runs Search
  with the context pre-filled.
- **Library card chip** promoted to the card header as a teal
  "Scenarios · N" badge (was buried below the action footer). Click
  expands the card + opens the picker.
- **PDF export** — `ProjectPDFExport` accepts an optional `scenario`
  param and renders a 2×4 metric grid + summary + disclaimer in the
  Deal Memo. Saved scenarios also ride the existing `/memo/:token`
  share flow when selected via "Include in PDF" toggle.
- **9 new glossary entries** for the financial terms (IRR, LCOE, NPV,
  Lifetime Rev, Equity IRR, DSCR, Opex, Discount Rate, Contract Tenor)
  — each documents the exact assumption being modeled.
- **Migration 041** — `scenario_snapshots` table with user_id +
  nullable project_id + jsonb (baseline_inputs, scenario_inputs,
  outputs). RLS owner-only. Append-only (no update/delete policy
  beyond cascading project deletes).

### Phase 4 — coverage expansion (`251bc38`)
- **C&I offtake: 12 → 32 states.** Calibrated against EIA Form 861
  commercial retail rates (2024) + qualitative market-depth adjustments.
  Added: ISO-NE (RI/NH/VT) · PJM (DC/DE/PA/OH) · MISO (MI/WI/IN/MO)
  · CAISO + SW (CA 88 / AZ / NV) · ERCOT + South (TX 62 — low retail
  offset by huge market / FL / NC / GA / SC) · SPP (NM).
- **BESS offtake: 8 → 25 states.** Calibrated against ISO/RTO
  capacity-market clearing prices + state storage carve-outs.
  Added: CAISO (CA 88) · ERCOT (TX 85) · PJM (VA/PA/OH/DE/DC) · SW
  (AZ/NV/NM) · MISO (MI/WI) · PNW (WA/OR) · SE (FL/NC/GA).
- All existing 18 states' scores preserved — no regression. Inline
  per-ISO calibration comments make future tweaks auditable.

### Bonus — churn defense flow (`fd621a0`)
- **Pre-cancel exit-intent survey.** "Manage subscription →" stays
  zero-friction (for payment method updates), but a separate
  "Considering canceling?" link below opens a modal with reason radios
  (pricing / missing_feature / wrong_fit / just_exploring /
  data_coverage / other) + free-text capture before handoff to Stripe
  portal.
- Email + tier snapshotted at submit time so the row stays meaningful
  even after the user is downgraded.
- **Migration 042** — `cancellation_feedback` table with own-rows-only
  RLS. Append-only — no update/delete policy.
- Client-side direct insert via RLS rather than a new API endpoint
  (we're at the Vercel Hobby 12-function cap).

### Polish bundle (`357d7f9`) — field-test feedback
- Best/Worst buttons: cursor-pointer + hover-brighten + dropped native
  title= tooltips (read as passive labels before).
- Delete on scenarios: confirm Dialog at both entry points (Studio
  history trash + Library card picker ✕).
- "Orphan" → "Exploration" in user-facing copy (state name stays
  `orphanScenarios` in code).
- Lens auto-search loosened: required state+county+mw+stage+technology
  → now just state+county+mw. Stage + tech are optional. Eliminates the
  "I clicked re-analyze but it didn't run" footgun.
- WoW state-delta chip: native title= → Radix Tooltip with proper
  styling (matches IX · Live tooltip treatment).
- StagePicker + Scenarios badge: native title= → aria-label (no
  visible tooltip — the labels carry their own meaning).
- Save button: lingers as green "Saved [name]" checkmark for 2.5s
  after success.
- Modified-inputs row: dot-separated string → pill chips (described
  above in Phase 2).
- Saved-scenarios history rows: added inputs-summary sub-line so two
  saves with the same name don't look identical.
- Navy output card: padding p-4 → p-3.5, gap-3 → gap-2.5 to reduce the
  dark expanse Aden flagged.
- Verified $/W consistency for capital metrics — capex + IX both
  render `$X.XX/W` everywhere (other units like $/MWh for REC + $/kW/yr
  for opex are conventional and kept).

---

## ✅ Shipped 2026-05-01 — Path B: county_geospatial_data (`7c49c5c`)

**Single large commit closing out a multi-session estimate in one session.**
Pre-work probes (in `scripts/probe-fips-conventions.mjs` and
`scripts/probe-geospatial.mjs`) validated the approach before touching
production code: confirmed all 4 county-keyed tables share `county_fips`
text PK with leading zeros, validated the USFWS NWI ArcGIS outStatistics
query against `Wetlands.ACRES` table-qualified, validated the USDA SSURGO
T-SQL aggregate of `farmlndcl IN (...)` returning whole-state prime-farmland
percentages in <100ms.

**`7c49c5c` — Path B build.** Replaces the silent `site=60` fallback for the
32 states that lack a `county_intelligence` default row with derived
signals from authoritative federal sources, covering all 3,142 counties.

- **Migration 039** — `county_geospatial_data` table keyed on `county_fips`,
  fields `wetland_coverage_pct`, `wetland_category`, `prime_farmland_pct`,
  separate `*_last_updated` timestamps because the two sources refresh at
  different cadences. Wetland category is bucketed (minimal/moderate/
  significant/severe) since raw NWI % can exceed 100% from polygon overlap
  + water inclusion (calibrated thresholds in the migration comment).
- **SSURGO refresh** — wired into the multiplexed `refresh-data.js` as
  `?source=geospatial_farmland`. Single T-SQL aggregate query covers the
  whole US in ~5s. New 7:45 Sunday cron entry. AK skipped (137 NRCS
  regions vs 30 boroughs); CT/RI handled as statewide single-area
  assignments to all counties via `county_acs_data`.
- **NWI seed** — `scripts/seed-county-geospatial-nwi.mjs`. Runs locally
  with 4x parallelism (~1.5h for 3,142 counties — too long for the 300s
  Vercel ceiling). Idempotent + resumable via `--refresh` flag (skips
  counties updated within 90 days).
- **scoreEngine** — three-layer site sub-score: live geospatial → curated
  `county_intelligence` → `site=60` baseline. Backward-compatible — when
  geospatial row is absent, the curated path runs with no behavior change.
  `coverage.site = 'live'|'researched'|'fallback'` exposed.
- **programData.getCountyData** — augmented to fetch `county_geospatial_data`
  via `county_fips` (resolved through `county_acs_data`, same FIPS bridge
  as `getNmtcLic`/`getHudQctDda`) and merge as `countyData.geospatial`.
  No frontend changes required — the data block just gets richer.
- **lens-insight context** — when geospatial is present, the AI prompt
  receives live numeric inputs (prime farmland %, wetland coverage %,
  NWI feature count) and an explicit `COVERAGE: live geospatial` line so
  the dossier reasons honestly about authoritative sources.
- **UI** — small teal **"Site · Live"** pill in the Lens result eyebrow,
  mirroring the IX · Live treatment. Radix tooltip explains inputs +
  thresholds. Absent (honest signal) for counties without a geospatial row.

`npm run verify` green (build + 7 smoke tests, ~12s).

---

## ✅ Shipped 2026-04-30 — IX score live-blend + Lens loader polish

Three commits closing out the long evening session. Together they shift
the IX sub-score from purely curated to a calibrated blend of curated +
live ISO/RTO queue signals, surface that honestly in the UI, and fix
the Lens loader stall.

**`e9506a7` — IX score live-blend.** `computeSubScores` now optionally
accepts an `ixQueueSummary` arg. When present + non-empty, applies a
clamped (±10) adjustment based on `avg_study_months` and total
`mw_pending`. Thresholds calibrated from the actual `ix_queue_data`
distribution (probe: `scripts/probe-ix-queue.mjs`):
- avg_study_months: <14mo +5 / 14-19 0 / 20-23 -3 / 24+ -8
- total mw_pending: <500 +3 / 500-999 0 / 1000-1499 -3 / 1500+ -6

New `coverage.ix = 'live' | 'curated'` flag. Library + Profile call
sites pass 4 args (no ixQueueSummary), so they stay on curated path.
Search.jsx passes the already-fetched `results.ixQueueSummary` →
Lens-only live blend, no regression elsewhere. Coverage today: 8 of
50 states (CO/IL/MA/MD/ME/MN/NJ/NY) — concentrated on the highest-
volume CS markets.

**`7d474e1` — IX · Live tooltip polish.** Replaced the native browser
`title` attribute with a Radix portal tooltip styled to match the
methodology popover at `Search.jsx:479` — dark navy bg, teal border,
structured headings + INPUTS / CLAMP / coverage-policy footnote.
Reads as research-note documentation, matching the Lens chrome
convention.

**`e4c6666` — Lens loader asymptote.** Halo arc was `p = (elapsed/14s)*88`
linear-then-stop, which produced a visible stall at 88% on every run.
Replaced with `p = 95 * (1 - exp(-elapsed/8s))` and removed the RAF
exit guard. Result: motion never freezes (sub-pixel asymptotic creep
even on 60s outliers), and the snap-to-100% on completion always has
5+ points of headroom for a clean landing.

---

## ✅ Shipped 2026-04-30 — Library WoW + freshness signal

Two retention-driving surfaces added on the Library page in parallel
to the Dashboard hero indicator (`e2c8b48`):

**Freshness signal** — small mono "Data refreshed [date]" caption with
teal breathing dot under the hero meta line. Amber when underlying
program data is >14d old. Tooltip explains scores are recomputed from
this snapshot on every load. Same retention rationale as the Dashboard
version: Library is the daily-driver surface, so the live-data promise
needs to stay visible on the user's main return loop.

**WoW score-delta chip** — when a saved project's state has moved
week-over-week in `state_programs_snapshots`, a "State ±N pt" pill
renders in the project-card chip row. Teal up / amber down. Honestly
labeled "State" because the source is state-level program snapshots,
not per-project history; tooltip explains the project's blended score
may differ. Falls back to silent when delta is null/zero — no visual
noise pre-data. Lights up automatically once history accrues (~2 weeks
post-migration-038).

**One file changed:** `src/pages/Library.jsx` (~50 LOC). No new RPC,
no new migration, no new dependency — piggybacks on the existing
`getStateProgramDeltas()` already shipped for Markets on the Move
(`5c30369`). Verified via `npm run verify:full` (14 tests green).

---

## ✅ Shipped 2026-04-30 — Pro-flow smoke tests (`5b6a7a0`)

Five files changed:

- `tests/auth.setup.js` (new) — drives `/signin` with creds from `.env.local`,
  saves storage state to `tests/.auth/pro-user.json`
- `tests/pro-smoke.spec.js` (new) — 6 tests covering home (Dashboard
  resolution), Search past paywall, Library past paywall, Library
  empty-state preview, Profile + Pro-badge, /preview when authed
- `playwright.config.js` — added `setup` + `pro-chromium` projects with
  glob testMatch
- `package.json` scripts — `test:smoke` now unauth-only; new
  `test:smoke:pro`, `test:smoke:all`, `verify:full`. `npm run verify`
  unchanged (build + unauth smoke).
- `.gitignore` += `tests/.auth/`. `.env.example` += test-account setup
  instructions.

**Before committing — one-time setup the user must do:**

1. **Create the test account** in the live app (sign up via UI, e.g.
   `smoke-test@tractova.com` with any password).
2. **Flip it to Pro** via Supabase SQL editor:
   ```sql
   update profiles
      set subscription_tier='pro',
          subscription_status='active'
    where id = (select id from auth.users where email='smoke-test@tractova.com');
   ```
3. **Drop creds in `.env.local`:**
   ```
   TEST_USER_EMAIL=smoke-test@tractova.com
   TEST_USER_PASSWORD=<the password>
   ```
4. **Run `npm run test:smoke:pro`** — should pass 6 tests in ~10-15s.
5. **Then `npm run verify:full`** to confirm the full suite is green
   before committing.

**`npm run verify` keeps working with no creds set.** It runs build +
unauth smoke (the existing 7 tests). Use `verify:full` once Pro creds
are in place.

**No live API calls in any test.** Lens form submissions are deliberately
not exercised — the smoke is render-and-watch-for-console-errors. Cost
per run: $0.

**Deferred items, in priority order (unchanged from prior session):**
- **Library WoW score deltas + freshness signal** (parallel to
  Dashboard hero) — ~2 hours, retention-driving.
- **Expand curated economic coverage to top-10 solar markets**
  (CA, TX, FL, NC, AZ, GA, NV, NM) — biggest single-move leverage.
  EIA Form 861 + ISO capacity markets publicly sourced. ~4-8h/state.
- **Apply pending migrations 034-037** (HUD QCT/DDA + NMTC LIC) in
  Supabase SQL editor.
- **Wetlands + farmland data layers** — 3-4 day R&D + spatial join.

**Coverage gap (unchanged):** only 18 of 50 states have a `default`
county_intelligence row. Missing: AK, AL, AR, AZ, DE, GA, IA, ID, IN,
KS, KY, LA, MO, MS, MT, NC, ND, NE, NH, NV, OH, OK, PA, SC, SD, TN,
TX, UT, VT, WI, WV, WY.

**Run `npm run verify` before pushing any visible-feature change.**

---

## ✅ Shipped 2026-04-30 — Score honesty pass (`596de4b` + `d4061d2`)

**Two layered fixes** addressing the same trust-erosion class:
silent baseline fallbacks in the Lens scoring engine that produced
research-grade-looking numbers from placeholder values.

### `596de4b` — offtake coverage
**The bug.** Customer could pick BESS/C&I/Hybrid for any of 50
states in `/search`. `CI_OFFTAKE_SCORES` (12 states) and
`BESS_OFFTAKE_SCORES` (10 states) silently fell back to 55/45 for
uncovered states. The revenue panel honestly said "model not
available" but the feasibility number looked researched.

**The fix.** `computeSubScores` returns `coverage: { offtake }`.
`MarketPositionPanel` renders a "Limited offtake coverage" caption
listing curated states. `api/lens-insight.js` adds a `COVERAGE
NOTE` instructing the AI to speak directionally for uncovered
geographies (no fabricated $/kW or PPA cents/kWh).

### `d4061d2` — site coverage (parallel)
**The bug.** Only 18 of 50 states have a `default`
county_intelligence row seeded. For the other 32 states, the Site
Control sub-score silently defaults to 60. Same trust issue.

**The fix.** `coverage.site` = `'researched' | 'fallback'`. The
caption block consolidated into one "Limited coverage — directional
only" panel with per-pillar bullets (offtake, site) so common-case
where both fire stays visually clean.

**What this didn't change.** All 50 states still receive full Lens
analysis on the data side. State programs all 50, IX difficulty all
50, IRA/HUD/NMTC overlays all 50. Only the **economic** and
**county-level site** layers honestly signal coverage now.

---

## ✅ Shipped 2026-04-30 — Tailwind v4 + Vite 8 + shadcn integration

Cleaner than the BUILD_LOG plan estimated (~1.5h vs 3-5h budgeted)
because the codebase had **zero `@apply` usage**, no Tailwind plugins,
and a simple custom palette — the official codemod handled almost
everything mechanically.

**Three commits, merged to main as `475a095`:**

- `3e7df8e` — Tailwind v3.4.6 → v4.2.4, Vite 5.3.4 → 8.0.10. Codemod
  migrated 35 files. JS config (`tailwind.config.js`) replaced by
  CSS-first `@theme` block in `src/index.css`. Class-name renames:
  `flex-shrink-0` → `shrink-0`, `focus:outline-none` →
  `focus:outline-hidden`, `rounded` → `rounded-sm`, `rounded-sm` →
  `rounded-xs`. Border-color compat shim added (v4 default changed
  from gray-200 to currentcolor). autoprefixer dropped (v4 has its
  own). Build time 22s → 4s thanks to Rolldown.

- `55f3fc7` — shadcn/ui integrated, scoped to its own directory at
  `src/components/shadcn/ui/` so primitives never collide with our
  existing custom UI in `src/components/ui/`. Pruned shadcn's
  universal CSS overrides (Geist font import, `* { @apply
  border-border }`, body/html @applies, `--font-sans` /
  `--color-primary` / `--color-accent` overrides in @theme inline).
  shadcn primitives now inherit our brand (teal primary, amber
  accent, Inter font) automatically. Smoke-test components: `card`,
  `badge`. Added `jsconfig.json` + `vite.config.js` `@/*` alias.

- `475a095` — merge commit.

**Audit impact:** vite + esbuild moderate vulns cleared (confirmed
locally). Remaining 6 high are all pre-documented accepted-risks
(`xlsx` + `react-simple-maps` / d3-color chain).

---

## ✅ Resolved 2026-04-30 — refresh pipeline + Census 503 saga

The data refresh that started yesterday with the NMTC wildcard bug is
now fully shipped. Diagnostic endpoint (`/api/refresh-data?debug=1`,
auth-bypass, fully redacted) confirmed Census API + key + Vercel
egress are all healthy: HTTP 200 in ~470ms with valid ACS data. User
clicked Refresh → **5/5 endpoints OK in 20.7s**, all 8 sub-sources ✓.

The remaining work was the durability layer — **stale-tolerance** for
the three Census handlers (`d8be8ef`). When Census 503s and our last
successful pull is <90 days old, the panel goes amber with a
`stale-ok · last good Nd ago` badge instead of red. ACS publishes
annually so this is the right semantics. Server keeps `ok: false` on
the actual failure so `cron_runs` records honestly and the next
stale-check finds the real last-good run.

---

## Status snapshot

- **Branch:** `main` · last commit `b15228a` G.5 (universal IRR ≤ 0 → dash). **Plan F + Plan G arc COMPLETE** across 18 commits over 2 sessions: critical white-screen + scenario fixes (F.0–F.6), mobile gate + favicons (F.7–F.9), Equity IRR + DSCR on OfftakeCard panels (G.1), full Hybrid Scenario Studio with dual capex sliders (G.2), dependabot patched + 3 stale allowlist entries removed (G.3), BESS rates chip overflow + Radix tooltip (G.4), universal IRR-zero-dash rule (G.5). **Mobile gate live** — phones see "use desktop until app ships" message with sessionStorage-dismiss for power users. Test counts: 62 unit (was 51) + 7 smoke unchanged. npm-audit: 6 high observed across 3 GHSA IDs, all on allowlist with current rationale. **Aden-side queue:** open backlog → manual site walkthrough; verify BESS NY + Hybrid in NY/IL on prod after deploy. Pickup item: **`computeIRR` solver stability** (bisection fallback / smarter starting guess) — separate health concern flagged in G.5; current dash rule masks the symptom but the underlying Newton-Raphson is unstable on near-degenerate cashflow streams.
- **Branch:** `main` · last commit `c08fed2` Plan E Sprint E.3 (Search.jsx 3,036 → 1,384 LOC). **Plan E COMPLETE** — locs-allowlist.json `exceptions` array is EMPTY; all 3 page-level files (Library 1,215 / Admin 603 / Search 1,384) now under the 1,500 LOC global budget without exceptions. **Axiom logging confirmed live** in production. Codebase health end-of-arc: 0 broken imports / 0 orphans / 0 console.log drift / 0 TODOs / 0 LOC budget breaches / 51 unit + 7 smoke + 16 mobile + 10 mobile-pro tests all green / npm-audit moderate count 2 (down from 4). **Aden-side queue: empty.**
- **Branch:** `main` · last commit `3127b6b` merge dependabot minor-and-patch group bump (6 deps: anthropic-ai-sdk 0.91.1→0.95.1, react-pdf-renderer 4.4→4.5, supabase-js 2.103→2.105, stripe 22.0→22.1, postcss 8.4→8.5, vite 8.0.10→8.0.11 — all minor/patch within-major; full verify chain green incl. smoke). **Axiom logging confirmed working in production** as of 2026-05-07; events flowing reliably with the awaited-fetch fix. **All 6 major-bump dependabot PRs auto-cleaned up** by Dependabot after our config block on major-version bumps (`a7f99b5`) took effect — branches no longer exist on remote. **Aden-side queue:** empty.
- **Branch:** `main` · last commit `5cc5db7` Plan D.4. Plan D cleanup sweep complete (4 commits: D.1-D.4) on top of Plan C COMPLETE state. Single supabaseAdmin client (was 18); single statusMaps.js source for IX_LABEL + CS_STATUS_LABEL (was 5 inlines); 12 previously-untracked probe + site-walk files now in git; site review archived. lint coverage: 307 tracked files for secrets, 57 for api/**/*.js.
- **Branch:** `main` · last commit `1e5bad5` Plan C Sprint 2.6. **Plan C COMPLETE** (Phase 0 + Phase 1 + Phase 2 all done, 9 commits this session). Migration 060 applied. Security 8.0 → ~9.3 / Engineering 6.5 → ~9.0 with measurable evidence (allowlist-aware audit, CSP + cross-origin, rate limits, webhook idempotency, 5 mega-files decomposed, JSDoc on hot exports, lint-locs CI gate). **Awaiting Aden:** (1) configure Vercel Log Drain destination per `docs/runbooks/observability.md` + record token in 1Password; (2) re-install pre-commit hook on any fresh clone (`node scripts/install-git-hooks.mjs`).
- **Branch:** `main` · 4-session site-walk fix sweep complete (commits `a1c00dd`, `1268cbc`, `288b1be`, `19b2638`, `445bce9`, `a456cca`) closing ~35 of ~40 review items. Highlights: favicon + sub-header recolor, ambient-animation gutter-mask, Active/Pending/No Program + Site Control tooltips, scrollable Data Limitations modal, Dashboard freshness via cron_runs (matches Footer), Admin LIVE/CURATED/SEEDED freshness chips, state-baseline-vs-project score line in Lens, NWI/SSURGO percentages surfaced in Site Control tiles, scenario presets recalibrated + methodology tooltips, jump-to-glossary in CommandPalette, scenario-save Library confirmation card, source-link audit (4 broken URLs replaced), Compare AI collapsible + insightType + sub-score rows, Library Select-all, 18+ signup checkbox, Terms § 04 strengthened with civil-action language. Pending Aden's input: analyst-brief verbosity redesign, CSV/XLSX consolidation, hello@ DNS setup.
- **NWI catch-up seed completed.** 1522 of 2144 queue items succeeded; 622 NWI server timeouts (concentrated in ND/SD where the server throttled). Live coverage went from **79.9% → 92.1%** (gained 382 new counties). 249 counties still missing — a second `--refresh` run would catch most of the timeouts.
- **Live data layers (all .gov / authoritative-source verified):**
  - `lmi_data` (state-level Census ACS)
  - `county_acs_data` (3,142 counties Census ACS)
  - `state_programs` + DSIRE verification
  - `revenue_stacks` + DSIRE verification
  - `news_feed` (RSS + Claude Haiku 4.5 classifier)
  - `energy_community_data` (DOE NETL EDX — IRA §45/§48 +10% ITC)
  - `hud_qct_dda_data` (HUD User — LIHTC LMI overlay)
  - `nmtc_lic_data` (Census ACS + CDFI methodology — IRA §48(e) Cat 1 +10% ITC)
  - `ix_queue_data` (ISO/RTO weekly scrapers)
  - `substations` (EIA Form 860 monthly)
  - `revenue_rates` (NREL PVWatts + EIA quarterly)
- **Multiplexed cron:** Two staggered Sunday runs to fit Hobby gateway window — `?source=fast` at 07:00 (7 quick sources) + `?source=nmtc_lic` at 07:30 (NMTC alone, ~50-70s due to 51-state iteration). Plus 3 separate cron functions for substations / IX queue / capacity factors (Hobby 12-function cap).
- **Admin manual refresh:** `/admin > Data Health > Refresh data from sources` parallel-fans-out to all **5 endpoints** (fast bundle + NMTC + substations + ix_queue + capacity) with admin JWT auth. Each endpoint has its own gateway window so a slow source can't drag the rest.

---

## Pending Supabase migrations

User runs these manually in Supabase SQL editor. Mark applied here when done.

✅ All migrations through 038 applied as of 2026-04-30 (verified via
`scripts/check-migrations.mjs` against the live DB — hud_qct_dda_data
has 1,801 rows, nmtc_lic_data has 3,144 rows, freshness RPC includes
both blocks).

| # | File | What it does | Status |
|---|------|--------------|--------|
| 028 | `news_feed_auto.sql` | RSS+AI ingest columns | ✅ |
| 029 | `revenue_stacks_dsire.sql` | DSIRE verification columns | ✅ |
| 030 | `data_freshness_rpc.sql` | RPC v1 | ✅ |
| 031 | `data_freshness_cron_driven.sql` | RPC reads cron_runs | ✅ |
| 032 | `energy_community_data.sql` | Energy Community table | ✅ |
| 033 | `freshness_energy_community.sql` | RPC +energy_community | ✅ |
| 034 | `hud_qct_dda_data.sql` | HUD QCT/DDA table | ✅ |
| 035 | `freshness_hud_qct_dda.sql` | RPC +hud_qct_dda | ✅ |
| 036 | `nmtc_lic_data.sql` | NMTC LIC table | ✅ |
| 037 | `freshness_nmtc_lic.sql` | RPC +nmtc_lic | ✅ |
| 038 | `state_programs_snapshots.sql` | Wave 1.4: append-only feasibility-score history table for WoW deltas + Markets on the Move trends | ✅ |
| 039 | `county_geospatial_data.sql` | Path B: per-county wetland coverage % (NWI) + prime farmland % (SSURGO) for all 3,142 counties — closes Site Control gap | ✅ |
| 040 | `dashboard_metrics_last_refresh.sql` | get_dashboard_metrics() returns lastRefreshAt from cron_runs so the Footer's "Data refreshed" caption reflects actual cron freshness rather than state_programs.last_verified | ✅ |
| 041 | `scenario_snapshots.sql` | Phase 2 Scenario Studio: user-saved scenarios with nullable project_id (orphan promotion to project on save), state_id + county_name + technology context, jsonb baseline_inputs / scenario_inputs / outputs. RLS owner-only. | ✅ |
| 042 | `cancellation_feedback.sql` | Pre-cancel exit-intent survey capture: reason category + free-text + email/tier snapshot + destination ("staying" / "stripe_portal"). RLS append-only own-rows. | ✅ |
| 043 | `revenue_rates_v18_recalibration.sql` | Lazard v18 re-anchored seed; superseded by 044 for the CS $/W column. | ✅ |
| 044 | `revenue_rates_cs_lbnl_anchor.sql` | CS $/W re-anchored on NREL Q1 2023 CS MMP + LBNL TTS 2024 + Tractova 2026 forward (Tier A/B per-state). | ✅ |
| 045 | `revenue_rates_ci_lbnl_anchor.sql` | C&I $/W re-anchored same methodology -$0.05 C&I premium offset. | ✅ |
| 046 | `revenue_rates_bess_capacity_iso_anchor.sql` | BESS capacityPerKwYear re-anchored on 2024-25 ISO clearing × 4-hr accreditation. | ✅ |
| 047 | `revenue_rates_bess_demand_arb_anchor.sql` | BESS demand+arb documented + CA/HI refinements. | ✅ |
| 048 | `solar_cost_index.sql` | Phase B: per-state LBNL TTS observed PV installed-cost percentiles. Data-lineage layer; engine still reads Tractova-synthesized $/W from revenue_rates. | ✅ |
| 049 | `freshness_solar_cost_index.sql` | RPC + solar_cost_index block (row_count, states_covered, latest_vintage, last_updated, last_cron_success). | ✅ |
| 050 | `cs_projects.sql` | Phase C-pivoted: NREL Sharing the Sun ground-truth ingestion. ~3,800 individual operating CS projects with utility/developer/size/vintage/LMI attribution. | ⏳ |
| 051 | `freshness_cs_projects.sql` | RPC + cs_projects block (row_count, states_covered, latest_vintage, source_release, last_updated). | ⏳ |
| 052 | `solar_cost_index_confidence_tier.sql` | Phase E: confidence_tier (strong/modest/thin) + aggregation_window_years + CHECK n≥3. Tier-B prefix backfill on revenue_rates.notes for 9 states. | ⏳ |
| 053 | `cs_specific_yield.sql` | Phase G: per-project observed Specific Yield from Nexamp + SR Energy + Catalyze public fleet. capacity_basis (AC/DC), SY ∈ [600, 2400] CHECK. | ⏳ |
| 054 | `freshness_cs_specific_yield.sql` | RPC + cs_specific_yield block. | ⏳ |
| 055 | `drop_redundant_updated_at_triggers.sql` | Drop broken triggers on solar_cost_index / cs_projects / cs_specific_yield (generic touch_updated_at expected updated_at column; tables use last_updated). | ⏳ |
| 056 | `cs_status_corrections.sql` | Triage of 9 audit flags from the cs_status accuracy audit. HI/CT/NM/VA flip; FL/MA/TX/AR/GA stay (audit-flag annotations). | ⏳ |
| 057 | `admin_role_and_audit.sql` | profiles.role enum (admin/curator/user) + admin_audit_log table. Backfills aden.walker67@gmail.com → role='admin'. RLS policies deferred. | ⏳ |
| 058 | `rls_role_based_hardening.sql` | Sprint 6: role-based RLS policies on 11 admin-write tables (puc_dockets/comparable_deals/lmi_data/county_acs_data/energy_community_data/hud_qct_dda_data/nmtc_lic_data/county_geospatial_data/solar_cost_index/cs_projects/cs_specific_yield). New policies coexist with legacy email policies during rollout. is_admin() helper installed. | ⏳ |
| 059 | `drop_legacy_email_rls.sql` | Plan B B.7: drops every legacy email-based RLS policy (DO block scans pg_policies for `auth.jwt() ->> 'email'` literals, drops each). is_admin() helper retains the email fallback for belt-and-suspenders, but no policy depends on it after 059. | ✅ |
| 060 | `webhook_events_processed.sql` | Plan C Phase 1.4: Stripe webhook idempotency. Single-column PK table (event_id), RLS deny-all + service-role-only writes, 90d prune helper function. Closes race window where Stripe retries could re-link stripe_customer_id mid-checkout. | ✅ |

> **Verification protocol going forward:** before asking the user to
> re-run any migration, run `node scripts/check-migrations.mjs` (or
> a similar live-DB probe). The build-log state can drift from the
> live state when migrations are applied out-of-band.

---

## Recent builds (most recent first)

| Commit | Subject |
|--------|---------|
| `b15228a` | **G.5 — Universal IRR ≤ 0 → dash** (Studio + ProjectPDF + MemoView). User flagged equity IRR jumping between '—' and '−50.0%' on small slider moves. Diagnosis: Newton-Raphson (single 10% starting guess) is numerically unstable on near-degenerate cashflow streams (DSCR ~1.0, project IRR near the debt rate); the −50% was the floor clamp, not a meaningful number. A negative equity IRR IS mathematically real (the discount rate that NPVs the stream to zero) but it's a compound-discount artifact even pros misread. Applied dash rule across 3 surfaces; delta also hidden when value is dashed. Directional impact still communicated via Year 1 Rev Δ / Payback Δ / NPV Δ / DSCR Δ. Underlying computeIRR convergence stability noted as separate health concern (bisection fallback / smarter starting guess) — out of scope for the display fix. |
| `2dc9337` | **G.4 — BESS chip overflow + IRR-zero formatting.** (1) BESS "Rates as of" chip rendered the full ~150-char `BESS_RATES_AS_OF` lineage string and `shrink-0` pushed the parent flex container off the screen. Now splits visible chip text on '+' to show short vintage tag ("2025/26 ISO clearing × accreditation"); full lineage + caveat moved to a branded Radix tooltip (navy panel + teal eyebrow + Source Serif body) matching the rest of the app. Same Radix treatment also applied to the C&I rates chip (was native browser title). Added `flex-wrap` to the chip row. (2) `LeveragedReturnsRow` now shows '—' for any IRR ≤ 0 — pre-fix it would render the −50% clamp value or 0.0% on edge cases. DSCR keeps real values (0.85x is a meaningful "can't cover debt" signal). |
| `99f85b6` | **G.2 — Hybrid Scenario Studio (real first-class scenario tech).** Pre-fix: hybrid silently routed to community-solar in `normalizeTech` so users saw only the solar $/W slider with the storage cost frozen. Now: hybrid is its own tech end-to-end. NEW `computeHybridForScenario` calls computeRevenueProjection (solar) + computeBESSProjection (storage at 50% solar MW, 4-hr) and merges into a flat raw object. NEW `computeHybridOutputs` runs the combined cashflow through `computeLifecycleMetrics` so IRR / Equity IRR / DSCR reflect the full project, not either arm alone. Slider config: dual capex sliders ('Solar Capex' $/W + 'Storage Capex' $/kWh) + Solar Capacity Factor + standard lifecycle. Gated to the 8 states with both CS + BESS data (IL/NY/MA/MN/CO/NJ/ME/MD). Presets already handled both fields from F.8. 5 new unit tests; 57 → 62 total. |
| `f8a0d23` | **G.3 — Dependabot triage** (3 advisories patched upstream + allowlist tidy). Ran `npm audit fix` (non-breaking). Resolved fast-uri ×2 (just-allowlisted from F.9 — patched upstream same day), ip-address, plus moderate express-rate-limit cascade as a transitive consequence. Removed the 3 now-stale allowlist entries. Final: 6 high observed across 3 GHSA IDs (d3-color chain via react-simple-maps + xlsx ×2 SheetJS), all already on allowlist with current rationale + review_due. audit-check green: 3 advisories observed · 3 on allowlist. |
| `6506395` | **G.1 — Equity IRR + DSCR on every OfftakeCard tech panel.** User: "why is there no equity IRR calculated there?" — and the honest answer was that it WAS computed (in `scenarioEngine.computeLifecycleMetrics`) and shown in the Scenario Studio + project PDFs + memos, just never surfaced on the main Lens page where the OfftakeCards live. NEW `src/components/LeveragedReturnsRow.jsx` (~50 LOC) — 3-cell row showing IRR · project, IRR · equity (70/30 lev), DSCR · year 1. Tier-color accents matching host panel; DSCR cell red <1.20 (tight) / amber 1.20-1.30 / green ≥1.30 (healthy). Wired into all 4 panels (CS via RevenueProjectionSection, C&I + BESS + Hybrid inline) with a single computeBaseline call shared across branches. |
| `fe26b43` | **F.9 — Multi-format favicons + OG/Twitter preview image.** Site only shipped favicon.svg, so Google search snippets, iOS Safari, Android Chrome / PWA contexts, and social-link unfurls all fell back to old cached icons. Generated full asset set from `public/favicon.svg` via `@resvg/resvg-js` + `png-to-ico`: favicon.ico (16+32+48 multi-res), favicon-16.png, favicon-32.png, apple-touch-icon.png (180), icon-192.png, icon-512.png, og-image.png (1200×630). NEW `public/og-image.svg` source + NEW `public/site.webmanifest` (PWA + theme-color). NEW `scripts/build-favicons.mjs` for re-render on SVG edit. `index.html` now references all formats + Open Graph + Twitter Card meta. Note: Google snippet refresh lags 1-7 days; iOS home-screen + Slack/iMessage unfurls cache aggressively. |
| `1c2a65c` | **F.8 — BESS Scenario Studio: real $/kWh slider** (was inert $/W). Pre-fix: BESS had a disabled $/W capex slider since BESS isn't priced in $/W. Now: $/W slider dropped from BESS, replaced with a real $/kWh slider that actually moves IRR/payback/NPV. Slider baseline reads `installedCostPerKwh` from `BESS_REVENUE_DATA` — anchored on **NREL ATB 2024 Commercial + Utility-Scale Battery Storage** per existing `BESS_RATES_AS_OF` constant. Range baseline×0.5 to baseline×2; floor clamped at $150/kWh. SCENARIO_PRESETS best/worst now also multiply `capexPerKwh`. extractInputs populates field; computeBESSOutputs scales `installedCostTotal` AND `itcAnnualized` by `capexPerKwh / raw.installedCostPerKwh`. 6 new BESS-only unit tests. |
| `3648999` | **F.6 — Two ErrorBoundary-caught throws fixed at root.** (1) scenarioEngine `TypeError: Cannot read properties of null (reading 'toFixed')` on `/search?state=NY` — Radix Slider calls `format(value)` and value can legitimately be null when baseline doesn't apply to active tech (BESS has no capexPerWatt). All 8 format functions in scenarioEngine now null-guard and return '—'; added `disabled: ixCostPerWatt == null` for symmetry. (2) iOS Safari `WebSocket not available: The operation is insecure` — `useSubscription.js` calls `supabase.channel(...).subscribe()` on mount; on iOS Safari + restrictive configs the WebSocket upgrade throws synchronously. Wrapped in try/catch; realtime degrades silently (initial fetch already populated tier/status). |
| `591bb8b` | **F.7 — Mobile gate ("use desktop until app ships").** Tractova built for ≥1024px screens; phone layouts work post-F.6 but render at ~30% intended fidelity. Rather than ship a half-rendered experience, NEW `src/components/MobileGate.jsx` listens to (max-width: 767px) and renders a navy/teal panel with the message + a list of what works on desktop + a single "Continue to mobile site (limited)" link in muted text. sessionStorage dismiss for power users. Wired inside ErrorBoundary, outside AuthProvider. mobile.spec.js + mobile-pro.spec.js + mobile-audit.spec.js pre-dismiss the gate via `addInitScript` so audits keep verifying underlying pages render at small viewports. |
| `ec8f6c3` | **F.5 — Mobile hardening: drop backdrop-filter; gate dev-only API fetches.** (a) `LensOverlay.jsx` removed `backdropFilter: blur(6px)` + `WebkitBackdropFilter` (iOS Safari 15.0-15.3 has a known bug where backdrop-filter + position:fixed + inset:0 can render the overlay invisible). Bumped navy scrim opacity 0.94 → 0.96 to compensate visually for the lost blur. (b) Footer + Dashboard `last-refresh` fetch now gated on `import.meta.env.PROD` — Vite's dev server doesn't serve api/ functions, was throwing JSON parse error in every smoke run. |
| `d501307` | **F.3 — Capex slider: drop $4.00 ceiling, scale with baseline only.** User flagged: harder-cost states (HI $3.80, MA $3.31, CT $3.12) sat almost flush against the right edge of the capex sensitivity slider. Pre-fix: `Math.min(4.00, baseline*2)`. Now: `baseline×2` alone bounds the slider — HI gets $7.60 max (was $4.00), MA $6.62, CT $6.24, etc. Floor stays clamped at $0.60/W (no real CS project comes in under that). Updated 1 unit test to match. |
| `526fede` | **F.0 — Lens scenarios: green for savings, red for cost** (G.1 mention). Every sensitivity scenario hardcoded red on the revenue impact bar regardless of whether the scenario was a cost or savings (IX cost shock + IX fast-track savings + BESS demand upside all rendered red). Each scenario now declares its `tone: 'positive' \| 'negative'`; renderer maps to green-50/700/200 vs red-50/700/200 vs amber fallback. Tone assignments: positive (ix_easier, new_block, lmi_removed, ci_rate_rise, bess_demand_up); negative (ix_harder, program_caps, lmi_rises, ci_ppa_drop, ci_default, bess_cap_drop, bess_degrade, hybrid_itc_drop, hybrid_clip). |
| `040f48a` | **F.0 — Lens never-let-fetch-error-freeze-loading.** User reported BESS+NY froze on white screen during loading. Root cause: handleSubmit had no outer try/catch around the 9 parallel data fetchers; if any threw uncaught, `setAnalyzing(false)` never ran and the spinner was permanent. Wrapped in try/catch/finally; finally → setAnalyzing(false) unconditionally; catch surfaces toast.error. NY data probed and confirmed healthy (revenue_rates 9 bess_* fields, state_programs complete, ix_queue_data 1 row, county_intelligence 3+) — actual root cause was the missing safety net, not malformed NY data. |
| `b889ef2` | **F.0 — Mobile fix: drop COEP credentialless.** Plan C Phase 1 set Cross-Origin-Embedder-Policy: credentialless in vercel.json — works on Chromium but iOS Safari rejects the entire page when cross-origin sub-resources (Google Fonts CSS) lack explicit CORP headers. Removed COEP since we don't use SharedArrayBuffer; net security delta ~zero, mobile becomes usable. Kept COOP same-origin + CORP same-origin (no compat issues). |
| `ef5a98a` | **F.2 — Break the Search.jsx ↔ child-component import cycle.** 7 components in src/components/ imported helpers from src/pages/Search.jsx, which in turn imported each of those components. Cycles like that work on Chromium (forgiving module resolution) but fail to resolve on iOS Safari (TDZ on first paint → blank page) under specific Suspense orderings. Extracted to NEW `src/lib/searchShared.jsx` (~390 LOC, no JSX-tree deps): getMarketRank, STATUS_CFG, sanitizeBrief, SectionLabel, DataRow, EaseArcGauge, QueueBadge, RunwayBadge, CSStatusBadge, computeScoreDelta, buildSensitivityScenarios, CHIP_COLORS. Move was character-for-character. 7 importers updated. Search.jsx still re-exports for back-compat. Search.jsx 1,384 → 1,045 LOC. |
| `d6e80c3` | **F.1 — App-root ErrorBoundary.** Defense-in-depth against any render throw blanking the page. NEW `src/components/ErrorBoundary.jsx` (107 LOC, class component with `componentDidCatch` + `getDerivedStateFromError`). On error: navy panel with message, "Try again" button, "Copy diagnostics" button (writes error.stack + componentStack + UA + URL to clipboard). Wraps the entire route tree in App.jsx. This alone substantially fixed the "white screen on BESS+NY / mobile" symptom regardless of root cause; the F.2 cycle break + F.5 mobile hardening + F.6 null-deref / WebSocket fixes addressed the underlying causes. |
| `c08fed2` | **Sprint E.3** — `src/pages/Search.jsx` 3,036 → 1,384 LOC (-54%). Plan E COMPLETE. 17 components extracted to `src/components/`: SubScoreBar, RunIdMasthead, SectionMarker, CollapsibleCard, CardDrilldown, RevenueStackBar, RevenueProjectionSection, SolarCostLineagePanel, BriefDrilldown, LensScenarioRow, CustomScenarioInline, CustomScenarioBuilder, LensOverlay, FieldSelect, CountyCombobox, AddToCompareButton, MaybeLensPanels (4 conditional wrappers consolidated). 5 sibling components updated their imports. **`scripts/locs-allowlist.json` `exceptions` array is now EMPTY** — entire codebase under the 1,500 / 500 LOC budgets without exceptions. |
| `387834e` | **Sprint E.2** — `src/pages/Admin.jsx` 1,914 → 603 LOC (-69%). 13 components extracted to `src/components/admin/`: ComparableDealsTab, IXQueueTab, StagingTab, TestNotificationsTab (the 4 inline tabs), MissionControl (with co-located UsageStat), NwiCoverageCard, IxFreshnessCard, MonthlyCronCard, CurationDriftRow, CsStatusAuditRow, IxStalenessAlert, CronLatencyPanel. DataHealthTab.jsx flipped 3 imports from circular `'../../pages/Admin.jsx'` → sibling files. |
| `7d11350` | **Sprint E.1** — `src/pages/Library.jsx` 2,704 → 1,215 LOC (-55%). 9 components extracted to `src/components/library/`: ScoreGauge, PipelineProgress, StagePicker, CompareChip, ShareDealMemoButton, UtilityOutreachButton (with private ContextRow + KitSection helpers), MiniArcGauge, WeeklySummaryCard, EmptyStateOnboarding. ProjectCard.jsx + YourDealSection.jsx import paths updated. Library.jsx removed from locs-allowlist (was 2 → now 2 entries... agent removed Library, only Search + Admin remained until E.2/E.3). |
| `f0fe82c` | **deps + dependabot cleanup** — captured prior commit (3127b6b) merging the dependabot minor-and-patch group bump (6 deps: @anthropic-ai/sdk 0.91.1 → 0.95.1, @react-pdf/renderer 4.4 → 4.5, @supabase/supabase-js 2.103 → 2.105, stripe 22.0 → 22.1, postcss 8.4 → 8.5, vite 8.0.10 → 8.0.11) + BUILD_LOG capture. All 6 prior major-bump dependabot PRs auto-cleaned after the .github/dependabot.yml block on major-version bumps took effect. npm-audit moderate count dropped 4 → 2. |
| `cf912d4` | **Axiom logging confirmed live in production** + AXIOM_TOKEN row added to `docs/SECURITY_ROTATION_LOG.md` (annual cadence). First event landed 2026-05-07 22:54:11 with full metadata (route, error, deploy, region iad1, env). |
| `dfa36c3` | **axiom: await axiomLog in error paths** so fetch completes before serverless tear-down. Root cause for delivery: Vercel-Hobby serverless doesn't expose `event.waitUntil()`; fire-and-forget fetches get killed when handler returns. Fixed by making axiomLog awaitable + adding `await` at all 10 callsites (webhook ×2, lens-insight, refresh-data, refresh-substations, refresh-ix-queue, refresh-capacity-factors, send-alerts, send-digest, check-staleness). 8s AbortController hard timeout caps the worst-case latency penalty. |
| `c997fd6` | **axiom diagnostic** — read env vars at call-time (was module-load), added one-time-per-cold-start `[axiom] init: AXIOM_TOKEN=set...` warn so Vercel function logs surface env var state. Confirmed env vars reaching production functions correctly. |
| `1501988` | **Static bug scan + 23 orphan imports removed.** NEW `scripts/scan-bugs.mjs` — read-only scan for orphan imports, broken imports, console.log drift, silent catches, TODOs, useEffect-no-dep. Initial run found 0 broken / 0 console.log / 0 TODOs / 8 intentional silent catches / 23 orphan imports. All 23 orphans were leftovers from Sprint 2.3 decomposition (Search.jsx 16, Library.jsx 1, shadcn+ui 5, WalkingTractovaMark useRef). Removed. Build dropped 2.90s → 1.85s. |
| `69aa3a2` | **Mobile UX: 44px tap targets on header + auth + Glossary.** NEW `tests/mobile-audit.spec.js` — deeper mobile audit beyond overflow (tap targets, font sizes, truncation). Header buttons (Sign In + Get Started) bumped to explicit `min-h-[44px]` (was 32-40px). Auth form submits `py-2.5 → py-3` (40 → 44px). Glossary filter chips `py-0.5 → py-1.5` (22 → 32px). "Forgot password" + "see also" inline links got negative-margin'd hit-area expansion. Remaining flags are intentional (10px legal-page eyebrows, inline body-text links). 16/16 mobile + smoke + unit tests still green. |
| `a7f99b5` | **dependabot: block ALL major-version bumps for npm + GitHub Actions.** Hotfix. Dependabot opened 7 PRs in last cycle; 6 were breaking major bumps (react 18→19, react-dom 18→19, react-router-dom 6→7, recharts 2→3, actions/checkout v3→v6, actions/setup-node v3→v6) that failed `npm install`. Added wildcard `update-types: ['version-update:semver-major']` ignore rule. Major upgrades now require deliberate migration sprints. |
| `b752d11` | **Observability: Axiom HTTPS-direct logging (Hobby alternative to Vercel Log Drains).** NEW `api/lib/_axiomLog.js` (102 LOC) — fire-and-forget POST to Axiom ingest API, silent fail-open if env vars not set. Wired into 8 critical handler error paths (webhook, lens-insight, 4 cron handlers, send-alerts, send-digest, check-staleness). Manual probe via `scripts/probe-axiom.mjs` confirms Axiom-side works (200 OK + event in Stream). Vercel-side env var scoping pending Aden-side debug. |
| `b0a44ed` | **Move 28 research files from public/ to data/ (gitignored).** xlsx/pdf/csv reference data (EIA-860, NREL ATB, LBNL TTS, USPVDB, Sharing the Sun, state agency reports) moved to gitignored `data/` folder. Verified zero URL references first. Updated 7 scripts (probe + seed + aggregate) to read from new path. revenueEngine doc-comments updated. Build 6.16s → 2.34s (Vite no longer scans). |
| `5cc5db7` | **Plan D.4** — File hygiene. Tracked 9 probe scripts (probe-atb, probe-cs-projects, probe-ix-staleness, probe-phase-b, probe-sharing-the-sun*, probe-state-programs-stale, probe-status-state, probe-tts) + scripts/site-walk.mjs + docs/site-walk-checklist.md. Archived "Full Manual Site Review.md" → `docs/archive/site-review-2026-05-03.md`. lint:secrets coverage 226 → 307 files. |
| `b7b5198` | **Plan D.3** — Consolidate IX_LABEL + CS_STATUS_LABEL. NEW `src/lib/statusMaps.js` (single source of truth for chip labels). 5 src files updated: exportHelpers, CompareTray, ProjectPDFExport drop inline IX_LABEL const + import; Library.jsx replaces two inline exports with re-exports from statusMaps. Local intentional deviations preserved + documented (ProjectPDFExport verbose PDF labels; exportHelpers + CompareTray's `CS_LABEL = 'None'` brevity; alertHelpers + Search.jsx `IX_RANK` local with different sort orders). |
| `bb160a3` | **Plan D.2** — Consolidate supabaseAdmin client. NEW `api/lib/_supabaseAdmin.js` (single `export const supabaseAdmin = createClient(...)`). 18 inline-instantiating files updated to import from it. _aiCacheLayer.js + _scraperBase.js re-export so callers that already imported from those base modules keep working. Net -57 lines. Behavior unchanged — Vercel Fluid Compute reuses module instances anyway. |
| `f01b425` | **Plan D.1** — Drop per-state console.log spam in 2 cron handlers (refresh-capacity-factors logged 50× per quarterly run; refresh-substations logged 50× per monthly run). Aggregate completion logs kept. Audit-agent A claims of unused applyCors imports + unused IX_LABEL export verified false; no other changes. |
| `1e5bad5` | **Plan C Sprint 2.6** (final sprint of Phase 2) — Architecture docs + JSDoc + lint-locs CI budget gate. NEW `scripts/lint-locs.mjs` + `scripts/locs-allowlist.json` (29 files checked, 7 allowlisted, ratchet pattern matches audit-check). NEW `docs/architecture.md` (217 LOC, one canonical view of the module tree + Plan C decomposition history table + cron schedule reference + verify-gate sequence + "where to look for what" lookup). JSDoc on every hot export across scoreEngine/revenueEngine/scenarioEngine/lensHelpers/alertHelpers/exportHelpers/markdownRender/adminHelpers/formatters — cheap halfway point to TS. `npm run verify` chain + `.github/workflows/verify.yml` extended. Verified: lint:api ✓, lint:locs ✓ (0 breaches), test:unit ✓ (51/51), build ✓. |
| `948d920` | **CSP fix** — added `https://cdn.jsdelivr.net` to `connect-src` in `vercel.json`. Aden flagged that the preview-website Dashboard map wasn't rendering; root cause was the strict CSP shipped in Phase 1 (b8f5e5f) blocking the topojson fetch in `src/components/USMap.jsx:5` (react-simple-maps loads geo data via XHR, which goes through `connect-src`). Restoration of intended behavior, not a posture downgrade. Self-hosting us-atlas in /public is a future cleanup that lets us drop this allowance. |
| `2ea5f3b` | **Plan C Sprint 2.5** — `src/pages/Admin.jsx` (3,425 LOC) → 6 tabs + helpers. NEW `src/components/admin/{StateProgramsTab,CountiesTab,RevenueRatesTab,NewsFeedTab,PucDocketsTab,DataHealthTab}.jsx` (subdirectory because the 6 tabs are clearly Admin-scoped). NEW `src/lib/adminHelpers.js` (endpointStatus + buildReportText + daysSince + freshnessColor pure helpers). Admin.jsx shrinks 3,425 → 1,914 LOC (-44%). ComparableDealsTab + IXQueueTab + StagingTab + TestNotificationsTab left inline (their state shape interlinks; not worth disturbing). Inline helpers (Field, ReadOnlyCell, SaveBar, Badge, plus all the DataHealth sub-cards: MissionControl, NwiCoverageCard, IxFreshnessCard, MonthlyCronCard, etc.) gained `export` keywords for the tab files to import. Cleanup: stripped unused imports (`getStatePrograms`, `getNewsFeed`, `computeFeasibilityScore`, `invalidateCacheEverywhere`, `TractovaLoader`, etc.). Verified end-to-end: lint:api ✓ (36 files), test:unit ✓ (51/51), build ✓ (7.66s, Admin chunk 112 kB), test:smoke ✓ (7/7 in 12.8s). |
| `1154913` | **Plan C Sprint 2.4** — `src/pages/Library.jsx` (4,379 LOC) → 5 components + 4 helper modules. NEW `src/components/{AlertChip,ProjectAuditTimeline,ScenariosView,ProjectCard,YourDealSection}.jsx`. NEW `src/lib/{alertHelpers,exportHelpers,formatters}.js` + `markdownRender.jsx` (.jsx because the helpers return JSX elements; vite-plugin-react only transforms .jsx by default). Library.jsx shrinks 4,379 → 2,703 LOC (-38%). Function bodies copied character-for-character; smoke 7/7. Inline helpers (StagePicker, CompareChip, ShareDealMemoButton, UtilityOutreachButton, MiniArcGauge, ScoreGauge, PipelineProgress + IX/CS_STATUS style constants) gained `export` keywords. Cleanup: stripped unused imports. |
| `3aeb02d` | **Plan C Sprint 2.3** — `src/pages/Search.jsx` (5,105 LOC) → 6 panels + helper. NEW `src/components/{ArcGauge,MarketPositionPanel,SiteControlCard,InterconnectionCard,OfftakeCard,MarketIntelligenceSummary}.jsx` + NEW `src/lib/lensHelpers.js` (generateMarketSummary). Search.jsx shrinks to 3,038 LOC (-40%). Function bodies copied character-for-character; JSX call sites unchanged. Several inline helpers gained `export` keywords because the new panels import them (circular import safe — references inside function bodies). Verified end-to-end: lint:api ✓ (36 files), test:unit ✓ (51/51), build ✓ (5.1s), test:smoke ✓ (7/7 Playwright in 13.5s — hits the actual populated Lens flow which would surface any prop-name typo or missing import as a render error). |
| `1640587` | **Plan C Sprint 2.2** — `api/lens-insight.js` (1,366 LOC) → 9 prompts + cache + thin handler. NEW `api/prompts/{system,portfolio,compare,sensitivity,scenario-commentary,news-summary,deal-memo,utility-outreach,classify-docket}.js` (one file per prompt template, byte-for-byte copies). NEW `api/lib/_aiCacheLayer.js` (buildCacheKey, cacheGet, cacheSet, dataVersionFor — reusable for any future AI feature). Scenario-shape helpers co-located with the scenario-commentary prompt. lens-insight.js shrinks to 1,003 LOC; still holds the 10 routed handlers + buildContext + parseInsightResponse + the two-tier rate-limit block from Phase 1.3. Verified: lint:api ✓ (36 files), test:unit ✓ (51/51), build ✓ (5.82s). |
| `5aa2b82` | **Plan C Sprint 2.1** — `api/refresh-data.js` (2,493 LOC) → 10 scrapers + thin orchestrator. NEW `api/scrapers/_scraperBase.js` (211 LOC, shared utilities) + 10 individual `_refresh-{source}.js` files. Private helpers stay local where single-consumer (RSS parsing in news, ssurgoQuery in geospatial-farmland, ttsAssignTier in solar-costs, CS_NAME_KEYWORDS in state-programs). Orchestrator shrinks 2,493 → 163 LOC. `scripts/lint-api.mjs` upgraded to recurse into api/**/*.js (was scanning top-level only — 13 → 26 → 36 files lint coverage as the API tree decomposed across this and the next two sprints). Verified end-to-end. |
| `b8f5e5f` | **Plan C Phase 1** — Security to 9+. (1) **CSP + COOP/COEP/CORP** in `vercel.json`: Content-Security-Policy locks script-src 'self', connect-src to Supabase/Anthropic/Stripe/Resend, frame-src to Stripe, frame-ancestors 'none'. COOP same-origin + COEP credentialless (Google Fonts compatible) + CORP same-origin. SRI on Google Fonts deferred (Google rotates CSS per UA — CSP allow-list is equivalent defense). (2) **Rate limiting** via NEW `api/_rate-limit.js` shared helper: 5/hour/user on `api/create-checkout-session.js`; 5/hour/admin on `api/send-alerts.js` test mode. Mirrors lens-insight's working pattern; silent-fail-open. (3) **Stripe webhook idempotency** via NEW migration **060** (event_id PK, RLS deny-all, 90d prune fn) + dedup probe in `api/webhook.js` BEFORE side effects. (4) **Observability runbook** (`docs/runbooks/observability.md`) — documents the 4 existing log layers (cron_runs, api_call_log, admin_audit_log, webhook_events_processed) + Vercel Log Drains setup + 3am incident-response quick reference. (5) **auth.users export** via NEW `scripts/export-auth-users.mjs` wired into `dump-supabase-snapshot.mjs`. Fully-restorable snapshot in one command. |
| `1a9d1a8` | **Plan C Phase 0** — Allowlist-aware audit + CI/pre-commit secret-scan parity. Discovered shadcn 4.6→4.7 doesn't close ip-address chain (transitive via @modelcontextprotocol/sdk → express-rate-limit) — every remaining vuln is upstream-blocked. Pivoted from `--audit-level=high` CI gate to NEW `scripts/audit-check.mjs` + `scripts/audit-allowlist.json`: 4 root advisories (the 10 npm-audit rows cascade from these) documented with reason + first_seen + review_due. CI fails on (a) NEW high+ vulns, (b) overdue allowlist rows. NEW `scripts/lint-secrets.mjs` is single source of truth for secret patterns; pre-commit hook + CI both call it. NEW `.github/dependabot.yml` weekly bumps with ignores for vuln-locked packages. NEW `docs/SECURITY_ROTATION_LOG.md` rotation tracker + DR drill log. |
| `8e0048f` | **Audit follow-up #5** — GitHub Action runs verify on PR + push. NEW `.github/workflows/verify.yml`: Node 24 LTS, `npm ci`, then lint:api → lint:citations → test:unit → build with placeholder Supabase env vars (real secrets stay in Vercel). 10-min timeout. Closes the "verify only runs locally" gap from the audit. |
| `db13c17` | **Audit follow-up #4** — Vitest + 51 unit tests on engine layer. NEW `vitest.config.js` (scoped to `tests/unit/` so Playwright `.spec.js` files in `tests/` aren't picked up). Coverage: scoreEngine (24 tests on safeScore guards, weighted composite, scenario sensitivity range, computeSubScores main entry, IX live-blend ±10 clamp, site geospatial → curated → fallback tiering); revenueEngine (12 tests on vintage stamps, null/zero/negative MW guards, NPV-scales-with-MW invariant, Supabase rates override); scenarioEngine (15 tests on dynamic capex range, IX cost $0 floor, BESS 20-year tenor cap). Caught a real bug in initial draft — LMI offtake penalty applies regardless of csStatus, not just on active. Wired into verify pipeline so engine invariants block the same gate as visual regressions. 51/51 in 708ms. |
| `520a526` | **Audit follow-up #3** — Backup posture from theoretical to validated. First snapshot: 22 tables / 19,146 rows / 11.1 MB to `backups/2026-05-06/`. Discovered + fixed 8 wrong table names in dump script (drift between when script was authored and migrations that landed). NEW `scripts/restore-from-snapshot.mjs`: DRY RUN default, `--live` flag required to write, refuses prod-host writes without `RESTORE_ALLOW_PROD=1`, `--on-conflict` pass-through, batched upserts. Idempotent merge (extra live rows left in place). NEW `docs/runbooks/restore-from-snapshot.md`: when to use JSON vs PITR, restore order parent→child, single-table vs full-DB paths, what CAN'T be recovered, failure-mode table, escalation steps. |
| `db77ac6` | **Audit follow-ups #1+#2** — Remove `?debug=1` bypass + pin CORS to Tractova origins. (1) 86 lines removed from `api/refresh-data.js` (auth-bypass branch + `handleCensusDebug()` function) — incident-response scaffolding, no longer needed. (2) NEW `api/_cors.js` helper: reflects request Origin only when allow-listed (tractova.com, www.tractova.com, localhost:5173/4173, `tractova-*.vercel.app` previews). Server-to-server cron callers send no Origin header so unaffected. Applied to 4 endpoints: refresh-data, lens-insight, create-checkout-session, create-portal-session. NEW `scripts/probe-rls-policies.mjs` — one-shot live-DB probe used to verify migration 058 + 059 health (is_admin() resolves, all 12 admin-write tables reachable, profiles.role='admin' populated, admin_audit_log exists). |
| `d83a89a` | **Plan B** — safety net + safeguards (8/8). (1) **CLAUDE.md** at project root: STOP-and-ask list (DELETE/TRUNCATE/DROP, force-push, rm-rf, .env edits, paid-service calls), TRUST-but-verify list, hallucination guards with named past-fabrication examples (Lazard recall, Phase G modeled-vs-observed), cost runaway circuit breakers, high-confidence-mistake step-back protocol, safe-fallback escape hatches, env-var manifest. Auto-loads into every Claude Code session. (2) **`.claude/settings.json`** harness-layer deny rules (rm -rf, git push --force, git reset --hard, supabase db reset, taskkill, vercel deploy --prod). Selectively un-gitignored via `.claude/*` + `!.claude/settings.json` so project deny rules commit while user-specific settings.local.json stays local. (3) **`scripts/lint-citations.mjs`** + `citations.allowlist.json` heuristic walk for citation-shape numbers ($X.YZ/W, n=N, percentile $) not traceable to migrations or allowlist; wired into `npm run verify` via `lint:citations` script. Currently 0/144 dirty. (4) **`scripts/_git-hooks/pre-commit`** + `install-git-hooks.mjs` secret-pattern scanner blocks commits with sk-* / supabase service-role / Stripe / Anthropic / Resend / AWS keys; runs `lint:api` before commit. Self-validated by blocking its own initial commit until meta-file skip added. (5) **`scripts/check-api-usage.mjs`** weekly probe of cron_runs (346 runs/week observed) + lens_insight_cache + Anthropic API key presence — surfaces cost runaway before the bill. Already flagged 32 ISO-NE failures + 11 NMTC + 9 LMI + 9 county_acs failures. (6) **`scripts/dump-supabase-snapshot.mjs`** JSON snapshot of 17 critical tables to `backups/YYYY-MM-DD/` (gitignored). Defense-in-depth alongside Supabase PITR. (7) **`docs/secrets-manifest.md`** committed env-var inventory + rotation cadence (Stripe quarterly, Resend + CRON_SECRET semi-annually, Supabase service-role + Anthropic annually) + leak-response runbook. (8) Migration **059_drop_legacy_email_rls** — DO-block enumerating pg_policies for any policy whose qual/with_check contains `aden.walker67@gmail.com`, dropping each. Awaits Aden's verification of role-based path (058) via /admin UI write before applying. |
| `bf73c4b` | **Plan A — A.2**: mobile populated-Lens save-face. Empty-state mobile sweep (4e2a943) caught 15/15 routes at 375px when no Lens was run; this closes the gap for the dense data panels that only render after Lens. (a) `Search.jsx:1782` SolarCostLineagePanel grid `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` + col-span-2 → sm:col-span-2 on the p10/p90 row. (b) `Search.jsx:2248` BESS revenue tiles `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`. (c) `ScenarioStudio.jsx:561` SliderRow `flex-row` → `flex-col sm:flex-row` so long-label sliders (e.g. "IX Cost per Watt" + "$/W" + "base: $0.12" + value) don't collide. (d) **New populated-state mobile-pro test** — pre-fills `/search?state=NY&county=Albany&mw=2&...` via URL params, clicks Run Lens, waits for results, then runs the same overflow audit. 6/6 mobile-pro tests pass (was 5/5). |
| `fe41821` | **Plan A — A.8**: Notes editor side-by-side preview. Library YourDealSection scrapped the edit/preview toggle state in favor of a `grid grid-cols-1 sm:grid-cols-2 gap-2` two-pane layout — markdown source on the left, live-rendered HTML on the right (stub message when empty). Existing markdown storage + auto-save + toolbar preserved. Stacks vertically below sm breakpoint. |
| `61cd365` | **Plan A — Sprint A2** (A.6 + A.7). **A.6**: alert color/kind taxonomy. `getAlerts()` now emits a `kind` field (`concern` / `data_update` / `neutral`) alongside the existing `level`. `alertStyleFor(kind)` helper picks palette per kind — `data_update` is emerald/green so a "data refreshed" alert no longer looks alarming. Library card pill split: `concernAlerts` chip (amber/red) + `updateAlerts` chip (emerald) render side-by-side. **A.7**: alert rationale traceability. Each alert now carries an `evidence` block with `field` / `before` / `after` / `verifiedAt` / `sourceUrl`. AlertChip tooltip renders the structured panel ("cs_status: active → limited; DSIRE-verified 2026-05-04; programs.dsireusa.org/..."). Solves the "why is this state flagged?" guess work. |
| `4daaf3d` | **Plan A — Sprint A1** (A.5 + A.1 + A.4 + A.3). **A.5**: methodology dropdown gains a "How freshness flows" paragraph clarifying that the engine is LIVE on every render — when underlying data refreshes, scores update automatically. Text-only. **A.1**: ScenarioEngine `getSliderConfig()` slider ranges now proportional to baseline. Capex 0.50× → 2.00× baseline (clamped [$0.80, $4.00]); IX cost floor drops to $0 (acquired-project case), max 3× baseline. Other sliders follow the same proportional pattern. **A.4**: `api/refresh-data.js` DSIRE handler now bumps `last_verified` on match (was only updating `dsire_last_verified`). Live probe showed 0 stale rows (migration 056 had already cleared them); ship was structural fix only. **A.3**: IX scrapers triage. MISO/NYISO probed fresh; PJM stale-by-design (Data Miner 2 license); ISO-NE actually broken — landing page added an ASP.NET session-cookie handshake. Repair deferred (~2-4hr lift); `DataLimitationsModal.jsx` § 06 extended with the specific cookie-handshake disclosure. |
| `a456cca` | Site-walk Session 4 (legal): I1 18+ checkbox at signup (required `agreed` flag, blocked submit until checked, links open in new tabs) + I2 Terms § 04 reverse-engineering / proprietary-misappropriation clause strengthened with explicit civil-action language citing the Defend Trade Secrets Act (18 U.S.C. § 1836), state trade-secret law, and reservation of all remedies at law and in equity |
| `445bce9` | Site-walk Session 4 (Library/Compare): F1 Compare AI summary collapsible (default closed) + COMPARE_PROMPT revamped to forbid score restatement (forces Recommendation / Differentiator / Non-obvious-insight) + insightType badge in UI · F2 5 new Compare rows (Offtake / IX / Site Control sub-scores + Wetland % + Prime farmland %) via lensResultToCompareItem + computeSubScores + Path B geospatial · F3 Library "Select all" inline link above grid + toolbar Select all/Deselect all toggle |
| `19b2638` | Site-walk Session 3 final: H2 ScenarioStudio post-save inline "Saved to your Library · view →" card (6s hold, click → /library?tab=scenarios) + Library URL ?tab=scenarios handler · H4 source-attribution link audit (PJM 404 → planningcenter.pjm.com; CAISO .aspx 404 → caiso.com root; energycommunities.gov ECONNREFUSED → IRS Low-Income Communities Bonus Credit page; IRS ITC 404 → IRS Form 3468) |
| `288b1be` | Site-walk Session 3 partial: E2 scenario presets recalibrated (best allocation cap 1.25→1.10 per Aden, worst IX cost 1.50→2.50 for network-upgrade-shock honesty) + SCENARIO_PRESET_METHODOLOGY constant anchoring multipliers to NREL ATB / Lazard P10/P90 + Radix Tooltip on each preset chip + Best/Worst case glossary entry · E5 ScenarioStudio clarifying intro ("sliders move financial outputs, not the gauge") · H1 jump-to-glossary in CommandPalette (GLOSSARY_TERMS + toSlug exports + location.hash listener for in-page nav) |
| `1268cbc` | Site-walk Session 2: dot/T-mark mask tightened 18-30%/70-82% → 8-12%/88-92% (closes Pillar Diagnostics overlap on 1920px viewport) + WalkingTractovaMark top/bottom narrowed to corner gutters · C1 Dashboard hero "data refreshed" caption switched from state_programs.last_verified → cron_runs.finished_at (same source as Footer) · C2 Admin Data Health LIVE/CURATED/SEEDED chips on each freshness card + mode legend + Last Run per Cron clarifying caption · E1 Market Position state-baseline-vs-project line under gauge + lens-insight SYSTEM_PROMPT rule 16 forbidding score conflation · E3 Capacity Factor tooltip + NREL PVWatts provenance suffix · E4 revenue stack methodology drilldown title rewritten · E6 Site Control Land + Wetland tile notes now display NWI + SSURGO percentages |
| `a1c00dd` | Site-walk Session 1: favicon green→teal · StateDetailPanel SubStat sub-headers grey→teal · revenue stack ITC adder blue→amber #D97706 · email "+15 idx"→"+15 pts"; digest IDX→SCORE · score-drop alert structured delta with big "↓ N pts · X→Y" gutter cell · Profile "Considering canceling?" passive CTA removed · IntelligenceBackground teal "fog" band removed; dots + T-mark wrapped in gutter mask · WalkingTractovaMark top/bottom variants narrowed to corner gutters · USMap legend tooltips on all 7 tiers · Site Control status badge tooltips citing SSURGO/NWI/hosting sources · Data Limitations modal scrollable + cursor-pointer + ⓘ icon |
| _no commit_ | **PJM IX scraper officially abandoned for legal reasons.** Aden attempted Data Miner 2 API key registration; PJM's developer-portal landing page reads: *"Information and data contained in Data Miner 2 is for internal use only and redistribution of information and or data contained in or derived from Data Miner 2 is strictly prohibited without an effective PJM-issued Redistribution License."* That clause is incompatible with our SaaS model — Tractova surfaces derived metrics (queue counts, MW pending, study months) on customer-facing Lens results. Free Data Miner 2 access is internal-corporate-research-only; SaaS redistribution requires a separately-negotiated PJM Redistribution License (multi-week process, $5K-$50K/yr typical). **Decision (Aden 2026-05-02):** abandon PJM live coverage. Lens IX·Live pill stays amber for PJM states (`87cea98` already shipped honest disclosure). Future revisit only if (a) we pursue the redistribution license at scale, or (b) we find an alternative public-domain PJM queue path (FERC eLibrary Form 715/1 filings, PJM Manual 14H Attachment B). Other-ISO TOS audit (MISO/NYISO/ISO-NE) was inconclusive via WebFetch — bundled into the attorney-review checklist for formal launch. NYISO + MISO scrapers stay shipping (industry norm is permissive); ISO-NE repair stays deferred. |
| _no commit_ | **NWI seed pass 2 complete — 100% coverage achieved.** 2,136 of 2,144 retried succeeded; 8 failures (KY/network blips). Live `county_geospatial_data` populated count: 3,144 of 3,143 counties (slight over-count from DC double-counting). Path B's Site Control sub-score now has live geospatial truth (NWI wetlands + SSURGO farmland) for every U.S. county. |
| `c690b01` | Glossary scroll bug + ambient animation extension. (1) **Global ScrollToTop** — new `src/components/ScrollToTop.jsx` listens to `useLocation()` pathname changes, calls `window.scrollTo({top: 0, behavior: 'instant'})` when no hash. Mounted inside `<BrowserRouter>` above `<Routes>` in App.jsx. Fixes the Glossary land-at-bottom bug Aden reported and any other "navigate from long page → land at random offset" instance across the app. Glossary's existing hash-based deep-link logic preserved. (2) **IntelligenceBackground + WalkingTractovaMark on Glossary, Library, Lens** — extends the Profile ambient treatment. Glossary + Library get both (sessionGate=true, 30%/25% triggerProbability). Lens result page gets IntelligenceBackground only — no cameo on the content-dense Lens to avoid pulling focus mid-analysis. Glossary hero gains a pulsing teal dot matching the Library "Data refreshed" pattern |
| `80412cf` | Audit-driven trust transparency (3 items). After the data-trust audit (plan: `what-are-some-caveats-cached-kite.md`) Aden picked the recommended directions on disclosure / BESS-rate freshness / curation-drift visibility. (1) **Data Limitations modal** on every Lens result — new `<DataLimitationsModal>` component (Radix Dialog), 5 audit-identified caveats with severity tags (capacity_mw drift HIGH, BESS rates HIGH, IRR/DSCR defaults MEDIUM, IX scraper staleness MEDIUM, comparable-deals sample MEDIUM). Trigger inline in the Lens disclaimer block. Links to /privacy + /terms § 06 for the full audit. (2) **BESS revenue panel "as of" stamp** — `BESS_RATES_AS_OF` constant in revenueEngine.js (`'2026-04'`) exposed on `computeBESSProjection` return shape, rendered as an amber-tinted mono pill in the BESS revenue panel footer. Plus a new ToS Section 06 bullet explicitly disclosing that BESS revenue rates are seeded constants and may swing 2-9× year over year. (3) **Mission Control curation drift row** — `handleFreshness` returns a `state_programs_drift` array (warn ≥30d, urgent ≥60d, stable thresholds). New `<CurationDriftRow>` component renders below the 3-card KPI grid, hides when nothing's drifting. ⚠ flag for states with null capacity_mw or enrollment_rate (silently breaks Runway) |
| `5c04eed` | Polish-pass after multi-agent audit. Five fixes: (1) **scoreEngine over-claim**: the EIA-861 utility seed inserted 32 state-default rows with `available_land=true, wetland_warning=false` which scoreEngine read as a favorable 82 site score until NWI caught up — over-claiming honesty for 32 states. UPDATE'd all 32 to NULL/NULL so computeSiteSubScore returns the neutral 60 baseline; seed script also updated for future re-runs. (2) **Scenario auto-expand race**: the 4s `setTimeout(clear, 4000)` could fire before async `loadSavedScenarios()` returned on slow networks, leaving the new row un-expanded. Now awaits the refresh BEFORE setting `justSavedId`; tightened hold to 1.5s. (3) **Library empty-state skeleton**: replaced the silent `liveMarkets.length > 0 &&` gate with 4 placeholder cards while `stateProgramMap` hydrates — eliminates the late-paint shift. (4) **Terminology consistency**: standardized "intelligence report" across UpgradePrompt, WelcomeCard, Search.jsx form header (was a mix of "feasibility report" / "intelligence report"). (5) **Stale comment**: generalized the IX·Live tooltip rationale comment that hardcoded the 2026-04-24 → 2026-05-02 window. Plus: live-DB probe confirmed NWI coverage just crossed **95.9%** (was 92.1% pre-pass) as the seed crossed the ND/SD gap-state cluster |
| `6fc4bbe` | Library empty-state deepening + Mission Control responsive polish — Library /library new-user landing now leads with a "Live markets right now" strip pulling the 4 most-recently-verified active CS states from the existing stateProgramMap (no new fetch); each is a clickable mini-card showing state code · name · capacity remaining · "Run Lens →" → /search?state=XX. The "Live data refreshed [date]" stamp from the populated-Library hero is also surfaced pre-projects so the live-data promise is provable on first impression. Existing 3-value-prop card + CTAs preserved below. Mission Control header + KPI card titles flex-wrap on narrow viewports |
| `89a43a7` | Admin Mission Control — single-screen executive snapshot at the top of the Data Health tab. Three KPI cards (NWI coverage circular gauge tier-colored against the 95% goal · IX scraper freshness pills per ISO with stale flag · Substations cron latency bar with the 60s ceiling + 70% WATCH threshold marker) plus a usage-signals row (Scenario Studio saves + churn-defense surveys). Backed by an extension to `handleFreshness` that adds a `missionControl` block to the response (NWI counts, ix_freshness array, scenario + cancellation counts). Backwards compatible — the existing fields stay unchanged |
| `c07f76c` | data-health: bearer-token-gated `health-summary` action returning machine-readable system-health JSON (NWI %, per-ISO IX freshness, cron p95 + last-success per cron_name, scenario_snapshots count, cancellation_feedback count). Auth via `HEALTH_CHECK_TOKEN` env var. Powers the weekly Anthropic-cloud routine `trig_01Xafjra7dtEecSQEBLNAoQL` ("Tractova weekly system-health", every Monday 09:00 ET). Token + routine ID stored in `.env.local` (gitignored) |
| `94fe80c` | NYISO scraper repair — replaces the dead `https://www.nyiso.com/api/interconnections` JSON endpoint (404 since 2026-04-24) with a 2-step xlsx flow: scrape `/interconnections` landing page for the latest dated `NYISO-Interconnection-Queue-MM-DD-YYYY.xlsx` URL, download, parse the "Interconnection Queue" sheet with the existing `xlsx` package, filter Type/Fuel="S" + SP(MW) > 0 + < 25, aggregate by Utility code. Live test: 29 solar <25MW projects across NM-NG (19), NYSEG (6), CHG&E (2), O&R (1), RG&E (1). UTILITY_STATE_MAP expanded to map NYISO's utility-code abbreviations (NM-NG, CHG&E, NYPA, LIPA, O&R) to NY. PJM and ISO-NE remain blocked: PJM requires Data Miner 2 API-key registration, ISO-NE landing pages 404 — both deferred to a follow-up session |
| `ad86917` | Privacy Policy + Terms of Service v1.0 — hand-rolled, comprehensive, sign-ready. /privacy + /terms public routes lazy-loaded; Footer links added. Privacy covers all sub-processors (Supabase/Vercel/Stripe/Anthropic/Resend/Cloudflare), explicit AI processing disclosure (Claude Sonnet 4.6 + Haiku 4.5 with Anthropic ZDR), every data source we synthesize (EIA Form 860/861, NREL PVWatts, Census ACS, USFWS NWI, USDA SSURGO, HUD QCT/DDA, CDFI NMTC, DOE NETL EDX Energy Community, DSIRE, ISO/RTO scrapers, RSS), CCPA-tier rights extended to all users, retention windows. ToS Section 06 is the legal-cover spine — every methodology limitation, scoring subjectivity, AI hallucination risk, coverage gap, and "research accelerator not professional advice" clause spelled out. Liability cap = greater of (12mo paid revenue, $100). NY governing law + JAMS arbitration + class waiver. Effective 2026-05-02 |
| `87cea98` | IX scraper staleness honesty — Lens "IX · Live" pill now flips amber + "stale Nd" suffix when the underlying ix_queue_data row hasn't refreshed in >7 days; tooltip explains the upstream URL change reason. Admin Data Health tab gets a system-level "IX scraper staleness · N of M ISOs frozen" alert listing each stale ISO with its last successful pull date. Defensive disclosure pending the proper scraper repair sprint — PJM, NYISO, ISO-NE all 404 since 2026-04-24 |
| `ec4b96f` | EIA Form 861 utility seed — adds default `county_intelligence` rows for the 32 states that previously had no curated state-default (AK/AL/AR/AZ/DE/GA/IA/ID/IN/KS/KY/LA/MO/MS/MT/NC/ND/NE/NH/NV/OH/OK/PA/SC/SD/TN/TX/UT/VT/WI/WV/WY). Each row has the dominant retail-customer utility per EIA Form 861 (2023, published 2024) — Alabama Power, Entergy LA, Duke Carolinas, NV Energy, Oncor, etc. Lens IX panel now displays a real serving utility for all 50 states instead of "Utility TBD". v1 = state-level default; v2 = per-county HIFLD spatial join, deferred. Site scores neutral (60 baseline) until per-county NWI ingest completes |
| `39758ba` | refresh-substations: parallel batched upsert — fixes the `monthly-data-refresh` p95 drift the latency monitor flagged (was at 57% of its 60s ceiling). Sequential row-by-row supabase upsert (8 states × ~100 rows × ~25ms = ~20s in supabase alone) replaced with bucket-by-state + Promise.allSettled batched upsert — should collapse the supabase phase to 1-2s |
| `dde4877` | Pillar Diagnostics format pass — SectionMarker text-[9px]→[11px] (slightly bigger, less letterspacing); § 04 drops the navy/grey wrapper and uses the same white-surface SectionMarker treatment as Market Position / Analyst Brief / Scenario Studio for visual consistency; SiteControl 4-col tile grid → 4 stacked rows (each factor's note now has room to wrap legibly at 1/3-viewport column width); IX Serving Utility + Ease Score combined into one structured panel matching the ISO Queue Data block's character (amber left-border + mono eyebrow + gauge inline + KV chips + interpretation footer); IX County Queue Notes also amber-tinted to match |
| `efdc33b` | Cron-runs latency monitor — admin Data Health tab now aggregates last 30 days of `cron_runs` and flags any handler whose p95 > 70% of its parent function's `maxDuration` (warn / watch / ok severity bands), surfaces drift like `monthly-data-refresh` at 57% before it becomes a 504; pure JS aggregation (no migration) |
| `2cd7399` | AI scenario commentary — saved Studio rows expose a `▸ Why?` button that fetches a 2-3 sentence Haiku 4.5 narrative explaining the dominant 1-2 input drivers behind the IRR/payback/NPV/DSCR shifts; auto-fires on save (4s window for the call to land), 30-day server-side cache keyed on hashed inputs+outputs (cross-user collapse), Library Scenarios tab gets it for free |
| `8848dd8` | Onboarding deepening — LensTour 4-step coachmark walkthrough on first-time-Pro Lens result (composite gauge → pillars → Scenario Studio → save), `?onboarding=1` URL trigger appended to UpgradeSuccess + WelcomeCard demo links, localStorage persistence, ESC/skip/keyboard nav, graceful-fallthrough on missing anchor |
| `357d7f9` | ScenarioStudio polish: confirm-delete + visible-save + input-pill row + auto-Lens + Radix tooltips on header badges + dropped native title= attrs + dark-space tightening |
| `a13f33d` | ScenarioStudio: vertical history list (replaces chip row) + orphan auto-promote on project save + Library "Scenarios" tab grouping all scenarios by Lens context + card header badge |
| `fd621a0` | Churn flow: pre-cancel exit-intent survey + cancellation_feedback table (migration 042) + reason categories + free-text capture + email/tier snapshot before Stripe portal handoff |
| `251bc38` | Phase 4 coverage: C&I offtake 12 → 32 states (calibrated against EIA Form 861 retail rates), BESS offtake 8 → 25 states (calibrated against ISO/RTO capacity-market clearing prices) |
| `e696d40` | ScenarioStudio: 3 lifecycle sliders (opex $/kW/yr · discount rate · contract tenor) + Equity-IRR (70/30 lev) + DSCR (Y1 NOI / debt service) outputs; output card grows to 8 metrics in 2×4 grid |
| `0dcc051` | ScenarioStudio: lifecycle financial metrics (IRR via Newton-Raphson + LCOE + NPV + lifetime revenue) + Best/Worst preset chips + saved scenarios ride share-memo flow into MemoView for recipients |
| `6caf484` | ScenarioStudio: directional slider colors (slate at baseline / teal when better / amber when worse, applied to chip + track gradient) — replaces the binary "modified" amber treatment |
| `576927b` | Phase 2 part 2: Library "Saved Scenarios · N" chip on cards + 2-col picker + selectedScenario flows into PDF export AND share memo + Search.jsx auto-matches Lens results to saved projects so scenarios attach to project_id |
| `42fd476` | Phase 2: Scenario Studio — interactive sensitivity layer (`scenarioEngine.js` pure compute over revenueEngine + 6 sliders + Y1 revenue + payback + delta chips + saved scenarios chip row + 8 glossary entries + migration 041) |
| `c72272e` | Phase 1: Landing trust signals (8 federal data sources + 120× time-saved comparison) + 14 glossary tooltip entries via new `<GlossaryLabel>` component + Library bulk operations toolbar (Add to Compare / Export CSV / Delete with confirm) |
| `7cf5713` | Phase 0: pricing → $29.99/mo + 14-day no-credit-card trial (Stripe trial_period_days) + webhook hardening (client_reference_id validation via maybeSingle) + cron consolidation 9 → 7 (under Hobby cap) |
| `796bb17` | Backlog batch 2 — a11y + empty states + keyboard nav: aria-labels on icon-only buttons, NewsFeed empty state, tiny-chip contrast (teal-800), aria-live on Admin RefreshResultPanel + Library alerts, autoFocus on Sign{In,Up}, ESC + role=dialog on CompareTray + Search modals |
| `6260c54` | Backlog batch 1 — polish: Admin stale-ok 4th status tier, MemoView ≥7d age warning banner, SignUp 60s rate-limited resend-confirmation link, UpgradePrompt Library-entry "N projects saved · ready for re-scoring" personalization |
| `5fa13c7` | Audit follow-ups: useSubscription .catch + maybeSingle (no more stuck-loading on missing profile row), create-checkout-session priceId allowlist, seed-county-geospatial-nwi.mjs `--parallel=N` flag for NWI catch-up runs |
| `3539511` | Session 3 audit fixes — silent failure sweep: CompareTray AI compare error block, Glossary copy-link "Copied" / "Copy failed" feedback, console.warn for graceful-degrade helpers (Search PUC/Comparable wrappers, Library local fallback fetch, CommandPalette state map, Footer last-updated) |
| `5f70330` | Session 2 audit fixes — data integrity: scoreEngine partial-input midpoint scoring (replaces null→favorable shortcut), Library getAlerts threads countyDataMap (alert delta now matches card display), BroadcastChannel cross-tab cache invalidation on admin Refresh |
| `14f92b2` | Session 1 audit fixes — onboarding: /update-password route (Supabase reset target), Landing ApiErrorBanner instead of swallowed catches, UpgradeSuccess first-time Pro guided-action card, UpgradePrompt LensPreview component (paywall now shows the output) |
| `dc85c18` | BUILD_LOG: cron-runs latency monitor → P2 backlog (catch the next 504-class bug before users do via cron_runs.duration_ms p95 vs maxDuration scan) |
| `d50c9fd` | Admin: visible feedback on Copy report / Copy / Copy JSON buttons via shared CopyButton component |
| `bbc9543` | Fix substations 504: parallelize fetchEIAData + fetchRetailRates per-state with Promise.allSettled (was 8×15s sequential = up to 120s past 60s budget) |
| `9902f51` | Fix HTTP 500 on refresh-data: duplicate `const usps` SyntaxError; adds `lint:api` step to verify pipeline so api/*.js syntax is checked locally |
| `5b17f89` | Fix geospatial_farmland: switch SSURGO from single whole-US query to per-state batched (50 × ~80ms = ~5s, was tripping SDA's 100s execution cap and returning empty {}) |
| `7c49c5c` | Path B: county_geospatial_data — wetland coverage (NWI) + prime farmland (SSURGO) for all 50 states / 3,142 counties; closes Site Control gap; migration 039 + scoreEngine 3-layer fallback + Site · Live pill |
| `e4c6666` | Lens loader: asymptotic halo fill — replaces linear-stall-then-jump with `p = 95 * (1 - exp(-elapsed/8s))`; RAF loop never exits while overlay visible so the halo physically can't freeze on slow runs; cleaner snap-to-100 landing on completion |
| `7d474e1` | IX · Live pill: structured Radix tooltip matching the methodology popover (dark navy + teal border); replaces native browser `title` with INPUTS / CLAMP / coverage-policy box |
| `e9506a7` | IX score live-blend: scoreEngine.computeSubScores now optionally blends ix_queue_data quantitative signals (mw_pending, avg_study_months) on top of curated ixDifficulty baseline; coverage.ix = 'live'\|'curated' flag exposed; teal "IX · Live" pill in Lens eyebrow when blend fired (8 top-CS-market states today); Library/Profile call sites unchanged → no regression |
| `4702b98` | BUILD_LOG: flip migrations 034-037 to ✅ + add live-DB probe script |
| `b27dfa0` | Library WoW + freshness signal: "Data refreshed [date]" hero caption (teal breathing dot, amber if >14d) + "State ±N pt" chip on project cards when state_programs_snapshots show movement; piggybacks on getStateProgramDeltas already shipped for Markets on the Move |
| `5b6a7a0` | Pro-flow smoke tests: auth.setup.js + pro-smoke.spec.js (6 tests, ~10-15s, $0/run) — covers Search/Library/Profile/Dashboard past the paywall, catches the white-screen class on the authed surface that smoke.spec.js can't reach |
| `4fb24b6` | Landing onboarding: items-baseline on the simulated alert feed so chip + text share a typographic baseline; reverted "— lines / dots / solid" addendum from map legend |
| `8a7f2ea` | Visual polish: gauge labels (25/50/75), shimmer flow (real CSS bug — animate 0%→100% not 0%→50%), legend visibility, baseline symmetry sweep across NewsFeed / Comparable / Regulatory |
| `e2c8b48` | Dashboard: surface "data refreshed [date]" caption on hero — makes the live-data promise provable on first impression with teal breathing dot (fresh) or amber (>14d stale) |
| `26b86b0` | BUILD_LOG: capture site-coverage fix + state-level coverage gaps |
| `d4061d2` | Score honesty: site sub-score also signals fallback when county_intelligence row missing (only 18 of 50 states seeded — caption now consolidates both pillars in one block) |
| `9b0d96c` | BUILD_LOG: capture score-honesty fix + new pickup priorities |
| `596de4b` | Score honesty: surface "limited coverage" caption + AI COVERAGE NOTE when offtake falls back to baseline (BESS/CI/Hybrid outside curated 8-12 states) |
| `1474c3d` | BUILD_LOG: capture full audit / fix / smoke-suite stretch + post-break pickup |
| `79bfb08` | Smoke tests: Playwright suite catches runtime bugs that pass build (7 tests, ~20s) — `npm run verify` is the new pre-push gate |
| `318930e` | Two visual fixes: CSS-keyframe shimmer (replaces motion's keyframes that produced loop-boundary discontinuity) + ticks moved OUTSIDE the gauge arc |
| `09304d5` | useSubscription: unique channel name per hook instance — **fixes white-screen on dashboard state click** (Supabase realtime channel collision when WelcomeCard + StateDetailPanel both mounted the hook) |
| `eea8d78` | Dashboard: defensive Map check on deltaMap (preventative; speculative diagnosis of the white-screen, real fix was `09304d5`) |
| `5c30369` | Wave 1.4: state_programs_snapshots history + Markets on the Move WoW deltas (migration 038 — needs to be applied) |
| `53625e3` | Two refinements: tiled-gradient shimmer (still had loop discontinuity, superseded by `318930e`) + bigger gauge ticks |
| `d3af13c` | Three follow-up fixes: peer-state dropdown becomes styled custom popup (not native select), dual-shimmer attempt, gauge merge into single object |
| `dae9e65` | Three fixes: audit log dedupe + 8-row cap with "Show N earlier" expansion, peer-state diff list redesigned as labeled grid (was bullet list of strings), sub-score shimmer flow (1.4s repeatDelay removed) |
| `c709a29` | BUILD_LOG: close out queue items with explicit status |
| `1780fbd` | Library: tighter mobile padding/gap on project card collapsed header |
| `5bd249c` | Color audit: consolidate legacy primary teal #0F6E56 → canonical #0F766E across all surfaces (Library / Profile / Search / ProjectPDFExport / SectionDivider / UpgradeSuccess) |
| `bcc65d9` | Compare modal: teal-tinted slim scrollbar (.scrollbar-dark utility) |
| `2b14b83` | Library: `?preview=empty` URL flag to view empty-state onboarding without deleting projects |
| `f02704e` | Onboarding: subscription-aware WelcomeCard + contextual UpgradePrompt (URL params surface as "Lens analysis staged for you") |
| `41c91eb` | Compare: TractovaLoader on AI synthesis (replaces gradient skeleton) |
| `b3cb940` | MemoView: real conversion CTA for non-owner share-link viewers |
| `6dc21ab` | Markets on the Move: live-pulse indicator + overflow count + chip tooltips |
| `79390c1` | Compare: enrich items + group rows into §01 Composite / §02 Project sections (Program Capacity + LMI Carveout rows added) |
| `b45b359` | Lens: rewrite Custom scenario as Peer-State picker (apply any state's profile, see live diff) |
| `1780fbd` | Library: tighter mobile padding/gap on project card collapsed header |
| `5bd249c` | Color audit: consolidate legacy primary teal #0F6E56 → canonical #0F766E |
| `2b14b83` | Library: `?preview=empty` URL flag to view empty-state onboarding without deleting projects |
| `d2aa9a1` | BUILD_LOG: capture audit-cycle commits + UX/Lens redesign sweep |
| `31247ae` | Loaders: TractovaLoader on NewsFeed Market Pulse, scenario rationale, Admin Data Health |
| `e447a7e` | Hygiene + polish: drop `iad1` from masthead, delete TopoBackground, fix scroll-into-view ordering, gitignore scratch txt |
| `1eda205` | Library: upgrade empty-state into a 3-value-prop onboarding card |
| `0ca8b7a` | UX: surface API failures with retry instead of swallowing — new ApiErrorBanner across Dashboard / Comparable / Regulatory |
| `6b17f40` | Lens: research-desk masthead + §-numbered section markers + dossier band wrapping the 3 cards |
| `6a25073` | Revert: remove TopoBackground from Lens (lines felt too literal) |
| `2c58e4b` | (later reverted) Lens: subtle topographic background on results panel |
| `e63a0c3` | Library: project-bar redesign — mini arc gauge + accent rail + score-tinted gradient |
| `c88629e` | Loaders: branded TractovaLoader + Library Portfolio AI summary uses it |
| `eab8492` | Lens: cards collapsed by default — prompt user interaction |
| `4eff1e9` | Lens: full-card collapse on the 3 main cards + grid alignment fix |
| `3d69237` | Lens: click-to-expand drilldowns on the 3 main cards (SC / IX / Offtake) |
| `6733480` | Lens: precedent-anchored scenarios + brief feedback loop (smooth scroll + pulse) |
| `db92ccb` | Lens: shimmer constant on sub-score bars + fold Federal LIHTC into Offtake stack |
| `3d57820` | Lens: redesign sub-score bars (Offtake / IX / Site Control) — animated arcs + spring counters |
| `2fb04db` | Admin: surface Census diagnostic in Data Health UI (`Run Census diagnostic` button) |
| `475a095` | Merge: Tailwind v4 + Vite 8 + shadcn |
| `55f3fc7` | Integrate shadcn/ui (scoped, brand-preserving) |
| `3e7df8e` | Upgrade Tailwind v3 → v4 and Vite 5 → 8 |
| `d8be8ef` | Refresh: stale-tolerance for Census ACS sources (90-day window, amber-OK badge) |
| `4285c1a` | Refresh: make `?debug=1` auth-bypass + fully redact key |
| `0cab89f` | BUILD_LOG: capture diagnostic plan + clear pickup steps |
| `beaac11` | Refresh: Census `?debug=1` diagnostic mode + descriptive User-Agent |
| `2d974cd` | BUILD_LOG: capture today's multiplex refactor + UI polish |
| `875aa88` | Admin: color-code the 10 tabs for at-a-glance scanning |
| `8012250` | Profile: move Data Admin link to top of page |
| `d28956c` | Refresh: inline `keyed=` flag into Census error strings (UI visibility) |
| `6011cab` | Refresh: surface `keyed` flag on Census handler errors (env-var diagnostic) |
| `503aec7` | Refresh: split NMTC into its own HTTP call to fit Hobby gateway ceiling |
| `341410f` | Refresh: kill 503-retry storm + add 310s client-side timeout |
| `4ed7f3b` | Refresh: serialize Census handlers + retry on 503 (later refined by 341410f) |
| `0baad56` | Bump `@anthropic-ai/sdk` 0.88 → 0.91.1 (dependabot moderate) + accepted-risk doc |
| `ebf3deb` | Tune Census fetch budget for parallel multiplexed runs |
| `3d9f978` | Fix: multiplexed refresh hitting 60s gateway timeout (`maxDuration` 60→300, `Promise.all`) |
| `9ba2086` | Fix: NMTC LIC handler — iterate tract pulls per-state (Census wildcard fix) ✓ verified |
| `f2fdb6c` | Docs: consolidate planning trail into single BUILD_LOG.md |
| `ad67356` | Data layer: NMTC LIC tracts → IRA §48(e) Cat 1 +10% ITC bonus per county |
| `fe2b108` | Data layer: HUD QCT/DDA federal LIHTC overlay per county |
| `71d7456` | Data layer: IRA Energy Community (+10% ITC bonus) per-county eligibility |
| `4016fca` | Crons: kill `.catch`-on-builder bug + redesigned refresh status panel |
| `c3aaecb` | Crons: surface uncaught exceptions as JSON instead of generic 500 |
| `26202d3` | Cron observability: stop swallowing failures, fix cron_runs schema bug |
| `604d345` | Admin: better diagnostics + fallback for partial-refresh failures |
| `acceb1a` | Admin: every Refresh click verifies every source — panel reflects it |
| `6485ed9` | Admin: wire cron-driven updates into Data Health freshness + cache flush |
| `b628866` | Data pipeline: news_feed RSS+AI ingest + revenue_stacks DSIRE verification |
| `3ae35dd` | Data pipeline: county-level Census ACS — 3,142 counties live-pulled |
| `27d9b4f` | Data pipeline: DSIRE verification layer for state_programs |
| `6e1c6f4` | Data pipeline: live Census ACS pull + multiplexed refresh-data + admin trigger |

> Older entries are in `docs/archive/Running_Notes.md` (Day 1-4 V3 build log preserved verbatim).

---

## Backlog (priority-ranked)

### P1 — Scaffolding shipped 2026-04-30; lights up automatically as data history accrues
- **Markets on the Move WoW deltas** — ✅ scaffolding shipped (`5c30369`). Migration 038 (`state_programs_snapshots`) appends a row per active-CS state on every `state_programs` cron run. UI pulls the deltas via `getStateProgramDeltas()` and renders ↑/↓ pt arrows when ≥2 snapshots exist per state. Falls back to the recency sort + "Xd ago" caption until then. Data accrues automatically; first deltas appear ~2 weeks after migration 038 lands.
- **Library project-card WoW chip** — ✅ scaffolding shipped (this session). Same data source as Markets on the Move; renders a "State ±N pt" pill on each card whose state has moved between weekly snapshots. Honestly labeled "State" because deltas are state-program-level, not per-project. Silent until snapshot history accrues.
- **IX Velocity Index + Program Saturation Index** (Wave 1.4 derived metrics) — `ix_queue_snapshots` accumulating since 2026-04-28 (migration 012 already shipped). Computation logic is the only piece pending; once we have ≥4 weeks of history we'll add an RPC and a chip on the IX card. Readiness recheck **scheduled for 2026-06-03** via /loop agent.
- **Trend chips on KPIs (MetricsBar)** — same pattern: needs `dashboard_metrics_snapshots` history. Revisit when prioritized; the same scaffolding template (migration + cron hook + delta helper) used for `state_programs_snapshots` applies here.

### P2 — Closed: existing solution is correct
- ~~**Search.jsx form inputs → ui/* primitives**~~ — **Reviewed 2026-04-30, deliberately not refactored.** Search.jsx already uses clean `FieldSelect`, `CountyCombobox` field components with shared `labelCls`/`inputCls` Tailwind classes. The grid layout is intentionally dense (5-column on desktop) and forcing the project's `Input.jsx` primitive (designed for stacked-label layout) would degrade not improve. The "deferred to natural touches" guideline in the V3 plan is the right call — substitute incrementally as new fields are added, not as a bulk rewrite.

### P2 — Engineering-ready (real work)
- **`computeIRR` solver stability** (flagged 2026-05-08 in G.5). Newton-Raphson with single 10% starting guess is unstable on near-degenerate cashflow streams — DSCR ~1.0 + project IRR near the debt rate produces equity cashflows that flip sign across the contract life, and Newton-Raphson lands on different roots (or fails to converge) for tiny input changes. Symptom: scenario sensitivity slider produces "—" / −50% / +18% jumps with no smooth gradient. G.5 hides this from users via the dash-for-≤0 rule, but the underlying solver should be replaced. Approach: bisection fallback when Newton diverges (plausible IRR range −95% to +200%); or multiple starting guesses (e.g. 5% / 15% / 50%) with sanity selection. ~1-2h. Adds robustness to Studio + memo math without changing display semantics.
- **Cron-runs latency monitor** — recurring agent (weekly cron or `/schedule`) that scans `cron_runs.duration_ms` p95s for each `cron_name` and flags any source whose p95 exceeds 70% of its function `maxDuration`. Surfaces in admin Data Health (or via PR/email). Catches the *next* `refresh-substations`-class 504 before it ships — the structural class of bug ("sequential per-state calls under a tight function budget") is invisible to syntax/smoke checks; it only shows up under upstream slowness, by which point users see a red panel. Implementation sketch: a `/api/check-cron-latency` endpoint that selects the last 8 successful runs per `cron_name` and computes p95 vs the corresponding vercel.json `maxDuration`; exits with a structured warning summary the admin UI can render. Estimated 2-3h. Pairs naturally with the existing `cron_runs` telemetry already populated by every refresh handler.
- **Wetlands + farmland data layers** (EPA NWI / USDA WSS) — ✅ shipped 2026-05-01 as Path B (`7c49c5c`).

### P3 — Pre-revenue legal / IP (non-engineering, no monthly subscriptions per user preference)
- Hand-roll **Privacy Policy + Terms of Service** (avoiding Termly/Iubenda monthly).
- **LLC formation** before significant revenue.
- **USPTO trademark filing** for "Tractova" wordmark (~$500 flat-fee attorney).
- **Defensive domain registrations** (.io / .app / .ai / typos).

### Accepted dependency risks (dependabot will keep flagging — context here)

| Package | Severity | Why we accept | Resolution path |
|---|---|---|---|
| `xlsx` | high (proto pollution + ReDoS) | Vulns require **parsing** malicious workbooks. We only **write** xlsx (Library export). No npm patch — SheetJS left npm in 2023. | Replace with `exceljs` only if we add xlsx import. Otherwise indefinite. |
| `react-simple-maps` chain (`d3-color` ReDoS) | high ×4 | ReDoS needs user-controlled color strings; we pass static us-atlas topojson. Library abandoned at v3; npm flags downgrade to v1 as the only "fix". | Swap for `@nivo/geo` or similar if the map needs new features. |
| ~~`vite` / `esbuild`~~ | ~~mod ×2~~ | ~~Dev-server-only vulns.~~ | ✅ **Resolved 2026-04-30** by Vite 5→8 upgrade (`3e7df8e`). |

### Deferred until paying-user traction
- **IX Queue Forecaster** (Wave 2 — needs ≥12 weekly snapshots, Q3 launch).
- **Comparable Deals DB** (~30+ Pro users justify build).
- **PUC dockets full crawl** (per-state portals, high curation cost).
- **OpenEI URDB integration** (utility tariff schedules — scale + utility-territory mapping issue).
- **§48(e) Categories 2-4** (Indian Land + low-income residential + economic benefit) — Cat 1 covers most CS projects; 2-4 require additional data layers.

---

## How to update this file

When the user says **"update build log"**, **"log this"**, **"save what we did"**, or similar, Claude should:

1. Run `git log --oneline -5` (or check session memory for new commits) and **prepend** any new commits to the Recent builds table.
2. Update **Pending migrations** — if a new `03X` SQL file was created, add it as ⏳; if user confirmed they ran SQL, flip the relevant row(s) to ✅.
3. Update **Status snapshot** — bump last-commit hash + subject; update the live-data-layers list if a new one shipped or one was removed.
4. Move any **Backlog** items that just shipped into Recent builds (delete from backlog).
5. Add new backlog items if the session generated them.
6. Keep the file concise — if Recent builds exceeds ~25 rows, move the bottom 5 to a "older builds" section or trim into `docs/archive/Running_Notes.md`.

That's the entire protocol. No other planning docs to maintain.
