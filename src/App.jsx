import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Nav from './components/Nav'
import Footer from './components/Footer'
import Dashboard from './pages/Dashboard'
import Search from './pages/Search'
import Library from './pages/Library'

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <Routes>
        <Route path="/"        element={<Dashboard />} />
        <Route path="/search"  element={<Search />} />
        <Route path="/library" element={<Library />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}
