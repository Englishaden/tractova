// Pure helpers extracted from src/pages/Admin.jsx during the Plan C Phase 2.5
// refactor. These have no React dependencies and are shared across the
// extracted Admin tab components plus Admin.jsx itself.

/**
 * Classifies a refresh-data endpoint result into one of four health
 * tiers used by the Admin Data Health UI.
 *
 * @param {object|null} val — endpoint summary (may have `sources` for multiplexed endpoints)
 * @returns {'ok'|'stale-ok'|'partial'|'failed'} — see comment below for semantics
 */
export function endpointStatus(val) {
  // Returns 'ok' | 'stale-ok' | 'partial' | 'failed'
  //   ok        — everything fresh and healthy
  //   stale-ok  — most recent attempt failed but we still have data inside
  //               the freshness window (Census 503 with last-good <90d, etc.)
  //               Data the user sees is correct; no alarm, but signal the
  //               soft-fail so admin knows the upstream is misbehaving.
  //   partial   — some sub-sources hard-failed but others succeeded
  //   failed    — no useful data (hard fail / no recent good)
  const isHardFail = (s) => s?.ok === false && !s?.stale_tolerated
  const isStaleOk  = (s) => s?.ok === false && !!s?.stale_tolerated
  if (!val) return 'failed'
  if (val.error || (val.ok === false && !val.sources && !val.stale_tolerated)) return 'failed'
  if (val.sources) {
    const subs = Object.values(val.sources)
    const anyFail = subs.some(isHardFail)
    if (anyFail) return subs.every(isHardFail) ? 'failed' : 'partial'
    // No hard-fails: if any sub-source is stale-tolerated, surface as stale-ok
    if (subs.some(isStaleOk)) return 'stale-ok'
  } else if (val.ok === false && val.stale_tolerated) {
    // Non-multiplexed endpoint that stale-toleranced its own failure
    return 'stale-ok'
  }
  return 'ok'
}

/**
 * Renders a refresh-data result as plain text — used by the "Copy
 * report" button on the Admin Data Health tab so admin can paste a
 * status snapshot into Slack / email when something's off.
 *
 * @param {{startedAt?:string, totalMs?:number, ok?:boolean, endpoints?:object}} result
 * @returns {string}
 */
export function buildReportText(result) {
  const lines = [
    `Tractova data refresh report`,
    `Started: ${result.startedAt || '—'}`,
    `Total:   ${result.totalMs ? `${(result.totalMs / 1000).toFixed(1)}s` : '—'}`,
    `Verdict: ${result.ok ? 'OK' : 'PARTIAL / FAILED'}`,
    '',
  ]
  for (const [name, val] of Object.entries(result.endpoints || {})) {
    const status = endpointStatus(val).toUpperCase()
    if (val.sources) {
      const subs = Object.entries(val.sources)
        .map(([k, v]) => {
          if (v?.ok !== false) return `  ${k}: ok`
          if (v?.stale_tolerated) return `  ${k}: STALE-OK (last good ${v.days_since_last_good}d ago) — ${v.error || 'unknown'}`
          return `  ${k}: FAIL — ${v.error || 'unknown'}`
        })
        .join('\n')
      lines.push(`[${name}] ${status}\n${subs}`)
    } else if (val.error || val.ok === false) {
      lines.push(`[${name}] ${status}\n  ${val.error || 'unknown error'}`)
    } else {
      lines.push(`[${name}] ${status}`)
    }
  }
  return lines.join('\n')
}

/**
 * Days elapsed since `dateStr`, rounded. Returns null for null input
 * so the caller can render a placeholder.
 * @param {string|null|undefined} dateStr — ISO datetime string
 * @returns {number|null}
 */
export function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

/**
 * Maps a day-count to a freshness-tier color. Two thresholds carve up
 * the green / yellow / red bands; null days renders gray.
 * @param {number|null} days
 * @param {[number, number]} thresholds — [greenMax, yellowMax]
 * @returns {'gray'|'green'|'yellow'|'red'}
 */
export function freshnessColor(days, thresholds) {
  if (days == null) return 'gray'
  if (days <= thresholds[0]) return 'green'
  if (days <= thresholds[1]) return 'yellow'
  return 'red'
}
