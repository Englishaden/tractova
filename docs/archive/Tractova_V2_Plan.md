# Tractova v2 — Major Iteration Plan

## Context

All prior phases are shipped. The product works. This iteration is a **design, UX, and intelligence upgrade** — transforming Tractova from a functional tool into a polished developer command center. The user's notes (Claude_Plan_4.28.26.md) call for: technology scope tightening (CS + Hybrid), interactive widgets over static text, a "war room" Library redesign, AI-powered news, rebuilt sensitivity analysis, richer exports, and layout polish across every surface.

**Constraints:** Vercel Hobby (11/12 functions — cannot add any), Supabase, claude-sonnet-4-6 via Anthropic SDK. New AI features must route through `lens-insight.js` action routing.

**Architecture decision — Chatbot tab:** NOT recommended as a standalone tab. The AI is already embedded contextually (Lens, Portfolio, Compare) where it delivers the most value. A generic chatbot would be a lower-value surface that costs API tokens without clear developer ROI. Instead, deepen the existing AI touchpoints.

**Architecture decision — About section:** Add as a section on the Landing page (not a nav tab). It explains the platform without diluting the main product navigation.

**Architecture decision — Nav rename:** "My Projects" → "Library" in nav and all references.

---

## Phase 1: Scope & Foundation (low risk, no visual change)

### 1A. Technology scope: CS + Hybrid priority
**Files:** `src/pages/Search.jsx`, `src/components/USMap.jsx`, `src/pages/Library.jsx`

The TECHNOLOGIES array in Search.jsx currently offers: Community Solar, C&I Solar, BESS, Hybrid. Keep all four but reorder and visually demote:
- Reorder: `['Community Solar', 'Hybrid', 'C&I Solar', 'BESS']`
- In the FieldSelect dropdown, add a subtle divider + "Other" label before C&I and BESS
- In Library filters, same reorder

In USMap tooltip and StateDetailPanel, ensure CS-specific data is always primary (it already is — just audit for any C&I-first references).

### 1B. Automate "data last verified" timestamps
**Files:** `src/lib/programData.js`, `src/pages/Search.jsx`, `src/components/StateDetailPanel.jsx`

Currently `lastVerified` is a manually-set date in state_programs. Replace the display logic:
- In `programData.js` `normalize()`, add: `lastSynced: row.updated_at` (Supabase auto-updates this on any row change)
- In Search.jsx results header (line ~2630), change `lastUpdated` display to use `max(lastVerified, lastSynced)` — whichever is more recent
- In StateDetailPanel footer, same logic
- Format as relative: "Updated 3 days ago" (with full date on hover)

### 1C. ESC key navigation
**Files:** `src/pages/Dashboard.jsx`, `src/components/StateDetailPanel.jsx`, `src/components/MetricsBar.jsx`

- Dashboard: add `useEffect` listening for Escape when `selectedStateId` is set → call `handleClosePanel()`
- MetricsBar: add ESC listener when modal is open → close modal
- StateDetailPanel: ESC already handled by Dashboard parent (panel has no internal modal)

### 1D. Rename "My Projects" → "Library"
**Files:** `src/components/Nav.jsx:68`, `src/pages/Library.jsx` (page header, title), `src/pages/Search.jsx` (save confirmation text), `src/pages/Profile.jsx` (recent activity link)

Simple text replacements. Nav link label, page title, any "My Projects" string references.

---

## Phase 2: Dashboard Overhaul

### 2A. Map color scheme + legend standardization
**File:** `src/components/USMap.jsx`

**Problem:** Current green gradient is too flat — states at 55 vs 75 look nearly identical. Legend has 5 buckets but no numbers.

**Fix — new color scale with clearer breakpoints:**
```
Score 75+:  #059669 (vivid emerald)
Score 60-74: #0D9488 (teal)
Score 45-59: #0EA5E9 (sky blue)
Score 25-44: #94A3B8 (slate)
Score <25:  #CBD5E1 (light gray)
Pending:    #F59E0B (amber)
No Program: #E2E8F0 (faint gray)
Selected:   #7C3AED (violet — keep)
```

