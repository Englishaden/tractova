// Phase 2B · TRACTOVA-UX-001 — Generate src/data/county_centroids.json.
//
// Read the us-atlas counties-10m.json TopoJSON, convert each county to a
// GeoJSON Feature, and compute its area-weighted centroid via d3-geo.
// Output a compact JSON keyed by `${STATE_ABBR}::${COUNTY_NAME}` →
// [lon, lat]. The Library Map view consumes this to position project
// pins (each saved project has state + county; we look up centroid by
// the same key shape).
//
// Run once via `node scripts/generate-county-centroids.mjs`. The output
// file is committed to the repo (~100 KB) so the runtime doesn't need
// to load the full 800+ KB TopoJSON every page view.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { feature } from 'topojson-client'
import { geoCentroid } from 'd3-geo'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// FIPS state code → USPS abbreviation. Same map as src/components/USMap.jsx
// so saved project lookups (which use USPS codes) match what we generate.
// DC (11) included for completeness; project pins in DC are unlikely but
// the centroid is cheap to compute.
const FIPS_TO_STATE = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO',
  '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI',
  '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY',
}

function main() {
  const topoPath = path.resolve(__dirname, '..', 'node_modules', 'us-atlas', 'counties-10m.json')
  const outPath  = path.resolve(__dirname, '..', 'src', 'data', 'county_centroids.json')

  const topo = JSON.parse(readFileSync(topoPath, 'utf8'))
  const countiesFc = feature(topo, topo.objects.counties)

  const centroids = {}
  let kept = 0
  let dropped = 0
  let unknownStates = new Set()

  for (const feat of countiesFc.features) {
    const fips = String(feat.id || '').padStart(5, '0')
    const stateFips = fips.slice(0, 2)
    const stateAbbr = FIPS_TO_STATE[stateFips]
    const countyName = feat.properties?.name

    if (!stateAbbr) {
      unknownStates.add(stateFips)
      dropped += 1
      continue
    }
    if (!countyName) {
      dropped += 1
      continue
    }

    const c = geoCentroid(feat)
    // Round to 4 decimal places (~11 m precision) — plenty for pin
    // placement and meaningfully shrinks the JSON.
    const lon = Math.round(c[0] * 10000) / 10000
    const lat = Math.round(c[1] * 10000) / 10000
    centroids[`${stateAbbr}::${countyName}`] = [lon, lat]
    kept += 1
  }

  writeFileSync(outPath, JSON.stringify(centroids) + '\n', 'utf8')

  // Summary so we have a paper trail when something looks off.
  const bytes = JSON.stringify(centroids).length
  console.log(`county_centroids.json:`)
  console.log(`  kept    ${kept}`)
  console.log(`  dropped ${dropped} (no FIPS / no name)`)
  console.log(`  size    ${(bytes / 1024).toFixed(1)} KB`)
  if (unknownStates.size > 0) {
    console.log(`  unknown state FIPS: ${[...unknownStates].sort().join(', ')}  (territories — expected to be skipped)`)
  }
  console.log(`  → ${path.relative(process.cwd(), outPath)}`)
}

main()
