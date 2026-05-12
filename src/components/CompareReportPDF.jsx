import { Document, Page, View, Text, StyleSheet, pdf } from '@react-pdf/renderer'
import { IX_LABEL } from '../lib/statusMaps.js'

// ── CompareReportPDF ─────────────────────────────────────────────────────────
// Side-by-side comparison brief — Phase 2C of TRACTOVA-UX-001. Mirrors the
// in-app Compare modal's row groups (composite / project) and visual cues
// (severity-tinted score gauge, mono numerics, V3 paper aesthetic). A4
// landscape for 3+ columns; portrait for ≤ 2 to avoid empty whitespace.
//
// ── WinAnsi-safe character discipline ────────────────────────────────────────
// react-pdf's built-in fonts (Times-Roman, Helvetica, Courier) only support
// the WinAnsi / Latin-1 character set. Anything outside that — geometric
// shapes (◆ ▸ ◇), arrows (↑ ↓ →), em-dashes that aren't 0x97, fancy quotes,
// most box-drawing — gets substituted by the renderer, and the substitution
// can cascade into ADJACENT characters (we observed "Community Solar" →
// "Community So" with the diamond at front mangling the rest of the line).
// So: this file uses ONLY WinAnsi-safe characters. The supported decorative
// glyphs are middle dot (·, 0xB7), section sign (§, 0xA7), em-dash (—, 0x97).
// No ◆ ▸ ↑ ↓ → · NO decorative shapes. Hierarchy comes from typography alone.
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
const GRAY_50    = '#F8FAFC'
const GRAY_100   = '#F3F4F6'
const RED        = '#DC2626'

const FONT_SERIF      = 'Times-Roman'
const FONT_SERIF_BOLD = 'Times-Bold'
const FONT_MONO       = 'Courier'
const FONT_MONO_BOLD  = 'Courier-Bold'
const FONT_SANS       = 'Helvetica'
const FONT_SANS_BOLD  = 'Helvetica-Bold'

const CS_STATUS_LABEL = { active: 'Active', limited: 'Limited', pending: 'Pending', none: 'No Program' }

// Fixed label-column width. 130pt leaves ~640pt for data columns in landscape
// A4 (842 - 72 padding - 130 label = 640pt) ÷ 5 = 128pt min per project,
// which fits the column-header name + state + meta strip comfortably.
const LABEL_COL_WIDTH = 130

