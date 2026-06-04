export default function TopBar({ user, pageTitle, unreadCount, onBellClick, onLogout }) {
  const initials = user.avatar || user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{pageTitle}</h1>
      </div>
      <div className="topbar-right">
        <div className="topbar-refresh-indicator">
          <span className="refresh-dot" title="Live — refreshing every 8s"/>
          <span className="refresh-label">Live</span>
        </div>

        {user.role !== 'employee' && (
          <button className="topbar-bell" onClick={onBellClick} title="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
          </button>
        )}

        <div className="topbar-user">
          <div className="topbar-avatar">{initials}</div>
          <div className="topbar-user-info">
            <span className="topbar-user-name">{user.name}</span>
            <span className="topbar-user-role">{user.dept}</span>
          </div>
          <button className="btn-topbar-logout" onClick={onLogout} title="Logout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
