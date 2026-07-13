import { useState, useEffect } from 'react'
import { resetEmployeePassword, fetchGroups, createGroup as apiCreateGroup, deleteGroup as apiDeleteGroup, addSubGroup as apiAddSubGroup, deleteSubGroup as apiDeleteSubGroup, assignToGroup, removeFromGroup as apiRemoveFromGroup } from '../../services/api'

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
  const [activeTab, setActiveTab]         = useState('users')
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

  // ── Groups state ──────────────────────────────────────────────────────────
  const [groups, setGroups]               = useState([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [manageGroup, setManageGroup]     = useState(null)  // group being managed
  const [newGroupName, setNewGroupName]   = useState('')
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupErr, setGroupErr]           = useState('')

  const loadGroups = async () => {
    setGroupsLoading(true)
    try { setGroups(await fetchGroups()) } catch {}
    setGroupsLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'groups') loadGroups()
  }, [activeTab])

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

  // ── Group CRUD handlers ───────────────────────────────────────────────────
  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    setGroupErr('')
    try {
      await apiCreateGroup(newGroupName.trim())
      setNewGroupName(''); setShowCreateGroup(false)
      loadGroups()
    } catch (e) { setGroupErr(e.message) }
  }

  const handleDeleteGroup = async (id) => {
    await apiDeleteGroup(id)
    if (manageGroup?.id === id) setManageGroup(null)
    loadGroups()
  }

  const handleAddSubGroup = async (groupId, name) => {
    if (!name.trim()) return
    await apiAddSubGroup(groupId, name.trim())
    loadGroups()
    // refresh manageGroup too
    setManageGroup(g => g?.id === groupId ? { ...g, _refresh: Date.now() } : g)
  }

  const handleDeleteSubGroup = async (sgId) => {
    await apiDeleteSubGroup(sgId)
    loadGroups()
  }

  const handleAssign = async (empId, groupId, subGroupId) => {
    await assignToGroup(empId, groupId, subGroupId ?? null)
    loadGroups()
  }

  const handleRemove = async (empId) => {
    await apiRemoveFromGroup(empId)
    loadGroups()
  }

  return (
    <div className="page-content">
      {/* ── Tab switcher ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 18, borderBottom: '2px solid #e2e8f0' }}>
        {[['users', 'Users'], ['groups', 'Groups']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: '9px 24px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 14,
            color: activeTab === key ? '#7c3aed' : '#64748b',
            borderBottom: activeTab === key ? '2px solid #7c3aed' : '2px solid transparent',
            marginBottom: -2, transition: 'all .15s',
          }}>{label}</button>
        ))}
      </div>

      {/* ══════════ GROUPS TAB ══════════ */}
      {activeTab === 'groups' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b' }}>Groups</h3>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Organise employees into groups and sub-groups</div>
            </div>
            <button onClick={() => { setShowCreateGroup(true); setGroupErr('') }} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
              border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(124,58,237,.3)',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create Group
            </button>
          </div>

          {groupsLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading…</div>
          ) : groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', background: '#f8fafc', borderRadius: 12, border: '2px dashed #e2e8f0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No groups yet</div>
              <div style={{ fontSize: 13 }}>Create a group to organise your team</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
              {groups.map(g => <GroupCard key={g.id} group={g} users={users}
                onManage={() => setManageGroup(g)}
                onDelete={() => handleDeleteGroup(g.id)}
              />)}
            </div>
          )}

          {/* Create Group modal */}
          {showCreateGroup && (
            <div style={{ position:'fixed', inset:0, zIndex:1200, background:'rgba(15,23,42,.45)', display:'flex', alignItems:'center', justifyContent:'center' }}
              onClick={e => { if (e.target===e.currentTarget) setShowCreateGroup(false) }}>
              <div style={{ background:'#fff', borderRadius:14, width:380, padding:28, boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}>
                <h4 style={{ margin:'0 0 16px', fontSize:16, fontWeight:700 }}>Create Group</h4>
                <input autoFocus value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && handleCreateGroup()}
                  placeholder="e.g. Development" style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:14, boxSizing:'border-box', outline:'none' }} />
                {groupErr && <div style={{ color:'#dc2626', fontSize:12, marginTop:6 }}>{groupErr}</div>}
                <div style={{ display:'flex', gap:8, marginTop:16, justifyContent:'flex-end' }}>
                  <button onClick={() => setShowCreateGroup(false)} style={{ padding:'8px 16px', borderRadius:8, border:'1px solid #e2e8f0', background:'#f1f5f9', color:'#64748b', fontWeight:600, cursor:'pointer' }}>Cancel</button>
                  <button onClick={handleCreateGroup} style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#7c3aed', color:'#fff', fontWeight:700, cursor:'pointer' }}>Create</button>
                </div>
              </div>
            </div>
          )}

          {/* Manage Members modal */}
          {manageGroup && (
            <ManageGroupModal
              group={groups.find(g => g.id === manageGroup.id) || manageGroup}
              users={users}
              onClose={() => setManageGroup(null)}
              onAddSubGroup={handleAddSubGroup}
              onDeleteSubGroup={handleDeleteSubGroup}
              onAssign={handleAssign}
              onRemove={handleRemove}
            />
          )}
        </div>
      )}

      {/* ══════════ USERS TAB ══════════ */}
      {activeTab === 'users' && (<>
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
      </>
      )}
    </div>
  )
}