const s = StyleSheet.create({
  page: {
    fontFamily: FONT_SANS,
    backgroundColor: '#FFFFFF',
    paddingTop: 36,
    paddingBottom: 30,
    paddingHorizontal: 36,
  },
  topRail: { height: 1.5, backgroundColor: TEAL, marginBottom: 16, marginTop: -20 },

  // Header
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  headerLeft:   { flexDirection: 'column' },
  logo:         { fontSize: 22, fontFamily: FONT_SERIF_BOLD, color: INK, letterSpacing: -0.4 },
  logoSub:      { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: TEAL, letterSpacing: 0.8, marginTop: 4, textTransform: 'uppercase' },
  headerRight:  { flexDirection: 'column', alignItems: 'flex-end' },
  headerKind:   { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: INK, letterSpacing: 0.8, textTransform: 'uppercase' },
  headerDate:   { fontSize: 7, fontFamily: FONT_MONO, color: INK_MUTED, letterSpacing: 0.6, marginTop: 3 },

  divider: { borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 14 },

  // Title block
  eyebrow:   { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: INK_MUTED, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  title:     { fontSize: 20, fontFamily: FONT_SERIF_BOLD, color: INK, marginBottom: 6, letterSpacing: -0.4, lineHeight: 1.15 },
  titleMeta: { fontSize: 8.5, fontFamily: FONT_MONO, color: INK_MUTED, letterSpacing: 0.4, marginBottom: 14, lineHeight: 1.4 },

  // Pull-blocks — Best-for + AI summary. Two distinct visual identities
  // by border-color so a reader can tell them apart without reading the
  // eyebrow text first.
  pullBlock:     { borderLeftWidth: 2, padding: 10, marginBottom: 8 },
  pullEyebrow:   { fontSize: 7, fontFamily: FONT_MONO_BOLD, letterSpacing: 0.8, marginBottom: 3, textTransform: 'uppercase' },
  pullText:      { fontSize: 9.5, fontFamily: FONT_SANS, color: INK, lineHeight: 1.5 },

  // Column header strip
  colHeaderStrip: { flexDirection: 'row', marginTop: 10, borderBottomWidth: 1, borderBottomColor: NAVY, paddingBottom: 4 },
  colHeaderCell:  { paddingHorizontal: 6, paddingTop: 3, paddingBottom: 6 },
  colHeaderName:  { fontSize: 10, fontFamily: FONT_SERIF_BOLD, color: INK, letterSpacing: -0.1, lineHeight: 1.2 },
  colHeaderState: { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: TEAL, letterSpacing: 0.8, marginTop: 3, textTransform: 'uppercase' },
  colHeaderMeta:  { fontSize: 7, fontFamily: FONT_MONO, color: INK_MUTED, letterSpacing: 0.4, marginTop: 2 },
  recommendBadge: { fontSize: 6.5, fontFamily: FONT_MONO_BOLD, color: TEAL, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },

  // Group label
  rowGroupRow:   { flexDirection: 'row', paddingTop: 10, paddingBottom: 4 },
  rowGroupLabel: { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: TEAL, letterSpacing: 1.0, textTransform: 'uppercase' },

  // Data rows
  row:           { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 0.5, borderBottomColor: GRAY_100 },
  rowAlt:        { backgroundColor: GRAY_50 },
  rowLabelCell:  { width: LABEL_COL_WIDTH, paddingHorizontal: 6, paddingVertical: 6, justifyContent: 'center' },
  rowLabel:      { fontSize: 7.5, fontFamily: FONT_MONO, color: INK_MUTED, letterSpacing: 0.4 },
  rowCell:       { paddingHorizontal: 6, paddingVertical: 6, justifyContent: 'center' },
  rowValue:      { fontSize: 9, fontFamily: FONT_SANS_BOLD, color: INK, lineHeight: 1.3 },
  rowValueMono:  { fontSize: 9, fontFamily: FONT_MONO_BOLD, color: INK, lineHeight: 1.3 },
  // Muted color does the work; italic would require a registered font variant.
  rowValueMuted: { fontSize: 9, fontFamily: FONT_SANS, color: INK_MUTED, lineHeight: 1.3 },

  // Score cell — bigger, severity-colored
  scoreRow:    { flexDirection: 'row', alignItems: 'flex-end' },
  scoreNum:    { fontSize: 20, fontFamily: FONT_MONO_BOLD, letterSpacing: -0.5, lineHeight: 1.0 },
  scoreUnits:  { fontSize: 7, fontFamily: FONT_MONO, color: INK_MUTED, marginLeft: 2, marginBottom: 1 },
  scoreLabel:  { fontSize: 6.5, fontFamily: FONT_MONO_BOLD, letterSpacing: 0.8, marginTop: 2, textTransform: 'uppercase' },
  scoreDelta:  { fontSize: 6.5, fontFamily: FONT_MONO, marginTop: 2, letterSpacing: 0.4 },

  // Footer
  footer:           { marginTop: 'auto', paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  footerBrand:      { fontSize: 7, fontFamily: FONT_MONO_BOLD, color: INK, letterSpacing: 0.8, textTransform: 'uppercase' },
  footerDisclaimer: { fontSize: 7, fontFamily: FONT_SANS, color: INK_MUTED, maxWidth: 380, textAlign: 'right', lineHeight: 1.5 },
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
  // Meta line: MW · technology · stage. Use middle dot (WinAnsi 0xB7), safe.
  const metaBits = [item.mw ? `${item.mw} MW` : null, item.technology, item.stage].filter(Boolean)
  const meta = metaBits.join(' · ')
  // State + county strip, then optional Recommended badge on its own line.
  return (
    <View style={s.colHeaderCell}>
      <Text style={s.colHeaderName}>{item.name}</Text>
      <Text style={s.colHeaderState}>
        {item.county ? `${item.county} Co., ${item.state}` : item.state}
      </Text>
      {meta && <Text style={s.colHeaderMeta}>{meta}</Text>}
      {isRecommended && <Text style={s.recommendBadge}>Recommended</Text>}
    </View>
  )
}

function ScoreCell({ score, delta }) {
  const tone = scoreTone(score)
  return (
    <View style={s.rowCell}>
      <View style={s.scoreRow}>
        <Text style={[s.scoreNum, { color: tone.color }]}>{score == null ? '-' : Math.round(score)}</Text>
        {score != null && <Text style={s.scoreUnits}>/100</Text>}
      </View>
      <Text style={[s.scoreLabel, { color: tone.color }]}>{tone.label}</Text>
      {delta != null && Math.abs(delta) > 2 && (
        <Text style={[s.scoreDelta, { color: delta > 0 ? TEAL : AMBER_DEEP }]}>
          {delta > 0 ? '+' : ''}{delta} pt vs saved
        </Text>
      )}
    </View>
  )
}

function SubScoreCell({ value }) {
  if (value == null) return <View style={s.rowCell}><Text style={s.rowValueMuted}>-</Text></View>
  const tone = scoreTone(value)
  return (
    <View style={s.rowCell}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text style={[s.rowValueMono, { color: tone.color, fontSize: 11 }]}>{Math.round(value)}</Text>
        <Text style={{ fontSize: 6.5, fontFamily: FONT_MONO, color: INK_MUTED, marginLeft: 2, marginBottom: 1 }}>/100</Text>
      </View>
    </View>
  )
}

function ValueCell({ value, mono = false }) {
  if (value == null || value === '') return <View style={s.rowCell}><Text style={s.rowValueMuted}>-</Text></View>
  return (
    <View style={s.rowCell}>
      <Text style={mono ? s.rowValueMono : s.rowValue}>{String(value)}</Text>
    </View>
  )
}

function CSStatusCell({ status }) {
  if (!status) return <View style={s.rowCell}><Text style={s.rowValueMuted}>-</Text></View>
  const color = status === 'active' ? TEAL : status === 'limited' ? AMBER : status === 'pending' ? NAVY : INK_MUTED
  return (
    <View style={s.rowCell}>
      <Text style={[s.rowValueMono, { color }]}>{CS_STATUS_LABEL[status] || status}</Text>
    </View>
  )
}

function IXCell({ difficulty }) {
  if (!difficulty) return <View style={s.rowCell}><Text style={s.rowValueMuted}>-</Text></View>
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
  return <View style={s.rowCell}><Text style={s.rowValueMuted}>-</Text></View>
}

// ── PDF Document ─────────────────────────────────────────────────────────────

function CompareDoc({ items, refreshed = {}, recommendedId = null, aiSummary = null }) {
  // Landscape for 3+ columns; portrait when ≤ 2 to avoid empty whitespace.
  const orientation = items.length > 2 ? 'landscape' : 'portrait'
  const generatedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const dataColStyle = { flex: 1 }

  // Row group definitions — same column shape as the in-app Compare modal.
  const rowsByGroup = [
    {
      group: 'Composite',
      groupNum: '01',
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
      groupNum: '02',
      rows: [
        { label: 'Project size',  render: (it) => <ValueCell value={it.mw ? `${it.mw} MW AC` : null} mono /> },
        { label: 'Technology',    render: (it) => <ValueCell value={it.technology} /> },
        { label: 'Stage',         render: (it) => <ValueCell value={it.stage} /> },
        { label: 'Source',        render: (it) => <ValueCell value={it.source === 'library' ? `Saved ${it.savedAt ? new Date(it.savedAt).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : ''}` : 'Live (Lens)'} /> },
      ],
    },
  ]

  // Best-for: highest composite + best IX (mirrors the in-app Modal logic).
  const IX_RANK = { easy: 3, moderate: 2, hard: 1, very_hard: 0 }
  const bestScore = items.reduce((b, it) => (!b || (it.feasibilityScore ?? 0) > (b.feasibilityScore ?? 0)) ? it : b, null)
  const bestIX    = items.reduce((b, it) => (!b || (IX_RANK[it.ixDifficulty] ?? -1) > (IX_RANK[b.ixDifficulty] ?? -1)) ? it : b, null)
  const bestForLines = []
  if (bestScore)                            bestForLines.push(`${bestScore.name} leads on Feasibility Index.`)
  if (bestIX && bestIX.id !== bestScore?.id) bestForLines.push(`${bestIX.name} offers easier interconnection.`)

  return (
    <Document title={`Tractova comparison ${items.length} projects`} author="Tractova">
      <Page size="A4" orientation={orientation} style={s.page}>

        <View style={s.topRail} />

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.logo}>Tractova</Text>
            <Text style={s.logoSub}>Comparison Brief</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerKind}>{items.length} Projects</Text>
            <Text style={s.headerDate}>{generatedDate.toUpperCase()}</Text>
          </View>
        </View>
        <View style={s.divider} />

        {/* Title */}
        <Text style={s.eyebrow}>Compare Subject</Text>
        <Text style={s.title}>Side-by-side feasibility</Text>
        <Text style={s.titleMeta}>
          {items.map(it => it.state).join(' · ')}   Tractova composite index + key signals
        </Text>

        {/* Best-for + AI summary — pull-blocks set apart by border-color */}
        {bestForLines.length > 0 && (
          <View style={[s.pullBlock, { backgroundColor: TEAL_LIGHT, borderLeftColor: TEAL }]}>
            <Text style={[s.pullEyebrow, { color: TEAL }]}>Best For</Text>
            {bestForLines.map((line, i) => (
              <Text key={i} style={[s.pullText, i > 0 ? { marginTop: 3 } : {}]}>{line}</Text>
            ))}
          </View>
        )}
        {aiSummary && (
          <View style={[s.pullBlock, { backgroundColor: PAPER, borderLeftColor: NAVY }]}>
            <Text style={[s.pullEyebrow, { color: NAVY }]}>AI Comparison · Claude</Text>
            <Text style={s.pullText}>{aiSummary}</Text>
          </View>
        )}

        {/* Column header strip — per-project identity */}
        <View style={s.colHeaderStrip}>
          <View style={{ width: LABEL_COL_WIDTH }} />
          {items.map(it => (
            <View key={it.id} style={dataColStyle}>
              <ColumnHeader item={it} isRecommended={recommendedId === it.id} />
            </View>
          ))}
        </View>

        {/* Row groups */}
        {rowsByGroup.map(({ group, groupNum, rows }) => (
          <View key={group} wrap={false}>
            <View style={s.rowGroupRow}>
              <Text style={s.rowGroupLabel}>§ {groupNum} · {group}</Text>
            </View>
            {rows.map((row, ri) => (
              <View key={row.label} style={[s.row, ri % 2 === 1 ? s.rowAlt : null]}>
                <View style={s.rowLabelCell}>
                  <Text style={s.rowLabel}>{row.label}</Text>
                </View>
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
