import { useState, useRef } from 'react'
import { useAssets, useFinancials, useDeals } from '../hooks/useData'
import { supabase } from '../lib/supabase'

// Excel export using SheetJS via CDN — loaded dynamically
const loadXLSX = () => new Promise((resolve) => {
  if (window.XLSX) { resolve(window.XLSX); return }
  const script = document.createElement('script')
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
  script.onload = () => resolve(window.XLSX)
  document.head.appendChild(script)
})

const TEMPLATES = [
  {
    id: 'assets',
    name: 'Asset List',
    desc: 'Import or update your portfolio properties',
    icon: '🏨',
    headers: ['name','type','market','rooms','status','brand','year_acquired','acquisition_price','current_value','cap_rate','notes'],
    sample: [['The Peabody Memphis','hotel','Memphis, TN',464,'active','Independent',2018,95000000,142000000,6.8,'Flagship asset']],
  },
  {
    id: 'deals',
    name: 'Deal Pipeline',
    desc: 'Import acquisition deals and return projections',
    icon: '💼',
    headers: ['name','market','type','rooms','ask_price','cap_rate','stage','projected_irr','equity_multiple','broker','notes'],
    sample: [['Chattanooga Boutique','Chattanooga, TN','hotel',140,28000000,7.8,'due_diligence',16.5,2.1,'CBRE','Strong boutique play']],
  },
  {
    id: 'valuations',
    name: 'Quarterly Valuations',
    desc: 'Import historical valuations by asset and quarter',
    icon: '📈',
    headers: ['asset_name','quarter','year','valuation_method','appraised_value','internal_estimate','noi_trailing','cap_rate_applied','outstanding_debt','valuation_notes'],
    sample: [['The Peabody Memphis',1,2026,'income',142000000,138000000,8500000,6.0,62000000,'Strong market conditions']],
  },
]

const EXPORTS = [
  { id: 'assets', name: 'Full Asset Portfolio', desc: 'All assets with acquisition price, current value, gain/loss', icon: '🏨' },
  { id: 'financials', name: 'Financial Performance', desc: 'All P&L data by asset and month', icon: '📊' },
  { id: 'deals', name: 'Deal Pipeline', desc: 'All deals with IRR, returns, checklist status', icon: '💼' },
  { id: 'valuations', name: 'Valuation History', desc: 'All quarterly valuations by asset', icon: '📈' },
  { id: 'portfolio_summary', name: 'Portfolio Summary', desc: 'Overview dashboard — all KPIs in one sheet', icon: '🗂' },
]

function parseCSVorXLSX(file, XLSX) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.readAsArrayBuffer(file)
  })
}

