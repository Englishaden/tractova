import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Guard: if env vars are missing at build time the app should still render —
// auth just won't work. A throw here kills the entire module graph (blank page).
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Tractova] Supabase env vars not found. ' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables, ' +
    'then redeploy.'
  )
}

// createClient is safe to call even with placeholder values — it only makes
// network requests when auth methods are invoked, not on initialization.
// The new sb_publishable_ key format is fully supported in @supabase/supabase-js v2.
export const supabase = createClient(
  supabaseUrl     ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder'
)

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
