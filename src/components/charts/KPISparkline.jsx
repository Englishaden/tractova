import { useId } from 'react'
import { AreaChart, Area, ResponsiveContainer, YAxis, Tooltip } from 'recharts'

// KPISparkline — shared Recharts AreaChart wrapper for the MetricsBar cards
// on the revamped Dashboard. Pattern adapted from
// `Skills/Area Charts/Area Chart Interactive.md` (the linearGradient fill
// inside <defs> + Area type="natural" combo), but stripped to sparkline
// mode — no axes, no legend, no tooltip cursor, no card chrome.
//
// Render two modes via the `compact` prop:
//   compact=true  → ~32px tall, no Y-axis, no tooltip. Fits inside a card row.
//   compact=false → ~120px tall, gentle Y-axis, hover tooltip. Used when the
//                   card is expanded inline (disclosure-metric pattern).
//
// Color defaults to Tractova teal #14B8A6 with a 20% → 0% gradient fill.
// Caller can override via `color` for categorical use (e.g. amber for
// policy-volume sparkline).

export default function KPISparkline({
  data,                       // [{ week: 'YYYY-Www', value: number }, ...]
  color = '#14B8A6',
  height = 32,
  compact = true,
  ariaLabel,
}) {
  // useId gives a stable per-instance gradient id so multiple sparklines
  // on the same page don't collide on the SVG <defs> id.
  const gradId = useId().replace(/:/g, '')

  if (!Array.isArray(data) || data.length === 0) {
    // Caller already decides whether to render us (skip when no history);
    // this is a defensive fallback so we don't blow up on empty arrays.
    return (
      <div
        style={{ height, width: '100%' }}
        aria-label={ariaLabel || 'Sparkline (no data)'}
      />
    )
  }

  return (
    <div style={{ width: '100%', height }} aria-label={ariaLabel || 'Trend sparkline'}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`spark-fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {!compact && (
            <YAxis
              hide={false}
              tickLine={false}
              axisLine={false}
              width={28}
              tick={{ fill: 'var(--text-muted, #6C7A91)', fontSize: 9, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
            />
          )}
          {!compact && (
            <Tooltip
              cursor={{ stroke: 'var(--hairline-teal, rgba(20,184,166,0.45))', strokeWidth: 1 }}
              contentStyle={{
                background: 'var(--bg-surface, #182336)',
                border: '1px solid var(--cards-border, #1F2A3D)',
                borderRadius: 4,
                padding: '4px 8px',
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                fontSize: 10,
                color: 'var(--text-primary, #F5F7FA)',
              }}
              labelStyle={{ color: 'var(--text-label, #98A4B6)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em' }}
              formatter={(value) => [value, '']}
              separator=""
            />
          )}
          <Area
            type="natural"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-fill-${gradId})`}
            isAnimationActive={false}
            dot={false}
            activeDot={!compact ? { r: 3, fill: color, stroke: 'var(--cards-bg, #131C2C)', strokeWidth: 2 } : false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
