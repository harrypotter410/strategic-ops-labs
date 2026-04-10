import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const idxColor = (v) => !v?'var(--gray500)':parseFloat(v)>=105?'var(--g600)':parseFloat(v)>=95?'var(--amber)':'var(--red)'
const idxBg = (v) => !v?'var(--gray50)':parseFloat(v)>=105?'var(--g50)':parseFloat(v)>=95?'var(--amberL)':'var(--redL)'

function AssetDropdown({ assets, selected, onSelect }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const sel = assets.find(a=>a.id===selected)
  const filtered = assets.filter(a=>!search||a.name.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const close = (e) => { if (!e.target.closest('.intel-asset-dd')) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="intel-asset-dd" style={{position:'relative',minWidth:260}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',border:'1px solid var(--gray200)',borderRadius:8,cursor:'pointer',background:'var(--white)',fontSize:13,fontWeight:500,color:'var(--g900)'}} onClick={()=>setOpen(o=>!o)}>
        <span style={{flex:1}}>{sel?sel.name:'Select property...'}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      {open&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'var(--white)',border:'1px solid var(--gray200)',borderRadius:10,zIndex:300,boxShadow:'var(--shadow-md)',overflow:'hidden'}}>
          <div style={{padding:'8px 10px',borderBottom:'1px solid var(--gray100)'}}>
            <input className="form-input" style={{padding:'5px 10px',fontSize:12}} placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} onClick={e=>e.stopPropagation()} autoFocus/>
          </div>
          <div style={{maxHeight:240,overflowY:'auto'}}>
            {filtered.map(a=>(
              <div key={a.id} style={{padding:'10px 14px',cursor:'pointer',background:a.id===selected?'var(--g50)':'transparent',borderBottom:'1px solid var(--gray100)'}}
                onClick={()=>{onSelect(a.id);setOpen(false);setSearch('')}}>
                <div style={{fontSize:13,fontWeight:500,color:a.id===selected?'var(--g700)':'var(--g900)'}}>{a.name}</div>
                <div style={{fontSize:10,color:'var(--gray500)'}}>{a.market} · {a.rooms} rooms</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Intel() {
  const { assets } = useAssets()
  const [selectedId, setSelectedId] = useState(null)
  const [compData, setCompData] = useState([])
  const [compSets, setCompSets] = useState([])
  const [loading, setLoading] = useState(false)
  const [addCompModal, setAddCompModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // FIX: comp form has explicit asset_id binding
  const blankCompForm = { asset_id:'', comp_name:'', comp_brand:'', comp_market:'', comp_rooms:'' }
  const [compForm, setCompForm] = useState(blankCompForm)
  const setC = (k,v) => setCompForm(f=>({...f,[k]:v}))

  // Auto-set asset_id in comp form when selectedId changes
  useEffect(() => {
    if (selectedId) {
      setCompForm(f=>({...f,asset_id:selectedId}))
    }
  }, [selectedId])

  // Auto-select first asset
  useEffect(() => { if (assets.length>0&&!selectedId) setSelectedId(assets[0].id) }, [assets])

  // Load data for selected asset
  useEffect(() => {
    if (!selectedId) return
    setLoading(true)
    Promise.all([
      supabase.from('comp_data').select('*').eq('asset_id',selectedId).order('period_year',{ascending:false}).order('period_month',{ascending:false}),
      supabase.from('comp_sets').select('*').eq('asset_id',selectedId).order('sort_order'),
    ]).then(([cd,cs])=>{
      setCompData(cd.data||[])
      setCompSets(cs.data||[])
      setLoading(false)
    })
  }, [selectedId])

  const selectedAsset = assets.find(a=>a.id===selectedId)
  const latest = compData[0]

  // FIX: Save comp set with explicit asset_id
  const handleSaveComp = async () => {
    setSaveError('')
    if (!compForm.comp_name.trim()) { setSaveError('Competitor name is required'); return }
    if (!compForm.asset_id) { setSaveError('Please select an asset first'); return }
    setSaving(true)
    const { data, error } = await supabase.from('comp_sets').insert({
      asset_id: compForm.asset_id,
      comp_name: compForm.comp_name.trim(),
      comp_brand: compForm.comp_brand||null,
      comp_market: compForm.comp_market||null,
      comp_rooms: compForm.comp_rooms?parseInt(compForm.comp_rooms):null,
      sort_order: compSets.length,
    }).select().single()
    if (error) { setSaveError(error.message); setSaving(false); return }
    setCompSets(prev=>[...prev,data])
    setCompForm(blankCompForm)
    setSaveSuccess(true)
    setTimeout(()=>{setSaveSuccess(false);setAddCompModal(false)},1200)
    setSaving(false)
  }

  // Chart data
  const chartData = [...compData].reverse().slice(-12).map(d=>({
    label:`${MONTHS[d.period_month-1].slice(0,3)} ${String(d.period_year).slice(2)}`,
    RGI:d.revpar_index?parseFloat(d.revpar_index):null,
    MPI:d.occ_index?parseFloat(d.occ_index):null,
    ARI:d.adr_index?parseFloat(d.adr_index):null,
  }))

  return (
    <div>
      <div className="page-header">
        <h1>Competitive Intel</h1>
        <p>STR benchmarking and comp set performance by property</p>
      </div>

      {/* Property selector */}
      <div className="card">
        <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:500,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:6}}>Select Property</div>
            <AssetDropdown assets={assets} selected={selectedId} onSelect={setSelectedId}/>
          </div>
          {selectedAsset&&(
            <div style={{fontSize:12,color:'var(--gray500)'}}>
              {selectedAsset.market} · {selectedAsset.rooms} rooms · {compData.length} months of data
            </div>
          )}
          <div style={{display:'flex',gap:8,marginLeft:'auto'}}>
            <button className="btn btn-secondary btn-sm" onClick={()=>{setSaveError('');setSaveSuccess(false);setAddCompModal(true)}} disabled={!selectedId}>+ Add Competitor</button>
          </div>
        </div>
      </div>

      {!selectedId?(
        <div className="empty-state"><div className="empty-state-title">Select a property above</div></div>
      ):loading?(
        <div className="loading">Loading comp data...</div>
      ):(
        <>
          {/* Latest indices */}
          {latest&&(
            <div className="kpi-grid">
              {[['MPI (Occ. Index)',latest.occ_index,'My Occ: '+(latest.my_occupancy?`${parseFloat(latest.my_occupancy).toFixed(1)}%`:'—')],['ARI (ADR Index)',latest.adr_index,'My ADR: '+(latest.my_adr?`$${parseFloat(latest.my_adr).toFixed(0)}`:'—')],['RGI (RevPAR Index)',latest.revpar_index,'My RevPAR: '+(latest.my_revpar?`$${parseFloat(latest.my_revpar).toFixed(0)}`:'—')],].map(([label,val,sub])=>(
                <div key={label} style={{background:'var(--white)',border:`1px solid ${idxColor(val)}40`,borderRadius:'var(--radius)',padding:'14px 16px',position:'relative',overflow:'hidden'}}>
                  <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:idxColor(val)}}/>
                  <div style={{fontSize:10,color:'var(--gray500)',letterSpacing:'.04em',textTransform:'uppercase',marginBottom:6}}>{label}</div>
                  <div style={{fontSize:24,fontFamily:'Playfair Display,serif',fontWeight:600,color:idxColor(val)}}>{val?parseFloat(val).toFixed(1):'—'}</div>
                  <div style={{fontSize:11,color:'var(--gray500)',marginTop:2}}>{sub}</div>
                  <div style={{fontSize:10,color:'var(--gray400)',marginTop:2}}>{MONTHS[latest.period_month-1]} {latest.period_year}</div>
                </div>
              ))}
              <div className="kpi-card">
                <div className="kpi-label">Fair Share Comparison</div>
                <div className="kpi-value" style={{color:latest.revpar_index?(parseFloat(latest.revpar_index)>=105?'var(--g600)':parseFloat(latest.revpar_index)>=95?'var(--amber)':'var(--red)'):'var(--gray300)'}}>{latest.revpar_index?(parseFloat(latest.revpar_index)>=105?'Above':'At / Below'):'—'}</div>
                <div className="kpi-change">100 = fair share. &gt;105 = outperforming</div>
              </div>
            </div>
          )}

          {/* Trend chart */}
          {chartData.length>=2&&(
            <div className="card">
              <div className="card-header"><span className="card-title">STR index trends — {selectedAsset?.name}</span></div>
              <div style={{fontSize:11,color:'var(--gray500)',marginBottom:8}}>100 = fair share (your performance equals the comp set). Above 100 = you are outperforming your set.</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:'var(--gray500)'}} axisLine={false} tickLine={false} domain={[75,135]}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:6}}/>
                  <ReferenceLine y={100} stroke="#c9a96e" strokeDasharray="4 4" label={{value:'Fair share (100)',fontSize:9,fill:'#c9a96e'}}/>
                  <Legend wrapperStyle={{fontSize:11}}/>
                  <Line type="monotone" dataKey="RGI" stroke="var(--g600)" strokeWidth={2} dot={{r:3}} connectNulls/>
                  <Line type="monotone" dataKey="MPI" stroke="var(--amber)" strokeWidth={2} dot={{r:3}} connectNulls/>
                  <Line type="monotone" dataKey="ARI" stroke="var(--blue)" strokeWidth={2} dot={{r:3}} connectNulls/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Monthly data table */}
          {compData.length>0?(
            <div className="card">
              <div className="card-header"><span className="card-title">Monthly STR data — {selectedAsset?.name}</span></div>
              <div style={{overflowX:'auto'}}>
                <table className="data-table">
                  <thead><tr>
                    <th>Period</th>
                    <th>My Occ.</th><th>My ADR</th><th>My RevPAR</th>
                    <th>Comp Occ.</th><th>Comp ADR</th><th>Comp RevPAR</th>
                    <th>MPI</th><th>ARI</th><th>RGI</th>
                  </tr></thead>
                  <tbody>
                    {compData.map(d=>(
                      <tr key={d.id}>
                        <td><strong>{MONTHS[d.period_month-1]} {d.period_year}</strong></td>
                        <td>{d.my_occupancy?`${parseFloat(d.my_occupancy).toFixed(1)}%`:'—'}</td>
                        <td>{d.my_adr?`$${parseFloat(d.my_adr).toFixed(0)}`:'—'}</td>
                        <td>{d.my_revpar?`$${parseFloat(d.my_revpar).toFixed(0)}`:'—'}</td>
                        <td>{d.comp_set_occ?`${parseFloat(d.comp_set_occ).toFixed(1)}%`:'—'}</td>
                        <td>{d.comp_set_adr?`$${parseFloat(d.comp_set_adr).toFixed(0)}`:'—'}</td>
                        <td>{d.comp_set_revpar?`$${parseFloat(d.comp_set_revpar).toFixed(0)}`:'—'}</td>
                        <td style={{fontWeight:600,color:idxColor(d.occ_index)}}>{d.occ_index?parseFloat(d.occ_index).toFixed(1):'—'}</td>
                        <td style={{fontWeight:600,color:idxColor(d.adr_index)}}>{d.adr_index?parseFloat(d.adr_index).toFixed(1):'—'}</td>
                        <td style={{fontWeight:700,color:idxColor(d.revpar_index)}}>{d.revpar_index?parseFloat(d.revpar_index).toFixed(1):'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ):(
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">No STR data for {selectedAsset?.name}</div>
              <div className="empty-state-desc">STR data will appear here once synced via the Integrations tab.</div>
            </div>
          )}

          {/* Comp set */}
          {compSets.length>0&&(
            <div className="card">
              <div className="card-header"><span className="card-title">Comp set — {selectedAsset?.name}</span></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
                {compSets.map(c=>(
                  <div key={c.id} style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'10px 12px'}}>
                    <div style={{fontSize:12.5,fontWeight:500,color:'var(--g900)',marginBottom:2}}>{c.comp_name}</div>
                    {c.comp_brand&&<div style={{fontSize:10,color:'var(--g600)',marginBottom:2}}>{c.comp_brand}</div>}
                    {c.comp_market&&<div style={{fontSize:10,color:'var(--gray500)'}}>{c.comp_market}</div>}
                    {c.comp_rooms&&<div style={{fontSize:10,color:'var(--gray500)'}}>{c.comp_rooms} rooms</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Competitor Modal — FIX: asset_id pre-populated and validated */}
      {addCompModal&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setAddCompModal(false)}>
          <div className="modal" style={{maxWidth:440}}>
            <div className="modal-header">
              <span className="modal-title">+ Add Competitor</span>
              <button className="modal-close" onClick={()=>setAddCompModal(false)}>✕</button>
            </div>
            {saveError&&<div style={{background:'var(--redL)',color:'var(--red)',padding:'8px 12px',borderRadius:7,fontSize:12,marginBottom:12}}>{saveError}</div>}
            {saveSuccess&&<div style={{background:'var(--g100)',color:'var(--g700)',padding:'8px 12px',borderRadius:7,fontSize:12,marginBottom:12}}>✓ Added to comp set</div>}
            <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:7,padding:'8px 12px',fontSize:11,color:'var(--g700)',marginBottom:12}}>
              Adding competitor to comp set for: <strong>{selectedAsset?.name}</strong>
            </div>
            <div className="form-group"><label className="form-label">Competitor Name *</label><input className="form-input" value={compForm.comp_name} onChange={e=>setC('comp_name',e.target.value)} placeholder="Sheraton Memphis Downtown" autoFocus/></div>
            <div className="form-grid-2">
              <div className="form-group"><label className="form-label">Brand</label><input className="form-input" value={compForm.comp_brand} onChange={e=>setC('comp_brand',e.target.value)} placeholder="Sheraton"/></div>
              <div className="form-group"><label className="form-label">Market</label><input className="form-input" value={compForm.comp_market} onChange={e=>setC('comp_market',e.target.value)} placeholder="Memphis, TN"/></div>
            </div>
            <div className="form-group"><label className="form-label">Rooms</label><input className="form-input" type="number" value={compForm.comp_rooms} onChange={e=>setC('comp_rooms',e.target.value)} placeholder="300"/></div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-secondary" onClick={()=>setAddCompModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveComp} disabled={saving||!compForm.comp_name.trim()}>{saving?'Saving...':'Add Competitor'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
