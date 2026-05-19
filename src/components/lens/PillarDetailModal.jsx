// PillarDetailModal — Bloomberg-class "research note" overlay that
// expands a §04 pillar summary into a centered fullscreen deep-dive.
// One mount covers all three pillars via a tab strip; analyst flow
// is to hop Offtake → IX → Site without closing the modal.
//
// Architecture (per 2026-05-19 design brief):
//   - Radix Dialog Portal + Overlay (navy backdrop + 4px blur, matches
//     existing ui/Dialog vocab).
//   - 88vw × 92vh centered panel with teal accent rail that flips color
//     to match the active tab (teal / amber / blue per Tractova pillar
//     palette).
//   - opacity 0→1 + scale 0.98→1 + y: 6→0 over 220ms with the Tractova
//     easing curve [0.16, 1, 0.3, 1]. Linear-class entrance — no
//     layoutId, no height-auto, no shared-element measurement.
//   - Lazy mount on first activation: each pillar body mounts on first
//     tab click and stays mounted (display:none toggling) so subsequent
//     tab switches don't recompute. Initial open cost = one tree.
//   - Body container has overflow-y: auto and min-height: 70vh so
//     dimensions don't pop when tab content has different heights.
//
// Accessibility:
//   - Radix focus trap free.
//   - Esc / outside-click / X-button all close.
//   - role=tablist + tab+tabpanel pattern on the tab strip.
//   - Left/right arrow keys cycle pillars when focus is on the tab strip.

import { useEffect, useRef, useState } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import OfftakeCard from '../OfftakeCard.jsx'
import InterconnectionCard from '../InterconnectionCard.jsx'
import SiteControlCard from '../SiteControlCard.jsx'

const PILLAR_TABS = [
  { key: 'offtake', label: '01 / Offtake',         accent: '#0F766E' },
  { key: 'ix',      label: '02 / Interconnection', accent: '#D97706' },
  { key: 'site',    label: '03 / Site Control',    accent: '#2563EB' },
]

