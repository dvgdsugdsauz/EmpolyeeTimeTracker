import { useState, useEffect, useRef } from 'react'
import * as api from '../../services/api'

const PRIORITY_COLOR = {
  High:   { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  Medium: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  Low:    { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
}
const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed']
const STATUS_COLOR = {
  Completed:    { bg: '#f0fdf4', color: '#16a34a' },
  'In Progress':{ bg: '#eff6ff', color: '#2563eb' },
  Pending:      { bg: '#fafafa', color: '#6b7280' },
}

function EditModal({ task, onClose, onSaved }) {
  const [form, setForm] = useState({
    actualStartDateTime: task.actualStartDateTime || '',
    actualEndDateTime:   task.actualEndDateTime   || '',
    status:              task.status              || 'Pending',
    remarks:             task.remarks             || '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const backdropRef = useRef()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    setErr('')
    try {
      const updated = await api.updateMyTask(task.taskId, form)
      onSaved(updated)
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

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
        background: '#fff', borderRadius: 16, width: 480,
        boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid #e2e8f0',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Update Task</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              <span style={{ fontWeight: 700, color: '#6366f1' }}>{task.taskId}</span>
              {task.module ? ` · ${task.module}` : ''}
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

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Status */}
          <div>
            <label style={labelStyle}>Status</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {STATUS_OPTIONS.map(s => {
                const sc = STATUS_COLOR[s] || {}
                const active = form.status === s
                return (
                  <button
                    key={s}
                    onClick={() => set('status', s)}
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                      border: active ? `2px solid ${sc.color}` : '2px solid #e2e8f0',
                      background: active ? sc.bg : '#fff',
                      color: active ? sc.color : '#64748b',
                      fontWeight: 600, fontSize: 13,
                    }}
                  >{s}</button>
                )
              })}
            </div>
          </div>

          {/* Actual Start */}
          <div>
            <label style={labelStyle}>Actual Start (Date-Time)</label>
            <input
              type="datetime-local"
              value={form.actualStartDateTime}
              onChange={e => set('actualStartDateTime', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Actual End */}
          <div>
            <label style={labelStyle}>Actual End (Date-Time)</label>
            <input
              type="datetime-local"
              value={form.actualEndDateTime}
              onChange={e => set('actualEndDateTime', e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Remarks */}
          <div>
            <label style={labelStyle}>Remarks</label>
            <textarea
              value={form.remarks}
              onChange={e => set('remarks', e.target.value)}
              rows={3}
              placeholder="Add your remarks..."
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
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #e2e8f0',
          display: 'flex', gap: 10,
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px 0', borderRadius: 9, cursor: 'pointer',
            background: '#f1f5f9', border: '1px solid #e2e8f0',
            color: '#64748b', fontWeight: 600, fontSize: 14,
          }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: '11px 0', borderRadius: 9, cursor: 'pointer',
              background: '#6366f1', border: 'none',
              color: '#fff', fontWeight: 700, fontSize: 14,
              boxShadow: '0 2px 8px rgba(99,102,241,.3)',
              opacity: saving ? .7 : 1,
            }}
          >{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

export default function MyTasksPage({ user }) {
  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(null)
  const [saveMsg, setSaveMsg]   = useState('')

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
        <span style={{ fontSize: 13, color: '#94a3b8' }}>Click a row to update progress</span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', borderRadius: 12, border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1e293b', position: 'sticky', top: 0, zIndex: 10 }}>
              {[
                'Task ID', 'Task Description', 'Assigned To', 'Role',
                'QA Assigned', 'Target Date', 'Yours',
                'Actual Start (Date-Time)', 'Actual End (Date-Time)',
                'Status', 'Remarks'
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
              const pc = PRIORITY_COLOR[t.priority] || {}
              const sc = STATUS_COLOR[t.status]     || { bg: '#f8fafc', color: '#64748b' }
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
                  {/* Task ID */}
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 700, color: '#6366f1', whiteSpace: 'nowrap' }}>{t.taskId}</span>
                  </td>

                  {/* Task Description */}
                  <td style={{ ...tdStyle, textAlign: 'left', minWidth: 220, maxWidth: 280 }}>
                    <span style={{
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden', color: '#374151',
                    }}>{t.description}</span>
                  </td>

                  {/* Assigned To */}
                  <td style={tdStyle}>
                    <span style={{ color: '#374151', whiteSpace: 'nowrap' }}>{t.assignedToName || t.assignedTo || '—'}</span>
                  </td>

                  {/* Role */}
                  <td style={tdStyle}>
                    <span style={{ color: '#374151' }}>{t.role || '—'}</span>
                  </td>

                  {/* QA Assigned */}
                  <td style={tdStyle}>
                    <span style={{ color: '#374151' }}>{t.qaAssigned || '—'}</span>
                  </td>

                  {/* Target Date */}
                  <td style={tdStyle}>
                    <span style={{ color: '#374151', whiteSpace: 'nowrap' }}>{t.targetDate || '—'}</span>
                  </td>

                  {/* Yours (priority badge) */}
                  <td style={tdStyle}>
                    {t.priority ? (
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: pc.bg, color: pc.color, border: `1px solid ${pc.border}`,
                      }}>{t.priority}</span>
                    ) : <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>

                  {/* Actual Start */}
                  <td style={tdStyle}>
                    <span style={{ color: t.actualStartDateTime ? '#374151' : '#94a3b8', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {t.actualStartDateTime ? t.actualStartDateTime.replace('T', ' ') : '—'}
                    </span>
                  </td>

                  {/* Actual End */}
                  <td style={tdStyle}>
                    <span style={{ color: t.actualEndDateTime ? '#374151' : '#94a3b8', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {t.actualEndDateTime ? t.actualEndDateTime.replace('T', ' ') : '—'}
                    </span>
                  </td>

                  {/* Status */}
                  <td style={tdStyle}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: sc.bg, color: sc.color, whiteSpace: 'nowrap',
                    }}>{t.status || '—'}</span>
                  </td>

                  {/* Remarks */}
                  <td style={{ ...tdStyle, maxWidth: 200, textAlign: 'left' }}>
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

      {/* Edit Modal */}
      {editing && (
        <EditModal
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
