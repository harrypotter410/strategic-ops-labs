import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAssets, useDeals } from '../hooks/useData'
import { Link } from 'react-router-dom'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'
const currentYear = new Date().getFullYear()

// Simple IRR approximation via Newton's method
function calcIRR(acqPrice, exitValue, holdYears, annualCF=0) {
  if (!acqPrice||!exitValue||!holdYears||holdYears<=0) return null
  if (acqPrice<=0||exitValue<=0) return null
  let irr = 0.10
  for (let i=0;i<100;i++) {
    let npv=-acqPrice
    for (let y=1;y<=holdYears;y++) npv+=annualCF/Math.pow(1+irr,y)
    npv+=exitValue/Math.pow(1+irr,holdYears)
    if (Math.abs(npv)<500) break
    irr+=npv>0?0.005:-0.005
    if (irr<-0.5||irr>5) return null
  }
  return isFinite(irr)&&!isNaN(irr) ? parseFloat((irr*100).toFixed(1)) : null
}

// Deal score formula
const SCORE_RULES = [
  { factor:'Base score', condition:'Always', points:50 },
  { factor:'Cap rate ≥ 8%', condition:'cap_rate >= 8', points:'+20' },
  { factor:'Cap rate 7–8%', condition:'cap_rate 7–8', points:'+15' },
  { factor:'Cap rate 6–7%', condition:'cap_rate 6–7', points:'+8' },
  { factor:'Cap rate < 5%', condition:'cap_rate < 5', points:'−10' },
  { factor:'Price/key < $150K', condition:'price_per_key < 150K', points:'+15' },
  { factor:'Price/key < $200K', condition:'price_per_key < 200K', points:'+10' },
  { factor:'Price/key < $250K', condition:'price_per_key < 250K', points:'+5' },
  { factor:'Price/key > $350K', condition:'price_per_key > 350K', points:'−10' },
  { factor:'IRR ≥ 18%', condition:'projected_irr >= 18', points:'+15' },
  { factor:'IRR 15–18%', condition:'projected_irr 15–18', points:'+10' },
  { factor:'IRR 12–15%', condition:'projected_irr 12–15', points:'+5' },
  { factor:'IRR < 10%', condition:'projected_irr < 10', points:'−10' },
]

