import { createContext, useContext, useState, useCallback } from 'react'
import * as RadixToast from '@radix-ui/react-toast'
import { motion, AnimatePresence } from 'motion/react'

// Lightweight global toast context. Wrap app with <ToastProvider>, use
// useToast() anywhere to push a transient notification.
//
// Visual: navy chrome, teal accent rail (or amber/red for kinds),
// JetBrains Mono eyebrow + Source Serif 4 title + ink body. Same
// editorial language as the Lens analyst brief and weekly digest --
// reads as "this is product, not consumer chat."
const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const KIND_ACCENT = {
  success: '#14B8A6', // teal -- saved, completed
  info:    '#0F766E', // teal-700 -- general
  warn:    '#D97706', // amber
  error:   '#DC2626', // red
}

let _id = 0

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])

  const push = useCallback((toast) => {
    const id = ++_id
    setItems((s) => [...s, { id, kind: 'success', duration: 3000, ...toast }])
    return id
  }, [])

  const dismiss = useCallback((id) => {
    setItems((s) => s.filter((t) => t.id !== id))
  }, [])

  const value = { push, dismiss, success: (msg, opts) => push({ kind: 'success', title: msg, ...opts }), info: (msg, opts) => push({ kind: 'info', title: msg, ...opts }), warn: (msg, opts) => push({ kind: 'warn', title: msg, ...opts }), error: (msg, opts) => push({ kind: 'error', title: msg, ...opts }) }

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider swipeDirection="right" duration={3000}>
        {children}
        <AnimatePresence>
          {items.map((t) => (
            <RadixToast.Root
              key={t.id}
              duration={t.duration}
              onOpenChange={(open) => { if (!open) dismiss(t.id) }}
              asChild
              forceMount
            >
              <motion.div
                initial={{ opacity: 0, x: 24, scale: 0.96 }}
                animate={{ opacity: 1, x: 0,  scale: 1 }}
                exit={{    opacity: 0, x: 24, scale: 0.96 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="rounded-lg shadow-2xl overflow-hidden pointer-events-auto"
                style={{ background: '#0A1828', border: '1px solid rgba(20,184,166,0.20)', minWidth: 280, maxWidth: 380 }}
              >
                <div className="h-[2px]" style={{ background: KIND_ACCENT[t.kind] || KIND_ACCENT.info }} />
                <div className="px-4 py-3">
                  {t.eyebrow && (
                    <RadixToast.Title asChild>
                      <p className="font-mono text-[9px] uppercase tracking-[0.20em] mb-1" style={{ color: KIND_ACCENT[t.kind] || KIND_ACCENT.info, opacity: 0.9 }}>
                        {t.eyebrow}
                      </p>
                    </RadixToast.Title>
                  )}
                  <RadixToast.Title asChild>
                    <p className="font-serif text-sm font-semibold text-white leading-snug" style={{ letterSpacing: '-0.01em' }}>
                      {t.title}
                    </p>
                  </RadixToast.Title>
                  {t.description && (
                    <RadixToast.Description className="text-[12px] text-white/70 mt-1 leading-relaxed">
                      {t.description}
                    </RadixToast.Description>
                  )}
                </div>
              </motion.div>
            </RadixToast.Root>
          ))}
        </AnimatePresence>
        <RadixToast.Viewport className="fixed bottom-6 right-6 z-[1000] flex flex-col gap-2 outline-none pointer-events-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  )
}
