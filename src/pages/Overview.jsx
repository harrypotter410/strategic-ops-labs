import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { usePortfolioSummary, useDeals } from '../hooks/useData'
import { Link } from 'react-router-dom'

const fmt = (n) => n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(0)}M` : `$${n?.toLocaleString() ?? 0}`

const noiData = [
  { name: 'Hotels', noi: 82 },
  { name: 'Resorts', noi: 44 },
  { name: 'Mixed', noi: 11 },
  { name: 'Commercial', noi: 5 },
]

const stageOrder = ['prospecting', 'loi', 'due_diligence', 'closing']
const stageLabels = { prospecting: 'Prospecting', loi: 'LOI Signed', due_diligence: 'Due Diligence', closing: 'Closing' }
const stageProgress = { prospecting: 12, loi: 35, due_diligence: 65, closing: 90 }

export default function Overview() {
  const { summary, loading } = usePortfolioSummary()
  const { deals } = useDeals()

  const activeDeals = deals.filter(d => stageOrder.includes(d.stage)).slice(0, 4)

  if (loading) return <div className="loading">Loading portfolio...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Portfolio Overview</h1>
        <p>Kemmons Wilson Hospitality Partners — Q1 2026</p>
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
          <div className="kpi-change">↑ 6.2% YoY</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg. Occupancy</div>
          <div className="kpi-value">{summary?.avgOccupancy ? `${summary.avgOccupancy}%` : '73%'}</div>
          <div className="kpi-change down">↓ 1.4% vs last qtr</div>
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
            <span className="card-title">NOI by asset class (TTM)</span>
            <Link to="/financial"><button className="card-action">Full report →</button></Link>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={noiData} barSize={36}>
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
              <div style={{ fontSize: 10, color: 'var(--gray500)', marginBottom: 4 }}>{stageLabels[deal.stage]}</div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${stageProgress[deal.stage]}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
