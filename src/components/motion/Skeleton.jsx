// Phase 0 — Branded skeleton loading states for layout-matched waits.
//
// Replaces the ad-hoc `bg-gray-100 animate-pulse` divs scattered across
// Library, Search, and Profile with components matched to the final
// rendered shape — so layout doesn't shift on data arrival. Slower
// shimmer + lower contrast than the default Tailwind animate-pulse so
// it reads as "research-grade loading" rather than "generic web app."
//
// Honors prefers-reduced-motion by static-rendering the placeholder
// without the shimmer keyframe.

import { useReducedMotion } from 'motion/react'

function shimmerClass(reduced) {
  return reduced
    ? 'bg-slate-100'
    : 'bg-slate-100 animate-[skeleton-shimmer_1.6s_ease-in-out_infinite]'
}

// SkeletonCard — matches OfftakeCard / InterconnectionCard / SiteControlCard
// outer shape (white rounded card with colored top accent rail).
export function SkeletonCard({ accent = '#94A3B8', height = 280, className = '' }) {
  const reduced = useReducedMotion()
  return (
    <div className={`relative bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`} style={{ minHeight: height }}>
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: accent, opacity: 0.4 }} />
      <div className="p-5 space-y-3">
        <div className={`h-2 w-24 rounded ${shimmerClass(reduced)}`} />
        <div className={`h-5 w-3/4 rounded ${shimmerClass(reduced)}`} />
        <div className={`h-3 w-1/2 rounded ${shimmerClass(reduced)}`} />
        <div className="pt-3 space-y-2">
          <div className={`h-3 w-full rounded ${shimmerClass(reduced)}`} />
          <div className={`h-3 w-5/6 rounded ${shimmerClass(reduced)}`} />
          <div className={`h-3 w-2/3 rounded ${shimmerClass(reduced)}`} />
        </div>
      </div>
    </div>
  )
}

// SkeletonRow — matches a table row, single horizontal line of cells.
// Use in Phase 2A's ProjectTable as the per-row loading state.
export function SkeletonRow({ cols = 5, className = '' }) {
  const reduced = useReducedMotion()
  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 ${className}`}>
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded ${shimmerClass(reduced)}`}
          style={{ width: i === 0 ? '32%' : i === 1 ? '20%' : '14%' }}
        />
      ))}
    </div>
  )
}

// SkeletonGauge — matches the ArcGauge circular shape so the Lens
// composite score doesn't jump when it loads.
export function SkeletonGauge({ size = 120, className = '' }) {
  const reduced = useReducedMotion()
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <div
        className={`absolute inset-0 rounded-full ${shimmerClass(reduced)}`}
        style={{ borderWidth: 8, borderStyle: 'solid', borderColor: '#E2E8F0', background: 'transparent' }}
      />
      <div className={`relative z-10 h-6 w-10 rounded ${shimmerClass(reduced)}`} />
    </div>
  )
}

// SkeletonText — generic n-line skeleton for prose blocks.
export function SkeletonText({ lines = 3, className = '' }) {
  const reduced = useReducedMotion()
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 rounded ${shimmerClass(reduced)}`}
          style={{ width: i === lines - 1 ? '70%' : '100%' }}
        />
      ))}
    </div>
  )
}
