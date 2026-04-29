import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CompareProvider } from './context/CompareContext'
import { TooltipProvider } from './components/ui/Tooltip'
import { ToastProvider } from './components/ui/Toast'
import CompareTray from './components/CompareTray'
import CommandPalette from './components/CommandPalette'
import Nav from './components/Nav'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import Search from './pages/Search'
import Glossary from './pages/Glossary'
import Library from './pages/Library'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Profile from './pages/Profile'
import UpgradeSuccess from './pages/UpgradeSuccess'
import Admin from './pages/Admin'
import MemoView from './pages/MemoView'

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
      <AuthProvider>
        <CompareProvider>
        <TooltipProvider delayDuration={200}>
        <ToastProvider>
        <Nav />
        <Routes>
          {/* Public routes */}
          <Route path="/"       element={<HomeRoute />} />
          <Route path="/signin"          element={<SignIn />} />
          <Route path="/signup"          element={<SignUp />} />
          <Route path="/upgrade-success" element={<UpgradeSuccess />} />
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
