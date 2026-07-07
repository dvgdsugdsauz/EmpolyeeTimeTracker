import { useState } from 'react'
import { resetEmployeePassword } from '../../services/api'

const USE_API = Boolean(import.meta.env.VITE_API_URL)

const DEPARTMENTS = [
  'Product & Engineering',
  'Security & Infrastructure',
  'Operations & Enablement',
]

const DESIGNATIONS = [
  'Associate Software Engineer - Frontend UI',
  'Associate Software Engineer - Frontend UX',
  'Software Engineer - Frontend UI',
  'Software Engineer - Backend',
  'Software Engineer - Mobile Developer',
  'Senior Software Engineer - Frontend Lead',
  'Senior Database Administrator - Lead',
  'Technical Delivery Manager',
  'IT Systems Manager',
  'IT Systems Administrator',
  'Quality Assurance Engineer',
  'Finance Manager',
  'HR Coordinator',
  'HR Manager',
]

const EMPTY_FORM = { id: '', name: '', email: '', username: '', dept: '', designation: '', role: 'employee', password: '' }

const ROLE_COLORS = { employee: '#4f46e5', manager: '#0891b2', admin: '#7c3aed', hr: '#059669' }

function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || '#6b7280'
  return (
    <span className="role-badge" style={{ background: color + '20', color }}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}

