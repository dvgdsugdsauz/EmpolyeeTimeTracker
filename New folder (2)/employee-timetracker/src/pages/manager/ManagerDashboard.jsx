import { useState, useEffect, useMemo } from 'react'
import { STATUS_META, getLiveWorkTotal, getLiveOutsideTotal, getPendingMs } from '../../utils/attendanceLogic'
import { formatTime12, formatDuration, formatDurationHHMMSS } from '../../utils/timeUtils'
import * as api from '../../services/api'

const USE_API = Boolean(import.meta.env.VITE_API_URL)

function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

function todayStr() {
  return toDateStr(new Date())
}

function formatLocalTime(t) {
  if (!t) return null
  const s = Array.isArray(t)
    ? `${String(t[0]).padStart(2,'0')}:${String(t[1]).padStart(2,'0')}`
    : String(t).slice(0, 5)
  const [h, m] = s.split(':')
  const hour = parseInt(h)
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
}

const HIST_STATUS_META = {
  PRESENT:     { label: 'Present',     bg: '#f0fdf4', color: '#16a34a', dot: '#16a34a' },
  WORKING:     { label: 'Present',     bg: '#f0fdf4', color: '#16a34a', dot: '#16a34a' },
  OFFLINE:     { label: 'Left',        bg: '#f8fafc', color: '#64748b', dot: '#94a3b8' },
  ABSENT:      { label: 'Absent',      bg: '#fff1f2', color: '#e11d48', dot: '#e11d48' },
  HOLIDAY:     { label: 'Holiday',     bg: '#eff6ff', color: '#2563eb', dot: '#2563eb' },
  NOT_ARRIVED: { label: 'Not Arrived', bg: '#fafafa', color: '#9ca3af', dot: '#d1d5db' },
  MISS_PUNCH:  { label: 'Miss Punch',  bg: '#fff7ed', color: '#ea580c', dot: '#ea580c' },
}

function getShiftColor(att, now) {
  if (!att) return 'normal'
  if (att.status === 'MISS_PUNCH') return 'danger'
  if (att.status === 'BREAK' || att.status === 'LUNCH') {
    const outside = att.lastPunchOut ? now - new Date(att.lastPunchOut).getTime() : 0
    if (outside > 3600000) return 'warning'
  }
  if (att.lateStatus === 'VERY_LATE') return 'danger'
  if (att.lateStatus === 'LATE') return 'warning'
  return 'normal'
}

