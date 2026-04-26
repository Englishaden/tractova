import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN_EMAIL = 'aden.walker67@gmail.com'

export default async function handler(req, res) {
  // Auth: verify JWT and check admin email
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.slice(7)
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user || user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    // Fetch all three data sources in parallel
    const [freshnessResult, cronRunsResult, dataUpdatesResult] = await Promise.all([
      supabaseAdmin.rpc('get_data_freshness'),
      supabaseAdmin
        .from('cron_runs')
        .select('*')
        .order('finished_at', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('data_updates')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(30),
    ])

    return res.status(200).json({
      freshness: freshnessResult.data,
      cronRuns: cronRunsResult.data || [],
      dataUpdates: dataUpdatesResult.data || [],
    })
  } catch (err) {
    console.error('Data health fetch failed:', err)
    return res.status(500).json({ error: 'Failed to fetch data health' })
  }
}
