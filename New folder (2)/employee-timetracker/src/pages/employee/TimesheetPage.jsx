import { useState, useEffect, useRef } from 'react'
import * as api from '../../services/api'

const MAX_DESC = null

const STATUS = {
  DRAFT:     { label: 'Draft',     color: '#6b7280', bg: '#f1f5f9',  border: '#cbd5e1' },
  SUBMITTED: { label: 'Submitted', color: '#b45309', bg: '#fef3c7',  border: '#fde68a' },
  APPROVED:  { label: 'Approved',  color: '#065f46', bg: '#d1fae5',  border: '#6ee7b7' },
  REJECTED:  { label: 'Rejected',  color: '#991b1b', bg: '#fee2e2',  border: '#fca5a5' },
}

function Badge({ status }) {
  const s = STATUS[status] || STATUS.DRAFT
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 11px',
      borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: '0.3px',
      color: s.color, background: s.bg,
    }}>{s.label}</span>
  )
}

function fmtDate(d) {
  if (!d) return ''
  const parts = String(d).slice(0, 10).split('-')
  return parts.length < 3 ? d : `${parts[2]}/${parts[1]}/${parts[0]}`
}

function fmtHours(minutes) {
  const m = Number(minutes) || 0
  const h = Math.floor(m / 60)
  const min = m % 60
  return min > 0 ? `${h}h ${min}m` : `${h}h`
}

