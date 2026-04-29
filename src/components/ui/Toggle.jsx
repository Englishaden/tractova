/**
 * V3 Toggle — accessible binary switch.
 *
 *   <Toggle on={prefs.digest} onChange={(next) => toggle('digest')} ariaLabel="Weekly digest" />
 *
 * Inline styles (rather than Tailwind arbitrary values) guarantee the dot
 * geometry regardless of JIT state -- some configs missed
 * `translate-x-[18px]` and the dot would clip the track edge.
 *
 * Geometry: 44 × 24 track, 18 × 18 dot, 3px gutter on both sides in both
 * states.
 */
import React from 'react'

export default function Toggle({ on, onChange, onClick, disabled = false, ariaLabel, size = 'md' }) {
  const dims =
    size === 'sm'
      ? { w: 36, h: 20, dot: 14, gutter: 3, onLeft: 19 }
      : { w: 44, h: 24, dot: 18, gutter: 3, onLeft: 23 }

  const handle = (e) => {
    if (disabled) return
    if (typeof onChange === 'function') onChange(!on, e)
    if (typeof onClick === 'function') onClick(e)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={handle}
      disabled={disabled}
      style={{
        position: 'relative',
        width: `${dims.w}px`,
        height: `${dims.h}px`,
        borderRadius: 9999,
        transition: 'background-color 150ms ease',
        backgroundColor: on ? '#14B8A6' : '#E2E8F0',
        flexShrink: 0,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: `${dims.gutter}px`,
          left: on ? `${dims.onLeft}px` : `${dims.gutter}px`,
          width: `${dims.dot}px`,
          height: `${dims.dot}px`,
          borderRadius: 9999,
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.10)',
          transition: 'left 150ms ease',
          display: 'block',
        }}
      />
    </button>
  )
}
