import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useDeals } from '../hooks/useData'

const STAGES = ['prospecting', 'loi', 'due_diligence', 'closing']
const STAGE_LABELS = { prospecting: 'Prospecting', loi: 'LOI Signed', due_diligence: 'Due Diligence', closing: 'Closing' }
const ACTIVITY_TYPES = ['call','email','site_visit','loi','offer','meeting','document','note','stage_change']
const ACTIVITY_ICONS = { call:'📞', email:'📧', site_visit:'🏨', loi:'📄', offer:'💼', meeting:'🤝', document:'📎', note:'📝', stage_change:'🔄' }
const fmt = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'
const fmtK = (n) => n ? `$${Math.round(n).toLocaleString()}` : '—'

function calcScore(deal) {
  let score = 50
  if (deal.cap_rate) {
    if (deal.cap_rate >= 8) score += 20
    else if (deal.cap_rate >= 7) score += 15
    else if (deal.cap_rate >= 6) score += 8
    else if (deal.cap_rate < 5) score -= 10
  }
  if (deal.price_per_key) {
    if (deal.price_per_key < 150000) score += 15
    else if (deal.price_per_key < 200000) score += 10
    else if (deal.price_per_key < 250000) score += 5
    else if (deal.price_per_key > 350000) score -= 10
  }
  if (deal.projected_irr) {
    if (deal.projected_irr >= 18) score += 15
    else if (deal.projected_irr >= 15) score += 10
    else if (deal.projected_irr >= 12) score += 5
    else if (deal.projected_irr < 10) score -= 10
  }
  return Math.min(100, Math.max(0, score))
}

