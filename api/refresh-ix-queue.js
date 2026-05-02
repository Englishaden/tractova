import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ─────────────────────────────────────────────────────────────────────────────
// IX Queue Refresh Cron
//
// Runs weekly (Sunday 6 AM UTC). Fetches public interconnection queue data
// from MISO, PJM, NYISO, and ISO-NE. Filters to solar projects <25MW,
// aggregates by utility territory, and upserts to ix_queue_data.
//
// Each ISO scraper is independent — one failure doesn't block the others.
// ─────────────────────────────────────────────────────────────────────────────

// Utility → state mapping (which state each utility's queue data applies to)
const UTILITY_STATE_MAP = {
  // PJM
  'ComEd':            'IL',
  'PSE&G':            'NJ',
  'PSEG':             'NJ',
  'JCP&L':            'NJ',
  'BGE':              'MD',
  'Pepco':            'MD',
  'PECO':             'PA',
  // MISO
  'Ameren Illinois':  'IL',
  'Ameren':           'IL',
  'Xcel Energy':      'MN',
  // NYISO — utility codes as they appear in NYISO's queue xlsx (verified
  // 2026-05-02 against the active queue download). NYISO is single-state.
  'ConEdison':        'NY',
  'Con Edison':       'NY',
  'National Grid':    'NY',
  'NM-NG':            'NY',  // NYISO's abbreviation for National Grid
  'NYSEG':            'NY',
  'RG&E':             'NY',
  'Central Hudson':   'NY',
  'CHG&E':            'NY',  // NYISO's abbreviation for Central Hudson
  'NYPA':             'NY',  // New York Power Authority (state-owned)
  'LIPA':             'NY',  // Long Island Power Authority
  'O&R':              'NY',  // Orange & Rockland
  // ISO-NE
  'National Grid MA': 'MA',
  'Eversource':       'MA',
  'CMP':              'ME',
  'Versant':          'ME',
}

// States we track and their ISO assignments
const STATE_ISO_MAP = {
  IL: ['PJM', 'MISO'],
  NY: ['NYISO'],
  MA: ['ISO-NE'],
  MN: ['MISO'],
  CO: ['WAPA'],
  NJ: ['PJM'],
  MD: ['PJM'],
  ME: ['ISO-NE'],
}

// ── ISO-specific scrapers ────────────────────────────────────────────────────
// Each returns an array of { stateId, iso, utilityName, projects, mw, studyMonths }
// or throws on failure. The caller catches per-ISO.

async function scrapePJM() {
  // PJM publishes queue data as CSV at their planning page
  // URL pattern: https://www.pjm.com/planning/services-requests/interconnection-queues
  // The actual CSV download requires navigating their queue tool.
  // For now, we use their public API endpoint.
  const url = 'https://services.pjm.com/PJMPlanningApi/api/Queue/ExportToCSV'

  const res = await fetch(url, {
    headers: { 'Accept': 'text/csv' },
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) throw new Error(`PJM fetch failed: ${res.status}`)
  const text = await res.text()
  return parseCSVQueue(text, 'PJM', {
    fuelColumn: 'Fuel',
    fuelFilter: ['Solar', 'SUN'],
    mwColumn: 'MFO',
    mwMax: 25,
    utilityColumn: 'Transmission Owner',
    statusColumn: 'Status',
    dateColumn: 'Queue Date',
  })
}

async function scrapeMISO() {
  // MISO GIA queue: https://www.misoenergy.org/planning/generator-interconnection/GI_Queue/
  // Downloads as Excel but they also have a JSON API
  const url = 'https://www.misoenergy.org/api/giqueue/getprojects'

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) throw new Error(`MISO fetch failed: ${res.status}`)
  const data = await res.json()

  // Filter to solar <25MW
  const solar = (Array.isArray(data) ? data : []).filter(p =>
    p.fuelType?.toLowerCase().includes('solar') &&
    (parseFloat(p.summerCapacity || p.capacity || 0) < 25)
  )

  return aggregateByUtility(solar, 'MISO', {
    utilityField: 'transmissionOwner',
    mwField: 'summerCapacity',
    dateField: 'queueDate',
  })
}

