import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Platform definitions ──────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: 'str',
    name: 'STR / CoStar',
    vendor: 'CoStar Group',
    category: 'Benchmarking',
    categoryColor: 'var(--blue)',
    desc: 'Pull comp set occupancy, ADR, and RevPAR directly into your STR Benchmarking page.',
    syncTarget: 'STR Benchmarking',
    syncFn: 'sync-str',
    setupNote: 'Contact your STR account rep to request API credentials. Enterprise benchmarking subscription required.',
    credFields: [
      { key: 'client_id',     label: 'Client ID',     type: 'text',     placeholder: 'Provided by your STR rep' },
      { key: 'client_secret', label: 'Client Secret', type: 'password', placeholder: '••••••••' },
    ],
    configFields: [
      { key: 'property_codes', label: 'STR Property Codes', type: 'text', placeholder: '12345, 67890', hint: 'Comma-separated. Found in your STR portal.' },
    ],
    assetMap: true,
  },
  {
    id: 'profitsword',
    name: 'ProfitSword',
    vendor: 'Actabl',
    category: 'Financial',
    categoryColor: 'var(--g600)',
    desc: 'Auto-sync monthly P&L — revenue, GOP, NOI, occupancy, ADR — into Financial Performance.',
    syncTarget: 'Financial Performance',
    syncFn: 'sync-profitsword',
    setupNote: 'Contact Actabl support to enable API access on your ProfitSword account. They will provide a base URL and API key.',
    credFields: [
      { key: 'api_url', label: 'API Base URL', type: 'text',     placeholder: 'https://api.profitsword.com/v1' },
      { key: 'api_key', label: 'API Key',      type: 'password', placeholder: '••••••••' },
    ],
    configFields: [
      { key: 'property_ids', label: 'Property IDs', type: 'text', placeholder: 'PROP001, PROP002', hint: 'Comma-separated. Found in your ProfitSword property settings.' },
    ],
    assetMap: true,
  },
  {
    id: 'lighthouse',
    name: 'Lighthouse',
    vendor: 'Lighthouse (formerly OTA Insight)',
    category: 'Revenue Intelligence',
    categoryColor: 'var(--amber)',
    desc: 'Rate intelligence — OTA rates, comp pricing, and market position via Lighthouse Benchmark Insight.',
    syncTarget: 'STR Benchmarking',
    syncFn: 'sync-lighthouse',
    setupNote: 'Apply to the Lighthouse Developer Solutions Suite at mylighthouse.com. A partner certification and revenue-share agreement is required.',
    credFields: [
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Bearer token from Lighthouse dashboard' },
    ],
    configFields: [
      { key: 'hotel_ids', label: 'Lighthouse Hotel IDs', type: 'text', placeholder: 'h_abc123, h_def456', hint: 'Comma-separated. Found in your Lighthouse property settings.' },
    ],
    assetMap: true,
  },
  {
    id: 'amadeus',
    name: 'Amadeus',
    vendor: 'Amadeus Hospitality',
    category: 'Distribution',
    categoryColor: '#6366f1',
    desc: 'Hotel content and live rate availability from the Amadeus GDS network.',
    syncTarget: 'Asset Tracker',
    syncFn: 'sync-amadeus',
    setupNote: 'Register for free at developers.amadeus.com. Start with the sandbox environment, then request production access.',
    credFields: [
      { key: 'client_id',     label: 'API Key',    type: 'text',     placeholder: 'From developers.amadeus.com' },
      { key: 'client_secret', label: 'API Secret', type: 'password', placeholder: '••••••••' },
      { key: 'environment',   label: 'Environment', type: 'select', options: ['test', 'production'] },
    ],
    configFields: [
      { key: 'hotel_ids', label: 'Amadeus Hotel IDs', type: 'text', placeholder: 'MADSYCIT, MADSYPAR', hint: 'Comma-separated Amadeus hotel codes.' },
    ],
    assetMap: false,
  },
  {
    id: 'demand360',
    name: 'Demand360',
    vendor: 'Amadeus Hospitality',
    category: 'Revenue Intelligence',
    categoryColor: 'var(--amber)',
    desc: 'Forward-looking booking pace and market demand data — 12-month outlook by market.',
    status: 'enterprise',
    setupNote: 'Enterprise product. Contact your Amadeus account rep to add Demand360 API access to your subscription. Integration requires IDeaS or Duetto as a middleware.',
    credFields: [],
    configFields: [],
  },
  {
    id: 'singlepane',
    name: 'SinglePane',
    vendor: 'SinglePane',
    category: 'Operations',
    categoryColor: 'var(--gray500)',
    desc: 'Asset management, CapEx planning, and operations data consolidation.',
    status: 'no_api',
    setupNote: 'No public API is currently available. Contact SinglePane directly at singlepaneapp.com to discuss integration options.',
    credFields: [],
    configFields: [],
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const diff = Date.now() - d.getTime()
  if (diff < 60000)  return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function StatusBadge({ integration, platform }) {
  if (platform.status === 'enterprise') return (
    <span style={{ fontSize: 10, background: 'rgba(201,169,110,0.15)', color: 'var(--amber)', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>Enterprise</span>
  )
  if (platform.status === 'no_api') return (
    <span style={{ fontSize: 10, background: 'var(--gray100)', color: 'var(--gray500)', padding: '2px 8px', borderRadius: 10 }}>No API yet</span>
  )
  if (!integration?.enabled) return (
    <span style={{ fontSize: 10, background: 'var(--gray100)', color: 'var(--gray500)', padding: '2px 8px', borderRadius: 10 }}>Not connected</span>
  )
  if (integration.last_sync_status === 'error') return (
    <span style={{ fontSize: 10, background: 'rgba(248,113,113,0.12)', color: 'var(--red)', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>Error</span>
  )
  return (
    <span style={{ fontSize: 10, background: 'var(--g50)', color: 'var(--g600)', padding: '2px 8px', borderRadius: 10, fontWeight: 500 }}>● Connected</span>
  )
}

// ── Configure Modal ───────────────────────────────────────────────────────────

function ConfigModal({ platform, integration, onClose, onSaved }) {
  const [creds, setCreds]     = useState(() => integration?.credentials ?? {})
  const [config, setConfig]   = useState(() => integration?.config ?? {})
  const [enabled, setEnabled] = useState(integration?.enabled ?? false)
  const [saving, setSaving]   = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [error, setError]     = useState('')

  // Asset map state: array of { platform_id, asset_id }
  const [assetMapRows, setAssetMapRows] = useState(() => {
    const m = integration?.config?.asset_map ?? {}
    return Object.entries(m).map(([aid, pid]) => ({ asset_id: aid, platform_id: pid }))
  })
  const [assets, setAssets] = useState([])
  useEffect(() => {
    if (platform.assetMap) {
      supabase.from('assets').select('id, name').order('name').then(({ data }) => setAssets(data || []))
    }
  }, [platform.assetMap])

  const setCred   = (k, v) => setCreds(prev => ({ ...prev, [k]: v }))
  const setConf   = (k, v) => setConfig(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    setSaving(true); setError('')
    const assetMap = Object.fromEntries(assetMapRows.filter(r => r.asset_id && r.platform_id).map(r => [r.asset_id, r.platform_id]))
    const { error: err } = await supabase.from('integrations').upsert({
      platform: platform.id,
      enabled,
      credentials: creds,
      config: { ...config, asset_map: assetMap },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'platform' })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
    onClose()
  }

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    // Save first so the edge function can read the credentials
    const assetMap = Object.fromEntries(assetMapRows.filter(r => r.asset_id && r.platform_id).map(r => [r.asset_id, r.platform_id]))
    await supabase.from('integrations').upsert({
      platform: platform.id, enabled: false,
      credentials: creds, config: { ...config, asset_map: assetMap },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'platform' })
    const { data, error: err } = await supabase.functions.invoke(platform.syncFn, { body: {} })
    setTesting(false)
    if (err) { setTestResult({ ok: false, msg: err.message }); return }
    setTestResult({ ok: data?.status === 'success', msg: data?.message ?? JSON.stringify(data) })
  }

  const addMapRow = () => setAssetMapRows(prev => [...prev, { asset_id: '', platform_id: '' }])
  const setMapRow = (i, k, v) => setAssetMapRows(prev => prev.map((r, j) => j === i ? { ...r, [k]: v } : r))
  const removeMapRow = (i) => setAssetMapRows(prev => prev.filter((_, j) => j !== i))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <span className="modal-title">Configure — {platform.name}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Setup note */}
        <div style={{ background: 'rgba(74,158,110,0.08)', border: '1px solid var(--g100)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--g700)', marginBottom: 20, lineHeight: 1.6 }}>
          {platform.setupNote}
        </div>

        {error && <div style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid var(--red)', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>{error}</div>}

        {testResult && (
          <div style={{ background: testResult.ok ? 'var(--g50)' : 'rgba(248,113,113,0.12)', border: `1px solid ${testResult.ok ? 'var(--g200)' : 'var(--red)'}`, borderRadius: 7, padding: '8px 12px', fontSize: 12, color: testResult.ok ? 'var(--g700)' : 'var(--red)', marginBottom: 12 }}>
            {testResult.ok ? '✓ ' : '✗ '}{testResult.msg}
          </div>
        )}

        {/* Credentials */}
        {platform.credFields.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--gray500)', marginBottom: 10 }}>Credentials</div>
            {platform.credFields.map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                {f.type === 'select' ? (
                  <select className="form-select" value={creds[f.key] ?? f.options[0]} onChange={e => setCred(f.key, e.target.value)}>
                    {f.options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                  </select>
                ) : (
                  <input className="form-input" type={f.type} value={creds[f.key] ?? ''} placeholder={f.placeholder} onChange={e => setCred(f.key, e.target.value)} autoComplete="off"/>
                )}
              </div>
            ))}
          </>
        )}

        {/* Config */}
        {platform.configFields.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--gray500)', margin: '16px 0 10px' }}>Configuration</div>
            {platform.configFields.map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}</label>
                <input className="form-input" type="text" value={config[f.key] ?? ''} placeholder={f.placeholder} onChange={e => setConf(f.key, e.target.value)}/>
                {f.hint && <div style={{ fontSize: 10, color: 'var(--gray500)', marginTop: 3 }}>{f.hint}</div>}
              </div>
            ))}
          </>
        )}

        {/* Asset mapping */}
        {platform.assetMap && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--gray500)', margin: '16px 0 10px' }}>
              Asset Mapping
              <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', marginLeft: 6, color: 'var(--gray400)' }}>Map your SOUL assets to their IDs in {platform.name}</span>
            </div>
            {assetMapRows.map((row, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <select className="form-select" style={{ flex: 1 }} value={row.asset_id} onChange={e => setMapRow(i, 'asset_id', e.target.value)}>
                  <option value="">Select SOUL asset…</option>
                  {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <span style={{ fontSize: 12, color: 'var(--gray400)', flexShrink: 0 }}>→</span>
                <input className="form-input" style={{ flex: 1 }} placeholder={`${platform.name} ID`} value={row.platform_id} onChange={e => setMapRow(i, 'platform_id', e.target.value)}/>
                <button className="btn" style={{ padding: '4px 8px', fontSize: 12, color: 'var(--red)', flexShrink: 0 }} onClick={() => removeMapRow(i)}>✕</button>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={addMapRow} style={{ marginBottom: 4 }}>+ Add mapping</button>
          </>
        )}

        {/* Enable toggle */}
        {platform.credFields.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', margin: '20px 0 16px' }}>
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/>
            Enable this integration and allow scheduled syncs
          </label>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {platform.syncFn && (
            <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
              {testing ? 'Testing…' : 'Test connection'}
            </button>
          )}
          {platform.credFields.length > 0 && (
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Integrations() {
  const [integrations, setIntegrations] = useState([])
  const [syncLogs, setSyncLogs]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState(null)   // platform id
  const [syncing, setSyncing]           = useState(null)   // platform id
  const [syncMsg, setSyncMsg]           = useState({})     // { [platformId]: msg }

  const load = useCallback(async () => {
    const [{ data: ints }, { data: logs }] = await Promise.all([
      supabase.from('integrations').select('*'),
      supabase.from('sync_logs').select('*').order('started_at', { ascending: false }).limit(20),
    ])
    setIntegrations(ints || [])
    setSyncLogs(logs || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const getInt = (id) => integrations.find(i => i.platform === id)

  const handleSync = async (platform) => {
    setSyncing(platform.id)
    setSyncMsg(prev => ({ ...prev, [platform.id]: null }))
    const { data, error } = await supabase.functions.invoke(platform.syncFn, {
      body: { from_year: new Date().getFullYear(), from_month: 1 },
    })
    setSyncing(null)
    const msg = error ? error.message : (data?.message ?? 'Done')
    setSyncMsg(prev => ({ ...prev, [platform.id]: { ok: !error && data?.status === 'success', text: msg } }))
    load()
  }

  const connected    = PLATFORMS.filter(p => !p.status && getInt(p.id)?.enabled).length
  const available    = PLATFORMS.filter(p => !p.status && !getInt(p.id)?.enabled).length
  const enterpriseN  = PLATFORMS.filter(p => p.status === 'enterprise' || p.status === 'no_api').length

  if (loading) return <div className="loading">Loading integrations…</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Integrations</h1>
          <p className="page-subtitle">Connect SOUL to your hotel data platforms for automatic syncing</p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card">
          <div className="kpi-label">Connected</div>
          <div className="kpi-value" style={{ color: connected > 0 ? 'var(--g600)' : undefined }}>{connected}</div>
          <div className="kpi-change">Active integrations</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Available to Connect</div>
          <div className="kpi-value">{available}</div>
          <div className="kpi-change">Need credentials</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Enterprise / Pending</div>
          <div className="kpi-value">{enterpriseN}</div>
          <div className="kpi-change">Requires vendor deal</div>
        </div>
      </div>

      {/* Platform cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 32 }}>
        {PLATFORMS.map(platform => {
          const int = getInt(platform.id)
          const isSyncing = syncing === platform.id
          const msg = syncMsg[platform.id]
          const canConnect = !platform.status
          const canSync = int?.enabled && platform.syncFn

          return (
            <div key={platform.id} className="card" style={{ opacity: platform.status === 'no_api' ? 0.7 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--g900)', marginBottom: 3 }}>{platform.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--gray500)' }}>{platform.vendor}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--gray200)', color: platform.categoryColor ?? 'var(--gray500)', padding: '1px 7px', borderRadius: 8, fontWeight: 500 }}>{platform.category}</span>
                  <StatusBadge integration={int} platform={platform}/>
                </div>
              </div>

              <p style={{ fontSize: 12, color: 'var(--gray600)', marginBottom: 12, lineHeight: 1.5 }}>{platform.desc}</p>

              {int?.enabled && (
                <div style={{ fontSize: 11, color: 'var(--gray500)', marginBottom: 10 }}>
                  Last sync: <span style={{ color: int.last_sync_status === 'error' ? 'var(--red)' : 'var(--gray700)', fontWeight: 500 }}>{fmtDate(int.last_sync_at)}</span>
                  {int.last_sync_message && <div style={{ color: int.last_sync_status === 'error' ? 'var(--red)' : 'var(--g600)', marginTop: 2, fontSize: 11 }}>{int.last_sync_message.slice(0, 80)}{int.last_sync_message.length > 80 ? '…' : ''}</div>}
                </div>
              )}

              {platform.syncFn && canSync && (
                <div style={{ fontSize: 10, color: 'var(--gray400)', marginBottom: 8 }}>→ Syncs to {platform.syncTarget}</div>
              )}

              {msg && (
                <div style={{ fontSize: 11, color: msg.ok ? 'var(--g600)' : 'var(--red)', background: msg.ok ? 'var(--g50)' : 'rgba(248,113,113,0.08)', border: `1px solid ${msg.ok ? 'var(--g100)' : 'var(--red)'}`, borderRadius: 6, padding: '6px 10px', marginBottom: 10 }}>
                  {msg.ok ? '✓ ' : '✗ '}{msg.text.slice(0, 100)}{msg.text.length > 100 ? '…' : ''}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {canConnect && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setModal(platform.id)}>
                    {int?.enabled ? 'Edit config' : 'Configure'}
                  </button>
                )}
                {canSync && (
                  <button className="btn btn-primary btn-sm" onClick={() => handleSync(platform)} disabled={isSyncing}>
                    {isSyncing ? 'Syncing…' : 'Sync now'}
                  </button>
                )}
                {platform.status === 'enterprise' && (
                  <span style={{ fontSize: 11, color: 'var(--gray400)', alignSelf: 'center' }}>Contact your vendor rep to get access</span>
                )}
                {platform.status === 'no_api' && (
                  <span style={{ fontSize: 11, color: 'var(--gray400)', alignSelf: 'center' }}>No API available yet</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Sync history */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Sync history</span>
          <button className="btn btn-secondary btn-sm" onClick={load}>Refresh</button>
        </div>
        {syncLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔄</div>
            <div className="empty-state-title">No syncs yet</div>
            <div className="empty-state-desc">Connect a platform and click "Sync now" to start pulling data.</div>
          </div>
        ) : (
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Platform</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Rows</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {syncLogs.map(log => {
                const dur = log.completed_at
                  ? `${((new Date(log.completed_at) - new Date(log.started_at)) / 1000).toFixed(1)}s`
                  : log.status === 'running' ? 'Running…' : '—'
                const statusColor = log.status === 'success' ? 'var(--g600)' : log.status === 'error' ? 'var(--red)' : 'var(--amber)'
                return (
                  <tr key={log.id}>
                    <td style={{ fontWeight: 500 }}>{PLATFORMS.find(p => p.id === log.platform)?.name ?? log.platform}</td>
                    <td>{fmtDate(log.started_at)}</td>
                    <td>{dur}</td>
                    <td><span style={{ color: statusColor, fontWeight: 500 }}>{log.status}</span></td>
                    <td>{log.rows_synced ?? '—'}</td>
                    <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--gray500)' }} title={log.message}>{log.message || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Config modal */}
      {modal && (
        <ConfigModal
          platform={PLATFORMS.find(p => p.id === modal)}
          integration={getInt(modal)}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
    </div>
  )
}
