import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Dialog, DialogContent, DialogClose } from '../ui/Dialog'

// ── Utility Outreach Kit — consultant-grade pre-application packet ──────────
// Generates a project-tailored outreach packet (email + study-process intel +
// attachments checklist + follow-up playbook + phone talking points + notes)
// the developer can send to the serving utility within minutes. Pro-gated
// via the existing isPro check on /api/lens-insight.
//
// V3 §Wave 2 — workflow artifacts, not just analysis. The output is a tool
// the developer literally uses, not another summary.
export default function UtilityOutreachButton({ project, stateProgram, countyData, stage }) {
  const [generating, setGenerating] = useState(false)
  const [open, setOpen]             = useState(false)
  const [kit, setKit]               = useState(null)
  const [error, setError]           = useState(null)
  // copyKey -> 'idle' | 'copied'  (shared across copy buttons via a small map)
  const [copyState, setCopyState]   = useState({})

  const flashCopy = (key) => {
    setCopyState((s) => ({ ...s, [key]: 'copied' }))
    setTimeout(() => setCopyState((s) => ({ ...s, [key]: 'idle' })), 1800)
  }

  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text)
      flashCopy(key)
    } catch { /* clipboard blocked -- soft-fail */ }
  }

  const handleGenerate = async (e) => {
    e.stopPropagation()
    if (kit) { setOpen(true); return }   // already generated -- just re-open
    setGenerating(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setError('Sign-in required'); setGenerating(false); return }

      const res = await fetch('/api/lens-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: 'utility-outreach',
          project: { ...project, stage, technology: project.technology },
          stateProgram,
          countyData,
        }),
      })

      // Defensive parse: a Vercel platform timeout (504) returns an HTML
      // error page, not JSON. Read the body once as text, then try to
      // parse -- if it fails, surface a clean message instead of "Unexpected
      // token 'A'" from a raw JSON.parse error.
      const rawBody = await res.text()
      let json = null
      try { json = JSON.parse(rawBody) } catch {}

      if (!res.ok) {
        if (res.status === 504) {
          setError('Generation timed out. The model took too long — please retry.')
        } else if (res.status === 429) {
          setError('Rate limit hit. Wait a minute and retry.')
        } else if (res.status === 403) {
          setError('Pro subscription required.')
        } else {
          setError(json?.error || `Server error (${res.status}). Please retry.`)
        }
        setGenerating(false)
        return
      }

      if (!json) {
        // 200 OK but body wasn't JSON -- shouldn't happen, but be loud if it does.
        setError('Server returned a non-JSON response. Please retry.')
        setGenerating(false)
        return
      }

      if (!json.kit) {
        setError(json.reason || 'Generation failed. Please retry.')
        setGenerating(false)
        return
      }

      setKit(json.kit)
      setOpen(true)
    } catch (err) {
      setError(`Network error: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const fullEmailText = kit ? `Subject: ${kit.email?.subject || ''}\n\n${kit.email?.greeting || ''}\n\n${kit.email?.body || ''}\n\n${kit.email?.signOff || ''}` : ''
  const fullKitText = kit ? buildPlainTextKit(kit) : ''

  return (
    <>
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'rgba(37,99,235,0.08)', color: '#1D4ED8', border: '1px solid rgba(37,99,235,0.30)' }}
        title="Generate a tailored utility outreach packet (email + study intel + checklists)"
      >
        {generating ? (
          <>
            <span className="w-3 h-3 rounded-full border-2 border-blue-300 border-t-blue-700 animate-spin" />
            Drafting kit…
          </>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Outreach Kit
          </>
        )}
      </button>

      {error && (
        <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-red-600">{error}</span>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-5xl! p-0! w-[94vw]! max-h-[92vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          aria-describedby={undefined}
        >
          {kit && (
            <div className="flex flex-col max-h-[92vh]">

              {/* ── Flagship header — full-bleed navy gradient with topo accent ── */}
              <div
                className="relative px-8 pt-6 pb-7 shrink-0"
                style={{ background: 'linear-gradient(135deg, #0F1A2E 0%, #0A132A 50%, #0F1A2E 100%)' }}
              >
                {/* Top teal rail — V3 brand signature */}
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(20,184,166,0.55) 25%, rgba(20,184,166,0.95) 50%, rgba(20,184,166,0.55) 75%, transparent 100%)' }} />
                {/* Subtle parcel-grid overlay echoing the Tractova mark */}
                <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
                  style={{ backgroundImage: 'linear-gradient(to right, #5EEAD4 1px, transparent 1px), linear-gradient(to bottom, #5EEAD4 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

                <div className="relative flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.28em] font-semibold mb-2.5"
                      style={{ color: '#5EEAD4' }}>
                      ◆ Tractova · Utility Outreach Kit
                    </p>
                    <h2 className="font-serif text-3xl font-semibold text-white tracking-tight mb-1.5"
                      style={{ letterSpacing: '-0.02em' }}>
                      {project.name || `${project.county} County · ${project.mw} MW`}
                    </h2>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.62)' }}>
                      Pre-application packet for{' '}
                      <span className="font-semibold" style={{ color: '#FFFFFF' }}>{kit.utilityContext?.utility || 'Serving Utility'}</span>
                      {kit.utilityContext?.iso ? <> · <span className="font-mono text-[12px]">{kit.utilityContext.iso}</span></> : null}
                      {project.stage ? <> · {project.stage} stage</> : null}
                    </p>
                  </div>
                  <DialogClose asChild>
                    <button
                      className="text-white/40 hover:text-white/90 transition-colors text-2xl leading-none w-8 h-8 flex items-center justify-center -mt-1 -mr-2 shrink-0"
                      aria-label="Close"
                    >×</button>
                  </DialogClose>
                </div>
              </div>

              {/* ── Scrollable body — paper background, generous padding ── */}
              <div
                className="overflow-y-auto px-8 py-7 space-y-6 flex-1"
                style={{ background: '#FAFAF7' }}
              >

                {/* Utility context — cartographic intel strip */}
                {kit.utilityContext && (
                  <div
                    className="rounded-xl bg-white"
                    style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15, 26, 46, 0.04)' }}
                  >
                    <div className="px-5 py-2.5 border-b border-gray-100 flex items-center gap-2">
                      <span className="w-1 h-3.5 rounded-full" style={{ background: '#14B8A6' }} />
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold text-ink-muted">
                        Utility Intelligence
                      </p>
                    </div>
                    <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                      {kit.utilityContext.studyProcess && (
                        <ContextRow label="Study Process" value={kit.utilityContext.studyProcess} />
                      )}
                      {kit.utilityContext.typicalQueueWait && (
                        <ContextRow label="Typical Queue Wait" value={kit.utilityContext.typicalQueueWait} />
                      )}
                      {kit.utilityContext.relevantTariffNote && (
                        <ContextRow label="Tariff / Schedule" value={kit.utilityContext.relevantTariffNote} />
                      )}
                    </div>
                  </div>
                )}

                {/* Email block — letterhead treatment, the centerpiece */}
                {kit.email && (
                  <KitSection
                    eyebrow="01 / Pre-Application Email"
                    sublabel="Bracketed fields are placeholders — find-and-replace before sending"
                    copyKey="email"
                    copyText={fullEmailText}
                    copyState={copyState.email}
                    onCopy={copy}
                  >
                    <div
                      className="rounded-xl bg-white relative overflow-hidden"
                      style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15, 26, 46, 0.04)' }}
                    >
                      {/* Subject strip */}
                      <div className="px-6 py-3 border-b border-gray-100 flex items-baseline gap-3 flex-wrap"
                        style={{ background: 'rgba(20, 184, 166, 0.04)' }}>
                        <span className="font-mono text-[9px] uppercase tracking-[0.20em] font-semibold text-ink-muted shrink-0">Subject</span>
                        <span className="text-[13px] font-medium text-ink">{kit.email.subject}</span>
                      </div>
                      {/* Body — letterhead style */}
                      <div className="px-6 py-5 text-[13.5px] leading-[1.7] text-ink whitespace-pre-wrap">
                        <p className="mb-4">{kit.email.greeting}</p>
                        <p className="mb-4">{kit.email.body}</p>
                        <p className="font-mono text-[12px] leading-relaxed text-ink-muted whitespace-pre-wrap">{kit.email.signOff}</p>
                      </div>
                    </div>
                  </KitSection>
                )}

                {/* Three-up bento: checklist · playbook · talking points */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                  {/* Attachments checklist */}
                  {Array.isArray(kit.attachmentsChecklist) && kit.attachmentsChecklist.length > 0 && (
                    <KitSection
                      eyebrow="02 / Attachments"
                      compact
                      copyKey="attach"
                      copyText={kit.attachmentsChecklist.map((s, i) => `${i + 1}. ${s}`).join('\n')}
                      copyState={copyState.attach}
                      onCopy={copy}
                    >
                      <div
                        className="rounded-xl bg-white px-5 py-4 h-full"
                        style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15, 26, 46, 0.04)' }}
                      >
                        <ol className="space-y-2.5 text-[13px] text-ink">
                          {kit.attachmentsChecklist.map((item, i) => (
                            <li key={i} className="flex gap-2.5">
                              <span className="font-mono text-[10px] tabular-nums font-semibold mt-1 shrink-0" style={{ color: '#0F766E' }}>
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </KitSection>
                  )}

                  {/* Follow-up playbook */}
                  {Array.isArray(kit.followUpPlaybook) && kit.followUpPlaybook.length > 0 && (
                    <KitSection
                      eyebrow="03 / Follow-Up Playbook"
                      compact
                      copyKey="followup"
                      copyText={kit.followUpPlaybook.join('\n')}
                      copyState={copyState.followup}
                      onCopy={copy}
                    >
                      <div
                        className="rounded-xl bg-white px-5 py-4 h-full"
                        style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15, 26, 46, 0.04)' }}
                      >
                        <ol className="space-y-3 text-[13px] text-ink">
                          {kit.followUpPlaybook.map((item, i) => (
                            <li key={i} className="flex gap-2.5">
                              <span className="w-5 h-5 rounded-full text-white text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5"
                                style={{ background: '#0F766E' }}>
                                {i + 1}
                              </span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </KitSection>
                  )}

                  {/* Phone talking points */}
                  {Array.isArray(kit.phoneTalkingPoints) && kit.phoneTalkingPoints.length > 0 && (
                    <KitSection
                      eyebrow="04 / Phone Talking Points"
                      compact
                      copyKey="talk"
                      copyText={kit.phoneTalkingPoints.map(s => `• ${s}`).join('\n')}
                      copyState={copyState.talk}
                      onCopy={copy}
                    >
                      <div
                        className="rounded-xl bg-white px-5 py-4 h-full"
                        style={{ border: '1px solid #E2E8F0', boxShadow: '0 1px 2px rgba(15, 26, 46, 0.04)' }}
                      >
                        <ul className="space-y-2.5 text-[13px] text-ink">
                          {kit.phoneTalkingPoints.map((item, i) => (
                            <li key={i} className="flex gap-2.5">
                              <span className="mt-1.5 leading-none shrink-0" style={{ color: '#14B8A6' }}>▸</span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </KitSection>
                  )}

                </div>

                {/* Notes — amber heads-up callout */}
                {kit.notes && (
                  <div
                    className="rounded-xl px-5 py-4 flex gap-4"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.28)' }}
                  >
                    <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(245,158,11,0.16)', color: '#B45309' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold mb-1" style={{ color: '#B45309' }}>
                        Heads Up · {kit.utilityContext?.utility || 'This Utility'}
                      </p>
                      <p className="text-[13px] text-ink leading-relaxed">{kit.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Footer — full-bleed paper, primary CTA + dismiss ── */}
              <div
                className="px-8 py-4 flex items-center justify-between gap-4 shrink-0"
                style={{ background: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}
              >
                <p className="text-[11px] text-ink-muted leading-relaxed flex-1">
                  Review carefully before sending. Tractova synthesizes from public ISO + utility data; verify specifics against the utility's own application portal.
                </p>
                <div className="flex items-center gap-3 shrink-0">
                  <DialogClose asChild>
                    <button className="text-[11px] font-mono uppercase tracking-[0.18em] font-semibold text-ink-muted hover:text-ink px-3 py-2">
                      Close
                    </button>
                  </DialogClose>
                  <button
                    onClick={() => copy('all', fullKitText)}
                    className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.18em] font-semibold px-4 py-2 rounded-lg text-white transition-transform hover:-translate-y-px"
                    style={{ background: '#0F1A2E', boxShadow: '0 1px 2px rgba(15, 26, 46, 0.18)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                    {copyState.all === 'copied' ? 'Copied' : 'Copy entire kit'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ContextRow({ label, value }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted mb-0.5">{label}</p>
      <p className="text-[12px] text-ink leading-relaxed">{value}</p>
    </div>
  )
}

function KitSection({ eyebrow, sublabel, copyKey, copyText, copyState, onCopy, compact = false, children }) {
  return (
    <section className={compact ? 'flex flex-col h-full' : ''}>
      <div className={`flex items-center justify-between gap-3 ${compact ? 'mb-2' : 'mb-2.5'}`}>
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: '#0F766E' }}>
            {eyebrow}
          </p>
          {sublabel && (
            <p className="text-[10px] text-ink-muted mt-0.5 italic">{sublabel}</p>
          )}
        </div>
        <button
          onClick={() => onCopy(copyKey, copyText)}
          className="font-mono text-[9.5px] uppercase tracking-[0.18em] font-semibold px-2.5 py-1 rounded-md transition-colors shrink-0"
          style={{
            color: copyState === 'copied' ? '#0F766E' : '#5A6B7A',
            border: '1px solid',
            borderColor: copyState === 'copied' ? 'rgba(15,118,110,0.40)' : 'rgba(90,107,122,0.22)',
            background: copyState === 'copied' ? 'rgba(15,118,110,0.07)' : 'transparent',
          }}
        >
          {copyState === 'copied' ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      {compact ? <div className="flex-1">{children}</div> : children}
    </section>
  )
}

// Plain-text serializer for the entire kit -- used by the "Copy entire kit"
// button so the developer can paste the whole packet into Notion / Docs.
function buildPlainTextKit(kit) {
  const lines = []
  if (kit.utilityContext) {
    lines.push(`UTILITY: ${kit.utilityContext.utility || ''}${kit.utilityContext.iso ? ` (${kit.utilityContext.iso})` : ''}`)
    if (kit.utilityContext.studyProcess)      lines.push(`Study process: ${kit.utilityContext.studyProcess}`)
    if (kit.utilityContext.typicalQueueWait)  lines.push(`Typical queue wait: ${kit.utilityContext.typicalQueueWait}`)
    if (kit.utilityContext.relevantTariffNote) lines.push(`Tariff/schedule: ${kit.utilityContext.relevantTariffNote}`)
    lines.push('')
  }
  if (kit.email) {
    lines.push('--- PRE-APPLICATION EMAIL ---')
    lines.push(`Subject: ${kit.email.subject || ''}`)
    lines.push('')
    lines.push(kit.email.greeting || '')
    lines.push('')
    lines.push(kit.email.body || '')
    lines.push('')
    lines.push(kit.email.signOff || '')
    lines.push('')
  }
  if (Array.isArray(kit.attachmentsChecklist) && kit.attachmentsChecklist.length) {
    lines.push('--- ATTACHMENTS CHECKLIST ---')
    kit.attachmentsChecklist.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
    lines.push('')
  }
  if (Array.isArray(kit.followUpPlaybook) && kit.followUpPlaybook.length) {
    lines.push('--- FOLLOW-UP PLAYBOOK ---')
    kit.followUpPlaybook.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
    lines.push('')
  }
  if (Array.isArray(kit.phoneTalkingPoints) && kit.phoneTalkingPoints.length) {
    lines.push('--- PHONE TALKING POINTS ---')
    kit.phoneTalkingPoints.forEach((s) => lines.push(`• ${s}`))
    lines.push('')
  }
  if (kit.notes) {
    lines.push('--- NOTES ---')
    lines.push(kit.notes)
  }
  return lines.join('\n')
}
