import { useState, useEffect } from 'react'
import { useAssets } from '../hooks/useData'
import { Link } from 'react-router-dom'
import { geocodeAddress } from './PortfolioMap'
import { supabase } from '../lib/supabase'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'
const TYPES = ['hotel','resort','mixed','commercial']
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
const statusStyle = (s) => STATUSES.find(x=>x.value===s) || { color:'var(--gray500)', bg:'var(--gray100)', label:s }

function SortHeader({ label, field, sort, onSort }) {
  const active = sort.field === field
  return <th className={active?(sort.dir==='asc'?'sorted-asc':'sorted-desc'):''} onClick={()=>onSort(field)}>{label}<span className="sort-icon">{active?(sort.dir==='asc'?'↑':'↓'):'↕'}</span></th>
}

function InlineCell({ value, onSave, type='text', format }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value||'')
  const commit = async () => { setEditing(false); if (String(val) !== String(value)) await onSave(val) }
  if (editing) return <input className="inline-edit-input" type={type} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape')setEditing(false)}} autoFocus/>
  return <span className="inline-edit editable-cell" onClick={()=>setEditing(true)} title="Click to edit">{format?format(value):(value||'—')}<span className="edit-pencil">✎</span></span>
}

// Full asset modal with ALL fields including exit/hold analysis
function AssetModal({ asset, onClose, onSave }) {
  const [tab, setTab] = useState('basics')
  const blankForm = {
    name:'', market:'', type:'hotel', status:'stabilized', rooms:'', brand:'',
    year_acquired:'', year_built:'', address:'',
    acquisition_price:'', current_value:'', cap_rate:'',
    noi_trailing:'', debt_service_annual:'',
    // Exit / hold period fields
    hold_period_years:'', target_exit_year:'', target_exit_cap_rate:'',
    projected_exit_value:'', actual_exit_date:'', actual_exit_value:'', actual_irr:'',
    notes:''
  }
  const [form, setForm] = useState(asset ? { ...blankForm, ...asset } : blankForm)
  const [loading, setLoading] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [error, setError] = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  // Live preview calcs
  const yoc = form.noi_trailing&&form.acquisition_price ? ((parseFloat(form.noi_trailing)/parseFloat(form.acquisition_price))*100).toFixed(2) : null
  const levYoc = form.noi_trailing&&form.debt_service_annual&&form.acquisition_price ? (((parseFloat(form.noi_trailing)-parseFloat(form.debt_service_annual))/parseFloat(form.acquisition_price))*100).toFixed(2) : null
  const gain = form.acquisition_price&&form.current_value ? parseFloat(form.current_value)-parseFloat(form.acquisition_price) : null
  const projGain = form.projected_exit_value&&form.acquisition_price ? parseFloat(form.projected_exit_value)-parseFloat(form.acquisition_price) : null
  const equityMultiple = form.projected_exit_value&&form.acquisition_price ? (parseFloat(form.projected_exit_value)/parseFloat(form.acquisition_price)).toFixed(2) : null

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Property name is required.'); return }
    if (!form.market.trim()) { setError('Market is required.'); return }
    setLoading(true); setError('')
    let lat=form.latitude||null, lng=form.longitude||null
    if (!lat||!lng) {
      setGeocoding(true)
      const q = form.address?`${form.address}, ${form.market}`:`${form.name}, ${form.market}`
      const coords = await geocodeAddress(q)
      if (coords){lat=coords.lat;lng=coords.lng}
      else{const m=await geocodeAddress(form.market);if(m){lat=m.lat;lng=m.lng}}
      setGeocoding(false)
    }
    const payload = {
      name:form.name.trim(), market:form.market.trim(), type:form.type, status:form.status,
      rooms:form.rooms?parseInt(form.rooms):null,
      brand:form.brand||null,
      year_acquired:form.year_acquired?parseInt(form.year_acquired):null,
      year_built:form.year_built?parseInt(form.year_built):null,
      address:form.address||null,
      acquisition_price:form.acquisition_price?parseFloat(form.acquisition_price):null,
      current_value:form.current_value?parseFloat(form.current_value):null,
      cap_rate:form.cap_rate?parseFloat(form.cap_rate):null,
      noi_trailing:form.noi_trailing?parseFloat(form.noi_trailing):null,
      debt_service_annual:form.debt_service_annual?parseFloat(form.debt_service_annual):null,
      // Exit / hold analysis
      hold_period_years:form.hold_period_years?parseInt(form.hold_period_years):null,
      target_exit_year:form.target_exit_year?parseInt(form.target_exit_year):null,
      target_exit_cap_rate:form.target_exit_cap_rate?parseFloat(form.target_exit_cap_rate):null,
      projected_exit_value:form.projected_exit_value?parseFloat(form.projected_exit_value):null,
      actual_exit_date:form.actual_exit_date||null,
      actual_exit_value:form.actual_exit_value?parseFloat(form.actual_exit_value):null,
      actual_irr:form.actual_irr?parseFloat(form.actual_irr):null,
      notes:form.notes||null, latitude:lat, longitude:lng,
    }
    const { error } = await onSave(payload)
    if (error){setError(error.message);setLoading(false);return}
    setLoading(false); onClose()
  }

  const tabStyle = (t) => ({ fontSize:12,padding:'5px 14px',borderRadius:20,border:'1px solid',cursor:'pointer',borderColor:tab===t?'var(--g600)':'var(--gray200)',background:tab===t?'var(--g700)':'var(--white)',color:tab===t?'var(--white)':'var(--gray700)' })

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:560}}>
        <div className="modal-header">
          <span className="modal-title">{asset?'Edit Asset':'Add Asset'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error&&<div style={{background:'var(--redL)',color:'var(--red)',padding:'8px 12px',borderRadius:7,fontSize:12,marginBottom:12}}>{error}</div>}

        {/* Tab switcher */}
        <div style={{display:'flex',gap:6,marginBottom:16}}>
          {[['basics','Basics'],['financials','Financials'],['exit','Exit & Hold']].map(([t,l])=>(
            <button key={t} style={tabStyle(t)} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </div>

        {/* BASICS TAB */}
        {tab==='basics'&&(<>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Property Name *</label><input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Market *</label><input className="form-input" value={form.market} onChange={e=>set('market',e.target.value)} placeholder="Memphis, TN"/></div>
          </div>
          <div className="form-group"><label className="form-label">Address <span style={{fontSize:10,color:'var(--gray400)'}}>— for map pin</span></label>
            <input className="form-input" value={form.address||''} onChange={e=>set('address',e.target.value)} placeholder="149 Union Ave, Memphis, TN 38103"/>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={e=>set('type',e.target.value)}>
                {TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={e=>set('status',e.target.value)}>
                {STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Rooms</label><input className="form-input" type="number" value={form.rooms||''} onChange={e=>set('rooms',e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Brand / Flag</label><input className="form-input" value={form.brand||''} onChange={e=>set('brand',e.target.value)}/></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Year Acquired</label><input className="form-input" type="number" value={form.year_acquired||''} onChange={e=>set('year_acquired',e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Year Built</label><input className="form-input" type="number" value={form.year_built||''} onChange={e=>set('year_built',e.target.value)}/></div>
          </div>
          <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes||''} onChange={e=>set('notes',e.target.value)} style={{resize:'vertical'}}/></div>
        </>)}

        {/* FINANCIALS TAB */}
        {tab==='financials'&&(<>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Acquisition Price ($)</label><input className="form-input" type="number" value={form.acquisition_price||''} onChange={e=>set('acquisition_price',e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Current Value ($)</label><input className="form-input" type="number" value={form.current_value||''} onChange={e=>set('current_value',e.target.value)}/></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label tooltip-wrap">Trailing NOI ($) ⓘ<div className="tooltip">Net Operating Income — trailing 12 months. Used to calculate YOC and DSCR.</div></label>
              <input className="form-input" type="number" value={form.noi_trailing||''} onChange={e=>set('noi_trailing',e.target.value)} placeholder="8200000"/>
            </div>
            <div className="form-group">
              <label className="form-label tooltip-wrap">Annual Debt Service ($) ⓘ<div className="tooltip">Total annual principal + interest payments. Used for Levered YOC and DSCR calculations.</div></label>
              <input className="form-input" type="number" value={form.debt_service_annual||''} onChange={e=>set('debt_service_annual',e.target.value)} placeholder="4100000"/>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Entry Cap Rate (%)</label><input className="form-input" type="number" step="0.1" value={form.cap_rate||''} onChange={e=>set('cap_rate',e.target.value)}/></div>
          {/* Live preview */}
          {(yoc||gain!==null)&&(
            <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:8,padding:'10px 14px',display:'flex',gap:20,flexWrap:'wrap'}}>
              {gain!==null&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>Unrealized Gain</div><div style={{fontSize:14,fontWeight:600,color:gain>=0?'var(--g600)':'var(--red)'}}>{gain>=0?'+':''}{fmtM(gain)}</div></div>}
              {yoc&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>Unlevered YOC</div><div style={{fontSize:14,fontWeight:600,color:'var(--g900)'}}>{yoc}%</div><div style={{fontSize:9,color:'var(--gray400)'}}>NOI ÷ Acq Price</div></div>}
              {levYoc&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>Levered YOC</div><div style={{fontSize:14,fontWeight:600,color:'var(--g900)'}}>{levYoc}%</div><div style={{fontSize:9,color:'var(--gray400)'}}>(NOI−DS) ÷ Acq Price</div></div>}
            </div>
          )}
        </>)}

        {/* EXIT & HOLD TAB */}
        {tab==='exit'&&(<>
          <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'var(--g700)',marginBottom:14}}>
            These fields drive the IRR & Exit Analysis page. Fill in your target hold period and exit assumptions.
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Hold Period (years)</label><input className="form-input" type="number" value={form.hold_period_years||''} onChange={e=>set('hold_period_years',e.target.value)} placeholder="7"/></div>
            <div className="form-group"><label className="form-label">Target Exit Year</label><input className="form-input" type="number" value={form.target_exit_year||''} onChange={e=>set('target_exit_year',e.target.value)} placeholder="2027"/></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label tooltip-wrap">Target Exit Cap Rate (%) ⓘ<div className="tooltip">The cap rate you expect to sell at. A higher exit cap = lower sale price. Lower exit cap = higher price.</div></label>
              <input className="form-input" type="number" step="0.1" value={form.target_exit_cap_rate||''} onChange={e=>set('target_exit_cap_rate',e.target.value)} placeholder="6.0"/>
            </div>
            <div className="form-group">
              <label className="form-label tooltip-wrap">Projected Exit Value ($) ⓘ<div className="tooltip">Expected sale price. Can be auto-calculated as: Forward NOI ÷ Exit Cap Rate. Or enter manually.</div></label>
              <input className="form-input" type="number" value={form.projected_exit_value||''} onChange={e=>set('projected_exit_value',e.target.value)} placeholder="165000000"/>
            </div>
          </div>

          {/* Live exit preview */}
          {projGain!==null&&(
            <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:8,padding:'10px 14px',display:'flex',gap:20,flexWrap:'wrap',marginBottom:12}}>
              <div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>Proj. Gain</div><div style={{fontSize:14,fontWeight:600,color:'var(--g600)'}}>{projGain>=0?'+':''}{fmtM(projGain)}</div></div>
              {equityMultiple&&<div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>Equity Multiple</div><div style={{fontSize:14,fontWeight:600,color:'var(--g900)'}}>{equityMultiple}x</div></div>}
            </div>
          )}

          <div style={{borderTop:'1px solid var(--gray100)',paddingTop:12,marginTop:4}}>
            <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--gray500)',marginBottom:10}}>Actual Results (if disposed)</div>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Actual Exit Date</label><input className="form-input" type="date" value={form.actual_exit_date||''} onChange={e=>set('actual_exit_date',e.target.value)}/></div>
              <div className="form-group"><label className="form-label">Actual Exit Value ($)</label><input className="form-input" type="number" value={form.actual_exit_value||''} onChange={e=>set('actual_exit_value',e.target.value)}/></div>
            </div>
            <div className="form-group">
              <label className="form-label tooltip-wrap">Actual IRR (%) ⓘ<div className="tooltip">Realized IRR after exit. Enter this manually from your financial model. Used in the IRR Dashboard.</div></label>
              <input className="form-input" type="number" step="0.1" value={form.actual_irr||''} onChange={e=>set('actual_irr',e.target.value)} placeholder="16.4"/>
            </div>
          </div>
        </>)}

        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading||geocoding}>
            {geocoding?'📍 Locating...':loading?'Saving...':asset?'Save Changes':'Add Asset'}
          </button>
        </div>
      </div>
    </div>
  )
}

