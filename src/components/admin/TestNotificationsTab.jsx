import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const ADMIN_EMAIL = 'aden.walker67@gmail.com'

// ─────────────────────────────────────────────────────────────────────────────
// Test Notifications — admin-only panel for triggering test emails / Slack
// ─────────────────────────────────────────────────────────────────────────────
export default function TestNotificationsTab() {
  const [running, setRunning] = useState(null)  // 'digest' | 'email' | 'slack' | null
  const [result, setResult] = useState(null)    // { kind, ok, message }

  const trigger = async (kind) => {
    setRunning(kind)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not signed in. Refresh the page and try again.')

      const endpoint = kind === 'digest'
        ? '/api/send-digest'
        : kind === 'opportunity'
          ? '/api/send-alerts?channel=email&type=opportunity'
          : `/api/send-alerts${kind === 'slack' ? '?channel=slack' : '?channel=email'}`

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ test: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      const sent = json.sent ?? 0
      const slackSent = json.slack?.sent ?? 0
      const where = kind === 'digest'
        ? `Email sent to ${ADMIN_EMAIL}`
        : kind === 'email'
          ? `Email sent to ${ADMIN_EMAIL} (${sent} message${sent !== 1 ? 's' : ''})`
          : kind === 'opportunity'
            ? `Opportunity email sent to ${ADMIN_EMAIL} (${sent} message${sent !== 1 ? 's' : ''})`
            : `Slack message posted to your saved webhook (${slackSent} sent)`
      setResult({ kind, ok: true, message: `✓ ${where}. Check inbox / channel — subject prefixed with [TEST].` })
    } catch (err) {
      setResult({ kind, ok: false, message: `✗ ${err.message}` })
    } finally {
      setRunning(null)
    }
  }

  const buttons = [
    {
      kind: 'digest',
      label: 'Send Test Weekly Digest',
      desc: 'Fires the Monday 14:00 UTC digest for your account only. Review header, portfolio meta, Markets in Motion, project cards, footer.',
      bg: '#0F1A2E',
    },
    {
      kind: 'email',
      label: 'Send Test Email Alert',
      desc: 'Fires the policy-alert email template. Synthesizes a sample urgent alert if no real alerts exist on your saved projects.',
      bg: '#D97706',
    },
    {
      kind: 'opportunity',
      label: 'Send Test Opportunity Alert',
      desc: 'Fires the positive-event email template — capacity expansions, new program launches, score improvements. Synthesizes a sample upside opportunity (teal accent rail, "MARKET OPPORTUNITY" eyebrow, ↑ delta).',
      bg: '#0F766E',
    },
    {
      kind: 'slack',
      label: 'Send Test Slack Alert',
      desc: 'Posts a Block Kit alert to the webhook URL saved in your Profile → Slack delivery section. Fails clearly if no webhook configured.',
      bg: '#14B8A6',
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.20em] font-bold text-ink-muted mb-1.5">Test Notifications</p>
        <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">
          Fire a one-shot test of each notification template against your admin account. All deliveries are scoped to <span className="font-mono text-ink">{ADMIN_EMAIL}</span> and your saved Slack webhook — no other users are touched. Subjects are prefixed with <span className="font-mono">[TEST]</span> so you can filter / delete after review.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {buttons.map(b => (
          <div key={b.kind} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col">
            <p className="font-serif text-base font-semibold text-ink leading-tight" style={{ letterSpacing: '-0.015em' }}>
              {b.label.replace('Send Test ', '')}
            </p>
            <p className="text-xs text-gray-500 leading-relaxed mt-2 flex-1">{b.desc}</p>
            <button
              onClick={() => trigger(b.kind)}
              disabled={running !== null}
              className="mt-4 inline-flex items-center justify-center gap-2 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: b.bg }}
            >
              {running === b.kind ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Sending…
                </>
              ) : b.label}
            </button>
          </div>
        ))}
      </div>

      {result && (
        <div
          className="rounded-lg px-4 py-3"
          style={{
            background: result.ok ? 'rgba(20,184,166,0.06)' : 'rgba(220,38,38,0.06)',
            border: `1px solid ${result.ok ? 'rgba(20,184,166,0.30)' : 'rgba(220,38,38,0.30)'}`,
          }}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold mb-1" style={{ color: result.ok ? '#0F766E' : '#991B1B' }}>
            {result.ok ? 'Success' : 'Failed'} · {result.kind}
          </p>
          <p className="text-sm text-ink leading-relaxed">{result.message}</p>
        </div>
      )}

      <div className="rounded-lg px-4 py-3 mt-4" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.25)' }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] font-bold mb-1" style={{ color: '#92400E' }}>
          Note · Temporary tooling
        </p>
        <p className="text-xs text-gray-700 leading-relaxed">
          This panel exists for QA review of the notification templates and Slack integration. The endpoints accept admin JWTs in addition to the Vercel cron header — production cron behavior is unchanged.
        </p>
      </div>
    </div>
  )
}
