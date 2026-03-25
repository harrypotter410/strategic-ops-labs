import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from 'recharts'

const fmtIdx = (n) => n ? parseFloat(n).toFixed(1) : '—'
const fmtPct = (n) => n ? `${parseFloat(n).toFixed(1)}%` : '—'
const fmtDollar = (n) => n ? `$${parseFloat(n).toFixed(0)}` : '—'
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const curYear = new Date().getFullYear()
const curMonth = new Date().getMonth() + 1

// Index status helpers
const idxColor = (v) => !v ? 'var(--gray500)' : v >= 105 ? 'var(--g600)' : v >= 95 ? 'var(--amber)' : 'var(--red)'
const idxBg = (v) => !v ? 'var(--gray100)' : v >= 105 ? 'var(--g100)' : v >= 95 ? 'var(--amberL)' : 'var(--redL)'
const idxLabel = (v) => !v ? '—' : v >= 105 ? 'Above' : v >= 95 ? 'Parity' : 'Below'

function useIntel() {
  const [compData, setCompData] = useState([])
  const [compSets, setCompSets] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const [cdRes, csRes] = await Promise.all([
      supabase.from('comp_data').select('*, assets(name, market, type)').order('period_year', { ascending: false }).order('period_month', { ascending: false }),
      supabase.from('comp_sets').select('*, assets(name, market)').order('sort_order'),
    ])
    setCompData(cdRes.data || [])
    setCompSets(csRes.data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const saveCompData = async (row) => {
    if (row.id) {
      const { data, error } = await supabase.from('comp_data').update(row).eq('id', row.id).select('*, assets(name, market, type)').single()
      if (!error) setCompData(prev => prev.map(r => r.id === row.id ? data : r))
      return { data, error }
    } else {
      const { data, error } = await supabase.from('comp_data').upsert(row, { onConflict: 'asset_id,period_month,period_year' }).select('*, assets(name, market, type)').single()
      if (!error) { setCompData(prev => { const exists = prev.find(r => r.asset_id === row.asset_id && r.period_month === row.period_month && r.period_year === row.period_year); return exists ? prev.map(r => r.asset_id === row.asset_id && r.period_month === row.period_month && r.period_year === row.period_year ? data : r) : [data, ...prev] })}
      return { data, error }
    }
  }

  const saveCompSet = async (cs) => {
    if (cs.id) {
      const { data, error } = await supabase.from('comp_sets').update(cs).eq('id', cs.id).select('*, assets(name, market)').single()
      if (!error) setCompSets(prev => prev.map(r => r.id === cs.id ? data : r))
      return { data, error }
    } else {
      const { data, error } = await supabase.from('comp_sets').insert(cs).select('*, assets(name, market)').single()
      if (!error) setCompSets(prev => [...prev, data])
      return { data, error }
    }
  }

  const removeCompSet = async (id) => {
    await supabase.from('comp_sets').delete().eq('id', id)
    setCompSets(prev => prev.filter(c => c.id !== id))
  }

  return { compData, compSets, loading, saveCompData, saveCompSet, removeCompSet, refetch: fetch }
}

// STR Import parser — handles common STR Excel export formats
function parseSTRData(rows) {
  const parsed = []
  for (const row of rows) {
    const keys = Object.keys(row).map(k => k.toLowerCase().trim())
    const get = (patterns) => {
      for (const p of patterns) {
        const key = keys.find(k => k.includes(p))
        if (key) { const orig = Object.keys(row).find(k => k.toLowerCase().trim() === key); return row[orig] }
      }
      return null
    }
    parsed.push({
      asset_name: get(['property','hotel','name']),
      period_month: parseInt(get(['month'])) || null,
      period_year: parseInt(get(['year'])) || null,
      my_occupancy: parseFloat(get(['my occ','subject occ','prop occ'])) || null,
      my_adr: parseFloat(get(['my adr','subject adr','prop adr'])) || null,
      my_revpar: parseFloat(get(['my revpar','subject revpar','prop revpar'])) || null,
      occ_index: parseFloat(get(['occ index','mpi'])) || null,
      adr_index: parseFloat(get(['adr index','ari'])) || null,
      revpar_index: parseFloat(get(['revpar index','rgi'])) || null,
      comp_set_occ: parseFloat(get(['comp occ','compset occ'])) || null,
      comp_set_adr: parseFloat(get(['comp adr','compset adr'])) || null,
      comp_set_revpar: parseFloat(get(['comp revpar','compset revpar'])) || null,
    })
  }
  return parsed.filter(r => r.asset_name)
}

function EntryModal({ entry, assets, onClose, onSave }) {
  const [form, setForm] = useState(entry ? { ...entry } : {
    asset_id: assets[0]?.id || '',
    period_month: curMonth, period_year: curYear,
    my_occupancy: '', my_adr: '', my_revpar: '',
    occ_index: '', adr_index: '', revpar_index: '',
    comp_set_occ: '', comp_set_adr: '', comp_set_revpar: '',
    notes: '', data_source: 'manual',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-calculate indices if we have both my data and comp data
  const calcIdx = (mine, comp) => mine && comp && parseFloat(comp) > 0 ? ((parseFloat(mine) / parseFloat(comp)) * 100).toFixed(1) : ''
  useEffect(() => {
    if (form.my_occupancy && form.comp_set_occ && !form.occ_index) set('occ_index', calcIdx(form.my_occupancy, form.comp_set_occ))
    if (form.my_adr && form.comp_set_adr && !form.adr_index) set('adr_index', calcIdx(form.my_adr, form.comp_set_adr))
    if (form.my_revpar && form.comp_set_revpar && !form.revpar_index) set('revpar_index', calcIdx(form.my_revpar, form.comp_set_revpar))
  }, [form.my_occupancy, form.my_adr, form.my_revpar, form.comp_set_occ, form.comp_set_adr, form.comp_set_revpar])

  const handleSubmit = async () => {
    if (!form.asset_id) { setError('Select an asset'); return }
    setLoading(true); setError('')
    const payload = {
      ...form,
      period_month: parseInt(form.period_month), period_year: parseInt(form.period_year),
      my_occupancy: form.my_occupancy ? parseFloat(form.my_occupancy) : null,
      my_adr: form.my_adr ? parseFloat(form.my_adr) : null,
      my_revpar: form.my_revpar ? parseFloat(form.my_revpar) : null,
      occ_index: form.occ_index ? parseFloat(form.occ_index) : null,
      adr_index: form.adr_index ? parseFloat(form.adr_index) : null,
      revpar_index: form.revpar_index ? parseFloat(form.revpar_index) : null,
      comp_set_occ: form.comp_set_occ ? parseFloat(form.comp_set_occ) : null,
      comp_set_adr: form.comp_set_adr ? parseFloat(form.comp_set_adr) : null,
      comp_set_revpar: form.comp_set_revpar ? parseFloat(form.comp_set_revpar) : null,
    }
    const { error } = await onSave(payload)
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onClose()
  }

  const rgi = form.revpar_index ? parseFloat(form.revpar_index) : null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 580 }}>
        <div className="modal-header">
          <span className="modal-title">{entry ? 'Edit Comp Data' : 'Enter Comp Data'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ background: 'var(--redL)', color: 'var(--red)', padding: '8px 12px', borderRadius: 7, fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <div className="form-group"><label className="form-label">Asset *</label>
          <select className="form-select" value={form.asset_id} onChange={e => set('asset_id', e.target.value)}>
            {assets.filter(a => a.type !== 'mixed' && a.type !== 'commercial').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Month</label>
            <select className="form-select" value={form.period_month} onChange={e => set('period_month', e.target.value)}>
              {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Year</label>
            <select className="form-select" value={form.period_year} onChange={e => set('period_year', e.target.value)}>
              {[curYear, curYear-1, curYear-2].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--g600)', margin: '8px 0 10px' }}>My Property</div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">My Occupancy (%)</label><input className="form-input" type="number" step="0.1" value={form.my_occupancy} onChange={e => set('my_occupancy', e.target.value)} placeholder="78.4" /></div>
          <div className="form-group"><label className="form-label">My ADR ($)</label><input className="form-input" type="number" step="0.01" value={form.my_adr} onChange={e => set('my_adr', e.target.value)} placeholder="182.50" /></div>
        </div>
        <div className="form-group"><label className="form-label">My RevPAR ($)</label><input className="form-input" type="number" step="0.01" value={form.my_revpar} onChange={e => set('my_revpar', e.target.value)} placeholder="143.00" /></div>

        <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--g600)', margin: '12px 0 10px' }}>Comp Set</div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Comp Set Occ (%)</label><input className="form-input" type="number" step="0.1" value={form.comp_set_occ} onChange={e => set('comp_set_occ', e.target.value)} placeholder="74.2" /></div>
          <div className="form-group"><label className="form-label">Comp Set ADR ($)</label><input className="form-input" type="number" step="0.01" value={form.comp_set_adr} onChange={e => set('comp_set_adr', e.target.value)} placeholder="162.00" /></div>
        </div>
        <div className="form-group"><label className="form-label">Comp Set RevPAR ($)</label><input className="form-input" type="number" step="0.01" value={form.comp_set_revpar} onChange={e => set('comp_set_revpar', e.target.value)} placeholder="120.00" /></div>

        <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--g600)', margin: '12px 0 10px' }}>STR Indices <span style={{ fontSize: 9, color: 'var(--gray500)', fontWeight: 400, textTransform: 'none' }}>— auto-calculated if you enter both my data and comp data above</span></div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">MPI (Occ Index)</label><input className="form-input" type="number" step="0.1" value={form.occ_index} onChange={e => set('occ_index', e.target.value)} placeholder="105.6" /></div>
          <div className="form-group"><label className="form-label">ARI (ADR Index)</label><input className="form-input" type="number" step="0.1" value={form.adr_index} onChange={e => set('adr_index', e.target.value)} placeholder="112.7" /></div>
        </div>
        <div className="form-group"><label className="form-label">RGI (RevPAR Index)</label><input className="form-input" type="number" step="0.1" value={form.revpar_index} onChange={e => set('revpar_index', e.target.value)} placeholder="116.2" /></div>

        {rgi !== null && (
          <div style={{ background: idxBg(rgi), border: '1px solid', borderColor: rgi >= 105 ? 'var(--g100)' : rgi >= 95 ? '#ffe082' : '#f5c6c2', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: idxColor(rgi), fontFamily: 'Playfair Display, serif' }}>{rgi.toFixed(1)}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: idxColor(rgi) }}>RGI — {idxLabel(rgi)} fair share</div>
              <div style={{ fontSize: 11, color: 'var(--gray500)' }}>{rgi >= 105 ? 'Capturing more than your fair share of RevPAR' : rgi >= 95 ? 'At or near fair share — monitor for trends' : 'Underperforming comp set — investigate'}</div>
            </div>
          </div>
        )}

        <div className="form-group" style={{ marginTop: 12 }}><label className="form-label">Source</label>
          <select className="form-select" value={form.data_source} onChange={e => set('data_source', e.target.value)}>
            <option value="manual">Manual entry</option>
            <option value="str">STR Report</option>
            <option value="costar">CoStar</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} /></div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Save Data'}</button>
        </div>
      </div>
    </div>
  )
}

