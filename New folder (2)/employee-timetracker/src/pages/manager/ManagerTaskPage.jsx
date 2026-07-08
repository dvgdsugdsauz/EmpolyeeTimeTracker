import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import * as api from '../../services/api'

const PRIORITY_COLOR = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' }
const STATUS_COLOR   = { Completed: '#22c55e', 'In Progress': '#3b82f6', Pending: '#f59e0b' }

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
        border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, padding: '2px 4px',
      }}>
        {label}
        {value && <span style={{ color: '#6366f1', fontSize: 11 }}>●</span>}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100, minWidth: 160,
          background: 'var(--card-bg, #1e2435)', border: '1px solid var(--border, #2a3145)',
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.3)', padding: 4,
        }}>
          <div onClick={() => { onChange(''); setOpen(false) }} style={{
            padding: '6px 12px', cursor: 'pointer', borderRadius: 5, fontSize: 13,
            color: value === '' ? '#6366f1' : 'inherit',
          }}>All</div>
          {options.map(o => (
            <div key={o} onClick={() => { onChange(o); setOpen(false) }} style={{
              padding: '6px 12px', cursor: 'pointer', borderRadius: 5, fontSize: 13,
              color: value === o ? '#6366f1' : 'inherit',
              background: value === o ? 'rgba(99,102,241,.1)' : 'none',
            }}>{o}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ManagerTaskPage() {
  const [tasks, setTasks]             = useState([])
  const [checkedIds, setCheckedIds]   = useState(new Set())
  const [filters, setFilters]         = useState({ module: '', type: '', priority: '', status: '' })
  const [employees, setEmployees]     = useState([])
  const [empSearch, setEmpSearch]     = useState('')
  const [assignEmp, setAssignEmp]     = useState(null)
  const [empDropOpen, setEmpDropOpen] = useState(false)
  const [assigning, setAssigning]     = useState(false)
  const [assignMsg, setAssignMsg]     = useState('')
  const [importing, setImporting]     = useState(false)
  const fileRef = useRef()
  const empRef  = useRef()

  useEffect(() => {
    api.fetchEmployees().then(setEmployees).catch(() => {})
    api.fetchAllTasks().then(setTasks).catch(() => {})
  }, [])

  useEffect(() => {
    const h = (e) => { if (empRef.current && !empRef.current.contains(e.target)) setEmpDropOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
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
        setAssignMsg(`${mapped.length} tasks imported successfully`)
        setTimeout(() => setAssignMsg(''), 3000)
      } catch {
        setAssignMsg('Import failed — check Excel format')
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

  const allChecked = visible.length > 0 && visible.every(t => checkedIds.has(t.taskId))
  const someChecked = visible.some(t => checkedIds.has(t.taskId))

  const toggleAll = () => {
    if (allChecked) {
      const next = new Set(checkedIds)
      visible.forEach(t => next.delete(t.taskId))
      setCheckedIds(next)
    } else {
      const next = new Set(checkedIds)
      visible.forEach(t => next.add(t.taskId))
      setCheckedIds(next)
    }
  }

  const toggleOne = (taskId) => {
    const next = new Set(checkedIds)
    next.has(taskId) ? next.delete(taskId) : next.add(taskId)
    setCheckedIds(next)
  }

  const filteredEmps = employees.filter(e =>
    (e.name || '').toLowerCase().includes(empSearch.toLowerCase()) ||
    (e.username || '').toLowerCase().includes(empSearch.toLowerCase())
  )

  const selectedTasks = tasks.filter(t => checkedIds.has(t.taskId))

  const handleAssign = async () => {
    if (checkedIds.size === 0 || !assignEmp) return
    setAssigning(true)
    try {
      await api.assignTasksBulk([...checkedIds], assignEmp.id)
      const fresh = await api.fetchAllTasks()
      setTasks(fresh)
      setCheckedIds(new Set())
      setAssignEmp(null)
      setEmpSearch('')
      setAssignMsg(`${selectedTasks.length} task${selectedTasks.length > 1 ? 's' : ''} assigned to ${assignEmp.name}`)
      setTimeout(() => setAssignMsg(''), 3000)
    } catch {
      setAssignMsg('Assignment failed')
      setTimeout(() => setAssignMsg(''), 3000)
    } finally {
      setAssigning(false)
    }
  }

  const showPanel = checkedIds.size > 0

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 0 }}>

      {/* ── Left: Table ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Task Management</h2>
            {checkedIds.size > 0 && (
              <span style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: 'rgba(99,102,241,.18)', color: '#818cf8',
              }}>{checkedIds.size} selected</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {assignMsg && (
              <span style={{
                fontSize: 13, padding: '5px 12px', borderRadius: 6,
                background: assignMsg.includes('fail') ? 'rgba(239,68,68,.15)' : 'rgba(34,197,94,.15)',
                color:      assignMsg.includes('fail') ? '#ef4444' : '#22c55e',
              }}>{assignMsg}</span>
            )}
            {checkedIds.size > 0 && (
              <button onClick={() => setCheckedIds(new Set())} style={{
                padding: '7px 14px', background: 'rgba(255,255,255,.06)',
                border: '1px solid var(--border, #2a3145)', borderRadius: 8,
                cursor: 'pointer', fontSize: 13, color: 'inherit',
              }}>Clear</button>
            )}
            <button
              onClick={() => fileRef.current.click()}
              disabled={importing}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
                background: '#6366f1', color: '#fff', border: 'none',
                borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                opacity: importing ? .6 : 1,
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
        <div style={{ flex: 1, overflow: 'auto', borderRadius: 10, border: '1px solid var(--border, #2a3145)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1a2340', position: 'sticky', top: 0, zIndex: 10 }}>
                {/* Select All checkbox */}
                <th style={{ ...thStyle, width: 40 }}>
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
                <th style={{ ...thStyle, textAlign: 'left', minWidth: 280 }}>Task Description</th>
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
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280', fontSize: 13 }}>
                    {tasks.length === 0 ? 'No tasks yet — import an Excel file to begin' : 'No tasks match filters'}
                  </td>
                </tr>
              )}
              {visible.map((t, i) => {
                const isChecked = checkedIds.has(t.taskId)
                return (
                  <tr
                    key={t.taskId + i}
                    style={{
                      background: isChecked ? 'rgba(99,102,241,.10)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)',
                      borderLeft: isChecked ? '3px solid #6366f1' : '3px solid transparent',
                      transition: 'background .12s',
                    }}
                  >
                    <td style={tdStyle} onClick={() => toggleOne(t.taskId)}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(t.taskId)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#6366f1' }}
                      />
                    </td>
                    <td style={tdStyle} onClick={() => toggleOne(t.taskId)} style={{ ...tdStyle, cursor: 'pointer' }}>
                      <span style={{ fontWeight: 600, color: '#6366f1' }}>{t.taskId}</span>
                    </td>
                    <td style={{ ...tdStyle, cursor: 'pointer' }} onClick={() => toggleOne(t.taskId)}>{t.module}</td>
                    <td style={{ ...tdStyle, textAlign: 'left', maxWidth: 320, cursor: 'pointer' }} onClick={() => toggleOne(t.taskId)}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {t.description}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, cursor: 'pointer' }} onClick={() => toggleOne(t.taskId)}>{t.type}</td>
                    <td style={{ ...tdStyle, cursor: 'pointer' }} onClick={() => toggleOne(t.taskId)}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: `${PRIORITY_COLOR[t.priority] || '#6b7280'}22`,
                        color: PRIORITY_COLOR[t.priority] || '#6b7280',
                      }}>{t.priority}</span>
                    </td>
                    <td style={{ ...tdStyle, cursor: 'pointer' }} onClick={() => toggleOne(t.taskId)}>{t.ticketRef || '—'}</td>
                    <td style={{ ...tdStyle, cursor: 'pointer' }} onClick={() => toggleOne(t.taskId)}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: `${STATUS_COLOR[t.status] || '#6b7280'}22`,
                        color: STATUS_COLOR[t.status] || '#6b7280',
                      }}>{t.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>{visible.length} task{visible.length !== 1 ? 's' : ''}</div>
      </div>

      {/* ── Right: Assign Panel (shown when tasks selected) ── */}
      {showPanel && (
        <div style={{
          width: 320, flexShrink: 0, background: 'var(--card-bg, #1e2435)',
          borderRadius: 12, border: '1px solid var(--border, #2a3145)',
          padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Assign Tasks</span>
            <button onClick={() => setCheckedIds(new Set())} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Selected count */}
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            background: 'rgba(99,102,241,.12)', color: '#818cf8', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 11 12 14 22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            <strong>{checkedIds.size}</strong> task{checkedIds.size > 1 ? 's' : ''} selected
          </div>

          {/* Selected task list */}
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {selectedTasks.map(t => (
              <div key={t.taskId} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 10px', borderRadius: 7,
                background: 'rgba(255,255,255,.04)', fontSize: 12,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: '#6366f1' }}>{t.taskId}</span>
                  <span style={{ color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                    {t.module} · {t.type}
                  </span>
                </div>
                <button onClick={() => toggleOne(t.taskId)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 2, flexShrink: 0,
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: 'var(--border, #2a3145)' }} />

          {/* Employee Search */}
          <div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Assign To Employee</div>
            <div ref={empRef} style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search employee..."
                value={empSearch}
                onChange={e => { setEmpSearch(e.target.value); setAssignEmp(null); setEmpDropOpen(true) }}
                onFocus={() => setEmpDropOpen(true)}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
                  background: 'rgba(255,255,255,.06)', border: '1px solid var(--border, #2a3145)',
                  color: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
              />
              {empDropOpen && filteredEmps.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, marginTop: 4,
                  background: 'var(--card-bg, #1e2435)', border: '1px solid var(--border, #2a3145)',
                  borderRadius: 8, maxHeight: 180, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,.3)',
                }}>
                  {filteredEmps.map(emp => (
                    <div
                      key={emp.id}
                      onClick={() => { setAssignEmp(emp); setEmpSearch(emp.name); setEmpDropOpen(false) }}
                      style={{
                        padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                        background: assignEmp?.id === emp.id ? 'rgba(99,102,241,.15)' : 'none',
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{emp.name || emp.username}</span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{emp.dept} · {emp.designation}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected employee chip */}
            {assignEmp && (
              <div style={{
                marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', borderRadius: 8, background: 'rgba(99,102,241,.12)',
                border: '1px solid rgba(99,102,241,.3)', fontSize: 13,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <span style={{ fontWeight: 600, color: '#818cf8' }}>{assignEmp.name}</span>
              </div>
            )}
          </div>

          {/* Assign Button */}
          <button
            onClick={handleAssign}
            disabled={!assignEmp || assigning}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px 0', borderRadius: 9, border: 'none',
              cursor: assignEmp && !assigning ? 'pointer' : 'not-allowed',
              background: assignEmp ? '#16a34a' : 'rgba(255,255,255,.06)',
              color: assignEmp ? '#fff' : '#6b7280',
              fontWeight: 700, fontSize: 14, transition: 'background .2s',
              opacity: assigning ? .7 : 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {assigning
              ? 'Assigning…'
              : `Assign ${checkedIds.size} Task${checkedIds.size > 1 ? 's' : ''}`}
          </button>

          {/* Cancel Button */}
          <button
            onClick={() => { setCheckedIds(new Set()); setAssignEmp(null); setEmpSearch('') }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 0', borderRadius: 9, cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border, #2a3145)',
              color: '#9ca3af', fontWeight: 600, fontSize: 14,
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

const thStyle = {
  padding: '11px 12px', textAlign: 'center', fontWeight: 600,
  fontSize: 12, color: '#e2e8f0', whiteSpace: 'nowrap',
  borderBottom: '1px solid rgba(255,255,255,.08)',
}
const tdStyle = {
  padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,.04)',
  verticalAlign: 'middle',
}
