import { useRef, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Nav() {
  const location = useLocation()
  const { user, loading, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return
    const handle = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [dropdownOpen])

  // Close dropdown on route change
  useEffect(() => { setDropdownOpen(false) }, [location.pathname])

  const navLink = (to, label) => {
    const active = location.pathname === to
    return (
      <Link
        to={to}
        className={`text-sm font-medium transition-colors px-1 pb-0.5 ${
          active
            ? 'text-primary border-b-2 border-primary'
            : 'text-gray-500 hover:text-gray-900'
        }`}
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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-14">
      <div className="max-w-dashboard mx-auto px-6 h-full flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 select-none">
          <TractovaMark />
          <span className="text-lg font-semibold tracking-tight text-gray-900">tractova</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-7">
          {navLink('/', 'Dashboard')}
          {navLink('/search', 'Tractova Lens')}
          {navLink('/glossary', 'Glossary')}
          {navLink('/library', 'My Projects')}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {loading ? (
            <div className="w-32 h-7 bg-gray-100 rounded animate-pulse" />
          ) : user ? (
            // ── Logged-in: user dropdown ──────────────────────────────────────
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors px-2 py-1.5 rounded-md hover:bg-gray-50"
              >
                <span className="max-w-[120px] truncate">{displayName}</span>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`flex-shrink-0 transition-transform duration-150 ${dropdownOpen ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                  {/* User info header */}
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-800 truncate">{displayName}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{user.email}</p>
                  </div>

                  {/* Profile */}
                  <Link
                    to="/profile"
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    Profile
                  </Link>

                  {/* Divider */}
                  <div className="my-1 border-t border-gray-100" />

                  {/* Sign Out */}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            // ── Logged-out: sign in / get started ─────────────────────────────
            <>
              <Link
                to="/signin"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="text-sm font-medium bg-primary text-white px-4 py-1.5 rounded hover:bg-primary-700 transition-colors"
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

function TractovaMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="26" height="26" rx="5" fill="#0F6E56" />
      <rect x="5" y="7" width="16" height="2.5" rx="1.25" fill="white" />
      <rect x="11.75" y="9.5" width="2.5" height="10" rx="1.25" fill="white" />
    </svg>
  )
}
