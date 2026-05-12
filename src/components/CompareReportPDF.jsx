import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer'
import { IX_LABEL } from '../lib/statusMaps.js'

// ── CompareReportPDF ─────────────────────────────────────────────────────────
// Side-by-side comparison brief — Phase 2C of TRACTOVA-UX-001. Mirrors the
// in-app Compare modal's row groups (composite / project) and visual cues
// (severity-tinted score gauge, mono numerics, V3 paper aesthetic). A4
// landscape so 5 columns stay legible; falls back to portrait when ≤ 2
// projects to avoid white-space waste.
//
// Lazy-loaded by CompareTray on Export PDF click — keeps @react-pdf/renderer
// (1.4 MB raw / ~483 KB gzip) out of the main bundle.

// ── V3 Brand tokens (mirror ProjectPDFExport.jsx) ────────────────────────────
const NAVY       = '#0F1A2E'
const TEAL       = '#0F766E'
const TEAL_LIGHT = '#ECFDF5'
const AMBER      = '#D97706'
const AMBER_DEEP = '#B45309'
const INK        = '#0A1828'
const INK_MUTED  = '#5A6B7A'
const PAPER      = '#FAFAF7'
const BORDER     = '#E2E8F0'
const GRAY_100   = '#F3F4F6'
const RED        = '#DC2626'

const FONT_SERIF      = 'Times-Roman'
const FONT_SERIF_BOLD = 'Times-Bold'
const FONT_MONO       = 'Courier'
const FONT_MONO_BOLD  = 'Courier-Bold'
const FONT_SANS       = 'Helvetica'
const FONT_SANS_BOLD  = 'Helvetica-Bold'

const CS_STATUS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'No Program' }

