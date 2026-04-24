import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAssets } from '../hooks/useData'

const STATUSES   = ['Not Started', 'Ongoing', 'Complete']
const FUND_ORDER = ['KWHP I', 'KWHP II', 'Sotherly', 'Other']

const TEMPLATES = {
  'Brand Conversion': [
    { item: 'Execute franchise agreement', poc: 'BH', days: 14 },
    { item: 'Submit PIP scope to brand for approval', poc: 'DR', days: 30 },
    { item: 'Engage GC for renovation bid', poc: 'DR', days: 21 },
    { item: 'Order FF&E per brand standards', poc: 'DR', days: 45 },
    { item: 'Notify OTA channels of flag change', poc: 'BH', days: 60 },
    { item: 'Transition loyalty program integration', poc: 'BH', days: 60 },
    { item: 'Final brand inspection / punch walk', poc: 'DR', days: 90 },
  ],
  'Pre-Opening Checklist': [
    { item: 'Confirm GM hire', poc: 'BH', days: 14 },
    { item: 'Finalize soft-opening room block', poc: 'BH', days: 21 },
    { item: 'Set up PMS and channel manager', poc: 'DR', days: 30 },
    { item: 'Execute vendor contracts (F&B, laundry, parking)', poc: 'DR', days: 30 },
    { item: 'Complete staff training program', poc: 'DR', days: 45 },
    { item: 'Punch list completion sign-off', poc: 'DR', days: 50 },
    { item: 'Grand opening marketing push', poc: 'BH', days: 60 },
  ],
  'Loan Refinance': [
    { item: 'Engage lender / broker for term sheet', poc: 'BH', days: 14 },
    { item: 'Deliver trailing 12-month P&L and rent roll', poc: 'DR', days: 21 },
    { item: 'Order appraisal', poc: 'BH', days: 21 },
    { item: 'Negotiate and execute term sheet', poc: 'BH', days: 45 },
    { item: 'Third-party reports (environmental, property condition)', poc: 'DR', days: 45 },
    { item: 'Loan committee approval', poc: 'BH', days: 60 },
    { item: 'Closing and fund wiring', poc: 'BH', days: 75 },
  ],
  'Disposition Process': [
    { item: 'Engage broker / run marketing process', poc: 'BH', days: 14 },
    { item: 'Prepare CIM and data room', poc: 'DR', days: 21 },
    { item: 'Distribute to buyer pool, set bid deadline', poc: 'BH', days: 30 },
    { item: 'Evaluate LOIs and select preferred buyer', poc: 'BH', days: 45 },
    { item: 'Execute PSA', poc: 'BH', days: 52 },
    { item: 'Support buyer DD process', poc: 'DR', days: 60 },
    { item: 'Closing / waterfall distribution', poc: 'BH', days: 90 },
  ],
  'PIP Management': [
    { item: 'Receive and review brand PIP document', poc: 'DR', days: 7 },
    { item: 'Bid scope with 3+ GCs', poc: 'DR', days: 21 },
    { item: 'Finalize GC and execute contract', poc: 'BH', days: 30 },
    { item: 'Submit PIP timeline to brand', poc: 'DR', days: 30 },
    { item: 'Monitor weekly progress vs schedule', poc: 'DR', days: 60 },
    { item: 'Brand mid-construction inspection', poc: 'DR', days: 75 },
    { item: 'Final PIP completion sign-off', poc: 'DR', days: 90 },
  ],
}

const STATUS_STYLE = {
  'Complete':    { color: '#4a9e6e', bg: 'rgba(74,158,110,0.15)',  border: 'rgba(74,158,110,0.35)' },
  'Ongoing':     { color: '#d4a84b', bg: 'rgba(212,168,75,0.12)',  border: 'rgba(212,168,75,0.35)' },
  'Not Started': { color: '#6b9e80', bg: 'rgba(107,158,128,0.08)', border: 'rgba(107,158,128,0.2)' },
}

const STATUS_GROUP_ORDER = { 'Ongoing': 0, 'Not Started': 1, 'Complete': 2 }

const URGENCY_BORDER = {
  critical: '#7b0d06',
  overdue:  '#c0392b',
  soon:     '#d4a84b',
  complete: 'rgba(74,158,110,0.4)',
  none:     'transparent',
}

// ── Date / urgency helpers ────────────────────────────────────────────────────

