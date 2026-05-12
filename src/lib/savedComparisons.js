// Saved Comparisons — Phase 2C of TRACTOVA-UX-001.
//
// Thin CRUD wrapper around the saved_comparisons table (migration 062).
// The Compare flow has two layers:
//   - localStorage  → "draft" (CompareContext, transient, lives only on
//                     this device until cleared)
//   - Supabase      → "saved" (persisted research artifact, surfaces in
//                     Library + Cmd-K, exportable to PDF, re-openable)
//
// Snapshot column contains the full compare item shape. Re-opening a
// saved comparison hydrates CompareContext from the snapshot; the Modal's
// existing drift-refresh then surfaces deltas between snapshot time and
// "now" when the underlying state/county data has moved.
//
// All helpers fail-soft: table missing / RLS denial / network errors
// return null or [] and log to console. Saved-comp failures must not
// break the user-visible compare flow (the draft layer still works).
import { supabase } from './supabase'

// Save the current Compare draft as a named, persistent comparison.
// Returns the inserted row (with id + created_at) on success, null on
// failure. Caller is responsible for auth — if user isn't signed in,
// the insert hits RLS and we surface that as a return null + console.warn.
export async function saveComparison(name, items) {
  if (!name || !Array.isArray(items) || items.length === 0) {
    console.warn('[savedComparisons.save] missing name or empty items')
    return null
  }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return null
    const payload = {
      user_id:  user.id,
      name:     name.trim().slice(0, 120),
      item_ids: items.map(it => String(it.id)),
      snapshot: items,
    }
    const { data, error } = await supabase
      .from('saved_comparisons')
      .insert([payload])
      .select('id, name, item_ids, snapshot, created_at, updated_at')
      .single()
    if (error) {
      console.warn('[savedComparisons.save] insert failed:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.warn('[savedComparisons.save] threw:', err?.message)
    return null
  }
}

// List the user's saved comparisons, newest first. RLS-scoped — only
// returns rows where user_id = auth.uid().
export async function listSavedComparisons() {
  try {
    const { data, error } = await supabase
      .from('saved_comparisons')
      .select('id, name, item_ids, snapshot, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(50)
    if (error) {
      console.warn('[savedComparisons.list] failed:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.warn('[savedComparisons.list] threw:', err?.message)
    return []
  }
}

// Fetch a single saved comparison by id. Returns null if missing or RLS
// denies. Used by the "Open" CTA in Library + Cmd-K `:compare` items.
export async function loadSavedComparison(id) {
  if (!id) return null
  try {
    const { data, error } = await supabase
      .from('saved_comparisons')
      .select('id, name, item_ids, snapshot, created_at, updated_at')
      .eq('id', id)
      .single()
    if (error) {
      console.warn('[savedComparisons.load] failed:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.warn('[savedComparisons.load] threw:', err?.message)
    return null
  }
}

// Rename a saved comparison. Returns the updated row on success.
export async function renameSavedComparison(id, name) {
  if (!id || !name) return null
  try {
    const { data, error } = await supabase
      .from('saved_comparisons')
      .update({ name: String(name).trim().slice(0, 120) })
      .eq('id', id)
      .select('id, name, updated_at')
      .single()
    if (error) {
      console.warn('[savedComparisons.rename] failed:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.warn('[savedComparisons.rename] threw:', err?.message)
    return null
  }
}

// Delete a saved comparison. Returns true on success, false on failure.
export async function deleteSavedComparison(id) {
  if (!id) return false
  try {
    const { error } = await supabase
      .from('saved_comparisons')
      .delete()
      .eq('id', id)
    if (error) {
      console.warn('[savedComparisons.delete] failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[savedComparisons.delete] threw:', err?.message)
    return false
  }
}
