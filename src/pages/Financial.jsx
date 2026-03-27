import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(2)}M` : '—'
const fmtPct = (n) => n ? `${parseFloat(n).toFixed(1)}%` : '—'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function Tip({ children, tip }) {
  return (
    <span className="tooltip-wrap" style={{cursor:'help'}}>
      {children} ⓘ
      <div className="tooltip" style={{minWidth:220,fontWeight:400,lineHeight:1.6}}>{tip}</div>
    </span>
  )
}

function AssetSelector({ assets, selected, onSelect }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const sel = assets.find(a=>a.id===selected)
  const filtered = assets.filter(a=>!search||a.name.toLowerCase().includes(search.toLowerCase())||a.market?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{position:'relative',minWidth:240}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',border:'1px solid var(--gray200)',borderRadius:8,cursor:'pointer',background:'var(--white)',fontSize:13,fontWeight:500,color:'var(--g900)'}} onClick={()=>setOpen(o=>!o)}>
        <span style={{flex:1}}>{sel?sel.name:'Select asset...'}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      {open&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'var(--white)',border:'1px solid var(--gray200)',borderRadius:10,zIndex:200,boxShadow:'var(--shadow-md)',overflow:'hidden'}}>
          <div style={{padding:'8px 10px',borderBottom:'1px solid var(--gray100)'}}>
            <input className="form-input" style={{padding:'5px 10px',fontSize:12}} placeholder="Search assets..." value={search} onChange={e=>setSearch(e.target.value)} onClick={e=>e.stopPropagation()} autoFocus/>
          </div>
          <div style={{maxHeight:220,overflowY:'auto'}}>
            {filtered.map(a=>(
              <div key={a.id} style={{padding:'9px 14px',cursor:'pointer',fontSize:12.5,color:a.id===selected?'var(--g700)':'var(--gray700)',background:a.id===selected?'var(--g50)':'transparent',borderBottom:'1px solid var(--gray100)'}}
                onClick={()=>{onSelect(a.id);setOpen(false);setSearch('')}}>
                <div style={{fontWeight:500}}>{a.name}</div>
                <div style={{fontSize:10,color:'var(--gray500)'}}>{a.market} · {a.type}</div>
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

  useEffect(() => { if (assets.length>0&&!selectedId) setSelectedId(assets[0].id) }, [assets])

  // FIX: Financial Performance reads from financials table — that's where + P&L entries go
  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    supabase.from('financials').select('*').eq('asset_id',selectedId).order('period_year').order('period_month').then(({data})=>{
      setFinancials(data||[])
      setLoading(false)
    })
  }, [selectedId])

  const selectedAsset = assets.find(a=>a.id===selectedId)
  const years = [...new Set(financials.map(f=>String(f.period_year)))].sort((a,b)=>b-a)
  const filteredFins = financials.filter(f=>filterYear==='all'||String(f.period_year)===filterYear)

  const chartData = filteredFins.map(f=>({
    label:`${MONTHS[f.period_month-1].slice(0,3)} ${String(f.period_year).slice(2)}`,
    revenue:f.revenue?Math.round(f.revenue/1000):null,
    noi:f.noi?Math.round(f.noi/1000):null,
    gop:f.gop?Math.round(f.gop/1000):null,
    occupancy:f.occupancy?parseFloat(f.occupancy):null,
  }))

  const totRevenue=filteredFins.reduce((s,f)=>s+(parseFloat(f.revenue)||0),0)
  const totNOI=filteredFins.reduce((s,f)=>s+(parseFloat(f.noi)||0),0)
  const totGOP=filteredFins.reduce((s,f)=>s+(parseFloat(f.gop)||0),0)
  const avgOcc=filteredFins.filter(f=>f.occupancy).length?(filteredFins.filter(f=>f.occupancy).reduce((s,f)=>s+parseFloat(f.occupancy),0)/filteredFins.filter(f=>f.occupancy).length).toFixed(1):null
  const avgADR=filteredFins.filter(f=>f.adr).length?(filteredFins.filter(f=>f.adr).reduce((s,f)=>s+parseFloat(f.adr),0)/filteredFins.filter(f=>f.adr).length).toFixed(0):null
  const noiMargin=totRevenue&&totNOI?((totNOI/totRevenue)*100).toFixed(1):null

  // Portfolio-level KPIs using noi_trailing on assets
  const portfolioNOI=assets.reduce((s,a)=>s+(parseFloat(a.noi_trailing)||0),0)
  const portfolioVal=assets.reduce((s,a)=>s+(parseFloat(a.current_value)||0),0)
  const portfolioAcq=assets.reduce((s,a)=>s+(parseFloat(a.acquisition_price)||0),0)
  const portfolioDS=assets.reduce((s,a)=>s+(parseFloat(a.debt_service_annual)||0),0)

  // YOC formulas
  const unleveredYOC=portfolioAcq&&portfolioNOI?((portfolioNOI/portfolioAcq)*100).toFixed(2):null
  const leveredYOC=portfolioAcq&&portfolioNOI&&portfolioDS?(((portfolioNOI-portfolioDS)/portfolioAcq)*100).toFixed(2):null
  const impliedCapRate=portfolioVal&&portfolioNOI?((portfolioNOI/portfolioVal)*100).toFixed(2):null

  return (
    <div>
      <div className="page-header">
        <h1>Financial Performance</h1>
        <p>Asset-level P&L from monthly entries · Portfolio-level KPIs from asset records</p>
      </div>

      {/* Formula explainer banner */}
      <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:12,color:'var(--g800)'}}>
        <strong>How metrics are calculated:</strong>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:'4px 24px',marginTop:6,fontSize:11,color:'var(--g700)'}}>
          <div>📌 <strong>Est. Portfolio Value</strong> = Sum of "Current Value" on each asset</div>
          <div>📌 <strong>Unlevered YOC</strong> = Total NOI ÷ Total Acquisition Price</div>
          <div>📌 <strong>Levered YOC</strong> = (NOI − Debt Service) ÷ Acquisition Price</div>
          <div>📌 <strong>Implied Cap Rate</strong> = Total NOI ÷ Current Portfolio Value</div>
          <div>📌 <strong>NOI Margin</strong> = NOI ÷ Revenue for the selected period</div>
          <div>📌 P&L figures come from the "+ P&L" entries on the Asset Tracker page</div>
        </div>
      </div>

      {/* Portfolio KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label"><Tip tip="Sum of 'Current Value' across all 7 assets. Update each asset's Current Value to keep this accurate.">Est. Portfolio Value</Tip></div>
          <div className="kpi-value">{fmtM(portfolioVal)}</div>
          <div className="kpi-change">{fmtM(portfolioAcq)} cost basis</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Tip tip={`Unlevered = NOI ÷ Acq Price (${fmtM(portfolioNOI)} ÷ ${fmtM(portfolioAcq)}). This is BEFORE debt service — the gross yield on your invested capital.`}>Unlevered YOC</Tip></div>
          <div className="kpi-value">{unleveredYOC?`${unleveredYOC}%`:'—'}</div>
          <div className="kpi-change">Before debt service</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Tip tip={`Levered = (NOI − Debt Service) ÷ Acq Price = (${fmtM(portfolioNOI)} − ${fmtM(portfolioDS)}) ÷ ${fmtM(portfolioAcq)}. This is AFTER debt service — net yield to equity.`}>Levered YOC</Tip></div>
          <div className="kpi-value">{leveredYOC?`${leveredYOC}%`:'—'}</div>
          <div className="kpi-change">After debt service</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label"><Tip tip="Total NOI ÷ Current Portfolio Value. What the market is effectively 'paying' for your NOI stream.">Implied Cap Rate</Tip></div>
          <div className="kpi-value">{impliedCapRate?`${impliedCapRate}%`:'—'}</div>
          <div className="kpi-change">NOI ÷ current value</div>
        </div>
      </div>

      {/* Portfolio P&L summary — all assets, sourced from noi_trailing */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Asset P&L summary — {assets.length} properties</span>
          <span style={{fontSize:11,color:'var(--gray500)'}}>Sourced from Trailing NOI on each asset record</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead><tr>
              <th>Property</th><th>Market</th><th>Rooms</th>
              <th><Tip tip="Sum of monthly revenue from P&L entries, or estimated from NOI if no monthly data entered.">T12 NOI</Tip></th>
              <th>Acq. Price</th><th>Current Value</th>
              <th><Tip tip="NOI ÷ Acquisition Price — gross yield before debt service.">Unlevered YOC</Tip></th>
              <th><Tip tip="(NOI − Annual Debt Service) ÷ Acquisition Price — net yield after financing costs.">Levered YOC</Tip></th>
              <th>Status</th>
            </tr></thead>
            <tbody>
              {assets.map(a=>{
                const yoc=a.noi_trailing&&a.acquisition_price?((parseFloat(a.noi_trailing)/parseFloat(a.acquisition_price))*100).toFixed(2):null
                const lyoc=a.noi_trailing&&a.debt_service_annual&&a.acquisition_price?(((parseFloat(a.noi_trailing)-parseFloat(a.debt_service_annual))/parseFloat(a.acquisition_price))*100).toFixed(2):null
                return (
                  <tr key={a.id} style={{cursor:'pointer'}} onClick={()=>setSelectedId(a.id)}>
                    <td><strong style={{color:a.id===selectedId?'var(--g600)':'var(--g900)'}}>{a.name}</strong></td>
                    <td style={{color:'var(--gray500)'}}>{a.market}</td>
                    <td>{a.rooms?.toLocaleString()||'—'}</td>
                    <td style={{fontWeight:500}}>{fmtM(a.noi_trailing)}</td>
                    <td>{fmtM(a.acquisition_price)}</td>
                    <td>{fmtM(a.current_value)}</td>
                    <td style={{color:'var(--g700)'}}>{yoc?`${yoc}%`:'—'}</td>
                    <td style={{fontWeight:500,color:'var(--g900)'}}>{lyoc?`${lyoc}%`:'—'}</td>
                    <td><span style={{fontSize:10,color:'var(--g600)',fontWeight:500}}>{a.status?.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{fontSize:11,color:'var(--gray500)',marginTop:8}}>Click any row to drill into that asset's monthly P&L below.</div>
      </div>

      {/* Asset drill-down — reads from financials table */}
      <div className="card">
        <div className="card-header">
          <div style={{display:'flex',alignItems:'center',gap:12,flex:1,flexWrap:'wrap'}}>
            <span className="card-title">Monthly P&L drill-down</span>
            <AssetSelector assets={assets} selected={selectedId} onSelect={setSelectedId}/>
            <div className="filter-tabs" style={{margin:0}}>
              {['all',...years].map(y=><button key={y} className={`filter-tab${filterYear===y?' active':''}`} onClick={()=>setFilterYear(y)}>{y==='all'?'All years':y}</button>)}
            </div>
          </div>
        </div>

        {/* FIX: Explain data source */}
        <div style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:7,padding:'8px 12px',fontSize:11,color:'var(--gray600)',marginBottom:12}}>
          💡 This data comes from the "+ P&L" button on the Asset Tracker page. Each monthly entry you save flows here automatically.
          {selectedAsset&&<> Currently viewing: <strong>{selectedAsset.name}</strong>.</>}
        </div>

        {!selectedId?(
          <div style={{fontSize:12,color:'var(--gray500)',textAlign:'center',padding:'20px'}}>Select an asset above</div>
        ):loading?(
          <div className="loading">Loading P&L data...</div>
        ):filteredFins.length===0?(
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No monthly P&L data for {selectedAsset?.name}</div>
            <div className="empty-state-desc">Go to the Asset Tracker page, find this asset, and click "+ P&L" to enter monthly financials. They will appear here immediately.</div>
          </div>
        ):(
          <>
            <div className="kpi-grid" style={{marginBottom:16}}>
              <div className="kpi-card"><div className="kpi-label">Revenue ({filterYear==='all'?'All':filterYear})</div><div className="kpi-value">{fmtM(totRevenue)}</div><div className="kpi-change">{filteredFins.length} months entered</div></div>
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
                  <th><Tip tip="NOI ÷ Revenue for this month">NOI Margin</Tip></th>
                  <th>Occupancy</th><th>ADR</th><th>RevPAR</th>
                </tr></thead>
                <tbody>
                  {[...filteredFins].reverse().map(f=>{
                    const margin=f.revenue&&f.noi?((parseFloat(f.noi)/parseFloat(f.revenue))*100).toFixed(1):null
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
  )
}