/* ── Detail modal ─────────────────────────────────────── */
function DetailModal({ ts, attendanceMap = {}, myTasks = [], onClose, onEdit, onDelete }) {
  if (!ts) return null
  const mods = ts.modules ? ts.modules.split(',').map(m => m.trim()).filter(Boolean) : []
  const taskIds = ts.taskIds ? ts.taskIds.split(',').map(t => t.trim()).filter(Boolean) : []
  const s = STATUS[ts.status] || STATUS.DRAFT
  const canEdit = ts.status === 'DRAFT' || ts.status === 'REJECTED'
  const canDelete = ts.status === 'DRAFT'

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540,
        margin: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Accent strip */}
        <div style={{ height: 5, background: s.border }} />

        {/* Header */}
        <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              {fmtDate(ts.workingDate)}
            </div>
            <div style={{ fontSize: 13, color: '#64748b', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>⏱ {fmtHours(attendanceMap[ts.workingDate] ?? ts.workingHours)}</span>
              {ts.managerName && <span>👤 {ts.managerName}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge status={ts.status} />
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#94a3b8', fontSize: 22, lineHeight: 1, padding: 4,
            }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>

          {/* Modules */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Modules</div>
            {mods.length > 0
              ? mods.map(m => (
                  <span key={m} style={{
                    display: 'inline-block', background: '#dcfce7', color: '#15803d',
                    borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600,
                    marginRight: 6, marginBottom: 4,
                  }}>{m}</span>
                ))
              : <span style={{ color: '#94a3b8', fontSize: 13 }}>—</span>
            }
          </div>

          {/* Tasks */}
          {taskIds.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8',
                textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Tasks</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {taskIds.map(tid => {
                  const task = myTasks.find(t => t.taskId === tid)
                  return (
                    <div key={tid} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      background: '#f5f3ff', border: '1px solid #e9d5ff',
                      borderRadius: 8, padding: '8px 12px',
                    }}>
                      <span style={{ fontWeight: 700, color: '#6d28d9', fontSize: 13, whiteSpace: 'nowrap' }}>{tid}</span>
                      {task?.description && (
                        <span style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>{task.description}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8',
              textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Brief Description</div>
            <div style={{
              background: '#f8fafc', borderRadius: 10, padding: '14px 16px',
              fontSize: 13, color: '#334155', lineHeight: 1.7,
              whiteSpace: 'pre-wrap', border: '1px solid #e2e8f0',
              maxHeight: 260, overflowY: 'auto',
            }}>
              {ts.description || <span style={{ color: '#94a3b8' }}>No description.</span>}
            </div>
          </div>

          {/* Rejection reason */}
          {ts.status === 'REJECTED' && ts.rejectReason && (
            <div style={{
              background: '#fef2f2', borderRadius: 10, padding: '12px 16px',
              border: '1px solid #fecaca',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b',
                textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>Rejection Reason</div>
              <div style={{ fontSize: 13, color: '#7f1d1d' }}>{ts.rejectReason}</div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(canEdit || canDelete) && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9',
            display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {canDelete && (
              <button onClick={() => { onDelete(ts); onClose() }} style={{
                padding: '8px 18px', borderRadius: 8, border: '1px solid #fca5a5',
                background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>Delete</button>
            )}
            {canEdit && (
              <button onClick={() => { onEdit(ts); onClose() }} style={{
                padding: '8px 22px', borderRadius: 8, border: 'none',
                background: '#4f9e6f', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}>✎ Edit</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Custom Date Picker ────────────────────────────────── */
function DatePicker({ value, onChange, max }) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.slice(0,4)) : new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.slice(5,7))-1 : new Date().getMonth())
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0, width: 290 })
  const triggerRef = useRef()
  const popupRef   = useRef()

  useEffect(() => {
    function h(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        popupRef.current   && !popupRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (value) { setViewYear(parseInt(value.slice(0,4))); setViewMonth(parseInt(value.slice(5,7))-1) }
  }, [value])

  function openCalendar() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - r.bottom
      const top = spaceBelow >= 320 ? r.bottom + 4 : r.top - 320 - 4
      setPopupPos({ top, left: r.left, width: Math.max(r.width, 290) })
    }
    setOpen(v => !v)
  }

  const pad = n => String(n).padStart(2,'0')
  const maxDate = max ? new Date(max+'T00:00:00') : null
  const todayD = new Date(); todayD.setHours(0,0,0,0)
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate()
  const nowD = new Date(); const canNext = !(viewYear===nowD.getFullYear()&&viewMonth===nowD.getMonth())

  function prevMonth() {
    if (viewMonth===0){setViewMonth(11);setViewYear(y=>y-1)} else setViewMonth(m=>m-1)
  }
  function nextMonth() {
    if (!canNext) return
    if (viewMonth===11){setViewMonth(0);setViewYear(y=>y+1)} else setViewMonth(m=>m+1)
  }
  function selectDay(day) {
    const d = new Date(viewYear, viewMonth, day); d.setHours(0,0,0,0)
    if (maxDate && d > maxDate) return
    onChange(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`)
    setOpen(false)
  }

  const display = value ? `${value.slice(8)}/${value.slice(5,7)}/${value.slice(0,4)}` : ''

  return (
    <div style={{ position: 'relative' }}>
      <div ref={triggerRef} onClick={openCalendar} style={{
        width: '100%', padding: '11px 14px', border: '1px solid #d1d5db',
        borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
        background: open ? '#fff' : '#fafafa', outline: 'none', color: '#1e293b',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        userSelect: 'none', borderColor: open ? '#6366f1' : '#d1d5db',
      }}>
        <span style={{ color: value ? '#1e293b' : '#9ca3af' }}>{display || 'Select date…'}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      {open && (
        <div ref={popupRef} style={{
          position: 'fixed', top: popupPos.top, left: popupPos.left, zIndex: 9999,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)', width: popupPos.width, padding: '14px 16px',
        }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button onClick={prevMonth} style={{ background: '#f1f5f9', border: 'none', borderRadius: 7, width: 30, height: 30, cursor: 'pointer', fontSize: 16, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} style={{ background: canNext ? '#f1f5f9' : 'none', border: 'none', borderRadius: 7, width: 30, height: 30, cursor: canNext ? 'pointer' : 'not-allowed', fontSize: 16, color: canNext ? '#475569' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
            {DAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', padding: '4px 0' }}>{d}</div>)}
          </div>
          {/* Days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {Array.from({length: firstDay}, (_,i) => <div key={'e'+i}/>)}
            {Array.from({length: daysInMonth}, (_,i) => {
              const day = i+1
              const d = new Date(viewYear, viewMonth, day); d.setHours(0,0,0,0)
              const disabled  = maxDate && d > maxDate
              const isToday   = d.getTime() === todayD.getTime()
              const dateStr   = `${viewYear}-${pad(viewMonth+1)}-${pad(day)}`
              const selected  = dateStr === value
              return (
                <button key={day} onClick={() => !disabled && selectDay(day)}
                  style={{
                    border: 'none', borderRadius: 8, padding: '7px 0', fontSize: 13,
                    fontWeight: selected || isToday ? 700 : 400,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: selected ? '#4f9e6f' : 'none',
                    color: disabled ? '#d1d5db' : selected ? '#fff' : isToday ? '#4f9e6f' : '#374151',
                    outline: isToday && !selected ? '2px solid #4f9e6f' : 'none',
                    outlineOffset: -2,
                  }}
                  onMouseEnter={e => { if (!disabled && !selected) e.currentTarget.style.background='#f0fdf4' }}
                  onMouseLeave={e => { if (!selected) e.currentTarget.style.background='none' }}
                >{day}</button>
              )
            })}
          </div>
          {/* Today shortcut */}
          <div style={{ marginTop: 10, borderTop: '1px solid #f1f5f9', paddingTop: 10, textAlign: 'center' }}>
            <button onClick={() => { const t=new Date(); onChange(`${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`); setOpen(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#4f9e6f', fontWeight: 700 }}>
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Form field wrapper ────────────────────────────────── */
function Field({ icon, label, required, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8',
      padding: '18px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 14, fontWeight: 600, color: '#1e293b', marginBottom: 12,
      }}>
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
        {label}
        {required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '11px 14px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: 14, boxSizing: 'border-box',
  background: '#fafafa', outline: 'none', color: '#1e293b',
}

/* ── Custom confirm dialog ─────────────────────────────── */
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div onClick={onCancel} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      backdropFilter: 'blur(3px)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 16, width: 340, padding: '28px 28px 22px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }}>
        <div style={{ fontSize: 22, marginBottom: 10 }}>🗑</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
          Delete Timesheet
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '9px 22px', borderRadius: 9, border: '1px solid #e2e8f0',
            background: '#f8fafc', color: '#475569', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '9px 22px', borderRadius: 9, border: 'none',
            background: '#dc2626', color: '#fff', cursor: 'pointer',
            fontSize: 13, fontWeight: 700,
          }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

/* ── Main page ────────────────────────────────────────── */
export default function TimesheetPage({ user }) {
  const [view, setView]             = useState('list')
  const [editId, setEditId]         = useState(null)
  const [timesheets, setTimesheets] = useState([])
  const [modules, setModules]       = useState([])
  const [managers, setManagers]     = useState([])
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [confirmDlg, setConfirmDlg] = useState(null)
  const [showMod, setShowMod]       = useState(false)
  const [showMgr, setShowMgr]       = useState(false)
  const [showTask, setShowTask]     = useState(false)
  const [mgrSearch, setMgrSearch]   = useState('')
  const [taskSearch, setTaskSearch] = useState('')
  const [detailTs, setDetailTs]     = useState(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [attachments, setAttachments] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [modSearch, setModSearch] = useState('')
  const [myTasks, setMyTasks]     = useState([])
  const modRef    = useRef(null)
  const mgrRef    = useRef(null)
  const taskRef   = useRef(null)
  const attachRef = useRef(null)

  const [form, setForm] = useState({
    workingDate: '',
    workingHoursH: 0,
    workingHoursM: 0,
    selectedModules: [],
    selectedTaskIds: [],
    managerIds: [],
    description: '',
  })

  const [workHoursLoading, setWorkHoursLoading] = useState(false)
  const [workHoursNoData, setWorkHoursNoData]   = useState(false)
  const [attendanceMap, setAttendanceMap]       = useState({}) // date → actual minutes from attendance

  useEffect(() => { loadAll() }, [])
  useEffect(() => {
    if (view !== 'form' || !form.workingDate) return
    const todayStr = new Date().toISOString().slice(0, 10)
    const isToday  = form.workingDate === todayStr
    const d = new Date(form.workingDate + 'T12:00:00')
    const year = d.getFullYear()
    const month = d.getMonth()
    setWorkHoursLoading(true)
    setWorkHoursNoData(false)

    const applyMs = (ms) => {
      if (ms > 0) {
        setForm(f => ({
          ...f,
          workingHoursH: Math.floor(ms / 3600000),
          workingHoursM: Math.floor((ms % 3600000) / 60000),
        }))
        setWorkHoursNoData(false)
      } else {
        setForm(f => ({ ...f, workingHoursH: 0, workingHoursM: 0 }))
        setWorkHoursNoData(true)
      }
    }

    if (isToday) {
      // Today's daily summary may not exist yet — use live attendance
      api.fetchMyAttendance()
        .then(dto => applyMs(dto?.totalWorkMs || 0))
        .catch(() => setWorkHoursNoData(true))
        .finally(() => setWorkHoursLoading(false))
    } else {
      api.fetchMyHistoryByMonth(year, month)
        .then(records => {
          const rec = records.find(r => r.date === form.workingDate)
          applyMs(rec?.totalWorkMs || 0)
        })
        .catch(() => setWorkHoursNoData(true))
        .finally(() => setWorkHoursLoading(false))
    }
  }, [form.workingDate, view])

  useEffect(() => {
    function h(e) {
      if (modRef.current  && !modRef.current.contains(e.target))  setShowMod(false)
      if (mgrRef.current  && !mgrRef.current.contains(e.target))  setShowMgr(false)
      if (taskRef.current && !taskRef.current.contains(e.target)) setShowTask(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [ts, mods, mgrs, tasks] = await Promise.all([
        api.fetchMyTimesheets(), api.fetchTimesheetModules(), api.fetchTimesheetManagers(), api.fetchMyTasks(),
      ])
      setTimesheets(ts); setModules(mods); setManagers(mgrs); setMyTasks(tasks)

      // Fetch attendance for all months covered by timesheets → build date→minutes map
      const monthKeys = [...new Set(ts.map(t => {
        const d = new Date(t.workingDate + 'T12:00:00')
        return `${d.getFullYear()}-${d.getMonth()}`
      }))]
      const attMap = {}
      await Promise.all(monthKeys.map(async key => {
        const [year, month] = key.split('-').map(Number)
        try {
          const records = await api.fetchMyHistoryByMonth(year, month)
          records.forEach(r => {
            if (r.totalWorkMs > 0) {
              attMap[r.date] = Math.floor(r.totalWorkMs / 3600000) * 60
                             + Math.floor((r.totalWorkMs % 3600000) / 60000)
            }
          })
        } catch {}
      }))
      setAttendanceMap(attMap)
    } catch {}
    setLoading(false)
  }

  function openNew() {
    setForm({
      workingDate: '',
      workingHoursH: 0, workingHoursM: 0, selectedModules: [], selectedTaskIds: [],
      managerIds: managers.length === 1 ? [managers[0].id] : [],
      description: '',
    })
    setWorkHoursNoData(false)
    setEditId(null); setError(''); setView('form')
  }

  function openEdit(ts) {
    const mods = ts.modules ? ts.modules.split(',').map(m => m.trim()).filter(Boolean) : []
    const tids = ts.taskIds ? ts.taskIds.split(',').map(t => t.trim()).filter(Boolean) : []
    setForm({
      workingDate: ts.workingDate,
      workingHoursH: 0,
      workingHoursM: 0,
      selectedModules: mods,
      selectedTaskIds: tids,
      managerIds: ts.managerId ? ts.managerId.split(',').map(m => m.trim()).filter(Boolean) : [],
      description: ts.description || '',
    })
    setWorkHoursNoData(false)
    setEditId(ts.id); setError(''); setView('form')
  }

  function handleDelete(ts) {
    setConfirmDlg({
      message: 'Are you sure you want to delete this draft? This cannot be undone.',
      onConfirm: async () => {
        setConfirmDlg(null)
        try {
          await api.deleteTimesheet(ts.id)
          setTimesheets(prev => prev.filter(t => t.id !== ts.id))
        } catch (e) { alert(e.message || 'Delete failed') }
      },
    })
  }

  function toggleSelect(id, e) {
    e.stopPropagation()
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleSelectAll() {
    const ids = visibleRows.filter(r => r.status === 'DRAFT').map(r => r.id)
    const allSelected = ids.length > 0 && ids.every(id => selected.has(id))
    setSelected(prev => {
      const n = new Set(prev)
      allSelected ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id))
      return n
    })
  }

  function handleBulkDelete() {
    const ids = [...selected]
    setConfirmDlg({
      message: `Are you sure you want to delete ${ids.length} selected timesheet${ids.length > 1 ? 's' : ''}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDlg(null)
        let failed = 0
        for (const id of ids) {
          try {
            await api.deleteTimesheet(id)
            setTimesheets(prev => prev.filter(t => t.id !== id))
            setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
          } catch { failed++ }
        }
        if (failed > 0) alert(`${failed} timesheet(s) could not be deleted.`)
      },
    })
  }

  async function handleBulkSubmit() {
    const draftTs = timesheets.filter(t => selected.has(t.id) && t.status === 'DRAFT')
    const noDesc  = draftTs.filter(t => !t.description?.trim())
    const toSubmit = draftTs.filter(t => t.description?.trim())

    if (toSubmit.length === 0) {
      alert('Selected timesheets have no description. Please edit them before submitting.')
      return
    }
    if (noDesc.length > 0) {
      const ok = window.confirm(
        `${noDesc.length} timesheet(s) have no description and will be skipped.\n` +
        `Submit the remaining ${toSubmit.length}?`
      )
      if (!ok) return
    }

    let failed = 0
    for (const ts of toSubmit) {
      try {
        const updated = await api.updateTimesheet(ts.id, {
          workingDate: ts.workingDate,
          workingHours: ts.workingHours,
          modules: ts.modules,
          managerId: ts.managerId,
          description: ts.description,
          status: 'SUBMITTED',
        })
        setTimesheets(prev => prev.map(t => t.id === ts.id ? updated : t))
        setSelected(prev => { const n = new Set(prev); n.delete(ts.id); return n })
      } catch { failed++ }
    }
    if (failed > 0) alert(`${failed} timesheet(s) could not be submitted.`)
  }

  function toggleModule(name) {
    setForm(f => ({
      ...f,
      selectedModules: f.selectedModules.includes(name)
        ? f.selectedModules.filter(m => m !== name)
        : [...f.selectedModules, name],
    }))
  }

  async function save(submitStatus) {
    if (!form.workingDate)        { setError('Working date is required'); return }
    if (workHoursLoading)         { setError('Please wait…'); return }
    if (form.managerIds.length === 0) { setError('Please select at least one manager'); return }
    if (submitStatus !== 'DRAFT' && !form.description.trim()) { setError('Brief description is required'); return }
    setSaving(true); setError('')

    // On Submit: re-fetch latest attendance hours to capture end-of-day actual hours
    let finalMins = (Number(form.workingHoursH) || 0) * 60 + (Number(form.workingHoursM) || 0)
    if (submitStatus !== 'DRAFT') {
      try {
        const todayStr = new Date().toISOString().slice(0, 10)
        const isToday  = form.workingDate === todayStr
        if (isToday) {
          const dto = await api.fetchMyAttendance()
          if (dto?.totalWorkMs > 0)
            finalMins = Math.floor(dto.totalWorkMs / 3600000) * 60 + Math.floor((dto.totalWorkMs % 3600000) / 60000)
        } else {
          const d = new Date(form.workingDate + 'T12:00:00')
          const records = await api.fetchMyHistoryByMonth(d.getFullYear(), d.getMonth())
          const rec = records.find(r => r.date === form.workingDate)
          if (rec?.totalWorkMs > 0)
            finalMins = Math.floor(rec.totalWorkMs / 3600000) * 60 + Math.floor((rec.totalWorkMs % 3600000) / 60000)
        }
      } catch { /* keep form hours if fetch fails */ }
    }

    const _todayStr = new Date().toISOString().slice(0, 10)
    if (submitStatus !== 'DRAFT' && form.workingDate !== _todayStr && finalMins < 1) { setError('No attendance record found for the selected date. Please choose a date you were present.'); setSaving(false); return }
    if (finalMins > 720) { setError('Working hours cannot exceed 12 hours'); setSaving(false); return }

    try {
      const payload = {
        workingDate: form.workingDate, workingHours: finalMins,
        modules: form.selectedModules.join(', '),
        taskIds: form.selectedTaskIds.join(','),
        managerId: form.managerIds.join(','),
        description: form.description, status: submitStatus,
      }
      let saved
      if (editId) {
        saved = await api.updateTimesheet(editId, payload)
        setTimesheets(prev => prev.map(t => t.id === editId ? saved : t))
      } else {
        saved = await api.createTimesheet(payload)
        setTimesheets(prev => [saved, ...prev])
      }
      setView('list'); setError('')
    } catch (e) { setError(e.message || 'Failed to save') }
    setSaving(false)
  }

  const counts = {
    all:       timesheets.length,
    submitted: timesheets.filter(t => t.status === 'SUBMITTED').length,
    approved:  timesheets.filter(t => t.status === 'APPROVED').length,
    rejected:  timesheets.filter(t => t.status === 'REJECTED').length,
    draft:     timesheets.filter(t => t.status === 'DRAFT').length,
  }

  const visibleRows = filterStatus === 'ALL'
    ? timesheets
    : timesheets.filter(t => t.status === filterStatus)


  /* ── FORM MODAL ──────────────────────────────────────────── */
  const formModal = view === 'form' && (
    <div onClick={e => { if (e.target === e.currentTarget) { setView('list'); setError('') } }} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)',
      backdropFilter: 'blur(3px)', zIndex: 1000,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto', padding: '24px 16px',
    }}>
      <div style={{
        background: '#f8fafc', borderRadius: 16, width: '100%', maxWidth: 640,
        boxShadow: '0 24px 60px rgba(0,0,0,0.22)', marginBottom: 24,
      }}>
        {/* Modal header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
          background: '#fff', borderRadius: '16px 16px 0 0',
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
            {editId ? '✎ Edit Timesheet' : '+ New Timesheet Entry'}
          </span>
          <button onClick={() => { setView('list'); setError('') }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#94a3b8', fontSize: 22, lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
              padding: '12px 18px', color: '#dc2626', fontSize: 13,
            }}>{error}</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            <Field icon="👤" label="Employee Name" required>
              <input readOnly value={user?.name || ''}
                style={{ ...inputStyle, background: '#f1f5f9', color: '#64748b', cursor: 'default' }} />
            </Field>

            <Field icon="👥" label="Manager Name" required>
              <div ref={mgrRef} style={{ position: 'relative' }}>
                <div onClick={() => { setShowMgr(v => !v); setMgrSearch('') }} style={{
                  minHeight: 44, padding: '6px 12px', border: '1px solid #d1d5db',
                  borderRadius: 8, cursor: 'pointer', background: '#fafafa',
                  display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center',
                }}>
                  {form.managerIds.length === 0
                    ? <span style={{ color: '#9ca3af', fontSize: 14 }}>Select manager(s)…</span>
                    : form.managerIds.map(id => {
                        const m = managers.find(x => x.id === id)
                        return <span key={id} style={{
                          background: '#dbeafe', color: '#1d4ed8',
                          borderRadius: 6, padding: '3px 10px', fontSize: 13, fontWeight: 600,
                        }}>{m ? m.name : id}</span>
                      })
                  }
                  <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 11 }}>▼</span>
                </div>
                {showMgr && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4,
                  }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                      <input autoFocus type="text" placeholder="Search managers…"
                        value={mgrSearch} onChange={e => setMgrSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
                          borderRadius: 7, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {managers.filter(m => m.name.toLowerCase().includes(mgrSearch.toLowerCase())).map(m => (
                        <label key={m.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                          background: form.managerIds.includes(m.id) ? '#eff6ff' : '#fff',
                        }}>
                          <input type="checkbox"
                            checked={form.managerIds.includes(m.id)}
                            onChange={() => setForm(f => ({
                              ...f,
                              managerIds: f.managerIds.includes(m.id)
                                ? f.managerIds.filter(id => id !== m.id)
                                : [...f.managerIds, m.id]
                            }))}
                            onClick={e => e.stopPropagation()}
                            style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#1d4ed8' }}
                          />
                          <span style={{ fontSize: 14, color: '#374151', fontWeight: form.managerIds.includes(m.id) ? 600 : 400 }}>{m.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Field>

            <Field icon="📅" label="Working Date" required>
              <DatePicker
                value={form.workingDate}
                onChange={d => setForm(f => ({ ...f, workingDate: d }))}
                max={new Date().toISOString().slice(0, 10)}
              />
            </Field>

            {/* Working Hours hidden — auto-fetched from attendance on save */}

            <Field icon="🗂" label="Working Modules" required>
              <div ref={modRef} style={{ position: 'relative' }}>
                <div onClick={() => { setShowMod(v => !v); setModSearch('') }} style={{
                  minHeight: 44, padding: '6px 12px', border: '1px solid #d1d5db',
                  borderRadius: 8, cursor: 'pointer', background: '#fafafa',
                  display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center',
                }}>
                  {form.selectedModules.length === 0
                    ? <span style={{ color: '#9ca3af', fontSize: 14 }}>Select modules…</span>
                    : form.selectedModules.map(m => (
                        <span key={m} style={{
                          background: '#dcfce7', color: '#15803d',
                          borderRadius: 6, padding: '3px 10px', fontSize: 13, fontWeight: 600,
                        }}>{m}</span>
                      ))
                  }
                  <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 11 }}>▼</span>
                </div>
                {showMod && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4,
                  }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search modules…"
                        value={modSearch}
                        onChange={e => setModSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{
                          width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
                          borderRadius: 7, fontSize: 13, boxSizing: 'border-box', outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {modules.length === 0
                        ? <div style={{ padding: '14px 18px', color: '#9ca3af', fontSize: 13 }}>
                            No modules yet — ask your manager to add modules
                          </div>
                        : modules.filter(m => m.moduleName.toLowerCase().includes(modSearch.toLowerCase())).length === 0
                          ? <div style={{ padding: '14px 18px', color: '#9ca3af', fontSize: 13 }}>No matches found</div>
                          : modules.filter(m => m.moduleName.toLowerCase().includes(modSearch.toLowerCase())).map(m => (
                              <label key={m.id} style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                                background: form.selectedModules.includes(m.moduleName) ? '#f0fdf4' : '#fff',
                              }}>
                                <input type="checkbox"
                                  checked={form.selectedModules.includes(m.moduleName)}
                                  onChange={() => toggleModule(m.moduleName)}
                                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#15803d' }}
                                />
                                <span style={{
                                  fontSize: 14, color: '#374151',
                                  fontWeight: form.selectedModules.includes(m.moduleName) ? 600 : 400,
                                }}>{m.moduleName}</span>
                              </label>
                            ))
                      }
                    </div>
                  </div>
                )}
              </div>
            </Field>

            <Field icon="✅" label="Tasks">
              <div ref={taskRef} style={{ position: 'relative' }}>
                <div onClick={() => { setShowTask(v => !v); setTaskSearch('') }} style={{
                  minHeight: 44, padding: '6px 12px', border: '1px solid #d1d5db',
                  borderRadius: 8, cursor: 'pointer', background: '#fafafa',
                  display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center',
                }}>
                  {form.selectedTaskIds.length === 0
                    ? <span style={{ color: '#9ca3af', fontSize: 14 }}>Select tasks…</span>
                    : form.selectedTaskIds.map(id => (
                        <span key={id} style={{
                          background: '#ede9fe', color: '#6d28d9',
                          borderRadius: 6, padding: '3px 10px', fontSize: 13, fontWeight: 600,
                        }}>{id}</span>
                      ))
                  }
                  <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 11 }}>▼</span>
                </div>
                {showTask && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4,
                  }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                      <input autoFocus type="text" placeholder="Search by task ID or description…"
                        value={taskSearch} onChange={e => setTaskSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db',
                          borderRadius: 7, fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                      />
                    </div>
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {myTasks.length === 0
                        ? <div style={{ padding: '14px 18px', color: '#9ca3af', fontSize: 13 }}>No tasks assigned to you</div>
                        : (() => {
                            const filtered = myTasks.filter(t =>
                              t.taskId.toLowerCase().includes(taskSearch.toLowerCase()) ||
                              (t.description || '').toLowerCase().includes(taskSearch.toLowerCase())
                            )
                            if (filtered.length === 0)
                              return <div style={{ padding: '14px 18px', color: '#9ca3af', fontSize: 13 }}>No matches found</div>
                            return filtered.map(t => (
                              <label key={t.taskId} style={{
                                display: 'flex', alignItems: 'flex-start', gap: 12,
                                padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                                background: form.selectedTaskIds.includes(t.taskId) ? '#f5f3ff' : '#fff',
                              }}>
                                <input type="checkbox"
                                  checked={form.selectedTaskIds.includes(t.taskId)}
                                  onChange={() => setForm(f => ({
                                    ...f,
                                    selectedTaskIds: f.selectedTaskIds.includes(t.taskId)
                                      ? f.selectedTaskIds.filter(id => id !== t.taskId)
                                      : [...f.selectedTaskIds, t.taskId],
                                  }))}
                                  onClick={e => e.stopPropagation()}
                                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#6d28d9', marginTop: 3, flexShrink: 0 }}
                                />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: '#6d28d9' }}>{t.taskId}</div>
                                  {t.description && (
                                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{t.description}</div>
                                  )}
                                </div>
                              </label>
                            ))
                          })()
                      }
                    </div>
                  </div>
                )}
              </div>
            </Field>

            <Field icon="📝" label="Brief Description" required>
              <textarea rows={5} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe what you worked on today…"
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              />
            </Field>

            {/* Attachments */}
            <Field icon="📎" label="Attachments">
              <input
                ref={attachRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files)
                  setAttachments(prev => {
                    const existing = prev.map(f => f.name)
                    const newFiles = files.filter(f => !existing.includes(f.name))
                    return [...prev, ...newFiles]
                  })
                  e.target.value = ''
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => attachRef.current?.click()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '9px 16px', borderRadius: 8,
                    border: '1.5px dashed #cbd5e1', background: '#f8fafc',
                    color: '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    width: 'fit-content',
                  }}
                >
                  <span style={{ fontSize: 16 }}>+</span> Add Attachments
                </button>
                {attachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {attachments.map((file, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 12px', background: '#f1f5f9', borderRadius: 7,
                        border: '1px solid #e2e8f0',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>📄</span>
                          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{file.name}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#dc2626', fontSize: 16, lineHeight: 1, padding: '0 4px',
                          }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Field>

            {/* Buttons */}
            <div style={{
              background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8',
              padding: '16px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end',
            }}>
              <button onClick={() => { setView('list'); setError('') }} disabled={saving} style={{
                padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0',
                background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 14,
              }}>Cancel</button>
              {(() => {
                const filledCount = [
                  form.managerIds.length > 0,
                  !!form.workingDate,
                  form.selectedModules.length > 0,
                  !!form.description.trim(),
                ].filter(Boolean).length
                const isToday   = form.workingDate === new Date().toISOString().slice(0, 10)
                const canDraft  = filledCount >= 2
                const canSubmit = filledCount === 4 && (isToday || (!workHoursNoData && !workHoursLoading && ((Number(form.workingHoursH)||0)*60+(Number(form.workingHoursM)||0)) >= 30))
                return (<>
                  <button onClick={() => save('DRAFT')} disabled={saving || !canDraft} style={{
                    padding: '10px 20px', borderRadius: 8, border: '1px solid #94a3b8',
                    background: canDraft ? '#f8fafc' : '#f1f5f9',
                    color: canDraft ? '#374151' : '#b0bec5',
                    cursor: canDraft ? 'pointer' : 'not-allowed',
                    fontSize: 14, fontWeight: 600, opacity: canDraft ? 1 : 0.6,
                  }}>Save as Draft</button>
                  {canSubmit && (
                    <button onClick={() => save('SUBMITTED')} disabled={saving} style={{
                      padding: '10px 28px', borderRadius: 8, border: 'none',
                      background: '#4f9e6f', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                      boxShadow: '0 2px 6px rgba(79,158,111,0.35)',
                    }}>{saving ? 'Submitting…' : '✓ Submit'}</button>
                  )}
                </>)
              })()}
            </div>

          </div>
        </div>
      </div>
    </div>
  )

  /* ── LIST VIEW ──────────────────────────────────────────── */
  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' }}>My Timesheet</h2>
        <button onClick={openNew} style={{
          background: '#4f9e6f', color: '#fff', border: 'none', borderRadius: 9,
          padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700,
          boxShadow: '0 2px 8px rgba(79,158,111,0.35)',
        }}>+ New Entry</button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
        {[
          { key: 'ALL',       label: 'Total',     value: counts.all,       color: '#1e40af', bg: '#dbeafe', border: '#bfdbfe' },
          { key: 'SUBMITTED', label: 'Submitted',  value: counts.submitted,  color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
          { key: 'APPROVED',  label: 'Approved',   value: counts.approved,   color: '#065f46', bg: '#d1fae5', border: '#a7f3d0' },
          { key: 'REJECTED',  label: 'Rejected',   value: counts.rejected,   color: '#991b1b', bg: '#fee2e2', border: '#fecaca' },
          { key: 'DRAFT',     label: 'Draft',      value: counts.draft,      color: '#374151', bg: '#f1f5f9', border: '#cbd5e1' },
        ].map(s => (
          <div key={s.key} onClick={() => setFilterStatus(s.key)} style={{
            background: s.bg, border: `2px solid ${filterStatus === s.key ? s.color : s.border}`,
            borderRadius: 12, padding: '12px 20px', minWidth: 90, cursor: 'pointer',
            transition: 'border-color 0.15s',
            boxShadow: filterStatus === s.key ? `0 0 0 3px ${s.bg}` : 'none',
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: s.color, opacity: 0.8, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10,
          padding: '10px 16px', marginBottom: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0369a1' }}>
            {selected.size} selected
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelected(new Set())} style={{
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 7,
              padding: '5px 14px', cursor: 'pointer', fontSize: 12, color: '#64748b', fontWeight: 500,
            }}>Cancel</button>
            <button onClick={handleBulkSubmit} style={{
              background: '#4f9e6f', border: 'none', borderRadius: 7,
              padding: '5px 14px', cursor: 'pointer', fontSize: 12, color: '#fff', fontWeight: 700,
            }}>✓ Submit Selected</button>
            <button onClick={handleBulkDelete} style={{
              background: '#dc2626', border: 'none', borderRadius: 7,
              padding: '5px 14px', cursor: 'pointer', fontSize: 12, color: '#fff', fontWeight: 700,
            }}>🗑 Delete Selected</button>
          </div>
        </div>
      )}

      {/* Table card */}
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
        overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
      }}>
        {loading
          ? <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading…</div>
          : visibleRows.length === 0
            ? <div style={{ padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 38, marginBottom: 12 }}>📋</div>
                <div style={{ color: '#94a3b8', fontSize: 14 }}>
                  {filterStatus === 'ALL' ? 'No entries yet. Click "+ New Entry" to start.' : `No ${filterStatus.toLowerCase()} entries.`}
                </div>
              </div>
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 12px', width: 36 }}>
                        {(() => {
                          const draftRows = visibleRows.filter(r => r.status === 'DRAFT')
                          return (
                            <input type="checkbox"
                              checked={draftRows.length > 0 && draftRows.every(r => selected.has(r.id))}
                              onChange={toggleSelectAll}
                              onClick={e => e.stopPropagation()}
                              disabled={draftRows.length === 0}
                              style={{ width: 15, height: 15, cursor: draftRows.length > 0 ? 'pointer' : 'not-allowed', accentColor: '#dc2626', opacity: draftRows.length === 0 ? 0.3 : 1 }}
                            />
                          )
                        })()}
                      </th>
                      {['Date', 'Hours', 'Modules', 'Manager', 'Description', 'Status'].map(h => (
                        <th key={h} style={{
                          padding: '12px 16px', textAlign: 'left',
                          fontWeight: 700, color: '#64748b', fontSize: 11,
                          textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map(ts => {
                      const s = STATUS[ts.status] || STATUS.DRAFT
                      const mods = ts.modules ? ts.modules.split(',').map(m => m.trim()).filter(Boolean) : []
                      return (
                        <tr key={ts.id}
                          onClick={() => setDetailTs(ts)}
                          style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: selected.has(ts.id) ? '#fef2f2' : '#fff' }}
                          onMouseEnter={e => { if (!selected.has(ts.id)) e.currentTarget.style.background = '#f8fafc' }}
                          onMouseLeave={e => { e.currentTarget.style.background = selected.has(ts.id) ? '#fef2f2' : '#fff' }}
                        >
                          <td style={{ padding: '13px 12px', width: 36 }} onClick={e => e.stopPropagation()}>
                            <input type="checkbox"
                              checked={selected.has(ts.id)}
                              onChange={e => ts.status === 'DRAFT' && toggleSelect(ts.id, e)}
                              disabled={ts.status !== 'DRAFT'}
                              style={{ width: 15, height: 15, cursor: ts.status === 'DRAFT' ? 'pointer' : 'not-allowed', accentColor: '#dc2626', opacity: ts.status === 'DRAFT' ? 1 : 0.2 }}
                            />
                          </td>
                          <td style={{ padding: '13px 16px' }}>
                            {/* Status-colored left bar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 3, height: 36, borderRadius: 4, background: s.border, flexShrink: 0 }} />
                              <span style={{ fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                                {fmtDate(ts.workingDate)}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '13px 16px', color: '#475569', fontWeight: 500 }}>
                            {fmtHours(attendanceMap[ts.workingDate] ?? ts.workingHours)}
                          </td>
                          <td style={{ padding: '13px 16px', maxWidth: 180 }}>
                            {mods.length > 0
                              ? mods.slice(0, 2).map(m => (
                                  <span key={m} style={{
                                    display: 'inline-block', background: '#dcfce7', color: '#15803d',
                                    borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                                    marginRight: 4, marginBottom: 3,
                                  }}>{m}</span>
                                )).concat(mods.length > 2
                                  ? [<span key="more" style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>+{mods.length - 2}</span>]
                                  : [])
                              : <span style={{ color: '#cbd5e1' }}>—</span>
                            }
                          </td>
                          <td style={{ padding: '13px 16px', color: '#475569', whiteSpace: 'nowrap', fontSize: 13 }}>
                            {ts.managerName || '—'}
                          </td>
                          <td style={{ padding: '13px 16px', maxWidth: 240 }}>
                            <div style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ts.description || <span style={{ color: '#cbd5e1' }}>—</span>}
                            </div>
                            {ts.status === 'REJECTED' && ts.rejectReason && (
                              <div style={{ color: '#dc2626', fontSize: 11, marginTop: 3 }}>✕ {ts.rejectReason}</div>
                            )}
                          </td>
                          <td style={{ padding: '13px 16px' }}><Badge status={ts.status} /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>

      {/* Detail modal */}
      <DetailModal
        ts={detailTs}
        attendanceMap={attendanceMap}
        myTasks={myTasks}
        onClose={() => setDetailTs(null)}
        onEdit={ts => { openEdit(ts) }}
        onDelete={ts => { handleDelete(ts) }}
      />

      {/* New / Edit form modal */}
      {formModal}

      {/* Custom confirm dialog */}
      {confirmDlg && (
        <ConfirmDialog
          message={confirmDlg.message}
          onConfirm={confirmDlg.onConfirm}
          onCancel={() => setConfirmDlg(null)}
        />
      )}
    </div>
  )
}
