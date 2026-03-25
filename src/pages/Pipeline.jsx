import { useState } from 'react'
import { useDeals } from '../hooks/useData'

const STAGES = ['prospecting', 'loi', 'due_diligence', 'closing']
const STAGE_LABELS = { prospecting: 'Prospecting', loi: 'LOI Signed', due_diligence: 'Due Diligence', closing: 'Closing' }
const fmt = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'

function DealModal({ deal, onClose, onSave }) {
  const [form, setForm] = useState(deal ? {
    name: deal.name || '',
    market: deal.market || '',
    type: deal.type || 'hotel',
    rooms: deal.rooms || '',
    ask_price: deal.ask_price || '',
    cap_rate: deal.cap_rate || '',
    stage: deal.stage || 'prospecting',
    score: deal.score || 50,
    notes: deal.notes || '',
    expected_close: deal.expected_close || '',
    broker: deal.broker || '',
  } : { name: '', market: '', type: 'hotel', rooms: '', ask_price: '', cap_rate: '', stage: 'prospecting', score: 50, notes: '', expected_close: '', broker: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Deal name is required.'); return }
    setLoading(true)
    setError('')
    const payload = {
      name: form.name.trim(),
      market: form.market.trim() || null,
      type: form.type,
      rooms: form.rooms ? parseInt(form.rooms) : null,
      ask_price: form.ask_price ? parseFloat(form.ask_price) : null,
      price_per_key: form.ask_price && form.rooms ? Math.round(parseFloat(form.ask_price) / parseInt(form.rooms)) : null,
      cap_rate: form.cap_rate ? parseFloat(form.cap_rate) : null,
      stage: form.stage,
      score: parseInt(form.score) || 50,
      notes: form.notes.trim() || null,
      expected_close: form.expected_close || null,
      broker: form.broker.trim() || null,
    }
    const { error } = await onSave(payload)
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{deal ? 'Edit Deal' : 'Add Deal'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ background: 'var(--redL)', color: 'var(--red)', padding: '8px 12px', borderRadius: 7, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Deal Name *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Chattanooga Boutique Hotel" /></div>
          <div className="form-group"><label className="form-label">Market</label><input className="form-input" value={form.market} onChange={e => set('market', e.target.value)} placeholder="Chattanooga, TN" /></div>
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
          <div className="form-group"><label className="form-label">Ask Price ($)</label><input className="form-input" type="number" value={form.ask_price} onChange={e => set('ask_price', e.target.value)} placeholder="28000000" /></div>
          <div className="form-group"><label className="form-label">Rooms</label><input className="form-input" type="number" value={form.rooms} onChange={e => set('rooms', e.target.value)} placeholder="140" /></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Cap Rate (%)</label><input className="form-input" type="number" step="0.1" value={form.cap_rate} onChange={e => set('cap_rate', e.target.value)} placeholder="7.2" /></div>
          <div className="form-group"><label className="form-label">Deal Score (0–100)</label><input className="form-input" type="number" min="0" max="100" value={form.score} onChange={e => set('score', e.target.value)} /></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Expected Close</label><input className="form-input" type="date" value={form.expected_close} onChange={e => set('expected_close', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Broker</label><input className="form-input" value={form.broker} onChange={e => set('broker', e.target.value)} placeholder="CBRE, JLL, etc." /></div>
        </div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} /></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : deal ? 'Save Changes' : 'Add Deal'}</button>
        </div>
      </div>
    </div>
  )
}

function DeleteDealConfirm({ deal, onClose, onDelete }) {
  const [loading, setLoading] = useState(false)
  const handleDelete = async () => {
    setLoading(true)
    await onDelete(deal.id)
    setLoading(false)
    onClose()
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <span className="modal-title">Delete Deal</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--gray700)', marginBottom: 20, lineHeight: 1.6 }}>
          Are you sure you want to delete <strong>{deal.name}</strong>? All checklist items will also be deleted. This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={loading}>{loading ? 'Deleting...' : 'Delete Deal'}</button>
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
  const [newItem, setNewItem] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  const activeDeals = deals.filter(d => STAGES.includes(d.stage))
  const selectedDeal = deals.find(d => d.id === selected)
  const pipelineValue = activeDeals.reduce((s, d) => s + (d.ask_price || 0), 0)
  const avgScore = activeDeals.length ? Math.round(activeDeals.reduce((s,d) => s+(d.score||0), 0) / activeDeals.length) : 0

  const handleSave = async (data) => {
    if (modal?.id) {
      const result = await updateDeal(modal.id, data)
      if (!result.error) setSelected(modal.id)
      return result
    } else {
      const result = await addDeal(data)
      if (!result.error && result.data) setSelected(result.data.id)
      return result
    }
  }

  const handleDelete = async (id) => {
    await deleteDeal(id)
    if (selected === id) setSelected(null)
  }

  const handleAddItem = async () => {
    if (!newItem.trim() || !selected) return
    setAddingItem(true)
    await addChecklistItem(selected, newItem.trim())
    setNewItem('')
    setAddingItem(false)
  }

  const handleStageChange = async (dealId, stage) => {
    await updateDeal(dealId, { stage })
  }

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
        <div className="kpi-card"><div className="kpi-label">Avg. Deal Score</div><div className="kpi-value">{avgScore}/100</div><div className="kpi-change">across active deals</div></div>
        <div className="kpi-card"><div className="kpi-label">Closing Stage</div><div className="kpi-value">{activeDeals.filter(d=>d.stage==='closing').length}</div><div className="kpi-change">deals near close</div></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary btn-sm" onClick={() => { setModal({}); setSelected(null) }}>+ Add Deal</button>
      </div>

      {/* KANBAN BOARD */}
      <div className="kanban">
        {STAGES.map(stage => {
          const stageDeals = activeDeals.filter(d => d.stage === stage)
          return (
            <div key={stage} className="kanban-col">
              <div className="kanban-header">{STAGE_LABELS[stage]}<span className="kanban-count">{stageDeals.length}</span></div>
              {stageDeals.length === 0 && <div style={{ fontSize: 11, color: 'var(--gray300)', textAlign: 'center', padding: '12px 0' }}>No deals</div>}
              {stageDeals.map(deal => (
                <div
                  key={deal.id}
                  className={`deal-card${selected===deal.id?' selected':''}`}
                  onClick={() => setSelected(selected===deal.id ? null : deal.id)}
                >
                  <div className="deal-card-name">{deal.name}</div>
                  <div className="deal-card-meta">{deal.rooms ? `${deal.rooms} rooms · ` : ''}{deal.market}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                    <span className="deal-card-value">{fmt(deal.ask_price)}</span>
                    {deal.score && <span style={{ fontSize: 10, color: 'var(--g600)', fontWeight: 500 }}>{deal.score}/100</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* DEAL DETAIL */}
      {selectedDeal && (
        <div className="card">
          <div className="card-header">
            <div>
              <span className="card-title">{selectedDeal.name}</span>
              {selectedDeal.market && <span style={{ fontSize: 11, color: 'var(--gray500)', marginLeft: 8 }}>{selectedDeal.market}</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                className="form-select"
                style={{ width: 'auto', fontSize: 11, padding: '4px 8px' }}
                value={selectedDeal.stage}
                onChange={e => handleStageChange(selectedDeal.id, e.target.value)}
              >
                {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
              <button className="btn btn-secondary btn-sm" onClick={() => setModal(selectedDeal)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => setDeleteModal(selectedDeal)}>Delete</button>
            </div>
          </div>

          {/* DEAL STATS */}
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

          {selectedDeal.expected_close && (
            <div style={{ fontSize: 11, color: 'var(--gray500)', marginBottom: 12 }}>
              Expected close: <strong style={{ color: 'var(--g900)' }}>{new Date(selectedDeal.expected_close).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
              {selectedDeal.broker && <> · Broker: <strong style={{ color: 'var(--g900)' }}>{selectedDeal.broker}</strong></>}
            </div>
          )}

          {/* CHECKLIST */}
          <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--gray500)', marginBottom: 8 }}>Due diligence checklist</div>

          {(!selectedDeal.deal_checklist || selectedDeal.deal_checklist.length === 0) && (
            <div style={{ fontSize: 12, color: 'var(--gray500)', marginBottom: 12 }}>No checklist items yet. Add your first item below.</div>
          )}

          <ul className="checklist">
            {(selectedDeal.deal_checklist || []).sort((a,b) => a.sort_order - b.sort_order).map(item => (
              <li key={item.id}>
                <div
                  className={`check-box${item.completed ? ' done' : ''}`}
                  onClick={() => toggleChecklist(item.id, !item.completed)}
                  title={item.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {item.completed && '✓'}
                </div>
                <span style={{ textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--gray500)' : 'var(--gray700)', flex: 1 }}>{item.item}</span>
                {item.completed_at && <span style={{ fontSize: 10, color: 'var(--gray300)' }}>{new Date(item.completed_at).toLocaleDateString()}</span>}
              </li>
            ))}
          </ul>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              className="form-input"
              style={{ flex: 1 }}
              placeholder="Add checklist item (e.g. 'Phase I ESA ordered')..."
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
            />
            <button className="btn btn-secondary btn-sm" onClick={handleAddItem} disabled={addingItem || !newItem.trim()}>
              {addingItem ? '...' : 'Add'}
            </button>
          </div>

          {selectedDeal.notes && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 7, fontSize: 12, color: 'var(--g900)', lineHeight: 1.6 }}>
              <strong style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--g600)' }}>Notes</strong>
              <div style={{ marginTop: 4 }}>{selectedDeal.notes}</div>
            </div>
          )}
        </div>
      )}

      {modal !== null && (
        <DealModal deal={modal?.id ? modal : null} onClose={() => setModal(null)} onSave={handleSave} />
      )}
      {deleteModal && (
        <DeleteDealConfirm deal={deleteModal} onClose={() => setDeleteModal(null)} onDelete={handleDelete} />
      )}
    </div>
  )
}
