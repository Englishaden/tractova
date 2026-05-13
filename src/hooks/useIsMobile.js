import { useState, useEffect } from 'react'

// Mirrors MobileGate.jsx's <768px threshold so route-level decisions
// (Library → MobileLibrary swap; Compare tray hide) share a single
// definition. Listens to matchMedia change so a window-shrunk desktop
// flips immediately rather than staying stale until refresh.
const MOBILE_QUERY = '(max-width: 767px)'

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(MOBILE_QUERY).matches
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(MOBILE_QUERY)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}