export default function PillarDetailModal({ activePillar, onClose, onPillarChange, pillarProps = {} }) {
  const open = activePillar !== null && activePillar !== undefined
  const reduced = useReducedMotion()
  const tabStripRef = useRef(null)

  // Track which pillars have been mounted so tab switches don't trigger
  // remount (preserves computeBaseline + revenue-stack work). Set is
  // reset when the modal closes (Dialog portal unmounts → all bodies
  // unmount → next open re-lazies).
  const [mounted, setMounted] = useState({ offtake: false, ix: false, site: false })
  useEffect(() => {
    if (open && activePillar) {
      setMounted((prev) => prev[activePillar] ? prev : { ...prev, [activePillar]: true })
    }
    if (!open) {
      setMounted({ offtake: false, ix: false, site: false })
    }
  }, [open, activePillar])

  // Arrow-key navigation on the tab strip — left/right cycles pillars
  // when focus is inside the tablist. Doesn't interfere with the body
  // focus trap because Tab keys still move normally.
  function handleTabKeyDown(e) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const idx = PILLAR_TABS.findIndex(t => t.key === activePillar)
    if (idx < 0) return
    e.preventDefault()
    const next = e.key === 'ArrowRight'
      ? (idx + 1) % PILLAR_TABS.length
      : (idx - 1 + PILLAR_TABS.length) % PILLAR_TABS.length
    onPillarChange?.(PILLAR_TABS[next].key)
  }

  const activeTab = PILLAR_TABS.find(t => t.key === activePillar)
  const contextLine = pillarPropsContextLine(pillarProps)

  return (
    <RadixDialog.Root open={open} onOpenChange={(o) => { if (!o) onClose?.() }}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50"
                style={{ background: 'rgba(10,24,40,0.55)', backdropFilter: 'blur(4px)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild aria-describedby={undefined}>
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 pointer-events-none"
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 6 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <div
                  className="pointer-events-auto bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
                  style={{
                    width: 'min(88vw, 1200px)',
                    maxHeight: '92vh',
                    minHeight: '70vh',
                    border: '1px solid #E2E8F0',
                  }}
                >
                  {/* Top accent rail — color swaps with active pillar */}
                  <div className="h-[3px] shrink-0" style={{ background: activeTab?.accent || '#14B8A6' }} />

                  {/* Header — context line + tab strip + close button */}
                  <div
                    className="sticky top-0 z-10 bg-white shrink-0"
                    style={{ borderBottom: '1px solid #E2E8F0' }}
                  >
                    <div className="px-5 pt-3 pb-0 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <RadixDialog.Title asChild>
                          <p className="eyebrow-mono mb-0.5" style={{ color: '#5A6B7A' }}>
                            Pillar Detail
                          </p>
                        </RadixDialog.Title>
                        {contextLine && (
                          <p className="font-serif text-[15px] font-semibold text-ink leading-tight truncate">
                            {contextLine}
                          </p>
                        )}
                      </div>
                      <RadixDialog.Close asChild>
                        <button
                          type="button"
                          aria-label="Close pillar detail"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors shrink-0"
                          style={{ color: '#5A6B7A', border: '1px solid #E2E8F0' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#F9FAFB' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </RadixDialog.Close>
                    </div>

                    {/* Tab strip */}
                    <div
                      ref={tabStripRef}
                      role="tablist"
                      aria-orientation="horizontal"
                      onKeyDown={handleTabKeyDown}
                      className="flex items-center gap-0 px-5 pt-2"
                    >
                      {PILLAR_TABS.map((tab) => {
                        const active = tab.key === activePillar
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            tabIndex={active ? 0 : -1}
                            onClick={() => onPillarChange?.(tab.key)}
                            className="cursor-pointer font-mono uppercase tracking-[0.18em] text-[10px] px-3 py-2 -mb-px transition-colors"
                            style={{
                              color: active ? tab.accent : '#94A3B8',
                              fontWeight: active ? 700 : 500,
                              borderBottom: active ? `2px solid ${tab.accent}` : '2px solid transparent',
                            }}
                          >
                            {tab.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Body — lazy-mounted tab bodies, display:none switching */}
                  <div className="flex-1 overflow-y-auto bg-paper">
                    {mounted.offtake && (
                      <div role="tabpanel" hidden={activePillar !== 'offtake'} className="px-2 py-3">
                        <OfftakeCard
                          stateProgram={pillarProps.stateProgram}
                          revenueStack={pillarProps.revenueStack}
                          technology={pillarProps.technology}
                          mw={pillarProps.mw}
                          rates={pillarProps.rates}
                          energyCommunity={pillarProps.energyCommunity}
                          nmtcLic={pillarProps.nmtcLic}
                          hudQctDda={pillarProps.hudQctDda}
                          county={pillarProps.county}
                        />
                      </div>
                    )}
                    {mounted.ix && (
                      <div role="tabpanel" hidden={activePillar !== 'ix'} className="px-2 py-3">
                        <InterconnectionCard
                          interconnection={pillarProps.interconnection}
                          stateProgram={pillarProps.stateProgram}
                          stateId={pillarProps.stateId}
                          mw={pillarProps.mw}
                          queueSummary={pillarProps.queueSummary}
                        />
                      </div>
                    )}
                    {mounted.site && (
                      <div role="tabpanel" hidden={activePillar !== 'site'} className="px-2 py-3">
                        <SiteControlCard
                          siteControl={pillarProps.siteControl}
                          interconnection={pillarProps.interconnection}
                          geospatial={pillarProps.geospatial}
                          stateName={pillarProps.stateName}
                          county={pillarProps.county}
                          stateId={pillarProps.stateId}
                          mw={pillarProps.mw}
                          substations={pillarProps.substations}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  )
}

// Compose a one-line context header — e.g. "Norfolk County, MA · 5 MW AC ·
// Community Solar" — so the modal header always anchors which Lens result
// the user is drilling into.
function pillarPropsContextLine({ county, stateName, mw, technology }) {
  const parts = []
  if (county) parts.push(`${county} County`)
  if (stateName) parts.push(stateName)
  const head = parts.join(', ')
  const tail = []
  if (mw != null) {
    const mwNum = parseFloat(mw)
    if (Number.isFinite(mwNum)) tail.push(`${mwNum.toFixed(1)} MW AC`)
  }
  if (technology) tail.push(technology)
  return [head, ...tail].filter(Boolean).join(' · ')
}
