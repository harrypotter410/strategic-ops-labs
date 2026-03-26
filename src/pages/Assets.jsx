import { useState } from 'react'
import { useAssets } from '../hooks/useData'
import { geocodeAddress } from './PortfolioMap'
import { supabase } from '../lib/supabase'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'
const fmtPct = (n) => n ? `${parseFloat(n).toFixed(1)}%` : '—'
const TYPES = ['hotel','resort','mixed','commercial']

// REPE-focused statuses
const STATUSES = [
  { value: 'stabilized', label: 'Stabilized' },
  { value: 'unstabilized', label: 'Unstabilized' },
  { value: 'value_add', label: 'Value-Add' },
  { value: 'under_renovation', label: 'Under Renovation' },
  { value: 'lease_up', label: 'Lease-Up' },
  { value: 'development', label: 'Development' },
  { value: 'held_for_sale', label: 'Held for Sale' },
  { value: 'disposed', label: 'Disposed' },
]

const statusStyle = (s) => {
  const styles = {
    stabilized: { color:'var(--g600)', background:'var(--g100)' },
    unstabilized: { color:'var(--amber)', background:'var(--amberL)' },
    value_add: { color:'var(--blue)', background:'var(--blueL)' },
    under_renovation: { color:'#7b1fa2', background:'#f3e5f5' },
    lease_up: { color:'#0288d1', background:'#e1f5fe' },
    development: { color:'#e65100', background:'#fff3e0' },
    held_for_sale: { color:'var(--red)', background:'var(--redL)' },
    disposed: { color:'var(--gray500)', background:'var(--gray100)' },
  }
  return styles[s] || { color:'var(--gray500)', background:'var(--gray100)' }
}

// Sortable column header
function SortHeader({ label, field, sort, onSort }) {
  const active = sort.field === field
  return (
    <th className={active ? (sort.dir==='asc'?'sorted-asc':'sorted-desc') : ''} onClick={() => onSort(field)}>
      {label}
      <span className="sort-icon">{active?(sort.dir==='asc'?'↑':'↓'):'↕'}</span>
    </th>
  )
}