async function scrapeNYISO() {
  // Rewrite 2026-05-02. The previous scraper hit a JSON endpoint
  // (https://www.nyiso.com/api/interconnections) that has been 404 since
  // at least 2026-04-24. NYISO now publishes the queue as a monthly
  // dated xlsx at /documents/20142/1407078/NYISO-Interconnection-Queue-MM-DD-YYYY.xlsx.
  // The path before the date is stable; the date in the filename rolls
  // monthly. We discover the current URL by scraping the public
  // /interconnections landing page, then parse the xlsx with the `xlsx`
  // package (already in deps).

  // Step 1: discover the current xlsx URL.
  const landingRes = await fetch('https://www.nyiso.com/interconnections', {
    signal: AbortSignal.timeout(20000),
  })
  if (!landingRes.ok) throw new Error(`NYISO landing fetch failed: ${landingRes.status}`)
  const html = await landingRes.text()
  // Match: /documents/{path}/NYISO-Interconnection-Queue-MM-DD-YYYY.xlsx
  // The bare URL (without the trailing /uuid?t=... that NYISO appends in
  // the link element) returns 200 directly, so we trim at the .xlsx.
  const match = html.match(/\/documents\/[^"'\s]+?NYISO-Interconnection-Queue-\d{2}-\d{2}-\d{4}\.xlsx/)
  if (!match) throw new Error('NYISO: queue xlsx URL not found on landing page (selector may have shifted)')
  const xlsxUrl = `https://www.nyiso.com${match[0]}`

  // Step 2: download the xlsx.
  const xlsxRes = await fetch(xlsxUrl, { signal: AbortSignal.timeout(30000) })
  if (!xlsxRes.ok) throw new Error(`NYISO xlsx fetch failed: ${xlsxRes.status} (${xlsxUrl})`)
  const buf = Buffer.from(await xlsxRes.arrayBuffer())

  // Step 3: parse. Sheet name is "Interconnection Queue" with the
  // active-queue rows (verified 2026-05-02 against the 03-31-2026 file).
  const XLSX = await import('xlsx')
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheet = wb.Sheets['Interconnection Queue']
  if (!sheet) throw new Error(`NYISO: 'Interconnection Queue' sheet missing — got [${wb.SheetNames.join(', ')}]`)
  const rows = XLSX.utils.sheet_to_json(sheet)

  // Step 4: filter to community-scale solar (<25 MW, > 0 MW). Type/Fuel
  // is "S" for Solar, "ES" for Energy Storage, "W" for Wind, etc.
  const projects = rows
    .filter((r) => {
      const fuel = String(r['Type/ Fuel'] || '').trim().toUpperCase()
      const mw = parseFloat(r['SP (MW)']) || 0
      return /^S\b|^S$/.test(fuel) && mw > 0 && mw < 25
    })
    .map((r) => ({
      utility: String(r['Utility'] || '').trim(),
      mw: parseFloat(r['SP (MW)']) || 0,
    }))

  return aggregateProjects(projects, 'NYISO')
}

async function scrapeISONE() {
  // ISO-NE: https://irtt.iso-ne.com/reports/external
  // They publish queue data as CSV
  const url = 'https://irtt.iso-ne.com/reports/external?reportId=interconnectionQueue&format=csv'

  const res = await fetch(url, {
    headers: { 'Accept': 'text/csv' },
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) throw new Error(`ISO-NE fetch failed: ${res.status}`)
  const text = await res.text()
  return parseCSVQueue(text, 'ISO-NE', {
    fuelColumn: 'Fuel Type',
    fuelFilter: ['Solar', 'SUN', 'PV'],
    mwColumn: 'Net MW',
    mwMax: 25,
    utilityColumn: 'Host Utility',
    statusColumn: 'Status',
    dateColumn: 'Queue Date',
  })
}

// ── CSV parser ───────────────────────────────────────────────────────────────

function parseCSVQueue(csvText, iso, opts) {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const fuelIdx = findColumn(headers, opts.fuelColumn)
  const mwIdx = findColumn(headers, opts.mwColumn)
  const utilIdx = findColumn(headers, opts.utilityColumn)

  if (fuelIdx < 0 || mwIdx < 0 || utilIdx < 0) {
    throw new Error(`${iso}: missing required columns (fuel=${fuelIdx}, mw=${mwIdx}, util=${utilIdx})`)
  }

  const projects = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    const fuel = (cols[fuelIdx] || '').toLowerCase()
    const mw = parseFloat(cols[mwIdx]) || 0
    const utility = cols[utilIdx] || ''

    if (opts.fuelFilter.some(f => fuel.includes(f.toLowerCase())) && mw > 0 && mw < opts.mwMax) {
      projects.push({ utility, mw })
    }
  }

  return aggregateProjects(projects, iso)
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue }
    if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
    current += char
  }
  result.push(current.trim())
  return result
}

