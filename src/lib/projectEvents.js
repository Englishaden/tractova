// Project Events helper -- thin wrapper around the project_events table.
//
// Append-only by convention. Insert silently fails (logged warn) if the
// migration hasn't been applied yet; the app should never block on event
// logging since it's audit, not transactional.
import { supabase } from './supabase'

const VALID_KINDS = new Set([
  'created',
  'stage_change',
  'score_change',
  'alert_triggered',
  'note_updated',
])

export async function logProjectEvent({ projectId, userId, kind, detail, meta = null }) {
  if (!projectId || !userId || !VALID_KINDS.has(kind) || !detail) {
    console.warn('[projectEvents] skipping invalid event:', { projectId, kind })
    return null
  }
  try {
    const { data, error } = await supabase
      .from('project_events')
      .insert([{ project_id: projectId, user_id: userId, kind, detail, meta }])
      .select()
      .single()
    if (error) {
      // Migration not run yet, RLS denial, or other -- log and move on.
      // Audit failures must not break the user-visible action.
      console.warn('[projectEvents] insert failed:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.warn('[projectEvents] insert threw:', err.message)
    return null
  }
}

export async function fetchProjectEvents(projectId, limit = 50) {
  if (!projectId) return []
  try {
    const { data, error } = await supabase
      .from('project_events')
      .select('id, kind, detail, meta, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) {
      console.warn('[projectEvents] fetch failed:', error.message)
      return []
    }
    return data ?? []
  } catch (err) {
    console.warn('[projectEvents] fetch threw:', err.message)
    return []
  }
}
