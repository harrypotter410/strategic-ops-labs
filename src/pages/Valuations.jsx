import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

const fmt = (n) => n ? `$${(n/1e6).toFixed(2)}M` : '—'
const fmtM = (n) => n ? `$${(n/1e6).toFixed(1)}M` : '—'
const fmtPct = (n) => n ? `${parseFloat(n).toFixed(2)}%` : '—'
const METHODS = { income: 'Income Approach', sales_comp: 'Sales Comp', replacement_cost: 'Replacement Cost', blended: 'Blended' }
const QUARTERS = [1, 2, 3, 4]
const currentYear = new Date().getFullYear()
const currentQ = Math.ceil((new Date().getMonth() + 1) / 3)

function useValuations() {
  const [valuations, setValuations] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('valuations')
      .select('*, assets(name, type, market, rooms, acquisition_price)')
      .order('year', { ascending: false })
      .order('quarter', { ascending: false })
    setValuations(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const save = async (val) => {
    if (val.id) {
      const { data, error } = await supabase.from('valuations').update({ ...val, updated_at: new Date().toISOString() }).eq('id', val.id).select('*, assets(name, type, market, rooms, acquisition_price)').single()
      if (!error) setValuations(prev => prev.map(v => v.id === val.id ? data : v))
      return { data, error }
    } else {
      const { data, error } = await supabase.from('valuations').insert(val).select('*, assets(name, type, market, rooms, acquisition_price)').single()
      if (!error) setValuations(prev => [data, ...prev])
      return { data, error }
    }
  }

  const remove = async (id) => {
    const { error } = await supabase.from('valuations').delete().eq('id', id)
    if (!error) setValuations(prev => prev.filter(v => v.id !== id))
    return { error }
  }

  return { valuations, loading, refetch: fetch, save, remove }
}

function ValuationModal({ valuation, assets, onClose, onSave }) {
  const [tab, setTab] = useState('basics')
  const [form, setForm] = useState(valuation ? { ...valuation } : {
    asset_id: assets[0]?.id || '',
    valuation_date: new Date().toISOString().split('T')[0],
    quarter: currentQ, year: currentYear,
    valuation_method: 'income',
    appraised_value: '', internal_estimate: '', book_value: '',
    noi_trailing: '', noi_forward: '', cap_rate_applied: '',
    comp_price_per_key: '', rooms: '',
    market_cap_rate_low: '', market_cap_rate_high: '',
    revpar_index: '', outstanding_debt: '',
    valuation_notes: '', prepared_by: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-calculate values
  const noiVal = form.noi_trailing && form.cap_rate_applied
    ? Math.round(parseFloat(form.noi_trailing) / (parseFloat(form.cap_rate_applied) / 100))
    : null
  const salesCompVal = form.comp_price_per_key && form.rooms
    ? Math.round(parseFloat(form.comp_price_per_key) * parseInt(form.rooms))
    : null
  const equityVal = form.appraised_value && form.outstanding_debt
    ? parseFloat(form.appraised_value) - parseFloat(form.outstanding_debt)
    : form.internal_estimate && form.outstanding_debt
    ? parseFloat(form.internal_estimate) - parseFloat(form.outstanding_debt)
    : null

  const selectedAsset = assets.find(a => a.id === form.asset_id)
  const gainLoss = (form.appraised_value || form.internal_estimate) && selectedAsset?.acquisition_price
    ? parseFloat(form.appraised_value || form.internal_estimate) - selectedAsset.acquisition_price
    : null

  const handleSubmit = async () => {
    if (!form.asset_id) { setError('Select an asset.'); return }
    setLoading(true); setError('')
    const payload = {
      ...form,
      quarter: parseInt(form.quarter), year: parseInt(form.year),
      appraised_value: form.appraised_value ? parseFloat(form.appraised_value) : null,
      internal_estimate: form.internal_estimate ? parseFloat(form.internal_estimate) : null,
      book_value: form.book_value ? parseFloat(form.book_value) : null,
      noi_trailing: form.noi_trailing ? parseFloat(form.noi_trailing) : null,
      noi_forward: form.noi_forward ? parseFloat(form.noi_forward) : null,
      cap_rate_applied: form.cap_rate_applied ? parseFloat(form.cap_rate_applied) : null,
      comp_price_per_key: form.comp_price_per_key ? parseFloat(form.comp_price_per_key) : null,
      rooms: form.rooms ? parseInt(form.rooms) : selectedAsset?.rooms || null,
      market_cap_rate_low: form.market_cap_rate_low ? parseFloat(form.market_cap_rate_low) : null,
      market_cap_rate_high: form.market_cap_rate_high ? parseFloat(form.market_cap_rate_high) : null,
      revpar_index: form.revpar_index ? parseFloat(form.revpar_index) : null,
      outstanding_debt: form.outstanding_debt ? parseFloat(form.outstanding_debt) : null,
      equity_value: equityVal,
    }
    const { error } = await onSave(payload)
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onClose()
  }

  const ts = (t) => ({ fontSize: 12, padding: '5px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer', borderColor: tab===t ? 'var(--g600)' : 'var(--gray200)', background: tab===t ? 'var(--g700)' : 'var(--white)', color: tab===t ? 'var(--white)' : 'var(--gray700)' })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 600 }}>
        <div className="modal-header">
          <span className="modal-title">{valuation ? 'Edit Valuation' : 'New Quarterly Valuation'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ background: 'var(--redL)', color: 'var(--red)', padding: '8px 12px', borderRadius: 7, fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[['basics','Property & Date'],['income','Income Approach'],['comp','Sales Comp'],['market','Market Context'],['notes','Notes']].map(([t,l]) => <button key={t} style={ts(t)} onClick={() => setTab(t)}>{l}</button>)}
        </div>

        {tab === 'basics' && (<>
          <div className="form-group"><label className="form-label">Asset *</label>
            <select className="form-select" value={form.asset_id} onChange={e => { set('asset_id', e.target.value); const a = assets.find(x => x.id === e.target.value); if (a?.rooms) set('rooms', a.rooms) }}>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name} — {a.market}</option>)}
            </select>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Quarter</label>
              <select className="form-select" value={form.quarter} onChange={e => set('quarter', e.target.value)}>
                {QUARTERS.map(q => <option key={q} value={q}>Q{q}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Year</label>
              <select className="form-select" value={form.year} onChange={e => set('year', e.target.value)}>
                {[currentYear+1, currentYear, currentYear-1, currentYear-2, currentYear-3].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Valuation Date</label><input className="form-input" type="date" value={form.valuation_date} onChange={e => set('valuation_date', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Method</label>
              <select className="form-select" value={form.valuation_method} onChange={e => set('valuation_method', e.target.value)}>
                {Object.entries(METHODS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Appraised Value ($)</label><input className="form-input" type="number" value={form.appraised_value} onChange={e => set('appraised_value', e.target.value)} placeholder="Third-party appraisal" /></div>
            <div className="form-group"><label className="form-label">Internal Estimate ($)</label><input className="form-input" type="number" value={form.internal_estimate} onChange={e => set('internal_estimate', e.target.value)} placeholder="Your estimate" /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Book Value ($)</label><input className="form-input" type="number" value={form.book_value} onChange={e => set('book_value', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Outstanding Debt ($)</label><input className="form-input" type="number" value={form.outstanding_debt} onChange={e => set('outstanding_debt', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Prepared By</label><input className="form-input" value={form.prepared_by} onChange={e => set('prepared_by', e.target.value)} placeholder="Your name" /></div>

          {/* Live calculations */}
          {(equityVal || gainLoss !== null) && (
            <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 8, padding: '12px 14px', marginTop: 4, display: 'flex', gap: 16 }}>
              {equityVal && <div><div style={{ fontSize: 10, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Implied Equity</div><div style={{ fontSize: 15, fontWeight: 600, color: 'var(--g900)' }}>{fmtM(equityVal)}</div></div>}
              {gainLoss !== null && <div><div style={{ fontSize: 10, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>vs. Cost Basis</div><div style={{ fontSize: 15, fontWeight: 600, color: gainLoss >= 0 ? 'var(--g600)' : 'var(--red)' }}>{gainLoss >= 0 ? '+' : ''}{fmtM(gainLoss)}</div></div>}
            </div>
          )}
        </>)}

        {tab === 'income' && (<>
          <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: 'var(--g700)', marginBottom: 14 }}>NOI ÷ Cap Rate = Implied Value. Enter both to auto-calculate.</div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Trailing NOI ($)</label><input className="form-input" type="number" value={form.noi_trailing} onChange={e => set('noi_trailing', e.target.value)} placeholder="8500000" /></div>
            <div className="form-group"><label className="form-label">Forward NOI ($)</label><input className="form-input" type="number" value={form.noi_forward} onChange={e => set('noi_forward', e.target.value)} placeholder="9200000" /></div>
          </div>
          <div className="form-group"><label className="form-label">Cap Rate Applied (%)</label><input className="form-input" type="number" step="0.01" value={form.cap_rate_applied} onChange={e => set('cap_rate_applied', e.target.value)} placeholder="6.50" /></div>
          {noiVal && (
            <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 8, padding: '12px 14px', marginTop: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Income Approach Value</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--g900)', fontFamily: 'Playfair Display, serif' }}>{fmt(noiVal)}</div>
              <div style={{ fontSize: 11, color: 'var(--gray500)', marginTop: 2 }}>{fmtM(form.noi_trailing)} ÷ {form.cap_rate_applied}% = {fmt(noiVal)}</div>
            </div>
          )}
        </>)}

        {tab === 'comp' && (<>
          <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: 'var(--g700)', marginBottom: 14 }}>Price/Key × Rooms = Implied Value</div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Comp Price/Key ($)</label><input className="form-input" type="number" value={form.comp_price_per_key} onChange={e => set('comp_price_per_key', e.target.value)} placeholder="185000" /></div>
            <div className="form-group"><label className="form-label">Rooms</label><input className="form-input" type="number" value={form.rooms || selectedAsset?.rooms || ''} onChange={e => set('rooms', e.target.value)} /></div>
          </div>
          {salesCompVal && (
            <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 8, padding: '12px 14px', marginTop: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>Sales Comp Value</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--g900)', fontFamily: 'Playfair Display, serif' }}>{fmt(salesCompVal)}</div>
              <div style={{ fontSize: 11, color: 'var(--gray500)', marginTop: 2 }}>${parseInt(form.comp_price_per_key).toLocaleString()}/key × {form.rooms || selectedAsset?.rooms} rooms</div>
            </div>
          )}
        </>)}

        {tab === 'market' && (<>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Market Cap Rate Low (%)</label><input className="form-input" type="number" step="0.01" value={form.market_cap_rate_low} onChange={e => set('market_cap_rate_low', e.target.value)} placeholder="5.50" /></div>
            <div className="form-group"><label className="form-label">Market Cap Rate High (%)</label><input className="form-input" type="number" step="0.01" value={form.market_cap_rate_high} onChange={e => set('market_cap_rate_high', e.target.value)} placeholder="7.50" /></div>
          </div>
          <div className="form-group"><label className="form-label">RevPAR Index</label><input className="form-input" type="number" step="0.1" value={form.revpar_index} onChange={e => set('revpar_index', e.target.value)} placeholder="108.4" /></div>
        </>)}

        {tab === 'notes' && (<>
          <div className="form-group"><label className="form-label">Valuation Notes</label><textarea className="form-input" rows={6} value={form.valuation_notes} onChange={e => set('valuation_notes', e.target.value)} style={{ resize: 'vertical' }} placeholder="Key assumptions, market conditions, methodology notes, risks, upside factors..." /></div>
        </>)}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : valuation ? 'Save Changes' : 'Save Valuation'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Valuations() {
  const { valuations, loading, save, remove } = useValuations()
  const { assets } = useAssets()
  const [modal, setModal] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [filterYear, setFilterYear] = useState(String(currentYear))
  const [filterQ, setFilterQ] = useState('all')
  const [filterAsset, setFilterAsset] = useState('all')
  const [view, setView] = useState('table') // table | compare

  const filtered = valuations.filter(v => {
    if (filterYear !== 'all' && String(v.year) !== filterYear) return false
    if (filterQ !== 'all' && String(v.quarter) !== filterQ) return false
    if (filterAsset !== 'all' && v.asset_id !== filterAsset) return false
    return true
  })

  // Portfolio totals for filtered period
  const totalAppraisedVal = filtered.reduce((s, v) => s + (v.appraised_value || v.internal_estimate || 0), 0)
  const totalEquity = filtered.reduce((s, v) => s + (v.equity_value || 0), 0)
  const totalDebt = filtered.reduce((s, v) => s + (v.outstanding_debt || 0), 0)

  // QoQ comparison — for selected asset
  const getHistory = (assetId) => valuations.filter(v => v.asset_id === assetId).sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter - b.quarter)

  // Years available
  const years = [...new Set(valuations.map(v => String(v.year)))].sort((a,b) => b-a)

  const statusColor = (v) => v.approved ? 'var(--g600)' : 'var(--amber)'

  if (loading) return <div className="loading">Loading valuations...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Quarterly Valuations</h1>
        <p>Track and compare asset values across reporting periods</p>
      </div>

      {/* Portfolio KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Portfolio Value</div>
          <div className="kpi-value">{fmtM(totalAppraisedVal) !== '—' ? fmtM(totalAppraisedVal) : fmtM(valuations.reduce((s,v)=>s+(v.appraised_value||v.internal_estimate||0),0))}</div>
          <div className="kpi-change">{filtered.length} valuations</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Equity Value</div>
          <div className="kpi-value">{fmtM(totalEquity || valuations.reduce((s,v)=>s+(v.equity_value||0),0))}</div>
          <div className="kpi-change">After debt</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Debt</div>
          <div className="kpi-value">{fmtM(totalDebt || valuations.reduce((s,v)=>s+(v.outstanding_debt||0),0))}</div>
          <div className="kpi-change">Outstanding</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Valuations on File</div>
          <div className="kpi-value">{valuations.length}</div>
          <div className="kpi-change">Across {[...new Set(valuations.map(v=>v.asset_id))].length} assets</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, flexWrap: 'wrap' }}>
            <span className="card-title">Valuation history</span>
            <div className="filter-tabs" style={{ margin: 0 }}>
              {['all', ...years].map(y => <button key={y} className={`filter-tab${filterYear===y?' active':''}`} onClick={() => setFilterYear(y)}>{y === 'all' ? 'All years' : y}</button>)}
            </div>
            <div className="filter-tabs" style={{ margin: 0 }}>
              {['all','1','2','3','4'].map(q => <button key={q} className={`filter-tab${filterQ===q?' active':''}`} onClick={() => setFilterQ(q)}>{q==='all'?'All Qs':'Q'+q}</button>)}
            </div>
            <select className="form-select" style={{ width: 'auto', fontSize: 11 }} value={filterAsset} onChange={e => setFilterAsset(e.target.value)}>
              <option value="all">All assets</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ New Valuation</button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No valuations yet</div>
            <div className="empty-state-desc">Start tracking quarterly valuations for your portfolio assets.</div>
            <button className="btn btn-primary" onClick={() => setModal({})}>+ New Valuation</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr>
                <th>Asset</th><th>Period</th><th>Method</th>
                <th>Appraised / Internal</th><th>Equity Value</th><th>Cap Rate</th>
                <th>vs. Cost Basis</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(v => {
                  const displayVal = v.appraised_value || v.internal_estimate
                  const costBasis = v.assets?.acquisition_price
                  const gain = displayVal && costBasis ? displayVal - costBasis : null
                  const gainPct = gain && costBasis ? ((gain/costBasis)*100).toFixed(1) : null
                  return (
                    <tr key={v.id}>
                      <td><strong>{v.assets?.name || '—'}</strong><div style={{ fontSize: 10, color: 'var(--gray500)' }}>{v.assets?.market}</div></td>
                      <td><span style={{ fontWeight: 500, color: 'var(--g900)' }}>Q{v.quarter} {v.year}</span></td>
                      <td><span style={{ fontSize: 11, color: 'var(--gray500)' }}>{METHODS[v.valuation_method] || '—'}</span></td>
                      <td>
                        {v.appraised_value && <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--g900)' }}>{fmtM(v.appraised_value)} <span style={{ fontSize: 10, color: 'var(--gray500)' }}>appraised</span></div>}
                        {v.internal_estimate && <div style={{ fontSize: 12, color: 'var(--gray700)' }}>{fmtM(v.internal_estimate)} <span style={{ fontSize: 10, color: 'var(--gray500)' }}>internal</span></div>}
                        {!v.appraised_value && !v.internal_estimate && '—'}
                      </td>
                      <td style={{ fontWeight: 500 }}>{fmtM(v.equity_value)}</td>
                      <td>{fmtPct(v.cap_rate_applied)}</td>
                      <td>
                        {gain !== null ? (
                          <span style={{ color: gain >= 0 ? 'var(--g600)' : 'var(--red)', fontWeight: 500, fontSize: 12 }}>
                            {gain >= 0 ? '+' : ''}{fmtM(gain)}<br/>
                            <span style={{ fontSize: 10, fontWeight: 400 }}>({gain >= 0 ? '+' : ''}{gainPct}%)</span>
                          </span>
                        ) : '—'}
                      </td>
                      <td><span style={{ fontSize: 11, fontWeight: 500, color: statusColor(v) }}>{v.approved ? 'Approved' : 'Draft'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="card-action" onClick={() => setModal(v)}>Edit</button>
                          {!v.approved && <button className="card-action" style={{ color: 'var(--g600)' }} onClick={async () => { await save({ ...v, approved: true }) }}>Approve</button>}
                          <button className="card-action" style={{ color: 'var(--red)' }} onClick={() => setDeleteId(v.id)}>Delete</button>
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

      {/* QoQ Comparison — show if a single asset is selected */}
      {filterAsset !== 'all' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Quarter-over-quarter — {assets.find(a=>a.id===filterAsset)?.name}</span>
          </div>
          {(() => {
            const history = getHistory(filterAsset)
            if (history.length < 2) return <div style={{ fontSize: 12, color: 'var(--gray500)' }}>Add at least 2 valuations to see QoQ comparison.</div>
            return (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead><tr>
                    <th>Period</th><th>Value</th><th>Change $</th><th>Change %</th><th>Cap Rate</th><th>Equity</th>
                  </tr></thead>
                  <tbody>
                    {history.map((v, i) => {
                      const prev = i > 0 ? history[i-1] : null
                      const thisVal = v.appraised_value || v.internal_estimate
                      const prevVal = prev ? (prev.appraised_value || prev.internal_estimate) : null
                      const change = thisVal && prevVal ? thisVal - prevVal : null
                      const changePct = change && prevVal ? ((change/prevVal)*100).toFixed(1) : null
                      return (
                        <tr key={v.id}>
                          <td><strong>Q{v.quarter} {v.year}</strong></td>
                          <td style={{ fontWeight: 500, color: 'var(--g900)' }}>{fmtM(thisVal)}</td>
                          <td style={{ color: change > 0 ? 'var(--g600)' : change < 0 ? 'var(--red)' : 'var(--gray500)' }}>
                            {change !== null ? `${change > 0 ? '+' : ''}${fmtM(change)}` : '—'}
                          </td>
                          <td style={{ color: change > 0 ? 'var(--g600)' : change < 0 ? 'var(--red)' : 'var(--gray500)', fontWeight: 500 }}>
                            {changePct !== null ? `${change > 0 ? '+' : ''}${changePct}%` : '—'}
                          </td>
                          <td>{fmtPct(v.cap_rate_applied)}</td>
                          <td>{fmtM(v.equity_value)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })()}
        </div>
      )}

      {modal !== null && <ValuationModal valuation={modal?.id ? modal : null} assets={assets} onClose={() => setModal(null)} onSave={save} />}

      {deleteId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header"><span className="modal-title">Delete Valuation</span><button className="modal-close" onClick={() => setDeleteId(null)}>✕</button></div>
            <p style={{ fontSize: 13, color: 'var(--gray700)', marginBottom: 20, lineHeight: 1.6 }}>Delete this valuation? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { remove(deleteId); setDeleteId(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
