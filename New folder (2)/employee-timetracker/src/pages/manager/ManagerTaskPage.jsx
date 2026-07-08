import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import * as api from '../../services/api'

const PRIORITY_COLOR = {
  High:   { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  Medium: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  Low:    { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
}
const STATUS_COLOR = {
  Completed:    { bg: '#f0fdf4', color: '#16a34a' },
  'In Progress':{ bg: '#eff6ff', color: '#2563eb' },
  Pending:      { bg: '#fafafa', color: '#6b7280' },
}

function FilterDropdown({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 4, background: 'none',
        border: 'none', cursor: 'pointer', color: value ? '#6366f1' : '#475569',
        fontSize: 13, fontWeight: 600, padding: '2px 4px',
      }}>
        {label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100, minWidth: 160,
          background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: 4,
        }}>
          <div onClick={() => { onChange(''); setOpen(false) }} style={{
            padding: '7px 12px', cursor: 'pointer', borderRadius: 6, fontSize: 13,
            color: value === '' ? '#6366f1' : '#374151',
            background: value === '' ? '#eef2ff' : 'none',
          }}>All</div>
          {options.map(o => (
            <div key={o} onClick={() => { onChange(o); setOpen(false) }} style={{
              padding: '7px 12px', cursor: 'pointer', borderRadius: 6, fontSize: 13,
              color: value === o ? '#6366f1' : '#374151',
              background: value === o ? '#eef2ff' : 'none',
            }}>{o}</div>
          ))}
        </div>
      )}
    </div>
  )
}

