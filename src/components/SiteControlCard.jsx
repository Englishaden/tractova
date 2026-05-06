import { Tooltip, TooltipTrigger, TooltipContent } from './ui/Tooltip'
import { CollapsibleCard, CardDrilldown } from '../pages/Search.jsx'

export default function SiteControlCard({ siteControl, interconnection, geospatial, stateName, county, stateId, mw, substations }) {
  if (!siteControl) return null
  const { availableLand, landNotes, wetlandWarning, wetlandNotes, landUseNotes } = siteControl
  // Path B authoritative percentages (USFWS NWI + USDA SSURGO). When
  // present, append a measurement line to the Land + Wetland tile notes
  // so the developer sees the actual coverage % driving the warning,
  // not just the qualitative tier. Falls through to the curated qualitative
  // notes when geospatial isn't available for this county.
  const wetlandPct      = geospatial?.wetlandCoveragePct
  const wetlandCategory = geospatial?.wetlandCategory  // 'minimal' | 'moderate' | 'significant' | 'severe'
  const farmlandPct     = geospatial?.primeFarmlandPct
  const fmtPct = (v) => (v == null || Number.isNaN(v)) ? null : `${v < 1 ? v.toFixed(1) : Math.round(v)}%`
  // Wetland %: NWI's polygon library has overlapping classifications (one
  // acre can count as both palustrine emergent + palustrine forested), so
  // the summed coverage can exceed 100%. Cap the display at 100% and note
  // overflow with a "+". The wetland_category bucket is the cleaner
  // categorical signal and drives the score; we lead with category in the
  // copy and surface the % as a secondary measurement. 2026-05-04 fix.
  const fmtWetlandPct = (v) => {
    if (v == null || Number.isNaN(v)) return null
    const capped = Math.min(100, v)
    const overflow = v > 100
    const display = capped < 1 ? capped.toFixed(1) : Math.round(capped)
    return `${display}%${overflow ? '+' : ''}`
  }
  const wetlandCategoryLabel = {
    minimal:     'Minimal wetland presence',
    moderate:    'Moderate wetland presence',
    significant: 'Significant wetland presence',
    severe:      'Severe wetland presence',
  }[wetlandCategory] || null

  // Derive hosting capacity status from IX ease score
  const hostingStatus = (() => {
    const ease = interconnection?.easeScore
    if (ease == null) return { label: 'Unknown', color: '#6B7280', bg: 'rgba(107,114,128,0.06)', note: 'Contact serving utility for hosting capacity map' }
    if (ease >= 7) return { label: 'Available', color: '#0F766E', bg: 'rgba(15,118,110,0.06)', note: 'Hosting capacity appears sufficient based on IX conditions' }
    if (ease >= 4) return { label: 'Constrained', color: '#B45309', bg: 'rgba(180,83,9,0.06)', note: 'Hosting capacity may be limited — upgrades possible' }
    return { label: 'Constrained', color: '#DC2626', bg: 'rgba(220,38,38,0.06)', note: 'Significant hosting constraints — expect upgrade costs' }
  })()

  // Derive population density from land notes
  const populationDensity = (() => {
    const notes = (landNotes || '').toLowerCase()
    if (notes.includes('urban') || notes.includes('densely') || notes.includes('metropolitan') || notes.includes('city')) return 'urban'
    if (notes.includes('suburban') || notes.includes('fringe') || notes.includes('mixed')) return 'suburban'
    return 'rural'
  })()

  const farmlandLine = fmtPct(farmlandPct) ? `Prime farmland: ${fmtPct(farmlandPct)} of soil-surveyed area · USDA SSURGO 2024` : null
  // Lead with the categorical signal (the load-bearing input to the score),
  // then surface the wetland-richness index in parentheses. Both fall back
  // to one another if either is missing.
  const wetlandLine  = wetlandCategoryLabel
    ? `${wetlandCategoryLabel}${fmtWetlandPct(wetlandPct) ? ` (${fmtWetlandPct(wetlandPct)} richness index, USFWS NWI 2024)` : ''}`
    : fmtWetlandPct(wetlandPct)
      ? `Wetland-richness index: ${fmtWetlandPct(wetlandPct)} · USFWS NWI 2024`
      : null
  const tiles = [
    {
      label: 'Land',
      status: availableLand ? 'Available' : 'Limited',
      color: availableLand ? '#0F766E' : '#DC2626',
      bg: availableLand ? 'rgba(15,118,110,0.06)' : 'rgba(220,38,38,0.06)',
      note: [landNotes, farmlandLine].filter(Boolean).join(' · ') || null,
      tooltip: availableLand
        ? 'USDA SSURGO prime-farmland coverage <25% in this county. Material siting headroom outside protected agricultural land.'
        : 'USDA SSURGO prime-farmland coverage ≥25%. Greenfield siting may need state agricultural-land conversion approvals.',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      label: 'Wetland',
      status: wetlandWarning ? 'Warning' : 'Low Risk',
      color: wetlandWarning ? '#B45309' : '#0F766E',
      bg: wetlandWarning ? 'rgba(180,83,9,0.06)' : 'rgba(15,118,110,0.06)',
      note: [wetlandNotes || (wetlandWarning ? null : 'Low wetland risk on typical upland sites'), wetlandLine].filter(Boolean).join(' · ') || null,
      tooltip: wetlandWarning
        ? 'USFWS NWI wetland-richness index ≥15% in this county. Section 404 review and potential mitigation are likely on a typical site. The richness index sums overlapping NWI wetland classifications, so values >100% are possible — wetland_category is the cleaner categorical signal driving the score.'
        : 'USFWS NWI wetland-richness index <15%. Minimal Section 404 permitting exposure on most upland parcels. The richness index sums overlapping NWI wetland classifications, so values >100% are possible — wetland_category is the cleaner categorical signal driving the score.',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
        </svg>
      ),
    },
    {
      label: 'Zoning',
      status: landUseNotes ? 'Restricted' : '—',
      color: landUseNotes ? '#B45309' : '#6B7280',
      bg: landUseNotes ? 'rgba(180,83,9,0.06)' : 'rgba(107,114,128,0.06)',
      note: landUseNotes,
      tooltip: landUseNotes
        ? 'County zoning code restricts ground-mount solar in agricultural or rural-residential districts. Expect a special-use permit or text-amendment path.'
        : 'No flagged zoning restriction at the county level. Confirm with local planning before site control is finalized.',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-4 0v2"/><line x1="12" y1="12" x2="12" y2="16"/>
        </svg>
      ),
    },
    {
      label: 'Hosting',
      status: hostingStatus.label,
      color: hostingStatus.color,
      bg: hostingStatus.bg,
      note: hostingStatus.note,
      tooltip: hostingStatus.label === 'Constrained'
        ? 'Local distribution feeders show hosting-capacity constraints. Expect upgrade-cost exposure or limited interconnection windows on a typical site.'
        : 'No flagged hosting-capacity constraint on the relevant feeders. Site-specific hosting capacity should still be confirmed via the utility study.',
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
    },
  ]

  return (
    <CollapsibleCard
      accentColor="#2563EB"
      eyebrow="03 / Site Control"
      title={`${county} County`}
      caption={stateName.toUpperCase()}
    >
      {/* Body */}
      <div className="px-5 py-4">
        {/* Population density context */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Area Profile</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-sm border" style={{
            ...(populationDensity === 'urban'
              ? { color: '#7C3AED', background: 'rgba(124,58,237,0.06)', borderColor: 'rgba(124,58,237,0.20)' }
              : populationDensity === 'suburban'
              ? { color: '#2563EB', background: 'rgba(37,99,235,0.06)', borderColor: 'rgba(37,99,235,0.20)' }
              : { color: '#0F766E', background: 'rgba(20,184,166,0.06)', borderColor: 'rgba(20,184,166,0.25)' })
          }}>
            {populationDensity.charAt(0).toUpperCase() + populationDensity.slice(1)}
          </span>
          <span className="text-[9px] text-gray-400">
            {populationDensity === 'urban' ? '· Higher land costs, rooftop focus' : populationDensity === 'suburban' ? '· Mixed land availability' : '· Large parcels typically available'}
          </span>
        </div>

        {/* 4-factor risk strip — stacked rows so each factor's note has room
            to breathe at the 1/3-viewport column width the parent grid forces.
            Earlier 4-col grid squashed labels and notes into unreadable tiles. */}
        <div className="space-y-1.5 mb-3">
          {tiles.map((t) => (
            <div
              key={t.label}
              className="flex items-start gap-3 rounded-md pl-2.5 pr-3 py-2"
              style={{ background: t.bg, borderLeft: `3px solid ${t.color}` }}
            >
              <span className="shrink-0 mt-0.5" style={{ color: t.color }}>{t.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: t.color }}
                  >
                    {t.label}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-sm cursor-help"
                        style={{ background: 'white', color: t.color, border: `1px solid ${t.color}40` }}
                      >
                        {t.status}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-[10px]">{t.tooltip}</TooltipContent>
                  </Tooltip>
                </div>
                {t.note && (
                  <p className="text-[11px] text-gray-600 leading-relaxed">{t.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Site Risk Assessment — synthesize all signals */}
        {(() => {
          const hostingRisk = hostingStatus.label === 'Constrained'
          const riskCount = [!availableLand, wetlandWarning, !!landUseNotes, hostingRisk].filter(Boolean).length
          const riskLevel = riskCount <= 1 ? 'low' : riskCount === 2 ? 'moderate' : 'elevated'
          const riskConfig = {
            low:      { label: 'Low Risk', color: '#0F766E', bg: 'rgba(15,118,110,0.06)', border: 'rgba(15,118,110,0.20)' },
            moderate: { label: 'Moderate Risk', color: '#B45309', bg: 'rgba(180,83,9,0.06)', border: 'rgba(180,83,9,0.20)' },
            elevated: { label: 'Elevated Risk', color: '#DC2626', bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.20)' },
          }
          const rc = riskConfig[riskLevel]

          const guidance = []
          if (!availableLand) guidance.push('Land supply is constrained — expect competitive pricing on available parcels and longer site acquisition timelines.')
          if (wetlandWarning) guidance.push('Wetland presence may require USACE Section 404 permits and jurisdictional delineation studies, adding 3–6 months and $20K–$50K to pre-development.')
          if (landUseNotes) guidance.push('Zoning restrictions may limit array placement or require special-use permits — review county ordinances early before committing to lease terms.')
          if (guidance.length === 0) guidance.push(`${county} County shows favorable site conditions. Standard due diligence recommended — confirm parcel-level suitability during site walks.`)

          return (
            <div
              className="rounded-lg px-3.5 py-3 mt-1"
              style={{ background: rc.bg, border: `1px solid ${rc.border}` }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: rc.color }}>
                  {rc.label}
                </span>
                <span className="text-[9px] text-gray-400">·</span>
                <span className="text-[9px] text-gray-400">{riskCount} of 4 risk factors flagged</span>
              </div>
              {guidance.map((g, i) => (
                <p key={i} className="text-[11px] text-gray-600 leading-relaxed mt-1">{g}</p>
              ))}
            </div>
          )
        })()}

        {/* Nearest substations */}
        {(() => {
          const subs = substations
          if (!subs) return null
          const servingUtil = interconnection?.servingUtility?.toLowerCase() || ''
          const mwNum = parseFloat(mw) || 5
          return (
            <div className="mt-4">
              <div className="flex items-center gap-1.5 mb-2">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Nearest Substations</span>
              </div>
              <div className="space-y-1.5">
                {subs.map((s, i) => {
                  const isUtilityMatch = servingUtil && s.utility?.toLowerCase().includes(servingUtil.split(' ')[0].toLowerCase())
                  const highlight = isUtilityMatch || i === 0
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                      style={{
                        background: isUtilityMatch ? 'rgba(20,184,166,0.08)' : highlight ? 'rgba(37,99,235,0.06)' : 'rgba(243,244,246,0.8)',
                        borderLeft: isUtilityMatch ? '3px solid #0F766E' : highlight ? '3px solid #2563EB' : '3px solid transparent',
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`font-semibold ${isUtilityMatch ? 'text-emerald-700' : highlight ? 'text-blue-700' : 'text-gray-700'}`}>{s.name}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-500">{s.utility}</span>
                        {isUtilityMatch && (
                          <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-700 border border-emerald-200">
                            Serving Utility
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 tabular-nums">
                        {s.distanceMiles != null && (
                          <span className={`font-semibold ${isUtilityMatch ? 'text-emerald-700' : highlight ? 'text-blue-700' : 'text-gray-600'}`}>{s.distanceMiles} mi</span>
                        )}
                        <span className="text-gray-400">{s.capacityMw} MW</span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-[9px] text-gray-400 mt-1.5">
                Distances from county centroid. Source: EIA Form 860. {mwNum <= 5 ? '138kV substations are typical POI for sub-5MW projects.' : mwNum <= 20 ? '138–230kV substations typical for this project size.' : '230kV+ substations may be needed for projects above 20MW.'} Verify POI with utility.
              </p>
            </div>
          )
        })()}
      </div>

      {/* Methodology drilldown — click to expand */}
      <CardDrilldown accentColor="#2563EB" label="Methodology · sources · verification">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#1D4ED8' }}>How each tile is derived</p>
          <ul className="space-y-1 text-gray-700 list-none">
            <li><span className="font-semibold text-ink">Land</span> · curated from state PUC filings + USGS land-cover overlay; binary "available" assumes typical greenfield/brownfield siting profile</li>
            <li><span className="font-semibold text-ink">Wetland</span> · EPA NWI (National Wetlands Inventory) check at county centroid; site-level wetlands require per-parcel survey</li>
            <li><span className="font-semibold text-ink">Zoning</span> · surfaced when county code references solar overlay districts, agricultural setbacks, or special-use permits in our notes layer</li>
            <li><span className="font-semibold text-ink">Hosting</span> · proxy from IX ease score until utility hosting-capacity maps are integrated per-territory</li>
          </ul>
        </div>
        <div className="pt-2 border-t border-gray-100">
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mb-1.5" style={{ color: '#1D4ED8' }}>Source attribution</p>
          <div className="flex flex-wrap gap-1.5">
            <a href="https://www.fws.gov/program/national-wetlands-inventory" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">EPA NWI ↗</a>
            <a href="https://www.eia.gov/electricity/data/eia860/" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">EIA Form 860 ↗</a>
            <a href="https://www.usgs.gov/centers/eros/science/national-land-cover-database" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">USGS NLCD ↗</a>
          </div>
        </div>
        <p className="pt-2 border-t border-gray-100 text-[10px] text-gray-500 italic">
          Site control flags are screening signals. Always confirm with a per-site survey (Phase I ESA, parcel-level wetland delineation, county zoning verification) before committing capital.
        </p>
      </CardDrilldown>
    </CollapsibleCard>
  )
}