function CompSetModal({ compSet, assets, onClose, onSave }) {
  const [form, setForm] = useState(compSet ? { ...compSet } : { asset_id: assets[0]?.id || '', comp_name: '', comp_brand: '', comp_market: '', comp_rooms: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.comp_name.trim()) return
    setLoading(true)
    await onSave({ ...form, comp_rooms: form.comp_rooms ? parseInt(form.comp_rooms) : null })
    setLoading(false); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <span className="modal-title">{compSet ? 'Edit Comp' : 'Add Comp'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-group"><label className="form-label">Asset</label>
          <select className="form-select" value={form.asset_id} onChange={e => set('asset_id', e.target.value)}>
            {assets.filter(a => a.type !== 'mixed' && a.type !== 'commercial').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Competitor Name *</label><input className="form-input" value={form.comp_name} onChange={e => set('comp_name', e.target.value)} placeholder="Marriott Memphis Downtown" /></div>
          <div className="form-group"><label className="form-label">Brand</label><input className="form-input" value={form.comp_brand} onChange={e => set('comp_brand', e.target.value)} placeholder="Marriott" /></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Market</label><input className="form-input" value={form.comp_market} onChange={e => set('comp_market', e.target.value)} placeholder="Memphis, TN" /></div>
          <div className="form-group"><label className="form-label">Rooms</label><input className="form-input" type="number" value={form.comp_rooms} onChange={e => set('comp_rooms', e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} /></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : compSet ? 'Save' : 'Add Comp'}</button>
        </div>
      </div>
    </div>
  )
}

function STRImport({ assets, onImport, onClose }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const loadXLSX = () => new Promise(resolve => {
    if (window.XLSX) { resolve(window.XLSX); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
    s.onload = () => resolve(window.XLSX)
    document.head.appendChild(s)
  })

  const handleFile = async (f) => {
    if (!f) return
    setFile(f)
    const XLSX = await loadXLSX()
    const reader = new FileReader()
    reader.onload = e => {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      setPreview(rows.slice(0, 3))
    }
    reader.readAsArrayBuffer(f)
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    const XLSX = await loadXLSX()
    const reader = new FileReader()
    reader.onload = async e => {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      const parsed = parseSTRData(rows)
      let imported = 0; let skipped = 0
      for (const row of parsed) {
        const asset = assets.find(a => a.name.toLowerCase().includes(row.asset_name.toLowerCase()) || row.asset_name.toLowerCase().includes(a.name.toLowerCase()))
        if (!asset || !row.period_month || !row.period_year) { skipped++; continue }
        const { error } = await supabase.from('comp_data').upsert({ asset_id: asset.id, ...row, asset_name: undefined }, { onConflict: 'asset_id,period_month,period_year' })
        error ? skipped++ : imported++
      }
      setResult({ imported, skipped })
      setImporting(false)
      if (imported > 0) onImport()
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 560 }}>
        <div className="modal-header">
          <span className="modal-title">Import STR Report</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--g700)', marginBottom: 14 }}>
          Export your STR report as Excel. SOUL will detect occupancy, ADR, RevPAR, and index columns automatically. Make sure the file has a "Property" or "Hotel" column and "Month"/"Year" columns.
        </div>
        <div style={{ border: '2px dashed var(--gray200)', borderRadius: 10, padding: 28, textAlign: 'center', cursor: 'pointer', background: 'var(--white)', marginBottom: 14 }}
          onClick={() => document.getElementById('str-input').click()}>
          <input id="str-input" type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--g900)', marginBottom: 3 }}>{file ? file.name : 'Click to upload STR Excel file'}</div>
          <div style={{ fontSize: 11, color: 'var(--gray500)' }}>.xlsx, .xls, .csv accepted</div>
        </div>
        {preview && (
          <div style={{ overflowX: 'auto', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--gray500)', marginBottom: 6 }}>Detected columns: {Object.keys(preview[0]).join(', ')}</div>
            <table className="data-table" style={{ fontSize: 10 }}>
              <thead><tr>{Object.keys(preview[0]).slice(0,6).map(k => <th key={k} style={{ fontSize: 9 }}>{k}</th>)}</tr></thead>
              <tbody>{preview.map((r,i) => <tr key={i}>{Object.values(r).slice(0,6).map((v,j) => <td key={j}>{String(v).slice(0,20)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
        {result && (
          <div style={{ background: result.imported > 0 ? 'var(--g50)' : 'var(--redL)', border: '1px solid', borderColor: result.imported > 0 ? 'var(--g100)' : '#f5c6c2', borderRadius: 7, padding: '10px 14px', fontSize: 12, color: result.imported > 0 ? 'var(--g700)' : 'var(--red)', marginBottom: 12 }}>
            {result.imported > 0 ? `✓ Imported ${result.imported} months of data.` : 'Import failed.'} {result.skipped > 0 ? `${result.skipped} rows skipped (check property names match your assets).` : ''}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>{result ? 'Close' : 'Cancel'}</button>
          {file && !result && <button className="btn btn-primary" onClick={handleImport} disabled={importing}>{importing ? 'Importing...' : 'Import Data'}</button>}
        </div>
      </div>
    </div>
  )
}

export default function Intel() {
  const { compData, compSets, loading, saveCompData, saveCompSet, removeCompSet, refetch } = useIntel()
  const { assets } = useAssets()
  const [selAsset, setSelAsset] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard') // dashboard | trends | compset | entry | history
  const [entryModal, setEntryModal] = useState(null)
  const [compSetModal, setCompSetModal] = useState(null)
  const [strModal, setSTRModal] = useState(false)
  const [editEntry, setEditEntry] = useState(null)

  const hotelAssets = assets.filter(a => a.type !== 'mixed' && a.type !== 'commercial')

  // Set default selected asset
  useEffect(() => { if (hotelAssets.length > 0 && !selAsset) setSelAsset(hotelAssets[0].id) }, [hotelAssets])

  const assetData = compData.filter(d => d.asset_id === selAsset).sort((a,b) => a.period_year !== b.period_year ? a.period_year - b.period_year : a.period_month - b.period_month)
  const latestData = assetData[assetData.length - 1]
  const prevData = assetData[assetData.length - 2]
  const assetCompSets = compSets.filter(c => c.asset_id === selAsset)
  const selAssetObj = assets.find(a => a.id === selAsset)

  // Portfolio-wide latest RGI
  const portfolioRGI = {}
  for (const asset of hotelAssets) {
    const latest = compData.filter(d => d.asset_id === asset.id).sort((a,b) => a.period_year !== b.period_year ? b.period_year - a.period_year : b.period_month - a.period_month)[0]
    if (latest) portfolioRGI[asset.id] = { ...latest, name: asset.name }
  }

  // Trend data for chart
  const trendData = assetData.slice(-12).map(d => ({
    label: `${MONTHS[d.period_month-1]} ${String(d.period_year).slice(2)}`,
    rgi: d.revpar_index ? parseFloat(d.revpar_index) : null,
    mpi: d.occ_index ? parseFloat(d.occ_index) : null,
    ari: d.adr_index ? parseFloat(d.adr_index) : null,
  }))

  // Alerts — assets with RGI < 95 in latest data
  const alerts = Object.values(portfolioRGI).filter(d => d.revpar_index && parseFloat(d.revpar_index) < 95)

  // MoM change
  const change = (curr, prev) => curr && prev ? (parseFloat(curr) - parseFloat(prev)).toFixed(1) : null
  const rgiChange = latestData && prevData ? change(latestData.revpar_index, prevData.revpar_index) : null

  const ts = (t) => ({ fontSize: 12, padding: '6px 14px', borderRadius: 20, border: '1px solid', cursor: 'pointer', borderColor: activeTab===t?'var(--g600)':'var(--gray200)', background: activeTab===t?'var(--g700)':'var(--white)', color: activeTab===t?'var(--white)':'var(--gray700)' })

  if (loading) return <div className="loading">Loading competitive intel...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Competitive Intel</h1>
        <p>STR index tracking and comp set benchmarking by asset</p>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ background: 'var(--redL)', border: '1px solid #f5c6c2', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--red)', marginBottom: 4 }}>⚠ Below fair share alert</div>
          {alerts.map(a => (
            <div key={a.asset_id} style={{ fontSize: 12, color: 'var(--red)' }}><strong>{a.name}</strong> — RGI {parseFloat(a.revpar_index).toFixed(1)} ({MONTHS[a.period_month-1]} {a.period_year})</div>
          ))}
        </div>
      )}

      {/* Portfolio RGI overview */}
      <div className="kpi-grid" style={{ gridTemplateColumns: `repeat(${Math.min(hotelAssets.length, 4)}, minmax(0,1fr))` }}>
        {hotelAssets.slice(0,4).map(a => {
          const d = portfolioRGI[a.id]
          return (
            <div key={a.id} className="kpi-card" style={{ cursor: 'pointer', borderTop: selAsset === a.id ? '3px solid var(--brass, #c9a96e)' : undefined }} onClick={() => { setSelAsset(a.id); setActiveTab('dashboard') }}>
              <div className="kpi-label" style={{ fontSize: 9 }}>{a.name.split(' ').slice(0,2).join(' ')}</div>
              <div className="kpi-value" style={{ fontSize: 20, color: d?.revpar_index ? idxColor(parseFloat(d.revpar_index)) : 'var(--gray300)' }}>{d?.revpar_index ? parseFloat(d.revpar_index).toFixed(1) : '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--gray500)' }}>RGI · {d ? `${MONTHS[d.period_month-1]} ${d.period_year}` : 'No data'}</div>
            </div>
          )
        })}
      </div>

      {/* Asset selector + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {hotelAssets.map(a => (
            <button key={a.id} className={`filter-tab${selAsset===a.id?' active':''}`} onClick={() => setSelAsset(a.id)}>
              {a.name.split(' ').slice(0,2).join(' ')}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setSTRModal(true)}>📊 Import STR</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setCompSetModal({})}>+ Comp</button>
          <button className="btn btn-primary btn-sm" onClick={() => setEntryModal({})}>+ Enter Data</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['dashboard','Dashboard'],['trends','Index Trends'],['compset','Comp Set'],['history','Data History']].map(([t,l]) => (
          <button key={t} style={ts(t)} onClick={() => setActiveTab(t)}>{l}</button>
        ))}
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <>
          {!latestData ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">No comp data yet for {selAssetObj?.name}</div>
              <div className="empty-state-desc">Enter your STR data manually or import an STR report to start tracking competitive performance.</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
                <button className="btn btn-secondary" onClick={() => setSTRModal(true)}>📊 Import STR</button>
                <button className="btn btn-primary" onClick={() => setEntryModal({})}>+ Enter Data Manually</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--gray500)', marginBottom: 12 }}>Latest data: <strong style={{ color: 'var(--g900)' }}>{MONTHS[latestData.period_month-1]} {latestData.period_year}</strong> · Source: {latestData.data_source || 'manual'}</div>

              {/* STR Index cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
                {[
                  { label: 'MPI — Occ. Index', val: latestData.occ_index, prev: prevData?.occ_index, mine: latestData.my_occupancy, comp: latestData.comp_set_occ, unit: '%' },
                  { label: 'ARI — ADR Index', val: latestData.adr_index, prev: prevData?.adr_index, mine: latestData.my_adr, comp: latestData.comp_set_adr, unit: '$' },
                  { label: 'RGI — RevPAR Index', val: latestData.revpar_index, prev: prevData?.revpar_index, mine: latestData.my_revpar, comp: latestData.comp_set_revpar, unit: '$' },
                ].map(({ label, val, prev, mine, comp, unit }) => {
                  const v = val ? parseFloat(val) : null
                  const ch = val && prev ? (parseFloat(val) - parseFloat(prev)).toFixed(1) : null
                  return (
                    <div key={label} style={{ background: v ? idxBg(v) : 'var(--gray50)', border: '1px solid', borderColor: v ? (v >= 105 ? 'var(--g100)' : v >= 95 ? '#ffe082' : '#f5c6c2') : 'var(--gray100)', borderRadius: 12, padding: '18px 20px' }}>
                      <div style={{ fontSize: 10, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>{label}</div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 36, fontWeight: 700, fontFamily: 'Playfair Display, serif', color: v ? idxColor(v) : 'var(--gray300)', lineHeight: 1 }}>{v ? v.toFixed(1) : '—'}</div>
                        {ch && <div style={{ fontSize: 12, fontWeight: 500, color: parseFloat(ch) >= 0 ? 'var(--g600)' : 'var(--red)', marginBottom: 4 }}>{parseFloat(ch) >= 0 ? '+' : ''}{ch} MoM</div>}
                      </div>
                      {/* Fair share line */}
                      <div style={{ height: 6, background: 'rgba(0,0,0,0.08)', borderRadius: 3, marginBottom: 8, position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '50%', top: -2, width: 2, height: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 1 }} title="Fair share = 100" />
                        {v && <div style={{ height: '100%', width: `${Math.min(v/120*100, 100)}%`, background: idxColor(v), borderRadius: 3 }} />}
                      </div>
                      {mine && comp && (
                        <div style={{ fontSize: 11, color: 'var(--gray500)' }}>
                          Mine: <strong style={{ color: 'var(--g900)' }}>{unit === '$' ? `$${parseFloat(mine).toFixed(0)}` : `${parseFloat(mine).toFixed(1)}%`}</strong> · Comp: {unit === '$' ? `$${parseFloat(comp).toFixed(0)}` : `${parseFloat(comp).toFixed(1)}%`}
                        </div>
                      )}
                      <div style={{ fontSize: 11, fontWeight: 500, color: idxColor(v) || 'var(--gray500)', marginTop: 4 }}>{v ? idxLabel(v) + ' fair share' : 'No data'}</div>
                    </div>
                  )
                })}
              </div>

              {/* Cross-portfolio ranking */}
              {Object.keys(portfolioRGI).length > 1 && (
                <div className="card">
                  <div className="card-header"><span className="card-title">Portfolio RGI ranking</span></div>
                  <div>
                    {Object.values(portfolioRGI).sort((a,b) => (parseFloat(b.revpar_index||0)) - (parseFloat(a.revpar_index||0))).map((d, i) => (
                      <div key={d.asset_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--gray100)' }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? 'var(--g100)' : 'var(--gray100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: i === 0 ? 'var(--g700)' : 'var(--gray500)', flexShrink: 0 }}>#{i+1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--g900)' }}>{d.name}</div>
                          <div style={{ height: 4, background: 'var(--gray100)', borderRadius: 2, marginTop: 4, width: '100%' }}>
                            <div style={{ height: '100%', borderRadius: 2, background: idxColor(parseFloat(d.revpar_index)), width: `${Math.min(parseFloat(d.revpar_index)/130*100, 100)}%` }} />
                          </div>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: idxColor(parseFloat(d.revpar_index)), fontFamily: 'Playfair Display, serif', minWidth: 48, textAlign: 'right' }}>{parseFloat(d.revpar_index).toFixed(1)}</div>
                        <div style={{ fontSize: 9, padding: '2px 7px', borderRadius: 10, background: idxBg(parseFloat(d.revpar_index)), color: idxColor(parseFloat(d.revpar_index)), fontWeight: 500 }}>{idxLabel(parseFloat(d.revpar_index))}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* TRENDS TAB */}
      {activeTab === 'trends' && (
        <>
          {trendData.length < 2 ? (
            <div className="empty-state"><div className="empty-state-title">Not enough data for trends</div><div className="empty-state-desc">Enter at least 2 months of data to see trend charts.</div></div>
          ) : (
            <>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">RGI trend — {selAssetObj?.name}</span>
                  <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--gray500)', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, background: '#2a6e47', display: 'inline-block', borderRadius: 2 }}></span>RGI</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 3, background: '#c9a96e', display: 'inline-block', borderRadius: 2, borderTop: '1px dashed #c9a96e' }}></span>Fair Share (100)</span>
                  </div>
                </div>
                <div style={{ position: 'relative', height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} domain={[80, 130]} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                      <ReferenceLine y={100} stroke="#c9a96e" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="rgi" stroke="#2a6e47" strokeWidth={2.5} dot={{ r: 4, fill: '#2a6e47' }} name="RGI" connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid-2">
                <div className="card">
                  <div className="card-header"><span className="card-title">MPI (Occ. Index) trend</span></div>
                  <div style={{ position: 'relative', height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} domain={[80, 130]} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                        <ReferenceLine y={100} stroke="#c9a96e" strokeDasharray="4 4" />
                        <Line type="monotone" dataKey="mpi" stroke="#4a9e6e" strokeWidth={2} dot={{ r: 3 }} name="MPI" connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="card">
                  <div className="card-header"><span className="card-title">ARI (ADR Index) trend</span></div>
                  <div style={{ position: 'relative', height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} domain={[80, 130]} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                        <ReferenceLine y={100} stroke="#c9a96e" strokeDasharray="4 4" />
                        <Line type="monotone" dataKey="ari" stroke="#163d27" strokeWidth={2} dot={{ r: 3 }} name="ARI" connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Market share gains/losses */}
              {trendData.filter(d => d.rgi).length >= 2 && (
                <div className="card">
                  <div className="card-header"><span className="card-title">Month-over-month RGI changes</span></div>
                  <div style={{ position: 'relative', height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData.filter(d => d.rgi).map((d, i, arr) => ({ label: d.label, change: i > 0 && arr[i-1].rgi ? parseFloat((d.rgi - arr[i-1].rgi).toFixed(1)) : null })).filter(d => d.change !== null)}>
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#7a817a' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={v => [`${v > 0 ? '+' : ''}${v}`, 'RGI Change']} contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                        <ReferenceLine y={0} stroke="var(--gray200)" />
                        <Bar dataKey="change" radius={[3, 3, 0, 0]}>
                          {trendData.filter(d => d.rgi).map((d, i, arr) => i > 0 && arr[i-1].rgi ? (
                            <Cell key={i} fill={(d.rgi - arr[i-1].rgi) >= 0 ? '#2a6e47' : '#c0392b'} />
                          ) : <Cell key={i} fill="transparent" />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* COMP SET TAB */}
      {activeTab === 'compset' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Comp set — {selAssetObj?.name}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setCompSetModal({ asset_id: selAsset })}>+ Add Comp</button>
          </div>
          {assetCompSets.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No comp set defined</div>
              <div className="empty-state-desc">Add the hotels that compete with {selAssetObj?.name} in its market.</div>
              <button className="btn btn-primary" onClick={() => setCompSetModal({ asset_id: selAsset })}>+ Add Comp Hotel</button>
            </div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Hotel</th><th>Brand</th><th>Market</th><th>Rooms</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {assetCompSets.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.comp_name}</strong></td>
                    <td style={{ color: 'var(--gray500)' }}>{c.comp_brand || '—'}</td>
                    <td>{c.comp_market || '—'}</td>
                    <td>{c.comp_rooms || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--gray500)' }}>{c.notes || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="card-action" onClick={() => setCompSetModal(c)}>Edit</button>
                        <button className="card-action" style={{ color: 'var(--red)' }} onClick={() => removeCompSet(c.id)}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Data history — {selAssetObj?.name}</span>
            <button className="btn btn-primary btn-sm" onClick={() => setEntryModal({})}>+ Add Month</button>
          </div>
          {assetData.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No data yet</div>
              <div className="empty-state-desc">Enter your STR data month by month or import an STR report.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead><tr>
                  <th>Period</th><th>My Occ.</th><th>My ADR</th><th>My RevPAR</th>
                  <th>Comp RevPAR</th><th>MPI</th><th>ARI</th><th>RGI</th><th>Source</th><th></th>
                </tr></thead>
                <tbody>
                  {[...assetData].reverse().map(d => (
                    <tr key={d.id}>
                      <td><strong>{MONTHS[d.period_month-1]} {d.period_year}</strong></td>
                      <td>{fmtPct(d.my_occupancy)}</td>
                      <td>{fmtDollar(d.my_adr)}</td>
                      <td>{fmtDollar(d.my_revpar)}</td>
                      <td>{fmtDollar(d.comp_set_revpar)}</td>
                      <td style={{ color: d.occ_index ? idxColor(parseFloat(d.occ_index)) : 'var(--gray500)', fontWeight: d.occ_index ? 500 : 400 }}>{fmtIdx(d.occ_index)}</td>
                      <td style={{ color: d.adr_index ? idxColor(parseFloat(d.adr_index)) : 'var(--gray500)', fontWeight: d.adr_index ? 500 : 400 }}>{fmtIdx(d.adr_index)}</td>
                      <td style={{ color: d.revpar_index ? idxColor(parseFloat(d.revpar_index)) : 'var(--gray500)', fontWeight: d.revpar_index ? 500 : 400 }}>{fmtIdx(d.revpar_index)}</td>
                      <td style={{ fontSize: 10, color: 'var(--gray500)' }}>{d.data_source || 'manual'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="card-action" onClick={() => { setEditEntry(d); setEntryModal(d) }}>Edit</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {entryModal !== null && <EntryModal entry={entryModal?.id ? entryModal : null} assets={hotelAssets} onClose={() => { setEntryModal(null); setEditEntry(null) }} onSave={saveCompData} />}
      {compSetModal !== null && <CompSetModal compSet={compSetModal?.id ? compSetModal : null} assets={hotelAssets} onClose={() => setCompSetModal(null)} onSave={saveCompSet} />}
      {strModal && <STRImport assets={hotelAssets} onImport={refetch} onClose={() => setSTRModal(false)} />}
    </div>
  )
}
