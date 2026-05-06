# Runbook — Restore from Supabase JSON snapshot

> **Last drill:** 2026-05-06. Snapshot of 22 tables / 19,146 rows /
> 11.1 MB completed via `scripts/dump-supabase-snapshot.mjs`. Restore
> path validated via dry-run (no writes); next live drill scheduled
> annually or on schema change.
>
> **Owner:** Aden.
>
> **Related:** `CLAUDE.md` Section 1.1 (DB destruction stop-list),
> `docs/secrets-manifest.md` (env vars needed), Plan B item B.3.

---

## When to use this runbook

Use the JSON snapshot when:

1. **Supabase PITR is unavailable** (you're on Free tier or PITR window
   has elapsed — > 7 days on Pro, > 14 days on Team).
2. **A specific row / set of rows needs reverting** but the rest of the
   table is fine. PITR restores to a database point-in-time, not row-level.
3. **Lift-and-shift to a new Supabase project** (e.g., region migration,
   tier change). Schema goes via migration files; data goes via this
   restore path.
4. **Local dev seed** — a colleague needs a non-secret subset of prod
   data to reproduce a bug.

If the database is corrupted but PITR is in window, **prefer PITR.** It
restores schema + data + auth in one step. The JSON snapshot is for
PITR-fallback and surgical row-level work.

---

## Pre-flight

1. Confirm you have an up-to-date snapshot in `backups/YYYY-MM-DD/`. If
   the latest snapshot is > 7 days old, run a fresh one first:
   ```
   node scripts/dump-supabase-snapshot.mjs
   ```
2. Confirm `.env.local` has `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and
   `SUPABASE_SERVICE_ROLE_KEY` set, pointing at the **target** project.
3. **Do not** run a restore against production unless you have a fresh
   PITR window AND you have explicit go-ahead per `CLAUDE.md` § 1.1.
   Bring up a staging Supabase project first when in doubt.

---

## Restore order

Restore parent tables before child tables to avoid FK violations. The
snapshot script's TABLES array is already ordered correctly — follow
that order.

```
profiles
projects
project_events
share_tokens
state_programs
state_programs_snapshots
revenue_rates
lmi_data
county_acs_data
county_geospatial_data
energy_community_data
hud_qct_dda_data
nmtc_lic_data
puc_dockets
comparable_deals
substations
ix_queue_data
ix_queue_snapshots
solar_cost_index
cs_projects
cs_specific_yield
scenario_snapshots
cancellation_feedback
cron_runs
api_call_log
ai_response_cache
admin_audit_log
```

---

## Procedure

### Step 1 — Dry run (always)

```
node scripts/restore-from-snapshot.mjs --dry-run --date 2026-05-06
```

Output: per-table row count + first-row preview, no writes. Verify the
counts match expectations and the JSON parses.

### Step 2 — Single-table restore

```
node scripts/restore-from-snapshot.mjs --date 2026-05-06 --table state_programs
```

Defaults to upsert by primary key. Existing rows with the same PK are
overwritten; rows present in the live table but not in the snapshot
are **left in place** (idempotent merge, not destructive sync). To
remove rows that shouldn't be there, run a separate cleanup query
under explicit approval.

### Step 3 — Full-database restore

```
node scripts/restore-from-snapshot.mjs --date 2026-05-06 --all
```

This is the PITR-replacement path. It iterates through every JSON file
in `backups/<date>/` in TABLES order, upserting each. Wall time on a
prod-shaped 11 MB snapshot: ~2-4 minutes (Supabase REST upserts at
~50-200 rows/sec depending on row width).

### Step 4 — Verify

```
node scripts/check-migrations.mjs        # confirms schema sane
node scripts/probe-rls-policies.mjs       # confirms admin/RLS healthy
```

Then load `/admin → Data Health` in the browser and confirm:

- All sources show recent `last_run_at`.
- NWI coverage % matches pre-restore.
- Active CS state count matches pre-restore.

If any value drifts, compare the JSON snapshot row count against the
live row count for that table to find the diff.

---

## What this restore CAN'T recover

- **Schema** — restored via migration files in `supabase/migrations/`
  applied in order through Supabase SQL editor or `supabase db push`.
- **Auth users** — `auth.users` is not in the snapshot (separate
  Supabase auth export path). Dump via:
  ```sql
  copy (select * from auth.users) to '/tmp/auth_users.csv' with csv header;
  ```
  But be aware: re-importing auth users requires careful UID
  preservation if you want existing `profiles.id` FKs to reconnect.
- **Storage buckets** — Supabase Storage objects are blob-stored, not in
  the JSON. Use the dashboard or `supabase storage` CLI to dump objects
  separately if a bucket goes down.
- **RLS policies** — restored via migrations 058 + 059 + earlier.
- **Extensions / triggers / functions** — same; from migration files.
- **Cron schedules** — defined in `vercel.json` and re-deploy on push.

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `duplicate key value violates unique constraint` | Restore tried to insert a row that already exists with a different PK source | Restore script defaults to upsert; if you see this, the table has a non-PK unique constraint. Use `--on-conflict <column>` flag. |
| `foreign key violation: profiles_id_fkey` | Restoring `profiles` before the linked `auth.users` row exists | Restore `auth.users` first via auth export; then re-run. |
| `permission denied for table X` | Service-role key wrong / RLS misconfigured / wrong project | Re-check `SUPABASE_SERVICE_ROLE_KEY` and project URL. Service role bypasses RLS, so this means the key is malformed. |
| Snapshot file is empty (`[]`) | Source table was empty at snapshot time, OR the snapshot script silently skipped it because of zero rows | Skip restore for that table; expected behavior. |
| Wall time > 10 min | Network slow, OR you're restoring all 22 tables sequentially | Parallelize at the table level (each upsert is independent across tables). |

---

## Escalation

If a restore fails partway and the live database is in an inconsistent
state:

1. **STOP** — do not retry the restore blindly.
2. Open Supabase dashboard → Database → Backups → restore the most
   recent PITR point you trust.
3. After PITR completes, re-attempt the JSON restore with the
   newly-stable baseline.
4. Document the failure mode in BUILD_LOG.md so the next drill catches it.
