import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import * as api from '../../services/api'
import { DatePicker } from '../../components/DatePicker'

const PRIORITY_COLOR = {
  High:   { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  Medium: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  Low:    { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
}
const STATUS_COLOR = {
  Completed:    { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  'In Progress':{ bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  Paused:       { bg: '#fefce8', color: '#ca8a04', border: '#fde68a' },
  Pending:      { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
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
  const [empSearch, setEmpSearch]       = useState('')
  const [selectedEmps, setSelectedEmps] = useState(new Set())
  const [targetDate, setTargetDate]     = useState('')
  const [plannedDate, setPlannedDate]   = useState('')
  const [assigning, setAssigning]       = useState(false)
  const [msg, setMsg]                   = useState('')
  const [groups, setGroups]             = useState([])
  const [groupFilter, setGroupFilter]   = useState(null)
  const [sgFilter, setSgFilter]         = useState(null)
  const backdropRef = useRef()

  useEffect(() => {
    api.fetchGroups().then(setGroups).catch(() => {})
  }, [])

  const currentGroup = groups.find(g => g.id === groupFilter)

  const filteredEmps = employees.filter(e => {
    const matchSearch = !empSearch ||
      (e.name || '').toLowerCase().includes(empSearch.toLowerCase()) ||
      (e.username || '').toLowerCase().includes(empSearch.toLowerCase())
    const matchGroup = !groupFilter || e.groupId === groupFilter
    const matchSg    = !sgFilter    || e.subGroupId === sgFilter
    return matchSearch && matchGroup && matchSg
  })

  const toggleEmp = (id) => setSelectedEmps(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleAssign = async () => {
    if (selectedEmps.size === 0) { setMsg('Select at least one employee'); return }
    setAssigning(true)
    try {
      for (const empId of selectedEmps) {
        await api.assignTasksBulk([...checkedIds], empId, targetDate, plannedDate)
      }
      const names = employees.filter(e => selectedEmps.has(e.id)).map(e => e.name).join(', ')
      onAssigned(names, selectedTasks.length)
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
        background: '#fff', borderRadius: 16, width: 720, maxHeight: '90vh',
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

          {/* Employee Section */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 10 }}>
              Assign To Employee <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional — select multiple)</span>
            </div>

            {/* Group filter chips */}
            {groups.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                <button onClick={() => { setGroupFilter(null); setSgFilter(null) }} style={{
                  padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: !groupFilter ? '#6366f1' : '#f1f5f9', color: !groupFilter ? '#fff' : '#64748b',
                }}>All</button>
                {groups.map(g => (
                  <button key={g.id} onClick={() => { setGroupFilter(g.id); setSgFilter(null) }} style={{
                    padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: groupFilter === g.id ? '#7c3aed' : '#f3e8ff', color: groupFilter === g.id ? '#fff' : '#7c3aed',
                  }}>{g.name}</button>
                ))}
              </div>
            )}

            {/* Sub-group filter */}
            {currentGroup?.subGroups?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                <button onClick={() => setSgFilter(null)} style={{
                  padding: '3px 10px', borderRadius: 20, border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  background: !sgFilter ? '#7c3aed22' : 'none', color: '#7c3aed',
                }}>All</button>
                {currentGroup.subGroups.map(sg => (
                  <button key={sg.id} onClick={() => setSgFilter(sg.id)} style={{
                    padding: '3px 10px', borderRadius: 20, border: '1px solid #e2e8f0', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    background: sgFilter === sg.id ? '#7c3aed22' : 'none', color: '#7c3aed',
                  }}>{sg.name}</button>
                ))}
              </div>
            )}

            {/* Search */}
            <input
              type="text" placeholder="Search employee..." value={empSearch}
              onChange={e => setEmpSearch(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box',
                background: '#f8fafc', border: '1px solid #e2e8f0', color: '#1e293b', outline: 'none', marginBottom: 8 }}
            />

            {/* Employee list with checkboxes */}
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
              {filteredEmps.length === 0 ? (
                <div style={{ padding: 14, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No employees found</div>
              ) : filteredEmps.map(emp => {
                const checked = selectedEmps.has(emp.id)
                return (
                  <div key={emp.id} onClick={() => toggleEmp(emp.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
                    cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                    background: checked ? '#eef2ff' : '#fff', transition: 'background .1s',
                  }}
                    onMouseEnter={e => { if (!checked) e.currentTarget.style.background = '#f8fafc' }}
                    onMouseLeave={e => { e.currentTarget.style.background = checked ? '#eef2ff' : '#fff' }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? '#6366f1' : '#cbd5e1'}`,
                      background: checked ? '#6366f1' : '#fff', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {checked && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{emp.name || emp.username}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.designation} · {emp.dept}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Selected chips */}
            {selectedEmps.size > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {employees.filter(e => selectedEmps.has(e.id)).map(e => (
                  <span key={e.id} style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px',
                    borderRadius: 20, background: '#eef2ff', color: '#6366f1', fontSize: 12, fontWeight: 600,
                  }}>
                    {e.name}
                    <button onClick={() => toggleEmp(e.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#a5b4fc', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                  </span>
                ))}
              </div>
            )}

            {msg && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 13, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>{msg}</div>
            )}
          </div>

          {/* Planned Date + Target Date side by side */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                Planned Date <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span>
              </div>
              <DatePicker
                value={plannedDate}
                onChange={setPlannedDate}
                placeholder="Pick date…"
                accentColor="#6366f1"
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>
                Target Date <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span>
              </div>
              <DatePicker
                value={targetDate}
                onChange={setTargetDate}
                placeholder="Pick date…"
                accentColor="#6366f1"
              />
            </div>
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
            disabled={assigning}
            style={{
              flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px 0', borderRadius: 9, border: 'none',
              cursor: !assigning ? 'pointer' : 'not-allowed',
              background: selectedEmps.size > 0 ? '#16a34a' : '#6366f1',
              color: '#fff', fontWeight: 700, fontSize: 14,
              boxShadow: selectedEmps.size > 0 ? '0 2px 8px rgba(22,163,74,.3)' : '0 2px 8px rgba(99,102,241,.3)',
              opacity: assigning ? .7 : 1,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {assigning ? 'Assigning…' :
              selectedEmps.size > 0
                ? `Assign ${checkedIds.size} Task${checkedIds.size > 1 ? 's' : ''} to ${selectedEmps.size} Employee${selectedEmps.size > 1 ? 's' : ''}`
                : `Assign ${checkedIds.size} Task${checkedIds.size > 1 ? 's' : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  )
}

function calcWorkedHours(t) {
  if (!t.actualStartDateTime) return '—'
  const status = t.status || 'Pending'
  const start = new Date(t.actualStartDateTime.replace(' ', 'T'))
  const end = (status !== 'In Progress' && t.actualEndDateTime)
    ? new Date(t.actualEndDateTime.replace(' ', 'T'))
    : (status === 'In Progress' ? new Date() : null)
  if (!end) return '—'
  const mins = Math.round((end - start) / 60000)
  if (mins <= 0) return '< 1m'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function ManagerTaskPage() {
  const [activeTab, setActiveTab]   = useState('unassigned')
  const [tasks, setTasks]           = useState([])
  const [subTaskMap, setSubTaskMap] = useState({})   // parentTaskId → SubTask[]
  const [expandedSubs, setExpandedSubs] = useState({})
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [filters, setFilters]       = useState({ module: '', type: '', priority: '', status: '' })
  const [employees, setEmployees]   = useState([])
  const [showModal, setShowModal]   = useState(false)
  const [assignMsg, setAssignMsg]   = useState('')
  const [importing, setImporting]   = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    api.fetchEmployees().then(setEmployees).catch(() => {})
    Promise.all([api.fetchAllTasks(), api.fetchMySubTasks ? api.fetchMySubTasks() : Promise.resolve([])])
      .then(([ts, sts]) => {
        setTasks(ts)
        // fetchMySubTasks only returns employee's own; for manager use by-task per assigned task
        // We'll load them lazily when expanding
      })
      .catch(() => {
        api.fetchAllTasks().then(setTasks).catch(() => {})
      })
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
          role:        r['Role']             || r['role']        || '',
          qaAssigned:  r['QA Assigned']      || r['qaAssigned']  || '',
          targetDate:  r['Target Date']      || r['targetDate']  || '',
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

  const unassignedTasks = tasks.filter(t => !t.assignedTo)
  const assignedTasks   = tasks.filter(t =>  t.assignedTo)
  const tabTasks        = activeTab === 'unassigned' ? unassignedTasks : assignedTasks

  const visible = tabTasks.filter(t =>
    (!filters.module   || t.module   === filters.module) &&
    (!filters.type     || t.type     === filters.type) &&
    (!filters.priority || t.priority === filters.priority) &&
    (!filters.status   || t.status   === filters.status)
  )

  const uniq = (key) => [...new Set(tabTasks.map(t => t[key]).filter(Boolean))]

  const allChecked  = visible.length > 0 && visible.every(t => checkedIds.has(t.taskId))
  const someChecked = visible.some(t => checkedIds.has(t.taskId))

  const toggleAll = () => {
    if (allChecked) {
      const next = new Set(checkedIds); visible.forEach(t => next.delete(t.taskId)); setCheckedIds(next)
    } else {
      const next = new Set(checkedIds); visible.forEach(t => next.add(t.taskId)); setCheckedIds(next)
    }
  }

  async function toggleSubExpand(taskId) {
    if (!expandedSubs[taskId]) {
      if (!subTaskMap[taskId]) {
        try {
          const subs = await api.fetchSubTasksByParent(taskId)
          setSubTaskMap(prev => ({ ...prev, [taskId]: subs }))
        } catch { /* ignore */ }
      }
    }
    setExpandedSubs(prev => ({ ...prev, [taskId]: !prev[taskId] }))
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid #e2e8f0', paddingBottom: 0 }}>
        {[
          { key: 'unassigned', label: 'Unassigned Tasks', count: unassignedTasks.length },
          { key: 'assigned',   label: 'Assigned Tasks',   count: assignedTasks.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setCheckedIds(new Set()); setFilters({ module: '', type: '', priority: '', status: '' }) }}
            style={{
              padding: '10px 20px', border: 'none', cursor: 'pointer',
              background: 'none', fontWeight: 600, fontSize: 14,
              color: activeTab === tab.key ? '#6366f1' : '#64748b',
              borderBottom: activeTab === tab.key ? '2px solid #6366f1' : '2px solid transparent',
              marginBottom: '-2px', display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {tab.label}
            <span style={{
              padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: activeTab === tab.key ? '#eef2ff' : '#f1f5f9',
              color: activeTab === tab.key ? '#6366f1' : '#94a3b8',
            }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {checkedIds.size > 0 && (
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe',
            }}>{checkedIds.size} selected</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {activeTab === 'unassigned' && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        {activeTab === 'unassigned' ? (
          /* ── Unassigned table: checkboxes + import columns ── */
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
                const sc = STATUS_COLOR[t.status]     || STATUS_COLOR.Pending
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
                      <input type="checkbox" checked={isChecked} onChange={() => toggleOne(t.taskId)}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#6366f1' }} />
                    </td>
                    <td style={tdStyle}><span style={{ fontWeight: 700, color: '#6366f1' }}>{t.taskId}</span></td>
                    <td style={tdStyle}><span style={{ color: '#374151' }}>{t.module}</span></td>
                    <td style={{ ...tdStyle, textAlign: 'left', maxWidth: 340 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: '#374151' }}>{t.description}</span>
                    </td>
                    <td style={tdStyle}><span style={{ color: '#374151' }}>{t.type}</span></td>
                    <td style={tdStyle}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>{t.priority}</span>
                    </td>
                    <td style={tdStyle}><span style={{ color: '#94a3b8' }}>{t.ticketRef || '—'}</span></td>
                    <td style={tdStyle}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{t.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          /* ── Assigned table: employee-style view with status colors ── */
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1e293b', position: 'sticky', top: 0, zIndex: 10 }}>
                {['Task ID', 'Task Description', 'Assigned To', 'Planned Date', 'Target Date', 'Priority', 'Actual Start', 'Actual End', 'Status', 'Hours', 'Remarks'].map(h => (
                  <th key={h} style={assignedThStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>
                    No assigned tasks yet
                  </td>
                </tr>
              )}
              {visible.map((t, i) => {
                const pc       = PRIORITY_COLOR[t.priority] || {}
                const status   = t.status || 'Pending'
                const sc       = STATUS_COLOR[status] || STATUS_COLOR.Pending
                const subs     = subTaskMap[t.taskId] || []
                const isExpand = expandedSubs[t.taskId]
                const rowBg    = i % 2 === 0 ? '#fff' : '#fafafa'
                return (
                  <>
                    <tr key={t.taskId + i}
                      style={{ background: rowBg, transition: 'background .1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9' }}
                      onMouseLeave={e => { e.currentTarget.style.background = rowBg }}
                    >
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#6366f1', whiteSpace: 'nowrap' }}>{t.taskId}</span>
                          <button
                            title={isExpand ? 'Collapse subtasks' : 'View subtasks'}
                            onClick={e => { e.stopPropagation(); toggleSubExpand(t.taskId) }}
                            style={{
                              border: 'none', borderRadius: 5, padding: '2px 6px',
                              background: isExpand ? '#ede9fe' : '#f5f3ff',
                              color: '#7c3aed', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                            }}
                          >{isExpand ? '▲' : (subs.length > 0 ? `▼ ${subs.length}` : '▼')}</button>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'left', minWidth: 200, maxWidth: 300 }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: '#374151' }}>{t.description}</span>
                      </td>
                      <td style={tdStyle}><span style={{ color: '#374151', whiteSpace: 'nowrap' }}>{t.assignedToName || t.assignedTo || '—'}</span></td>
                      <td style={tdStyle}><span style={{ color: '#374151', whiteSpace: 'nowrap' }}>{t.plannedDate || '—'}</span></td>
                      <td style={tdStyle}><span style={{ color: '#374151', whiteSpace: 'nowrap' }}>{t.targetDate || '—'}</span></td>
                      <td style={tdStyle}>
                        {t.priority ? (
                          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: pc.bg, color: pc.color, border: `1px solid ${pc.border}` }}>{t.priority}</span>
                        ) : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={tdStyle}><span style={{ color: t.actualStartDateTime ? '#374151' : '#94a3b8', whiteSpace: 'nowrap', fontSize: 12 }}>{t.actualStartDateTime ? t.actualStartDateTime.replace('T', ' ') : '—'}</span></td>
                      <td style={tdStyle}><span style={{ color: t.actualEndDateTime ? '#374151' : '#94a3b8', whiteSpace: 'nowrap', fontSize: 12 }}>{t.actualEndDateTime ? t.actualEndDateTime.replace('T', ' ') : '—'}</span></td>
                      <td style={tdStyle}>
                        <span className={status === 'In Progress' ? 'task-in-progress' : ''}
                          style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: 'nowrap', display: 'inline-block' }}
                        >{status}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: '#374151', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 }}>{calcWorkedHours(t)}</span>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 200, textAlign: 'left' }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: t.remarks ? '#374151' : '#94a3b8', fontSize: 12 }}>{t.remarks || '—'}</span>
                      </td>
                    </tr>
                    {/* Subtask rows */}
                    {isExpand && subs.length === 0 && (
                      <tr key={t.taskId + '-nosubs'} style={{ background: '#faf5ff' }}>
                        <td colSpan={11} style={{ ...tdStyle, color: '#c4b5fd', fontSize: 12, fontStyle: 'italic' }}>No subtasks created yet</td>
                      </tr>
                    )}
                    {isExpand && subs.map(st => (
                      <tr key={st.subTaskId} style={{ background: '#faf5ff' }}>
                        <td style={{ ...tdStyle, paddingLeft: 20 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                            <span style={{ color: '#c4b5fd', fontSize: 11 }}>└</span>
                            <span style={{ fontWeight: 700, color: '#7c3aed', fontSize: 12, whiteSpace: 'nowrap' }}>{st.subTaskId}</span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'left', minWidth: 200, maxWidth: 300 }}>
                          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: '#6b21a8', fontSize: 12 }}>{st.description || '—'}</span>
                        </td>
                        <td style={{ ...tdStyle, fontSize: 11, color: '#94a3b8' }}>{st.employeeId}</td>
                        <td colSpan={3} style={{ ...tdStyle, color: '#94a3b8', fontSize: 11 }}>— subtask —</td>
                        <td style={tdStyle}><span style={{ color: '#374151', whiteSpace: 'nowrap', fontSize: 12 }}>{st.actualStartDateTime ? st.actualStartDateTime.replace('T',' ') : '—'}</span></td>
                        <td style={tdStyle}><span style={{ color: '#374151', whiteSpace: 'nowrap', fontSize: 12 }}>{st.actualEndDateTime ? st.actualEndDateTime.replace('T',' ') : '—'}</span></td>
                        <td style={tdStyle}></td>
                        <td style={tdStyle}></td>
                        <td style={{ ...tdStyle, maxWidth: 200, textAlign: 'left' }}>
                          <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: st.remarks ? '#374151' : '#94a3b8', fontSize: 12 }}>{st.remarks || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>{visible.length} task{visible.length !== 1 ? 's' : ''}</div>

      {/* Floating Assign Button (FAB) - bottom right */}
      {checkedIds.size > 0 && !showModal && (
        <button
          onClick={() => setShowModal(true)}
          style={{
            position: 'fixed', bottom: 32, right: 32, zIndex: 500,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '14px 24px', borderRadius: 50,
            background: '#16a34a', color: '#fff', border: 'none',
            cursor: 'pointer', fontWeight: 700, fontSize: 15,
            boxShadow: '0 6px 24px rgba(22,163,74,.45)',
            transition: 'transform .1s, box-shadow .1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(22,163,74,.55)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';    e.currentTarget.style.boxShadow = '0 6px 24px rgba(22,163,74,.45)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Assign {checkedIds.size} Task{checkedIds.size > 1 ? 's' : ''}
        </button>
      )}

      {/* Toast notification */}
      {assignMsg && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          zIndex: 600, padding: '12px 24px', borderRadius: 12,
          background: assignMsg.includes('fail') ? '#fef2f2' : '#f0fdf4',
          color:      assignMsg.includes('fail') ? '#dc2626' : '#16a34a',
          border: `1px solid ${assignMsg.includes('fail') ? '#fecaca' : '#bbf7d0'}`,
          fontWeight: 600, fontSize: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,.12)',
        }}>{assignMsg}</div>
      )}

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
const assignedThStyle = {
  padding: '11px 14px', textAlign: 'center', fontWeight: 600,
  fontSize: 12, color: '#e2e8f0', whiteSpace: 'nowrap',
  borderBottom: '2px solid #334155',
}
const tdStyle = {
  padding: '11px 14px', textAlign: 'center',
  borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle',
}
