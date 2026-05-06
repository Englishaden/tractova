# CLAUDE.md — Tractova Project Safety Net

> **Purpose.** This file is loaded into every Claude Code session that
> opens this repo. Its job is to make the AI **stop and think** before
> destructive operations, even when momentum says "just ship it."
>
> If anything in this file conflicts with a session-time instruction
> from Aden, the SESSION instruction wins — but only for THAT session.
> CLAUDE.md is the durable contract; session overrides are temporary.
>
> **Last reviewed:** 2026-05-06.
> **Owner:** Aden (englishaden / aden.walker67@gmail.com).

---

## Section 1 — STOP-AND-ASK list

Before executing ANY of the following, you MUST surface what you are
about to do and wait for explicit, operation-specific approval. A
generic "continue" or "go ahead" from earlier in the session does NOT
count. Aden's approval must reference the specific operation by name
or by visible diff/SQL.

### 1.1  Database destruction

- **`DELETE` / `TRUNCATE` / `DROP` against any Supabase table.**
  - Show: the SQL, the target table, an estimated row count.
  - Approval requires: explicit "yes delete N rows from `<table>`"
    or "yes drop `<table>`".
- **Migrations marked irreversible** (DROP COLUMN with data, DROP TABLE
  on a populated table, REVOKE permissions Aden can't easily restore).
  - Migrations are FILES; writing them is fine. APPLYING them is what
    Aden does manually in Supabase SQL editor — but if you ever wire
    auto-apply, the apply step belongs here.
- **`UPDATE` without a `WHERE` clause** or with an obviously dangerous
  WHERE (e.g., `WHERE 1=1`, no clause at all).

### 1.2  Code / git destruction

- **`git push --force` / `--force-with-lease` to `main` / `master`.**
  - Show: commits about to be lost, upstream HEAD, why this is the
    right call. Default answer: don't.
- **`git reset --hard`**, `git checkout -- <file>` that overwrites
  uncommitted work, `git clean -f`, `git branch -D`.
- **Deleting branches that aren't merged.**
- **Amending commits that have already been pushed** (force-push
  required → see above).

### 1.3  File-system destruction

- **`rm -rf` of any directory you didn't create this session.**
- **Overwriting files outside the project working directory tree**
  (no edits to `~`, `/etc`, other repos, system config).
- **`Write`/`Edit` into `.env` / `.env.local`** — these contain
  secrets. Show which env var, redacted source value.

### 1.4  Process / external-side-effect

- **`kill` / `taskkill`** of any process you didn't start this session.
  Show: PID, command, age.
- **Running anything that talks to a paid service** (Stripe API
  calls, Resend bulk send, Anthropic batch jobs > 1 call, Vercel
  deploy / promote, GitHub Action triggers) without an explicit
  per-call OK.
- **`vercel deploy --prod` / `vercel promote`** — production deploys
  go through `git push origin main` and the standard CI pipeline,
  not the CLI.

### 1.5  Cost runaway

- **Multi-agent fan-outs > 3 agents in parallel.** Show: estimated
  token cost, what each agent will do.
- **Web fetches > 50 in a single session.** Mass scraping is rarely
  the right call.
- **AI calls in a loop over states/projects/counties.** Single Lens
  insight is fine; iterating is not without a budget OK.

### 1.6  Approval format

What "approval" looks like:

- ✅ "yes drop `cs_projects` and reseed from the NREL CSV" — specific.
- ✅ "go ahead with that DELETE — show me the row count first then
  apply it" — explicit and tied to the next operation.
- ❌ "continue" — too generic.
- ❌ "yes" with no recent operation in view — pre-approval doesn't
  carry to a NEW destructive op.

If Aden says "just do it, don't ask" for one operation, that's a
**one-shot bypass** for THAT call only. The next destructive op
re-enters the STOP list.

---

## Section 2 — TRUST-BUT-VERIFY list

These auto-execute, but you owe Aden a visible diff / output / impact
estimate at the end:

- **All `Edit` / `Write` to project files** — diff is shown by the
  tool, that's enough.
- **`git add` + `git commit`** — show the staged file list and the
  commit message before running.
- **`git push origin main`** — auto per saved feedback memory
  (`feedback_auto_push`), but show the commit count + range in the
  final summary.
- **`npm run build`, `npm run lint:api`, `npm run test:smoke`** —
  auto. Capture the output; relay failures.
- **Writing migration FILES** (`supabase/migrations/*.sql`) — auto.
  Aden reviews + applies manually. The DANGER is APPLYING, which
  Aden does, not you.
- **Seed scripts on dev DB** — prefer `--dry-run` for first run;
  live run requires explicit OK if no recent dry-run was visible.

---

## Section 3 — HALLUCINATION GUARDS

These are anti-fabrication rules. Saved feedback memories
(`feedback_no_guessing`, `feedback_no_synthesis_as_primary`) cover
some of this; CLAUDE.md reinforces them at the project layer.

- **NEVER cite a source URL without first WebFetching it OR
  confirming from a file in the working tree.** If a URL is in your
  training data only, label the citation as "(unverified — training-
  data recall)" or skip it.
