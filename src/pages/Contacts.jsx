import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = { broker: { label: 'Broker', color: 'var(--blue)', bg: 'var(--blueL)' }, lender: { label: 'Lender', color: 'var(--g700)', bg: 'var(--g100)' }, operator: { label: 'Operator', color: 'var(--amber)', bg: 'var(--amberL)' }, jv_partner: { label: 'JV Partner', color: '#7b1fa2', bg: '#f3e5f5' }, legal: { label: 'Legal', color: 'var(--gray700)', bg: 'var(--gray100)' }, consultant: { label: 'Consultant', color: '#0288d1', bg: '#e1f5fe' }, investor: { label: 'Investor', color: '#2e7d32', bg: '#e8f5e9' }, other: { label: 'Other', color: 'var(--gray500)', bg: 'var(--gray100)' } }

function useContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const { data } = await supabase.from('contacts').select('*').order('name')
    setContacts(data || [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const save = async (c) => {
    if (c.id) {
      const { data, error } = await supabase.from('contacts').update(c).eq('id', c.id).select().single()
      if (!error) setContacts(prev => prev.map(x => x.id === c.id ? data : x))
      return { data, error }
    } else {
      const { data, error } = await supabase.from('contacts').insert(c).select().single()
      if (!error) setContacts(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)))
      return { data, error }
    }
  }

  const remove = async (id) => {
    await supabase.from('contacts').delete().eq('id', id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  return { contacts, loading, save, remove }
}

function ContactModal({ contact, onClose, onSave }) {
  const [form, setForm] = useState(contact ? { ...contact } : { name: '', company: '', role: '', category: 'broker', email: '', phone: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setLoading(true)
    const { error } = await onSave(form)
    if (error) { setError(error.message); setLoading(false); return }
    setLoading(false); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{contact ? 'Edit Contact' : 'Add Contact'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {error && <div style={{ background: 'var(--redL)', color: 'var(--red)', padding: '8px 12px', borderRadius: 7, fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Company</label><input className="form-input" value={form.company} onChange={e => set('company', e.target.value)} placeholder="CBRE, JLL, Wells Fargo..." /></div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Role / Title</label><input className="form-input" value={form.role} onChange={e => set('role', e.target.value)} placeholder="Managing Director" /></div>
          <div className="form-group"><label className="form-label">Category</label>
            <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Phone</label><input className="form-input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} placeholder="Covers Southeast markets, strong Marriott relationships..." /></div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : contact ? 'Save Changes' : 'Add Contact'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Contacts() {
  const { contacts, loading, save, remove } = useContacts()
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [deleteId, setDeleteId] = useState(null)

  const filtered = contacts.filter(c => {
    if (catFilter !== 'all' && c.category !== catFilter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.company?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const initials = (name) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  if (loading) return <div className="loading">Loading contacts...</div>

  return (
    <div>
      <div className="page-header">
        <h1>Contacts</h1>
        <p>Brokers, lenders, operators, and key relationships</p>
      </div>

      <div className="kpi-grid">
        {Object.entries(CATEGORIES).slice(0, 4).map(([k, v]) => (
          <div className="kpi-card" key={k}>
            <div className="kpi-label">{v.label}s</div>
            <div className="kpi-value">{contacts.filter(c => c.category === k).length}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, flexWrap: 'wrap' }}>
            <span className="card-title">All contacts</span>
            <div className="filter-tabs" style={{ margin: 0 }}>
              <button className={`filter-tab${catFilter==='all'?' active':''}`} onClick={() => setCatFilter('all')}>All</button>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <button key={k} className={`filter-tab${catFilter===k?' active':''}`} onClick={() => setCatFilter(k)}>{v.label}</button>
              ))}
            </div>
            <input className="form-input" style={{ width: 200, padding: '5px 10px', fontSize: 12 }} placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>+ Add Contact</button>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">No contacts yet</div>
            <div className="empty-state-desc">Add brokers, lenders, operators, and other key relationships.</div>
            <button className="btn btn-primary" onClick={() => setModal({})}>+ Add Contact</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {filtered.map(c => {
              const cat = CATEGORIES[c.category] || CATEGORIES.other
              return (
                <div key={c.id} style={{ background: 'var(--white)', border: '1px solid var(--gray100)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: cat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: cat.color, flexShrink: 0 }}>{initials(c.name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--g900)', marginBottom: 2 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--gray500)' }}>{[c.role, c.company].filter(Boolean).join(' · ')}</div>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 500, padding: '2px 7px', borderRadius: 10, background: cat.bg, color: cat.color, letterSpacing: '.04em', textTransform: 'uppercase', flexShrink: 0 }}>{cat.label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray500)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {c.email && <a href={`mailto:${c.email}`} style={{ color: 'var(--g600)', textDecoration: 'none' }}>✉ {c.email}</a>}
                    {c.phone && <span>📞 {c.phone}</span>}
                    {c.notes && <span style={{ color: 'var(--gray500)', marginTop: 4, fontSize: 11, lineHeight: 1.5 }}>{c.notes.slice(0, 80)}{c.notes.length > 80 ? '...' : ''}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--gray100)' }}>
                    <button className="card-action" onClick={() => setModal(c)}>Edit</button>
                    <button className="card-action" style={{ color: 'var(--red)' }} onClick={() => setDeleteId(c.id)}>Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal !== null && <ContactModal contact={modal?.id ? modal : null} onClose={() => setModal(null)} onSave={save} />}
      {deleteId && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeleteId(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header"><span className="modal-title">Delete Contact</span><button className="modal-close" onClick={() => setDeleteId(null)}>✕</button></div>
            <p style={{ fontSize: 13, color: 'var(--gray700)', marginBottom: 20 }}>Delete this contact? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { remove(deleteId); setDeleteId(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
