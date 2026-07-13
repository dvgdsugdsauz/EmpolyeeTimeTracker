import { useState, useEffect, useRef } from 'react'
import * as api from '../../services/api'
import { DateTimePicker } from '../../components/DatePicker'

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

const localNow = () => {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/* ── Confirm Delete Popup ─────────────────────────────── */
function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: 360,
        boxShadow: '0 20px 60px rgba(0,0,0,.22)', overflow: 'hidden',
      }}>
        <div style={{ padding: '22px 24px 16px', textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: '#fef2f2', margin: '0 auto 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', marginBottom: 8 }}>Delete Subtask?</div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>{message}</div>
        </div>
        <div style={{ padding: '12px 24px 20px', display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '10px 0', borderRadius: 9, cursor: 'pointer',
            background: '#f1f5f9', border: '1px solid #e2e8f0',
            color: '#475569', fontWeight: 600, fontSize: 14,
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '10px 0', borderRadius: 9, cursor: 'pointer',
            border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 14,
            boxShadow: '0 2px 8px rgba(220,38,38,.3)',
          }}>Delete</button>
        </div>
      </div>
    </div>
  )
}

/* ── SubTask Modal ─────────────────────────────────────── */
function SubTaskModal({ parentTask, existingSubTask, onClose, onSaved }) {
  const [form, setForm] = useState({
    description: existingSubTask?.description || '',
    remarks:     existingSubTask?.remarks     || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const backdropRef = useRef()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      let result
      if (existingSubTask) {
        result = await api.updateSubTask(existingSubTask.id, form)
      } else {
        result = await api.createSubTask({ ...form, parentTaskId: parentTask.taskId })
      }
      onSaved(result, !!existingSubTask)
    } catch (e) {
      setErr(e.message || 'Save failed')
      setSaving(false)
    }
  }

  const title = existingSubTask ? existingSubTask.subTaskId : `New subtask of ${parentTask.taskId}`

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: 500,
        boxShadow: '0 20px 60px rgba(0,0,0,.22)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 22px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#7c3aed' }}>⊕ Sub Task</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#6366f1' }}>{title}</span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {parentTask.description?.slice(0, 60)}{(parentTask.description?.length || 0) > 60 ? '…' : ''}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: '#e2e8f0', border: 'none', borderRadius: 8,
            width: 32, height: 32, cursor: 'pointer', color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3} placeholder="Describe this subtask…"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Remarks</label>
            <textarea
              value={form.remarks}
              onChange={e => set('remarks', e.target.value)}
              rows={2} placeholder="Add remarks…"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          {err && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 13 }}>{err}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '9px 18px', borderRadius: 9, cursor: 'pointer',
            background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600, fontSize: 13,
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '9px 22px', borderRadius: 9, cursor: 'pointer', border: 'none',
            background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13,
            boxShadow: '0 2px 8px rgba(124,58,237,.3)', opacity: saving ? .7 : 1,
          }}>{saving ? 'Saving…' : existingSubTask ? 'Update' : 'Create Subtask'}</button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Task Modal ───────────────────────────────────── */
