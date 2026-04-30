import { motion } from 'motion/react'

/**
 * TractovaLoader — inline branded loading state.
 *
 * Mirrors the fullscreen LensOverlay's brand mark animations (scanline down
 * the T stem, survey tick marks pulsing in sequence, soft teal halo glow)
 * but sized for inline use (Library AI summary, embedded async cards, etc.).
 *
 * Usage: <TractovaLoader size={60} label="Generating portfolio insight…" />
 *
 * Note: the fullscreen overlay (Search.jsx LensOverlay) intentionally stays
 * separate -- different content, different progress treatment. This is the
 * inline twin so the brand reads consistently across loading surfaces.
 */
export default function TractovaLoader({ size = 60, label = null, sublabel = null, tone = 'light' }) {
  const dark = tone === 'dark'
  const bgColor = dark ? '#0F1A2E' : 'transparent'
  const textColor = dark ? '#5EEAD4' : '#0F766E'
  const subTextColor = dark ? 'rgba(255,255,255,0.55)' : '#5A6B7A'
  // Mark uses the original 26-unit viewBox so the exact proportions match Nav.jsx.
  return (
    <div className="flex flex-col items-center justify-center gap-3" style={{ background: bgColor }}>
      <motion.div
        animate={{
          filter: [
            'drop-shadow(0 0 8px rgba(20,184,166,0.30))',
            'drop-shadow(0 0 14px rgba(20,184,166,0.55))',
            'drop-shadow(0 0 8px rgba(20,184,166,0.30))',
          ],
        }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width={size} height={size} viewBox="0 0 26 26" fill="none">
          {/* Rounded navy mark — the Tractova "T" frame */}
          <rect width="26" height="26" rx="5" fill="#0F1A2E" />
          {/* Horizontal baseline */}
          <rect x="5" y="7" width="16" height="2.5" rx="1.25" fill="#14B8A6" />
          {/* Vertical stem (scanline travels through this column) */}
          <rect x="11.75" y="9.5" width="2.5" height="10" rx="1.25" fill="#14B8A6" />
          {/* Left survey tick — pulses 0->1 from 0% to 50% of the loop */}
          <motion.rect
            x="6" y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6"
            animate={{ opacity: [0.25, 1, 1, 0.25] }}
            transition={{ duration: 1.6, times: [0, 0.2, 0.5, 1], repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Right survey tick — pulses 0->1 from 50% to 80% of the loop */}
          <motion.rect
            x="19.2" y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6"
            animate={{ opacity: [0.25, 0.25, 1, 1, 0.25] }}
            transition={{ duration: 1.6, times: [0, 0.5, 0.65, 0.8, 1], repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Scanline crossing the stem — 2.4s loop */}
          <motion.rect
            x="9" width="8" height="0.6"
            fill="#5EEAD4"
            style={{ filter: 'drop-shadow(0 0 0.8px rgba(94,234,212,0.85))' }}
            animate={{ y: [9.4, 19, 9.4], opacity: [0, 0.95, 0] }}
            transition={{ duration: 2.4, times: [0, 0.5, 1], repeat: Infinity, ease: 'easeInOut' }}
          />
        </svg>
      </motion.div>
      {label && (
        <div className="flex flex-col items-center gap-0.5">
          <p
            className="font-mono text-[9px] uppercase font-bold m-0"
            style={{ color: textColor, letterSpacing: '0.22em' }}
          >
            {label}
          </p>
          {sublabel && (
            <p
              className="text-[10px] font-medium m-0"
              style={{ color: subTextColor }}
            >
              {sublabel}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