function findColumn(headers, name) {
  return headers.findIndex(h =>
    h.toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, '')
  )
}

// ── Aggregation helpers ──────────────────────────────────────────────────────

function aggregateProjects(projects, iso) {
  const byUtility = {}
  for (const p of projects) {
    const key = normalizeUtility(p.utility)
    if (!key) continue
    if (!byUtility[key]) byUtility[key] = { name: key, projects: 0, totalMW: 0 }
    byUtility[key].projects++
    byUtility[key].totalMW += p.mw
  }

  return Object.values(byUtility).map(u => ({
    utilityName: u.name,
    iso,
    stateId: UTILITY_STATE_MAP[u.name] || null,
    projectsInQueue: u.projects,
    mwPending: Math.round(u.totalMW),
  })).filter(u => u.stateId) // Only keep utilities we track
}

function aggregateByUtility(projects, iso, fields) {
  const mapped = projects.map(p => ({
    utility: p[fields.utilityField] || '',
    mw: parseFloat(p[fields.mwField]) || 0,
  }))
  return aggregateProjects(mapped, iso)
}

function normalizeUtility(raw) {
  if (!raw) return null
  const cleaned = raw.trim()
  // Try exact match first
  if (UTILITY_STATE_MAP[cleaned]) return cleaned
  // Try partial match
  for (const key of Object.keys(UTILITY_STATE_MAP)) {
    if (cleaned.toLowerCase().includes(key.toLowerCase())) return key
  }
  return null
}

// ── Trend computation ────────────────────────────────────────────────────────

function computeTrend(newCount, oldCount) {
  if (oldCount == null) return 'stable'
  const delta = (newCount - oldCount) / Math.max(oldCount, 1)
  if (delta > 0.10) return 'growing'
  if (delta < -0.10) return 'shrinking'
  return 'stable'
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  try {
    return await handlerInner(req, res)
  } catch (err) {
    console.error('[refresh-ix-queue] uncaught:', err)
    return res.status(500).json({
      error: err?.message || String(err),
      where: 'refresh-ix-queue',
      stack: err?.stack?.split('\n').slice(0, 4).join(' | '),
    })
  }
}