**Legend redesign:** Replace inline text legend with a horizontal bar below the map title:
- 7 color swatches with labels: "75+ Strong", "60-74 Viable", "45-59 Moderate", "25-44 Weak", "<25 Non-viable", "Pending", "No Program"
- Each swatch is a small rectangle, not a dot
- Compact single row

### 2B. StateDetailPanel → CS Program Database drill-down
**File:** `src/components/StateDetailPanel.jsx`

Redesign the panel into a structured, widget-based CS program sheet when a state is clicked. Current: score bar + 2 text sections + news. New structure:

**Header:** State name + program status badge + feasibility score (keep ScoreBar)

**Tab bar** (within the panel): "Program" | "Market" | "News"

**Program tab (default):**
- **Program Identity widget:** CS program name, administering agency, program type (virtual net metering, community solar garden, etc.), launch year
- **Capacity widget:** remaining MW, total allocated MW, fill rate bar, enrollment rate (MW/mo), runway badge
- **Eligibility widget:** LMI requirement (%), max project size, eligible technologies, subscriber rules
- **Incentive widget:** ITC base + adders, REC/SREC value, net metering status, bill credit structure
- All data from existing `state_programs` + `revenue_stacks` tables — no new DB tables needed

**Market tab:**
- IX difficulty + notes
- Serving utilities (from county_intelligence defaults)
- Sub-score breakdown (Offtake/IX/Site bars — reuse from Search.jsx `SubScoreBar`)

**News tab:**
- Existing filtered news (keep current implementation)

**Implementation:** Convert StateDetailPanel body into a 3-tab component. Each tab is a function component receiving `state` prop. Use `useState` for active tab. Data is already available from `stateProgramMap` + can call `getRevenueStack(state.id)` on mount.

### 2C. AI-powered news summaries
**Files:** `api/lens-insight.js`, `src/components/NewsFeed.jsx`

Add `action: 'news-summary'` to lens-insight.js:
- Accepts `{ action: 'news-summary', items: [{headline, summary, pillar, source}...] }`
- System prompt: "Summarize these community solar market developments into 2-3 sentences highlighting policy changes, capacity shifts, and developer implications."
- Returns `{ summary: "..." }`
- max_tokens: 300

In NewsFeed.jsx:
- Add a "Market Pulse" card at the top of the feed (above filter tabs)
- Shows AI summary when loaded, shimmer while loading
- "Generate Summary" button for first load (not auto — saves API tokens)
- Requires auth token (Pro only — free users see normal feed)

### 2D. Policy alert criteria definition
**File:** `src/components/NewsFeed.jsx`, `src/components/MetricsBar.jsx`

Currently `type === 'policy-alert'` is manually set in the news_feed table. Formalize:
- In NewsFeed, add a subtle info tooltip on the "Policy Alert" badge explaining criteria: "Flagged when: program capacity drops >20%, new legislation passes, rate structure changes, or enrollment freeze announced"
- In MetricsBar PolicyAlertsDetail modal, add the same criteria definition at the top
- No code logic change — this is documentation/UX, the manual flagging workflow stays (user confirmed: "maintain manual source validation workflow before publishing")

---

## Phase 3: Lens Intelligence Upgrade

### 3A. Interactive AI modules
**File:** `src/pages/Search.jsx` — MarketIntelligenceSummary component (lines 1465-1780)

Transform the three static text blocks (Immediate Action, Stage Guidance, Competitive Context) into expandable card widgets:

**Current:** Full text blocks always visible, stacked vertically, differentiated only by left-border color.

**New design — collapsed card grid:**
- 3 cards in a responsive row (lg:3-col, sm:stacked)
- Each card shows: icon + title + first sentence only (truncated)
- Click to expand: card grows to full width, pushes others down, shows complete text
- Smooth height animation (`max-height` transition + `overflow-hidden`)
- Active card gets a subtle glow/shadow
- Only one expanded at a time (accordion pattern)