- **NEVER quote a number from a published report without finding it
  in an actual file.** If the file's not on disk, say "I don't have
  the source on hand; let me fetch it" or skip the number entirely.
- **NEVER reference an API endpoint, library function, schema column,
  or config key you haven't read in the actual codebase.** Use
  Grep / Read first. Filenames are not a substitute — `cs_projects.sql`
  doesn't prove a `cs_projects` table exists; read the migration body.
- **NEVER state that a Supabase migration "applied" or a cron
  "succeeded" without probing the live state.** Use
  `scripts/probe-*.mjs` or query `cron_runs` directly.
- **Past fabrication examples** (so future-you sees the failure mode
  named):
  - Session 6: Lazard LCOE numbers cited from training-data recall
    rather than the actual June 2025 PDF on disk. Caught by Aden.
    Fix: actually fetch the PDF, find the table, quote the page.
  - Phase G: cs_specific_yield treated as observed when it was a
    derived modeled value. Caught by Aden during data-trust audit.
    Fix: separate observed-vs-synthesis everywhere they merge.

---

## Section 4 — COST RUNAWAY CIRCUIT BREAKERS

- **Single Lens insight ≈ 6,000 tokens (Haiku 4.5).** One-off calls
  are fine. Loops over multiple states/projects/counties require
  explicit budget approval.
- **Subagents are ~$0.10–0.30 each.** Max 3 in parallel without
  asking. Re-asking subagents to redo work without new info is
  waste — synthesize their first output before spawning more.
- **Web fetches > 50 / session = stop and ask.**
- **Background processes:** only run-in-background commands you can
  reasonably bound (a known seed script, a single npm test). Never
  open-ended loops.
- **Mass refactors touching > 20 files = stop and present scope
  before executing.**
- **Compaction is your friend.** Long sessions cost more per turn.
  When the work is done, summarize and stop — don't keep poking.

---

## Section 5 — HIGH-CONFIDENCE-MISTAKE PROTOCOL

The "step-back" protocol. Before executing ANY operation in Section 1,
even if you think you've been pre-authorized:

1. **WRITE the operation** as plain English. Example: "I'm about to
   `DELETE FROM cs_projects WHERE state = 'NY'`, ~840 rows."
2. **WRITE what could go wrong.** Example: "If this is wrong, the
   NY operating-CS-projects ground-truth layer goes empty until
   reseed from the NREL CSV; ~2 hrs to recover."
3. **WRITE the evidence it's safe.** Example: "Aden said 'reseed NY
   only' 4 turns ago; the seed file is `scripts/seed-cs-projects.mjs`
   with `--state=NY` flag; we ran `--dry-run` last turn and the row
   count matched expectations; no production user is reading the
   table during this window."
4. **ASK explicitly** with the above written down. Wait for an
   approval that names the specific operation, not a generic
   "continue."

