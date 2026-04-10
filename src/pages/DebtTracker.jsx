import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

const fmtM = (n) => n ? `$${(n/1e6).toFixed(2)}M` : '—'
const LOAN_TYPES = ['senior','mezzanine','preferred_equity','construction','bridge','permanent','heloc']
const RATE_TYPES = ['fixed','floating','hybrid']

const COVENANTS = [
  { key:'dscr', label:'DSCR', fullName:'Debt Service Coverage Ratio', minField:'covenant_dscr_min', actualField:'covenant_dscr_actual', type:'min', format:v=>v?`${parseFloat(v).toFixed(2)}x`:'—', placeholder:'1.25', description:'NOI ÷ Debt Service. Typically ≥ 1.20x–1.35x.', threshold:0.10 },
  { key:'ltv', label:'LTV', fullName:'Loan-to-Value Ratio', minField:'covenant_ltv_max', actualField:'covenant_ltv_actual', type:'max', format:v=>v?`${parseFloat(v).toFixed(1)}%`:'—', placeholder:'70', description:'Loan ÷ Appraised Value. Typically ≤ 65–75%.', threshold:0.05 },
  { key:'debt_yield', label:'Debt Yield', fullName:'Debt Yield', minField:'covenant_debt_yield_min', actualField:'covenant_debt_yield_actual', type:'min', format:v=>v?`${parseFloat(v).toFixed(2)}%`:'—', placeholder:'8.0', description:'NOI ÷ Loan Balance. Typically ≥ 8–10%.', threshold:0.10 },
  { key:'icr', label:'ICR', fullName:'Interest Coverage Ratio', minField:'covenant_interest_coverage_min', actualField:'covenant_interest_coverage_actual', type:'min', format:v=>v?`${parseFloat(v).toFixed(2)}x`:'—', placeholder:'1.50', description:'EBITDA ÷ Interest Expense. Typically ≥ 1.5x–2.0x.', threshold:0.10 },
  { key:'occ', label:'Occupancy', fullName:'Minimum Occupancy', minField:'covenant_occupancy_min', actualField:'covenant_occupancy_actual', type:'min', format:v=>v?`${parseFloat(v).toFixed(1)}%`:'—', placeholder:'60', description:'Minimum occupancy rate required by lender.', threshold:0.05 },
  { key:'liquidity', label:'Liquidity', fullName:'Minimum Liquidity', minField:'covenant_liquidity_min', actualField:'covenant_liquidity_actual', type:'min', format:v=>v?`$${(parseFloat(v)/1e6).toFixed(1)}M`:'—', placeholder:'2000000', description:'Minimum unrestricted cash on hand ($).', threshold:0.15 },
  { key:'net_worth', label:'Net Worth', fullName:'Guarantor Net Worth', minField:'covenant_net_worth_min', actualField:'covenant_net_worth_actual', type:'min', format:v=>v?`$${(parseFloat(v)/1e6).toFixed(1)}M`:'—', placeholder:'10000000', description:'Minimum guarantor net worth ($).', threshold:0.10 },
  { key:'capex', label:'CapEx Reserve', fullName:'CapEx / FF&E Reserve', minField:'covenant_capex_reserve_min', actualField:'covenant_capex_reserve_actual', type:'min', format:v=>v?`$${(parseFloat(v)/1e6).toFixed(2)}M`:'—', placeholder:'500000', description:'Minimum FF&E reserve balance ($). Typically 4–5% of revenue.', threshold:0.15 },
]

function covenantStatus(cov, loan) {
  const min = parseFloat(loan[cov.minField])
  const actual = parseFloat(loan[cov.actualField])
  if (!min||!actual||isNaN(min)||isNaN(actual)) return 'unknown'
  if (cov.type==='min') { if(actual<min)return 'breach'; if(actual<min*(1+cov.threshold))return 'warning'; return 'ok' }
  else { if(actual>min)return 'breach'; if(actual>min*(1-cov.threshold))return 'warning'; return 'ok' }
}

