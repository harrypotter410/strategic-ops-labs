import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAssets, useDeals } from '../hooks/useData'

const PRIORITIES = { low: { label: 'Low', color: 'var(--gray500)', bg: 'var(--gray100)' }, medium: { label: 'Medium', color: 'var(--blue)', bg: 'var(--blueL)' }, high: { label: 'High', color: 'var(--amber)', bg: 'var(--amberL)' }, urgent: { label: 'Urgent', color: 'var(--red)', bg: 'var(--redL)' } }
const STATUSES = { open: 'Open', in_progress: 'In Progress', done: 'Done', cancelled: 'Cancelled' }

function useTasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const { data } = await supabase.from('tasks').select('*, assets(name), deals(name)').order('due_date', { ascending: true, nullsFirst: false }).order('priority', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const save = async (task) => {
    if (task.id) {
      const { data, error } = await supabase.from('tasks').update(task).eq('id', task.id).select('*, assets(name), deals(name)').single()
      if (!error) setTasks(prev => prev.map(t => t.id === task.id ? data : t))
      return { data, error }
    } else {
      const { data, error } = await supabase.from('tasks').insert(task).select('*, assets(name), deals(name)').single()
      if (!error) setTasks(prev => [data, ...prev])
      return { data, error }
    }
  }

  const remove = async (id) => {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const toggle = async (task) => {
    const next = task.status === 'done' ? 'open' : 'done'
    const updates = { status: next, completed_at: next === 'done' ? new Date().toISOString() : null }
    const { data } = await supabase.from('tasks').update(updates).eq('id', task.id).select('*, assets(name), deals(name)').single()
    if (data) setTasks(prev => prev.map(t => t.id === task.id ? data : t))
  }

  return { tasks, loading, save, remove, toggle, refetch: fetch }
}

function TaskModal({ task, assets, deals, onClose, onSave }) {
  const [form, setForm] = useState(task ? { ...task } : {
    title: '', description: '', due_date: '', priority: 'medium',
    status: 'open', asset_id: '', deal_id: '', assigned_to: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Title is required'); return }
    setLoading(true)
    const payload = { ...form, asset_id: form.asset_id || null, deal_id: form.deal_id || null, due_date: form.due_date || null }
    const { error } = await onSave(payload)
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{task ? 'Edit Task' : 'Add Task'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ background: 'var(--redL)', color: 'var(--red)', padding: '8px 12px', borderRadius: 7, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div className="form-group"><label className="form-label">Task Title *</label><input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Follow up with CBRE on Destin deal" /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} style={{ resize: 'vertical' }} /></div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Priority</label>
            <select className="form-select" value={form.priority} onChange={e => set('priority', e.target.value)}>
              {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Due Date</label><input className="form-input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Link to Asset</label>
            <select className="form-select" value={form.asset_id} onChange={e => set('asset_id', e.target.value)}>
              <option value="">No asset</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Link to Deal</label>
            <select className="form-select" value={form.deal_id} onChange={e => set('deal_id', e.target.value)}>
              <option value="">No deal</option>
              {deals.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group"><label className="form-label">Assigned To</label><input className="form-input" value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="Bear Hutchinson" /></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : task ? 'Save Changes' : 'Add Task'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Tasks() {
  const { tasks, loading, save, remove, toggle } = useTasks()
  const { assets } = useAssets()
  const { deals } = useDeals()
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState('open')
  const [priorityFilter, setPriorityFilter] = useState('all')

  const filtered = tasks.filter(t => {
    if (filter === 'open' && (t.status === 'done' || t.status === 'cancelled')) return false
    if (filter === 'done' && t.status !== 'done') return false
    if (filter === 'all') {}
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    return true
  })

  const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done' && t.status !== 'cancelled')
  const dueToday = tasks.filter(t => t.due_date && new Date(t.due_date).toDateString() === new Date().toDateString() && t.status !== 'done')
  const open = tasks.filter(t => t.status === 'open' || t.status === 'in_progress')
  const done = tasks.filter(t => t.status === 'done')

  const isOverdue = (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done' && t.status !== 'cancelled'

  if (loading) return <div className="loading">Loading tasks...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Tasks</h1>
        <p>Action items across your portfolio and pipeline</p>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Open Tasks</div><div className="kpi-value">{open.length}</div><div className="kpi-change">Across portfolio & deals</div></div>
        <div className="kpi-card"><div className="kpi-label">Overdue</div><div className="kpi-value" style={{ color: overdue.length > 0 ? 'var(--red)' : 'var(--g900)' }}>{overdue.length}</div><div className={`kpi-change${overdue.length > 0 ? ' down' : ''}`}>{overdue.length > 0 ? 'Need attention' : 'All on track'}</div></div>
        <div className="kpi-card"><div className="kpi-label">Due Today</div><div className="kpi-value">{dueToday.length}</div><div className="kpi-change">Action required today</div></div>
        <div className="kpi-card"><div className="kpi-label">Completed</div><div className="kpi-value">{done.length}</div><div className="kpi-change">Total closed tasks</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, flexWrap: 'wrap' }}>
            <span className="card-title">All tasks</span>
            <div className="filter-tabs" style={{ margin: 0 }}>
              {[['open','Open'],['done','Done'],['all','All']].map(([v,l]) => <button key={v} className={`filter-tab${filter===v?' active':''}`} onClick={() => setFilter(v)}>{l}</button>)}
            </div>
            <div className="filter-tabs" style={{ margin: 0 }}>
              {[['all','All'],['urgent','Urgent'],['high','High'],['medium','Medium'],['low','Low']].map(([v,l]) => (
                <button key={v} className={`filter-tab${priorityFilter===v?' active':''}`} onClick={() => setPriorityFilter(v)}>{l}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Add Task</button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">{filter === 'open' ? 'No open tasks' : 'No tasks'}</div>
            <div className="empty-state-desc">Add action items to track follow-ups, deadlines, and next steps.</div>
            <button className="btn btn-primary" onClick={() => setModal({})}>+ Add Task</button>
          </div>
        ) : (
          <div>
            {filtered.map(task => {
              const p = PRIORITIES[task.priority]
              const overdue = isOverdue(task)
              return (
                <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--gray100)' }}>
                  {/* Checkbox */}
                  <div
                    style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${task.status === 'done' ? 'var(--g400)' : 'var(--gray300)'}`, background: task.status === 'done' ? 'var(--g100)' : 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: 2, transition: 'all .12s' }}
                    onClick={() => toggle(task)}
                  >
                    {task.status === 'done' && <span style={{ fontSize: 10, color: 'var(--g600)' }}>✓</span>}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: task.status === 'done' ? 'var(--gray500)' : 'var(--g900)', textDecoration: task.status === 'done' ? 'line-through' : 'none' }}>{task.title}</span>
                      <span style={{ fontSize: 9, fontWeight: 500, padding: '2px 7px', borderRadius: 10, background: p.bg, color: p.color, letterSpacing: '.04em', textTransform: 'uppercase' }}>{p.label}</span>
                      {task.assets?.name && <span style={{ fontSize: 10, color: 'var(--g600)', background: 'var(--g50)', padding: '1px 7px', borderRadius: 10 }}>🏨 {task.assets.name}</span>}
                      {task.deals?.name && <span style={{ fontSize: 10, color: 'var(--blue)', background: 'var(--blueL)', padding: '1px 7px', borderRadius: 10 }}>💼 {task.deals.name}</span>}
                    </div>
                    {task.description && <div style={{ fontSize: 12, color: 'var(--gray500)', marginBottom: 3 }}>{task.description}</div>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--gray500)', flexWrap: 'wrap' }}>
                      {task.due_date && <span style={{ color: overdue ? 'var(--red)' : 'var(--gray500)', fontWeight: overdue ? 500 : 400 }}>{overdue ? '⚠ Overdue · ' : '📅 '}{new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                      {task.assigned_to && <span>👤 {task.assigned_to}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="card-action" onClick={() => setModal(task)}>Edit</button>
                    <button className="card-action" style={{ color: 'var(--red)' }} onClick={() => remove(task.id)}>Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal !== null && <TaskModal task={modal?.id ? modal : null} assets={assets} deals={deals} onClose={() => setModal(null)} onSave={save} />}
    </div>
  )
}
