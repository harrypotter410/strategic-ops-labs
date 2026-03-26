import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const fmt = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'
const fmtK = (n) => n ? `$${Math.round(n).toLocaleString()}` : '—'
const STAGE_LABELS = { prospecting:'Prospecting', loi:'LOI Signed', due_diligence:'Due Diligence', closing:'Closing', closed:'Closed', dead:'Dead' }
const STAGES = ['prospecting','loi','due_diligence','closing']
const ACT_ICONS = { call:'📞', email:'📧', site_visit:'🏨', loi:'📄', offer:'💼', meeting:'🤝', document:'📎', note:'📝', stage_change:'🔄' }

function calcScore(deal) {
  let score = 50
  if (deal.cap_rate) { if (deal.cap_rate>=8)score+=20; else if(deal.cap_rate>=7)score+=15; else if(deal.cap_rate>=6)score+=8; else if(deal.cap_rate<5)score-=10 }
  if (deal.price_per_key) { if(deal.price_per_key<150000)score+=15; else if(deal.price_per_key<200000)score+=10; else if(deal.price_per_key<250000)score+=5; else if(deal.price_per_key>350000)score-=10 }
  if (deal.projected_irr) { if(deal.projected_irr>=18)score+=15; else if(deal.projected_irr>=15)score+=10; else if(deal.projected_irr>=12)score+=5; else if(deal.projected_irr<10)score-=10 }
  return Math.min(100,Math.max(0,score))
}

