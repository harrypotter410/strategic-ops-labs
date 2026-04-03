import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

function KWConstellation({ size = 160 }) {
  const s = size / 160
  const scale = (n) => n * s

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── K letter constellation ── */}
      {/* K spine: top, mid, bottom */}
      {/* K upper arm: mid → upper-right → tip */}
      {/* K lower arm: mid → lower-right → tip */}

      {/* Spine connections */}
      <line x1="38" y1="34" x2="38" y2="80" stroke="#163d27" strokeWidth="1" opacity="0.7"/>
      <line x1="38" y1="80" x2="38" y2="126" stroke="#163d27" strokeWidth="1" opacity="0.7"/>

      {/* Upper arm */}
      <line x1="38" y1="80" x2="58" y2="58" stroke="#a8d5bc" strokeWidth="0.8" opacity="0.5"/>
      <line x1="58" y1="58" x2="74" y2="40" stroke="#a8d5bc" strokeWidth="0.8" opacity="0.4"/>

      {/* Lower arm */}
      <line x1="38" y1="80" x2="58" y2="102" stroke="#a8d5bc" strokeWidth="0.8" opacity="0.5"/>
      <line x1="58" y1="102" x2="74" y2="120" stroke="#a8d5bc" strokeWidth="0.8" opacity="0.4"/>

      {/* ── W letter constellation ── */}
      {/* W: top-left, valley-left, peak, valley-right, top-right */}
      <line x1="86" y1="38" x2="96" y2="90" stroke="#a8d5bc" strokeWidth="0.8" opacity="0.5"/>
      <line x1="96" y1="90" x2="106" y2="64" stroke="#a8d5bc" strokeWidth="0.8" opacity="0.5"/>
      <line x1="106" y1="64" x2="116" y2="90" stroke="#a8d5bc" strokeWidth="0.8" opacity="0.5"/>
      <line x1="116" y1="90" x2="126" y2="38" stroke="#a8d5bc" strokeWidth="0.8" opacity="0.5"/>

      {/* Subtle cross-letter bridge */}
      <line x1="74" y1="40" x2="86" y2="38" stroke="#2a6e47" strokeWidth="0.5" strokeDasharray="3,5" opacity="0.3"/>

      {/* ── K star nodes ── */}
      {/* Top */}
      <circle cx="38" cy="34" r="5" fill="#c9a96e"/>
      <circle cx="38" cy="34" r="8" fill="#c9a96e" opacity="0.1"/>
      {/* Mid (pivot) */}
      <circle cx="38" cy="80" r="4.5" fill="#c9a96e"/>
      <circle cx="38" cy="80" r="8" fill="#c9a96e" opacity="0.08"/>
      {/* Bottom */}
      <circle cx="38" cy="126" r="5" fill="#c9a96e"/>
      <circle cx="38" cy="126" r="8" fill="#c9a96e" opacity="0.1"/>
      {/* Upper arm midpoint */}
      <circle cx="58" cy="58" r="3" fill="#a8d5bc" opacity="0.75"/>
      {/* Upper arm tip */}
      <circle cx="74" cy="40" r="4" fill="#c9a96e"/>
      {/* Lower arm midpoint */}
      <circle cx="58" cy="102" r="3" fill="#a8d5bc" opacity="0.75"/>
      {/* Lower arm tip */}
      <circle cx="74" cy="120" r="4" fill="#c9a96e"/>

      {/* ── W star nodes ── */}
      {/* Top-left */}
      <circle cx="86" cy="38" r="5" fill="#c9a96e"/>
      <circle cx="86" cy="38" r="8" fill="#c9a96e" opacity="0.1"/>
      {/* Valley-left */}
      <circle cx="96" cy="90" r="4.5" fill="#c9a96e"/>
      {/* Peak (middle high point) */}
      <circle cx="106" cy="64" r="3.5" fill="#a8d5bc" opacity="0.8"/>
      {/* Valley-right */}
      <circle cx="116" cy="90" r="4.5" fill="#c9a96e"/>
      {/* Top-right */}
      <circle cx="126" cy="38" r="5" fill="#c9a96e"/>
      <circle cx="126" cy="38" r="8" fill="#c9a96e" opacity="0.1"/>

      {/* ── Ambient stars ── */}
      <circle cx="22" cy="56" r="1.5" fill="#4a9e6e" opacity="0.5"/>
      <circle cx="22" cy="104" r="1.5" fill="#4a9e6e" opacity="0.35"/>
      <circle cx="56" cy="140" r="1.5" fill="#4a9e6e" opacity="0.4"/>
      <circle cx="140" cy="56" r="1.5" fill="#4a9e6e" opacity="0.35"/>
      <circle cx="82" cy="18" r="1.5" fill="#c9a96e" opacity="0.3"/>
      <circle cx="138" cy="110" r="1.2" fill="#4a9e6e" opacity="0.3"/>
      <circle cx="18" cy="80" r="1" fill="#2a6e47" opacity="0.4"/>
    </svg>
  )
}

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError('Invalid credentials. Please try again.')
      setLoading(false)
      return
    }
    navigate('/')
  }

  return (
    <div className="login-wrap">
      {/* Left — branding panel */}
      <div className="login-left">
        <div className="login-constellation">
          <KWConstellation size={160}/>
        </div>
        <div className="login-brand-soul">SOUL</div>
        <div className="login-brand-sub">Strategic Ops &amp; Underwriting Lab</div>
        <div className="login-tagline">
          Portfolio intelligence for<br/>
          Kemmons Wilson Hospitality Partners
        </div>
      </div>

      {/* Right — sign in form */}
      <div className="login-right">
        <div style={{width:'100%',maxWidth:320}}>
          <div className="login-form-title">Sign in</div>
          <div className="login-form-sub">KWHP · SECURE ACCESS</div>

          {error && <div className="login-error">{error}</div>}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={e=>setEmail(e.target.value)}
                placeholder="you@kwhp.com"
                autoComplete="email"
                required
              />
            </div>
            <div className="form-group" style={{marginBottom:20}}>
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? 'SIGNING IN...' : 'SIGN IN →'}
            </button>
          </form>

          <div style={{
            marginTop:28,
            paddingTop:20,
            borderTop:'1px solid #163d27',
            fontFamily:'JetBrains Mono, monospace',
            fontSize:9,
            color:'#2a6e47',
            letterSpacing:'1px',
            textAlign:'center',
            lineHeight:1.8
          }}>
            SOUL v2 · KWHP INTERNAL USE ONLY<br/>
            © {new Date().getFullYear()} Kemmons Wilson Hospitality Partners
          </div>
        </div>
      </div>
    </div>
  )
}
