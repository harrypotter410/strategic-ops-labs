import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useState, useEffect } from 'react'
import { useAssets, useDeals } from '../hooks/useData'
import QuickAdd from './QuickAdd'

const Logo = () => (
  <svg viewBox="0 0 18 18" fill="none">
    <rect x="2" y="2" width="6" height="6" rx="1.5" fill="white" opacity=".9"/>
    <rect x="10" y="2" width="6" height="6" rx="1.5" fill="white" opacity=".6"/>
    <rect x="2" y="10" width="6" height="6" rx="1.5" fill="white" opacity=".6"/>
    <rect x="10" y="10" width="6" height="6" rx="1.5" fill="white" opacity=".3"/>
  </svg>
)

const nav = [
  { section: 'Overview', items: [
    { to: '/', label: 'Portfolio Overview', icon: <Logo /> },
    { to: '/map', label: 'Portfolio Map', icon: <svg viewBox="0 0 16 16" fill="none"><path d="M8 1C5.24 1 3 3.24 3 6c0 4 5 9 5 9s5-5 5-9c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="8" cy="6" r="1.5" fill="currentColor"/></svg> },
    { to: '/tasks', label: 'Tasks', icon: <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 7l2 2 4-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  ]},
  { section: 'Asset Management', items: [
    { to: '/assets', label: 'Asset Tracker', icon: <svg viewBox="0 0 16 16" fill="none"><path d="M8 1L14 5V11L8 15L2 11V5L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg> },
    { to: '/financial', label: 'Performance', icon: <svg viewBox="0 0 16 16" fill="none"><polyline points="2,12 6,7 9,9 14,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { to: '/valuations', label: 'Valuations', icon: <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="10" width="2.5" height="4" rx=".5" fill="currentColor"/><rect x="6.5" y="7" width="2.5" height="7" rx=".5" fill="currentColor"/><rect x="11" y="4" width="2.5" height="10" rx=".5" fill="currentColor"/></svg> },
    { to: '/debt', label: 'Debt & Covenants', icon: <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1 7h14" stroke="currentColor" strokeWidth="1.5"/><circle cx="5" cy="10.5" r="1" fill="currentColor"/></svg> },
    { to: '/irr', label: 'IRR & Exit Analysis', icon: <svg viewBox="0 0 16 16" fill="none"><polyline points="2,14 5,9 8,11 14,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="14" cy="4" r="1.5" fill="currentColor"/></svg> },
  ]},
  { section: 'Deals', items: [
    { to: '/pipeline', label: 'Acquisition Pipeline', icon: <svg viewBox="0 0 16 16" fill="none"><path d="M2 14V6L8 2L14 6V14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><rect x="6" y="9" width="4" height="5" rx=".5" stroke="currentColor" strokeWidth="1.5"/></svg> },
    { to: '/intel', label: 'Competitive Intel', icon: <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><line x1="5" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    { to: '/contacts', label: 'Contacts', icon: <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 14c0-3.31 2.69-5 6-5s6 1.69 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  ]},
  { section: 'Output', items: [
    { to: '/reports', label: 'Report Builder', icon: <svg viewBox="0 0 16 16" fill="none"><path d="M3 2H10L13 5V14H3V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M10 2V5H13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  ]},
]

// SearchResults defined OUTSIDE Layout to prevent re-mount on every render
function SearchResults({ query, assets, deals, onClose }) {
  const navigate = useNavigate()
  if (!query) return null
  const q = query.toLowerCase()
  const matchPages = nav.flatMap(s => s.items).filter(i => i.label.toLowerCase().includes(q)).slice(0, 3)
  const matchAssets = assets.filter(a => a.name.toLowerCase().includes(q) || a.market?.toLowerCase().includes(q)).slice(0, 5)
  const matchDeals = deals.filter(d => d.name.toLowerCase().includes(q) || d.market?.toLowerCase().includes(q)).slice(0, 4)
  if (!matchPages.length && !matchAssets.length && !matchDeals.length) return (
    <div className="search-results"><div style={{padding:'12px 16px',fontSize:12,color:'var(--gray500)'}}>No results for "{query}"</div></div>
  )
  return (
    <div className="search-results">
      {matchPages.length>0&&<div className="search-result-group"><div className="search-result-label">Pages</div>{matchPages.map(p=><div key={p.to} className="search-result-item" onClick={()=>{navigate(p.to);onClose()}}><div className="search-result-name">{p.icon} {p.label}</div></div>)}</div>}
      {matchAssets.length>0&&<div className="search-result-group"><div className="search-result-label">Assets</div>{matchAssets.map(a=><div key={a.id} className="search-result-item" onClick={()=>{navigate(`/assets/${a.id}`);onClose()}}><div><div className="search-result-name">{a.name}</div><div className="search-result-sub">{a.market}</div></div></div>)}</div>}
      {matchDeals.length>0&&<div className="search-result-group"><div className="search-result-label">Deals</div>{matchDeals.map(d=><div key={d.id} className="search-result-item" onClick={()=>{navigate(`/deals/${d.id}`);onClose()}}><div><div className="search-result-name">{d.name}</div><div className="search-result-sub">{d.market}</div></div></div>)}</div>}
    </div>
  )
}

export default function Layout({ children }) {
  const { signOut } = useAuth()
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

  return (
    <div className={`app-shell${collapsed?' sidebar-collapsed':''}`}>
      <nav className={`sidebar${collapsed?' collapsed':''}`}>
        {/* Logo */}
        <div className="sidebar-logo" onClick={()=>navigate('/')} style={{cursor:'pointer'}}>
          <div className="logo-icon"><Logo/></div>
          {!collapsed&&<span className="logo-text">SOUL</span>}
        </div>

        {/* Search */}
        {!collapsed&&(
          <div style={{padding:'0 12px 8px',position:'relative'}}>
            <input
              className="sidebar-search"
              placeholder="Search..."
              value={search}
              onChange={e=>setSearch(e.target.value)}
              onFocus={()=>setSearchOpen(true)}
              onBlur={()=>setTimeout(()=>{setSearchOpen(false);setSearch('')},200)}
            />
            {searchOpen&&search&&<SearchResults query={search} assets={assets} deals={deals} onClose={()=>{setSearchOpen(false);setSearch('')}}/>}
          </div>
        )}

        {/* Nav sections */}
        {nav.map((section,si)=>(
          <div key={si} className="nav-section">
            {!collapsed&&<div className="nav-section-label">{section.section}</div>}
            {section.items.map(item=>(
              <NavLink key={item.to} to={item.to} end={item.to==='/'} className={({isActive})=>`nav-link${isActive?' active':''}`} title={collapsed?item.label:undefined}>
                <span className="nav-icon">{item.icon}</span>
                {!collapsed&&<span className="nav-text">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}

        {/* Bottom */}
        <div className="sidebar-bottom">
          <button className="nav-link" onClick={()=>setDarkMode(d=>!d)}>
            <span className="nav-icon">{darkMode?'☀':'◑'}</span>
            {!collapsed&&<span className="nav-text">{darkMode?'Light mode':'Dark mode'}</span>}
          </button>
          <button className="nav-link" onClick={handleSignOut}>
            <span className="nav-icon">⎋</span>
            {!collapsed&&<span className="nav-text">Sign out</span>}
          </button>
          <button className="nav-link" onClick={()=>setCollapsed(c=>!c)}>
            <span className="nav-icon">{collapsed?'→':'←'}</span>
            {!collapsed&&<span className="nav-text">Collapse</span>}
          </button>
        </div>
      </nav>

      <main className="main-content">
        {children}
      </main>

      <QuickAdd/>
    </div>
  )
}
