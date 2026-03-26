import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useDeals } from '../hooks/useData'

const STAGES = ['prospecting', 'loi', 'due_diligence', 'closing']
const STAGE_LABELS = { prospecting: 'Prospecting', loi: 'LOI Signed', due_diligence: 'Due Diligence', closing: 'Closing' }
const fmt = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'
const fmtK = (n) => n ? `$${Math.round(n).toLocaleString()}` : '—'

function calcScore(deal) {
  let score = 50; let breakdown = []
  if (deal.cap_rate) {
    if (deal.cap_rate >= 8) { score += 20; breakdown.push({ factor: 'Cap rate ≥8%', pts: '+20' }) }
    else if (deal.cap_rate >= 7) { score += 15; breakdown.push({ factor: 'Cap rate ≥7%', pts: '+15' }) }
    else if (deal.cap_rate >= 6) { score += 8; breakdown.push({ factor: 'Cap rate ≥6%', pts: '+8' }) }
    else { score -= 10; breakdown.push({ factor: 'Cap rate <5%', pts: '-10' }) }
  }
  if (deal.price_per_key) {
    if (deal.price_per_key < 150000) { score += 15; breakdown.push({ factor: 'Price/key <$150K', pts: '+15' }) }
    else if (deal.price_per_key < 200000) { score += 10; breakdown.push({ factor: 'Price/key <$200K', pts: '+10' }) }
    else if (deal.price_per_key < 250000) { score += 5; breakdown.push({ factor: 'Price/key <$250K', pts: '+5' }) }
    else if (deal.price_per_key > 350000) { score -= 10; breakdown.push({ factor: 'Price/key >$350K', pts: '-10' }) }
  }
  if (deal.projected_irr) {
    if (deal.projected_irr >= 18) { score += 15; breakdown.push({ factor: 'IRR ≥18%', pts: '+15' }) }
    else if (deal.projected_irr >= 15) { score += 10; breakdown.push({ factor: 'IRR ≥15%', pts: '+10' }) }
    else if (deal.projected_irr >= 12) { score += 5; breakdown.push({ factor: 'IRR ≥12%', pts: '+5' }) }
    else { score -= 10; breakdown.push({ factor: 'IRR <10%', pts: '-10' }) }
  }
  return { score: Math.min(100, Math.max(0, score)), breakdown }
}

// Score badge with tooltip showing breakdown
function ScoreBadge({ deal }) {
  const { score, breakdown } = calcScore(deal)
  const color = score >= 70 ? 'var(--g600)' : score >= 50 ? 'var(--amber)' : 'var(--red)'
  return (
    <div className="tooltip-wrap">
      <span style={{ fontSize: 10, color, fontWeight: 500 }}>{score}/100</span>
      <div className="tooltip score-breakdown">
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>Score breakdown</div>
        <div className="score-breakdown-row"><span className="factor">Base</span><span className="pts">50</span></div>
        {breakdown.map((b, i) => (
          <div key={i} className="score-breakdown-row">
            <span className="factor">{b.factor}</span>
            <span className="pts" style={{ color: b.pts.startsWith('+') ? '#a8d5bc' : '#f5c6c2' }}>{b.pts}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 6, paddingTop: 6 }}>
          <div className="score-breakdown-row"><span style={{ color: '#fff', fontWeight: 600 }}>Total</span><span className="pts" style={{ color: '#fff', fontWeight: 600 }}>{score}</span></div>
        </div>
      </div>
    </div>
  )
}

// Email draft generator
function EmailDraftModal({ deal, onClose }) {
  const [copied, setCopied] = useState(false)
  const stageMessages = {
    prospecting: `I wanted to reach out regarding ${deal.name}${deal.market ? ` in ${deal.market}` : ''}. We've reviewed the opportunity and believe it could be a strong fit for our portfolio. Could we schedule a brief call to discuss the details?`,
    loi: `Following our initial review of ${deal.name}, we're prepared to move forward with a Letter of Intent. We see compelling fundamentals${deal.cap_rate ? ` at a ${deal.cap_rate}% cap rate` : ''}${deal.ask_price ? ` and an ask of ${fmt(deal.ask_price)}` : ''}. Please let me know the next steps.`,
    due_diligence: `We're progressing through due diligence on ${deal.name} and have a few follow-up questions. Could you please provide the trailing 12-month P&L, any deferred maintenance reports, and the current franchise agreement if applicable?`,
    closing: `We're finalizing the closing process for ${deal.name} and wanted to confirm the timeline. Please advise on the status of the title work and confirm the anticipated closing date so we can ensure all parties are aligned.`,
  }
  const subject = `RE: ${deal.name}${deal.market ? ` — ${deal.market}` : ''}`
  const body = `Hi ${deal.broker || '[Broker Name]'},\n\nHope you're doing well.\n\n${stageMessages[deal.stage] || `I wanted to follow up on ${deal.name}.`}\n\nLooking forward to your response.\n\nBest,\nBear Hutchinson\nStrategic Operations Associate\nKemmons Wilson Hospitality Partners`

  const copy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 560 }}>
        <div className="modal-header">
          <span className="modal-title">Email Draft — {deal.name}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--gray500)', marginBottom: 4 }}>SUBJECT</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--g900)', padding: '8px 10px', background: 'var(--gray50)', borderRadius: 6 }}>{subject}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--gray500)', marginBottom: 4 }}>BODY</div>
          <textarea
            style={{ width: '100%', height: 200, padding: '10px 12px', border: '1px solid var(--gray200)', borderRadius: 8, fontSize: 12.5, fontFamily: 'DM Sans, sans-serif', color: 'var(--gray700)', resize: 'vertical', lineHeight: 1.7, outline: 'none' }}
            defaultValue={body}
            id="email-body"
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={copy}>{copied ? '✓ Copied!' : '📋 Copy to clipboard'}</button>
        </div>
      </div>
    </div>
  )
}