export default function DataHub() {
  const { assets, addAsset, updateAsset } = useAssets()
  const { financials, addFinancials } = useFinancials()
  const { deals, addDeal } = useDeals()

  const [activeTemplate, setActiveTemplate] = useState('assets')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [exporting, setExporting] = useState(null)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef()

  const handleFile = async (f) => {
    if (!f) return
    setFile(f)
    setImportResult(null)
    try {
      const XLSX = await loadXLSX()
      const rows = await parseCSVorXLSX(f, XLSX)
      setPreview(rows.slice(0, 5))
    } catch (err) {
      setImportResult({ type: 'error', msg: 'Could not parse file. Make sure it is a valid Excel (.xlsx) or CSV file.' })
    }
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleImport = async () => {
    if (!preview || !file) return
    setImporting(true)
    setImportResult(null)
    try {
      const XLSX = await loadXLSX()
      const rows = await parseCSVorXLSX(file, XLSX)
      let imported = 0; let errors = 0

      if (activeTemplate === 'assets') {
        for (const row of rows) {
          if (!row.name) continue
          const existing = assets.find(a => a.name.toLowerCase() === String(row.name).toLowerCase())
          const payload = {
            name: String(row.name), market: String(row.market || ''), type: String(row.type || 'hotel'),
            status: String(row.status || 'active'), rooms: row.rooms ? parseInt(row.rooms) : null,
            brand: row.brand || null, year_acquired: row.year_acquired ? parseInt(row.year_acquired) : null,
            acquisition_price: row.acquisition_price ? parseFloat(row.acquisition_price) : null,
            current_value: row.current_value ? parseFloat(row.current_value) : null,
            cap_rate: row.cap_rate ? parseFloat(row.cap_rate) : null,
            notes: row.notes || null,
          }
          if (existing) { const { error } = await updateAsset(existing.id, payload); error ? errors++ : imported++ }
          else { const { error } = await addAsset(payload); error ? errors++ : imported++ }
        }
      } else if (activeTemplate === 'deals') {
        for (const row of rows) {
          if (!row.name) continue
          const payload = {
            name: String(row.name), market: row.market || null, type: row.type || 'hotel',
            rooms: row.rooms ? parseInt(row.rooms) : null,
            ask_price: row.ask_price ? parseFloat(row.ask_price) : null,
            cap_rate: row.cap_rate ? parseFloat(row.cap_rate) : null,
            stage: row.stage || 'prospecting', score: 50,
            projected_irr: row.projected_irr ? parseFloat(row.projected_irr) : null,
            equity_multiple: row.equity_multiple ? parseFloat(row.equity_multiple) : null,
            broker: row.broker || null, notes: row.notes || null,
          }
          const { error } = await addDeal(payload)
          error ? errors++ : imported++
        }
      } else if (activeTemplate === 'valuations') {
        for (const row of rows) {
          if (!row.asset_name) continue
          const asset = assets.find(a => a.name.toLowerCase().includes(String(row.asset_name).toLowerCase()))
          if (!asset) { errors++; continue }
          const { error } = await supabase.from('valuations').upsert({
            asset_id: asset.id,
            quarter: parseInt(row.quarter), year: parseInt(row.year),
            valuation_method: row.valuation_method || 'income',
            appraised_value: row.appraised_value ? parseFloat(row.appraised_value) : null,
            internal_estimate: row.internal_estimate ? parseFloat(row.internal_estimate) : null,
            noi_trailing: row.noi_trailing ? parseFloat(row.noi_trailing) : null,
            cap_rate_applied: row.cap_rate_applied ? parseFloat(row.cap_rate_applied) : null,
            outstanding_debt: row.outstanding_debt ? parseFloat(row.outstanding_debt) : null,
            valuation_notes: row.valuation_notes || null,
            valuation_date: new Date(`${row.year}-${String(row.quarter * 3).padStart(2,'0')}-01`).toISOString().split('T')[0],
          }, { onConflict: 'asset_id,quarter,year' })
          error ? errors++ : imported++
        }
      }

      setImportResult({
        type: errors > 0 && imported === 0 ? 'error' : imported > 0 ? 'success' : 'error',
        msg: imported > 0
          ? `✓ Imported ${imported} row${imported > 1 ? 's' : ''} successfully.${errors > 0 ? ` (${errors} rows skipped — check asset names match exactly)` : ''}`
          : `Import failed. ${errors} row${errors > 1 ? 's' : ''} had errors. Check that asset names match your portfolio exactly.`
      })
      setFile(null); setPreview(null)
    } catch (err) {
      setImportResult({ type: 'error', msg: `Import error: ${err.message}` })
    }
    setImporting(false)
  }

  const handleExport = async (exportId) => {
    setExporting(exportId)
    try {
      const XLSX = await loadXLSX()
      const wb = XLSX.utils.book_new()

      if (exportId === 'assets' || exportId === 'portfolio_summary') {
        const assetRows = assets.map(a => ({
          'Property': a.name, 'Type': a.type, 'Market': a.market,
          'Brand': a.brand || '', 'Rooms': a.rooms || '',
          'Status': a.status, 'Year Acquired': a.year_acquired || '',
          'Acquisition Price': a.acquisition_price || '',
          'Current Value': a.current_value || '',
          'Unrealized Gain ($)': (a.current_value && a.acquisition_price) ? a.current_value - a.acquisition_price : '',
          'Unrealized Gain (%)': (a.current_value && a.acquisition_price) ? (((a.current_value - a.acquisition_price) / a.acquisition_price) * 100).toFixed(1) + '%' : '',
          'Cap Rate (%)': a.cap_rate || '', 'Notes': a.notes || '',
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assetRows), 'Assets')
      }

      if (exportId === 'financials' || exportId === 'portfolio_summary') {
        const { data: fins } = await supabase.from('financials').select('*, assets(name, market)').order('period_year').order('period_month')
        const finRows = (fins || []).map(f => ({
          'Asset': f.assets?.name || '', 'Market': f.assets?.market || '',
          'Month': f.period_month, 'Year': f.period_year,
          'Revenue': f.revenue || '', 'GOP': f.gop || '', 'NOI': f.noi || '',
          'EBITDA': f.ebitda || '', 'Occupancy (%)': f.occupancy || '',
          'ADR ($)': f.adr || '', 'RevPAR ($)': f.revpar || '',
          'Budget Revenue': f.budget_revenue || '', 'Budget NOI': f.budget_noi || '',
          'Revenue vs Budget': (f.revenue && f.budget_revenue) ? (((f.revenue - f.budget_revenue) / f.budget_revenue) * 100).toFixed(1) + '%' : '',
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(finRows.length ? finRows : [{ 'Note': 'No financial data yet' }]), 'Financials')
      }

      if (exportId === 'deals' || exportId === 'portfolio_summary') {
        const { data: dealData } = await supabase.from('deals').select('*, deal_checklist(*)').order('created_at', { ascending: false })
        const dealRows = (dealData || []).map(d => ({
          'Deal Name': d.name, 'Market': d.market || '', 'Type': d.type || '',
          'Stage': d.stage, 'Ask Price ($)': d.ask_price || '',
          'Price/Key ($)': d.price_per_key || '', 'Cap Rate (%)': d.cap_rate || '',
          'Projected IRR (%)': d.projected_irr || '', 'Equity Multiple (x)': d.equity_multiple || '',
          'Cash-on-Cash (%)': d.cash_on_cash || '', 'Equity Check ($)': d.equity_check || '',
          'LTV (%)': d.ltv || '', 'Broker': d.broker || '',
          'Expected Close': d.expected_close || '', 'Score': d.score || '',
          'Checklist Items': (d.deal_checklist || []).length,
          'Checklist Complete': (d.deal_checklist || []).filter(c => c.completed).length,
          'Notes': d.notes || '',
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dealRows.length ? dealRows : [{ 'Note': 'No deals yet' }]), 'Deals')
      }

      if (exportId === 'valuations' || exportId === 'portfolio_summary') {
        const { data: valData } = await supabase.from('valuations').select('*, assets(name, market, acquisition_price)').order('year', { ascending: false }).order('quarter', { ascending: false })
        const valRows = (valData || []).map(v => ({
          'Asset': v.assets?.name || '', 'Market': v.assets?.market || '',
          'Q': `Q${v.quarter}`, 'Year': v.year,
          'Method': v.valuation_method || '', 'Appraised Value ($)': v.appraised_value || '',
          'Internal Estimate ($)': v.internal_estimate || '',
          'Book Value ($)': v.book_value || '', 'Equity Value ($)': v.equity_value || '',
          'Outstanding Debt ($)': v.outstanding_debt || '',
          'NOI Trailing ($)': v.noi_trailing || '', 'Cap Rate Applied (%)': v.cap_rate_applied || '',
          'vs Cost Basis ($)': (v.appraised_value && v.assets?.acquisition_price) ? v.appraised_value - v.assets.acquisition_price : '',
          'Approved': v.approved ? 'Yes' : 'Draft', 'Notes': v.valuation_notes || '',
        }))
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(valRows.length ? valRows : [{ 'Note': 'No valuations yet' }]), 'Valuations')
      }

      // Generate and download
      const filename = `SOUL_${exportId}_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, filename)
    } catch (err) {
      alert('Export error: ' + err.message)
    }
    setExporting(null)
  }

  const downloadTemplate = async (template) => {
    const XLSX = await loadXLSX()
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([template.headers, ...template.sample])
    XLSX.utils.book_append_sheet(wb, ws, template.name)
    XLSX.writeFile(wb, `SOUL_template_${template.id}.xlsx`)
  }

  const activeT = TEMPLATES.find(t => t.id === activeTemplate)
  const statusColor = (type) => ({ success: 'var(--g600)', error: 'var(--red)', info: 'var(--blue)' }[type] || 'var(--gray500)')
  const statusBg = (type) => ({ success: 'var(--g50)', error: 'var(--redL)', info: 'var(--blueL)' }[type] || 'var(--gray50)')

  return (
    <div>
      <div className="page-header">
        <h1>Data Hub</h1>
        <p>Import from Excel, export your data, download templates</p>
      </div>

      <div className="grid-2">
        {/* IMPORT */}
        <div>
          <div className="card">
            <div className="card-header"><span className="card-title">Import from Excel or CSV</span></div>

            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--gray500)', marginBottom: 10 }}>What are you importing?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => { setActiveTemplate(t.id); setFile(null); setPreview(null); setImportResult(null) }}
                  style={{ fontSize: 11, padding: '6px 12px', borderRadius: 8, border: '1px solid', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderColor: activeTemplate===t.id ? 'var(--g600)' : 'var(--gray200)', background: activeTemplate===t.id ? 'var(--g50)' : 'var(--white)', color: activeTemplate===t.id ? 'var(--g800)' : 'var(--gray700)', fontWeight: activeTemplate===t.id ? 500 : 400 }}>
                  <span style={{ fontSize: 14 }}>{t.icon}</span>{t.name}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 12, color: 'var(--gray500)', marginBottom: 12 }}>{activeT?.desc}</div>

            <div
              style={{ border: `2px dashed ${drag ? 'var(--g600)' : 'var(--gray200)'}`, borderRadius: 10, padding: 32, textAlign: 'center', cursor: 'pointer', background: drag ? 'var(--g50)' : 'var(--white)', transition: 'all .15s' }}
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--g900)', marginBottom: 4 }}>
                {file ? file.name : 'Drop your Excel or CSV file here'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--gray500)' }}>
                {file ? `${(file.size/1024).toFixed(0)} KB · Click to change` : 'Click to browse · .xlsx, .xls, .csv accepted'}
              </div>
            </div>

            {importResult && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: statusBg(importResult.type), border: `1px solid`, borderColor: importResult.type==='success'?'var(--g100)':importResult.type==='error'?'#f5c6c2':'var(--blueL)', borderRadius: 7, fontSize: 12, color: statusColor(importResult.type) }}>
                {importResult.msg}
              </div>
            )}

            {preview && (
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={handleImport} disabled={importing}>
                {importing ? 'Importing...' : `Import ${preview.length}+ rows as ${activeT?.name}`}
              </button>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div className="card">
              <div className="card-header"><span className="card-title">Preview — first 5 rows</span></div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: 11 }}>
                  <thead><tr>{Object.keys(preview[0]).slice(0, 8).map(k => <th key={k} style={{ fontSize: 9 }}>{k}</th>)}</tr></thead>
                  <tbody>{preview.map((row, i) => <tr key={i}>{Object.values(row).slice(0, 8).map((v, j) => <td key={j}>{String(v).slice(0, 30) || '—'}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div>
          {/* TEMPLATES */}
          <div className="card">
            <div className="card-header"><span className="card-title">Download templates</span></div>
            <p style={{ fontSize: 12, color: 'var(--gray500)', marginBottom: 14 }}>Download a pre-formatted Excel template, fill in your data, and import above.</p>
            {TEMPLATES.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--gray100)' }}>
                <div style={{ width: 36, height: 36, background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{t.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--g900)', marginBottom: 2 }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray500)' }}>{t.headers.join(', ')}</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => downloadTemplate(t)}>⬇ Template</button>
              </div>
            ))}
          </div>

          {/* EXPORTS */}
          <div className="card">
            <div className="card-header"><span className="card-title">Export data to Excel</span></div>
            <p style={{ fontSize: 12, color: 'var(--gray500)', marginBottom: 14 }}>Export any part of SOUL to a formatted Excel file for presentations, investors, or offline review.</p>
            {EXPORTS.map(e => (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--gray100)' }}>
                <div style={{ width: 36, height: 36, background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{e.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--g900)', marginBottom: 2 }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray500)' }}>{e.desc}</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => handleExport(e.id)} disabled={exporting === e.id}>
                  {exporting === e.id ? '...' : '⬆ Export'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
