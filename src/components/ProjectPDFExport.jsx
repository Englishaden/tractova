import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer'
import { SCENARIO_DISCLAIMER, formatScenarioSummary } from '../lib/scenarioEngine'

// ── V3 Brand tokens ───────────────────────────────────────────────────────────
// PDF-native fonts only (Times/Courier/Helvetica) so we avoid Font.register
// network risk. Fonts approximate the platform: Times for serif headlines,
// Courier for monospace numerics + mono caps eyebrows, Helvetica for body.
const NAVY       = '#0F1A2E'   // brand chrome
const TEAL       = '#0F766E'   // V3 accent (replaces legacy emerald #0F766E)
const TEAL_LIGHT = '#ECFDF5'   // teal-50ish — pull-block bg
const TEAL_DARK  = '#0F766E'   // teal-700 — body accent
const AMBER      = '#D97706'   // V3 amber (replaces legacy #BA7517) — IX/caution
const INK        = '#0A1828'   // V3 ink — primary text
const INK_MUTED  = '#5A6B7A'   // V3 ink-muted — secondary text
const PAPER      = '#FAFAF7'   // V3 paper background
const BORDER     = '#E2E8F0'   // V3 border-subtle hairline
const GRAY_900   = '#0A1828'   // alias to INK for legacy refs
const GRAY_700   = '#374151'
const GRAY_500   = '#5A6B7A'
const GRAY_300   = '#D1D5DB'
const GRAY_100   = '#F3F4F6'
const RED        = '#DC2626'

// Built-in PDF font family names — these don't need Font.register()
const FONT_SERIF = 'Times-Roman'
const FONT_SERIF_BOLD = 'Times-Bold'
const FONT_MONO = 'Courier'
const FONT_MONO_BOLD = 'Courier-Bold'
const FONT_SANS = 'Helvetica'
const FONT_SANS_BOLD = 'Helvetica-Bold'

const PIPELINE_STAGES = [
  'Prospecting', 'Site Control', 'Pre-Development', 'Development',
  'NTP (Notice to Proceed)', 'Construction', 'Operational',
]
const PIPELINE_SHORT = ['Prospect', 'Site Ctrl', 'Pre-Dev', 'Dev', 'NTP', 'Construct', 'Oper.']

const CS_STATUS_LABEL = {
  active:  'Active',
  limited: 'Limited Capacity',
  pending: 'Pending Launch',
  none:    'No Program',
}
const IX_LABEL = {
  easy:      'Easy',
  moderate:  'Moderate',
  hard:      'Hard',
  very_hard: 'Very Hard',
}