**Skip conditions** (no step-back needed):

- The operation is a single `Edit` on a non-config file in the
  project tree.
- The operation is `Read` / `Grep` / `Glob` / no side effects.
- The operation is `npm run lint:api` / `build` / `test:smoke` / etc.
- Aden granted a one-shot bypass tied to THIS specific call.

---

## Section 6 — SAFE-FALLBACK ESCAPE HATCHES

When in doubt, prefer the reversible alternative:

- Instead of `git reset --hard`, prefer `git revert` or branch off.
- Instead of overwriting a file, write to a sibling and let Aden diff.
- Instead of `DROP COLUMN`, write a deprecation migration that
  renames the column (`old_col_DEPRECATED`) — Aden can drop later.
- Instead of `DELETE`, prefer `UPDATE ... SET deleted_at = now()` if
  the table has a soft-delete pattern.
- Instead of an open-ended loop, ship a single iteration first and
  show the output before extending.
- Instead of `--force` anything, ask whether there's a non-force
  path. There almost always is.

---

## Section 7 — INVENTORY + MAINTENANCE

This file's source of truth is git history. When a new failure mode
is discovered, add to the relevant section + a one-line entry in the
"Recent additions" log below. Aden reviews quarterly.

### Recent additions

- 2026-05-06: Initial draft — Sections 1–6 codified after the data-
  trust audit + RLS hardening arc closed. Plan B item B.1.

### Companion files

- `BUILD_LOG.md` — chronological session log + decisions + lineage.
- `docs/data-trust-audit.md` — quarterly data-trust audit findings.
- `docs/secrets-manifest.md` — env-var inventory + rotation cadence
  (Plan B item B.8 — pending).
- `.claude/settings.local.json` — Claude Code permission model.
  Section 1 patterns live here too (Plan B item B.2 — pending).

### Env-var manifest (read-only inventory, no values)

The project requires the following secrets at runtime. They live in
`.env.local` (dev) and Vercel Project Settings (prod). NEVER commit
them to git.

- `VITE_SUPABASE_URL` — Supabase project URL (public, but stays in
  env for parity).
- `VITE_SUPABASE_ANON_KEY` — anon key for browser-side Supabase.
- `SUPABASE_URL` — server-side mirror.
- `SUPABASE_SERVICE_ROLE_KEY` — full-access service-role key. Never
  ship to the browser. Used by `api/*.js` cron handlers.
- `ANTHROPIC_API_KEY` — Lens insight + Compare insight + AI portfolio
  digest.
- `RESEND_API_KEY` — outbound transactional email (alerts, digest,
  signup).
- `STRIPE_SECRET_KEY` — billing API.
- `STRIPE_WEBHOOK_SECRET` — webhook signature verification.
- `VITE_STRIPE_PUBLISHABLE_KEY` — checkout-session creation.
- `CRON_SECRET` — bearer-token gate on `api/refresh-data.js` etc.
- `VITE_RESEND_AUDIENCE_ID` (optional) — Resend audience for digest.

If a new env var is added, update this list AND `docs/secrets-
manifest.md` (when it ships) AND verify it's set in Vercel before
the next deploy.

---

## Section 8 — Quick reference

### When to stop and ask

- DELETE / TRUNCATE / DROP — yes, ask.
- `git push --force` — yes, ask.
- `rm -rf` of anything not session-created — yes, ask.
- Editing `.env*` — yes, ask.
- Killing processes — yes, ask.
- Spending > $0.50 in a single sweep — yes, ask.

### When to just do it

- File `Edit` / `Write` in the project tree.
- `git add` / `git commit` / `git push origin main` (per saved
  feedback).
- `npm run lint:api` / `build` / `test:smoke` / `test:mobile` etc.
- `Read` / `Grep` / `Glob` — no side effects.
- Writing a migration FILE (Aden applies separately).

### When unsure

Default to **ask**. The cost of a 30-second pause is nothing; the
cost of an unwanted DELETE is hours-to-days of recovery.
