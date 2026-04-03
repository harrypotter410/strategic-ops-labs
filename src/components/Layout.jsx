import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useState, useEffect } from 'react'
import { useAssets, useDeals } from '../hooks/useData'
import QuickAdd from './QuickAdd'

function KWLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="38" y1="34" x2="38" y2="126" stroke="#163d27" strokeWidth="2" opacity="0.8"/>
      <line x1="38" y1="80" x2="58" y2="58" stroke="#a8d5bc" strokeWidth="1.5" opacity="0.5"/>
      <line x1="58" y1="58" x2="74" y2="40" stroke="#a8d5bc" strokeWidth="1.5" opacity="0.4"/>
      <line x1="38" y1="80" x2="58" y2="102" stroke="#a8d5bc" strokeWidth="1.5" opacity="0.5"/>
      <line x1="58" y1="102" x2="74" y2="120" stroke="#a8d5bc" strokeWidth="1.5" opacity="0.4"/>
      <line x1="86" y1="38" x2="96" y2="90" stroke="#a8d5bc" strokeWidth="1.5" opacity="0.5"/>
      <line x1="96" y1="90" x2="106" y2="64" stroke="#a8d5bc" strokeWidth="1.5" opacity="0.5"/>
      <line x1="106" y1="64" x2="116" y2="90" stroke="#a8d5bc" strokeWidth="1.5" opacity="0.5"/>
      <line x1="116" y1="90" x2="126" y2="38" stroke="#a8d5bc" strokeWidth="1.5" opacity="0.5"/>
      <circle cx="38" cy="34" r="7" fill="#c9a96e"/>
      <circle cx="38" cy="80" r="6" fill="#c9a96e"/>
      <circle cx="38" cy="126" r="7" fill="#c9a96e"/>
      <circle cx="58" cy="58" r="4.5" fill="#a8d5bc" opacity="0.7"/>
      <circle cx="74" cy="40" r="6" fill="#c9a96e"/>
      <circle cx="58" cy="102" r="4.5" fill="#a8d5bc" opacity="0.7"/>
      <circle cx="74" cy="120" r="6" fill="#c9a96e"/>
      <circle cx="86" cy="38" r="7" fill="#c9a96e"/>
      <circle cx="96" cy="90" r="6" fill="#c9a96e"/>
      <circle cx="106" cy="64" r="4.5" fill="#a8d5bc" opacity="0.7"/>
      <circle cx="116" cy="90" r="6" fill="#c9a96e"/>
      <circle cx="126" cy="38" r="7" fill="#c9a96e"/>
      <circle cx="22" cy="56" r="2.5" fill="#4a9e6e" opacity="0.4"/>
      <circle cx="22" cy="104" r="2.5" fill="#4a9e6e" opacity="0.3"/>
      <circle cx="140" cy="56" r="2.5" fill="#4a9e6e" opacity="0.3"/>
    </svg>
  )
}

const nav = [
  { section: 'Overview', items: [
    { to: '/', label: 'Portfolio Overview', icon: '⌂' },
    { to: '/map', label: 'Portfolio Map', icon: '◎' },
    { to: '/tasks', label: 'Tasks', icon: '✓' },
  ]},
  { section: 'Assets', items: [
    { to: '/assets', label: 'Asset Tracker', icon: '▦' },
    { to: '/financial', label: 'Performance', icon: '↗' },
    { to: '/valuations', label: 'Valuations', icon: '◈' },
    { to: '/debt', label: 'Debt & Covenants', icon: '⬡' },
    { to: '/irr', label: 'IRR & Exit Analysis', icon: '⟳' },
  ]},
  { section: 'Deals', items: [
    { to: '/pipeline', label: 'Acquisition Pipeline', icon: '◇' },
    { to: '/intel', label: 'Competitive Intel', icon: '◉' },
    { to: '/contacts', label: 'Contacts', icon: '○' },
  ]},
  { section: 'Output', items: [
    { to: '/reports', label: 'Report Builder', icon: '▤' },
  ]},
]

