import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

const STATUSES   = ['Not Started', 'Ongoing', 'Complete']
const FUND_ORDER = ['KWHP I', 'KWHP II', 'Other']

const STATUS_STYLE = {
  'Complete':    { color: '#4a9e6e', bg: 'rgba(74,158,110,0.15)',  border: 'rgba(74,158,110,0.35)' },
  'Ongoing':     { color: '#d4a84b', bg: 'rgba(212,168,75,0.12)',  border: 'rgba(212,168,75,0.35)' },
  'Not Started': { color: '#6b9e80', bg: 'rgba(107,158,128,0.08)', border: 'rgba(107,158,128,0.2)' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanPayload(form) {
  const out = { ...form }
  if ('due_date'     in out && !out.due_date)     out.due_date     = null
  if ('poc'          in out && !out.poc)          out.poc          = null
  if ('update_notes' in out && !out.update_notes) out.update_notes = null
  return out
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDateTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const tdSt = { padding: '8px 10px', verticalAlign: 'middle' }
const thSt = {
  padding: '5px 10px', fontSize: 10, color: '#4a9e6e', letterSpacing: '.08em',
  textTransform: 'uppercase', textAlign: 'left', fontWeight: 600,
  borderBottom: '1px solid rgba(74,158,110,0.2)',
}

// ── Data hooks ────────────────────────────────────────────────────────────────

function useTasks() {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at',  { ascending: true })
    setTasks(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const upsert = async (task) => {
    const { id, ...rest } = task
    const payload = cleanPayload(rest)
    if (id) {
      const { data, error } = await supabase.from('tasks').update(payload).eq('id', id).select().single()
      if (!error) setTasks(prev => prev.map(t => t.id === id ? data : t))
      return { data, error }
    } else {
      const { data, error } = await supabase.from('tasks').insert(payload).select().single()
      if (!error) setTasks(prev => [...prev, data])
      return { data, error }
    }
  }

  const remove = async (id) => {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  return { tasks, loading, upsert, remove }
}

function useTaskUpdates() {
  const [byTask, setByTask] = useState({})

  const load = async (taskId) => {
    if (byTask[taskId]) return
    const { data } = await supabase
      .from('task_updates')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
    setByTask(prev => ({ ...prev, [taskId]: data || [] }))
  }

  const add = async (taskId, note, poc) => {
    const { data, error } = await supabase
      .from('task_updates')
      .insert({ task_id: taskId, note: note.trim(), poc: poc || null })
      .select()
      .single()
    if (!error) {
      setByTask(prev => ({ ...prev, [taskId]: [data, ...(prev[taskId] || [])] }))
    }
    return { data, error }
  }

  return { byTask, load, add }
}

// ── Status dropdown ───────────────────────────────────────────────────────────

function StatusCell({ status, onChange }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE['Not Started']
  return (
    <select
      value={status || 'Not Started'}
      onChange={e => onChange(e.target.value)}
      style={{
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
        borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
        cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none',
      }}
    >
      {STATUSES.map(sv => <option key={sv} value={sv}>{sv}</option>)}
    </select>
  )
}

// ── Update history panel ──────────────────────────────────────────────────────

function UpdatesPanel({ task, updates, onAdd, onClose }) {
  const [note, setNote]     = useState('')
  const [poc, setPoc]       = useState(task.poc || '')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleAdd = async () => {
    if (!note.trim()) return
    setSaving(true)
    setError('')
    const { error: err } = await onAdd(task.id, note, poc)
    if (err) { setError(err.message); setSaving(false); return }
    setNote('')
    setSaving(false)
  }

  return (
    <tr>
      <td colSpan={6} style={{ padding: '0 10px 12px 10px' }}>
        <div style={{
          background: 'var(--gray50)',
          border: '1px solid rgba(74,158,110,0.15)',
          borderRadius: 8, padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#4a9e6e', letterSpacing: '.07em', textTransform: 'uppercase' }}>
              Update History
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray500)', fontSize: 14 }}>✕</button>
          </div>

          {/* Past updates */}
          {updates.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--gray500)', marginBottom: 12 }}>No updates logged yet.</div>
          ) : (
            <div style={{ marginBottom: 12, maxHeight: 220, overflowY: 'auto' }}>
              {updates.map(u => (
                <div key={u.id} style={{
                  padding: '7px 10px', marginBottom: 4,
                  background: 'var(--white)', borderRadius: 6,
                  border: '1px solid var(--gray100)',
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                    {u.poc && <span style={{ fontSize: 10, fontWeight: 700, color: '#4a9e6e' }}>{u.poc}</span>}
                    <span style={{ fontSize: 10, color: 'var(--gray500)' }}>{fmtDateTime(u.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--g900)' }}>{u.note}</div>
                </div>
              ))}
            </div>
          )}

          {/* Add update */}
          {error && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 6 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <input
              className="form-input"
              value={poc}
              onChange={e => setPoc(e.target.value.toUpperCase())}
              placeholder="POC"
              style={{ padding: '5px 8px', fontSize: 12, width: 56, flexShrink: 0 }}
            />
            <input
              className="form-input"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add an update…"
              style={{ padding: '5px 8px', fontSize: 12, flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              autoFocus
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleAdd}
              disabled={saving || !note.trim()}
              style={{ fontSize: 11, flexShrink: 0 }}
            >
              {saving ? '...' : 'Add'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, updates, onSave, onDelete, onExpandUpdates, onAddUpdate, updatesOpen }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({ ...task })
  const [hovered, setHovered] = useState(false)
  const [saveError, setSaveError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleStatusChange = async (newStatus) => {
    await onSave({ ...task, status: newStatus })
  }

  const handleSave = async () => {
    setSaveError('')
    const { error } = await onSave({ ...form, id: task.id })
    if (error) { setSaveError(error.message); return }
    setEditing(false)
  }

  const handleCancel = () => { setForm({ ...task }); setEditing(false); setSaveError('') }

  const updateCount = updates?.length || 0

  if (editing) {
    return (
      <tr style={{ background: 'rgba(74,158,110,0.05)' }}>
        <td style={tdSt}>
          <input type="date" className="form-input" value={form.due_date || ''}
            onChange={e => set('due_date', e.target.value)}
            style={{ padding: '3px 6px', fontSize: 12, width: 130 }} />
        </td>
        <td style={tdSt}>
          <input className="form-input" value={form.item}
            onChange={e => set('item', e.target.value)}
            style={{ padding: '3px 6px', fontSize: 12, width: '100%' }} autoFocus />
          {saveError && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 3 }}>{saveError}</div>}
        </td>
        <td style={tdSt}>
          <input className="form-input" value={form.poc || ''}
            onChange={e => set('poc', e.target.value.toUpperCase())}
            style={{ padding: '3px 6px', fontSize: 12, width: 52 }} placeholder="DR" />
        </td>
        <td style={tdSt}>
          <select className="form-input" value={form.status || 'Not Started'}
            onChange={e => set('status', e.target.value)}
            style={{ padding: '3px 6px', fontSize: 12 }}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
        <td style={tdSt}>
          <input className="form-input" value={form.update_notes || ''}
            onChange={e => set('update_notes', e.target.value)}
            style={{ padding: '3px 6px', fontSize: 12, width: '100%' }} />
        </td>
        <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave}
            style={{ marginRight: 4, fontSize: 11 }}>Save</button>
          <button className="btn btn-sm" onClick={handleCancel}
            style={{ fontSize: 11 }}>Cancel</button>
        </td>
      </tr>
    )
  }

  const isComplete = task.status === 'Complete'

  return (
    <>
      <tr
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderBottom: updatesOpen ? 'none' : '1px solid rgba(74,158,110,0.08)',
          background: updatesOpen ? 'rgba(74,158,110,0.04)' : hovered ? 'rgba(74,158,110,0.03)' : 'transparent',
          transition: 'background 0.1s',
        }}
      >
        <td style={{ ...tdSt, color: 'var(--gray500)', fontSize: 12, whiteSpace: 'nowrap' }}>
          {fmtDate(task.due_date)}
        </td>
        <td style={{ ...tdSt, maxWidth: 380 }}>
          <span style={{
            fontSize: 13,
            color: isComplete ? '#4a9e6e' : 'var(--g900)',
            textDecoration: isComplete ? 'line-through' : 'none',
            opacity: isComplete ? 0.65 : 1,
          }}>
            {task.item}
          </span>
        </td>
        <td style={{ ...tdSt, fontSize: 12, fontWeight: 700, color: '#4a9e6e', letterSpacing: '.06em' }}>
          {task.poc}
        </td>
        <td style={tdSt}>
          <StatusCell status={task.status} onChange={handleStatusChange} />
        </td>
        <td style={{ ...tdSt, maxWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--gray500)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.update_notes}
            </span>
            <button
              onClick={() => onExpandUpdates(task.id)}
              style={{
                flexShrink: 0,
                background: updatesOpen ? 'rgba(74,158,110,0.15)' : 'rgba(74,158,110,0.08)',
                color: '#4a9e6e',
                border: '1px solid rgba(74,158,110,0.25)',
                borderRadius: 10,
                padding: '2px 7px',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '.04em',
              }}
            >
              {updateCount > 0 ? `${updateCount} ${updatesOpen ? '▲' : '▼'}` : (updatesOpen ? '▲' : '+')}
            </button>
          </div>
        </td>
        <td style={{ ...tdSt, whiteSpace: 'nowrap', opacity: hovered || updatesOpen ? 1 : 0, transition: 'opacity 0.15s' }}>
          <button className="card-action" onClick={() => setEditing(true)}
            style={{ fontSize: 11 }}>Edit</button>
          <button className="card-action" onClick={() => onDelete(task.id)}
            style={{ color: 'var(--red)', marginLeft: 4, fontSize: 11 }}>✕</button>
        </td>
      </tr>
      {updatesOpen && (
        <UpdatesPanel
          task={task}
          updates={updates || []}
          onAdd={onAddUpdate}
          onClose={() => onExpandUpdates(task.id)}
        />
      )}
    </>
  )
}

// ── Add-row form ──────────────────────────────────────────────────────────────

function AddTaskRow({ assetId, onSave, onCancel }) {
  const [form, setForm]     = useState({
    asset_id: assetId, item: '', poc: '', due_date: '', status: 'Not Started', update_notes: '',
  })
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.item.trim()) return
    setSaving(true)
    setError('')
    const { error: err } = await onSave(cleanPayload(form))
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
  }

  return (
    <>
      <tr style={{ background: 'rgba(74,158,110,0.04)', borderBottom: '1px solid rgba(74,158,110,0.1)' }}>
        <td style={tdSt}>
          <input type="date" className="form-input" value={form.due_date}
            onChange={e => set('due_date', e.target.value)}
            style={{ padding: '3px 6px', fontSize: 12, width: 130 }} />
        </td>
        <td style={tdSt}>
          <input className="form-input" value={form.item}
            onChange={e => set('item', e.target.value)}
            placeholder="New action item…"
            style={{ padding: '3px 6px', fontSize: 12, width: '100%' }}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel() }} />
        </td>
        <td style={tdSt}>
          <input className="form-input" value={form.poc}
            onChange={e => set('poc', e.target.value.toUpperCase())}
            style={{ padding: '3px 6px', fontSize: 12, width: 52 }} placeholder="DR" />
        </td>
        <td style={tdSt}>
          <select className="form-input" value={form.status}
            onChange={e => set('status', e.target.value)}
            style={{ padding: '3px 6px', fontSize: 12 }}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
        <td style={tdSt}>
          <input className="form-input" value={form.update_notes}
            onChange={e => set('update_notes', e.target.value)}
            style={{ padding: '3px 6px', fontSize: 12, width: '100%' }} />
        </td>
        <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave}
            disabled={saving || !form.item.trim()}
            style={{ marginRight: 4, fontSize: 11 }}>{saving ? '...' : 'Add'}</button>
          <button className="btn btn-sm" onClick={onCancel} style={{ fontSize: 11 }}>Cancel</button>
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={6} style={{ padding: '4px 10px 8px', fontSize: 11, color: 'var(--red)' }}>
            {error}
          </td>
        </tr>
      )}
    </>
  )
}

