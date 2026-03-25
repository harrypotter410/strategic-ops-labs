import { useState, useRef } from 'react'
import { useAssets, useFinancials } from '../hooks/useData'

const TEMPLATES = [
  { name: 'Asset List', desc: 'name, type, market, rooms, status, brand, year_acquired, acquisition_price, current_value', file: 'assets_template.csv' },
  { name: 'Monthly Financials', desc: 'asset_name, period_month, period_year, revenue, gop, noi, ebitda, occupancy, adr, revpar', file: 'financials_template.csv' },
]

function genCSV(type) {
  const headers = {
    assets: 'name,type,market,rooms,status,brand,year_acquired,acquisition_price,current_value\nExample Hotel,hotel,"Nashville, TN",200,active,Marriott,2020,45000000,55000000',
    financials: 'asset_name,period_month,period_year,revenue,gop,noi,ebitda,occupancy,adr,revpar\nExample Hotel,1,2026,2500000,1100000,850000,34,78,155,121',
  }
  return headers[type]
}

function downloadCSV(type, name) {
  const blob = new Blob([genCSV(type)], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

export default function Upload() {
  const [drag, setDrag] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [dataType, setDataType] = useState('financials')
  const [status, setStatus] = useState(null)
  const inputRef = useRef()
  const { addAsset } = useAssets()
  const { addFinancials } = useFinancials()

  const parseCSV = (text) => {
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g, ''))
      return Object.fromEntries(headers.map((h, i) => [h, vals[i]]))
    })
  }

  const handleFile = (f) => {
    if (!f) return
    setFile(f)
    setStatus(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const rows = parseCSV(e.target.result)
        setPreview(rows.slice(0, 5))
      } catch (err) {
        setStatus({ type: 'error', msg: 'Could not parse file. Please check the format.' })
      }
    }
    reader.readAsText(f)
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleImport = async () => {
    if (!preview) return
    setStatus({ type: 'loading', msg: 'Importing...' })
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const rows = parseCSV(e.target.result)
        if (dataType === 'assets') {
          for (const row of rows) {
            await addAsset({ name: row.name, type: row.type, market: row.market, rooms: Number(row.rooms) || null, status: row.status || 'active', brand: row.brand || null, year_acquired: Number(row.year_acquired) || null, acquisition_price: Number(row.acquisition_price) || null, current_value: Number(row.current_value) || null })
          }
        } else {
          setStatus({ type: 'info', msg: 'Financial import requires asset IDs. Use the API or manual entry for now.' })
          return
        }
        setStatus({ type: 'success', msg: `Imported ${rows.length} rows successfully.` })
        setFile(null); setPreview(null)
      }
      reader.readAsText(file)
    } catch (err) {
      setStatus({ type: 'error', msg: err.message })
    }
  }

  const statusColors = { success: 'var(--g600)', error: 'var(--red)', loading: 'var(--gray500)', info: 'var(--blue)' }

  return (
    <div>
      <div className="page-header">
        <h1>Data Import</h1>
        <p>Import assets, financials, and KPI data from Excel or CSV files</p>
      </div>

      <div className="grid-2">
        <div>
          <div className="card">
            <div className="card-header"><span className="card-title">Upload file</span></div>

            <div className="form-group">
              <label className="form-label">Data type</label>
              <select className="form-select" value={dataType} onChange={e => setDataType(e.target.value)}>
                <option value="assets">Asset list</option>
                <option value="financials">Monthly financials (P&L)</option>
              </select>
            </div>

            <div
              className={`upload-zone${drag ? ' drag' : ''}`}
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
              <div className="upload-zone-icon">📂</div>
              <div className="upload-zone-title">{file ? file.name : 'Drop your file here'}</div>
              <div className="upload-zone-desc">{file ? `${(file.size/1024).toFixed(1)} KB · Click to change` : 'CSV or Excel · Click to browse'}</div>
            </div>

            {status && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--gray50)', border: '1px solid var(--gray100)', borderRadius: 7, fontSize: 12, color: statusColors[status.type] }}>
                {status.msg}
              </div>
            )}

            {preview && (
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }} onClick={handleImport}>
                Import {preview.length}+ rows
              </button>
            )}
          </div>

          {preview && (
            <div className="card">
              <div className="card-header"><span className="card-title">Preview (first 5 rows)</span></div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead><tr>{Object.keys(preview[0]).map(k => <th key={k}>{k}</th>)}</tr></thead>
                  <tbody>{preview.map((row, i) => <tr key={i}>{Object.values(row).map((v, j) => <td key={j}>{v || '—'}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <div className="card-header"><span className="card-title">CSV templates</span></div>
            <p style={{ fontSize: 12, color: 'var(--gray500)', marginBottom: 16 }}>Download these templates, fill in your data, and upload above.</p>
            {[['assets', 'assets_template.csv', 'Asset List', 'name, type, market, rooms, status, brand, acquisition_price...'], ['financials', 'financials_template.csv', 'Monthly Financials', 'asset_name, period_month, period_year, revenue, noi, occupancy...']].map(([type, fname, label, desc]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--gray100)' }}>
                <div style={{ width: 36, height: 36, background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📋</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--g900)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray500)' }}>{desc}</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => downloadCSV(type, fname)}>Download</button>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">PMS integration</span></div>
            <p style={{ fontSize: 12, color: 'var(--gray500)', marginBottom: 16 }}>Connect directly to your property management system for automated data sync.</p>
            {[['Opera PMS', 'Oracle Hospitality'], ['Maestro', 'Northwind'], ['RMS Cloud', 'RMS'], ['Mews', 'Mews Systems']].map(([name, vendor]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray100)' }}>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--g900)' }}>{name}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray500)' }}>{vendor}</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => alert('PMS integration coming soon. Contact your admin to configure.')}>Configure</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
