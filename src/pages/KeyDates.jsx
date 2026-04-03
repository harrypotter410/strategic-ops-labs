import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

const fmtDate = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
}

function daysFromNow(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0,0,0,0)
  d.setHours(0,0,0,0)
  return Math.ceil((d - now) / (1000 * 60 * 60 * 24))
}

function urgencyInfo(days) {
  if (days === null) return { label:'Unknown', color:'var(--gray500)', bg:'var(--gray100)' }
  if (days < 0) return { label:'Past Due', color:'var(--red)', bg:'var(--redL)' }
  if (days <= 365) return { label:'Within 12mo', color:'var(--amber)', bg:'var(--amberL)' }
  if (days <= 1095) return { label:'Within 36mo', color:'#b8860b', bg:'#fff8e1' }
  return { label:'Beyond 36mo', color:'var(--gray500)', bg:'var(--gray100)' }
}

export default function KeyDates() {
  const { assets, loading: assetsLoading } = useAssets()
  const [debt, setDebt] = useState([])
  const [debtLoading, setDebtLoading] = useState(true)

  useEffect(() => {
    supabase.from('asset_debt').select('*').then(({ data }) => {
      setDebt(data || [])
      setDebtLoading(false)
    })
  }, [])

  if (assetsLoading || debtLoading) return <div className="loading">Loading key dates...</div>

  // Build date items
  const items = []

  assets.forEach(a => {
    if (a.franchise_expiry) items.push({ date: a.franchise_expiry, assetId: a.id, assetName: a.name, category:'Franchise Expiry' })
    if (a.mgmt_contract_expiry) items.push({ date: a.mgmt_contract_expiry, assetId: a.id, assetName: a.name, category:'Mgmt Contract' })
    if (a.ground_lease_expiry) items.push({ date: a.ground_lease_expiry, assetId: a.id, assetName: a.name, category:'Ground Lease' })
    if (a.pip_deadline) items.push({ date: a.pip_deadline, assetId: a.id, assetName: a.name, category:'PIP Deadline' })
    if (a.target_exit_year) items.push({ date: `${a.target_exit_year}-01-01`, assetId: a.id, assetName: a.name, category:'Target Exit' })
  })

  debt.forEach(loan => {
    if (loan.maturity_date) {
      const a = assets.find(x => x.id === loan.asset_id)
      items.push({ date: loan.maturity_date, assetId: loan.asset_id, assetName: a?.name || 'Unknown', category:'Loan Maturity', sub: loan.lender })
    }
  })

  // Sort soonest first
  items.sort((a, b) => new Date(a.date) - new Date(b.date))

  // Add days and urgency
  items.forEach(item => {
    item.days = daysFromNow(item.date)
    item.urgency = urgencyInfo(item.days)
  })

  // Summary counts
  const pastDue = items.filter(i => i.days !== null && i.days < 0).length
  const within12 = items.filter(i => i.days !== null && i.days >= 0 && i.days <= 365).length
  const within36 = items.filter(i => i.days !== null && i.days > 365 && i.days <= 1095).length

  return (
    <div>
      <div className="page-header">
        <h1>Key Dates</h1>
        <p>All time-sensitive dates across the portfolio, sorted by urgency</p>
      </div>

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{marginBottom:20}}>
        <div className="kpi-card">
          <div className="kpi-label">Past Due</div>
          <div className="kpi-value" style={{color: pastDue > 0 ? 'var(--red)' : 'var(--g600)'}}>{pastDue}</div>
          <div className="kpi-change">Requires immediate attention</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Due Within 12 Months</div>
          <div className="kpi-value" style={{color: within12 > 0 ? 'var(--amber)' : 'var(--g600)'}}>{within12}</div>
          <div className="kpi-change">Action needed soon</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Due Within 36 Months</div>
          <div className="kpi-value">{within36}</div>
          <div className="kpi-change">Plan ahead</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Tracked</div>
          <div className="kpi-value">{items.length}</div>
          <div className="kpi-change">Across {assets.length} assets</div>
        </div>
      </div>

      {/* Past due alerts */}
      {items.filter(i => i.days !== null && i.days < 0).map((item, idx) => (
        <div key={`alert-${idx}`} style={{background:'var(--redL)',border:'1px solid #f5c6c2',borderRadius:10,padding:'10px 16px',fontSize:12,marginBottom:6}}>
          <strong style={{color:'var(--red)'}}>PAST DUE</strong>
          <span style={{color:'var(--red)',marginLeft:8}}>
            {item.assetName} -- {item.category}: {fmtDate(item.date)} ({Math.abs(item.days)} days ago)
          </span>
        </div>
      ))}

      {/* Table */}
      <div className="card">
        <div className="card-header"><span className="card-title">All Key Dates</span></div>
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-title">No key dates found</div>
            <div className="empty-state-desc">Add franchise, management, ground lease, or debt data to your assets to see dates here.</div>
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Asset</th>
                  <th>Category</th>
                  <th>Days Away</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{fontWeight:500}}>{fmtDate(item.date)}</td>
                    <td>
                      <Link to={`/assets/${item.assetId}`} style={{color:'var(--g600)',textDecoration:'none',fontWeight:500}}>
                        {item.assetName}
                      </Link>
                    </td>
                    <td>
                      {item.category}
                      {item.sub && <span style={{fontSize:10,color:'var(--gray400)',marginLeft:6}}>({item.sub})</span>}
                    </td>
                    <td style={{fontWeight:500,color:item.days<0?'var(--red)':item.days<=365?'var(--amber)':'var(--gray700)'}}>
                      {item.days !== null ? (item.days < 0 ? `${item.days}d (past)` : `${item.days}d`) : '—'}
                    </td>
                    <td>
                      <span style={{fontSize:10,fontWeight:500,padding:'2px 8px',borderRadius:10,background:item.urgency.bg,color:item.urgency.color}}>
                        {item.urgency.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