function TaskModal({ task, onClose, onSaved }) {
  const [form, setForm] = useState({
    actualStartDateTime: task.actualStartDateTime || '',
    actualEndDateTime:   task.actualEndDateTime   || '',
    remarks:             task.remarks             || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const backdropRef = useRef()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const callApi = async (extra = {}) => {
    setSaving(true)
    setErr('')
    try {
      const updated = await api.updateMyTask(task.taskId, { ...form, ...extra })
      onSaved(updated)
    } catch (e) {
      setErr(e.message || 'Save failed')
      setSaving(false)
    }
  }

  const status = task.status || 'Pending'
  const sc = STATUS_COLOR[status] || STATUS_COLOR.Pending

  return (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: 520,
        boxShadow: '0 20px 60px rgba(0,0,0,.22)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#6366f1', flexShrink: 0 }}>{task.taskId}</span>
              <span style={{
                padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, flexShrink: 0,
              }}>{status}</span>
              {task.module && (
                <span style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.module}
                </span>
              )}
            </div>
            <div style={{
              fontSize: 13, color: '#374151', lineHeight: 1.4,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>{task.description}</div>
          </div>
          <button onClick={onClose} style={{
            background: '#e2e8f0', border: 'none', borderRadius: 8, marginLeft: 12,
            width: 32, height: 32, cursor: 'pointer', color: '#64748b', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Actual Start</label>
              <DateTimePicker
                value={form.actualStartDateTime}
                onChange={v => set('actualStartDateTime', v)}
                placeholder="Select start…"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Actual End</label>
              <DateTimePicker
                value={form.actualEndDateTime}
                onChange={v => set('actualEndDateTime', v)}
                placeholder="Select end…"
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Remarks</label>
            <textarea
              value={form.remarks}
              onChange={e => set('remarks', e.target.value)}
              rows={3} placeholder="Add remarks..."
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          {err && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 13 }}>{err}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '10px 16px', borderRadius: 9, cursor: 'pointer',
            background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', fontWeight: 600, fontSize: 13,
          }}>Cancel</button>

          <button onClick={() => callApi({})} disabled={saving} style={{
            padding: '10px 18px', borderRadius: 9, cursor: 'pointer',
            background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', fontWeight: 600, fontSize: 13, opacity: saving ? .7 : 1,
          }}>Save</button>

          {status === 'Pending' && (
            <button onClick={() => callApi({ status: 'In Progress', actualStartDateTime: form.actualStartDateTime || localNow() })} disabled={saving}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 0', borderRadius:9, border:'none', cursor:'pointer', background:'#6366f1', color:'#fff', fontWeight:700, fontSize:14, boxShadow:'0 2px 8px rgba(99,102,241,.3)', opacity:saving?.7:1 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Start Task
            </button>
          )}
          {status === 'Paused' && (
            <button onClick={() => callApi({ status: 'In Progress', actualEndDateTime: '' })} disabled={saving}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 0', borderRadius:9, border:'none', cursor:'pointer', background:'#6366f1', color:'#fff', fontWeight:700, fontSize:14, boxShadow:'0 2px 8px rgba(99,102,241,.3)', opacity:saving?.7:1 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Resume
            </button>
          )}
          {status === 'In Progress' && (
            <>
              <button onClick={() => callApi({ status: 'Paused', actualEndDateTime: localNow() })} disabled={saving}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 0', borderRadius:9, cursor:'pointer', background:'#fefce8', border:'1px solid #fde68a', color:'#ca8a04', fontWeight:700, fontSize:13, opacity:saving?.7:1 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                Pause
              </button>
              <button onClick={() => callApi({ status: 'Completed', actualEndDateTime: form.actualEndDateTime || localNow() })} disabled={saving}
                style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 0', borderRadius:9, border:'none', cursor:'pointer', background:'#16a34a', color:'#fff', fontWeight:700, fontSize:14, boxShadow:'0 2px 8px rgba(22,163,74,.3)', opacity:saving?.7:1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Complete
              </button>
            </>
          )}
          {status === 'Completed' && (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'10px 0', borderRadius:9, background:'#f0fdf4', color:'#16a34a', fontWeight:600, fontSize:13, border:'1px solid #bbf7d0' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Completed
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MyTasksPage() {
  const [tasks, setTasks]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [editing, setEditing]       = useState(null)
  const [saveMsg, setSaveMsg]       = useState('')
  const [subTaskMap, setSubTaskMap] = useState({})   // taskId → SubTask[]
  const [expanded, setExpanded]     = useState({})   // taskId → bool
  const [subModal, setSubModal]       = useState(null) // { parentTask, existingSubTask? }
  const [confirmDelete, setConfirmDelete] = useState(null) // SubTask to delete

  useEffect(() => {
    Promise.all([api.fetchMyTasks(), api.fetchMySubTasks()])
      .then(([ts, sts]) => {
        setTasks(ts)
        const map = {}
        sts.forEach(s => {
          if (!map[s.parentTaskId]) map[s.parentTaskId] = []
          map[s.parentTaskId].push(s)
        })
        setSubTaskMap(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSaved = (updated) => {
    setTasks(prev => prev.map(t => t.taskId === updated.taskId ? updated : t))
    setEditing(null)
    setSaveMsg('Task updated')
    setTimeout(() => setSaveMsg(''), 2500)
  }

  function handleSubTaskSaved(result, isUpdate) {
    setSubTaskMap(prev => {
      const pid = result.parentTaskId
      const existing = prev[pid] || []
      const list = isUpdate
        ? existing.map(s => s.id === result.id ? result : s)
        : [...existing, result]
      return { ...prev, [pid]: list }
    })
    setExpanded(prev => ({ ...prev, [result.parentTaskId]: true }))
    setSubModal(null)
    setSaveMsg(isUpdate ? 'Subtask updated' : 'Subtask created')
    setTimeout(() => setSaveMsg(''), 2500)
  }

  async function doDeleteSubTask(subTask) {
    try {
      await api.deleteSubTask(subTask.id)
      setSubTaskMap(prev => {
        const list = (prev[subTask.parentTaskId] || []).filter(s => s.id !== subTask.id)
        return { ...prev, [subTask.parentTaskId]: list }
      })
      setSaveMsg('Subtask deleted')
      setTimeout(() => setSaveMsg(''), 2500)
    } catch (e) {
      setSaveMsg('Delete failed')
      setTimeout(() => setSaveMsg(''), 2500)
    } finally {
      setConfirmDelete(null)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#94a3b8', fontSize: 14 }}>
      Loading tasks…
    </div>
  )

  const totalSubTasks = Object.values(subTaskMap).reduce((s, a) => s + a.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 14, gap: 10 }}>
        {saveMsg && (
          <span style={{ fontSize: 13, padding: '5px 12px', borderRadius: 6, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>{saveMsg}</span>
        )}
        {totalSubTasks > 0 && (
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
            {totalSubTasks} subtask{totalSubTasks !== 1 ? 's' : ''}
          </span>
        )}
        <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe' }}>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1e293b', position: 'sticky', top: 0, zIndex: 10 }}>
              {[
                'Task ID', 'Task Description', 'Assigned By',
                'Planned Date', 'Target Date', 'Priority',
                'Actual Start', 'Actual End', 'Status', 'Hours', 'Remarks',
              ].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>
                  No tasks assigned to you yet
                </td>
              </tr>
            )}
            {tasks.map((t, i) => {
              const pc       = PRIORITY_COLOR[t.priority] || {}
              const status   = t.status || 'Pending'
              const sc       = STATUS_COLOR[status] || STATUS_COLOR.Pending
              const subs     = subTaskMap[t.taskId] || []
              const isExpand = expanded[t.taskId]
              const rowBg    = i % 2 === 0 ? '#fff' : '#fafafa'
              return (
                <>
                  {/* ── Main task row ── */}
                  <tr
                    key={t.taskId}
                    onClick={() => setEditing(t)}
                    style={{ background: rowBg, cursor: 'pointer', transition: 'background .1s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9' }}
                    onMouseLeave={e => { e.currentTarget.style.background = rowBg }}
                  >
                    {/* Task ID + subtask toggle + add button */}
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                        <span style={{ fontWeight: 700, color: '#6366f1', whiteSpace: 'nowrap' }}>{t.taskId}</span>
                        {/* Add subtask button */}
                        <button
                          title="Add subtask"
                          onClick={e => { e.stopPropagation(); setSubModal({ parentTask: t }) }}
                          style={{
                            border: 'none', borderRadius: 5, padding: '2px 5px',
                            background: '#f5f3ff', color: '#7c3aed', cursor: 'pointer',
                            fontSize: 14, fontWeight: 700, lineHeight: 1,
                          }}
                        >+</button>
                        {/* Expand/collapse if subtasks exist */}
                        {subs.length > 0 && (
                          <button
                            title={isExpand ? 'Collapse subtasks' : `${subs.length} subtask(s)`}
                            onClick={e => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [t.taskId]: !prev[t.taskId] })) }}
                            style={{
                              border: 'none', borderRadius: 5, padding: '2px 6px',
                              background: '#ede9fe', color: '#7c3aed', cursor: 'pointer',
                              fontSize: 11, fontWeight: 700,
                            }}
                          >{isExpand ? '▲' : `▼ ${subs.length}`}</button>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'left', minWidth: 200, maxWidth: 280 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: '#374151' }}>{t.description}</span>
                    </td>
                    <td style={tdStyle}><span style={{ color: '#374151', whiteSpace: 'nowrap' }}>{t.assignedByName || t.assignedBy || '—'}</span></td>
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
                      <span className={status === 'In Progress' ? 'task-in-progress' : ''} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, whiteSpace: 'nowrap', display: 'inline-block' }}>{status}</span>
                    </td>
                    <td style={tdStyle}><span style={{ color: '#374151', whiteSpace: 'nowrap', fontWeight: 500 }}>{calcWorkedHours(t)}</span></td>
                    <td style={{ ...tdStyle, maxWidth: 180, textAlign: 'left' }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: t.remarks ? '#374151' : '#94a3b8', fontSize: 12 }}>{t.remarks || '—'}</span>
                    </td>
                  </tr>

                  {/* ── Subtask rows (expanded) ── */}
                  {isExpand && subs.map(st => (
                    <tr key={st.subTaskId} style={{ background: '#faf5ff' }}>
                      <td style={{ ...tdStyle, paddingLeft: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                          <span style={{ color: '#94a3b8', fontSize: 11 }}>└</span>
                          <span style={{ fontWeight: 700, color: '#7c3aed', fontSize: 12, whiteSpace: 'nowrap' }}>{st.subTaskId}</span>
                          <button
                            title="Edit subtask"
                            onClick={e => { e.stopPropagation(); setSubModal({ parentTask: t, existingSubTask: st }) }}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#6366f1', fontSize: 13, padding: '1px 3px' }}
                          >✎</button>
                          <button
                            title="Delete subtask"
                            onClick={e => { e.stopPropagation(); setConfirmDelete(st) }}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 13, padding: '1px 3px' }}
                          >✕</button>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'left', minWidth: 200, maxWidth: 280 }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: '#6b21a8', fontSize: 12 }}>{st.description || '—'}</span>
                      </td>
                      <td colSpan={3} style={{ ...tdStyle, color: '#94a3b8', fontSize: 11 }}>— subtask —</td>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}><span style={{ color: '#374151', whiteSpace: 'nowrap', fontSize: 12 }}>{st.actualStartDateTime ? st.actualStartDateTime.replace('T', ' ') : '—'}</span></td>
                      <td style={tdStyle}><span style={{ color: '#374151', whiteSpace: 'nowrap', fontSize: 12 }}>{st.actualEndDateTime ? st.actualEndDateTime.replace('T', ' ') : '—'}</span></td>
                      <td style={tdStyle}></td>
                      <td style={tdStyle}></td>
                      <td style={{ ...tdStyle, maxWidth: 180, textAlign: 'left' }}>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: st.remarks ? '#374151' : '#94a3b8', fontSize: 12 }}>{st.remarks || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <TaskModal task={editing} onClose={() => setEditing(null)} onSaved={handleSaved} />
      )}
      {subModal && (
        <SubTaskModal
          parentTask={subModal.parentTask}
          existingSubTask={subModal.existingSubTask}
          onClose={() => setSubModal(null)}
          onSaved={handleSubTaskSaved}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          message={`Are you sure you want to delete subtask "${confirmDelete.subTaskId}"? This action cannot be undone.`}
          onConfirm={() => doDeleteSubTask(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}

const thStyle = {
  padding: '11px 14px', textAlign: 'center', fontWeight: 600,
  fontSize: 12, color: '#e2e8f0', whiteSpace: 'nowrap',
  borderBottom: '2px solid #334155',
}
const tdStyle = {
  padding: '11px 14px', textAlign: 'center',
  borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle',
}
const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b',
}
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
  background: '#f8fafc', border: '1px solid #e2e8f0',
  color: '#1e293b', outline: 'none', boxSizing: 'border-box', marginTop: 6,
}
