import { useMemo, useState } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { computeSubScores, safeScore } from '../../lib/scoreEngine'
import countyCentroids from '../../data/county_centroids.json'

// Phase 2B · TRACTOVA-UX-001 — Library Map view (research-terminal pass).
//
// US choropleth + project pins for the user's saved pipeline. Visual
// vocabulary deliberately distinct from Dashboard's USMap so users can
// tell the two surfaces apart:
//   - Dashboard USMap colors states by the *market* feasibility score.
//   - LibraryMap colors states by the *portfolio* — MW-weighted avg of
//     saved-project live scores per state.
//
// Interaction model (revised after user feedback):
//   - Single click on state → set filterState only (stays on map).
//   - Double click on state → filterState + switch to Table layout
//     (explicit transition, no misclick risk).
//   - Click pin → ProjectDrawer slide-in with full ProjectCard.
//   - "View as table →" CTA in the header when filtered, for
//     keyboard / accessibility users who can't dbl-click.
//
// Visual layers, top-to-bottom:
//   1. Header bar (eyebrow + title + ticker-style stats + filter chip)
//   2. Legend strip (state buckets + pin score buckets + √MW note)
//   3. Map canvas (pale ocean-tint base, dot-grid, graticule,
//      state polygons w/ drop-shadow, radar-blip pins)
//   4. Footer coordinate marker (very subtle mono caps)

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

const FIPS = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT',
  '10':'DE','11':'DC','12':'FL','13':'GA','15':'HI','16':'ID','17':'IL',
  '18':'IN','19':'IA','20':'KS','21':'KY','22':'LA','23':'ME','24':'MD',
  '25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT','31':'NE',
  '32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND',
  '39':'OH','40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD',
  '47':'TN','48':'TX','49':'UT','50':'VT','51':'VA','53':'WA','54':'WV',
  '55':'WI','56':'WY',
}

const CLUSTER_THRESHOLD = 200

function colorForScore(score) {
  if (score == null)  return '#9CA3AF'
  if (score >= 70)    return '#0F766E'
  if (score >= 50)    return '#D97706'
  return '#DC2626'
}

function stateFillForAggregate(agg) {
  if (!agg) return '#F1F5F9'
  const score = agg.weightedAvg
  if (score == null)  return '#E2E8F0'
  if (score >= 70)    return '#0F766E'
  if (score >= 60)    return '#14B8A6'
  if (score >= 50)    return '#5EEAD4'
  if (score >= 40)    return '#FCD34D'
  return '#FCA5A5'
}

