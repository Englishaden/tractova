import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { invalidateCacheEverywhere } from '../../lib/programData'
import TractovaLoader from '../ui/TractovaLoader'
import { daysSince, freshnessColor } from '../../lib/adminHelpers'
import {
  Badge,
  RefreshStatusBanner,
  CensusDiagnosticPanel,
  MissionControl,
  IxStalenessAlert,
  CronLatencyPanel,
} from '../../pages/Admin.jsx'

// Each card prefers `last_cron_success` (when did the cron last verify this
// data against the live source?) -- migration 031 derives this from cron_runs
// so a click on "Refresh data from sources" bumps every card whose cron
// succeeded, even if no rows actually mutated. `fallbackField` keeps the
// card meaningful when migration 031 hasn't been applied yet OR when the
// cron has never logged a success entry yet.
// county_intelligence is the one exception: hand-curated, no cron, so we
// keep its row-level field as primary.
// `mode` clarifies how each table stays fresh — answers Aden's "I always
// forget which data gets scraped and which doesn't":
//   live    — auto-refreshed via a cron handler (Census/EIA/NREL/ISO/RSS).
//             Stale = upstream source was unreachable on the last run.
//   curated — hand-maintained by the operator with a periodic verify cron
//             that just checks DSIRE / source URLs are still live. Stale
//             = the row is overdue for a manual review, not that an API
//             returned bad data.
//   seeded  — one-time data load (NWI / SSURGO geospatial). No cron.
//             Refresh requires a manual seed-script run.
const FRESHNESS_CONFIG = {
  state_programs:      { label: 'State Programs',      mode: 'curated', icon: '🗺', field: 'last_cron_success', fallbackField: 'newest_verified', staleField: 'stale_count', thresholds: [14, 30] },
  lmi_data:            { label: 'LMI Data (Census)',   mode: 'live',    icon: '🏘', field: 'last_cron_success', fallbackField: 'last_updated',    staleField: null,          thresholds: [14, 30] },
  ix_queue_data:       { label: 'IX Queue Data',       mode: 'live',    icon: '⚡', field: 'last_cron_success', fallbackField: 'newest_fetch',    staleField: 'stale_count', thresholds: [14, 30] },
  substations:         { label: 'Substations',         mode: 'live',    icon: '🔌', field: 'last_cron_success', fallbackField: 'last_updated',    staleField: null,          thresholds: [45, 90] },
  county_intelligence: { label: 'County Intelligence', mode: 'curated', icon: '📍', field: 'oldest_verified',   fallbackField: null,              staleField: 'stale_count', thresholds: [90, 180] },
  county_acs_data:     { label: 'County ACS (Census)', mode: 'live',    icon: '📊', field: 'last_cron_success', fallbackField: 'last_updated',    staleField: null,          thresholds: [14, 30] },
  energy_community_data:{ label: 'Energy Community (IRA)', mode: 'live', icon: '⚡', field: 'last_cron_success', fallbackField: 'last_updated', staleField: null,          thresholds: [14, 60] },
  hud_qct_dda_data:    { label: 'HUD QCT / DDA',         mode: 'live',    icon: '🏘', field: 'last_cron_success', fallbackField: 'last_updated', staleField: null,          thresholds: [14, 60] },
  nmtc_lic_data:       { label: 'NMTC LIC §48(e)',       mode: 'live',    icon: '🎯', field: 'last_cron_success', fallbackField: 'last_updated', staleField: null,          thresholds: [14, 60] },
  revenue_rates:       { label: 'Revenue Rates',       mode: 'live',    icon: '💰', field: 'last_cron_success', fallbackField: 'last_updated',    staleField: null,          thresholds: [120, 200] },
  revenue_stacks:      { label: 'Revenue Stacks',      mode: 'curated', icon: '🏛', field: 'last_cron_success', fallbackField: 'newest_dsire_check', staleField: null,       thresholds: [14, 30] },
  news_feed:           { label: 'News Feed',           mode: 'live',    icon: '📰', field: 'last_cron_success', fallbackField: 'latest_item',     staleField: null,          thresholds: [14, 30] },
  county_geospatial_data: { label: 'County Geospatial (NWI + SSURGO)', mode: 'seeded', icon: '🌿', field: 'last_seeded', fallbackField: null, staleField: null, thresholds: [180, 365] },
  solar_cost_index:    { label: 'Solar Cost Index (LBNL TTS)', mode: 'live',    icon: '☀', field: 'last_cron_success', fallbackField: 'last_updated', staleField: null,          thresholds: [400, 540] },
  cs_projects:         { label: 'CS Projects (NREL Sharing the Sun)', mode: 'seeded', icon: '🌞', field: 'last_updated', fallbackField: null, staleField: null, thresholds: [180, 365] },
  cs_specific_yield:   { label: 'Specific Yield (Nexamp / SR Energy / Catalyze)', mode: 'seeded', icon: '⚡', field: 'last_updated', fallbackField: null, staleField: null, thresholds: [120, 270] },
}

