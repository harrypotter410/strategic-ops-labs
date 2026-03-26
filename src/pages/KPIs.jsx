import { useState, useEffect } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

const fmtDollar = (n) => n ? `$${parseFloat(n).toFixed(0)}` : '—'
const fmtPct = (n) => n ? `${parseFloat(n).toFixed(1)}%` : '—'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Reusable searchable asset selector
function AssetSelector({ assets, selected, onSelect, label = 'Select property' }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const sel = assets.find(a => a.id === selected)
  const filtered = assets.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.market?.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const close = (e) => { if (!e.target.closest('.asset-sel')) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="asset-sel" style={{ position: 'relative', minWidth: 260 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', border: '1px solid var(--gray200)', borderRadius: 8, cursor: 'pointer', background: 'var(--white)', fontSize: 13, color: 'var(--g900)', fontWeight: 500 }}
        onClick={() => setOpen(o => !o)}
      >
        {sel ? (
          <div style={{ flex: 1 }}>
            <div>{sel.name}</div>
            <div style={{ fontSize: 10, color: 'var(--gray500)', fontWeight: 400 }}>{sel.market} · {sel.rooms} rooms</div>
          </div>
        ) : (
          <span style={{ flex: 1, color: 'var(--gray500)', fontWeight: 400 }}>{label}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, width: '100%', minWidth: 280, background: 'var(--white)', border: '1px solid var(--gray200)', borderRadius: 10, zIndex: 300, boxShadow: 'var(--shadow-md)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--gray100)' }}>
            <input className="form-input" style={{ padding: '5px 10px', fontSize: 12 }} placeholder="Search properties..." value={search} onChange={e => setSearch(e.target.value)} onClick={e => e.stopPropagation()} autoFocus />
          </div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {filtered.length === 0 && <div style={{ padding: 12, fontSize: 12, color: 'var(--gray500)', textAlign: 'center' }}>No properties found</div>}
            {filtered.map(a => (
              <div
                key={a.id}
                style={{ padding: '10px 14px', cursor: 'pointer', background: a.id === selected ? 'var(--g50)' : 'transparent', borderBottom: '1px solid var(--gray100)', transition: 'background .1s' }}
                onClick={() => { onSelect(a.id); setOpen(false); setSearch('') }}
                onMouseEnter={e => { if (a.id !== selected) e.currentTarget.style.background = 'var(--gray50)' }}
                onMouseLeave={e => { if (a.id !== selected) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: a.id === selected ? 'var(--g700)' : 'var(--g900)' }}>{a.name}</div>
                <div style={{ fontSize: 10, color: 'var(--gray500)' }}>{a.market} · {a.rooms} rooms · {a.type}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '6px 14px', borderTop: '1px solid var(--gray100)', fontSize: 10, color: 'var(--gray500)' }}>{filtered.length} of {assets.length} properties</div>
        </div>
      )}
    </div>
  )
}

function KPICard({ label, value, sub, color, tooltip }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color: color || 'var(--g900)', fontSize: 20 }}>{value}</div>
      {sub && <div className="kpi-change">{sub}</div>}
    </div>
  )
}

