import { useState, useEffect } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function AssetSelector({ assets, selected, onSelect, label='Select property...' }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const sel = assets.find(a=>a.id===selected)
  const filtered = assets.filter(a=>!search||a.name.toLowerCase().includes(search.toLowerCase())||a.market?.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const close = (e) => { if (!e.target.closest('.asset-sel-kpi')) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="asset-sel-kpi" style={{position:'relative',minWidth:260}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',border:'1px solid var(--gray200)',borderRadius:8,cursor:'pointer',background:'var(--white)',fontSize:13,color:'var(--g900)',fontWeight:500}} onClick={()=>setOpen(o=>!o)}>
        {sel?<div style={{flex:1}}><div>{sel.name}</div><div style={{fontSize:10,color:'var(--gray500)',fontWeight:400}}>{sel.market} · {sel.rooms} rooms</div></div>:<span style={{flex:1,color:'var(--gray500)',fontWeight:400}}>{label}</span>}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      {open&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,width:'100%',minWidth:280,background:'var(--white)',border:'1px solid var(--gray200)',borderRadius:10,zIndex:300,boxShadow:'var(--shadow-md)',overflow:'hidden'}}>
          <div style={{padding:'8px 10px',borderBottom:'1px solid var(--gray100)'}}>
            <input className="form-input" style={{padding:'5px 10px',fontSize:12}} placeholder="Search properties..." value={search} onChange={e=>setSearch(e.target.value)} onClick={e=>e.stopPropagation()} autoFocus/>
          </div>
          <div style={{maxHeight:260,overflowY:'auto'}}>
            {filtered.length===0&&<div style={{padding:12,fontSize:12,color:'var(--gray500)',textAlign:'center'}}>No properties found</div>}
            {filtered.map(a=>(
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

export default function KPIs() {
  const { assets } = useAssets()
  const [selectedId, setSelectedId] = useState(null)
  const [compId, setCompId] = useState(null)
  const [financials, setFinancials] = useState([])
  const [compData, setCompData] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (assets.length>0&&!selectedId) setSelectedId(assets[0].id) }, [assets])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    Promise.all([
      supabase.from('financials').select('*').eq('asset_id',selectedId).order('period_year').order('period_month'),
      supabase.from('comp_data').select('*').eq('asset_id',selectedId).order('period_year').order('period_month'),
    ]).then(([fins,comp])=>{
      setFinancials(fins.data||[])
      setCompData(comp.data||[])
      setLoading(false)
    })
  }, [selectedId])

  const sel = assets.find(a=>a.id===selectedId)
  const comp = assets.find(a=>a.id===compId)
  const latest = [...compData].sort((a,b)=>b.period_year-a.period_year||b.period_month-a.period_month)[0]
  const t12 = financials.slice(-12)
  const t12Revenue = t12.reduce((s,f)=>s+(parseFloat(f.revenue)||0),0)
  const t12NOI = t12.reduce((s,f)=>s+(parseFloat(f.noi)||0),0)
  const avgOcc = t12.filter(f=>f.occupancy).length?(t12.filter(f=>f.occupancy).reduce((s,f)=>s+parseFloat(f.occupancy),0)/t12.filter(f=>f.occupancy).length).toFixed(1):null
  const avgADR = t12.filter(f=>f.adr).length?(t12.filter(f=>f.adr).reduce((s,f)=>s+parseFloat(f.adr),0)/t12.filter(f=>f.adr).length).toFixed(0):null
  const avgRevPAR = t12.filter(f=>f.revpar).length?(t12.filter(f=>f.revpar).reduce((s,f)=>s+parseFloat(f.revpar),0)/t12.filter(f=>f.revpar).length).toFixed(0):null
  const noiMargin = t12Revenue&&t12NOI?((t12NOI/t12Revenue)*100).toFixed(1):null
  const yoc = sel?.noi_trailing&&sel?.acquisition_price?((parseFloat(sel.noi_trailing)/parseFloat(sel.acquisition_price))*100).toFixed(2):null
  const levYoc = sel?.noi_trailing&&sel?.debt_service_annual&&sel?.acquisition_price?(((parseFloat(sel.noi_trailing)-parseFloat(sel.debt_service_annual))/parseFloat(sel.acquisition_price))*100).toFixed(2):null
  const dscr = sel?.noi_trailing&&sel?.debt_service_annual?(parseFloat(sel.noi_trailing)/parseFloat(sel.debt_service_annual)).toFixed(2):null

  // Radar axes — each scored 0–100 for visualization
  const radarData = [
    {
      metric: 'Occupancy',
      A: latest?.my_occupancy ? Math.min(parseFloat(latest.my_occupancy)/85*100, 100) : (avgOcc ? Math.min(parseFloat(avgOcc)/85*100, 100) : 0),
      label: 'Occupancy %',
      tip: 'Scored: actual occ ÷ 85% benchmark × 100. Higher = better.',
    },
    {
      metric: 'ADR Index',
      A: latest?.adr_index ? Math.min(parseFloat(latest.adr_index)/130*100, 100) : 0,
      label: 'ADR Index (ARI)',
      tip: 'Your ADR vs comp set. 100 = fair share. Scored: index ÷ 130 × 100.',
    },
    {
      metric: 'RevPAR Index',
      A: latest?.revpar_index ? Math.min(parseFloat(latest.revpar_index)/130*100, 100) : 0,
      label: 'RevPAR Index (RGI)',
      tip: 'Your RevPAR vs comp set. 100 = fair share. Scored: index ÷ 130 × 100.',
    },
    {
      metric: 'NOI Margin',
      A: noiMargin ? Math.min(parseFloat(noiMargin)/35*100, 100) : (sel?.noi_trailing&&t12Revenue ? Math.min((parseFloat(sel.noi_trailing)/t12Revenue)*100/35*100,100) : 0),
      label: 'NOI Margin %',
      tip: 'NOI ÷ Revenue. Scored: margin ÷ 35% benchmark × 100. Higher = more operationally efficient.',
    },
    {
      metric: 'YOC',
      A: yoc ? Math.min(parseFloat(yoc)/12*100, 100) : 0,
      label: 'Yield on Cost (Unlevered)',
      tip: 'NOI ÷ Acquisition Price. Scored: YOC ÷ 12% benchmark × 100.',
    },
    {
      metric: 'DSCR',
      A: dscr ? Math.min((parseFloat(dscr)-1)/1.5*100, 100) : 0,
      label: 'Debt Service Coverage',
      tip: 'NOI ÷ Annual Debt Service. Scored: (DSCR − 1.0) ÷ 1.5 × 100. >1.25x is healthy.',
    },
  ]

  const revparTrend = financials.slice(-12).map(f=>({
    label:`${MONTHS[f.period_month-1].slice(0,3)} ${String(f.period_year).slice(2)}`,
    revpar:f.revpar?parseFloat(f.revpar):null,
    adr:f.adr?parseFloat(f.adr):null,
  }))

  return (
    <div>
      <div className="page-header">
        <h1>Property KPIs</h1>
        <p>Select any property to drill into operating performance</p>
      </div>

      {/* Selector */}
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
          {compId&&<button className="btn btn-secondary btn-sm" style={{marginTop:20}} onClick={()=>setCompId(null)}>Clear</button>}
        </div>
      </div>

      {!selectedId?(
        <div className="empty-state"><div className="empty-state-title">Select a property above to see KPIs</div></div>
      ):loading?(
        <div className="loading">Loading KPIs...</div>
      ):(
        <>
          {/* Asset header */}
          <div style={{background:'var(--g900)',borderRadius:12,padding:'20px 24px',marginBottom:20,display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
            <div>
              <div style={{fontFamily:'Playfair Display,serif',fontSize:18,fontWeight:600,color:'#fff',marginBottom:4}}>{sel?.name}</div>
              <div style={{fontSize:12,color:'var(--g200)'}}>{sel?.market} · {sel?.rooms} rooms · {sel?.type}</div>
            </div>
            <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
              {[['YOC (Unlevered)',yoc?`${yoc}%`:'—'],['Levered YOC',levYoc?`${levYoc}%`:'—'],['DSCR',dscr?`${dscr}x`:'—']].map(([l,v])=>(
                <div key={l} style={{background:'rgba(255,255,255,0.08)',borderRadius:8,padding:'10px 14px',textAlign:'center'}}>
                  <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>{l}</div>
                  <div style={{fontSize:16,fontWeight:600,color:'#fff'}}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Formula explainer */}
          <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:10,padding:'12px 16px',marginBottom:16,fontSize:11,color:'var(--g700)'}}>
            <strong style={{fontSize:12}}>How KPIs are calculated:</strong>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'3px 20px',marginTop:6}}>
              <div>• <strong>Unlevered YOC</strong> = NOI ÷ Acquisition Price</div>
              <div>• <strong>Levered YOC</strong> = (NOI − Debt Service) ÷ Acq. Price</div>
              <div>• <strong>DSCR</strong> = NOI ÷ Annual Debt Service (≥1.25x is healthy)</div>
              <div>• <strong>NOI Margin</strong> = NOI ÷ Total Revenue</div>
              <div>• <strong>ADR</strong> = Room Revenue ÷ Rooms Sold</div>
              <div>• <strong>RevPAR</strong> = ADR × Occupancy %</div>
            </div>
          </div>

          <div className="kpi-grid">
            <div className="kpi-card"><div className="kpi-label">T12 NOI</div><div className="kpi-value">{sel?.noi_trailing?`$${(parseFloat(sel.noi_trailing)/1e6).toFixed(1)}M`:'—'}</div><div className="kpi-change">From asset record</div></div>
            <div className="kpi-card"><div className="kpi-label">NOI Margin (T12)</div><div className="kpi-value">{noiMargin?`${noiMargin}%`:'—'}</div><div className="kpi-change">NOI ÷ Revenue · from P&L entries</div></div>
            <div className="kpi-card"><div className="kpi-label">Avg. Occupancy</div><div className="kpi-value">{avgOcc?`${avgOcc}%`:'—'}</div><div className="kpi-change">T12 average</div></div>
            <div className="kpi-card"><div className="kpi-label">Avg. RevPAR</div><div className="kpi-value">{avgRevPAR?`$${avgRevPAR}`:'—'}</div><div className="kpi-change">{avgADR?`ADR $${avgADR}`:''}</div></div>
          </div>

          <div className="grid-2">
            {/* Radar with legend */}
            <div className="card" style={{marginBottom:0}}>
              <div className="card-header"><span className="card-title">Performance radar</span></div>

              {/* Legend explaining each axis */}
              <div style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'10px 12px',marginBottom:12,fontSize:11,color:'var(--gray700)'}}>
                <div style={{fontWeight:500,marginBottom:6,color:'var(--g900)'}}>What this radar shows:</div>
                <div style={{display:'flex',flexDirection:'column',gap:3}}>
                  <div>🔵 <strong>Occupancy</strong> — actual occ vs 85% benchmark. Higher = fuller hotel.</div>
                  <div>🔵 <strong>ADR Index (ARI)</strong> — your ADR vs comp set. 100 = fair share.</div>
                  <div>🔵 <strong>RevPAR Index (RGI)</strong> — your RevPAR vs comp set. &gt;100 = outperforming.</div>
                  <div>🔵 <strong>NOI Margin</strong> — operating efficiency. Scored vs 35% benchmark.</div>
                  <div>🔵 <strong>YOC</strong> — unlevered yield on cost vs 12% benchmark.</div>
                  <div>🔵 <strong>DSCR</strong> — debt coverage. &gt;1.25x is lender-safe.</div>
                </div>
                <div style={{marginTop:6,fontSize:10,color:'var(--gray400)'}}>All axes scaled 0–100. Larger = better. STR indices require comp data entry on the Intel page.</div>
              </div>

              {radarData.some(d=>d.A>0)?(
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--gray100)"/>
                    <PolarAngleAxis dataKey="metric" tick={{fontSize:10,fill:'var(--gray500)'}}/>
                    <Radar name={sel?.name} dataKey="A" stroke="var(--g600)" fill="var(--g600)" fillOpacity={0.2} strokeWidth={2}/>
                    {compId&&<Radar name={comp?.name} dataKey="B" stroke="var(--amber)" fill="var(--amber)" fillOpacity={0.15} strokeWidth={2}/>}
                  </RadarChart>
                </ResponsiveContainer>
              ):(
                <div style={{fontSize:12,color:'var(--gray500)',textAlign:'center',padding:'40px 20px'}}>
                  Enter P&L data and STR comp data to populate the radar.<br/>
                  <span style={{fontSize:11,color:'var(--gray400)'}}>Use "+ P&L" on Asset Tracker · Enter comps on Intel page</span>
                </div>
              )}
            </div>

            {/* RevPAR trend */}
            <div className="card" style={{marginBottom:0}}>
              <div className="card-header"><span className="card-title">RevPAR & ADR trend</span></div>
              {revparTrend.some(d=>d.revpar)?(
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={revparTrend}>
                    <XAxis dataKey="label" tick={{fontSize:9,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={(v,n)=>[`$${v}`,n]} contentStyle={{fontSize:11,borderRadius:6}}/>
                    <Bar dataKey="revpar" fill="var(--g600)" name="RevPAR" radius={[2,2,0,0]}/>
                    <Bar dataKey="adr" fill="var(--g200)" name="ADR" radius={[2,2,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ):(
                <div style={{fontSize:12,color:'var(--gray500)',textAlign:'center',padding:'40px 20px'}}>
                  No monthly P&L data yet.<br/>
                  <span style={{fontSize:11,color:'var(--gray400)'}}>Use "+ P&L" on the Asset Tracker to add data.</span>
                </div>
              )}
            </div>
          </div>

          {/* Side-by-side comparison */}
          {compId&&comp&&(
            <div className="card">
              <div className="card-header"><span className="card-title">Side-by-side comparison</span></div>
              <table className="data-table">
                <thead><tr><th>Metric</th><th>Formula</th><th>{sel?.name?.split(' ').slice(0,2).join(' ')}</th><th>{comp?.name?.split(' ').slice(0,2).join(' ')}</th></tr></thead>
                <tbody>
                  {[
                    ['T12 NOI','From asset record',sel?.noi_trailing,comp?.noi_trailing,v=>`$${(parseFloat(v)/1e6).toFixed(1)}M`],
                    ['Unlevered YOC','NOI ÷ Acq Price',sel?.noi_trailing&&sel?.acquisition_price?((parseFloat(sel.noi_trailing)/parseFloat(sel.acquisition_price))*100):null,comp?.noi_trailing&&comp?.acquisition_price?((parseFloat(comp.noi_trailing)/parseFloat(comp.acquisition_price))*100):null,v=>`${parseFloat(v).toFixed(2)}%`],
                    ['Levered YOC','(NOI−DS) ÷ Acq Price',sel?.noi_trailing&&sel?.debt_service_annual&&sel?.acquisition_price?((parseFloat(sel.noi_trailing)-parseFloat(sel.debt_service_annual))/parseFloat(sel.acquisition_price)*100):null,comp?.noi_trailing&&comp?.debt_service_annual&&comp?.acquisition_price?((parseFloat(comp.noi_trailing)-parseFloat(comp.debt_service_annual))/parseFloat(comp.acquisition_price)*100):null,v=>`${parseFloat(v).toFixed(2)}%`],
                    ['DSCR','NOI ÷ Debt Service',sel?.noi_trailing&&sel?.debt_service_annual?parseFloat(sel.noi_trailing)/parseFloat(sel.debt_service_annual):null,comp?.noi_trailing&&comp?.debt_service_annual?parseFloat(comp.noi_trailing)/parseFloat(comp.debt_service_annual):null,v=>`${parseFloat(v).toFixed(2)}x`],
                    ['Rooms','—',sel?.rooms,comp?.rooms,v=>v.toLocaleString()],
                    ['Acq. Price','—',sel?.acquisition_price,comp?.acquisition_price,v=>`$${(parseFloat(v)/1e6).toFixed(1)}M`],
                    ['Current Value','—',sel?.current_value,comp?.current_value,v=>`$${(parseFloat(v)/1e6).toFixed(1)}M`],
                  ].map(([label,formula,aVal,bVal,format])=>{
                    const diff=aVal!==null&&aVal!==undefined&&bVal!==null&&bVal!==undefined?aVal-bVal:null
                    return (
                      <tr key={label}>
                        <td style={{color:'var(--gray700)'}}>{label}</td>
                        <td style={{fontSize:10,color:'var(--gray400)',fontStyle:'italic'}}>{formula}</td>
                        <td style={{fontWeight:500}}>{aVal!==null&&aVal!==undefined?format(aVal):'—'}</td>
                        <td style={{fontWeight:500}}>{bVal!==null&&bVal!==undefined?format(bVal):'—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
