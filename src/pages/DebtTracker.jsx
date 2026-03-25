import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(2)}M` : '—'
const fmtPct = (n) => n ? `${parseFloat(n).toFixed(2)}%` : '—'
const LOAN_TYPES = ['senior','mezzanine','preferred_equity','construction','bridge','permanent','heloc']
const RATE_TYPES = ['fixed','floating','hybrid']

function daysUntilMaturity(date) {
  if (!date) return null
  const diff = new Date(date) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function useDebt() {
  const [debt, setDebt] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const { data } = await supabase.from('asset_debt').select('*, assets(name, market, current_value)').order('maturity_date', { ascending: true })
    setDebt(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const save = async (d) => {
    if (d.id) {
      const { data, error } = await supabase.from('asset_debt').update(d).eq('id', d.id).select('*, assets(name, market, current_value)').single()
      if (!error) setDebt(prev => prev.map(x => x.id === d.id ? data : x))
      return { data, error }
    } else {
      const { data, error } = await supabase.from('asset_debt').insert(d).select('*, assets(name, market, current_value)').single()
      if (!error) setDebt(prev => [...prev, data])
      return { data, error }
    }
  }

  const remove = async (id) => {
    await supabase.from('asset_debt').delete().eq('id', id)
    setDebt(prev => prev.filter(d => d.id !== id))
  }

  return { debt, loading, save, remove }
}

function DebtModal({ debt, assets, onClose, onSave }) {
  const [form, setForm] = useState(debt ? { ...debt } : {
    asset_id: assets[0]?.id || '', lender: '', loan_type: 'senior', rate_type: 'fixed',
    original_balance: '', current_balance: '', interest_rate: '', ltv: '',
    origination_date: '', maturity_date: '', debt_service_annual: '',
    extension_options: '', prepayment_penalty: false, notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.lender.trim()) { setError('Lender is required'); return }
    if (!form.asset_id) { setError('Asset is required'); return }
    setLoading(true)
    const payload = {
      ...form,
      original_balance: form.original_balance ? parseFloat(form.original_balance) : null,
      current_balance: form.current_balance ? parseFloat(form.current_balance) : null,
      interest_rate: form.interest_rate ? parseFloat(form.interest_rate) : null,
      ltv: form.ltv ? parseFloat(form.ltv) : null,
      debt_service_annual: form.debt_service_annual ? parseFloat(form.debt_service_annual) : null,
      origination_date: form.origination_date || null,
      maturity_date: form.maturity_date || null,
    }
    const { error } = await onSave(payload)
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 580 }}>
        <div className="modal-header">
          <span className="modal-title">{debt ? 'Edit Loan' : 'Add Loan'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ background: 'var(--redL)', color: 'var(--red)', padding: '8px 12px', borderRadius: 7, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div className="form-group"><label className="form-label">Asset *</label>
          <select className="form-select" value={form.asset_id} onChange={e => set('asset_id', e.target.value)}>
            {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Lender *</label><input className="form-input" value={form.lender} onChange={e => set('lender', e.target.value)} placeholder="Wells Fargo" /></div>
          <div className="form-group"><label className="form-label">Loan Type</label>
            <select className="form-select" value={form.loan_type} onChange={e => set('loan_type', e.target.value)}>
              {LOAN_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </select>
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Original Balance ($)</label><input className="form-input" type="number" value={form.original_balance} onChange={e => set('original_balance', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Current Balance ($)</label><input className="form-input" type="number" value={form.current_balance} onChange={e => set('current_balance', e.target.value)} /></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Interest Rate (%)</label><input className="form-input" type="number" step="0.01" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} placeholder="5.75" /></div>
          <div className="form-group"><label className="form-label">Rate Type</label>
            <select className="form-select" value={form.rate_type} onChange={e => set('rate_type', e.target.value)}>
              {RATE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Origination Date</label><input className="form-input" type="date" value={form.origination_date} onChange={e => set('origination_date', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Maturity Date</label><input className="form-input" type="date" value={form.maturity_date} onChange={e => set('maturity_date', e.target.value)} /></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">LTV (%)</label><input className="form-input" type="number" step="0.1" value={form.ltv} onChange={e => set('ltv', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Annual Debt Service ($)</label><input className="form-input" type="number" value={form.debt_service_annual} onChange={e => set('debt_service_annual', e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Extension Options</label><input className="form-input" value={form.extension_options} onChange={e => set('extension_options', e.target.value)} placeholder="2 x 1-year extensions" /></div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 500, color: 'var(--gray700)', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.prepayment_penalty} onChange={e => set('prepayment_penalty', e.target.checked)} />
            Prepayment penalty applies
          </label>
        </div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} /></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : debt ? 'Save Changes' : 'Add Loan'}</button>
        </div>
      </div>
    </div>
  )
}

export default function DebtTracker() {
  const { debt, loading, save, remove } = useDebt()
  const { assets } = useAssets()
  const [modal, setModal] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [filterAsset, setFilterAsset] = useState('all')
  const [view, setView] = useState('table') // table | calendar

  const filtered = filterAsset === 'all' ? debt : debt.filter(d => d.asset_id === filterAsset)
  const totalDebt = debt.reduce((s, d) => s + (d.current_balance || 0), 0)
  const totalDS = debt.reduce((s, d) => s + (d.debt_service_annual || 0), 0)
  const avgRate = debt.filter(d => d.interest_rate).length
    ? (debt.filter(d => d.interest_rate).reduce((s, d) => s + d.interest_rate, 0) / debt.filter(d => d.interest_rate).length).toFixed(2)
    : null

  // Maturity alerts
  const maturingIn12 = debt.filter(d => { const days = daysUntilMaturity(d.maturity_date); return days !== null && days >= 0 && days <= 365 })
  const maturingIn6 = debt.filter(d => { const days = daysUntilMaturity(d.maturity_date); return days !== null && days >= 0 && days <= 180 })

  if (loading) return <div className="loading">Loading debt tracker...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Debt & Capital Stack</h1>
        <p>Track loans, maturities, and debt service across your portfolio</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Debt Outstanding</div><div className="kpi-value">{fmtM(totalDebt)}</div><div className="kpi-change">{debt.length} loans</div></div>
        <div className="kpi-card"><div className="kpi-label">Annual Debt Service</div><div className="kpi-value">{fmtM(totalDS)}</div><div className="kpi-change">Portfolio total</div></div>
        <div className="kpi-card"><div className="kpi-label">Avg. Interest Rate</div><div className="kpi-value">{avgRate ? `${avgRate}%` : '—'}</div><div className="kpi-change">Across all loans</div></div>
        <div className="kpi-card">
          <div className="kpi-label">Maturing ≤ 12 Months</div>
          <div className="kpi-value" style={{ color: maturingIn6.length > 0 ? 'var(--red)' : maturingIn12.length > 0 ? 'var(--amber)' : 'var(--g900)' }}>{maturingIn12.length}</div>
          <div className={`kpi-change${maturingIn6.length > 0 ? ' down' : ''}`}>{maturingIn6.length > 0 ? `${maturingIn6.length} within 6 months` : 'All clear'}</div>
        </div>
      </div>

      {maturingIn6.length > 0 && (
        <div style={{ background: 'var(--redL)', border: '1px solid #f5c6c2', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--red)', marginBottom: 6 }}>⚠ Loans maturing within 6 months</div>
          {maturingIn6.map(d => (
            <div key={d.id} style={{ fontSize: 12, color: 'var(--red)', marginBottom: 2 }}>
              <strong>{d.assets?.name}</strong> — {d.lender} · {fmtM(d.current_balance)} · Matures {new Date(d.maturity_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} ({daysUntilMaturity(d.maturity_date)} days)
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, flexWrap: 'wrap' }}>
            <span className="card-title">Loan register</span>
            <select className="form-select" style={{ width: 'auto', fontSize: 11 }} value={filterAsset} onChange={e => setFilterAsset(e.target.value)}>
              <option value="all">All assets</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Add Loan</button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏦</div>
            <div className="empty-state-title">No loans tracked yet</div>
            <div className="empty-state-desc">Add your portfolio debt to track maturities and debt service.</div>
            <button className="btn btn-primary" onClick={() => setModal({})}>+ Add Loan</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr>
                <th>Asset</th><th>Lender</th><th>Type</th><th>Balance</th>
                <th>Rate</th><th>Maturity</th><th>Days Left</th><th>Ann. DS</th><th>LTV</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(d => {
                  const days = daysUntilMaturity(d.maturity_date)
                  const urgent = days !== null && days <= 180
                  const warning = days !== null && days <= 365 && days > 180
                  return (
                    <tr key={d.id}>
                      <td><strong>{d.assets?.name || '—'}</strong><div style={{ fontSize: 10, color: 'var(--gray500)' }}>{d.assets?.market}</div></td>
                      <td>{d.lender}</td>
                      <td><span style={{ fontSize: 10, background: 'var(--g50)', color: 'var(--g700)', padding: '2px 7px', borderRadius: 10 }}>{d.loan_type?.replace('_',' ')}</span></td>
                      <td style={{ fontWeight: 500 }}>{fmtM(d.current_balance)}</td>
                      <td>{fmtPct(d.interest_rate)}{d.rate_type && <span style={{ fontSize: 9, color: 'var(--gray500)', marginLeft: 4 }}>{d.rate_type}</span>}</td>
                      <td style={{ color: urgent ? 'var(--red)' : warning ? 'var(--amber)' : 'var(--gray700)' }}>
                        {d.maturity_date ? new Date(d.maturity_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ fontWeight: days !== null && days <= 365 ? 500 : 400, color: urgent ? 'var(--red)' : warning ? 'var(--amber)' : 'var(--gray700)' }}>
                        {days !== null ? (days < 0 ? '⚠ Expired' : `${days}d`) : '—'}
                      </td>
                      <td>{fmtM(d.debt_service_annual)}</td>
                      <td>{fmtPct(d.ltv)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="card-action" onClick={() => setModal(d)}>Edit</button>
                          <button className="card-action" style={{ color: 'var(--red)' }} onClick={() => setDeleteId(d.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && <DebtModal debt={modal?.id ? modal : null} assets={assets} onClose={() => setModal(null)} onSave={save} />}
      {deleteId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header"><span className="modal-title">Delete Loan</span><button className="modal-close" onClick={() => setDeleteId(null)}>✕</button></div>
            <p style={{ fontSize: 13, color: 'var(--gray700)', marginBottom: 20, lineHeight: 1.6 }}>Delete this loan record? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { remove(deleteId); setDeleteId(null) }}>Delete Loan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
