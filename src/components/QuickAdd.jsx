// QuickAdd.jsx — drop this in src/components/
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAssets, useDeals } from '../hooks/useData'

const QUICK_TYPES = [
  { id:'deal', label:'New Deal', icon:'💼', color:'var(--g600)' },
  { id:'task', label:'New Priority', icon:'◫', color:'var(--blue)' },
  { id:'valuation', label:'New Valuation', icon:'📊', color:'#7b1fa2' },
  { id:'contact', label:'New Contact', icon:'👤', color:'var(--amber)' },
]

export default function QuickAdd() {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const { assets } = useAssets()
  const { deals, addDeal } = useDeals()
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSave = async () => {
    setLoading(true)
    try {
      if (type === 'deal') {
        const { error } = await addDeal({ name: form.name||'New Deal', market: form.market||null, stage: form.stage||'prospecting', ask_price: form.ask_price?parseFloat(form.ask_price):null, cap_rate: form.cap_rate?parseFloat(form.cap_rate):null, type:'hotel', score:50, close_probability:15 })
        if (!error) { setSuccess(true); setTimeout(()=>{ setOpen(false); setType(null); setForm({}); setSuccess(false); navigate('/pipeline') }, 1000) }
      } else if (type === 'task') {
        const { error } = await supabase.from('tasks').insert({ item: form.item||'', poc: form.poc||null, status:'Not Started', due_date: form.due_date||null, asset_id: form.asset_id||null })
        if (!error) { setSuccess(true); setTimeout(()=>{ setOpen(false); setType(null); setForm({}); setSuccess(false); navigate('/tasks') }, 1000) }
      } else if (type === 'valuation') {
        const { error } = await supabase.from('valuations').insert({ asset_id: form.asset_id, quarter: parseInt(form.quarter)||1, year: parseInt(form.year)||new Date().getFullYear(), internal_estimate: form.internal_estimate?parseFloat(form.internal_estimate):null, valuation_method:'income', valuation_date: new Date().toISOString().split('T')[0] })
        if (!error) { setSuccess(true); setTimeout(()=>{ setOpen(false); setType(null); setForm({}); setSuccess(false); navigate('/valuations') }, 1000) }
      } else if (type === 'contact') {
        const { error } = await supabase.from('contacts').insert({ name: form.name||'New Contact', company: form.company||null, category: form.category||'broker', email: form.email||null })
        if (!error) { setSuccess(true); setTimeout(()=>{ setOpen(false); setType(null); setForm({}); setSuccess(false); navigate('/contacts') }, 1000) }
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  return (
    <>
      {/* Floating + button */}
      <div style={{ position:'fixed', bottom:24, right:24, zIndex:9998 }}>
        <div style={{ width:48, height:48, borderRadius:'50%', background:'var(--g600)', boxShadow:'0 4px 16px rgba(13,43,26,0.35)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', transition:'all .2s', border:'2px solid rgba(255,255,255,0.15)' }}
          onClick={()=>{ setOpen(o=>!o); setType(null); setForm({}) }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 4v12M4 10h12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Type picker */}
        {open && !type && (
          <div style={{ position:'absolute', bottom:60, right:0, background:'var(--white)', border:'1px solid var(--gray100)', borderRadius:12, padding:8, boxShadow:'var(--shadow-lg)', width:160, animation:'scaleIn .15s ease' }}>
            <div style={{ fontSize:10, color:'var(--gray500)', padding:'4px 8px', marginBottom:4, fontWeight:500, textTransform:'uppercase', letterSpacing:'.07em' }}>Quick add</div>
            {QUICK_TYPES.map(t=>(
              <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:8, cursor:'pointer', fontSize:12.5, color:'var(--g900)' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--gray50)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                onClick={()=>setType(t.id)}>
                <span style={{ fontSize:16 }}>{t.icon}</span>{t.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick form modal */}
      {open && type && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&(setOpen(false),setType(null),setForm({}))}>
          <div className="modal" style={{ maxWidth:440 }}>
            <div className="modal-header">
              <span className="modal-title">{QUICK_TYPES.find(t=>t.id===type)?.icon} {QUICK_TYPES.find(t=>t.id===type)?.label}</span>
              <button className="modal-close" onClick={()=>{setOpen(false);setType(null);setForm({})}}>✕</button>
            </div>

            {success ? (
              <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
                <div style={{ fontSize:14, fontWeight:500, color:'var(--g900)' }}>Created successfully!</div>
                <div style={{ fontSize:12, color:'var(--gray500)', marginTop:4 }}>Redirecting...</div>
              </div>
            ) : (
              <>
                {type === 'deal' && (<>
                  <div className="form-group"><label className="form-label">Deal Name *</label><input className="form-input" autoFocus value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="Nashville Boutique Hotel"/></div>
                  <div className="form-grid-2">
                    <div className="form-group"><label className="form-label">Market</label><input className="form-input" value={form.market||''} onChange={e=>set('market',e.target.value)} placeholder="Nashville, TN"/></div>
                    <div className="form-group"><label className="form-label">Ask Price ($)</label><input className="form-input" type="number" value={form.ask_price||''} onChange={e=>set('ask_price',e.target.value)}/></div>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group"><label className="form-label">Cap Rate (%)</label><input className="form-input" type="number" step="0.1" value={form.cap_rate||''} onChange={e=>set('cap_rate',e.target.value)}/></div>
                    <div className="form-group"><label className="form-label">Stage</label>
                      <select className="form-select" value={form.stage||'prospecting'} onChange={e=>set('stage',e.target.value)}>
                        {['prospecting','loi','due_diligence','closing'].map(s=><option key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
                      </select>
                    </div>
                  </div>
                </>)}

                {type === 'task' && (<>
                  <div className="form-group"><label className="form-label">Item *</label><input className="form-input" autoFocus value={form.item||''} onChange={e=>set('item',e.target.value)} placeholder="Action item description"/></div>
                  <div className="form-grid-2">
                    <div className="form-group"><label className="form-label">Asset</label>
                      <select className="form-select" value={form.asset_id||''} onChange={e=>set('asset_id',e.target.value)}>
                        <option value="">Select asset…</option>
                        {assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">POC</label><input className="form-input" value={form.poc||''} onChange={e=>set('poc',e.target.value.toUpperCase())} placeholder="DR"/></div>
                  </div>
                  <div className="form-group"><label className="form-label">Due Date</label><input className="form-input" type="date" value={form.due_date||''} onChange={e=>set('due_date',e.target.value)}/></div>
                </>)}

                {type === 'valuation' && (<>
                  <div className="form-group"><label className="form-label">Asset *</label>
                    <select className="form-select" value={form.asset_id||''} onChange={e=>set('asset_id',e.target.value)}>
                      <option value="">Select asset...</option>
                      {assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group"><label className="form-label">Quarter</label>
                      <select className="form-select" value={form.quarter||'1'} onChange={e=>set('quarter',e.target.value)}>
                        {[1,2,3,4].map(q=><option key={q} value={q}>Q{q}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">Year</label>
                      <input className="form-input" type="number" value={form.year||new Date().getFullYear()} onChange={e=>set('year',e.target.value)}/>
                    </div>
                  </div>
                  <div className="form-group"><label className="form-label">Internal Estimate ($)</label><input className="form-input" type="number" value={form.internal_estimate||''} onChange={e=>set('internal_estimate',e.target.value)}/></div>
                </>)}

                {type === 'contact' && (<>
                  <div className="form-group"><label className="form-label">Name *</label><input className="form-input" autoFocus value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="John Smith"/></div>
                  <div className="form-grid-2">
                    <div className="form-group"><label className="form-label">Company</label><input className="form-input" value={form.company||''} onChange={e=>set('company',e.target.value)} placeholder="CBRE"/></div>
                    <div className="form-group"><label className="form-label">Category</label>
                      <select className="form-select" value={form.category||'broker'} onChange={e=>set('category',e.target.value)}>
                        {['broker','lender','operator','jv_partner','legal','consultant','investor','other'].map(c=><option key={c} value={c}>{c.replace('_',' ').replace(/\b\w/g,x=>x.toUpperCase())}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email||''} onChange={e=>set('email',e.target.value)}/></div>
                </>)}

                <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
                  <button className="btn btn-secondary" onClick={()=>setType(null)}>← Back</button>
                  <button className="btn btn-primary" onClick={handleSave} disabled={loading||(type==='deal'&&!form.name)||(type==='task'&&!form.item)||(type==='valuation'&&!form.asset_id)||(type==='contact'&&!form.name)}>{loading?'Saving...':'Create'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
