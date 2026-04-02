import { useState } from 'react'
import { useAssets } from '../hooks/useData'
import { Link } from 'react-router-dom'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'
const fmtPct = (n) => n ? `${parseFloat(n).toFixed(2)}%` : '—'
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
const statusStyle = (s) => STATUSES.find(x=>x.value===s) || { color:'var(--gray500)', bg:'var(--gray100)', label:s||'—' }

function SortHeader({ label, field, sort, onSort }) {
  const active = sort.field === field
  return (
    <th className={active?(sort.dir==='asc'?'sorted-asc':'sorted-desc'):''} onClick={()=>onSort(field)} style={{cursor:'pointer'}}>
      {label}<span className="sort-icon">{active?(sort.dir==='asc'?'↑':'↓'):'↕'}</span>
    </th>
  )
}

export default function Assets() {
  const { assets, loading, error } = useAssets()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [sort, setSort] = useState({ field:'name', dir:'asc' })

  const handleSort = (field) => setSort(s=>s.field===field?{field,dir:s.dir==='asc'?'desc':'asc'}:{field,dir:'asc'})

  const sorted = [...assets].sort((a,b)=>{
    let av=a[sort.field], bv=b[sort.field]
    if (av==null) return 1
    if (bv==null) return -1
    if (typeof av==='string') av=av.toLowerCase()
    if (typeof bv==='string') bv=bv.toLowerCase()
    return sort.dir==='asc'?(av>bv?1:-1):(av<bv?1:-1)
  })

  const filtered = sorted
    .filter(a=>filter==='all'||a.type===filter)
    .filter(a=>!search||a.name.toLowerCase().includes(search.toLowerCase())||a.market?.toLowerCase().includes(search.toLowerCase()))

  const toggleSelect = (id) => setSelected(s=>{ const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })
  const toggleAll = () => setSelected(s=>s.size===filtered.length?new Set():new Set(filtered.map(a=>a.id)))

  // CSV export
  const exportCSV = () => {
    const rows = filtered.filter(a=>selected.size===0||selected.has(a.id))
    const headers = ['Name','Market','Rooms','Acquisition Price','Current Value','Gain/Loss','NOI T12','Status']
    const lines = rows.map(a=>{
      const gain = a.current_value&&a.acquisition_price ? parseFloat(a.current_value)-parseFloat(a.acquisition_price) : null
      return [a.name,a.market||'',a.rooms||'',a.acquisition_price||'',a.current_value||'',gain!=null?gain.toFixed(0):'',a.noi_trailing||'',a.status||''].join(',')
    })
    const csv = [headers.join(','),...lines].join('\n')
    const blob = new Blob([csv],{type:'text/csv'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='assets.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // Portfolio KPIs
  const totalAcq = assets.reduce((s,a)=>s+(parseFloat(a.acquisition_price)||0),0)
  const totalVal = assets.reduce((s,a)=>s+(parseFloat(a.current_value)||0),0)
  const totalNOI = assets.reduce((s,a)=>s+(parseFloat(a.noi_trailing)||0),0)
  const totalDS  = assets.reduce((s,a)=>s+(parseFloat(a.debt_service_annual)||0),0)
  const unrealizedGain = totalVal-totalAcq
  const gainPct = totalAcq ? ((unrealizedGain/totalAcq)*100).toFixed(1) : null
  const wtdYOC = totalAcq&&totalNOI ? ((totalNOI/totalAcq)*100).toFixed(2) : null
  const wtdLevYOC = totalAcq&&totalNOI&&totalDS ? (((totalNOI-totalDS)/totalAcq)*100).toFixed(2) : null

  if (loading) return <div className="loading">Loading assets...</div>
  if (error) return <div className="empty-state"><div className="empty-state-icon">⚠</div><div className="empty-state-title">Can't reach database</div></div>

  return (
    <div>
      <div className="page-header">
        <h1>Asset Tracker</h1>
        <p>{assets.length} assets across {[...new Set(assets.map(a=>a.market).filter(Boolean))].length} markets · Click any asset to view or edit</p>
      </div>

      {/* Portfolio KPI cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Portfolio Value</div>
          <div className="kpi-value">{fmtM(totalVal)}</div>
          <div className="kpi-change">{fmtM(totalAcq)} cost basis</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Unrealized Gain</div>
          <div className="kpi-value">{unrealizedGain?(unrealizedGain>=0?'+':'')+fmtM(unrealizedGain):'—'}</div>
          <div className={`kpi-change${unrealizedGain<0?' down':''}`}>{gainPct?`${unrealizedGain>=0?'+':''}${gainPct}% vs cost`:''}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">
            <span className="tooltip-wrap" style={{cursor:'help'}}>Wtd. Unlevered YOC ⓘ
              <div className="tooltip" style={{minWidth:220,fontWeight:400}}>Total NOI ÷ Total Acquisition Price<br/>Before debt service</div>
            </span>
          </div>
          <div className="kpi-value">{wtdYOC?`${wtdYOC}%`:'—'}</div>
          <div className="kpi-change">Levered: {wtdLevYOC?`${wtdLevYOC}%`:'—'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total T12 NOI</div>
          <div className="kpi-value">{fmtM(totalNOI)}</div>
          <div className="kpi-change">Trailing 12-month</div>
        </div>
      </div>

      {/* Bulk bar */}
      {selected.size>0&&(
        <div className="bulk-bar">
          <span>{selected.size} selected</span>
          <button className="btn btn-secondary btn-sm" onClick={exportCSV}>Export CSV</button>
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
            <input
              className="form-input"
              style={{width:180,padding:'5px 10px',fontSize:12}}
              placeholder="Search..."
              value={search}
              onChange={e=>setSearch(e.target.value)}
            />
          </div>
          {selected.size>0&&(
            <button className="btn btn-secondary btn-sm" onClick={exportCSV}>Export CSV</button>
          )}
        </div>

        {filtered.length===0?(
          <div className="empty-state">
            <div className="empty-state-icon">🏨</div>
            <div className="empty-state-title">{search?'No assets match':'No assets yet'}</div>
          </div>
        ):(
          <div style={{overflowX:'auto'}}>
            <table className="data-table">
              <thead><tr>
                <th style={{width:28}}>
                  <input type="checkbox" className="row-checkbox"
                    checked={selected.size===filtered.length&&filtered.length>0}
                    onChange={toggleAll}/>
                </th>
                <SortHeader label="Property" field="name" sort={sort} onSort={handleSort}/>
                <SortHeader label="Market" field="market" sort={sort} onSort={handleSort}/>
                <SortHeader label="Rooms" field="rooms" sort={sort} onSort={handleSort}/>
                <SortHeader label="Acq. Price" field="acquisition_price" sort={sort} onSort={handleSort}/>
                <SortHeader label="Current Value" field="current_value" sort={sort} onSort={handleSort}/>
                <th>Gain / Loss</th>
                <SortHeader label="NOI T12" field="noi_trailing" sort={sort} onSort={handleSort}/>
                <th>
                  <span className="tooltip-wrap" style={{cursor:'help'}}>Levered YOC ⓘ
                    <div className="tooltip" style={{fontWeight:400,minWidth:200}}>(NOI − Debt Service) ÷ Acquisition Price</div>
                  </span>
                </th>
                <SortHeader label="Status" field="status" sort={sort} onSort={handleSort}/>
                <th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(a=>{
                  const gain = a.current_value&&a.acquisition_price ? parseFloat(a.current_value)-parseFloat(a.acquisition_price) : null
                  const gainPct = gain&&a.acquisition_price ? ((gain/parseFloat(a.acquisition_price))*100).toFixed(1) : null
                  const yoc = a.noi_trailing&&a.acquisition_price ? ((parseFloat(a.noi_trailing)/parseFloat(a.acquisition_price))*100).toFixed(2) : null
                  const levYoc = a.noi_trailing&&a.debt_service_annual&&a.acquisition_price ? (((parseFloat(a.noi_trailing)-parseFloat(a.debt_service_annual))/parseFloat(a.acquisition_price))*100).toFixed(2) : null
                  const ss = statusStyle(a.status)
                  return (
                    <tr key={a.id} style={{opacity:selected.size>0&&!selected.has(a.id)?0.6:1}}>
                      <td>
                        <input type="checkbox" className="row-checkbox" checked={selected.has(a.id)} onChange={()=>toggleSelect(a.id)}/>
                      </td>
                      <td>
                        <Link to={`/assets/${a.id}`} style={{color:'var(--g600)',textDecoration:'none',fontWeight:500}}>{a.name}</Link>
                        {a.brand&&<div style={{fontSize:10,color:'var(--gray500)'}}>{a.brand}</div>}
                      </td>
                      <td style={{color:'var(--gray600)'}}>{a.market||'—'}</td>
                      <td>{a.rooms?.toLocaleString()||'—'}</td>
                      <td>{fmtM(a.acquisition_price)}</td>
                      <td>{fmtM(a.current_value)}</td>
                      <td>
                        {gain!==null?(
                          <span style={{color:gain>=0?'var(--g600)':'var(--red)',fontWeight:500,fontSize:12}}>
                            {gain>=0?'+':''}{fmtM(gain)}<br/>
                            <span style={{fontSize:10,fontWeight:400}}>({gain>=0?'+':''}{gainPct}%)</span>
                          </span>
                        ):'—'}
                      </td>
                      <td style={{fontWeight:500}}>{fmtM(a.noi_trailing)}</td>
                      <td>
                        {levYoc||yoc?(
                          <div className="tooltip-wrap">
                            <span style={{fontWeight:600,color:'var(--g700)'}}>{levYoc?`${levYoc}%`:yoc?`${yoc}%`:'—'}</span>
                            <div className="tooltip" style={{minWidth:190,fontWeight:400}}>
                              <div style={{fontWeight:600,marginBottom:4}}>Yield on Cost</div>
                              <div style={{fontSize:11,color:'var(--g200)'}}>Unlevered: {yoc?`${yoc}%`:'—'}</div>
                              <div style={{fontSize:11,color:'var(--g200)'}}>Levered: {levYoc?`${levYoc}%`:'—'}</div>
                            </div>
                          </div>
                        ):'—'}
                      </td>
                      <td>
                        <span style={{fontSize:11,fontWeight:500,padding:'2px 8px',borderRadius:10,background:ss.bg,color:ss.color,whiteSpace:'nowrap'}}>
                          {ss.label}
                        </span>
                      </td>
                      <td>
                        <Link to={`/assets/${a.id}`} style={{textDecoration:'none'}}>
                          <button className="card-action">View →</button>
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
