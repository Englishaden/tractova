import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Nav from './components/Nav'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Search from './pages/Search'
import Glossary from './pages/Glossary'
import Library from './pages/Library'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Profile from './pages/Profile'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Nav />
        <Routes>
          {/* Public routes */}
          <Route path="/"       element={<Dashboard />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />

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
          <Route
            path="/glossary"
            element={
              <ProtectedRoute message="Sign in to access the full Tractova glossary.">
                <Glossary />
              </ProtectedRoute>
            }
          />
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
      </AuthProvider>
    </BrowserRouter>
  )
}