export default function LibraryMap({
  projects,
  stateProgramMap,
  countyDataMap,
  onStateClick,
  onStateDoubleClick,
  onPinClick,
  onSwitchToTable,
  filterState,
}) {
  const [hoveredStateId, setHoveredStateId] = useState(null)
  const [hoveredPinId,   setHoveredPinId]   = useState(null)
  const [tooltip,        setTooltip]        = useState(null)

  // Portfolio-level rollup for the stats ticker.
  const portfolio = useMemo(() => {
    let mwSum = 0
    let weighted = 0
    let scoredCount = 0
    const stateSet = new Set()
    for (const p of projects) {
      const sp = stateProgramMap[p.state]
      if (!sp) continue
      stateSet.add(p.state)
      const cd = countyDataMap?.[`${p.state}::${p.county}`] || null
      const subs = computeSubScores(sp, cd, p.stage, p.technology)
      const score = safeScore(subs.offtake, subs.ix, subs.site)
      const mw = parseFloat(p.mw) || 0
      const w = mw > 0 ? mw : 1
      if (score != null) {
        mwSum += w
        weighted += w * score
        scoredCount += 1
      }
    }
    return {
      count: projects.length,
      mwSum: projects.reduce((s, p) => s + (parseFloat(p.mw) || 0), 0),
      weightedAvg: scoredCount > 0 ? Math.round(weighted / mwSum) : null,
      stateCount: stateSet.size,
    }
  }, [projects, stateProgramMap, countyDataMap])

  const stateAggregates = useMemo(() => {
    const agg = {}
    for (const p of projects) {
      if (!p.state) continue
      const sp = stateProgramMap[p.state]
      if (!sp) continue
      const cd = countyDataMap?.[`${p.state}::${p.county}`] || null
      const subs = computeSubScores(sp, cd, p.stage, p.technology)
      const score = safeScore(subs.offtake, subs.ix, subs.site)
      if (score == null) continue
      const mw = parseFloat(p.mw) || 0
      if (!agg[p.state]) agg[p.state] = { mwSum: 0, weighted: 0, count: 0 }
      const w = mw > 0 ? mw : 1
      agg[p.state].mwSum    += w
      agg[p.state].weighted += w * score
      agg[p.state].count    += 1
    }
    for (const k of Object.keys(agg)) {
      agg[k].weightedAvg = Math.round(agg[k].weighted / agg[k].mwSum)
    }
    return agg
  }, [projects, stateProgramMap, countyDataMap])

  const pins = useMemo(() => {
    return projects.map(p => {
      const sp = stateProgramMap[p.state]
      if (!sp || !p.state || !p.county) return null
      const centroid = countyCentroids[`${p.state}::${p.county}`]
      if (!centroid) return null
      const cd = countyDataMap?.[`${p.state}::${p.county}`] || null
      const subs = computeSubScores(sp, cd, p.stage, p.technology)
      const score = safeScore(subs.offtake, subs.ix, subs.site)
      const mw = parseFloat(p.mw) || 0
      return { id: p.id, name: p.name, state: p.state, county: p.county, mw, score, centroid, project: p }
    }).filter(Boolean)
  }, [projects, stateProgramMap, countyDataMap])

  const shouldCluster = pins.length > CLUSTER_THRESHOLD

  const clusters = useMemo(() => {
    if (!shouldCluster) return []
    const byState = {}
    for (const pin of pins) {
      if (!byState[pin.state]) byState[pin.state] = { state: pin.state, pins: [], mwSum: 0 }
      byState[pin.state].pins.push(pin)
      byState[pin.state].mwSum += pin.mw
    }
    return Object.values(byState).map(c => {
      const lon = c.pins.reduce((s, p) => s + p.centroid[0], 0) / c.pins.length
      const lat = c.pins.reduce((s, p) => s + p.centroid[1], 0) / c.pins.length
      return { state: c.state, count: c.pins.length, mwSum: c.mwSum, centroid: [lon, lat] }
    })
  }, [pins, shouldCluster])

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{
        // Layered depth — pale teal-mint atmosphere reads as "ocean
        // surface" without being literally blue. Top-left highlight +
        // bottom-right depth, then the base wash beneath.
        background: [
          'radial-gradient(ellipse at 20% 10%, rgba(255,255,255,0.85) 0%, transparent 50%)',
          'radial-gradient(ellipse at 85% 90%, rgba(15,26,46,0.10) 0%, transparent 55%)',
          'linear-gradient(170deg, #F4FAFA 0%, #E0F0EE 100%)',
        ].join(', '),
        border: '1px solid rgba(15,118,110,0.22)',
        boxShadow: '0 0 0 1px rgba(20,184,166,0.08), 0 16px 44px rgba(10,24,40,0.10), 0 2px 8px rgba(10,24,40,0.06)',
      }}
    >
      {/* ── Header bar — eyebrow + title + ticker stats (under title)
            + filter chip when active ───────────────────────────────── */}
      <div
        className="relative z-10 px-5 pt-3 pb-3"
        style={{ borderBottom: '1px solid rgba(15,118,110,0.12)', background: 'rgba(20,184,166,0.05)' }}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <span className="eyebrow-mono" style={{ color: '#0F766E' }}>Portfolio Geography</span>
            <h2 className="font-serif text-sm font-semibold text-ink mt-0.5">
              {portfolio.count === 0
                ? 'Your pipeline on the map'
                : `${portfolio.count} project${portfolio.count === 1 ? '' : 's'} across ${portfolio.stateCount} state${portfolio.stateCount === 1 ? '' : 's'}`}
            </h2>

            {/* Bloomberg-style stats ticker. Single line, mono numerics,
                all tabular-nums + middle-dot separators so the row reads
                as one ledger column rather than four misaligned blocks. */}
            {portfolio.count > 0 && (
              <div className="mt-1.5 flex items-center gap-2 font-mono text-[11px] tabular-nums flex-wrap" style={{ color: '#475569' }}>
                <span><span className="font-bold text-ink">{portfolio.mwSum.toFixed(1)}</span> MW</span>
                <span className="text-gray-300">·</span>
                <span>
                  weighted avg <span className="font-bold" style={{ color: portfolio.weightedAvg != null && portfolio.weightedAvg >= 70 ? '#0F766E' : '#0F1A2E' }}>
                    {portfolio.weightedAvg ?? '—'}
                  </span>
                </span>
                <span className="text-gray-300">·</span>
                <span>{portfolio.stateCount} state{portfolio.stateCount === 1 ? '' : 's'}</span>
              </div>
            )}
          </div>

          {/* Right side — quick-help affordance about the click model. */}
          <p className="text-[11px] text-gray-400 mt-1 max-w-[200px] text-right hidden sm:block">
            Click pin for detail · double-click state to filter as table · esc to clear
          </p>
        </div>

        {filterState && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold uppercase tracking-[0.14em] px-2 py-1 rounded-sm"
              style={{ background: 'rgba(124,58,237,0.08)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.25)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#7C3AED' }} />
              Filtered: {filterState}
            </span>
            {onSwitchToTable && (
              <button
                type="button"
                onClick={onSwitchToTable}
                className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-teal-700 hover:text-teal-900 transition-colors"
              >
                View as table →
              </button>
            )}
            <button
              type="button"
              onClick={() => onStateClick?.(filterState, true)}
              className="text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-gray-400 hover:text-gray-600 transition-colors"
              title="Press Esc to clear"
            >
              Clear ✕
            </button>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: '#94A3B8' }}>
              or press <kbd className="px-1 py-0.5 rounded-sm border border-gray-300 bg-white text-[9px]" style={{ color: '#5A6B7A' }}>Esc</kbd>
            </span>
          </div>
        )}
      </div>

      {/* ── Legend at top, right below header (was at bottom in prior
            iteration; surfaced upward per feedback so the user can
            decode colors before scanning the map) ──────────────────── */}
      <Legend />

      {/* ── Map ──────────────────────────────────────────────────── */}
      <div className="relative z-10">
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 1000 }}
          style={{ width: '100%', height: 'auto' }}
        >
          <defs>
            {/* Dot-grid pattern — slightly stronger contrast than the
                first cut (10% vs 8%) but still beneath state polygons,
                so it reads as analyst-paper texture, not as content. */}
            <pattern id="lib-map-dotgrid" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="8" cy="8" r="0.55" fill="#0F1A2E" fillOpacity="0.10" />
            </pattern>
            {/* Soft state drop-shadow. dy 0.7 / stdDev 0.7 / 12% black
                — subtle lift, no bevel. Only applied to states with
                saved projects so blank states stay flat. */}
            <filter id="lib-map-state-shadow" x="-5%" y="-5%" width="110%" height="115%">
              <feDropShadow dx="0" dy="0.7" stdDeviation="0.7" floodColor="#0F1A2E" floodOpacity="0.12" />
            </filter>
          </defs>

          <rect x="-100" y="-100" width="1200" height="700" fill="url(#lib-map-dotgrid)" />

          <Graticule />

          <Geographies geography={GEO_URL}>
            {({ geographies }) => geographies.map((geo) => {
              const fips = String(geo.id).padStart(2, '0')
              const stateId = FIPS[fips]
              if (!stateId) return null
              const agg = stateAggregates[stateId]
              const hasProjects = !!agg
              const isHovered  = hoveredStateId === stateId
              const isFiltered = filterState === stateId
              const baseFill = stateFillForAggregate(agg)
              const fill = isFiltered ? '#7C3AED' : isHovered && hasProjects ? '#0F766E' : baseFill
              const aria = hasProjects
                ? `${stateId}: ${agg.count} project${agg.count === 1 ? '' : 's'}, ${agg.mwSum.toFixed(1)} MW, weighted-avg score ${agg.weightedAvg}. Enter to filter; double-click to filter as table.`
                : `${stateId}: no saved projects.`
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="#FFFFFF"
                  strokeWidth={0.6}
                  style={{
                    default: { outline: 'none', filter: hasProjects ? 'url(#lib-map-state-shadow)' : 'none' },
                    hover:   { outline: 'none', filter: hasProjects ? 'url(#lib-map-state-shadow)' : 'none' },
                    pressed: { outline: 'none', filter: hasProjects ? 'url(#lib-map-state-shadow)' : 'none' },
                  }}
                  onMouseMove={(evt) => {
                    setHoveredStateId(stateId)
                    setTooltip({ x: evt.clientX, y: evt.clientY, kind: 'state', stateId, agg })
                  }}
                  onMouseLeave={() => { setHoveredStateId(null); setTooltip(null) }}
                  onClick={() => onStateClick?.(stateId, hasProjects)}
                  onDoubleClick={() => onStateDoubleClick?.(stateId, hasProjects)}
                  onKeyDown={(evt) => { if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); onStateClick?.(stateId, hasProjects) } }}
                  className={`transition-all duration-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500 ${hasProjects ? 'cursor-pointer' : 'cursor-default'}`}
                  role="button"
                  tabIndex={hasProjects ? 0 : -1}
                  aria-label={aria}
                  aria-pressed={isFiltered}
                />
              )
            })}
          </Geographies>

          {/* Pins — radar-blip structure. Stacking order matters:
              halo (back) → inner dot (middle) → pulse ring (front,
              only when hovered). Pulse uses SVG SMIL <animate>
              elements — declarative, no JS overhead, bulletproof
              across Chrome / Firefox / Safari. The previous motion-
              library `scale` approach was being shadowed by Tailwind
              v4's transform reset on SVG elements; SMIL bypasses CSS
              transform entirely by animating the SVG `r` attribute
              directly. Pin radii: 2.5–5.5 px so dense states don't
              look crowded. */}
          {!shouldCluster && pins.map((pin) => {
            const color = colorForScore(pin.score)
            const isHovered = hoveredPinId === pin.id
            const r = Math.max(2.5, Math.min(5.5, 2.5 + Math.sqrt(Math.max(0, pin.mw)) * 0.45))
            return (
              <Marker key={pin.id} coordinates={pin.centroid}>
                {/* Outer halo */}
                <circle
                  r={r * 1.7}
                  fill={color}
                  fillOpacity={0.18}
                  pointerEvents="none"
                />
                {/* Inner dot */}
                <circle
                  cx={0}
                  cy={0}
                  r={isHovered ? r + 1.2 : r}
                  fill={color}
                  fillOpacity={0.92}
                  stroke="#FFFFFF"
                  strokeWidth={1}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(evt) => {
                    setHoveredPinId(pin.id)
                    setTooltip({ x: evt.clientX, y: evt.clientY, kind: 'pin', pin })
                  }}
                  onMouseMove={(evt) => setTooltip(t => t ? { ...t, x: evt.clientX, y: evt.clientY } : t)}
                  onMouseLeave={() => { setHoveredPinId(null); setTooltip(null) }}
                  onClick={(evt) => { evt.stopPropagation(); onPinClick?.(pin.project) }}
                  role="button"
                  aria-label={`${pin.name} — ${pin.mw} MW, score ${pin.score ?? 'unknown'}. Click to view details.`}
                />
                {/* Pulse ring — only when hovered. Rendered LAST so it
                    paints on top of halo + dot. SMIL <animate> on r
                    and opacity, 1.4s loop, ease-out via keySplines so
                    the expand decelerates like a radar wave. */}
                {isHovered && (
                  <circle
                    cx={0}
                    cy={0}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.4}
                    pointerEvents="none"
                  >
                    <animate
                      attributeName="r"
                      values={`${r};${r * 3.2}`}
                      keyTimes="0;1"
                      keySplines="0.16 1 0.3 1"
                      calcMode="spline"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.75;0"
                      keyTimes="0;1"
                      keySplines="0.16 1 0.3 1"
                      calcMode="spline"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </Marker>
            )
          })}

          {shouldCluster && clusters.map((c) => {
            const r = Math.max(8, Math.min(28, 8 + Math.sqrt(c.count) * 3))
            return (
              <Marker key={c.state} coordinates={c.centroid}>
                <circle r={r * 1.4} fill="#0F766E" fillOpacity={0.10} pointerEvents="none" />
                <circle
                  r={r}
                  fill="#0F766E"
                  fillOpacity={0.35}
                  stroke="#0F766E"
                  strokeWidth={1.5}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onStateClick?.(c.state, true)}
                  onDoubleClick={() => onStateDoubleClick?.(c.state, true)}
                  aria-label={`${c.state} — ${c.count} projects, ${c.mwSum.toFixed(1)} MW. Click to filter; double-click to filter as table.`}
                />
                <text
                  textAnchor="middle"
                  y={4}
                  className="font-mono font-bold tabular-nums pointer-events-none"
                  style={{ fontSize: '11px', fill: '#0F1A2E' }}
                >{c.count}</text>
              </Marker>
            )
          })}
        </ComposableMap>
      </div>

      {/* ── Footer coordinate marker — quiet research-terminal stamp
            in the lower-right. Mono caps, very low contrast so it
            reads as chrome, not content. */}
      <div
        className="relative z-10 px-5 pb-2 pt-1 flex items-center justify-end"
        style={{ borderTop: '1px solid rgba(15,118,110,0.08)' }}
      >
        <span
          className="font-mono uppercase tracking-[0.18em]"
          style={{ fontSize: '9px', color: '#94A3B8' }}
        >
          Tractova · Albers USA · Lat 39.5°N Lon 98.5°W
        </span>
      </div>

      {/* ── Hover tooltips ───────────────────────────────────────── */}
      {tooltip && tooltip.kind === 'state' && (
        <div className="fixed z-50 pointer-events-none" style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          <div
            className="text-xs rounded-lg px-3 py-2 shadow-2xl max-w-[240px]"
            style={{ background: 'rgba(7,17,12,0.95)', border: '1px solid rgba(20,184,166,0.30)' }}
          >
            <div className="font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{tooltip.stateId}</div>
            {tooltip.agg ? (
              <div className="mt-1 flex flex-col gap-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span className="font-mono tabular-nums">
                  <span className="text-white font-semibold">{tooltip.agg.count}</span> project{tooltip.agg.count === 1 ? '' : 's'} ·
                  <span className="text-white font-semibold ml-1">{tooltip.agg.mwSum.toFixed(1)} MW</span>
                </span>
                <span className="font-mono tabular-nums">
                  Weighted-avg score: <span className="text-white font-semibold">{tooltip.agg.weightedAvg}</span>
                </span>
                <span className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Click to filter · double-click to filter as table →
                </span>
              </div>
            ) : (
              <div className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>No saved projects</div>
            )}
          </div>
        </div>
      )}
      {tooltip && tooltip.kind === 'pin' && (
        <div className="fixed z-50 pointer-events-none" style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          <div
            className="text-xs rounded-lg px-3 py-2 shadow-2xl max-w-[260px]"
            style={{ background: 'rgba(7,17,12,0.95)', border: '1px solid rgba(20,184,166,0.30)' }}
          >
            <div className="font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{tooltip.pin.name}</div>
            <div className="mt-0.5 text-[11px] font-mono tabular-nums" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {tooltip.pin.county}, {tooltip.pin.state} · {tooltip.pin.mw} MW
            </div>
            <div className="mt-1 text-[11px] font-mono tabular-nums" style={{ color: '#2DD4BF' }}>
              Score: <span className="font-bold">{tooltip.pin.score ?? '—'}</span>
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Click for details →</div>
          </div>
        </div>
      )}
    </div>
  )
}