// ── V3 Styles ─────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: FONT_SANS,
    backgroundColor: '#FFFFFF',
    paddingTop: 36,
    paddingBottom: 32,
    paddingHorizontal: 48,
  },

  // Top teal accent rail (renders as a 1.5px-tall colored rect)
  topRail: { height: 1.5, backgroundColor: TEAL, marginBottom: 16, marginTop: -16 },

  // Header — wordmark in serif, mono caps eyebrow + date
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  logo:   { fontSize: 22, fontFamily: FONT_SERIF_BOLD, color: INK, letterSpacing: -0.4 },
  logoSub: { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: TEAL_DARK, letterSpacing: 1.6, marginTop: 4, textTransform: 'uppercase' },
  headerDate: { fontSize: 7, fontFamily: FONT_MONO, color: INK_MUTED, letterSpacing: 1.0, textTransform: 'uppercase' },

  divider: { borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 14 },
  dividerLight: { borderBottomWidth: 1, borderBottomColor: GRAY_100, marginBottom: 12 },

  sectionLabel: {
    fontSize: 7,
    fontFamily: FONT_MONO_BOLD,
    color: INK_MUTED,
    letterSpacing: 2.0,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  // Project identity — serif name, mono caps meta
  projectName: { fontSize: 22, fontFamily: FONT_SERIF_BOLD, color: INK, marginBottom: 4, letterSpacing: -0.5 },
  projectMeta: { fontSize: 9, fontFamily: FONT_MONO, color: INK_MUTED, letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },

  badgeRow: { flexDirection: 'row', marginBottom: 16 },
  badge: {
    fontSize: 7.5,
    fontFamily: FONT_MONO_BOLD,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
    marginRight: 6,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  // Score — large mono numeric (was Helvetica-Bold)
  scoreRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  scoreNum:  { fontSize: 36, fontFamily: FONT_MONO_BOLD, marginRight: 14, letterSpacing: -1 },
  scoreBarTrack: { height: 4, backgroundColor: BORDER, borderRadius: 2, marginBottom: 5 },
  scoreBarFill:  { height: 4, borderRadius: 2 },
  scoreLabel: { fontSize: 7.5, fontFamily: FONT_MONO_BOLD, marginTop: 2, letterSpacing: 1.4, textTransform: 'uppercase' },

  // Data table — mono labels, mono numerics for values that look like data
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_100,
  },
  dataLabel: { fontSize: 8, fontFamily: FONT_MONO, color: INK_MUTED, letterSpacing: 0.6, width: 130, textTransform: 'uppercase' },
  dataValue: { fontSize: 8.5, fontFamily: FONT_SANS_BOLD, color: INK, flex: 1 },

  // Blocks — V3 paper-tinted
  tealBlock: {
    backgroundColor: TEAL_LIGHT,
    borderLeftWidth: 2,
    borderLeftColor: TEAL,
    padding: 11,
    marginBottom: 10,
  },
  grayBlock: {
    backgroundColor: PAPER,
    borderLeftWidth: 2,
    borderLeftColor: BORDER,
    padding: 11,
    marginBottom: 10,
  },
  blockText: { fontSize: 9, fontFamily: FONT_SANS, color: INK, lineHeight: 1.55 },
  tealText:  { fontSize: 9, fontFamily: FONT_SANS, color: INK, lineHeight: 1.55 },

  // Pipeline
  pipelineRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  pipelineLabels: { flexDirection: 'row' },
  pipelineLabelCell: { flex: 1, alignItems: 'center' },

  // Footer — mono caps brand line
  footer: {
    marginTop: 'auto',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footerBrand:      { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: INK, letterSpacing: 1.6, textTransform: 'uppercase' },
  footerDisclaimer: { fontSize: 7, fontFamily: FONT_SANS, color: INK_MUTED, maxWidth: 300, textAlign: 'right', lineHeight: 1.5 },
})

// ── Sub-components ────────────────────────────────────────────────────────────

function DataRow({ label, value }) {
  if (value == null || value === '') return null
  return (
    <View style={s.dataRow}>
      <Text style={s.dataLabel}>{label}</Text>
      <Text style={s.dataValue}>{String(value)}</Text>
    </View>
  )
}