// Edit modal for a single asset's IRR inputs
function AssetIRREditModal({ asset, onClose, onSave }) {
  const [form, setForm] = useState({
    year_acquired: asset.year_acquired||'',
    noi_trailing: asset.noi_trailing||'',
    debt_service_annual: asset.debt_service_annual||'',
    acquisition_price: asset.acquisition_price||'',
    current_value: asset.current_value||'',
    hold_period_years: asset.hold_period_years||'',
    target_exit_year: asset.target_exit_year||'',
    target_exit_cap_rate: asset.target_exit_cap_rate||'',
    projected_exit_value: asset.projected_exit_value||'',
    actual_irr: asset.actual_irr||'',
  })
  const [loading, setLoading] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  // Live IRR preview
  const holdYears = form.target_exit_year&&form.year_acquired ? parseInt(form.target_exit_year)-parseInt(form.year_acquired) : parseInt(form.hold_period_years)||null
  const annualCF = (parseFloat(form.noi_trailing)||0) - (parseFloat(form.debt_service_annual)||0)
  const liveIRR = calcIRR(parseFloat(form.acquisition_price)||null, parseFloat(form.projected_exit_value)||null, holdYears, annualCF)
  const equityMultiple = form.projected_exit_value&&form.acquisition_price ? (parseFloat(form.projected_exit_value)/parseFloat(form.acquisition_price)).toFixed(2) : null
  const yoc = form.noi_trailing&&form.acquisition_price ? ((parseFloat(form.noi_trailing)/parseFloat(form.acquisition_price))*100).toFixed(2) : null

  const handleSave = async () => {
    setLoading(true)
    await onSave(asset.id, {
      year_acquired:form.year_acquired?parseInt(form.year_acquired):null,
      noi_trailing:form.noi_trailing?parseFloat(form.noi_trailing):null,
      debt_service_annual:form.debt_service_annual?parseFloat(form.debt_service_annual):null,
      acquisition_price:form.acquisition_price?parseFloat(form.acquisition_price):null,
      current_value:form.current_value?parseFloat(form.current_value):null,
      hold_period_years:form.hold_period_years?parseInt(form.hold_period_years):null,
      target_exit_year:form.target_exit_year?parseInt(form.target_exit_year):null,
      target_exit_cap_rate:form.target_exit_cap_rate?parseFloat(form.target_exit_cap_rate):null,
      projected_exit_value:form.projected_exit_value?parseFloat(form.projected_exit_value):null,
      actual_irr:form.actual_irr?parseFloat(form.actual_irr):null,
    })
    setLoading(false); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:540}}>
        <div className="modal-header"><span className="modal-title">Edit IRR Inputs — {asset.name}</span><button className="modal-close" onClick={onClose}>✕</button></div>

        <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:8,padding:'10px 14px',marginBottom:14,fontSize:11,color:'var(--g700)'}}>
          <strong>How IRR is calculated here:</strong><br/>
          Projected IRR = discount rate where NPV of (annual cash flows + exit proceeds) equals acquisition price.<br/>
          Cash flow = NOI − Debt Service each year. Exit = Projected Exit Value.
        </div>

        <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--g600)',marginBottom:8}}>Acquisition</div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Year Acquired</label><input className="form-input" type="number" value={form.year_acquired} onChange={e=>set('year_acquired',e.target.value)} placeholder="2018"/></div>
          <div className="form-group"><label className="form-label">Acquisition Price ($)</label><input className="form-input" type="number" value={form.acquisition_price} onChange={e=>set('acquisition_price',e.target.value)}/></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Trailing NOI ($) <span style={{fontSize:9,color:'var(--gray400)'}}>Used as annual CF</span></label><input className="form-input" type="number" value={form.noi_trailing} onChange={e=>set('noi_trailing',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Annual Debt Service ($)</label><input className="form-input" type="number" value={form.debt_service_annual} onChange={e=>set('debt_service_annual',e.target.value)}/></div>
        </div>

        <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--g600)',margin:'12px 0 8px'}}>Exit Assumptions</div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Target Exit Year</label><input className="form-input" type="number" value={form.target_exit_year} onChange={e=>set('target_exit_year',e.target.value)} placeholder="2027"/></div>
          <div className="form-group"><label className="form-label">Hold Period (years) <span style={{fontSize:9,color:'var(--gray400)'}}>Auto-calc if both dates set</span></label><input className="form-input" type="number" value={form.hold_period_years} onChange={e=>set('hold_period_years',e.target.value)}/></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Target Exit Cap Rate (%)</label><input className="form-input" type="number" step="0.1" value={form.target_exit_cap_rate} onChange={e=>set('target_exit_cap_rate',e.target.value)} placeholder="6.0"/></div>
          <div className="form-group"><label className="form-label">Projected Exit Value ($)</label><input className="form-input" type="number" value={form.projected_exit_value} onChange={e=>set('projected_exit_value',e.target.value)}/></div>
        </div>

        {/* Live IRR preview */}
        {(liveIRR||equityMultiple)&&(
          <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:8,padding:'10px 14px',display:'flex',gap:20,marginBottom:12}}>
            {holdYears&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>Hold Period</div><div style={{fontSize:14,fontWeight:600,color:'var(--g900)'}}>{holdYears} yrs</div></div>}
            {liveIRR&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>Projected IRR</div><div style={{fontSize:18,fontWeight:700,color:liveIRR>=15?'var(--g600)':liveIRR>=12?'var(--amber)':'var(--red)'}}>{liveIRR}%</div><div style={{fontSize:9,color:'var(--gray400)'}}>Auto-calculated</div></div>}
            {equityMultiple&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>Equity Multiple</div><div style={{fontSize:14,fontWeight:600,color:'var(--g900)'}}>{equityMultiple}x</div></div>}
            {yoc&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>YOC (Unlev.)</div><div style={{fontSize:14,fontWeight:600,color:'var(--g900)'}}>{yoc}%</div></div>}
          </div>
        )}

        <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--g600)',margin:'4px 0 8px'}}>Actual (if disposed)</div>
        <div className="form-group"><label className="form-label">Actual Realized IRR (%) — enter from your model</label><input className="form-input" type="number" step="0.1" value={form.actual_irr} onChange={e=>set('actual_irr',e.target.value)} placeholder="16.4"/></div>

        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading?'Saving...':'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

