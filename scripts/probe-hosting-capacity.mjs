/**
 * Verify a hosting-capacity ArcGIS feed BEFORE adding it to FEEDS in
 * api/scrapers/_refresh-hosting-capacity.js. Checks: layer is reachable, the
 * capacity field is numeric, the feature count is manageable, and server-side
 * count/threshold/avg/max all work (no text-field surprises like Ameren IL).
 *
 * Usage:
 *   node scripts/probe-hosting-capacity.mjs "<layerUrl>" "<capField>" [threshold]
 * Example:
 *   node scripts/probe-hosting-capacity.mjs \
 *     "https://services3.arcgis.com/agWTKEK7X5K1Bx7o/arcgis/rest/services/BGE_HOSTING_CAPACITY_EPRI_AGOL/FeatureServer/1" \
 *     "Sum_FEEDER_AVAIL_CAP_MW_MIN" 5
 */
const UA = 'Mozilla/5.0 (Tractova data pipeline)'
const [layerUrl, capField, thrArg] = process.argv.slice(2)
const threshold = Number(thrArg) || 5
if (!layerUrl || !capField) { console.error('Usage: node scripts/probe-hosting-capacity.mjs "<layerUrl>" "<capField>" [threshold]'); process.exit(1) }

async function j(u) {
  const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) })
  const t = await r.text(); try { return JSON.parse(t) } catch { return { _raw: t.slice(0, 150) } }
}

const meta = await j(`${layerUrl}?f=json`)
if (meta.error || meta._raw) { console.error('layer unreachable:', meta.error?.message || meta._raw); process.exit(1) }
const field = (meta.fields || []).find(f => f.name === capField)
console.log(`layer: ${meta.name}`)
console.log(`capField "${capField}" type: ${field ? field.type : 'NOT FOUND'}`)
const numeric = field && /Double|Integer|Single/.test(field.type)
console.log(`numeric? ${numeric ? 'YES ✓' : 'NO ✗ (server-side stats will not work — needs a different approach)'}`)

const total = await j(`${layerUrl}/query?where=1%3D1&returnCountOnly=true&f=json`)
console.log(`feature count: ${total.count} ${total.count > 200000 ? '(⚠ very large)' : ''}`)

const ge = await j(`${layerUrl}/query?where=${encodeURIComponent(`${capField} >= ${threshold}`)}&returnCountOnly=true&f=json`)
console.log(`cells with >= ${threshold}: ${ge.count} (${total.count ? Math.round(100 * ge.count / total.count) : '?'}%)`)

const stats = encodeURIComponent(JSON.stringify([
  { statisticType: 'avg', onStatisticField: capField, outStatisticFieldName: 'avg' },
  { statisticType: 'max', onStatisticField: capField, outStatisticFieldName: 'max' },
]))
const s = await j(`${layerUrl}/query?where=1%3D1&outStatistics=${stats}&f=json`)
console.log(`avg/max: ${JSON.stringify(s.features?.[0]?.attributes ?? s.error ?? s).slice(0, 150)}`)
console.log(`\nVerdict: ${numeric && total.count > 0 && total.count < 200000 ? 'GREEN — add to FEEDS' : 'NOT clean — needs special handling'}`)
