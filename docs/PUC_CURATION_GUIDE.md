# PUC Docket Curation Guide

> Quarterly playbook for refreshing the Tractova PUC Docket Tracker.
> Last reviewed: 2026-04-29.

## Cadence (the rule)

**1–3 high-impact dockets per active state, refreshed quarterly.** Tractova surfaces signal, not exhaustive coverage. Users get an "Explore PUC portal →" link in every empty / populated panel to drill into the long tail themselves. **Do not chase comprehensiveness here** — that's what users go to the source for.

Total target across the 8 core CS states: ~10–18 active dockets at any time.

---

## The "worth tracking" sniff test

Before you add a docket, run this filter:

### ✅ Worth tracking — affects:

- Program capacity allocation (Illinois Shines blocks, MA SMART tranches, etc.)
- REC / SREC values
- Net-metering or successor compensation tariffs
- IX tariff revisions / cluster-study cost allocation
- LMI carve-out rules
- Capacity-market changes for storage / DER
- Major utility-specific filings affecting CS-relevant tariffs

### ❌ Skip:

- Single-customer rate complaints
- Gas / water utility tariffs (CS dev doesn't care)
- Pure procedural orders (comment-period extensions, scheduling)
- Closed dockets older than ~12 months unless they're the *current landmark* on the topic
- Electric distribution upgrades unrelated to DER
- Transmission siting unrelated to DER
- Anything purely regional (one substation upgrade, one corridor)

### Date filter

When the portal allows it: restrict to **filed within last 18 months** AND status `active` / `pending`. Cuts ~90% of noise.

---

## Per-state search strings

### Illinois (ICC) — `icc.illinois.gov/docket`

```
site:icc.illinois.gov "Illinois Shines"
Illinois Commerce Commission "adjustable block program" 2025 docket
site:icc.illinois.gov "community renewable generation"
```

**Look for:** ABP capacity reallocation between blocks · ComEd or Ameren IX tariff revisions · CEJA implementation rules.

**Docket-number pattern:** `23-0066`, `24-XXXX`.

### Massachusetts (DPU) — `eeaonline.eea.state.ma.us/dpu/fileroom/dockets/`

```
site:eeaonline.eea.state.ma.us "SMART"
"D.P.U. 17-140" Massachusetts SMART
Massachusetts DPU SMART program 2024 2025
```

**Look for:** SMART block 8/9 capacity allocations · DPU 17-140 follow-on dockets · net-metering reform proceedings.

**Docket-number pattern:** `D.P.U. 17-140`, `D.P.U. 22-22`.

### Minnesota (MN PUC) — `edockets.state.mn.us`

```
site:edockets.state.mn.us "community solar garden"
Minnesota PUC "Solar*Rewards Community"
Xcel Energy Minnesota CSG 2025
```

**Look for:** Garden capacity / sizing rule changes · Xcel CSG tariff updates · DER aggregation rules.

**Docket-number pattern:** `E-002/M-XX-XXX`.

### Colorado (CO PUC) — `dora.colorado.gov/puc-edocket`

```
site:dora.colorado.gov "community solar"
Colorado PUC "HB22-1218" implementation
Xcel Colorado community solar tariff
```

**Look for:** CS 2.0 / HB22-1218 implementation rules · Xcel community-solar tariff cases · low-income carve-out implementation.

**Docket-number pattern:** `21A-XXXXE`.

### New Jersey (BPU) — `bpu.nj.gov`

```
site:bpu.nj.gov "successor solar incentive"
New Jersey BPU SuSI 2025 docket
NJ BPU "community solar pilot"
```

**Look for:** SuSI program rules · TREC successor proceedings · permanent CS program creation · Class I REC value cases.

**Docket-number pattern:** `QO22XXXXXX`.

### Maine (MPUC) — `mpuc-cms.maine.gov/CQM.Public.WebUI/`

```
site:mpuc-cms.maine.gov "net energy billing"
Maine PUC NEB reform 2024 2025
Maine "distributed generation" docket
```

**Look for:** NEB reform · DG tariff cases · CMP / Versant interconnection rules · commercial NEB rate-class cases.

### Maryland (PSC) — `psc.state.md.us`

```
site:psc.state.md.us "community solar pilot"
Maryland PSC "community solar program" 2025
Maryland PSC "renewable energy portfolio standard"
```

**Look for:** Pilot program permanence proceedings · capacity expansion · COMAR 20.62 amendments · LMI carve-out rules.

**Docket-number pattern:** `Case No. 9XXXX`.

### New York (DPS) — `documents.dps.ny.gov/public/MatterManagement/CaseSearch.aspx`

```
site:documents.dps.ny.gov "community DG"
"Case 15-E-0751" successor
NYISO interconnection community solar 2025
```

**Look for:** VDER successor proceedings · subscriber-credit / customer-credit mechanic revisions · Con Edison / Central Hudson tariff cases related to DER · interconnection rule changes.

**Docket-number pattern:** `Case 15-E-0751`, `Case 22-E-XXXX`. The `-E-` denotes Electric industry; ignore `-G-` (gas) and `-W-` (water).

---

## Two pro-tips that save 80% of the time

### 1. Start in Google News, not the PUC portal

Search e.g. `"Illinois Commerce Commission" "Illinois Shines" 2024 2025 docket` on `news.google.com`. Industry trade press (Solar Industry Mag, Utility Dive, PV Magazine, RTO Insider) writes summary articles that explicitly cite the relevant docket numbers — which means you can grab the docket # from the article, then plug it directly into the state portal's search.

This skips most of the navigation pain on each portal's bespoke UI. The portal is for verification + the source URL; news articles are for discovery.

### 2. Use AI Classify with PARTIAL info

If you've got just `"NJ BPU SuSI Phase 3 successor proceeding · Docket QO22030153 · filed 2024-XX-XX · approved 2024-XX-XX"` from a news article, that's enough to paste into the Quick Add. Sonnet fills in the structured fields. You don't need to track down the official docket master page if a credible secondary source has the substance.

The `source_url` field can point at the BPU search page OR the news article — both are fine for Tractova's "we curate signal" positioning. The user's escape-hatch button to the official PUC portal handles the comprehensive-coverage need separately.

---

## Quarterly refresh playbook (the actual workflow)

When it's quarter-end and you're refreshing the tracker:

1. **Open `/admin > PUC Dockets`.** Filter to each state in turn.
2. **For each existing docket:** check `last_updated` — if older than 90 days AND the docket is still `comment_open` or `pending_decision`, do a quick Google News search for the docket number to confirm status hasn't changed. If commission has issued an order, change status to `closed` and consider whether to add a successor docket (often there is one).
3. **Add 1–2 net-new dockets per state** based on the search strings above. Don't chase target-counts; if there genuinely isn't material activity in MN this quarter, that's fine — add zero.
4. **Tractova-voice check** on summaries: directive opening verb, named mechanism, quantitative anchor when possible (e.g., "100–300 bps"), actionable "who and when" close. No `monitor closely` / `could potentially` filler. The v=2 AI Classifier prompt is tuned for this; if a generated summary doesn't match the bar, edit inline before saving.
5. **Spot-check the panel in Lens.** Run a Lens analysis on each state and confirm the Regulatory Activity panel renders the new dockets with reasonable sort order (high-impact first).

Total time per quarterly refresh: 60–90 minutes for all 8 core states. Way less than the weekly chase.

---

## When does this guide stop being the answer?

Two trigger conditions for revisiting the curation strategy:

1. **Pro user count crosses ~30–50.** At that scale, sustaining quarterly admin curation might still be viable but starts to feel disproportionate to the value delivered. Worth re-evaluating an automated candidate-surfacing cron at that point — `Tractova_V3_Plan.md` "Next-Session Pickup" tracks the design notes for that build.
2. **A user requests a state we don't cover.** If a paying Pro asks for, say, OH or PA dockets, the calculus shifts. Either we expand Tier 1 to that state (with corresponding curation cost), or the user lives with the explore-source link as the answer.
