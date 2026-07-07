import { formatTime12 } from '../../utils/timeUtils'

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}

function formatType(type) {
  if (type === 'MISS_PUNCH')   return 'MISS PUNCH'
  if (type === 'EARLY_LOGOFF') return 'EARLY LOGOFF'
  return (type || '').replace(/_/g, ' ')
}

export default function ApprovalsPage({ notifications, onApproveOffline, onMarkRead, onClearResolved }) {
  const pending  = notifications.filter(n => !n.resolved)
  const resolved = notifications.filter(n => n.resolved)

  return (
    <div className="page-content">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Approvals</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Review and approve attendance alerts
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ padding: '6px 16px', borderRadius: 20, background: '#fee2e2', color: '#dc2626', fontSize: 13, fontWeight: 600 }}>
            {pending.length} Pending
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ padding: '6px 16px', borderRadius: 20, background: '#dcfce7', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
              {resolved.length} Resolved
            </div>
            {resolved.length > 0 && (
              <button
                onClick={onClearResolved}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                  background: '#f1f5f9', color: '#64748b',
                  border: '1px solid #e2e8f0', cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pending Approvals */}
      <div className="section-card">
        <div className="section-header">
          <h3>Pending Approvals</h3>
          <span className="section-count">{pending.length}</span>
        </div>

        {pending.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p>No pending approvals. All clear!</p>
          </div>
        ) : (
          <div style={{ padding: '8px 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pending.map(n => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 16,
                padding: '16px 20px',
                borderRadius: 10,
                background: n.type === 'EARLY_LOGOFF' ? '#fffbeb' : '#fff5f5',
                border: `1.5px solid ${n.type === 'EARLY_LOGOFF' ? '#fde68a' : '#fecaca'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 10,
                    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
                  }}>
                    {n.employeeName?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{n.employeeName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n.employeeId}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Alert</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: n.type === 'EARLY_LOGOFF' ? '#d97706' : '#dc2626' }}>{formatType(n.type)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Details</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: n.type === 'EARLY_LOGOFF' ? '#d97706' : '#dc2626' }}>{n.message}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Time</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{timeAgo(n.time)}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {n.type === 'MISS_PUNCH' && (
                    <button
                      onClick={() => onApproveOffline(n.employeeId)}
                      style={{
                        padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        background: '#1e293b', color: '#fff', border: 'none', cursor: 'pointer',
                      }}
                    >
                      Approve Offline
                    </button>
                  )}
                  <button
                    onClick={() => onMarkRead(n.id)}
                    style={{
                      padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: n.type === 'EARLY_LOGOFF' ? '#1e293b' : '#f1f5f9',
                      color: n.type === 'EARLY_LOGOFF' ? '#fff' : 'var(--text-muted)',
                      border: n.type === 'EARLY_LOGOFF' ? 'none' : '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                  >
                    {n.type === 'EARLY_LOGOFF' ? 'Approve' : 'Dismiss'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <h3>Resolved</h3>
            <span className="section-count">{resolved.length}</span>
          </div>
          <div style={{ padding: '8px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {resolved.map(n => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: 16,
                padding: '14px 20px',
                borderRadius: 10,
                background: '#f0fdf4',
                border: '1.5px solid #bbf7d0',
                opacity: 0.85,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {n.employeeName?.split(' ').map(w => w[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{n.employeeName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.employeeId} · {timeAgo(n.time)}</div>
                  </div>
                </div>
                <span style={{
                  padding: '5px 14px', borderRadius: 6,
                  background: '#16a34a', color: '#fff',
                  fontSize: 12, fontWeight: 700, letterSpacing: '.5px',
                }}>
                  APPROVED
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
