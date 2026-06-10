import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui'

// ─────────────────────────────────────────────────────────────────────────────
// Manual IX-queue CSV upload (Phase 4a) — for the gated states with no machine
// feed (NJ ACE · ME CMP · MN Xcel · HI HECO · OR OASIS). The admin maps the
// state's published queue file to ONE canonical CSV; this reads it as TEXT and
// POSTs to /api/refresh-data?source=ix_manual (admin JWT). No file ever leaves
// the browser as a binary — the server only sees CSV text (never a workbook),
// matching the gov-source-only xlsx-parse rule.
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_HEADER = 'state_id,iso,utility_name,metering_type,projects_in_queue,mw_pending,avg_study_months,withdrawal_pct,data_source_url'
const TEMPLATE = `${TEMPLATE_HEADER}
NJ,PJM,Atlantic City Electric,community_solar,42,125.5,18,7.5,https://www.njcleanenergy.com/
ME,ISO-NE,Central Maine Power,net_metering,310,88.2,14,,https://www.maine.gov/mpuc/
MN,MISO,Xcel Energy,community_solar,540,1450,20,9.1,https://www.xcelenergy.com/
HI,HICEP,Hawaiian Electric,net_billing,210,75,16,,https://www.hawaiianelectric.com/
OR,WECC,PacifiCorp,net_metering,95,40.5,12,,https://www.pacificpower.net/`

const GATED = 'NJ ACE · ME CMP · MN Xcel · HI HECO · OR OASIS'

export default function IxManualUpload({ onIngested }) {
  const [open, setOpen] = useState(false)
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null); setResult(null)
    try {
      const text = await f.text()        // read as TEXT — never a binary workbook
      setCsv(text)
      setFileName(f.name)
    } catch (err) { setError(`Could not read file: ${err.message}`) }
  }

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tractova-ix-manual-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const submit = async () => {
    if (!csv.trim()) { setError('Paste CSV or choose a .csv file first'); return }
    setBusy(true); setError(null); setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not signed in')
      const resp = await fetch('/api/refresh-data?source=ix_manual', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok || json.ok === false) {
        const detail = json.parse_errors?.length ? ` — ${json.parse_errors.slice(0, 5).join('; ')}` : ''
        throw new Error((json.error || `HTTP ${resp.status}`) + detail)
      }
      setResult(json)
      onIngested?.()
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  return (
    <div className="mb-4 border border-cyan-200/70 rounded-xl bg-cyan-50/30">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-cyan-900">
          Manual upload <span className="font-normal text-cyan-700/70">— gated states ({GATED})</span>
        </span>
        <span className="text-xs text-cyan-600">{open ? 'Hide ▲' : 'Upload CSV ▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            These states have no redistribution-safe interconnection feed. Map the state's published queue
            to the canonical CSV (one row per utility × monetization structure), then upload it here.
            Rows persist as <code className="text-[11px] bg-white px-1 rounded">data_source: manual</code>;
            re-uploading a state replaces its rows. Manual rows are queue CONTEXT — they do not move the
            curated IX score.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium text-cyan-800 cursor-pointer">
              <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
              <span className="px-3 py-1.5 rounded-md border border-cyan-300 bg-white hover:bg-cyan-50 transition-colors inline-block">
                Choose .csv file
              </span>
            </label>
            {fileName && <span className="text-xs text-gray-500">{fileName}</span>}
            <button onClick={downloadTemplate} className="text-xs text-cyan-700 hover:text-cyan-900 underline">
              Download template
            </button>
          </div>

          <textarea
            value={csv}
            onChange={(e) => { setCsv(e.target.value); setError(null); setResult(null) }}
            placeholder={`Or paste CSV here…\n${TEMPLATE_HEADER}`}
            rows={6}
            className="w-full text-[11px] font-mono border border-gray-200 rounded-md p-2 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-400 outline-none"
          />

          <div className="flex items-center gap-3">
            <Button variant="accent" onClick={submit} loading={busy} disabled={busy}>
              {busy ? 'Ingesting…' : 'Ingest CSV'}
            </Button>
            {csv && <span className="text-xs text-gray-400">{csv.split(/\r?\n/).filter(l => l.trim()).length - 1} data row(s)</span>}
          </div>

          {error && <p className="text-xs text-red-600 leading-relaxed">{error}</p>}
          {result && (
            <div className="text-xs text-emerald-800 bg-emerald-50/60 border border-emerald-200 rounded-md px-3 py-2 leading-relaxed">
              ✓ Upserted {result.rows_upserted} row(s) · states: {(result.states || []).join(', ')} · structures: {(result.metering_types || []).join(', ')}
              {result.parse_warnings?.length ? (
                <div className="mt-1 text-amber-700">⚠ {result.parse_warnings.length} warning(s): {result.parse_warnings.slice(0, 3).join('; ')}{result.parse_warnings.length > 3 ? '…' : ''}</div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