const s = StyleSheet.create({
  page: {
    fontFamily: FONT_SANS,
    backgroundColor: '#FFFFFF',
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 36,
  },
  topRail: { height: 1.5, backgroundColor: TEAL, marginBottom: 14, marginTop: -16 },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  logo:       { fontSize: 20, fontFamily: FONT_SERIF_BOLD, color: INK, letterSpacing: -0.4 },
  logoSub:    { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: TEAL, letterSpacing: 1.6, marginTop: 4, textTransform: 'uppercase' },
  headerDate: { fontSize: 7, fontFamily: FONT_MONO, color: INK_MUTED, letterSpacing: 1.0, textTransform: 'uppercase' },

  divider: { borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 12 },

  // Title
  title:     { fontSize: 18, fontFamily: FONT_SERIF_BOLD, color: INK, marginBottom: 4, letterSpacing: -0.4 },
  titleMeta: { fontSize: 8, fontFamily: FONT_MONO, color: INK_MUTED, letterSpacing: 0.8, marginBottom: 12, textTransform: 'uppercase' },

  sectionLabel: { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: INK_MUTED, letterSpacing: 2.0, textTransform: 'uppercase', marginBottom: 6 },

  // Column header cells (per-project identity strip at top of the table)
  colHeaderCell:  { paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  colHeaderName:  { fontSize: 10, fontFamily: FONT_SERIF_BOLD, color: INK, letterSpacing: -0.1, lineHeight: 1.2 },
  colHeaderState: { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: TEAL, letterSpacing: 1.2, marginTop: 3, textTransform: 'uppercase' },
  colHeaderMeta:  { fontSize: 7, fontFamily: FONT_MONO, color: INK_MUTED, letterSpacing: 0.4, marginTop: 2 },

  // Data rows
  rowGroupLabel: { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: TEAL, letterSpacing: 1.8, textTransform: 'uppercase', paddingTop: 9, paddingBottom: 4, paddingHorizontal: 6 },
  row:           { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: GRAY_100 },
  rowLabel:      { fontSize: 7.5, fontFamily: FONT_MONO, color: INK_MUTED, letterSpacing: 0.6, paddingVertical: 5, paddingHorizontal: 6, textTransform: 'uppercase' },
  rowCell:       { paddingVertical: 5, paddingHorizontal: 6 },
  rowValue:      { fontSize: 9, fontFamily: FONT_SANS_BOLD, color: INK },
  rowValueMono:  { fontSize: 9, fontFamily: FONT_MONO_BOLD, color: INK },
  rowValueMuted: { fontSize: 9, fontFamily: FONT_SANS, color: INK_MUTED, fontStyle: 'italic' },

  // Score cell — bigger, severity-colored
  scoreNum:    { fontSize: 18, fontFamily: FONT_MONO_BOLD, letterSpacing: -0.5 },
  scoreUnits:  { fontSize: 7, fontFamily: FONT_MONO, color: INK_MUTED, marginLeft: 2 },
  scoreLabel:  { fontSize: 6.5, fontFamily: FONT_MONO_BOLD, letterSpacing: 1.2, marginTop: 2, textTransform: 'uppercase' },

  // Best-for + AI summary
  pullBlock:     { backgroundColor: TEAL_LIGHT, borderLeftWidth: 2, borderLeftColor: TEAL, padding: 9, marginBottom: 8 },
  pullEyebrow:   { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: TEAL, letterSpacing: 1.4, marginBottom: 2, textTransform: 'uppercase' },
  pullText:      { fontSize: 9, fontFamily: FONT_SANS, color: INK, lineHeight: 1.5 },

  // Footer
  footer:           { marginTop: 'auto', paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  footerBrand:      { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: INK, letterSpacing: 1.6, textTransform: 'uppercase' },
  footerDisclaimer: { fontSize: 7, fontFamily: FONT_SANS, color: INK_MUTED, maxWidth: 360, textAlign: 'right', lineHeight: 1.5 },
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreTone(v) {
  if (v == null) return { color: INK_MUTED, label: 'No data' }
  if (v >= 70)   return { color: TEAL,      label: 'Strong' }
  if (v >= 50)   return { color: AMBER,     label: 'Moderate' }
  return            { color: RED,       label: 'Weak' }
}

function fmtCap(mw) {
  if (mw == null) return null
  if (mw >= 1000) return `${(mw / 1000).toFixed(1)} GW`
  return `${Math.round(mw)} MW`
}

function fmtPct(v) {
  if (v == null) return null
  return v < 1 ? `${v.toFixed(1)}%` : `${Math.round(v)}%`
}

function fmtWetlandPct(v) {
  if (v == null) return null
  const capped = Math.min(100, v)
  const overflow = v > 100
  const display = capped < 1 ? capped.toFixed(1) : Math.round(capped)
  return `${display}%${overflow ? '+' : ''}`
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ColumnHeader({ item, isRecommended }) {
  const meta = [item.mw ? `${item.mw} MW` : null, item.technology, item.stage]
    .filter(Boolean).join(' · ')
  return (
    <View style={s.colHeaderCell}>
      <Text style={s.colHeaderName}>{item.name}</Text>
      <Text style={s.colHeaderState}>
        {item.state}{isRecommended ? '  ·  RECOMMENDED' : ''}
      </Text>
      {meta && <Text style={s.colHeaderMeta}>{meta}</Text>}
    </View>
  )
}

function ScoreCell({ score, delta }) {
  const tone = scoreTone(score)
  return (
    <View style={s.rowCell}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={[s.scoreNum, { color: tone.color }]}>{score == null ? '—' : Math.round(score)}</Text>
        {score != null && <Text style={s.scoreUnits}>/100</Text>}
      </View>
      <Text style={[s.scoreLabel, { color: tone.color }]}>{tone.label}</Text>
      {delta != null && Math.abs(delta) > 2 && (
        <Text style={{ fontSize: 6.5, fontFamily: FONT_MONO, color: delta > 0 ? TEAL : AMBER_DEEP, marginTop: 2, letterSpacing: 0.6 }}>
          {delta > 0 ? '↑ +' : '↓ '}{delta} pt vs at-add
        </Text>
      )}
    </View>
  )
}

function SubScoreCell({ value }) {
  if (value == null) return <View style={s.rowCell}><Text style={s.rowValueMuted}>—</Text></View>
  const tone = scoreTone(value)
  return (
    <View style={s.rowCell}>
      <Text style={[s.rowValueMono, { color: tone.color }]}>{Math.round(value)}<Text style={{ fontSize: 6.5, color: INK_MUTED }}> /100</Text></Text>
    </View>
  )
}

function ValueCell({ value, mono = false }) {
  if (value == null || value === '') return <View style={s.rowCell}><Text style={s.rowValueMuted}>—</Text></View>
  return (
    <View style={s.rowCell}>
      <Text style={mono ? s.rowValueMono : s.rowValue}>{String(value)}</Text>
    </View>
  )
}

function CSStatusCell({ status }) {
  if (!status) return <View style={s.rowCell}><Text style={s.rowValueMuted}>—</Text></View>
  const color = status === 'active' ? TEAL : status === 'limited' ? AMBER : status === 'pending' ? NAVY : INK_MUTED
  return (
    <View style={s.rowCell}>
      <Text style={[s.rowValueMono, { color }]}>{CS_STATUS_LABEL[status] || status}</Text>
    </View>
  )
}

function IXCell({ difficulty }) {
  if (!difficulty) return <View style={s.rowCell}><Text style={s.rowValueMuted}>—</Text></View>
  const color = difficulty === 'easy' ? TEAL : difficulty === 'moderate' ? AMBER : difficulty === 'hard' ? AMBER_DEEP : RED
  return (
    <View style={s.rowCell}>
      <Text style={[s.rowValueMono, { color }]}>{IX_LABEL[difficulty] || difficulty}</Text>
    </View>
  )
}

function LMICell({ item }) {
  if (item.lmiRequired === false || item.lmiPercent === 0) {
    return <View style={s.rowCell}><Text style={[s.rowValueMono, { color: TEAL }]}>Not required</Text></View>
  }
  if (item.lmiRequired && item.lmiPercent > 0) {
    const color = item.lmiPercent >= 50 ? AMBER_DEEP : item.lmiPercent >= 30 ? AMBER : INK
    return (
      <View style={s.rowCell}>
        <Text style={[s.rowValueMono, { color }]}>{item.lmiPercent}% min</Text>
      </View>
    )
  }
  return <View style={s.rowCell}><Text style={s.rowValueMuted}>—</Text></View>
}

// ── PDF Document ─────────────────────────────────────────────────────────────

function CompareDoc({ items, refreshed = {}, recommendedId = null, aiSummary = null }) {
  // Landscape for 3+ columns; portrait when ≤ 2 to avoid empty whitespace.
  const orientation = items.length > 2 ? 'landscape' : 'portrait'
  const generatedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Column-grid: first cell is the row label (140pt), remaining cells are
  // equal width. Using flex children inside a row View achieves the same
  // effect without a real <Table> component.
  const labelColStyle = { width: 140, paddingHorizontal: 6, paddingVertical: 5 }
  const dataColStyle  = { flex: 1 }

  // Build a per-item "live score" that prefers the refreshed snapshot
  // (Modal's compare-open recompute) over the at-add stored score.
  const rowsByGroup = [
    {
      group: 'Composite',
      rows: [
        {
          label: 'Feasibility Index',
          render: (it) => {
            const r = refreshed[it.id]
            const score = r?.score != null ? r.score : it.feasibilityScore
            const delta = r?.score != null && it.feasibilityScore != null && Math.abs(r.score - it.feasibilityScore) > 2
              ? r.score - it.feasibilityScore
              : null
            return <ScoreCell score={score} delta={delta} />
          },
        },
        { label: 'Offtake sub-score',         render: (it) => <SubScoreCell value={it.subOfftake} /> },
        { label: 'Interconnection sub-score', render: (it) => <SubScoreCell value={it.subIx} /> },
        { label: 'Site sub-score',            render: (it) => <SubScoreCell value={it.subSite} /> },
        { label: 'CS Program Status',         render: (it) => <CSStatusCell status={it.csStatus} /> },
        { label: 'CS Program',                render: (it) => <ValueCell value={it.csProgram} /> },
        { label: 'Program Capacity',          render: (it) => <ValueCell value={fmtCap(it.capacityMW)} mono /> },
        { label: 'IX Difficulty',             render: (it) => <IXCell difficulty={it.ixDifficulty} /> },
        { label: 'LMI Carveout',              render: (it) => <LMICell item={it} /> },
        { label: 'Wetland-richness index',    render: (it) => <ValueCell value={fmtWetlandPct(it.wetlandPct)} mono /> },
        { label: 'Prime farmland',            render: (it) => <ValueCell value={fmtPct(it.farmlandPct)} mono /> },
      ],
    },
    {
      group: 'Project',
      rows: [
        { label: 'Project size',  render: (it) => <ValueCell value={it.mw ? `${it.mw} MW AC` : null} mono /> },
        { label: 'Technology',    render: (it) => <ValueCell value={it.technology} /> },
        { label: 'Stage',         render: (it) => <ValueCell value={it.stage} /> },
        { label: 'County',        render: (it) => <ValueCell value={it.county ? `${it.county} Co., ${it.state}` : it.state} /> },
        { label: 'Source',        render: (it) => <ValueCell value={it.source === 'library' ? `Saved ${it.savedAt ? new Date(it.savedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : ''}` : 'Live (Lens)'} /> },
      ],
    },
  ]

  // Best-for: highest composite + best IX (Modal's bestFor logic, replicated
  // server-side so the PDF carries the same takeaway).
  const IX_RANK = { easy: 3, moderate: 2, hard: 1, very_hard: 0 }
  const bestScore = items.reduce((b, it) => (!b || (it.feasibilityScore ?? 0) > (b.feasibilityScore ?? 0)) ? it : b, null)
  const bestIX    = items.reduce((b, it) => (!b || (IX_RANK[it.ixDifficulty] ?? -1) > (IX_RANK[b.ixDifficulty] ?? -1)) ? it : b, null)
  const bestForParts = []
  if (bestScore)                            bestForParts.push(`${bestScore.name} leads on Feasibility Index`)
  if (bestIX && bestIX.id !== bestScore?.id) bestForParts.push(`${bestIX.name} offers easier interconnection`)
  const bestFor = bestForParts.join(' · ') || null

  return (
    <Document title={`Tractova comparison · ${items.length} projects`} author="Tractova">
      <Page size="A4" orientation={orientation} style={s.page}>

        <View style={s.topRail} />

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.logo}>Tractova</Text>
            <Text style={s.logoSub}>Comparison Brief · {generatedDate.toUpperCase()}</Text>
          </View>
          <Text style={s.headerDate}>{items.length} Projects</Text>
        </View>
        <View style={s.divider} />

        {/* Title */}
        <Text style={s.sectionLabel}>Compare Subject</Text>
        <Text style={s.title}>Side-by-side feasibility</Text>
        <Text style={s.titleMeta}>
          {items.map(it => it.state).join(' · ')}  ·  Tractova composite index + key signals
        </Text>

        {/* Best-for + AI summary */}
        {bestFor && (
          <View style={s.pullBlock}>
            <Text style={s.pullEyebrow}>◆ Best for</Text>
            <Text style={s.pullText}>{bestFor}</Text>
          </View>
        )}
        {aiSummary && (
          <View style={[s.pullBlock, { backgroundColor: PAPER, borderLeftColor: NAVY }]}>
            <Text style={[s.pullEyebrow, { color: NAVY }]}>◆ AI comparison · Claude</Text>
            <Text style={s.pullText}>{aiSummary}</Text>
          </View>
        )}

        {/* Column headers (per-project identity strip) */}
        <View style={{ flexDirection: 'row', marginTop: 4 }}>
          <View style={labelColStyle} />
          {items.map(it => (
            <View key={it.id} style={dataColStyle}>
              <ColumnHeader item={it} isRecommended={recommendedId === it.id} />
            </View>
          ))}
        </View>

        {/* Row groups */}
        {rowsByGroup.map(({ group, rows }) => (
          <View key={group} wrap={false}>
            <Text style={s.rowGroupLabel}>§ {group === 'Composite' ? '01 · Composite' : '02 · Project'}</Text>
            {rows.map((row) => (
              <View key={row.label} style={s.row}>
                <Text style={[s.rowLabel, { width: 140 }]}>{row.label}</Text>
                {items.map((it) => (
                  <View key={`${it.id}::${row.label}`} style={dataColStyle}>
                    {row.render(it)}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerBrand}>Tractova · Tractova.com</Text>
          <Text style={s.footerDisclaimer}>
            Tractova's composite index is a research accelerator. Verify interconnection terms with the serving utility and confirm program capacity with the state PUC before committing capital.
          </Text>
        </View>

      </Page>
    </Document>
  )
}

// ── Export function ──────────────────────────────────────────────────────────
//
// Generate + trigger download. Caller passes the live `items` from
// CompareContext plus the `refreshed` map (Modal's compare-open recompute)
// so the PDF reflects the same scores the user is reading on screen, not
// the stored-at-add-time values. Returns the blob in case the caller wants
// to do something else with it (preview, attach, etc.).
export async function exportCompareReportPDF(items, { refreshed = {}, recommendedId = null, aiSummary = null } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('No projects to export')
  }
  const doc = <CompareDoc items={items} refreshed={refreshed} recommendedId={recommendedId} aiSummary={aiSummary} />
  const blob = await pdf(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tractova-compare-${items.length}-projects-${new Date().toISOString().slice(0, 10)}.pdf`
  a.click()
  URL.revokeObjectURL(url)
  return blob
}
