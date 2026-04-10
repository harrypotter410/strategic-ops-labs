import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

// ── Constants ────────────────────────────────────────────────────────────────

const IMPORT_TYPES = [
  { value: '', label: 'Select import type…' },
  { value: 'pl', label: 'Monthly P&L (Financial Report)' },
  { value: 'str', label: 'STR Report (Competitive Benchmarking)' },
  { value: 'appraisal', label: 'Appraisal / Valuation' },
  { value: 'loan', label: 'Loan / Debt Document' },
  { value: 'franchise', label: 'Franchise / Management Agreement' },
]

const SYSTEM_PROMPTS = {
  pl: 'You are extracting hotel financial data from an operator P&L report. Return ONLY a JSON array where each element has: property_name, period_month (1-12), period_year (4 digits), revenue (number in dollars), gop (gross operating profit, number), noi (net operating income, number), occupancy (percentage as decimal e.g. 0.78), adr (average daily rate, number), revpar (number). If a field is not found return null. Return only valid JSON, no other text.',
  str: 'You are extracting hotel competitive benchmarking data from an STR report. Return ONLY a JSON array where each element has: property_name, period_month (1-12), period_year (4 digits), my_occupancy (decimal), my_adr (number), my_revpar (number), comp_set_occ (decimal), comp_set_adr (number), comp_set_revpar (number), occ_index (MPI, number e.g. 107.3), adr_index (ARI, number), revpar_index (RGI, number). Return only valid JSON, no other text.',
  appraisal: 'You are extracting data from a real estate appraisal report. Return ONLY a JSON object with: property_name, valuation_date (YYYY-MM-DD), appraised_value (number in dollars), cap_rate_applied (percentage as decimal e.g. 0.065), noi_used (number), equity_value (number or null), notes (brief string summarizing key findings, max 200 chars). Return only valid JSON, no other text.',
  loan: 'You are extracting data from a commercial real estate loan document or term sheet. Return ONLY a JSON object with: property_name, lender, loan_type (one of: senior, mezzanine, bridge, permanent, construction, preferred_equity), original_balance (number), current_balance (number or null), interest_rate (percentage as a number e.g. 5.75 for 5.75%, NOT 0.0575), rate_type (fixed or floating), maturity_date (YYYY-MM-DD), annual_debt_service (number or null), ltv (percentage as a number e.g. 65 for 65%, NOT 0.65, or null), covenant_dscr_min (number or null), covenant_ltv_max (percentage as a number e.g. 75 for 75%, or null), covenant_occupancy_min (percentage as a number e.g. 60 for 60%, or null). Return only valid JSON, no other text.',
  franchise: 'You are extracting data from a hotel franchise agreement or management contract. Return ONLY a JSON object with: property_name, franchise_expiry (YYYY-MM-DD or null), franchise_fee_pct (decimal or null), pip_cost_estimate (number in dollars or null), pip_deadline (YYYY-MM-DD or null), management_company (string or null), management_fee_pct (decimal or null), mgmt_contract_expiry (YYYY-MM-DD or null). Return only valid JSON, no other text.',
}

// Types that return an array of rows (vs. a single object)
const ARRAY_TYPES = new Set(['pl', 'str'])

