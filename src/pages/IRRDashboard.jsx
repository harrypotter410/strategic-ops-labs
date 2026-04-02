import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
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

export default function IRRDashboard() {
  const { assets } = useAssets()
  const { deals } = useDeals()
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
              ✏️ <strong>To update IRR inputs</strong>: Click any asset name to open its detail page, then go to the "Exit & Returns" tab. Fill in Year Acquired, Trailing NOI, Debt Service, Target Exit Year, and Projected Exit Value.
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

      {/* Full asset IRR table — read-only, link to detail page to edit */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Asset return summary</span>
          <span style={{fontSize:11,color:'var(--gray500)'}}>Open an asset to update IRR inputs on its detail page</span>
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
              <th>Proj. Exit Value</th>
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
                    {a.projIRR?`${a.projIRR}%`:<Link to={`/assets/${a.id}`} style={{fontSize:10,color:'var(--g600)',textDecoration:'none'}}>Add data →</Link>}
                  </td>
                  <td style={{color:a.yearsToExit!==null&&a.yearsToExit<=0?'var(--red)':a.yearsToExit!==null&&a.yearsToExit<=2?'var(--amber)':'var(--gray700)'}}>{a.target_exit_year||'—'}</td>
                  <td style={{color:a.yearsToExit!==null&&a.yearsToExit<0?'var(--red)':a.yearsToExit!==null&&a.yearsToExit<=2?'var(--amber)':'var(--gray700)',fontWeight:a.yearsToExit!==null&&a.yearsToExit<=2?500:400}}>
                    {a.yearsToExit!==null?(a.yearsToExit<0?`${Math.abs(a.yearsToExit)}y past`:`${a.yearsToExit}y`):'—'}
                  </td>
                  <td>{fmtM(a.projected_exit_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{fontSize:11,color:'var(--gray500)',marginTop:8}}>
          "Proj. IRR" is auto-calculated. Click "Add data →" or the asset name to open its detail page and fill in exit assumptions.
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

    </div>
  )
}
