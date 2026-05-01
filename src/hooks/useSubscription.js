import { useState, useEffect, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Returns the user's subscription tier and whether they are a Pro subscriber.
// Listens for real-time DB updates so the UI reflects payment within seconds
// of the Stripe webhook firing (no page refresh needed).
//
// V3.1 fix: each hook instance generates a UNIQUE channel name suffix.
// Without it, multiple components on the same screen (Dashboard's WelcomeCard
// + the StateDetailPanel that opens on state click + Library's gate, etc.)
// all called `supabase.channel('profile-sub:USERID')` -- which returns the
// SAME shared channel object. The second consumer's `.on()` call would
// arrive after the first instance had already `.subscribe()`-d, triggering:
//
//   Error: cannot add `postgres_changes` callbacks for realtime:profile-sub
//   after `subscribe()`
//
// ...which crashed the entire dashboard with a white screen on state click.
// Each instance now has its own channel; minor cost in realtime fanout, but
// correct.
export function useSubscription() {
  const { user } = useAuth()
  const [tier,   setTier]   = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  // Stable per-mount suffix so React Strict Mode double-invoke + multiple
  // hook consumers in the tree don't collide on the same channel.
  const instanceId = useRef(null)
  if (instanceId.current === null) {
    instanceId.current = Math.random().toString(36).slice(2, 10)
  }

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setTier('free')
      setStatus(null)
      setLoading(false)
      return
    }

    let cancelled = false

    // Initial fetch. Defensive against three failure modes that previously
    // left the hook stuck loading forever:
    //   1. Network error / RLS rejection — error is non-null
    //   2. profiles row missing (auth trigger didn't fire) — .single()
    //      returns code 'PGRST116' "Cannot coerce the result to a single
    //      JSON object"
    //   3. data is null/undefined — already handled by ?? 'free' fallback
    // In any failure case, default to free tier and clear loading so the
    // UI doesn't hang on a phantom subscription check. Logged for debug.
    supabase
      .from('profiles')
      .select('subscription_tier, subscription_status')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('[useSubscription] profile fetch error, defaulting to free:', error.message)
        }
        setTier(data?.subscription_tier ?? 'free')
        setStatus(data?.subscription_status ?? null)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[useSubscription] profile fetch threw, defaulting to free:', err?.message)
        setTier('free')
        setStatus(null)
        setLoading(false)
      })

    // Real-time: update instantly when the webhook fires
    const channel = supabase
      .channel(`profile-sub:${user.id}:${instanceId.current}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          setTier(payload.new.subscription_tier)
          setStatus(payload.new.subscription_status)
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const isPro = tier === 'pro' && ['active', 'trialing'].includes(status)

  return { tier, status, isPro, loading }
}
