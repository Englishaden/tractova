import { useState, useRef, useEffect } from 'react'
import { ComposableMap, Geographies, Geography } from 'react-simple-maps'
import { stateById } from '../data/statePrograms'
import { getCountyData, revenueStackByState } from '../data/countyData'
import allCounties from '../data/allCounties.json'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'

const FIPS = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT",
  "10":"DE","11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL",
  "18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME","24":"MD",
  "25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE",
  "32":"NV","33":"NH","34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND",
  "39":"OH","40":"OK","41":"OR","42":"PA","44":"RI","45":"SC","46":"SD",
  "47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV",
  "55":"WI","56":"WY",
}

function ResultsStateMap({ stateId, stateName, csStatus, opportunityScore }) {
  const statusConfig = {
    active:  { label: 'Active Program',   dot: '#0F6E56' },
    limited: { label: 'Limited Capacity', dot: '#BA7517' },
    pending: { label: 'Pending Launch',   dot: '#FBBF24' },
    none:    { label: 'No Program',       dot: '#9CA3AF' },
  }
  const cfg = statusConfig[csStatus] || statusConfig.none

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-stretch">
        {/* Map column */}
        <div className="flex-1 min-w-0">
          <ComposableMap
            projection="geoAlbersUsa"
            projectionConfig={{ scale: 900 }}
            style={{ width: '100%', height: '180px', display: 'block' }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const fips = String(geo.id).padStart(2, '0')
                  const geoStateId = FIPS[fips]
                  const isTarget = geoStateId === stateId
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isTarget ? '#0F6E56' : '#E5E7EB'}
                      stroke="#FFFFFF"
                      strokeWidth={0.75}
                      style={{
                        default: { outline: 'none' },
                        hover:   { outline: 'none', fill: isTarget ? '#0F6E56' : '#E5E7EB' },
                        pressed: { outline: 'none' },
                      }}
                    />
                  )
                })
              }
            </Geographies>
          </ComposableMap>
        </div>

        {/* Divider */}
        <div className="w-px bg-gray-100 flex-shrink-0" />

        {/* Info column */}
        <div className="w-52 flex-shrink-0 flex flex-col justify-center px-5 py-4 gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Target State</p>
            <p className="text-lg font-bold text-gray-900 leading-tight">{stateName}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
              <span className="text-xs text-gray-700 font-medium">{cfg.label}</span>
            </div>
            {opportunityScore > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">Opportunity score</span>
                  <span className="text-xs font-bold text-gray-700">{opportunityScore}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${opportunityScore}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: '#0F6E56' }} />
            <span className="text-xs text-gray-400">= {stateName}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ALL_STATES = [
  { id: 'AL', name: 'Alabama' }, { id: 'AK', name: 'Alaska' },
  { id: 'AZ', name: 'Arizona' }, { id: 'AR', name: 'Arkansas' },
  { id: 'CA', name: 'California' }, { id: 'CO', name: 'Colorado' },
  { id: 'CT', name: 'Connecticut' }, { id: 'DE', name: 'Delaware' },
  { id: 'FL', name: 'Florida' }, { id: 'GA', name: 'Georgia' },
  { id: 'HI', name: 'Hawaii' }, { id: 'ID', name: 'Idaho' },
  { id: 'IL', name: 'Illinois' }, { id: 'IN', name: 'Indiana' },
  { id: 'IA', name: 'Iowa' }, { id: 'KS', name: 'Kansas' },
  { id: 'KY', name: 'Kentucky' }, { id: 'LA', name: 'Louisiana' },
  { id: 'ME', name: 'Maine' }, { id: 'MD', name: 'Maryland' },
  { id: 'MA', name: 'Massachusetts' }, { id: 'MI', name: 'Michigan' },
  { id: 'MN', name: 'Minnesota' }, { id: 'MS', name: 'Mississippi' },
  { id: 'MO', name: 'Missouri' }, { id: 'MT', name: 'Montana' },
  { id: 'NE', name: 'Nebraska' }, { id: 'NV', name: 'Nevada' },
  { id: 'NH', name: 'New Hampshire' }, { id: 'NJ', name: 'New Jersey' },
  { id: 'NM', name: 'New Mexico' }, { id: 'NY', name: 'New York' },
  { id: 'NC', name: 'North Carolina' }, { id: 'ND', name: 'North Dakota' },
  { id: 'OH', name: 'Ohio' }, { id: 'OK', name: 'Oklahoma' },
  { id: 'OR', name: 'Oregon' }, { id: 'PA', name: 'Pennsylvania' },
  { id: 'RI', name: 'Rhode Island' }, { id: 'SC', name: 'South Carolina' },
  { id: 'SD', name: 'South Dakota' }, { id: 'TN', name: 'Tennessee' },
  { id: 'TX', name: 'Texas' }, { id: 'UT', name: 'Utah' },
  { id: 'VT', name: 'Vermont' }, { id: 'VA', name: 'Virginia' },
  { id: 'WA', name: 'Washington' }, { id: 'WV', name: 'West Virginia' },
  { id: 'WI', name: 'Wisconsin' }, { id: 'WY', name: 'Wyoming' },
]