async function handlerInner(req, res) {
  // Auth: Vercel cron header, CRON_SECRET bearer, or admin-user JWT.
  const authHeader = req.headers.authorization
  const isVercelCron = req.headers['x-vercel-cron'] === '1'
  const isBearerAuth = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`

  let isAdminAuth = false
  if (!isVercelCron && !isBearerAuth && authHeader?.startsWith('Bearer ')) {
    try {
      const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.slice(7))
      if (user?.email === 'aden.walker67@gmail.com') isAdminAuth = true
    } catch (_) { /* fall through */ }
  }

  if (!isVercelCron && !isBearerAuth && !isAdminAuth) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const startedAt = new Date()
  const results = { success: [], failed: [], updated: 0, unchanged: 0, warnings: [] }

  // Fetch current data for trend comparison
  const { data: existing } = await supabaseAdmin
    .from('ix_queue_data')
    .select('state_id, utility_name, projects_in_queue, iso')
  const existingMap = {}
  for (const row of (existing || [])) {
    existingMap[`${row.state_id}:${row.utility_name}`] = row.projects_in_queue
  }

  // Run all scrapers in parallel — each one is independent
  const scrapers = [
    { name: 'PJM', fn: scrapePJM },
    { name: 'MISO', fn: scrapeMISO },
    { name: 'NYISO', fn: scrapeNYISO },
    { name: 'ISO-NE', fn: scrapeISONE },
  ]

  const scraperResults = await Promise.allSettled(
    scrapers.map(async s => {
      try {
        const data = await s.fn()
        return { name: s.name, data }
      } catch (err) {
        throw { name: s.name, error: err.message }
      }
    })
  )

  // Collect all successful results
  const allUpdates = []
  for (const result of scraperResults) {
    if (result.status === 'fulfilled') {
      results.success.push(result.value.name)
      allUpdates.push(...result.value.data)
    } else {
      const reason = result.reason
      results.failed.push({ iso: reason.name, error: reason.error })
    }
  }

  // Validate: skip ISOs that returned 0 rows when they previously had data
  const isoRowCounts = {}
  for (const u of allUpdates) { isoRowCounts[u.iso] = (isoRowCounts[u.iso] || 0) + 1 }
  const existingISOs = new Set(Object.keys(existingMap).length > 0
    ? (existing || []).map(r => r.iso).filter(Boolean)
    : [])
  for (const iso of existingISOs) {
    if (!isoRowCounts[iso] || isoRowCounts[iso] === 0) {
      results.warnings.push(`${iso} returned 0 rows but had existing data — skipping`)
    }
  }

  // Upsert each utility's data
  for (const update of allUpdates) {
    const key = `${update.stateId}:${update.utilityName}`
    const oldCount = existingMap[key]

    // Validate: flag large drops but still write
    if (oldCount != null && oldCount > 0 && update.projectsInQueue < oldCount * 0.5) {
      results.warnings.push(`${key}: projects_in_queue dropped ${Math.round((1 - update.projectsInQueue / oldCount) * 100)}% (${oldCount} → ${update.projectsInQueue})`)
    }

    const trend = computeTrend(update.projectsInQueue, oldCount)

    const row = {
      state_id: update.stateId,
      iso: update.iso,
      utility_name: update.utilityName,
      projects_in_queue: update.projectsInQueue,
      mw_pending: update.mwPending,
      queue_trend: trend,
      data_source: 'scraper',
      fetched_at: new Date().toISOString(),
    }

    // Only include fields that were scraped (preserve existing values for others)
    if (update.avgStudyMonths != null) row.avg_study_months = update.avgStudyMonths
    if (update.withdrawalPct != null) row.withdrawal_pct = update.withdrawalPct
    if (update.avgUpgradeCostMW != null) row.avg_upgrade_cost_mw = update.avgUpgradeCostMW

    const { error } = await supabaseAdmin
      .from('ix_queue_data')
      .upsert(row, { onConflict: 'state_id,utility_name' })

    if (error) {
      results.failed.push({ utility: update.utilityName, error: error.message })
    } else if (oldCount !== update.projectsInQueue) {
      results.updated++
      // Log the change
      await supabaseAdmin.from('data_updates').insert({
        table_name: 'ix_queue_data',
        row_id: `${update.stateId}:${update.utilityName}`,
        field: 'projects_in_queue',
        old_value: String(oldCount ?? 'null'),
        new_value: String(update.projectsInQueue),
        updated_by: 'ix-queue-scraper',
      })
    } else {
      results.unchanged++
    }

    // V3 Wave 1: append a snapshot row to ix_queue_snapshots regardless of
    // whether the value changed. This builds the time-series the Wave 2
    // Forecaster needs (P50/P90 study completion modeling). Snapshot is
    // best-effort -- if it fails, we don't fail the cron, just log.
    const snapshotRow = {
      state_id:            update.stateId,
      iso:                 update.iso,
      utility_name:        update.utilityName,
      projects_in_queue:   update.projectsInQueue,
      mw_pending:          update.mwPending,
      queue_trend:         trend,
      avg_study_months:    update.avgStudyMonths ?? null,
      withdrawal_pct:      update.withdrawalPct ?? null,
      avg_upgrade_cost_mw: update.avgUpgradeCostMW ?? null,
      data_source:         'scraper',
    }
    const { error: snapErr } = await supabaseAdmin.from('ix_queue_snapshots').insert(snapshotRow)
    if (snapErr) {
      console.warn(`[ix-queue] snapshot insert failed for ${update.stateId}:${update.utilityName}:`, snapErr.message)
    } else {
      results.snapshotsRecorded = (results.snapshotsRecorded || 0) + 1
    }
  }

  // Log cron run for observability
  try {
    await supabaseAdmin.from('cron_runs').insert({
      cron_name: 'ix-queue-refresh',
      status: results.failed.length > 0 ? 'partial' : 'success',
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt.getTime(),
      summary: results,
    })
  } catch (err) {
    console.error('Failed to log cron run:', err.message)
  }

  return res.status(200).json({
    message: `IX queue refresh complete`,
    ...results,
    timestamp: new Date().toISOString(),
  })
}
