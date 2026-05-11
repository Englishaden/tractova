import * as RadixDialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import ProjectCard from '../ProjectCard.jsx'

// Phase 2B · TRACTOVA-UX-001 — ProjectDrawer.
//
// Right-side slide-in panel triggered when the user clicks a pin in
// LibraryMap. Renders ProjectCard with defaultExpanded so the user
// lands on full project detail in one click (mirrors the same
// one-click-to-full convention as the Table view's row expansion).
//
// Built on Radix Dialog for the right accessibility primitives:
//   - Focus trap inside the panel
//   - Esc closes
//   - Outside-click closes
//   - Title + Description hooks for screen readers
//
// Motion: 220ms slide from the right with the standard Phase 0 entrance
// curve [0.16, 1, 0.3, 1]. Honors prefers-reduced-motion via Radix +
// motion's useReducedMotion (which we also use in MotionPrimitives.jsx).

export default function ProjectDrawer({
  project,
  open,
  onOpenChange,
  stateProgramMap,
  countyDataMap,
  stateDeltaMap,
  scenariosMap,
  shareCountMap,
  selectedIds,
  onToggleSelect,
  onStageChange,
  onRequestRemove,
  onShareSuccess,
  onScenarioDelete,
}) {
  const reduced = useReducedMotion()

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50"
                style={{ background: 'rgba(10,24,40,0.45)', backdropFilter: 'blur(3px)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
              />
            </RadixDialog.Overlay>
            <RadixDialog.Content asChild aria-describedby={undefined}>
              <motion.div
                className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[480px] bg-paper shadow-2xl overflow-y-auto"
                style={{ borderLeft: '1px solid #E2E8F0' }}
                initial={reduced ? { opacity: 0 } : { x: '100%' }}
                animate={reduced ? { opacity: 1 } : { x: 0 }}
                exit={reduced ? { opacity: 0 } : { x: '100%' }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                {/* Header — eyebrow + close button. Project name lives
                    inside the ProjectCard, so the drawer header is a
                    small frame, not a competing title. */}
                <div
                  className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 bg-paper"
                  style={{ borderBottom: '1px solid #E2E8F0' }}
                >
                  <div>
                    <RadixDialog.Title asChild>
                      <span className="eyebrow-mono" style={{ color: '#5A6B7A' }}>
                        Project Detail
                      </span>
                    </RadixDialog.Title>
                    {project && (
                      <p className="font-serif text-sm font-semibold text-ink leading-tight mt-0.5 truncate">
                        {project.name}
                      </p>
                    )}
                  </div>
                  <RadixDialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close project detail"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors"
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

                {/* Body — ProjectCard with defaultExpanded so the user
                    lands on full detail without an extra click. */}
                <div className="px-3 py-3">
                  {project ? (
                    <ProjectCard
                      project={project}
                      defaultExpanded
                      onRequestRemove={(id, name) => { onRequestRemove?.(id, name); onOpenChange(false) }}
                      onStageChange={onStageChange}
                      stateProgramMap={stateProgramMap}
                      countyDataMap={countyDataMap}
                      stateDelta={stateDeltaMap?.get?.(project.state) || null}
                      shareCount={shareCountMap?.[project.id] || 0}
                      onShareSuccess={() => onShareSuccess?.(project.id)}
                      selected={selectedIds?.has(project.id) || false}
                      onToggleSelect={() => onToggleSelect?.(project.id)}
                      selectionActive={selectedIds && selectedIds.size > 0}
                      scenarios={scenariosMap?.[project.id] || []}
                      onScenarioDelete={(snapId) => onScenarioDelete?.(project.id, snapId)}
                    />
                  ) : (
                    <p className="text-xs text-ink-muted text-center py-6">No project selected.</p>
                  )}
                </div>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        )}
      </AnimatePresence>
    </RadixDialog.Root>
  )
}