// ── Asset block ───────────────────────────────────────────────────────────────

function AssetBlock({ asset, tasks, onSave, onDelete, updatesByTask, onExpandUpdates, expandedTask, onAddUpdate }) {
  const [addingRow, setAddingRow] = useState(false)

  const handleAdd = async (task) => {
    const { error } = await onSave(task)
    if (!error) setAddingRow(false)
  }

  const complete = tasks.filter(t => t.status === 'Complete').length

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(74,158,110,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--g900)', letterSpacing: '.02em' }}>
            {asset.name}
          </span>
          {asset.mvp_captain && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#4a9e6e',
              background: 'rgba(74,158,110,0.1)', border: '1px solid rgba(74,158,110,0.2)',
              padding: '2px 9px', borderRadius: 10, letterSpacing: '.06em',
            }}>
              MVP · {asset.mvp_captain}
            </span>
          )}
          {tasks.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--gray500)' }}>
              {complete}/{tasks.length} complete
            </span>
          )}
        </div>
        <button className="btn btn-sm" onClick={() => setAddingRow(true)}
          style={{ fontSize: 11, padding: '3px 10px' }}>
          + Add item
        </button>
      </div>

      {(tasks.length > 0 || addingRow) ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thSt, width: 100 }}>Timeline</th>
              <th style={thSt}>Item</th>
              <th style={{ ...thSt, width: 60 }}>POC</th>
              <th style={{ ...thSt, width: 130 }}>Status</th>
              <th style={thSt}>Update</th>
              <th style={{ ...thSt, width: 100 }}></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => (
              <TaskRow
                key={t.id}
                task={t}
                updates={updatesByTask[t.id]}
                onSave={onSave}
                onDelete={onDelete}
                onExpandUpdates={onExpandUpdates}
                onAddUpdate={onAddUpdate}
                updatesOpen={expandedTask === t.id}
              />
            ))}
            {addingRow && (
              <AddTaskRow assetId={asset.id} onSave={handleAdd} onCancel={() => setAddingRow(false)} />
            )}
          </tbody>
        </table>
      ) : (
        <div style={{ padding: '8px 10px', color: 'var(--gray500)', fontSize: 12 }}>
          No items yet — click + Add item to start tracking.
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Tasks() {
  const { tasks, loading: tasksLoading, upsert, remove } = useTasks()
  const { assets, loading: assetsLoading }               = useAssets()
  const { byTask: updatesByTask, load: loadUpdates, add: addUpdate } = useTaskUpdates()
  const [expandedTask, setExpandedTask] = useState(null)

  const loading = tasksLoading || assetsLoading

  const handleExpandUpdates = (taskId) => {
    if (expandedTask === taskId) {
      setExpandedTask(null)
    } else {
      setExpandedTask(taskId)
      loadUpdates(taskId)
    }
  }

  const handleAddUpdate = async (taskId, note, poc) => {
    const result = await addUpdate(taskId, note, poc)
    // Also update the task's update_notes to the latest
    if (!result.error) {
      await upsert({ id: taskId, update_notes: note, poc: poc || undefined })
    }
    return result
  }

  const assetsByFund = FUND_ORDER.reduce((acc, fund) => {
    acc[fund] = assets.filter(a => (a.fund || 'Other') === fund)
    return acc
  }, {})

  const tasksByAsset = tasks.reduce((acc, t) => {
    if (!t.asset_id) return acc
    if (!acc[t.asset_id]) acc[t.asset_id] = []
    acc[t.asset_id].push(t)
    return acc
  }, {})

  const notStarted = tasks.filter(t => t.status === 'Not Started').length
  const ongoing    = tasks.filter(t => t.status === 'Ongoing').length
  const complete   = tasks.filter(t => t.status === 'Complete').length

  if (loading) return <div className="loading">Loading...</div>

  const hasFundAssets = FUND_ORDER.some(f => (assetsByFund[f] || []).length > 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">30.60.90 Priorities</h1>
          <p className="page-subtitle">Q1 2026 · Action items by asset and fund</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Not Started</div>
          <div className="kpi-value">{notStarted}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Ongoing</div>
          <div className="kpi-value" style={{ color: '#d4a84b' }}>{ongoing}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Complete</div>
          <div className="kpi-value" style={{ color: '#4a9e6e' }}>{complete}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Items</div>
          <div className="kpi-value">{tasks.length}</div>
        </div>
      </div>

      {!hasFundAssets ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">Assign assets to a fund to get started</div>
            <div className="empty-state-desc">
              Set a <code>fund</code> value (KWHP I, KWHP II, or Other) on your assets in Supabase.
            </div>
          </div>
        </div>
      ) : (
        FUND_ORDER.map(fund => {
          const fundAssets = assetsByFund[fund]
          if (!fundAssets || fundAssets.length === 0) return null
          return (
            <div key={fund} className="card" style={{ marginBottom: 24 }}>
              <div className="card-header" style={{ marginBottom: 20 }}>
                <h2 className="card-title" style={{ fontSize: 16, letterSpacing: '.04em' }}>{fund}</h2>
              </div>
              {fundAssets.map(asset => (
                <AssetBlock
                  key={asset.id}
                  asset={asset}
                  tasks={tasksByAsset[asset.id] || []}
                  onSave={upsert}
                  onDelete={remove}
                  updatesByTask={updatesByTask}
                  onExpandUpdates={handleExpandUpdates}
                  expandedTask={expandedTask}
                  onAddUpdate={handleAddUpdate}
                />
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}
