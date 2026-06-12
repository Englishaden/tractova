-- Migration 085: admin_audit_log AFTER trigger on admin-curated tables (F-06).
--
-- admin_audit_log (migration 057) + logAdminAction() (api/_admin-auth.js) were
-- dead code — nothing wrote the table, so admin data-curation left NO audit
-- trail. This adds the DB-side half of a HYBRID fix:
--   • TRIGGER (here): captures CLIENT-DIRECT admin writes — the /admin UI tabs
--     write via the anon-key client under is_admin() RLS, so auth.uid() is the
--     admin. A trigger is the ONLY thing that can see those (no server hook in
--     their path).
--   • APP-LAYER logAdminAction() (shipped in the same commit, in
--     api/scrapers/_refresh-ix-manual.js + api/handlers/_health-staging-post.js):
--     captures the two admin-gated SERVER writes, which run as service-role
--     (auth.uid() = NULL here), so the trigger deliberately skips them and the
--     handler logs them with the known actor instead.
--
-- Safe by construction: SECURITY DEFINER (the insert bypasses admin_audit_log's
-- own RLS); the body is wrapped so an audit-insert failure NEVER blocks the
-- admin's actual write; and service-role/cron writes (auth.uid() NULL) are
-- skipped — so machine refreshes don't pollute the trail and can't violate
-- admin_audit_log.actor_id NOT NULL.
--
-- House rule: Claude writes migrations, Aden applies. Idempotent — safe to re-run.

create or replace function public.log_admin_write()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid  := auth.uid();
  v_email text  := nullif(auth.jwt() ->> 'email', '');
  v_rec   jsonb := to_jsonb(coalesce(NEW, OLD));
begin
  -- Only log writes made in an authenticated user context. Service-role/cron
  -- writes have no auth.uid() — those are machine refreshes (logged app-side
  -- when admin-gated), and actor_id is NOT NULL.
  if v_actor is null then
    return coalesce(NEW, OLD);
  end if;

  insert into admin_audit_log (actor_id, actor_email, action, target_table, target_id, details)
  values (
    v_actor,
    v_email,
    lower(TG_OP),                              -- 'insert' | 'update' | 'delete'
    TG_TABLE_NAME,
    -- best-effort handle (tables vary: id vs state_id); full identity is in details.
    coalesce(v_rec ->> 'id', v_rec ->> 'state_id', ''),
    case
      when TG_OP = 'INSERT' then jsonb_build_object('new', to_jsonb(NEW))
      when TG_OP = 'DELETE' then jsonb_build_object('old', to_jsonb(OLD))
      else jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    end
  );
  return coalesce(NEW, OLD);
exception when others then
  -- Audit must never block the admin's write.
  return coalesce(NEW, OLD);
end;
$$;

comment on function public.log_admin_write() is
  'AFTER trigger: records authenticated-admin row writes to admin_audit_log (F-06). Skips service-role/cron writes (auth.uid() NULL).';

-- Attach to the admin-curated tables. The trigger no-ops for any write without
-- an auth.uid(), so attaching to a table whose writes are all service-role is
-- harmless. comparable_deals / puc_dockets / policy_impact_events have is_admin()
-- write RLS (058), so their client-direct writes run as the admin and are captured.
do $$
declare t text;
begin
  foreach t in array array[
    'state_programs','county_intelligence','revenue_rates','news_feed',
    'comparable_deals','puc_dockets','policy_impact_events'
  ] loop
    execute format('drop trigger if exists trg_admin_audit on public.%I', t);
    execute format(
      'create trigger trg_admin_audit after insert or update or delete on public.%I
         for each row execute function public.log_admin_write()', t);
  end loop;
end$$;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────
-- Verification (after applying): make one /admin edit on a table with
-- confirmed is_admin() write RLS (comparable_deals / puc_dockets / policy
-- events), then:
--   select actor_email, action, target_table, target_id, created_at
--   from admin_audit_log order by created_at desc limit 5;
--
-- Coverage probe (optional): whether state_programs / county_intelligence /
-- revenue_rates / news_feed client-edits are captured depends on whether those
-- writes run as the authenticated admin vs service-role:
--   select tablename, cmd, roles, qual from pg_policies
--   where tablename in ('state_programs','county_intelligence','revenue_rates','news_feed')
--     and cmd in ('INSERT','UPDATE','ALL');
-- If a table has no authenticated-admin write policy, its /admin saves route
-- through a server path — add a logAdminAction() call there, mirroring the two
-- in _refresh-ix-manual.js / _health-staging-post.js.
-- ─────────────────────────────────────────────────────────────────────────
