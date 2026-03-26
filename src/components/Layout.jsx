import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAssets, useDeals } from '../hooks/useData'

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
    { to: '/', label: 'Portfolio Overview', icon: <Logo />, kbd: 'G O' },
    { to: '/map', label: 'Portfolio Map', icon: <svg viewBox="0 0 16 16" fill="none"><path d="M8 1C5.24 1 3 3.24 3 6c0 4 5 9 5 9s5-5 5-9c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="8" cy="6" r="1.5" fill="currentColor"/></svg> },
    { to: '/tasks', label: 'Tasks', icon: <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 7l2 2 4-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  ]},
  { section: 'Asset Management', items: [
    { to: '/assets', label: 'Asset Tracker', icon: <svg viewBox="0 0 16 16" fill="none"><path d="M8 1L14 5V11L8 15L2 11V5L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg> },
    { to: '/financial', label: 'Financial Performance', icon: <svg viewBox="0 0 16 16" fill="none"><polyline points="2,12 6,7 9,9 14,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { to: '/kpis', label: 'Property KPIs', badge: '5', icon: <svg viewBox="0 0 16 16" fill="none"><circle cx="5" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="11" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5"/></svg> },
    { to: '/valuations', label: 'Valuations', icon: <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="10" width="2.5" height="4" rx=".5" fill="currentColor"/><rect x="6.5" y="7" width="2.5" height="7" rx=".5" fill="currentColor"/><rect x="11" y="4" width="2.5" height="10" rx=".5" fill="currentColor"/><polyline points="2,8 7.5,5 13,2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { to: '/debt', label: 'Debt Tracker', icon: <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1 7h14" stroke="currentColor" strokeWidth="1.5"/><circle cx="5" cy="10.5" r="1" fill="currentColor"/></svg> },
  ]},
  { section: 'Deals', items: [
    { to: '/pipeline', label: 'Acquisition Pipeline', badge: '5', icon: <svg viewBox="0 0 16 16" fill="none"><path d="M2 14V6L8 2L14 6V14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><rect x="6" y="9" width="4" height="5" rx=".5" stroke="currentColor" strokeWidth="1.5"/></svg> },
    { to: '/intel', label: 'Competitive Intel', icon: <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><line x1="5" y1="7" x2="11" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><line x1="5" y1="10" x2="9" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    { to: '/contacts', label: 'Contacts', icon: <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M2 14c0-3.31 2.69-5 6-5s6 1.69 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  ]},
  { section: 'Output', items: [
    { to: '/reports', label: 'Report Builder', icon: <svg viewBox="0 0 16 16" fill="none"><path d="M3 2H10L13 5V14H3V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M10 2V5H13" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><line x1="5" y1="8" x2="11" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    { to: '/data', label: 'Data Hub', icon: <svg viewBox="0 0 16 16" fill="none"><ellipse cx="8" cy="4" rx="5" ry="2" stroke="currentColor" strokeWidth="1.5"/><path d="M3 4v4c0 1.1 2.24 2 5 2s5-.9 5-2V4" stroke="currentColor" strokeWidth="1.5"/><path d="M3 8v4c0 1.1 2.24 2 5 2s5-.9 5-2V8" stroke="currentColor" strokeWidth="1.5"/></svg> },
  ]},
]

// Global search results
function SearchResults({ query, assets, deals, onSelect, onClose }) {
  const navigate = useNavigate()
  if (!query.trim()) return null
  const q = query.toLowerCase()
  const matchAssets = assets.filter(a => a.name.toLowerCase().includes(q) || a.market?.toLowerCase().includes(q)).slice(0, 4)
  const matchDeals = deals.filter(d => d.name.toLowerCase().includes(q) || d.market?.toLowerCase().includes(q)).slice(0, 4)
  const pages = nav.flatMap(s => s.items).filter(i => i.label.toLowerCase().includes(q)).slice(0, 3)

  if (!matchAssets.length && !matchDeals.length && !pages.length) {
    return <div className="search-results"><div className="cmd-empty">No results for "{query}"</div></div>
  }

  return (
    <div className="search-results">
      {pages.length > 0 && <div className="search-result-group">
        <div className="search-result-label">Pages</div>
        {pages.map(p => (
          <div key={p.to} className="search-result-item" onClick={() => { navigate(p.to); onClose() }}>
            <div><div className="search-result-name">{p.label}</div></div>
          </div>
        ))}
      </div>}
      {matchAssets.length > 0 && <div className="search-result-group">
        <div className="search-result-label">Assets</div>
        {matchAssets.map(a => (
          <div key={a.id} className="search-result-item" onClick={() => { navigate(`/assets`); onClose() }}>
            <div><div className="search-result-name">{a.name}</div><div className="search-result-sub">{a.market} · {a.type}</div></div>
          </div>
        ))}
      </div>}
      {matchDeals.length > 0 && <div className="search-result-group">
        <div className="search-result-label">Deals</div>
        {matchDeals.map(d => (
          <div key={d.id} className="search-result-item" onClick={() => { navigate('/pipeline'); onClose() }}>
            <div><div className="search-result-name">{d.name}</div><div className="search-result-sub">{d.market} · {d.stage}</div></div>
          </div>
        ))}
      </div>}
    </div>
  )
}

// Command Palette (Cmd+K)
function CommandPalette({ onClose, assets, deals }) {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef()

  useEffect(() => { inputRef.current?.focus() }, [])

  const allItems = [
    ...nav.flatMap(s => s.items).map(i => ({ type: 'page', name: i.label, icon: '📄', action: () => navigate(i.to), kbd: i.kbd })),
    ...assets.slice(0, 6).map(a => ({ type: 'asset', name: a.name, sub: a.market, icon: '🏨', action: () => navigate('/assets') })),
    ...deals.slice(0, 6).map(d => ({ type: 'deal', name: d.name, sub: d.market, icon: '💼', action: () => navigate('/pipeline') })),
  ]

  const q = query.toLowerCase()
  const filtered = query ? allItems.filter(i => i.name.toLowerCase().includes(q) || i.sub?.toLowerCase().includes(q)) : allItems.slice(0, 12)
  const grouped = { page: filtered.filter(i=>i.type==='page'), asset: filtered.filter(i=>i.type==='asset'), deal: filtered.filter(i=>i.type==='deal') }

  const flat = [...grouped.page, ...grouped.asset, ...grouped.deal]

  const handleKey = (e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h+1, flat.length-1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h-1, 0)) }
    if (e.key === 'Enter' && flat[highlighted]) { flat[highlighted].action(); onClose() }
  }

  return (
    <div className="cmd-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cmd-box">
        <div className="cmd-input-wrap">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="#7a817a" strokeWidth="1.5"/><path d="M10.5 10.5L14 14" stroke="#7a817a" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <input ref={inputRef} className="cmd-input" placeholder="Search or jump to..." value={query} onChange={e => { setQuery(e.target.value); setHighlighted(0) }} onKeyDown={handleKey} />
          <span style={{ fontSize: 10, color: 'var(--gray300)', background: 'var(--gray100)', padding: '2px 6px', borderRadius: 4 }}>ESC</span>
        </div>
        <div className="cmd-results">
          {flat.length === 0 && <div className="cmd-empty">No results</div>}
          {grouped.page.length > 0 && <><div className="cmd-group-label">Pages</div>{grouped.page.map((item, i) => <div key={i} className={`cmd-item${flat.indexOf(item)===highlighted?' highlighted':''}`} onClick={() => { item.action(); onClose() }}><div className="cmd-item-icon">{item.icon}</div><div><div className="cmd-item-name">{item.name}</div></div>{item.kbd && <span className="cmd-item-kbd">{item.kbd}</span>}</div>)}</>}
          {grouped.asset.length > 0 && <><div className="cmd-group-label">Assets</div>{grouped.asset.map((item, i) => <div key={i} className={`cmd-item${flat.indexOf(item)===highlighted?' highlighted':''}`} onClick={() => { item.action(); onClose() }}><div className="cmd-item-icon">{item.icon}</div><div><div className="cmd-item-name">{item.name}</div>{item.sub && <div className="cmd-item-sub">{item.sub}</div>}</div></div>)}</>}
          {grouped.deal.length > 0 && <><div className="cmd-group-label">Deals</div>{grouped.deal.map((item, i) => <div key={i} className={`cmd-item${flat.indexOf(item)===highlighted?' highlighted':''}`} onClick={() => { item.action(); onClose() }}><div className="cmd-item-icon">{item.icon}</div><div><div className="cmd-item-name">{item.name}</div>{item.sub && <div className="cmd-item-sub">{item.sub}</div>}</div></div>)}</>}
        </div>
        <div className="cmd-footer">
          <div className="cmd-hint"><kbd>↑↓</kbd> navigate</div>
          <div className="cmd-hint"><kbd>Enter</kbd> select</div>
          <div className="cmd-hint"><kbd>Esc</kbd> close</div>
        </div>
      </div>
    </div>
  )
}

// Notifications panel
function NotifPanel({ onClose }) {
  const [notifs, setNotifs] = useState([])
  useEffect(() => {
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(10).then(({ data }) => setNotifs(data || []))
  }, [])
  const markRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('read', false)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }
  const timeAgo = (ts) => {
    const diff = (Date.now() - new Date(ts)) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
    return `${Math.floor(diff/86400)}d ago`
  }
  return (
    <div className="notif-panel">
      <div className="notif-header">
        <span className="notif-title">Notifications</span>
        {notifs.some(n => !n.read) && <button onClick={markRead} style={{ fontSize: 11, color: 'var(--g400)', background: 'none', border: 'none', cursor: 'pointer' }}>Mark all read</button>}
      </div>
      {notifs.length === 0 ? <div className="notif-empty">No notifications</div> : notifs.map(n => (
        <div key={n.id} className={`notif-item${!n.read ? ' unread' : ''}`}>
          <div className="notif-item-title">{n.title}</div>
          {n.message && <div className="notif-item-msg">{n.message}</div>}
          <div className="notif-item-time">{timeAgo(n.created_at)}</div>
        </div>
      ))}
    </div>
  )
}

