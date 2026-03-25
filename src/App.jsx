import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Assets from './pages/Assets'
import Financial from './pages/Financial'
import KPIs from './pages/KPIs'
import Pipeline from './pages/Pipeline'
import Intel from './pages/Intel'
import Reports from './pages/Reports'
import Valuations from './pages/Valuations'
import DataHub from './pages/DataHub'
import PortfolioMap from './pages/PortfolioMap'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#0d2b1a' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontFamily:'Playfair Display,serif', fontSize:22, fontWeight:700, color:'#fff', letterSpacing:'0.12em', marginBottom:6 }}>SOUL</div>
        <div style={{ fontSize:11, color:'#a8d5bc', letterSpacing:'0.15em', textTransform:'uppercase' }}>Loading...</div>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
          <Route path="/map" element={<ProtectedRoute><PortfolioMap /></ProtectedRoute>} />
          <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
          <Route path="/financial" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
          <Route path="/kpis" element={<ProtectedRoute><KPIs /></ProtectedRoute>} />
          <Route path="/valuations" element={<ProtectedRoute><Valuations /></ProtectedRoute>} />
          <Route path="/pipeline" element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
          <Route path="/intel" element={<ProtectedRoute><Intel /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/data" element={<ProtectedRoute><DataHub /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
