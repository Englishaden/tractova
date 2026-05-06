# Runbook — Production observability

> **Purpose.** Make sure that when something goes wrong in production
> at 3 a.m., there is a queryable trail of evidence rather than an
> empty Vercel function-log tail.
>
> **Last reviewed:** 2026-05-06.
> **Owner:** Aden.
>
> Related: `docs/runbooks/restore-from-snapshot.md`, `docs/SECURITY_ROTATION_LOG.md`,
> CLAUDE.md § 4 (cost runaway).

---

## Layers in place today

These already exist in production and answer specific incident-response
questions. **Read them first** when investigating anything weird.

### 1. `cron_runs` — scheduled-job health

Every cron handler logs to `cron_runs` (migration 006) on
start + completion. Columns: `cron_name`, `status`, `started_at`,
`finished_at`, `duration_ms`, `summary` (jsonb).

Investigation queries:
```sql
-- Most recent run per cron, was it healthy?
select distinct on (cron_name) cron_name, status, finished_at, duration_ms
from cron_runs
order by cron_name, finished_at desc;

-- p95 duration vs maxDuration over the last 30 days
select cron_name,
       percentile_cont(0.95) within group (order by duration_ms) as p95_ms,
       count(*) as runs
from cron_runs
where started_at > now() - interval '30 days'
group by cron_name
order by p95_ms desc;
```

Surfaced in `/admin → Data Health` (the cron-latency monitor card flags
any p95 > 70% of maxDuration as `WATCH`).

### 2. `api_call_log` — Anthropic + rate-limit accounting

Every Anthropic call (and now every checkout-session + alert-test —
see `api/_rate-limit.js`) lands here (migration 015). Columns:
`user_id`, `action`, `model`, `called_at`.

Investigation queries:
```sql
-- Top 10 users by call count in the last 24h (catches abuse + heavy use)
select user_id, action, count(*) as calls
from api_call_log
where called_at > now() - interval '24 hours'
group by user_id, action
order by calls desc
limit 10;

-- Rate-limit-relevant: who hit 429s?
-- (We log every successful call. A user hitting the 60/hr lens-insight
-- limit will show as 60 rows in the trailing hour.)
```

### 3. `admin_audit_log` — privileged writes

Every admin write through `_admin-auth.js` writes to
`admin_audit_log` (migration 057). Columns: `actor_id`, `actor_email`,
`action`, `target_table`, `target_id`, `details`, `created_at`.

Investigation query:
```sql
-- Privilege-escalation evidence: any admin write you didn't expect?
select * from admin_audit_log
where created_at > now() - interval '7 days'
order by created_at desc;
```

### 4. `webhook_events_processed` — Stripe webhook ledger

Every Stripe event the webhook handler successfully processes lands
here (migration 060). Use to audit double-processing, replay events,
or reconstruct billing-event order.

```sql
-- Recent webhooks by day
select date_trunc('day', created_at) as day, count(*) as events
from webhook_events_processed
group by 1 order by 1 desc limit 14;

-- Gaps (events stripe sent but our handler never marked processed)?
-- Compare against Stripe's Dashboard → Developers → Events.
```

---

## What's still missing — runtime errors

The four sources above cover **scheduled jobs**, **paid API spend**,
**privileged writes**, and **billing events**. They do NOT capture:

- Unhandled exceptions in `api/*.js` (500s).
- Vite/React client-side runtime errors (chunk-load failures, render
  exceptions).
- Console warnings that point at degraded behavior.

For these, configure **Vercel Log Drains** to forward function stderr
and optionally browser Sentry-equivalent. Vercel-native is preferred:
zero deps, no extra cost (free tier covers our volume), data stays
inside Vercel + the destination.

### Setting up Vercel Log Drains (manual, ~10 min)

> This is a Vercel-dashboard operation; no code change needed. Aden
> performs this; document the destination URL + token in 1Password.

1. Pick a destination. Free tiers acceptable today:
   - **Better Stack (Logtail)** — 1 GB/mo free, fastest UI
   - **Axiom** — 0.5 TB/mo free, best for long retention
   - **Datadog** — paid, only if SOC 2 or compliance needs it
2. In Vercel → Project → Settings → Log Drains → Add Log Drain.
3. Configure:
   - Source: this project's Production environment
   - Type: HTTPS endpoint provided by destination
   - Filter: errors + warnings (avoid info-spam)
4. Test by triggering a `console.error('observability test')` in any
   API route + verifying it lands in the destination dashboard within
   60 seconds.
5. Document the destination URL + auth token in 1Password under
   "Tractova — Log Drain destination".
6. Update `docs/SECURITY_ROTATION_LOG.md` with the rotation cadence
   for the destination's auth token (annually).

### When to escalate to Sentry

Sentry catches **client-side** errors (the React app crashing in a
user's browser) which Vercel Log Drains do NOT cover. Add Sentry
React when:
- Client-side error rate is non-zero per the smoke tests but Vercel
  function logs are clean.
- A premium customer reports a bug we can't reproduce.
- Pre-launch enterprise sales calls ask about your client-side
  observability story.

Until then, the engine-layer unit tests (51 in `tests/unit/`) +
Playwright smoke + browser console are sufficient.

---

## Incident response quick reference

For a 3am "the site is broken" page:

| Symptom | First place to look |
|---|---|
| All pages return 500 | Vercel function logs (most recent deploy) → `cron_runs` for migration drift |
| Specific cron failing | `cron_runs where status='error' order by started_at desc limit 10` |
| Stripe webhook delays | `webhook_events_processed` count over last hour vs Stripe Dashboard count |
| Pro user can't access feature | `admin_audit_log` (any role flips?) → `profiles` (subscription_tier set?) |
| Anthropic spend spike | `api_call_log` group-by-user / 24h |
| Suspected privilege escalation | `admin_audit_log where actor_id != known_admin_id` |
| Unknown 500s | (after Log Drains live) destination dashboard, then function-log tail |

## Related

- CLAUDE.md § 4 — cost runaway circuit breakers
- `scripts/check-api-usage.mjs` — weekly spend probe
- `scripts/dump-supabase-snapshot.mjs` — backup posture (parallel layer)
