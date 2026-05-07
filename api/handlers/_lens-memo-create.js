/**
 * Memo Share — frozen Deal Memo snapshot accessible via opaque token URL
 * Action: 'memo-create'
 *
 * Two paths:
 *   handleMemoCreate (auth'd): owner generates a token + stores frozen memo +
 *                              project snapshot. Returns { token, url, expiresAt }.
 *   handleMemoView (public):   recipient hits with token, gets memo if not expired
 *                              and view_count < max_views. Increments view_count.
 *
 * Tokens self-expire (90 days) and have a view cap (100) to bound abuse.
 */
import { supabaseAdmin } from '../lib/_aiCacheLayer.js'

export default async function handleMemoCreate(body, res, user) {
  const { project, stateProgram, countyData, memo, scenario } = body
  if (!project?.id) return res.status(400).json({ error: 'project.id required' })
  if (!memo) return res.status(400).json({ error: 'memo required' })

  // Verify the project actually belongs to this user (defense in depth -- the
  // RLS policy also enforces this, but explicit check returns a cleaner error).
  const { data: projectRow, error: projectErr } = await supabaseAdmin
    .from('projects')
    .select('id, user_id, name')
    .eq('id', project.id)
    .maybeSingle()
  if (projectErr || !projectRow || projectRow.user_id !== user.id) {
    return res.status(403).json({ error: 'Project not found or access denied' })
  }

  // Freeze the memo + a project snapshot so the shared link shows what the
  // owner saw at share time, even if the underlying state data changes later.
  // ownerUserId is embedded so MemoView can detect "this viewer owns this
  // project" without an extra DB round-trip; sharedByName uses the user's
  // display name (never raw email -- email is PII and the shared URL is
  // public, so anyone with the link could otherwise harvest it).
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || null
  const snapshot = {
    memo,
    project: {
      id: project.id,
      name: project.name,
      state: project.state,
      stateName: project.stateName,
      county: project.county,
      mw: project.mw,
      stage: project.stage,
      technology: project.technology,
      servingUtility: project.servingUtility,
      feasibilityScore: project.feasibilityScore,
    },
    stateProgram: stateProgram || null,
    countyData: countyData || null,
    // Optional saved scenario from scenario_snapshots. When the owner
    // toggled "Include in PDF + share" on a card, the row rides into
    // the snapshot so the recipient sees the deal memo + scenario in
    // a single token-protected URL. We embed the row inline (rather
    // than referencing scenario_snapshots.id) so the snapshot is
    // hermetic — even if the owner later deletes the saved scenario,
    // the shared link still renders.
    scenario: scenario && typeof scenario === 'object' ? {
      name: scenario.name,
      baseline_inputs: scenario.baseline_inputs,
      scenario_inputs: scenario.scenario_inputs,
      outputs: scenario.outputs,
    } : null,
    sharedAt: new Date().toISOString(),
    sharedByName: displayName,
    ownerUserId: user.id,
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('share_tokens')
    .insert([{ project_id: project.id, user_id: user.id, memo: snapshot }])
    .select('token, expires_at')
    .single()

  if (insertErr) {
    console.error('[lens-insight:memo-create] insert error:', insertErr.message)
    return res.status(500).json({ error: 'Failed to create share token' })
  }

  // Audit-log the share so the V3 project Audit tab shows who shared / when.
  // Fire-and-forget: a failure here must not break the share flow.
  // Migration 018 widens project_events.kind to include 'shared'; if the
  // migration hasn't run yet, the insert silently fails on the check
  // constraint (matches the existing fail-soft pattern for audit writes).
  supabaseAdmin
    .from('project_events')
    .insert([{
      project_id: project.id,
      user_id: user.id,
      kind: 'shared',
      detail: `Shared deal memo · expires ${new Date(inserted.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      meta: { token: inserted.token, sharedBy: user.email || null },
    }])
    .then(({ error: auditErr }) => {
      if (auditErr) console.warn('[lens-insight:memo-create] audit log failed:', auditErr.message)
    })

  return res.status(200).json({
    token: inserted.token,
    url: `/memo/${inserted.token}`,
    expiresAt: inserted.expires_at,
  })
}