function DealModal({ deal, onClose, onSave }) {
  const [tab, setTab] = useState('basics')
  const [form, setForm] = useState(deal ? { ...deal } : {
    name:'', market:'', type:'hotel', rooms:'', ask_price:'', cap_rate:'', stage:'prospecting',
    notes:'', expected_close:'', broker:'', projected_irr:'', equity_multiple:'', cash_on_cash:'',
    hold_period:5, equity_check:'', debt_amount:'', ltv:65,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const ppk = form.ask_price && form.rooms ? Math.round(parseFloat(form.ask_price) / parseInt(form.rooms)) : null
  const autoScore = calcScore({ ...form, price_per_key: ppk })

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Deal name is required.'); return }
    setLoading(true); setError('')
    const payload = {
      name: form.name.trim(), market: form.market || null, type: form.type,
      rooms: form.rooms ? parseInt(form.rooms) : null,
      ask_price: form.ask_price ? parseFloat(form.ask_price) : null,
      price_per_key: ppk, cap_rate: form.cap_rate ? parseFloat(form.cap_rate) : null,
      stage: form.stage, score: autoScore, notes: form.notes || null,
      expected_close: form.expected_close || null, broker: form.broker || null,
      projected_irr: form.projected_irr ? parseFloat(form.projected_irr) : null,
      equity_multiple: form.equity_multiple ? parseFloat(form.equity_multiple) : null,
      cash_on_cash: form.cash_on_cash ? parseFloat(form.cash_on_cash) : null,
      hold_period: form.hold_period ? parseInt(form.hold_period) : null,
      equity_check: form.equity_check ? parseFloat(form.equity_check) : null,
      debt_amount: form.debt_amount ? parseFloat(form.debt_amount) : null,
      ltv: form.ltv ? parseFloat(form.ltv) : null,
    }
    const { error } = await onSave(payload)
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onClose()
  }

  const ts = (t) => ({ fontSize:12, padding:'6px 14px', borderRadius:20, border:'1px solid', cursor:'pointer', borderColor:tab===t?'var(--g600)':'var(--gray200)', background:tab===t?'var(--g700)':'var(--white)', color:tab===t?'var(--white)':'var(--gray700)' })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width:580 }}>
        <div className="modal-header">
          <span className="modal-title">{deal ? 'Edit Deal' : 'Add Deal'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ background:'var(--redL)', color:'var(--red)', padding:'8px 12px', borderRadius:7, fontSize:12, marginBottom:12 }}>{error}</div>}
        <div style={{ display:'flex', gap:6, marginBottom:16 }}>
          {[['basics','Basics'],['returns','Returns & Financing'],['notes','Notes']].map(([t,l]) => <button key={t} style={ts(t)} onClick={() => setTab(t)}>{l}</button>)}
        </div>
        {tab === 'basics' && (<>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Deal Name *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Market</label><input className="form-input" value={form.market} onChange={e => set('market', e.target.value)} placeholder="City, ST" /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Stage</label>
              <select className="form-select" value={form.stage} onChange={e => set('stage', e.target.value)}>
                {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
                {['hotel','resort','mixed','commercial'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Ask Price ($)</label><input className="form-input" type="number" value={form.ask_price} onChange={e => set('ask_price', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Rooms</label><input className="form-input" type="number" value={form.rooms} onChange={e => set('rooms', e.target.value)} /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Cap Rate (%)</label><input className="form-input" type="number" step="0.1" value={form.cap_rate} onChange={e => set('cap_rate', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Broker</label><input className="form-input" value={form.broker} onChange={e => set('broker', e.target.value)} /></div>
          </div>
          {ppk && <div style={{ background:'var(--g50)', border:'1px solid var(--g100)', borderRadius:7, padding:'10px 14px', fontSize:12, color:'var(--g900)' }}>Price/Key: <strong>{fmtK(ppk)}</strong> · Auto deal score: <strong>{autoScore}/100</strong></div>}
        </>)}
        {tab === 'returns' && (<>
          <div style={{ background:'var(--g50)', border:'1px solid var(--g100)', borderRadius:7, padding:'10px 14px', fontSize:12, color:'var(--g700)', marginBottom:14 }}>Return projections feed into the auto-calculated deal score.</div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Projected IRR (%)</label><input className="form-input" type="number" step="0.1" value={form.projected_irr} onChange={e => set('projected_irr', e.target.value)} placeholder="16.5" /></div>
            <div className="form-group"><label className="form-label">Equity Multiple (x)</label><input className="form-input" type="number" step="0.1" value={form.equity_multiple} onChange={e => set('equity_multiple', e.target.value)} placeholder="2.1" /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Cash-on-Cash (%)</label><input className="form-input" type="number" step="0.1" value={form.cash_on_cash} onChange={e => set('cash_on_cash', e.target.value)} placeholder="8.5" /></div>
            <div className="form-group"><label className="form-label">Hold Period (years)</label><input className="form-input" type="number" value={form.hold_period} onChange={e => set('hold_period', e.target.value)} placeholder="5" /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Equity Check ($)</label><input className="form-input" type="number" value={form.equity_check} onChange={e => set('equity_check', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Debt Amount ($)</label><input className="form-input" type="number" value={form.debt_amount} onChange={e => set('debt_amount', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">LTV (%)</label><input className="form-input" type="number" step="1" value={form.ltv} onChange={e => set('ltv', e.target.value)} /></div>
        </>)}
        {tab === 'notes' && (<>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Expected Close</label><input className="form-input" type="date" value={form.expected_close} onChange={e => set('expected_close', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Hold Period (years)</label><input className="form-input" type="number" value={form.hold_period} onChange={e => set('hold_period', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Notes / Investment Thesis</label><textarea className="form-input" rows={5} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize:'vertical' }} placeholder="Key investment thesis, risks, upside drivers, market context..." /></div>
        </>)}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : deal ? 'Save Changes' : 'Add Deal'}</button>
        </div>
      </div>
    </div>
  )
}

function ActivityLog({ dealId }) {
  const [activities, setActivities] = useState([])
  const [newType, setNewType] = useState('call')
  const [newDesc, setNewDesc] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!dealId) return
    supabase.from('deal_activity').select('*').eq('deal_id', dealId).order('activity_date', { ascending: false }).then(({ data }) => setActivities(data || []))
  }, [dealId])

  const addActivity = async () => {
    if (!newDesc.trim()) return
    setLoading(true)
    const { data } = await supabase.from('deal_activity').insert({ deal_id: dealId, activity_type: newType, description: newDesc.trim() }).select().single()
    if (data) setActivities(prev => [data, ...prev])
    setNewDesc(''); setLoading(false)
  }

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <select className="form-select" style={{ width:140, fontSize:11 }} value={newType} onChange={e => setNewType(e.target.value)}>
          {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{ACTIVITY_ICONS[t]} {t.replace('_',' ')}</option>)}
        </select>
        <input className="form-input" style={{ flex:1 }} placeholder="Describe the activity..." value={newDesc} onChange={e => setNewDesc(e.target.value)} onKeyDown={e => e.key==='Enter' && addActivity()} />
        <button className="btn btn-secondary btn-sm" onClick={addActivity} disabled={loading || !newDesc.trim()}>Log</button>
      </div>
      {activities.length === 0 && <div style={{ fontSize:12, color:'var(--gray500)' }}>No activity logged yet.</div>}
      {activities.map(a => (
        <div key={a.id} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid var(--gray100)', alignItems:'flex-start' }}>
          <span style={{ fontSize:14, flexShrink:0 }}>{ACTIVITY_ICONS[a.activity_type]}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:'var(--g900)' }}>{a.description}</div>
            <div style={{ fontSize:10, color:'var(--gray500)', marginTop:2 }}>{new Date(a.activity_date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function InvestorMemo({ deal, onClose }) {
  const score = calcScore(deal)
  const ppk = deal.price_per_key || (deal.ask_price && deal.rooms ? Math.round(deal.ask_price / deal.rooms) : null)
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width:620 }}>
        <div className="modal-header"><span className="modal-title">Investment Memo — {deal.name}</span><button className="modal-close" onClick={onClose}>✕</button></div>
        <div style={{ background:'var(--g50)', border:'1px solid var(--g100)', borderRadius:10, padding:'20px 24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, paddingBottom:12, borderBottom:'2px solid var(--g600)' }}>
            <div style={{ width:20, height:20, background:'var(--g600)', borderRadius:4 }}></div>
            <div>
              <div style={{ fontFamily:'Playfair Display,serif', fontSize:16, fontWeight:600, color:'var(--g900)' }}>Investment Memorandum</div>
              <div style={{ fontSize:10, color:'var(--gray500)', textTransform:'uppercase', letterSpacing:'.08em' }}>SOUL · Kemmons Wilson Hospitality · {new Date().toLocaleDateString('en-US', { month:'long', year:'numeric' })}</div>
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:500, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--g600)', marginBottom:8, paddingBottom:4, borderBottom:'1px solid var(--g100)' }}>Asset Overview</div>
            <div style={{ fontFamily:'Playfair Display,serif', fontSize:15, fontWeight:600, color:'var(--g900)', marginBottom:4 }}>{deal.name}</div>
            <div style={{ fontSize:11, color:'var(--gray700)', lineHeight:1.7 }}>
              {[deal.market, deal.type && deal.type.charAt(0).toUpperCase()+deal.type.slice(1), deal.rooms && `${deal.rooms} rooms`, STAGE_LABELS[deal.stage]].filter(Boolean).join(' · ')}
            </div>
            {deal.notes && <div style={{ marginTop:8, fontSize:11, color:'var(--gray700)', lineHeight:1.7 }}>{deal.notes}</div>}
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:500, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--g600)', marginBottom:8, paddingBottom:4, borderBottom:'1px solid var(--g100)' }}>Deal Economics</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {[['Ask Price',fmt(deal.ask_price)],['Price/Key',fmtK(ppk)],['Cap Rate',deal.cap_rate?`${deal.cap_rate}%`:'—'],['Proj. IRR',deal.projected_irr?`${deal.projected_irr}%`:'—'],['Eq. Multiple',deal.equity_multiple?`${deal.equity_multiple}x`:'—'],['Cash-on-Cash',deal.cash_on_cash?`${deal.cash_on_cash}%`:'—'],['Equity Check',fmt(deal.equity_check)],['Debt',fmt(deal.debt_amount)],['LTV',deal.ltv?`${deal.ltv}%`:'—']].map(([l,v]) => (
                <div key={l} style={{ background:'var(--white)', border:'1px solid var(--gray100)', borderRadius:6, padding:'8px 10px' }}>
                  <div style={{ fontSize:9, color:'var(--gray500)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>{l}</div>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--g900)' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ width:56, height:56, borderRadius:'50%', border:`4px solid ${score>=70?'var(--g400)':score>=50?'var(--amber)':'var(--red)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', flexShrink:0 }}>
              <div style={{ fontSize:16, fontWeight:600, color:'var(--g900)' }}>{score}</div>
              <div style={{ fontSize:8, color:'var(--gray500)', textTransform:'uppercase' }}>score</div>
            </div>
            <div style={{ fontSize:11, color:'var(--gray700)', lineHeight:1.7 }}>
              {score >= 75 ? 'Strong conviction — recommend advancing.' : score >= 50 ? 'Moderate conviction — continue diligence.' : 'Below threshold — reassess fundamentals.'}
              {' '}Score driven by cap rate ({deal.cap_rate || '—'}%), price/key ({fmtK(ppk)}), and IRR ({deal.projected_irr || '—'}%).
            </div>
          </div>
          <div style={{ paddingTop:10, borderTop:'1px solid var(--g200)', fontSize:10, color:'var(--gray500)', display:'flex', justifyContent:'space-between' }}>
            <span>{deal.expected_close ? `Expected close: ${new Date(deal.expected_close).toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}` : 'Close date TBD'}</span>
            <span>SOUL · Kemmons Wilson Hospitality Partners</span>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:14 }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function CompareModal({ deals, onClose }) {
  const [sel, setSel] = useState(deals.slice(0,2).map(d=>d.id))
  const compared = deals.filter(d => sel.includes(d.id))
  const metrics = [
    ['Ask Price', d => fmt(d.ask_price)],
    ['Price/Key', d => fmtK(d.price_per_key)],
    ['Cap Rate', d => d.cap_rate?`${d.cap_rate}%`:'—'],
    ['Projected IRR', d => d.projected_irr?`${d.projected_irr}%`:'—'],
    ['Equity Multiple', d => d.equity_multiple?`${d.equity_multiple}x`:'—'],
    ['Cash-on-Cash', d => d.cash_on_cash?`${d.cash_on_cash}%`:'—'],
    ['Equity Check', d => fmt(d.equity_check)],
    ['LTV', d => d.ltv?`${d.ltv}%`:'—'],
    ['Rooms', d => d.rooms||'—'],
    ['Deal Score', d => `${calcScore(d)}/100`],
  ]
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width:640 }}>
        <div className="modal-header"><span className="modal-title">Compare Deals</span><button className="modal-close" onClick={onClose}>✕</button></div>
        <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
          {deals.map(d => (
            <button key={d.id} style={{ fontSize:11, padding:'4px 12px', borderRadius:20, border:'1px solid', cursor:'pointer', borderColor:sel.includes(d.id)?'var(--g600)':'var(--gray200)', background:sel.includes(d.id)?'var(--g100)':'var(--white)', color:sel.includes(d.id)?'var(--g800)':'var(--gray700)' }}
              onClick={() => setSel(p => p.includes(d.id) ? p.filter(x=>x!==d.id) : p.length<3 ? [...p,d.id] : p)}>
              {d.name.split(' ').slice(0,2).join(' ')}
            </button>
          ))}
        </div>
        {compared.length < 2 ? <div style={{ fontSize:12, color:'var(--gray500)', textAlign:'center', padding:'20px 0' }}>Select at least 2 deals</div> : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr>
              <th style={{ textAlign:'left', fontSize:10, fontWeight:500, color:'var(--gray500)', textTransform:'uppercase', letterSpacing:'.07em', padding:'0 0 8px', borderBottom:'1px solid var(--gray100)' }}>Metric</th>
              {compared.map(d => <th key={d.id} style={{ textAlign:'right', fontSize:11, fontWeight:500, color:'var(--g900)', padding:'0 0 8px 12px', borderBottom:'1px solid var(--gray100)' }}>{d.name.split(' ').slice(0,2).join(' ')}</th>)}
            </tr></thead>
            <tbody>
              {metrics.map(([label, fn]) => (
                <tr key={label}>
                  <td style={{ padding:'8px 0', borderBottom:'1px solid var(--gray100)', color:'var(--gray500)', fontSize:11 }}>{label}</td>
                  {compared.map(d => <td key={d.id} style={{ padding:'8px 0 8px 12px', borderBottom:'1px solid var(--gray100)', textAlign:'right', fontWeight:500, color:'var(--g900)' }}>{fn(d)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function Pipeline() {
  const { deals, loading, addDeal, updateDeal, deleteDeal, toggleChecklist, addChecklistItem } = useDeals()
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [deleteModal, setDeleteModal] = useState(null)
  const [memoModal, setMemoModal] = useState(null)
  const [compareModal, setCompareModal] = useState(false)
  const [newItem, setNewItem] = useState('')
  const [detailTab, setDetailTab] = useState('overview')

  const activeDeals = deals.filter(d => STAGES.includes(d.stage))
  const selectedDeal = deals.find(d => d.id === selected)
  const pipelineValue = activeDeals.reduce((s, d) => s + (d.ask_price || 0), 0)
  const irrDeals = activeDeals.filter(d => d.projected_irr)
  const avgIRR = irrDeals.length ? (irrDeals.reduce((s,d) => s+d.projected_irr, 0) / irrDeals.length).toFixed(1) : null

  const handleSave = async (data) => {
    if (modal?.id) { const r = await updateDeal(modal.id, data); if (!r.error) setSelected(modal.id); return r }
    else { const r = await addDeal(data); if (!r.error && r.data) setSelected(r.data.id); return r }
  }
  const handleDelete = async (id) => { await deleteDeal(id); if (selected===id) setSelected(null) }
  const ts = (t) => ({ fontSize:11, padding:'5px 12px', borderRadius:20, border:'1px solid', cursor:'pointer', borderColor:detailTab===t?'var(--g600)':'var(--gray200)', background:detailTab===t?'var(--g700)':'var(--white)', color:detailTab===t?'var(--white)':'var(--gray700)' })

  if (loading) return <div className="loading">Loading pipeline...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Acquisition Pipeline</h1>
        <p>{activeDeals.length} active deals · {fmt(pipelineValue)} total deal volume</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Pipeline</div><div className="kpi-value">{fmt(pipelineValue)}</div><div className="kpi-change">{activeDeals.length} active deals</div></div>
        <div className="kpi-card"><div className="kpi-label">Due Diligence</div><div className="kpi-value">{activeDeals.filter(d=>d.stage==='due_diligence').length}</div><div className="kpi-change">deals in DD</div></div>
        <div className="kpi-card"><div className="kpi-label">Avg. Deal Score</div><div className="kpi-value">{activeDeals.length ? Math.round(activeDeals.reduce((s,d) => s+calcScore(d), 0)/activeDeals.length) : '—'}/100</div><div className="kpi-change">auto-calculated</div></div>
        <div className="kpi-card"><div className="kpi-label">Avg. Proj. IRR</div><div className="kpi-value">{avgIRR ? `${avgIRR}%` : '—'}</div><div className="kpi-change">across deals with IRR</div></div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:12 }}>
        {activeDeals.length >= 2 && <button className="btn btn-secondary btn-sm" onClick={() => setCompareModal(true)}>⟺ Compare Deals</button>}
        <button className="btn btn-primary btn-sm" onClick={() => { setModal({}); setSelected(null) }}>+ Add Deal</button>
      </div>

      <div className="kanban">
        {STAGES.map(stage => {
          const stageDeals = activeDeals.filter(d => d.stage === stage)
          return (
            <div key={stage} className="kanban-col">
              <div className="kanban-header">{STAGE_LABELS[stage]}<span className="kanban-count">{stageDeals.length}</span></div>
              {stageDeals.length === 0 && <div style={{ fontSize:11, color:'var(--gray300)', textAlign:'center', padding:'12px 0' }}>No deals</div>}
              {stageDeals.map(deal => {
                const sc = calcScore(deal)
                return (
                  <div key={deal.id} className={`deal-card${selected===deal.id?' selected':''}`} onClick={() => setSelected(selected===deal.id?null:deal.id)}>
                    <div className="deal-card-name">{deal.name}</div>
                    <div className="deal-card-meta">{deal.rooms?`${deal.rooms} rooms · `:''}{deal.market}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:5 }}>
                      <span className="deal-card-value">{fmt(deal.ask_price)}</span>
                      <div style={{ display:'flex', gap:5 }}>
                        {deal.projected_irr && <span style={{ fontSize:9, color:'var(--blue)', fontWeight:500 }}>{deal.projected_irr}%</span>}
                        <span style={{ fontSize:10, color:sc>=70?'var(--g600)':sc>=50?'var(--amber)':'var(--red)', fontWeight:500 }}>{sc}/100</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {selectedDeal && (
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">{selectedDeal.name}</span>
              {selectedDeal.market && <span style={{ fontSize:11, color:'var(--gray500)', marginLeft:8 }}>{selectedDeal.market}</span>}
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <select className="form-select" style={{ width:'auto', fontSize:11, padding:'4px 8px' }} value={selectedDeal.stage} onChange={e => updateDeal(selectedDeal.id, { stage: e.target.value })}>
                {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
              <button className="btn btn-secondary btn-sm" onClick={() => setMemoModal(selectedDeal)}>📄 Investor Memo</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setModal(selectedDeal)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => setDeleteModal(selectedDeal)}>Delete</button>
            </div>
          </div>

          <div style={{ display:'flex', gap:6, marginBottom:16 }}>
            {[['overview','Overview'],['checklist','Checklist'],['activity','Activity Log']].map(([t,l]) => <button key={t} style={ts(t)} onClick={() => setDetailTab(t)}>{l}</button>)}
          </div>

          {detailTab === 'overview' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
                {[
                  ['Ask Price', fmt(selectedDeal.ask_price)],
                  ['Price/Key', selectedDeal.price_per_key?`$${selectedDeal.price_per_key.toLocaleString()}`:'—'],
                  ['Cap Rate', selectedDeal.cap_rate?`${selectedDeal.cap_rate}%`:'—'],
                  ['Deal Score', `${calcScore(selectedDeal)}/100`],
                  ['Projected IRR', selectedDeal.projected_irr?`${selectedDeal.projected_irr}%`:'—'],
                  ['Equity Multiple', selectedDeal.equity_multiple?`${selectedDeal.equity_multiple}x`:'—'],
                  ['Cash-on-Cash', selectedDeal.cash_on_cash?`${selectedDeal.cash_on_cash}%`:'—'],
                  ['Equity Check', fmt(selectedDeal.equity_check)],
                ].map(([label, value]) => (
                  <div key={label} style={{ background:'var(--gray50)', border:'1px solid var(--gray100)', borderRadius:8, padding:'10px 12px' }}>
                    <div style={{ fontSize:10, color:'var(--gray500)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:4 }}>{label}</div>
                    <div style={{ fontSize:15, fontWeight:500, color:'var(--g900)' }}>{value}</div>
                  </div>
                ))}
              </div>
              {selectedDeal.notes && <div style={{ padding:'10px 12px', background:'var(--g50)', border:'1px solid var(--g100)', borderRadius:7, fontSize:12, color:'var(--g900)', lineHeight:1.6 }}><strong style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.05em', color:'var(--g600)' }}>Investment Thesis</strong><div style={{ marginTop:4 }}>{selectedDeal.notes}</div></div>}
            </>
          )}

          {detailTab === 'checklist' && (
            <>
              {(!selectedDeal.deal_checklist || selectedDeal.deal_checklist.length === 0) && <div style={{ fontSize:12, color:'var(--gray500)', marginBottom:12 }}>No checklist items yet.</div>}
              <ul className="checklist">
                {(selectedDeal.deal_checklist||[]).sort((a,b)=>a.sort_order-b.sort_order).map(item => (
                  <li key={item.id}>
                    <div className={`check-box${item.completed?' done':''}`} onClick={() => toggleChecklist(item.id, !item.completed)}>{item.completed&&'✓'}</div>
                    <span style={{ textDecoration:item.completed?'line-through':'none', color:item.completed?'var(--gray500)':'var(--gray700)', flex:1 }}>{item.item}</span>
                    {item.completed_at && <span style={{ fontSize:10, color:'var(--gray300)' }}>{new Date(item.completed_at).toLocaleDateString()}</span>}
                  </li>
                ))}
              </ul>
              <div style={{ display:'flex', gap:8, marginTop:12 }}>
                <input className="form-input" style={{ flex:1 }} placeholder="Add checklist item..." value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key==='Enter' && addChecklistItem(selectedDeal.id, newItem.trim()).then(()=>setNewItem(''))} />
                <button className="btn btn-secondary btn-sm" onClick={() => addChecklistItem(selectedDeal.id, newItem.trim()).then(()=>setNewItem(''))} disabled={!newItem.trim()}>Add</button>
              </div>
            </>
          )}

          {detailTab === 'activity' && <ActivityLog dealId={selectedDeal.id} />}
        </div>
      )}

      {modal !== null && <DealModal deal={modal?.id?modal:null} onClose={() => setModal(null)} onSave={handleSave} />}
      {deleteModal && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setDeleteModal(null)}>
          <div className="modal" style={{ maxWidth:400 }}>
            <div className="modal-header"><span className="modal-title">Delete Deal</span><button className="modal-close" onClick={() => setDeleteModal(null)}>✕</button></div>
            <p style={{ fontSize:13, color:'var(--gray700)', marginBottom:20, lineHeight:1.6 }}>Delete <strong>{deleteModal.name}</strong>? This cannot be undone.</p>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { handleDelete(deleteModal.id); setDeleteModal(null) }}>Delete Deal</button>
            </div>
          </div>
        </div>
      )}
      {memoModal && <InvestorMemo deal={memoModal} onClose={() => setMemoModal(null)} />}
      {compareModal && <CompareModal deals={activeDeals} onClose={() => setCompareModal(false)} />}
    </div>
  )
}
