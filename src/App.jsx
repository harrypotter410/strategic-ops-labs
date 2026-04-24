import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Assets from './pages/Assets'
import AssetDetail from './pages/AssetDetail'
import Performance from './pages/Performance'
import Valuations from './pages/Valuations'
import Pipeline from './pages/Pipeline'
import DealDetail from './pages/DealDetail'
import Intel from './pages/Intel'
import STRBenchmark from './pages/STRBenchmark'
import Reports from './pages/Reports'
import DataHub from './pages/DataHub'
import PortfolioMap from './pages/PortfolioMap'
import Tasks from './pages/Tasks'
import DebtTracker from './pages/DebtTracker'
import Contacts from './pages/Contacts'
import IRRDashboard from './pages/IRRDashboard'
import KeyDates from './pages/KeyDates'
import Import from './pages/Import'
import Integrations from './pages/Integrations'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0d2b1a'}}>
      <div style={{textAlign:'center'}}>
        <div style={{fontFamily:'Playfair Display,serif',fontSize:22,fontWeight:700,color:'#fff',letterSpacing:'0.12em',marginBottom:6}}>SOUL</div>
        <div style={{fontSize:11,color:'#a8d5bc',letterSpacing:'0.15em',textTransform:'uppercase'}}>Loading...</div>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace/>
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login/>}/>
          <Route path="/" element={<ProtectedRoute><Overview/></ProtectedRoute>}/>
          <Route path="/map" element={<ProtectedRoute><PortfolioMap/></ProtectedRoute>}/>
          <Route path="/tasks" element={<ProtectedRoute><Tasks/></ProtectedRoute>}/>
          <Route path="/assets" element={<ProtectedRoute><Assets/></ProtectedRoute>}/>
          <Route path="/assets/:id" element={<ProtectedRoute><AssetDetail/></ProtectedRoute>}/>
          <Route path="/financial" element={<ProtectedRoute><Performance/></ProtectedRoute>}/>
          <Route path="/kpis" element={<ProtectedRoute><Performance/></ProtectedRoute>}/>
          <Route path="/valuations" element={<ProtectedRoute><Valuations/></ProtectedRoute>}/>
          <Route path="/debt" element={<ProtectedRoute><DebtTracker/></ProtectedRoute>}/>
          <Route path="/irr" element={<ProtectedRoute><IRRDashboard/></ProtectedRoute>}/>
          <Route path="/key-dates" element={<ProtectedRoute><KeyDates/></ProtectedRoute>}/>
          <Route path="/pipeline" element={<ProtectedRoute><Pipeline/></ProtectedRoute>}/>
          <Route path="/deals/:id" element={<ProtectedRoute><DealDetail/></ProtectedRoute>}/>
          <Route path="/intel" element={<ProtectedRoute><Intel/></ProtectedRoute>}/>
          <Route path="/str-benchmark" element={<ProtectedRoute><STRBenchmark/></ProtectedRoute>}/>
          <Route path="/contacts" element={<ProtectedRoute><Contacts/></ProtectedRoute>}/>
          <Route path="/reports" element={<ProtectedRoute><Reports/></ProtectedRoute>}/>
          <Route path="/data" element={<ProtectedRoute><DataHub/></ProtectedRoute>}/>
          <Route path="/import" element={<ProtectedRoute><Import/></ProtectedRoute>}/>
          <Route path="/integrations" element={<ProtectedRoute><Integrations/></ProtectedRoute>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
