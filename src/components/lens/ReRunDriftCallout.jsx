import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'
import { logProjectEvent } from '../../lib/projectEvents'
import { computeSubScores, safeScore } from '../../lib/scoreEngine'

// Re-run drift callout — renders on the ?fromProject= path. Recomputes the
// project's sub-scores against live state/county data, compares the composite
// to the project's stored baseline, and offers a "Save updates back" write
// (composite + cs_status + ix_difficulty → the projects row, with a
// score_change audit event when the delta is material).
//
// Extracted from Search.jsx (was a ~110-line IIFE inline in the results JSX).
// Owns its own save state; the parent only supplies reRunOf + a setter so the
// baseline can refresh after a successful write.
export default function ReRunDriftCallout({ reRunOf, setReRunOf, results, user }) {
  const toast = useToast()
  const [reRunSaving, setReRunSaving] = useState(false)
  const [reRunSaved, setReRunSaved] = useState(false)

  if (!reRunOf || !results) return null

  const sub = computeSubScores(results.stateProgram, results.countyData, results.form.stage, results.form.technology)
  const newScore = safeScore(sub)
  const baseline = reRunOf.baselineScore
  const delta = (newScore != null && baseline != null) ? newScore - baseline : null
  const drift = delta != null && Math.abs(delta) >= 2
  const csChanged = results.stateProgram?.csStatus && reRunOf.baselineCsStatus && results.stateProgram.csStatus !== reRunOf.baselineCsStatus
  const ixChanged = results.stateProgram?.ixDifficulty && reRunOf.baselineIxDifficulty && results.stateProgram.ixDifficulty !== reRunOf.baselineIxDifficulty
  const anyDrift = drift || csChanged || ixChanged
  const accent = drift && delta > 0 ? '#0F766E' : drift && delta < 0 ? '#B45309' : '#0F1A2E'
  const bg = drift && delta > 0 ? 'rgba(15,118,110,0.06)' : drift && delta < 0 ? 'rgba(217,119,6,0.06)' : 'rgba(15,26,46,0.04)'
  const border = drift && delta > 0 ? 'rgba(15,118,110,0.25)' : drift && delta < 0 ? 'rgba(217,119,6,0.30)' : 'rgba(15,26,46,0.18)'

  const handleSaveBack = async () => {
    if (!user || !reRunOf.id || reRunSaving) return
    setReRunSaving(true)
    try {
      const update = {
        opportunity_score:   newScore,
        last_observed_score: newScore,
        cs_status:           results.stateProgram?.csStatus ?? reRunOf.baselineCsStatus,
        cs_program:          results.stateProgram?.csProgram ?? null,
        ix_difficulty:       results.stateProgram?.ixDifficulty ?? reRunOf.baselineIxDifficulty,
        serving_utility:     results.countyData?.interconnection?.servingUtility ?? null,
      }
      const { error } = await supabase.from('projects').update(update).eq('id', reRunOf.id)
      if (error) {
        toast.error('Could not save updates', { description: error.message?.slice(0, 200) })
        setReRunSaving(false)
        return
      }
      // Audit log a score_change event when the delta is material. Mirrors the
      // Library audit threshold (5 pts).
      if (delta != null && Math.abs(delta) >= 5) {
        try {
          await logProjectEvent({
            projectId: reRunOf.id,
            userId:    user.id,
            kind:      'score_change',
            detail:    `Index ${delta > 0 ? 'rose' : 'fell'}: ${baseline} → ${newScore} (${delta > 0 ? '+' : ''}${delta} pts) following Re-run with latest data`,
            meta:      { previous: baseline, current: newScore, delta, trigger: 'rerun' },
          })
        } catch { /* audit failures must not block UI */ }
      }
      // Reflect the new baseline locally so a second "Save" doesn't show stale
      // drift, and disable the button.
      setReRunOf((prev) => prev ? ({ ...prev, baselineScore: newScore, baselineCsStatus: update.cs_status, baselineIxDifficulty: update.ix_difficulty }) : prev)
      setReRunSaved(true)
      toast.success('Project updated', {
        eyebrow: '◆ Saved back',
        description: `${reRunOf.name} · score ${baseline ?? '—'} → ${newScore}`,
      })
    } catch (err) {
      toast.error('Save failed', { description: err?.message?.slice(0, 200) || 'Please try again.' })
    } finally {
      setReRunSaving(false)
    }
  }

  return (
    <div
      className="mb-5 rounded-lg px-4 py-3 flex items-start gap-3"
      style={{ background: bg, border: `1px solid ${border}` }}
      role="region"
      aria-label="Re-run drift summary"
    >
      <div className="shrink-0 mt-0.5 w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${accent}1F`, border: `1px solid ${accent}33` }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {drift && delta > 0
            ? <polyline points="6 15 12 9 18 15" />
            : drift && delta < 0
              ? <polyline points="6 9 12 15 18 9" />
              : <><circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>}
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="eyebrow-mono" style={{ color: accent }}>
          Re-run · {reRunOf.name}
        </p>
        {anyDrift ? (
          <p className="text-[13px] text-ink leading-snug mt-0.5">
            {drift && (
              <>
                Composite score {delta > 0 ? 'rose' : 'fell'}{' '}
                <span className="font-mono font-semibold tabular-nums" style={{ color: accent }}>
                  {baseline ?? '—'} → {newScore} ({delta > 0 ? '+' : ''}{delta} pt)
                </span>
                {(csChanged || ixChanged) && ' · '}
              </>
            )}
            {csChanged && <span>CS Program <span className="font-medium">{reRunOf.baselineCsStatus} → {results.stateProgram.csStatus}</span> · </span>}
            {ixChanged && <span>IX <span className="font-medium">{reRunOf.baselineIxDifficulty} → {results.stateProgram.ixDifficulty}</span></span>}
          </p>
        ) : (
          <p className="text-[13px] text-ink leading-snug mt-0.5">
            No material drift since {reRunOf.savedAt ? new Date(reRunOf.savedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'last save'} — composite, CS status, and IX difficulty all hold.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleSaveBack}
        disabled={reRunSaving || reRunSaved || newScore == null}
        className="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: accent, color: 'white' }}
        title="Write the new composite + CS + IX values back to this project"
      >
        {reRunSaved ? '✓ Saved back' : reRunSaving ? 'Saving…' : 'Save updates back'}
      </button>
    </div>
  )
}