function covenantColor(status) {
  if(status==='breach') return { color:'var(--red)', bg:'var(--redL)', icon:'🚨' }
  if(status==='warning') return { color:'var(--amber)', bg:'var(--amberL)', icon:'⚠' }
  if(status==='ok') return { color:'var(--g600)', bg:'var(--g100)', icon:'✓' }
  return { color:'var(--gray500)', bg:'var(--gray100)', icon:'—' }
}

// Compute covenant actuals from T12 financials for a given loan
function computedCovenantActuals(loan, t12ByAsset) {
  const t12 = t12ByAsset[loan.asset_id]
  if (!t12) return {}
  const out = {}
  // DSCR = T12 NOI / annual debt service
  if (t12.noi && loan.debt_service_annual)
    out.covenant_dscr_actual = parseFloat((t12.noi / parseFloat(loan.debt_service_annual)).toFixed(2))
  // Occupancy = T12 avg occupancy
  if (t12.occ)
    out.covenant_occupancy_actual = parseFloat(t12.occ.toFixed(1))
  // Interest Coverage = T12 NOI / (rate% * balance)
  if (t12.noi && loan.interest_rate && loan.current_balance) {
    const interest = (parseFloat(loan.interest_rate) / 100) * parseFloat(loan.current_balance)
    if (interest > 0) out.covenant_interest_coverage_actual = parseFloat((t12.noi / interest).toFixed(2))
  }
  // Debt Yield = T12 NOI / loan balance * 100
  if (t12.noi && loan.current_balance)
    out.covenant_debt_yield_actual = parseFloat(((t12.noi / parseFloat(loan.current_balance)) * 100).toFixed(2))
  return out
}

function useDebt() {
  const [debt, setDebt] = useState([])
  const [t12ByAsset, setT12ByAsset] = useState({})
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const [{ data: debtData }, { data: finData }] = await Promise.all([
      supabase.from('asset_debt').select('*').order('maturity_date',{ascending:true}),
      supabase.from('financials').select('asset_id,noi,occupancy,adr,period_year,period_month').order('period_year',{ascending:false}).order('period_month',{ascending:false}),
    ])
    setDebt(debtData||[])
    // Build T12 map: asset_id → { noi, occ, adr }
    const byAsset = {}
    for (const row of (finData||[])) {
      if (!byAsset[row.asset_id]) byAsset[row.asset_id] = []
      if (byAsset[row.asset_id].length < 12) byAsset[row.asset_id].push(row)
    }
    const t12 = {}
    for (const [assetId, rows] of Object.entries(byAsset)) {
      if (rows.length === 0) continue
      t12[assetId] = {
        noi: rows.reduce((s,r) => s + (parseFloat(r.noi)||0), 0),
        occ: rows.reduce((s,r) => s + (parseFloat(r.occupancy)||0), 0) / rows.length,
        adr: rows.reduce((s,r) => s + (parseFloat(r.adr)||0), 0) / rows.length,
      }
    }
    setT12ByAsset(t12)
    setLoading(false)
  }
  useEffect(()=>{fetch()},[])

  const save = async (d) => {
    if (d.id) {
      const { data, error } = await supabase.from('asset_debt').update(d).eq('id',d.id).select('*').single()
      if (!error) setDebt(prev=>prev.map(x=>x.id===d.id?data:x))
      return { data, error }
    } else {
      const { data, error } = await supabase.from('asset_debt').insert(d).select('*').single()
      if (!error) setDebt(prev=>[...prev,data])
      return { data, error }
    }
  }
  const remove = async (id) => { await supabase.from('asset_debt').delete().eq('id',id); setDebt(prev=>prev.filter(d=>d.id!==id)) }
  return { debt, t12ByAsset, loading, save, remove, refetch: fetch }
}

function daysUntilMaturity(date) {
  if (!date) return null
  return Math.ceil((new Date(date)-new Date())/(1000*60*60*24))
}

