import { useState } from 'react'
import { useAssets } from '../hooks/useData'

const fmt = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'

const TYPES = ['hotel', 'resort', 'mixed', 'commercial']
const STATUSES = ['active', 'renovation', 'review', 'disposed']

function AssetModal({ asset, onClose, onSave }) {
  const [form, setForm] = useState(asset || { name: '', type: 'hotel', market: '', rooms: '', status: 'active', brand: '', year_acquired: '', acquisition_price: '', current_value: '', notes: '' })
  const [loading, setLoading] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setLoading(true)
    const payload = { ...form, rooms: form.rooms ? Number(form.rooms) : null, year_acquired: form.year_acquired ? Number(form.year_acquired) : null, acquisition_price: form.acquisition_price ? Number(form.acquisition_price) : null, current_value: form.current_value ? Number(form.current_value) : null }
    await onSave(payload)
    setLoading(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{asset ? 'Edit Asset' : 'Add Asset'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Property Name</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Market</label><input className="form-input" value={form.market} onChange={e => set('market', e.target.value)} placeholder="City, ST" /></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Type</label>
            <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
              {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Rooms</label><input className="form-input" type="number" value={form.rooms} onChange={e => set('rooms', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Brand / Flag</label><input className="form-input" value={form.brand} onChange={e => set('brand', e.target.value)} /></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Year Acquired</label><input className="form-input" type="number" value={form.year_acquired} onChange={e => set('year_acquired', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Acquisition Price ($)</label><input className="form-input" type="number" value={form.acquisition_price} onChange={e => set('acquisition_price', e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Current Value ($)</label><input className="form-input" type="number" value={form.current_value} onChange={e => set('current_value', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} /></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || !form.name}>{loading ? 'Saving...' : 'Save Asset'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Assets() {
  const { assets, loading, addAsset, updateAsset } = useAssets()
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null)

  const filtered = filter === 'all' ? assets : assets.filter(a => a.type === filter)

  const statusClass = (s) => ({ active: 'status-active', renovation: 'status-renovation', review: 'status-review' }[s] || '')
  const statusLabel = (s) => s.charAt(0).toUpperCase() + s.slice(1)

  const handleSave = async (data) => {
    if (modal?.id) await updateAsset(modal.id, data)
    else await addAsset(data)
  }

  if (loading) return <div className="loading">Loading assets...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Asset Tracker</h1>
        <p>Full portfolio — {assets.length} assets across multiple markets</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Hotels</div><div className="kpi-value">{assets.filter(a=>a.type==='hotel').length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Resorts</div><div className="kpi-value">{assets.filter(a=>a.type==='resort').length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Mixed / Commercial</div><div className="kpi-value">{assets.filter(a=>['mixed','commercial'].includes(a.type)).length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Under Renovation</div><div className="kpi-value">{assets.filter(a=>a.status==='renovation').length}</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="card-title">All assets</span>
            <div className="filter-tabs" style={{ margin: 0 }}>
              {['all','hotel','resort','mixed','commercial'].map(t => (
                <button key={t} className={`filter-tab${filter===t?' active':''}`} onClick={() => setFilter(t)}>{t==='all'?'All':t.charAt(0).toUpperCase()+t.slice(1)+'s'}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Add Asset</button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No assets yet</div>
            <div className="empty-state-desc">Add your first asset to get started</div>
            <button className="btn btn-primary" onClick={() => setModal({})}>+ Add Asset</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr>
                <th>Property</th><th>Type</th><th>Market</th><th>Brand</th><th>Rooms</th>
                <th>Acq. Price</th><th>Current Value</th><th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong></td>
                    <td><span className={`badge badge-${a.type}`}>{a.type}</span></td>
                    <td>{a.market}</td>
                    <td style={{ color: 'var(--gray500)' }}>{a.brand || '—'}</td>
                    <td>{a.rooms ?? '—'}</td>
                    <td>{fmt(a.acquisition_price)}</td>
                    <td>{fmt(a.current_value)}</td>
                    <td><span className={statusClass(a.status)}>{statusLabel(a.status)}</span></td>
                    <td><button className="card-action" onClick={() => setModal(a)}>Edit →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <AssetModal asset={modal?.id ? modal : null} onClose={() => setModal(null)} onSave={handleSave} />
      )}
    </div>
  )
}