function DealModal({ deal, onClose, onSave }) {
  const AUTOSAVE_KEY = deal?.id ? `deal_draft_${deal.id}` : 'deal_draft_new'
  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem(AUTOSAVE_KEY)
    if (saved && !deal?.id) return JSON.parse(saved)
    return deal ? { ...deal } : {
      name:'', market:'', type:'hotel', rooms:'', ask_price:'', cap_rate:'', stage:'prospecting',
      notes:'', expected_close:'', broker:'', projected_irr:'', equity_multiple:'', cash_on_cash:'',
      hold_period:5, equity_check:'', debt_amount:'', ltv:65, close_probability:15,
    }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autoSaved, setAutoSaved] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Autosave every 30s
  useEffect(() => {
    if (!deal?.id) {
      const t = setInterval(() => {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(form))
        setAutoSaved(true)
        setTimeout(() => setAutoSaved(false), 2000)
      }, 30000)
      return () => clearInterval(t)
    }
  }, [form])

  const ppk = form.ask_price && form.rooms ? Math.round(parseFloat(form.ask_price) / parseInt(form.rooms)) : null
  const { score } = calcScore({ ...form, price_per_key: ppk })

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Deal name is required.'); return }
    setLoading(true); setError('')
    const payload = {
      name: form.name.trim(), market: form.market || null, type: form.type,
      rooms: form.rooms ? parseInt(form.rooms) : null,
      ask_price: form.ask_price ? parseFloat(form.ask_price) : null,
      price_per_key: ppk, cap_rate: form.cap_rate ? parseFloat(form.cap_rate) : null,
      stage: form.stage, score, notes: form.notes || null,
      expected_close: form.expected_close || null, broker: form.broker || null,
      projected_irr: form.projected_irr ? parseFloat(form.projected_irr) : null,
      equity_multiple: form.equity_multiple ? parseFloat(form.equity_multiple) : null,
      cash_on_cash: form.cash_on_cash ? parseFloat(form.cash_on_cash) : null,
      hold_period: form.hold_period ? parseInt(form.hold_period) : null,
      equity_check: form.equity_check ? parseFloat(form.equity_check) : null,
      debt_amount: form.debt_amount ? parseFloat(form.debt_amount) : null,
      ltv: form.ltv ? parseFloat(form.ltv) : null,
      close_probability: parseInt(form.close_probability) || 15,
    }
    const { error } = await onSave(payload)
    if (error) { setError(error.message); setLoading(false); return }
    localStorage.removeItem(AUTOSAVE_KEY)
    setLoading(false); onClose()
  }

  const [tab, setTab] = useState('basics')
  const ts = (t) => ({ fontSize: 12, padding: '5px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer', borderColor: tab===t?'var(--g600)':'var(--gray200)', background: tab===t?'var(--g700)':'var(--white)', color: tab===t?'var(--white)':'var(--gray700)' })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 580 }}>
        <div className="modal-header">
          <span className="modal-title">{deal ? 'Edit Deal' : 'Add Deal'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {autoSaved && <span className="autosave-badge saved">✓ Autosaved</span>}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>
        {error && <div style={{ background:'var(--redL)', color:'var(--red)', padding:'8px 12px', borderRadius:7, fontSize:12, marginBottom:12 }}>{error}</div>}
        <div style={{ display:'flex', gap:6, marginBottom:16 }}>
          {[['basics','Basics'],['returns','Returns'],['notes','Notes']].map(([t,l]) => <button key={t} style={ts(t)} onClick={() => setTab(t)}>{l}</button>)}
        </div>
        {tab === 'basics' && (<>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Deal Name *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Market</label><input className="form-input" value={form.market} onChange={e => set('market', e.target.value)} placeholder="City, ST" /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Stage</label>
              <select className="form-select" value={form.stage} onChange={e => { set('stage', e.target.value); set('close_probability', e.target.value==='closing'?90:e.target.value==='due_diligence'?65:e.target.value==='loi'?35:15) }}>
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
            <div className="form-group"><label className="form-label">Close Probability (%)</label><input className="form-input" type="number" min="0" max="100" value={form.close_probability} onChange={e => set('close_probability', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Broker</label><input className="form-input" value={form.broker} onChange={e => set('broker', e.target.value)} /></div>
          {ppk && <div style={{ background:'var(--g50)', border:'1px solid var(--g100)', borderRadius:7, padding:'8px 12px', fontSize:12, color:'var(--g900)', marginTop:4 }}>Price/Key: <strong>{fmtK(ppk)}</strong> · Auto score: <strong>{score}/100</strong></div>}
        </>)}
        {tab === 'returns' && (<>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Projected IRR (%)</label><input className="form-input" type="number" step="0.1" value={form.projected_irr} onChange={e => set('projected_irr', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Equity Multiple (x)</label><input className="form-input" type="number" step="0.1" value={form.equity_multiple} onChange={e => set('equity_multiple', e.target.value)} /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Cash-on-Cash (%)</label><input className="form-input" type="number" step="0.1" value={form.cash_on_cash} onChange={e => set('cash_on_cash', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Hold Period (years)</label><input className="form-input" type="number" value={form.hold_period} onChange={e => set('hold_period', e.target.value)} /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Equity Check ($)</label><input className="form-input" type="number" value={form.equity_check} onChange={e => set('equity_check', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">LTV (%)</label><input className="form-input" type="number" value={form.ltv} onChange={e => set('ltv', e.target.value)} /></div>
          </div>
        </>)}
        {tab === 'notes' && (<>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Expected Close</label><input className="form-input" type="date" value={form.expected_close} onChange={e => set('expected_close', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Hold Period</label><input className="form-input" type="number" value={form.hold_period} onChange={e => set('hold_period', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Investment Thesis / Notes</label><textarea className="form-input" rows={5} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize:'vertical' }} /></div>
        </>)}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : deal ? 'Save Changes' : 'Add Deal'}</button>
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
  const [emailModal, setEmailModal] = useState(null)
  const [newItem, setNewItem] = useState('')
  const [detailTab, setDetailTab] = useState('overview')
  const [dragging, setDragging] = useState(null)
  const [dragOver, setDragOver] = useState(null)

  const activeDeals = deals.filter(d => STAGES.includes(d.stage))
  const selectedDeal = deals.find(d => d.id === selected)
  const pipelineValue = activeDeals.reduce((s, d) => s + (d.ask_price || 0), 0)
  const weightedPipeline = activeDeals.reduce((s, d) => s + ((d.ask_price || 0) * ((d.close_probability || 50) / 100)), 0)
  const irrDeals = activeDeals.filter(d => d.projected_irr)
  const avgIRR = irrDeals.length ? (irrDeals.reduce((s,d) => s+d.projected_irr, 0) / irrDeals.length).toFixed(1) : null

  const handleSave = async (data) => {
    if (modal?.id) { const r = await updateDeal(modal.id, data); if (!r.error) setSelected(modal.id); return r }
    else { const r = await addDeal(data); if (!r.error && r.data) setSelected(r.data.id); return r }
  }

  const handleDelete = async (id) => { await deleteDeal(id); if (selected === id) setSelected(null) }

  // Drag and drop
  const handleDragStart = (e, deal) => {
    setDragging(deal.id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragEnd = () => { setDragging(null); setDragOver(null) }
  const handleDragOver = (e, stage) => { e.preventDefault(); setDragOver(stage) }
  const handleDrop = async (e, stage) => {
    e.preventDefault()
    if (dragging && stage) {
      const deal = deals.find(d => d.id === dragging)
      if (deal && deal.stage !== stage) {
        const probs = { prospecting:15, loi:35, due_diligence:65, closing:90 }
        await updateDeal(dragging, { stage, close_probability: probs[stage] })
        // Log activity
        await supabase.from('deal_activity').insert({ deal_id: dragging, activity_type: 'stage_change', description: `Stage changed from ${STAGE_LABELS[deal.stage]} to ${STAGE_LABELS[stage]}` })
        await supabase.from('activity_stream').insert({ action_type:'deal_stage_changed', entity_type:'deal', entity_name: deal.name, entity_id: dragging, description:`Moved to ${STAGE_LABELS[stage]}` })
      }
    }
    setDragging(null); setDragOver(null)
  }

  const ts = (t) => ({ fontSize:11, padding:'5px 12px', borderRadius:20, border:'1px solid', cursor:'pointer', borderColor:detailTab===t?'var(--g600)':'var(--gray200)', background:detailTab===t?'var(--g700)':'var(--white)', color:detailTab===t?'var(--white)':'var(--gray700)' })

  if (loading) return (
    <div>
      <div className="page-header"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-text" style={{ width:'40%' }} /></div>
      <div className="kpi-grid">{[0,1,2,3].map(i => <div key={i} className="skeleton-kpi skeleton" />)}</div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1>Acquisition Pipeline</h1>
        <p>{activeDeals.length} active deals · {fmt(pipelineValue)} gross · {fmt(weightedPipeline)} probability-weighted</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Pipeline</div><div className="kpi-value">{fmt(pipelineValue)}</div><div className="kpi-change">{activeDeals.length} active deals</div></div>
        <div className="kpi-card"><div className="kpi-label">Probability-Weighted</div><div className="kpi-value">{fmt(weightedPipeline)}</div><div className="kpi-change">Adjusted pipeline</div></div>
        <div className="kpi-card"><div className="kpi-label">Due Diligence</div><div className="kpi-value">{activeDeals.filter(d=>d.stage==='due_diligence').length}</div><div className="kpi-change">deals in DD</div></div>
        <div className="kpi-card"><div className="kpi-label">Avg. Proj. IRR</div><div className="kpi-value">{avgIRR ? `${avgIRR}%` : '—'}</div><div className="kpi-change">across deals with IRR</div></div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:12 }}>
        {activeDeals.length >= 2 && (
          <button className="btn btn-secondary btn-sm" onClick={() => {
            const top2 = activeDeals.slice(0,2).map(d => d.name).join(' vs ')
            window.location.href = '/pipeline#compare'
          }}>⟺ Compare</button>
        )}
        <button className="btn btn-primary btn-sm" onClick={() => { setModal({}); setSelected(null) }}>+ Add Deal</button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--gray500)', marginBottom: 8 }}>Drag cards between columns to advance deals</div>

      {/* KANBAN — DRAG AND DROP */}
      <div className="kanban">
        {STAGES.map(stage => {
          const stageDeals = activeDeals.filter(d => d.stage === stage)
          return (
            <div
              key={stage}
              className={`kanban-col${dragOver === stage ? ' drag-over' : ''}`}
              onDragOver={e => handleDragOver(e, stage)}
              onDrop={e => handleDrop(e, stage)}
            >
              <div className="kanban-header">{STAGE_LABELS[stage]}<span className="kanban-count">{stageDeals.length}</span></div>
              {stageDeals.length === 0 && <div style={{ fontSize:11, color:'var(--gray300)', textAlign:'center', padding:'16px 0', borderRadius:6, border:'2px dashed var(--gray100)' }}>Drop here</div>}
              {stageDeals.map(deal => {
                const { score } = calcScore(deal)
                return (
                  <div
                    key={deal.id}
                    className={`deal-card${selected===deal.id?' selected':''}${dragging===deal.id?' dragging':''}`}
                    draggable
                    onDragStart={e => handleDragStart(e, deal)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelected(selected===deal.id ? null : deal.id)}
                  >
                    <div className="deal-card-name">{deal.name}</div>
                    <div className="deal-card-meta">{deal.rooms ? `${deal.rooms} rooms · ` : ''}{deal.market}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:5 }}>
                      <span className="deal-card-value">{fmt(deal.ask_price)}</span>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        {deal.projected_irr && <span style={{ fontSize:9, color:'var(--blue)', fontWeight:500 }}>{deal.projected_irr}%</span>}
                        <ScoreBadge deal={deal} />
                      </div>
                    </div>
                    {deal.close_probability && <div style={{ marginTop:5 }}><div className="progress-bar"><div className="progress-fill" style={{ width:`${deal.close_probability}%`, background: deal.close_probability >= 70 ? 'var(--g600)' : deal.close_probability >= 40 ? 'var(--amber)' : 'var(--gray300)' }} /></div><div style={{ fontSize:9, color:'var(--gray500)', marginTop:2 }}>{deal.close_probability}% probability</div></div>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* DEAL DETAIL */}
      {selectedDeal && (
        <div className="card">
          <div className="card-header">
            <div><span className="card-title">{selectedDeal.name}</span>{selectedDeal.market && <span style={{ fontSize:11, color:'var(--gray500)', marginLeft:8 }}>{selectedDeal.market}</span>}</div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setEmailModal(selectedDeal)}>✉ Email Draft</button>
              <select className="form-select" style={{ width:'auto', fontSize:11, padding:'4px 8px' }} value={selectedDeal.stage} onChange={e => updateDeal(selectedDeal.id, { stage: e.target.value, close_probability: e.target.value==='closing'?90:e.target.value==='due_diligence'?65:e.target.value==='loi'?35:15 })}>
                {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
              <button className="btn btn-secondary btn-sm" onClick={() => setModal(selectedDeal)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => setDeleteModal(selectedDeal)}>Delete</button>
            </div>
          </div>

          <div style={{ display:'flex', gap:6, marginBottom:16 }}>
            {[['overview','Overview'],['checklist','Checklist'],['activity','Activity']].map(([t,l]) => <button key={t} style={ts(t)} onClick={() => setDetailTab(t)}>{l}</button>)}
          </div>

          {detailTab === 'overview' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:16 }}>
                {[
                  ['Ask Price', fmt(selectedDeal.ask_price)],
                  ['Price/Key', selectedDeal.price_per_key?`$${selectedDeal.price_per_key.toLocaleString()}`:'—'],
                  ['Cap Rate', selectedDeal.cap_rate?`${selectedDeal.cap_rate}%`:'—'],
                  ['Deal Score', `${calcScore(selectedDeal).score}/100`],
                  ['Proj. IRR', selectedDeal.projected_irr?`${selectedDeal.projected_irr}%`:'—'],
                  ['Equity Multiple', selectedDeal.equity_multiple?`${selectedDeal.equity_multiple}x`:'—'],
                  ['Close Probability', selectedDeal.close_probability?`${selectedDeal.close_probability}%`:'—'],
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
          {detailTab === 'activity' && (
            <ActivityLog dealId={selectedDeal.id} />
          )}
        </div>
      )}

      {modal !== null && <DealModal deal={modal?.id?modal:null} onClose={() => setModal(null)} onSave={handleSave} />}
      {emailModal && <EmailDraftModal deal={emailModal} onClose={() => setEmailModal(null)} />}
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
    </div>
  )
}

function ActivityLog({ dealId }) {
  const [activities, setActivities] = useState([])
  const [newType, setNewType] = useState('call')
  const [newDesc, setNewDesc] = useState('')
  const [loading, setLoading] = useState(false)
  const TYPES = ['call','email','site_visit','loi','offer','meeting','document','note','stage_change']
  const ICONS = { call:'📞', email:'📧', site_visit:'🏨', loi:'📄', offer:'💼', meeting:'🤝', document:'📎', note:'📝', stage_change:'🔄' }

  useEffect(() => {
    if (!dealId) return
    supabase.from('deal_activity').select('*').eq('deal_id', dealId).order('activity_date', { ascending: false }).then(({ data }) => setActivities(data || []))
  }, [dealId])

  const add = async () => {
    if (!newDesc.trim()) return
    setLoading(true)
    const { data } = await supabase.from('deal_activity').insert({ deal_id: dealId, activity_type: newType, description: newDesc.trim() }).select().single()
    if (data) setActivities(prev => [data, ...prev])
    setNewDesc(''); setLoading(false)
  }

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <select className="form-select" style={{ width:130, fontSize:11 }} value={newType} onChange={e => setNewType(e.target.value)}>
          {TYPES.map(t => <option key={t} value={t}>{ICONS[t]} {t.replace('_',' ')}</option>)}
        </select>
        <input className="form-input" style={{ flex:1 }} placeholder="Describe the activity..." value={newDesc} onChange={e => setNewDesc(e.target.value)} onKeyDown={e => e.key==='Enter' && add()} />
        <button className="btn btn-secondary btn-sm" onClick={add} disabled={loading || !newDesc.trim()}>Log</button>
      </div>
      {activities.length === 0 && <div style={{ fontSize:12, color:'var(--gray500)' }}>No activity logged yet.</div>}
      {activities.map(a => (
        <div key={a.id} style={{ display:'flex', gap:10, padding:'8px 0', borderBottom:'1px solid var(--gray100)', alignItems:'flex-start' }}>
          <span style={{ fontSize:14, flexShrink:0 }}>{ICONS[a.activity_type]}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:'var(--g900)' }}>{a.description}</div>
            <div style={{ fontSize:10, color:'var(--gray500)', marginTop:2 }}>{new Date(a.activity_date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