const fmtK = (n) => n != null ? `$${(n/1000).toFixed(0)}K` : '—'

function FinancialsModal({ asset, onClose }) {
  const [form, setForm] = useState({ period_month:new Date().getMonth()+1, period_year:new Date().getFullYear(), revenue:'', gop:'', noi:'', occupancy:'', adr:'', revpar:'' })
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'success'|'error', msg }
  const [history, setHistory] = useState([])
  const [histLoading, setHistLoading] = useState(true)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  // Load history for this asset
  useEffect(() => {
    const load = async () => {
      setHistLoading(true)
      const { data, error } = await supabase
        .from('financials')
        .select('*')
        .eq('asset_id', asset.id)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
      if (!error) setHistory(data || [])
      setHistLoading(false)
    }
    load()
  }, [asset.id])

  // When month/year changes, prefill form with existing entry if present
  const [selectedPeriod, setSelectedPeriod] = useState({ month: new Date().getMonth()+1, year: new Date().getFullYear() })

  useEffect(() => {
    const existing = history.find(h => h.period_month === selectedPeriod.month && h.period_year === selectedPeriod.year)
    if (existing) {
      setForm(f => ({
        ...f,
        period_month: selectedPeriod.month,
        period_year: selectedPeriod.year,
        revenue: existing.revenue ?? '',
        gop: existing.gop ?? '',
        noi: existing.noi ?? '',
        occupancy: existing.occupancy ?? '',
        adr: existing.adr ?? '',
        revpar: existing.revpar ?? '',
        budget_revenue: existing.budget_revenue ?? '',
        budget_noi: existing.budget_noi ?? '',
      }))
    } else {
      setForm(f => ({ ...f, period_month: selectedPeriod.month, period_year: selectedPeriod.year, revenue:'', gop:'', noi:'', occupancy:'', adr:'', revpar:'', budget_revenue:'', budget_noi:'' }))
    }
  }, [selectedPeriod, history])

  const handleSave = async () => {
    setLoading(true)
    setStatus(null)
    const { error: upsertErr } = await supabase.from('financials').upsert({
      asset_id:asset.id, period_month:parseInt(form.period_month), period_year:parseInt(form.period_year),
      revenue:form.revenue!==''?parseFloat(form.revenue):null, gop:form.gop!==''?parseFloat(form.gop):null,
      noi:form.noi!==''?parseFloat(form.noi):null, occupancy:form.occupancy!==''?parseFloat(form.occupancy):null,
      adr:form.adr!==''?parseFloat(form.adr):null, revpar:form.revpar!==''?parseFloat(form.revpar):null,
      budget_revenue:form.budget_revenue!==''?parseFloat(form.budget_revenue):null,
      budget_noi:form.budget_noi!==''?parseFloat(form.budget_noi):null,
    }, { onConflict:'asset_id,period_month,period_year' })

    if (upsertErr) {
      setStatus({ type:'error', msg: upsertErr.message })
      setLoading(false)
      return
    }

    // Also update trailing NOI on asset if provided
    if (form.noi !== '') await supabase.from('assets').update({ noi_trailing: parseFloat(form.noi) * 12 }).eq('id', asset.id)

    // Refresh history
    const { data: refreshed } = await supabase
      .from('financials')
      .select('*')
      .eq('asset_id', asset.id)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
    setHistory(refreshed || [])

    setStatus({ type:'success', msg:'Saved' })
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:680}}>
        <div className="modal-header"><span className="modal-title">P&L — {asset.name}</span><button className="modal-close" onClick={onClose}>✕</button></div>

        {status && (
          <div style={{background:status.type==='success'?'var(--g100)':'var(--redL)',color:status.type==='success'?'var(--g700)':'var(--red)',padding:'8px 12px',borderRadius:7,fontSize:12,marginBottom:12}}>
            {status.type==='success'?'✓ Saved':'✕ '+status.msg}
          </div>
        )}

        {/* Entry form */}
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Month</label>
            <select className="form-select" value={form.period_month} onChange={e=>setSelectedPeriod(p=>({...p,month:parseInt(e.target.value)}))}>
              {months.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Year</label><input className="form-input" type="number" value={form.period_year} onChange={e=>setSelectedPeriod(p=>({...p,year:parseInt(e.target.value)}))}/></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Revenue ($)</label><input className="form-input" type="number" value={form.revenue} onChange={e=>set('revenue',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">GOP ($)</label><input className="form-input" type="number" value={form.gop} onChange={e=>set('gop',e.target.value)}/></div>
        </div>
        <div className="form-group"><label className="form-label">NOI ($)</label><input className="form-input" type="number" value={form.noi} onChange={e=>set('noi',e.target.value)}/></div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Occupancy (%)</label><input className="form-input" type="number" step="0.1" value={form.occupancy} onChange={e=>set('occupancy',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">ADR ($)</label><input className="form-input" type="number" value={form.adr} onChange={e=>set('adr',e.target.value)}/></div>
        </div>
        <div className="form-group"><label className="form-label">RevPAR ($)</label><input className="form-input" type="number" value={form.revpar} onChange={e=>set('revpar',e.target.value)}/></div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Budget Revenue ($)</label><input className="form-input" type="number" value={form.budget_revenue} onChange={e=>set('budget_revenue',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Budget NOI ($)</label><input className="form-input" type="number" value={form.budget_noi} onChange={e=>set('budget_noi',e.target.value)}/></div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginBottom:20}}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading?'Saving...':'Save P&L'}</button>
        </div>

        {/* History table */}
        <div style={{borderTop:'1px solid var(--gray200)',paddingTop:16}}>
          <div style={{fontSize:12,fontWeight:600,color:'var(--gray700)',marginBottom:10,textTransform:'uppercase',letterSpacing:'.05em'}}>History</div>
          {histLoading ? (
            <div style={{fontSize:12,color:'var(--gray500)'}}>Loading...</div>
          ) : history.length === 0 ? (
            <div style={{fontSize:12,color:'var(--gray500)'}}>No entries yet — save your first P&L above.</div>
          ) : (
            <div style={{overflowX:'auto'}}>
              <table className="data-table" style={{fontSize:12}}>
                <thead><tr>
                  <th>Period</th>
                  <th>Revenue</th>
                  <th>GOP</th>
                  <th>NOI</th>
                  <th>Occ %</th>
                  <th>ADR</th>
                  <th>RevPAR</th>
                  <th>Bdgt Rev</th>
                  <th>Bdgt NOI</th>
                </tr></thead>
                <tbody>
                  {history.map(h => (
                    <tr key={`${h.period_year}-${h.period_month}`}
                        style={{cursor:'pointer', background: selectedPeriod.month===h.period_month && selectedPeriod.year===h.period_year ? 'var(--g50)' : undefined}}
                        onClick={()=>setSelectedPeriod({ month: h.period_month, year: h.period_year })}>
                      <td style={{fontWeight:600,whiteSpace:'nowrap'}}>{months[h.period_month-1]} {h.period_year}</td>
                      <td>{fmtK(h.revenue)}</td>
                      <td>{fmtK(h.gop)}</td>
                      <td style={{fontWeight:500,color:'var(--g700)'}}>{fmtK(h.noi)}</td>
                      <td>{h.occupancy != null ? `${parseFloat(h.occupancy).toFixed(1)}%` : '—'}</td>
                      <td>{h.adr != null ? `$${parseFloat(h.adr).toFixed(0)}` : '—'}</td>
                      <td>{h.revpar != null ? `$${parseFloat(h.revpar).toFixed(0)}` : '—'}</td>
                      <td>{fmtK(h.budget_revenue)}</td>
                      <td>{fmtK(h.budget_noi)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Assets() {
  const { assets, loading, error, addAsset, updateAsset, deleteAsset } = useAssets()
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [finModal, setFinModal] = useState(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [sort, setSort] = useState({ field:'name', dir:'asc' })

  const handleSort = (field) => setSort(s=>s.field===field?{field,dir:s.dir==='asc'?'desc':'asc'}:{field,dir:'asc'})
  const sorted = [...assets].sort((a,b)=>{
    let av=a[sort.field],bv=b[sort.field]
    if(av==null)return 1;if(bv==null)return -1
    if(typeof av==='string')av=av.toLowerCase();if(typeof bv==='string')bv=bv.toLowerCase()
    return sort.dir==='asc'?(av>bv?1:-1):(av<bv?1:-1)
  })
  const filtered = sorted.filter(a=>filter==='all'||a.type===filter).filter(a=>!search||a.name.toLowerCase().includes(search.toLowerCase())||a.market?.toLowerCase().includes(search.toLowerCase()))

  const handleSave = async (data) => {
    if (modal?.id) return await updateAsset(modal.id, data)
    return await addAsset(data)
  }

  const toggleSelect=(id)=>setSelected(s=>{const n=new Set(s);n.has(id)?n.delete(id):n.add(id);return n})
  const toggleAll=()=>setSelected(s=>s.size===filtered.length?new Set():new Set(filtered.map(a=>a.id)))

  // Portfolio KPIs
  const totalAcq=assets.reduce((s,a)=>s+(parseFloat(a.acquisition_price)||0),0)
  const totalVal=assets.reduce((s,a)=>s+(parseFloat(a.current_value)||0),0)
  const totalNOI=assets.reduce((s,a)=>s+(parseFloat(a.noi_trailing)||0),0)
  const totalDS=assets.reduce((s,a)=>s+(parseFloat(a.debt_service_annual)||0),0)
  const unrealizedGain=totalVal-totalAcq
  const gainPct=totalAcq?((unrealizedGain/totalAcq)*100).toFixed(1):null
  const wtdYOC=totalAcq&&totalNOI?((totalNOI/totalAcq)*100).toFixed(2):null
  const wtdLevYOC=totalAcq&&totalNOI&&totalDS?(((totalNOI-totalDS)/totalAcq)*100).toFixed(2):null

  if (loading) return <div className="loading">Loading assets...</div>
  if (error) return <div className="empty-state"><div className="empty-state-icon">⚠</div><div className="empty-state-title">Can't reach database</div></div>

  return (
    <div>
      <div className="page-header">
        <h1>Asset Tracker</h1>
        <p>{assets.length} assets across {[...new Set(assets.map(a=>a.market).filter(Boolean))].length} markets</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Portfolio Value</div><div className="kpi-value">{fmtM(totalVal)}</div><div className="kpi-change">{fmtM(totalAcq)} cost basis</div></div>
        <div className="kpi-card"><div className="kpi-label">Unrealized Gain</div><div className="kpi-value">{unrealizedGain?(unrealizedGain>=0?'+':'')+fmtM(unrealizedGain):'—'}</div><div className={`kpi-change${unrealizedGain<0?' down':''}`}>{gainPct?`${unrealizedGain>=0?'+':''}${gainPct}% vs cost`:''}</div></div>
        <div className="kpi-card">
          <div className="kpi-label">
            <span className="tooltip-wrap" style={{cursor:'help'}}>Wtd. Unlevered YOC ⓘ<div className="tooltip" style={{minWidth:220,fontWeight:400}}>Total NOI ÷ Total Acquisition Price<br/>Before debt service</div></span>
          </div>
          <div className="kpi-value">{wtdYOC?`${wtdYOC}%`:'—'}</div>
          <div className="kpi-change">Levered: {wtdLevYOC?`${wtdLevYOC}%`:'—'}</div>
        </div>
        <div className="kpi-card"><div className="kpi-label">Total T12 NOI</div><div className="kpi-value">{fmtM(totalNOI)}</div><div className="kpi-change">Trailing 12-month</div></div>
      </div>

      {selected.size>0&&<div className="bulk-bar"><span>{selected.size} selected</span><button className="btn btn-secondary btn-sm" onClick={()=>setSelected(new Set())}>Clear</button></div>}

      <div className="card">
        <div className="card-header">
          <div style={{display:'flex',alignItems:'center',gap:12,flex:1,flexWrap:'wrap'}}>
            <span className="card-title">All assets</span>
            <div className="filter-tabs" style={{margin:0}}>
              {['all','hotel','resort','mixed','commercial'].map(t=>(
                <button key={t} className={`filter-tab${filter===t?' active':''}`} onClick={()=>setFilter(t)}>{t==='all'?'All':t.charAt(0).toUpperCase()+t.slice(1)+'s'}</button>
              ))}
            </div>
            <input className="form-input" style={{width:180,padding:'5px 10px',fontSize:12}} placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <button className="btn btn-primary btn-sm" onClick={()=>setModal({})}>+ Add Asset</button>
        </div>

        {filtered.length===0?(
          <div className="empty-state">
            <div className="empty-state-icon">🏨</div>
            <div className="empty-state-title">{search?'No assets match':'No assets yet'}</div>
            {!search&&<button className="btn btn-primary" onClick={()=>setModal({})}>+ Add Asset</button>}
          </div>
        ):(
          <div style={{overflowX:'auto'}}>
            <table className="data-table">
              <thead><tr>
                <th style={{width:28}}><input type="checkbox" className="row-checkbox" checked={selected.size===filtered.length&&filtered.length>0} onChange={toggleAll}/></th>
                <SortHeader label="Property" field="name" sort={sort} onSort={handleSort}/>
                <SortHeader label="Market" field="market" sort={sort} onSort={handleSort}/>
                <SortHeader label="Rooms" field="rooms" sort={sort} onSort={handleSort}/>
                <SortHeader label="Acq. Price" field="acquisition_price" sort={sort} onSort={handleSort}/>
                <SortHeader label="Current Value" field="current_value" sort={sort} onSort={handleSort}/>
                <th>Gain / Loss</th>
                <SortHeader label="NOI (T12)" field="noi_trailing" sort={sort} onSort={handleSort}/>
                <th>
                  <span className="tooltip-wrap" style={{cursor:'help'}}>Levered YOC ⓘ<div className="tooltip" style={{fontWeight:400,minWidth:200}}>(NOI − Debt Service) ÷ Acquisition Price<br/>Hover each cell for unlevered</div></span>
                </th>
                <SortHeader label="Status" field="status" sort={sort} onSort={handleSort}/>
                <th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(a=>{
                  const gain=a.current_value&&a.acquisition_price?parseFloat(a.current_value)-parseFloat(a.acquisition_price):null
                  const gainPct=gain&&a.acquisition_price?((gain/parseFloat(a.acquisition_price))*100).toFixed(1):null
                  const yoc=a.noi_trailing&&a.acquisition_price?((parseFloat(a.noi_trailing)/parseFloat(a.acquisition_price))*100).toFixed(2):null
                  const levYoc=a.noi_trailing&&a.debt_service_annual&&a.acquisition_price?(((parseFloat(a.noi_trailing)-parseFloat(a.debt_service_annual))/parseFloat(a.acquisition_price))*100).toFixed(2):null
                  const ss=statusStyle(a.status)
                  return (
                    <tr key={a.id} style={{opacity:selected.size>0&&!selected.has(a.id)?0.6:1}}>
                      <td><input type="checkbox" className="row-checkbox" checked={selected.has(a.id)} onChange={()=>toggleSelect(a.id)}/></td>
                      <td>
                        {/* FIX: Clickable link to asset detail page */}
                        <Link to={`/assets/${a.id}`} style={{color:'var(--g600)',textDecoration:'none',fontWeight:500}}>{a.name}</Link>
                        {a.brand&&<div style={{fontSize:10,color:'var(--gray500)'}}>{a.brand}</div>}
                      </td>
                      <td><InlineCell value={a.market} onSave={v=>updateAsset(a.id,{market:v})}/></td>
                      <td><InlineCell value={a.rooms} type="number" onSave={v=>updateAsset(a.id,{rooms:parseInt(v)})}/></td>
                      <td>{fmtM(a.acquisition_price)}</td>
                      <td><InlineCell value={a.current_value} type="number" onSave={v=>updateAsset(a.id,{current_value:parseFloat(v)})} format={fmtM}/></td>
                      <td>{gain!==null?<span style={{color:gain>=0?'var(--g600)':'var(--red)',fontWeight:500,fontSize:12}}>{gain>=0?'+':''}{fmtM(gain)}<br/><span style={{fontSize:10,fontWeight:400}}>({gain>=0?'+':''}{gainPct}%)</span></span>:'—'}</td>
                      <td style={{fontWeight:500}}>{fmtM(a.noi_trailing)}</td>
                      <td>
                        {levYoc||yoc?(
                          <div className="tooltip-wrap">
                            <span style={{fontWeight:600,color:'var(--g700)'}}>{levYoc?`${levYoc}%`:yoc?`${yoc}%`:'—'}</span>
                            <div className="tooltip" style={{minWidth:190,fontWeight:400}}>
                              <div style={{fontWeight:600,marginBottom:4}}>Yield on Cost</div>
                              <div style={{fontSize:11,color:'var(--g200)'}}>Unlevered: {yoc?`${yoc}%`:'—'} <span style={{fontSize:10,opacity:.6}}>(NOI÷Acq)</span></div>
                              <div style={{fontSize:11,color:'var(--g200)'}}>Levered: {levYoc?`${levYoc}%`:'—'} <span style={{fontSize:10,opacity:.6}}>((NOI−DS)÷Acq)</span></div>
                            </div>
                          </div>
                        ):'—'}
                      </td>
                      <td>
                        <select style={{fontSize:10,border:'1px solid',borderColor:ss.color+'40',borderRadius:12,padding:'2px 6px',background:ss.bg,color:ss.color,cursor:'pointer',fontWeight:500}} value={a.status} onChange={e=>updateAsset(a.id,{status:e.target.value})}>
                          {STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <div style={{display:'flex',gap:6}}>
                          <button className="card-action" onClick={()=>setFinModal(a)}>+ P&L</button>
                          {/* FIX: Edit button opens full modal with all fields */}
                          <button className="card-action" onClick={()=>setModal(a)}>Edit</button>
                          <button className="card-action" style={{color:'var(--red)'}} onClick={()=>setDeleteModal(a)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal!==null&&<AssetModal asset={modal?.id?modal:null} onClose={()=>setModal(null)} onSave={handleSave}/>}
      {finModal&&<FinancialsModal asset={finModal} onClose={()=>setFinModal(null)}/>}
      {deleteModal&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDeleteModal(null)}>
          <div className="modal" style={{maxWidth:400}}>
            <div className="modal-header"><span className="modal-title">Delete Asset</span><button className="modal-close" onClick={()=>setDeleteModal(null)}>✕</button></div>
            <p style={{fontSize:13,color:'var(--gray700)',marginBottom:20,lineHeight:1.6}}>Delete <strong>{deleteModal.name}</strong>? All linked data will also be deleted.</p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-secondary" onClick={()=>setDeleteModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={()=>{deleteAsset(deleteModal.id);setDeleteModal(null)}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
