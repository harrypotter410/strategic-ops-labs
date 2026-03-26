import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(2)}M` : '—'
const fmtPct = (n) => n ? `${parseFloat(n).toFixed(2)}%` : '—'
const LOAN_TYPES = ['senior','mezzanine','preferred_equity','construction','bridge','permanent','heloc']
const RATE_TYPES = ['fixed','floating','hybrid']

// The 10 most important REPE covenants
const COVENANTS = [
  {
    key: 'dscr',
    label: 'DSCR',
    fullName: 'Debt Service Coverage Ratio',
    minField: 'covenant_dscr_min',
    actualField: 'covenant_dscr_actual',
    type: 'min', // actual must be >= min
    format: (v) => v ? `${parseFloat(v).toFixed(2)}x` : '—',
    description: 'NOI ÷ Annual Debt Service. Typically must be ≥ 1.20x–1.35x.',
    warningThreshold: 0.10, // flag if within 10% of breach
  },
  {
    key: 'ltv',
    label: 'LTV',
    fullName: 'Loan-to-Value Ratio',
    minField: 'covenant_ltv_max',
    actualField: 'covenant_ltv_actual',
    type: 'max', // actual must be <= max
    format: (v) => v ? `${parseFloat(v).toFixed(1)}%` : '—',
    description: 'Outstanding Loan ÷ Appraised Value. Typically must be ≤ 65–75%.',
    warningThreshold: 0.05,
  },
  {
    key: 'debt_yield',
    label: 'Debt Yield',
    fullName: 'Debt Yield',
    minField: 'covenant_debt_yield_min',
    actualField: 'covenant_debt_yield_actual',
    type: 'min',
    format: (v) => v ? `${parseFloat(v).toFixed(2)}%` : '—',
    description: 'NOI ÷ Loan Balance. Often required ≥ 8–10%. Preferred by CMBS lenders.',
    warningThreshold: 0.10,
  },
  {
    key: 'interest_coverage',
    label: 'ICR',
    fullName: 'Interest Coverage Ratio',
    minField: 'covenant_interest_coverage_min',
    actualField: 'covenant_interest_coverage_actual',
    type: 'min',
    format: (v) => v ? `${parseFloat(v).toFixed(2)}x` : '—',
    description: 'EBITDA ÷ Interest Expense. Typically must be ≥ 1.50x–2.00x.',
    warningThreshold: 0.10,
  },
  {
    key: 'occupancy',
    label: 'Occupancy',
    fullName: 'Minimum Occupancy',
    minField: 'covenant_occupancy_min',
    actualField: 'covenant_occupancy_actual',
    type: 'min',
    format: (v) => v ? `${parseFloat(v).toFixed(1)}%` : '—',
    description: 'Minimum hotel occupancy rate. Typically ≥ 60–70% for hospitality loans.',
    warningThreshold: 0.05,
  },
  {
    key: 'liquidity',
    label: 'Liquidity',
    fullName: 'Minimum Liquidity',
    minField: 'covenant_liquidity_min',
    actualField: 'covenant_liquidity_actual',
    type: 'min',
    format: (v) => v ? `$${(parseFloat(v)/1e6).toFixed(1)}M` : '—',
    description: 'Minimum unrestricted cash on hand. Protects against short-term cash crunches.',
    warningThreshold: 0.15,
  },
  {
    key: 'net_worth',
    label: 'Net Worth',
    fullName: 'Guarantor Net Worth',
    minField: 'covenant_net_worth_min',
    actualField: 'covenant_net_worth_actual',
    type: 'min',
    format: (v) => v ? `$${(parseFloat(v)/1e6).toFixed(1)}M` : '—',
    description: "Guarantor's minimum net worth. Required in personal guaranty situations.",
    warningThreshold: 0.10,
  },
  {
    key: 'capex_reserve',
    label: 'CapEx Reserve',
    fullName: 'CapEx / FF&E Reserve',
    minField: 'covenant_capex_reserve_min',
    actualField: 'covenant_capex_reserve_actual',
    type: 'min',
    format: (v) => v ? `$${(parseFloat(v)/1e6).toFixed(2)}M` : '—',
    description: 'Minimum furniture, fixture & equipment reserve balance. Typically 4–5% of revenue.',
    warningThreshold: 0.15,
  },
]

function covenantStatus(cov, loan) {
  const min = parseFloat(loan[cov.minField])
  const actual = parseFloat(loan[cov.actualField])
  if (!min || !actual || isNaN(min) || isNaN(actual)) return 'unknown'
  if (cov.type === 'min') {
    if (actual < min) return 'breach'
    if (actual < min * (1 + cov.warningThreshold)) return 'warning'
    return 'ok'
  } else {
    if (actual > min) return 'breach'
    if (actual > min * (1 - cov.warningThreshold)) return 'warning'
    return 'ok'
  }
}

function covenantColor(status) {
  if (status === 'breach') return { color: 'var(--red)', bg: 'var(--redL)', icon: '🚨' }
  if (status === 'warning') return { color: 'var(--amber)', bg: 'var(--amberL)', icon: '⚠' }
  if (status === 'ok') return { color: 'var(--g600)', bg: 'var(--g100)', icon: '✓' }
  return { color: 'var(--gray500)', bg: 'var(--gray100)', icon: '—' }
}

function useDebt() {
  const [debt, setDebt] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const { data } = await supabase.from('asset_debt').select('*, assets(name, market, current_value, noi_trailing)').order('maturity_date', { ascending: true })
    setDebt(data || [])
    setLoading(false)
  }
  useEffect(() => { fetch() }, [])

  const save = async (d) => {
    if (d.id) {
      const { data, error } = await supabase.from('asset_debt').update(d).eq('id', d.id).select('*, assets(name, market, current_value, noi_trailing)').single()
      if (!error) setDebt(prev => prev.map(x => x.id === d.id ? data : x))
      return { data, error }
    } else {
      const { data, error } = await supabase.from('asset_debt').insert(d).select('*, assets(name, market, current_value, noi_trailing)').single()
      if (!error) setDebt(prev => [...prev, data])
      return { data, error }
    }
  }
  const remove = async (id) => { await supabase.from('asset_debt').delete().eq('id', id); setDebt(prev => prev.filter(d => d.id !== id)) }
  return { debt, loading, save, remove }
}

function daysUntilMaturity(date) {
  if (!date) return null
  return Math.ceil((new Date(date) - new Date()) / (1000*60*60*24))
}

function CovenantsPanel({ loan, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  const startEdit = () => {
    const f = {}
    COVENANTS.forEach(c => { f[c.minField] = loan[c.minField] || ''; f[c.actualField] = loan[c.actualField] || '' })
    f.covenant_notes = loan.covenant_notes || ''
    f.covenant_test_date = loan.covenant_test_date || ''
    f.covenant_test_frequency = loan.covenant_test_frequency || 'quarterly'
    setForm(f)
    setEditing(true)
  }

  const handleSave = async () => {
    const updates = {}
    COVENANTS.forEach(c => {
      updates[c.minField] = form[c.minField] ? parseFloat(form[c.minField]) : null
      updates[c.actualField] = form[c.actualField] ? parseFloat(form[c.actualField]) : null
    })
    updates.covenant_notes = form.covenant_notes || null
    updates.covenant_test_date = form.covenant_test_date || null
    updates.covenant_test_frequency = form.covenant_test_frequency
    await onUpdate(loan.id, updates)
    setEditing(false)
  }

  const breachCount = COVENANTS.filter(c => covenantStatus(c, loan) === 'breach').length
  const warningCount = COVENANTS.filter(c => covenantStatus(c, loan) === 'warning').length
  const hasData = COVENANTS.some(c => loan[c.minField] || loan[c.actualField])

  if (!hasData && !editing) {
    return (
      <div style={{ padding: '12px 0' }}>
        <div style={{ fontSize: 12, color: 'var(--gray500)', marginBottom: 10 }}>No covenants tracked yet.</div>
        <button className="btn btn-secondary btn-sm" onClick={startEdit}>+ Add Covenants</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 0' }}>
      {/* Summary badges */}
      {!editing && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
          {breachCount > 0 && <span style={{ background: 'var(--redL)', color: 'var(--red)', fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20 }}>🚨 {breachCount} BREACH{breachCount > 1 ? 'ES' : ''}</span>}
          {warningCount > 0 && <span style={{ background: 'var(--amberL)', color: 'var(--amber)', fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20 }}>⚠ {warningCount} WARNING{warningCount > 1 ? 'S' : ''}</span>}
          {!breachCount && !warningCount && hasData && <span style={{ background: 'var(--g100)', color: 'var(--g600)', fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20 }}>✓ All covenants in compliance</span>}
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={startEdit}>Edit Covenants</button>
        </div>
      )}

      {!editing && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {COVENANTS.filter(c => loan[c.minField] || loan[c.actualField]).map(cov => {
            const status = covenantStatus(cov, loan)
            const { color, bg, icon } = covenantColor(status)
            const min = loan[cov.minField]
            const actual = loan[cov.actualField]
            return (
              <div key={cov.key} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div className="tooltip-wrap">
                    <span style={{ fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '.06em' }}>{cov.label}</span>
                    <div className="tooltip">{cov.fullName}<br/><span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>{cov.description}</span></div>
                  </div>
                  <span style={{ fontSize: 13 }}>{icon}</span>
                </div>
                <div style={{ fontSize: 9, color, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>{cov.type === 'min' ? 'Minimum' : 'Maximum'}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color }}>{actual ? cov.format(actual) : '—'}</div>
                  <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)' }}>req. {cov.format(min)}</div>
                </div>
                {status === 'breach' && <div style={{ fontSize: 10, color, marginTop: 4, fontWeight: 500 }}>⚠ COVENANT BREACH — immediate action required</div>}
                {status === 'warning' && <div style={{ fontSize: 10, color, marginTop: 4 }}>Approaching threshold — monitor closely</div>}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--gray500)', marginBottom: 14, lineHeight: 1.5 }}>
            Enter the required threshold (what the lender requires) and your current actual value. SOUL will automatically flag breaches and warnings.
          </div>
          {COVENANTS.map(cov => (
            <div key={cov.key} style={{ marginBottom: 14, padding: '12px 14px', background: 'var(--gray50)', borderRadius: 8, border: '1px solid var(--gray100)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--g900)', marginBottom: 2 }}>{cov.fullName}</div>
              <div style={{ fontSize: 10, color: 'var(--gray500)', marginBottom: 8 }}>{cov.description}</div>
              <div className="form-grid-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{cov.type === 'min' ? 'Required Minimum' : 'Max Allowed'}</label>
                  <input className="form-input" type="number" step="0.01" value={form[cov.minField]} onChange={e => setForm(f => ({ ...f, [cov.minField]: e.target.value }))} placeholder={cov.type === 'min' ? 'e.g. 1.25' : 'e.g. 70'} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Current Actual</label>
                  <input className="form-input" type="number" step="0.01" value={form[cov.actualField]} onChange={e => setForm(f => ({ ...f, [cov.actualField]: e.target.value }))} placeholder="Current value" />
                </div>
              </div>
            </div>
          ))}
          <div className="form-grid-2" style={{ marginBottom: 12 }}>
            <div className="form-group"><label className="form-label">Test Frequency</label>
              <select className="form-select" value={form.covenant_test_frequency} onChange={e => setForm(f => ({ ...f, covenant_test_frequency: e.target.value }))}>
                {['monthly','quarterly','semi-annual','annual'].map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Last Test Date</label>
              <input className="form-input" type="date" value={form.covenant_test_date} onChange={e => setForm(f => ({ ...f, covenant_test_date: e.target.value }))} />
            </div>
          </div>
          <div className="form-group"><label className="form-label">Covenant Notes</label>
            <textarea className="form-input" rows={2} value={form.covenant_notes} onChange={e => setForm(f => ({ ...f, covenant_notes: e.target.value }))} style={{ resize: 'vertical' }} placeholder="Any waiver agreements, cure periods, or special provisions..." />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save Covenants</button>
          </div>
        </div>
      )}
    </div>
  )
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
      <div className="modal" style={{ width: 560 }}>
        <div className="modal-header"><span className="modal-title">{debt ? 'Edit Loan' : 'Add Loan'}</span><button className="modal-close" onClick={onClose}>✕</button></div>
        {error && <div style={{ background:'var(--redL)',color:'var(--red)',padding:'8px 12px',borderRadius:7,fontSize:12,marginBottom:12 }}>{error}</div>}
        <div className="form-group"><label className="form-label">Asset *</label>
          <select className="form-select" value={form.asset_id} onChange={e => set('asset_id', e.target.value)}>
            {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Lender *</label><input className="form-input" value={form.lender} onChange={e => set('lender', e.target.value)} placeholder="Wells Fargo"/></div>
          <div className="form-group"><label className="form-label">Loan Type</label>
            <select className="form-select" value={form.loan_type} onChange={e => set('loan_type', e.target.value)}>
              {LOAN_TYPES.map(t => <option key={t} value={t}>{t.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
            </select>
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Original Balance ($)</label><input className="form-input" type="number" value={form.original_balance} onChange={e => set('original_balance', e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Current Balance ($)</label><input className="form-input" type="number" value={form.current_balance} onChange={e => set('current_balance', e.target.value)}/></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Interest Rate (%)</label><input className="form-input" type="number" step="0.01" value={form.interest_rate} onChange={e => set('interest_rate', e.target.value)} placeholder="5.75"/></div>
          <div className="form-group"><label className="form-label">Rate Type</label>
            <select className="form-select" value={form.rate_type} onChange={e => set('rate_type', e.target.value)}>
              {RATE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Origination Date</label><input className="form-input" type="date" value={form.origination_date} onChange={e => set('origination_date', e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Maturity Date</label><input className="form-input" type="date" value={form.maturity_date} onChange={e => set('maturity_date', e.target.value)}/></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">LTV (%)</label><input className="form-input" type="number" step="0.1" value={form.ltv} onChange={e => set('ltv', e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Annual Debt Service ($)</label><input className="form-input" type="number" value={form.debt_service_annual} onChange={e => set('debt_service_annual', e.target.value)}/></div>
        </div>
        <div className="form-group"><label className="form-label">Extension Options</label><input className="form-input" value={form.extension_options} onChange={e => set('extension_options', e.target.value)} placeholder="2 x 1-year extensions"/></div>
        <div className="form-group">
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,fontWeight:500,color:'var(--gray700)',cursor:'pointer'}}>
            <input type="checkbox" checked={form.prepayment_penalty} onChange={e => set('prepayment_penalty', e.target.checked)}/>
            Prepayment penalty applies
          </label>
        </div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} style={{resize:'vertical'}}/></div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading?'Saving...':debt?'Save Changes':'Add Loan'}</button>
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
  const [expandedId, setExpandedId] = useState(null)

  const filtered = filterAsset === 'all' ? debt : debt.filter(d => d.asset_id === filterAsset)
  const totalDebt = debt.reduce((s,d) => s+(d.current_balance||0), 0)
  const totalDS = debt.reduce((s,d) => s+(d.debt_service_annual||0), 0)
  const avgRate = debt.filter(d=>d.interest_rate).length
    ? (debt.filter(d=>d.interest_rate).reduce((s,d)=>s+d.interest_rate,0)/debt.filter(d=>d.interest_rate).length).toFixed(2) : null

  const maturingIn6 = debt.filter(d => { const days=daysUntilMaturity(d.maturity_date); return days!==null&&days>=0&&days<=180 })
  const maturingIn12 = debt.filter(d => { const days=daysUntilMaturity(d.maturity_date); return days!==null&&days>=0&&days<=365 })

  // Count covenant breaches across all loans
  const allBreaches = debt.flatMap(loan => COVENANTS.filter(c => covenantStatus(c, loan) === 'breach').map(c => ({ loan, cov: c })))
  const allWarnings = debt.flatMap(loan => COVENANTS.filter(c => covenantStatus(c, loan) === 'warning').map(c => ({ loan, cov: c })))

  const handleCovenantUpdate = async (loanId, updates) => {
    const { error } = await supabase.from('asset_debt').update(updates).eq('id', loanId)
    if (!error) {
      const { data } = await supabase.from('asset_debt').select('*, assets(name, market, current_value, noi_trailing)').eq('id', loanId).single()
      // Trigger refetch by updating local state via save
      if (data) save({ ...data })
    }
  }

  if (loading) return <div className="loading">Loading debt tracker...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Debt & Capital Stack</h1>
        <p>Track loans, maturities, covenants, and debt service across your portfolio</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Debt Outstanding</div><div className="kpi-value">{fmtM(totalDebt)}</div><div className="kpi-change">{debt.length} loans</div></div>
        <div className="kpi-card"><div className="kpi-label">Annual Debt Service</div><div className="kpi-value">{fmtM(totalDS)}</div><div className="kpi-change">Portfolio total</div></div>
        <div className="kpi-card"><div className="kpi-label">Avg. Interest Rate</div><div className="kpi-value">{avgRate?`${avgRate}%`:'—'}</div><div className="kpi-change">Across all loans</div></div>
        <div className="kpi-card">
          <div className="kpi-label">Covenant Status</div>
          <div className="kpi-value" style={{color:allBreaches.length>0?'var(--red)':allWarnings.length>0?'var(--amber)':'var(--g600)'}}>{allBreaches.length>0?`${allBreaches.length} Breach${allBreaches.length>1?'es':''}`:allWarnings.length>0?`${allWarnings.length} Warning${allWarnings.length>1?'s':''}`:debt.length>0?'All Clear':'—'}</div>
          <div className={`kpi-change${allBreaches.length>0?' down':''}`}>{allBreaches.length>0?'Immediate action required':allWarnings.length>0?'Monitor closely':'No violations'}</div>
        </div>
      </div>

      {/* Covenant breach/warning alerts */}
      {(allBreaches.length > 0 || allWarnings.length > 0 || maturingIn6.length > 0) && (
        <div style={{marginBottom:16,display:'flex',flexDirection:'column',gap:8}}>
          {allBreaches.map(({loan, cov}) => (
            <div key={`${loan.id}-${cov.key}`} style={{background:'var(--redL)',border:'1px solid #f5c6c2',borderRadius:10,padding:'12px 16px',fontSize:12}}>
              <strong style={{color:'var(--red)'}}>🚨 COVENANT BREACH</strong>
              <span style={{color:'var(--red)',marginLeft:8}}>{loan.assets?.name} — {cov.fullName}: {cov.format(loan[cov.actualField])} vs required {cov.type==='min'?'min':'max'} of {cov.format(loan[cov.minField])}</span>
            </div>
          ))}
          {allWarnings.map(({loan, cov}) => (
            <div key={`${loan.id}-${cov.key}`} style={{background:'var(--amberL)',border:'1px solid #ffe082',borderRadius:10,padding:'12px 16px',fontSize:12}}>
              <strong style={{color:'var(--amber)'}}>⚠ Covenant Warning</strong>
              <span style={{color:'#7a5500',marginLeft:8}}>{loan.assets?.name} — {cov.fullName}: {cov.format(loan[cov.actualField])} approaching {cov.type==='min'?'minimum':'maximum'} of {cov.format(loan[cov.minField])}</span>
            </div>
          ))}
          {maturingIn6.map(d => (
            <div key={d.id} style={{background:'var(--redL)',border:'1px solid #f5c6c2',borderRadius:10,padding:'12px 16px',fontSize:12}}>
              <strong style={{color:'var(--red)'}}>⚠ Loan Maturing Soon</strong>
              <span style={{color:'var(--red)',marginLeft:8}}>{d.assets?.name} — {d.lender}: {fmtM(d.current_balance)} matures {new Date(d.maturity_date).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} ({daysUntilMaturity(d.maturity_date)} days)</span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div style={{display:'flex',alignItems:'center',gap:12,flex:1,flexWrap:'wrap'}}>
            <span className="card-title">Loan register</span>
            <select className="form-select" style={{width:'auto',fontSize:11}} value={filterAsset} onChange={e=>setFilterAsset(e.target.value)}>
              <option value="all">All assets</option>
              {assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-sm" onClick={()=>setModal({})}>+ Add Loan</button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏦</div>
            <div className="empty-state-title">No loans tracked yet</div>
            <div className="empty-state-desc">Add your portfolio debt to track maturities, covenants, and debt service.</div>
            <button className="btn btn-primary" onClick={()=>setModal({})}>+ Add Loan</button>
          </div>
        ) : (
          <div>
            {filtered.map(d => {
              const days = daysUntilMaturity(d.maturity_date)
              const urgent = days !== null && days <= 180
              const warning = days !== null && days <= 365 && days > 180
              const breachCount = COVENANTS.filter(c => covenantStatus(c, d) === 'breach').length
              const warnCount = COVENANTS.filter(c => covenantStatus(c, d) === 'warning').length
              const isExpanded = expandedId === d.id

              return (
                <div key={d.id} style={{borderBottom:'1px solid var(--gray100)'}}>
                  {/* Main row */}
                  <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',cursor:'pointer'}} onClick={() => setExpandedId(isExpanded?null:d.id)}>
                    <div style={{flex:1.5}}>
                      <div style={{fontSize:12.5,fontWeight:500,color:'var(--g900)'}}>{d.assets?.name || '—'}</div>
                      <div style={{fontSize:10,color:'var(--gray500)'}}>{d.assets?.market}</div>
                    </div>
                    <div style={{flex:1,fontSize:12,color:'var(--gray700)'}}>{d.lender}</div>
                    <div style={{flex:0.7}}><span style={{fontSize:10,background:'var(--g50)',color:'var(--g700)',padding:'2px 7px',borderRadius:10}}>{d.loan_type?.replace('_',' ')}</span></div>
                    <div style={{flex:0.8,fontSize:12,fontWeight:500,color:'var(--g900)'}}>{fmtM(d.current_balance)}</div>
                    <div style={{flex:0.6,fontSize:12}}>{fmtPct(d.interest_rate)}<span style={{fontSize:9,color:'var(--gray500)',marginLeft:3}}>{d.rate_type}</span></div>
                    <div style={{flex:0.8,fontSize:12,color:urgent?'var(--red)':warning?'var(--amber)':'var(--gray700)'}}>
                      {d.maturity_date ? new Date(d.maturity_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}) : '—'}
                      {days !== null && <div style={{fontSize:9,fontWeight:days<=365?500:400}}>{days<0?'Expired':`${days}d`}</div>}
                    </div>
                    <div style={{flex:0.8}}>
                      {breachCount > 0 && <span style={{fontSize:10,background:'var(--redL)',color:'var(--red)',padding:'2px 7px',borderRadius:10,fontWeight:500}}>🚨 {breachCount} breach</span>}
                      {!breachCount && warnCount > 0 && <span style={{fontSize:10,background:'var(--amberL)',color:'var(--amber)',padding:'2px 7px',borderRadius:10}}>⚠ {warnCount} warn</span>}
                      {!breachCount && !warnCount && COVENANTS.some(c=>d[c.minField]) && <span style={{fontSize:10,background:'var(--g100)',color:'var(--g600)',padding:'2px 7px',borderRadius:10}}>✓ OK</span>}
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <button className="card-action" onClick={e=>{e.stopPropagation();setModal(d)}}>Edit</button>
                      <button className="card-action" style={{color:'var(--red)'}} onClick={e=>{e.stopPropagation();setDeleteId(d.id)}}>Del</button>
                      <span style={{fontSize:11,color:'var(--gray400)'}}>{isExpanded?'▲':'▼'}</span>
                    </div>
                  </div>

                  {/* Expanded covenants panel */}
                  {isExpanded && (
                    <div style={{paddingLeft:16,paddingBottom:16,borderTop:'1px dashed var(--gray100)'}}>
                      <div style={{fontSize:11,fontWeight:500,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--gray500)',marginTop:12,marginBottom:8}}>Covenant Tracking</div>
                      <CovenantsPanel loan={d} onUpdate={handleCovenantUpdate}/>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Covenant reference guide */}
      <div className="card">
        <div className="card-header"><span className="card-title">Covenant reference guide</span></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:10}}>
          {COVENANTS.map(cov => (
            <div key={cov.key} style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:11,fontWeight:600,color:'var(--g900)',marginBottom:3}}>{cov.fullName}</div>
              <div style={{fontSize:10,color:'var(--gray500)',lineHeight:1.5}}>{cov.description}</div>
            </div>
          ))}
        </div>
      </div>

      {modal !== null && <DebtModal debt={modal?.id?modal:null} assets={assets} onClose={()=>setModal(null)} onSave={save}/>}
      {deleteId && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDeleteId(null)}>
          <div className="modal" style={{maxWidth:400}}>
            <div className="modal-header"><span className="modal-title">Delete Loan</span><button className="modal-close" onClick={()=>setDeleteId(null)}>✕</button></div>
            <p style={{fontSize:13,color:'var(--gray700)',marginBottom:20,lineHeight:1.6}}>Delete this loan record? This cannot be undone.</p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn btn-secondary" onClick={()=>setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={()=>{remove(deleteId);setDeleteId(null)}}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