// FIX: Full loan modal WITH covenant fields
function DebtModal({ debt, assets, onClose, onSave }) {
  const [tab, setTab] = useState('loan')
  const blankCovs = {}
  COVENANTS.forEach(c => { blankCovs[c.minField]=''; blankCovs[c.actualField]='' })

  const [form, setForm] = useState(debt ? { ...debt } : {
    asset_id:assets[0]?.id||'', lender:'', loan_type:'senior', rate_type:'fixed',
    original_balance:'', current_balance:'', interest_rate:'', ltv:'',
    origination_date:'', maturity_date:'', debt_service_annual:'', extension_options:'',
    prepayment_penalty:false, assumable:false, recourse:false, prepayment_structure:'none',
    notes:'', covenant_test_frequency:'quarterly', covenant_test_date:'', covenant_notes:'',
    ...blankCovs
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const handleSubmit = async () => {
    if (!form.lender.trim()) { setError('Lender is required'); return }
    if (!form.asset_id) { setError('Asset is required'); return }
    setLoading(true)
    // Strip joined/non-column fields before sending to Supabase
    const { assets: _assets, created_at: _ca, ...formClean } = form
    const payload = {
      ...formClean,
      original_balance:form.original_balance?parseFloat(form.original_balance):null,
      current_balance:form.current_balance?parseFloat(form.current_balance):null,
      interest_rate:form.interest_rate?parseFloat(form.interest_rate):null,
      ltv:form.ltv?parseFloat(form.ltv):null,
      debt_service_annual:form.debt_service_annual?parseFloat(form.debt_service_annual):null,
      origination_date:form.origination_date||null,
      maturity_date:form.maturity_date||null,
      covenant_test_date:form.covenant_test_date||null,
    }
    // Parse covenant numerics
    COVENANTS.forEach(c => {
      payload[c.minField] = form[c.minField]?parseFloat(form[c.minField]):null
      payload[c.actualField] = form[c.actualField]?parseFloat(form[c.actualField]):null
    })
    const { error } = await onSave(payload)
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onClose()
  }

  const tabStyle = (t) => ({ fontSize:12,padding:'5px 14px',borderRadius:20,border:'1px solid',cursor:'pointer',borderColor:tab===t?'var(--g600)':'var(--gray200)',background:tab===t?'var(--g700)':'var(--white)',color:tab===t?'var(--white)':'var(--gray700)' })

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:580}}>
        <div className="modal-header"><span className="modal-title">{debt?'Edit Loan':'Add Loan'}</span><button className="modal-close" onClick={onClose}>✕</button></div>
        {error&&<div style={{background:'var(--redL)',color:'var(--red)',padding:'8px 12px',borderRadius:7,fontSize:12,marginBottom:12}}>{error}</div>}

        <div style={{display:'flex',gap:6,marginBottom:16}}>
          {[['loan','Loan Details'],['covenants','Covenants']].map(([t,l])=>(
            <button key={t} style={tabStyle(t)} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </div>

        {/* LOAN DETAILS TAB */}
        {tab==='loan'&&(<>
          <div className="form-group"><label className="form-label">Asset *</label>
            <select className="form-select" value={form.asset_id} onChange={e=>set('asset_id',e.target.value)}>
              {assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Lender *</label><input className="form-input" value={form.lender} onChange={e=>set('lender',e.target.value)} placeholder="Wells Fargo, PGIM, etc."/></div>
            <div className="form-group"><label className="form-label">Loan Type</label>
              <select className="form-select" value={form.loan_type} onChange={e=>set('loan_type',e.target.value)}>
                {LOAN_TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Original Balance ($)</label><input className="form-input" type="number" value={form.original_balance} onChange={e=>set('original_balance',e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Current Balance ($)</label><input className="form-input" type="number" value={form.current_balance} onChange={e=>set('current_balance',e.target.value)}/></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Interest Rate (%)</label><input className="form-input" type="number" step="0.01" value={form.interest_rate} onChange={e=>set('interest_rate',e.target.value)} placeholder="5.75"/></div>
            <div className="form-group"><label className="form-label">Rate Type</label>
              <select className="form-select" value={form.rate_type} onChange={e=>set('rate_type',e.target.value)}>
                {RATE_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Origination Date</label><input className="form-input" type="date" value={form.origination_date} onChange={e=>set('origination_date',e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Maturity Date</label><input className="form-input" type="date" value={form.maturity_date} onChange={e=>set('maturity_date',e.target.value)}/></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">LTV (%)</label><input className="form-input" type="number" step="0.1" value={form.ltv} onChange={e=>set('ltv',e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Annual Debt Service ($)</label><input className="form-input" type="number" value={form.debt_service_annual} onChange={e=>set('debt_service_annual',e.target.value)}/></div>
          </div>
          <div className="form-group"><label className="form-label">Extension Options</label><input className="form-input" value={form.extension_options} onChange={e=>set('extension_options',e.target.value)} placeholder="2 × 1-year extensions"/></div>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer',marginBottom:12}}>
            <input type="checkbox" checked={form.prepayment_penalty} onChange={e=>set('prepayment_penalty',e.target.checked)}/>Prepayment penalty applies
          </label>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer',marginBottom:12}}>
            <input type="checkbox" checked={form.assumable||false} onChange={e=>set('assumable',e.target.checked)}/>Loan is assumable
          </label>
          <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer',marginBottom:12}}>
            <input type="checkbox" checked={form.recourse||false} onChange={e=>set('recourse',e.target.checked)}/>Personal recourse
          </label>
          <div className="form-group" style={{marginBottom:12}}>
            <label className="form-label">Prepayment Structure</label>
            <select className="form-select" value={form.prepayment_structure||'none'} onChange={e=>set('prepayment_structure',e.target.value)}>
              {['none','defeasance','yield_maintenance','step_down','lockout'].map(v=><option key={v} value={v}>{v==='none'?'None':v==='yield_maintenance'?'Yield Maintenance':v==='step_down'?'Step-Down':v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} style={{resize:'vertical'}}/></div>
        </>)}

        {/* COVENANTS TAB — FIX: This is now accessible in the modal */}
        {tab==='covenants'&&(<>
          <div style={{background:'var(--g50)',border:'1px solid var(--g100)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'var(--g700)',marginBottom:14}}>
            Enter the lender-required threshold and your current actual value for each covenant. SOUL will flag breaches (red) and warnings within 10% of the limit (amber).
          </div>
          {COVENANTS.map(cov=>(
            <div key={cov.key} style={{marginBottom:12,padding:'10px 14px',background:'var(--gray50)',borderRadius:8,border:'1px solid var(--gray100)'}}>
              <div style={{fontSize:11,fontWeight:600,color:'var(--g900)',marginBottom:2}}>{cov.fullName}</div>
              <div style={{fontSize:10,color:'var(--gray500)',marginBottom:8}}>{cov.description}</div>
              <div className="form-grid-2">
                <div className="form-group" style={{marginBottom:0}}>
                  <label className="form-label">{cov.type==='min'?'Required Minimum':'Max Allowed'}</label>
                  <input className="form-input" type="number" step="0.01" value={form[cov.minField]||''} onChange={e=>set(cov.minField,e.target.value)} placeholder={cov.placeholder}/>
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                  <label className="form-label">Current Actual</label>
                  <input className="form-input" type="number" step="0.01" value={form[cov.actualField]||''} onChange={e=>set(cov.actualField,e.target.value)} placeholder="Enter actual value"/>
                </div>
              </div>
            </div>
          ))}
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Test Frequency</label>
              <select className="form-select" value={form.covenant_test_frequency} onChange={e=>set('covenant_test_frequency',e.target.value)}>
                {['monthly','quarterly','semi-annual','annual'].map(v=><option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Last Test Date</label><input className="form-input" type="date" value={form.covenant_test_date||''} onChange={e=>set('covenant_test_date',e.target.value)}/></div>
          </div>
          <div className="form-group"><label className="form-label">Covenant Notes</label><textarea className="form-input" rows={2} value={form.covenant_notes||''} onChange={e=>set('covenant_notes',e.target.value)} style={{resize:'vertical'}} placeholder="Waivers, cure periods, special provisions..."/></div>
        </>)}

        <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading?'Saving...':debt?'Save Changes':'Add Loan'}</button>
        </div>
      </div>
    </div>
  )
}

export default function DebtTracker() {
  const { debt, t12ByAsset, loading, save, remove } = useDebt()
  const { assets } = useAssets()
  const [modal, setModal] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [filterAsset, setFilterAsset] = useState('all')
  const [expandedId, setExpandedId] = useState(null)

  const filtered = filterAsset==='all' ? debt : debt.filter(d=>d.asset_id===filterAsset)
  const totalDebt = debt.reduce((s,d)=>s+(parseFloat(d.current_balance)||0),0)
  const totalDS = debt.reduce((s,d)=>s+(parseFloat(d.debt_service_annual)||0),0)
  const avgRate = debt.filter(d=>d.interest_rate).length ? (debt.filter(d=>d.interest_rate).reduce((s,d)=>s+parseFloat(d.interest_rate),0)/debt.filter(d=>d.interest_rate).length).toFixed(2) : null
  // Merge computed actuals (from ProfitSword T12) over stored actuals for each loan
  const loanWithActuals = (loan) => ({ ...loan, ...computedCovenantActuals(loan, t12ByAsset) })
  const allBreaches = debt.flatMap(loan=>COVENANTS.filter(c=>covenantStatus(c,loanWithActuals(loan))==='breach').map(c=>({loan:loanWithActuals(loan),cov:c})))
  const allWarnings = debt.flatMap(loan=>COVENANTS.filter(c=>covenantStatus(c,loanWithActuals(loan))==='warning').map(c=>({loan:loanWithActuals(loan),cov:c})))

  if (loading) return <div className="loading">Loading debt tracker...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Debt & Capital Stack</h1>
        <p>Track loans, maturities, and covenant compliance across the portfolio</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Debt Outstanding</div><div className="kpi-value">{fmtM(totalDebt)}</div><div className="kpi-change">{debt.length} loans</div></div>
        <div className="kpi-card"><div className="kpi-label">Annual Debt Service</div><div className="kpi-value">{fmtM(totalDS)}</div></div>
        <div className="kpi-card"><div className="kpi-label">Avg. Interest Rate</div><div className="kpi-value">{avgRate?`${avgRate}%`:'—'}</div></div>
        <div className="kpi-card">
          <div className="kpi-label">Covenant Status</div>
          <div className="kpi-value" style={{color:allBreaches.length>0?'var(--red)':allWarnings.length>0?'var(--amber)':'var(--g600)'}}>
            {allBreaches.length>0?`${allBreaches.length} Breach${allBreaches.length>1?'es':''}`:allWarnings.length>0?`${allWarnings.length} Warning${allWarnings.length>1?'s':''}`:debt.length>0?'All Clear':'—'}
          </div>
          <div className="kpi-change">{allBreaches.length>0?'Immediate action required':allWarnings.length>0?'Monitor closely':'No violations'}</div>
        </div>
      </div>

      {/* Covenant alerts */}
      {allBreaches.map(({loan,cov})=>(
        <div key={`${loan.id}-${cov.key}`} style={{background:'var(--redL)',border:'1px solid #f5c6c2',borderRadius:10,padding:'12px 16px',fontSize:12,marginBottom:8}}>
          <strong style={{color:'var(--red)'}}>🚨 COVENANT BREACH</strong>
          <span style={{color:'var(--red)',marginLeft:8}}>{assets.find(a=>a.id===loan.asset_id)?.name} — {cov.fullName}: {cov.format(loan[cov.actualField])} vs required {cov.type==='min'?'min':'max'} of {cov.format(loan[cov.minField])}</span>
        </div>
      ))}
      {allWarnings.map(({loan,cov})=>(
        <div key={`${loan.id}-${cov.key}`} style={{background:'var(--amberL)',border:'1px solid #ffe082',borderRadius:10,padding:'12px 16px',fontSize:12,marginBottom:8}}>
          <strong style={{color:'var(--amber)'}}>⚠ Warning</strong>
          <span style={{color:'#7a5500',marginLeft:8}}>{assets.find(a=>a.id===loan.asset_id)?.name} — {cov.fullName}: {cov.format(loan[cov.actualField])} approaching limit of {cov.format(loan[cov.minField])}</span>
        </div>
      ))}

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

        {filtered.length===0?(
          <div className="empty-state">
            <div className="empty-state-icon">🏦</div>
            <div className="empty-state-title">No loans tracked yet</div>
            <div className="empty-state-desc">Add your portfolio debt to track maturities and covenant compliance.</div>
            <button className="btn btn-primary" onClick={()=>setModal({})}>+ Add Loan</button>
          </div>
        ):(
          <div>
            {filtered.map(d=>{
              const dl=loanWithActuals(d)
              const days=daysUntilMaturity(d.maturity_date)
              const urgent=days!==null&&days<=180
              const warn=days!==null&&days<=365&&days>180
              const breachCount=COVENANTS.filter(c=>covenantStatus(c,dl)==='breach').length
              const warnCount=COVENANTS.filter(c=>covenantStatus(c,dl)==='warning').length
              const isExpanded=expandedId===d.id
              const hasT12=!!t12ByAsset[d.asset_id]

              return (
                <div key={d.id} style={{borderBottom:'1px solid var(--gray100)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0',cursor:'pointer'}} onClick={()=>setExpandedId(isExpanded?null:d.id)}>
                    <div style={{flex:1.5}}>
                      <div style={{fontSize:12.5,fontWeight:500,color:'var(--g900)'}}>{assets.find(a=>a.id===d.asset_id)?.name||'—'}</div>
                      <div style={{fontSize:10,color:'var(--gray500)'}}>{assets.find(a=>a.id===d.asset_id)?.market}</div>
                    </div>
                    <div style={{flex:1,fontSize:12,color:'var(--gray700)'}}>{d.lender}</div>
                    <div style={{flex:0.7}}><span style={{fontSize:10,background:'var(--g50)',color:'var(--g700)',padding:'2px 7px',borderRadius:10}}>{d.loan_type?.replace('_',' ')}</span></div>
                    <div style={{flex:0.8,fontSize:12,fontWeight:500}}>{fmtM(d.current_balance)}</div>
                    <div style={{flex:0.6,fontSize:12}}>{d.interest_rate?`${d.interest_rate}%`:'—'} <span style={{fontSize:9,color:'var(--gray500)'}}>{d.rate_type}</span></div>
                    <div style={{flex:0.8,fontSize:12,color:urgent?'var(--red)':warn?'var(--amber)':'var(--gray700)'}}>
                      {d.maturity_date?new Date(d.maturity_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'}):'—'}
                      {days!==null&&<div style={{fontSize:9,fontWeight:days<=365?500:400}}>{days<0?'Expired':`${days}d`}</div>}
                    </div>
                    <div style={{flex:0.8}}>
                      {breachCount>0&&<span style={{fontSize:10,background:'var(--redL)',color:'var(--red)',padding:'2px 7px',borderRadius:10,fontWeight:500}}>🚨 {breachCount} breach</span>}
                      {!breachCount&&warnCount>0&&<span style={{fontSize:10,background:'var(--amberL)',color:'var(--amber)',padding:'2px 7px',borderRadius:10}}>⚠ {warnCount}</span>}
                      {!breachCount&&!warnCount&&COVENANTS.some(c=>d[c.minField])&&<span style={{fontSize:10,background:'var(--g100)',color:'var(--g600)',padding:'2px 7px',borderRadius:10}}>✓ OK</span>}
                      {!COVENANTS.some(c=>d[c.minField])&&<span style={{fontSize:10,color:'var(--gray400)'}}>No covenants</span>}
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <button className="card-action" onClick={e=>{e.stopPropagation();setModal(d)}}>Edit</button>
                      <button className="card-action" style={{color:'var(--red)'}} onClick={e=>{e.stopPropagation();setDeleteId(d.id)}}>Del</button>
                      <span style={{fontSize:11,color:'var(--gray400)'}}>{isExpanded?'▲':'▼'}</span>
                    </div>
                  </div>

                  {isExpanded&&(
                    <div style={{paddingLeft:16,paddingBottom:16,borderTop:'1px dashed var(--gray100)'}}>
                      {/* Loan details */}
                      <div style={{fontSize:11,fontWeight:500,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--gray500)',marginTop:12,marginBottom:8}}>Loan Details</div>
                      <div style={{display:'flex',gap:16,flexWrap:'wrap',marginBottom:12}}>
                        <div style={{fontSize:12,color:'var(--gray700)'}}>
                          <span style={{color:'var(--gray500)'}}>Assumable:</span>{' '}
                          <span style={{fontWeight:500}}>{d.assumable?'Yes':'No'}</span>
                        </div>
                        <div style={{fontSize:12,color:'var(--gray700)'}}>
                          <span style={{color:'var(--gray500)'}}>Recourse:</span>{' '}
                          <span style={{fontWeight:500,color:d.recourse?'var(--red)':'var(--g600)'}}>{d.recourse?'Yes':'No'}</span>
                        </div>
                        <div style={{fontSize:12,color:'var(--gray700)'}}>
                          <span style={{color:'var(--gray500)'}}>Prepayment Structure:</span>{' '}
                          <span style={{fontWeight:500}}>{d.prepayment_structure&&d.prepayment_structure!=='none'?d.prepayment_structure.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase()):'None'}</span>
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:12,marginBottom:8}}>
                        <span style={{fontSize:11,fontWeight:500,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--gray500)'}}>Covenants</span>
                        {hasT12&&<span style={{fontSize:9,background:'var(--g100)',color:'var(--g600)',padding:'1px 6px',borderRadius:4,fontWeight:600}}>⚡ Actuals from ProfitSword</span>}
                      </div>
                      {!COVENANTS.some(c=>dl[c.minField]||dl[c.actualField])?(
                        <div style={{fontSize:12,color:'var(--gray500)',marginBottom:8}}>No covenant data. Click Edit → Covenants tab to add thresholds.</div>
                      ):(
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:8}}>
                          {COVENANTS.filter(c=>dl[c.minField]||dl[c.actualField]).map(cov=>{
                            const st=covenantStatus(cov,dl)
                            const {color,bg,icon}=covenantColor(st)
                            const isComputed=!!computedCovenantActuals(d,t12ByAsset)[cov.actualField]
                            return (
                              <div key={cov.key} style={{background:bg,border:`1px solid ${color}30`,borderRadius:8,padding:'10px 12px'}}>
                                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                                  <span style={{fontSize:10,fontWeight:600,color,textTransform:'uppercase',letterSpacing:'.05em'}}>{cov.label}{isComputed&&<span style={{fontSize:8,marginLeft:4,opacity:.7}}>⚡</span>}</span>
                                  <span style={{fontSize:13}}>{icon}</span>
                                </div>
                                <div style={{fontSize:16,fontWeight:700,color}}>{cov.format(dl[cov.actualField])}</div>
                                <div style={{fontSize:10,color:'rgba(0,0,0,0.4)',marginTop:2}}>req. {cov.format(dl[cov.minField])}</div>
                                {st==='breach'&&<div style={{fontSize:10,color,marginTop:4,fontWeight:500}}>⚠ BREACH</div>}
                                {st==='warning'&&<div style={{fontSize:10,color,marginTop:4}}>Approaching limit</div>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Covenant reference */}
      <div className="card">
        <div className="card-header"><span className="card-title">Covenant reference guide</span></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:10}}>
          {COVENANTS.map(cov=>(
            <div key={cov.key} style={{background:'var(--gray50)',border:'1px solid var(--gray100)',borderRadius:8,padding:'10px 12px'}}>
              <div style={{fontSize:11,fontWeight:600,color:'var(--g900)',marginBottom:3}}>{cov.fullName}</div>
              <div style={{fontSize:10,color:'var(--gray500)',lineHeight:1.5}}>{cov.description}</div>
            </div>
          ))}
        </div>
      </div>

      {modal!==null&&<DebtModal debt={modal?.id?modal:null} assets={assets} onClose={()=>setModal(null)} onSave={save}/>}
      {deleteId&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setDeleteId(null)}>
          <div className="modal" style={{maxWidth:400}}>
            <div className="modal-header"><span className="modal-title">Delete Loan</span><button className="modal-close" onClick={()=>setDeleteId(null)}>✕</button></div>
            <p style={{fontSize:13,color:'var(--gray700)',marginBottom:20}}>Delete this loan record? This cannot be undone.</p>
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
