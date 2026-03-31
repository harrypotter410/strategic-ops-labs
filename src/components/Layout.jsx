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

// Simplified nav — removed Budget vs Actual, STR Benchmark, Data Hub
const nav = [
  { section: 'Overview', items: [
    { to: '/', label: 'Portfolio Overview', icon: '⌂' },
    { to: '/map', label: 'Portfolio Map', icon: '📍' },
    { to: '/tasks', label: 'Tasks', icon: '✓' },
  ]},
  { section: 'Asset Management', items: [
    { to: '/assets', label: 'Asset Tracker', icon: '🏨' },
    { to: '/financial', label: 'Performance', icon: '📈' },
    { to: '/valuations', label: 'Valuations', icon: '📊' },
    { to: '/debt', label: 'Debt & Covenants', icon: '🏦' },
    { to: '/irr', label: 'IRR & Exit Analysis', icon: '↗' },
  ]},
  { section: 'Deals', items: [
    { to: '/pipeline', label: 'Acquisition Pipeline', icon: '💼' },
    { to: '/intel', label: 'Competitive Intel', icon: '🔍' },
    { to: '/contacts', label: 'Contacts', icon: '👤' },
  ]},
  { section: 'Output', items: [
    { to: '/reports', label: 'Report Builder', icon: '📄' },
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