function ScoreBar({ score }) {
  const pct   = Math.max(0, Math.min(score / 100, 1))
  const color = score >= 70 ? TEAL : score >= 50 ? AMBER : RED
  const label = score >= 70 ? 'Strong market' : score >= 50 ? 'Moderate market' : 'Weak market'
  return (
    <View style={s.scoreRow}>
      <Text style={[s.scoreNum, { color }]}>{score}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[s.sectionLabel, { marginBottom: 5 }]}>Feasibility Index</Text>
        <View style={s.scoreBarTrack}>
          <View style={[s.scoreBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
        <Text style={[s.scoreLabel, { color }]}>{label}</Text>
      </View>
    </View>
  )
}

function PipelineViz({ stage }) {
  const activeIdx = PIPELINE_STAGES.indexOf(stage)
  return (
    <View>
      <View style={s.pipelineRow}>
        {PIPELINE_STAGES.map((st, i) => {
          const done    = i < activeIdx
          const current = i === activeIdx
          return (
            <View
              key={st}
              style={{ flexDirection: 'row', alignItems: 'center', flex: i < PIPELINE_STAGES.length - 1 ? 1 : 0 }}
            >
              <View style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: current ? '#FFFFFF' : done ? TEAL : GRAY_300,
                borderWidth: current ? 2 : 0,
                borderColor: current ? TEAL : 'transparent',
              }} />
              {i < PIPELINE_STAGES.length - 1 && (
                <View style={{ flex: 1, height: 1.5, backgroundColor: done ? TEAL : GRAY_300 }} />
              )}
            </View>
          )
        })}
      </View>
      <View style={s.pipelineLabels}>
        {PIPELINE_SHORT.map((label, i) => {
          const current = i === activeIdx
          return (
            <View key={label} style={[s.pipelineLabelCell, i === PIPELINE_STAGES.length - 1 ? { flex: 0 } : {}]}>
              <Text style={{
                fontSize: 6.5,
                textAlign: 'center',
                color: current ? TEAL : GRAY_300,
                fontFamily: current ? 'Helvetica-Bold' : 'Helvetica',
              }}>
                {label}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

// ── AI Memo block — IC-grade analyst commentary (V3 Deal Memo) ──────────────
function AIMemoSection({ memo }) {
  if (!memo) return null
  const cards = [
    { label: 'Site Control Assessment', text: memo.siteControlSummary },
    { label: 'Interconnection Outlook', text: memo.ixSummary },
    { label: 'Revenue Positioning',     text: memo.revenueSummary },
  ].filter(c => c.text)
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text style={[s.sectionLabel, { marginBottom: 0, marginRight: 8 }]}>AI Deal Memo</Text>
        <Text style={{ fontSize: 6.5, fontFamily: FONT_MONO_BOLD, color: TEAL_DARK, backgroundColor: TEAL_LIGHT, paddingHorizontal: 5, paddingVertical: 2, letterSpacing: 1.4, textTransform: 'uppercase' }}>
          ◆ AI · Claude
        </Text>
      </View>
      {cards.map(({ label, text }) => (
        <View key={label} style={{ marginBottom: 9 }}>
          <Text style={{ fontSize: 7, fontFamily: FONT_MONO_BOLD, color: TEAL_DARK, marginBottom: 3, letterSpacing: 1.4, textTransform: 'uppercase' }}>{label}</Text>
          <Text style={{ fontSize: 9.5, fontFamily: FONT_SANS, color: INK, lineHeight: 1.5 }}>{text}</Text>
        </View>
      ))}
      {memo.recommendation && (
        <View style={{ marginTop: 6, paddingTop: 9, paddingBottom: 9, paddingLeft: 11, paddingRight: 11, borderLeftWidth: 2, borderLeftColor: TEAL, backgroundColor: TEAL_LIGHT }}>
          <Text style={{ fontSize: 7, fontFamily: FONT_MONO_BOLD, color: TEAL_DARK, marginBottom: 3, letterSpacing: 1.4, textTransform: 'uppercase' }}>Recommendation</Text>
          <Text style={{ fontSize: 11, fontFamily: FONT_SERIF_BOLD, color: INK, lineHeight: 1.4, letterSpacing: -0.1 }}>{memo.recommendation}</Text>
        </View>
      )}
    </View>
  )
}

// ── PDF Document ──────────────────────────────────────────────────────────────
// ── Scenario Studio section ──────────────────────────────────────────────────
// Renders only when the caller passes a saved scenario. Two-column metrics
// strip (Year 1 revenue + simple payback) + summary line + disclaimer.
function ScenarioSection({ scenario }) {
  if (!scenario) return null
  const out = scenario.outputs || {}
  const summary = scenario.scenario_inputs && scenario.baseline_inputs
    ? formatScenarioSummary(
        { inputs: scenario.scenario_inputs, outputs: out },
        { inputs: scenario.baseline_inputs },
      )
    : ''
  return (
    <View>
      <Text style={s.sectionLabel}>Selected Scenario · {scenario.name}</Text>
      {/* 2x4 metric grid mirrors the Studio output card. Each cell is a
          tile with a label + bold mono numeric — matches the data-density
          aesthetic used elsewhere in the PDF. */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>
        <ScenarioMetricTile label="Year 1 Revenue" value={`$${formatLargeUSD(out.year1Revenue)}`} suffix="/yr" />
        <ScenarioMetricTile label="Simple Payback" value={out.paybackYears != null ? `${out.paybackYears} yr` : '—'} />
        <ScenarioMetricTile label="IRR · project" value={out.irr != null ? `${(out.irr * 100).toFixed(1)}%` : '—'} />
        <ScenarioMetricTile label="IRR · equity" value={out.equityIrr != null ? `${(out.equityIrr * 100).toFixed(1)}%` : '—'} />
        <ScenarioMetricTile label="NPV" value={out.npv != null ? `$${formatLargeUSD(out.npv)}` : '—'} />
        <ScenarioMetricTile label="DSCR" value={out.dscr != null ? `${out.dscr.toFixed(2)}x` : '—'} />
        <ScenarioMetricTile label="LCOE" value={out.lcoe != null ? `$${out.lcoe.toFixed(0)}` : '—'} suffix="/MWh" />
        <ScenarioMetricTile label="Lifetime Rev" value={out.lifetimeRevenue != null ? `$${formatLargeUSD(out.lifetimeRevenue)}` : '—'} />
      </View>
      {summary && (
        <View style={s.tealBlock}>
          <Text style={[s.tealText, { fontSize: 8.5 }]}>Inputs: {summary}</Text>
        </View>
      )}
      <View style={[s.grayBlock, { borderLeftColor: AMBER, borderLeftWidth: 2 }]}>
        <Text style={[s.blockText, { fontSize: 7.5, color: INK_MUTED, lineHeight: 1.4 }]}>
          {SCENARIO_DISCLAIMER}
        </Text>
      </View>
    </View>
  )
}

function ScenarioMetricTile({ label, value, suffix }) {
  return (
    <View style={{ width: '25%', paddingRight: 6, paddingBottom: 8 }}>
      <Text style={[s.dataLabel, { width: 'auto', marginBottom: 2 }]}>{label}</Text>
      <Text style={{ fontSize: 11, fontFamily: FONT_MONO_BOLD, color: INK }}>
        {value}
        {suffix && <Text style={{ fontSize: 7, fontFamily: FONT_MONO, color: INK_MUTED }}> {suffix}</Text>}
      </Text>
    </View>
  )
}

function formatLargeUSD(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return Math.round(n).toLocaleString()
}

function ProjectPDFDoc({ project, current, aiMemo, scenario }) {
  const generatedDate = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
  const score = current?.feasibilityScore ?? null

  return (
    <Document title={project.name} author="Tractova">
      <Page size="A4" style={s.page}>

        {/* V3: top teal accent rail (matches Library banner / Lens hero) */}
        <View style={s.topRail} />

        {/* ── V3 Header — serif wordmark + mono caps eyebrow ── */}
        <View style={s.header}>
          <View>
            <Text style={s.logo}>Tractova</Text>
            <Text style={s.logoSub}>Intelligence Brief · {generatedDate.toUpperCase()}</Text>
          </View>
          <Text style={s.headerDate}>{aiMemo ? 'AI · Deal Memo' : 'Project Summary'}</Text>
        </View>
        <View style={s.divider} />

        {/* ── Project identity — V3 mono caps eyebrow + serif title ── */}
        <Text style={s.sectionLabel}>{aiMemo ? 'Deal Subject' : 'Project Summary'}</Text>
        <Text style={s.projectName}>{project.name}</Text>
        <Text style={s.projectMeta}>
          {(project.county || '').toUpperCase()} COUNTY · {(project.stateName || project.state || '').toUpperCase()}
          {project.mw ? `  ·  ${project.mw} MW AC` : ''}
        </Text>
        <View style={s.badgeRow}>
          {project.technology && (
            <View style={[s.badge, { backgroundColor: TEAL_LIGHT }]}>
              <Text style={{ fontSize: 7.5, fontFamily: FONT_MONO_BOLD, color: TEAL_DARK, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                {project.technology}
              </Text>
            </View>
          )}
          {project.stage && (
            <View style={[s.badge, { backgroundColor: PAPER, borderWidth: 0.5, borderColor: BORDER }]}>
              <Text style={{ fontSize: 7.5, fontFamily: FONT_MONO_BOLD, color: INK, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                {project.stage}
              </Text>
            </View>
          )}
        </View>
        <View style={s.divider} />

        {/* ── Feasibility score ── */}
        {score != null && (
          <>
            <ScoreBar score={score} />
            <View style={s.divider} />
          </>
        )}

        {/* ── Market Intelligence ── */}
        <Text style={s.sectionLabel}>Market Intelligence</Text>
        <View style={{ marginBottom: 14 }}>
          <DataRow label="State" value={project.stateName || project.state} />
          <DataRow label="CS Program" value={current?.csProgram || project.csProgram} />
          <DataRow
            label="Program Status"
            value={CS_STATUS_LABEL[current?.csStatus || project.csStatus] || project.csStatus}
          />
          <DataRow
            label="Program Capacity"
            value={current?.capacityMW > 0 ? `${current.capacityMW.toLocaleString()} MW remaining` : null}
          />
          <DataRow
            label="LMI Requirement"
            value={current?.lmiRequired ? `${current.lmiPercent}% minimum` : 'Not required'}
          />
          <DataRow
            label="IX Difficulty"
            value={IX_LABEL[current?.ixDifficulty] || null}
          />
          <DataRow label="Serving Utility"  value={project.servingUtility} />
          <DataRow label="Data As Of"        value={current?.lastUpdated || null} />
        </View>

        {/* Program context */}
        {current?.programNotes && (
          <View style={{ marginBottom: 8 }}>
            <Text style={[s.sectionLabel, { marginBottom: 5 }]}>Program Context</Text>
            <View style={s.tealBlock}>
              <Text style={s.tealText}>{current.programNotes}</Text>
            </View>
          </View>
        )}

        {/* IX notes */}
        {current?.ixNotes && (
          <View style={{ marginBottom: 14 }}>
            <Text style={[s.sectionLabel, { marginBottom: 5 }]}>IX Notes</Text>
            <View style={s.grayBlock}>
              <Text style={s.blockText}>{current.ixNotes}</Text>
            </View>
          </View>
        )}

        <View style={s.divider} />

        {/* ── AI Deal Memo (when memo provided) ── */}
        {aiMemo && (
          <>
            <AIMemoSection memo={aiMemo} />
            <View style={s.divider} />
          </>
        )}

        {/* ── Selected Scenario (when scenario provided) ── */}
        {scenario && (
          <>
            <ScenarioSection scenario={scenario} />
            <View style={s.divider} />
          </>
        )}

        {/* ── Pipeline ── */}
        <Text style={s.sectionLabel}>Development Pipeline</Text>
        <View style={{ marginBottom: 16 }}>
          <PipelineViz stage={project.stage} />
        </View>

        {/* ── Deal Notes ── */}
        {project.notes && (
          <>
            <View style={s.divider} />
            <Text style={s.sectionLabel}>Deal Notes</Text>
            <View style={s.grayBlock}>
              <Text style={s.blockText}>{project.notes}</Text>
            </View>
          </>
        )}

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={s.footerBrand}>Tractova · Tractova.com</Text>
          <Text style={s.footerDisclaimer}>
            Tractova intelligence is a research accelerator — verify interconnection conditions with the serving utility and program capacity with your state PUC before committing capital.
          </Text>
        </View>

      </Page>
    </Document>
  )
}

// ── Export function ───────────────────────────────────────────────────────────
// Optional `scenario` is a row from scenario_snapshots (with baseline_inputs +
// scenario_inputs + outputs + name). When passed, the PDF gains a
// "Selected Scenario" section between the AI memo and the pipeline visual.
export async function exportProjectPDF(project, current, aiMemo = null, scenario = null) {
  const doc  = <ProjectPDFDoc project={project} current={current} aiMemo={aiMemo} scenario={scenario} />
  const blob = await pdf(doc).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const suffix = aiMemo ? '-deal-memo' : (scenario ? '-scenario' : '')
  a.href     = url
  a.download = `${(project.name || 'project').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-tractova${suffix}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