export default function ManagerDashboard({ users, attendance, myAttendance, currentUser, onApproveOffline, defaultStatusFilter }) {
  const [search, setSearch]         = useState('')
  const [deptFilter, setDeptFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState(defaultStatusFilter || 'All')
  const [now, setNow]               = useState(Date.now())
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [histData, setHistData]     = useState(null)
  const [histLoading, setHistLoading] = useState(false)

  const isToday = selectedDate === todayStr()

  // 1-second clock for live durations
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Fetch historical data when date changes; reset status filter when toggling today/history
  useEffect(() => {
    setStatusFilter(isToday ? (defaultStatusFilter || 'All') : 'All')
    if (isToday) { setHistData(null); return }
    if (!USE_API) { setHistData([]); return }

    setHistLoading(true)
    api.fetchDailySummary(selectedDate)
      .then(list => setHistData(list))
      .catch(() => setHistData([]))
      .finally(() => setHistLoading(false))
  }, [selectedDate])

  const goBack = () => {
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setSelectedDate(toDateStr(d))
  }

  const goForward = () => {
    if (isToday) return
    const d = new Date(selectedDate + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    setSelectedDate(toDateStr(d))
  }

  const displayDate = new Date(selectedDate + 'T12:00:00')
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: isToday ? undefined : 'numeric' })

  const employees   = useMemo(() => users.filter(u => u.role === 'employee'), [users])
  const attMap      = useMemo(() => Object.fromEntries(attendance.map(a => [a.employeeId, a])), [attendance])
  const departments = useMemo(() => ['All', ...new Set(employees.map(e => e.dept))], [employees])

  // For historical view: build a map empId → summaryDto
  const histMap = useMemo(() => {
    if (!histData) return {}
    return Object.fromEntries(histData.map(s => [s.employeeId, s]))
  }, [histData])

  const filtered = useMemo(() => employees.filter(emp => {
    const att = isToday ? attMap[emp.id] : histMap[emp.id]
    const matchSearch = !search || emp.name.toLowerCase().includes(search.toLowerCase()) || emp.id.toLowerCase().includes(search.toLowerCase())
    const matchDept   = deptFilter === 'All' || emp.dept === deptFilter
    const curStatus   = isToday ? att?.status : (histMap[emp.id]?.status || 'ABSENT')
    const matchStatus = statusFilter === 'All' || curStatus === statusFilter
    return matchSearch && matchDept && matchStatus
  }), [employees, attMap, histMap, search, deptFilter, statusFilter, isToday])

  const counts = useMemo(() => {
    if (!isToday) {
      return {
        total:      employees.length,
        working:    Object.values(histMap).filter(s => ['PRESENT','OFFLINE'].includes(s.status)).length,
        outside:    0,
        miss:       0,
        notArrived: Object.values(histMap).filter(s => s.status === 'ABSENT').length,
      }
    }
    const empIds    = new Set(employees.map(e => e.id))
    const empAtt    = attendance.filter(a => empIds.has(a.employeeId))
    const arrivedIds = new Set(empAtt.filter(a => a.status !== 'NOT_ARRIVED').map(a => a.employeeId))
    return {
      total:      employees.length,
      working:    empAtt.filter(a => a.status === 'WORKING').length,
      outside:    empAtt.filter(a => ['BREAK','LUNCH'].includes(a.status)).length,
      miss:       empAtt.filter(a => a.status === 'MISS_PUNCH').length,
      notArrived: employees.length - arrivedIds.size,
    }
  }, [employees, attendance, attMap, histMap, isToday])

  const myMeta      = STATUS_META[myAttendance?.status] || STATUS_META.NOT_ARRIVED
  const myWorkMs    = myAttendance ? getLiveWorkTotal(myAttendance, now) : 0
  const { break: myBreakMs, lunch: myLunchMs } = myAttendance ? getLiveOutsideTotal(myAttendance, now) : { break: 0, lunch: 0 }
  const myPendingMs = myAttendance ? getPendingMs(myAttendance, now) : 0

  return (
    <div className="page-content ta-page">

      {/* Manager Own Status Bar */}
      {currentUser && (
        <div className="mgr-status-bar" style={{
          display: 'flex', alignItems: 'center', gap: 0,
          background: myMeta.bg, border: `1.5px solid ${myMeta.dot}22`,
          borderRadius: 14, padding: '12px 20px', marginBottom: 18,
          flexWrap: 'wrap', rowGap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 0 auto', marginRight: 24 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: '#1e293b',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
            }}>{currentUser.avatar || currentUser.name?.slice(0,2).toUpperCase()}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', lineHeight: 1.3 }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>My Attendance</div>
            </div>
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: myMeta.dot, color: '#fff', borderRadius: 20,
            padding: '4px 12px', fontSize: 12, fontWeight: 700,
            marginRight: 20, flexShrink: 0,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.8)',
              display: 'inline-block',
              animation: myAttendance?.status === 'WORKING' ? 'pulse 1.5s infinite' : 'none',
            }}/>
            {myMeta.label}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 1 }}>Entry</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                {myAttendance?.entryTime ? formatTime12(myAttendance.entryTime) : '—'}
              </div>
            </div>
            <div style={{ width: 1, height: 30, background: '#e2e8f0' }}/>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 1 }}>Working</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: myWorkMs > 0 ? '#16a34a' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                {formatDurationHHMMSS(myWorkMs)}
              </div>
            </div>
            <div style={{ width: 1, height: 30, background: '#e2e8f0' }}/>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 1 }}>Break</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: myBreakMs > 0 ? '#f97316' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                {myBreakMs > 0 ? formatDuration(myBreakMs) : '—'}
              </div>
            </div>
            <div style={{ width: 1, height: 30, background: '#e2e8f0' }}/>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 1 }}>Lunch</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: myLunchMs > 0 ? '#8b5cf6' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                {myLunchMs > 0 ? formatDuration(myLunchMs) : '—'}
              </div>
            </div>
            <div style={{ width: 1, height: 30, background: '#e2e8f0' }}/>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 1 }}>Pending</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: myPendingMs > 0 ? '#ef4444' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                {formatDurationHHMMSS(myPendingMs)}
              </div>
            </div>
            {myAttendance?.lateStatus && (myAttendance.lateStatus === 'LATE' || myAttendance.lateStatus === 'VERY_LATE') && (
              <>
                <div style={{ width: 1, height: 30, background: '#e2e8f0' }}/>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  color: myAttendance.lateStatus === 'LATE' ? '#f97316' : '#ef4444',
                  background: myAttendance.lateStatus === 'LATE' ? '#ffedd5' : '#fee2e2',
                }}>
                  {myAttendance.lateStatus === 'LATE' ? 'Late' : 'Very Late'}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="ta-header">
        <div className="ta-header-left">
          <h2 className="ta-title">Time &amp; Attendance</h2>
          <div className="ta-date-nav">
            <button className="ta-nav-btn" onClick={goBack}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="ta-date-label" style={{ minWidth: 90, textAlign: 'center' }}>
              {isToday ? `Today, ${displayDate}` : displayDate}
            </span>
            <button className="ta-nav-btn" onClick={goForward}
              style={{ opacity: isToday ? 0.3 : 1, cursor: isToday ? 'default' : 'pointer' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <div className="ta-filters">
            <select className="ta-filter-select" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              {departments.map(d => <option key={d}>{d}</option>)}
            </select>
            <select className="ta-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Status</option>
              {isToday ? <>
                <option value="WORKING">Working</option>
                <option value="BREAK">Break</option>
                <option value="LUNCH">Lunch</option>
                <option value="MISS_PUNCH">Miss Punch</option>
                <option value="NOT_ARRIVED">Not Arrived</option>
                <option value="OFFLINE">Offline</option>
              </> : <>
                <option value="PRESENT">Present</option>
                <option value="OFFLINE">Left Early</option>
                <option value="ABSENT">Absent</option>
                <option value="HOLIDAY">Holiday</option>
              </>}
            </select>
          </div>
        </div>
        <div className="ta-header-right">
          <input
            className="ta-search"
            placeholder="Search employees..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Summary chips */}
      <div className="ta-summary-chips">
        <div className="ta-chip ta-chip-total"><span>{counts.total}</span> Total</div>
        <div className="ta-chip ta-chip-working"><span>{counts.working}</span> {isToday ? 'Working' : 'Present'}</div>
        {isToday && <><div className="ta-chip ta-chip-outside"><span>{counts.outside}</span> Outside</div>
        <div className="ta-chip ta-chip-miss"><span>{counts.miss}</span> Miss Punch</div></>}
        <div className="ta-chip ta-chip-away"><span>{counts.notArrived}</span> {isToday ? 'Not Arrived' : 'Absent'}</div>
      </div>

      {/* Table */}
      <div className="section-card">
        {histLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
            Loading attendance for {displayDate}...
          </div>
        ) : (
          <div className="table-scroll">
            <table className="ta-table">
              <thead>
                <tr>
                  <th style={{width:220}}>Employee</th>
                  <th>ID</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Presence</th>
                  <th>Break</th>
                  <th>Lunch</th>
                  <th>Work Duration</th>
                  <th>Status</th>
                  <th>Late</th>
                  {isToday && <th>Outside For</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => {
                  if (!isToday) {
                    // Historical row
                    const s    = histMap[emp.id]
                    const meta = HIST_STATUS_META[s?.status] || HIST_STATUS_META.ABSENT
                    return (
                      <tr key={emp.id} className="ta-row ta-row-normal">
                        <td>
                          <div className="ta-emp-cell">
                            <div className="ta-avatar">{emp.avatar}</div>
                            <div>
                              <div className="ta-emp-name">{emp.name}</div>
                              {emp.designation && <div style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>{emp.designation}</div>}
                              <div className="ta-emp-dept">{emp.dept}</div>
                            </div>
                          </div>
                        </td>
                        <td><span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{emp.id}</span></td>
                        <td>{s?.entryTime ? <div className="ta-time-box ta-time-normal">{formatLocalTime(s.entryTime)}</div> : <span className="ta-dash">—</span>}</td>
                        <td>{s?.exitTime  ? <div className="ta-time-box ta-time-normal">{formatLocalTime(s.exitTime)}</div>  : <span className="ta-dash">—</span>}</td>
                        <td><span className="ta-duration-text">{(() => {
                          if (!s?.entryTime || !s?.exitTime) return '—'
                          const et = Array.isArray(s.entryTime) ? s.entryTime[0]*60+s.entryTime[1] : parseInt(String(s.entryTime).slice(0,2))*60+parseInt(String(s.entryTime).slice(3,5))
                          const xt = Array.isArray(s.exitTime)  ? s.exitTime[0]*60+s.exitTime[1]   : parseInt(String(s.exitTime).slice(0,2))*60+parseInt(String(s.exitTime).slice(3,5))
                          const m = xt - et
                          return m > 0 ? `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m` : '—'
                        })()}</span></td>
                        <td><span className="ta-duration-text">{s?.totalBreakMs > 0 ? formatDuration(s.totalBreakMs) : '—'}</span></td>
                        <td><span className="ta-duration-text">{s?.totalLunchMs > 0 ? formatDuration(s.totalLunchMs) : '—'}</span></td>
                        <td><span className={`ta-shift-duration ${s?.totalWorkMs > 8*3600000 ? 'ta-shift-ot' : s?.totalWorkMs > 0 ? 'ta-shift-ok' : ''}`}>{s?.totalWorkMs > 0 ? formatDuration(s.totalWorkMs) : '—'}</span></td>
                        <td><div className="status-dot-badge" style={{ background: meta.bg, color: meta.color }}><span className="sdot" style={{ background: meta.dot }}/>{meta.label}</div></td>
                        <td>
                          {s?.lateStatus && (s.lateStatus === 'LATE' || s.lateStatus === 'VERY_LATE')
                            ? <span className="late-tag" style={{ color: s.lateStatus === 'LATE' ? '#f97316' : '#ef4444', background: s.lateStatus === 'LATE' ? '#ffedd5' : '#fee2e2' }}>{s.lateStatus === 'LATE' ? 'Late' : 'Very Late'}</span>
                            : s?.entryTime ? <span className="ta-ontime">On Time</span> : <span className="ta-dash">—</span>}
                        </td>
                      </tr>
                    )
                  }

                  // Live row
                  const att      = attMap[emp.id]
                  const meta     = STATUS_META[att?.status] || STATUS_META.NOT_ARRIVED
                  const workMs   = att ? getLiveWorkTotal(att, now) : 0
                  const { break: breakMs, lunch: lunchMs } = att ? getLiveOutsideTotal(att, now) : { break: 0, lunch: 0 }
                  const outsideMs = att?.lastPunchOut && att.status !== 'WORKING' && att.status !== 'NOT_ARRIVED'
                    ? now - new Date(att.lastPunchOut).getTime() : 0
                  const shade = getShiftColor(att, now)

                  return (
                    <tr key={emp.id} className={`ta-row ta-row-${shade}`}>
                      <td>
                        <div className="ta-emp-cell">
                          <div className="ta-avatar">{emp.avatar}</div>
                          <div>
                            <div className="ta-emp-name">{emp.name}</div>
                            {emp.designation && <div style={{ fontSize: 11, color: '#475569', fontWeight: 500 }}>{emp.designation}</div>}
                            <div className="ta-emp-dept">{emp.dept}</div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{emp.id}</span></td>
                      <td>
                        {att?.entryTime ? <div className={`ta-time-box ta-time-${shade}`}>{formatTime12(att.entryTime)}</div> : <span className="ta-dash">—</span>}
                      </td>
                      <td>
                        {att?.lastPunchOut
                          ? <div className={`ta-time-box ta-time-${att.status === 'WORKING' ? 'normal' : shade}`}>{formatTime12(att.lastPunchOut)}</div>
                          : att?.status === 'WORKING' ? <span className="ta-live-pill">Live</span> : <span className="ta-dash">—</span>}
                      </td>
                      <td><span className="ta-duration-text">{att?.entryTime ? formatDuration(now - new Date(att.entryTime).getTime()) : '—'}</span></td>
                      <td><span className="ta-duration-text">{breakMs > 0 ? formatDuration(breakMs) : '—'}</span></td>
                      <td><span className="ta-duration-text">{lunchMs > 0 ? formatDuration(lunchMs) : '—'}</span></td>
                      <td><span className={`ta-shift-duration ${workMs > 8*3600000 ? 'ta-shift-ot' : workMs > 0 ? 'ta-shift-ok' : ''}`}>{workMs > 0 ? formatDuration(workMs) : '—'}</span></td>
                      <td><div className="status-dot-badge" style={{ background: meta.bg, color: meta.color }}><span className="sdot" style={{ background: meta.dot }}/>{meta.label}</div></td>
                      <td>
                        {att?.lateStatus && (att.lateStatus === 'LATE' || att.lateStatus === 'VERY_LATE')
                          ? <span className="late-tag" style={{ color: att.lateStatus === 'LATE' ? '#f97316' : '#ef4444', background: att.lateStatus === 'LATE' ? '#ffedd5' : '#fee2e2' }}>{att.lateStatus === 'LATE' ? 'Late' : 'Very Late'}</span>
                          : att?.entryTime ? <span className="ta-ontime">On Time</span> : <span className="ta-dash">—</span>}
                      </td>
                      <td>
                        {outsideMs > 0
                          ? <span style={{ color: meta.color, fontWeight: 600, fontSize: 13 }}>{formatDuration(outsideMs)}</span>
                          : <span className="ta-dash">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
