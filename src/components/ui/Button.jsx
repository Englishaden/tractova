/**
 * V3 Button — shared brand-aligned button component.
 *
 * Variants:
 *   - primary  (default) : navy chrome, white text -- premium CTA
 *   - accent             : teal, white text -- standard CTA
 *   - ghost              : white bg, ink text, hairline border -- secondary
 *   - link               : no chrome, teal text -- inline action
 *
 * Sizes: sm (padding 1.5/3, text-xs) · md (default, py-2 px-4 text-sm) · lg (py-3 px-6).
 *
 * Use this for any new surface. Existing legacy buttons stay until naturally
 * touched -- don't bulk-rewrite. The point is forward consistency, not churn.
 */
import React from 'react'

const SIZE = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-sm',
}

const VARIANT = {
  primary: {
    base: 'text-white border',
    style: { background: '#0F1A2E', borderColor: '#0F1A2E' },
    hoverStyle: { background: '#0A132A', borderColor: '#0A132A' },
  },
  accent: {
    base: 'text-white border',
    style: { background: '#14B8A6', borderColor: '#14B8A6', boxShadow: '0 4px 12px rgba(20,184,166,0.20)' },
    hoverStyle: { background: '#0F766E', borderColor: '#0F766E' },
  },
  ghost: {
    base: 'text-ink border bg-white',
    style: { borderColor: '#E2E8F0' },
    hoverStyle: { borderColor: '#14B8A6', color: '#0F766E' },
  },
  link: {
    base: 'border-0 bg-transparent',
    style: { color: '#0F766E' },
    hoverStyle: { color: '#0A1828' },
  },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  children,
  disabled,
  loading,
  onClick,
  ...rest
}) {
  const v = VARIANT[variant] || VARIANT.primary
  const [isHover, setIsHover] = React.useState(false)
  const style = isHover && !disabled && !loading ? { ...v.style, ...v.hoverStyle } : v.style

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${SIZE[size] || SIZE.md} ${v.base} ${className}`}
      style={style}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
      {...rest}
    >
      {loading && (
        <span
          className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
}
