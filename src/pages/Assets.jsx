import { useState } from 'react'
import { useAssets } from '../hooks/useData'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'
const TYPES = ['hotel', 'resort', 'mixed', 'commercial']
const STATUSES = ['active', 'renovation', 'review', 'disposed']

function AssetModal({ asset, onClose, onSave }) {
  const [form, setForm] = useState(asset ? {
    name: asset.name || '',
    market: asset.market || '',
    type: asset.type || 'hotel',
    status: asset.status || 'active',
    rooms: asset.rooms || '',
    brand: asset.brand || '',
    year_acquired: asset.year_acquired || '',
    acquisition_price: asset.acquisition_price || '',
    current_value: asset.current_value || '',
    notes: asset.notes || '',
  } : { name: '', market: '', type: 'hotel', status: 'active', rooms: '', brand: '', year_acquired: '', acquisition_price: '', current_value: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Property name is required.'); return }
    if (!form.market.trim()) { setError('Market is required.'); return }
    setLoading(true)
    setError('')
    const payload = {
      name: form.name.trim(),
      market: form.market.trim(),
      type: form.type,
      status: form.status,
      rooms: form.rooms ? parseInt(form.rooms) : null,
      brand: form.brand.trim() || null,
      year_acquired: form.year_acquired ? parseInt(form.year_acquired) : null,
      acquisition_price: form.acquisition_price ? parseFloat(form.acquisition_price) : null,
      current_value: form.current_value ? parseFloat(form.current_value) : null,
      notes: form.notes.trim() || null,
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
          <span className="modal-title">{asset ? 'Edit Asset' : 'Add Asset'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ background: 'var(--redL)', color: 'var(--red)', padding: '8px 12px', borderRadius: 7, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Property Name *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="The Peabody Memphis" /></div>
          <div className="form-group"><label className="form-label">Market *</label><input className="form-input" value={form.market} onChange={e => set('market', e.target.value)} placeholder="Memphis, TN" /></div>
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
          <div className="form-group"><label className="form-label">Rooms</label><input className="form-input" type="number" value={form.rooms} onChange={e => set('rooms', e.target.value)} placeholder="250" /></div>
          <div className="form-group"><label className="form-label">Brand / Flag</label><input className="form-input" value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Marriott" /></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Year Acquired</label><input className="form-input" type="number" value={form.year_acquired} onChange={e => set('year_acquired', e.target.value)} placeholder="2021" /></div>
          <div className="form-group"><label className="form-label">Acquisition Price ($)</label><input className="form-input" type="number" value={form.acquisition_price} onChange={e => set('acquisition_price', e.target.value)} placeholder="45000000" /></div>
        </div>
        <div className="form-group"><label className="form-label">Current Value ($)</label><input className="form-input" type="number" value={form.current_value} onChange={e => set('current_value', e.target.value)} placeholder="55000000" /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} /></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : asset ? 'Save Changes' : 'Add Asset'}</button>
        </div>
      </div>
    </div>
  )
}

function DeleteConfirm({ asset, onClose, onDelete }) {
  const [loading, setLoading] = useState(false)
  const handleDelete = async () => {
    setLoading(true)
    await onDelete(asset.id)
    setLoading(false)
    onClose()
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <span className="modal-title">Delete Asset</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--gray700)', marginBottom: 20, lineHeight: 1.6 }}>
          Are you sure you want to delete <strong>{asset.name}</strong>? This will also delete all financial data associated with this asset. This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={handleDelete} disabled={loading}>{loading ? 'Deleting...' : 'Delete Asset'}</button>
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
  const [search, setSearch] = useState('')

  const filtered = assets
    .filter(a => filter === 'all' || a.type === filter)
    .filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.market.toLowerCase().includes(search.toLowerCase()))

  const statusClass = (s) => ({ active: 'status-active', renovation: 'status-renovation', review: 'status-review' }[s] || '')
  const statusLabel = (s) => s.charAt(0).toUpperCase() + s.slice(1)
  const typeClass = (t) => ({ hotel: 'badge-hotel', resort: 'badge-resort', mixed: 'badge-mixed', commercial: 'badge-commercial' }[t] || 'badge-hotel')

  const handleSave = async (data) => {
    if (modal?.id) return await updateAsset(modal.id, data)
    else return await addAsset(data)
  }

  if (loading) return <div className="loading">Loading assets...</div>
  if (error) return <div className="loading" style={{ color: 'var(--red)' }}>Error loading assets. Please refresh.</div>

  return (
    <div>
      <div className="page-header">
        <h1>Asset Tracker</h1>
        <p>Full portfolio — {assets.length} assets across {[...new Set(assets.map(a => a.market))].length} markets</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Hotels</div><div className="kpi-value">{assets.filter(a=>a.type==='hotel').length}</div><div className="kpi-change">{assets.filter(a=>a.type==='hotel').reduce((s,a)=>s+(a.rooms||0),0).toLocaleString()} rooms</div></div>
        <div className="kpi-card"><div className="kpi-label">Resorts</div><div className="kpi-value">{assets.filter(a=>a.type==='resort').length}</div><div className="kpi-change">{assets.filter(a=>a.type==='resort').reduce((s,a)=>s+(a.rooms||0),0).toLocaleString()} rooms</div></div>
        <div className="kpi-card"><div className="kpi-label">Mixed / Commercial</div><div className="kpi-value">{assets.filter(a=>['mixed','commercial'].includes(a.type)).length}</div><div className="kpi-change">Non-hotel assets</div></div>
        <div className="kpi-card"><div className="kpi-label">Under Renovation</div><div className="kpi-value">{assets.filter(a=>a.status==='renovation').length}</div><div className="kpi-change">{assets.filter(a=>a.status==='review').length} under review</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <span className="card-title">All assets</span>
            <div className="filter-tabs" style={{ margin: 0 }}>
              {['all','hotel','resort','mixed','commercial'].map(t => (
                <button key={t} className={`filter-tab${filter===t?' active':''}`} onClick={() => setFilter(t)}>
                  {t === 'all' ? 'All' : t.charAt(0).toUpperCase()+t.slice(1)+'s'}
                </button>
              ))}
            </div>
            <input
              className="form-input"
              style={{ width: 180, padding: '5px 10px', fontSize: 12 }}
              placeholder="Search assets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Add Asset</button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏨</div>
            <div className="empty-state-title">{search ? 'No assets match your search' : 'No assets yet'}</div>
            <div className="empty-state-desc">{search ? 'Try a different search term' : 'Add your first asset to get started'}</div>
            {!search && <button className="btn btn-primary" onClick={() => setModal({})}>+ Add Asset</button>}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr>
                <th>Property</th><th>Type</th><th>Market</th><th>Brand</th><th>Rooms</th>
                <th>Acq. Price</th><th>Current Value</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong>{a.notes && <div style={{ fontSize: 10, color: 'var(--gray500)', marginTop: 2 }}>{a.notes.slice(0, 60)}{a.notes.length > 60 ? '…' : ''}</div>}</td>
                    <td><span className={`badge ${typeClass(a.type)}`}>{a.type}</span></td>
                    <td>{a.market}</td>
                    <td style={{ color: 'var(--gray500)' }}>{a.brand || '—'}</td>
                    <td>{a.rooms?.toLocaleString() ?? '—'}</td>
                    <td>{fmtM(a.acquisition_price)}</td>
                    <td>{fmtM(a.current_value)}</td>
                    <td><span className={statusClass(a.status)}>{statusLabel(a.status)}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="card-action" onClick={() => setModal(a)}>Edit</button>
                        <button className="card-action" style={{ color: 'var(--red)' }} onClick={() => setDeleteModal(a)}>Delete</button>
                      </div>
                    </td>
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
      {deleteModal && (
        <DeleteConfirm asset={deleteModal} onClose={() => setDeleteModal(null)} onDelete={deleteAsset} />
      )}
    </div>
  )
}
