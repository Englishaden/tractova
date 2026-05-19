import NwiCoverageCard from './NwiCoverageCard.jsx'
import IxFreshnessCard from './IxFreshnessCard.jsx'
import MonthlyCronCard from './MonthlyCronCard.jsx'
import CurationDriftRow from './CurationDriftRow.jsx'
import CsStatusAuditRow from './CsStatusAuditRow.jsx'
import LoadingDot from '../ui/LoadingDot.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// Mission Control — single-screen system-health executive snapshot
// ─────────────────────────────────────────────────────────────────────────────
// Renders at the top of DataHealthTab. Three KPI cards:
//   1. NWI coverage gauge (live geospatial seed completion %)
//   2. IX freshness — per-ISO pills, colored by staleness
//   3. Substations cron — latency bar vs the 60s function ceiling
// Plus a usage-signals row (Scenario Studio saves + churn-defense surveys).
//
// Visual language: matches the rest of the platform (mono uppercase eyebrows,
// serif titles, tinted bordered panels, brand teal/amber/navy palette).

export default function MissionControl({ missionControl, cronRuns }) {
  if (!missionControl) {
    // Skeleton during initial load — keeps layout stable
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-5 py-5">
        <LoadingDot message="Loading mission control" />
      </div>
    )
  }

  const { nwi_coverage, ix_freshness, scenario_snapshots_count, cancellation_feedback_count } = missionControl
  const monthlyRun = (cronRuns || []).find((r) => r.cron_name === 'monthly-data-refresh' && r.status === 'success') || null

  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, rgba(15,26,46,0.025) 0%, rgba(15,26,46,0.05) 100%)',
        border: '1px solid rgba(15,26,46,0.10)',
      }}
    >
      {/* Header eyebrow — wraps on narrow viewports so the timestamp drops
          to its own line instead of colliding with the eyebrow text. */}
      <div
        className="px-5 py-3 flex items-baseline justify-between gap-3 border-b flex-wrap"
        style={{ borderColor: 'rgba(15,26,46,0.08)', background: 'rgba(15,26,46,0.04)' }}
      >
        <div className="flex items-baseline gap-3 flex-wrap">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.22em] font-bold"
            style={{ color: '#0F1A2E' }}
          >
            ◆ Mission Control
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-gray-400">
            executive snapshot · live data
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-gray-400">
          {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>

      {/* 3-card KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
        <NwiCoverageCard data={nwi_coverage} />
        <IxFreshnessCard freshness={ix_freshness} />
        <MonthlyCronCard run={monthlyRun} />
      </div>

      {/* Curation drift row — flags state_programs entries past their
          warn threshold (>30d). The audit identified state_programs.capacity_mw
          as the highest-impact hand-curated value (drives Runway + Feasibility
          Index), so surfacing staleness here forces visibility before users
          see overstated numbers. Hidden when nothing is drifting. */}
      <CurationDriftRow
        drift={missionControl.state_programs_drift || []}
        thresholds={missionControl.state_programs_drift_thresholds || { warn_days: 30, urgent_days: 60 }}
      />

      {/* cs_status accuracy audit — joins curated state_programs.cs_status
          against operational MW from cs_projects (NREL Sharing the Sun).
          Flags states whose curated label doesn't match deployment reality.
          Read-only triage queue; user fixes via the State Programs editor. */}
      <CsStatusAuditRow audit={missionControl.cs_status_audit || null} />

      {/* Usage signals — small horizontal row */}
      <div className="border-t border-gray-100 px-5 py-3 bg-white flex items-center gap-6 flex-wrap">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-gray-400 font-bold">
          Usage signals
        </span>
        <UsageStat
          label="Scenario Studio saves"
          value={scenario_snapshots_count}
          color="#0F766E"
        />
        <UsageStat
          label="Churn-defense surveys"
          value={cancellation_feedback_count}
          color="#D97706"
        />
      </div>
    </section>
  )
}

// ── Small inline KPI for the usage-signals row ──
function UsageStat({ label, value, color }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-sm font-bold tabular-nums" style={{ color }}>
        {Number(value || 0).toLocaleString()}
      </span>
      <span className="text-[11px] text-gray-500">{label}</span>
    </div>
  )
}
