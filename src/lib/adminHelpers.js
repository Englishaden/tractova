// Pure helpers extracted from src/pages/Admin.jsx during the Plan C Phase 2.5
// refactor. These have no React dependencies and are shared across the
// extracted Admin tab components plus Admin.jsx itself.

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

export function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

export function freshnessColor(days, thresholds) {
  if (days == null) return 'gray'
  if (days <= thresholds[0]) return 'green'
  if (days <= thresholds[1]) return 'yellow'
  return 'red'
}
