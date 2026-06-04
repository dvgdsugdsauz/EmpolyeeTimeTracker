import { useState, useEffect } from 'react'
import { STATUS_META, getLateLabel, getLiveWorkTotal, getLiveOutsideTotal, getPendingMs } from '../../utils/attendanceLogic'
import { formatDurationHHMMSS, formatDuration, formatTime12, formatDateLabel } from '../../utils/timeUtils'
import * as api from '../../services/api'

const USE_API = Boolean(import.meta.env.VITE_API_URL)

function TimerCard({ label, value, accent, icon }) {
  return (
    <div className={`timer-card ${accent ? 'timer-card-accent' : ''}`}>
      <div className="timer-card-icon">{icon}</div>
      <div className="timer-card-value">{value}</div>
      <div className="timer-card-label">{label}</div>
    </div>
  )
}

export default function EmployeeDashboard({ user, attendance }) {
  const [now, setNow] = useState(Date.now())
  const [history, setHistory] = useState([])
  const [todayPunches, setTodayPunches] = useState([])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!USE_API) return
    api.fetchMyHistory(7).then(setHistory).catch(() => {})
    api.fetchTodayPunches().then(setTodayPunches).catch(() => {})
  }, [])

  // Refresh punch log when attendance status changes (new punch arrived)
  useEffect(() => {
    if (!USE_API || !attendance) return
    api.fetchTodayPunches().then(setTodayPunches).catch(() => {})
  }, [attendance?.status, attendance?.lastPunchIn?.toString(), attendance?.lastPunchOut?.toString()])

  if (!attendance) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <p>No attendance data found.</p>
        </div>
      </div>
    )
  }

  const meta = STATUS_META[attendance.status] || STATUS_META.NOT_ARRIVED
  const lateInfo = attendance.lateStatus ? getLateLabel(attendance.lateStatus) : null

  const workMs = getLiveWorkTotal(attendance, now)
  const { break: breakMs, lunch: lunchMs } = getLiveOutsideTotal(attendance, now)
  const pendingMs = getPendingMs(attendance, now)

  const outsideMs = attendance.lastPunchOut && attendance.status !== 'WORKING' && attendance.status !== 'NOT_ARRIVED'
    ? now - new Date(attendance.lastPunchOut).getTime()
    : 0

  return (
    <div className="page-content">

      {/* Status Hero */}
      <div className="emp-status-hero" style={{ background: meta.bg, borderColor: meta.dot }}>
        <div className="emp-status-left">
          <div className="status-pill" style={{ background: meta.dot }}>
            <span className="status-pulse-dot" style={{ background: meta.dot }}/>
            <span style={{ color: '#fff' }}>{meta.label}</span>
          </div>
          {lateInfo && (
            <div className="late-badge" style={{ background: lateInfo.bg, color: lateInfo.color }}>
              {lateInfo.label}
            </div>
          )}
          <h2 className="emp-welcome">Good day, {user.name.split(' ')[0]}</h2>
          <p className="emp-dept">{user.dept} &nbsp;·&nbsp; {user.id}</p>
        </div>
        <div className="emp-status-right">
          <div className="emp-entry-info">
            <div className="emp-info-row">
              <span className="emp-info-label">First Entry</span>
              <span className="emp-info-value">{formatTime12(attendance.entryTime)}</span>
            </div>
            <div className="emp-info-row">
              <span className="emp-info-label">Last Punch Out</span>
              <span className="emp-info-value">
                {attendance.status === 'WORKING'
                  ? '--'
                  : formatTime12(attendance.lastPunchOut)}
              </span>
            </div>
            {attendance.status !== 'WORKING' && attendance.status !== 'NOT_ARRIVED' && outsideMs > 0 && (
              <div className="emp-info-row">
                <span className="emp-info-label">Outside For</span>
                <span className="emp-info-value" style={{ color: meta.color, fontWeight: 700 }}>
                  {formatDuration(outsideMs)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timer Cards */}
      <div className="timer-cards-row">
        <TimerCard
          label="Working Time"
          value={formatDurationHHMMSS(workMs)}
          accent={attendance.status === 'WORKING'}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          }
        />
        <TimerCard
          label="Break Time"
          value={formatDurationHHMMSS(breakMs)}
          accent={attendance.status === 'BREAK'}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
            </svg>
          }
        />
        <TimerCard
          label="Lunch Time"
          value={formatDurationHHMMSS(lunchMs)}
          accent={attendance.status === 'LUNCH'}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
            </svg>
          }
        />
        <TimerCard
          label="Pending Hours"
          value={formatDurationHHMMSS(pendingMs)}
          accent={false}
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          }
        />
      </div>

      {/* Today's Punch Log */}
      {todayPunches.length > 0 && (
        <div className="section-card">
          <div className="section-header">
            <h3>Today's Punch Log</h3>
            <span className="section-count">{todayPunches.length} events</span>
          </div>
          <div style={{ padding: '8px 20px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {todayPunches.map((p, i) => {
              const isIn = p.state === 'IN'
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px', borderRadius: 8,
                  background: isIn ? '#f0fdf4' : '#fff7ed',
                  border: `1px solid ${isIn ? '#bbf7d0' : '#fed7aa'}`,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: isIn ? '#22c55e' : '#f97316',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                      {isIn
                        ? <><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></>
                        : <><polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>
                      </>}
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: isIn ? '#16a34a' : '#ea580c' }}>
                      {isIn ? 'Punched In' : 'Punched Out'}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                    {formatTime12(p.time)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Weekly History */}
      <div className="section-card">
        <div className="section-header">
          <h3>Last 7 Days</h3>
        </div>
        <div className="history-grid">
          {history.length === 0 && (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>No history found.</p>
          )}
          {history.slice(0, 7).map(h => {
            const dotColor = h.status === 'PRESENT'
              ? (h.lateStatus === 'VERY_LATE' ? '#ef4444' : h.lateStatus === 'LATE' ? '#f97316' : '#22c55e')
              : h.status === 'HOLIDAY' ? '#a78bfa' : '#d1d5db'
            return (
              <div key={h.date} className="history-day-card">
                <div className="history-day-dot" style={{ background: dotColor }}/>
                <div className="history-day-date">{formatDateLabel(h.date)}</div>
                <div className="history-day-status" style={{ color: dotColor }}>
                  {h.status === 'PRESENT' ? formatDuration(h.totalWorkMs) : h.status}
                </div>
                {h.status === 'PRESENT' && h.entryTime && (
                  <div className="history-day-times">
                    {formatTime12(h.entryTime)}{h.exitTime ? ` – ${formatTime12(h.exitTime)}` : ''}
                  </div>
                )}
                {(h.lateStatus === 'LATE' || h.lateStatus === 'VERY_LATE') && (
                  <div className="history-late-tag" style={{ color: h.lateStatus === 'LATE' ? '#f97316' : '#ef4444' }}>
                    {h.lateStatus === 'LATE' ? 'Late' : 'Very Late'}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
