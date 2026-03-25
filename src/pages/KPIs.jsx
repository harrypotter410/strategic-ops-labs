import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const props = [
  { name: 'The Peabody Memphis', occ: 78, adr: 182, revpar: 142, gop: 44.8, sat: 4.4, rooms: 464,
    occT: [71,73,75,76,78,80,82,81,79,77,76,78], adrT: [162,165,168,172,176,180,188,186,182,178,174,182] },
  { name: 'Embassy Suites Nashville', occ: 81, adr: 158, revpar: 128, gop: 43.7, sat: 4.6, rooms: 208,
    occT: [74,76,78,80,82,84,86,84,82,80,79,81], adrT: [138,140,144,148,152,156,164,162,158,154,150,158] },
  { name: 'Gulf Shores Resort', occ: 69, adr: 242, revpar: 167, gop: 46.1, sat: 4.7, rooms: 312,
    occT: [45,48,52,58,68,80,88,86,74,62,52,69], adrT: [180,188,200,216,232,248,270,265,250,230,210,242] },
  { name: 'Hilton Garden Atlanta', occ: 74, adr: 132, revpar: 98, gop: 40.3, sat: 4.1, rooms: 196,
    occT: [68,70,72,74,75,76,77,76,75,74,73,74], adrT: [118,120,122,126,128,132,136,134,132,130,128,132] },
  { name: 'Courtyard Birmingham', occ: 71, adr: 125, revpar: 89, gop: 38.2, sat: 4.0, rooms: 168,
    occT: [65,66,68,70,71,72,74,73,71,70,69,71], adrT: [112,114,116,119,122,125,130,128,125,122,118,125] },
]

export default function KPIs() {
  const [sel, setSel] = useState(0)
  const p = props[sel]

  const occData = months.map((m, i) => ({ month: m, occ: p.occT[i] }))
  const adrData = months.map((m, i) => ({ month: m, adr: p.adrT[i], revpar: Math.round(p.adrT[i] * p.occT[i] / 100) }))

  const scorecard = [
    { metric: 'Occupancy', curr: `${p.occ}%`, prior: `${Math.round(p.occ*0.97)}%`, budget: '75%', yoy: `+${Math.round(p.occ*0.04)}pp`, up: true },
    { metric: 'ADR', curr: `$${p.adr}`, prior: `$${Math.round(p.adr*0.97)}`, budget: `$${Math.round(p.adr*0.98)}`, yoy: `+$${Math.round(p.adr*0.06)}`, up: true },
    { metric: 'RevPAR', curr: `$${p.revpar}`, prior: `$${Math.round(p.revpar*0.94)}`, budget: `$${Math.round(p.revpar*0.97)}`, yoy: `+$${Math.round(p.revpar*0.05)}`, up: true },
    { metric: 'GOP Margin', curr: `${p.gop}%`, prior: `${(p.gop-1).toFixed(1)}%`, budget: `${(p.gop-0.5).toFixed(1)}%`, yoy: '+1.2pp', up: true },
    { metric: 'Guest Sat.', curr: `${p.sat}/5`, prior: `${(p.sat-0.1).toFixed(1)}/5`, budget: '4.3/5', yoy: '+0.2', up: true },
    { metric: 'F&B Revenue', curr: '$2.4M', prior: '$2.2M', budget: '$2.3M', yoy: '+8.4%', up: true },
  ]

  return (
    <div>
      <div className="page-header">
        <h1>Property KPIs</h1>
        <p>Operational metrics by property — trailing 12 months</p>
      </div>

      <div className="filter-tabs">
        {props.map((pr, i) => (
          <button key={i} className={`filter-tab${sel===i?' active':''}`} onClick={() => setSel(i)}>
            {pr.name.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
        {[
          ['Occupancy', `${p.occ}%`],
          ['ADR', `$${p.adr}`],
          ['RevPAR', `$${p.revpar}`],
          ['GOP Margin', `${p.gop}%`],
          ['Guest Sat.', `${p.sat}/5`],
          ['Rooms', p.rooms],
        ].map(([label, value]) => (
          <div className="kpi-card" key={label}>
            <div className="kpi-label">{label}</div>
            <div className="kpi-value" style={{ fontSize: 18 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Occupancy — trailing 12 months</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={occData}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} domain={[40, 100]} />
              <Tooltip formatter={v => [`${v}%`, 'Occupancy']} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Line type="monotone" dataKey="occ" stroke="#2a6e47" strokeWidth={2} dot={{ r: 3 }} fill="rgba(42,110,71,0.08)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">ADR vs RevPAR — trailing 12M</span>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--gray500)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, background: '#2a6e47', display: 'inline-block', borderRadius: 2 }}></span>ADR</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, background: '#a8d5bc', display: 'inline-block', borderRadius: 2 }}></span>RevPAR</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={adrData}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v, n) => [`$${v}`, n.toUpperCase()]} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <Line type="monotone" dataKey="adr" stroke="#2a6e47" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="revpar" stroke="#a8d5bc" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Operational scorecard — {p.name}</span></div>
        <table className="data-table">
          <thead><tr><th>Metric</th><th>Current</th><th>Prior Month</th><th>Budget</th><th>YoY</th></tr></thead>
          <tbody>
            {scorecard.map(r => (
              <tr key={r.metric}>
                <td><strong>{r.metric}</strong></td>
                <td>{r.curr}</td>
                <td style={{ color: 'var(--gray500)' }}>{r.prior}</td>
                <td style={{ color: 'var(--gray500)' }}>{r.budget}</td>
                <td className={r.up ? 'up' : 'dn'}>{r.yoy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
