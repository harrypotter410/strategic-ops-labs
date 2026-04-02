import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

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

function EditSelect({ value, options, onSave }) {
  const [editing, setEditing] = useState(false)
  const label = options.find(o=>o.value===value)?.label || value || '—'
  if (editing) return (
    <select className="form-select" style={{fontSize:12,padding:'3px 8px'}} value={value||''} onChange={e=>{onSave(e.target.value);setEditing(false)}} onBlur={()=>setEditing(false)} autoFocus>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
  return (
    <div style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer'}} onClick={()=>setEditing(true)} title="Click to edit">
      <span style={{fontWeight:500,color:'var(--g900)'}}>{label}</span>
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

// ── INDEX COLOR HELPER ──
const indexColor = (v) => {
  if (!v) return 'var(--gray500)'
  const n = parseFloat(v)
  return n>=105?'var(--g600)':n>=95?'var(--amber)':'var(--red)'
}

export default function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(null)
  const [financials, setFinancials] = useState([])
  const [compData, setCompData] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [saving, setSaving] = useState(false)

  // ── P&L form state ──
  const now = new Date()
  const [pnlPeriod, setPnlPeriod] = useState({ month: now.getMonth()+1, year: now.getFullYear() })
  const blankPnl = { revenue:'', gop:'', noi:'', occupancy:'', adr:'', revpar:'', budget_revenue:'', budget_noi:'' }
  const [pnlForm, setPnlForm] = useState(blankPnl)
  const [pnlSaving, setPnlSaving] = useState(false)
  const [pnlStatus, setPnlStatus] = useState(null)

  // ── STR Intel form state ──
  const [intelPeriod, setIntelPeriod] = useState({ month: now.getMonth()+1, year: now.getFullYear() })
  const blankIntel = { occ_index:'', adr_index:'', revpar_index:'', comp_set_occ:'', comp_set_adr:'', comp_set_revpar:'' }
  const [intelForm, setIntelForm] = useState(blankIntel)
  const [intelSaving, setIntelSaving] = useState(false)
  const [intelStatus, setIntelStatus] = useState(null)

  // ── Initial load ──
  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      supabase.from('assets').select('*').eq('id', id).single(),
      supabase.from('financials').select('*').eq('asset_id', id).order('period_year').order('period_month'),
      supabase.from('comp_data').select('*').eq('asset_id', id).order('period_year',{ascending:false}).order('period_month',{ascending:false}),
    ]).then(([a, f, c]) => {
      if (a.error || !a.data) { navigate('/assets'); return }
      setAsset(a.data)
      setFinancials(f.data||[])
      setCompData(c.data||[])
      setLoading(false)
    })
  }, [id])

  // ── Auto-prefill P&L form when period changes ──
  useEffect(() => {
    const existing = financials.find(h => h.period_month===pnlPeriod.month && h.period_year===pnlPeriod.year)
    if (existing) {
      setPnlForm({
        revenue: existing.revenue ?? '',
        gop: existing.gop ?? '',
        noi: existing.noi ?? '',
        occupancy: existing.occupancy ?? '',
        adr: existing.adr ?? '',
        revpar: existing.revpar ?? '',
        budget_revenue: existing.budget_revenue ?? '',
        budget_noi: existing.budget_noi ?? '',
      })
    } else {
      setPnlForm(blankPnl)
    }
  }, [pnlPeriod, financials])

  // ── Auto-prefill Intel form when period changes ──
  useEffect(() => {
    const existing = compData.find(d => d.period_month===intelPeriod.month && d.period_year===intelPeriod.year)
    if (existing) {
      setIntelForm({
        occ_index: existing.occ_index ?? '',
        adr_index: existing.adr_index ?? '',
        revpar_index: existing.revpar_index ?? '',
        comp_set_occ: existing.comp_set_occ ?? '',
        comp_set_adr: existing.comp_set_adr ?? '',
        comp_set_revpar: existing.comp_set_revpar ?? '',
      })
    } else {
      setIntelForm(blankIntel)
    }
  }, [intelPeriod, compData])

  // ── Field updater for asset record ──
  const updateField = async (field, rawVal) => {
    const numFields = ['acquisition_price','current_value','noi_trailing','debt_service_annual','cap_rate','rooms','year_acquired','year_built','hold_period_years','target_exit_year','target_exit_cap_rate','projected_exit_value','actual_irr','actual_exit_value']
    const val = numFields.includes(field) ? (rawVal?parseFloat(rawVal):null) : rawVal||null
    setSaving(true)
    const { data, error } = await supabase.from('assets').update({[field]:val}).eq('id',id).select().single()
    if (!error && data) setAsset(data)
    setSaving(false)
  }

  // ── Save P&L entry ──
  const savePnl = async () => {
    setPnlSaving(true)
    setPnlStatus(null)
    const { error } = await supabase.from('financials').upsert({
      asset_id: id,
      period_month: pnlPeriod.month,
      period_year: pnlPeriod.year,
      revenue: pnlForm.revenue!=='' ? parseFloat(pnlForm.revenue) : null,
      gop: pnlForm.gop!=='' ? parseFloat(pnlForm.gop) : null,
      noi: pnlForm.noi!=='' ? parseFloat(pnlForm.noi) : null,
      occupancy: pnlForm.occupancy!=='' ? parseFloat(pnlForm.occupancy) : null,
      adr: pnlForm.adr!=='' ? parseFloat(pnlForm.adr) : null,
      revpar: pnlForm.revpar!=='' ? parseFloat(pnlForm.revpar) : null,
      budget_revenue: pnlForm.budget_revenue!=='' ? parseFloat(pnlForm.budget_revenue) : null,
      budget_noi: pnlForm.budget_noi!=='' ? parseFloat(pnlForm.budget_noi) : null,
    }, { onConflict: 'asset_id,period_month,period_year' })

    if (error) {
      setPnlStatus({ type:'error', msg: error.message })
      setPnlSaving(false)
      return
    }

    // If NOI was entered, update noi_trailing = noi * 12 on the asset
    if (pnlForm.noi !== '') {
      const { data: updated } = await supabase
        .from('assets')
        .update({ noi_trailing: parseFloat(pnlForm.noi) * 12 })
        .eq('id', id)
        .select()
        .single()
      if (updated) setAsset(updated)
    }

    // Refresh financials list
    const { data: refreshed } = await supabase
      .from('financials').select('*').eq('asset_id', id)
      .order('period_year').order('period_month')
    setFinancials(refreshed || [])

    setPnlStatus({ type:'success', msg:'Saved' })
    setPnlSaving(false)
  }

  // ── Save STR Intel entry ──
  const saveIntel = async () => {
    setIntelSaving(true)
    setIntelStatus(null)
    const { error } = await supabase.from('comp_data').upsert({
      asset_id: id,
      period_month: intelPeriod.month,
      period_year: intelPeriod.year,
      occ_index: intelForm.occ_index!=='' ? parseFloat(intelForm.occ_index) : null,
      adr_index: intelForm.adr_index!=='' ? parseFloat(intelForm.adr_index) : null,
      revpar_index: intelForm.revpar_index!=='' ? parseFloat(intelForm.revpar_index) : null,
      comp_set_occ: intelForm.comp_set_occ!=='' ? parseFloat(intelForm.comp_set_occ) : null,
      comp_set_adr: intelForm.comp_set_adr!=='' ? parseFloat(intelForm.comp_set_adr) : null,
      comp_set_revpar: intelForm.comp_set_revpar!=='' ? parseFloat(intelForm.comp_set_revpar) : null,
    }, { onConflict: 'asset_id,period_month,period_year' })

    if (error) {
      setIntelStatus({ type:'error', msg: error.message })
      setIntelSaving(false)
      return
    }

    // Refresh comp data list
    const { data: refreshed } = await supabase
      .from('comp_data').select('*').eq('asset_id', id)
      .order('period_year',{ascending:false}).order('period_month',{ascending:false})
    setCompData(refreshed || [])

    setIntelStatus({ type:'success', msg:'Saved' })
    setIntelSaving(false)
  }

  if (loading) return <div className="loading">Loading asset...</div>
  if (!asset) return null

  // ── Derived metrics ──
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
  const statusInfo = STATUSES.find(s=>s.value===asset.status)||STATUSES[0]

  // ── Chart data (last 12 months) ──
  const chartData = financials.slice(-12).map(f=>({
    label:`${MONTHS[f.period_month-1].slice(0,3)} ${String(f.period_year).slice(2)}`,
    revenue: f.revenue ? Math.round(parseFloat(f.revenue)/1000) : null,
    noi: f.noi ? Math.round(parseFloat(f.noi)/1000) : null,
  }))

  const latestComp = compData[0]

  const tabStyle = (t) => ({
    fontSize:13,padding:'7px 18px',borderRadius:20,border:'1px solid',cursor:'pointer',
    fontWeight:tab===t?500:400,
    borderColor:tab===t?'var(--g600)':'var(--gray200)',
    background:tab===t?'var(--g700)':'var(--white)',
    color:tab===t?'var(--white)':'var(--gray700)',
    transition:'all .12s'
  })

  const statusOptions = STATUSES.map(s=>({ value:s.value, label:s.label }))

  return (
    <div>
      {/* ── Header ── */}
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
              <span style={{fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:10,background:statusInfo.bg,color:statusInfo.color}}>{statusInfo.label}</span>
              {saving&&<span style={{fontSize:10,color:'var(--g600)'}}>Saving...</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
        {[['overview','Overview'],['exit','Exit & Returns'],['pnl','Monthly P&L'],['intel','STR Intel']].map(([t,l])=>(
          <button key={t} style={tabStyle(t)} onClick={()=>setTab(t)}>{l}</button>
        ))}
      </div>

      {/* ══ OVERVIEW TAB ══ */}
      {tab==='overview'&&(
        <div>
          {/* Top KPI cards */}
          <div className="kpi-grid" style={{marginBottom:20}}>
            <KPICard label="Acquisition Price" value={fmtM(asset.acquisition_price)}/>
            <KPICard
              label="Current Value"
              value={fmtM(asset.current_value)}
              sub={gain!==null?`${gain>=0?'+':''}${fmtM(gain)} (${gain>=0?'+':''}${gainPct}%)`:'Click pencil to update'}
              color={gain>0?'var(--g600)':gain<0?'var(--red)':undefined}
            />
            <KPICard label="Unlevered YOC" value={yoc?`${yoc}%`:null} sub="NOI ÷ Acq. Price"/>
            <KPICard label="DSCR" value={dscr?`${dscr}x`:null} sub="NOI ÷ Debt Service" color={dscr?(parseFloat(dscr)>=1.25?'var(--g600)':parseFloat(dscr)>=1?'var(--amber)':'var(--red)'):undefined}/>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            {/* Investment fields */}
            <div className="card" style={{marginBottom:0}}>
              <div className="card-header">
                <span className="card-title">Investment fields</span>
                <span style={{fontSize:10,color:'var(--gray500)'}}>Click any value to edit</span>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:0}}>
                {[
                  ['Acquisition Price','acquisition_price','number','$'],
                  ['Current Value','current_value','number','$'],
                  ['Trailing NOI (T12)','noi_trailing','number','$'],
                  ['Annual Debt Service','debt_service_annual','number','$'],
                  ['Entry Cap Rate','cap_rate','number','','%'],
                  ['Rooms','rooms','number'],
                  ['Brand / Flag','brand','text'],
                  ['Market','market','text'],
                  ['Address','address','text'],
                  ['Year Acquired','year_acquired','number'],
                  ['Year Built','year_built','number'],
                ].map(([label,field,type,prefix='',suffix=''])=>(
                  <div key={field} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid var(--gray100)'}}>
                    <span style={{fontSize:12,color:'var(--gray600)'}}>{label}</span>
                    <EditField label={label} value={asset[field]} onSave={v=>updateField(field,v)} type={type} prefix={prefix} suffix={suffix}/>
                  </div>
                ))}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid var(--gray100)'}}>
                  <span style={{fontSize:12,color:'var(--gray600)'}}>Status</span>
                  <EditSelect value={asset.status} options={statusOptions} onSave={v=>updateField('status',v)}/>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <div className="card" style={{marginBottom:0}}>
                <div className="card-header"><span className="card-title">Notes</span></div>
                <textarea
                  className="form-input"
                  rows={6}
                  style={{resize:'vertical',fontSize:13,lineHeight:1.6}}
                  defaultValue={asset.notes||''}
                  onBlur={e=>e.target.value!==(asset.notes||'')&&updateField('notes',e.target.value)}
                  placeholder="Investment thesis, key highlights, watch items..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ EXIT & RETURNS TAB ══ */}
      {tab==='exit'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {/* Exit assumptions — inline edit */}
          <div className="card" style={{marginBottom:0}}>
            <div className="card-header">
              <span className="card-title">Exit assumptions</span>
              <span style={{fontSize:10,color:'var(--gray500)'}}>Click any value to edit</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              {[
                ['Hold Period (years)','hold_period_years','number'],
                ['Target Exit Year','target_exit_year','number'],
                ['Target Exit Cap Rate','target_exit_cap_rate','number','','%'],
                ['Projected Exit Value','projected_exit_value','number','$'],
                ['Actual Exit Date','actual_exit_date','text'],
                ['Actual Exit Value','actual_exit_value','number','$'],
                ['Actual Realized IRR','actual_irr','number','','%'],
              ].map(([label,field,type,prefix='',suffix=''])=>(
                <div key={field} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 0',borderBottom:'1px solid var(--gray100)'}}>
                  <span style={{fontSize:12,color:'var(--gray600)'}}>{label}</span>
                  <EditField label={label} value={asset[field]} onSave={v=>updateField(field,v)} type={type} prefix={prefix} suffix={suffix}/>
                </div>
              ))}
            </div>
          </div>

          {/* Live preview panel */}
          <div className="card" style={{marginBottom:0}}>
            <div className="card-header"><span className="card-title">Live return preview</span></div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:8,padding:'12px 14px'}}>
                <div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Proj. IRR</div>
                <div style={{fontSize:26,fontFamily:'Playfair Display,serif',fontWeight:700,color:projIRR?(projIRR>=15?'var(--g600)':projIRR>=12?'var(--amber)':'var(--red)'):'var(--gray400)'}}>
                  {projIRR?`${projIRR}%`:'—'}
                </div>
                <div style={{fontSize:9,color:'var(--gray400)',marginTop:2}}>auto-calculated</div>
              </div>
              <div style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'12px 14px'}}>
                <div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Equity Multiple</div>
                <div style={{fontSize:26,fontFamily:'Playfair Display,serif',fontWeight:700,color:'var(--g900)'}}>{equityMultiple?`${equityMultiple}x`:'—'}</div>
              </div>
              <div style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'12px 14px'}}>
                <div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Levered YOC</div>
                <div style={{fontSize:22,fontFamily:'Playfair Display,serif',fontWeight:600,color:'var(--g900)'}}>{levYoc?`${levYoc}%`:'—'}</div>
                <div style={{fontSize:9,color:'var(--gray400)',marginTop:2}}>(NOI−DS) ÷ Acq. Price</div>
              </div>
              <div style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'12px 14px'}}>
                <div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:4}}>Years to Exit</div>
                <div style={{fontSize:22,fontFamily:'Playfair Display,serif',fontWeight:600,color:yearsToExit!==null&&yearsToExit<=0?'var(--red)':yearsToExit!==null&&yearsToExit<=2?'var(--amber)':'var(--g900)'}}>
                  {yearsToExit!==null?(yearsToExit<0?`${Math.abs(yearsToExit)}y past`:`${yearsToExit}y`):'—'}
                </div>
              </div>
            </div>

            <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:8,padding:'10px 14px',fontSize:11,color:'var(--g700)',lineHeight:1.7}}>
              <strong>How IRR is calculated:</strong><br/>
              Projected IRR = discount rate where NPV of (annual CFs + exit proceeds) = $0.<br/>
              Annual CF = NOI − Debt Service · Hold years = Target Exit Year − Year Acquired
            </div>
          </div>
        </div>
      )}

      {/* ══ MONTHLY P&L TAB ══ */}
      {tab==='pnl'&&(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            {/* Entry form */}
            <div className="card" style={{marginBottom:0}}>
              <div className="card-header"><span className="card-title">Enter Monthly P&L</span></div>

              {/* Period selector */}
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                <div className="form-group" style={{flex:1,margin:0}}>
                  <label className="form-label">Month</label>
                  <select className="form-select" value={pnlPeriod.month} onChange={e=>setPnlPeriod(p=>({...p,month:parseInt(e.target.value)}))}>
                    {MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{flex:1,margin:0}}>
                  <label className="form-label">Year</label>
                  <input className="form-input" type="number" value={pnlPeriod.year} onChange={e=>setPnlPeriod(p=>({...p,year:parseInt(e.target.value)||p.year}))}/>
                </div>
              </div>

              {pnlStatus&&(
                <div style={{background:pnlStatus.type==='success'?'var(--g100)':'var(--redL)',color:pnlStatus.type==='success'?'var(--g700)':'var(--red)',padding:'7px 12px',borderRadius:7,fontSize:12,marginBottom:12}}>
                  {pnlStatus.type==='success'?'Saved successfully':'Error: '+pnlStatus.msg}
                </div>
              )}

              <div className="form-grid-2" style={{marginBottom:8}}>
                <div className="form-group"><label className="form-label">Revenue ($)</label><input className="form-input" type="number" value={pnlForm.revenue} onChange={e=>setPnlForm(f=>({...f,revenue:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">GOP ($)</label><input className="form-input" type="number" value={pnlForm.gop} onChange={e=>setPnlForm(f=>({...f,gop:e.target.value}))}/></div>
              </div>
              <div className="form-group" style={{marginBottom:8}}>
                <label className="form-label">NOI ($) <span style={{fontSize:9,color:'var(--gray400)'}}>— also updates Trailing NOI on asset (×12)</span></label>
                <input className="form-input" type="number" value={pnlForm.noi} onChange={e=>setPnlForm(f=>({...f,noi:e.target.value}))}/>
              </div>
              <div className="form-grid-2" style={{marginBottom:8}}>
                <div className="form-group"><label className="form-label">Occupancy (%)</label><input className="form-input" type="number" step="0.1" value={pnlForm.occupancy} onChange={e=>setPnlForm(f=>({...f,occupancy:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">ADR ($)</label><input className="form-input" type="number" value={pnlForm.adr} onChange={e=>setPnlForm(f=>({...f,adr:e.target.value}))}/></div>
              </div>
              <div className="form-group" style={{marginBottom:8}}>
                <label className="form-label">RevPAR ($)</label>
                <input className="form-input" type="number" value={pnlForm.revpar} onChange={e=>setPnlForm(f=>({...f,revpar:e.target.value}))}/>
              </div>
              <div className="form-grid-2" style={{marginBottom:14}}>
                <div className="form-group"><label className="form-label">Budget Revenue ($)</label><input className="form-input" type="number" value={pnlForm.budget_revenue} onChange={e=>setPnlForm(f=>({...f,budget_revenue:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Budget NOI ($)</label><input className="form-input" type="number" value={pnlForm.budget_noi} onChange={e=>setPnlForm(f=>({...f,budget_noi:e.target.value}))}/></div>
              </div>
              <button className="btn btn-primary" onClick={savePnl} disabled={pnlSaving} style={{width:'100%'}}>
                {pnlSaving?'Saving...':'Save P&L'}
              </button>
            </div>

            {/* Bar chart */}
            <div className="card" style={{marginBottom:0}}>
              <div className="card-header"><span className="card-title">Revenue vs NOI ($000s) — last 12 months</span></div>
              {chartData.some(d=>d.noi||d.revenue)?(
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="label" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                    <Tooltip formatter={(v,n)=>[`$${v}K`,n]} contentStyle={{fontSize:11,borderRadius:6}}/>
                    <Bar dataKey="revenue" fill="var(--g200)" name="Revenue" radius={[2,2,0,0]}/>
                    <Bar dataKey="noi" fill="var(--g600)" name="NOI" radius={[2,2,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              ):(
                <div style={{fontSize:12,color:'var(--gray500)',textAlign:'center',padding:'40px 20px'}}>
                  No P&L data yet — save a period on the left.
                </div>
              )}
            </div>
          </div>

          {/* History table */}
          {financials.length>0&&(
            <div className="card">
              <div className="card-header"><span className="card-title">P&L history</span><span style={{fontSize:10,color:'var(--gray500)'}}>Click a row to load that period into the form</span></div>
              <div style={{overflowX:'auto'}}>
                <table className="data-table">
                  <thead><tr><th>Period</th><th>Revenue</th><th>GOP</th><th>NOI</th><th>NOI Margin</th><th>Occ %</th><th>ADR</th><th>RevPAR</th></tr></thead>
                  <tbody>
                    {[...financials].reverse().map(f=>{
                      const margin = f.revenue&&f.noi ? ((parseFloat(f.noi)/parseFloat(f.revenue))*100).toFixed(1) : null
                      const isActive = pnlPeriod.month===f.period_month && pnlPeriod.year===f.period_year
                      return (
                        <tr key={f.id} style={{cursor:'pointer',background:isActive?'var(--g50)':undefined}}
                          onClick={()=>setPnlPeriod({month:f.period_month,year:f.period_year})}>
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
          )}
        </div>
      )}

      {/* ══ STR INTEL TAB ══ */}
      {tab==='intel'&&(
        <div>
          {/* Latest KPI cards */}
          {latestComp&&(
            <div className="kpi-grid" style={{marginBottom:16}}>
              {[
                ['MPI (Occ. Index)',latestComp.occ_index,'Occupancy vs comp set'],
                ['ARI (ADR Index)',latestComp.adr_index,'ADR vs comp set'],
                ['RGI (RevPAR Index)',latestComp.revpar_index,'RevPAR vs comp set — 100 = fair share'],
              ].map(([label,val,sub])=>{
                const v = val ? parseFloat(val) : null
                return <KPICard key={label} label={label} value={v?v.toFixed(1):null} sub={sub} color={indexColor(v)}/>
              })}
              <KPICard label="Latest Period" value={`${MONTHS[latestComp.period_month-1]} ${latestComp.period_year}`}/>
            </div>
          )}

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            {/* Entry form */}
            <div className="card" style={{marginBottom:0}}>
              <div className="card-header"><span className="card-title">Enter STR Data</span></div>

              <div style={{display:'flex',gap:8,marginBottom:14}}>
                <div className="form-group" style={{flex:1,margin:0}}>
                  <label className="form-label">Month</label>
                  <select className="form-select" value={intelPeriod.month} onChange={e=>setIntelPeriod(p=>({...p,month:parseInt(e.target.value)}))}>
                    {MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{flex:1,margin:0}}>
                  <label className="form-label">Year</label>
                  <input className="form-input" type="number" value={intelPeriod.year} onChange={e=>setIntelPeriod(p=>({...p,year:parseInt(e.target.value)||p.year}))}/>
                </div>
              </div>

              {intelStatus&&(
                <div style={{background:intelStatus.type==='success'?'var(--g100)':'var(--redL)',color:intelStatus.type==='success'?'var(--g700)':'var(--red)',padding:'7px 12px',borderRadius:7,fontSize:12,marginBottom:12}}>
                  {intelStatus.type==='success'?'Saved successfully':'Error: '+intelStatus.msg}
                </div>
              )}

              <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--g600)',marginBottom:8}}>STR Indices (subject property)</div>
              <div className="form-grid-2" style={{marginBottom:8}}>
                <div className="form-group"><label className="form-label">MPI — Occ. Index</label><input className="form-input" type="number" step="0.1" value={intelForm.occ_index} onChange={e=>setIntelForm(f=>({...f,occ_index:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">ARI — ADR Index</label><input className="form-input" type="number" step="0.1" value={intelForm.adr_index} onChange={e=>setIntelForm(f=>({...f,adr_index:e.target.value}))}/></div>
              </div>
              <div className="form-group" style={{marginBottom:12}}>
                <label className="form-label">RGI — RevPAR Index</label>
                <input className="form-input" type="number" step="0.1" value={intelForm.revpar_index} onChange={e=>setIntelForm(f=>({...f,revpar_index:e.target.value}))}/>
              </div>

              <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--g600)',marginBottom:8}}>Comp set actuals</div>
              <div className="form-grid-2" style={{marginBottom:8}}>
                <div className="form-group"><label className="form-label">Comp Set Occ (%)</label><input className="form-input" type="number" step="0.1" value={intelForm.comp_set_occ} onChange={e=>setIntelForm(f=>({...f,comp_set_occ:e.target.value}))}/></div>
                <div className="form-group"><label className="form-label">Comp Set ADR ($)</label><input className="form-input" type="number" value={intelForm.comp_set_adr} onChange={e=>setIntelForm(f=>({...f,comp_set_adr:e.target.value}))}/></div>
              </div>
              <div className="form-group" style={{marginBottom:14}}>
                <label className="form-label">Comp Set RevPAR ($)</label>
                <input className="form-input" type="number" value={intelForm.comp_set_revpar} onChange={e=>setIntelForm(f=>({...f,comp_set_revpar:e.target.value}))}/>
              </div>
              <button className="btn btn-primary" onClick={saveIntel} disabled={intelSaving} style={{width:'100%'}}>
                {intelSaving?'Saving...':'Save STR Data'}
              </button>
            </div>

            {/* Info card */}
            <div className="card" style={{marginBottom:0}}>
              <div className="card-header"><span className="card-title">Index guide</span></div>
              <div style={{fontSize:12,color:'var(--gray700)',lineHeight:1.8}}>
                <div style={{marginBottom:12}}>
                  <strong>MPI</strong> (Market Penetration Index) — your occupancy ÷ comp set occupancy × 100.<br/>
                  <strong>ARI</strong> (ADR Index) — your ADR ÷ comp set ADR × 100.<br/>
                  <strong>RGI</strong> (RevPAR Index) — your RevPAR ÷ comp set RevPAR × 100.
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:10,height:10,borderRadius:'50%',background:'var(--g600)',display:'inline-block'}}></span>
                    <span><strong style={{color:'var(--g600)'}}>≥ 105</strong> — outperforming comp set</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:10,height:10,borderRadius:'50%',background:'var(--amber)',display:'inline-block'}}></span>
                    <span><strong style={{color:'var(--amber)'}}>95–104</strong> — at or near fair share</span>
                  </div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:10,height:10,borderRadius:'50%',background:'var(--red)',display:'inline-block'}}></span>
                    <span><strong style={{color:'var(--red)'}}>&lt; 95</strong> — underperforming comp set</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* History table */}
          {compData.length>0&&(
            <div className="card">
              <div className="card-header"><span className="card-title">STR history</span><span style={{fontSize:10,color:'var(--gray500)'}}>Click a row to load that period</span></div>
              <div style={{overflowX:'auto'}}>
                <table className="data-table">
                  <thead><tr><th>Period</th><th>MPI</th><th>ARI</th><th>RGI</th><th>Comp Occ</th><th>Comp ADR</th><th>Comp RevPAR</th></tr></thead>
                  <tbody>
                    {compData.map(d=>{
                      const isActive = intelPeriod.month===d.period_month && intelPeriod.year===d.period_year
                      return (
                        <tr key={d.id} style={{cursor:'pointer',background:isActive?'var(--g50)':undefined}}
                          onClick={()=>setIntelPeriod({month:d.period_month,year:d.period_year})}>
                          <td><strong>{MONTHS[d.period_month-1]} {d.period_year}</strong></td>
                          <td style={{color:indexColor(d.occ_index),fontWeight:500}}>{d.occ_index?parseFloat(d.occ_index).toFixed(1):'—'}</td>
                          <td style={{color:indexColor(d.adr_index),fontWeight:500}}>{d.adr_index?parseFloat(d.adr_index).toFixed(1):'—'}</td>
                          <td style={{color:indexColor(d.revpar_index),fontWeight:700}}>{d.revpar_index?parseFloat(d.revpar_index).toFixed(1):'—'}</td>
                          <td>{d.comp_set_occ?`${parseFloat(d.comp_set_occ).toFixed(1)}%`:'—'}</td>
                          <td>{d.comp_set_adr?`$${parseFloat(d.comp_set_adr).toFixed(0)}`:'—'}</td>
                          <td>{d.comp_set_revpar?`$${parseFloat(d.comp_set_revpar).toFixed(0)}`:'—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {compData.length===0&&(
            <div className="empty-state">
              <div className="empty-state-icon">📉</div>
              <div className="empty-state-title">No STR data yet</div>
              <div className="empty-state-desc">Enter monthly STR index data using the form above.</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
