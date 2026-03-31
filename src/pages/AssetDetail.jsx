import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(2)}M` : '—'
const fmtPct = (n) => n ? `${parseFloat(n).toFixed(2)}%` : '—'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const currentYear = new Date().getFullYear()

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

function calcIRR(acqPrice, exitValue, holdYears, annualCF=0) {
  if (!acqPrice||!exitValue||!holdYears||holdYears<=0||acqPrice<=0||exitValue<=0) return null
  let irr = 0.10
  for (let i=0;i<100;i++) {
    let npv = -acqPrice
    for (let y=1;y<=holdYears;y++) npv += annualCF/Math.pow(1+irr,y)
    npv += exitValue/Math.pow(1+irr,holdYears)
    if (Math.abs(npv)<500) break
    irr += npv>0?0.005:-0.005
    if (irr<-0.5||irr>5) return null
  }
  return isFinite(irr)&&!isNaN(irr) ? parseFloat((irr*100).toFixed(1)) : null
}

// Editable field component
function EditField({ label, value, onSave, type='text', prefix='', suffix='', tip='' }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value||'')
  const commit = async () => {
    setEditing(false)
    if (String(val) !== String(value||'')) await onSave(val)
  }
  const display = value ? `${prefix}${type==='number'&&parseFloat(value)>=1e6?fmtM(parseFloat(value)):parseFloat(value)||value}${suffix}` : '—'

  if (editing) return (
    <div style={{display:'flex',gap:4}}>
      <input className="form-input" style={{fontSize:12,padding:'3px 8px'}} type={type} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape')setEditing(false)}} autoFocus/>
    </div>
  )
  return (
    <div style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer'}} onClick={()=>{setVal(value||'');setEditing(true)}} title={tip||'Click to edit'}>
      <span style={{fontWeight:500,color:'var(--g900)'}}>{display}</span>
      <span style={{fontSize:10,color:'var(--gray400)'}}>✎</span>
    </div>
  )
}

function KPICard({ label, value, sub, color }) {
  return (
    <div style={{background:'var(--white)',border:'1px solid var(--gray100)',borderRadius:10,padding:'14px 16px'}}>
      <div style={{fontSize:10,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:6}}>{label}</div>
      <div style={{fontSize:20,fontFamily:'Playfair Display,serif',fontWeight:600,color:color||'var(--g900)'}}>{value||'—'}</div>
      {sub&&<div style={{fontSize:11,color:'var(--gray500)',marginTop:3}}>{sub}</div>}
    </div>
  )
}

export default function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(null)
  const [financials, setFinancials] = useState([])
  const [debt, setDebt] = useState([])
  const [compData, setCompData] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      supabase.from('assets').select('*').eq('id', id).single(),
      supabase.from('financials').select('*').eq('asset_id', id).order('period_year').order('period_month'),
      supabase.from('asset_debt').select('*').eq('asset_id', id).order('maturity_date'),
      supabase.from('comp_data').select('*').eq('asset_id', id).order('period_year',{ascending:false}).order('period_month',{ascending:false}),
    ]).then(([a, f, d, c]) => {
      if (a.error || !a.data) { navigate('/assets'); return }
      setAsset(a.data)
      setFinancials(f.data||[])
      setDebt(d.data||[])
      setCompData(c.data||[])
      setLoading(false)
    })
  }, [id])

  const updateField = async (field, rawVal) => {
    const numFields = ['acquisition_price','current_value','noi_trailing','debt_service_annual','cap_rate','rooms','year_acquired','year_built','hold_period_years','target_exit_year','target_exit_cap_rate','projected_exit_value','actual_irr']
    const val = numFields.includes(field) ? (rawVal?parseFloat(rawVal):null) : rawVal||null
    setSaving(true)
    const { data, error } = await supabase.from('assets').update({[field]:val}).eq('id',id).select().single()
    if (!error && data) setAsset(data)
    setSaving(false)
  }

  if (loading) return <div className="loading">Loading asset...</div>
  if (!asset) return null

  // Derived metrics
  const gain = asset.current_value&&asset.acquisition_price ? parseFloat(asset.current_value)-parseFloat(asset.acquisition_price) : null
  const gainPct = gain&&asset.acquisition_price ? ((gain/parseFloat(asset.acquisition_price))*100).toFixed(1) : null
  const yoc = asset.noi_trailing&&asset.acquisition_price ? ((parseFloat(asset.noi_trailing)/parseFloat(asset.acquisition_price))*100).toFixed(2) : null
  const levYoc = asset.noi_trailing&&asset.debt_service_annual&&asset.acquisition_price ? (((parseFloat(asset.noi_trailing)-parseFloat(asset.debt_service_annual))/parseFloat(asset.acquisition_price))*100).toFixed(2) : null
  const dscr = asset.noi_trailing&&asset.debt_service_annual ? (parseFloat(asset.noi_trailing)/parseFloat(asset.debt_service_annual)).toFixed(2) : null
  const holdYears = asset.target_exit_year&&asset.year_acquired ? parseInt(asset.target_exit_year)-parseInt(asset.year_acquired) : asset.hold_period_years
  const annualCF = (parseFloat(asset.noi_trailing)||0)-(parseFloat(asset.debt_service_annual)||0)
  const projIRR = calcIRR(parseFloat(asset.acquisition_price)||null, parseFloat(asset.projected_exit_value)||null, holdYears, annualCF)
  const equityMultiple = asset.projected_exit_value&&asset.acquisition_price ? (parseFloat(asset.projected_exit_value)/parseFloat(asset.acquisition_price)).toFixed(2) : null
  const yearsToExit = asset.target_exit_year ? parseInt(asset.target_exit_year)-currentYear : null
  const statusStyle = STATUSES.find(s=>s.value===asset.status)||STATUSES[0]

  // Chart data
  const chartData = financials.slice(-12).map(f=>({
    label:`${MONTHS[f.period_month-1].slice(0,3)} ${String(f.period_year).slice(2)}`,
    revenue:f.revenue?Math.round(parseFloat(f.revenue)/1000):null,
    noi:f.noi?Math.round(parseFloat(f.noi)/1000):null,
  }))
  const latest = compData[0]

  const tabStyle = (t) => ({fontSize:13,padding:'7px 18px',borderRadius:20,border:'1px solid',cursor:'pointer',fontWeight:tab===t?500:400,borderColor:tab===t?'var(--g600)':'var(--gray200)',background:tab===t?'var(--g700)':'var(--white)',color:tab===t?'var(--white)':'var(--gray700)',transition:'all .12s'})

  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:12,color:'var(--gray500)',marginBottom:6}}>
          <Link to="/assets" style={{color:'var(--g600)',textDecoration:'none'}}>Asset Tracker</Link>
          <span style={{margin:'0 6px'}}>›</span>
          <span>{asset.name}</span>
        </div>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}>
          <div>
            <h1 style={{margin:0,marginBottom:4}}>{asset.name}</h1>
            <div style={{fontSize:13,color:'var(--gray500)',display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
              <span>{asset.market}</span>
              {asset.brand&&<span>· {asset.brand}</span>}
              {asset.rooms&&<span>· {asset.rooms} rooms</span>}
              {asset.type&&<span>· {asset.type}</span>}
              <span style={{fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:10,background:statusStyle.bg,color:statusStyle.color}}>{statusStyle.label}</span>
              {saving&&<span style={{fontSize:10,color:'var(--g600)'}}>Saving...</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="kpi-grid" style={{marginBottom:20}}>
        <KPICard label="Acquisition Price" value={fmtM(asset.acquisition_price)}/>
        <KPICard label="Current Value" value={fmtM(asset.current_value)} sub={gain!==null?`${gain>=0?'+':''}${fmtM(gain)} (${gain>=0?'+':''}${gainPct}%)`:'Click pencil to update'} color={gain>0?'var(--g600)':gain<0?'var(--red)':undefined}/>
        <KPICard label="Unlevered YOC" value={yoc?`${yoc}%`:null} sub="NOI ÷ Acq. Price"/>
        <KPICard label="Proj. IRR" value={projIRR?`${projIRR}%`:null} sub={holdYears?`${holdYears}yr hold`:'Set exit year'} color={projIRR?(projIRR>=15?'var(--g600)':projIRR>=12?'var(--amber)':'var(--red)'):undefined}/>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        {[['overview','Overview'],['financials','Financials'],['debt','Debt & Covenants'],['intel','STR Intel']].map(([t,l])=>(
          <button key={t} style={tabStyle(t)} onClick={()=>setTab(t)}>{l}</button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab==='overview'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {/* Investment metrics */}
          <div className="card" style={{marginBottom:0}}>
            <div className="card-header"><span className="card-title">Investment metrics</span><span style={{fontSize:10,color:'var(--gray500)'}}>Click any value to edit</span></div>
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              {[
                ['Acquisition Price','acquisition_price','number','$'],
                ['Current Value','current_value','number','$'],
                ['Trailing NOI (T12)','noi_trailing','number','$'],
                ['Annual Debt Service','debt_service_annual','number','$'],
                ['Entry Cap Rate','cap_rate','number','','%'],
                ['Year Acquired','year_acquired','number'],
                ['Year Built','year_built','number'],
                ['Rooms','rooms','number'],
                ['Brand / Flag','brand','text'],
                ['Market','market','text'],
              ].map(([label,field,type,prefix='',suffix=''])=>(
                <div key={field} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid var(--gray100)'}}>
                  <span style={{fontSize:12,color:'var(--gray600)'}}>{label}</span>
                  <EditField label={label} value={asset[field]} onSave={v=>updateField(field,v)} type={type} prefix={prefix} suffix={suffix}/>
                </div>
              ))}
            </div>
          </div>

          {/* Exit & hold analysis */}
          <div>
            <div className="card" style={{marginBottom:16}}>
              <div className="card-header"><span className="card-title">Exit & hold analysis</span><span style={{fontSize:10,color:'var(--gray500)'}}>Click any value to edit</span></div>
              <div style={{display:'flex',flexDirection:'column',gap:0}}>
                {[
                  ['Hold Period (years)','hold_period_years','number'],
                  ['Target Exit Year','target_exit_year','number'],
                  ['Target Exit Cap Rate','target_exit_cap_rate','number','','%'],
                  ['Projected Exit Value','projected_exit_value','number','$'],
                  ['Actual Realized IRR','actual_irr','number','','%'],
                ].map(([label,field,type,prefix='',suffix=''])=>(
                  <div key={field} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid var(--gray100)'}}>
                    <span style={{fontSize:12,color:'var(--gray600)'}}>{label}</span>
                    <EditField label={label} value={asset[field]} onSave={v=>updateField(field,v)} type={type} prefix={prefix} suffix={suffix}/>
                  </div>
                ))}
              </div>

              {/* Live IRR preview */}
              {(projIRR||equityMultiple)&&(
                <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:8,padding:'12px 14px',marginTop:12,display:'flex',gap:20,flexWrap:'wrap'}}>
                  {holdYears&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>Hold Period</div><div style={{fontSize:16,fontWeight:600,color:'var(--g900)'}}>{holdYears}y</div></div>}
                  {projIRR&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>Proj. IRR</div><div style={{fontSize:22,fontFamily:'Playfair Display,serif',fontWeight:700,color:projIRR>=15?'var(--g600)':projIRR>=12?'var(--amber)':'var(--red)'}}>{projIRR}%</div><div style={{fontSize:9,color:'var(--gray400)'}}>auto-calculated</div></div>}
                  {equityMultiple&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>Equity Multiple</div><div style={{fontSize:16,fontWeight:600,color:'var(--g900)'}}>{equityMultiple}x</div></div>}
                  {yoc&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>YOC (Unlev.)</div><div style={{fontSize:16,fontWeight:600,color:'var(--g900)'}}>{yoc}%</div></div>}
                  {levYoc&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>Levered YOC</div><div style={{fontSize:16,fontWeight:600,color:'var(--g900)'}}>{levYoc}%</div></div>}
                  {dscr&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>DSCR</div><div style={{fontSize:16,fontWeight:600,color:parseFloat(dscr)>=1.25?'var(--g600)':parseFloat(dscr)>=1?'var(--amber)':'var(--red)'}}>{dscr}x</div></div>}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="card" style={{marginBottom:0}}>
              <div className="card-header"><span className="card-title">Notes</span></div>
              <textarea
                className="form-input"
                rows={4}
                style={{resize:'vertical',fontSize:13,lineHeight:1.6}}
                defaultValue={asset.notes||''}
                onBlur={e=>e.target.value!==asset.notes&&updateField('notes',e.target.value)}
                placeholder="Investment thesis, key highlights, watch items..."
              />
            </div>
          </div>
        </div>
      )}

      {/* ── FINANCIALS TAB ── */}
      {tab==='financials'&&(
        <div>
          <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:12,color:'var(--g700)'}}>
            💡 Monthly P&L entries come from the "+ P&L" button on the Asset Tracker. Enter data there and it flows here automatically.
          </div>
          {financials.length===0?(
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">No monthly P&L data yet</div>
              <div className="empty-state-desc">Go to <Link to="/assets" style={{color:'var(--g600)'}}>Asset Tracker</Link>, find this asset, and click "+ P&L" to add monthly data.</div>
            </div>
          ):(
            <>
              {chartData.some(d=>d.noi)&&(
                <div className="card">
                  <div className="card-header"><span className="card-title">Revenue vs NOI ($000s)</span></div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData}>
                      <XAxis dataKey="label" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                      <Tooltip formatter={(v,n)=>[`$${v}K`,n]} contentStyle={{fontSize:11,borderRadius:6}}/>
                      <Bar dataKey="revenue" fill="var(--g200)" name="Revenue" radius={[2,2,0,0]}/>
                      <Bar dataKey="noi" fill="var(--g600)" name="NOI" radius={[2,2,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="card">
                <div style={{overflowX:'auto'}}>
                  <table className="data-table">
                    <thead><tr><th>Period</th><th>Revenue</th><th>GOP</th><th>NOI</th><th>NOI Margin</th><th>Occupancy</th><th>ADR</th><th>RevPAR</th></tr></thead>
                    <tbody>
                      {[...financials].reverse().map(f=>{
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
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DEBT & COVENANTS TAB ── */}
      {tab==='debt'&&(
        <div>
          {debt.length===0?(
            <div className="empty-state">
              <div className="empty-state-icon">🏦</div>
              <div className="empty-state-title">No loans tracked for this asset</div>
              <div className="empty-state-desc">Go to <Link to="/debt" style={{color:'var(--g600)'}}>Debt & Covenants</Link> and add a loan for this property.</div>
            </div>
          ):debt.map(d=>{
            const days = d.maturity_date ? Math.ceil((new Date(d.maturity_date)-new Date())/(1000*60*60*24)) : null
            return (
              <div key={d.id} className="card">
                <div className="card-header">
                  <div>
                    <span className="card-title">{d.lender}</span>
                    <span style={{fontSize:11,color:'var(--gray500)',marginLeft:8}}>{d.loan_type?.replace('_',' ')} · {d.rate_type}</span>
                  </div>
                  <Link to="/debt"><button className="card-action">Edit in Debt Tracker →</button></Link>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10,marginBottom:16}}>
                  {[
                    ['Balance',fmtM(d.current_balance)],
                    ['Interest Rate',d.interest_rate?`${d.interest_rate}%`:'—'],
                    ['LTV',d.ltv?`${d.ltv}%`:'—'],
                    ['Annual DS',fmtM(d.debt_service_annual)],
                    ['Maturity',d.maturity_date?new Date(d.maturity_date).toLocaleDateString('en-US',{month:'short',year:'numeric'}):'—'],
                    ['Days to Maturity',days!==null?(days<0?`${Math.abs(days)} past`:`${days}d`):'—'],
                  ].map(([l,v])=>(
                    <div key={l} style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'10px 12px'}}>
                      <div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>{l}</div>
                      <div style={{fontSize:14,fontWeight:500,color:l==='Days to Maturity'&&days!==null&&days<=180?'var(--red)':'var(--g900)'}}>{v}</div>
                    </div>
                  ))}
                </div>
                {d.notes&&<div style={{fontSize:12,color:'var(--gray600)',marginTop:4}}>{d.notes}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* ── STR INTEL TAB ── */}
      {tab==='intel'&&(
        <div>
          {compData.length===0?(
            <div className="empty-state">
              <div className="empty-state-icon">📉</div>
              <div className="empty-state-title">No STR data for this asset</div>
              <div className="empty-state-desc">Go to <Link to="/intel" style={{color:'var(--g600)'}}>Competitive Intel</Link> and add monthly STR data for this property.</div>
            </div>
          ):(
            <>
              {latest&&(
                <div className="kpi-grid" style={{marginBottom:16}}>
                  {[
                    ['MPI (Occ. Index)',latest.occ_index,'Occupancy vs comp set'],
                    ['ARI (ADR Index)',latest.adr_index,'ADR vs comp set'],
                    ['RGI (RevPAR Index)',latest.revpar_index,'RevPAR vs comp set — 100 = fair share'],
                  ].map(([label,val,sub])=>{
                    const v = val?parseFloat(val):null
                    const color = !v?'var(--gray500)':v>=105?'var(--g600)':v>=95?'var(--amber)':'var(--red)'
                    return <KPICard key={label} label={label} value={v?v.toFixed(1):null} sub={sub} color={color}/>
                  })}
                  <KPICard label="Latest Period" value={latest?`${MONTHS[latest.period_month-1]} ${latest.period_year}`:null}/>
                </div>
              )}
              <div className="card">
                <div style={{overflowX:'auto'}}>
                  <table className="data-table">
                    <thead><tr><th>Period</th><th>My Occ.</th><th>My ADR</th><th>My RevPAR</th><th>MPI</th><th>ARI</th><th>RGI</th></tr></thead>
                    <tbody>
                      {compData.map(d=>{
                        const rgi = d.revpar_index?parseFloat(d.revpar_index):null
                        return (
                          <tr key={d.id}>
                            <td><strong>{MONTHS[d.period_month-1]} {d.period_year}</strong></td>
                            <td>{d.my_occupancy?`${parseFloat(d.my_occupancy).toFixed(1)}%`:'—'}</td>
                            <td>{d.my_adr?`$${parseFloat(d.my_adr).toFixed(0)}`:'—'}</td>
                            <td>{d.my_revpar?`$${parseFloat(d.my_revpar).toFixed(0)}`:'—'}</td>
                            <td style={{color:d.occ_index?(parseFloat(d.occ_index)>=105?'var(--g600)':parseFloat(d.occ_index)>=95?'var(--amber)':'var(--red)'):'var(--gray500)',fontWeight:500}}>{d.occ_index?parseFloat(d.occ_index).toFixed(1):'—'}</td>
                            <td style={{color:d.adr_index?(parseFloat(d.adr_index)>=105?'var(--g600)':parseFloat(d.adr_index)>=95?'var(--amber)':'var(--red)'):'var(--gray500)',fontWeight:500}}>{d.adr_index?parseFloat(d.adr_index).toFixed(1):'—'}</td>
                            <td style={{color:rgi?(rgi>=105?'var(--g600)':rgi>=95?'var(--amber)':'var(--red)'):'var(--gray500)',fontWeight:700}}>{rgi?rgi.toFixed(1):'—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
