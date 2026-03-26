import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(2)}M` : '—'
const fmtDollar = (n) => n ? `$${parseFloat(n).toLocaleString('en-US',{maximumFractionDigits:0})}` : '—'
const fmtPct = (n) => n ? `${parseFloat(n).toFixed(1)}%` : '—'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Asset selector with search — handles 20+ assets
function AssetSelector({ assets, selected, onSelect }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const sel = assets.find(a => a.id === selected)
  const filtered = assets.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.market?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position:'relative', minWidth:240 }}>
      <div
        style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', border:'1px solid var(--gray200)', borderRadius:8, cursor:'pointer', background:'var(--white)', fontSize:12.5, color:'var(--g900)', fontWeight:500 }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ flex:1 }}>{sel ? sel.name : 'Select asset...'}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'calc(100%+4px)', left:0, right:0, background:'var(--white)', border:'1px solid var(--gray200)', borderRadius:10, zIndex:200, boxShadow:'var(--shadow-md)', overflow:'hidden', marginTop:4 }}>
          <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--gray100)' }}>
            <input
              className="form-input"
              style={{ padding:'5px 10px', fontSize:12 }}
              placeholder="Search assets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div style={{ maxHeight:220, overflowY:'auto' }}>
            {filtered.length === 0 && <div style={{ padding:'12px', fontSize:12, color:'var(--gray500)', textAlign:'center' }}>No assets found</div>}
            {filtered.map(a => (
              <div
                key={a.id}
                style={{ padding:'9px 14px', cursor:'pointer', fontSize:12.5, color: a.id===selected?'var(--g700)':'var(--gray700)', background: a.id===selected?'var(--g50)':'transparent', borderBottom:'1px solid var(--gray100)', transition:'background .1s' }}
                onClick={() => { onSelect(a.id); setOpen(false); setSearch('') }}
                onMouseEnter={e => { if (a.id!==selected) e.currentTarget.style.background='var(--gray50)' }}
                onMouseLeave={e => { if (a.id!==selected) e.currentTarget.style.background='transparent' }}
              >
                <div style={{ fontWeight:500 }}>{a.name}</div>
                <div style={{ fontSize:10, color:'var(--gray500)' }}>{a.market} · {a.type}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Financial() {
  const { assets } = useAssets()
  const [selectedId, setSelectedId] = useState(null)
  const [financials, setFinancials] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))

  // Set first asset on load
  useEffect(() => { if (assets.length > 0 && !selectedId) setSelectedId(assets[0].id) }, [assets])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    supabase.from('financials').select('*').eq('asset_id', selectedId).order('period_year').order('period_month').then(({ data }) => {
      setFinancials(data || [])
      setLoading(false)
    })
  }, [selectedId])

  const selectedAsset = assets.find(a => a.id === selectedId)
  const years = [...new Set(financials.map(f => String(f.period_year)))].sort((a,b)=>b-a)
  const filteredFins = financials.filter(f => filterYear === 'all' || String(f.period_year) === filterYear)

  // Chart data
  const chartData = filteredFins.map(f => ({
    label: `${MONTHS[f.period_month-1]} ${String(f.period_year).slice(2)}`,
    revenue: f.revenue ? Math.round(f.revenue/1000) : null,
    noi: f.noi ? Math.round(f.noi/1000) : null,
    gop: f.gop ? Math.round(f.gop/1000) : null,
    occupancy: f.occupancy ? parseFloat(f.occupancy) : null,
    adr: f.adr ? parseFloat(f.adr) : null,
    revpar: f.revpar ? parseFloat(f.revpar) : null,
    budget_noi: f.budget_noi ? Math.round(f.budget_noi/1000) : null,
    noi_variance: f.noi && f.budget_noi ? Math.round((f.noi-f.budget_noi)/1000) : null,
  }))

  // Totals for period
  const totRevenue = filteredFins.reduce((s,f)=>s+(f.revenue||0),0)
  const totNOI = filteredFins.reduce((s,f)=>s+(f.noi||0),0)
  const totGOP = filteredFins.reduce((s,f)=>s+(f.gop||0),0)
  const avgOcc = filteredFins.filter(f=>f.occupancy).length ? (filteredFins.filter(f=>f.occupancy).reduce((s,f)=>s+parseFloat(f.occupancy),0)/filteredFins.filter(f=>f.occupancy).length).toFixed(1) : null
  const avgADR = filteredFins.filter(f=>f.adr).length ? (filteredFins.filter(f=>f.adr).reduce((s,f)=>s+parseFloat(f.adr),0)/filteredFins.filter(f=>f.adr).length).toFixed(0) : null
  const avgRevPAR = filteredFins.filter(f=>f.revpar).length ? (filteredFins.filter(f=>f.revpar).reduce((s,f)=>s+parseFloat(f.revpar),0)/filteredFins.filter(f=>f.revpar).length).toFixed(0) : null

  // NOI margin
  const noiMargin = totRevenue && totNOI ? ((totNOI/totRevenue)*100).toFixed(1) : null

  // Waterfall data
  const waterfallData = totRevenue ? [
    { name:'Revenue', value: Math.round(totRevenue/1000), color:'var(--g600)' },
    { name:'GOP', value: Math.round(totGOP/1000), color:'var(--g500)' },
    { name:'NOI', value: Math.round(totNOI/1000), color:'var(--g400)' },
    ...(selectedAsset?.debt_service_annual ? [{ name:'Levered CF', value: Math.round((totNOI-(selectedAsset.debt_service_annual*(filteredFins.length/12||1)))/1000), color:'var(--g200)' }] : []),
  ] : []

  // Portfolio summary — all assets
  const portfolioNOI = assets.reduce((s,a)=>s+(a.noi_trailing||0),0)
  const portfolioVal = assets.reduce((s,a)=>s+(a.current_value||0),0)
  const portfolioAcq = assets.reduce((s,a)=>s+(a.acquisition_price||0),0)

  return (
    <div>
      <div className="page-header">
        <h1>Financial Performance</h1>
        <p>Asset-level P&L, operating metrics, and portfolio summary</p>
      </div>

      {/* Portfolio-level KPIs — always shows all assets */}
      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Portfolio NOI (T12)</div><div className="kpi-value">{fmtM(portfolioNOI)}</div><div className="kpi-change">Across {assets.length} assets</div></div>
        <div className="kpi-card"><div className="kpi-label">Portfolio Value</div><div className="kpi-value">{fmtM(portfolioVal)}</div><div className="kpi-change">Current est. value</div></div>
        <div className="kpi-card"><div className="kpi-label">Wtd. YOC</div><div className="kpi-value">{portfolioAcq&&portfolioNOI?`${((portfolioNOI/portfolioAcq)*100).toFixed(2)}%`:'—'}</div><div className="kpi-change">Yield on cost</div></div>
        <div className="kpi-card"><div className="kpi-label">Implied Cap Rate</div><div className="kpi-value">{portfolioVal&&portfolioNOI?`${((portfolioNOI/portfolioVal)*100).toFixed(2)}%`:'—'}</div><div className="kpi-change">NOI ÷ current value</div></div>
      </div>

      {/* Asset P&L summary table — ALL assets */}
      <div className="card">
        <div className="card-header"><span className="card-title">Asset P&L summary — {assets.length} properties</span></div>
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead><tr>
              <th>Property</th><th>Market</th><th>Rooms</th>
              <th>T12 NOI</th><th>Acq. Price</th><th>Current Value</th>
              <th>YOC</th><th>Levered YOC</th><th>Status</th>
            </tr></thead>
            <tbody>
              {assets.map(a => {
                const yoc = a.noi_trailing && a.acquisition_price ? ((a.noi_trailing/a.acquisition_price)*100).toFixed(2) : null
                const lyoc = a.noi_trailing && a.debt_service_annual && a.acquisition_price ? (((a.noi_trailing-a.debt_service_annual)/a.acquisition_price)*100).toFixed(2) : null
                const statusColors = { stabilized:'var(--g600)', unstabilized:'var(--amber)', value_add:'var(--blue)', under_renovation:'#7b1fa2', lease_up:'#0288d1', development:'#e65100', held_for_sale:'var(--red)', disposed:'var(--gray500)' }
                return (
                  <tr key={a.id} style={{cursor:'pointer'}} onClick={() => setSelectedId(a.id)}>
                    <td><strong style={{color:a.id===selectedId?'var(--g600)':'var(--g900)'}}>{a.name}</strong></td>
                    <td style={{color:'var(--gray500)'}}>{a.market}</td>
                    <td>{a.rooms?.toLocaleString()||'—'}</td>
                    <td style={{fontWeight:500}}>{fmtM(a.noi_trailing)}</td>
                    <td>{fmtM(a.acquisition_price)}</td>
                    <td>{fmtM(a.current_value)}</td>
                    <td style={{fontWeight:500,color:'var(--g700)'}}>{yoc?`${yoc}%`:'—'}</td>
                    <td style={{fontWeight:500,color:'var(--g900)'}}>{lyoc?`${lyoc}%`:'—'}</td>
                    <td><span style={{fontSize:10,color:statusColors[a.status]||'var(--gray500)',fontWeight:500}}>{a.status?.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{fontSize:11,color:'var(--gray500)',marginTop:8}}>Click any row to view detailed P&L for that asset below.</div>
      </div>

      {/* Asset drill-down */}
      <div className="card">
        <div className="card-header">
          <div style={{display:'flex',alignItems:'center',gap:12,flex:1,flexWrap:'wrap'}}>
            <span className="card-title">Asset drill-down</span>
            <AssetSelector assets={assets} selected={selectedId} onSelect={setSelectedId}/>
            <div className="filter-tabs" style={{margin:0}}>
              {['all',...years].map(y=><button key={y} className={`filter-tab${filterYear===y?' active':''}`} onClick={()=>setFilterYear(y)}>{y==='all'?'All years':y}</button>)}
            </div>
          </div>
        </div>

        {!selectedId ? (
          <div style={{fontSize:12,color:'var(--gray500)',textAlign:'center',padding:'20px'}}>Select an asset above to see detailed P&L</div>
        ) : loading ? (
          <div className="loading">Loading financials...</div>
        ) : filteredFins.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No P&L data for {selectedAsset?.name}</div>
            <div className="empty-state-desc">Use the "+ P&L" button on the Asset Tracker page to enter monthly financials.</div>
          </div>
        ) : (
          <>
            {/* Period KPIs */}
            <div className="kpi-grid" style={{marginBottom:16}}>
              <div className="kpi-card"><div className="kpi-label">Revenue</div><div className="kpi-value">{fmtM(totRevenue)}</div><div className="kpi-change">{filteredFins.length} months</div></div>
              <div className="kpi-card"><div className="kpi-label">NOI</div><div className="kpi-value">{fmtM(totNOI)}</div><div className="kpi-change">{noiMargin?`${noiMargin}% margin`:''}</div></div>
              <div className="kpi-card"><div className="kpi-label">Avg. Occupancy</div><div className="kpi-value">{avgOcc?`${avgOcc}%`:'—'}</div></div>
              <div className="kpi-card"><div className="kpi-label">Avg. RevPAR</div><div className="kpi-value">{avgRevPAR?`$${avgRevPAR}`:'—'}</div><div className="kpi-change">{avgADR?`ADR $${avgADR}`:''}</div></div>
            </div>

            {/* Waterfall */}
            {waterfallData.length > 0 && (
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:500,color:'var(--g900)',marginBottom:12}}>P&L waterfall ({filterYear === 'all' ? 'All periods' : filterYear})</div>
                <div style={{display:'flex',alignItems:'flex-end',gap:12,height:200,padding:'0 8px'}}>
                  {waterfallData.map((d,i) => {
                    const maxVal = Math.max(...waterfallData.map(x=>x.value))
                    const h = maxVal > 0 ? Math.max((d.value/maxVal)*160,4) : 4
                    return (
                      <div key={d.name} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flex:1}}>
                        <div style={{fontSize:11,fontWeight:600,color:'var(--g900)'}}>{d.value>0?`$${d.value}K`:'—'}</div>
                        <div style={{width:'100%',height:h,background:d.color,borderRadius:'4px 4px 0 0',transition:'height .4s ease',position:'relative'}}>
                          {i < waterfallData.length-1 && <div style={{position:'absolute',right:-13,top:0,width:13,height:1,background:'var(--gray300)'}}/>}
                        </div>
                        <div style={{fontSize:10,color:'var(--gray500)',textAlign:'center'}}>{d.name}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Revenue & NOI chart */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:500,color:'var(--g900)',marginBottom:8}}>Revenue vs NOI ($000s)</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(v,n)=>[`$${v}K`,n]} contentStyle={{fontSize:11,borderRadius:6}}/>
                  <Bar dataKey="revenue" fill="var(--g200)" name="Revenue" radius={[2,2,0,0]}/>
                  <Bar dataKey="noi" fill="var(--g600)" name="NOI" radius={[2,2,0,0]}/>
                  {chartData.some(d=>d.budget_noi) && <Bar dataKey="budget_noi" fill="var(--gray200)" name="Budget NOI" radius={[2,2,0,0]}/>}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Occupancy & RevPAR chart */}
            {chartData.some(d=>d.occupancy) && (
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:500,color:'var(--g900)',marginBottom:8}}>Occupancy % trend</div>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="label" tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false} domain={[0,100]}/>
                    <Tooltip formatter={(v,n)=>[`${v}%`,n]} contentStyle={{fontSize:11,borderRadius:6}}/>
                    <Line type="monotone" dataKey="occupancy" stroke="var(--g600)" strokeWidth={2} dot={{r:3}} name="Occupancy %" connectNulls/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Monthly data table */}
            <div style={{overflowX:'auto'}}>
              <table className="data-table">
                <thead><tr>
                  <th>Period</th><th>Revenue</th><th>GOP</th><th>NOI</th>
                  <th>NOI Margin</th><th>Occupancy</th><th>ADR</th><th>RevPAR</th>
                  <th>Bud. NOI</th><th>Variance</th>
                </tr></thead>
                <tbody>
                  {[...filteredFins].reverse().map(f => {
                    const margin = f.revenue && f.noi ? ((f.noi/f.revenue)*100).toFixed(1) : null
                    const variance = f.noi && f.budget_noi ? f.noi - f.budget_noi : null
                    return (
                      <tr key={f.id}>
                        <td><strong>{MONTHS[f.period_month-1]} {f.period_year}</strong></td>
                        <td>{fmtM(f.revenue)}</td>
                        <td>{fmtM(f.gop)}</td>
                        <td style={{fontWeight:500}}>{fmtM(f.noi)}</td>
                        <td>{margin?`${margin}%`:'—'}</td>
                        <td>{fmtPct(f.occupancy)}</td>
                        <td>{f.adr?`$${parseFloat(f.adr).toFixed(0)}`:'—'}</td>
                        <td>{f.revpar?`$${parseFloat(f.revpar).toFixed(0)}`:'—'}</td>
                        <td>{fmtM(f.budget_noi)}</td>
                        <td style={{color:variance>0?'var(--g600)':variance<0?'var(--red)':'var(--gray500)',fontWeight:variance?500:400}}>
                          {variance!==null?`${variance>=0?'+':''}${fmtM(variance)}`:'—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
