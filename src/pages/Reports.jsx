import { useState } from 'react'
import { usePortfolioSummary } from '../hooks/useData'

const SECTIONS = [
  { id: 'exec', name: 'Executive summary', meta: '1 page overview' },
  { id: 'portfolio', name: 'Portfolio snapshot', meta: 'KPIs & asset list' },
  { id: 'financial', name: 'Financial performance', meta: 'Revenue, NOI, EBITDA' },
  { id: 'kpis', name: 'Property KPIs', meta: 'Occupancy, ADR, RevPAR' },
  { id: 'pipeline', name: 'Acquisition pipeline', meta: 'Active deals & scores' },
  { id: 'intel', name: 'Competitive benchmarking', meta: 'RevPAR index by market' },
  { id: 'outlook', name: 'Outlook & strategy', meta: 'Q2 priorities' },
]

const fmt = (n) => n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(0)}M` : '—'

export default function Reports() {
  const { summary } = usePortfolioSummary()
  const [title, setTitle] = useState('Q1 2026 Portfolio Report')
  const [type, setType] = useState('Investor Summary')
  const [prepared, setPrepared] = useState('Strategic Ops Team')
  const [date, setDate] = useState('March 2026')
  const [sections, setSections] = useState({ exec: true, portfolio: true, financial: true, kpis: true, pipeline: false, intel: false, outlook: true })
  const [preview, setPreview] = useState(false)

  const toggle = (id) => setSections(s => ({ ...s, [id]: !s[id] }))
  const activeSections = SECTIONS.filter(s => sections[s.id])

  return (
    <div>
      <div className="page-header">
        <h1>Report Builder</h1>
        <p>Generate investor-ready portfolio reports</p>
      </div>

      <div className="grid-3-2">
        <div className="card">
          <div className="card-header"><span className="card-title">Report configuration</span></div>

          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Report title</label><input className="form-input" value={title} onChange={e => setTitle(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Report type</label>
              <select className="form-select" value={type} onChange={e => setType(e.target.value)}>
                {['Investor Summary', 'Board Deck', 'Asset Review', 'Acquisition Brief', 'Quarterly Ops Report'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Prepared by</label><input className="form-input" value={prepared} onChange={e => setPrepared(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Date</label><input className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>

          <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--gray500)', marginBottom: 10 }}>Sections to include</div>

          {SECTIONS.map(s => (
            <div key={s.id} className="section-toggle">
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--g900)' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--gray500)' }}>{s.meta}</div>
              </div>
              <div className={`toggle-switch${sections[s.id] ? ' on' : ''}`} onClick={() => toggle(s.id)}>
                <div className="toggle-knob" />
              </div>
            </div>
          ))}

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16 }} onClick={() => setPreview(true)}>
            Generate report preview
          </button>
        </div>

        <div>
          {!preview ? (
            <div className="empty-state" style={{ padding: '80px 20px' }}>
              <div className="empty-state-icon">📄</div>
              <div className="empty-state-title">Configure and generate</div>
              <div className="empty-state-desc">Set your report options and click generate to preview</div>
            </div>
          ) : (
            <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 10, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid var(--g600)' }}>
                <div style={{ width: 24, height: 24, background: 'var(--g600)', borderRadius: 4 }} />
                <div>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 600, color: 'var(--g900)' }}>{title}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{type} · {prepared} · {date}</div>
                </div>
              </div>

              {activeSections.map(s => (
                <div key={s.id} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--g600)', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid var(--g100)' }}>{s.name}</div>

                  {s.id === 'portfolio' && summary && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                      {[['Total assets', summary.totalAssets], ['Portfolio value', fmt(summary.portfolioValue)], ['Active pipeline', `${summary.pipelineDeals} deals`], ['Active assets', summary.activeAssets]].map(([l, v]) => (
                        <div key={l} style={{ background: 'var(--white)', border: '1px solid var(--gray100)', borderRadius: 6, padding: '8px 10px' }}>
                          <div style={{ fontSize: 9, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{l}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--g900)' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {s.id === 'exec' && <div style={{ fontSize: 11, color: 'var(--gray700)', lineHeight: 1.6 }}>Q1 2026 reflects continued portfolio strength across all major metrics. Occupancy softness is offset by ADR growth. Three deals in active pipeline representing significant acquisition opportunity.</div>}
                  {s.id === 'financial' && <div style={{ fontSize: 11, color: 'var(--gray700)', lineHeight: 1.6 }}>Portfolio revenue of $312M for TTM, up 8.4% YoY. EBITDA margin expanded 180bps to 34.2%. RevPAR of $118 reflects healthy rate growth across full-service assets.</div>}
                  {s.id === 'kpis' && <div style={{ fontSize: 11, color: 'var(--gray700)', lineHeight: 1.6 }}>Average portfolio occupancy at 73%, ADR of $148, RevPAR of $118. Gulf Shores Resort leads on RevPAR at $167. See property-level detail in appendix.</div>}
                  {s.id === 'pipeline' && <div style={{ fontSize: 11, color: 'var(--gray700)', lineHeight: 1.6 }}>5 active deals totaling {fmt(summary?.pipelineValue)} in deal volume. Brentwood Mixed-Use expected to close Q2 2026. Chattanooga Boutique advancing through due diligence.</div>}
                  {s.id === 'intel' && <div style={{ fontSize: 11, color: 'var(--gray700)', lineHeight: 1.6 }}>Portfolio RevPAR Index of 108.4 — above fair share across most markets. Atlanta Hilton Garden underperforming comp set at RGI 91; corrective action underway.</div>}
                  {s.id === 'outlook' && <div style={{ fontSize: 11, color: 'var(--gray700)', lineHeight: 1.6 }}>Q2 priorities: close Brentwood Mixed-Use, advance Chattanooga to LOI, complete renovation at Brentwood Suites, and launch STR benchmarking program across all select-service assets.</div>}
                </div>
              ))}

              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--g200)', fontSize: 10, color: 'var(--gray500)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Strategic Ops Labs · Kemmons Wilson Hospitality Partners</span>
                <span>{date}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
