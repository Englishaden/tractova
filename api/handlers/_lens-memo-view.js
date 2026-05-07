/**
 * Memo View — public token-gated read of a frozen memo snapshot
 * Action: 'memo-view'
 *
 * Token validation + view-cap enforcement happens here via service-role.
 */
import { supabaseAdmin } from '../lib/_aiCacheLayer.js'

export default async function handleMemoView(body, res) {
  const { token } = body
  if (!token || typeof token !== 'string' || token.length < 16) {
    return res.status(400).json({ error: 'Invalid token' })
  }

  const { data: row, error } = await supabaseAdmin
    .from('share_tokens')
    .select('token, memo, expires_at, view_count, max_views')
    .eq('token', token)
    .maybeSingle()

  if (error || !row) return res.status(404).json({ error: 'Memo not found' })

  if (new Date(row.expires_at) < new Date()) {
    return res.status(410).json({ error: 'This memo link has expired' })
  }

  if (row.view_count >= row.max_views) {
    return res.status(410).json({ error: 'This memo link has reached its view limit' })
  }

  // Increment view count fire-and-forget (don't slow the response).
  supabaseAdmin
    .from('share_tokens')
    .update({ view_count: row.view_count + 1 })
    .eq('token', token)
    .then(({ error: updErr }) => {
      if (updErr) console.warn('[lens-insight:memo-view] view_count bump failed:', updErr.message)
    })

  return res.status(200).json({ memo: row.memo, expiresAt: row.expires_at })
}