const STAGES = ['Prospecting', 'Site Control', 'Pre-Development', 'Development', 'NTP (Notice to Proceed)', 'Construction', 'Operational']
const TECHNOLOGIES = ['Community Solar', 'C&I Solar', 'BESS', 'Hybrid']

// ─────────────────────────────────────────────────────────────────────────────
// Small UI helpers
// ─────────────────────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{children}</p>
  )
}

function DataRow({ label, value, highlight, valueClass }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className={`text-xs font-semibold text-right ${valueClass || (highlight ? 'text-primary' : 'text-gray-800')}`}>
        {value}
      </span>
    </div>
  )
}

function EaseScoreMeter({ score }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-gray-400 italic">Not available</span>
  }
  const pct = score * 10
  let color = 'bg-red-400'
  if (score >= 7) color = 'bg-primary'
  else if (score >= 5) color = 'bg-yellow-400'
  else if (score >= 3) color = 'bg-orange-400'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-10 text-right">{score} / 10</span>
    </div>
  )
}

function QueueBadge({ statusCode }) {
  const map = {
    open:      { label: 'Open', cls: 'bg-primary-50 text-primary-700 border-primary-200' },
    limited:   { label: 'Limited', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    saturated: { label: 'Saturated', cls: 'bg-red-50 text-red-700 border-red-200' },
    unknown:   { label: 'Unknown', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  }
  const cfg = map[statusCode] || map.unknown
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function CSStatusBadge({ csStatus }) {
  const map = {
    active:  { label: 'Active Program', cls: 'bg-primary-50 text-primary-700 border-primary-200' },
    limited: { label: 'Limited Capacity', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    pending: { label: 'Pending Launch', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    none:    { label: 'No Program', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  }
  const cfg = map[csStatus] || map.none
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function PillarIcon({ type }) {
  if (type === 'site') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  )
  if (type === 'ix') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
  if (type === 'offtake') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  )
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Pillar Cards
// ─────────────────────────────────────────────────────────────────────────────
function SiteControlCard({ siteControl, stateName, county }) {
  const { availableLand, landNotes, wetlandWarning, wetlandNotes, landUseNotes } = siteControl

  return (
    <div className="bg-white border border-gray-200 rounded-lg flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-primary-50 flex items-center justify-center text-primary">
          <PillarIcon type="site" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Site Control</h3>
          <p className="text-xs text-gray-400">{county} County, {stateName}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4 flex-1">
        {/* Land availability flag */}
        <div>
          <SectionLabel>Land Availability</SectionLabel>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
            availableLand
              ? 'bg-primary-50 text-primary-700'
              : 'bg-red-50 text-red-700'
          }`}>
            {availableLand ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Land parcels available in this county
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Limited land availability — see notes
              </>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">{landNotes}</p>
        </div>

        {/* Wetland warning */}
        <div>
          <SectionLabel>Wetland Risk</SectionLabel>
          {wetlandWarning ? (
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold mb-1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Wetland warning — NWI review required
              </div>
              {wetlandNotes && <p className="text-xs text-amber-700 leading-relaxed">{wetlandNotes}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-primary-50 text-primary-700 text-xs font-medium px-3 py-2 rounded-md">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Low wetland risk on typical upland sites
            </div>
          )}
        </div>

        {/* Land use notes */}
        <div>
          <SectionLabel>Zoning & Land Use</SectionLabel>
          <p className="text-xs text-gray-600 leading-relaxed bg-surface rounded-md px-3 py-2">{landUseNotes}</p>
        </div>
      </div>
    </div>
  )
}

function InterconnectionCard({ interconnection, stateProgram }) {
  const { servingUtility, queueStatus, queueStatusCode, easeScore, avgStudyTimeline, queueNotes } = interconnection

  return (
    <div className="bg-white border border-gray-200 rounded-lg flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-primary-50 flex items-center justify-center text-primary">
          <PillarIcon type="ix" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Interconnection</h3>
          <p className="text-xs text-gray-400">Queue status & utility conditions</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4 flex-1">
        {/* Utility + queue */}
        <div>
          <SectionLabel>Serving Utility</SectionLabel>
          <div className="bg-surface rounded-md px-3 py-2 space-y-0.5">
            <DataRow label="Utility" value={servingUtility} />
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-xs text-gray-500">Queue status</span>
              <QueueBadge statusCode={queueStatusCode} />
            </div>
            <DataRow label="Avg study timeline" value={avgStudyTimeline} />
          </div>
        </div>

        {/* Ease score */}
        <div>
          <SectionLabel>Ease Score</SectionLabel>
          <div className="bg-surface rounded-md px-3 py-2">
            <EaseScoreMeter score={easeScore} />
            <p className="text-xs text-gray-400 mt-1.5">
              {easeScore >= 7 ? 'Strong interconnection conditions for this county.'
               : easeScore >= 5 ? 'Moderate difficulty — budget for potential upgrade costs.'
               : easeScore >= 3 ? 'Challenging territory — high upgrade costs likely.'
               : easeScore !== null ? 'Extremely difficult — avoid unless project economics are strong.'
               : 'Score not available for this county.'}
            </p>
          </div>
        </div>

        {/* Queue notes */}
        <div>
          <SectionLabel>Queue Intelligence</SectionLabel>
          <p className="text-xs text-gray-600 leading-relaxed bg-surface rounded-md px-3 py-2">{queueNotes}</p>
        </div>

        {/* State-level IX note */}
        {stateProgram?.ixNotes && (
          <div>
            <SectionLabel>State-Level IX Context</SectionLabel>
            <p className="text-xs text-gray-500 leading-relaxed">{stateProgram.ixNotes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function OfftakeCard({ stateProgram, revenueStack, technology, mw }) {
  const hasProgram = stateProgram && stateProgram.csStatus !== 'none'
  const showCSWarning = technology === 'BESS' || technology === 'C&I Solar'

  return (
    <div className="bg-white border border-gray-200 rounded-lg flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-md bg-primary-50 flex items-center justify-center text-primary">
          <PillarIcon type="offtake" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Offtake</h3>
          <p className="text-xs text-gray-400">Program status & revenue stack</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4 flex-1">
        {/* CS program status */}
        <div>
          <SectionLabel>Community Solar Program</SectionLabel>
          {hasProgram ? (
            <div className="bg-surface rounded-md px-3 py-2 space-y-0.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                <span className="text-xs text-gray-500">Program</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-800 text-right max-w-[180px] leading-tight">{stateProgram.csProgram}</span>
                  <CSStatusBadge csStatus={stateProgram.csStatus} />
                </div>
              </div>
              <DataRow
                label="Capacity remaining"
                value={stateProgram.capacityMW > 0 ? `${stateProgram.capacityMW.toLocaleString()} MW` : 'TBD'}
                highlight
              />
              <DataRow
                label="LMI allocation required"
                value={stateProgram.lmiRequired ? `Yes — ${stateProgram.lmiPercent}%` : 'No'}
              />
              {mw && stateProgram.capacityMW > 0 && (
                <DataRow
                  label="Project share of remaining"
                  value={`${((parseFloat(mw) / stateProgram.capacityMW) * 100).toFixed(1)}%`}
                />
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-md px-3 py-3">
              <p className="text-xs font-medium text-gray-600">No active community solar program in this state.</p>
              {stateProgram?.programNotes && (
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{stateProgram.programNotes}</p>
              )}
            </div>
          )}
        </div>

        {/* Technology note */}
        {showCSWarning && technology === 'BESS' && (
          <div className="flex items-start gap-2 bg-accent-50 border border-accent-200 rounded-md px-3 py-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p className="text-xs text-accent-700">BESS offtake depends on contracted capacity market revenue, not CS bill credits. CS program data shown is for context only.</p>
          </div>
        )}

        {/* Revenue stack */}
        {revenueStack ? (
          <div>
            <SectionLabel>Revenue Stack</SectionLabel>
            <div className="bg-surface rounded-md px-3 py-2 space-y-0.5">
              <DataRow label="ITC base" value={revenueStack.itcBase} highlight />
              <DataRow label="ITC adders" value={revenueStack.itcAdder} />
              <DataRow label="REC / I-REC market" value={revenueStack.irecMarket} />
              <DataRow label="Net metering / credit" value={revenueStack.netMeteringStatus} />
            </div>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed px-1">{revenueStack.summary}</p>
          </div>
        ) : (
          <div>
            <SectionLabel>Revenue Stack</SectionLabel>
            <p className="text-xs text-gray-400 italic">Revenue stack summary not yet seeded for this state. Check DSIRE (dsireusa.org) for incentive details.</p>
          </div>
        )}

        {/* Program notes */}
        {hasProgram && stateProgram.programNotes && (
          <div>
            <SectionLabel>Developer Notes</SectionLabel>
            <p className="text-xs text-gray-600 leading-relaxed">{stateProgram.programNotes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared style constant (used by CountyCombobox + Search form)
// ─────────────────────────────────────────────────────────────────────────────
const inputCls = "w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors appearance-none"

// ─────────────────────────────────────────────────────────────────────────────
// Searchable county combobox
// ─────────────────────────────────────────────────────────────────────────────
function CountyCombobox({ stateId, value, onValueChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const containerRef = useRef(null)

  // allCounties keys are state abbreviations → string[]
  const counties = allCounties[stateId] || []

  // Keep query in sync when parent resets value (e.g. state change)
  useEffect(() => { setQuery(value) }, [value])

  // Close on outside click
  useEffect(() => {
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const filtered = counties.filter(name =>
    name.toLowerCase().includes(query.toLowerCase())
  )

  const handleInput = (e) => {
    setQuery(e.target.value)
    onValueChange(e.target.value)
    if (!open) setOpen(true)
  }

  const handleSelect = (name) => {
    setQuery(name)
    onValueChange(name)
    setOpen(false)
  }

  const disabled = !stateId
  const placeholder = disabled ? 'Select a state first' : 'Search counties…'

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        required
        className={inputCls + (disabled ? ' opacity-50 cursor-not-allowed bg-gray-50' : '')}
      />
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      {open && stateId && (
        <ul className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {filtered.length > 0 ? filtered.map(name => (
            <li
              key={name}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(name) }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-primary-50 hover:text-primary ${
                value === name ? 'bg-primary-50 text-primary font-medium' : 'text-gray-800'
              }`}
            >
              {name}
            </li>
          )) : (
            <li className="px-3 py-2 text-xs text-gray-400 italic">No matching county</li>
          )}
        </ul>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Save confirmation toast
// ─────────────────────────────────────────────────────────────────────────────
function SaveToast({ visible }) {
  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
      <div className="flex items-center gap-2.5 bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-lg shadow-lg">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34B08A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Project saved to My Projects
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Search component
// ─────────────────────────────────────────────────────────────────────────────
export default function Search() {
  const [form, setForm] = useState({
    state: '',
    county: '',
    mw: '',
    stage: '',
    technology: '',
  })
  const [results, setResults] = useState(null)
  const [showToast, setShowToast] = useState(false)
  const [saveModal, setSaveModal] = useState(null) // { defaultName } | null
  const [saveName, setSaveName] = useState('')
  const resultsRef = useRef(null)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const stateProgram = stateById[form.state] || null
    const countyData   = getCountyData(form.state, form.county)
    const revenueStack = revenueStackByState[form.state] || null

    setResults({
      form: { ...form },
      stateProgram,
      countyData,
      revenueStack,
    })

    // Scroll to results
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  }

  const handleSave = () => {
    if (!results) return
    const defaultName = `${results.form.county} ${results.form.mw}MW ${results.form.technology}`
    setSaveName(defaultName)
    setSaveModal({ defaultName })
  }

  const handleSaveConfirm = () => {
    if (!results) return
    const projects = JSON.parse(localStorage.getItem('tractova_projects') || '[]')
    const project = {
      id: Date.now(),
      name: saveName.trim() || `${results.form.county} ${results.form.mw}MW ${results.form.technology}`,
      state: results.form.state,
      stateName: results.stateProgram?.name || results.form.state,
      county: results.form.county,
      mw: results.form.mw,
      stage: results.form.stage,
      technology: results.form.technology,
      savedAt: new Date().toISOString(),
      csProgram: results.stateProgram?.csProgram || null,
      csStatus: results.stateProgram?.csStatus || 'none',
      servingUtility: results.countyData?.interconnection?.servingUtility || null,
      opportunityScore: results.stateProgram?.opportunityScore || null,
    }
    projects.unshift(project)
    localStorage.setItem('tractova_projects', JSON.stringify(projects))
    setSaveModal(null)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const isFormValid = form.state && form.county.trim() && form.mw && form.stage && form.technology

  const labelCls = "block text-[10px] font-semibold uppercase tracking-wider text-primary-700 mb-1.5"

  return (
    <div className="min-h-screen bg-surface">
      <main className="max-w-dashboard mx-auto px-6 pt-20 pb-16">

        {/* Page header */}
        <div className="mt-4 mb-5">
          <h1 className="text-xl font-bold text-gray-900">Tractova Lens</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Enter a specific project to get targeted site control, interconnection, and offtake intelligence.
          </p>
        </div>

        {/* Search form */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl overflow-hidden shadow-sm border border-gray-200/80"
          style={{ boxShadow: '0 2px 12px rgba(15,110,86,0.07), 0 1px 3px rgba(0,0,0,0.06)' }}
        >
          {/* Form header band */}
          <div
            className="px-6 py-4 flex items-center gap-4"
            style={{ background: 'linear-gradient(135deg, #0A5240 0%, #063629 100%)' }}
          >
            {/* Top accent line */}
            <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-primary-400/40 via-primary-300/60 to-primary-400/40 pointer-events-none" />

            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.10)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60 leading-none mb-1">
                Project Intelligence Search
              </p>
              <p className="text-sm font-bold text-white leading-snug">
                Enter project parameters below to run a targeted Lens analysis
              </p>
            </div>

            {/* Required field hint */}
            <p className="text-[10px] text-white/40 flex-shrink-0 hidden lg:block">All fields required</p>
          </div>

          {/* Fields */}
          <div className="bg-white px-6 pt-5 pb-1">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">

              {/* State */}
              <div>
                <label className={labelCls}>State</label>
                <div className="relative">
                  <select
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value, county: '' }))}
                    required
                    className={inputCls + ' pr-8'}
                  >
                    <option value="">Select state…</option>
                    {ALL_STATES.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>

              {/* County */}
              <div>
                <label className={labelCls}>County</label>
                <CountyCombobox
                  stateId={form.state}
                  value={form.county}
                  onValueChange={(val) => setForm((f) => ({ ...f, county: val }))}
                />
              </div>

              {/* MW */}
              <div>
                <label className={labelCls}>Project Size (MW AC)</label>
                <input
                  type="number"
                  value={form.mw}
                  onChange={set('mw')}
                  placeholder="e.g. 5"
                  min="0.1"
                  step="0.1"
                  required
                  className={inputCls}
                />
              </div>

              {/* Development stage */}
              <div>
                <label className={labelCls}>Development Stage</label>
                <div className="relative">
                  <select value={form.stage} onChange={set('stage')} required className={inputCls + ' pr-8'}>
                    <option value="">Select stage…</option>
                    {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>

              {/* Technology */}
              <div>
                <label className={labelCls}>Technology Type</label>
                <div className="relative">
                  <select value={form.technology} onChange={set('technology')} required className={inputCls + ' pr-8'}>
                    <option value="">Select type…</option>
                    {TECHNOLOGIES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </div>
            </div>
          </div>

          {/* Submit row */}
          <div className="bg-white px-6 py-4 border-t border-gray-100 flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400 hidden sm:block">
              Intelligence is generated from seeded state + county data — verify with your utility and PUC before committing capital.
            </p>
            <button
              type="submit"
              disabled={!isFormValid}
              className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Run Lens Analysis
            </button>
          </div>
        </form>

        {/* Results panel */}
        {results && (
          <div ref={resultsRef} className="mt-8">
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {results.form.county} County, {results.stateProgram?.name || results.form.state}
                  <span className="text-gray-400 font-normal mx-2">·</span>
                  <span className="text-gray-600">{results.form.mw} MW AC</span>
                  <span className="text-gray-400 font-normal mx-2">·</span>
                  <span className="text-gray-600">{results.form.technology}</span>
                  <span className="text-gray-400 font-normal mx-2">·</span>
                  <span className="text-gray-600">{results.form.stage}</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Intelligence as of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  {results.stateProgram?.lastUpdated && ` · Data last updated ${new Date(results.stateProgram.lastUpdated + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                </p>
              </div>

              {/* Save as Project */}
              <button
                onClick={handleSave}
                className="flex items-center gap-2 bg-white border border-gray-200 text-sm font-medium text-gray-700 px-4 py-2 rounded-lg hover:border-primary hover:text-primary transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Save as Project
              </button>
            </div>

            {/* State context map */}
            <div className="mb-5">
              <ResultsStateMap
                stateId={results.form.state}
                stateName={results.stateProgram?.name || results.form.state}
                csStatus={results.stateProgram?.csStatus || 'none'}
                opportunityScore={results.stateProgram?.opportunityScore || 0}
              />
            </div>

            {/* Three pillar cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <SiteControlCard
                siteControl={results.countyData.siteControl}
                stateName={results.stateProgram?.name || results.form.state}
                county={results.form.county}
              />
              <InterconnectionCard
                interconnection={results.countyData.interconnection}
                stateProgram={results.stateProgram}
              />
              <OfftakeCard
                stateProgram={results.stateProgram}
                revenueStack={results.revenueStack}
                technology={results.form.technology}
                mw={results.form.mw}
              />
            </div>

            {/* Bottom CTA / disclaimer */}
            <div className="mt-5 flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-5 py-4">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#BA7517" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-700">Tractova intelligence is a research accelerator, not a substitute for site-specific due diligence.</span>{' '}
                Verify interconnection conditions with the serving utility, confirm wetland boundaries with a site survey, and validate program capacity with your state PUC before committing capital.
                Data is updated regularly but may not reflect the latest queue changes.
              </p>
            </div>
          </div>
        )}
      </main>

      <SaveToast visible={showToast} />

      {/* Save naming modal */}
      {saveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSaveModal(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Name this project</h3>
            <p className="text-xs text-gray-400 mb-4">You can edit the name before saving.</p>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveConfirm() }}
              autoFocus
              className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors mb-4"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSaveModal(null)}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfirm}
                disabled={!saveName.trim()}
                className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Save Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
