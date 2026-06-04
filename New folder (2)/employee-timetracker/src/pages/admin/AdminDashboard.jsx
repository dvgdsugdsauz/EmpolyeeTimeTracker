import { useState, useEffect, useMemo } from 'react'
import { STATUS_META, getLiveWorkTotal } from '../../utils/attendanceLogic'
import { formatDuration, formatTime12 } from '../../utils/timeUtils'
import * as api from '../../services/api'

const BAR_H = 150

function AttendanceChart({ data }) {
  const [hovered, setHovered] = useState(null)
  const chartData = data && data.length > 0 ? data : []
  const maxVal    = Math.max(...chartData.map(d => (d.present || 0) + (d.overtime || 0)), 10)

  return (
    <div className="chart-wrap">
      <div className="chart-header">
        <div className="chart-title-row">
          <h3>Attendance Overview — Last 14 Days</h3>
          <div className="chart-legend">
            <span className="legend-dot legend-present" />Present
            <span className="legend-dot legend-ot" />Overtime
          </div>
        </div>
      </div>

      <div className="chart-body" style={{ height: BAR_H + 28 }}>
        {chartData.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', color: '#94a3b8', fontSize: 13 }}>
            Loading chart data...
          </div>
        ) : chartData.map((d, i) => {
          const total    = (d.present || 0) + (d.overtime || 0)
          const presentH = Math.round(((d.present  || 0) / maxVal) * BAR_H)
          const otH      = Math.round(((d.overtime || 0) / maxVal) * BAR_H)
          const isHov    = hovered === i

          return (
            <div
              key={i}
              className="chart-bar-col"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip — only for hovered bar */}
              {isHov && (
                <div className="chart-tooltip">
                  <div className="chart-tooltip-label">{d.label}</div>
                  <div className="chart-tooltip-row">
                    <span className="ct-dot ct-present" />Present:&nbsp;<strong>{d.present}</strong>
                  </div>
                  {d.overtime > 0 && (
                    <div className="chart-tooltip-row">
                      <span className="ct-dot ct-ot" />OT:&nbsp;<strong>{d.overtime}</strong>
                    </div>
                  )}
                  {d.isWeekend && (
                    <div className="chart-tooltip-row" style={{ color: '#94a3b8' }}>Weekend</div>
                  )}
                </div>
              )}

              {/* Bar area */}
              <div className="chart-bar-track" style={{ height: BAR_H }}>
                {total > 0 ? (
                  <div
                    className="chart-bar-stack"
                    style={{
                      height: presentH + otH,
                      transformOrigin: 'bottom',
                      animation: `growUp 0.6s cubic-bezier(.22,.61,.36,1) ${i * 0.04}s both`,
                    }}
                  >
                    {d.overtime > 0 && (
                      <div
                        style={{
                          height: otH,
                          background: '#475569',
                          width: '100%',
                          borderRadius: '4px 4px 0 0',
                        }}
                      />
                    )}
                    <div
                      style={{
                        height: presentH,
                        background: '#1e293b',
                        width: '100%',
                        borderRadius: d.overtime > 0 ? 0 : '4px 4px 0 0',
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ height: 4, background: '#e2e8f0', width: '70%', borderRadius: 4 }} />
                )}
              </div>

              <div className="chart-bar-label">{d.label.split(' ')[0]}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function AdminDashboard({ users, attendance, onNavigate, devices = [], onToggleDevice, chartData = [] }) {
  const [now, setNow]             = useState(Date.now())
  const [rebuilding, setRebuilding] = useState(false)
  const [rebuildMsg, setRebuildMsg] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  async function handleRebuild() {
    setRebuilding(true)
    setRebuildMsg(null)
    try {
      const res = await api.rebuildData()
      setRebuildMsg({ ok: true, text: `Done — ${res.historical} · ${res.live}` })
    } catch (e) {
      setRebuildMsg({ ok: false, text: e.message })
    } finally {
      setRebuilding(false)
    }
  }

  const employees = useMemo(() => users.filter(u => u.role === 'employee'), [users])
  const attMap    = useMemo(() => Object.fromEntries(attendance.map(a => [a.employeeId, a])), [attendance])

  const counts = useMemo(() => ({
    total:      employees.length,
    working:    attendance.filter(a => a.status === 'WORKING').length,
    outside:    attendance.filter(a => ['BREAK','LUNCH'].includes(a.status)).length,
    miss:       attendance.filter(a => a.status === 'MISS_PUNCH').length,
    notArrived: attendance.filter(a => a.status === 'NOT_ARRIVED').length,
    offline:    attendance.filter(a => a.status === 'OFFLINE').length,
  }), [employees, attendance])

  const presentPct = Math.round(((counts.total - counts.notArrived) / counts.total) * 100)

  const STAT_CARDS = [
    { label: 'Total Employees', value: counts.total,      color: '#4f46e5' },
    { label: 'Working Now',     value: counts.working,    color: '#16a34a' },
    { label: 'Outside',         value: counts.outside,    color: '#f97316' },
    { label: 'Miss Punch',      value: counts.miss,       color: '#ef4444' },
    { label: 'Not Arrived',     value: counts.notArrived, color: '#6b7280' },
    { label: 'Presence Rate',   value: `${presentPct}%`,  color: '#0891b2' },
  ]

  return (
    <div className="page-content">

      {/* Stat cards */}
      <div className="admin-stats-grid">
        {STAT_CARDS.map(s => (
          <div key={s.label} className="admin-stat-card">
            <div className="admin-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="admin-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-row">
        <button className="quick-action-btn" onClick={() => onNavigate('employees')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Manage Employees
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate('devices')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
            <rect x="9" y="9" width="6" height="6"/>
            <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
            <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
            <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
            <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
          </svg>
          Biometric Devices
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate('live')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          Live Monitor
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate('reports')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Reports &amp; Export
        </button>
        <button
          className="quick-action-btn"
          onClick={handleRebuild}
          disabled={rebuilding}
          style={{ opacity: rebuilding ? 0.6 : 1 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {rebuilding ? 'Rebuilding…' : 'Rebuild Data'}
        </button>
      </div>

      {/* Rebuild result message */}
      {rebuildMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, fontSize: 13,
          background: rebuildMsg.ok ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${rebuildMsg.ok ? '#bbf7d0' : '#fecaca'}`,
          color: rebuildMsg.ok ? '#16a34a' : '#dc2626',
        }}>
          {rebuildMsg.text}
        </div>
      )}

      {/* Biometric Devices */}
      <div className="section-card">
        <div className="section-header">
          <div className="section-header-left">
            <h3>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, display: 'inline', marginRight: 6, verticalAlign: 'middle' }}>
                <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
                <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
                <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
                <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
                <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
              </svg>
              Biometric Devices
            </h3>
            <span className="section-count">{devices.length} configured</span>
          </div>
          <button className="quick-action-btn" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => onNavigate('devices')}>
            Manage Devices
          </button>
        </div>
        <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {devices.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '8px 0' }}>No devices configured.</p>
          ) : devices.map(dev => (
            <div key={dev.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderRadius: 10,
              background: dev.status === 'ONLINE' ? '#f0fdf4' : '#f9fafb',
              border: `1.5px solid ${dev.status === 'ONLINE' ? '#bbf7d0' : '#e5e7eb'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: dev.status === 'ONLINE' ? '#22c55e' : '#9ca3af',
                  boxShadow: dev.status === 'ONLINE' ? '0 0 0 3px rgba(34,197,94,0.2)' : 'none',
                }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{dev.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dev.location} &nbsp;·&nbsp; {dev.ip}:{dev.port}</div>
                </div>
              </div>
              <button
                onClick={() => onToggleDevice(dev.id)}
                style={{
                  padding: '6px 18px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: 'none',
                  background: dev.status === 'ONLINE' ? '#fee2e2' : '#1e293b',
                  color: dev.status === 'ONLINE' ? '#dc2626' : '#fff',
                  transition: 'background 0.2s',
                }}
              >
                {dev.status === 'ONLINE' ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bar Chart */}
      <div className="section-card">
        <AttendanceChart data={chartData} />
      </div>

      {/* Live Table */}
      <div className="section-card">
        <div className="section-header">
          <h3>Live Attendance — Today</h3>
          <span className="section-count">{employees.length} employees</span>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Status</th>
                <th>Entry</th>
                <th>Last Punch</th>
                <th>Work Time</th>
                <th>Late</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const att = attMap[emp.id]
                const meta = STATUS_META[att?.status] || STATUS_META.NOT_ARRIVED
                const workMs = att ? getLiveWorkTotal(att, now) : 0
                return (
                  <tr key={emp.id}>
                    <td>
                      <div className="table-emp-cell">
                        <div className="table-avatar">{emp.avatar}</div>
                        <div>
                          <div className="table-emp-name">{emp.name}</div>
                          <div className="table-emp-id">{emp.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>{emp.dept}</td>
                    <td>
                      <div className="status-dot-badge" style={{ background: meta.bg, color: meta.color }}>
                        <span className="sdot" style={{ background: meta.dot }}/>
                        {meta.label}
                      </div>
                    </td>
                    <td>{formatTime12(att?.entryTime)}</td>
                    <td>
                      {att?.status === 'WORKING'
                        ? formatTime12(att?.lastPunchIn)
                        : formatTime12(att?.lastPunchOut)}
                    </td>
                    <td>{formatDuration(workMs)}</td>
                    <td>
                      {att?.lateStatus && (att.lateStatus === 'LATE' || att.lateStatus === 'VERY_LATE') && (
                        <span className="late-tag" style={{
                          color: att.lateStatus === 'LATE' ? '#f97316' : '#ef4444',
                          background: att.lateStatus === 'LATE' ? '#ffedd5' : '#fee2e2',
                        }}>
                          {att.lateStatus === 'LATE' ? 'Late' : 'Very Late'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
