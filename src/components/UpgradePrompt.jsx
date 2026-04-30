import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Match the WelcomeCard's pre-filled-demo URL so the paywall recognizes "I
// came here from the onboarding card" and personalizes the headline.
const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
}

const FEATURE_CONFIG = {
  'Tractova Lens': {
    headline: 'Run your first intelligence report.',
    sub: 'Tractova Lens delivers a three-pillar site, interconnection, and offtake report for any county in any active community solar state.',
    bullets: [
      'Site control flags — wetlands, prime farmland, land use restrictions',
      'Serving utility, ease score (1–10), and avg study timeline',
      'Program capacity, LMI requirements, and full IRA ITC revenue stack',
      'Save results directly to your project library',
    ],
  },
  'Library': {
    headline: 'Track every project in your pipeline.',
    sub: 'Your Project Library keeps all your saved Lens searches in one place — updated automatically as program conditions change.',
    bullets: [
      'Save unlimited projects with one click from Lens results',
      'See three-pillar status snapshot on every project card',
      'Get alerts when program capacity drops or IX queue status changes',
      'Export and share your project pipeline',
    ],
  },
}

export default function UpgradePrompt({ feature = 'Tractova Lens' }) {
  const config = FEATURE_CONFIG[feature] || FEATURE_CONFIG['Tractova Lens']
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)
  // V3.1 onboarding polish: surface URL params (state/county/mw/technology/
  // stage) when the user arrives from a pre-filled link (WelcomeCard CTA,
  // shared lens URL, etc.). The paywall then references the exact analysis
  // they were trying to run -- not a generic "upgrade to access Lens."
  const [searchParams] = useSearchParams()
  const ctxState  = searchParams.get('state')?.toUpperCase()
  const ctxCounty = searchParams.get('county')
  const ctxMw     = searchParams.get('mw')
  const ctxTech   = searchParams.get('technology')
  const ctxStage  = searchParams.get('stage')
  const hasContext = ctxState && ctxCounty
  const ctxStateName = ctxState && STATE_NAMES[ctxState] ? STATE_NAMES[ctxState] : ctxState

  const handleUpgrade = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')

      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId:    import.meta.env.VITE_STRIPE_PRICE_ID,
          successUrl: `${window.location.origin}/upgrade-success`,
          cancelUrl:  window.location.href,
        }),
      })

      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Something went wrong')
      window.location.href = json.url
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-start justify-center pt-24 pb-16 px-6">
      <div className="max-w-lg w-full">

        {/* V3: Pro badge — brand navy with teal star accent */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-6" style={{ background: '#0F1A2E', color: '#FFFFFF', border: '1px solid rgba(20,184,166,0.30)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Tractova Pro
        </div>

        {/* Headline — serif treatment matches V3 brand. When the user arrives
            with prefilled URL context (e.g. came from the WelcomeCard's IL/Will
            County demo), the paywall references the exact analysis they were
            trying to run instead of pitching Lens generically. */}
        {hasContext && feature === 'Tractova Lens' ? (
          <>
            <div
              className="rounded-lg px-4 py-3 mb-5"
              style={{ background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(15,118,110,0.22)' }}
            >
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] font-bold mb-1" style={{ color: '#0F766E' }}>
                ◆ Lens analysis · staged for you
              </p>
              <p className="text-sm font-semibold text-ink leading-snug">
                {ctxCounty} County, {ctxStateName}
                {ctxMw ? ` · ${ctxMw} MW AC` : ''}
                {ctxTech ? ` · ${decodeURIComponent(ctxTech)}` : ''}
                {ctxStage ? ` · ${decodeURIComponent(ctxStage)}` : ''}
              </p>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                Your inputs are saved. Upgrade to run the live analysis with three-pillar AI commentary.
              </p>
            </div>
            <h1 className="text-2xl font-serif font-semibold text-ink mb-3" style={{ letterSpacing: '-0.02em' }}>
              Run this report — and any other county.
            </h1>
            <p className="text-gray-500 text-sm leading-relaxed mb-7">
              Tractova Lens delivers a county-level feasibility report with site, interconnection, and offtake commentary in seconds. Save unlimited projects, share Deal Memos with co-developers, and get alerts when program conditions shift.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-serif font-semibold text-ink mb-3" style={{ letterSpacing: '-0.02em' }}>{config.headline}</h1>
            <p className="text-gray-500 text-sm leading-relaxed mb-7">{config.sub}</p>
          </>
        )}

        {/* Bullet list */}
        <ul className="space-y-3 mb-8">
          {config.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm text-gray-700">
              <span className="mt-0.5 shrink-0" style={{ color: '#0F766E' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              {b}
            </li>
          ))}
        </ul>

        {/* V3: Price + CTA — navy/teal accent rail at top */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #0F1A2E 0%, #14B8A6 100%)' }} />
          <div className="flex items-end gap-1 mb-1 mt-1">
            <span className="text-3xl font-bold font-mono tabular-nums text-ink">$9.99</span>
            <span className="text-gray-400 text-sm mb-1">/ month</span>
          </div>
          <p className="text-xs text-gray-400 mb-5">Cancel anytime. No long-term commitment.</p>

          {error && (
            <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-sm text-xs text-red-600">
              {error}
            </div>
          )}

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            style={{ background: '#14B8A6', boxShadow: '0 4px 12px rgba(20,184,166,0.20)' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#0F766E' }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#14B8A6' }}
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Redirecting to checkout…
              </>
            ) : (
              'Upgrade to Pro — $9.99 / month'
            )}
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">
            Secured by Stripe · Cancel any time from your{' '}
            <Link to="/profile" className="underline hover:text-gray-600">Profile</Link>
          </p>
        </div>

        <p className="mt-5 text-xs text-center text-gray-400">
          <Link to="/" className="hover:text-gray-600 transition-colors">← Back to Dashboard</Link>
        </p>
      </div>
    </div>
  )
}
