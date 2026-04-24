import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer'

// ── Brand tokens ──────────────────────────────────────────────────────────────
const TEAL       = '#0F6E56'
const TEAL_LIGHT = '#E6F4F0'
const TEAL_DARK  = '#0A5240'
const AMBER      = '#BA7517'
const GRAY_900   = '#111827'
const GRAY_700   = '#374151'
const GRAY_500   = '#6B7280'
const GRAY_300   = '#D1D5DB'
const GRAY_100   = '#F3F4F6'
const RED        = '#EF4444'

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

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
    paddingTop: 40,
    paddingBottom: 36,
    paddingHorizontal: 48,
  },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  logo:   { fontSize: 15, fontFamily: 'Helvetica-Bold', color: TEAL, letterSpacing: 1.5 },
  logoSub: { fontSize: 7, color: GRAY_500, letterSpacing: 0.5, marginTop: 1 },
  headerDate: { fontSize: 8, color: GRAY_500 },

  divider: { borderBottomWidth: 1, borderBottomColor: GRAY_300, marginBottom: 14 },
  dividerLight: { borderBottomWidth: 1, borderBottomColor: GRAY_100, marginBottom: 12 },

  sectionLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: GRAY_500,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  // Project identity
  projectName: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: GRAY_900, marginBottom: 4 },
  projectMeta: { fontSize: 10, color: GRAY_500, marginBottom: 8 },

  badgeRow: { flexDirection: 'row', marginBottom: 16 },
  badge: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
    marginRight: 5,
  },

  // Score
  scoreRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  scoreNum:  { fontSize: 36, fontFamily: 'Helvetica-Bold', marginRight: 14 },
  scoreBarTrack: { height: 5, backgroundColor: GRAY_100, borderRadius: 3, marginBottom: 5 },
  scoreBarFill:  { height: 5, borderRadius: 3 },
  scoreLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 2 },

  // Data table
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: GRAY_100,
  },
  dataLabel: { fontSize: 8, color: GRAY_500, width: 130 },
  dataValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRAY_700, flex: 1 },

  // Blocks
  tealBlock: {
    backgroundColor: TEAL_LIGHT,
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
  },
  grayBlock: {
    backgroundColor: GRAY_100,
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
  },
  blockText: { fontSize: 8.5, color: GRAY_700, lineHeight: 1.7 },
  tealText:  { fontSize: 8.5, color: '#065F46', lineHeight: 1.7 },

  // Pipeline
  pipelineRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  pipelineLabels: { flexDirection: 'row' },
  pipelineLabelCell: { flex: 1, alignItems: 'center' },

  // Footer
  footer: {
    marginTop: 'auto',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: GRAY_300,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footerBrand:      { fontSize: 8, fontFamily: 'Helvetica-Bold', color: TEAL },
  footerDisclaimer: { fontSize: 7, color: GRAY_500, maxWidth: 280, textAlign: 'right', lineHeight: 1.5 },
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

// ── PDF Document ──────────────────────────────────────────────────────────────
function ProjectPDFDoc({ project, current }) {
  const generatedDate = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
  const score = current?.feasibilityScore ?? null

  return (
    <Document title={project.name} author="Tractova">
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.logo}>TRACTOVA</Text>
            <Text style={s.logoSub}>Project Intelligence Platform</Text>
          </View>
          <Text style={s.headerDate}>Generated {generatedDate}</Text>
        </View>
        <View style={s.divider} />

        {/* ── Project identity ── */}
        <Text style={s.sectionLabel}>Project Summary</Text>
        <Text style={s.projectName}>{project.name}</Text>
        <Text style={s.projectMeta}>
          {project.county} County, {project.stateName || project.state}
          {project.mw ? `  ·  ${project.mw} MW AC` : ''}
        </Text>
        <View style={s.badgeRow}>
          {project.technology && (
            <View style={[s.badge, { backgroundColor: TEAL_LIGHT }]}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: TEAL_DARK }}>
                {project.technology}
              </Text>
            </View>
          )}
          {project.stage && (
            <View style={[s.badge, { backgroundColor: GRAY_100 }]}>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: GRAY_700 }}>
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
          <Text style={s.footerBrand}>tractova.com</Text>
          <Text style={s.footerDisclaimer}>
            Tractova intelligence is a research accelerator — verify interconnection conditions with the serving utility and program capacity with your state PUC before committing capital.
          </Text>
        </View>

      </Page>
    </Document>
  )
}

// ── Export function ───────────────────────────────────────────────────────────
export async function exportProjectPDF(project, current) {
  const doc  = <ProjectPDFDoc project={project} current={current} />
  const blob = await pdf(doc).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${(project.name || 'project').replace(/[^a-z0-9]/gi, '-').toLowerCase()}-tractova.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