export default function Layout({ children }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { assets } = useAssets()
  const { deals } = useDeals()

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('soul-dark') === 'true')
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('soul-collapsed') === 'true')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocus, setSearchFocus] = useState(false)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [unreadCount, setUnreadCount] = useState(0)
  const searchRef = useRef()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('soul-dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem('soul-collapsed', collapsed)
  }, [collapsed])

  useEffect(() => {
    const handleOnline = () => setOffline(false)
    const handleOffline = () => setOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [])

  // Cmd+K to open command palette
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(true) }
      if (e.key === 'Escape') { setCmdOpen(false); setNotifOpen(false); setSearchFocus(false) }
      // Keyboard shortcuts
      if (!e.metaKey && !e.ctrlKey && !e.altKey && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        if (e.key === '[') setCollapsed(c => !c)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Fetch unread notifications count
  useEffect(() => {
    supabase.from('notifications').select('id', { count: 'exact' }).eq('read', false).then(({ count }) => setUnreadCount(count || 0))
  }, [])

  // Close search on route change
  useEffect(() => { setSearchFocus(false); setSearchQuery('') }, [location])

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'SA'
  const handleSignOut = async () => { await signOut(); navigate('/login') }

  return (
    <>
      {offline && <div className="offline-banner">⚠ You're offline — changes may not save</div>}

      <div className="app-shell" style={{ marginTop: offline ? 36 : 0 }}>
        <header className="topbar">
          <div className="brand">
            <div className="brand-logo"><Logo /></div>
            <div className="brand-wordmark" style={{ display: collapsed ? 'none' : 'block' }}>
              <span className="brand-soul">SOUL</span>
              <span className="brand-kwh">Strategic Ops & Underwriting Lab</span>
            </div>
          </div>

          {/* Global search */}
          <div className="topbar-search" ref={searchRef}>
            <svg className="topbar-search-icon" width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="white" strokeWidth="1.5"/><path d="M10.5 10.5L14 14" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <input
              placeholder="Search assets, deals, pages... (⌘K)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
            />
            {(searchFocus && searchQuery) && (
              <SearchResults query={searchQuery} assets={assets} deals={deals} onClose={() => { setSearchFocus(false); setSearchQuery('') }} />
            )}
          </div>

          <div className="topbar-right">
            <span className="topbar-badge">Q1 2026</span>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}><div className="realtime-dot" title="Live sync active" /></div>

            {/* Dark mode toggle */}
            <button className="theme-btn" onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Light mode' : 'Dark mode'}>
              {darkMode ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="4"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.5 10.5A6 6 0 015.5 2.5a6 6 0 108 8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              )}
            </button>

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <div className="notif-btn" onClick={() => setNotifOpen(o => !o)}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1a5 5 0 00-5 5v3l-1.5 2h13L13 9V6a5 5 0 00-5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M6.5 13a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.5"/></svg>
                {unreadCount > 0 && <div className="notif-dot" />}
              </div>
              {notifOpen && <NotifPanel onClose={() => setNotifOpen(false)} />}
            </div>

            <div className="avatar" title={user?.email} onClick={handleSignOut}>{initials}</div>
          </div>
        </header>

        <div className="content-area">
          <nav className={`sidebar${collapsed ? ' collapsed' : ''}`}>
            {nav.map((section, si) => (
              <div key={section.section}>
                {si > 0 && <div className="sidebar-divider" />}
                {!collapsed && <div className="sidebar-label">{section.section}</div>}
                {section.items.map(item => (
                  <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} title={collapsed ? item.label : undefined}>
                    {item.icon}
                    <span className="nav-text">{item.label}</span>
                    {item.badge && !collapsed && <span className="nav-badge">{item.badge}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
            <div className="sidebar-collapse-btn" onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar [ '}>
              {collapsed ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
              {!collapsed && <span style={{ fontSize: 10, marginLeft: 4 }}>[ collapse</span>}
            </div>
          </nav>

          <main className="main">
            <div className="page-enter" key={location.pathname}>
              {children}
            </div>
          </main>
        </div>
      </div>

      {cmdOpen && <CommandPalette assets={assets} deals={deals} onClose={() => setCmdOpen(false)} />}
    </>
  )
}