const FIELD_DEFS = {
  pl: [
    { key: 'property_name', label: 'Property' },
    { key: 'period_month',  label: 'Month' },
    { key: 'period_year',   label: 'Year' },
    { key: 'revenue',       label: 'Revenue ($)' },
    { key: 'gop',           label: 'GOP ($)' },
    { key: 'noi',           label: 'NOI ($)' },
    { key: 'occupancy',     label: 'Occupancy' },
    { key: 'adr',           label: 'ADR ($)' },
    { key: 'revpar',        label: 'RevPAR ($)' },
  ],
  str: [
    { key: 'property_name',   label: 'Property' },
    { key: 'period_month',    label: 'Month' },
    { key: 'period_year',     label: 'Year' },
    { key: 'my_occupancy',    label: 'My Occ' },
    { key: 'my_adr',          label: 'My ADR' },
    { key: 'my_revpar',       label: 'My RevPAR' },
    { key: 'comp_set_occ',    label: 'Comp Occ' },
    { key: 'comp_set_adr',    label: 'Comp ADR' },
    { key: 'comp_set_revpar', label: 'Comp RevPAR' },
    { key: 'occ_index',       label: 'MPI' },
    { key: 'adr_index',       label: 'ARI' },
    { key: 'revpar_index',    label: 'RGI' },
  ],
  appraisal: [
    { key: 'property_name',    label: 'Property Name' },
    { key: 'valuation_date',   label: 'Valuation Date (YYYY-MM-DD)' },
    { key: 'appraised_value',  label: 'Appraised Value ($)' },
    { key: 'cap_rate_applied', label: 'Cap Rate (decimal, e.g. 0.065)' },
    { key: 'noi_used',         label: 'NOI Used ($)' },
    { key: 'equity_value',     label: 'Equity Value ($)' },
    { key: 'notes',            label: 'Notes' },
  ],
  loan: [
    { key: 'property_name',          label: 'Property Name' },
    { key: 'lender',                 label: 'Lender' },
    { key: 'loan_type',              label: 'Loan Type' },
    { key: 'original_balance',       label: 'Original Balance ($)' },
    { key: 'current_balance',        label: 'Current Balance ($)' },
    { key: 'interest_rate',          label: 'Interest Rate (%, e.g. 5.75)' },
    { key: 'rate_type',              label: 'Rate Type (fixed/floating)' },
    { key: 'maturity_date',          label: 'Maturity Date (YYYY-MM-DD)' },
    { key: 'annual_debt_service',    label: 'Annual Debt Service ($)' },
    { key: 'ltv',                    label: 'LTV (%, e.g. 65)' },
    { key: 'covenant_dscr_min',      label: 'DSCR Min Covenant' },
    { key: 'covenant_ltv_max',       label: 'LTV Max Covenant (%, e.g. 75)' },
    { key: 'covenant_occupancy_min', label: 'Occ Min Covenant (%, e.g. 60)' },
  ],
  franchise: [
    { key: 'property_name',       label: 'Property Name' },
    { key: 'franchise_expiry',    label: 'Franchise Expiry (YYYY-MM-DD)' },
    { key: 'franchise_fee_pct',   label: 'Franchise Fee % (decimal)' },
    { key: 'pip_cost_estimate',   label: 'PIP Cost Estimate ($)' },
    { key: 'pip_deadline',        label: 'PIP Deadline (YYYY-MM-DD)' },
    { key: 'management_company',  label: 'Management Company' },
    { key: 'management_fee_pct',  label: 'Mgmt Fee % (decimal)' },
    { key: 'mgmt_contract_expiry',label: 'Mgmt Contract Expiry (YYYY-MM-DD)' },
  ],
}

