import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ScatterChart, Scatter, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAssets, useDeals } from '../hooks/useData'
import { Link } from 'react-router-dom'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'
const COLORS = ['#2a6e47','#4a9e6e','#163d27','#c9a96e','#a8d5bc','#0288d1','#7b1fa2']

function calcSimpleIRR(acqPrice, exitValue, holdYears, annualCF = 0) {
  if (!acqPrice || !exitValue || !holdYears) return null
  let irr = 0.10
  for (let i = 0; i < 100; i++) {
    let npv = -acqPrice
    for (let y = 1; y <= holdYears; y++) npv += annualCF / Math.pow(1 + irr, y)
    npv += exitValue / Math.pow(1 + irr, holdYears)
    if (Math.abs(npv) < 100) break
    irr += npv > 0 ? 0.005 : -0.005
    if (irr < -0.5 || irr > 5) break
  }
  return (irr * 100).toFixed(1)
}

export default function IRRDashboard() {
  const { assets } = useAssets()
  const { deals } = useDeals()
  const [budgets, setBudgets] = useState([])

  useEffect(() => {
    supabase.from('asset_budgets').select('*').then(({ data }) => setBudgets(data || []))
  }, [])

  const currentYear = new Date().getFullYear()
  const activeDeals = deals.filter(d => ['prospecting','loi','due_diligence','closing'].includes(d.stage))

  // Build IRR data for each asset
  const assetIRR = assets.map(a => {
    const holdYears = a.year_acquired ? currentYear - a.year_acquired : null
    const annualDS = a.debt_service_annual || 0
    const annualCF = (a.noi_trailing || 0) - annualDS

    // Projected IRR to target exit
    const projIRR = a.projected_exit_value && a.acquisition_price && a.target_exit_year
      ? calcSimpleIRR(a.acquisition_price, a.projected_exit_value, a.target_exit_year - (a.year_acquired || currentYear - 5), annualCF)
      : null

    // Realized IRR (disposed)
    const realizedIRR = a.actual_irr || null

    // Unlevered current return
    const yoc = a.noi_trailing && a.acquisition_price ? ((a.noi_trailing / a.acquisition_price) * 100).toFixed(1) : null

    // Years to target exit
    const yearsToExit = a.target_exit_year ? a.target_exit_year - currentYear : null

    return {
      id: a.id,
      name: a.name,
      market: a.market,
      status: a.status,
      acquisition_price: a.acquisition_price,
      current_value: a.current_value,
      projected_exit_value: a.projected_exit_value,
      year_acquired: a.year_acquired,
      target_exit_year: a.target_exit_year,
      hold_period_years: a.hold_period_years,
      holdYears,
      projIRR: projIRR ? parseFloat(projIRR) : null,
      realizedIRR: realizedIRR ? parseFloat(realizedIRR) : null,
      yoc: yoc ? parseFloat(yoc) : null,
      yearsToExit,
      annualCF,
      unrealizedGain: a.current_value && a.acquisition_price ? a.current_value - a.acquisition_price : null,
      equityMultiple: a.current_value && a.acquisition_price ? (a.current_value / a.acquisition_price).toFixed(2) : null,
    }
  })

  // Portfolio averages
  const assetsWithProjIRR = assetIRR.filter(a => a.projIRR)
  const assetsWithRealIRR = assetIRR.filter(a => a.realizedIRR)
  const avgProjIRR = assetsWithProjIRR.length ? (assetsWithProjIRR.reduce((s,a)=>s+a.projIRR,0)/assetsWithProjIRR.length).toFixed(1) : null
  const avgRealIRR = assetsWithRealIRR.length ? (assetsWithRealIRR.reduce((s,a)=>s+a.realizedIRR,0)/assetsWithRealIRR.length).toFixed(1) : null
  const avgPipelineIRR = activeDeals.filter(d=>d.projected_irr).length ? (activeDeals.filter(d=>d.projected_irr).reduce((s,d)=>s+d.projected_irr,0)/activeDeals.filter(d=>d.projected_irr).length).toFixed(1) : null

  // Approaching exit (within 2 years)
  const approachingExit = assetIRR.filter(a => a.yearsToExit !== null && a.yearsToExit >= 0 && a.yearsToExit <= 2)
  const pastExit = assetIRR.filter(a => a.yearsToExit !== null && a.yearsToExit < 0)

  // Chart data
  const irrChartData = assetIRR.filter(a => a.projIRR || a.yoc).map(a => ({
    name: a.name.split(' ').slice(0,2).join(' '),
    projIRR: a.projIRR,
    yoc: a.yoc,
  }))

  const holdTimelineData = assetIRR.filter(a=>a.year_acquired).map(a=>({
    name: a.name.split(' ').slice(0,2).join(' '),
    yearAcquired: a.year_acquired,
    heldYears: a.holdYears || 0,
    targetExit: a.target_exit_year,
    yearsToExit: a.yearsToExit,
  })).sort((a,b)=>a.yearAcquired-b.yearAcquired)

  return (
    <div>
      <div className="page-header">
        <h1>Portfolio IRR & Exit Analysis</h1>
        <p>Projected and realized returns across all assets and pipeline deals</p>
      </div>

      {/* Alerts */}
      {(approachingExit.length > 0 || pastExit.length > 0) && (
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          {pastExit.map(a => (
            <Link key={a.id} to={`/assets/${a.id}`} style={{ textDecoration:'none' }}>
              <div style={{ background:'var(--redL)', border:'1px solid #f5c6c2', borderRadius:8, padding:'8px 14px', fontSize:12, color:'var(--red)' }}>
                ⚠ {a.name} — past target exit year ({a.target_exit_year})
              </div>
            </Link>
          ))}
          {approachingExit.map(a => (
            <Link key={a.id} to={`/assets/${a.id}`} style={{ textDecoration:'none' }}>
              <div style={{ background:'var(--amberL)', border:'1px solid #ffe082', borderRadius:8, padding:'8px 14px', fontSize:12, color:'var(--amber)' }}>
                ⏰ {a.name} — target exit in {a.yearsToExit} year{a.yearsToExit!==1?'s':''}
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Avg. Projected IRR</div><div className="kpi-value">{avgProjIRR?`${avgProjIRR}%`:'—'}</div><div className="kpi-change">Across {assetsWithProjIRR.length} assets</div></div>
        <div className="kpi-card"><div className="kpi-label">Avg. Realized IRR</div><div className="kpi-value">{avgRealIRR?`${avgRealIRR}%`:'—'}</div><div className="kpi-change">Disposed assets</div></div>
        <div className="kpi-card"><div className="kpi-label">Pipeline Avg. IRR</div><div className="kpi-value">{avgPipelineIRR?`${avgPipelineIRR}%`:'—'}</div><div className="kpi-change">{activeDeals.filter(d=>d.projected_irr).length} deals with IRR</div></div>
        <div className="kpi-card"><div className="kpi-label">Approaching Exit</div><div className="kpi-value" style={{ color:approachingExit.length>0?'var(--amber)':'var(--g900)' }}>{approachingExit.length + pastExit.length}</div><div className="kpi-change">{pastExit.length > 0 ? `${pastExit.length} past target` : 'within 2 years'}</div></div>
      </div>

      {/* IRR by asset chart */}
      {irrChartData.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Projected IRR & YOC by asset</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={irrChartData} layout="vertical">
              <XAxis type="number" tick={{ fontSize:10 }} axisLine={false} tickLine={false} unit="%"/>
              <YAxis type="category" dataKey="name" tick={{ fontSize:11 }} axisLine={false} tickLine={false} width={120}/>
              <Tooltip formatter={(v,n)=>[`${v}%`,n]} contentStyle={{ fontSize:11, borderRadius:6 }}/>
              <Bar dataKey="projIRR" fill="var(--g600)" name="Proj. IRR" radius={[0,3,3,0]}/>
              <Bar dataKey="yoc" fill="var(--g200)" name="YOC" radius={[0,3,3,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Asset IRR table */}
      <div className="card">
        <div className="card-header"><span className="card-title">Asset-level return summary</span></div>
        <div style={{ overflowX:'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th>Asset</th><th>Acquired</th><th>Yrs Held</th>
              <th>Acq. Price</th><th>Current Value</th><th>Unrealized Gain</th>
              <th>Equity Multiple</th><th>YOC</th><th>Proj. IRR</th>
              <th>Target Exit</th><th>Yrs to Exit</th><th>Proj. Exit Value</th>
            </tr></thead>
            <tbody>
              {assetIRR.map(a => (
                <tr key={a.id}>
                  <td><Link to={`/assets/${a.id}`} style={{ color:'var(--g600)', textDecoration:'none', fontWeight:500 }}>{a.name}</Link></td>
                  <td>{a.year_acquired||'—'}</td>
                  <td>{a.holdYears!==null?`${a.holdYears}y`:'—'}</td>
                  <td>{fmtM(a.acquisition_price)}</td>
                  <td>{fmtM(a.current_value)}</td>
                  <td style={{ color:a.unrealizedGain>=0?'var(--g600)':'var(--red)', fontWeight:500 }}>
                    {a.unrealizedGain!==null?`${a.unrealizedGain>=0?'+':''}${fmtM(a.unrealizedGain)}`:'—'}
                  </td>
                  <td style={{ fontWeight:500 }}>{a.equityMultiple?`${a.equityMultiple}x`:'—'}</td>
                  <td>{a.yoc?`${a.yoc}%`:'—'}</td>
                  <td style={{ fontWeight:600, color:a.projIRR?(a.projIRR>=15?'var(--g600)':a.projIRR>=12?'var(--amber)':'var(--red)'):'var(--gray500)' }}>{a.projIRR?`${a.projIRR}%`:'—'}</td>
                  <td style={{ color:a.yearsToExit!==null&&a.yearsToExit<=0?'var(--red)':a.yearsToExit!==null&&a.yearsToExit<=2?'var(--amber)':'var(--gray700)' }}>{a.target_exit_year||'—'}</td>
                  <td style={{ color:a.yearsToExit!==null&&a.yearsToExit<0?'var(--red)':a.yearsToExit!==null&&a.yearsToExit<=2?'var(--amber)':'var(--gray700)', fontWeight:a.yearsToExit!==null&&a.yearsToExit<=2?500:400 }}>
                    {a.yearsToExit!==null?(a.yearsToExit<0?`${Math.abs(a.yearsToExit)}y past`:`${a.yearsToExit}y`):'—'}
                  </td>
                  <td>{fmtM(a.projected_exit_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pipeline IRR */}
      {activeDeals.filter(d=>d.projected_irr).length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Pipeline projected returns</span><Link to="/pipeline"><button className="card-action">View pipeline →</button></Link></div>
          <table className="data-table">
            <thead><tr><th>Deal</th><th>Market</th><th>Stage</th><th>Ask Price</th><th>Cap Rate</th><th>Proj. IRR</th><th>Eq. Multiple</th><th>Hold</th></tr></thead>
            <tbody>
              {activeDeals.filter(d=>d.projected_irr).map(d=>(
                <tr key={d.id}>
                  <td><Link to={`/deals/${d.id}`} style={{ color:'var(--g600)', textDecoration:'none', fontWeight:500 }}>{d.name}</Link></td>
                  <td>{d.market||'—'}</td>
                  <td style={{ fontSize:11 }}>{d.stage?.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</td>
                  <td>{fmtM(d.ask_price)}</td>
                  <td>{d.cap_rate?`${d.cap_rate}%`:'—'}</td>
                  <td style={{ fontWeight:600, color:d.projected_irr>=15?'var(--g600)':d.projected_irr>=12?'var(--amber)':'var(--red)' }}>{d.projected_irr?`${d.projected_irr}%`:'—'}</td>
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