export default function KPIs() {
  const { assets } = useAssets()
  const [selectedId, setSelectedId] = useState(null)
  const [compId, setCompId] = useState(null)
  const [financials, setFinancials] = useState([])
  const [compFinancials, setCompFinancials] = useState([])
  const [compData, setCompData] = useState([])
  const [loading, setLoading] = useState(false)

  // Auto-select first asset
  useEffect(() => { if (assets.length > 0 && !selectedId) setSelectedId(assets[0].id) }, [assets])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    Promise.all([
      supabase.from('financials').select('*').eq('asset_id', selectedId).order('period_year').order('period_month'),
      supabase.from('comp_data').select('*').eq('asset_id', selectedId).order('period_year').order('period_month'),
    ]).then(([fins, comp]) => {
      setFinancials(fins.data || [])
      setCompData(comp.data || [])
      setLoading(false)
    })
  }, [selectedId])

  useEffect(() => {
    if (!compId) return
    supabase.from('financials').select('*').eq('asset_id', compId).order('period_year').order('period_month').then(({ data }) => setCompFinancials(data || []))
  }, [compId])

  const sel = assets.find(a => a.id === selectedId)
  const comp = assets.find(a => a.id === compId)

  // Latest period
  const latest = [...financials].sort((a,b) => a.period_year!==b.period_year?b.period_year-a.period_year:b.period_month-a.period_month)[0]
  const latestComp = [...compData].sort((a,b) => a.period_year!==b.period_year?b.period_year-a.period_year:b.period_month-a.period_month)[0]

  // T12 aggregates
  const t12 = financials.slice(-12)
  const t12Revenue = t12.reduce((s,f)=>s+(f.revenue||0),0)
  const t12NOI = t12.reduce((s,f)=>s+(f.noi||0),0)
  const avgOcc = t12.filter(f=>f.occupancy).length ? (t12.filter(f=>f.occupancy).reduce((s,f)=>s+parseFloat(f.occupancy),0)/t12.filter(f=>f.occupancy).length).toFixed(1) : (sel?.noi_trailing ? null : null)
  const avgADR = t12.filter(f=>f.adr).length ? (t12.filter(f=>f.adr).reduce((s,f)=>s+parseFloat(f.adr),0)/t12.filter(f=>f.adr).length).toFixed(0) : null
  const avgRevPAR = t12.filter(f=>f.revpar).length ? (t12.filter(f=>f.revpar).reduce((s,f)=>s+parseFloat(f.revpar),0)/t12.filter(f=>f.revpar).length).toFixed(0) : null
  const noiMargin = t12Revenue && t12NOI ? ((t12NOI/t12Revenue)*100).toFixed(1) : null

  // YOC metrics from asset
  const yoc = sel?.noi_trailing && sel?.acquisition_price ? ((sel.noi_trailing/sel.acquisition_price)*100).toFixed(2) : null
  const levYoc = sel?.noi_trailing && sel?.debt_service_annual && sel?.acquisition_price ? (((sel.noi_trailing-sel.debt_service_annual)/sel.acquisition_price)*100).toFixed(2) : null

  // RevPAR trend chart
  const revparTrend = financials.slice(-12).map(f => ({
    label: `${MONTHS[f.period_month-1].slice(0,3)} ${String(f.period_year).slice(2)}`,
    revpar: f.revpar ? parseFloat(f.revpar) : null,
    adr: f.adr ? parseFloat(f.adr) : null,
    occupancy: f.occupancy ? parseFloat(f.occupancy) : null,
  }))

  // Radar chart data
  const radarData = [
    { metric: 'Occupancy', A: latest?.occupancy ? Math.min(parseFloat(latest.occupancy)/100*100,100) : 0 },
    { metric: 'ADR Index', A: latestComp?.adr_index ? Math.min(parseFloat(latestComp.adr_index)/130*100,100) : 0 },
    { metric: 'RevPAR Index', A: latestComp?.revpar_index ? Math.min(parseFloat(latestComp.revpar_index)/130*100,100) : 0 },
    { metric: 'NOI Margin', A: noiMargin ? Math.min(parseFloat(noiMargin)/30*100,100) : (sel?.noi_trailing && t12Revenue ? Math.min((sel.noi_trailing/t12Revenue)*100/30*100,100) : 0) },
    { metric: 'YOC', A: yoc ? Math.min(parseFloat(yoc)/12*100,100) : 0 },
  ]

  return (
    <div>
      <div className="page-header">
        <h1>Property KPIs</h1>
        <p>Select any property to drill into operating performance — supports 20+ assets</p>
      </div>

      {/* Property selector — prominent at top */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Primary Property</div>
            <AssetSelector assets={assets} selected={selectedId} onSelect={(id) => { setSelectedId(id); if (compId === id) setCompId(null) }} label="Select primary property..." />
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6 }}>Compare With (optional)</div>
            <AssetSelector assets={assets.filter(a => a.id !== selectedId)} selected={compId} onSelect={setCompId} label="Select comparison property..." />
          </div>
          {compId && (
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 20 }} onClick={() => setCompId(null)}>Clear comparison</button>
          )}
        </div>
      </div>

      {!selectedId ? (
        <div className="empty-state"><div className="empty-state-title">Select a property above to see KPIs</div></div>
      ) : loading ? (
        <div className="loading">Loading KPIs...</div>
      ) : (
        <>
          {/* Asset header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20, padding: '16px 20px', background: 'var(--g900)', borderRadius: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{sel?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--g200)' }}>{sel?.market} · {sel?.rooms} rooms · {sel?.type?.charAt(0).toUpperCase()+sel?.type?.slice(1)}</div>
            </div>
            {latestComp && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--g400)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>Latest STR data</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  {[['RGI', latestComp.revpar_index], ['MPI', latestComp.occ_index], ['ARI', latestComp.adr_index]].map(([l,v]) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--g400)' }}>{l}</div>
                      <div style={{ fontSize: 16, fontWeight: 600, color: v&&parseFloat(v)>=105?'#a8d5bc':v&&parseFloat(v)>=95?'#ffe082':'#f5c6c2' }}>{v?parseFloat(v).toFixed(1):'—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* KPI cards */}
          <div className="kpi-grid">
            <KPICard label="T12 NOI" value={sel?.noi_trailing?`$${(sel.noi_trailing/1e6).toFixed(1)}M`:'—'} sub={noiMargin?`${noiMargin}% margin`:''} />
            <KPICard label="YOC" value={yoc?`${yoc}%`:'—'} sub="Yield on cost" />
            <KPICard label="Levered YOC" value={levYoc?`${levYoc}%`:'—'} sub="After debt service" />
            <KPICard label="Unrealized Gain" value={sel?.current_value&&sel?.acquisition_price?`${sel.current_value>=sel.acquisition_price?'+':''}$${((sel.current_value-sel.acquisition_price)/1e6).toFixed(1)}M`:'—'} color={sel?.current_value>=sel?.acquisition_price?'var(--g600)':'var(--red)'} sub={sel?.current_value&&sel?.acquisition_price?`${(((sel.current_value-sel.acquisition_price)/sel.acquisition_price)*100).toFixed(1)}% vs cost`:''}/>
          </div>

          {financials.length > 0 && (
            <div className="kpi-grid">
              <KPICard label="Avg. Occupancy" value={avgOcc?`${avgOcc}%`:'—'} sub="T12" />
              <KPICard label="Avg. ADR" value={avgADR?`$${avgADR}`:'—'} sub="T12" />
              <KPICard label="Avg. RevPAR" value={avgRevPAR?`$${avgRevPAR}`:'—'} sub="T12" />
              <KPICard label="NOI Margin" value={noiMargin?`${noiMargin}%`:'—'} sub="T12 NOI ÷ Revenue" />
            </div>
          )}

          <div className="grid-2">
            {/* Radar chart */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header"><span className="card-title">Performance radar</span></div>
              {radarData.some(d => d.A > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--gray100)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--gray500)' }} />
                    <Radar name={sel?.name} dataKey="A" stroke="var(--g600)" fill="var(--g600)" fillOpacity={0.2} strokeWidth={2} />
                    {compId && compFinancials.length > 0 && <Radar name={comp?.name} dataKey="B" stroke="var(--amber)" fill="var(--amber)" fillOpacity={0.15} strokeWidth={2} />}
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--gray500)', textAlign: 'center', padding: '40px 20px' }}>
                  Enter P&L data and STR comps to populate the radar chart.
                </div>
              )}
            </div>

            {/* RevPAR/ADR trend */}
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header"><span className="card-title">RevPAR & ADR trend</span></div>
              {revparTrend.some(d => d.revpar) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={revparTrend}>
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--gray500)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--gray500)' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v, n) => [`$${v}`, n]} contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                    <Bar dataKey="revpar" fill="var(--g600)" name="RevPAR" radius={[2,2,0,0]} />
                    <Bar dataKey="adr" fill="var(--g200)" name="ADR" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--gray500)', textAlign: 'center', padding: '40px 20px' }}>
                  No monthly financials entered yet.<br/>Use "+ P&L" on the Asset Tracker to add data.
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
                  <th>Metric</th>
                  <th>{sel?.name?.split(' ').slice(0,2).join(' ')}</th>
                  <th>{comp?.name?.split(' ').slice(0,2).join(' ')}</th>
                  <th>Difference</th>
                </tr></thead>
                <tbody>
                  {[
                    ['T12 NOI', sel?.noi_trailing, comp?.noi_trailing, v => `$${(v/1e6).toFixed(1)}M`],
                    ['YOC', sel?.noi_trailing&&sel?.acquisition_price?((sel.noi_trailing/sel.acquisition_price)*100):null, comp?.noi_trailing&&comp?.acquisition_price?((comp.noi_trailing/comp.acquisition_price)*100):null, v => `${v.toFixed(2)}%`],
                    ['Rooms', sel?.rooms, comp?.rooms, v => v.toLocaleString()],
                    ['Acquisition Price', sel?.acquisition_price, comp?.acquisition_price, v => `$${(v/1e6).toFixed(1)}M`],
                    ['Current Value', sel?.current_value, comp?.current_value, v => `$${(v/1e6).toFixed(1)}M`],
                    ['Unrealized Gain', sel?.current_value&&sel?.acquisition_price?sel.current_value-sel.acquisition_price:null, comp?.current_value&&comp?.acquisition_price?comp.current_value-comp.acquisition_price:null, v => `${v>=0?'+':''}$${(v/1e6).toFixed(1)}M`],
                  ].map(([label, aVal, bVal, format]) => {
                    const diff = aVal !== null && bVal !== null ? aVal - bVal : null
                    return (
                      <tr key={label}>
                        <td style={{ color: 'var(--gray500)', fontSize: 12 }}>{label}</td>
                        <td style={{ fontWeight: 500, color: 'var(--g900)' }}>{aVal !== null && aVal !== undefined ? format(aVal) : '—'}</td>
                        <td style={{ fontWeight: 500, color: 'var(--g900)' }}>{bVal !== null && bVal !== undefined ? format(bVal) : '—'}</td>
                        <td style={{ color: diff > 0 ? 'var(--g600)' : diff < 0 ? 'var(--red)' : 'var(--gray500)', fontWeight: 500 }}>
                          {diff !== null ? `${diff >= 0 ? '+' : ''}${format(diff)}` : '—'}
                        </td>
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
