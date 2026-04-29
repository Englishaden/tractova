-- Migration 021: puc_dockets admin write policies
--
-- Migration 020 enabled RLS on puc_dockets with only a public-read policy.
-- The /admin > PUC Dockets tab uses the regular supabase anon client (same
-- pattern as the other reference-data tabs), so its upserts/updates/
-- deletes were getting blocked with:
--   "new row violates row-level security policy for table 'puc_dockets'"
--
-- This adds admin-email-gated policies for INSERT, UPDATE, and DELETE.
-- The pattern matches what the other reference-data tables use (those
-- policies were added via the Supabase UI historically); this one is
-- checked into source so re-creates of the project don't lose it.
--
-- The admin email is hard-coded to match the ADMIN_EMAIL constant in
-- src/pages/Admin.jsx (aden.walker67@gmail.com). If that ever changes,
-- update both places together.

drop policy if exists "puc_dockets admin insert" on puc_dockets;
create policy "puc_dockets admin insert"
  on puc_dockets for insert
  with check (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "puc_dockets admin update" on puc_dockets;
create policy "puc_dockets admin update"
  on puc_dockets for update
  using       (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com')
  with check  (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

drop policy if exists "puc_dockets admin delete" on puc_dockets;
create policy "puc_dockets admin delete"
  on puc_dockets for delete
  using (auth.jwt() ->> 'email' = 'aden.walker67@gmail.com');

notify pgrst, 'reload schema';
