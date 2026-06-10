import { useState, useRef, useEffect } from 'react'
import { classifyCountyMatch } from '../../lib/addressCounty.js'

// Mirror the form's field styling (Search.jsx inputCls / labelCls).
const inputCls = 'w-full text-sm bg-transparent border-0 outline-hidden px-0 py-0 text-gray-900 placeholder-gray-400 appearance-none'
const labelCls = 'block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5'

// Optional site-address field with PRE-RUN resolution.
//
// On blur (and never per-keystroke — the free Census geocoder is rate-limited +
// has no autocomplete endpoint) it geocodes the address to its census tract via
// the server proxy, then:
//   • flags an UNRESOLVED address before the Lens runs (no wasted run), and
//   • checks the resolved county against the picked county — on a mismatch it
//     offers to SWITCH the form to the address's county (address-wins) or clear
//     the address, so county + address stay structurally consistent and the
//     composite never mixes two places.
//
// The settled resolution is lifted up via onResolveStateChange so the run reuses
// it instead of re-calling the flaky geocoder. A pending mismatch lifts status
// 'mismatch' → the run drops to coherent county-level rather than applying the
// address's tract into the wrong county's composite.
export default function AddressField({
  value,
  onChange,
  stateId,
  county,
  resolveAddress,        // async (address, signal) => proxyResult | null  (provided by Search)
  onResolveStateChange,  // ({ address, status, result }) | null
  onSwitchCounty,        // (stateId, countyName) => void
  onClearAddress,        // () => void
}) {
  const [status, setStatus] = useState('idle') // idle | resolving | resolved | unresolved
  const [result, setResult] = useState(null)
  const [match, setMatch] = useState(null)      // classifyCountyMatch output (when resolved)
  const resolvedForRef = useRef('')             // the address string `result` corresponds to
  const abortRef = useRef(null)

  const lift = (st, res, m) => {
    onResolveStateChange?.({
      address: String(value || '').trim(),
      status: st === 'resolved' && m?.verdict === 'mismatch' ? 'mismatch' : st,
      result: res,
    })
  }

  const reset = () => {
    abortRef.current?.abort()
    setStatus('idle')
    setResult(null)
    setMatch(null)
    resolvedForRef.current = ''
    onResolveStateChange?.(null)
  }

  // Re-check the county match when the picked state/county changes AFTER an
  // address resolved (e.g. user accepts the switch, or picks a different county
  // post-resolve). Cheap pure recompute over the already-resolved result.
  useEffect(() => {
    if (status !== 'resolved' || !result?.ok) return
    const m = classifyCountyMatch(result, stateId, county)
    setMatch(m)
    lift('resolved', result, m)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateId, county])

  // Reset internal state when the address is cleared programmatically (e.g. the
  // "Clear address" CTA or Clear All in the parent).
  useEffect(() => {
    if (!String(value || '').trim() && (status !== 'idle' || result)) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => () => abortRef.current?.abort(), [])

  const handleChange = (e) => {
    onChange?.(e)
    // Any edit invalidates a prior resolution; the next blur re-resolves.
    if (status !== 'idle' || result) reset()
  }

  const handleBlur = async () => {
    const addr = String(value || '').trim()
    if (!addr) return reset()
    if (addr === resolvedForRef.current && status !== 'idle') return // already settled
    if (!resolveAddress) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('resolving')
    setMatch(null)
    let res
    try {
      res = await resolveAddress(addr, controller.signal)
    } catch {
      res = { ok: false, reason: 'error' }
    }
    if (controller.signal.aborted) return
    if (res == null) { setStatus('idle'); return } // aborted upstream — leave as-is
    resolvedForRef.current = addr
    if (res.ok) {
      const m = classifyCountyMatch(res, stateId, county)
      setResult(res)
      setMatch(m)
      setStatus('resolved')
      lift('resolved', res, m)
    } else {
      setResult(res)
      setStatus('unresolved')
      lift('unresolved', res)
    }
  }

  const mismatch = status === 'resolved' && match?.verdict === 'mismatch' ? match.addrCounty : null
  const addrCountyLabel = (c) =>
    c ? `${c.countyName} County${c.state && c.state !== stateId ? `, ${c.state}` : ''}` : 'another county'

  return (
    <div className="sm:col-span-2 md:col-span-3 bg-white rounded-lg border border-gray-200 px-3.5 pt-2.5 pb-2 shadow-xs transition-all focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/15">
      <label className={labelCls + ' flex items-center gap-1.5'}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
        Site address <span className="text-gray-400 font-normal normal-case tracking-normal">— optional, for the exact LIC tract</span>
      </label>
      <input
        type="text"
        value={value ?? ''}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="e.g. 100 Main St, Springfield, MA"
        autoComplete="off"
        className={inputCls + ' w-full'}
      />

      {/* Pre-run resolution status — keeps an address error (or county mismatch)
          out of a 10–30s wasted Lens run. */}
      {status === 'resolving' && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-500">
          <span className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-teal-500 animate-spin shrink-0" />
          Resolving address…
        </div>
      )}

      {status === 'resolved' && !mismatch && result?.ok && (
        <div className="mt-1.5 text-[11px] leading-snug">
          <span className="font-semibold text-teal-800">✓ {result.matchedAddress || 'Address resolved'}</span>
          <span className="text-gray-500">
            {' · '}tract {result.tractGeoid}
            {match?.addrCounty ? ` · ${match.addrCounty.countyName} County` : ''}
            {' · '}
            {result.isLicTract
              ? <span className="text-teal-700 font-medium">in a §48(e) LIC tract</span>
              : <span className="text-gray-500">not in a LIC tract</span>}
          </span>
        </div>
      )}

      {mismatch && (
        <div className="mt-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug">
          <div className="text-amber-900">
            This address is in <span className="font-semibold">{addrCountyLabel(mismatch)}</span>, but you selected{' '}
            <span className="font-semibold">{county} County</span>. They have to agree for the report to be coherent.
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSwitchCounty?.(mismatch.state, mismatch.countyName)}
              className="font-semibold text-amber-900 underline hover:text-amber-700"
            >
              Switch to {addrCountyLabel(mismatch)}
            </button>
            <span className="text-amber-400">·</span>
            <button
              type="button"
              onClick={() => onClearAddress?.()}
              className="text-amber-700 hover:text-amber-900"
            >
              Clear address
            </button>
          </div>
        </div>
      )}

      {status === 'unresolved' && (
        <div className="mt-1.5 text-[11px] leading-snug text-amber-700">
          ✗ Couldn't resolve that address. The report will run at county level for{' '}
          <span className="font-medium">{county ? `${county} County` : 'the selected county'}</span> — check the
          address, or run as-is.
        </div>
      )}
    </div>
  )
}
