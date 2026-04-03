import { useState, useEffect } from 'react'
import { useAssets, useDeals } from '../hooks/useData'
import { supabase } from '../lib/supabase'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'

const SECTIONS = [
  { id:'cover', label:'Cover Page', icon:'📄', required:true, description:'Title, date, firm name' },
  { id:'portfolio_summary', label:'Portfolio Summary', icon:'📊', description:'Value, gain/loss, YOC, pipeline overview' },
  { id:'asset_table', label:'Asset Table', icon:'🏨', description:'Full asset list with financials and status' },
  { id:'pipeline', label:'Deal Pipeline', icon:'💼', description:'Active deals by stage with projected returns' },
  { id:'financials', label:'Financial Performance', icon:'📈', description:'P&L by property — NOI, revenue' },
  { id:'valuations', label:'Quarterly Valuations', icon:'📉', description:'Latest valuations and QoQ changes' },
  { id:'debt_summary', label:'Debt Summary', icon:'🏦', description:'Loans with maturities and covenant status' },
  { id:'kpis', label:'Operating KPIs', icon:'🎯', description:'YOC, levered YOC, DSCR, NOI margin by asset' },
]

const REPORT_TYPES = [
  { id:'investor_update', label:'Investor Update', defaultSections:['cover','portfolio_summary','asset_table','pipeline','financials','valuations'] },
  { id:'lp_report', label:'LP Quarterly Report', defaultSections:['cover','portfolio_summary','asset_table','financials','valuations','debt_summary'] },
  { id:'ic_memo', label:'IC Memo', defaultSections:['cover','portfolio_summary','pipeline','kpis'] },
  { id:'ops_review', label:'Operations Review', defaultSections:['cover','asset_table','financials','kpis','debt_summary'] },
  { id:'custom', label:'Custom', defaultSections:['cover','portfolio_summary'] },
]

// Inject print CSS — only the report preview panel will print
const PRINT_STYLE = `
@media print {
  /* Hide app chrome */
  .topbar, .sidebar, .sidebar-collapse-btn { display: none !important; }

  /* Reset layout so report fills the full page */
  .app-shell, .content-area { display: block !important; }
  .main { margin: 0 !important; padding: 0 !important; width: 100% !important; }

  /* Hide the config panel (first grid child) — only show the report */
  #soul-report-config { display: none !important; }
  #soul-report-wrapper {
    display: block !important;
    width: 100% !important;
  }

  /* Let the report card flow across pages */
  #soul-report-preview {
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    overflow: visible !important;
    width: 100% !important;
  }

  @page { margin: 0.5in; size: letter portrait; }
  table { page-break-inside: avoid; width: 100%; font-size: 10px; }
  thead { display: table-header-group; }
  .report-section { page-break-inside: avoid; margin-bottom: 24px; }
}
`

