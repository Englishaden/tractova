import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CompareProvider } from './context/CompareContext'
import { TooltipProvider } from './components/ui/Tooltip'
import { ToastProvider } from './components/ui/Toast'
import { LoadingDot } from './components/ui'
import CompareTray from './components/CompareTray'
import CommandPalette from './components/CommandPalette'
import Nav from './components/Nav'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import ScrollToTop from './components/ScrollToTop'

// Eagerly loaded -- on the critical path for new visitors and most
// signed-in returns (Dashboard is the home for authed users; Landing
// for anon; auth pages are tiny and likely-next-step from Landing).
import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'

// Lazy-loaded -- not on the initial-render critical path. Suspense
// fallback is the same mono-caps + teal-pulse loading affordance used
// by ProtectedRoute, so the visual language stays consistent.
const Search          = lazy(() => import('./pages/Search'))
const Library         = lazy(() => import('./pages/Library'))
const Glossary        = lazy(() => import('./pages/Glossary'))
const Profile         = lazy(() => import('./pages/Profile'))
const Admin           = lazy(() => import('./pages/Admin'))
const MemoView        = lazy(() => import('./pages/MemoView'))
const UpgradeSuccess  = lazy(() => import('./pages/UpgradeSuccess'))
const UpdatePassword  = lazy(() => import('./pages/UpdatePassword'))
const Privacy         = lazy(() => import('./pages/Privacy'))
const Terms           = lazy(() => import('./pages/Terms'))

// Branded route-level Suspense fallback. Matches ProtectedRoute's
// loading state visually so transitions feel coherent.
function RouteFallback() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center pt-14">
      <LoadingDot />
    </div>
  )
}

// Shows Landing to logged-out visitors, Dashboard to signed-in users.
// Blank surface during auth hydration prevents content flash.
function HomeRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="pt-14 min-h-screen bg-surface" />
  return user ? <Dashboard /> : <Landing />
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <CompareProvider>
        <TooltipProvider delayDuration={200}>
        <ToastProvider>
        <Nav />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public routes */}
            <Route path="/"       element={<HomeRoute />} />
            <Route path="/signin"          element={<SignIn />} />
            <Route path="/signup"          element={<SignUp />} />
            <Route path="/upgrade-success" element={<UpgradeSuccess />} />
            <Route path="/update-password" element={<UpdatePassword />} />
            <Route path="/preview"         element={<Dashboard previewMode />} />

            {/* Gated routes — require sign-in */}
            <Route
              path="/search"
              element={
                <ProtectedRoute message="Sign in to access Tractova Lens intelligence reports.">
                  <Search />
                </ProtectedRoute>
              }
            />
            <Route
              path="/library"
              element={
                <ProtectedRoute message="Sign in to view and manage your saved projects.">
                  <Library />
                </ProtectedRoute>
              }
            />
            <Route path="/glossary" element={<Glossary />} />
            <Route path="/admin" element={<Admin />} />
            {/* Public legal pages — no auth */}
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms"   element={<Terms />} />
            {/* Public read-only Deal Memo by share token (no auth) */}
            <Route path="/memo/:token" element={<MemoView />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute message="Sign in to view your profile.">
                  <Profile />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
        <Footer />
        <CompareTray />
        <CommandPalette />
        </ToastProvider>
        </TooltipProvider>
        </CompareProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
