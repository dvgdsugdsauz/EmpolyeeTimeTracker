import { useState, useEffect } from 'react'
import * as api from '../../services/api'

const PRIORITY_COLOR = { High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e' }
const STATUS_COLOR   = { Completed: '#22c55e', 'In Progress': '#3b82f6', Pending: '#f59e0b' }

export default function MyTasksPage({ user }) {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    api.fetchMyTasks()
      .then(setTasks)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#6b7280', fontSize: 14 }}>
      Loading tasks…
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>

      {/* ── Left: Table ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>My Tasks</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Tasks assigned to you</p>
        </div>

        <div style={{ flex: 1, overflow: 'auto', borderRadius: 10, border: '1px solid var(--border, #2a3145)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1a2340', position: 'sticky', top: 0 }}>
                {['Task ID', 'Module', 'Task Description', 'Type', 'Priority', 'Ticket Ref', 'Status'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0', color: '#6b7280', fontSize: 13 }}>
                    No tasks assigned to you yet
                  </td>
                </tr>
              )}
              {tasks.map((t, i) => {
                const isSel = selected?.taskId === t.taskId
                return (
                  <tr
                    key={t.taskId + i}
                    onClick={() => setSelected(isSel ? null : t)}
                    style={{
                      background: isSel ? 'rgba(99,102,241,.12)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)',
                      cursor: 'pointer',
                      borderLeft: isSel ? '3px solid #6366f1' : '3px solid transparent',
                    }}
                  >
                    <td style={tdStyle}><span style={{ fontWeight: 600, color: '#6366f1' }}>{t.taskId}</span></td>
                    <td style={tdStyle}>{t.module}</td>
                    <td style={{ ...tdStyle, textAlign: 'left', maxWidth: 300 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {t.description}
                      </span>
                    </td>
                    <td style={tdStyle}>{t.type}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        background: `${PRIORITY_COLOR[t.priority] || '#6b7280'}22`,
                        color: PRIORITY_COLOR[t.priority] || '#6b7280',
                      }}>{t.priority}</span>
                    </td>
                    <td style={tdStyle}>{t.ticketRef || '—'}</td>
                    <td style={tdStyle}>
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
        <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned
        </div>
      </div>

      {/* ── Right: Detail Panel ── */}
      {selected && (
        <div style={{
          width: 300, flexShrink: 0, background: 'var(--card-bg, #1e2435)',
          borderRadius: 12, border: '1px solid var(--border, #2a3145)',
          padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Task Details</span>
            <button onClick={() => setSelected(null)} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              ['Task ID',    selected.taskId,      '#6366f1'],
              ['Module',     selected.module,      null],
              ['Type',       selected.type,        null],
              ['Priority',   selected.priority,    PRIORITY_COLOR[selected.priority]],
              ['Ticket Ref', selected.ticketRef || '—', null],
              ['Status',     selected.status,      STATUS_COLOR[selected.status]],
            ].map(([lbl, val, col]) => (
              <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: '#9ca3af' }}>{lbl}</span>
                <span style={{ fontWeight: 600, color: col || 'inherit' }}>{val}</span>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 6 }}>Description</div>
            <div style={{
              fontSize: 13, lineHeight: 1.6, padding: '10px 12px',
              background: 'rgba(255,255,255,.04)', borderRadius: 8,
            }}>{selected.description || '—'}</div>
          </div>
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