/* ── GroupCard ──────────────────────────────────────────────────────────── */
function GroupCard({ group, users, onManage, onDelete }) {
  const totalMembers = group.directMembers.length + group.subGroups.reduce((s, sg) => s + sg.members.length, 0)
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1.5px solid #e2e8f0', padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:15, color:'#1e293b' }}>{group.name}</div>
          <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{totalMembers} member{totalMembers!==1?'s':''}</div>
        </div>
        <button onClick={onDelete} title="Delete group" style={{ border:'none', background:'none', cursor:'pointer', color:'#cbd5e1', padding:4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
      {group.subGroups.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:12 }}>
          {group.subGroups.map(sg => (
            <span key={sg.id} style={{ padding:'3px 10px', borderRadius:20, background:'#f3e8ff', color:'#7c3aed', fontSize:12, fontWeight:600 }}>
              {sg.name} <span style={{ color:'#a78bfa' }}>({sg.members.length})</span>
            </span>
          ))}
        </div>
      )}
      {/* Member avatars */}
      {totalMembers > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:12 }}>
          {[...group.directMembers, ...group.subGroups.flatMap(sg => sg.members)].slice(0,8).map(m => (
            <div key={m.id} title={m.name} style={{
              width:28, height:28, borderRadius:'50%', background:'#7c3aed22', color:'#7c3aed',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700,
            }}>{m.avatar || m.name.slice(0,2).toUpperCase()}</div>
          ))}
          {totalMembers > 8 && <div style={{ width:28, height:28, borderRadius:'50%', background:'#f1f5f9', color:'#64748b', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:600 }}>+{totalMembers-8}</div>}
        </div>
      )}
      <button onClick={onManage} style={{
        width:'100%', padding:'7px 0', borderRadius:8, border:'1.5px solid #7c3aed',
        background:'none', color:'#7c3aed', fontWeight:600, fontSize:13, cursor:'pointer',
      }}>Manage Members</button>
    </div>
  )
}