function AssignModal({ checkedIds, selectedTasks, employees, onClose, onAssigned }) {
  const [empSearch, setEmpSearch]   = useState('')
  const [assignEmp, setAssignEmp]   = useState(null)
  const [empDropOpen, setEmpDropOpen] = useState(false)
  const [assigning, setAssigning]   = useState(false)
  const [msg, setMsg]               = useState('')
  const empRef = useRef()
  const backdropRef = useRef()

  useEffect(() => {
    const h = (e) => { if (empRef.current && !empRef.current.contains(e.target)) setEmpDropOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filteredEmps = employees.filter(e =>
    (e.name || '').toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.username || '').toLowerCase().includes(empSearch.toLowerCase())
  )

  const handleAssign = async () => {
    if (!assignEmp) return
    setAssigning(true)
    try {
      await api.assignTasksBulk([...checkedIds], assignEmp.id)
      onAssigned(assignEmp.name, selectedTasks.length)
    } catch {
      setMsg('Assignment failed')
      setTimeout(() => setMsg(''), 3000)
      setAssigning(false)
    }
  }

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: 440, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
        overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, background: '#eef2ff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Assign Tasks</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{checkedIds.size} task{checkedIds.size > 1 ? 's' : ''} selected</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#f1f5f9', border: 'none', borderRadius: 8,
            width: 32, height: 32, cursor: 'pointer', color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Selected task list */}
        <div style={{ padding: '16px 24px 0', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Selected Tasks</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {selectedTasks.map(t => (
              <div key={t.taskId} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8,
                background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12,
              }}>
                <span style={{ fontWeight: 700, color: '#6366f1', minWidth: 58 }}>{t.taskId}</span>
                <span style={{ color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.module} · {t.type}
                </span>
                {t.priority && (() => {
                  const pc = PRIORITY_COLOR[t.priority] || {}
                  return (
                    <span style={{
                      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`, flexShrink: 0,
                    }}>{t.priority}</span>
                  )
                })()}
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#e2e8f0', margin: '16px 0' }} />

          {/* Employee Search */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Assign To Employee</div>
            <div ref={empRef} style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search employee..."
                value={empSearch}
                onChange={e => { setEmpSearch(e.target.value); setAssignEmp(null); setEmpDropOpen(true) }}
                onFocus={() => setEmpDropOpen(true)}
                autoFocus
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  color: '#1e293b', outline: 'none', boxSizing: 'border-box',
                }}
              />
              {empDropOpen && filteredEmps.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, marginTop: 4,
                  background: '#fff', border: '1px solid #e2e8f0',
                  borderRadius: 10, maxHeight: 180, overflowY: 'auto',
                  boxShadow: '0 8px 24px rgba(0,0,0,.12)',
                }}>
                  {filteredEmps.map(emp => (
                    <div
                      key={emp.id}
                      onClick={() => { setAssignEmp(emp); setEmpSearch(emp.name || emp.username); setEmpDropOpen(false) }}
                      style={{
                        padding: '9px 14px', cursor: 'pointer', fontSize: 13,
                        background: assignEmp?.id === emp.id ? '#eef2ff' : '#fff',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}
                      onMouseEnter={e => { if (assignEmp?.id !== emp.id) e.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={e => { e.currentTarget.style.background = assignEmp?.id === emp.id ? '#eef2ff' : '#fff' }}
                    >
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{emp.name || emp.username}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{emp.dept} · {emp.designation}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {assignEmp && (
              <div style={{
                marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8, background: '#eef2ff',
                border: '1px solid #c7d2fe', fontSize: 13,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span style={{ fontWeight: 600, color: '#6366f1' }}>{assignEmp.name}</span>
                <span style={{ fontSize: 11, color: '#8b5cf6', marginLeft: 'auto' }}>{assignEmp.dept}</span>
              </div>
            )}

            {msg && (
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 13,
                background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
              }}>{msg}</div>
            )}
          </div>
        </div>

        {/* Footer buttons */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #e2e8f0',
          display: 'flex', gap: 10,
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 9, cursor: 'pointer',
              background: '#f1f5f9', border: '1px solid #e2e8f0',
              color: '#64748b', fontWeight: 600, fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!assignEmp || assigning}
            style={{
              flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 0', borderRadius: 9, border: 'none',
              cursor: assignEmp && !assigning ? 'pointer' : 'not-allowed',
              background: assignEmp ? '#16a34a' : '#e2e8f0',
              color: assignEmp ? '#fff' : '#94a3b8',
              fontWeight: 700, fontSize: 14,
              boxShadow: assignEmp ? '0 2px 8px rgba(22,163,74,.3)' : 'none',
              opacity: assigning ? .7 : 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {assigning ? 'Assigning…' : `Assign ${checkedIds.size} Task${checkedIds.size > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ManagerTaskPage() {
  const [tasks, setTasks]           = useState([])
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [filters, setFilters]       = useState({ module: '', type: '', priority: '', status: '' })
  const [employees, setEmployees]   = useState([])
  const [showModal, setShowModal]   = useState(false)
  const [assignMsg, setAssignMsg]   = useState('')
  const [importing, setImporting]   = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    api.fetchEmployees().then(setEmployees).catch(() => {})
    api.fetchAllTasks().then(setTasks).catch(() => {})
  }, [])

  const handleImport = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'array' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        const mapped = rows.map((r, i) => ({
          taskId:      r['Task ID']          || r['taskId']      || `WT-${String(i + 1).padStart(3, '0')}`,
          module:      r['Module']           || r['module']      || '',
          description: r['Task Description'] || r['description'] || '',
          type:        r['Type']             || r['type']        || '',
          priority:    r['Priority']         || r['priority']    || '',
          ticketRef:   r['Ticket Ref']       || r['ticketRef']   || '',
          status:      r['Status']           || r['status']      || 'Pending',
        }))
        await api.importTasks(mapped)
        const fresh = await api.fetchAllTasks()
        setTasks(fresh)
        setCheckedIds(new Set())
        setAssignMsg(`${mapped.length} tasks imported`)
        setTimeout(() => setAssignMsg(''), 3000)
      } catch {
        setAssignMsg('Import failed')
        setTimeout(() => setAssignMsg(''), 3000)
      } finally {
        setImporting(false)
        e.target.value = ''
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }))

  const visible = tasks.filter(t =>
    (!filters.module   || t.module   === filters.module) &&
    (!filters.type     || t.type     === filters.type) &&
    (!filters.priority || t.priority === filters.priority) &&
    (!filters.status   || t.status   === filters.status)
  )

  const uniq = (key) => [...new Set(tasks.map(t => t[key]).filter(Boolean))]

  const allChecked  = visible.length > 0 && visible.every(t => checkedIds.has(t.taskId))
  const someChecked = visible.some(t => checkedIds.has(t.taskId))

  const toggleAll = () => {
    if (allChecked) {
      const next = new Set(checkedIds); visible.forEach(t => next.delete(t.taskId)); setCheckedIds(next)
    } else {
      const next = new Set(checkedIds); visible.forEach(t => next.add(t.taskId)); setCheckedIds(next)
    }
  }

  const toggleOne = (taskId) => {
    const next = new Set(checkedIds)
    next.has(taskId) ? next.delete(taskId) : next.add(taskId)
    setCheckedIds(next)
  }

  const selectedTasks = tasks.filter(t => checkedIds.has(t.taskId))

  const handleAssigned = (empName, count) => {
    api.fetchAllTasks().then(setTasks).catch(() => {})
    setCheckedIds(new Set())
    setShowModal(false)
    setAssignMsg(`${count} task${count > 1 ? 's' : ''} assigned to ${empName}`)
    setTimeout(() => setAssignMsg(''), 3000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Task Management</h2>
          {checkedIds.size > 0 && (
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe',
            }}>{checkedIds.size} selected</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {assignMsg && (
            <span style={{
              fontSize: 13, padding: '5px 12px', borderRadius: 6,
              background: assignMsg.includes('fail') ? '#fef2f2' : '#f0fdf4',
              color:      assignMsg.includes('fail') ? '#dc2626' : '#16a34a',
              border: `1px solid ${assignMsg.includes('fail') ? '#fecaca' : '#bbf7d0'}`,
            }}>{assignMsg}</span>
          )}
          {checkedIds.size > 0 && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px',
                background: '#16a34a', color: '#fff', border: 'none',
                borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                boxShadow: '0 2px 8px rgba(22,163,74,.3)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Assign {checkedIds.size} Task{checkedIds.size > 1 ? 's' : ''}
            </button>
          )}
          <button
            onClick={() => fileRef.current.click()}
            disabled={importing}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px',
              background: '#6366f1', color: '#fff', border: 'none',
              borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              boxShadow: '0 2px 8px rgba(99,102,241,.3)', opacity: importing ? .7 : 1,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
            {importing ? 'Importing…' : 'Import Excel'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 10 }}>
              <th style={thStyle}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
                  onChange={toggleAll}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#6366f1' }}
                />
              </th>
              <th style={thStyle}>
                <FilterDropdown label="Task ID" options={uniq('taskId')} value={filters.taskId || ''} onChange={v => setFilter('taskId', v)} />
              </th>
              <th style={thStyle}>
                <FilterDropdown label="Module" options={uniq('module')} value={filters.module} onChange={v => setFilter('module', v)} />
              </th>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: 300 }}>Task Description</th>
              <th style={thStyle}>
                <FilterDropdown label="Type" options={uniq('type')} value={filters.type} onChange={v => setFilter('type', v)} />
              </th>
              <th style={thStyle}>
                <FilterDropdown label="Priority" options={uniq('priority')} value={filters.priority} onChange={v => setFilter('priority', v)} />
              </th>
              <th style={thStyle}>
                <FilterDropdown label="Ticket Ref" options={uniq('ticketRef')} value={filters.ticketRef || ''} onChange={v => setFilter('ticketRef', v)} />
              </th>
              <th style={thStyle}>
                <FilterDropdown label="Status" options={uniq('status')} value={filters.status} onChange={v => setFilter('status', v)} />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>
                  {tasks.length === 0 ? 'No tasks yet — click Import Excel to get started' : 'No tasks match filters'}
                </td>
              </tr>
            )}
            {visible.map((t, i) => {
              const isChecked = checkedIds.has(t.taskId)
              const pc = PRIORITY_COLOR[t.priority] || { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' }
              const sc = STATUS_COLOR[t.status]     || { bg: '#f8fafc', color: '#64748b' }
              return (
                <tr
                  key={t.taskId + i}
                  onClick={() => toggleOne(t.taskId)}
                  style={{
                    background: isChecked ? '#eef2ff' : i % 2 === 0 ? '#fff' : '#fafafa',
                    borderLeft: isChecked ? '3px solid #6366f1' : '3px solid transparent',
                    cursor: 'pointer', transition: 'background .1s',
                  }}
                  onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = '#f1f5f9' }}
                  onMouseLeave={e => { e.currentTarget.style.background = isChecked ? '#eef2ff' : i % 2 === 0 ? '#fff' : '#fafafa' }}
                >
                  <td style={tdStyle} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOne(t.taskId)}
                      style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#6366f1' }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 700, color: '#6366f1' }}>{t.taskId}</span>
                  </td>
                  <td style={tdStyle}><span style={{ color: '#374151' }}>{t.module}</span></td>
                  <td style={{ ...tdStyle, textAlign: 'left', maxWidth: 340 }}>
                    <span style={{
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden', color: '#374151',
                    }}>{t.description}</span>
                  </td>
                  <td style={tdStyle}><span style={{ color: '#374151' }}>{t.type}</span></td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`,
                    }}>{t.priority}</span>
                  </td>
                  <td style={tdStyle}><span style={{ color: '#94a3b8' }}>{t.ticketRef || '—'}</span></td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: sc.bg, color: sc.color,
                    }}>{t.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>{visible.length} task{visible.length !== 1 ? 's' : ''}</div>

      {/* Assign Modal */}
      {showModal && (
        <AssignModal
          checkedIds={checkedIds}
          selectedTasks={selectedTasks}
          employees={employees}
          onClose={() => setShowModal(false)}
          onAssigned={handleAssigned}
        />
      )}
    </div>
  )
}

const thStyle = {
  padding: '11px 14px', textAlign: 'center', fontWeight: 600,
  fontSize: 12, color: '#475569', whiteSpace: 'nowrap',
}
const tdStyle = {
  padding: '11px 14px', textAlign: 'center',
  borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle',
}
