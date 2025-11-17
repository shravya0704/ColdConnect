import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import Home from './pages/Home'
import Generate from './pages/Generate'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Auth from './components/Auth'
import { supabase } from './supabaseClient'
import type { User } from '@supabase/supabase-js'

function ResetPassword() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full p-6 bg-white rounded shadow">
        <h1 className="text-xl font-semibold mb-4">Reset Password</h1>
        <p className="text-sm text-gray-600">To reset your password, follow the instructions sent to your email.</p>
      </div>
    </div>
  )
}

// Redirects any `type=recovery` URL to the reset-password route and listens for Supabase recovery event
function RecoveryRedirect() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.hash && location.hash.includes('type=recovery')) {
      navigate('/reset-password' + location.hash, { replace: true })
    }
  }, [location, navigate])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true })
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  return null
}

// ProtectedRoute component
function ProtectedRoute({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        console.error("Supabase auth error:", error)
      }
      setUser(data?.user ?? null)
      setLoading(false)
    }

    checkUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-primary-700 font-semibold">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <RecoveryRedirect />
      <div className="min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link
              to="/"
              className="text-2xl font-bold text-gradient tracking-tight transition hover:opacity-90"
            >
              ColdConnect
            </Link>

            <div className="flex items-center gap-6">
              <nav className="flex items-center gap-6 text-sm">
                <Link
                  to="/"
                  className="text-gray-600 hover:text-primary-600 transition-colors duration-200 font-medium"
                >
                  Home
                </Link>

                <Link
                  to="/generate"
                  className="text-gray-600 hover:text-primary-600 transition-colors duration-200 font-medium"
                >
                  Generate
                </Link>

                <Link
                  to="/dashboard"
                  className="text-gray-600 hover:text-primary-600 transition-colors duration-200 font-medium"
                >
                  Dashboard
                </Link>
              </nav>

              <div className="border-l border-gray-200 pl-6">
                <Auth />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            {/** OAuth removed: no auth callback route */}
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route
              path="/generate"
              element={
                <ProtectedRoute>
                  <Generate />
                </ProtectedRoute>
              }
            />

            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
