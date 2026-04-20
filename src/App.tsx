import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SessionConfig from './pages/SessionConfig'
import Present from './pages/Present'
import JoinPage from './pages/JoinPage'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sessions/:id" element={<SessionConfig />} />
        <Route path="/sessions/:id/present" element={<Present />} />
        <Route path="/j/:code" element={<JoinPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}
