# Hosting-Capacity / ICA data sourcing (for broad IX coverage)

> **Why this exists.** Project-level *interconnection queue* data only exists for
> ~6 states (NY shipped, NJ partial, MA/IL gated/blocked). To get IX coverage
> across most of the map, the realistic path is **hosting-capacity** (a.k.a.
> Integration Capacity Analysis / ICA / DER) data, which most large investor-owned
> utilities publish as **open, machine-readable ArcGIS feeds**.
>
> **What it measures (be honest about this).** Hosting capacity = how much more DG
> a given distribution circuit/feeder can absorb before upgrades are triggered. It
> is **grid headroom, not queue depth** — a *different but real* interconnection
> signal (arguably more useful: it answers "can my parcel's feeder take my
> project?"). In Tractova it would be a new `signalType` (e.g. `hosting_capacity`),
> labeled honestly, shown as live CONTEXT, score still on the curated baseline —
> exactly like the `cs_pipeline` sources.

---

## How to find any utility's ArcGIS endpoint (the repeatable method)

You don't need to know the URL in advance — every utility hosting-capacity *map*
is a web app backed by an ArcGIS REST service you can capture in ~60 seconds:

1. Google **"<utility name> hosting capacity map"** (or "ICA map" / "DER map").
   Open the interactive map page.
2. Open browser **DevTools → Network tab**, then pan/zoom the map once so it
   loads data.
3. In the Network filter box, type **`FeatureServer`** (or `MapServer`, or
   `arcgis`). You'll see requests to a URL like:
   `https://services{N}.arcgis.com/{ORG}/ArcGIS/rest/services/{NAME}/FeatureServer`
4. Copy that base URL. **That's the endpoint.** Send it to me and I wire up a
   scraper (same shape as the NY/NJ ones).

### When there's NO download button (Experience Builder maps)
Many utility maps (e.g. Ameren IL) are ArcGIS **Experience Builder** apps with no
export button. Don't bother — the data is a queryable REST service behind the app.
The map URL contains the experience item id: `experience.arcgis.com/experience/{ID}/…`.
Resolve it to the FeatureServer server-side (no browser):
1. `https://www.arcgis.com/sharing/rest/content/items/{ID}/data?f=json`
   → `dataSources` lists Web Map item ids.
2. `https://www.arcgis.com/sharing/rest/content/items/{WEBMAP_ID}/data?f=json`
   → `operationalLayers[].url` is the FeatureServer.
(Send me the experience URL and I'll do this for you, like I did for Ameren below.)

### Confirm it's usable (optional, paste in a browser)
- **Service metadata / layer list:** add `?f=json` →
  `…/FeatureServer?f=json` (shows the layers + whether a token is required).
- **Pull a few rows of a layer:**
  `…/FeatureServer/0/query?where=1=1&outFields=*&f=geojson&resultRecordCount=10`
- If those return JSON without a login, it's an **open feed** (good). If you get
  a token error, it's gated → skip it (or it needs the manual-download path).
- Open Data Hub portals (URLs like `*.opendata.arcgis.com`) also have direct
  **Download → CSV / GeoJSON / Shapefile / Excel** buttons.

---

## Verified-open starter endpoints (live + no login, checked 2026-05-22)

| Utility(ies) | What | Endpoint (base) |
|---|---|---|
| **PG&E** (CA) | DRP/ICA FeatureServer, 20 layers (feeders, substations, hosting capacity) | `https://services2.arcgis.com/mJaJSax0KPHoCNB6/ArcGIS/rest/services/DRPComplianceRelProd/FeatureServer` |
| **SCE** (CA) | DRPEP Data Portal (ArcGIS Open Data hub) | `https://drpep-sce2.opendata.arcgis.com` |
| **Exelon org** — **ComEd (IL), BGE (MD)**, + PECO (PA), Pepco (DC/MD), Delmarva (DE/MD), ACE (NJ) | 48 services incl. `BGE_HOSTING_CAPACITY_EPRI_AGOL`, `ComEd_*` | `https://services3.arcgis.com/agWTKEK7X5K1Bx7o/ArcGIS/rest/services?f=json` (browse, pick the hosting-capacity service per utility) |
| **Ameren Illinois** (IL) | Distribution HC grid, **1.67M cells**; field `MAXGENMW_TXT` = MW headroom, + `FEEDERID`, `OPERATINGVOLTAGE`, `GENLIMITER` | `https://services5.arcgis.com/3jEEGnl6c1x9Sze7/arcgis/rest/services/IL_HC_Grids/FeatureServer/0` (resolved from experience `38e61537…` 2026-05-23) |

The Exelon org alone potentially covers **IL, MD, PA, DC, DE, NJ** hosting
capacity from one ArcGIS org — the highest-leverage single source. Other big
IOUs to check with the method above: **National Grid** (MA/NY —
`systemdataportal.nationalgrid.com`), **Eversource** (MA/CT/NH), **Xcel**
(MN/CO/WI — ORNL OpenEnergyHub also mirrors Xcel hosting capacity under an open
license), **Duke** (NC/SC/FL/IN), **Dominion** (VA), **National Grid**, **SDG&E**.

---

## What I need from you to wire a utility up
Just the **FeatureServer/MapServer base URL** + (if you can tell) which **layer**
holds the hosting-capacity values (often named like `…HostingCapacity…`,
`ICA…`, `…Feeder…`). I'll:
1. Probe the layer's fields + value distribution (no guessing).
2. Build a scraper that aggregates circuit-level headroom → a per-county/utility
   signal, on the weekly cron, with honest `hosting_capacity` labeling.

## Legal note
Open ArcGIS REST feeds served without auth are generally fine to consume, but the
*org's* terms still govern. The ones in the table above were published as public
data portals (PG&E DRP, SCE DRPEP "approved for public sharing", Exelon AGOL). If
a feed's metadata or portal page carries a no-redistribution clause, treat it like
PJM/Illinois Shines (don't republish raw — your call on internal-score use). When
in doubt, send me the endpoint and I'll check the terms before building.
