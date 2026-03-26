import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(2)}M` : '—'
const fmtPct = (n) => n ? `${parseFloat(n).toFixed(1)}%` : '—'
const currentYear = new Date().getFullYear()

// RAG color for variance
const varColor = (actual, budget) => {
  if (!actual || !budget) return 'var(--gray500)'
  const pct = ((actual - budget) / budget) * 100
  if (pct >= 0) return 'var(--g600)'
  if (pct >= -5) return 'var(--amber)'
  return 'var(--red)'
}
const varBg = (actual, budget) => {
  if (!actual || !budget) return 'var(--gray50)'
  const pct = ((actual - budget) / budget) * 100
  if (pct >= 0) return 'var(--g50)'
  if (pct >= -5) return 'var(--amberL)'
  return 'var(--redL)'
}

// Searchable asset selector
function AssetSelector({ assets, selected, onSelect }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const sel = assets.find(a => a.id === selected)
  const filtered = assets.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position:'relative', minWidth:240 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', border:'1px solid var(--gray200)', borderRadius:8, cursor:'pointer', background:'var(--white)', fontSize:13, fontWeight:500, color:'var(--g900)' }} onClick={()=>setOpen(o=>!o)}>
        <span style={{ flex:1 }}>{sel?sel.name:'Select asset...'}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--white)', border:'1px solid var(--gray200)', borderRadius:10, zIndex:200, boxShadow:'var(--shadow-md)', overflow:'hidden' }}>
          <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--gray100)' }}>
            <input className="form-input" style={{ padding:'5px 10px', fontSize:12 }} placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} onClick={e=>e.stopPropagation()} autoFocus/>
          </div>
          <div style={{ maxHeight:220, overflowY:'auto' }}>
            {assets.filter(a=>!search||a.name.toLowerCase().includes(search.toLowerCase())).map(a=>(
              <div key={a.id} style={{ padding:'9px 14px', cursor:'pointer', fontSize:12.5, color:a.id===selected?'var(--g700)':'var(--gray700)', background:a.id===selected?'var(--g50)':'transparent', borderBottom:'1px solid var(--gray100)' }}
                onClick={()=>{onSelect(a.id);setOpen(false);setSearch('')}}>
                <div style={{ fontWeight:500 }}>{a.name}</div>
                <div style={{ fontSize:10, color:'var(--gray500)' }}>{a.market}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BudgetModal({ assetId, year, existing, onClose, onSave }) {
  const [form, setForm] = useState(existing ? { ...existing } : { budget_year:year, budget_revenue:'', budget_noi:'', budget_occupancy:'', budget_adr:'', budget_revpar:'', budget_gop:'', budget_capex:'' })
  const [loading, setLoading] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async () => {
    setLoading(true)
    await onSave({ asset_id:assetId, ...form, budget_year:parseInt(form.budget_year), budget_revenue:form.budget_revenue?parseFloat(form.budget_revenue):null, budget_noi:form.budget_noi?parseFloat(form.budget_noi):null, budget_gop:form.budget_gop?parseFloat(form.budget_gop):null, budget_occupancy:form.budget_occupancy?parseFloat(form.budget_occupancy):null, budget_adr:form.budget_adr?parseFloat(form.budget_adr):null, budget_revpar:form.budget_revpar?parseFloat(form.budget_revpar):null, budget_capex:form.budget_capex?parseFloat(form.budget_capex):null })
    setLoading(false); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header"><span className="modal-title">{existing?'Edit Budget':'Set Budget'} — {form.budget_year}</span><button className="modal-close" onClick={onClose}>✕</button></div>
        <div className="form-group"><label className="form-label">Budget Year</label><input className="form-input" type="number" value={form.budget_year} onChange={e=>set('budget_year',e.target.value)}/></div>
        <div style={{ fontSize:10, fontWeight:500, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--g600)', margin:'4px 0 10px' }}>P&L Targets</div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Budget Revenue ($)</label><input className="form-input" type="number" value={form.budget_revenue} onChange={e=>set('budget_revenue',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Budget GOP ($)</label><input className="form-input" type="number" value={form.budget_gop} onChange={e=>set('budget_gop',e.target.value)}/></div>
        </div>
        <div className="form-group"><label className="form-label">Budget NOI ($)</label><input className="form-input" type="number" value={form.budget_noi} onChange={e=>set('budget_noi',e.target.value)}/></div>
        <div style={{ fontSize:10, fontWeight:500, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--g600)', margin:'12px 0 10px' }}>Operating Targets</div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Budget Occupancy (%)</label><input className="form-input" type="number" step="0.1" value={form.budget_occupancy} onChange={e=>set('budget_occupancy',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Budget ADR ($)</label><input className="form-input" type="number" value={form.budget_adr} onChange={e=>set('budget_adr',e.target.value)}/></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Budget RevPAR ($)</label><input className="form-input" type="number" value={form.budget_revpar} onChange={e=>set('budget_revpar',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Budget CapEx ($)</label><input className="form-input" type="number" value={form.budget_capex} onChange={e=>set('budget_capex',e.target.value)}/></div>
        </div>
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading?'Saving...':'Save Budget'}</button>
        </div>
      </div>
    </div>
  )
}

export default function BudgetVsActual() {
  const { assets } = useAssets()
  const [selectedId, setSelectedId] = useState(null)
  const [selectedYear, setSelectedYear] = useState(String(currentYear))
  const [budgets, setBudgets] = useState([])
  const [financials, setFinancials] = useState([])
  const [budgetModal, setBudgetModal] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (assets.length > 0 && !selectedId) setSelectedId(assets[0].id) }, [assets])

  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    Promise.all([
      supabase.from('asset_budgets').select('*').eq('asset_id', selectedId),
      supabase.from('financials').select('*').eq('asset_id', selectedId).order('period_year').order('period_month'),
    ]).then(([b, f]) => {
      setBudgets(b.data || [])
      setFinancials(f.data || [])
      setLoading(false)
    })
  }, [selectedId])

  const asset = assets.find(a => a.id === selectedId)
  const budget = budgets.find(b => String(b.budget_year) === selectedYear)
  const yearFins = financials.filter(f => String(f.period_year) === selectedYear)

  // Actual YTD aggregates for selected year
  const actualRevenue = yearFins.reduce((s,f)=>s+(f.revenue||0),0)
  const actualNOI = yearFins.reduce((s,f)=>s+(f.noi||0),0)
  const actualGOP = yearFins.reduce((s,f)=>s+(f.gop||0),0)
  const avgOcc = yearFins.filter(f=>f.occupancy).length ? yearFins.filter(f=>f.occupancy).reduce((s,f)=>s+parseFloat(f.occupancy),0)/yearFins.filter(f=>f.occupancy).length : null
  const avgADR = yearFins.filter(f=>f.adr).length ? yearFins.filter(f=>f.adr).reduce((s,f)=>s+parseFloat(f.adr),0)/yearFins.filter(f=>f.adr).length : null

  // Annualize actuals if partial year
  const monthsActual = yearFins.length
  const annualizeMultiplier = monthsActual > 0 ? 12 / monthsActual : 1
  const annualRevenue = actualRevenue * annualizeMultiplier
  const annualNOI = actualNOI * annualizeMultiplier

  const saveBudget = async (data) => {
    const { data: result } = await supabase.from('asset_budgets').upsert(data, { onConflict: 'asset_id,budget_year' }).select().single()
    if (result) setBudgets(prev => { const exists = prev.findIndex(b=>String(b.budget_year)===String(data.budget_year)); return exists>=0 ? prev.map(b=>String(b.budget_year)===String(data.budget_year)?result:b) : [...prev, result] })
  }

  // All-assets budget overview
  const allAssetSummary = assets.map(a => {
    const latestBudget = budgets.find(b => b.asset_id === a.id && String(b.budget_year) === selectedYear)
    return { ...a, budget: latestBudget }
  })

  if (loading) return <div className="loading">Loading budget data...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Budget vs Actual</h1>
        <p>Track performance against annual budget targets by asset</p>
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20, flexWrap:'wrap' }}>
        <AssetSelector assets={assets} selected={selectedId} onSelect={setSelectedId}/>
        <div className="filter-tabs" style={{ margin:0 }}>
          {[String(currentYear-1), String(currentYear), String(currentYear+1)].map(y=>(
            <button key={y} className={`filter-tab${selectedYear===y?' active':''}`} onClick={()=>setSelectedYear(y)}>{y}</button>
          ))}
        </div>
        <button className="btn btn-primary btn-sm" onClick={()=>setBudgetModal(true)}>
          {budget ? 'Edit Budget' : '+ Set Budget'}
        </button>
      </div>

      {!budget ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-title">No budget set for {asset?.name} — {selectedYear}</div>
          <div className="empty-state-desc">Set annual budget targets to track variance against actual performance.</div>
          <button className="btn btn-primary" onClick={()=>setBudgetModal(true)}>+ Set Budget</button>
        </div>
      ) : (
        <>
          {/* Variance KPI cards */}
          <div className="kpi-grid">
            {[
              { label:'Revenue YTD vs Budget', actual:actualRevenue, budget:budget.budget_revenue, format:fmtM, annualized:annualRevenue },
              { label:'NOI YTD vs Budget', actual:actualNOI, budget:budget.budget_noi, format:fmtM, annualized:annualNOI },
              { label:'Avg. Occupancy vs Budget', actual:avgOcc, budget:budget.budget_occupancy, format:v=>v?`${parseFloat(v).toFixed(1)}%`:'—' },
              { label:'Avg. ADR vs Budget', actual:avgADR, budget:budget.budget_adr, format:v=>v?`$${parseFloat(v).toFixed(0)}`:'—' },
            ].map(({ label, actual, budget: bud, format, annualized }) => {
              const variance = actual && bud ? ((actual - bud) / bud * 100).toFixed(1) : null
              const color = varColor(actual, bud)
              return (
                <div key={label} style={{ background:'var(--white)', border:`1px solid ${actual&&bud?(parseFloat(variance||0)>=0?'var(--g200)':parseFloat(variance||0)>=-5?'#ffe082':'#f5c6c2'):'var(--gray100)'}`, borderRadius:'var(--radius)', padding:'14px 16px', position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:color }} />
                  <div style={{ fontSize:10, color:'var(--gray500)', letterSpacing:'.04em', textTransform:'uppercase', marginBottom:6 }}>{label}</div>
                  <div style={{ fontSize:20, fontFamily:'Playfair Display,serif', fontWeight:600, color:'var(--g900)', marginBottom:4 }}>{format(actual)}</div>
                  <div style={{ fontSize:11, color:'var(--gray500)', marginBottom:4 }}>Budget: {format(bud)}</div>
                  {variance && <div style={{ fontSize:12, fontWeight:500, color }}>{parseFloat(variance)>=0?'+':''}{variance}% vs budget</div>}
                  {annualized && bud && monthsActual < 12 && <div style={{ fontSize:10, color:'var(--gray400)', marginTop:4 }}>Annualized: {format(annualized)} ({monthsActual}mo)</div>}
                </div>
              )
            })}
          </div>

          {/* Variance chart */}
          {yearFins.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Monthly NOI — Actual vs Budget ({selectedYear})</span></div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={yearFins.map(f=>({ label:`${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][f.period_month-1]}`, actual:f.noi?Math.round(f.noi/1000):null, budget:budget.budget_noi?Math.round(budget.budget_noi/12000):null }))}>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(v,n)=>[`$${v}K`,n]} contentStyle={{fontSize:11,borderRadius:6}}/>
                  <Bar dataKey="actual" fill="var(--g600)" name="Actual NOI" radius={[2,2,0,0]}/>
                  <Bar dataKey="budget" fill="var(--gray200)" name="Monthly Budget" radius={[2,2,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Full budget comparison table */}
          <div className="card">
            <div className="card-header"><span className="card-title">Full variance summary — {asset?.name} {selectedYear}</span></div>
            <table className="data-table">
              <thead><tr><th>Metric</th><th>Budget (Annual)</th><th>Actual YTD</th><th>Variance $</th><th>Variance %</th><th>Status</th></tr></thead>
              <tbody>
                {[
                  ['Revenue', budget.budget_revenue, actualRevenue, fmtM],
                  ['GOP', budget.budget_gop, actualGOP, fmtM],
                  ['NOI', budget.budget_noi, actualNOI, fmtM],
                  ['Occupancy', budget.budget_occupancy, avgOcc, v=>v?`${parseFloat(v).toFixed(1)}%`:'—'],
                  ['ADR', budget.budget_adr, avgADR, v=>v?`$${parseFloat(v).toFixed(0)}`:'—'],
                  ['RevPAR', budget.budget_revpar, null, v=>v?`$${parseFloat(v).toFixed(0)}`:'—'],
                ].map(([label, bud, actual, fmt]) => {
                  const variance = actual && bud ? actual - bud : null
                  const variancePct = variance && bud ? ((variance/bud)*100).toFixed(1) : null
                  const color = varColor(actual, bud)
                  const bg = varBg(actual, bud)
                  return (
                    <tr key={label}>
                      <td>{label}</td>
                      <td>{fmt(bud)}</td>
                      <td style={{ fontWeight:500 }}>{fmt(actual)}</td>
                      <td style={{ color, fontWeight:variance?500:400 }}>{variance!==null?`${variance>=0?'+':''}${fmt(variance)}`:'—'}</td>
                      <td style={{ color, fontWeight:variancePct?500:400 }}>{variancePct!==null?`${parseFloat(variancePct)>=0?'+':''}${variancePct}%`:'—'}</td>
                      <td>
                        {variancePct!==null && (
                          <span style={{ fontSize:10, fontWeight:500, padding:'2px 8px', borderRadius:10, background:bg, color }}>
                            {parseFloat(variancePct)>=0?'✓ Ahead':'⚠ Behind'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {monthsActual < 12 && <div style={{ fontSize:11, color:'var(--gray500)', marginTop:8 }}>YTD based on {monthsActual} month{monthsActual!==1?'s':''} of actual data.</div>}
          </div>
        </>
      )}

      {budgetModal && <BudgetModal assetId={selectedId} year={selectedYear} existing={budget} onClose={()=>setBudgetModal(false)} onSave={saveBudget}/>}
    </div>
  )
}
