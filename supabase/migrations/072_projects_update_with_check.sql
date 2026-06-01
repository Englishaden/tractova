-- Migration 072: add WITH CHECK to the projects UPDATE policy (C1-class fix).
--
-- ── Why this exists ────────────────────────────────────────────────────────
-- The 2026-05-31 RLS sweep (follow-up to security finding C1 / migration 071)
-- looked for the same missing-WITH-CHECK pattern across every table. `profiles`
-- (071) was the critical one; `projects` is the only other surviving instance.
-- Migration 007's policy:
--
--     create policy "users update own projects"
--       on projects for update
--       using (auth.uid() = user_id);   -- no WITH CHECK
--
-- With WITH CHECK omitted, PostgreSQL reuses the USING expression to gate WHICH
-- rows may be targeted (only the caller's own) but does NOT constrain the NEW
-- row. An authenticated user can therefore reassign ownership of their own
-- project to someone else via the public anon-key client:
--
--     supabase.from('projects').update({ user_id: '<other-uuid>' }).eq('id', mine)
--
-- Unlike profiles (071), `projects` carries NO privilege/payment columns
-- (it's user-owned saved-project data), so this is broken object-level write
-- authorization / ownership reassignment — Medium severity, not privilege
-- escalation. Fixed for consistency with the correct pattern already used by
-- scenario_snapshots (041) and saved_comparisons (062): USING + matching
-- WITH CHECK.
--
-- ── Trust model ────────────────────────────────────────────────────────────
-- Server writes use the service-role key and bypass RLS. Legitimate user edits
-- (stage, notes, mw, etc.) keep user_id unchanged and still pass the check;
-- only an attempt to change user_id away from the caller is now blocked.
--
-- The INSERT, SELECT, and DELETE policies (007) are already correctly scoped
-- (insert has WITH CHECK; select/delete gate on auth.uid() = user_id).
--
-- Idempotent. Safe to re-run.

drop policy if exists "users update own projects" on projects;
create policy "users update own projects"
  on projects for update
  using       (auth.uid() = user_id)
  with check  (auth.uid() = user_id);

-- ── Verification (run manually after applying) ─────────────────────────────
--   -- As an ordinary user, reassigning ownership must now RAISE:
--   --   update projects set user_id = '<other-uuid>' where id = '<my-project>';
--   -- A benign self-edit must still SUCCEED:
--   --   update projects set stage = 'diligence' where id = '<my-project>';
--   -- Confirm the policy now carries a WITH CHECK expression:
--   select policyname, cmd, qual, with_check
--   from pg_policies where tablename = 'projects' and cmd = 'UPDATE';

notify pgrst, 'reload schema';
