import { useState, useEffect } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(2)}M` : '—'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function AssetSelector({ assets, selected, onSelect, label='Select property...' }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const sel = assets.find(a => a.id === selected)
  const filtered = assets.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.market?.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const close = (e) => { if (!e.target.closest('.perf-asset-sel')) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="perf-asset-sel" style={{position:'relative',minWidth:260}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',border:'1px solid var(--gray200)',borderRadius:8,cursor:'pointer',background:'var(--white)',fontSize:13,color:'var(--g900)',fontWeight:500}} onClick={()=>setOpen(o=>!o)}>
        {sel
          ? <div style={{flex:1}}><div>{sel.name}</div><div style={{fontSize:10,color:'var(--gray500)',fontWeight:400}}>{sel.market} · {sel.rooms} rooms</div></div>
          : <span style={{flex:1,color:'var(--gray500)',fontWeight:400}}>{label}</span>}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      {open && (
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,width:'100%',minWidth:280,background:'var(--white)',border:'1px solid var(--gray200)',borderRadius:10,zIndex:300,boxShadow:'var(--shadow-md)',overflow:'hidden'}}>
          <div style={{padding:'8px 10px',borderBottom:'1px solid var(--gray100)'}}>
            <input className="form-input" style={{padding:'5px 10px',fontSize:12}} placeholder="Search properties..." value={search} onChange={e=>setSearch(e.target.value)} onClick={e=>e.stopPropagation()} autoFocus/>
          </div>
          <div style={{maxHeight:260,overflowY:'auto'}}>
            {filtered.length===0 && <div style={{padding:12,fontSize:12,color:'var(--gray500)',textAlign:'center'}}>No properties found</div>}
            {filtered.map(a => (
              <div key={a.id} style={{padding:'10px 14px',cursor:'pointer',background:a.id===selected?'var(--g50)':'transparent',borderBottom:'1px solid var(--gray100)'}}
                onClick={()=>{onSelect(a.id);setOpen(false);setSearch('')}}>
                <div style={{fontSize:13,fontWeight:500,color:a.id===selected?'var(--g700)':'var(--g900)'}}>{a.name}</div>
                <div style={{fontSize:10,color:'var(--gray500)'}}>{a.market} · {a.rooms} rooms · {a.type}</div>
              </div>
            ))}
          </div>
          <div style={{padding:'6px 14px',borderTop:'1px solid var(--gray100)',fontSize:10,color:'var(--gray500)'}}>{filtered.length} of {assets.length} properties</div>
        </div>
      )}
    </div>
  )
}

export default function Performance() {
  const { assets } = useAssets()
  const [tab, setTab] = useState('pnl')

  // Shared selected asset
  const [selectedId, setSelectedId] = useState(null)
  const [compId, setCompId] = useState(null)

  // P&L tab state
  const [financials, setFinancials] = useState([])
  const [pnlLoading, setPnlLoading] = useState(false)
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))

  // KPI tab state
  const [compData, setCompData] = useState([])
  const [kpiLoading, setKpiLoading] = useState(false)

  useEffect(() => { if (assets.length > 0 && !selectedId) setSelectedId(assets[0].id) }, [assets])

  useEffect(() => {
    if (!selectedId) return
    setPnlLoading(true)
    setKpiLoading(true)
    Promise.all([
      supabase.from('financials').select('*').eq('asset_id', selectedId).order('period_year').order('period_month'),
      supabase.from('comp_data').select('*').eq('asset_id', selectedId).order('period_year').order('period_month'),
    ]).then(([fins, comp]) => {
      setFinancials(fins.data || [])
      setCompData(comp.data || [])
      setPnlLoading(false)
      setKpiLoading(false)
    })
  }, [selectedId])

  const sel = assets.find(a => a.id === selectedId)
  const comp = assets.find(a => a.id === compId)

  // ── Portfolio KPIs (P&L tab header) ──
  const portfolioNOI = assets.reduce((s,a) => s+(parseFloat(a.noi_trailing)||0), 0)
  const portfolioVal = assets.reduce((s,a) => s+(parseFloat(a.current_value)||0), 0)
  const portfolioAcq = assets.reduce((s,a) => s+(parseFloat(a.acquisition_price)||0), 0)
  const portfolioDS  = assets.reduce((s,a) => s+(parseFloat(a.debt_service_annual)||0), 0)
  const unlevYOC  = portfolioAcq && portfolioNOI ? ((portfolioNOI/portfolioAcq)*100).toFixed(2) : null
  const levYOC    = portfolioAcq && portfolioNOI && portfolioDS ? (((portfolioNOI-portfolioDS)/portfolioAcq)*100).toFixed(2) : null
  const impliedCap = portfolioVal && portfolioNOI ? ((portfolioNOI/portfolioVal)*100).toFixed(2) : null

  // ── P&L tab derived ──
  const years = [...new Set(financials.map(f => String(f.period_year)))].sort((a,b) => b-a)
  const filteredFins = financials.filter(f => filterYear==='all' || String(f.period_year)===filterYear)
  const totRevenue = filteredFins.reduce((s,f) => s+(parseFloat(f.revenue)||0), 0)
  const totNOI     = filteredFins.reduce((s,f) => s+(parseFloat(f.noi)||0), 0)
  const totGOP     = filteredFins.reduce((s,f) => s+(parseFloat(f.gop)||0), 0)
  const withOcc    = filteredFins.filter(f => f.occupancy)
  const withADR    = filteredFins.filter(f => f.adr)
  const avgOcc     = withOcc.length ? (withOcc.reduce((s,f) => s+parseFloat(f.occupancy), 0)/withOcc.length).toFixed(1) : null
  const avgADR     = withADR.length ? (withADR.reduce((s,f) => s+parseFloat(f.adr), 0)/withADR.length).toFixed(0) : null
  const noiMargin  = totRevenue && totNOI ? ((totNOI/totRevenue)*100).toFixed(1) : null

  const chartData = filteredFins.map(f => ({
    label: `${MONTHS[f.period_month-1].slice(0,3)} ${String(f.period_year).slice(2)}`,
    revenue: f.revenue ? Math.round(parseFloat(f.revenue)/1000) : null,
    noi: f.noi ? Math.round(parseFloat(f.noi)/1000) : null,
    gop: f.gop ? Math.round(parseFloat(f.gop)/1000) : null,
  }))

  // ── KPI tab derived ──
  const latest = [...compData].sort((a,b) => b.period_year-a.period_year || b.period_month-a.period_month)[0]
  const t12 = financials.slice(-12)
  const t12Revenue  = t12.reduce((s,f) => s+(parseFloat(f.revenue)||0), 0)
  const t12NOI      = t12.reduce((s,f) => s+(parseFloat(f.noi)||0), 0)
  const t12withOcc  = t12.filter(f => f.occupancy)
  const t12withADR  = t12.filter(f => f.adr)
  const t12withRev  = t12.filter(f => f.revpar)
  const t12AvgOcc   = t12withOcc.length ? (t12withOcc.reduce((s,f) => s+parseFloat(f.occupancy), 0)/t12withOcc.length).toFixed(1) : null
  const t12AvgADR   = t12withADR.length ? (t12withADR.reduce((s,f) => s+parseFloat(f.adr), 0)/t12withADR.length).toFixed(0) : null
  const t12AvgRevPAR = t12withRev.length ? (t12withRev.reduce((s,f) => s+parseFloat(f.revpar), 0)/t12withRev.length).toFixed(0) : null
  const t12Margin   = t12Revenue && t12NOI ? ((t12NOI/t12Revenue)*100).toFixed(1) : null
  const yoc  = sel?.noi_trailing && sel?.acquisition_price ? ((parseFloat(sel.noi_trailing)/parseFloat(sel.acquisition_price))*100).toFixed(2) : null
  const dscr = sel?.noi_trailing && sel?.debt_service_annual ? (parseFloat(sel.noi_trailing)/parseFloat(sel.debt_service_annual)).toFixed(2) : null

  const radarData = [
    { metric:'Occupancy', A: latest?.my_occupancy ? Math.min(parseFloat(latest.my_occupancy)/85*100,100) : (t12AvgOcc ? Math.min(parseFloat(t12AvgOcc)/85*100,100) : 0) },
    { metric:'ADR Index',  A: latest?.adr_index ? Math.min(parseFloat(latest.adr_index)/130*100,100) : 0 },
    { metric:'RGI',        A: latest?.revpar_index ? Math.min(parseFloat(latest.revpar_index)/130*100,100) : 0 },
    { metric:'NOI Margin', A: t12Margin ? Math.min(parseFloat(t12Margin)/35*100,100) : 0 },
    { metric:'YOC',        A: yoc ? Math.min(parseFloat(yoc)/12*100,100) : 0 },
    { metric:'DSCR',       A: dscr ? Math.min((parseFloat(dscr)-1)/1.5*100,100) : 0 },
  ]

  const revparTrend = t12.map(f => ({
    label: `${MONTHS[f.period_month-1].slice(0,3)} ${String(f.period_year).slice(2)}`,
    revpar: f.revpar ? parseFloat(f.revpar) : null,
    adr: f.adr ? parseFloat(f.adr) : null,
  }))

  const tabStyle = (t) => ({
    fontSize:13, padding:'7px 18px', borderRadius:20, border:'1px solid', cursor:'pointer',
    fontWeight: tab===t ? 500 : 400,
    borderColor: tab===t ? 'var(--g600)' : 'var(--gray200)',
    background: tab===t ? 'var(--g700)' : 'var(--white)',
    color: tab===t ? 'var(--white)' : 'var(--gray700)',
    transition:'all .12s',
  })

  return (
    <div>
      <div className="page-header">
        <h1>Performance</h1>
        <p>Monthly P&L drill-down and operating KPIs across the portfolio</p>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <button style={tabStyle('pnl')} onClick={()=>setTab('pnl')}>P&L</button>
        <button style={tabStyle('kpis')} onClick={()=>setTab('kpis')}>Operating KPIs</button>
      </div>

      {/* ══ P&L TAB ══ */}
      {tab==='pnl' && (
        <div>
          {/* Portfolio KPIs */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Est. Portfolio Value</div>
              <div className="kpi-value">{fmtM(portfolioVal)}</div>
              <div className="kpi-change">{fmtM(portfolioAcq)} cost basis</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Unlevered YOC</div>
              <div className="kpi-value">{unlevYOC ? `${unlevYOC}%` : '—'}</div>
              <div className="kpi-change">NOI ÷ Acq. Price · before debt service</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Levered YOC</div>
              <div className="kpi-value">{levYOC ? `${levYOC}%` : '—'}</div>
              <div className="kpi-change">(NOI − Debt Service) ÷ Acq. Price</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Implied Cap Rate</div>
              <div className="kpi-value">{impliedCap ? `${impliedCap}%` : '—'}</div>
              <div className="kpi-change">NOI ÷ current portfolio value</div>
            </div>
          </div>

          {/* Portfolio summary table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Asset P&L summary — {assets.length} properties</span>
              <span style={{fontSize:11,color:'var(--gray500)'}}>Click any row to drill in below</span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table className="data-table">
                <thead><tr>
                  <th>Property</th><th>Market</th><th>Rooms</th>
                  <th>T12 NOI</th><th>Acq. Price</th><th>Current Value</th>
                  <th>Unlev. YOC</th><th>Lev. YOC</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {assets.map(a => {
                    const ayoc  = a.noi_trailing && a.acquisition_price ? ((parseFloat(a.noi_trailing)/parseFloat(a.acquisition_price))*100).toFixed(2) : null
                    const alyoc = a.noi_trailing && a.debt_service_annual && a.acquisition_price ? (((parseFloat(a.noi_trailing)-parseFloat(a.debt_service_annual))/parseFloat(a.acquisition_price))*100).toFixed(2) : null
                    return (
                      <tr key={a.id} style={{cursor:'pointer'}} onClick={()=>setSelectedId(a.id)}>
                        <td><strong style={{color:a.id===selectedId?'var(--g600)':'var(--g900)'}}>{a.name}</strong></td>
                        <td style={{color:'var(--gray500)'}}>{a.market}</td>
                        <td>{a.rooms?.toLocaleString()||'—'}</td>
                        <td style={{fontWeight:500}}>{fmtM(a.noi_trailing)}</td>
                        <td>{fmtM(a.acquisition_price)}</td>
                        <td>{fmtM(a.current_value)}</td>
                        <td>{ayoc ? `${ayoc}%` : '—'}</td>
                        <td style={{fontWeight:500}}>{alyoc ? `${alyoc}%` : '—'}</td>
                        <td><span style={{fontSize:10,color:'var(--g600)',fontWeight:500}}>{a.status?.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly drill-down */}
          <div className="card">
            <div className="card-header">
              <div style={{display:'flex',alignItems:'center',gap:12,flex:1,flexWrap:'wrap'}}>
                <span className="card-title">Monthly P&L drill-down</span>
                <AssetSelector assets={assets} selected={selectedId} onSelect={setSelectedId}/>
                <div className="filter-tabs" style={{margin:0}}>
                  {['all',...years].map(y => (
                    <button key={y} className={`filter-tab${filterYear===y?' active':''}`} onClick={()=>setFilterYear(y)}>
                      {y==='all'?'All years':y}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {!selectedId ? (
              <div style={{fontSize:12,color:'var(--gray500)',textAlign:'center',padding:'20px'}}>Select an asset above</div>
            ) : pnlLoading ? (
              <div className="loading">Loading...</div>
            ) : filteredFins.length===0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-title">No monthly P&L for {sel?.name}</div>
                <div className="empty-state-desc">Go to the asset's detail page and use the Monthly P&L tab to enter data.</div>
              </div>
            ) : (
              <>
                <div className="kpi-grid" style={{marginBottom:16}}>
                  <div className="kpi-card"><div className="kpi-label">Revenue ({filterYear==='all'?'All':filterYear})</div><div className="kpi-value">{fmtM(totRevenue)}</div><div className="kpi-change">{filteredFins.length} months</div></div>
                  <div className="kpi-card"><div className="kpi-label">NOI</div><div className="kpi-value">{fmtM(totNOI)}</div><div className="kpi-change">{noiMargin?`${noiMargin}% margin`:''}</div></div>
                  <div className="kpi-card"><div className="kpi-label">Avg. Occupancy</div><div className="kpi-value">{avgOcc?`${avgOcc}%`:'—'}</div></div>
                  <div className="kpi-card"><div className="kpi-label">Avg. ADR</div><div className="kpi-value">{avgADR?`$${avgADR}`:'—'}</div></div>
                </div>

                <div style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:500,color:'var(--g900)',marginBottom:8}}>Revenue vs NOI ($000s)</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData}>
                      <XAxis dataKey="label" tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                      <Tooltip formatter={(v,n)=>[`$${v}K`,n]} contentStyle={{fontSize:11,borderRadius:6}}/>
                      <Bar dataKey="revenue" fill="var(--g200)" name="Revenue" radius={[2,2,0,0]}/>
                      <Bar dataKey="noi" fill="var(--g600)" name="NOI" radius={[2,2,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{overflowX:'auto'}}>
                  <table className="data-table">
                    <thead><tr>
                      <th>Period</th><th>Revenue</th><th>GOP</th><th>NOI</th>
                      <th>NOI Margin</th><th>Occupancy</th><th>ADR</th><th>RevPAR</th>
                    </tr></thead>
                    <tbody>
                      {[...filteredFins].reverse().map(f => {
                        const margin = f.revenue && f.noi ? ((parseFloat(f.noi)/parseFloat(f.revenue))*100).toFixed(1) : null
                        return (
                          <tr key={f.id}>
                            <td><strong>{MONTHS[f.period_month-1]} {f.period_year}</strong></td>
                            <td>{fmtM(f.revenue)}</td>
                            <td>{fmtM(f.gop)}</td>
                            <td style={{fontWeight:500}}>{fmtM(f.noi)}</td>
                            <td>{margin?`${margin}%`:'—'}</td>
                            <td>{f.occupancy?`${parseFloat(f.occupancy).toFixed(1)}%`:'—'}</td>
                            <td>{f.adr?`$${parseFloat(f.adr).toFixed(0)}`:'—'}</td>
                            <td>{f.revpar?`$${parseFloat(f.revpar).toFixed(0)}`:'—'}</td>
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
      )}

      {/* ══ OPERATING KPIs TAB ══ */}
      {tab==='kpis' && (
        <div>
          {/* Asset selectors */}
          <div className="card">
            <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:280}}>
                <div style={{fontSize:11,fontWeight:500,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:6}}>Primary Property</div>
                <AssetSelector assets={assets} selected={selectedId} onSelect={id=>{setSelectedId(id);if(compId===id)setCompId(null)}}/>
              </div>
              <div style={{flex:1,minWidth:280}}>
                <div style={{fontSize:11,fontWeight:500,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:6}}>Compare With (optional)</div>
                <AssetSelector assets={assets.filter(a=>a.id!==selectedId)} selected={compId} onSelect={setCompId} label="Select comparison property..."/>
              </div>
              {compId && <button className="btn btn-secondary btn-sm" style={{marginTop:20}} onClick={()=>setCompId(null)}>Clear</button>}
            </div>
          </div>

          {!selectedId ? (
            <div className="empty-state"><div className="empty-state-title">Select a property above to see KPIs</div></div>
          ) : kpiLoading ? (
            <div className="loading">Loading KPIs...</div>
          ) : (
            <>
              <div className="kpi-grid">
                <div className="kpi-card"><div className="kpi-label">T12 NOI</div><div className="kpi-value">{sel?.noi_trailing?fmtM(parseFloat(sel.noi_trailing)):'—'}</div><div className="kpi-change">From asset record</div></div>
                <div className="kpi-card"><div className="kpi-label">NOI Margin (T12)</div><div className="kpi-value">{t12Margin?`${t12Margin}%`:'—'}</div><div className="kpi-change">NOI ÷ Revenue</div></div>
                <div className="kpi-card"><div className="kpi-label">Avg. Occupancy</div><div className="kpi-value">{t12AvgOcc?`${t12AvgOcc}%`:'—'}</div><div className="kpi-change">T12 average</div></div>
                <div className="kpi-card"><div className="kpi-label">Avg. RevPAR</div><div className="kpi-value">{t12AvgRevPAR?`$${t12AvgRevPAR}`:'—'}</div><div className="kpi-change">{t12AvgADR?`ADR $${t12AvgADR}`:''}</div></div>
              </div>

              <div className="grid-2">
                {/* Radar */}
                <div className="card" style={{marginBottom:0}}>
                  <div className="card-header"><span className="card-title">Performance radar</span></div>
                  <div style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'10px 12px',marginBottom:12,fontSize:11,color:'var(--gray700)'}}>
                    <div style={{fontWeight:500,marginBottom:4,color:'var(--g900)'}}>Axes (all scored 0–100, larger = better):</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'2px 16px',fontSize:10,color:'var(--gray600)'}}>
                      <div>Occupancy vs 85% benchmark</div>
                      <div>ADR Index vs comp set (÷130)</div>
                      <div>RGI vs comp set (÷130)</div>
                      <div>NOI Margin vs 35% benchmark</div>
                      <div>YOC vs 12% benchmark</div>
                      <div>DSCR: (value−1) ÷ 1.5</div>
                    </div>
                  </div>
                  {radarData.some(d=>d.A>0) ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="var(--gray100)"/>
                        <PolarAngleAxis dataKey="metric" tick={{fontSize:10,fill:'var(--gray500)'}}/>
                        <Radar name={sel?.name} dataKey="A" stroke="var(--g600)" fill="var(--g600)" fillOpacity={0.2} strokeWidth={2}/>
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{fontSize:12,color:'var(--gray500)',textAlign:'center',padding:'40px 20px'}}>
                      Enter P&L and STR comp data to populate the radar.
                    </div>
                  )}
                </div>

                {/* RevPAR & ADR trend */}
                <div className="card" style={{marginBottom:0}}>
                  <div className="card-header"><span className="card-title">RevPAR & ADR trend (T12)</span></div>
                  {revparTrend.some(d=>d.revpar) ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={revparTrend}>
                        <XAxis dataKey="label" tick={{fontSize:9,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                        <Tooltip formatter={(v,n)=>[`$${v}`,n]} contentStyle={{fontSize:11,borderRadius:6}}/>
                        <Bar dataKey="revpar" fill="var(--g600)" name="RevPAR" radius={[2,2,0,0]}/>
                        <Bar dataKey="adr" fill="var(--g200)" name="ADR" radius={[2,2,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{fontSize:12,color:'var(--gray500)',textAlign:'center',padding:'40px 20px'}}>
                      No monthly P&L data yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Side-by-side comparison */}
              {compId && comp && (
                <div className="card">
                  <div className="card-header"><span className="card-title">Side-by-side comparison</span></div>
                  <table className="data-table">
                    <thead><tr>
                      <th>Metric</th><th>Formula</th>
                      <th>{sel?.name?.split(' ').slice(0,2).join(' ')}</th>
                      <th>{comp?.name?.split(' ').slice(0,2).join(' ')}</th>
                    </tr></thead>
                    <tbody>
                      {[
                        ['T12 NOI','From asset record',sel?.noi_trailing,comp?.noi_trailing,v=>`$${(parseFloat(v)/1e6).toFixed(1)}M`],
                        ['Unlev. YOC','NOI ÷ Acq Price',sel?.noi_trailing&&sel?.acquisition_price?((parseFloat(sel.noi_trailing)/parseFloat(sel.acquisition_price))*100):null,comp?.noi_trailing&&comp?.acquisition_price?((parseFloat(comp.noi_trailing)/parseFloat(comp.acquisition_price))*100):null,v=>`${parseFloat(v).toFixed(2)}%`],
                        ['Lev. YOC','(NOI−DS) ÷ Acq Price',sel?.noi_trailing&&sel?.debt_service_annual&&sel?.acquisition_price?((parseFloat(sel.noi_trailing)-parseFloat(sel.debt_service_annual))/parseFloat(sel.acquisition_price)*100):null,comp?.noi_trailing&&comp?.debt_service_annual&&comp?.acquisition_price?((parseFloat(comp.noi_trailing)-parseFloat(comp.debt_service_annual))/parseFloat(comp.acquisition_price)*100):null,v=>`${parseFloat(v).toFixed(2)}%`],
                        ['DSCR','NOI ÷ Debt Service',sel?.noi_trailing&&sel?.debt_service_annual?parseFloat(sel.noi_trailing)/parseFloat(sel.debt_service_annual):null,comp?.noi_trailing&&comp?.debt_service_annual?parseFloat(comp.noi_trailing)/parseFloat(comp.debt_service_annual):null,v=>`${parseFloat(v).toFixed(2)}x`],
                        ['Rooms','—',sel?.rooms,comp?.rooms,v=>v.toLocaleString()],
                        ['Acq. Price','—',sel?.acquisition_price,comp?.acquisition_price,v=>`$${(parseFloat(v)/1e6).toFixed(1)}M`],
                        ['Current Value','—',sel?.current_value,comp?.current_value,v=>`$${(parseFloat(v)/1e6).toFixed(1)}M`],
                      ].map(([label,formula,aVal,bVal,format])=>(
                        <tr key={label}>
                          <td style={{color:'var(--gray700)'}}>{label}</td>
                          <td style={{fontSize:10,color:'var(--gray400)',fontStyle:'italic'}}>{formula}</td>
                          <td style={{fontWeight:500}}>{aVal!=null?format(aVal):'—'}</td>
                          <td style={{fontWeight:500}}>{bVal!=null?format(bVal):'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