const SUCCESS_LINKS = {
  pl:        { label: 'View Financial Performance', path: '/financial' },
  str:       { label: 'View STR Benchmark', path: '/str-benchmark' },
  appraisal: { label: 'View Valuations', path: '/valuations' },
  loan:      { label: 'View Debt Tracker', path: '/debt' },
  franchise: { label: 'View Assets', path: '/assets' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function fuzzyScore(a, b) {
  if (!a || !b) return 0
  const al = a.toLowerCase(), bl = b.toLowerCase()
  if (al === bl) return 1
  if (al.includes(bl) || bl.includes(al)) return 0.8
  const aWords = al.split(/[\s,\-_]+/).filter(w => w.length > 2)
  const bWords = bl.split(/[\s,\-_]+/).filter(w => w.length > 2)
  if (!aWords.length || !bWords.length) return 0
  const hits = aWords.filter(w => bWords.some(bw => bw.includes(w) || w.includes(bw)))
  return hits.length / Math.max(aWords.length, bWords.length)
}

function findBestMatch(assets, propertyName) {
  if (!propertyName || !assets.length) return null
  let best = null, bestScore = 0
  for (const a of assets) {
    const s = fuzzyScore(a.name, propertyName)
    if (s > bestScore) { bestScore = s; best = a }
  }
  return bestScore >= 0.3 ? best : null
}

async function readFileContent(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (ext === 'pdf') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve({ type: 'pdf', data: e.target.result.split(',')[1] })
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
  // Excel or CSV
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const sheets = wb.SheetNames.map(name => {
          const ws = wb.Sheets[name]
          return `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(ws)}`
        })
        resolve({ type: 'text', data: sheets.join('\n\n') })
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

async function callClaude(importType, fileContent) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set')

  const userContent = fileContent.type === 'pdf'
    ? [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: fileContent.data },
        },
        { type: 'text', text: 'Extract the data from this document and return it as JSON per your instructions.' },
      ]
    : [{ type: 'text', text: `Here is the document content:\n\n${fileContent.data}` }]

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'anthropic-beta': 'pdfs-2024-09-25',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: SYSTEM_PROMPTS[importType],
      messages: [{ role: 'user', content: userContent }],
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error?.message || `API error ${res.status}`)
  }

  const json = await res.json()
  const text = (json.content[0]?.text || '').trim()
  // Strip accidental markdown fences
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
  return JSON.parse(cleaned)
}

// ── Save helpers ─────────────────────────────────────────────────────────────

