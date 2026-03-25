import { useState } from 'react'
import { useDeals } from '../hooks/useData'

const STAGES = ['prospecting', 'loi', 'due_diligence', 'closing']
const STAGE_LABELS = { prospecting: 'Prospecting', loi: 'LOI Signed', due_diligence: 'Due Diligence', closing: 'Closing' }
const fmt = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'

function DealModal({ deal, onClose, onSave }) {
  const [form, setForm] = useState(deal || { name: '', market: '', type: 'hotel', rooms: '', ask_price: '', cap_rate: '', stage: 'prospecting', score: 50, notes: '' })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setLoading(true)
    const payload = { ...form, rooms: form.rooms ? Number(form.rooms) : null, ask_price: form.ask_price ? Number(form.ask_price) : null, cap_rate: form.cap_rate ? Number(form.cap_rate) : null, score: Number(form.score), price_per_key: form.ask_price && form.rooms ? Math.round(Number(form.ask_price) / Number(form.rooms)) : null }
    await onSave(payload)
    setLoading(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{deal?.id ? 'Edit Deal' : 'Add Deal'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Deal Name</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Market</label><input className="form-input" value={form.market} onChange={e => set('market', e.target.value)} placeholder="City, ST" /></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Stage</label>
            <select className="form-select" value={form.stage} onChange={e => set('stage', e.target.value)}>
              {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Property Type</label>
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
          <div className="form-group"><label className="form-label">Deal Score (0–100)</label><input className="form-input" type="number" min="0" max="100" value={form.score} onChange={e => set('score', e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} /></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !form.name}>{loading ? 'Saving...' : 'Save Deal'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Pipeline() {
  const { deals, loading, addDeal, updateDeal, toggleChecklist, addChecklistItem } = useDeals()
  const [selected, setSelected] = useState(null)
  const [modal, setModal] = useState(null)
  const [newItem, setNewItem] = useState('')

  const activeDeals = deals.filter(d => STAGES.includes(d.stage))
  const selectedDeal = deals.find(d => d.id === selected)

  const pipelineValue = activeDeals.reduce((s, d) => s + (d.ask_price || 0), 0)

  const handleSave = async (data) => {
    if (modal?.id) { await updateDeal(modal.id, data); setSelected(modal.id) }
    else { const { data: nd } = await addDeal(data); if (nd) setSelected(nd.id) }
  }

  const handleAddItem = async () => {
    if (!newItem.trim() || !selected) return
    await addChecklistItem(selected, newItem.trim())
    setNewItem('')
  }

  const handleStageChange = async (dealId, stage) => {
    await updateDeal(dealId, { stage })
  }

  if (loading) return <div className="loading">Loading pipeline...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Acquisition Pipeline</h1>
        <p>{activeDeals.length} active deals · {fmt(pipelineValue).replace('$','$')} total deal volume</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Pipeline</div><div className="kpi-value">{fmt(pipelineValue)}</div><div className="kpi-change">{activeDeals.length} active deals</div></div>
        <div className="kpi-card"><div className="kpi-label">Due Diligence</div><div className="kpi-value">{activeDeals.filter(d=>d.stage==='due_diligence').length}</div><div className="kpi-change">deals in DD</div></div>
        <div className="kpi-card"><div className="kpi-label">Avg. Deal Score</div><div className="kpi-value">{activeDeals.length ? Math.round(activeDeals.reduce((s,d)=>s+(d.score||0),0)/activeDeals.length) : '—'}/100</div></div>
        <div className="kpi-card"><div className="kpi-label">Closing Stage</div><div className="kpi-value">{activeDeals.filter(d=>d.stage==='closing').length}</div><div className="kpi-change">deals near close</div></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Add Deal</button>
      </div>

      <div className="kanban">
        {STAGES.map(stage => {
          const stagDeals = activeDeals.filter(d => d.stage === stage)
          return (
            <div key={stage} className="kanban-col">
              <div className="kanban-header">{STAGE_LABELS[stage]}<span className="kanban-count">{stagDeals.length}</span></div>
              {stagDeals.length === 0 && <div style={{ fontSize: 11, color: 'var(--gray300)', textAlign: 'center', padding: '12px 0' }}>No deals</div>}
              {stagDeals.map(deal => (
                <div key={deal.id} className={`deal-card${selected===deal.id?' selected':''}`} onClick={() => setSelected(selected===deal.id?null:deal.id)}>
                  <div className="deal-card-name">{deal.name}</div>
                  <div className="deal-card-meta">{deal.rooms ? `${deal.rooms} rooms · ` : ''}{deal.market}</div>
                  <div className="deal-card-value">{fmt(deal.ask_price)}</div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {selectedDeal && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">{selectedDeal.name}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setModal(selectedDeal)}>Edit</button>
              <select className="form-select" style={{ width: 'auto', fontSize: 11, padding: '4px 8px' }} value={selectedDeal.stage} onChange={e => handleStageChange(selectedDeal.id, e.target.value)}>
                {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              ['Ask Price', fmt(selectedDeal.ask_price)],
              ['Price/Key', selectedDeal.price_per_key ? `$${selectedDeal.price_per_key.toLocaleString()}` : '—'],
              ['Cap Rate', selectedDeal.cap_rate ? `${selectedDeal.cap_rate}%` : '—'],
              ['Deal Score', selectedDeal.score ? `${selectedDeal.score}/100` : '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--gray50)', border: '1px solid var(--gray100)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--g900)' }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--gray500)', marginBottom: 8 }}>Due diligence checklist</div>

          {selectedDeal.deal_checklist?.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--gray500)', marginBottom: 12 }}>No checklist items yet.</div>
          )}

          <ul className="checklist">
            {(selectedDeal.deal_checklist || []).sort((a,b) => a.sort_order - b.sort_order).map(item => (
              <li key={item.id}>
                <div className={`check-box${item.completed?' done':''}`} onClick={() => toggleChecklist(item.id, !item.completed)}>
                  {item.completed && '✓'}
                </div>
                <span style={{ textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--gray500)' : 'var(--gray700)' }}>{item.item}</span>
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input className="form-input" style={{ flex: 1 }} placeholder="Add checklist item..." value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddItem()} />
            <button className="btn btn-secondary btn-sm" onClick={handleAddItem}>Add</button>
          </div>

          {selectedDeal.notes && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 7, fontSize: 12, color: 'var(--g900)' }}>{selectedDeal.notes}</div>
          )}
        </div>
      )}

      {modal !== null && (
        <DealModal deal={modal?.id ? modal : null} onClose={() => setModal(null)} onSave={handleSave} />
      )}
    </div>
  )
}
