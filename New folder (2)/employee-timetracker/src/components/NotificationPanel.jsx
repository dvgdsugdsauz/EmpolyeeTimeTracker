import { formatTime12 } from '../utils/timeUtils'

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}

function MissPunchCard({ n, onApprove, onDismiss }) {
  return (
    <div className={`notif-item notif-miss-punch ${n.read ? 'notif-read' : ''}`}>
      {!n.read && <div className="notif-unread-bar" />}
      <div className="notif-mp-header">
        <div className="notif-mp-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div>
          <div className="notif-mp-title">⚠ MISS PUNCH ALERT</div>
          <div className="notif-mp-time">{timeAgo(n.time)}</div>
        </div>
      </div>

      <div className="notif-mp-body">
        <div className="notif-mp-row">
          <span className="notif-mp-label">Employee</span>
          <span className="notif-mp-value">{n.employeeName}</span>
        </div>
        <div className="notif-mp-row">
          <span className="notif-mp-label">Employee ID</span>
          <span className="notif-mp-value">{n.employeeId}</span>
        </div>
        <div className="notif-mp-row">
          <span className="notif-mp-label">Outside Since</span>
          <span className="notif-mp-value notif-mp-duration">{n.message}</span>
        </div>
      </div>

      {!n.resolved && (
        <div className="notif-actions">
          <button className="btn-approve-offline" onClick={() => onApprove(n)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Approve Offline
          </button>
          <button className="btn-mark-read" onClick={() => onDismiss(n.id)}>
            Dismiss
          </button>
        </div>
      )}
      {n.resolved && (
        <div style={{ marginTop: 8 }}>
          <span className="ta-approved-badge">APPROVED — OFFLINE</span>
        </div>
      )}
    </div>
  )
}

function GenericCard({ n, onDismiss }) {
  const isLate = n.type === 'LATE_ENTRY' || n.type === 'VERY_LATE'
  const color  = n.type === 'VERY_LATE' ? '#ef4444' : '#f97316'
  const bg     = n.type === 'VERY_LATE' ? '#fee2e2' : '#ffedd5'
  const label  = n.type === 'VERY_LATE' ? 'VERY LATE' : n.type.replace('_', ' ')

  return (
    <div className={`notif-item ${n.read ? 'notif-read' : ''}`}>
      {!n.read && <div className="notif-unread-bar" style={{ background: color }} />}
      <div className="notif-item-icon" style={{ color }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </div>
      <div className="notif-item-body">
        <div className="notif-item-top">
          <span className="notif-type-badge" style={{ background: bg, color }}>{label}</span>
          <span className="notif-time">{timeAgo(n.time)}</span>
        </div>
        <p className="notif-employee"><strong>{n.employeeName}</strong> &nbsp;·&nbsp; {n.employeeId}</p>
        <p className="notif-message">{n.message}</p>
        {!n.read && (
          <button className="btn-mark-read" style={{ marginTop: 6 }} onClick={() => onDismiss(n.id)}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}

export default function NotificationPanel({ notifications, onClose, onMarkRead, onApproveOffline, onClearAll }) {
  const unread = notifications.filter(n => !n.read && !n.resolved).length

  return (
    <div className="notif-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="notif-panel">

        {/* Header */}
        <div className="notif-header">
          <div>
            <h3>Notifications</h3>
            {unread > 0 && <span className="notif-count">{unread} unread</span>}
          </div>
          <div className="notif-header-actions">
            {unread > 0 && (
              <button className="btn-mark-all"
                onClick={() => notifications.forEach(n => !n.read && onMarkRead(n.id))}>
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button className="btn-mark-all" style={{ color: '#ef4444', borderColor: '#fecaca', background: '#fff5f5' }}
                onClick={onClearAll}>
                Clear all
              </button>
            )}
            <button className="notif-close" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* List */}
        <div className="notif-list">
          {notifications.length === 0 ? (
            <div className="notif-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <p>No notifications</p>
            </div>
          ) : (
            notifications.map(n =>
              n.type === 'MISS_PUNCH'
                ? <MissPunchCard key={n.id} n={n} onApprove={onApproveOffline} onDismiss={onMarkRead} />
                : <GenericCard   key={n.id} n={n} onDismiss={onMarkRead} />
            )
          )}
        </div>

      </div>
    </div>
  )
}
