import { useState, useEffect, useRef } from 'react'
import * as api from '../../services/api'

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

const localNow = () => {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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
                background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                flexShrink: 0,
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
              <input
                type="datetime-local" value={form.actualStartDateTime}
                onChange={e => set('actualStartDateTime', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Actual End</label>
              <input
                type="datetime-local" value={form.actualEndDateTime}
                onChange={e => set('actualEndDateTime', e.target.value)}
                style={inputStyle}
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
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 13 }}>
              {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '10px 16px', borderRadius: 9, cursor: 'pointer',
            background: '#f1f5f9', border: '1px solid #e2e8f0',
            color: '#64748b', fontWeight: 600, fontSize: 13,
          }}>Cancel</button>

          <button onClick={() => callApi({})} disabled={saving} style={{
            padding: '10px 18px', borderRadius: 9, cursor: 'pointer',
            background: '#f8fafc', border: '1px solid #e2e8f0',
            color: '#475569', fontWeight: 600, fontSize: 13, opacity: saving ? .7 : 1,
          }}>Save</button>

          {/* Pending → Start */}
          {status === 'Pending' && (
            <button
              onClick={() => callApi({ status: 'In Progress', actualStartDateTime: form.actualStartDateTime || localNow() })}
              disabled={saving}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 14,
                boxShadow: '0 2px 8px rgba(99,102,241,.3)', opacity: saving ? .7 : 1,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Start Task
            </button>
          )}

          {/* Paused → Resume */}
          {status === 'Paused' && (
            <button
              onClick={() => callApi({ status: 'In Progress' })}
              disabled={saving}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 14,
                boxShadow: '0 2px 8px rgba(99,102,241,.3)', opacity: saving ? .7 : 1,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Resume
            </button>
          )}

          {/* In Progress → Pause + Complete */}
          {status === 'In Progress' && (
            <>
              <button
                onClick={() => callApi({ status: 'Paused' })}
                disabled={saving}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 0', borderRadius: 9, cursor: 'pointer',
                  background: '#fefce8', border: '1px solid #fde68a',
                  color: '#ca8a04', fontWeight: 700, fontSize: 13, opacity: saving ? .7 : 1,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
                </svg>
                Pause
              </button>
              <button
                onClick={() => callApi({ status: 'Completed', actualEndDateTime: form.actualEndDateTime || localNow() })}
                disabled={saving}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 14,
                  boxShadow: '0 2px 8px rgba(22,163,74,.3)', opacity: saving ? .7 : 1,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Complete
              </button>
            </>
          )}

          {/* Completed */}
          {status === 'Completed' && (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 0', borderRadius: 9,
              background: '#f0fdf4', color: '#16a34a', fontWeight: 600, fontSize: 13,
              border: '1px solid #bbf7d0',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Completed
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function MyTasksPage() {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    api.fetchMyTasks()
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSaved = (updated) => {
    setTasks(prev => prev.map(t => t.taskId === updated.taskId ? updated : t))
    setEditing(null)
    setSaveMsg('Task updated')
    setTimeout(() => setSaveMsg(''), 2500)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#94a3b8', fontSize: 14 }}>
      Loading tasks…
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 14, gap: 10 }}>
        {saveMsg && (
          <span style={{
            fontSize: 13, padding: '5px 12px', borderRadius: 6,
            background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
          }}>{saveMsg}</span>
        )}
        <span style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
          background: '#eef2ff', color: '#6366f1', border: '1px solid #c7d2fe',
        }}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>Click a row to update</span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1e293b', position: 'sticky', top: 0, zIndex: 10 }}>
              {[
                'Task ID', 'Task Description', 'Assigned To',
                'Target Date', 'Priority',
                'Actual Start', 'Actual End', 'Status', 'Remarks',
              ].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: 14 }}>
                  No tasks assigned to you yet
                </td>
              </tr>
            )}
            {tasks.map((t, i) => {
              const pc     = PRIORITY_COLOR[t.priority] || {}
              const status = t.status || 'Pending'
              const sc     = STATUS_COLOR[status] || STATUS_COLOR.Pending
              return (
                <tr
                  key={t.taskId + i}
                  onClick={() => setEditing(t)}
                  style={{
                    background: i % 2 === 0 ? '#fff' : '#fafafa',
                    cursor: 'pointer', transition: 'background .1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9' }}
                  onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa' }}
                >
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 700, color: '#6366f1', whiteSpace: 'nowrap' }}>{t.taskId}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'left', minWidth: 200, maxWidth: 280 }}>
                    <span style={{
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden', color: '#374151',
                    }}>{t.description}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: '#374151', whiteSpace: 'nowrap' }}>{t.assignedToName || t.assignedTo || '—'}</span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: '#374151', whiteSpace: 'nowrap' }}>{t.targetDate || '—'}</span>
                  </td>
                  <td style={tdStyle}>
                    {t.priority ? (
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`,
                      }}>{t.priority}</span>
                    ) : <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: t.actualStartDateTime ? '#374151' : '#94a3b8', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {t.actualStartDateTime ? t.actualStartDateTime.replace('T', ' ') : '—'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ color: t.actualEndDateTime ? '#374151' : '#94a3b8', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {t.actualEndDateTime ? t.actualEndDateTime.replace('T', ' ') : '—'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                      whiteSpace: 'nowrap',
                    }}>{status}</span>
                  </td>
                  <td style={{ ...tdStyle, maxWidth: 180, textAlign: 'left' }}>
                    <span style={{
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      color: t.remarks ? '#374151' : '#94a3b8', fontSize: 12,
                    }}>{t.remarks || '—'}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <TaskModal
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
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
