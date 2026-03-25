import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const intelData = [
  { name: 'The Peabody Memphis', market: 'Memphis, TN', occIdx: 104, adrIdx: 112, revIdx: 116, pos: 'above' },
  { name: 'Embassy Suites Nashville', market: 'Nashville, TN', occIdx: 108, adrIdx: 106, revIdx: 114, pos: 'above' },
  { name: 'Gulf Shores Resort', market: 'Gulf Shores, AL', occIdx: 96, adrIdx: 118, revIdx: 113, pos: 'above' },
  { name: 'Hilton Garden Atlanta', market: 'Atlanta, GA', occIdx: 93, adrIdx: 98, revIdx: 91, pos: 'below' },
  { name: 'Courtyard Birmingham', market: 'Birmingham, AL', occIdx: 99, adrIdx: 101, revIdx: 100, pos: 'parity' },
]

const trendData = months.map((m, i) => ({
  month: m,
  kwPortfolio: [102,104,106,107,108,110,112,111,109,108,107,108][i],
  compSet: 100,
}))

const compSet = [
  { name: 'The Peabody Memphis', type: 'KW', revpar: 142, idx: 116 },
  { name: 'Marriott Memphis Downtown', type: 'Comp', revpar: 128, idx: 104 },
  { name: 'Hyatt Centric Beale St.', type: 'Comp', revpar: 119, idx: 97 },
  { name: 'Hampton Inn Memphis', type: 'Comp', revpar: 98, idx: 80 },
]

const MARKETS = ['All markets', 'Memphis, TN', 'Nashville, TN', 'Gulf Shores, AL', 'Atlanta, GA', 'Birmingham, AL']

export default function Intel() {
  const [market, setMarket] = useState('All markets')
  const filtered = market === 'All markets' ? intelData : intelData.filter(r => r.market === market)

  const posClass = (p) => ({ above: 'mkt-above', below: 'mkt-below', parity: 'mkt-parity' }[p])
  const posLabel = (p) => ({ above: 'Above fair share', below: 'Below fair share', parity: 'At parity' }[p])

  return (
    <div>
      <div className="page-header">
        <h1>Competitive Intel</h1>
        <p>STR comp set benchmarking by market — Q1 2026</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Markets tracked</div><div className="kpi-value">8</div><div className="kpi-change">32 comp properties</div></div>
        <div className="kpi-card"><div className="kpi-label">RevPAR Index (RGI)</div><div className="kpi-value">108.4</div><div className="kpi-change">↑ above fair share</div></div>
        <div className="kpi-card"><div className="kpi-label">ADR Index (ARI)</div><div className="kpi-value">103.1</div><div className="kpi-change">↑ 2.4pts YoY</div></div>
        <div className="kpi-card"><div className="kpi-label">Occ. Index (MPI)</div><div className="kpi-value">97.8</div><div className="kpi-change down">↓ slightly below fair share</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Market penetration by property</span>
          <select className="form-select" style={{ width: 'auto', fontSize: 11 }} value={market} onChange={e => setMarket(e.target.value)}>
            {MARKETS.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '180px repeat(4, 1fr)', gap: 0, paddingBottom: 6, borderBottom: '1px solid var(--gray100)', marginBottom: 2 }}>
          {['Property', 'Occ. Index', 'ADR Index', 'RevPAR Index', 'Position'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 500, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.07em' }}>{h}</div>
          ))}
        </div>

        {filtered.map(row => (
          <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '180px repeat(4, 1fr)', gap: 0, padding: '8px 0', borderBottom: '1px solid var(--gray100)', alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--g900)' }}>{row.name}</div>
            {[['occIdx', row.occIdx], ['adrIdx', row.adrIdx], ['revIdx', row.revIdx]].map(([key, val]) => (
              <div key={key}>
                <span style={{ fontSize: 12, fontWeight: 500, color: val >= 100 ? 'var(--g600)' : 'var(--red)' }}>{val}</span>
                <div className="index-bar" style={{ width: `${Math.min(val / 120 * 100, 100)}%`, background: val >= 100 ? '#2a6e47' : '#c0392b', opacity: 0.4 }} />
              </div>
            ))}
            <div><span className={`mkt-badge ${posClass(row.pos)}`}>{posLabel(row.pos)}</span></div>
          </div>
        ))}
      </div>

      <div className="grid-3-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">RevPAR index — trailing 12M</span>
            <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--gray500)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, background: '#2a6e47', display: 'inline-block', borderRadius: 2 }}></span>KW Portfolio</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, background: '#c4c9c4', display: 'inline-block', borderRadius: 2 }}></span>Fair Share (100)</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} domain={[90, 120]} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
              <ReferenceLine y={100} stroke="#c4c9c4" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="kwPortfolio" stroke="#2a6e47" strokeWidth={2} dot={{ r: 3 }} name="KW Portfolio" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Comp set — Memphis market</span></div>
          {compSet.map(c => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray100)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: c.type === 'KW' ? 500 : 400, color: c.type === 'KW' ? 'var(--g900)' : 'var(--gray700)' }}>{c.name}</div>
                <div style={{ fontSize: 10, color: 'var(--gray500)' }}>RevPAR Index: {c.idx}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: c.type === 'KW' ? 'var(--g700)' : 'var(--gray700)' }}>${c.revpar}</div>
              {c.type === 'KW' && <span className="mkt-badge mkt-above">KW</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
