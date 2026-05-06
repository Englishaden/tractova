# Security Rotation Log

> Operational log of secret rotations + accepted-risk advisory reviews.
> Update this file every time you rotate a key or review a CVE
> allowlist row. Cadences come from `docs/secrets-manifest.md`.
>
> **Today's date** (current canonical reference): **2026-05-06**.

---

## Secret rotation tracker

Rotation cadences enforced by humans (calendar reminders) — no automation.
On rotation, update `last_rotated` to today's date and `next_due` to the
new horizon, and verify Vercel + 1Password + `.env.local` all hold the
new value before declaring done.

| Secret | Cadence | Last rotated | Next due | Status |
|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | quarterly | 2026-05-06 (baseline) | 2026-08-06 | OK |
| `STRIPE_WEBHOOK_SECRET` | quarterly | 2026-05-06 (baseline) | 2026-08-06 | OK |
| `RESEND_API_KEY` | semi-annual | 2026-05-06 (baseline) | 2026-11-06 | OK |
| `CRON_SECRET` | semi-annual | 2026-05-06 (baseline) | 2026-11-06 | OK |
| `SUPABASE_SERVICE_ROLE_KEY` | annual | 2026-05-06 (baseline) | 2027-05-06 | OK |
| `ANTHROPIC_API_KEY` | annual | 2026-05-06 (baseline) | 2027-05-06 | OK |

Status legend:
- **OK** — current rotation horizon not yet reached.
- **DUE** — within 14 days of `next_due` — schedule rotation now.
- **OVERDUE** — past `next_due` — rotate immediately.

> **Baseline note (2026-05-06):** these are the project-inception
> secrets. The "last rotated" entries are placeholders for the first
> review cycle; they will be replaced with real rotation dates as each
> secret is rotated for the first time.

---

## Accepted-risk advisory log

Maintained alongside `scripts/audit-allowlist.json`. Each row here mirrors
an entry there and gets a quarterly review for "is this still acceptable?"

| GHSA | Package | Severity | First seen | Review due | Last reviewed | Decision |
|---|---|---|---|---|---|---|
| GHSA-36jr-mh4h-2g58 | d3-color | high | 2026-05-06 | 2026-08-06 | 2026-05-06 | Accept; transitive via react-simple-maps@3.0.0; no user input reaches the regex; track upstream 4.0.0 stable |
| GHSA-v2v4-37r5-5v8g | ip-address | moderate | 2026-05-06 | 2026-08-06 | 2026-05-06 | Accept; transitive via shadcn (build-time CLI, not runtime); awaiting upstream patch |
| GHSA-4r6h-8v6p-xvw6 | xlsx | high | 2026-05-06 | 2026-08-06 | 2026-05-06 | Accept; lazy-loaded export-only, write-only flow, no parsing of user-uploaded data |
| GHSA-5pgg-2g8v-p4x9 | xlsx | high | 2026-05-06 | 2026-08-06 | 2026-05-06 | Accept; same xlsx root as the prototype-pollution row above |

Quarterly review checklist (run on each `review_due` for each row):
1. Has the upstream package shipped a fix? (`npm view <pkg> versions --json`)
2. Has the threat model changed? (e.g. did we add a flow that now feeds user input to the vulnerable code path?)
3. If "still accept": bump `review_due` by 90 days and update the audit-allowlist.json entry's `review_due`.
4. If "no longer acceptable": upgrade the dep or migrate to an alternative; remove from allowlist.

---

## Disaster-recovery drill log

Rotation cadence for full restore-from-snapshot drill:
- **Annually** at minimum, plus on any schema-shape change.
- Quarterly **dry-run** (no live writes) recommended.

| Drill date | Type | Result | Notes |
|---|---|---|---|
| 2026-05-06 | First snapshot + dry-run restore | ✓ 22 tables / 19,146 rows / 11.1 MB; dry-run loader validated 0 errors | Snapshot script's TABLES list had 8 wrong names (drift from migrations); corrected during drill |

---

## Last reviewed

2026-05-06 (baseline). Next review: 2026-08-06.
