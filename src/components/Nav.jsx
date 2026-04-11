import { Link, useLocation } from 'react-router-dom'

export default function Nav() {
  const location = useLocation()

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

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-14">
      <div className="max-w-dashboard mx-auto px-6 h-full flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 select-none">
          <TractovaMark />
          <span className="text-lg font-semibold tracking-tight text-gray-900">
            tractova
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-7">
          {navLink('/', 'Dashboard')}
          {navLink('/search', 'Search')}
          {navLink('/library', 'My Projects')}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          <button className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Sign In
          </button>
          <button className="text-sm font-medium bg-primary text-white px-4 py-1.5 rounded hover:bg-primary-700 transition-colors">
            Get Started
          </button>
        </div>
      </div>
    </nav>
  )
}

function TractovaMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="26" height="26" rx="5" fill="#0F6E56" />
      {/* Abstract surveyor's T mark */}
      <rect x="5" y="7" width="16" height="2.5" rx="1.25" fill="white" />
      <rect x="11.75" y="9.5" width="2.5" height="10" rx="1.25" fill="white" />
    </svg>
  )
}
