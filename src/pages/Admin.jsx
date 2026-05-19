import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Input, Select, Button } from '../components/ui'
import TractovaLoader from '../components/ui/TractovaLoader'
import { endpointStatus, buildReportText } from '../lib/adminHelpers'
import StateProgramsTab from '../components/admin/StateProgramsTab.jsx'
import CountiesTab from '../components/admin/CountiesTab.jsx'
import RevenueRatesTab from '../components/admin/RevenueRatesTab.jsx'
import NewsFeedTab from '../components/admin/NewsFeedTab.jsx'
import PucDocketsTab from '../components/admin/PucDocketsTab.jsx'
import PolicyImpactTab from '../components/admin/PolicyImpactTab.jsx'
import DataHealthTab from '../components/admin/DataHealthTab.jsx'
import ComparableDealsTab from '../components/admin/ComparableDealsTab.jsx'
import IXQueueTab from '../components/admin/IXQueueTab.jsx'
import StagingTab from '../components/admin/StagingTab.jsx'
import TestNotificationsTab from '../components/admin/TestNotificationsTab.jsx'
import MissionControl from '../components/admin/MissionControl.jsx'
import NwiCoverageCard from '../components/admin/NwiCoverageCard.jsx'
import IxFreshnessCard from '../components/admin/IxFreshnessCard.jsx'
import MonthlyCronCard from '../components/admin/MonthlyCronCard.jsx'
import CurationDriftRow from '../components/admin/CurationDriftRow.jsx'
import CsStatusAuditRow from '../components/admin/CsStatusAuditRow.jsx'
import IxStalenessAlert from '../components/admin/IxStalenessAlert.jsx'
import CronLatencyPanel from '../components/admin/CronLatencyPanel.jsx'

const ADMIN_EMAIL = 'aden.walker67@gmail.com'
// Each tab carries its own accent color so the 10-tab strip is scannable at a
// glance. Dot is always visible (even when the tab is inactive) so users can
// learn position-by-color over time. Active state lifts the dot's hue into
// the label and border for emphasis.
const TABS = [
  { label: 'State Programs',     color: 'sky'     }, // regulatory / state
  { label: 'Counties',           color: 'emerald' }, // geographic
  { label: 'Revenue Rates',      color: 'amber'   }, // money
  { label: 'News Feed',          color: 'indigo'  }, // info stream
  { label: 'IX Queue',           color: 'cyan'    }, // infrastructure
  { label: 'PUC Dockets',        color: 'violet'  }, // regulatory dockets
  { label: 'Policy Impact',      color: 'fuchsia' }, // enacted-bill quantified effects
  { label: 'Comparable Deals',   color: 'rose'    }, // market intel
  { label: 'Staging',            color: 'orange'  }, // work / pending
  { label: 'Data Health',        color: 'teal'    }, // system / brand
  { label: 'Test Notifications', color: 'red'     }, // alerts
]