export default function Reports() {
  const { assets } = useAssets()
  const { deals } = useDeals()
  const [valuations, setValuations] = useState([])
  const [debt, setDebt] = useState([])
  const [reportType, setReportType] = useState('investor_update')
  const [sections, setSections] = useState(new Set(['cover','portfolio_summary','asset_table','pipeline','financials','valuations']))
  const [config, setConfig] = useState({
    title:'Portfolio Update',
    period:`Q1 ${new Date().getFullYear()}`,
    preparedBy:'Bear Hutchinson',
    firm:'Kemmons Wilson Hospitality Partners',
    confidential:true,
  })

  // Inject print CSS on mount
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'soul-print-style'
    style.textContent = PRINT_STYLE
    document.head.appendChild(style)
    return () => { const s = document.getElementById('soul-print-style'); if (s) s.remove() }
  }, [])

  useEffect(() => {
    supabase.from('valuations').select('*, assets(name, market)').order('year',{ascending:false}).order('quarter',{ascending:false}).limit(20).then(({data})=>setValuations(data||[]))
    supabase.from('asset_debt').select('*, assets(name)').order('maturity_date').then(({data})=>setDebt(data||[]))
  }, [])

  const toggleSection = (id) => {
    if (SECTIONS.find(s=>s.id===id)?.required) return
    setSections(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})
  }

  const applyTemplate = (typeId) => {
    const t = REPORT_TYPES.find(r=>r.id===typeId)
    if (t) setSections(new Set(t.defaultSections))
    setReportType(typeId)
  }

  // FIX: Proper print function — only prints #soul-report-preview
  const handlePrint = () => { window.print() }

  // Portfolio data
  const totalVal = assets.reduce((s,a)=>s+(parseFloat(a.current_value)||0),0)
  const totalAcq = assets.reduce((s,a)=>s+(parseFloat(a.acquisition_price)||0),0)
  const totalNOI = assets.reduce((s,a)=>s+(parseFloat(a.noi_trailing)||0),0)
  const unrealizedGain = totalVal - totalAcq
  const wtdYOC = totalAcq&&totalNOI?((totalNOI/totalAcq)*100).toFixed(2):null
  const activeDeals = deals.filter(d=>['prospecting','loi','due_diligence','closing'].includes(d.stage))
  const pipelineVal = activeDeals.reduce((s,d)=>s+(parseFloat(d.ask_price)||0),0)
  const latestValuations = Object.values(valuations.reduce((acc,v)=>{if(!acc[v.asset_id]||v.year>acc[v.asset_id].year||(v.year===acc[v.asset_id].year&&v.quarter>acc[v.asset_id].quarter))acc[v.asset_id]=v;return acc},{}))

  const statusColors = {stabilized:'var(--g600)',unstabilized:'var(--amber)',value_add:'var(--blue)',under_renovation:'#7b1fa2',lease_up:'#0288d1',development:'#e65100',held_for_sale:'var(--red)',disposed:'var(--gray500)'}

  return (
    <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:20}}>
      {/* LEFT: Config panel */}
      <div id="soul-report-config">
        <div className="card">
          <div className="card-header"><span className="card-title">Report builder</span></div>

          <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--gray500)',marginBottom:8}}>Template</div>
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:16}}>
            {REPORT_TYPES.map(t=>(
              <button key={t.id} onClick={()=>applyTemplate(t.id)} style={{textAlign:'left',padding:'8px 12px',borderRadius:8,border:'1px solid',fontSize:12,cursor:'pointer',borderColor:reportType===t.id?'var(--g600)':'var(--gray200)',background:reportType===t.id?'var(--g50)':'var(--white)',color:reportType===t.id?'var(--g800)':'var(--gray700)',fontWeight:reportType===t.id?500:400}}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--gray500)',marginBottom:8}}>Include / Exclude Sections</div>
          <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:16}}>
            {SECTIONS.map(s=>{
              const active = sections.has(s.id)
              return (
                <div key={s.id} onClick={()=>toggleSection(s.id)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:8,border:'1px solid',cursor:s.required?'not-allowed':'pointer',borderColor:active?'var(--g400)':'var(--gray200)',background:active?'var(--g50)':'var(--white)',transition:'all .12s'}}>
                  {/* Toggle */}
                  <div style={{width:28,height:16,borderRadius:8,background:active?'var(--g600)':'var(--gray200)',position:'relative',flexShrink:0,transition:'background .15s'}}>
                    <div style={{position:'absolute',top:2,left:active?12:2,width:12,height:12,borderRadius:'50%',background:'#fff',transition:'left .15s'}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:500,color:active?'var(--g800)':'var(--gray700)'}}>{s.icon} {s.label}</div>
                    <div style={{fontSize:10,color:'var(--gray500)'}}>{s.description}</div>
                  </div>
                  {s.required&&<span style={{fontSize:9,color:'var(--gray400)',background:'var(--gray100)',padding:'1px 5px',borderRadius:4}}>required</span>}
                </div>
              )
            })}
          </div>

          <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--gray500)',marginBottom:8}}>Details</div>
          <div className="form-group"><label className="form-label">Report Title</label><input className="form-input" value={config.title} onChange={e=>setConfig(c=>({...c,title:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Period</label><input className="form-input" value={config.period} onChange={e=>setConfig(c=>({...c,period:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Prepared By</label><input className="form-input" value={config.preparedBy} onChange={e=>setConfig(c=>({...c,preparedBy:e.target.value}))}/></div>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer',marginBottom:12}}>
            <input type="checkbox" checked={config.confidential} onChange={e=>setConfig(c=>({...c,confidential:e.target.checked}))}/>Mark as Confidential
          </label>

          {/* FIX: Print button scoped to report panel only */}
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <button className="btn btn-primary" style={{flex:1,justifyContent:'center'}} onClick={handlePrint}>🖨 Print / Save PDF</button>
          </div>
          <div style={{fontSize:10,color:'var(--gray500)',marginTop:6,textAlign:'center',lineHeight:1.5}}>
            Opens print dialog. Choose "Save as PDF" in your printer settings.<br/>Only the report preview will print.
          </div>
          <div style={{fontSize:11,color:'var(--gray500)',marginTop:8,textAlign:'center'}}>{sections.size} sections · {assets.length} assets</div>
        </div>
      </div>

      {/* RIGHT: Report preview — id="soul-report-preview" targets print CSS */}
      <div id="soul-report-wrapper">
        <div id="soul-report-preview" style={{background:'#fff',border:'1px solid var(--gray100)',borderRadius:12,overflow:'hidden',boxShadow:'var(--shadow-md)'}}>

          {/* Cover */}
          {sections.has('cover')&&(
            <div className="report-section" style={{background:'var(--g900)',padding:'40px 48px',borderBottom:'4px solid #c9a96e'}}>
              {config.confidential&&<div style={{fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'.15em',textTransform:'uppercase',marginBottom:24}}>CONFIDENTIAL — NOT FOR DISTRIBUTION</div>}
              <div style={{fontFamily:'Playfair Display,serif',fontSize:28,fontWeight:600,color:'#fff',marginBottom:8}}>{config.title}</div>
              <div style={{fontSize:14,color:'var(--g200)',marginBottom:4}}>{config.period}</div>
              <div style={{fontSize:12,color:'var(--g400)',marginTop:24}}>{config.firm}</div>
              <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:4}}>Prepared by {config.preparedBy} · {new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
            </div>
          )}

          <div style={{padding:'32px 48px'}}>

            {/* Portfolio Summary */}
            {sections.has('portfolio_summary')&&(
              <div className="report-section" style={{marginBottom:36}}>
                <div style={{fontFamily:'Playfair Display,serif',fontSize:16,fontWeight:600,color:'var(--g900)',marginBottom:16,paddingBottom:8,borderBottom:'2px solid var(--g900)'}}>Portfolio Summary</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
                  {[
                    ['Total Assets',String(assets.length)],
                    ['Portfolio Value',fmtM(totalVal)],
                    ['Unrealized Gain',`${unrealizedGain>=0?'+':''}${fmtM(unrealizedGain)}`],
                    ['Wtd. Unlevered YOC',wtdYOC?`${wtdYOC}%`:'—'],
                    ['Total T12 NOI',fmtM(totalNOI)],
                    ['Total Rooms',assets.reduce((s,a)=>s+(a.rooms||0),0).toLocaleString()],
                    ['Pipeline Value',fmtM(pipelineVal)],
                    ['Active Deals',String(activeDeals.length)],
                  ].map(([label,value])=>(
                    <div key={label} style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'10px 12px'}}>
                      <div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>{label}</div>
                      <div style={{fontSize:15,fontWeight:600,color:'var(--g900)',fontFamily:'Playfair Display,serif'}}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Asset Table */}
            {sections.has('asset_table')&&(
              <div className="report-section" style={{marginBottom:36}}>
                <div style={{fontFamily:'Playfair Display,serif',fontSize:16,fontWeight:600,color:'var(--g900)',marginBottom:16,paddingBottom:8,borderBottom:'2px solid var(--g900)'}}>Asset Portfolio</div>
                <table className="data-table">
                  <thead><tr>
                    <th>Property</th><th>Market</th><th>Rooms</th>
                    <th>Acq. Price</th><th>Current Value</th><th>Gain/Loss</th>
                    <th>T12 NOI</th><th>Unlev. YOC</th><th>Status</th>
                  </tr></thead>
                  <tbody>
                    {assets.map(a=>{
                      const gain=a.current_value&&a.acquisition_price?parseFloat(a.current_value)-parseFloat(a.acquisition_price):null
                      const yoc=a.noi_trailing&&a.acquisition_price?((parseFloat(a.noi_trailing)/parseFloat(a.acquisition_price))*100).toFixed(1):null
                      return (
                        <tr key={a.id}>
                          <td><strong>{a.name}</strong></td><td>{a.market}</td><td>{a.rooms?.toLocaleString()}</td>
                          <td>{fmtM(a.acquisition_price)}</td><td>{fmtM(a.current_value)}</td>
                          <td style={{color:gain>=0?'var(--g600)':'var(--red)',fontWeight:500}}>{gain!==null?`${gain>=0?'+':''}${fmtM(gain)}`:'—'}</td>
                          <td>{fmtM(a.noi_trailing)}</td>
                          <td style={{fontWeight:500}}>{yoc?`${yoc}%`:'—'}</td>
                          <td><span style={{fontSize:10,color:statusColors[a.status]||'var(--gray500)',fontWeight:500}}>{a.status?.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pipeline */}
            {sections.has('pipeline')&&(
              <div className="report-section" style={{marginBottom:36}}>
                <div style={{fontFamily:'Playfair Display,serif',fontSize:16,fontWeight:600,color:'var(--g900)',marginBottom:16,paddingBottom:8,borderBottom:'2px solid var(--g900)'}}>Acquisition Pipeline</div>
                {activeDeals.length===0?<div style={{fontSize:12,color:'var(--gray500)'}}>No active deals.</div>:(
                  <table className="data-table">
                    <thead><tr><th>Deal</th><th>Market</th><th>Stage</th><th>Ask Price</th><th>Cap Rate</th><th>Proj. IRR</th><th>Close Prob.</th></tr></thead>
                    <tbody>
                      {activeDeals.map(d=>(
                        <tr key={d.id}>
                          <td><strong>{d.name}</strong></td><td>{d.market||'—'}</td>
                          <td style={{fontSize:10}}>{d.stage?.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</td>
                          <td>{fmtM(d.ask_price)}</td><td>{d.cap_rate?`${d.cap_rate}%`:'—'}</td>
                          <td>{d.projected_irr?`${d.projected_irr}%`:'—'}</td><td>{d.close_probability?`${d.close_probability}%`:'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Valuations */}
            {sections.has('valuations')&&latestValuations.length>0&&(
              <div className="report-section" style={{marginBottom:36}}>
                <div style={{fontFamily:'Playfair Display,serif',fontSize:16,fontWeight:600,color:'var(--g900)',marginBottom:16,paddingBottom:8,borderBottom:'2px solid var(--g900)'}}>Quarterly Valuations</div>
                <table className="data-table">
                  <thead><tr><th>Property</th><th>Period</th><th>Appraised</th><th>Internal Est.</th><th>Equity Value</th><th>Cap Rate</th><th>Status</th></tr></thead>
                  <tbody>
                    {latestValuations.map(v=>(
                      <tr key={v.id}>
                        <td><strong>{v.assets?.name||'—'}</strong></td><td>Q{v.quarter} {v.year}</td>
                        <td>{fmtM(v.appraised_value)}</td><td>{fmtM(v.internal_estimate)}</td>
                        <td style={{fontWeight:500}}>{fmtM(v.equity_value)}</td>
                        <td>{v.cap_rate_applied?`${v.cap_rate_applied}%`:'—'}</td>
                        <td style={{fontSize:11,color:v.approved?'var(--g600)':'var(--amber)',fontWeight:500}}>{v.approved?'Approved':'Draft'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Debt */}
            {sections.has('debt_summary')&&(
              <div className="report-section" style={{marginBottom:36}}>
                <div style={{fontFamily:'Playfair Display,serif',fontSize:16,fontWeight:600,color:'var(--g900)',marginBottom:16,paddingBottom:8,borderBottom:'2px solid var(--g900)'}}>Debt Summary</div>
                {debt.length===0?<div style={{fontSize:12,color:'var(--gray500)'}}>No loans tracked.</div>:(
                  <table className="data-table">
                    <thead><tr><th>Asset</th><th>Lender</th><th>Balance</th><th>Rate</th><th>Maturity</th><th>Ann. DS</th></tr></thead>
                    <tbody>
                      {debt.map(d=>(
                        <tr key={d.id}>
                          <td><strong>{d.assets?.name||'—'}</strong></td><td>{d.lender}</td>
                          <td style={{fontWeight:500}}>{fmtM(d.current_balance)}</td>
                          <td>{d.interest_rate?`${d.interest_rate}%`:'—'}</td>
                          <td>{d.maturity_date?new Date(d.maturity_date).toLocaleDateString('en-US',{month:'short',year:'numeric'}):'—'}</td>
                          <td>{fmtM(d.debt_service_annual)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* KPIs */}
            {sections.has('kpis')&&(
              <div className="report-section" style={{marginBottom:36}}>
                <div style={{fontFamily:'Playfair Display,serif',fontSize:16,fontWeight:600,color:'var(--g900)',marginBottom:16,paddingBottom:8,borderBottom:'2px solid var(--g900)'}}>Operating KPIs</div>
                <table className="data-table">
                  <thead><tr><th>Property</th><th>Rooms</th><th>T12 NOI</th><th>Unlev. YOC</th><th>Lev. YOC</th><th>DSCR</th></tr></thead>
                  <tbody>
                    {assets.map(a=>{
                      const yoc=a.noi_trailing&&a.acquisition_price?((parseFloat(a.noi_trailing)/parseFloat(a.acquisition_price))*100).toFixed(2):null
                      const lyoc=a.noi_trailing&&a.debt_service_annual&&a.acquisition_price?(((parseFloat(a.noi_trailing)-parseFloat(a.debt_service_annual))/parseFloat(a.acquisition_price))*100).toFixed(2):null
                      const dscr=a.noi_trailing&&a.debt_service_annual?(parseFloat(a.noi_trailing)/parseFloat(a.debt_service_annual)).toFixed(2):null
                      return (
                        <tr key={a.id}>
                          <td><strong>{a.name}</strong></td><td>{a.rooms?.toLocaleString()||'—'}</td>
                          <td style={{fontWeight:500}}>{fmtM(a.noi_trailing)}</td>
                          <td>{yoc?`${yoc}%`:'—'}</td><td>{lyoc?`${lyoc}%`:'—'}</td>
                          <td style={{color:dscr&&parseFloat(dscr)>=1.25?'var(--g600)':dscr&&parseFloat(dscr)>=1.0?'var(--amber)':'var(--red)',fontWeight:500}}>{dscr?`${dscr}x`:'—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div style={{paddingTop:20,borderTop:'1px solid var(--gray100)',display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--gray400)'}}>
              <span>{config.firm}</span>
              <span>{config.confidential?'CONFIDENTIAL':''}</span>
              <span>Generated {new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
