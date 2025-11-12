import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import Home from './pages/Home'
import Generate from './pages/Generate'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/" className="text-2xl font-bold text-gradient tracking-tight transition hover:opacity-90">
              ColdConnect
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link to="/" className="text-gray-600 hover:text-primary-600 transition-colors duration-200 font-medium">
                Home
              </Link>
              <Link to="/generate" className="text-gray-600 hover:text-primary-600 transition-colors duration-200 font-medium">
                Generate
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/generate" element={<Generate />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
