# Tractova site walk · 2026-05-02

**How to use:**
1. Open this file in any text editor (VS Code, Notepad++, even Notepad).
2. For each item, change `[ ]` to `[x]` when done. If something needs fixing, add your note inline (anywhere on or under the line — I'll find it).
3. When done, paste the contents back into chat and I'll structure the fixes.

Status legend (use whatever you like):
- `[x]` = pass — looks good, no changes needed
- `[~]` = needs fix — add a one-line note below
- `[-]` = skip — didn't load / not applicable

---

## Anonymous flow

### `[ ]` Landing page
- **URL:** https://www.tractova.com/
- **Look:** Hero, three pillars, time-saved comparison, who-it's-for. About to be Huly-revamped — flag issues that would survive the redesign (typography, copy, color drift).
- **Note:**

### `[ ]` Sign in
- **URL:** https://www.tractova.com/signin
- **Look:** Form clarity, error states, password reset link, autofocus.
- **Note:**

### `[ ]` Sign up
- **URL:** https://www.tractova.com/signup
- **Look:** Form clarity, password rules, autofocus, confirmation messaging.
- **Note:**

### `[ ]` Privacy Policy
- **URL:** https://www.tractova.com/privacy
- **Look:** Just shipped today. Section spacing, mono-eyebrow consistency, link colors, table rendering on §04 sub-processors.
- **Note:**

### `[ ]` Terms of Service
- **URL:** https://www.tractova.com/terms
- **Look:** Just shipped today. Section spacing, the new BESS rate-freshness bullet in §06.
- **Note:**

---

## Authed daily flow

### `[ ]` Dashboard
- **URL:** https://www.tractova.com/
- **Look:** IntelligenceBackground floating dots should be visible (just shipped). Map, MetricsBar, NewsFeed, WelcomeCard, Markets-on-the-Move strip.
- **Note:**

### `[ ]` Lens form (empty)
- **URL:** https://www.tractova.com/search
- **Look:** Field labels, dropdown styling, run-analysis button. Form panel header.
- **Note:**

### `[ ]` Lens result — Will County, IL, 5MW CS
- **URL:** https://www.tractova.com/search?state=IL&county=Will&mw=5&stage=Prospecting&technology=Community%20Solar
- **Look:** WALK EVERY SECTION: §01 Market Position gauge, §02 Analyst Brief, §03 Scenario Studio (drag a slider, save a scenario, click "▸ Why?" on it), §04 Pillar Diagnostics (Site/IX/Offtake stacked rows). Bottom disclaimer block — click "Data limitations →" link to see modal. Try switching technology to BESS — look for the "◆ Rates as of 2026-04" amber pill in the BESS revenue panel footer.
- **Note:**

### `[ ]` LensTour onboarding (5-step coachmark)
- **URL:** https://www.tractova.com/search?state=IL&county=Will&mw=5&stage=Prospecting&technology=Community%20Solar&onboarding=1
- **Look:** If you already dismissed the tour on this device, clear localStorage `tractova_lens_tour_completed_at` first (DevTools → Application → Local Storage). Then run the URL — tour fires after results load. Walk all 5 steps + closing card.
- **Note:**

### `[ ]` Library (with projects)
- **URL:** https://www.tractova.com/library
- **Look:** Project cards, WoW state-delta chips, sort/filter row, "Data refreshed [date]" stamp + breathing dot, Scenarios tab toggle.
- **Note:**

### `[ ]` Library empty-state preview
- **URL:** https://www.tractova.com/library?preview=empty
- **Look:** Live-markets strip with 4 cards (or skeleton if stateProgramMap loading), 3 value-prop card grid, CTAs ("Open Tractova Lens" + "Markets on the Move").
- **Note:**

### `[ ]` Compare drawer
- **URL:** https://www.tractova.com/preview
- **Look:** Click any state on the map, in the detail panel click "+ Compare". Add 2-3 states. Click the floating tray. AI compare summary loads.
- **Note:**

### `[ ]` Profile
- **URL:** https://www.tractova.com/profile
- **Look:** Animated header with initials avatar + Tractova mark cameo (Profile is the "gold standard" for ambient — verify others now match). Member-since date legibility, Pro/Free badge, Stripe portal link, exit-intent survey trigger.
- **Note:**

### `[ ]` Glossary
- **URL:** https://www.tractova.com/glossary
- **Look:** Should land at TOP of page (bug fixed today). Pulsing teal dot in hero "Reference" eyebrow. Term cards, search bar, pillar filter chips. Click any term — should scroll into center and pulse.
- **Note:**

---

## Admin

### `[ ]` Admin → Data Health
- **URL:** https://www.tractova.com/admin?tab=8
- **Look:** Mission Control 3-card KPI grid (NWI gauge / IX freshness pills / Substations cron bar). Below: Curation Drift row (may be hidden if everything is fresh), Refresh status panel, Freshness grid, Last cron runs, IX staleness alert, Cron latency table.
- **Note:**

---

## Anything else? (free-form)

If you spotted something not on this list — a Nav inconsistency, a transition that felt off, a button that hovers weirdly — drop it here:

-
-
-