function getQuarter() {
  const d = new Date()
  return `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')
  return Math.round(diff / 86400000)
}

function urgencyOf(task) {
  if (task.status === 'Complete') return 'complete'
  if (!task.due_date) return 'none'
  const d = daysUntil(task.due_date)
  if (d < -30) return 'critical'
  if (d < 0)   return 'overdue'
  if (d <= 14)  return 'soon'
  return 'none'
}

// Render text with @MENTION highlighted
function MentionText({ text, style }) {
  if (!text) return null
  const parts = text.split(/(@[A-Z]{2,6})/g)
  return (
    <span style={style}>
      {parts.map((p, i) =>
        /^@[A-Z]{2,6}$/.test(p)
          ? <span key={i} style={{ color: '#4a9e6e', fontWeight: 700 }}>{p}</span>
          : p
      )}
    </span>
  )
}

// Sort: Ongoing → Not Started → Complete; within each group: overdue first, then by date asc, no-date last
function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const ag = STATUS_GROUP_ORDER[a.status] ?? 3
    const bg = STATUS_GROUP_ORDER[b.status] ?? 3
    if (ag !== bg) return ag - bg
    const au = urgencyOf(a) === 'overdue' ? 0 : 1
    const bu = urgencyOf(b) === 'overdue' ? 0 : 1
    if (au !== bu) return au - bu
    if (!a.due_date && !b.due_date) return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date) - new Date(b.due_date)
  })
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDateTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DueBadge({ task }) {
  const dateLabel = fmtDate(task.due_date)
  if (!task.due_date) return <span style={{ fontSize: 11, color: 'var(--gray500)' }}>—</span>
  if (task.status === 'Complete') return <span style={{ fontSize: 11, color: 'var(--gray500)' }}>{dateLabel}</span>
  const d = daysUntil(task.due_date)
  if (d < -30) return (
    <span>
      <span style={{ display: 'block', fontSize: 11, color: '#7b0d06', fontWeight: 700, lineHeight: 1.3 }}>{dateLabel}</span>
      <span style={{ display: 'block', fontSize: 9, color: '#7b0d06', fontWeight: 700, letterSpacing: '.03em' }}>{Math.abs(d)}d — CRITICAL</span>
    </span>
  )
  if (d < 0) return (
    <span>
      <span style={{ display: 'block', fontSize: 11, color: '#c0392b', fontWeight: 600, lineHeight: 1.3 }}>{dateLabel}</span>
      <span style={{ display: 'block', fontSize: 9, color: '#c0392b', fontWeight: 700, letterSpacing: '.03em' }}>{Math.abs(d)}d overdue</span>
    </span>
  )
  if (d === 0) return (
    <span>
      <span style={{ display: 'block', fontSize: 11, color: '#d4a84b', fontWeight: 600, lineHeight: 1.3 }}>{dateLabel}</span>
      <span style={{ display: 'block', fontSize: 9, color: '#d4a84b', fontWeight: 700 }}>Today</span>
    </span>
  )
  if (d <= 14) return (
    <span>
      <span style={{ display: 'block', fontSize: 11, color: '#d4a84b', lineHeight: 1.3 }}>{dateLabel}</span>
      <span style={{ display: 'block', fontSize: 9, color: '#d4a84b' }}>in {d}d</span>
    </span>
  )
  return <span style={{ fontSize: 11, color: 'var(--gray500)' }}>{dateLabel}</span>
}

function ProgressBar({ complete, total }) {
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 3, background: 'rgba(74,158,110,0.12)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#4a9e6e', borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--gray500)', whiteSpace: 'nowrap', minWidth: 30, textAlign: 'right' }}>
        {complete}/{total}
      </span>
    </div>
  )
}

// ── Column layout (shared across all tables for alignment) ────────────────────
// Urgency | Timeline | Item | POC | Status | Update | Actions
const COL_WIDTHS = ['3px', '96px', null, '46px', '114px', '22%', '72px']

function TableCols() {
  return (
    <colgroup>
      <col style={{ width: COL_WIDTHS[0] }} />
      <col style={{ width: COL_WIDTHS[1] }} />
      <col /> {/* Item — takes remaining space */}
      <col style={{ width: COL_WIDTHS[3] }} />
      <col style={{ width: COL_WIDTHS[4] }} />
      <col style={{ width: COL_WIDTHS[5] }} />
      <col style={{ width: COL_WIDTHS[6] }} />
    </colgroup>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanPayload(form) {
  const out = { ...form }
  if ('due_date'     in out && !out.due_date)     out.due_date     = null
  if ('poc'          in out && !out.poc)          out.poc          = null
  if ('update_notes' in out && !out.update_notes) out.update_notes = null
  return out
}

const tdSt = { padding: '7px 8px', verticalAlign: 'middle' }
const thSt = {
  padding: '5px 8px', fontSize: 9, color: '#4a9e6e', letterSpacing: '.09em',
  textTransform: 'uppercase', textAlign: 'left', fontWeight: 700,
  borderBottom: '1px solid rgba(74,158,110,0.2)', whiteSpace: 'nowrap',
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
    if (!error) setByTask(prev => ({ ...prev, [taskId]: [data, ...(prev[taskId] || [])] }))
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
        borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700,
        cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none',
        width: '100%',
      }}
    >
      {STATUSES.map(sv => <option key={sv} value={sv}>{sv}</option>)}
    </select>
  )
}

// ── Status group header row ───────────────────────────────────────────────────

function StatusGroupRow({ status, count }) {
  const colors = {
    'Ongoing':     { color: '#d4a84b', bg: 'rgba(212,168,75,0.05)',    border: 'rgba(212,168,75,0.2)' },
    'Not Started': { color: '#6b9e80', bg: 'rgba(107,158,128,0.04)',  border: 'rgba(107,158,128,0.15)' },
    'Complete':    { color: '#4a9e6e', bg: 'rgba(74,158,110,0.04)',   border: 'rgba(74,158,110,0.15)' },
  }
  const c = colors[status] || colors['Not Started']
  return (
    <tr>
      <td style={{ padding: 0, background: c.bg, borderTop: `1px solid ${c.border}` }} />
      <td colSpan={6} style={{
        padding: '5px 8px 4px',
        background: c.bg,
        borderTop: `1px solid ${c.border}`,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: c.color, letterSpacing: '.1em', textTransform: 'uppercase' }}>
          {status} · {count}
        </span>
      </td>
    </tr>
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
    setSaving(true); setError('')
    const { error: err } = await onAdd(task.id, note, poc)
    if (err) { setError(err.message); setSaving(false); return }
    setNote(''); setSaving(false)
  }

  return (
    <tr>
      <td colSpan={7} style={{ padding: '0 8px 10px 8px' }}>
        <div style={{
          background: 'var(--gray50)', border: '1px solid rgba(74,158,110,0.15)',
          borderRadius: 8, padding: '10px 12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#4a9e6e', letterSpacing: '.07em', textTransform: 'uppercase' }}>
              Update History
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray500)', fontSize: 14 }}>✕</button>
          </div>
          {updates.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--gray500)', marginBottom: 10 }}>No updates logged yet.</div>
          ) : (
            <div style={{ marginBottom: 10, maxHeight: 200, overflowY: 'auto' }}>
              {updates.map(u => (
                <div key={u.id} style={{
                  padding: '6px 9px', marginBottom: 4,
                  background: 'var(--white)', borderRadius: 6, border: '1px solid var(--gray100)',
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                    {u.poc && <span style={{ fontSize: 10, fontWeight: 700, color: '#4a9e6e' }}>{u.poc}</span>}
                    <span style={{ fontSize: 10, color: 'var(--gray500)' }}>{fmtDateTime(u.created_at)}</span>
                  </div>
                  <MentionText text={u.note} style={{ fontSize: 11, color: 'var(--g900)', display: 'block' }} />
                </div>
              ))}
            </div>
          )}
          {error && <div style={{ fontSize: 10, color: 'var(--red)', marginBottom: 5 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
            <input className="form-input" value={poc}
              onChange={e => setPoc(e.target.value.toUpperCase())}
              placeholder="POC" style={{ padding: '4px 7px', fontSize: 11, width: 52, flexShrink: 0 }} />
            <input className="form-input" value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add an update…" style={{ padding: '4px 7px', fontSize: 11, flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }} autoFocus />
            <button className="btn btn-primary btn-sm" onClick={handleAdd}
              disabled={saving || !note.trim()} style={{ fontSize: 10, flexShrink: 0 }}>
              {saving ? '…' : 'Add'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task, updates, onSave, onDelete, onExpandUpdates, onAddUpdate, updatesOpen, selected, onSelect }) {
  const [editing, setEditing]         = useState(false)
  const [form, setForm]               = useState({ ...task })
  const [hovered, setHovered]         = useState(false)
  const [saveError, setSaveError]     = useState('')
  const [ongoingNote, setOngoingNote] = useState('')
  const [showNotePrompt, setShowNotePrompt] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const urgency     = urgencyOf(task)
  const isComplete  = task.status === 'Complete'
  const updateCount = updates?.length || 0

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'Ongoing' && task.status !== 'Ongoing') {
      setShowNotePrompt(true)
      return
    }
    await onSave({ ...task, status: newStatus })
  }

  const handleOngoingConfirm = async () => {
    await onSave({ ...task, status: 'Ongoing', update_notes: ongoingNote || task.update_notes })
    if (ongoingNote.trim()) await onAddUpdate(task.id, ongoingNote, task.poc)
    setShowNotePrompt(false)
    setOngoingNote('')
  }
  const handleSave = async () => {
    setSaveError('')
    const { error } = await onSave({ ...form, id: task.id })
    if (error) { setSaveError(error.message); return }
    setEditing(false)
  }
  const handleCancel = () => { setForm({ ...task }); setEditing(false); setSaveError('') }

  if (editing) {
    return (
      <tr style={{ background: 'rgba(74,158,110,0.05)' }}>
        <td style={{ padding: 0, background: '#4a9e6e' }} />
        <td style={tdSt}>
          <input type="date" className="form-input" value={form.due_date || ''}
            onChange={e => set('due_date', e.target.value)}
            style={{ padding: '2px 5px', fontSize: 11, width: '100%' }} />
        </td>
        <td style={tdSt}>
          <input className="form-input" value={form.item}
            onChange={e => set('item', e.target.value)}
            style={{ padding: '2px 5px', fontSize: 12, width: '100%' }} autoFocus />
          {saveError && <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 2 }}>{saveError}</div>}
        </td>
        <td style={tdSt}>
          <input className="form-input" value={form.poc || ''}
            onChange={e => set('poc', e.target.value.toUpperCase())}
            style={{ padding: '2px 5px', fontSize: 11, width: '100%' }} placeholder="DR" />
        </td>
        <td style={tdSt}>
          <select className="form-input" value={form.status || 'Not Started'}
            onChange={e => set('status', e.target.value)}
            style={{ padding: '2px 5px', fontSize: 11, width: '100%' }}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
        <td style={tdSt}>
          <input className="form-input" value={form.update_notes || ''}
            onChange={e => set('update_notes', e.target.value)}
            style={{ padding: '2px 5px', fontSize: 11, width: '100%' }} />
        </td>
        <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave}
            style={{ marginRight: 3, fontSize: 10 }}>Save</button>
          <button className="btn btn-sm" onClick={handleCancel} style={{ fontSize: 10 }}>Cancel</button>
        </td>
      </tr>
    )
  }

  const rowBg = urgency === 'critical' ? 'rgba(123,13,6,0.04)'
    : urgency === 'overdue' ? 'rgba(192,57,43,0.02)'
    : updatesOpen ? 'rgba(74,158,110,0.03)'
    : hovered ? 'rgba(74,158,110,0.025)'
    : 'transparent'

  const itemColor = isComplete ? 'var(--gray500)'
    : urgency === 'critical' ? '#7b0d06'
    : urgency === 'overdue' ? '#c0392b'
    : 'var(--g900)'

  return (
    <>
      {showNotePrompt && (
        <tr style={{ background: 'rgba(212,168,75,0.06)' }}>
          <td colSpan={7} style={{ padding: '8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#d4a84b', fontWeight: 600, flexShrink: 0 }}>Update note (required to mark Ongoing):</span>
              <input className="form-input" value={ongoingNote} onChange={e => setOngoingNote(e.target.value)}
                placeholder="What's the current status? @DR coordinating with brand…"
                style={{ padding: '3px 8px', fontSize: 11, flex: 1 }} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleOngoingConfirm(); if (e.key === 'Escape') setShowNotePrompt(false) }} />
              <button className="btn btn-primary btn-sm" onClick={handleOngoingConfirm} style={{ fontSize: 10, flexShrink: 0 }}>Confirm</button>
              <button className="btn btn-sm" onClick={() => setShowNotePrompt(false)} style={{ fontSize: 10 }}>Cancel</button>
            </div>
          </td>
        </tr>
      )}
      <tr
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderBottom: updatesOpen ? 'none' : '1px solid rgba(74,158,110,0.07)',
          background: rowBg,
          transition: 'background 0.1s',
          opacity: isComplete ? 0.5 : 1,
        }}
      >
        {/* Urgency stripe */}
        <td style={{ padding: 0, background: URGENCY_BORDER[urgency] }} />

        {/* Timeline */}
        <td style={tdSt}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input type="checkbox" className="row-checkbox" checked={!!selected}
              onChange={e => { e.stopPropagation(); onSelect(task.id, e.target.checked) }} />
            <DueBadge task={task} />
          </div>
        </td>

        {/* Item */}
        <td style={{ ...tdSt, overflow: 'hidden' }}>
          <span style={{
            display: 'block',
            fontSize: 12,
            color: itemColor,
            textDecoration: isComplete ? 'line-through' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {task.item}
          </span>
        </td>

        {/* POC */}
        <td style={{ ...tdSt, overflow: 'hidden' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#4a9e6e', letterSpacing: '.05em', display: 'block', textAlign: 'center' }}>
            {task.poc || ''}
          </span>
        </td>

        {/* Status */}
        <td style={tdSt}>
          <StatusCell status={task.status} onChange={handleStatusChange} />
        </td>

        {/* Update / notes */}
        <td style={{ ...tdSt, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <MentionText text={task.update_notes} style={{
              fontSize: 11, color: 'var(--gray500)', flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
            }} />
            <button
              onClick={() => onExpandUpdates(task.id)}
              style={{
                flexShrink: 0,
                background: updatesOpen ? 'rgba(74,158,110,0.15)' : 'rgba(74,158,110,0.07)',
                color: '#4a9e6e', border: '1px solid rgba(74,158,110,0.22)',
                borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 700,
                cursor: 'pointer', letterSpacing: '.04em', whiteSpace: 'nowrap',
              }}
            >
              {updateCount > 0 ? `${updateCount} ${updatesOpen ? '▲' : '▼'}` : (updatesOpen ? '▲' : '+')}
            </button>
          </div>
        </td>

        {/* Actions */}
        <td style={{ ...tdSt, opacity: hovered || updatesOpen ? 1 : 0, transition: 'opacity 0.15s', whiteSpace: 'nowrap' }}>
          <button className="card-action" onClick={() => setEditing(true)} style={{ fontSize: 10 }}>Edit</button>
          <button className="card-action" onClick={() => onDelete(task.id)}
            style={{ color: 'var(--red)', marginLeft: 3, fontSize: 10 }}>✕</button>
        </td>
      </tr>

      {updatesOpen && (
        <UpdatesPanel task={task} updates={updates || []} onAdd={onAddUpdate} onClose={() => onExpandUpdates(task.id)} />
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
    setSaving(true); setError('')
    const { error: err } = await onSave(cleanPayload(form))
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false)
  }

  return (
    <>
      <tr style={{ background: 'rgba(74,158,110,0.04)', borderBottom: '1px solid rgba(74,158,110,0.1)' }}>
        <td style={{ padding: 0, background: 'rgba(74,158,110,0.35)' }} />
        <td style={tdSt}>
          <input type="date" className="form-input" value={form.due_date}
            onChange={e => set('due_date', e.target.value)}
            style={{ padding: '2px 5px', fontSize: 11, width: '100%' }} />
        </td>
        <td style={tdSt}>
          <input className="form-input" value={form.item}
            onChange={e => set('item', e.target.value)}
            placeholder="New action item…"
            style={{ padding: '2px 5px', fontSize: 12, width: '100%' }}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel() }} />
        </td>
        <td style={tdSt}>
          <input className="form-input" value={form.poc}
            onChange={e => set('poc', e.target.value.toUpperCase())}
            style={{ padding: '2px 5px', fontSize: 11, width: '100%' }} placeholder="DR" />
        </td>
        <td style={tdSt}>
          <select className="form-input" value={form.status}
            onChange={e => set('status', e.target.value)}
            style={{ padding: '2px 5px', fontSize: 11, width: '100%' }}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </td>
        <td style={tdSt}>
          <input className="form-input" value={form.update_notes}
            onChange={e => set('update_notes', e.target.value)}
            style={{ padding: '2px 5px', fontSize: 11, width: '100%' }} />
        </td>
        <td style={{ ...tdSt, whiteSpace: 'nowrap' }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave}
            disabled={saving || !form.item.trim()}
            style={{ marginRight: 3, fontSize: 10 }}>{saving ? '…' : 'Add'}</button>
          <button className="btn btn-sm" onClick={onCancel} style={{ fontSize: 10 }}>Cancel</button>
        </td>
      </tr>
      {error && (
        <tr><td colSpan={7} style={{ padding: '3px 8px 6px', fontSize: 10, color: 'var(--red)' }}>{error}</td></tr>
      )}
    </>
  )
}

// ── Bulk action bar ───────────────────────────────────────────────────────────

function BulkBar({ count, onMarkStatus, onClear }) {
  return (
    <div className="bulk-bar" style={{ marginBottom: 16 }}>
      <span style={{ fontWeight: 600 }}>{count} selected</span>
      <button className="btn btn-sm" onClick={() => onMarkStatus('Complete')}
        style={{ background: 'rgba(74,158,110,0.3)', color: '#a8d5bc', border: 'none' }}>
        Mark Complete
      </button>
      <button className="btn btn-sm" onClick={() => onMarkStatus('Ongoing')}
        style={{ background: 'rgba(212,168,75,0.3)', color: '#d4a84b', border: 'none' }}>
        Mark Ongoing
      </button>
      <button className="btn btn-sm" onClick={() => onMarkStatus('Not Started')}
        style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none' }}>
        Mark Not Started
      </button>
      <button onClick={onClear} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}>✕</button>
    </div>
  )
}

// ── Template modal ────────────────────────────────────────────────────────────

function TemplateModal({ assets, onApply, onClose }) {
  const [selectedAsset, setSelectedAsset]     = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [applying, setApplying]               = useState(false)

  const handleApply = async () => {
    if (!selectedAsset || !selectedTemplate) return
    setApplying(true)
    const today = new Date()
    const tasks = TEMPLATES[selectedTemplate].map(t => {
      const due = new Date(today)
      due.setDate(due.getDate() + t.days)
      return {
        asset_id: selectedAsset,
        item: t.item,
        poc: t.poc,
        due_date: due.toISOString().split('T')[0],
        status: 'Not Started',
      }
    })
    await onApply(tasks)
    setApplying(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 480 }}>
        <div className="modal-header">
          <span className="modal-title">Apply Playbook</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="form-group">
          <label className="form-label">Select Property</label>
          <select className="form-select" value={selectedAsset} onChange={e => setSelectedAsset(e.target.value)}>
            <option value="">— choose asset —</option>
            {assets.filter(a => a.status !== 'disposed').map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Select Playbook</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.keys(TEMPLATES).map(name => (
              <div key={name}
                onClick={() => setSelectedTemplate(name)}
                style={{
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${selectedTemplate === name ? '#4a9e6e' : 'var(--gray200)'}`,
                  background: selectedTemplate === name ? 'rgba(74,158,110,0.07)' : '#fff',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--g900)', marginBottom: 2 }}>{name}</div>
                <div style={{ fontSize: 10, color: 'var(--gray500)' }}>{TEMPLATES[name].length} tasks · up to {Math.max(...TEMPLATES[name].map(t => t.days))}d timeline</div>
              </div>
            ))}
          </div>
        </div>
        {selectedTemplate && (
          <div style={{ background: 'var(--gray50)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#4a9e6e', letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 6 }}>Tasks to be created</div>
            {TEMPLATES[selectedTemplate].map((t, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--gray700)', padding: '3px 0', borderBottom: '1px solid var(--gray100)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{t.item}</span>
                <span style={{ color: 'var(--gray500)', flexShrink: 0, marginLeft: 12 }}>{t.poc} · Day {t.days}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={handleApply}
            disabled={!selectedAsset || !selectedTemplate || applying}>
            {applying ? 'Creating…' : `Create ${selectedTemplate ? TEMPLATES[selectedTemplate].length : ''} Tasks`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Drag handle icon ──────────────────────────────────────────────────────────

function GripIcon() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
      <circle cx="2.5" cy="3"  r="1.4"/>
      <circle cx="7.5" cy="3"  r="1.4"/>
      <circle cx="2.5" cy="8"  r="1.4"/>
      <circle cx="7.5" cy="8"  r="1.4"/>
      <circle cx="2.5" cy="13" r="1.4"/>
      <circle cx="7.5" cy="13" r="1.4"/>
    </svg>
  )
}

// ── Asset block ───────────────────────────────────────────────────────────────

function AssetBlock({
  asset, tasks, onSave, onDelete, updatesByTask, onExpandUpdates, expandedTask, onAddUpdate,
  hideComplete, overdueOnly,
  collapsed, onToggleCollapse,
  isDragging, isDragOver,
  onDragStart, onDragEnd, onDragOver, onDrop,
  selectedTasks, onSelect,
}) {
  const [addingRow, setAddingRow] = useState(false)

  const handleAdd = async (task) => {
    const { error } = await onSave(task)
    if (!error) setAddingRow(false)
  }

  const complete = tasks.filter(t => t.status === 'Complete').length
  const overdue  = tasks.filter(t => urgencyOf(t) === 'overdue').length

  const visibleTasks = sortTasks(tasks.filter(t => {
    if (overdueOnly && urgencyOf(t) !== 'overdue') return false
    if (hideComplete && t.status === 'Complete') return false
    return true
  }))

  if (visibleTasks.length === 0 && !addingRow) return null

  // Group visible tasks by status for section headers
  const groups = []
  let lastStatus = null
  visibleTasks.forEach(t => {
    if (t.status !== lastStatus) {
      groups.push({ type: 'header', status: t.status, count: visibleTasks.filter(x => x.status === t.status).length })
      lastStatus = t.status
    }
    groups.push({ type: 'task', task: t })
  })

  return (
    <div
      onDragOver={e => onDragOver(e, asset.id)}
      onDrop={e => onDrop(e, asset.id)}
      style={{
        marginBottom: 16,
        borderTop: isDragOver ? '2px solid #4a9e6e' : '2px solid transparent',
        opacity: isDragging ? 0.35 : 1,
        transition: 'opacity 0.15s, border-color 0.1s',
      }}
    >
      {/* Asset header */}
      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: 7, borderBottom: '1px solid rgba(74,158,110,0.15)', marginBottom: collapsed ? 0 : 8 }}>

        {/* Drag handle */}
        <div
          draggable
          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(asset.id) }}
          onDragEnd={onDragEnd}
          onClick={e => e.stopPropagation()}
          title="Drag to reorder"
          style={{
            cursor: 'grab', flexShrink: 0, padding: '2px 8px 2px 2px',
            color: 'var(--gray300)', display: 'flex', alignItems: 'center',
          }}
        >
          <GripIcon />
        </div>

        {/* Collapse toggle — takes up remaining space */}
        <div
          onClick={() => onToggleCollapse()}
          style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer', userSelect: 'none' }}
        >
          <span style={{ fontSize: 9, color: 'var(--gray400)', flexShrink: 0 }}>
            {collapsed ? '▶' : '▼'}
          </span>

          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--g900)', letterSpacing: '.01em', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {asset.name}
          </span>

          {asset.mvp_captain && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: '#4a9e6e',
              background: 'rgba(74,158,110,0.1)', border: '1px solid rgba(74,158,110,0.2)',
              padding: '2px 8px', borderRadius: 10, letterSpacing: '.06em', flexShrink: 0,
            }}>
              MVP · {asset.mvp_captain}
            </span>
          )}

          {overdue > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: '#c0392b',
              background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)',
              padding: '2px 7px', borderRadius: 10, flexShrink: 0,
            }}>
              {overdue} overdue
            </span>
          )}

          {/* Collapsed summary — show stats inline when collapsed */}
          {collapsed && (
            <span style={{ fontSize: 10, color: 'var(--gray500)', flexShrink: 0, display: 'flex', gap: 10 }}>
              {tasks.filter(t => t.status === 'Ongoing').length > 0 && (
                <span style={{ color: '#d4a84b', fontWeight: 600 }}>{tasks.filter(t => t.status === 'Ongoing').length} ongoing</span>
              )}
              {tasks.filter(t => t.status === 'Not Started').length > 0 && (
                <span>{tasks.filter(t => t.status === 'Not Started').length} not started</span>
              )}
            </span>
          )}
        </div>

        <div style={{ flexShrink: 0, width: 140, marginLeft: 10 }} onClick={e => e.stopPropagation()}>
          <ProgressBar complete={complete} total={tasks.length} />
        </div>

        <button
          className="btn btn-sm"
          onClick={e => { e.stopPropagation(); setAddingRow(true); onToggleCollapse(false) }}
          style={{ fontSize: 10, padding: '2px 9px', flexShrink: 0, marginLeft: 8 }}
        >
          + Add
        </button>
      </div>

      {/* Task table */}
      {!collapsed && (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <TableCols />
          <thead>
            <tr>
              <th style={{ ...thSt, padding: 0, border: 'none', width: 3 }} />
              <th style={{ ...thSt }}>Due</th>
              <th style={{ ...thSt }}>Action Item</th>
              <th style={{ ...thSt, textAlign: 'center' }}>POC</th>
              <th style={{ ...thSt }}>Status</th>
              <th style={{ ...thSt }}>Latest Update</th>
              <th style={{ ...thSt, width: 72 }} />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) =>
              g.type === 'header' ? (
                <StatusGroupRow key={`hdr-${g.status}`} status={g.status} count={g.count} />
              ) : (
                <TaskRow
                  key={g.task.id}
                  task={g.task}
                  updates={updatesByTask[g.task.id]}
                  onSave={onSave}
                  onDelete={onDelete}
                  onExpandUpdates={onExpandUpdates}
                  onAddUpdate={onAddUpdate}
                  updatesOpen={expandedTask === g.task.id}
                  selected={selectedTasks?.has(g.task.id)}
                  onSelect={onSelect}
                />
              )
            )}
            {addingRow && (
              <AddTaskRow assetId={asset.id} onSave={handleAdd} onCancel={() => setAddingRow(false)} />
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Tasks() {
  const { tasks, loading: tasksLoading, upsert, remove } = useTasks()
  const { assets, loading: assetsLoading }               = useAssets()
  const { byTask: updatesByTask, load: loadUpdates, add: addUpdate } = useTaskUpdates()
  const [expandedTask,    setExpandedTask]    = useState(null)
  const [hideComplete,    setHideComplete]    = useState(false)
  const [overdueOnly,     setOverdueOnly]     = useState(false)
  const [fundFilter,      setFundFilter]      = useState(null)
  const [collapsedAssets, setCollapsedAssets] = useState({})
  const collapsedInitialized = useRef(false)
  const [draggingId,      setDraggingId]      = useState(null)
  const [dragOverId,      setDragOverId]      = useState(null)
  const [assetOrders,     setAssetOrders]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('soul-asset-order') || '{}') }
    catch { return {} }
  })

  const loading = tasksLoading || assetsLoading

  // Collapse all assets on first load
  useEffect(() => {
    if (assets.length > 0 && !collapsedInitialized.current) {
      collapsedInitialized.current = true
      setCollapsedAssets(assets.reduce((acc, a) => ({ ...acc, [a.id]: true }), {}))
    }
  }, [assets])

  const handleExpandUpdates = (taskId) => {
    if (expandedTask === taskId) { setExpandedTask(null) }
    else { setExpandedTask(taskId); loadUpdates(taskId) }
  }

  const handleAddUpdate = async (taskId, note, poc) => {
    const result = await addUpdate(taskId, note, poc)
    if (!result.error) await upsert({ id: taskId, update_notes: note, poc: poc || undefined })
    return result
  }

  const assetsByFund = useMemo(() =>
    FUND_ORDER.reduce((acc, fund) => {
      acc[fund] = assets.filter(a => (a.fund || 'Other') === fund)
      return acc
    }, {}),
  [assets])

  const tasksByAsset = useMemo(() =>
    tasks.reduce((acc, t) => {
      if (!t.asset_id) return acc
      if (!acc[t.asset_id]) acc[t.asset_id] = []
      acc[t.asset_id].push(t)
      return acc
    }, {}),
  [tasks])

  const kpiTasks = useMemo(() => {
    if (!fundFilter) return tasks
    const ids = new Set((assetsByFund[fundFilter] || []).map(a => a.id))
    return tasks.filter(t => ids.has(t.asset_id))
  }, [tasks, fundFilter, assetsByFund])

  // ── Collapse helpers ────────────────────────────────────────────────────────

  const toggleCollapse = (assetId, forceTo) => {
    setCollapsedAssets(prev => ({
      ...prev,
      [assetId]: forceTo !== undefined ? forceTo : !prev[assetId],
    }))
  }

  const collapseAllInFund = (fund) => {
    const updates = (assetsByFund[fund] || []).reduce((acc, a) => ({ ...acc, [a.id]: true }), {})
    setCollapsedAssets(prev => ({ ...prev, ...updates }))
  }

  const expandAllInFund = (fund) => {
    const updates = (assetsByFund[fund] || []).reduce((acc, a) => ({ ...acc, [a.id]: false }), {})
    setCollapsedAssets(prev => ({ ...prev, ...updates }))
  }

  // ── Drag-to-reorder helpers ─────────────────────────────────────────────────

  const getSortedFundAssets = (fund) => {
    const base  = assetsByFund[fund] || []
    const order = assetOrders[fund]
    if (!order || order.length === 0) return base
    const rank = {}
    order.forEach((id, i) => { rank[id] = i })
    return [...base].sort((a, b) => (rank[a.id] ?? Infinity) - (rank[b.id] ?? Infinity))
  }

  const handleDragStart = (assetId) => setDraggingId(assetId)

  const handleDragEnd = () => { setDraggingId(null); setDragOverId(null) }

  const handleDragOver = (e, assetId) => {
    e.preventDefault()
    if (assetId !== draggingId) setDragOverId(assetId)
  }

  const handleDrop = (e, targetId, fund) => {
    e.preventDefault()
    if (!draggingId || draggingId === targetId) { handleDragEnd(); return }

    const sorted  = getSortedFundAssets(fund)
    const fromIdx = sorted.findIndex(a => a.id === draggingId)
    const toIdx   = sorted.findIndex(a => a.id === targetId)
    if (fromIdx === -1 || toIdx === -1) { handleDragEnd(); return }

    const reordered = [...sorted]
    const [moved]   = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    const newOrders = { ...assetOrders, [fund]: reordered.map(a => a.id) }
    setAssetOrders(newOrders)
    localStorage.setItem('soul-asset-order', JSON.stringify(newOrders))
    handleDragEnd()
  }

  // ── Bulk selection ──────────────────────────────────────────────────────────

  const [selectedTasks, setSelectedTasks] = useState(new Set())
  const [byPersonView,  setByPersonView]  = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  const handleSelect = (taskId, checked) => {
    setSelectedTasks(prev => {
      const next = new Set(prev)
      checked ? next.add(taskId) : next.delete(taskId)
      return next
    })
  }

  const handleBulkStatus = async (status) => {
    await Promise.all([...selectedTasks].map(id => upsert({ id, status })))
    setSelectedTasks(new Set())
  }

  const handleApplyTemplate = async (taskList) => {
    for (const t of taskList) await upsert(t)
  }

  // ── KPI counts ──────────────────────────────────────────────────────────────

  const overdueCount  = kpiTasks.filter(t => ['overdue','critical'].includes(urgencyOf(t))).length
  const notStarted    = kpiTasks.filter(t => t.status === 'Not Started').length
  const ongoing       = kpiTasks.filter(t => t.status === 'Ongoing').length
  const complete      = kpiTasks.filter(t => t.status === 'Complete').length
  const criticalCount = kpiTasks.filter(t => urgencyOf(t) === 'critical').length

  // ── POC view data ────────────────────────────────────────────────────────────

  const pocGroups = useMemo(() => {
    const visibleTasks = tasks.filter(t => {
      if (overdueOnly && !['overdue','critical'].includes(urgencyOf(t))) return false
      if (hideComplete && t.status === 'Complete') return false
      if (fundFilter) {
        const fundAssetIds = new Set((assetsByFund[fundFilter] || []).map(a => a.id))
        if (!fundAssetIds.has(t.asset_id)) return false
      }
      return true
    })
    const byPoc = {}
    visibleTasks.forEach(t => {
      const poc = t.poc || 'Unassigned'
      if (!byPoc[poc]) byPoc[poc] = []
      byPoc[poc].push(t)
    })
    return Object.entries(byPoc).sort((a, b) => a[0].localeCompare(b[0]))
  }, [tasks, overdueOnly, hideComplete, fundFilter, assetsByFund])

  const assetMap = useMemo(() => assets.reduce((acc, a) => ({ ...acc, [a.id]: a }), {}), [assets])

  if (loading) return <div className="loading">Loading…</div>

  const nowDate       = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const activeFunds   = fundFilter ? [fundFilter] : FUND_ORDER
  const hasFundAssets = FUND_ORDER.some(f => (assetsByFund[f] || []).length > 0)

  return (
    <div>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">30.60.90 Priorities</h1>
          <p className="page-subtitle">{getQuarter()} · As of {nowDate}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm" onClick={() => setShowTemplates(true)}
            style={{ fontSize: 10, background: 'rgba(74,158,110,0.08)', border: '1px solid rgba(74,158,110,0.25)', color: '#4a9e6e' }}>
            Playbooks
          </button>
          <button className="export-btn" onClick={() => window.print()} style={{ marginTop: 0 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM5 5V1.5a.5.5 0 0 0-.5-.5h-2A.5.5 0 0 0 2 1.5V5H1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1v1.5a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5V14h1a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H5zm1 0V2h4v3H6zm4 1v3H6V6h4zM3 2h1v3H3V2zm-1 9V6h12v5H2zm3-2H5v1h2v-1zm1 0h2v1H8v-1zm3 0h-1v1h1v-1z"/>
            </svg>
            Print
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="kpi-card" style={{ borderTop: criticalCount > 0 ? '3px solid #7b0d06' : overdueCount > 0 ? '3px solid #c0392b' : '3px solid transparent' }}>
          <div className="kpi-label">Overdue</div>
          <div className="kpi-value" style={{ color: criticalCount > 0 ? '#7b0d06' : overdueCount > 0 ? '#c0392b' : 'var(--g900)' }}>{overdueCount}</div>
          {criticalCount > 0 && <div style={{ fontSize: 9, color: '#7b0d06', fontWeight: 700, letterSpacing: '.04em' }}>{criticalCount} CRITICAL</div>}
        </div>
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
          <div className="kpi-value">{kpiTasks.length}</div>
        </div>
      </div>

      {/* Bulk bar */}
      {selectedTasks.size > 0 && (
        <BulkBar count={selectedTasks.size} onMarkStatus={handleBulkStatus} onClear={() => setSelectedTasks(new Set())} />
      )}

      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        padding: '9px 14px', background: 'var(--white)',
        border: '1px solid rgba(74,158,110,0.15)', borderRadius: 8, flexWrap: 'wrap',
      }}>
        {[null, ...FUND_ORDER].map(f => (
          <button key={f || 'all'} onClick={() => setFundFilter(f)} style={{
            padding: '3px 13px', fontSize: 11, fontWeight: 600, borderRadius: 20,
            border: '1px solid rgba(74,158,110,0.3)',
            background: fundFilter === f ? '#4a9e6e' : 'transparent',
            color: fundFilter === f ? '#fff' : '#4a9e6e',
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {f || 'All Funds'}
          </button>
        ))}

        <div style={{ width: 1, height: 18, background: 'rgba(74,158,110,0.2)', margin: '0 2px' }} />

        <button onClick={() => setOverdueOnly(o => !o)} style={{
          padding: '3px 13px', fontSize: 11, fontWeight: 600, borderRadius: 20,
          border: '1px solid rgba(192,57,43,0.4)',
          background: overdueOnly ? '#c0392b' : 'transparent',
          color: overdueOnly ? '#fff' : '#c0392b',
          cursor: 'pointer', transition: 'all 0.15s',
        }}>
          Overdue only
        </button>

        <button onClick={() => setHideComplete(h => !h)} style={{
          padding: '3px 13px', fontSize: 11, fontWeight: 600, borderRadius: 20,
          border: '1px solid rgba(74,158,110,0.3)',
          background: hideComplete ? 'rgba(74,158,110,0.12)' : 'transparent',
          color: '#4a9e6e', cursor: 'pointer', transition: 'all 0.15s',
        }}>
          {hideComplete ? 'Active only' : 'Hide complete'}
        </button>

        <button onClick={() => setByPersonView(v => !v)} style={{
          padding: '3px 13px', fontSize: 11, fontWeight: 600, borderRadius: 20,
          border: '1px solid rgba(74,158,110,0.3)',
          background: byPersonView ? '#4a9e6e' : 'transparent',
          color: byPersonView ? '#fff' : '#4a9e6e',
          cursor: 'pointer', transition: 'all 0.15s', marginLeft: 'auto',
        }}>
          {byPersonView ? 'By Property' : 'By Person'}
        </button>
      </div>

      {/* Template modal */}
      {showTemplates && (
        <TemplateModal assets={assets} onApply={handleApplyTemplate} onClose={() => setShowTemplates(false)} />
      )}

      {/* ── By-Person view ─────────────────────────────────────────────────────── */}
      {byPersonView ? (
        <div>
          {pocGroups.length === 0 ? (
            <div className="card"><div className="empty-state"><div className="empty-state-title">No tasks match current filters</div></div></div>
          ) : pocGroups.map(([poc, pocTasks]) => {
            const sorted = sortTasks(pocTasks)
            const pocOverdue = pocTasks.filter(t => ['overdue','critical'].includes(urgencyOf(t))).length
            return (
              <div key={poc} className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid rgba(74,158,110,0.15)' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--g900)', fontFamily: "'Playfair Display',serif" }}>{poc}</span>
                  <span style={{ fontSize: 10, color: 'var(--gray500)' }}>{pocTasks.length} tasks</span>
                  {pocOverdue > 0 && <span style={{ fontSize: 9, fontWeight: 700, color: '#c0392b', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)', padding: '2px 7px', borderRadius: 10 }}>{pocOverdue} overdue</span>}
                  <div style={{ marginLeft: 'auto', width: 160 }}><ProgressBar complete={pocTasks.filter(t => t.status === 'Complete').length} total={pocTasks.length} /></div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <TableCols />
                  <thead>
                    <tr>
                      <th style={{ ...thSt, padding: 0, border: 'none', width: 3 }} />
                      <th style={{ ...thSt }}>Due</th>
                      <th style={{ ...thSt }}>Action Item · Property</th>
                      <th style={{ ...thSt, textAlign: 'center' }}>POC</th>
                      <th style={{ ...thSt }}>Status</th>
                      <th style={{ ...thSt }}>Latest Update</th>
                      <th style={{ ...thSt, width: 72 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(t => {
                      const asset = assetMap[t.asset_id]
                      return (
                        <TaskRow
                          key={t.id}
                          task={{ ...t, item: asset ? `${t.item} · ${asset.name}` : t.item }}
                          updates={updatesByTask[t.id]}
                          onSave={upsert}
                          onDelete={remove}
                          onExpandUpdates={handleExpandUpdates}
                          onAddUpdate={handleAddUpdate}
                          updatesOpen={expandedTask === t.id}
                          selected={selectedTasks.has(t.id)}
                          onSelect={handleSelect}
                        />
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      ) : !hasFundAssets ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">Assign assets to a fund to get started</div>
            <div className="empty-state-desc">Set a <code>fund</code> value (KWHP I, KWHP II, or Other) on your assets.</div>
          </div>
        </div>
      ) : (
        activeFunds.map(fund => {
          const fundAssets   = getSortedFundAssets(fund)
          if (!fundAssets || fundAssets.length === 0) return null

          const fundTaskList = fundAssets.flatMap(a => tasksByAsset[a.id] || [])
          const fundComplete = fundTaskList.filter(t => t.status === 'Complete').length
          const fundOverdue  = fundTaskList.filter(t => ['overdue','critical'].includes(urgencyOf(t))).length

          const allCollapsed = fundAssets.every(a => !!collapsedAssets[a.id])

          return (
            <div key={fund} className="card" style={{ marginBottom: 20 }}>
              {/* Fund header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(74,158,110,0.18)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: 'var(--g900)', margin: 0, letterSpacing: '.02em' }}>
                    {fund}
                  </h2>
                  {fundOverdue > 0 && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: '#c0392b',
                      background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)',
                      padding: '2px 8px', borderRadius: 10, letterSpacing: '.04em',
                    }}>
                      {fundOverdue} overdue
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => allCollapsed ? expandAllInFund(fund) : collapseAllInFund(fund)}
                    style={{
                      padding: '2px 10px', fontSize: 10, fontWeight: 600, borderRadius: 20,
                      border: '1px solid rgba(74,158,110,0.25)',
                      background: 'transparent', color: '#4a9e6e',
                      cursor: 'pointer', letterSpacing: '.04em',
                    }}
                  >
                    {allCollapsed ? 'Expand all' : 'Collapse all'}
                  </button>
                  <div style={{ width: 200 }}>
                    <ProgressBar complete={fundComplete} total={fundTaskList.length} />
                  </div>
                </div>
              </div>

              {fundAssets.map(asset => {
                const assetTasks = tasksByAsset[asset.id] || []
                return (
                  <AssetBlock
                    key={asset.id}
                    asset={asset}
                    tasks={assetTasks}
                    onSave={upsert}
                    onDelete={remove}
                    updatesByTask={updatesByTask}
                    onExpandUpdates={handleExpandUpdates}
                    expandedTask={expandedTask}
                    onAddUpdate={handleAddUpdate}
                    hideComplete={hideComplete}
                    overdueOnly={overdueOnly}
                    collapsed={!!collapsedAssets[asset.id]}
                    onToggleCollapse={(forceTo) => toggleCollapse(asset.id, forceTo)}
                    isDragging={draggingId === asset.id}
                    isDragOver={dragOverId === asset.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(e, targetId) => handleDrop(e, targetId, fund)}
                    selectedTasks={selectedTasks}
                    onSelect={handleSelect}
                  />
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}
