import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Diary from './pages/Diary'
import Shelf from './pages/Shelf'
import Insights from './pages/Insights'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/diary" element={<Diary />} />
              <Route path="/shelf" element={<Shelf />} />
              <Route path="/library" element={<Navigate to="/shelf" replace />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/" element={<Navigate to="/diary" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
