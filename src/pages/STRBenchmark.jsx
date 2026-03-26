import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, LineChart, Line, Legend } from 'recharts'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const idxColor = (v) => !v ? 'var(--gray300)' : v >= 105 ? 'var(--g600)' : v >= 95 ? 'var(--amber)' : 'var(--red)'
const idxBg = (v) => !v ? 'var(--gray50)' : v >= 105 ? 'var(--g50)' : v >= 95 ? 'var(--amberL)' : 'var(--redL)'

export default function STRBenchmark() {
  const { assets } = useAssets()
  const [compData, setCompData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState('revpar_index')
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))

  useEffect(() => {
    supabase.from('comp_data').select('*, assets(name, market, type)').order('period_year', { ascending: false }).order('period_month', { ascending: false }).then(({ data }) => {
      setCompData(data || [])
      setLoading(false)
    })
  }, [])

  // Latest data per asset
  const latestByAsset = {}
  for (const d of compData) {
    if (!latestByAsset[d.asset_id]) latestByAsset[d.asset_id] = d
  }

  // Cross-portfolio comparison data
  const portfolioData = assets.map(a => {
    const latest = latestByAsset[a.id]
    return {
      id: a.id,
      name: a.name,
      shortName: a.name.split(' ').slice(0,2).join(' '),
      market: a.market,
      rgi: latest?.revpar_index ? parseFloat(latest.revpar_index) : null,
      mpi: latest?.occ_index ? parseFloat(latest.occ_index) : null,
      ari: latest?.adr_index ? parseFloat(latest.adr_index) : null,
      myRevpar: latest?.my_revpar ? parseFloat(latest.my_revpar) : null,
      myOcc: latest?.my_occupancy ? parseFloat(latest.my_occupancy) : null,
      myAdr: latest?.my_adr ? parseFloat(latest.my_adr) : null,
      csRevpar: latest?.comp_set_revpar ? parseFloat(latest.comp_set_revpar) : null,
      period: latest ? `${MONTHS[latest.period_month-1]} ${latest.period_year}` : null,
    }
  })

  const withData = portfolioData.filter(a => a.rgi || a.mpi || a.ari)
  const withoutData = portfolioData.filter(a => !a.rgi && !a.mpi && !a.ari)

  // Sorted by selected metric
  const sorted = [...withData].sort((a, b) => (b[selectedMetric === 'revpar_index' ? 'rgi' : selectedMetric === 'occ_index' ? 'mpi' : 'ari'] || 0) - (a[selectedMetric === 'revpar_index' ? 'rgi' : selectedMetric === 'occ_index' ? 'mpi' : 'ari'] || 0))

  // Portfolio averages
  const avgRGI = withData.filter(a=>a.rgi).length ? (withData.filter(a=>a.rgi).reduce((s,a)=>s+a.rgi,0)/withData.filter(a=>a.rgi).length).toFixed(1) : null
  const avgMPI = withData.filter(a=>a.mpi).length ? (withData.filter(a=>a.mpi).reduce((s,a)=>s+a.mpi,0)/withData.filter(a=>a.mpi).length).toFixed(1) : null
  const avgARI = withData.filter(a=>a.ari).length ? (withData.filter(a=>a.ari).reduce((s,a)=>s+a.ari,0)/withData.filter(a=>a.ari).length).toFixed(1) : null

  const belowParity = withData.filter(a => a.rgi && a.rgi < 95)
  const aboveParity = withData.filter(a => a.rgi && a.rgi >= 105)

  // Trend data (last 6 months cross-portfolio)
  const trendMonths = [...new Set(compData.map(d=>`${d.period_year}-${String(d.period_month).padStart(2,'0')}`))].sort().slice(-6)
  const trendData = trendMonths.map(ym => {
    const [y, m] = ym.split('-')
    const label = `${MONTHS[parseInt(m)-1].slice(0,3)} ${String(y).slice(2)}`
    const row = { label }
    for (const a of assets) {
      const d = compData.find(c => c.asset_id === a.id && String(c.period_year) === y && String(c.period_month) === String(parseInt(m)))
      row[a.name.split(' ').slice(0,2).join(' ')] = d?.revpar_index ? parseFloat(d.revpar_index) : null
    }
    return row
  })

  const COLORS = ['#2a6e47','#c9a96e','#1565c0','#7b1fa2','#e65100','#0288d1','#2e7d32']

  if (loading) return <div className="loading">Loading benchmark data...</div>

  return (
    <div>
      <div className="page-header">
        <h1>STR Portfolio Benchmarking</h1>
        <p>All assets side by side — latest STR indices and competitive positioning</p>
      </div>

      {belowParity.length > 0 && (
        <div style={{ background:'var(--redL)', border:'1px solid #f5c6c2', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ fontSize:12.5, fontWeight:500, color:'var(--red)', marginBottom:4 }}>⚠ Below fair share ({belowParity.length} asset{belowParity.length>1?'s':''})</div>
          {belowParity.map(a=><div key={a.id} style={{ fontSize:12, color:'var(--red)' }}><strong>{a.name}</strong> — RGI {a.rgi?.toFixed(1)} ({a.period})</div>)}
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Portfolio Avg. RGI</div><div className="kpi-value" style={{ color:avgRGI?(parseFloat(avgRGI)>=105?'var(--g600)':parseFloat(avgRGI)>=95?'var(--amber)':'var(--red)'):'var(--gray300)' }}>{avgRGI||'—'}</div><div className="kpi-change">{withData.filter(a=>a.rgi).length} assets with data</div></div>
        <div className="kpi-card"><div className="kpi-label">Portfolio Avg. MPI</div><div className="kpi-value">{avgMPI||'—'}</div><div className="kpi-change">Occupancy index</div></div>
        <div className="kpi-card"><div className="kpi-label">Portfolio Avg. ARI</div><div className="kpi-value">{avgARI||'—'}</div><div className="kpi-change">ADR index</div></div>
        <div className="kpi-card"><div className="kpi-label">Above Fair Share</div><div className="kpi-value" style={{ color:'var(--g600)' }}>{aboveParity.length}</div><div className="kpi-change">RGI ≥ 105</div></div>
      </div>

      {/* Metric selector */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[['revpar_index','RGI (RevPAR Index)'],['occ_index','MPI (Occupancy Index)'],['adr_index','ARI (ADR Index)']].map(([v,l])=>(
          <button key={v} className={`filter-tab${selectedMetric===v?' active':''}`} onClick={()=>setSelectedMetric(v)}>{l}</button>
        ))}
      </div>

      {withData.length === 0 ? (
        <div className="empty-state"><div className="empty-state-icon">📊</div><div className="empty-state-title">No STR data entered yet</div><div className="empty-state-desc">Enter comp data on the Competitive Intel page to see cross-portfolio benchmarking.</div></div>
      ) : (
        <>
          {/* Ranked bar chart */}
          <div className="card">
            <div className="card-header"><span className="card-title">Portfolio ranking by {selectedMetric==='revpar_index'?'RGI':selectedMetric==='occ_index'?'MPI':'ARI'}</span></div>
            <div style={{ marginBottom:8 }}>
              {sorted.map((a, i) => {
                const val = selectedMetric==='revpar_index'?a.rgi:selectedMetric==='occ_index'?a.mpi:a.ari
                const maxVal = Math.max(...sorted.map(x => selectedMetric==='revpar_index'?x.rgi:selectedMetric==='occ_index'?x.mpi:x.ari).filter(Boolean))
                return (
                  <div key={a.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid var(--gray100)' }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background:i===0?'var(--g100)':'var(--gray100)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:600, color:i===0?'var(--g700)':'var(--gray500)', flexShrink:0 }}>#{i+1}</div>
                    <div style={{ width:140, fontSize:12, fontWeight:500, color:'var(--g900)', flexShrink:0 }}>{a.shortName}</div>
                    <div style={{ flex:1, height:8, background:'var(--gray100)', borderRadius:4 }}>
                      <div style={{ height:'100%', width:val?`${(val/maxVal)*100}%`:'0%', background:idxColor(val), borderRadius:4, transition:'width .4s ease' }}/>
                    </div>
                    <div style={{ width:60, textAlign:'right', fontSize:14, fontWeight:700, color:idxColor(val) }}>{val?.toFixed(1)||'—'}</div>
                    <div style={{ width:80, fontSize:9, padding:'2px 7px', borderRadius:10, background:idxBg(val), color:idxColor(val), fontWeight:500, textAlign:'center' }}>
                      {val?(val>=105?'Above':val>=95?'Parity':'Below'):'No data'}
                    </div>
                    <div style={{ fontSize:10, color:'var(--gray400)', width:60, textAlign:'right' }}>{a.period}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop:8, display:'flex', gap:12, fontSize:10, color:'var(--gray500)' }}>
              <span><span style={{ color:'var(--g600)' }}>●</span> ≥105 = Above fair share</span>
              <span><span style={{ color:'var(--amber)' }}>●</span> 95–105 = At parity</span>
              <span><span style={{ color:'var(--red)' }}>●</span> &lt;95 = Below fair share</span>
            </div>
          </div>

          {/* Full metrics table */}
          <div className="card">
            <div className="card-header"><span className="card-title">Full index comparison — latest available data</span></div>
            <div style={{ overflowX:'auto' }}>
              <table className="data-table">
                <thead><tr>
                  <th>Asset</th><th>Market</th><th>Period</th>
                  <th>My RevPAR</th><th>Comp RevPAR</th>
                  <th>RGI</th><th>MPI</th><th>ARI</th>
                  <th>My Occ.</th><th>My ADR</th>
                </tr></thead>
                <tbody>
                  {[...withData].sort((a,b)=>(b.rgi||0)-(a.rgi||0)).map(a=>(
                    <tr key={a.id}>
                      <td><strong>{a.name}</strong></td>
                      <td style={{ color:'var(--gray500)' }}>{a.market}</td>
                      <td style={{ fontSize:11, color:'var(--gray500)' }}>{a.period||'—'}</td>
                      <td>{a.myRevpar?`$${a.myRevpar.toFixed(0)}`:'—'}</td>
                      <td>{a.csRevpar?`$${a.csRevpar.toFixed(0)}`:'—'}</td>
                      <td style={{ fontWeight:700, color:idxColor(a.rgi) }}>{a.rgi?.toFixed(1)||'—'}</td>
                      <td style={{ fontWeight:600, color:idxColor(a.mpi) }}>{a.mpi?.toFixed(1)||'—'}</td>
                      <td style={{ fontWeight:600, color:idxColor(a.ari) }}>{a.ari?.toFixed(1)||'—'}</td>
                      <td>{a.myOcc?`${a.myOcc.toFixed(1)}%`:'—'}</td>
                      <td>{a.myAdr?`$${a.myAdr.toFixed(0)}`:'—'}</td>
                    </tr>
                  ))}
                  {withoutData.map(a=>(
                    <tr key={a.id} style={{ opacity:0.4 }}>
                      <td><strong>{a.name}</strong></td>
                      <td style={{ color:'var(--gray500)' }}>{a.market}</td>
                      <td colSpan={8} style={{ fontSize:11, color:'var(--gray400)', fontStyle:'italic' }}>No STR data — enter via Competitive Intel</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RGI trend across portfolio */}
          {trendData.length >= 2 && withData.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">RGI trend — all assets (last 6 months)</span></div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trendData}>
                  <XAxis dataKey="label" tick={{ fontSize:10, fill:'var(--gray500)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:10, fill:'var(--gray500)' }} axisLine={false} tickLine={false} domain={[80,135]}/>
                  <Tooltip contentStyle={{ fontSize:11, borderRadius:6 }}/>
                  <ReferenceLine y={100} stroke="#c9a96e" strokeDasharray="4 4" label={{ value:'Fair share', fontSize:9, fill:'#c9a96e' }}/>
                  <Legend wrapperStyle={{ fontSize:11 }}/>
                  {withData.map((a, i) => (
                    <Line key={a.id} type="monotone" dataKey={a.shortName} stroke={COLORS[i%COLORS.length]} strokeWidth={2} dot={{ r:3 }} connectNulls/>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