const MODE_BADGE = {
  live:    { label: 'LIVE',    bg: 'rgba(15,118,110,0.10)',  text: '#0F766E', border: 'rgba(15,118,110,0.30)', tooltip: 'Auto-refreshed via cron (Census / EIA / NREL / ISO / RSS).' },
  curated: { label: 'CURATED', bg: 'rgba(124,58,237,0.08)',  text: '#6D28D9', border: 'rgba(124,58,237,0.30)', tooltip: 'Hand-maintained by the operator with a periodic verify cron.' },
  seeded:  { label: 'SEEDED',  bg: 'rgba(217,119,6,0.08)',   text: '#92400E', border: 'rgba(217,119,6,0.30)',  tooltip: 'One-time seed (NWI / SSURGO). No cron — refresh requires a manual seed-script run.' },
}

export default function DataHealthTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)
  // Manual data-refresh trigger -- alternative to waiting for the weekly
  // cron. Fans out to every supported source via /api/refresh-data?source=all.
  const [refreshing, setRefreshing] = useState(false)
  const [refreshResult, setRefreshResult] = useState(null)
  // Census diagnostic — hits /api/refresh-data?debug=1 to surface raw
  // upstream state when Census handlers are misbehaving. Auth-bypass
  // endpoint, response is fully redacted (no key chars), so no risk
  // surfacing it inline.
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnostic, setDiagnostic] = useState(null)

  useEffect(() => {
    async function fetchHealth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setError('Not authenticated'); setLoading(false); return }
        const resp = await fetch('/api/data-health', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        setData(await resp.json())
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchHealth()
  }, [])

  const handleRefreshData = async () => {
    setRefreshing(true)
    setRefreshResult(null)
    setError(null)
    const startedAt = new Date()
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const auth = { Authorization: `Bearer ${session.access_token}` }

      // Fan out to every cron endpoint in parallel. We split the multiplexed
      // refresh into two HTTP calls so each has its own ~60s gateway budget:
      //   - "fast": 7 sources (everything except NMTC LIC)
      //   - "nmtc": NMTC alone -- it iterates 51 states sequentially through
      //     Census API and takes 50-70s on its own, which would otherwise
      //     blow the multiplexer past the gateway ceiling.
      // substations + ix-queue + capacity-factors are separate Vercel
      // functions (12-slot Hobby cap). All endpoints accept the admin JWT.
      const endpoints = [
        { name: 'fast',        url: '/api/refresh-data?source=fast' },
        { name: 'nmtc_lic',    url: '/api/refresh-data?source=nmtc_lic' },
        { name: 'substations', url: '/api/refresh-substations' },
        { name: 'ix_queue',    url: '/api/refresh-ix-queue' },
        { name: 'capacity',    url: '/api/refresh-capacity-factors' },
      ]
      // 310s hard ceiling per endpoint -- slightly above the server's 300s
      // function budget. Without this, a hung connection (e.g. Vercel killing
      // the function but the gateway not closing the socket cleanly) leaves
      // the UI spinning forever.
      const settled = await Promise.allSettled(
        endpoints.map(e => {
          const controller = new AbortController()
          const timer = setTimeout(() => controller.abort(), 310000)
          return fetch(e.url, { method: 'POST', headers: auth, signal: controller.signal })
            .then(async r => {
              clearTimeout(timer)
              const text = await r.text()
              let json = null
              try { json = JSON.parse(text) } catch {}
              if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`)
              return json
            })
            .catch(err => {
              clearTimeout(timer)
              if (err?.name === 'AbortError') throw new Error('Client timeout (>310s) — server did not respond')
              throw err
            })
        })
      )

      const aggregate = { ok: true, endpoints: {}, startedAt: startedAt.toISOString() }
      for (let i = 0; i < endpoints.length; i++) {
        const e = endpoints[i]
        const r = settled[i]
        if (r.status === 'fulfilled') {
          aggregate.endpoints[e.name] = r.value
          // The multiplexer returns 200 with `ok: false` if any sub-source
          // failed. Stale-tolerated sub-sources don't count against the
          // aggregate verdict -- the data is still recent, the failed
          // attempt is just a transient upstream blip.
          if (r.value?.ok === false && !r.value?.stale_tolerated) aggregate.ok = false
          if (r.value?.sources) {
            for (const sub of Object.values(r.value.sources)) {
              if (sub?.ok === false && !sub?.stale_tolerated) aggregate.ok = false
            }
          }
        } else {
          aggregate.ok = false
          aggregate.endpoints[e.name] = { ok: false, error: r.reason?.message || 'failed' }
        }
      }
      aggregate.totalMs = Date.now() - startedAt.getTime()
      setRefreshResult(aggregate)

      // Crons just rewrote the underlying tables -- nuke the front-end 1h
      // cache so the rest of the app re-fetches without a hard reload.
      // Cross-tab variant: BroadcastChannel so a Dashboard left open in
      // another tab also clears its in-memory cache, not just this Admin tab.
      invalidateCacheEverywhere()

      // Re-fetch the freshness panel itself so the cards update inline.
      try {
        const fresh = await fetch('/api/data-health', { headers: auth })
        if (fresh.ok) setData(await fresh.json())
      } catch (_) { /* non-fatal */ }
    } catch (err) {
      setRefreshResult({ ok: false, error: err.message, startedAt: startedAt.toISOString(), totalMs: Date.now() - startedAt.getTime() })
    } finally {
      setRefreshing(false)
    }
  }

  const handleRunDiagnostic = async () => {
    setDiagnosing(true)
    setDiagnostic(null)
    const startedAt = new Date()
    try {
      // ?debug=1 is intentionally auth-bypassed (response carries no
      // secrets — key length only). 35s ceiling: the server-side fetch
      // has a 30s timeout, plus a few seconds of network slack.
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 35000)
      const resp = await fetch('/api/refresh-data?debug=1', { signal: controller.signal })
        .finally(() => clearTimeout(timer))
      const json = await resp.json()
      setDiagnostic({ ok: resp.ok, json, fetchedAt: new Date().toISOString(), totalMs: Date.now() - startedAt.getTime() })
    } catch (err) {
      setDiagnostic({ ok: false, error: err?.message || String(err), fetchedAt: new Date().toISOString(), totalMs: Date.now() - startedAt.getTime() })
    } finally {
      setDiagnosing(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expired — please log in again')
      const resp = await fetch('/api/data-health?action=export', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = resp.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'tractova-backup.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(`Export failed: ${err.message}`)
    } finally {
      setExporting(false)
    }
  }

  if (loading) return (
    <div className="py-12 flex items-center justify-center">
      <TractovaLoader size={56} label="Loading Data Health" sublabel="freshness · cron runs · audit log" />
    </div>
  )
  if (error) return <div className="py-8 text-sm text-red-500">Failed to load: {error}</div>
  if (!data) return null

  const { freshness, cronRuns, dataUpdates } = data

  return (
    <div className="space-y-8">

      {/* ── Mission Control — single-screen executive snapshot of system health ──
          Pulls the missionControl block surfaced by /api/data-health (the
          same probes the bearer-token health-summary endpoint runs, just
          inline-served to the admin's JWT). Sits at the very top so the
          first thing the admin sees on Data Health is "is the platform
          healthy." Detail surfaces (freshness grid, audit log, cron
          rollups, cron latency, IX staleness alert) live below. */}
      <MissionControl missionControl={data?.missionControl} cronRuns={data?.cronRuns || []} />

      {/* ── Action buttons + manual data-refresh trigger ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleRefreshData}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-50"
            style={{ background: '#14B8A6' }}
          >
            {refreshing ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Refreshing live data…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Refresh data from sources
              </>
            )}
          </button>
          <button
            onClick={handleRunDiagnostic}
            disabled={diagnosing}
            className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            title="Hits /api/refresh-data?debug=1 — single tiny Census fetch with full response diagnostics. Use when Census handlers are misbehaving."
          >
            {diagnosing ? (
              <>
                <span className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                Running diagnostic…
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                Run Census diagnostic
              </>
            )}
          </button>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {exporting ? 'Exporting...' : 'Export All Data (JSON)'}
        </button>
      </div>

      {/* Refresh status panel — full-width, copy-friendly diagnostics */}
      {refreshResult && <RefreshStatusBanner result={refreshResult} />}

      {/* Census diagnostic panel — appears when "Run Census diagnostic" is clicked */}
      {diagnostic && <CensusDiagnosticPanel result={diagnostic} onDismiss={() => setDiagnostic(null)} />}

      {/* Source attribution help */}
      <p className="text-[11px] text-ink-muted leading-relaxed">
        Clicking Refresh fans out to every cron in parallel: Census ACS (LMI + counties), DSIRE (state programs + revenue stacks), RSS+AI (news feed),
        ISO queues (IX queue), EIA Form 860 (substations), and NREL + EIA (capacity factors + retail rates). Each handler logs to{' '}
        <span className="font-mono">cron_runs</span> on success, which drives the freshness cards above.
      </p>

      {/* ── Section 1: Freshness Grid ──
          Each card now carries a LIVE / CURATED / SEEDED chip so the
          operator can answer "is this auto-refreshed or hand-maintained"
          without crossing into source code. The "Last updated Nd ago"
          stamp tracks cron completion (last_cron_success) — it's the same
          source the Footer uses, so per-source freshness here matches the
          global "Data refreshed" caption. */}
      <div>
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-gray-900">Data Freshness</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(MODE_BADGE).map(([mode, cfg]) => (
              <span
                key={mode}
                className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold"
                style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
                title={cfg.tooltip}
              >
                {cfg.label}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(FRESHNESS_CONFIG).map(([key, cfg]) => {
            const tableData = freshness?.[key]
            if (!tableData) return null
            // Prefer the cron-success timestamp, but fall back to the row-level
            // field if migration 031 hasn't run or the cron has never succeeded.
            const dateVal = tableData[cfg.field] ?? (cfg.fallbackField ? tableData[cfg.fallbackField] : null)
            const days = daysSince(dateVal)
            const color = freshnessColor(days, cfg.thresholds)
            const rowCount = tableData.row_count ?? tableData.active_count ?? '—'
            const staleCount = cfg.staleField ? (tableData[cfg.staleField] ?? 0) : null
            const colorMap = { green: 'border-emerald-200 bg-emerald-50/40', yellow: 'border-amber-200 bg-amber-50/40', red: 'border-red-200 bg-red-50/40', gray: 'border-gray-200 bg-gray-50' }
            const dotMap = { green: 'bg-emerald-500', yellow: 'bg-amber-400', red: 'bg-red-500', gray: 'bg-gray-300' }
            const modeBadge = MODE_BADGE[cfg.mode] || MODE_BADGE.curated

            return (
              <div key={key} className={`rounded-lg border px-4 py-3 ${colorMap[color]}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-gray-700 truncate">{cfg.label}</span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dotMap[color]}`} />
                </div>
                <p className="text-lg font-bold text-gray-900 tabular-nums">{rowCount} <span className="text-xs font-normal text-gray-400">rows</span></p>
                <p className="text-[11px] text-gray-500 mt-1">
                  {days != null ? (
                    <>Last updated <span className="font-medium">{days}d ago</span></>
                  ) : (
                    <span className="text-gray-400">No data</span>
                  )}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span
                    className="font-mono text-[8px] uppercase tracking-[0.16em] px-1 py-0.5 font-bold"
                    style={{ background: modeBadge.bg, color: modeBadge.text, border: `1px solid ${modeBadge.border}` }}
                    title={modeBadge.tooltip}
                  >
                    {modeBadge.label}
                  </span>
                  {staleCount > 0 && (
                    <span className="text-[10px] font-medium text-amber-600">{staleCount} stale row{staleCount > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Section 2: Cron Run History ── */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Cron Run History</h3>
        {cronRuns.length === 0 ? (
          <p className="text-xs text-gray-400 py-4">No cron runs recorded yet. Runs will appear after the next scheduled cron execution.</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold">Cron</th>
                  <th className="text-left px-3 py-2 font-semibold">Status</th>
                  <th className="text-left px-3 py-2 font-semibold">Finished</th>
                  <th className="text-right px-3 py-2 font-semibold">Duration</th>
                  <th className="text-right px-3 py-2 font-semibold">Changes</th>
                  <th className="text-left px-3 py-2 font-semibold">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {cronRuns.map((run) => {
                  const statusColor = run.status === 'success' ? 'green' : run.status === 'partial' ? 'yellow' : 'red'
                  const summary = run.summary || {}
                  const changes = summary.updated ?? summary.changes ?? 0
                  const warnings = summary.warnings || []
                  const finishedAgo = daysSince(run.finished_at)
                  return (
                    <tr key={run.id} className={`border-b border-gray-100 last:border-0 ${run.status === 'failed' ? 'bg-red-50/30' : ''}`}>
                      <td className="px-3 py-2 font-medium text-gray-700">{run.cron_name}</td>
                      <td className="px-3 py-2"><Badge color={statusColor}>{run.status}</Badge></td>
                      <td className="px-3 py-2 text-gray-500 tabular-nums">
                        {run.finished_at ? (
                          <>{finishedAgo === 0 ? 'Today' : `${finishedAgo}d ago`} <span className="text-gray-300">·</span> {new Date(run.finished_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 tabular-nums">{run.duration_ms != null ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-700">{changes}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">{warnings.length > 0 ? warnings.join('; ') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 3: Recent Changes ── */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Recent Data Changes</h3>
        {dataUpdates.length === 0 ? (
          <p className="text-xs text-gray-400 py-4">No changes recorded yet.</p>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 border-b border-gray-200">
                  <th className="text-left px-3 py-2 font-semibold">Table</th>
                  <th className="text-left px-3 py-2 font-semibold">Row</th>
                  <th className="text-left px-3 py-2 font-semibold">Field</th>
                  <th className="text-left px-3 py-2 font-semibold">Old → New</th>
                  <th className="text-left px-3 py-2 font-semibold">By</th>
                  <th className="text-left px-3 py-2 font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {dataUpdates.map((u) => {
                  const ago = daysSince(u.updated_at)
                  return (
                    <tr key={u.id} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2 font-medium text-gray-700">{u.table_name}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[120px] truncate" title={u.row_id}>{u.row_id}</td>
                      <td className="px-3 py-2 text-gray-500">{u.field}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                        {u.old_value && <span className="text-red-400 line-through mr-1">{u.old_value}</span>}
                        <span className="text-emerald-600">{u.new_value}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          u.updated_by?.includes('scraper') || u.updated_by?.includes('refresh')
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}>{u.updated_by || '—'}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-400 tabular-nums">{ago != null ? `${ago}d ago` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Last Cron Runs Summary from RPC ──
          Caption clarifies that this surface measures CRON COMPLETION, not
          DATA FRESHNESS. A cron that completes "success" with 0 changes
          still means the scraper is silently broken — cross-reference the
          IX scraper staleness alert below for that signal. */}
      {freshness?.last_cron_runs && freshness.last_cron_runs.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-1">Last Run per Cron</h3>
          <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
            <span className="font-semibold text-gray-700">Cron-completion</span> timestamps
            (when the handler returned success). A green cron with 0 changes
            can still mean the upstream scraper is broken — check the IX
            scraper staleness alert below for actual data freshness.
          </p>
          <div className="flex gap-3">
            {freshness.last_cron_runs.map((r) => {
              const ago = daysSince(r.finished_at)
              const statusColor = r.status === 'success' ? 'green' : r.status === 'partial' ? 'yellow' : 'red'
              return (
                <div key={r.cron_name} className="flex-1 border border-gray-200 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-gray-700">{r.cron_name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge color={statusColor}>{r.status}</Badge>
                    <span className="text-[11px] text-gray-400">{ago != null ? `${ago}d ago` : '—'}</span>
                  </div>
                  {r.changes && <p className="text-[11px] text-gray-500 mt-1">{r.changes} changes</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── IX scraper staleness alert ──
          Surfaces ISO scrapers that haven't refreshed in >7 days. When the
          underlying queue download URL changes upstream, the scraper silently
          fails and stale data sits in ix_queue_data forever. The Lens IX
          panel also flips its 'IX · Live' pill to amber + 'stale Nd' for
          affected states; this admin alert is the system-level mirror. */}
      <IxStalenessAlert />

      {/* ── Cron latency monitor — defensive observability ──
          Aggregates cron_runs over the last 30 days and flags any handler
          whose p95 duration is approaching the parent function's
          maxDuration ceiling. Catches the next 504-class bug structurally
          before users see a red panel. */}
      <CronLatencyPanel />
    </div>
  )
}
