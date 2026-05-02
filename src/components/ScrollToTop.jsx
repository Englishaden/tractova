import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Reset window scroll to top on every route change UNLESS the URL has a hash
// (in which case the destination page's own anchor logic should handle it —
// e.g., Glossary.jsx's deep-link useEffect at lines 359-405 scrolls to the
// matching term card).
//
// Why this exists: React Router's default behavior preserves window scroll
// position across route changes. Navigating from a long page (Lens result,
// Library with many projects) to /glossary keeps the prior scroll offset,
// landing the user near the bottom of the new page instead of the top.
// This is a known React Router gotcha and the standard fix is a global
// scroll-restoration component mounted inside <BrowserRouter>.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) return
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])
  return null
}
