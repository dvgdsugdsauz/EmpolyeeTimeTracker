import { useState, useRef, useEffect } from 'react'
import * as api from '../services/api'

function ChangePasswordModal({ onClose }) {
  const [current, setCurrent]   = useState('')
  const [next, setNext]         = useState('')
  const [confirm, setConfirm]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (next.length < 6)        { setError('New password must be at least 6 characters'); return }
    if (next !== confirm)       { setError('Passwords do not match'); return }
    if (!current.trim())        { setError('Current password is required'); return }
    setSaving(true)
    try {
      await api.changeMyPassword(current, next)
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (e) {
      setError(e.message || 'Failed to change password')
    }
    setSaving(false)
  }

  const inp = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    border: '1px solid #e2e8f0', fontSize: 14, outline: 'none',
    background: '#f8fafc', boxSizing: 'border-box',
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      backdropFilter: 'blur(3px)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400,
        margin: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#0f172a',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Change Password</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#94a3b8',
            fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        <form onSubmit={submit} style={{ padding: '24px' }}>
          {success ? (
            <div style={{
              textAlign: 'center', padding: '24px 0',
              color: '#16a34a', fontSize: 15, fontWeight: 600,
            }}>
              ✓ Password changed successfully!
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>
                  Current Password
                </label>
                <input type="password" value={current} onChange={e => setCurrent(e.target.value)}
                  placeholder="Enter current password" style={inp} autoFocus />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>
                  New Password
                </label>
                <input type="password" value={next} onChange={e => setNext(e.target.value)}
                  placeholder="Min 6 characters" style={inp} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>
                  Confirm New Password
                </label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter new password" style={inp} />
              </div>

              {error && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                  padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626',
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={onClose} disabled={saving} style={{
                  padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0',
                  background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 14,
                }}>Cancel</button>
                <button type="submit" disabled={saving} style={{
                  padding: '10px 22px', borderRadius: 8, border: 'none',
                  background: '#0f172a', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1,
                }}>
                  {saving ? 'Saving…' : 'Update Password'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

export default function TopBar({ user, pageTitle, unreadCount, onBellClick, onLogout }) {
  const initials   = user.avatar || user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const [open, setOpen]         = useState(false)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const cardRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (cardRef.current && !cardRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <>
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

          {/* Profile area — click to open card */}
          <div ref={cardRef} style={{ position: 'relative' }}>
            <div
              className="topbar-user"
              onClick={() => setOpen(o => !o)}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <div className="topbar-avatar">{initials}</div>
              <div className="topbar-user-info">
                <span className="topbar-user-name">{user.name}</span>
                <span className="topbar-user-role">{user.dept}</span>
              </div>
              <button className="btn-topbar-logout" onClick={e => { e.stopPropagation(); onLogout() }} title="Logout">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>

            {/* Profile dropdown card */}
            {open && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                background: '#fff', borderRadius: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                border: '1px solid #e2e8f0',
                minWidth: 240, zIndex: 1500, overflow: 'hidden',
              }}>
                {/* Avatar + name strip */}
                <div style={{
                  background: '#0f172a', padding: '18px 20px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>{initials}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{user.name}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                      {user.designation || user.dept || ''}
                    </div>
                  </div>
                </div>

                {/* Info rows */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9' }}>
                  {user.id && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>Employee ID</span>
                      <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 700 }}>{user.id}</span>
                    </div>
                  )}
                  {user.email && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>Email</span>
                      <span style={{ fontSize: 12, color: '#475569', fontWeight: 500, maxWidth: 140, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{user.email}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ padding: '8px 0' }}>
                  <button
                    onClick={() => { setOpen(false); setShowChangePwd(true) }}
                    style={{
                      width: '100%', padding: '10px 20px', background: 'none',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontSize: 13, color: '#374151', fontWeight: 500,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontSize: 16 }}>🔑</span> Change Password
                  </button>
                  <button
                    onClick={() => { setOpen(false); onLogout() }}
                    style={{
                      width: '100%', padding: '10px 20px', background: 'none',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontSize: 13, color: '#dc2626', fontWeight: 500,
                      display: 'flex', alignItems: 'center', gap: 10,
                      borderTop: '1px solid #f1f5f9',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontSize: 16 }}>↪</span> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </>
  )
}
