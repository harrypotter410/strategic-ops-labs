import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { usePortfolioSummary, useDeals, useAssets } from '../hooks/useData'
import { Link } from 'react-router-dom'

const fmt = (n) => !n ? '—' : n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(0)}M` : `$${n.toLocaleString()}`
const fmtM = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'

const STAGE_LABELS = { prospecting: 'Prospecting', loi: 'LOI Signed', due_diligence: 'Due Diligence', closing: 'Closing' }
const STAGE_PROGRESS = { prospecting: 12, loi: 35, due_diligence: 65, closing: 90 }
const COLORS = ['#2a6e47', '#4a9e6e', '#163d27', '#a8d5bc', '#d4eddf']

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

  const activeDeals = deals.filter(d => ['prospecting','loi','due_diligence','closing'].includes(d.stage)).slice(0, 4)

  // Portfolio calculations from real assets
  const totalAcq = assets.reduce((s, a) => s + (a.acquisition_price || 0), 0)
  const totalVal = assets.reduce((s, a) => s + (a.current_value || 0), 0)
  const unrealizedGain = totalVal - totalAcq
  const gainPct = totalAcq ? ((unrealizedGain / totalAcq) * 100).toFixed(1) : null

  // Weighted avg cap rate
  const assetsWithCap = assets.filter(a => a.cap_rate && a.current_value)
  const wtdCapRate = assetsWithCap.length
    ? (assetsWithCap.reduce((s, a) => s + (a.cap_rate * a.current_value), 0) / assetsWithCap.reduce((s, a) => s + a.current_value, 0)).toFixed(2)
    : null

  // Allocation by type
  const typeAlloc = ['hotel','resort','mixed','commercial'].map(type => ({
    name: type.charAt(0).toUpperCase()+type.slice(1),
    value: assets.filter(a=>a.type===type).reduce((s,a)=>s+(a.current_value||0),0)
  })).filter(t => t.value > 0)

  // Portfolio IRR from deals
  const irrDeals = deals.filter(d => d.projected_irr)
  const avgIRR = irrDeals.length ? (irrDeals.reduce((s,d)=>s+d.projected_irr,0)/irrDeals.length).toFixed(1) : null

  if (loading) return <div className="loading">Loading portfolio...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Portfolio Overview</h1>
        <p>Kemmons Wilson Hospitality Partners — {new Date().toLocaleDateString('en-US', { month:'long', year:'numeric' })}</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Assets</div>
          <div className="kpi-value">{summary?.totalAssets ?? '—'}</div>
          <div className="kpi-change">{summary?.activeAssets} active</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Portfolio Value</div>
          <div className="kpi-value">{fmt(totalVal || summary?.portfolioValue)}</div>
          <div className="kpi-change">{fmt(totalAcq)} cost basis</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Unrealized Gain</div>
          <div className="kpi-value">{unrealizedGain ? (unrealizedGain >= 0 ? '+' : '') + fmtM(unrealizedGain) : '—'}</div>
          <div className={`kpi-change${unrealizedGain < 0 ? ' down' : ''}`}>{gainPct ? `${unrealizedGain >= 0 ? '+' : ''}${gainPct}% vs cost` : 'Add values to track'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Wtd. Avg. Cap Rate</div>
          <div className="kpi-value">{wtdCapRate ? `${wtdCapRate}%` : '—'}</div>
          <div className="kpi-change">{avgIRR ? `Avg. pipeline IRR: ${avgIRR}%` : 'Add cap rates to assets'}</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:16 }}>
        {/* Pipeline summary */}
        <div className="card" style={{ marginBottom:0 }}>
          <div className="card-header">
            <span className="card-title">Pipeline</span>
            <Link to="/pipeline"><button className="card-action">View all →</button></Link>
          </div>
          <div className="kpi-grid" style={{ gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:0 }}>
            <div style={{ background:'var(--gray50)', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, color:'var(--gray500)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:4 }}>Deal Volume</div>
              <div style={{ fontSize:18, fontFamily:'Playfair Display,serif', fontWeight:600, color:'var(--g900)' }}>{fmt(summary?.pipelineValue)}</div>
            </div>
            <div style={{ background:'var(--gray50)', borderRadius:8, padding:'10px 12px' }}>
              <div style={{ fontSize:10, color:'var(--gray500)', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:4 }}>Active Deals</div>
              <div style={{ fontSize:18, fontFamily:'Playfair Display,serif', fontWeight:600, color:'var(--g900)' }}>{summary?.pipelineDeals}</div>
            </div>
          </div>
          {activeDeals.length > 0 && (
            <div style={{ marginTop:12 }}>
              {activeDeals.map(deal => (
                <div key={deal.id} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:2 }}>
                    <span style={{ color:'var(--g900)', fontWeight:500 }}>{deal.name}</span>
                    <span style={{ color:'var(--gray500)' }}>{fmt(deal.ask_price)}</span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--gray500)', marginBottom:3 }}>{STAGE_LABELS[deal.stage]}{deal.projected_irr ? ` · ${deal.projected_irr}% IRR` : ''}</div>
                  <div className="progress-bar"><div className="progress-fill" style={{ width:`${STAGE_PROGRESS[deal.stage]}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Allocation by type */}
        <div className="card" style={{ marginBottom:0 }}>
          <div className="card-header"><span className="card-title">Allocation by type</span></div>
          {typeAlloc.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={typeAlloc} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" paddingAngle={2}>
                    {typeAlloc.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [fmtM(v), '']} contentStyle={{ fontSize:11, borderRadius:6 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {typeAlloc.map((t, i) => (
                  <div key={t.name} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:COLORS[i], flexShrink:0 }}></span>
                    <span style={{ color:'var(--gray700)', flex:1 }}>{t.name}</span>
                    <span style={{ color:'var(--g900)', fontWeight:500 }}>{fmtM(t.value)}</span>
                    <span style={{ color:'var(--gray500)' }}>{totalVal ? `${((t.value/totalVal)*100).toFixed(0)}%` : ''}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize:12, color:'var(--gray500)', textAlign:'center', padding:'20px 0' }}>Add current values to assets to see allocation</div>
          )}
        </div>

        {/* Quick stats */}
        <div class="card" style={{ marginBottom:0 }}>
          <div className="card-header"><span className="card-title">Portfolio stats</span><Link to="/assets"><button className="card-action">Assets →</button></Link></div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              ['Total rooms', assets.reduce((s,a)=>s+(a.rooms||0),0).toLocaleString()],
              ['Hotels', `${assets.filter(a=>a.type==='hotel').length} properties`],
              ['Resorts', `${assets.filter(a=>a.type==='resort').length} properties`],
              ['Under renovation', `${assets.filter(a=>a.status==='renovation').length} properties`],
              ['Markets', `${[...new Set(assets.map(a=>a.market))].length} markets`],
              ['Avg. value/asset', fmtM(totalVal / (assets.length || 1))],
            ].map(([label, value]) => (
              <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid var(--gray100)', fontSize:12 }}>
                <span style={{ color:'var(--gray500)' }}>{label}</span>
                <span style={{ color:'var(--g900)', fontWeight:500 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
