import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    else navigate('/')
    setLoading(false)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <div style={{ width: 36, height: 36, background: '#2a6e47', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 18 18" fill="none" style={{ width: 20, height: 20 }}>
              <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" opacity=".9"/>
              <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity=".6"/>
              <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity=".6"/>
              <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" opacity=".3"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 14, fontWeight: 600, color: '#0d2b1a' }}>SOUL</div>
            <div style={{ fontSize: 10, color: '#7a817a', letterSpacing: '.08em', textTransform: 'uppercase' }}>Strategic Ops & Underwriting Lab</div>
          </div>
        </div>
        <div className="login-title">Welcome back</div>
        <div className="login-sub">Sign in to access your portfolio dashboard</div>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@kemmonswilson.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p style={{ fontSize: 11, color: '#7a817a', marginTop: 16, textAlign: 'center' }}>
          Need access? Contact your admin to be invited.
        </p>
      </div>
    </div>
  )
}