// Inline editable cell
function InlineCell({ value, onSave, type='text', format }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value||'')
  const commit = async () => { setEditing(false); if (val !== value) await onSave(val) }
  if (editing) return <input className="inline-edit-input" type={type} value={val} onChange={e=>setVal(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape')setEditing(false)}} autoFocus />
  return <span className="inline-edit editable-cell" onClick={()=>setEditing(true)} title="Click to edit">{format?format(value):(value||'—')}<span className="edit-pencil">✎</span></span>
}

function FinancialsModal({ asset, onClose }) {
  const [form, setForm] = useState({ period_month:new Date().getMonth()+1, period_year:new Date().getFullYear(), revenue:'', gop:'', noi:'', occupancy:'', adr:'', revpar:'', budget_revenue:'', budget_noi:'' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const handleSave = async () => {
    setLoading(true)
    await supabase.from('financials').upsert({
      asset_id:asset.id, period_month:parseInt(form.period_month), period_year:parseInt(form.period_year),
      revenue:form.revenue?parseFloat(form.revenue):null, gop:form.gop?parseFloat(form.gop):null,
      noi:form.noi?parseFloat(form.noi):null, occupancy:form.occupancy?parseFloat(form.occupancy):null,
      adr:form.adr?parseFloat(form.adr):null, revpar:form.revpar?parseFloat(form.revpar):null,
      budget_revenue:form.budget_revenue?parseFloat(form.budget_revenue):null,
      budget_noi:form.budget_noi?parseFloat(form.budget_noi):null,
    }, { onConflict:'asset_id,period_month,period_year' })
    // Also update trailing NOI on asset if provided
    if (form.noi) await supabase.from('assets').update({ noi_trailing: parseFloat(form.noi) * 12 }).eq('id', asset.id)
    setSuccess(true); setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header"><span className="modal-title">Enter P&L — {asset.name}</span><button className="modal-close" onClick={onClose}>✕</button></div>
        {success && <div style={{background:'var(--g100)',color:'var(--g700)',padding:'8px 12px',borderRadius:7,fontSize:12,marginBottom:12}}>✓ Saved</div>}
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Month</label>
            <select className="form-select" value={form.period_month} onChange={e=>set('period_month',e.target.value)}>
              {months.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Year</label><input className="form-input" type="number" value={form.period_year} onChange={e=>set('period_year',e.target.value)}/></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Revenue ($)</label><input className="form-input" type="number" value={form.revenue} onChange={e=>set('revenue',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">GOP ($)</label><input className="form-input" type="number" value={form.gop} onChange={e=>set('gop',e.target.value)}/></div>
        </div>
        <div className="form-group"><label className="form-label">NOI ($) <span style={{fontSize:10,color:'var(--g600)',fontWeight:400}}>— will update trailing NOI on asset</span></label><input className="form-input" type="number" value={form.noi} onChange={e=>set('noi',e.target.value)}/></div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Occupancy (%)</label><input className="form-input" type="number" step="0.1" value={form.occupancy} onChange={e=>set('occupancy',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">ADR ($)</label><input className="form-input" type="number" value={form.adr} onChange={e=>set('adr',e.target.value)}/></div>
        </div>
        <div className="form-group"><label className="form-label">RevPAR ($)</label><input className="form-input" type="number" value={form.revpar} onChange={e=>set('revpar',e.target.value)}/></div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Budget Revenue ($)</label><input className="form-input" type="number" value={form.budget_revenue} onChange={e=>set('budget_revenue',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Budget NOI ($)</label><input className="form-input" type="number" value={form.budget_noi} onChange={e=>set('budget_noi',e.target.value)}/></div>
        </div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>{loading?'Saving...':'Save P&L'}</button>
        </div>
      </div>
    </div>
  )
}

function AssetModal({ asset, onClose, onSave }) {
  const [form, setForm] = useState(asset ? {
    ...asset, rooms:asset.rooms||'', year_acquired:asset.year_acquired||'',
    acquisition_price:asset.acquisition_price||'', current_value:asset.current_value||'',
    cap_rate:asset.cap_rate||'', notes:asset.notes||'', brand:asset.brand||'',
    address:asset.address||'', noi_trailing:asset.noi_trailing||'', debt_service_annual:asset.debt_service_annual||'',
  } : { name:'',market:'',type:'hotel',status:'stabilized',rooms:'',brand:'',year_acquired:'',acquisition_price:'',current_value:'',cap_rate:'',notes:'',address:'',noi_trailing:'',debt_service_annual:'' })
  const [loading, setLoading] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [error, setError] = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  // Compute YOC and Levered YOC live
  const yoc = form.noi_trailing && form.acquisition_price ? ((parseFloat(form.noi_trailing)/parseFloat(form.acquisition_price))*100).toFixed(2) : null
  const leveredYoc = form.noi_trailing && form.debt_service_annual && form.acquisition_price
    ? (((parseFloat(form.noi_trailing)-parseFloat(form.debt_service_annual))/parseFloat(form.acquisition_price))*100).toFixed(2) : null

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Property name is required.'); return }
    if (!form.market.trim()) { setError('Market is required.'); return }
    setLoading(true); setError('')
    let lat = form.latitude||null, lng = form.longitude||null
    if (!lat || !lng) {
      setGeocoding(true)
      const q = form.address ? `${form.address}, ${form.market}` : `${form.name}, ${form.market}`
      const coords = await geocodeAddress(q)
      if (coords) { lat=coords.lat; lng=coords.lng }
      else { const m = await geocodeAddress(form.market); if (m) { lat=m.lat; lng=m.lng } }
      setGeocoding(false)
    }
    const payload = {
      name:form.name.trim(), market:form.market.trim(), type:form.type, status:form.status,
      rooms:form.rooms?parseInt(form.rooms):null, brand:form.brand||null,
      year_acquired:form.year_acquired?parseInt(form.year_acquired):null,
      acquisition_price:form.acquisition_price?parseFloat(form.acquisition_price):null,
      current_value:form.current_value?parseFloat(form.current_value):null,
      cap_rate:form.cap_rate?parseFloat(form.cap_rate):null,
      noi_trailing:form.noi_trailing?parseFloat(form.noi_trailing):null,
      debt_service_annual:form.debt_service_annual?parseFloat(form.debt_service_annual):null,
      notes:form.notes||null, address:form.address||null, latitude:lat, longitude:lng,
    }
    const { error } = await onSave(payload)
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onClose()
  }

  const gain = form.acquisition_price && form.current_value ? parseFloat(form.current_value)-parseFloat(form.acquisition_price) : null

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header"><span className="modal-title">{asset?'Edit Asset':'Add Asset'}</span><button className="modal-close" onClick={onClose}>✕</button></div>
        {error && <div style={{background:'var(--redL)',color:'var(--red)',padding:'8px 12px',borderRadius:7,fontSize:12,marginBottom:12}}>{error}</div>}
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Property Name *</label><input className="form-input" value={form.name} onChange={e=>set('name',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Market *</label><input className="form-input" value={form.market} onChange={e=>set('market',e.target.value)} placeholder="Memphis, TN"/></div>
        </div>
        <div className="form-group">
          <label className="form-label">Address <span style={{fontSize:10,color:'var(--g600)',fontWeight:400}}>— for precise map placement</span></label>
          <input className="form-input" value={form.address} onChange={e=>set('address',e.target.value)} placeholder="149 Union Ave, Memphis, TN 38103"/>
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
          <div className="form-group"><label className="form-label">Rooms</label><input className="form-input" type="number" value={form.rooms} onChange={e=>set('rooms',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Brand / Flag</label><input className="form-input" value={form.brand} onChange={e=>set('brand',e.target.value)}/></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Year Acquired</label><input className="form-input" type="number" value={form.year_acquired} onChange={e=>set('year_acquired',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Cap Rate (%)</label><input className="form-input" type="number" step="0.1" value={form.cap_rate} onChange={e=>set('cap_rate',e.target.value)}/></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Acquisition Price ($)</label><input className="form-input" type="number" value={form.acquisition_price} onChange={e=>set('acquisition_price',e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Current Value ($)</label><input className="form-input" type="number" value={form.current_value} onChange={e=>set('current_value',e.target.value)}/></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Trailing NOI ($)</label><input className="form-input" type="number" value={form.noi_trailing} onChange={e=>set('noi_trailing',e.target.value)} placeholder="8200000"/></div>
          <div className="form-group"><label className="form-label">Annual Debt Service ($)</label><input className="form-input" type="number" value={form.debt_service_annual} onChange={e=>set('debt_service_annual',e.target.value)} placeholder="4100000"/></div>
        </div>

        {/* Live YOC preview */}
        {(yoc || gain !== null) && (
          <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:8,padding:'10px 14px',marginBottom:8,display:'flex',gap:20}}>
            {gain !== null && <div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Unrealized Gain</div><div style={{fontSize:14,fontWeight:600,color:gain>=0?'var(--g600)':'var(--red)'}}>{gain>=0?'+':''}{fmtM(gain)}</div></div>}
            {yoc && <div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>YOC (Yield on Cost)</div><div style={{fontSize:14,fontWeight:600,color:'var(--g900)'}}>{yoc}%</div></div>}
            {leveredYoc && <div><div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3}}>Levered YOC</div><div style={{fontSize:14,fontWeight:600,color:'var(--g900)'}}>{leveredYoc}%</div></div>}
          </div>
        )}

        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} style={{resize:'vertical'}}/></div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading||geocoding}>{geocoding?'📍 Locating...':loading?'Saving...':asset?'Save Changes':'Add Asset'}</button>
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

  const handleSort = (field) => setSort(s => s.field===field ? {field,dir:s.dir==='asc'?'desc':'asc'} : {field,dir:'asc'})

  const sorted = [...assets].sort((a,b) => {
    let av=a[sort.field], bv=b[sort.field]
    if (av==null) return 1; if (bv==null) return -1
    if (typeof av==='string') av=av.toLowerCase(); if (typeof bv==='string') bv=bv.toLowerCase()
    return sort.dir==='asc'?(av>bv?1:-1):(av<bv?1:-1)
  })

  const filtered = sorted
    .filter(a => filter==='all' || a.type===filter)
    .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.market?.toLowerCase().includes(search.toLowerCase()))

  const handleSave = async (data) => {
    if (modal?.id) return await updateAsset(modal.id, data)
    return await addAsset(data)
  }

  const toggleSelect = (id) => setSelected(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  const toggleAll = () => setSelected(s => s.size===filtered.length ? new Set() : new Set(filtered.map(a=>a.id)))

  const bulkExport = () => {
    const sel = assets.filter(a => selected.has(a.id))
    const csv = ['Name,Market,Type,Rooms,Acquisition Price,Current Value,NOI (Trailing),YOC,Levered YOC,Status',
      ...sel.map(a => {
        const yoc = a.noi_trailing && a.acquisition_price ? ((a.noi_trailing/a.acquisition_price)*100).toFixed(2) : ''
        const lyoc = a.noi_trailing && a.debt_service_annual && a.acquisition_price ? (((a.noi_trailing-a.debt_service_annual)/a.acquisition_price)*100).toFixed(2) : ''
        return `"${a.name}","${a.market}","${a.type}",${a.rooms||''},${a.acquisition_price||''},${a.current_value||''},${a.noi_trailing||''},${yoc},${lyoc},"${a.status}"`
      })].join('\n')
    const blob = new Blob([csv],{type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const el = document.createElement('a'); el.href=url; el.download='soul_assets.csv'; el.click()
  }

  // Portfolio KPIs
  const totalAcq = assets.reduce((s,a)=>s+(a.acquisition_price||0),0)
  const totalVal = assets.reduce((s,a)=>s+(a.current_value||0),0)
  const totalNOI = assets.reduce((s,a)=>s+(a.noi_trailing||0),0)
  const unrealizedGain = totalVal - totalAcq
  const gainPct = totalAcq ? ((unrealizedGain/totalAcq)*100).toFixed(1) : null

  // Weighted YOC = total trailing NOI / total acquisition price
  const wtdYOC = totalAcq && totalNOI ? ((totalNOI/totalAcq)*100).toFixed(2) : null
  // Weighted Levered YOC
  const totalDS = assets.reduce((s,a)=>s+(a.debt_service_annual||0),0)
  const wtdLevYOC = totalAcq && totalNOI && totalDS ? (((totalNOI-totalDS)/totalAcq)*100).toFixed(2) : null

  if (loading) return <div className="loading">Loading assets...</div>
  if (error) return <div className="empty-state"><div className="empty-state-icon">⚠</div><div className="empty-state-title">Can't reach database</div><div className="empty-state-desc">Check your connection and refresh.</div></div>

  return (
    <div>
      <div className="page-header">
        <h1>Asset Tracker</h1>
        <p>{assets.length} assets across {[...new Set(assets.map(a=>a.market))].length} markets</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Portfolio Value</div><div className="kpi-value">{fmtM(totalVal)}</div><div className="kpi-change">{fmtM(totalAcq)} cost basis</div></div>
        <div className="kpi-card">
          <div className="kpi-label">Unrealized Gain</div>
          <div className="kpi-value">{unrealizedGain?(unrealizedGain>=0?'+':'')+fmtM(unrealizedGain):'—'}</div>
          <div className={`kpi-change${unrealizedGain<0?' down':''}`}>{gainPct?`${unrealizedGain>=0?'+':''}${gainPct}% vs cost`:'Add values to track'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Wtd. Avg. YOC</div>
          <div className="kpi-value">{wtdYOC?`${wtdYOC}%`:'—'}</div>
          <div className="kpi-change">Yield on cost · {fmtM(totalNOI)} total NOI</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Wtd. Avg. Levered YOC</div>
          <div className="kpi-value">{wtdLevYOC?`${wtdLevYOC}%`:'—'}</div>
          <div className="kpi-change">After debt service</div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span>{selected.size} asset{selected.size>1?'s':''} selected</span>
          <button className="btn btn-secondary btn-sm" onClick={bulkExport}>⬇ Export CSV</button>
          <button className="btn btn-secondary btn-sm" onClick={()=>setSelected(new Set())}>Clear</button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div style={{display:'flex',alignItems:'center',gap:12,flex:1,flexWrap:'wrap'}}>
            <span className="card-title">All assets</span>
            <div className="filter-tabs" style={{margin:0}}>
              {['all','hotel','resort','mixed','commercial'].map(t=>(
                <button key={t} className={`filter-tab${filter===t?' active':''}`} onClick={()=>setFilter(t)}>
                  {t==='all'?'All':t.charAt(0).toUpperCase()+t.slice(1)+'s'}
                </button>
              ))}
            </div>
            <input className="form-input" style={{width:180,padding:'5px 10px',fontSize:12}} placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <button className="btn btn-primary btn-sm" onClick={()=>setModal({})}>+ Add Asset</button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏨</div>
            <div className="empty-state-title">{search?'No assets match your search':'No assets yet'}</div>
            <div className="empty-state-desc">{search?'Try a different search term':'Add your first asset to get started'}</div>
            {!search && <button className="btn btn-primary" onClick={()=>setModal({})}>+ Add Asset</button>}
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table className="data-table">
              <thead><tr>
                <th style={{width:28}}><input type="checkbox" className="row-checkbox" checked={selected.size===filtered.length&&filtered.length>0} onChange={toggleAll}/></th>
                <SortHeader label="Property" field="name" sort={sort} onSort={handleSort}/>
                <SortHeader label="Type" field="type" sort={sort} onSort={handleSort}/>
                <SortHeader label="Market" field="market" sort={sort} onSort={handleSort}/>
                <SortHeader label="Rooms" field="rooms" sort={sort} onSort={handleSort}/>
                <SortHeader label="Acq. Price" field="acquisition_price" sort={sort} onSort={handleSort}/>
                <SortHeader label="Current Value" field="current_value" sort={sort} onSort={handleSort}/>
                <th>Gain / Loss</th>
                <SortHeader label="NOI (T12)" field="noi_trailing" sort={sort} onSort={handleSort}/>
                <SortHeader label="Levered YOC" field="noi_trailing" sort={sort} onSort={handleSort}/>
                <SortHeader label="Status" field="status" sort={sort} onSort={handleSort}/>
                <th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(a => {
                  const gain = a.current_value && a.acquisition_price ? a.current_value - a.acquisition_price : null
                  const gainPct = gain && a.acquisition_price ? ((gain/a.acquisition_price)*100).toFixed(1) : null
                  const yoc = a.noi_trailing && a.acquisition_price ? ((a.noi_trailing/a.acquisition_price)*100).toFixed(2) : null
                  const levYoc = a.noi_trailing && a.debt_service_annual && a.acquisition_price ? (((a.noi_trailing-a.debt_service_annual)/a.acquisition_price)*100).toFixed(2) : null
                  const ss = statusStyle(a.status)
                  return (
                    <tr key={a.id} style={{opacity:selected.size>0&&!selected.has(a.id)?0.6:1}}>
                      <td><input type="checkbox" className="row-checkbox" checked={selected.has(a.id)} onChange={()=>toggleSelect(a.id)}/></td>
                      <td>
                        <strong><InlineCell value={a.name} onSave={v=>updateAsset(a.id,{name:v})}/></strong>
                        {a.brand && <div style={{fontSize:10,color:'var(--gray500)'}}>{a.brand}</div>}
                      </td>
                      <td><span className={`badge badge-${a.type}`}>{a.type}</span></td>
                      <td><InlineCell value={a.market} onSave={v=>updateAsset(a.id,{market:v})}/></td>
                      <td><InlineCell value={a.rooms} type="number" onSave={v=>updateAsset(a.id,{rooms:parseInt(v)})}/></td>
                      <td>{fmtM(a.acquisition_price)}</td>
                      <td><InlineCell value={a.current_value} type="number" onSave={v=>updateAsset(a.id,{current_value:parseFloat(v)})} format={fmtM}/></td>
                      <td>
                        {gain !== null ? (
                          <span style={{color:gain>=0?'var(--g600)':'var(--red)',fontWeight:500,fontSize:12}}>
                            {gain>=0?'+':''}{fmtM(gain)}<br/>
                            <span style={{fontSize:10,fontWeight:400}}>({gain>=0?'+':''}{gainPct}%)</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{fontWeight:500}}>{fmtM(a.noi_trailing)}</td>
                      <td>
                        {levYoc ? (
                          <div className="tooltip-wrap">
                            <span style={{fontWeight:600,color:'var(--g700)'}}>{levYoc}%</span>
                            <div className="tooltip">
                              <div style={{fontWeight:600,marginBottom:4}}>Yield on Cost</div>
                              <div style={{fontSize:11,color:'var(--g200)'}}>Unlevered: {yoc}%</div>
                              <div style={{fontSize:11,color:'var(--g200)'}}>Levered: {levYoc}%</div>
                              <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginTop:4}}>(NOI - Debt Service) ÷ Acq. Price</div>
                            </div>
                          </div>
                        ) : yoc ? `${yoc}%` : '—'}
                      </td>
                      <td>
                        <select
                          style={{fontSize:10,border:'1px solid',borderColor:ss.color+'40',borderRadius:12,padding:'2px 6px',background:ss.background,color:ss.color,cursor:'pointer',fontWeight:500}}
                          value={a.status}
                          onChange={e=>updateAsset(a.id,{status:e.target.value})}
                        >
                          {STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <div style={{display:'flex',gap:6}}>
                          <button className="card-action" onClick={()=>setFinModal(a)}>+ P&L</button>
                          <button className="card-action" onClick={()=>setModal(a)}>Edit</button>
                          <button className="card-action" style={{color:'var(--red)'}} onClick={()=>setDeleteModal(a)}>Delete</button>
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

      {modal !== null && <AssetModal asset={modal?.id?modal:null} onClose={()=>setModal(null)} onSave={handleSave}/>}
      {finModal && <FinancialsModal asset={finModal} onClose={()=>setFinModal(null)}/>}
      {deleteModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDeleteModal(null)}>
          <div className="modal" style={{maxWidth:400}}>
            <div className="modal-header"><span className="modal-title">Delete Asset</span><button className="modal-close" onClick={()=>setDeleteModal(null)}>✕</button></div>
            <p style={{fontSize:13,color:'var(--gray700)',marginBottom:20,lineHeight:1.6}}>Delete <strong>{deleteModal.name}</strong>? All financials will also be deleted.</p>
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