/* ── ManageGroupModal ───────────────────────────────────────────────────── */
function ManageGroupModal({ group, users, onClose, onAddSubGroup, onDeleteSubGroup, onAssign, onRemove }) {
  const [desigFilter, setDesigFilter] = useState('')
  const [newSgName, setNewSgName]     = useState('')
  const [addingSg, setAddingSg]       = useState(false)
  const [pickSg, setPickSg]           = useState({})  // empId → subGroupId to assign

  const allMembers = new Set([
    ...group.directMembers.map(m => m.id),
    ...group.subGroups.flatMap(sg => sg.members.map(m => m.id)),
  ])

  const available = users.filter(u =>
    !allMembers.has(u.id) &&
    (!desigFilter || (u.designation || '').toLowerCase().includes(desigFilter.toLowerCase()))
  )

  const designations = [...new Set(users.map(u => u.designation).filter(Boolean))]

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1300, background:'rgba(15,23,42,.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => { if (e.target===e.currentTarget) onClose() }}>
      <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:680, maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,.22)' }}>
        {/* Header */}
        <div style={{ padding:'20px 24px 14px', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:16, color:'#1e293b' }}>Manage — {group.name}</div>
            <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Add/remove members and sub-groups</div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', fontSize:20, color:'#94a3b8' }}>×</button>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:'16px 24px 20px' }}>
          {/* Sub-groups row */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>Sub-groups</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, alignItems:'center' }}>
              {group.subGroups.map(sg => (
                <span key={sg.id} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, background:'#f3e8ff', color:'#7c3aed', fontSize:13, fontWeight:600 }}>
                  {sg.name}
                  <button onClick={() => onDeleteSubGroup(sg.id)} style={{ border:'none', background:'none', cursor:'pointer', color:'#a78bfa', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                </span>
              ))}
              {addingSg ? (
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input autoFocus value={newSgName} onChange={e => setNewSgName(e.target.value)}
                    onKeyDown={e => { if (e.key==='Enter') { onAddSubGroup(group.id, newSgName); setNewSgName(''); setAddingSg(false) } if (e.key==='Escape') setAddingSg(false) }}
                    placeholder="Sub-group name" style={{ padding:'5px 10px', borderRadius:8, border:'1.5px solid #a78bfa', fontSize:13, outline:'none', width:150 }} />
                  <button onClick={() => { onAddSubGroup(group.id, newSgName); setNewSgName(''); setAddingSg(false) }}
                    style={{ padding:'5px 12px', borderRadius:8, border:'none', background:'#7c3aed', color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer' }}>Add</button>
                  <button onClick={() => setAddingSg(false)} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #e2e8f0', background:'#f1f5f9', color:'#64748b', fontSize:13, cursor:'pointer' }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setAddingSg(true)} style={{ padding:'4px 12px', borderRadius:20, border:'1.5px dashed #a78bfa', background:'none', color:'#7c3aed', fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Add Sub-group</button>
              )}
            </div>
          </div>

          {/* Current members */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>Current Members ({allMembers.size})</div>
            {allMembers.size === 0 ? (
              <div style={{ color:'#94a3b8', fontSize:13, padding:'8px 0' }}>No members yet</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {group.directMembers.map(m => <MemberRow key={m.id} m={m} label="Direct" onRemove={() => onRemove(m.id)} />)}
                {group.subGroups.map(sg => sg.members.map(m => <MemberRow key={m.id} m={m} label={sg.name} onRemove={() => onRemove(m.id)} />))}
              </div>
            )}
          </div>

          {/* Available employees */}
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>Add Members</div>
            <select value={desigFilter} onChange={e => setDesigFilter(e.target.value)}
              style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:13, marginBottom:10, color:'#374151' }}>
              <option value="">All Designations</option>
              {designations.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {available.length === 0 ? (
              <div style={{ color:'#94a3b8', fontSize:13, padding:'6px 0' }}>No employees to add{desigFilter ? ' for this designation' : ''}</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:220, overflowY:'auto' }}>
                {available.map(u => (
                  <div key={u.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:8, background:'#f8fafc', border:'1px solid #e2e8f0' }}>
                    <div style={{ width:30, height:30, borderRadius:'50%', background:'#e0e7ff', color:'#4f46e5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
                      {u.avatar || u.name.slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:13, color:'#1e293b' }}>{u.name}</div>
                      <div style={{ fontSize:11, color:'#94a3b8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.designation || u.dept}</div>
                    </div>
                    {group.subGroups.length > 0 && (
                      <select value={pickSg[u.id] ?? ''} onChange={e => setPickSg(p => ({ ...p, [u.id]: e.target.value }))}
                        style={{ padding:'4px 8px', borderRadius:6, border:'1px solid #e2e8f0', fontSize:12, color:'#374151' }}>
                        <option value="">Direct</option>
                        {group.subGroups.map(sg => <option key={sg.id} value={sg.id}>{sg.name}</option>)}
                      </select>
                    )}
                    <button onClick={() => onAssign(u.id, group.id, pickSg[u.id] ? Number(pickSg[u.id]) : null)}
                      style={{ padding:'5px 12px', borderRadius:7, border:'none', background:'#7c3aed', color:'#fff', fontWeight:600, fontSize:12, cursor:'pointer', flexShrink:0 }}>
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MemberRow({ m, label, onRemove }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 10px', borderRadius:8, background:'#faf5ff', border:'1px solid #e9d5ff' }}>
      <div style={{ width:28, height:28, borderRadius:'50%', background:'#7c3aed22', color:'#7c3aed', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>
        {m.avatar || m.name.slice(0,2).toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <span style={{ fontWeight:600, fontSize:13, color:'#1e293b' }}>{m.name}</span>
        {m.designation && <span style={{ marginLeft:6, fontSize:11, color:'#94a3b8' }}>{m.designation}</span>}
      </div>
      <span style={{ padding:'2px 8px', borderRadius:20, background:'#ede9fe', color:'#7c3aed', fontSize:11, fontWeight:600 }}>{label}</span>
      <button onClick={onRemove} title="Remove from group" style={{ border:'none', background:'none', cursor:'pointer', color:'#dc2626', padding:2 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  )
}