**Card specs:**
| Card | Icon | Color | Border |
|------|------|-------|--------|
| Immediate Action | Lightning bolt | Purple | `#7C3AED` |
| Stage Guidance | Clock | Teal | `#0F6E56` |
| Competitive Context | Users | Blue | `#2563EB` |

Each card header also shows a relevance indicator: high/medium/low based on content length and whether the AI flagged urgency markers.

### 3B. Sensitivity analysis as modal widget
**File:** `src/pages/Search.jsx` — extract from MarketIntelligenceSummary into standalone component

**Current:** Sensitivity analysis is buried at the bottom of MarketIntelligenceSummary, scroll-dependent, easy to miss.

**New design — floating panel:**
- Add a "Sensitivity Analysis" button in the results header (next to Save/Compare buttons)
- Clicking opens a slide-over panel from the right (not a centered modal — keeps results visible)
- Panel width: ~420px, full height, dark header with teal accent

**Panel contents:**
1. **Base case display:** Current score with sub-score bars (Offtake/IX/Site)
2. **Scenario toggles:** Pre-built scenarios as toggle switches (not buttons). Each toggle shows: label, score delta badge, one-line description
3. **Custom scenario builder:** Always visible at bottom (not collapsible). Two dropdowns (IX difficulty, CS status) + live score delta
4. **AI rationale:** When any scenario is active, call lens-insight.js with `action: 'sensitivity'` passing the scenario override + base state data. Returns 1-2 sentence explanation of why the score changed. Show below the active toggle.
5. **Score comparison bar:** Visual bar showing base score vs scenario score side by side

Add `action: 'sensitivity'` to lens-insight.js:
- Accepts `{ action: 'sensitivity', state, scenario, baseScore, newScore, override }`
- System prompt: "Explain in 1-2 developer-focused sentences why this scenario changes the feasibility score. Be specific about the market mechanism."
- Returns `{ rationale: "..." }`
- max_tokens: 200

### 3C. Clean up market intelligence tags
**File:** `src/pages/Search.jsx` — `generateMarketSummary()` function (lines 1138-1286)

**Problem:** Tags like "No CS program" and "Index 56 – viable" restate what's already shown in the score panel and status badges — low information density.