// Defined outside Layout to prevent re-mount focus issues
function SearchResults({ query, assets, deals, onClose }) {
  const navigate = useNavigate()
  if (!query) return null
  const q = query.toLowerCase()
  const matchPages = nav.flatMap(s => s.items).filter(i => i.label.toLowerCase().includes(q)).slice(0, 3)
  const matchAssets = assets.filter(a => a.name?.toLowerCase().includes(q) || a.market?.toLowerCase().includes(q)).slice(0, 5)
  const matchDeals = deals.filter(d => d.name?.toLowerCase().includes(q) || d.market?.toLowerCase().includes(q)).slice(0, 4)
  if (!matchPages.length && !matchAssets.length && !matchDeals.length) return (
    <div className="search-results"><div style={{padding:'12px 14px',fontSize:11,color:'#4a9e6e',fontFamily:'monospace'}}>No results</div></div>
  )
  return (
    <div className="search-results">
      {matchPages.length>0&&(
        <div className="search-result-group">
          <div className="search-result-label">Pages</div>
          {matchPages.map(p=><div key={p.to} className="search-result-item" onClick={()=>{navigate(p.to);onClose()}}><div className="search-result-name">{p.label}</div></div>)}
        </div>
      )}
      {matchAssets.length>0&&(
        <div className="search-result-group">
          <div className="search-result-label">Assets</div>
          {matchAssets.map(a=><div key={a.id} className="search-result-item" onClick={()=>{navigate(`/assets/${a.id}`);onClose()}}><div><div className="search-result-name">{a.name}</div><div className="search-result-sub">{a.market}</div></div></div>)}
        </div>
      )}
      {matchDeals.length>0&&(
        <div className="search-result-group">
          <div className="search-result-label">Deals</div>
          {matchDeals.map(d=><div key={d.id} className="search-result-item" onClick={()=>{navigate(`/deals/${d.id}`);onClose()}}><div><div className="search-result-name">{d.name}</div><div className="search-result-sub">{d.market}</div></div></div>)}
        </div>
      )}
    </div>
  )
}

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { assets } = useAssets()
  const { deals } = useDeals()
  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('soul-dark') === 'true')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('soul-dark', darkMode)
  }, [darkMode])

  const handleSignOut = async () => { await signOut(); navigate('/login') }
  const initials = user?.email?.slice(0,2).toUpperCase() || 'KW'

  return (
    <div className="app-shell">
      {/* ── SIDEBAR ── */}
      <nav className={`sidebar${collapsed?' collapsed':''}`}>

        {/* Logo */}
        <div className="logo-row" onClick={()=>navigate('/')}>
          <div className="logo-box"><KWLogo/></div>
          {!collapsed&&(
            <div className="logo-text-wrap">
              <div className="logo-soul">SOUL</div>
              <div className="logo-sub">KWHP · STRATEGIC OPS</div>
            </div>
          )}
        </div>

        {/* Search */}
        {!collapsed&&(
          <div className="sidebar-search-wrap" style={{position:'relative'}}>
            <input
              className="sidebar-search"
              placeholder="/ search..."
              value={search}
              onChange={e=>setSearch(e.target.value)}
              onFocus={()=>setSearchOpen(true)}
              onBlur={()=>setTimeout(()=>{setSearchOpen(false);setSearch('')},200)}
            />
            {searchOpen&&search&&<SearchResults query={search} assets={assets} deals={deals} onClose={()=>{setSearchOpen(false);setSearch('')}}/>}
          </div>
        )}

        {/* Nav */}
        {nav.map((section,si)=>(
          <div key={si} className="nav-section">
            {!collapsed&&<div className="nav-section-label">{section.section}</div>}
            {section.items.map(item=>(
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to==='/'}
                className={({isActive})=>`nav-link${isActive?' active':''}`}
                title={collapsed?item.label:undefined}
              >
                <span className="nav-icon">{item.icon}</span>
                {!collapsed&&<span className="nav-text">{item.label}</span>}
              </NavLink>
            ))}
            {si < nav.length-1 && <div className="nav-divider"/>}
          </div>
        ))}

        {/* Bottom controls */}
        <div className="sidebar-bottom">
          <button className="nav-link" onClick={()=>setDarkMode(d=>!d)}>
            <span className="nav-icon">{darkMode?'◐':'◑'}</span>
            {!collapsed&&<span className="nav-text">{darkMode?'Light mode':'Dark mode'}</span>}
          </button>
          <button className="nav-link" onClick={handleSignOut}>
            <span className="nav-icon">⎋</span>
            {!collapsed&&<span className="nav-text">Sign out</span>}
          </button>
          <button className="nav-link" onClick={()=>setCollapsed(c=>!c)} title={collapsed?'Expand sidebar':'Collapse sidebar'}>
            <span className="nav-icon">{collapsed?'→':'←'}</span>
            {!collapsed&&<span className="nav-text">Collapse</span>}
          </button>
        </div>
      </nav>

      {/* ── MAIN ── */}
      <div className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            SOUL · KWHP · {new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'}).toUpperCase()}
          </div>
          <div className="topbar-right">
            <div className="topbar-badge">{assets.length} ASSETS TRACKED</div>
            <div className="topbar-avatar">{initials}</div>
          </div>
        </div>

        {/* Page content */}
        <div className="page-content">
          {children}
        </div>
      </div>

      <QuickAdd/>
    </div>
  )
}
