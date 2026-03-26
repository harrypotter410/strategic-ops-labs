import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(2)}M` : '—'
const fmtPct = (n) => n ? `${parseFloat(n).toFixed(2)}%` : '—'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const STATUSES = [
  { value:'stabilized', label:'Stabilized', color:'var(--g600)', bg:'var(--g100)' },
  { value:'unstabilized', label:'Unstabilized', color:'var(--amber)', bg:'var(--amberL)' },
  { value:'value_add', label:'Value-Add', color:'var(--blue)', bg:'var(--blueL)' },
  { value:'under_renovation', label:'Under Renovation', color:'#7b1fa2', bg:'#f3e5f5' },
  { value:'lease_up', label:'Lease-Up', color:'#0288d1', bg:'#e1f5fe' },
  { value:'development', label:'Development', color:'#e65100', bg:'#fff3e0' },
  { value:'held_for_sale', label:'Held for Sale', color:'var(--red)', bg:'var(--redL)' },
  { value:'disposed', label:'Disposed', color:'var(--gray500)', bg:'var(--gray100)' },
]

const DOC_CATEGORIES = ['psa','appraisal','loan_doc','lease','ic_memo','financial','environmental','title','insurance','other']

const COVENANTS = [
  { key:'dscr', label:'DSCR', minField:'covenant_dscr_min', actualField:'covenant_dscr_actual', type:'min', format: v => v?`${parseFloat(v).toFixed(2)}x`:'—' },
  { key:'ltv', label:'LTV', minField:'covenant_ltv_max', actualField:'covenant_ltv_actual', type:'max', format: v => v?`${parseFloat(v).toFixed(1)}%`:'—' },
  { key:'debt_yield', label:'Debt Yield', minField:'covenant_debt_yield_min', actualField:'covenant_debt_yield_actual', type:'min', format: v => v?`${parseFloat(v).toFixed(2)}%`:'—' },
  { key:'icr', label:'ICR', minField:'covenant_interest_coverage_min', actualField:'covenant_interest_coverage_actual', type:'min', format: v => v?`${parseFloat(v).toFixed(2)}x`:'—' },
  { key:'occ', label:'Occupancy', minField:'covenant_occupancy_min', actualField:'covenant_occupancy_actual', type:'min', format: v => v?`${parseFloat(v).toFixed(1)}%`:'—' },
]

function covenantStatus(cov, loan) {
  const min = parseFloat(loan[cov.minField])
  const actual = parseFloat(loan[cov.actualField])
  if (!min || !actual || isNaN(min) || isNaN(actual)) return 'unknown'
  if (cov.type === 'min') {
    if (actual < min) return 'breach'
    if (actual < min * 1.10) return 'warning'
    return 'ok'
  } else {
    if (actual > min) return 'breach'
    if (actual > min * 0.95) return 'warning'
    return 'ok'
  }
}

export default function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(null)
  const [financials, setFinancials] = useState([])
  const [debt, setDebt] = useState([])
  const [valuations, setValuations] = useState([])
  const [compData, setCompData] = useState([])
  const [tasks, setTasks] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [editField, setEditField] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [docModal, setDocModal] = useState(false)
  const [docForm, setDocForm] = useState({ name:'', category:'psa', notes:'', file_url:'' })

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const [assetRes, finsRes, debtRes, valsRes, compRes, tasksRes, docsRes] = await Promise.all([
        supabase.from('assets').select('*').eq('id', id).single(),
        supabase.from('financials').select('*').eq('asset_id', id).order('period_year').order('period_month'),
        supabase.from('asset_debt').select('*').eq('asset_id', id),
        supabase.from('valuations').select('*').eq('asset_id', id).order('year', { ascending: false }).order('quarter', { ascending: false }),
        supabase.from('comp_data').select('*').eq('asset_id', id).order('period_year').order('period_month'),
        supabase.from('tasks').select('*').eq('asset_id', id).order('due_date', { ascending: true }),
        supabase.from('documents').select('*').eq('asset_id', id).order('created_at', { ascending: false }),
      ])
      setAsset(assetRes.data)
      setFinancials(finsRes.data || [])
      setDebt(debtRes.data || [])
      setValuations(valsRes.data || [])
      setCompData(compRes.data || [])
      setTasks(tasksRes.data || [])
      setDocuments(docsRes.data || [])
      setLoading(false)
    }
    fetch()
  }, [id])

  const saveField = async (field, value) => {
    const parsed = ['rooms','year_acquired','hold_period_years','target_exit_year'].includes(field) ? parseInt(value) :
      ['acquisition_price','current_value','cap_rate','noi_trailing','debt_service_annual','target_exit_cap_rate','projected_exit_value','actual_irr'].includes(field) ? parseFloat(value) : value
    await supabase.from('assets').update({ [field]: parsed }).eq('id', id)
    setAsset(prev => ({ ...prev, [field]: parsed }))
    setEditField(null)
  }

  const addDoc = async () => {
    const { data } = await supabase.from('documents').insert({ asset_id: id, ...docForm }).select().single()
    if (data) setDocuments(prev => [data, ...prev])
    setDocModal(false); setDocForm({ name:'', category:'psa', notes:'', file_url:'' })
  }

  const toggleTask = async (task) => {
    const next = task.status === 'done' ? 'open' : 'done'
    await supabase.from('tasks').update({ status: next, completed_at: next==='done'?new Date().toISOString():null }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
  }

  if (loading) return <div className="loading">Loading asset...</div>
  if (!asset) return <div className="empty-state"><div className="empty-state-title">Asset not found</div><Link to="/assets"><button className="btn btn-secondary">← Back to assets</button></Link></div>

  const gain = asset.current_value && asset.acquisition_price ? asset.current_value - asset.acquisition_price : null
  const gainPct = gain && asset.acquisition_price ? ((gain/asset.acquisition_price)*100).toFixed(1) : null
  const yoc = asset.noi_trailing && asset.acquisition_price ? ((asset.noi_trailing/asset.acquisition_price)*100).toFixed(2) : null
  const levYoc = asset.noi_trailing && asset.debt_service_annual && asset.acquisition_price ? (((asset.noi_trailing-asset.debt_service_annual)/asset.acquisition_price)*100).toFixed(2) : null
  const dscr = asset.noi_trailing && asset.debt_service_annual ? (asset.noi_trailing/asset.debt_service_annual).toFixed(2) : null
  const yearsHeld = asset.year_acquired ? new Date().getFullYear() - asset.year_acquired : null
  const ss = STATUSES.find(s => s.value === asset.status) || STATUSES[0]

  const t12 = financials.slice(-12)
  const t12Revenue = t12.reduce((s,f)=>s+(f.revenue||0),0)
  const t12NOI = t12.reduce((s,f)=>s+(f.noi||0),0)
  const avgOcc = t12.filter(f=>f.occupancy).length ? (t12.filter(f=>f.occupancy).reduce((s,f)=>s+parseFloat(f.occupancy),0)/t12.filter(f=>f.occupancy).length).toFixed(1) : null
  const chartData = financials.slice(-12).map(f => ({ label:`${MONTHS[f.period_month-1].slice(0,3)} ${String(f.period_year).slice(2)}`, revenue:f.revenue?Math.round(f.revenue/1000):null, noi:f.noi?Math.round(f.noi/1000):null, occupancy:f.occupancy?parseFloat(f.occupancy):null }))

  const latestComp = [...compData].sort((a,b)=>b.period_year-a.period_year||b.period_month-a.period_month)[0]
  const totalDebt = debt.reduce((s,d)=>s+(d.current_balance||0),0)
  const allBreaches = debt.flatMap(loan => COVENANTS.filter(c => covenantStatus(c,loan)==='breach'))

  const EditableField = ({ field, value, label, format, type='text' }) => {
    if (editField === field) return (
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <input className="form-input" style={{ padding:'4px 8px', fontSize:13, width:160 }} type={type} defaultValue={value||''} autoFocus onBlur={e=>saveField(field,e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveField(field,e.target.value);if(e.key==='Escape')setEditField(null)}}/>
      </div>
    )
    return (
      <span className="inline-edit" onClick={()=>setEditField(field)} title="Click to edit" style={{ fontSize:15, fontWeight:500, color:'var(--g900)' }}>
        {format ? format(value) : (value||'—')}
        <span className="edit-pencil">✎</span>
      </span>
    )
  }

  const tabStyle = (t) => ({ fontSize:12.5, padding:'9px 18px', cursor:'pointer', color:tab===t?'var(--g700)':'var(--gray500)', borderBottom:`2px solid ${tab===t?'var(--g600)':'transparent'}`, marginBottom:-2, fontWeight:tab===t?500:400, background:'none', border:'none', borderBottom:`2px solid ${tab===t?'var(--g600)':'transparent'}`, transition:'all .12s' })

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize:11, color:'var(--gray500)', marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
        <Link to="/assets" style={{ color:'var(--g600)', textDecoration:'none' }}>Assets</Link>
        <span>›</span>
        <span>{asset.name}</span>
      </div>

      {/* Asset header */}
      <div style={{ background:'var(--g900)', borderRadius:12, padding:'24px 28px', marginBottom:20, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:20, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontFamily:'Playfair Display,serif', fontSize:22, fontWeight:600, color:'#fff', marginBottom:6 }}>{asset.name}</div>
          <div style={{ fontSize:12, color:'var(--g200)', marginBottom:12 }}>{asset.market} · {asset.rooms?.toLocaleString()} rooms · {asset.type?.charAt(0).toUpperCase()+asset.type?.slice(1)}{asset.brand?` · ${asset.brand}`:''}</div>
          <span style={{ fontSize:11, fontWeight:500, padding:'3px 12px', borderRadius:20, background:ss.bg, color:ss.color }}>{ss.label}</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,minmax(100px,1fr))', gap:10 }}>
          {[
            ['Portfolio Value', fmtM(asset.current_value)],
            ['Unrealized Gain', gain!==null?`${gain>=0?'+':''}${fmtM(gain)}`:'—'],
            ['YOC', yoc?`${yoc}%`:'—'],
            ['DSCR', dscr?`${dscr}x`:'—'],
          ].map(([l,v],i) => (
            <div key={l} style={{ background:'rgba(255,255,255,0.08)', borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>{l}</div>
              <div style={{ fontSize:16, fontWeight:600, color: i===1?(gain>=0?'#a8d5bc':'#f5c6c2'):'#fff' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid var(--gray100)', marginBottom:20, gap:0 }}>
        {[['overview','Overview'],['financials','Financials'],['debt','Debt & Covenants'],['valuations','Valuations'],['comps','Comp Intel'],['tasks','Tasks'],['documents','Documents']].map(([t,l]) => (
          <button key={t} style={tabStyle(t)} onClick={()=>setTab(t)}>{l}{t==='debt'&&allBreaches.length>0?<span style={{marginLeft:4,fontSize:9,background:'var(--red)',color:'#fff',padding:'1px 5px',borderRadius:10}}>!</span>:null}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <>
          <div className="grid-2">
            {/* Key metrics */}
            <div className="card" style={{marginBottom:0}}>
              <div className="card-header"><span className="card-title">Investment metrics</span></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {[
                  ['Acquisition Price', fmtM(asset.acquisition_price)],
                  ['Current Value', fmtM(asset.current_value)],
                  ['Unrealized Gain', gain!==null?`${gain>=0?'+':''}${fmtM(gain)} (${gain>=0?'+':''}${gainPct}%)`:'—'],
                  ['T12 NOI', fmtM(asset.noi_trailing)],
                  ['YOC (Unlevered)', yoc?`${yoc}%`:'—'],
                  ['Levered YOC', levYoc?`${levYoc}%`:'—'],
                  ['Annual Debt Service', fmtM(asset.debt_service_annual)],
                  ['DSCR', dscr?`${dscr}x`:'—'],
                ].map(([l,v]) => (
                  <div key={l} style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'10px 12px'}}>
                    <div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>{l}</div>
                    <div style={{fontSize:14,fontWeight:500,color:'var(--g900)'}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Exit analysis */}
            <div className="card" style={{marginBottom:0}}>
              <div className="card-header"><span className="card-title">Hold period & exit analysis</span></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                {[
                  ['Year Acquired', asset.year_acquired||'—'],
                  ['Years Held', yearsHeld!==null?`${yearsHeld} yrs`:'—'],
                  ['Target Hold', asset.hold_period_years?`${asset.hold_period_years} yrs`:'—'],
                  ['Target Exit Year', asset.target_exit_year||'—'],
                  ['Target Exit Cap', asset.target_exit_cap_rate?`${asset.target_exit_cap_rate}%`:'—'],
                  ['Proj. Exit Value', fmtM(asset.projected_exit_value)],
                ].map(([l,v]) => (
                  <div key={l} style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'10px 12px'}}>
                    <div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>{l}</div>
                    <div style={{fontSize:14,fontWeight:500,color:'var(--g900)'}}>{v}</div>
                  </div>
                ))}
              </div>
              {asset.target_exit_year && asset.projected_exit_value && asset.acquisition_price && (
                <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:8,padding:'12px 14px'}}>
                  <div style={{fontSize:10,color:'var(--g600)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6}}>Projected exit return</div>
                  <div style={{display:'flex',gap:16}}>
                    <div><div style={{fontSize:10,color:'var(--gray500)',marginBottom:2}}>Proj. gain</div><div style={{fontSize:15,fontWeight:600,color:'var(--g700)'}}>{`+${fmtM(asset.projected_exit_value-asset.acquisition_price)}`}</div></div>
                    <div><div style={{fontSize:10,color:'var(--gray500)',marginBottom:2}}>Equity multiple</div><div style={{fontSize:15,fontWeight:600,color:'var(--g700)'}}>{`${(asset.projected_exit_value/asset.acquisition_price).toFixed(2)}x`}</div></div>
                    {asset.actual_irr && <div><div style={{fontSize:10,color:'var(--gray500)',marginBottom:2}}>Actual IRR</div><div style={{fontSize:15,fontWeight:600,color:'var(--g600)'}}>{`${asset.actual_irr}%`}</div></div>}
                  </div>
                  {asset.target_exit_year <= new Date().getFullYear() && (
                    <div style={{marginTop:8,fontSize:11,color:'var(--amber)',fontWeight:500}}>⚠ This asset has reached its target exit year</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* STR snapshot */}
          {latestComp && (
            <div className="card">
              <div className="card-header"><span className="card-title">Latest STR performance — {MONTHS[latestComp.period_month-1]} {latestComp.period_year}</span></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10}}>
                {[
                  ['My Occupancy', latestComp.my_occupancy?`${parseFloat(latestComp.my_occupancy).toFixed(1)}%`:'—'],
                  ['My ADR', latestComp.my_adr?`$${parseFloat(latestComp.my_adr).toFixed(0)}`:'—'],
                  ['My RevPAR', latestComp.my_revpar?`$${parseFloat(latestComp.my_revpar).toFixed(0)}`:'—'],
                  ['MPI', latestComp.occ_index?parseFloat(latestComp.occ_index).toFixed(1):'—'],
                  ['ARI', latestComp.adr_index?parseFloat(latestComp.adr_index).toFixed(1):'—'],
                  ['RGI', latestComp.revpar_index?parseFloat(latestComp.revpar_index).toFixed(1):'—'],
                ].map(([l,v],i) => {
                  const isIndex = i >= 3
                  const val = isIndex ? parseFloat(v) : null
                  const color = isIndex ? (val>=105?'var(--g600)':val>=95?'var(--amber)':'var(--red)') : 'var(--g900)'
                  return (
                    <div key={l} style={{background:isIndex?(val>=105?'var(--g50)':val>=95?'var(--amberL)':'var(--redL)'):'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                      <div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>{l}</div>
                      <div style={{fontSize:16,fontWeight:600,color}}>{v}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {asset.notes && (
            <div className="card">
              <div className="card-header"><span className="card-title">Notes</span></div>
              <div style={{fontSize:13,color:'var(--gray700)',lineHeight:1.7}}>{asset.notes}</div>
            </div>
          )}
        </>
      )}

      {/* FINANCIALS */}
      {tab === 'financials' && (
        <>
          <div className="kpi-grid">
            <div className="kpi-card"><div className="kpi-label">T12 Revenue</div><div className="kpi-value">{fmtM(t12Revenue)}</div></div>
            <div className="kpi-card"><div className="kpi-label">T12 NOI</div><div className="kpi-value">{fmtM(t12NOI)}</div><div className="kpi-change">{t12Revenue&&t12NOI?`${((t12NOI/t12Revenue)*100).toFixed(1)}% margin`:''}</div></div>
            <div className="kpi-card"><div className="kpi-label">Avg. Occupancy</div><div className="kpi-value">{avgOcc?`${avgOcc}%`:'—'}</div></div>
            <div className="kpi-card"><div className="kpi-label">YOC</div><div className="kpi-value">{yoc?`${yoc}%`:'—'}</div></div>
          </div>
          {chartData.length > 0 ? (
            <>
              <div className="card">
                <div className="card-header"><span className="card-title">Revenue vs NOI ($000s)</span></div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="label" tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={(v,n)=>[`$${v}K`,n]} contentStyle={{fontSize:11,borderRadius:6}}/>
                    <Bar dataKey="revenue" fill="var(--g200)" name="Revenue" radius={[2,2,0,0]}/>
                    <Bar dataKey="noi" fill="var(--g600)" name="NOI" radius={[2,2,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card">
                <div className="card-header"><span className="card-title">Monthly data</span></div>
                <div style={{overflowX:'auto'}}>
                  <table className="data-table">
                    <thead><tr><th>Period</th><th>Revenue</th><th>GOP</th><th>NOI</th><th>Margin</th><th>Occ.</th><th>ADR</th><th>RevPAR</th></tr></thead>
                    <tbody>
                      {[...financials].reverse().map(f => {
                        const margin = f.revenue&&f.noi?((f.noi/f.revenue)*100).toFixed(1):null
                        return (
                          <tr key={f.id}>
                            <td><strong>{MONTHS[f.period_month-1]} {f.period_year}</strong></td>
                            <td>{fmtM(f.revenue)}</td><td>{fmtM(f.gop)}</td>
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
              </div>
            </>
          ) : (
            <div className="empty-state"><div className="empty-state-icon">📊</div><div className="empty-state-title">No financial data yet</div><div className="empty-state-desc">Use "+ P&L" on the Asset Tracker to add monthly financials.</div></div>
          )}
        </>
      )}

      {/* DEBT & COVENANTS */}
      {tab === 'debt' && (
        <>
          {debt.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🏦</div><div className="empty-state-title">No loans tracked</div><div className="empty-state-desc">Add loans in the Debt Tracker page.</div><Link to="/debt"><button className="btn btn-primary">Go to Debt Tracker</button></Link></div>
          ) : debt.map(loan => {
            const breaches = COVENANTS.filter(c => covenantStatus(c,loan)==='breach')
            const warnings = COVENANTS.filter(c => covenantStatus(c,loan)==='warning')
            const days = loan.maturity_date ? Math.ceil((new Date(loan.maturity_date)-new Date())/(1000*60*60*24)) : null
            return (
              <div key={loan.id} className="card">
                <div className="card-header">
                  <div>
                    <span className="card-title">{loan.lender}</span>
                    <span style={{fontSize:10,background:'var(--g50)',color:'var(--g700)',padding:'2px 7px',borderRadius:10,marginLeft:8}}>{loan.loan_type?.replace('_',' ')}</span>
                  </div>
                  <div style={{fontSize:12,color:'var(--gray500)'}}>
                    {fmtM(loan.current_balance)} · {loan.interest_rate?`${loan.interest_rate}%`:''} {loan.rate_type}
                    {days!==null && <span style={{color:days<=180?'var(--red)':days<=365?'var(--amber)':'var(--gray500)',marginLeft:12}}>Matures {new Date(loan.maturity_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} ({days}d)</span>}
                  </div>
                </div>
                {(breaches.length>0||warnings.length>0) && (
                  <div style={{marginBottom:12}}>
                    {breaches.map(c=><div key={c.key} style={{background:'var(--redL)',border:'1px solid #f5c6c2',borderRadius:7,padding:'8px 12px',fontSize:12,color:'var(--red)',marginBottom:4}}>🚨 BREACH — {c.label}: {c.format(loan[c.actualField])} vs required {c.type==='min'?'min':'max'} {c.format(loan[c.minField])}</div>)}
                    {warnings.map(c=><div key={c.key} style={{background:'var(--amberL)',border:'1px solid #ffe082',borderRadius:7,padding:'8px 12px',fontSize:12,color:'var(--amber)',marginBottom:4}}>⚠ Warning — {c.label}: {c.format(loan[c.actualField])} approaching {c.type==='min'?'minimum':'maximum'} of {c.format(loan[c.minField])}</div>)}
                  </div>
                )}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:8}}>
                  {COVENANTS.filter(c=>loan[c.minField]||loan[c.actualField]).map(cov => {
                    const st = covenantStatus(cov,loan)
                    const color = st==='breach'?'var(--red)':st==='warning'?'var(--amber)':st==='ok'?'var(--g600)':'var(--gray500)'
                    const bg = st==='breach'?'var(--redL)':st==='warning'?'var(--amberL)':st==='ok'?'var(--g50)':'var(--gray50)'
                    return (
                      <div key={cov.key} style={{background:bg,border:`1px solid ${color}30`,borderRadius:8,padding:'10px 12px'}}>
                        <div style={{fontSize:9,color,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>{cov.label}</div>
                        <div style={{fontSize:16,fontWeight:700,color}}>{cov.format(loan[cov.actualField])}</div>
                        <div style={{fontSize:10,color:'rgba(0,0,0,0.4)',marginTop:2}}>req. {cov.format(loan[cov.minField])}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* VALUATIONS */}
      {tab === 'valuations' && (
        <>
          {valuations.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">📈</div><div className="empty-state-title">No valuations yet</div><Link to="/valuations"><button className="btn btn-primary">Add Valuation</button></Link></div>
          ) : (
            <div className="card">
              <div className="card-header"><span className="card-title">Valuation history</span></div>
              <table className="data-table">
                <thead><tr><th>Period</th><th>Appraised</th><th>Internal Est.</th><th>Equity Value</th><th>Cap Rate</th><th>QoQ Change</th><th>Status</th></tr></thead>
                <tbody>
                  {valuations.map((v,i) => {
                    const prev = valuations[i+1]
                    const thisVal = v.appraised_value||v.internal_estimate
                    const prevVal = prev?.appraised_value||prev?.internal_estimate
                    const change = thisVal&&prevVal?thisVal-prevVal:null
                    return (
                      <tr key={v.id}>
                        <td><strong>Q{v.quarter} {v.year}</strong></td>
                        <td>{fmtM(v.appraised_value)}</td>
                        <td>{fmtM(v.internal_estimate)}</td>
                        <td style={{fontWeight:500}}>{fmtM(v.equity_value)}</td>
                        <td>{v.cap_rate_applied?`${v.cap_rate_applied}%`:'—'}</td>
                        <td style={{color:change>0?'var(--g600)':change<0?'var(--red)':'var(--gray500)',fontWeight:500}}>{change!==null?`${change>=0?'+':''}${fmtM(change)}`:'—'}</td>
                        <td style={{fontSize:11,color:v.approved?'var(--g600)':'var(--amber)',fontWeight:500}}>{v.approved?'Approved':'Draft'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* COMP INTEL */}
      {tab === 'comps' && (
        <>
          {compData.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">📊</div><div className="empty-state-title">No comp data yet</div><Link to="/intel"><button className="btn btn-primary">Go to Competitive Intel</button></Link></div>
          ) : (
            <div className="card">
              <div className="card-header"><span className="card-title">STR performance history</span></div>
              <div style={{overflowX:'auto'}}>
                <table className="data-table">
                  <thead><tr><th>Period</th><th>My Occ.</th><th>My ADR</th><th>My RevPAR</th><th>Comp RevPAR</th><th>MPI</th><th>ARI</th><th>RGI</th></tr></thead>
                  <tbody>
                    {[...compData].reverse().map(d => {
                      const rgi = d.revpar_index?parseFloat(d.revpar_index):null
                      const color = rgi?(rgi>=105?'var(--g600)':rgi>=95?'var(--amber)':'var(--red)'):'var(--gray500)'
                      return (
                        <tr key={d.id}>
                          <td><strong>{MONTHS[d.period_month-1]} {d.period_year}</strong></td>
                          <td>{d.my_occupancy?`${parseFloat(d.my_occupancy).toFixed(1)}%`:'—'}</td>
                          <td>{d.my_adr?`$${parseFloat(d.my_adr).toFixed(0)}`:'—'}</td>
                          <td>{d.my_revpar?`$${parseFloat(d.my_revpar).toFixed(0)}`:'—'}</td>
                          <td>{d.comp_set_revpar?`$${parseFloat(d.comp_set_revpar).toFixed(0)}`:'—'}</td>
                          <td style={{color:d.occ_index&&parseFloat(d.occ_index)>=105?'var(--g600)':d.occ_index&&parseFloat(d.occ_index)<95?'var(--red)':'var(--gray700)',fontWeight:500}}>{d.occ_index?parseFloat(d.occ_index).toFixed(1):'—'}</td>
                          <td style={{fontWeight:500}}>{d.adr_index?parseFloat(d.adr_index).toFixed(1):'—'}</td>
                          <td style={{color,fontWeight:600}}>{rgi?rgi.toFixed(1):'—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* TASKS */}
      {tab === 'tasks' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Tasks for {asset.name}</span>
            <Link to="/tasks"><button className="btn btn-primary btn-sm">+ Add Task</button></Link>
          </div>
          {tasks.length === 0 ? (
            <div className="empty-state"><div className="empty-state-title">No tasks linked to this asset</div><div className="empty-state-desc">Create a task and link it to this asset from the Tasks page.</div></div>
          ) : tasks.map(t => {
            const overdue = t.due_date&&new Date(t.due_date)<new Date()&&t.status!=='done'
            return (
              <div key={t.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--gray100)'}}>
                <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${t.status==='done'?'var(--g400)':'var(--gray300)'}`,background:t.status==='done'?'var(--g100)':'var(--white)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}} onClick={()=>toggleTask(t)}>
                  {t.status==='done'&&<span style={{fontSize:9,color:'var(--g600)'}}>✓</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,color:t.status==='done'?'var(--gray500)':'var(--g900)',textDecoration:t.status==='done'?'line-through':'none'}}>{t.title}</div>
                  {t.due_date&&<div style={{fontSize:11,color:overdue?'var(--red)':'var(--gray500)'}}>{overdue?'⚠ ':''}{new Date(t.due_date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>}
                </div>
                <span style={{fontSize:10,padding:'2px 8px',borderRadius:10,background:t.priority==='urgent'?'var(--redL)':t.priority==='high'?'var(--amberL)':'var(--gray100)',color:t.priority==='urgent'?'var(--red)':t.priority==='high'?'var(--amber)':'var(--gray500)'}}>{t.priority}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* DOCUMENTS */}
      {tab === 'documents' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Document vault</span>
            <button className="btn btn-primary btn-sm" onClick={()=>setDocModal(true)}>+ Add Document</button>
          </div>
          {documents.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">📁</div><div className="empty-state-title">No documents yet</div><div className="empty-state-desc">Add links to PSAs, appraisals, loan docs, leases, and IC memos.</div></div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
              {documents.map(doc => (
                <div key={doc.id} style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:10,padding:'14px 16px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10,marginBottom:8}}>
                    <div style={{fontSize:20,flexShrink:0}}>📄</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500,color:'var(--g900)',marginBottom:2}}>{doc.name}</div>
                      <span style={{fontSize:9,background:'var(--g100)',color:'var(--g700)',padding:'1px 7px',borderRadius:10,textTransform:'uppercase',letterSpacing:'.05em'}}>{doc.category?.replace('_',' ')}</span>
                    </div>
                  </div>
                  {doc.notes&&<div style={{fontSize:11,color:'var(--gray500)',marginBottom:8}}>{doc.notes}</div>}
                  {doc.file_url&&<a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:'var(--g600)',textDecoration:'none'}}>→ Open document</a>}
                  <div style={{fontSize:10,color:'var(--gray400)',marginTop:6}}>{new Date(doc.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Document modal */}
      {docModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDocModal(false)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">Add Document</span><button className="modal-close" onClick={()=>setDocModal(false)}>✕</button></div>
            <div className="form-group"><label className="form-label">Document Name *</label><input className="form-input" value={docForm.name} onChange={e=>setDocForm(f=>({...f,name:e.target.value}))} placeholder="Q1 2026 Appraisal"/></div>
            <div className="form-group"><label className="form-label">Category</label>
              <select className="form-select" value={docForm.category} onChange={e=>setDocForm(f=>({...f,category:e.target.value}))}>
                {DOC_CATEGORIES.map(c=><option key={c} value={c}>{c.replace('_',' ').replace(/\b\w/g,x=>x.toUpperCase())}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Link / URL</label><input className="form-input" value={docForm.file_url} onChange={e=>setDocForm(f=>({...f,file_url:e.target.value}))} placeholder="https://drive.google.com/..."/></div>
            <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={docForm.notes} onChange={e=>setDocForm(f=>({...f,notes:e.target.value}))}/></div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-secondary" onClick={()=>setDocModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addDoc} disabled={!docForm.name.trim()}>Add Document</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