// Sensitivity analysis calculator
function SensitivityMatrix({ deal }) {
  const [params, setParams] = useState({ noi: deal.ask_price&&deal.cap_rate ? deal.ask_price*(deal.cap_rate/100) : 1000000, ltv: deal.ltv||65, interest_rate: deal.interest_rate||6.5, hold_years: deal.hold_period||5 })
  const exitCapRates = [4.5,5.0,5.5,6.0,6.5,7.0,7.5]
  const entryCapRates = [5.5,6.0,6.5,7.0,7.5,8.0,8.5]

  const calcIRR = (entryCap, exitCap) => {
    if (!params.noi || !entryCap || !exitCap) return null
    const entryVal = params.noi / (entryCap/100)
    const exitVal = params.noi * Math.pow(1.03, params.hold_years) / (exitCap/100)
    const debtAmt = entryVal * (params.ltv/100)
    const equity = entryVal - debtAmt
    const annualDS = debtAmt * (params.interest_rate/100)
    const annualCF = params.noi - annualDS
    const proceeds = exitVal - debtAmt
    // Simple IRR approximation using XIRR-like approach
    let irr = 0.1
    for (let i = 0; i < 50; i++) {
      let npv = -equity
      for (let y = 1; y <= params.hold_years; y++) npv += annualCF / Math.pow(1+irr, y)
      npv += proceeds / Math.pow(1+irr, params.hold_years)
      if (Math.abs(npv) < 1000) break
      irr += npv > 0 ? 0.005 : -0.005
    }
    return (irr*100).toFixed(1)
  }

  const getColor = (irr) => {
    if (!irr) return 'var(--gray50)'
    const v = parseFloat(irr)
    if (v >= 18) return '#e8f5e9'
    if (v >= 15) return '#f0f8f3'
    if (v >= 12) return '#fff8e1'
    if (v >= 10) return '#fff3e0'
    return '#fce4ec'
  }

  const getTextColor = (irr) => {
    if (!irr) return 'var(--gray500)'
    const v = parseFloat(irr)
    if (v >= 18) return '#1b5e20'
    if (v >= 15) return 'var(--g600)'
    if (v >= 12) return '#f57f17'
    if (v >= 10) return '#e65100'
    return 'var(--red)'
  }

  return (
    <div>
      <div style={{display:'flex',gap:12,marginBottom:16,flexWrap:'wrap'}}>
        <div className="form-group" style={{marginBottom:0}}>
          <label className="form-label">NOI ($)</label>
          <input className="form-input" style={{width:140}} type="number" value={params.noi} onChange={e=>setParams(p=>({...p,noi:parseFloat(e.target.value)||0}))}/>
        </div>
        <div className="form-group" style={{marginBottom:0}}>
          <label className="form-label">LTV (%)</label>
          <input className="form-input" style={{width:80}} type="number" value={params.ltv} onChange={e=>setParams(p=>({...p,ltv:parseFloat(e.target.value)||65}))}/>
        </div>
        <div className="form-group" style={{marginBottom:0}}>
          <label className="form-label">Interest Rate (%)</label>
          <input className="form-input" style={{width:80}} type="number" step="0.1" value={params.interest_rate} onChange={e=>setParams(p=>({...p,interest_rate:parseFloat(e.target.value)||6.5}))}/>
        </div>
        <div className="form-group" style={{marginBottom:0}}>
          <label className="form-label">Hold (years)</label>
          <input className="form-input" style={{width:80}} type="number" value={params.hold_years} onChange={e=>setParams(p=>({...p,hold_years:parseInt(e.target.value)||5}))}/>
        </div>
      </div>

      <div style={{fontSize:11,color:'var(--gray500)',marginBottom:10}}>IRR sensitivity — Entry cap rate (rows) vs Exit cap rate (columns). <span style={{background:'#e8f5e9',color:'#1b5e20',padding:'1px 6px',borderRadius:4,fontSize:10}}>≥18%</span> <span style={{background:'#f0f8f3',color:'var(--g600)',padding:'1px 6px',borderRadius:4,fontSize:10,marginLeft:4}}>15-18%</span> <span style={{background:'#fff8e1',color:'#f57f17',padding:'1px 6px',borderRadius:4,fontSize:10,marginLeft:4}}>12-15%</span></div>

      <div style={{overflowX:'auto'}}>
        <table style={{borderCollapse:'collapse',fontSize:12,width:'100%'}}>
          <thead>
            <tr>
              <th style={{padding:'6px 10px',fontSize:10,color:'var(--gray500)',fontWeight:500,textAlign:'left',borderBottom:'1px solid var(--gray100)'}}>Entry → Exit</th>
              {exitCapRates.map(ec=><th key={ec} style={{padding:'6px 10px',fontSize:10,color:'var(--gray500)',fontWeight:500,textAlign:'center',borderBottom:'1px solid var(--gray100)'}}>{ec}%</th>)}
            </tr>
          </thead>
          <tbody>
            {entryCapRates.map(entry=>(
              <tr key={entry}>
                <td style={{padding:'6px 10px',fontSize:11,fontWeight:500,color:'var(--gray700)',borderBottom:'1px solid var(--gray100)'}}>{entry}%</td>
                {exitCapRates.map(exit=>{
                  const irr = calcIRR(entry,exit)
                  return (
                    <td key={exit} style={{padding:'6px 10px',textAlign:'center',borderBottom:'1px solid var(--gray100)',background:getColor(irr),color:getTextColor(irr),fontWeight:500,fontSize:12}}>
                      {irr?`${irr}%`:'—'}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function DealDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [deal, setDeal] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [activity, setActivity] = useState([])
  const [documents, setDocuments] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [newActivity, setNewActivity] = useState('')
  const [actType, setActType] = useState('call')
  const [newCheckItem, setNewCheckItem] = useState('')
  const [docModal, setDocModal] = useState(false)
  const [docForm, setDocForm] = useState({ name:'', category:'psa', notes:'', file_url:'' })

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const [dealRes, actRes, docsRes, contactsRes] = await Promise.all([
        supabase.from('deals').select('*, deal_checklist(*)').eq('id', id).single(),
        supabase.from('deal_activity').select('*').eq('deal_id', id).order('activity_date', { ascending: false }),
        supabase.from('documents').select('*').eq('deal_id', id).order('created_at', { ascending: false }),
        supabase.from('contact_associations').select('*, contacts(*)').eq('deal_id', id),
      ])
      setDeal(dealRes.data)
      setChecklist(dealRes.data?.deal_checklist || [])
      setActivity(actRes.data || [])
      setDocuments(docsRes.data || [])
      setContacts(contactsRes.data?.map(ca=>ca.contacts).filter(Boolean) || [])
      setLoading(false)
    }
    fetch()
  }, [id])

  const addActivity = async () => {
    if (!newActivity.trim()) return
    const { data } = await supabase.from('deal_activity').insert({ deal_id: id, activity_type: actType, description: newActivity.trim() }).select().single()
    if (data) { setActivity(prev => [data, ...prev]); setNewActivity('') }
  }

  const toggleCheck = async (item) => {
    const next = !item.completed
    await supabase.from('deal_checklist').update({ completed: next, completed_at: next ? new Date().toISOString() : null }).eq('id', item.id)
    setChecklist(prev => prev.map(c => c.id===item.id?{...c,completed:next}:c))
  }

  const addCheckItem = async () => {
    if (!newCheckItem.trim()) return
    const { data } = await supabase.from('deal_checklist').insert({ deal_id: id, item: newCheckItem.trim(), sort_order: checklist.length }).select().single()
    if (data) { setChecklist(prev => [...prev, data]); setNewCheckItem('') }
  }

  const addDoc = async () => {
    const { data } = await supabase.from('documents').insert({ deal_id: id, ...docForm }).select().single()
    if (data) setDocuments(prev => [data, ...prev])
    setDocModal(false); setDocForm({ name:'', category:'psa', notes:'', file_url:'' })
  }

  const updateStage = async (stage) => {
    await supabase.from('deals').update({ stage, close_probability: stage==='closing'?90:stage==='due_diligence'?65:stage==='loi'?35:15 }).eq('id', id)
    setDeal(prev => ({ ...prev, stage }))
    await supabase.from('deal_activity').insert({ deal_id: id, activity_type: 'stage_change', description: `Stage changed to ${STAGE_LABELS[stage]}` })
  }

  if (loading) return <div className="loading">Loading deal...</div>
  if (!deal) return <div className="empty-state"><div className="empty-state-title">Deal not found</div><Link to="/pipeline"><button className="btn btn-secondary">← Back to pipeline</button></Link></div>

  const score = calcScore(deal)
  const scoreColor = score>=70?'var(--g600)':score>=50?'var(--amber)':'var(--red)'
  const completedItems = checklist.filter(c=>c.completed).length
  const tabStyle = (t) => ({ fontSize:12.5, padding:'9px 18px', cursor:'pointer', color:tab===t?'var(--g700)':'var(--gray500)', borderBottom:`2px solid ${tab===t?'var(--g600)':'transparent'}`, marginBottom:-2, fontWeight:tab===t?500:400, background:'none', border:'none', borderBottom:`2px solid ${tab===t?'var(--g600)':'transparent'}`, transition:'all .12s' })

  return (
    <div>
      <div style={{fontSize:11,color:'var(--gray500)',marginBottom:16,display:'flex',alignItems:'center',gap:6}}>
        <Link to="/pipeline" style={{color:'var(--g600)',textDecoration:'none'}}>Pipeline</Link>
        <span>›</span><span>{deal.name}</span>
      </div>

      {/* Deal header */}
      <div style={{background:'var(--g900)',borderRadius:12,padding:'24px 28px',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:20,flexWrap:'wrap'}}>
          <div>
            <div style={{fontFamily:'Playfair Display,serif',fontSize:22,fontWeight:600,color:'#fff',marginBottom:6}}>{deal.name}</div>
            <div style={{fontSize:12,color:'var(--g200)',marginBottom:12}}>{[deal.market,deal.type&&deal.type.charAt(0).toUpperCase()+deal.type.slice(1),deal.rooms&&`${deal.rooms} rooms`].filter(Boolean).join(' · ')}</div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              <select style={{fontSize:11,padding:'4px 10px',borderRadius:20,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',color:'#fff',cursor:'pointer'}} value={deal.stage} onChange={e=>updateStage(e.target.value)}>
                {STAGES.map(s=><option key={s} value={s} style={{background:'var(--g900)',color:'#fff'}}>{STAGE_LABELS[s]}</option>)}
              </select>
              {deal.broker&&<span style={{fontSize:11,color:'var(--g200)'}}>Broker: {deal.broker}</span>}
              {deal.expected_close&&<span style={{fontSize:11,color:'var(--g200)'}}>Close: {new Date(deal.expected_close).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(90px,1fr))',gap:10}}>
            {[
              ['Ask Price', fmt(deal.ask_price)],
              ['Cap Rate', deal.cap_rate?`${deal.cap_rate}%`:'—'],
              ['Proj. IRR', deal.projected_irr?`${deal.projected_irr}%`:'—'],
              ['Score', `${score}/100`],
            ].map(([l,v],i)=>(
              <div key={l} style={{background:'rgba(255,255,255,0.08)',borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                <div style={{fontSize:9,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:4}}>{l}</div>
                <div style={{fontSize:16,fontWeight:600,color:i===3?scoreColor:'#fff'}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Progress bar */}
        {deal.close_probability && (
          <div style={{marginTop:16}}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:4}}>
              <span>Close probability</span><span>{deal.close_probability}%</span>
            </div>
            <div style={{height:4,background:'rgba(255,255,255,0.15)',borderRadius:2}}>
              <div style={{height:'100%',width:`${deal.close_probability}%`,background:'var(--g400)',borderRadius:2,transition:'width .3s'}}/>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:'flex',borderBottom:'2px solid var(--gray100)',marginBottom:20,gap:0,overflowX:'auto'}}>
        {[['overview','Overview'],['returns','Returns'],['checklist',`Checklist (${completedItems}/${checklist.length})`],['activity','Activity'],['sensitivity','Sensitivity'],['contacts','Contacts'],['documents','Documents']].map(([t,l])=>(
          <button key={t} style={tabStyle(t)} onClick={()=>setTab(t)}>{l}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:16}}>
            {[
              ['Ask Price', fmt(deal.ask_price)],
              ['Price/Key', deal.price_per_key?`$${deal.price_per_key.toLocaleString()}`:'—'],
              ['Cap Rate', deal.cap_rate?`${deal.cap_rate}%`:'—'],
              ['Deal Score', `${score}/100`],
              ['Proj. IRR', deal.projected_irr?`${deal.projected_irr}%`:'—'],
              ['Equity Multiple', deal.equity_multiple?`${deal.equity_multiple}x`:'—'],
              ['Cash-on-Cash', deal.cash_on_cash?`${deal.cash_on_cash}%`:'—'],
              ['Close Probability', deal.close_probability?`${deal.close_probability}%`:'—'],
            ].map(([l,v])=>(
              <div key={l} style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'10px 12px'}}>
                <div style={{fontSize:9,color:'var(--gray500)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:4}}>{l}</div>
                <div style={{fontSize:15,fontWeight:500,color:'var(--g900)'}}>{v}</div>
              </div>
            ))}
          </div>
          {deal.notes && (
            <div style={{padding:'14px 16px',background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:8}}>
              <div style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'.06em',color:'var(--g600)',marginBottom:6}}>Investment Thesis</div>
              <div style={{fontSize:13,color:'var(--gray700)',lineHeight:1.7}}>{deal.notes}</div>
            </div>
          )}
        </>
      )}

      {/* RETURNS */}
      {tab === 'returns' && (
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div className="card" style={{marginBottom:0}}>
            <div className="card-header"><span className="card-title">Return projections</span></div>
            {[['Projected IRR', deal.projected_irr?`${deal.projected_irr}%`:'—'],['Equity Multiple', deal.equity_multiple?`${deal.equity_multiple}x`:'—'],['Cash-on-Cash', deal.cash_on_cash?`${deal.cash_on_cash}%`:'—'],['Hold Period', deal.hold_period?`${deal.hold_period} years`:'—']].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--gray100)'}}>
                <span style={{fontSize:12,color:'var(--gray500)'}}>{l}</span>
                <span style={{fontSize:13,fontWeight:500,color:'var(--g900)'}}>{v}</span>
              </div>
            ))}
          </div>
          <div className="card" style={{marginBottom:0}}>
            <div className="card-header"><span className="card-title">Capital structure</span></div>
            {[['Equity Check', fmt(deal.equity_check)],['Debt Amount', fmt(deal.debt_amount)],['LTV', deal.ltv?`${deal.ltv}%`:'—'],['Price/Key', deal.price_per_key?`$${deal.price_per_key.toLocaleString()}`:'—']].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--gray100)'}}>
                <span style={{fontSize:12,color:'var(--gray500)'}}>{l}</span>
                <span style={{fontSize:13,fontWeight:500,color:'var(--g900)'}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CHECKLIST */}
      {tab === 'checklist' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Due diligence checklist</span><span style={{fontSize:11,color:'var(--gray500)'}}>{completedItems}/{checklist.length} complete</span></div>
          {checklist.length > 0 && <div style={{height:4,background:'var(--gray100)',borderRadius:2,marginBottom:16}}><div style={{height:'100%',width:`${checklist.length>0?(completedItems/checklist.length)*100:0}%`,background:'var(--g600)',borderRadius:2,transition:'width .3s'}}/></div>}
          <ul className="checklist">
            {checklist.sort((a,b)=>a.sort_order-b.sort_order).map(item=>(
              <li key={item.id}>
                <div className={`check-box${item.completed?' done':''}`} onClick={()=>toggleCheck(item)}>{item.completed&&'✓'}</div>
                <span style={{textDecoration:item.completed?'line-through':'none',color:item.completed?'var(--gray500)':'var(--gray700)',flex:1}}>{item.item}</span>
                {item.completed_at&&<span style={{fontSize:10,color:'var(--gray300)'}}>{new Date(item.completed_at).toLocaleDateString()}</span>}
              </li>
            ))}
          </ul>
          <div style={{display:'flex',gap:8,marginTop:12}}>
            <input className="form-input" style={{flex:1}} placeholder="Add checklist item..." value={newCheckItem} onChange={e=>setNewCheckItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCheckItem()}/>
            <button className="btn btn-secondary btn-sm" onClick={addCheckItem} disabled={!newCheckItem.trim()}>Add</button>
          </div>
        </div>
      )}

      {/* ACTIVITY */}
      {tab === 'activity' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Activity log</span></div>
          <div style={{display:'flex',gap:8,marginBottom:16}}>
            <select className="form-select" style={{width:130,fontSize:11}} value={actType} onChange={e=>setActType(e.target.value)}>
              {Object.keys(ACT_ICONS).map(t=><option key={t} value={t}>{ACT_ICONS[t]} {t.replace('_',' ')}</option>)}
            </select>
            <input className="form-input" style={{flex:1}} placeholder="Describe the activity..." value={newActivity} onChange={e=>setNewActivity(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addActivity()}/>
            <button className="btn btn-primary btn-sm" onClick={addActivity} disabled={!newActivity.trim()}>Log</button>
          </div>
          {activity.length===0?<div style={{fontSize:12,color:'var(--gray500)'}}>No activity logged yet.</div>:activity.map(a=>(
            <div key={a.id} style={{display:'flex',gap:10,padding:'10px 0',borderBottom:'1px solid var(--gray100)',alignItems:'flex-start'}}>
              <span style={{fontSize:16,flexShrink:0}}>{ACT_ICONS[a.activity_type]}</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,color:'var(--g900)'}}>{a.description}</div>
                <div style={{fontSize:10,color:'var(--gray500)',marginTop:2}}>{new Date(a.activity_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SENSITIVITY */}
      {tab === 'sensitivity' && (
        <div className="card">
          <div className="card-header"><span className="card-title">IRR sensitivity analysis</span></div>
          <SensitivityMatrix deal={deal}/>
        </div>
      )}

      {/* CONTACTS */}
      {tab === 'contacts' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Contacts on this deal</span><Link to="/contacts"><button className="btn btn-secondary btn-sm">Manage contacts →</button></Link></div>
          {contacts.length===0?(
            <div className="empty-state"><div className="empty-state-title">No contacts linked</div><div className="empty-state-desc">Link contacts to this deal from the Contacts page.</div></div>
          ):contacts.map(c=>(
            <div key={c.id} style={{display:'flex',gap:12,padding:'10px 0',borderBottom:'1px solid var(--gray100)',alignItems:'center'}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:'var(--g100)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:500,color:'var(--g700)',flexShrink:0}}>{c.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,color:'var(--g900)'}}>{c.name}</div>
                <div style={{fontSize:11,color:'var(--gray500)'}}>{[c.role,c.company].filter(Boolean).join(' · ')}</div>
              </div>
              {c.email&&<a href={`mailto:${c.email}`} style={{fontSize:11,color:'var(--g600)',textDecoration:'none'}}>✉ {c.email}</a>}
            </div>
          ))}
        </div>
      )}

      {/* DOCUMENTS */}
      {tab === 'documents' && (
        <div className="card">
          <div className="card-header"><span className="card-title">Deal documents</span><button className="btn btn-primary btn-sm" onClick={()=>setDocModal(true)}>+ Add Document</button></div>
          {documents.length===0?(
            <div className="empty-state"><div className="empty-state-icon">📁</div><div className="empty-state-title">No documents yet</div></div>
          ):(
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:12}}>
              {documents.map(doc=>(
                <div key={doc.id} style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:10,padding:'14px 16px'}}>
                  <div style={{fontSize:20,marginBottom:8}}>📄</div>
                  <div style={{fontSize:13,fontWeight:500,color:'var(--g900)',marginBottom:4}}>{doc.name}</div>
                  <span style={{fontSize:9,background:'var(--g100)',color:'var(--g700)',padding:'1px 7px',borderRadius:10,textTransform:'uppercase'}}>{doc.category?.replace('_',' ')}</span>
                  {doc.notes&&<div style={{fontSize:11,color:'var(--gray500)',marginTop:6}}>{doc.notes}</div>}
                  {doc.file_url&&<a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:'var(--g600)',textDecoration:'none',display:'block',marginTop:6}}>→ Open document</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {docModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDocModal(false)}>
          <div className="modal">
            <div className="modal-header"><span className="modal-title">Add Document</span><button className="modal-close" onClick={()=>setDocModal(false)}>✕</button></div>
            <div className="form-group"><label className="form-label">Document Name *</label><input className="form-input" value={docForm.name} onChange={e=>setDocForm(f=>({...f,name:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Category</label>
              <select className="form-select" value={docForm.category} onChange={e=>setDocForm(f=>({...f,category:e.target.value}))}>
                {['psa','appraisal','loan_doc','lease','ic_memo','financial','environmental','title','insurance','other'].map(c=><option key={c} value={c}>{c.replace('_',' ').replace(/\b\w/g,x=>x.toUpperCase())}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Link / URL</label><input className="form-input" value={docForm.file_url} onChange={e=>setDocForm(f=>({...f,file_url:e.target.value}))}/></div>
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
