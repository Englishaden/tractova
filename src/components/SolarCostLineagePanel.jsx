// ── Solar capex $/W per-state data lineage ──────────────────────────────────
// Five visual variants disclose where each state sits on the observed-vs-
// synthesized axis:
//
//   Tier A · STRONG    (n>=40)   teal panel, full p10–p90 percentile grid
//   Tier A · MODEST    (n=10–39) teal panel + "modest sample" caveat line
//   Tier A · THIN      (n=3–9)   amber-tinged teal; suppress p10/p90
//                                 (false precision at thin n); mandatory caveat
//   Tier B · THIN      (n<3)     amber panel + "below floor" copy
//   Tier B · STRUCTURAL          amber panel + "incentive design" copy.
//                                 SREC-strike states (IL/PA/OR/DE/WA) generate
//                                 no LBNL paper trail regardless of program
//                                 maturity — surfaced via the [TIER_B:STRUCTURAL]
//                                 prefix on revenue_rates.notes (migration 052).
//
// Tier-B prefixes are parsed from rates.notes; absent prefix renders as a
// legacy single Tier-B variant (graceful degrade for any state added pre-052).
function parseTierBPrefix(notes) {
  if (!notes || typeof notes !== 'string') return { kind: 'legacy', stripped: notes || '' }
  const m = notes.match(/^\[TIER_B:(THIN|STRUCTURAL)([^\]]*)\]\s*(.*)$/s)
  if (!m) return { kind: 'legacy', stripped: notes }
  return { kind: m[1].toLowerCase(), meta: m[2].trim(), stripped: m[3] }
}