export default function IRRDashboard() {
  const { assets, updateAsset } = useAssets()
  const { deals } = useDeals()
  const [editModal, setEditModal] = useState(null)
  const [showCalcExplainer, setShowCalcExplainer] = useState(false)
  const [showScoreExplainer, setShowScoreExplainer] = useState(false)

  const activeDeals = deals.filter(d=>['prospecting','loi','due_diligence','closing'].includes(d.stage))

  const assetIRR = assets.map(a => {
    const holdYears = a.target_exit_year&&a.year_acquired ? parseInt(a.target_exit_year)-parseInt(a.year_acquired) : a.hold_period_years
    const annualCF = (parseFloat(a.noi_trailing)||0) - (parseFloat(a.debt_service_annual)||0)
    const projIRR = calcIRR(parseFloat(a.acquisition_price)||null, parseFloat(a.projected_exit_value)||null, holdYears, annualCF)
    const yoc = a.noi_trailing&&a.acquisition_price ? ((parseFloat(a.noi_trailing)/parseFloat(a.acquisition_price))*100).toFixed(1) : null
    const unrealizedGain = a.current_value&&a.acquisition_price ? parseFloat(a.current_value)-parseFloat(a.acquisition_price) : null
    const equityMultiple = a.projected_exit_value&&a.acquisition_price ? (parseFloat(a.projected_exit_value)/parseFloat(a.acquisition_price)).toFixed(2) : null
    const yearsToExit = a.target_exit_year ? parseInt(a.target_exit_year)-currentYear : null
    return { ...a, holdYears, projIRR, yoc:yoc?parseFloat(yoc):null, unrealizedGain, equityMultiple, yearsToExit }
  })

  const withProjIRR = assetIRR.filter(a=>a.projIRR)
  const avgProjIRR = withProjIRR.length ? (withProjIRR.reduce((s,a)=>s+a.projIRR,0)/withProjIRR.length).toFixed(1) : null
  const pastExit = assetIRR.filter(a=>a.yearsToExit!==null&&a.yearsToExit<0)
  const approachingExit = assetIRR.filter(a=>a.yearsToExit!==null&&a.yearsToExit>=0&&a.yearsToExit<=2)
  const avgPipelineIRR = activeDeals.filter(d=>d.projected_irr).length ? (activeDeals.filter(d=>d.projected_irr).reduce((s,d)=>s+parseFloat(d.projected_irr),0)/activeDeals.filter(d=>d.projected_irr).length).toFixed(1) : null

  const irrChartData = assetIRR.filter(a=>a.projIRR||a.yoc).map(a=>({
    name:a.name.split(' ').slice(0,2).join(' '),
    'Proj. IRR':a.projIRR,
    'YOC':a.yoc,
  }))

  const handleSaveAsset = async (id, data) => {
    await updateAsset(id, data)
  }

  return (
    <div>
      <div className="page-header">
        <h1>IRR & Exit Analysis</h1>
        <p>Projected returns and hold period tracking across the portfolio</p>
      </div>

      {/* How it's calculated — collapsible */}
      <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:10,padding:'12px 16px',marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}} onClick={()=>setShowCalcExplainer(v=>!v)}>
          <strong style={{fontSize:13,color:'var(--g900)'}}>📐 How IRR is calculated</strong>
          <span style={{fontSize:11,color:'var(--g600)'}}>{showCalcExplainer?'Hide ▲':'Show ▼'}</span>
        </div>
        {showCalcExplainer&&(
          <div style={{marginTop:12,fontSize:12,color:'var(--g800)',lineHeight:1.8}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 24px'}}>
              <div>• <strong>Projected IRR</strong> = discount rate where NPV of all cash flows = $0</div>
              <div>• <strong>Annual cash flow</strong> = Trailing NOI − Annual Debt Service</div>
              <div>• <strong>Exit proceeds</strong> = Projected Exit Value (minus debt is NOT deducted here — this is levered project IRR)</div>
              <div>• <strong>Hold years</strong> = Target Exit Year − Year Acquired (or Hold Period Years if set)</div>
              <div>• <strong>Equity multiple</strong> = Projected Exit Value ÷ Acquisition Price</div>
              <div>• <strong>YOC</strong> = Trailing NOI ÷ Acquisition Price (unlevered)</div>
            </div>
            <div style={{marginTop:8,padding:'8px 12px',background:'var(--g100)',borderRadius:7,fontSize:11}}>
              ✏️ <strong>To update IRR inputs</strong>: Click the "Edit" button on any asset row below, or use the Edit button on the Asset Tracker. Fill in Year Acquired, Trailing NOI, Debt Service, Target Exit Year, and Projected Exit Value.
            </div>
          </div>
        )}
      </div>

      {/* Deal score explainer */}
      <div style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:10,padding:'12px 16px',marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}} onClick={()=>setShowScoreExplainer(v=>!v)}>
          <strong style={{fontSize:13,color:'var(--g900)'}}>🎯 How deal scores are calculated</strong>
          <span style={{fontSize:11,color:'var(--g600)'}}>{showScoreExplainer?'Hide ▲':'Show ▼'}</span>
        </div>
        {showScoreExplainer&&(
          <div style={{marginTop:12}}>
            <div style={{fontSize:12,color:'var(--gray700)',marginBottom:8}}>Deal score is a 0–100 index calculated automatically from three inputs: cap rate, price per key, and projected IRR. Base score is 50.</div>
            <table className="data-table" style={{fontSize:11}}>
              <thead><tr><th>Factor</th><th>Condition</th><th>Points</th></tr></thead>
              <tbody>
                {SCORE_RULES.map((r,i)=>(
                  <tr key={i}>
                    <td>{r.factor}</td>
                    <td style={{color:'var(--gray500)'}}>{r.condition}</td>
                    <td style={{fontWeight:500,color:String(r.points).startsWith('+')?'var(--g600)':String(r.points).startsWith('−')?'var(--red)':'var(--gray700)'}}>{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{fontSize:11,color:'var(--gray500)',marginTop:6}}>Score is capped at 0–100. Scores ≥70 are green, 50–69 amber, &lt;50 red.</div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {(pastExit.length>0||approachingExit.length>0)&&(
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
          {pastExit.map(a=><Link key={a.id} to={`/assets/${a.id}`} style={{textDecoration:'none'}}><div style={{background:'var(--redL)',border:'1px solid #f5c6c2',borderRadius:8,padding:'8px 14px',fontSize:12,color:'var(--red)'}}>⚠ {a.name} — past target exit ({a.target_exit_year})</div></Link>)}
          {approachingExit.map(a=><Link key={a.id} to={`/assets/${a.id}`} style={{textDecoration:'none'}}><div style={{background:'var(--amberL)',border:'1px solid #ffe082',borderRadius:8,padding:'8px 14px',fontSize:12,color:'var(--amber)'}}>⏰ {a.name} — target exit in {a.yearsToExit} yr{a.yearsToExit!==1?'s':''}</div></Link>)}
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Avg. Projected IRR</div><div className="kpi-value">{avgProjIRR?`${avgProjIRR}%`:'—'}</div><div className="kpi-change">{withProjIRR.length} assets with full data</div></div>
        <div className="kpi-card"><div className="kpi-label">Pipeline Avg. IRR</div><div className="kpi-value">{avgPipelineIRR?`${avgPipelineIRR}%`:'—'}</div><div className="kpi-change">Active deals</div></div>
        <div className="kpi-card"><div className="kpi-label">Assets Near/Past Exit</div><div className="kpi-value" style={{color:pastExit.length>0?'var(--red)':approachingExit.length>0?'var(--amber)':'var(--g900)'}}>{pastExit.length+approachingExit.length}</div><div className="kpi-change">{pastExit.length>0?`${pastExit.length} past target`:'within 2 years'}</div></div>
        <div className="kpi-card"><div className="kpi-label">Total Portfolio Value</div><div className="kpi-value">{fmtM(assets.reduce((s,a)=>s+(parseFloat(a.current_value)||0),0))}</div><div className="kpi-change">vs {fmtM(assets.reduce((s,a)=>s+(parseFloat(a.acquisition_price)||0),0))} cost</div></div>
      </div>

      {irrChartData.length>0&&(
        <div className="card">
          <div className="card-header"><span className="card-title">Projected IRR & YOC by asset</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={irrChartData} layout="vertical">
              <XAxis type="number" tick={{fontSize:10}} axisLine={false} tickLine={false} unit="%"/>
              <YAxis type="category" dataKey="name" tick={{fontSize:11}} axisLine={false} tickLine={false} width={120}/>
              <Tooltip formatter={(v,n)=>[v?`${v}%`:'—',n]} contentStyle={{fontSize:11,borderRadius:6}}/>
              <Bar dataKey="Proj. IRR" fill="var(--g600)" radius={[0,3,3,0]}/>
              <Bar dataKey="YOC" fill="var(--g200)" radius={[0,3,3,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Full asset IRR table with edit button */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Asset return summary</span>
          <span style={{fontSize:11,color:'var(--gray500)'}}>Click Edit to update IRR inputs for any asset</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table className="data-table">
            <thead><tr>
              <th>Asset</th><th>Acquired</th><th>Yrs Held</th>
              <th>Acq. Price</th><th>Current Value</th>
              <th>Unrealized Gain</th><th>Equity Multiple</th>
              <th>YOC</th>
              <th title="Calculated from: Acq Price, Proj Exit Value, Hold Years, NOI−DS as annual CF">Proj. IRR ⓘ</th>
              <th>Target Exit</th><th>Yrs to Exit</th>
              <th>Proj. Exit Value</th><th>Edit</th>
            </tr></thead>
            <tbody>
              {assetIRR.map(a=>(
                <tr key={a.id}>
                  <td><Link to={`/assets/${a.id}`} style={{color:'var(--g600)',textDecoration:'none',fontWeight:500}}>{a.name}</Link></td>
                  <td>{a.year_acquired||'—'}</td>
                  <td>{a.year_acquired?`${currentYear-parseInt(a.year_acquired)}y`:'—'}</td>
                  <td>{fmtM(a.acquisition_price)}</td>
                  <td>{fmtM(a.current_value)}</td>
                  <td style={{color:a.unrealizedGain>=0?'var(--g600)':'var(--red)',fontWeight:500}}>{a.unrealizedGain!==null?`${a.unrealizedGain>=0?'+':''}${fmtM(a.unrealizedGain)}`:'—'}</td>
                  <td style={{fontWeight:500}}>{a.equityMultiple?`${a.equityMultiple}x`:'—'}</td>
                  <td>{a.yoc?`${a.yoc}%`:'—'}</td>
                  <td style={{fontWeight:600,color:a.projIRR?(a.projIRR>=15?'var(--g600)':a.projIRR>=12?'var(--amber)':'var(--red)'):'var(--gray400)'}}>
                    {a.projIRR?`${a.projIRR}%`:<span style={{fontSize:10,color:'var(--gray400)'}}>Need data</span>}
                  </td>
                  <td style={{color:a.yearsToExit!==null&&a.yearsToExit<=0?'var(--red)':a.yearsToExit!==null&&a.yearsToExit<=2?'var(--amber)':'var(--gray700)'}}>{a.target_exit_year||'—'}</td>
                  <td style={{color:a.yearsToExit!==null&&a.yearsToExit<0?'var(--red)':a.yearsToExit!==null&&a.yearsToExit<=2?'var(--amber)':'var(--gray700)',fontWeight:a.yearsToExit!==null&&a.yearsToExit<=2?500:400}}>
                    {a.yearsToExit!==null?(a.yearsToExit<0?`${Math.abs(a.yearsToExit)}y past`:`${a.yearsToExit}y`):'—'}
                  </td>
                  <td>{fmtM(a.projected_exit_value)}</td>
                  <td><button className="card-action" onClick={()=>setEditModal(a)}>Edit ✎</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{fontSize:11,color:'var(--gray500)',marginTop:8}}>
          "Proj. IRR" is auto-calculated. "Need data" means one or more of: Acquisition Price, Projected Exit Value, or Year Acquired is missing. Click Edit to fill in.
        </div>
      </div>

      {/* Pipeline IRR */}
      {activeDeals.filter(d=>d.projected_irr).length>0&&(
        <div className="card">
          <div className="card-header"><span className="card-title">Pipeline projected returns</span><Link to="/pipeline"><button className="card-action">View pipeline →</button></Link></div>
          <table className="data-table">
            <thead><tr><th>Deal</th><th>Market</th><th>Stage</th><th>Ask Price</th><th>Cap Rate</th><th>Proj. IRR</th><th>Eq. Multiple</th><th>Hold</th></tr></thead>
            <tbody>
              {activeDeals.filter(d=>d.projected_irr).map(d=>(
                <tr key={d.id}>
                  <td><Link to={`/deals/${d.id}`} style={{color:'var(--g600)',textDecoration:'none',fontWeight:500}}>{d.name}</Link></td>
                  <td>{d.market||'—'}</td>
                  <td style={{fontSize:11}}>{d.stage?.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</td>
                  <td>{fmtM(d.ask_price)}</td>
                  <td>{d.cap_rate?`${d.cap_rate}%`:'—'}</td>
                  <td style={{fontWeight:600,color:parseFloat(d.projected_irr)>=15?'var(--g600)':parseFloat(d.projected_irr)>=12?'var(--amber)':'var(--red)'}}>{d.projected_irr?`${d.projected_irr}%`:'—'}</td>
                  <td>{d.equity_multiple?`${d.equity_multiple}x`:'—'}</td>
                  <td>{d.hold_period?`${d.hold_period}y`:'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editModal&&<AssetIRREditModal asset={editModal} onClose={()=>setEditModal(null)} onSave={handleSaveAsset}/>}
    </div>
  )
}
