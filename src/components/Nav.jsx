import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useAuth } from '../context/AuthContext'

export default function Nav() {
  const location = useLocation()
  const { user, loading, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const navigate = useNavigate()

  // Route-aware theming (2026-05-28 v2.5):
  // Dashboard (`/`) is the dark "intelligence terminal" surface; every other
  // page keeps the cream Tractova brand surface. Nav meets each page where
  // it lives, instead of forcing the editorial pages into a dark frame they
  // weren't designed for. Locked via AskUserQuestion 2026-05-28.
  const isDashboardRoute = location.pathname === '/'

  // Scope-aware token palette. Picked from index.css's dashboard-dark
  // tokens so a future global var rename only has to update both places.
  const scope = isDashboardRoute ? {
    navBg:           '#0B1623',
    navBorder:       '#1F2A3D',
    linkInactive:    '#98A4B6',   // --text-label
    linkHover:       '#F5F7FA',   // --text-primary
    activeColor:     '#5EEAD4',   // brighter teal on dark
    activeBorder:    '#5EEAD4',
    cmdkBg:          'rgba(20,184,166,0.10)',
    cmdkBorder:      'rgba(20,184,166,0.30)',
    cmdkText:        '#98A4B6',
    cmdkHoverText:   '#F5F7FA',
    dropdownBg:      '#131C2C',
    dropdownBorder:  '#1F2A3D',
    dropdownDivider: '#1F2A3D',
    userPrimary:     '#F5F7FA',
    userMeta:        '#6C7A91',
    menuItemText:    '#C6CEDB',
    menuItemHoverBg: 'rgba(20,184,166,0.10)',
    menuItemHoverFg: '#5EEAD4',
    signOutText:     '#C6CEDB',
    signOutHoverBg:  'rgba(248,113,113,0.10)',
    signOutHoverFg:  '#F87171',
  } : {
    navBg:           '#FFFFFF',
    navBorder:       '#E5E7EB', // gray-200
    linkInactive:    '#6B7280', // gray-500
    linkHover:       '#111827', // gray-900
    activeColor:     '#0F766E', // teal-700
    activeBorder:    '#0F766E',
    cmdkBg:          '#F9FAFB',
    cmdkBorder:      '#E2E8F0',
    cmdkText:        '#5A6B7A',
    cmdkHoverText:   '#0A1828',
    dropdownBg:      '#FFFFFF',
    dropdownBorder:  '#E5E7EB',
    dropdownDivider: '#F3F4F6',
    userPrimary:     '#1F2937',
    userMeta:        '#9CA3AF',
    menuItemText:    '#374151',
    menuItemHoverBg: '#F0FDFA', // primary-50
    menuItemHoverFg: '#0F766E',
    signOutText:     '#4B5563',
    signOutHoverBg:  '#FEE2E2',
    signOutHoverFg:  '#DC2626',
  }

  const navLink = (to, label) => {
    const active = location.pathname === to
    if (active) {
      return (
        <Link
          to={to}
          className="text-sm font-medium transition-colors px-1 pb-0.5"
          style={{ color: scope.activeColor, borderBottom: `2px solid ${scope.activeBorder}` }}
        >
          {label}
        </Link>
      )
    }
    return (
      <Link
        to={to}
        className="text-sm font-medium transition-colors px-1 pb-0.5"
        style={{ color: scope.linkInactive }}
        onMouseEnter={(e) => { e.currentTarget.style.color = scope.linkHover }}
        onMouseLeave={(e) => { e.currentTarget.style.color = scope.linkInactive }}
      >
        {label}
      </Link>
    )
  }

  const displayName = user
    ? (user.user_metadata?.full_name?.split(' ')[0] || user.email.split('@')[0])
    : null

  const handleSignOut = async () => {
    setDropdownOpen(false)
    await signOut()
    navigate('/')
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 h-14 transition-colors duration-200"
      style={{ background: scope.navBg, borderBottom: `1px solid ${scope.navBorder}` }}
    >
      <div className="max-w-dashboard mx-auto px-4 md:px-6 h-full flex items-center justify-between gap-3">

        {/* Logo — wordmark hides on phone (mark stays) for tighter nav */}
        <Link to="/" className="flex items-center gap-2 select-none shrink-0">
          <TractovaMark />
          <span
            className="hidden sm:inline text-xl font-serif font-semibold tracking-tight leading-none"
            style={{ letterSpacing: '-0.02em', color: isDashboardRoute ? '#F5F7FA' : '#0A1828' }}
          >Tractova</span>
        </Link>

        {/* Nav links — only shown to signed-in users. The wrapper is
            also gated on `user` so signed-out visitors don't see an
            empty 28-44 px flex gap between the logo and the Sign-In
            buttons. */}
        {user && (
          <div className="flex items-center gap-3 sm:gap-5 md:gap-7 overflow-x-auto">
            {navLink('/', 'Dashboard')}
            {navLink('/search', 'Lens')}
            {navLink('/glossary', 'Glossary')}
            {navLink('/library', 'Library')}
          </div>
        )}

        {/* Auth */}
        <div className="flex items-center gap-3">
          {/* V3: Cmd-K hint -- power-user discovery cue. Click also opens
              the palette via dispatched keyboard event so non-keyboard
              users can find it. */}
          {user && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }))}
              className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-teal-600 focus-visible:outline-offset-2"
              style={{ background: scope.cmdkBg, border: `1px solid ${scope.cmdkBorder}`, color: scope.cmdkText }}
              onMouseEnter={(e) => { e.currentTarget.style.color = scope.cmdkHoverText }}
              onMouseLeave={(e) => { e.currentTarget.style.color = scope.cmdkText }}
              title="Open command palette"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <span className="font-mono text-[10px] tracking-wide">⌘K</span>
            </button>
          )}
          {loading ? (
            <div className="w-32 h-7 bg-gray-100 rounded-sm animate-pulse" />
          ) : user ? (
            // Logged-in user dropdown — Phase 4 migrated from a
            // hand-rolled absolute-positioned div to Radix
            // DropdownMenu. Menu portals to <body> so it never clips
            // against ancestor overflow, ships Esc + outside-click +
            // focus-trap + keyboard nav out of the box, and surfaces
            // a proper focus-visible ring.
            <DropdownMenu.Root open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label="Open account menu"
                  className="flex items-center gap-1.5 text-sm font-medium transition-colors px-2 py-1.5 rounded-md focus-visible:outline-2 focus-visible:outline-teal-600 focus-visible:outline-offset-2"
                  style={{ color: scope.menuItemText }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = scope.linkHover; e.currentTarget.style.background = scope.menuItemHoverBg }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = scope.menuItemText; e.currentTarget.style.background = 'transparent' }}
                >
                  <span className="max-w-[120px] truncate">{displayName}</span>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`shrink-0 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  collisionPadding={8}
                  className="w-48 rounded-lg shadow-lg py-1 z-50"
                  style={{ background: scope.dropdownBg, border: `1px solid ${scope.dropdownBorder}` }}
                >
                  {/* User info header */}
                  <div className="px-3 py-2" style={{ borderBottom: `1px solid ${scope.dropdownDivider}` }}>
                    <p className="text-xs font-semibold truncate" style={{ color: scope.userPrimary }}>{displayName}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: scope.userMeta }}>{user.email}</p>
                  </div>

                  <DropdownMenu.Item asChild>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors outline-none"
                      style={{ color: scope.menuItemText }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = scope.menuItemHoverBg; e.currentTarget.style.color = scope.menuItemHoverFg }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = scope.menuItemText }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      Profile
                    </Link>
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator className="my-1" style={{ borderTop: `1px solid ${scope.dropdownDivider}` }} />

                  <DropdownMenu.Item asChild>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors outline-none"
                      style={{ color: scope.signOutText }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = scope.signOutHoverBg; e.currentTarget.style.color = scope.signOutHoverFg }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = scope.signOutText }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Sign Out
                    </button>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : (
            // Logged-out: sign in / get started.
            // 2026-05-07 mobile-audit: explicit min-h-[44px] +
            // flex-center clears the 44px Apple HIG tap-target minimum
            // regardless of inner text height.
            <>
              <Link
                to="/signin"
                className="text-sm font-medium transition-colors px-3 -mx-1 min-h-[44px] inline-flex items-center focus-visible:outline-2 focus-visible:outline-teal-600 focus-visible:outline-offset-2 rounded-sm"
                style={{ color: scope.linkInactive }}
                onMouseEnter={(e) => { e.currentTarget.style.color = scope.linkHover }}
                onMouseLeave={(e) => { e.currentTarget.style.color = scope.linkInactive }}
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="text-sm font-medium bg-primary text-white px-4 rounded-sm hover:bg-primary-700 transition-colors min-h-[44px] inline-flex items-center focus-visible:outline-2 focus-visible:outline-teal-600 focus-visible:outline-offset-2"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

      </div>
    </nav>
  )
}

// V3 mark: brand-navy rounded square with teal "T". Survey-baseline tick marks
// nod to the *tractus* (Roman land surveyor) etymology.
function TractovaMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="26" height="26" rx="5" fill="#0F1A2E" />
      {/* Horizontal baseline of the T */}
      <rect x="5" y="7" width="16" height="2.5" rx="1.25" fill="#14B8A6" />
      {/* Vertical stem */}
      <rect x="11.75" y="9.5" width="2.5" height="10" rx="1.25" fill="#14B8A6" />
      {/* Survey tick marks on the baseline */}
      <rect x="6" y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6" opacity="0.6" />
      <rect x="19.2" y="10" width="0.8" height="2" rx="0.4" fill="#14B8A6" opacity="0.6" />
    </svg>
  )
}