export default function SolarCostLineagePanel({ rates, stateName }) {
  if (!rates) return null
  const stateLabel = stateName || rates.state_id || ''
  const synthValue = rates.installed_cost_per_watt
  const lineage = rates.solar_cost_lineage
  if (synthValue == null) return null

  const fmtDollar = (n) => (n == null ? '—' : `$${Number(n).toFixed(2)}/W`)

  // ── Tier A branch (observed lineage row exists) ──
  if (lineage) {
    const tier = lineage.confidence_tier || 'strong'  // legacy rows default to strong
    const isThin = tier === 'thin'
    const isModest = tier === 'modest'

    // Visual treatment shifts only at thin tier (amber-tinged).
    const containerStyle = isThin
      ? { borderColor: 'rgba(15,118,110,0.30)', background: 'rgba(217,119,6,0.04)' }
      : { borderColor: 'rgba(15,118,110,0.30)', background: 'rgba(15,118,110,0.04)' }
    const badgeStyle = isThin
      ? { background: 'rgba(217,119,6,0.10)', color: '#0F766E', border: '1px solid rgba(217,119,6,0.30)' }
      : { background: 'rgba(15,118,110,0.10)', color: '#0F766E', border: '1px solid rgba(15,118,110,0.30)' }
    const badgeLabel = (
      tier === 'strong' ? 'Tier A · LBNL observed'
      : tier === 'modest' ? 'Tier A · LBNL observed (modest sample)'
      : 'Tier A · LBNL observed (thin sample)'
    )

    return (
      <div className="pt-2 border-t border-gray-100">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#0F766E' }}>
          Solar capex $/W — observed data lineage for {stateLabel}
        </p>
        <div className="rounded-md border px-3 py-2.5" style={containerStyle}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="font-mono text-[8px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold" style={badgeStyle}>
              {badgeLabel}
            </span>
            <span className="text-[10px] text-gray-500">vintage {lineage.vintage_window} · n={lineage.install_count}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-700">
            <div>Sample size · <span className="font-semibold tabular-nums">{lineage.install_count} projects</span></div>
            <div>Bracket · <span className="font-semibold">0.5–5 MW non-res</span></div>
            <div>Median (p50) · <span className="font-semibold tabular-nums">{fmtDollar(lineage.p50_per_watt)}</span></div>
            <div>p25–p75 band · <span className="font-semibold tabular-nums">{fmtDollar(lineage.p25_per_watt)} – {fmtDollar(lineage.p75_per_watt)}</span></div>
            {/* p10/p90 suppressed in thin tier — at n=3–9 they're essentially min/max,
                conveying false precision. Strong + Modest still show them. */}
            {!isThin && (
              <div className="sm:col-span-2 text-[9px] text-gray-500">p10 {fmtDollar(lineage.p10_per_watt)} · p90 {fmtDollar(lineage.p90_per_watt)}</div>
            )}
          </div>
          {isModest && (
            <p className="mt-1.5 text-[10px] text-gray-600 italic">
              Sample is below the n≥40 statistical-significance threshold; treat percentiles as directional. p25–p75 band is the load-bearing signal.
            </p>
          )}
          {isThin && (
            <p className="mt-1.5 text-[10px] text-gray-600 italic">
              Thin sample (n&lt;10). Median is best-available observed signal but a single project can move the percentile materially. Use as anchor, not as ground truth. Tier reassessed each October from the freshest LBNL TTS release.
            </p>
          )}
          <div className="mt-2 pt-2 border-t border-teal-200/60 text-[10px] text-gray-700">
            <span className="font-semibold text-ink">→ Tractova 2026 anchor:</span> <span className="font-semibold tabular-nums">{fmtDollar(synthValue)}</span>
            <span className="text-gray-500"> · explicit forward extrapolation from observed median (NREL +22% YoY 2023→2024 + FEOC + reshoring + logistics layers — see methodology paragraph below).</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <a href="https://emp.lbl.gov/tracking-the-sun" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors">LBNL Tracking the Sun ↗</a>
          </div>
        </div>
      </div>
    )
  }

  // ── Tier B branch (no observed lineage row — synthesis only) ──
  // Parse the [TIER_B:THIN n=N] or [TIER_B:STRUCTURAL incentive=SREC] prefix
  // from rates.notes (migration 052 backfill). Two distinct copy variants;
  // legacy/no-prefix renders the original single-variant copy.
  const tierB = parseTierBPrefix(rates.notes)

  let bodyCopy
  let badgeLabel
  let metaLabel
  if (tierB.kind === 'structural') {
    badgeLabel = 'Tier B · regional analog · structural data gap'
    metaLabel  = 'incentive design generates no LBNL paper trail'
    bodyCopy = (
      <>{stateLabel}'s primary CS incentive is per-MWh REC strike rather than per-W upfront rebate, so installations do not generate an LBNL TTS paper trail. No sample-size threshold can unlock this — the gap is structural to the program's incentive design. Synthesized value <span className="font-semibold tabular-nums">{fmtDollar(synthValue)}</span> is a Tractova editorial Tier B regional-analog × $2.45/W national 2026 anchor (NREL Q1 2023 CS MMP $1.76 + explicit 2023→2026 forward layers).</>
    )
  } else if (tierB.kind === 'thin') {
    badgeLabel = 'Tier B · regional analog · sample below n≥3 floor'
    metaLabel  = `${tierB.meta || 'n<3'} observed projects in window`
    bodyCopy = (
      <>{stateLabel} has fewer than 3 observed projects in the LBNL TTS public CSV (0.5–5 MW large non-residential bracket, last 3 install years) — below the n≥3 floor for publication. Synthesized value <span className="font-semibold tabular-nums">{fmtDollar(synthValue)}</span> is a Tractova editorial Tier B regional-analog × $2.45/W national 2026 anchor.</>
    )
  } else {
    // Legacy / no-prefix fallback — graceful degrade for any state added pre-052.
    badgeLabel = 'Tier B · regional analog'
    metaLabel  = 'no qualifying LBNL TTS sample'
    bodyCopy = (
      <>{stateLabel} has insufficient observed sample in the LBNL Tracking the Sun public CSV. Synthesized value <span className="font-semibold tabular-nums">{fmtDollar(synthValue)}</span> is a Tractova editorial Tier B regional-analog × $2.45/W national 2026 anchor (NREL Q1 2023 CS MMP $1.76 + explicit 2023→2026 forward layers).</>
    )
  }

  return (
    <div className="pt-2 border-t border-gray-100">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#0F766E' }}>
        Solar capex $/W — synthesis basis for {stateLabel}
      </p>
      <div className="rounded-md border px-3 py-2.5" style={{ borderColor: 'rgba(217,119,6,0.30)', background: 'rgba(217,119,6,0.04)' }}>
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          <span className="font-mono text-[8px] uppercase tracking-[0.16em] px-1.5 py-0.5 font-bold" style={{ background: 'rgba(217,119,6,0.10)', color: '#92400E', border: '1px solid rgba(217,119,6,0.30)' }}>
            {badgeLabel}
          </span>
          <span className="text-[10px] text-gray-500">{metaLabel}</span>
        </div>
        <p className="text-[10px] text-gray-700 leading-relaxed">
          {bodyCopy}
        </p>
        {tierB.stripped && (
          <p className="mt-1.5 pt-1.5 border-t border-amber-200/60 text-[10px] text-gray-600 leading-relaxed">
            <span className="font-semibold text-ink">State-specific basis:</span> {tierB.stripped}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <a href="https://emp.lbl.gov/tracking-the-sun" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors">LBNL TTS (national reference) ↗</a>
        </div>
      </div>
    </div>
  )
}