**Fix:**
- Remove the verdict/summary text block when AI insight is available (it's redundant with the AI brief)
- Keep signal tiles but refine: remove any signal that just restates a badge value (e.g., "Program: Active" when the status badge already says Active)
- Signal tiles should only show when they add context beyond what's visible in other panels (e.g., "LMI sourcing will be challenging at 40% — 12,000 eligible subscribers in county" is high value; "IX: Moderate" is not)

### 3D. Consistent layout for low-data states
**File:** `src/pages/Search.jsx` — pillar cards (SiteControlCard, InterconnectionCard, OfftakeCard)

**Problem:** States like KS with no CS program, no county data, and no revenue rates show empty/broken cards.

**Fix:** Each pillar card should have a structured placeholder when data is missing:
- Gray dashed border instead of solid
- Icon + "Limited data for [State]" message
- Specific guidance: "IX queue data not available — contact [utility] directly for interconnection timeline"
- "Request coverage" link (mailto or feedback form)
- Cards still render at correct height to maintain layout consistency

---

## Phase 4: Library War Room Redesign

### 4A. Visual identity shift
**File:** `src/pages/Library.jsx` — LibraryContent component

**Concept:** Transform from a light card list into a developer command center. Not full dark mode — instead, use dark accents for section headers and widget chrome, while keeping card content light for readability.

**Page header redesign:**
- Dark gradient banner (same style as Profile banner): `linear-gradient(135deg, #0A3D2E 0%, #0C1220 100%)`
- Title: "Library" (not "My Projects" or "Deal Tracker")
- Subtitle: project count + total MW + alert count, inline
- Export CSV + New Lens buttons: ghost-style on dark background (white text, subtle border)

**Stat strip redesign:**
- Remove the current 3-card stat strip (it duplicates Portfolio Intelligence)
- Replace with a single-line contextual bar: `"12 projects · 45.2 MW · 3 states · 2 alerts"` — compact, not cards

**Section separators:**
- Between pipeline, portfolio intelligence, and project list: use thin dark headers with uppercase labels (like MetricsBar style) instead of plain SectionDividers

### 4B. Pipeline distribution overhaul
**File:** `src/pages/Library.jsx` — pipeline distribution section (lines ~1264-1313)

**Current:** Colored bars + labels below. Functional but bland.

**New design:**
- Add a color legend row above the bars (7 stage colors with labels)
- Make bars clickable: clicking a stage bar filters the project list to that stage
- Add MW values directly on/above each bar (not just below)
- Wider bars with more padding, rounded corners
- Hover: show tooltip AND highlight the corresponding projects in the list below (add a subtle flash/border)
- Active filter state: clicked bar gets a ring outline, others dim to 50% opacity
- Clear filter: click the active bar again or use the stage dropdown

### 4C. Portfolio Intelligence deduplication + interactive geo
**File:** `src/pages/Library.jsx` — WeeklySummaryCard component

**Problem (from user notes):** Health Score, Avg Score, and Total Capacity are partially redundant. Risk Spread visual is low-value. Geographic Spread is static bars.

**Redesign — 2-row layout:**

**Row 1: Three KPI widgets (keep):**
- Portfolio Health gauge (keep — this IS the primary metric)
- Total MW + project count (combine into one widget: large MW number, smaller "across N projects" subtitle)
- MW by Technology donut (keep)

**Remove:** Avg Score widget (redundant with Health), Risk Spread bars (low value — the health gauge already conveys this)

**Row 2: Interactive geographic view:**
- Replace the static bar chart with a **mini US map** — reuse USMap component with a simplified renderer
- Each state with projects gets a colored marker (sized by MW, colored by avg score)
- Hover: show state name + project count + total MW + avg score
- Click: filters project list to that state
- If only 1-2 states: fall back to the current bar chart (map would look empty)

**Row 3: AI Insight (keep current design)**

### 4D. Interactive alerts banner
**File:** `src/pages/Library.jsx` — "What Changed" banner (lines ~1394-1414)

**Current:** Static blue bar saying "X projects have updated data · Y alerts"

**Redesign:**
- Make the alert count clickable → scrolls to first project with alerts and highlights it
- Add individual alert chips inline: "IL capacity limited · NY score drop · CO queue harder"
- Each chip is clickable → scrolls to that specific project
- Higher contrast colors: urgent alerts get red chip, warnings get amber (current blue is too subtle)
- Dismissible with x button (persists in session only)

### 4E. YourDeal section redesign
**File:** `src/pages/Library.jsx` — YourDealSection component (lines 685-796)

**Problem:** Section is sparse — just stage picker, MW, tech badge, and a notes textarea with hint buttons.

**Redesign as structured deal tracker:**
- **Deal status strip:** Stage picker (keep) + key date field (optional, new) + priority selector (High/Medium/Low, new — stored in projects.notes as structured prefix or new column)
- **Quick facts grid:** Serving utility, IX difficulty, saved score vs current score delta
- **Notes:** Keep textarea but add auto-save indicator more prominently (pulsing dot is too subtle -> use a small toast-style "Saved" badge that appears for 2s)
- **Remove** the pipeline progress visualization from inside YourDeal (it duplicates the page-level pipeline chart)

### 4F. CSV export expansion
**File:** `src/pages/Library.jsx` — exportCSV function (lines 243-267)

**Current columns (11):** Name, State, County, MW, Technology, Stage, CS Status, CS Program, Feasibility Index, Serving Utility, Saved Date

**Add columns (7 new, total 18):**
- IX Difficulty
- IX Notes (truncated to 200 chars)
- Program Capacity (MW remaining)
- LMI Required (%)
- Program Runway (months)
- Revenue Estimate ($/MW/yr — from revenueEngine if available)
- Risk Flags (comma-separated alert labels)

To get the extra data: the export function already has access to `stateProgramMap`. For revenue, call `computeRevenueProjection` from revenueEngine.js (already imported in Library? If not, import it). For alerts, `getAlerts()` is already in scope.

### 4G. Stage dropdown truncation fix
**File:** `src/pages/Library.jsx` — StagePicker component

**Bug:** When the project card is collapsed, the StagePicker dropdown text gets truncated by the card's `overflow-hidden`.

**Fix:** Add `z-50` and `position: fixed` (or portal) to the StagePicker dropdown so it renders above the card boundary. Alternatively, use `overflow-visible` on the collapsed card header row.

---

## Phase 5: PDF Export Upgrade

### 5A. AI-driven project insight in PDF
**Files:** `src/components/ProjectPDFExport.jsx`, `src/pages/Library.jsx` (export handler)

**Current:** PDF has no AI content — just static data tables and score.

**New approach:**
- When "Export Summary PDF" is clicked, first fetch AI insight via lens-insight.js with a new `action: 'pdf-summary'`
- Accepts: `{ action: 'pdf-summary', project: {name, state, county, mw, stage, technology, score, ixDifficulty, csStatus, servingUtility} }`
- Returns: `{ siteControlSummary, ixSummary, revenueSummary, recommendation }` — four short paragraphs
- max_tokens: 500

**PDF layout additions:**
- After the Market Intelligence table, add "AI Analysis" section with 4 mini-cards:
  - Site Control Assessment (1-2 sentences)
  - Interconnection Outlook (1-2 sentences)
  - Revenue Positioning (1-2 sentences)
  - Recommendation (1-2 sentences, bold)
- Add Tractova logo SVG in header (currently just text "TRACTOVA")
- Upgrade footer: add generation timestamp, user email, subtle branding bar

**Loading UX:** Show a brief loading indicator on the export button while AI generates (1-2 seconds). Disable the button during fetch.

---

## Phase 6: Profile + Glossary + About

### 6A. Profile layout + toggle fix
**File:** `src/pages/Profile.jsx`

**Toggle fix:** The `translate-x-4` on the toggle dot overflows the `w-9` container. Fix: change to `translate-x-[18px]` or adjust container to `w-10`.

**Layout rebalance:** Currently `max-w-lg` pins everything to a narrow left column. Redesign:
- Widen to `max-w-2xl`
- Two-column layout on desktop: left column (account info, subscription, alerts) + right column (portfolio stats, recent activity)
- On mobile: stack to single column
- Right column gets a subtle background texture or gradient edge to fill the visual space

**Positive event alerts:**
- In AlertPreferences component, add a third toggle: "Good news alerts — capacity additions, new program launches, score improvements"
- In `send-alerts.js`, add detection for: score increase >10 points, CS status upgrade (pending->active, limited->active), capacity increase >100MW
- Store as `profiles.alert_positive` (add to migration 009 or new migration 010)

### 6B. Glossary expansion
**File:** `src/pages/Glossary.jsx`

Add platform-specific terms to the TERMS array. New entries:
- **Lens Analysis:** "Tractova's core intelligence tool. Enter a state, county, MW size, stage, and technology to generate a full feasibility assessment with AI-powered market intelligence."
- **Feasibility Index:** "Composite score (0-100) combining Offtake (40%), Interconnection (35%), and Site Control (25%) sub-scores. Stage and technology adjustments shift each component."
- **Add to Compare:** "Save a Lens result or Library project to the comparison tray. Compare up to 4 projects side-by-side with AI-generated tradeoff analysis."
- **Market Intelligence:** "AI-generated analysis section in Lens results, including Immediate Action items, Stage-specific Guidance, and Competitive Context."
- **Portfolio Intelligence:** "AI-powered portfolio summary in the Library, analyzing geographic diversification, risk concentration, and strategic recommendations."
- **Program Runway:** "Estimated months until a community solar program's remaining capacity is fully enrolled, based on current enrollment rate."
- **Sensitivity Analysis:** "Interactive scenario testing in Lens results. Toggle market conditions (IX difficulty, program status) to see score impact with AI rationale."

Pillar: `'all'` for platform terms (gray badge).

### 6C. About section on Landing page
**File:** `src/pages/Landing.jsx`

Add a new section between the existing feature showcase and the footer:

**"How Tractova Works" section:**
- 3-step visual: (1) Select a market -> (2) Analyze feasibility -> (3) Track & compare
- Each step: icon + title + 1-sentence description
- Below: "Built for solar developers by solar developers. Tractova aggregates public data from state PUCs, ISO/RTOs, EIA, and NREL into actionable intelligence -- so you can spend less time on spreadsheets and more time closing deals."
- Methodology note: "Feasibility scores are computed from live program capacity, interconnection conditions, and site control factors. AI analysis powered by Claude."

---

## Phase 7: Final Consistency Pass

### 7A. Alert color contrast audit
**Files:** `src/pages/Library.jsx` (AlertChip), `src/components/NewsFeed.jsx`

- Urgent alerts: change from red-50 bg to red-100 bg, red-800 text (more contrast)
- Warning alerts: change from amber-50 to amber-100, amber-800 text
- Info (data refreshed): keep current blue styling

### 7B. Data refresh button cleanup
**File:** `src/pages/Library.jsx`

Find the data refresh button (if it exists in ProjectCard or header) and:
- Integrate into the page header bar as an icon-only button with tooltip
- Remove any isolated/floating placement

### 7C. Color consistency audit
Ensure TECH_COLORS and STAGE_COLORS are defined in ONE place and imported everywhere (currently duplicated in Library.jsx and Profile.jsx). Extract to `src/lib/constants.js`.

---

## Execution Order

| Phase | Dependencies | Impact |
|-------|-------------|--------|
| 1 (Foundation) | None | Low visual, high consistency |
| 2 (Dashboard) | Phase 1B for timestamps | High -- dashboard is first impression |
| 3 (Lens) | None | High -- core product surface |
| 4 (Library) | Phase 1D for rename | Highest -- user's primary ask |
| 5 (PDF) | None | Medium -- export quality |
| 6 (Profile/Glossary/About) | None | Medium -- completeness |
| 7 (Polish) | All phases | Low -- consistency |

## Verification

After each phase:
1. `npx vite build` passes
2. `ls api/*.js | wc -l` = 11 (no new serverless functions)
3. Visual spot-check in dev server for each modified surface

After all phases:
4. Dashboard: click 3+ states, verify CS database drill-down renders, ESC closes panel
5. Lens: run analysis for IL (full data) + KS (low data) -- verify consistent layout, interactive AI cards expand/collapse, sensitivity panel opens/closes
6. Library: verify pipeline click-to-filter, geographic mini-map renders, CSV has 18 columns, PDF includes AI insight
7. Profile: verify toggle dots don't overflow, two-column layout on desktop
8. Glossary: search for "Lens Analysis" -- verify platform terms appear
9. Compare: open with 2+ items -- verify AI comparison still loads (regression check)

## Key Files

| File | Phases |
|------|--------|
| `src/pages/Search.jsx` | 1A, 1B, 3A, 3B, 3C, 3D |
| `src/pages/Library.jsx` | 1A, 1D, 4A-4G |
| `src/pages/Dashboard.jsx` | 1C, 2B |
| `src/pages/Profile.jsx` | 1D, 6A |
| `src/pages/Landing.jsx` | 6C |
| `src/pages/Glossary.jsx` | 6B |
| `src/components/USMap.jsx` | 2A |
| `src/components/StateDetailPanel.jsx` | 1B, 2B |
| `src/components/NewsFeed.jsx` | 2C, 2D |
| `src/components/MetricsBar.jsx` | 1C, 2D |
| `src/components/Nav.jsx` | 1D |
| `src/components/ProjectPDFExport.jsx` | 5A |
| `api/lens-insight.js` | 2C, 3B, 5A |
| `src/lib/programData.js` | 1B |
| `src/lib/constants.js` (new) | 7C |
