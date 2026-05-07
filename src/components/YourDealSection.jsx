import { useRef } from 'react'
import TechLabel from './ui/TechLabel'
import { StagePicker, PipelineProgress } from '../pages/Library.jsx'
import { renderMarkdown } from '../lib/markdownRender.jsx'

// Toolbar that wraps/prefixes selected textarea text with markdown syntax.
function MarkdownToolbar({ textareaRef, value, onChange }) {
  const wrap = (before, after = before) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.slice(start, end)
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(next)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, end + before.length)
    }, 0)
  }
  const prefixLine = (prefix) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    onChange(next)
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + prefix.length, start + prefix.length)
    }, 0)
  }
  const btnCls = "px-1.5 py-0.5 rounded text-[10px] font-mono text-ink-muted hover:bg-gray-100 hover:text-ink transition-colors"
  return (
    <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-gray-200 bg-gray-50/50 rounded-t-lg" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={(e) => { e.stopPropagation(); wrap('**') }} className={`${btnCls} font-bold`} title="Bold (wraps **text**)">B</button>
      <button type="button" onClick={(e) => { e.stopPropagation(); wrap('*') }} className={`${btnCls} italic`} title="Italic (wraps *text*)">I</button>
      <span className="w-px h-3 bg-gray-300 mx-1" />
      <button type="button" onClick={(e) => { e.stopPropagation(); prefixLine('# ') }} className={btnCls} title="Heading (prefixes # )">H</button>
      <button type="button" onClick={(e) => { e.stopPropagation(); prefixLine('- ') }} className={btnCls} title="Bullet list (prefixes - )">•</button>
      <button type="button" onClick={(e) => { e.stopPropagation(); prefixLine('1. ') }} className={btnCls} title="Numbered list (prefixes 1. )">1.</button>
      <span className="w-px h-3 bg-gray-300 mx-1" />
      <button type="button" onClick={(e) => { e.stopPropagation(); wrap('[', '](url)') }} className={btnCls} title="Link [text](url)">↗</button>
      <button type="button" onClick={(e) => { e.stopPropagation(); wrap('`') }} className={`${btnCls} font-mono`} title="Inline code (wraps `text`)">{'<>'}</button>
    </div>
  )
}

export default function YourDealSection({ project, stage, setStage, notes, setNotes, saveStatus }) {
  // "Last analyzed X days ago"
  const daysAgo = project.savedAt
    ? Math.max(0, Math.round((Date.now() - new Date(project.savedAt).getTime()) / 86400000))
    : null

  // 2026-05-05 (A.8): replaced the old edit/preview toggle with a
  // side-by-side live-preview layout. Editing pane stays a textarea
  // (markdown syntax visible as you type); preview pane renders the
  // markdown into JSX continuously. Stacks vertically on mobile (<sm).
  // The legacy `notesPreview` boolean state is removed; preview is
  // always visible alongside the textarea.
  const notesTextareaRef = useRef(null)

  return (
    <div className="flex flex-col gap-3">
      {/* Header strip — saved-on caption + always-visible meta + stage picker */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="font-medium text-ink">{project.mw} MW AC</span>
          {project.technology && <><span className="text-gray-300">·</span><TechLabel tech={project.technology} className="text-ink-muted" /></>}
          <span className="text-gray-300">·</span>
          <StagePicker stage={stage} projectId={project.id} onChange={setStage} />
        </div>
        {daysAgo != null && (
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-ink-muted">
            {daysAgo === 0 ? 'Saved today' : daysAgo === 1 ? 'Saved yesterday' : `Saved ${daysAgo}d ago`}
          </span>
        )}
      </div>

      {/* Always-expanded content — replaces the legacy collapsible */}
      <div className="flex flex-col gap-4 mt-1">
          {/* Pipeline progress */}
          <div className="rounded-lg px-4 py-3 bg-white border border-gray-200">
            <p className="text-[9px] font-bold uppercase tracking-wider mb-3 text-gray-500">Pipeline Progress</p>
            <PipelineProgress stage={stage} />
          </div>

          {/* Deal details */}
          <div className="rounded-lg px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-xs bg-white border border-gray-200">
            {project.servingUtility && (
              <div className="sm:col-span-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5 text-gray-500">Serving Utility</p>
                <p className="font-medium text-gray-900">{project.servingUtility}</p>
              </div>
            )}
            <div className="sm:col-span-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5 text-gray-500">Saved</p>
              <p className="text-gray-400">{project.savedAt ? new Date(project.savedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</p>
            </div>
          </div>

          {/* Notes — side-by-side live preview (A.8 fix 2026-05-05).
              Replaces the legacy edit/preview TOGGLE with two panes
              rendered together: textarea on the left (markdown source),
              live-rendered preview on the right. Stacks vertically on
              mobile (<sm). Auto-save behavior + toolbar preserved. */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Deal Notes</p>
                <span className="text-[9px] font-mono text-gray-400">live preview</span>
              </div>
              {saveStatus === 'saving' && (
                <span className="text-[9px] flex items-center gap-1 text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse inline-block bg-gray-400" />
                  Saving…
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-[9px] flex items-center gap-1" style={{ color: '#34D399' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Saved
                </span>
              )}
            </div>
            {!notes && (
              <div className="flex flex-wrap gap-1.5">
                {['Landowner', 'Queue position', 'Key dates', 'ISA deposit', 'Site notes'].map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setNotes(`${hint}: `) }}
                    className="text-[10px] px-2 py-0.5 rounded-sm transition-colors border border-gray-200 text-gray-500 bg-white hover:border-teal-700 hover:text-teal-700"
                  >
                    + {hint}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* LEFT: editor pane (markdown source) */}
              <div
                className="rounded-lg overflow-hidden flex flex-col"
                style={{ background: '#FFFFFF', border: '1px solid #D1D5DB' }}
              >
                <div className="flex items-center justify-between px-2 py-1 border-b border-gray-200 bg-gray-50/50">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400">Editor</span>
                </div>
                <MarkdownToolbar textareaRef={notesTextareaRef} value={notes} onChange={setNotes} />
                <textarea
                  ref={notesTextareaRef}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Landowner · Queue position · Key dates · ISA deposit · Site findings · **bold** *italic* # heading - bullet"
                  rows={6}
                  className="w-full text-xs resize-y focus:outline-hidden leading-relaxed px-3 py-2.5 min-h-[140px] font-mono"
                  style={{ background: 'transparent', border: 'none', color: '#111827' }}
                />
              </div>
              {/* RIGHT: live preview pane */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg overflow-hidden flex flex-col"
                style={{ background: '#FFFFFF', border: '1px solid #D1D5DB' }}
              >
                <div className="flex items-center justify-between px-2 py-1 border-b border-gray-200 bg-gray-50/50">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-teal-700">Preview</span>
                </div>
                <div className="px-3 py-2.5 text-xs leading-relaxed text-gray-900 min-h-[140px]">
                  {notes
                    ? renderMarkdown(notes)
                    : <p className="text-[11px] text-gray-300 italic">Preview renders here as you type.</p>
                  }
                </div>
              </div>
            </div>
            <p className="text-[9px] font-mono text-gray-400 italic">
              Markdown supported — <span className="font-bold not-italic">**bold**</span>,{' '}
              <span className="italic not-italic">*italic*</span>,{' '}
              <span className="not-italic">#heading</span>,{' '}
              <span className="not-italic">- bullets</span>,{' '}
              <span className="not-italic">[links](url)</span>
            </p>
          </div>
      </div>
    </div>
  )
}
