/**
 * Shared admin auth helper for API endpoints.
 *
 * Replaces the hardcoded `user.email === 'aden.walker67@gmail.com'` checks
 * scattered across api/*.js with a role-based lookup against
 * profiles.role (migration 057).
 *
 * Defense-in-depth: if the role lookup fails (migration 057 not yet
 * applied; profiles row missing; supabase outage), we FALL BACK to the
 * legacy email check so production doesn't lock out admin during the
 * rollout window. Once 057 is verified live, the email fallback can be
 * removed in a future cleanup.
 *
 * Usage:
 *   import { isAdminFromBearer } from './_admin-auth.js'
 *   const ok = await isAdminFromBearer(supabaseAdmin, req.headers.authorization)
 *   if (!ok) return res.status(401).json({ error: 'Unauthorized' })
 */

const LEGACY_ADMIN_EMAIL = 'aden.walker67@gmail.com'

/**
 * Verifies a Bearer JWT and confirms the user is admin.
 * @param {SupabaseClient} supabaseAdmin — service-role client.
 * @param {string|undefined} authHeader — `Authorization` header value.
 * @returns {Promise<{ok: boolean, user?: object, role?: string, email?: string}>}
 */
export async function isAdminFromBearer(supabaseAdmin, authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false }
  }
  const token = authHeader.slice(7)
  let user = null
  try {
    const result = await supabaseAdmin.auth.getUser(token)
    user = result?.data?.user || null
  } catch {
    return { ok: false }
  }
  if (!user) return { ok: false }

  // Primary path: profiles.role == 'admin'
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (!error && data?.role === 'admin') {
      return { ok: true, user, role: 'admin', email: user.email }
    }
    // If the role lookup succeeded but role is NOT admin, deny — this
    // is the post-rollout state. The legacy fallback below ONLY fires
    // when the role lookup failed entirely (migration not applied yet).
    if (!error && data) {
      return { ok: false, user, role: data.role, email: user.email }
    }
  } catch { /* fall through */ }

  // Legacy fallback: email match. Active during the migration-057 rollout
  // window only; remove after verifying role data is populated.
  if (user.email === LEGACY_ADMIN_EMAIL) {
    return { ok: true, user, role: 'admin', email: user.email, _legacyFallback: true }
  }

  return { ok: false, user, email: user.email }
}

/**
 * Records an admin write event to admin_audit_log. Best-effort — failures
 * are logged to console but don't block the user's action. The audit log
 * table itself has RLS that allows admin INSERT.
 */
export async function logAdminAction(supabaseAdmin, actor, { action, targetTable, targetId, details }) {
  try {
    await supabaseAdmin.from('admin_audit_log').insert({
      actor_id: actor?.id || null,
      actor_email: actor?.email || null,
      action,
      target_table: targetTable,
      target_id: targetId == null ? null : String(targetId),
      details: details || null,
    })
  } catch (e) {
    console.warn('[admin-audit] insert failed:', e?.message)
  }
}

export { LEGACY_ADMIN_EMAIL }
