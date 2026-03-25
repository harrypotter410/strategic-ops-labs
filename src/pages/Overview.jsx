import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { usePortfolioSummary, useDeals, useAssets } from '../hooks/useData'
import { Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const fmt = (n) => !n ? '—' : n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(0)}M` : `$${n.toLocaleString()}`
const fmtM = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'
const COLORS = ['#2a6e47','#4a9e6e','#163d27','#a8d5bc','#d4eddf']
const STAGE_LABELS = { prospecting:'Prospecting', loi:'LOI Signed', due_diligence:'Due Diligence', closing:'Closing' }
const STAGE_PROGRESS = { prospecting:12, loi:35, due_diligence:65, closing:90 }

function calcScore(deal) {
  let score = 50
  if (deal.cap_rate) { if (deal.cap_rate >= 8) score += 20; else if (deal.cap_rate >= 7) score += 15; else if (deal.cap_rate >= 6) score += 8; else if (deal.cap_rate < 5) score -= 10 }
  if (deal.price_per_key) { if (deal.price_per_key < 150000) score += 15; else if (deal.price_per_key < 200000) score += 10; else if (deal.price_per_key < 250000) score += 5; else if (deal.price_per_key > 350000) score -= 10 }
  if (deal.projected_irr) { if (deal.projected_irr >= 18) score += 15; else if (deal.projected_irr >= 15) score += 10; else if (deal.projected_irr >= 12) score += 5; else if (deal.projected_irr < 10) score -= 10 }
  return Math.min(100, Math.max(0, score))
}

export default function Overview() {
  const { summary, loading } = usePortfolioSummary()
  const { deals } = useDeals()
  const { assets } = useAssets()
  const [tasks, setTasks] = useState([])
  const [debt, setDebt] = useState([])

  useEffect(() => {
    supabase.from('tasks').select('*').in('status', ['open','in_progress']).order('due_date', { ascending: true }).limit(5).then(({ data }) => setTasks(data || []))
    supabase.from('asset_debt').select('*, assets(name)').order('maturity_date', { ascending: true }).then(({ data }) => setDebt(data || []))
  }, [])

  const activeDeals = deals.filter(d => ['prospecting','loi','due_diligence','closing'].includes(d.stage))

  // Portfolio calculations
  const totalAcq = assets.reduce((s, a) => s + (a.acquisition_price || 0), 0)
  const totalVal = assets.reduce((s, a) => s + (a.current_value || 0), 0)
  const unrealizedGain = totalVal - totalAcq
  const gainPct = totalAcq ? ((unrealizedGain / totalAcq) * 100).toFixed(1) : null

  // Weighted cap rate
  const assetsWithCap = assets.filter(a => a.cap_rate && a.current_value)
  const wtdCapRate = assetsWithCap.length
    ? (assetsWithCap.reduce((s, a) => s + (a.cap_rate * a.current_value), 0) / assetsWithCap.reduce((s, a) => s + a.current_value, 0)).toFixed(2)
    : null

  // Weighted pipeline value (probability-adjusted)
  const weightedPipeline = activeDeals.reduce((s, d) => s + ((d.ask_price || 0) * ((d.close_probability || 50) / 100)), 0)

  // Portfolio avg IRR (realized exits + projected active)
  const disposedWithIRR = assets.filter(a => a.actual_irr)
  const activeWithIRR = activeDeals.filter(d => d.projected_irr)
  const allIRR = [...disposedWithIRR.map(a => a.actual_irr), ...activeWithIRR.map(d => d.projected_irr)]
  const avgIRR = allIRR.length ? (allIRR.reduce((s, v) => s + v, 0) / allIRR.length).toFixed(1) : null

  // Allocation
  const typeAlloc = ['hotel','resort','mixed','commercial'].map(type => ({
    name: type.charAt(0).toUpperCase()+type.slice(1),
    value: assets.filter(a=>a.type===type).reduce((s,a)=>s+(a.current_value||0),0)
  })).filter(t => t.value > 0)

  // Maturing debt alerts
  const maturingDebt = debt.filter(d => {
    if (!d.maturity_date) return false
    const days = Math.ceil((new Date(d.maturity_date) - new Date()) / (1000*60*60*24))
    return days >= 0 && days <= 365
  })

  // Overdue tasks
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date())

  if (loading) return <div className="loading">Loading portfolio...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Portfolio Overview</h1>
        <p>Kemmons Wilson Hospitality Partners — {new Date().toLocaleDateString('en-US', { month:'long', year:'numeric' })}</p>
      </div>

      {/* Alerts bar */}
      {(maturingDebt.length > 0 || overdueTasks.length > 0) && (
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          {maturingDebt.length > 0 && (
            <Link to="/debt" style={{ textDecoration:'none' }}>
              <div style={{ background:'var(--amberL)', border:'1px solid #ffe082', borderRadius:8, padding:'8px 14px', fontSize:12, color:'var(--amber)', cursor:'pointer' }}>
                ⚠ {maturingDebt.length} loan{maturingDebt.length>1?'s':''} maturing within 12 months → Review
              </div>
            </Link>
          )}
          {overdueTasks.length > 0 && (
            <Link to="/tasks" style={{ textDecoration:'none' }}>
              <div style={{ background:'var(--redL)', border:'1px solid #f5c6c2', borderRadius:8, padding:'8px 14px', fontSize:12, color:'var(--red)', cursor:'pointer' }}>
                ⚠ {overdueTasks.length} overdue task{overdueTasks.length>1?'s':''} → View tasks
              </div>
            </Link>
          )}
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Assets</div><div className="kpi-value">{summary?.totalAssets ?? '—'}</div><div className="kpi-change">{summary?.activeAssets} active</div></div>
        <div className="kpi-card"><div className="kpi-label">Portfolio Value</div><div className="kpi-value">{fmt(totalVal || summary?.portfolioValue)}</div><div className="kpi-change">{fmt(totalAcq)} cost basis</div></div>
        <div className="kpi-card">
          <div className="kpi-label">Unrealized Gain</div>
          <div className="kpi-value">{unrealizedGain ? (unrealizedGain >= 0 ? '+' : '') + fmtM(unrealizedGain) : '—'}</div>
          <div className={`kpi-change${unrealizedGain < 0 ? ' down' : ''}`}>{gainPct ? `${unrealizedGain >= 0 ? '+' : ''}${gainPct}% vs cost` : 'Add values to track'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Wtd. Cap Rate / IRR</div>
          <div className="kpi-value">{wtdCapRate ? `${wtdCapRate}%` : '—'}</div>
          <div className="kpi-change">{avgIRR ? `Avg IRR: ${avgIRR}%` : 'Add cap rates to assets'}</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Pipeline with probability weighting */}
        <div className="card" style={{ marginBottom:0 }}>
          <div className="card-header">
            <span className="card-title">Acquisition pipeline</span>
            <Link to="/pipeline"><button className="card-action">View all →</button></Link>
          </div>
          <div style={{ display:'flex', gap:16, marginBottom:12 }}>
            <div style={{ background:'var(--gray50)', borderRadius:8, padding:'8px 12px', flex:1 }}>
              <div style={{ fontSize:10, color:'var(--gray500)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:3 }}>Gross Pipeline</div>
              <div style={{ fontSize:16, fontFamily:'Playfair Display,serif', fontWeight:600, color:'var(--g900)' }}>{fmt(activeDeals.reduce((s,d)=>s+(d.ask_price||0),0))}</div>
            </div>
            <div style={{ background:'var(--g50)', border:'1px solid var(--g100)', borderRadius:8, padding:'8px 12px', flex:1 }}>
              <div style={{ fontSize:10, color:'var(--g600)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:3 }}>Probability-Weighted</div>
              <div style={{ fontSize:16, fontFamily:'Playfair Display,serif', fontWeight:600, color:'var(--g900)' }}>{fmt(weightedPipeline)}</div>
            </div>
          </div>
          {activeDeals.slice(0,4).map(deal => (
            <div key={deal.id} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:2 }}>
                <span style={{ color:'var(--g900)', fontWeight:500 }}>{deal.name}</span>
                <div style={{ display:'flex', gap:8 }}>
                  {deal.close_probability && <span style={{ fontSize:10, color:'var(--gray500)' }}>{deal.close_probability}%</span>}
                  <span style={{ color:'var(--gray500)' }}>{fmt(deal.ask_price)}</span>
                </div>
              </div>
              <div style={{ fontSize:10, color:'var(--gray500)', marginBottom:3 }}>{STAGE_LABELS[deal.stage]}{deal.projected_irr ? ` · ${deal.projected_irr}% IRR` : ''}</div>
              <div className="progress-bar"><div className="progress-fill" style={{ width:`${STAGE_PROGRESS[deal.stage]}%` }} /></div>
            </div>
          ))}
        </div>

        {/* Type allocation */}
        <div className="card" style={{ marginBottom:0 }}>
          <div className="card-header"><span className="card-title">Allocation</span></div>
          {typeAlloc.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={100}>
                <PieChart><Pie data={typeAlloc} cx="50%" cy="50%" innerRadius={28} outerRadius={45} dataKey="value" paddingAngle={2}>
                  {typeAlloc.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie><Tooltip formatter={(v) => [fmtM(v), '']} contentStyle={{ fontSize:11, borderRadius:6 }} /></PieChart>
              </ResponsiveContainer>
              {typeAlloc.map((t, i) => (
                <div key={t.name} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, marginBottom:4 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:COLORS[i], flexShrink:0 }}></span>
                  <span style={{ color:'var(--gray700)', flex:1 }}>{t.name}</span>
                  <span style={{ color:'var(--g900)', fontWeight:500 }}>{totalVal ? `${((t.value/totalVal)*100).toFixed(0)}%` : ''}</span>
                </div>
              ))}
            </>
          ) : <div style={{ fontSize:12, color:'var(--gray500)', textAlign:'center', padding:'20px 0' }}>Add current values</div>}
        </div>

        {/* Open tasks */}
        <div className="card" style={{ marginBottom:0 }}>
          <div className="card-header"><span className="card-title">Open tasks</span><Link to="/tasks"><button className="card-action">All tasks →</button></Link></div>
          {tasks.length === 0 ? (
            <div style={{ fontSize:12, color:'var(--gray500)', textAlign:'center', padding:'20px 0' }}>No open tasks</div>
          ) : tasks.map(t => {
            const isOverdue = t.due_date && new Date(t.due_date) < new Date()
            return (
              <div key={t.id} style={{ display:'flex', gap:8, padding:'7px 0', borderBottom:'1px solid var(--gray100)', alignItems:'flex-start' }}>
                <div style={{ width:12, height:12, borderRadius:3, border:'1.5px solid var(--gray300)', flexShrink:0, marginTop:2 }}></div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:'var(--g900)', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{t.title}</div>
                  {t.due_date && <div style={{ fontSize:10, color: isOverdue ? 'var(--red)' : 'var(--gray500)' }}>{isOverdue ? '⚠ ' : ''}{new Date(t.due_date+'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })}</div>}
                </div>
              </div>
            )
          })}
          <Link to="/tasks"><button className="btn btn-secondary btn-sm" style={{ width:'100%', justifyContent:'center', marginTop:10 }}>+ Add Task</button></Link>
        </div>
      </div>
    </div>
  )
}
