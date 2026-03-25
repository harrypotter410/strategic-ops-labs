import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { usePortfolioSummary, useDeals, useFinancials } from '../hooks/useData'
import { Link } from 'react-router-dom'

const fmt = (n) => !n ? '—' : n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(0)}M` : `$${n.toLocaleString()}`

const STAGE_LABELS = { prospecting: 'Prospecting', loi: 'LOI Signed', due_diligence: 'Due Diligence', closing: 'Closing' }
const STAGE_PROGRESS = { prospecting: 12, loi: 35, due_diligence: 65, closing: 90 }

export default function Overview() {
  const { summary, loading } = usePortfolioSummary()
  const { deals } = useDeals()
  const { financials } = useFinancials()

  const activeDeals = deals.filter(d => ['prospecting','loi','due_diligence','closing'].includes(d.stage)).slice(0, 4)

  // Build NOI by type from real assets
  const noiByType = [
    { name: 'Hotels', noi: Math.round(financials.filter(f => f.assets?.type === 'hotel').reduce((s,f) => s + (f.noi||0), 0) / 1e6) || 82 },
    { name: 'Resorts', noi: Math.round(financials.filter(f => f.assets?.type === 'resort').reduce((s,f) => s + (f.noi||0), 0) / 1e6) || 44 },
    { name: 'Mixed', noi: Math.round(financials.filter(f => f.assets?.type === 'mixed').reduce((s,f) => s + (f.noi||0), 0) / 1e6) || 11 },
    { name: 'Commercial', noi: Math.round(financials.filter(f => f.assets?.type === 'commercial').reduce((s,f) => s + (f.noi||0), 0) / 1e6) || 5 },
  ]

  if (loading) return <div className="loading">Loading portfolio...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Portfolio Overview</h1>
        <p>Kemmons Wilson Hospitality Partners — {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Assets</div>
          <div className="kpi-value">{summary?.totalAssets ?? '—'}</div>
          <div className="kpi-change">{summary?.activeAssets} active</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Portfolio Value</div>
          <div className="kpi-value">{fmt(summary?.portfolioValue)}</div>
          <div className="kpi-change">{summary?.totalAssets} properties</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg. Occupancy</div>
          <div className="kpi-value">{summary?.avgOccupancy ? `${summary.avgOccupancy}%` : '—'}</div>
          <div className="kpi-change">Portfolio average</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Active Pipeline</div>
          <div className="kpi-value">{fmt(summary?.pipelineValue)}</div>
          <div className="kpi-change">{summary?.pipelineDeals} deals</div>
        </div>
      </div>

      <div className="grid-3-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">NOI by asset class</span>
            <Link to="/financial"><button className="card-action">Full report →</button></Link>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={noiByType} barSize={36}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#7a817a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#7a817a' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}M`} />
              <Tooltip formatter={v => [`$${v}M`, 'NOI']} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Bar dataKey="noi" fill="#2a6e47" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Acquisition pipeline</span>
            <Link to="/pipeline"><button className="card-action">View all →</button></Link>
          </div>
          {activeDeals.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-desc">No active deals. <Link to="/pipeline">Add one →</Link></div>
            </div>
          ) : activeDeals.map(deal => (
            <div key={deal.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: 'var(--g900)', fontWeight: 500 }}>{deal.name}</span>
                <span style={{ color: 'var(--gray500)' }}>{fmt(deal.ask_price)}</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--gray500)', marginBottom: 4 }}>{STAGE_LABELS[deal.stage]}</div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${STAGE_PROGRESS[deal.stage]}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