// Tailwind's JIT can't see classes built from interpolation, so map color
// keys to the static class strings we actually want generated.
const TAB_COLOR_CLASSES = {
  sky:     { dot: 'bg-sky-500',     activeBorder: 'border-sky-500',     activeText: 'text-sky-700' },
  emerald: { dot: 'bg-emerald-500', activeBorder: 'border-emerald-500', activeText: 'text-emerald-700' },
  amber:   { dot: 'bg-amber-500',   activeBorder: 'border-amber-500',   activeText: 'text-amber-700' },
  indigo:  { dot: 'bg-indigo-500',  activeBorder: 'border-indigo-500',  activeText: 'text-indigo-700' },
  cyan:    { dot: 'bg-cyan-500',    activeBorder: 'border-cyan-500',    activeText: 'text-cyan-700' },
  violet:  { dot: 'bg-violet-500',  activeBorder: 'border-violet-500',  activeText: 'text-violet-700' },
  fuchsia: { dot: 'bg-fuchsia-500', activeBorder: 'border-fuchsia-500', activeText: 'text-fuchsia-700' },
  rose:    { dot: 'bg-rose-500',    activeBorder: 'border-rose-500',    activeText: 'text-rose-700' },
  orange:  { dot: 'bg-orange-500',  activeBorder: 'border-orange-500',  activeText: 'text-orange-700' },
  teal:    { dot: 'bg-teal-500',    activeBorder: 'border-teal-500',    activeText: 'text-teal-700' },
  red:     { dot: 'bg-red-500',     activeBorder: 'border-red-500',     activeText: 'text-red-700' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI
// ─────────────────────────────────────────────────────────────────────────────

// Admin Field — preserves the existing external API
// (label, value, field, onChange, type, options, className) so the 30+
// call sites elsewhere in this file need no changes. Internally delegates
// to V3 Input/Select primitives where applicable; falls back to native
// textarea + checkbox (those primitives don't exist yet).
export function Field({ label, value, field, onChange, type = 'text', options, className = '' }) {
  if (options) {
    return (
      <Select
        label={label}
        value={value ?? ''}
        onChange={(next) => onChange(field, next)}
        options={options}
        className={className}
      />
    )
  }
  if (type === 'boolean') {
    return (
      <div className={className}>
        <label className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted mb-1.5">
          {label}
        </label>
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(field, e.target.checked)}
          className="h-4 w-4 accent-primary mt-1"
        />
      </div>
    )
  }
  if (type === 'textarea') {
    return (
      <div className={className}>
        <label className="block font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted mb-1.5">
          {label}
        </label>
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(field, e.target.value)}
          rows={2}
          className="w-full text-sm rounded-lg px-3 py-2 bg-white border border-gray-200 text-ink resize-y focus:outline-hidden focus:ring-2 focus:ring-teal-500/15 focus:border-teal-500 transition-colors"
        />
      </div>
    )
  }
  // text / number / url etc.
  const isNumeric = type === 'number'
  return (
    <Input
      label={label}
      type={type}
      value={value ?? ''}
      onChange={(next) => onChange(field, isNumeric ? (next === '' ? null : Number(next)) : next)}
      className={className}
    />
  )
}

export function ReadOnlyCell({ value, className = '' }) {
  const display = value === null || value === undefined ? '—' : String(value)
  return <span className={`text-sm text-gray-700 tabular-nums ${className}`}>{display}</span>
}

export function SaveBar({ dirty, saving, onSave, onCancel, error }) {
  if (!dirty && !error) return null
  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center gap-3 z-20">
      {error && <p className="text-xs text-red-500 flex-1">{error}</p>}
      {dirty && (
        <>
          <Button variant="accent" size="sm" onClick={onSave} loading={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
          <Button variant="link" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </>
      )}
    </div>
  )
}

