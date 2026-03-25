import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useFinancials, useAssets } from '../hooks/useData'

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const sampleMonthly = months.map((m, i) => ({
  month: m,
  revenue: [22,20,25,27,31,34,38,36,29,26,24,28][i],
  noi: [7,6,8,9,11,12,14,13,10,9,8,10][i],
}))

const revparByClass = [
  { name: 'Full-Service', revpar: 128 },
  { name: 'Select-Svc', revpar: 94 },
  { name: 'Resort', revpar: 177 },
  { name: 'Boutique', revpar: 142 },
]

const plSummary = [
  { name: 'The Peabody Memphis', revenue: '$48.2M', gop: '$21.4M', noi: '$16.8M', ebitda: '34.8%', revpar: '$142', budget: '+4.2%', up: true },
  { name: 'Embassy Suites Nashville', revenue: '$31.6M', gop: '$13.8M', noi: '$10.9M', ebitda: '34.5%', revpar: '$128', budget: '+2.1%', up: true },
  { name: 'Gulf Shores Resort', revenue: '$52.4M', gop: '$24.1M', noi: '$19.3M', ebitda: '36.8%', revpar: '$167', budget: '+6.8%', up: true },
  { name: 'Hilton Garden Atlanta', revenue: '$22.8M', gop: '$9.2M', noi: '$6.9M', ebitda: '30.3%', revpar: '$98', budget: '-1.4%', up: false },
  { name: 'Courtyard Birmingham', revenue: '$18.4M', gop: '$7.6M', noi: '$5.8M', ebitda: '31.5%', revpar: '$89', budget: '+0.2%', up: null },
]

export default function Financial() {
  return (
    <div>
      <div className="page-header">
        <h1>Financial Performance</h1>
        <p>Portfolio-level P&L and RevPAR trends — Q1 2026</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total Revenue (TTM)</div><div className="kpi-value">$312M</div><div className="kpi-change">↑ 8.4% YoY</div></div>
        <div className="kpi-card"><div className="kpi-label">EBITDA Margin</div><div className="kpi-value">34.2%</div><div className="kpi-change">↑ 1.8pp YoY</div></div>
        <div className="kpi-card"><div className="kpi-label">Portfolio RevPAR</div><div className="kpi-value">$118</div><div className="kpi-change">↑ 5.1% YoY</div></div>
        <div className="kpi-card"><div className="kpi-label">GOP PAR</div><div className="kpi-value">$68</div><div className="kpi-change">↑ 7.3% YoY</div></div>
      </div>

      <div className="grid-3-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Revenue vs NOI — monthly 2025</span>
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--gray500)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, background: '#2a6e47', display: 'inline-block', borderRadius: 2 }}></span>Revenue</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, background: '#a8d5bc', display: 'inline-block', borderRadius: 2 }}></span>NOI</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={sampleMonthly}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}M`} />
              <Tooltip formatter={(v, n) => [`$${v}M`, n === 'revenue' ? 'Revenue' : 'NOI']} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Line type="monotone" dataKey="revenue" stroke="#2a6e47" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="noi" stroke="#a8d5bc" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">RevPAR by asset class</span></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revparByClass} layout="vertical" barSize={20}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} width={80} />
              <Tooltip formatter={v => [`$${v}`, 'RevPAR']} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Bar dataKey="revpar" fill="#2a6e47" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Asset-level P&L summary</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th>Property</th><th>Revenue</th><th>GOP</th><th>NOI</th><th>EBITDA %</th><th>RevPAR</th><th>vs Budget</th>
            </tr></thead>
            <tbody>
              {plSummary.map(r => (
                <tr key={r.name}>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.revenue}</td><td>{r.gop}</td><td>{r.noi}</td><td>{r.ebitda}</td><td>{r.revpar}</td>
                  <td className={r.up === true ? 'up' : r.up === false ? 'dn' : 'fl'}>{r.budget}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
