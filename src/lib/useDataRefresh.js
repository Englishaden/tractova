import { useEffect, useState } from 'react'

// Shared "data refreshed" signal — single source across Footer / Dashboard /
// Library. Reads max(cron_runs.finished_at WHERE status='success') via the
// public /api/data-health?action=last-refresh endpoint.
//
// Why a hook (not three copies of the fetch): the signal must update across the
// platform the moment data refreshes — not only on a hard reload. So this:
//   - fetches with cache:'no-store' (the endpoint also sends no-store) so a
//     fresh value lands on every mount — no CDN/browser staleness window;
//   - re-fetches on the `tractova-cache` BroadcastChannel `invalidate` message
//     that the admin Refresh flow posts (invalidateCacheEverywhere), so every
//     open surface updates the instant a refresh completes — even tabs left
//     open in the background;
//   - re-fetches on window focus + a 5-min poll so a long-open tab self-heals;
//   - ticks every 30s so relative labels ("5m ago") keep aging without a fetch.
//
// Returns the raw ISO string (or null). Each surface formats it itself — the
// stale thresholds and label styles differ per surface (Footer: relative;
// Dashboard/Library: absolute date + age).
export function useDataRefresh() {
  const [finishedAt, setFinishedAt] = useState(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    // Vite's dev server doesn't run api/ functions, so skip the fetch in dev
    // to avoid noisy failures. In a real production build PROD is true, so the
    // signal fetches on prod as intended.
    if (!import.meta.env.PROD) return
    let cancelled = false

    const refetch = () => {
      fetch('/api/data-health?action=last-refresh', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!cancelled && d?.finishedAt) setFinishedAt(d.finishedAt) })
        .catch(() => { /* freshness caption is best-effort; degrade silently */ })
    }

    refetch()

    const onFocus = () => refetch()
    window.addEventListener('focus', onFocus)

    // Re-fetch when the admin Refresh flow broadcasts a cache invalidation.
    // A separate BroadcastChannel instance still receives messages posted by
    // the programData channel of the same name (same tab + other tabs).
    let channel = null
    if (typeof BroadcastChannel === 'function') {
      channel = new BroadcastChannel('tractova-cache')
      channel.onmessage = (ev) => { if (ev.data?.type === 'invalidate') refetch() }
    }

    const poll = setInterval(refetch, 5 * 60 * 1000)
    const tick = setInterval(() => setTick((n) => n + 1), 30000)

    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      if (channel) channel.close()
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [])

  return finishedAt
}