export function Badge({ children, color = 'gray' }) {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    yellow: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
  }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[color]}`}>{children}</span>
}


// ─────────────────────────────────────────────────────────────────────────────
// Refresh status banner — V3-styled diagnostics panel for the manual refresh
// click. Shows overall verdict, per-endpoint status, expandable failure
// detail with one-click copy so the admin can paste a clean error report.
// ─────────────────────────────────────────────────────────────────────────────

// CopyButton — clipboard with visible feedback. The previous inline buttons
// silently swallowed clipboard failures (`.catch(() => {})`) so the user
// couldn't tell whether the copy worked. This flips label to "Copied" on
// success and "Copy failed" on rejection (~1.5s) before reverting.
export function CopyButton({ text, label = 'Copy', className = '' }) {
  const [state, setState] = useState('idle')
  async function handleClick() {
    try {
      await navigator.clipboard.writeText(typeof text === 'function' ? text() : text)
      setState('copied')
    } catch {
      setState('error')
    }
    setTimeout(() => setState('idle'), 1500)
  }
  const display = state === 'copied' ? 'Copied' : state === 'error' ? 'Copy failed' : label
  const tone = state === 'copied'
    ? 'text-emerald-700'
    : state === 'error'
      ? 'text-red-700'
      : 'text-teal-700 hover:text-teal-900'
  return (
    <button
      onClick={handleClick}
      className={`text-[10px] font-mono uppercase tracking-[0.18em] font-semibold transition-colors ${tone} ${className}`}
    >
      {display}
    </button>
  )
}

export function RefreshStatusBanner({ result }) {
  if (!result) return null

  // Top-level catastrophic case: the click itself threw before any endpoints ran.
  if (result.error && !result.endpoints) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="font-serif text-sm font-medium text-red-900">Refresh failed before any endpoint ran</span>
        </div>
        <pre className="mt-2 ml-5 text-[11px] font-mono text-red-700 whitespace-pre-wrap wrap-break-word leading-snug">
          {String(result.error)}
        </pre>
      </div>
    )
  }

  const eps = Object.entries(result.endpoints || {})
  const okCount   = eps.filter(([, v]) => endpointStatus(v) === 'ok').length
  const staleOk   = eps.filter(([, v]) => endpointStatus(v) === 'stale-ok').length
  const partial   = eps.filter(([, v]) => endpointStatus(v) === 'partial').length
  const failed    = eps.filter(([, v]) => endpointStatus(v) === 'failed').length

  const verdict = failed === 0 && partial === 0 && staleOk === 0
    ? { label: 'Refresh complete',     tone: 'emerald' }
    : failed === eps.length
      ? { label: 'Refresh failed',     tone: 'red' }
      : failed === 0 && partial === 0  // only stale-ok soft fails remain
        ? { label: 'Refresh complete · stale-tolerated', tone: 'amber' }
        : { label: 'Partial refresh',  tone: 'amber' }

  const tones = {
    emerald: { ring: 'border-emerald-200', wash: 'bg-emerald-50/40', dot: 'bg-emerald-500', text: 'text-emerald-800' },
    amber:   { ring: 'border-amber-200',   wash: 'bg-amber-50/40',   dot: 'bg-amber-500',   text: 'text-amber-900'   },
    red:     { ring: 'border-red-200',     wash: 'bg-red-50/40',     dot: 'bg-red-500',     text: 'text-red-900'     },
  }
  const t = tones[verdict.tone]

  const totalSec = result.totalMs ? (result.totalMs / 1000).toFixed(1) : null
  const startedTime = result.startedAt ? new Date(result.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null

  return (
    <div
      className={`rounded-xl border ${t.ring} ${t.wash} overflow-hidden`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b ${t.ring}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2 h-2 rounded-full ${t.dot} shrink-0`} />
          <span className={`font-serif text-sm font-medium ${t.text}`}>{verdict.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted truncate">
            {okCount}/{eps.length} ok
            {staleOk > 0 ? ` · ${staleOk} stale-ok` : ''}
            {partial > 0 ? ` · ${partial} partial` : ''}
            {failed > 0 ? ` · ${failed} failed` : ''}
            {startedTime ? ` · ${startedTime}` : ''}
            {totalSec ? ` · ${totalSec}s` : ''}
          </span>
        </div>
        <CopyButton
          text={() => buildReportText(result)}
          label="Copy report"
          className="shrink-0"
        />
      </div>

      {/* Endpoint rows */}
      <div className="divide-y divide-gray-200/60">
        {eps.map(([name, val]) => <EndpointRow key={name} name={name} val={val} />)}
      </div>
    </div>
  )
}

