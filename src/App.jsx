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
          <Route path="/"         element={<Dashboard />} />
          <Route path="/glossary" element={<Glossary />} />
          <Route path="/library"  element={<Library />} />
          <Route path="/signin"   element={<SignIn />} />
          <Route path="/signup"   element={<SignUp />} />
          <Route path="/profile"  element={<Profile />} />

          {/* Search is gated — redirects to /signin with a message if not logged in */}
          <Route
            path="/search"
            element={
              <ProtectedRoute message="Sign in to access Catered Search.">
                <Search />
              </ProtectedRoute>
            }
          />
        </Routes>
        <Footer />
      </AuthProvider>
    </BrowserRouter>
  )
}