function parseNum(v) {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

async function saveData(importType, assetId, editedData) {
  if (importType === 'pl') {
    const rows = editedData.map(row => ({
      asset_id:     assetId,
      period_month: parseInt(row.period_month) || null,
      period_year:  parseInt(row.period_year)  || null,
      revenue:      parseNum(row.revenue),
      gop:          parseNum(row.gop),
      noi:          parseNum(row.noi),
      occupancy:    parseNum(row.occupancy),
      adr:          parseNum(row.adr),
      revpar:       parseNum(row.revpar),
    }))
    const { error } = await supabase.from('financials').insert(rows)
    if (error) throw error
    return { desc: `${rows.length} month(s) of financial data`, table: 'financials' }
  }

  if (importType === 'str') {
    const rows = editedData.map(row => ({
      asset_id:        assetId,
      period_month:    parseInt(row.period_month) || null,
      period_year:     parseInt(row.period_year)  || null,
      my_occupancy:    parseNum(row.my_occupancy),
      my_adr:          parseNum(row.my_adr),
      my_revpar:       parseNum(row.my_revpar),
      comp_set_occ:    parseNum(row.comp_set_occ),
      comp_set_adr:    parseNum(row.comp_set_adr),
      comp_set_revpar: parseNum(row.comp_set_revpar),
      occ_index:       parseNum(row.occ_index),
      adr_index:       parseNum(row.adr_index),
      revpar_index:    parseNum(row.revpar_index),
    }))
    const { error } = await supabase.from('comp_data').insert(rows)
    if (error) throw error
    return { desc: `${rows.length} STR period(s)`, table: 'comp_data' }
  }

  if (importType === 'appraisal') {
    const d = editedData
    const date = d.valuation_date ? new Date(d.valuation_date) : new Date()
    const quarter = Math.ceil((date.getMonth() + 1) / 3)
    const { error } = await supabase.from('valuations').insert({
      asset_id:         assetId,
      valuation_date:   d.valuation_date || null,
      quarter,
      year:             date.getFullYear(),
      appraised_value:  parseNum(d.appraised_value),
      cap_rate_applied: parseNum(d.cap_rate_applied),
      noi_trailing:     parseNum(d.noi_used),
      equity_value:     parseNum(d.equity_value),
      valuation_notes:  d.notes || null,
    })
    if (error) throw error
    return { desc: 'Valuation record', table: 'valuations' }
  }

  if (importType === 'loan') {
    const d = editedData
    // Normalize percentage fields: if value looks like a decimal (< 1), convert to percentage
    const normPct = (v) => { const n = parseNum(v); return n !== null && n < 1 ? n * 100 : n }
    const { error } = await supabase.from('asset_debt').insert({
      asset_id:               assetId,
      lender:                 d.lender || null,
      loan_type:              d.loan_type || null,
      original_balance:       parseNum(d.original_balance),
      current_balance:        parseNum(d.current_balance),
      interest_rate:          normPct(d.interest_rate),
      rate_type:              d.rate_type || null,
      maturity_date:          d.maturity_date || null,
      debt_service_annual:    parseNum(d.annual_debt_service),
      ltv:                    normPct(d.ltv),
      covenant_dscr_min:      parseNum(d.covenant_dscr_min),
      covenant_ltv_max:       normPct(d.covenant_ltv_max),
      covenant_occupancy_min: normPct(d.covenant_occupancy_min),
    })
    if (error) throw error
    return { desc: 'Debt record', table: 'asset_debt' }
  }

  if (importType === 'franchise') {
    const d = editedData
    const { error } = await supabase.from('assets').update({
      franchise_expiry:    d.franchise_expiry    || null,
      franchise_fee_pct:   parseNum(d.franchise_fee_pct),
      pip_cost_estimate:   parseNum(d.pip_cost_estimate),
      pip_deadline:        d.pip_deadline        || null,
      management_company:  d.management_company  || null,
      management_fee_pct:  parseNum(d.management_fee_pct),
      mgmt_contract_expiry: d.mgmt_contract_expiry || null,
    }).eq('id', assetId)
    if (error) throw error
    return { desc: 'Asset franchise/management fields updated', table: 'assets' }
  }

  throw new Error('Unknown import type')
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Import() {
  const navigate = useNavigate()
  const { assets } = useAssets()

  const [file, setFile]             = useState(null)
  const [importType, setImportType] = useState('')
  const [step, setStep]             = useState('upload') // upload | extracting | preview | saving | success
  const [editedData, setEditedData] = useState(null)
  const [selectedAssetId, setSelectedAssetId] = useState('')
  const [error, setError]           = useState('')
  const [saveResult, setSaveResult] = useState(null)
  const [dragOver, setDragOver]     = useState(false)
  const fileInputRef = useRef(null)

  const isArrayType = ARRAY_TYPES.has(importType)
  const fields = FIELD_DEFS[importType] || []

  // ── File handling ──────────────────────────────────────────────────────────

  const acceptFile = (f) => {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'csv', 'pdf'].includes(ext)) {
      setError('Unsupported file type. Please use .xlsx, .xls, .csv, or .pdf')
      return
    }
    setFile(f)
    setError('')
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    acceptFile(e.dataTransfer.files[0])
  }, [])

  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragOver(true) }, [])
  const onDragLeave = useCallback(() => setDragOver(false), [])

  // ── Extract ────────────────────────────────────────────────────────────────

  const handleExtract = async () => {
    if (!file || !importType) return
    setStep('extracting')
    setError('')
    try {
      const fileContent = await readFileContent(file)
      const raw = await callClaude(importType, fileContent)

      // Normalize to array or object
      const normalized = isArrayType
        ? (Array.isArray(raw) ? raw : [raw]).map(r => ({ ...r }))
        : { ...raw }

      setEditedData(normalized)

      // Auto-select best-matching asset
      const propertyName = Array.isArray(normalized)
        ? normalized[0]?.property_name
        : normalized?.property_name
      const match = findBestMatch(assets, propertyName)
      if (match) setSelectedAssetId(match.id)

      setStep('preview')
    } catch (err) {
      setError(`Extraction failed: ${err.message}`)
      setStep('upload')
    }
  }

  // ── Edit ───────────────────────────────────────────────────────────────────

  const updateRow = (rowIdx, key, val) =>
    setEditedData(prev => prev.map((r, i) => i === rowIdx ? { ...r, [key]: val } : r))

  const updateField = (key, val) =>
    setEditedData(prev => ({ ...prev, [key]: val }))

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedAssetId) { setError('Please select an asset to link this data to'); return }
    setStep('saving')
    setError('')
    try {
      const result = await saveData(importType, selectedAssetId, editedData)
      const asset = assets.find(a => a.id === selectedAssetId)
      setSaveResult({ ...result, assetName: asset?.name })
      setStep('success')
    } catch (err) {
      setError(`Save failed: ${err.message}`)
      setStep('preview')
    }
  }

  const handleReset = () => {
    setFile(null)
    setImportType('')
    setStep('upload')
    setEditedData(null)
    setSelectedAssetId('')
    setError('')
    setSaveResult(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isNull = (v) => v === null || v === undefined || v === ''

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Import Data</h1>
          <p className="page-subtitle">
            Upload Excel files or PDFs — Claude extracts the data, you confirm before saving
          </p>
        </div>
        {step !== 'upload' && step !== 'extracting' && (
          <button className="btn" onClick={handleReset}>Start over</button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: '#2d1b1b', border: '1px solid #8b3a3a', borderRadius: 8,
          padding: '12px 16px', marginBottom: 20, color: '#f87171', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* ── UPLOAD ─────────────────────────────────────────────────────────── */}
      {(step === 'upload' || step === 'extracting') && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Step 1 — Upload Document</h2>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Import Type</label>
            <select
              className="form-input"
              value={importType}
              onChange={e => setImportType(e.target.value)}
              style={{ width: '100%' }}
              disabled={step === 'extracting'}
            >
              {IMPORT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => step !== 'extracting' && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#4a9e6e' : '#2d5a3d'}`,
              borderRadius: 10,
              padding: '40px 24px',
              textAlign: 'center',
              cursor: step === 'extracting' ? 'default' : 'pointer',
              background: dragOver ? 'rgba(74,158,110,0.08)' : 'rgba(255,255,255,0.02)',
              transition: 'border-color 0.2s, background 0.2s',
              marginBottom: 16,
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              style={{ display: 'none' }}
              onChange={e => acceptFile(e.target.files[0])}
            />
            {file ? (
              <div>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                <div style={{ fontWeight: 600, color: '#e8f5ee', fontSize: 14 }}>{file.name}</div>
                <div style={{ color: '#4a9e6e', fontSize: 12, marginTop: 4 }}>{formatBytes(file.size)}</div>
                {step !== 'extracting' && (
                  <div style={{ color: '#6b9e80', fontSize: 11, marginTop: 8 }}>Click to change file</div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>↑</div>
                <div style={{ color: '#a8d5bc', fontSize: 14, fontWeight: 500 }}>
                  Drop file here or click to browse
                </div>
                <div style={{ color: '#4a9e6e', fontSize: 11, marginTop: 6 }}>
                  Accepts .xlsx · .xls · .csv · .pdf
                </div>
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={handleExtract}
            disabled={!file || !importType || step === 'extracting'}
            style={{ width: '100%' }}
          >
            {step === 'extracting'
              ? 'Claude is reading your document…'
              : 'Extract'}
          </button>
        </div>
      )}

      {/* ── PREVIEW ────────────────────────────────────────────────────────── */}
      {(step === 'preview' || step === 'saving') && editedData && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Step 2 — Review Extracted Data</h2>
            <div style={{ fontSize: 12, color: '#4a9e6e' }}>
              {file?.name} · {IMPORT_TYPES.find(t => t.value === importType)?.label}
            </div>
          </div>

          {/* Asset selector */}
          <div style={{ marginBottom: 24 }}>
            <label className="form-label">Link to Asset</label>
            <select
              className="form-input"
              value={selectedAssetId}
              onChange={e => setSelectedAssetId(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">Select asset…</option>
              {assets.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {selectedAssetId && (
              <div style={{ fontSize: 11, color: '#4a9e6e', marginTop: 4 }}>
                ✓ Auto-matched from property name — verify this is correct
              </div>
            )}
          </div>

          {/* Array preview (P&L, STR) */}
          {isArrayType && Array.isArray(editedData) && (
            <div style={{ overflowX: 'auto', marginBottom: 20 }}>
              <table className="data-table" style={{ fontSize: 12, minWidth: 700 }}>
                <thead>
                  <tr>
                    {fields.map(f => <th key={f.key}>{f.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {editedData.map((row, ri) => (
                    <tr key={ri}>
                      {fields.map(f => (
                        <td key={f.key} style={{ padding: '4px 6px' }}>
                          <input
                            className="form-input"
                            value={row[f.key] ?? ''}
                            onChange={e => updateRow(ri, f.key, e.target.value)}
                            style={{
                              padding: '4px 6px',
                              fontSize: 12,
                              minWidth: 72,
                              background: isNull(row[f.key])
                                ? 'rgba(248,113,113,0.12)' : undefined,
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {editedData.some(row => fields.some(f => isNull(row[f.key]))) && (
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>
                  Red fields were not found in the document — fill them in or leave blank.
                </div>
              )}
            </div>
          )}

          {/* Object preview (appraisal, loan, franchise) */}
          {!isArrayType && editedData && typeof editedData === 'object' && (
            <div style={{ marginBottom: 20 }}>
              <table className="data-table" style={{ fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ width: '42%' }}>Field</th>
                    <th>Extracted Value</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map(f => (
                    <tr
                      key={f.key}
                      style={{
                        background: isNull(editedData[f.key])
                          ? 'rgba(248,113,113,0.06)' : undefined,
                      }}
                    >
                      <td style={{ fontWeight: 500, color: '#a8d5bc' }}>{f.label}</td>
                      <td style={{ padding: '4px 8px' }}>
                        <input
                          className="form-input"
                          value={editedData[f.key] ?? ''}
                          onChange={e => updateField(f.key, e.target.value)}
                          style={{ width: '100%', padding: '4px 8px', fontSize: 13 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {fields.some(f => isNull(editedData[f.key])) && (
                <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>
                  Red rows were not found in the document — fill them in or leave blank.
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={step === 'saving' || !selectedAssetId}
            >
              {step === 'saving' ? 'Saving…' : 'Save to SOUL'}
            </button>
            <button className="btn" onClick={handleReset}>
              Start over
            </button>
          </div>
        </div>
      )}

      {/* ── SUCCESS ────────────────────────────────────────────────────────── */}
      {step === 'success' && saveResult && (
        <div className="card" style={{ borderColor: '#4a9e6e' }}>
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(74,158,110,0.15)', border: '2px solid #4a9e6e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 24, color: '#4a9e6e',
            }}>
              ✓
            </div>
            <h2 style={{ color: '#4a9e6e', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Saved Successfully
            </h2>
            <p style={{ color: '#a8d5bc', fontSize: 14, marginBottom: 4 }}>
              {saveResult.desc}
              {saveResult.assetName ? ` for ${saveResult.assetName}` : ''}
            </p>
            <p style={{ color: '#4a9e6e', fontSize: 11, letterSpacing: '0.08em', marginBottom: 28 }}>
              TABLE · {saveResult.table.toUpperCase()}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              {SUCCESS_LINKS[importType] && (
                <button
                  className="btn btn-primary"
                  onClick={() => navigate(SUCCESS_LINKS[importType].path)}
                >
                  {SUCCESS_LINKS[importType].label}
                </button>
              )}
              <button className="btn" onClick={handleReset}>
                Import another file
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