// Faint graticule — research-terminal reference lines. Lon every 10°,
// lat every 5° approximated by SVG-coord placement (the AlbersUsa
// projection bounds we render into are roughly 20–920 × 20–500).
function Graticule() {
  const horiz = [120, 200, 280, 360, 440]
  const vert  = [120, 240, 360, 480, 600, 720]
  return (
    <g aria-hidden="true" pointerEvents="none">
      {horiz.map(y => (
        <line key={`h-${y}`} x1={20} x2={920} y1={y} y2={y} stroke="#0F1A2E" strokeOpacity={0.05} strokeWidth={0.5} strokeDasharray="2 4" />
      ))}
      {vert.map(x => (
        <line key={`v-${x}`} x1={x} x2={x} y1={20} y2={500} stroke="#0F1A2E" strokeOpacity={0.05} strokeWidth={0.5} strokeDasharray="2 4" />
      ))}
    </g>
  )
}

// Legend — two compact rows beneath the header. State buckets first
// (most of the visual real estate), then pin score scale + √MW note.
function Legend() {
  const stateBuckets = [
    { color: '#0F766E', label: '70+' },
    { color: '#14B8A6', label: '60–69' },
    { color: '#5EEAD4', label: '50–59' },
    { color: '#FCD34D', label: '40–49' },
    { color: '#FCA5A5', label: '<40' },
    { color: '#F1F5F9', label: 'none', border: '#CBD5E1' },
  ]
  const pinBuckets = [
    { color: '#0F766E', label: '70+' },
    { color: '#D97706', label: '50–69' },
    { color: '#DC2626', label: '<50' },
  ]
  return (
    <div
      className="relative z-10 px-5 py-2 flex flex-col gap-1.5"
      style={{ borderBottom: '1px solid rgba(15,118,110,0.08)', background: 'rgba(15,26,46,0.025)' }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mr-1" style={{ color: '#0F766E' }}>
          State · MW-weighted
        </span>
        {stateBuckets.map(b => (
          <div key={b.label} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-xs shrink-0"
              style={{ backgroundColor: b.color, border: `1px solid ${b.border || 'rgba(0,0,0,0.08)'}` }}
            />
            <span className="text-[11px] text-gray-600">{b.label}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] font-bold mr-1" style={{ color: '#0F766E' }}>
          Pin · project score
        </span>
        {pinBuckets.map(b => (
          <div key={b.label} className="flex items-center gap-1.5">
            <svg width="14" height="14" className="shrink-0">
              <circle cx="7" cy="7" r="5.5" fill={b.color} fillOpacity="0.18" />
              <circle cx="7" cy="7" r="3" fill={b.color} fillOpacity="0.92" stroke="#FFFFFF" strokeWidth="1" />
            </svg>
            <span className="text-[11px] text-gray-600">{b.label}</span>
          </div>
        ))}
        <span className="text-[11px] text-gray-400 ml-1">· size = √MW</span>
      </div>
    </div>
  )
}
