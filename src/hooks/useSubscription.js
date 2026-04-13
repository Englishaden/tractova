import { useState, useEffect } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Returns the user's subscription tier and whether they are a Pro subscriber.
// Listens for real-time DB updates so the UI reflects payment within seconds
// of the Stripe webhook firing (no page refresh needed).
export function useSubscription() {
  const { user } = useAuth()
  const [tier,   setTier]   = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setTier('free')
      setStatus(null)
      setLoading(false)
      return
    }

    let cancelled = false

    // Initial fetch
    supabase
      .from('profiles')
      .select('subscription_tier, subscription_status')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return
        setTier(data?.subscription_tier ?? 'free')
        setStatus(data?.subscription_status ?? null)
        setLoading(false)
      })

    // Real-time: update instantly when the webhook fires
    const channel = supabase
      .channel(`profile-sub:${user.id}`)
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
