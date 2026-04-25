// Substation proximity engine.
// Reads substation data from Supabase via programData.
// County centroids from Census TIGER data (compute-only, not stored).

import { getSubstations } from './programData'

// County centroid coordinates (approximate, from Census TIGER data)
const COUNTY_CENTROIDS = {
  'IL:cook':       { lat: 41.84, lon: -87.82 },
  'IL:will':       { lat: 41.45, lon: -87.98 },
  'IL:dupage':     { lat: 41.85, lon: -88.09 },
  'IL:lake':       { lat: 42.35, lon: -87.86 },
  'IL:kane':       { lat: 41.94, lon: -88.43 },
  'IL:mchenry':    { lat: 42.32, lon: -88.45 },
  'IL:champaign':  { lat: 40.14, lon: -88.20 },
  'IL:sangamon':   { lat: 39.76, lon: -89.66 },
  'IL:mclean':     { lat: 40.49, lon: -88.85 },
  'IL:lasalle':    { lat: 41.34, lon: -89.09 },
  'IL:winnebago':  { lat: 42.34, lon: -89.07 },
  'IL:peoria':     { lat: 40.79, lon: -89.76 },
  'IL:madison':    { lat: 38.83, lon: -89.90 },
  'IL:stclair':    { lat: 38.47, lon: -89.93 },
  'NY:suffolk':    { lat: 40.94, lon: -72.68 },
  'NY:nassau':     { lat: 40.73, lon: -73.59 },
  'NY:westchester':{ lat: 41.15, lon: -73.77 },
  'NY:erie':       { lat: 42.76, lon: -78.78 },
  'NY:monroe':     { lat: 43.14, lon: -77.66 },
  'NY:onondaga':   { lat: 43.01, lon: -76.19 },
  'NY:albany':     { lat: 42.60, lon: -73.97 },
  'NY:dutchess':   { lat: 41.77, lon: -73.74 },
  'NY:orange':     { lat: 41.40, lon: -74.31 },
  'NY:saratoga':   { lat: 43.11, lon: -73.86 },
  'MA:middlesex':  { lat: 42.49, lon: -71.39 },
  'MA:worcester':  { lat: 42.35, lon: -71.91 },
  'MA:essex':      { lat: 42.66, lon: -70.95 },
  'MA:norfolk':    { lat: 42.17, lon: -71.18 },
  'MA:bristol':    { lat: 41.75, lon: -71.07 },
  'MA:plymouth':   { lat: 41.99, lon: -70.74 },
  'MA:hampshire':  { lat: 42.34, lon: -72.66 },
  'MA:berkshire':  { lat: 42.38, lon: -73.21 },
  'MN:hennepin':   { lat: 44.98, lon: -93.47 },
  'MN:ramsey':     { lat: 45.02, lon: -93.10 },
  'MN:dakota':     { lat: 44.67, lon: -93.07 },
  'MN:anoka':      { lat: 45.27, lon: -93.25 },
  'MN:washington':  { lat: 45.04, lon: -92.88 },
  'MN:scott':      { lat: 44.65, lon: -93.53 },
  'MN:olmsted':    { lat: 44.00, lon: -92.46 },
  'MN:stearns':    { lat: 45.55, lon: -94.62 },
  'CO:denver':     { lat: 39.74, lon: -104.99 },
  'CO:elpaso':     { lat: 38.83, lon: -104.76 },
  'CO:arapahoe':   { lat: 39.65, lon: -104.34 },
  'CO:jefferson':  { lat: 39.59, lon: -105.25 },
  'CO:adams':      { lat: 39.87, lon: -104.33 },
  'CO:douglas':    { lat: 39.33, lon: -104.93 },
  'CO:larimer':    { lat: 40.66, lon: -105.46 },
  'CO:weld':       { lat: 40.55, lon: -104.39 },
  'CO:boulder':    { lat: 40.09, lon: -105.36 },
  'CO:pueblo':     { lat: 38.17, lon: -104.62 },
  'NJ:middlesex':  { lat: 40.44, lon: -74.39 },
  'NJ:bergen':     { lat: 40.96, lon: -74.07 },
  'NJ:essex':      { lat: 40.79, lon: -74.25 },
  'NJ:morris':     { lat: 40.86, lon: -74.54 },
  'NJ:burlington': { lat: 39.88, lon: -74.67 },
  'NJ:ocean':      { lat: 39.87, lon: -74.25 },
  'NJ:camden':     { lat: 39.80, lon: -75.00 },
  'NJ:monmouth':   { lat: 40.29, lon: -74.16 },
  'MD:montgomery': { lat: 39.14, lon: -77.24 },
  'MD:princegeorges':{ lat: 38.82, lon: -76.84 },
  'MD:baltimore':  { lat: 39.44, lon: -76.62 },
  'MD:annarundel': { lat: 38.99, lon: -76.57 },
  'MD:howard':     { lat: 39.25, lon: -76.93 },
  'MD:frederick':  { lat: 39.47, lon: -77.40 },
  'MD:harford':    { lat: 39.54, lon: -76.30 },
  'ME:cumberland': { lat: 43.80, lon: -70.33 },
  'ME:york':       { lat: 43.43, lon: -70.68 },
  'ME:penobscot':  { lat: 45.40, lon: -68.65 },
  'ME:kennebec':   { lat: 44.41, lon: -69.77 },
  'ME:androscoggin':{ lat: 44.17, lon: -70.21 },
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function normalizeCounty(name) {
  if (!name) return ''
  return name.toLowerCase().replace(/\s+county$/i, '').replace(/[^a-z0-9]/g, '')
}

// Async — fetches substations from Supabase, computes distances
export async function getNearestSubstations(stateId, countyName, count = 3) {
  const subs = await getSubstations(stateId)
  if (!subs || subs.length === 0) return null

  const key = `${stateId}:${normalizeCounty(countyName)}`
  const centroid = COUNTY_CENTROIDS[key]
  if (!centroid) {
    return subs.slice(0, count).map(s => ({ ...s, distanceMiles: null }))
  }

  const withDist = subs.map(s => ({
    ...s,
    distanceMiles: Math.round(haversineDistance(centroid.lat, centroid.lon, s.lat, s.lon) * 10) / 10,
  }))

  return withDist.sort((a, b) => a.distanceMiles - b.distanceMiles).slice(0, count)
}

export async function hasSubstationData(stateId) {
  const subs = await getSubstations(stateId)
  return subs && subs.length > 0
}
