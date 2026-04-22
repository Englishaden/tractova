// Substation proximity engine.
// Seed data from EIA Form 860 — major substations in CS-active states.
// Pre-computed county centroid → nearest substations.
// Distances are approximate (haversine from county centroid).

const SUBSTATIONS = {
  IL: [
    { name: 'Pontiac 138kV', lat: 40.88, lon: -88.63, voltageKv: 138, capacityMw: 45, utility: 'ComEd' },
    { name: 'Dixon 345kV', lat: 41.84, lon: -89.48, voltageKv: 345, capacityMw: 120, utility: 'ComEd' },
    { name: 'Elwood 765kV', lat: 41.40, lon: -88.11, voltageKv: 765, capacityMw: 350, utility: 'ComEd' },
    { name: 'DeWitt 345kV', lat: 40.17, lon: -88.90, voltageKv: 345, capacityMw: 95, utility: 'Ameren' },
    { name: 'Coffeen 345kV', lat: 39.07, lon: -89.40, voltageKv: 345, capacityMw: 110, utility: 'Ameren' },
    { name: 'Kincaid 345kV', lat: 39.58, lon: -89.42, voltageKv: 345, capacityMw: 80, utility: 'Ameren' },
    { name: 'Lombard 138kV', lat: 41.88, lon: -88.01, voltageKv: 138, capacityMw: 55, utility: 'ComEd' },
    { name: 'Rockford 138kV', lat: 42.27, lon: -89.09, voltageKv: 138, capacityMw: 40, utility: 'ComEd' },
    { name: 'Marion 138kV', lat: 37.73, lon: -88.93, voltageKv: 138, capacityMw: 35, utility: 'Ameren' },
    { name: 'Quincy 138kV', lat: 39.93, lon: -91.41, voltageKv: 138, capacityMw: 30, utility: 'Ameren' },
  ],
  NY: [
    { name: 'Marcy 765kV', lat: 43.17, lon: -75.27, voltageKv: 765, capacityMw: 400, utility: 'National Grid' },
    { name: 'Dunwoodie 345kV', lat: 40.94, lon: -73.87, voltageKv: 345, capacityMw: 200, utility: 'ConEdison' },
    { name: 'Pleasant Valley 345kV', lat: 41.75, lon: -73.82, voltageKv: 345, capacityMw: 150, utility: 'Central Hudson' },
    { name: 'Rotterdam 230kV', lat: 42.79, lon: -74.00, voltageKv: 230, capacityMw: 90, utility: 'National Grid' },
    { name: 'Oakdale 138kV', lat: 40.74, lon: -73.14, voltageKv: 138, capacityMw: 60, utility: 'PSEG LI' },
    { name: 'Massena 230kV', lat: 44.93, lon: -74.89, voltageKv: 230, capacityMw: 70, utility: 'National Grid' },
    { name: 'Niagara 345kV', lat: 43.08, lon: -79.04, voltageKv: 345, capacityMw: 180, utility: 'National Grid' },
    { name: 'Albany 115kV', lat: 42.65, lon: -73.76, voltageKv: 115, capacityMw: 45, utility: 'National Grid' },
  ],
  MA: [
    { name: 'West Medway 345kV', lat: 42.14, lon: -71.42, voltageKv: 345, capacityMw: 160, utility: 'National Grid' },
    { name: 'Millbury 345kV', lat: 42.20, lon: -71.77, voltageKv: 345, capacityMw: 140, utility: 'National Grid' },
    { name: 'Canal 345kV', lat: 41.73, lon: -70.61, voltageKv: 345, capacityMw: 120, utility: 'Eversource' },
    { name: 'Brayton Point 345kV', lat: 41.70, lon: -71.18, voltageKv: 345, capacityMw: 130, utility: 'Eversource' },
    { name: 'Ludlow 115kV', lat: 42.18, lon: -72.47, voltageKv: 115, capacityMw: 50, utility: 'Eversource' },
    { name: 'Pittsfield 115kV', lat: 42.45, lon: -73.25, voltageKv: 115, capacityMw: 35, utility: 'Eversource' },
  ],
  MN: [
    { name: 'Blue Lake 345kV', lat: 44.94, lon: -93.44, voltageKv: 345, capacityMw: 180, utility: 'Xcel Energy' },
    { name: 'Sherco 345kV', lat: 45.38, lon: -93.89, voltageKv: 345, capacityMw: 200, utility: 'Xcel Energy' },
    { name: 'Chisago 345kV', lat: 45.37, lon: -92.89, voltageKv: 345, capacityMw: 120, utility: 'Xcel Energy' },
    { name: 'Red Wing 115kV', lat: 44.56, lon: -92.53, voltageKv: 115, capacityMw: 45, utility: 'Xcel Energy' },
    { name: 'Marshall 115kV', lat: 44.45, lon: -95.79, voltageKv: 115, capacityMw: 40, utility: 'Xcel Energy' },
    { name: 'Wilmarth 345kV', lat: 44.15, lon: -93.98, voltageKv: 345, capacityMw: 100, utility: 'Xcel Energy' },
  ],
  CO: [
    { name: 'Comanche 345kV', lat: 38.22, lon: -104.58, voltageKv: 345, capacityMw: 250, utility: 'Xcel Energy' },
    { name: 'Daniels Park 230kV', lat: 39.49, lon: -104.91, voltageKv: 230, capacityMw: 140, utility: 'Xcel Energy' },
    { name: 'Pawnee 230kV', lat: 40.82, lon: -104.72, voltageKv: 230, capacityMw: 110, utility: 'Xcel Energy' },
    { name: 'Ault 230kV', lat: 40.58, lon: -104.73, voltageKv: 230, capacityMw: 90, utility: 'Xcel Energy' },
    { name: 'San Luis 115kV', lat: 37.68, lon: -105.42, voltageKv: 115, capacityMw: 35, utility: 'Xcel Energy' },
    { name: 'Pueblo 115kV', lat: 38.27, lon: -104.61, voltageKv: 115, capacityMw: 50, utility: 'Xcel Energy' },
  ],
  NJ: [
    { name: 'Linden 230kV', lat: 40.63, lon: -74.24, voltageKv: 230, capacityMw: 160, utility: 'PSE&G' },
    { name: 'Branchburg 230kV', lat: 40.57, lon: -74.73, voltageKv: 230, capacityMw: 120, utility: 'PSE&G' },
    { name: 'Deans 230kV', lat: 40.40, lon: -74.50, voltageKv: 230, capacityMw: 100, utility: 'PSE&G' },
    { name: 'Salem 500kV', lat: 39.46, lon: -75.54, voltageKv: 500, capacityMw: 300, utility: 'PSE&G' },
    { name: 'Larrabee 230kV', lat: 40.74, lon: -74.19, voltageKv: 230, capacityMw: 110, utility: 'JCP&L' },
  ],
  MD: [
    { name: 'Calvert Cliffs 500kV', lat: 38.43, lon: -76.44, voltageKv: 500, capacityMw: 280, utility: 'BGE' },
    { name: 'Waugh Chapel 230kV', lat: 39.07, lon: -76.68, voltageKv: 230, capacityMw: 120, utility: 'BGE' },
    { name: 'Chalk Point 230kV', lat: 38.53, lon: -76.67, voltageKv: 230, capacityMw: 100, utility: 'Pepco' },
    { name: 'Indian River 138kV', lat: 38.60, lon: -75.06, voltageKv: 138, capacityMw: 55, utility: 'Delmarva' },
  ],
  ME: [
    { name: 'Maine Yankee 345kV', lat: 43.95, lon: -69.70, voltageKv: 345, capacityMw: 100, utility: 'CMP' },
    { name: 'Orrington 345kV', lat: 44.73, lon: -68.82, voltageKv: 345, capacityMw: 80, utility: 'Versant' },
    { name: 'Surowiec 345kV', lat: 43.97, lon: -70.13, voltageKv: 345, capacityMw: 90, utility: 'CMP' },
  ],
}

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

export function getNearestSubstations(stateId, countyName, count = 3) {
  const subs = SUBSTATIONS[stateId]
  if (!subs) return null

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

export function hasSubstationData(stateId) {
  return stateId in SUBSTATIONS
}