export function EndpointRow({ name, val }) {
  const status = endpointStatus(val)
  const isMux  = !!val?.sources

  const dots = { ok: 'bg-emerald-500', 'stale-ok': 'bg-amber-500', partial: 'bg-amber-500', failed: 'bg-red-500' }
  const labels = { ok: 'OK', 'stale-ok': 'STALE-OK', partial: 'PARTIAL', failed: 'FAILED' }
  const labelColors = { ok: 'text-emerald-700', 'stale-ok': 'text-amber-700', partial: 'text-amber-700', failed: 'text-red-700' }

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full ${dots[status]} shrink-0`} />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink truncate">{name}</span>
          {isMux && (
            <span className="font-mono text-[10px] text-ink-muted hidden sm:inline">
              · {Object.keys(val.sources).length} sources
            </span>
          )}
        </div>
        <span className={`font-mono text-[10px] uppercase tracking-[0.18em] font-semibold ${labelColors[status]}`}>
          {labels[status]}
        </span>
      </div>

      {/* Multiplexed: per-source pills */}
      {isMux && (
        <div className="mt-2 ml-4 flex flex-wrap gap-1.5">
          {Object.entries(val.sources).map(([k, v]) => {
            const subOk = v?.ok !== false
            const stale = v?.stale_tolerated
            const tone = subOk
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : stale
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-red-200 bg-red-50 text-red-700'
            const mark = subOk ? '✓' : stale ? '◐' : '✗'
            return (
              <span key={k} className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${tone}`}>
                <span className="mr-1">{mark}</span>{k}
                {stale && <span className="ml-1 text-amber-600">·stale-ok</span>}
              </span>
            )
          })}
        </div>
      )}

      {/* Top-level endpoint failure */}
      {!isMux && status === 'failed' && (
        <div className="mt-2 ml-4 flex items-start gap-2">
          <pre className="flex-1 text-[10px] font-mono text-red-800 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5 whitespace-pre-wrap break-all leading-snug max-h-40 overflow-auto">
            {String(val?.error || 'unknown error')}
            {val?.where ? `\n  at: ${val.where}` : ''}
          </pre>
          <CopyButton
            text={() => String(val?.error || '')}
            className="shrink-0 pt-1"
          />
        </div>
      )}

      {/* Multiplexed: per-source failure detail */}
      {isMux && Object.entries(val.sources).filter(([, v]) => v?.ok === false).length > 0 && (
        <div className="mt-2 ml-4 space-y-1.5">
          {Object.entries(val.sources)
            .filter(([, v]) => v?.ok === false)
            .map(([k, v]) => (
              <div key={k} className="flex items-start gap-2">
                <div className="flex-1 text-[10px] font-mono text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 leading-snug">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="font-semibold uppercase tracking-[0.14em] text-[9px] text-amber-700">{k}</div>
                    {v.stale_tolerated && (
                      <span className="text-[9px] font-mono uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 border border-amber-300">
                        stale-ok · last good {v.days_since_last_good}d ago
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap break-all">{String(v.error || 'unknown')}</div>
                  {v.first_error && v.first_error !== v.error && (
                    <div className="mt-1 pt-1 border-t border-amber-200 text-amber-800 break-all">
                      <span className="text-amber-600">first row error: </span>{v.first_error}
                    </div>
                  )}
                </div>
                <CopyButton
                  text={() => `[${k}] ${v.error || ''}${v.first_error ? `\nfirst row: ${v.first_error}` : ''}`}
                  className="shrink-0 pt-1"
                />
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Census diagnostic panel — renders the response from /api/refresh-data?debug=1.
// Surfaces just the fields that drive triage decisions (HTTP status, key shape
// sanity, important headers, body) plus a Copy button for sharing the raw JSON.
// ─────────────────────────────────────────────────────────────────────────────
export function CensusDiagnosticPanel({ result, onDismiss }) {
  if (!result) return null

  // Fetch-level failure (network error, abort, JSON parse fail).
  if (result.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/60 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="font-serif text-sm font-medium text-red-900">Census diagnostic failed</span>
          </div>
          <button onClick={onDismiss} className="text-[10px] font-mono uppercase tracking-[0.18em] font-semibold text-gray-400 hover:text-gray-600">Dismiss</button>
        </div>
        <pre className="mt-2 ml-5 text-[11px] font-mono text-red-700 whitespace-pre-wrap break-words leading-snug">
          {String(result.error)}
        </pre>
      </div>
    )
  }

  const j = result.json || {}
  const req = j.request || {}
  const resp = j.response || {}
  const status = resp.status
  const keyOk = req.key_length > 0 && req.key_shape_ok && (req.key_whitespace_check || '').includes('no surrounding')
  const censusOk = status === 200

  const verdict = censusOk && keyOk
    ? { label: 'Census healthy + key valid',  tone: 'emerald', dot: 'bg-emerald-500', text: 'text-emerald-800', ring: 'border-emerald-200', wash: 'bg-emerald-50/40' }
    : !keyOk
      ? { label: 'Key issue detected',         tone: 'red',     dot: 'bg-red-500',     text: 'text-red-900',     ring: 'border-red-200',     wash: 'bg-red-50/40' }
      : { label: `Census responded ${status || '???'}`, tone: 'amber', dot: 'bg-amber-500', text: 'text-amber-900', ring: 'border-amber-200', wash: 'bg-amber-50/40' }

  // Triage hint based on diagnostic shape.
  let hint = null
  if (!keyOk) {
    if (req.key_length === 0) hint = 'CENSUS_API_KEY env var is empty in Production. Add it in Vercel → Settings → Environment Variables.'
    else if (!req.key_shape_ok) hint = `Key length is ${req.key_length}; Census keys are 40-char hex. Check for typos / wrong value.`
    else hint = 'Key has surrounding whitespace — likely a copy-paste with a trailing newline. Edit the env var to remove it.'
  } else if (status === 503) {
    hint = (resp.headers || {})['retry-after']
      ? `Upstream throttling. Retry-After header: ${resp.headers['retry-after']}s. Wait then click Refresh again.`
      : 'Census ACS API is busy or in maintenance. No client-side fix; wait it out. Stale-tolerance keeps existing data green for 90 days.'
  } else if ((resp.headers || {})['cf-ray'] || (resp.headers || {})['cf-mitigated']) {
    hint = 'Cloudflare edge sitting in front of Census — possible WAF block on Vercel egress IPs. Investigate bulk-download fallback if this persists.'
  } else if (status && status >= 400 && status < 500 && status !== 429) {
    hint = `Census returned ${status} — body should explain. Check key validity if 401/403.`
  } else if (censusOk) {
    hint = 'Everything reachable. If refreshes still fail, the issue is in our handlers, not Census itself.'
  }


  return (
    <div className={`rounded-xl border ${verdict.ring} ${verdict.wash} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between gap-3 px-4 py-2.5 border-b ${verdict.ring}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-2 h-2 rounded-full ${verdict.dot} flex-shrink-0`} />
          <span className={`font-serif text-sm font-medium ${verdict.text}`}>{verdict.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted truncate">
            {result.totalMs ? `${(result.totalMs / 1000).toFixed(1)}s` : ''}
            {req.vercel_region ? ` · region ${req.vercel_region}` : ''}
            {typeof j.duration_ms === 'number' ? ` · upstream ${(j.duration_ms / 1000).toFixed(2)}s` : ''}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <CopyButton text={() => JSON.stringify(j, null, 2)} label="Copy JSON" />
          <button onClick={onDismiss} className="text-[10px] font-mono uppercase tracking-[0.18em] font-semibold text-gray-400 hover:text-gray-600 transition-colors">
            Dismiss
          </button>
        </div>
      </div>

      {/* Hint */}
      {hint && (
        <div className={`px-4 py-2 text-[11px] ${verdict.text} border-b ${verdict.ring} bg-white/30`}>
          <span className="font-semibold uppercase tracking-[0.14em] text-[9px] mr-2 opacity-70">Triage</span>
          {hint}
        </div>
      )}

      {/* Detail grid */}
      <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[11px] font-mono">
        <DetailRow label="HTTP status"  value={status ? `${status} ${resp.status_text || ''}`.trim() : '(no response)'} ok={censusOk} />
        <DetailRow label="Key length"   value={req.key_length || 0} ok={req.key_length === 40} />
        <DetailRow label="Key shape"    value={req.key_shape_ok ? '40-char hex ✓' : 'unexpected'} ok={req.key_shape_ok} />
        <DetailRow label="Whitespace"   value={req.key_whitespace_check || '(unknown)'} ok={(req.key_whitespace_check || '').includes('no surrounding')} />
        <DetailRow label="Vercel region" value={req.vercel_region || '(unknown)'} />
        <DetailRow label="Body size"    value={typeof resp.body_length === 'number' ? `${resp.body_length} bytes` : '—'} />
      </div>

      {/* Headers */}
      {resp.headers && Object.keys(resp.headers).length > 0 && (
        <div className="px-4 pb-2 text-[11px] font-mono">
          <div className="font-semibold uppercase tracking-[0.14em] text-[9px] text-gray-500 mb-1">Response headers</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5">
            {Object.entries(resp.headers).map(([k, v]) => (
              <div key={k} className="text-gray-700 truncate">
                <span className="text-gray-400">{k}:</span> {v}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      {resp.body && (
        <div className="px-4 pb-3 text-[11px] font-mono">
          <div className="font-semibold uppercase tracking-[0.14em] text-[9px] text-gray-500 mb-1">Response body (first 4KB)</div>
          <pre className="text-[10px] text-gray-800 bg-white border border-gray-200 rounded-md px-2.5 py-1.5 whitespace-pre-wrap break-all leading-snug max-h-48 overflow-auto">
            {resp.body}
          </pre>
        </div>
      )}
    </div>
  )
}

export function DetailRow({ label, value, ok }) {
  const valueColor = ok === undefined
    ? 'text-gray-700'
    : ok
      ? 'text-emerald-700'
      : 'text-red-700'
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-gray-400 flex-shrink-0">{label}:</span>
      <span className={`${valueColor} truncate`}>{String(value)}</span>
    </div>
  )
}



// ─────────────────────────────────────────────────────────────────────────────
// Admin Page Shell
// ─────────────────────────────────────────────────────────────────────────────


export default function Admin() {
  const { user, loading: authLoading } = useAuth()
  // 2026-05-05 (C1): role-based admin gate via profiles.role (migration 057).
  // Loads the role on mount; defaults to legacy email check while the role
  // value is still loading or if the migration isn't yet applied.
  const [profileRole, setProfileRole] = useState(null)
  const [roleLoaded, setRoleLoaded] = useState(false)
  useEffect(() => {
    if (!user) { setRoleLoaded(true); return }
    let cancelled = false
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setProfileRole(data?.role ?? null)
        setRoleLoaded(true)
      })
      .catch(() => { if (!cancelled) setRoleLoaded(true) })
    return () => { cancelled = true }
  }, [user])
  const [tab, setTab] = useState(0)

  // Reset window scroll to top on mount + when switching tabs.
  // React Router doesn't auto-reset scroll on route change, so if user
  // arrived from a scrolled-down page (Profile, Library) they'd land
  // mid-page on Admin -- past the tab headers, which is disorienting.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [tab])

  if (authLoading || !roleLoaded) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <TractovaLoader size={48} label="Authorizing admin" />
      </div>
    )
  }

  // C1 fix 2026-05-05: role-based admin gate. Allows profiles.role='admin'
  // (migration 057). Legacy email fallback for the rollout window — once
  // role data is verified populated, the email match can be removed.
  const isAdmin = profileRole === 'admin' || (profileRole == null && user?.email === ADMIN_EMAIL)
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-sm text-gray-500">Access denied.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      <main className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="mt-4">
          <h1 className="text-2xl font-bold text-gray-900">Data Admin</h1>
          <p className="text-sm text-gray-400 mt-1">Edit live market intelligence data. Changes propagate within 1 hour (cache TTL).</p>

          <div className="flex flex-wrap gap-1 mt-6 border-b border-gray-200">
            {TABS.map((t, i) => {
              const c = TAB_COLOR_CLASSES[t.color]
              const isActive = tab === i
              return (
                <button
                  key={t.label}
                  onClick={() => setTab(i)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    isActive
                      ? `${c.activeBorder} ${c.activeText}`
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${isActive ? '' : 'opacity-70'}`} />
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="mt-6">
            {tab === 0 && <StateProgramsTab />}
            {tab === 1 && <CountiesTab />}
            {tab === 2 && <RevenueRatesTab />}
            {tab === 3 && <NewsFeedTab />}
            {tab === 4 && <IXQueueTab />}
            {tab === 5 && <PucDocketsTab />}
            {tab === 6 && <PolicyImpactTab />}
            {tab === 7 && <ComparableDealsTab />}
            {tab === 8 && <StagingTab />}
            {tab === 9 && <DataHealthTab />}
            {tab === 10 && <TestNotificationsTab />}
          </div>
        </div>
      </main>
    </div>
  )
}
