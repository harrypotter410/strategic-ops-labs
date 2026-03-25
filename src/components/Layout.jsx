import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

const Logo = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" opacity=".9"/>
    <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity=".6"/>
    <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity=".6"/>
    <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" opacity=".3"/>
  </svg>
)

const nav = [
  { section: 'Overview', items: [{ to: '/', label: 'Portfolio Overview', icon: <Logo /> }] },
  {
    section: 'Asset Management', items: [
      { to: '/assets', label: 'Asset Tracker', icon: <svg viewBox="0 0 16 16" fill="none"><path d="M8 1L14 5V11L8 15L2 11V5L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg> },
      { to: '/financial', label: 'Financial Performance', icon: <svg viewBox="0 0 16 16" fill="none"><polyline points="2,12 6,7 9,9 14,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
      { to: '/kpis', label: 'Property KPIs', badge: '12', icon: <svg viewBox="0 0 16 16" fill="none"><circle cx="5" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/></svg> },
    ]
  },
  {
    section: 'Deals', items: [
      { to: '/pipeline', label: 'Acquisition Pipeline', badge: '5', icon: <svg viewBox="0 0 16 16" fill="none"><path d="M2 14V6L8 2L14 6V14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><rect x="6" y="9" width="4" height="5" rx=".5" stroke="currentColor" strokeWidth="1.5"/></svg> },
      { to: '/intel', label: 'Competitive Intel', icon: <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><line x1="5" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="5" y1="10" x2="9" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    ]
  },
  {
    section: 'Output', items: [
      { to: '/reports', label: 'Report Builder', icon: <svg viewBox="0 0 16 16" fill="none"><path d="M3 2H10L13 5V14H3V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M10 2V5H13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
      { to: '/upload', label: 'Data Import', icon: <svg viewBox="0 0 16 16" fill="none"><path d="M8 10V2M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    ]
  },
]

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'SA'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo"><Logo /></div>
          <div>
            <span className="brand-sol">Strategic Ops Labs</span>
            <span className="brand-kwh">Kemmons Wilson Hospitality</span>
          </div>
        </div>
        <div className="topbar-right">
          <span className="topbar-badge">Q1 2026</span>
          <div className="avatar" title={user?.email} onClick={handleSignOut}>{initials}</div>
        </div>
      </header>

      <div className="content-area">
        <nav className="sidebar">
          {nav.map(section => (
            <div key={section.section}>
              <div className="sidebar-label">{section.section}</div>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  {item.icon}
                  {item.label}
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <main className="main">{children}</main>
      </div>
    </div>
  )
}
