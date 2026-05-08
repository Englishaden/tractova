import { Component } from 'react'

// App-root error boundary.
//
// Why: any uncaught render error blanks the page. Without this, a TDZ
// from a circular import or a missing field on AI-null payloads gives
// the user a permanent white screen. Catching here guarantees a
// reload-able fallback regardless of root cause.
//
// Scope: this is the LAST line of defense — wrap the whole route tree.
// Local boundaries inside features are still encouraged for graceful
// per-section degradation, but this catches everything else.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleCopyDiagnostics = async () => {
    const { error, info } = this.state
    const payload = [
      `URL: ${window.location.href}`,
      `User-Agent: ${navigator.userAgent}`,
      `Time: ${new Date().toISOString()}`,
      '',
      `Error: ${error?.name || 'Error'}: ${error?.message || String(error)}`,
      '',
      'Stack:',
      error?.stack || '(no stack)',
      '',
      'Component stack:',
      info?.componentStack || '(no component stack)',
    ].join('\n')
    try {
      await navigator.clipboard.writeText(payload)
    } catch {
      // Clipboard blocked (older iOS, insecure context). Fall back to
      // a textarea so the user can copy manually.
      const ta = document.createElement('textarea')
      ta.value = payload
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch { /* nothing more to do */ }
      document.body.removeChild(ta)
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    const message = this.state.error?.message || String(this.state.error || 'Unknown error')

    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: '#F8F7F4' }}>
        <div className="max-w-md w-full rounded-lg overflow-hidden" style={{ background: '#0F1A2E', border: '1px solid rgba(20,184,166,0.30)', boxShadow: '0 24px 60px -20px rgba(15,26,46,0.45)' }}>
          <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, rgba(20,184,166,0.4) 0%, rgba(20,184,166,0.85) 50%, rgba(20,184,166,0.4) 100%)' }} />
          <div className="px-6 py-7">
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] mb-2" style={{ color: '#5EEAD4' }}>
              ◆ Something went wrong
            </p>
            <h1 className="font-serif text-[22px] leading-snug font-semibold text-white mb-3">
              The app hit an unexpected error and stopped rendering.
            </h1>
            <p className="text-[13px] leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.72)' }}>
              Try reloading the page. If the issue persists, copy the
              diagnostics and send them to support so we can fix it.
            </p>
            <pre className="text-[11px] font-mono p-3 rounded mb-5 overflow-auto max-h-32" style={{ background: 'rgba(0,0,0,0.30)', color: '#FCA5A5', border: '1px solid rgba(255,255,255,0.08)' }}>
              {message}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={this.handleReload}
                className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold px-4 py-2.5 rounded-sm transition-all"
                style={{ background: '#14B8A6', color: '#0F1A2E', minHeight: 44 }}
              >
                Try again
              </button>
              <button
                onClick={this.handleCopyDiagnostics}
                className="font-mono text-[10px] uppercase tracking-[0.18em] font-semibold px-4 py-2.5 rounded-sm transition-all"
                style={{ background: 'transparent', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.20)', minHeight: 44 }}
              >
                Copy diagnostics
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
}