export default function UserManagement({ users, onAddUser, onEditUser, onDeleteUser }) {
  const [showAddForm, setShowAddForm]     = useState(false)
  const [editUser, setEditUser]           = useState(null)
  const [form, setForm]                   = useState(EMPTY_FORM)
  const [editForm, setEditForm]           = useState({})
  const [roleFilter, setRoleFilter]       = useState('ALL')
  const [search, setSearch]               = useState('')
  const [error, setError]                 = useState('')
  const [editError, setEditError]         = useState('')
  const [resetUser, setResetUser]         = useState(null)
  const [resetPw, setResetPw]             = useState('')
  const [resetMsg, setResetMsg]           = useState('')
  const [resetError, setResetError]       = useState('')

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setResetError('')
    if (resetPw.length < 6) return setResetError('Password must be at least 6 characters')
    if (USE_API) {
      try {
        await resetEmployeePassword(resetUser.id, resetPw)
      } catch (err) {
        return setResetError(err.message || 'Failed')
      }
    }
    setResetMsg('Password reset successfully!')
    setTimeout(() => { setResetUser(null); setResetPw(''); setResetMsg('') }, 1500)
  }

  const filtered = users.filter(u => {
    const matchRole   = roleFilter === 'ALL' || u.role === roleFilter
    const matchSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      u.id.toLowerCase().includes(search.toLowerCase())
    return matchRole && matchSearch
  })

  const handleAdd = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.id || !form.name || !form.email || !form.dept || !form.password) {
      setError('All fields are required.')
      return
    }
    try {
      await onAddUser({
        ...form,
        avatar: form.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      })
      setForm(EMPTY_FORM)
      setShowAddForm(false)
    } catch (err) {
      setError(err.message || 'Failed to create user. Check Employee ID or username.')
    }
  }

  const openEdit = (u) => {
    setEditUser(u)
    setEditForm({
      name:        u.name        || '',
      dept:        u.dept        || '',
      designation: u.designation || '',
      role:        u.role        || 'employee',
      email:       u.email       || '',
      username:    u.username    || '',
      password:    '',
    })
    setEditError('')
  }

  const handleEdit = (e) => {
    e.preventDefault()
    setEditError('')
    if (!editForm.name || !editForm.dept || !editForm.role) {
      setEditError('Name, department and role are required.')
      return
    }
    onEditUser(editUser.id, {
      ...editForm,
      avatar: editForm.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
    })
    setEditUser(null)
  }

  return (
    <div className="page-content">
      <div className="section-card">
        <div className="section-header">
          <div className="section-header-left">
            <h3>User Management</h3>
            <span className="section-count">{users.length} users</span>
          </div>
          <div className="section-header-right">
            <input
              className="search-input"
              placeholder="Search by name, email, ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="filter-tabs">
              {['ALL', 'employee', 'manager', 'hr', 'admin'].map(r => (
                <button key={r} className={`filter-tab ${roleFilter === r ? 'active' : ''}`} onClick={() => setRoleFilter(r)}>
                  {r === 'ALL' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            <button className="btn-primary-sm" onClick={() => { setShowAddForm(true); setError('') }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add User
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table className="data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Employee</th>
                <th>ID</th>
                <th>Department</th>
                <th>Role</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="table-emp-cell">
                      <div className="table-avatar">{u.avatar}</div>
                      <div>
                        <div className="table-emp-name">{u.name}</div>
                        {u.designation && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.designation}</div>}
                      </div>
                    </div>
                  </td>
                  <td><code className="id-code">{u.id}</code></td>
                  <td>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{u.dept}</div>
                  </td>
                  <td><RoleBadge role={u.role} /></td>
                  <td className="text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn-secondary-sm" onClick={() => openEdit(u)} title="Edit User">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Edit
                      </button>
                      <button className="btn-secondary-sm" onClick={() => { setResetUser(u); setResetPw(''); setResetError(''); setResetMsg('') }} title="Reset Password"
                        style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
                        🔑
                      </button>
                      <button className="btn-danger-sm" onClick={() => onDeleteUser(u.id)} title="Delete User">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAddForm(false) }}>
          <div className="modal-card">
            <div className="modal-header">
              <h3>Add New User</h3>
              <button className="modal-close" onClick={() => setShowAddForm(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleAdd} className="modal-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Employee ID</label>
                  <input value={form.id} onChange={e => setForm({...form, id: e.target.value})} placeholder="e.g. 10175" required />
                </div>
                <div className="form-group">
                  <label>Full Name</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="John Smith" required />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="john@wilotus.com" required />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input value={form.username} onChange={e => setForm({...form, username: e.target.value})} placeholder="john.smith" required />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <select value={form.dept} onChange={e => setForm({...form, dept: e.target.value})} required>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group form-col-span-2">
                  <label>Designation</label>
                  <select value={form.designation} onChange={e => setForm({...form, designation: e.target.value})}>
                    <option value="">Select designation</option>
                    {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Set initial password" required />
                </div>
              </div>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditUser(null) }}>
          <div className="modal-card">
            <div className="modal-header">
              <h3>Edit User — <span style={{ color: '#6b7280', fontWeight: 400 }}>{editUser.name}</span></h3>
              <button className="modal-close" onClick={() => setEditUser(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleEdit} className="modal-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Full Name</label>
                  <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <select value={editForm.dept} onChange={e => setEditForm({...editForm, dept: e.target.value})} required>
                    <option value="">Select department</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} placeholder="john@wilotus.com" required />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr">HR</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group form-col-span-2">
                  <label>Designation</label>
                  <select value={editForm.designation} onChange={e => setEditForm({...editForm, designation: e.target.value})}>
                    <option value="">Select designation</option>
                    {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group form-col-span-2">
                  <label>New Password <span style={{ color: '#9ca3af', fontWeight: 400 }}>(leave blank to keep current)</span></label>
                  <input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} placeholder="Leave blank to keep current" />
                </div>
              </div>
              <div style={{ padding: '8px 0 4px', fontSize: 12, color: '#9ca3af' }}>
                ID: <code>{editUser.id}</code>
              </div>
              {editError && <p className="form-error">{editError}</p>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setResetUser(null) }}>
          <div className="modal-card" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button className="modal-close" onClick={() => setResetUser(null)}>×</button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div style={{ padding: '16px 24px 8px' }}>
                <div style={{ marginBottom: 14, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, fontSize: 13, color: '#475569' }}>
                  <strong>{resetUser.name}</strong> ({resetUser.id})
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={resetPw}
                    onChange={e => setResetPw(e.target.value)}
                    placeholder="Min 6 characters"
                    autoFocus
                    required
                  />
                </div>
                {resetError && <p className="form-error">{resetError}</p>}
                {resetMsg && <p style={{ color: '#16a34a', fontSize: 13, margin: '4px 0' }}>{resetMsg}</p>}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setResetUser(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
