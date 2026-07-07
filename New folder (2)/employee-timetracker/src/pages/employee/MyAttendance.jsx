import { useState, useEffect } from 'react'
import { generateHistory } from '../../data/mockData'
import { formatDuration, formatDateLabel } from '../../utils/timeUtils'
import { workStatus } from '../../utils/attendanceLogic'
import * as api from '../../services/api'

const USE_API = Boolean(import.meta.env.VITE_API_URL)
// Employee can view only last 1 month of their own data

function timeStr(t) {
  if (!t) return null
  if (Array.isArray(t)) return `${String(t[0]).padStart(2,'0')}:${String(t[1]).padStart(2,'0')}`
  return String(t).slice(0, 5)
}

function mapDto(s) {
  const raw = s.status || 'ABSENT'
  const status = (raw === 'OFFLINE' && s.entryTime) ? 'PRESENT' : raw
  return {
    date:           s.date,
    status,
    entryTime:      timeStr(s.entryTime),
    exitTime:       timeStr(s.exitTime),
    workTotal:      s.totalWorkMs  || 0,
    breakTotal:     s.totalBreakMs || 0,
    lunchTotal:     s.totalLunchMs || 0,
    lateStatus:     s.lateStatus  || 'NORMAL',
    overrideStatus: s.overrideStatus || null,
    overrideComment: s.overrideComment || null,
  }
}

const STATUS_COLORS = {
  'Full Day':     { color: '#059669', bg: '#ecfdf5' },
  'Short':        { color: '#e11d48', bg: '#fff1f2' },
  'Early Logoff': { color: '#ea580c', bg: '#fff7ed' },
  'Half Day':     { color: '#d97706', bg: '#fffbeb' },
  'Absent':       { color: '#64748b', bg: '#f8fafc' },
  'Leave':        { color: '#7c3aed', bg: '#f5f3ff' },
  'Holiday':      { color: '#0284c7', bg: '#f0f9ff' },
}

function getMyStatus(h) {
  if (h.overrideStatus) return { value: h.overrideStatus, ...(STATUS_COLORS[h.overrideStatus] || { color: '#6b7280', bg: '#f9fafb' }) }
  if (!h.workTotal || h.workTotal <= 0) return null
  const ws = workStatus(h.workTotal)
  return ws ? { value: ws.label, color: ws.color, bg: ws.bg } : null
}

function getRowStyle(h) {
  if (h.status === 'WEEKEND') return { bg: '#f8fafc', border: '#e2e8f0' }
  const st = getMyStatus(h)
  if (st) return { bg: st.bg, border: st.color }
  if (!h.entryTime) return { bg: '#f8fafc', border: '#94a3b8' }
  return { bg: 'transparent', border: '#e2e8f0' }
}


function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export default function MyAttendance({ user }) {
  const today = new Date()
  const [year, setYear]         = useState(today.getFullYear())
  const [month, setMonth]       = useState(today.getMonth())
  const [filter, setFilter]     = useState('All')
  const [monthHistory, setMonthHistory] = useState([])
  const [loading, setLoading]   = useState(false)

  // Fetch data whenever year/month changes
  useEffect(() => {
    setLoading(true)
    const today = new Date()
    const firstDay = new Date(year, month, 1)
    const lastDay  = new Date(year, month + 1, 0)
    const endDay   = (year === today.getFullYear() && month === today.getMonth())
      ? today : lastDay

    // Build full date list for the month up to today
    const toLocalStr = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const allDates = []
    for (let d = new Date(firstDay); d <= endDay; d.setDate(d.getDate() + 1)) {
      allDates.push(toLocalStr(d))
    }

    if (USE_API) {
      api.fetchMyHistoryByMonth(year, month)
        .then(list => {
          const byDate = {}
          list.forEach(s => { byDate[s.date] = mapDto(s) })
          // Fill every date — weekends always forced regardless of DB record
          const full = allDates.map(date => {
            const day = new Date(date + 'T00:00:00').getDay()
            if (day === 0 || day === 6) return { date, status: 'WEEKEND', entryTime: null, exitTime: null, workTotal: 0, breakTotal: 0, lunchTotal: 0, lateStatus: 'NORMAL', overrideStatus: null }
            if (byDate[date]) return byDate[date]
            return { date, status: 'ABSENT', entryTime: null, exitTime: null, workTotal: 0, breakTotal: 0, lunchTotal: 0, lateStatus: 'NORMAL', overrideStatus: null }
          }).reverse() // newest first
          setMonthHistory(full)
        })
        .catch(() => setMonthHistory([]))
        .finally(() => setLoading(false))
    } else {
      setMonthHistory(generateHistory(30))
      setLoading(false)
    }
  }, [user?.id, year, month])

  const oldestAllowed = new Date(today.getFullYear(), today.getMonth() - 1, 1)

  const goBack = () => {
    if (isOldestMonth) return
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  const goForward = () => {
    if (isCurrentMonth) return
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
  const isOldestMonth  = year === oldestAllowed.getFullYear() && month === oldestAllowed.getMonth()

  const localToday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  const historyWithoutToday = monthHistory.filter(h => h.date !== localToday)
  const workdays = historyWithoutToday.filter(h => h.status !== 'WEEKEND')
  const filtered = filter === 'All' ? historyWithoutToday : historyWithoutToday.filter(h => h.status === filter)
  const workedDays = workdays.filter(h => h.workTotal > 0 && h.date !== localToday)
  const summary = {
    present:  workdays.filter(h => h.status === 'PRESENT').length,
    absent:   workdays.filter(h => h.status === 'ABSENT').length,
    late:     workdays.filter(h => h.lateStatus === 'LATE').length,
    veryLate: workdays.filter(h => h.lateStatus === 'VERY_LATE').length,
    avgMs: workedDays.length > 0
      ? workedDays.reduce((s, h) => s + h.workTotal, 0) / workedDays.length
      : 0,
  }

  return (
    <div className="page-content">

      {/* Summary chips */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '12px 0', color: '#94a3b8', fontSize: 13 }}>
          Loading...
        </div>
      )}

      <div className="ta-summary-chips">
        <div className="ta-chip ta-chip-total"><span>{summary.present}</span> Present</div>
<div className="ta-chip ta-chip-outside"><span>{summary.late}</span> Late</div>
        <div className="ta-chip ta-chip-miss"><span>{summary.veryLate}</span> Very Late</div>
        <div className="ta-chip ta-chip-away"><span>{formatDuration(summary.avgMs)}</span> Avg Hours</div>
      </div>

      <div className="section-card">

        {/* Header */}
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="ta-nav-btn" onClick={goBack} disabled={isOldestMonth}
              style={{ opacity: isOldestMonth ? 0.3 : 1, cursor: isOldestMonth ? 'default' : 'pointer' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', minWidth: 150, textAlign: 'center' }}>
              {monthLabel(year, month)}
            </span>
            <button className="ta-nav-btn" onClick={goForward} disabled={isCurrentMonth}
              style={{ opacity: isCurrentMonth ? 0.3 : 1, cursor: isCurrentMonth ? 'default' : 'pointer' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          <select className="ta-filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="All">All</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="HOLIDAY">Holiday</option>
            <option value="WEEKEND">Weekend</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
            Loading attendance history...
          </div>
        ) : filtered.length > 0 ? (
          <div className="table-scroll">
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>Presence</th>
                  <th>Break</th>
                  <th>Work Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(h => {
                  const totalBreakMs = h.breakTotal + h.lunchTotal
                  const presenceMs   = (h.workTotal || 0) + totalBreakMs
                  const presenceStr  = presenceMs > 0 ? formatDuration(presenceMs) : '—'
                  const rs = getRowStyle(h)
                  if (h.status === 'WEEKEND') return (
                    <tr key={h.date} style={{ background: rs.bg, opacity: 0.65 }}>
                      <td style={{ borderLeft: `3px solid ${rs.border}`, fontWeight: 500, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {formatDateLabel(h.date)}
                      </td>
                      <td colSpan={6} style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 12, color: '#94a3b8', background: '#f1f5f9', padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>
                          Weekend
                        </span>
                      </td>
                    </tr>
                  )
                  const myStatus = getMyStatus(h)
                  return (
                    <tr key={h.date} style={{ background: rs.bg }}>
                      <td style={{ borderLeft: `3px solid ${rs.border}`, fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap' }}>
                        {formatDateLabel(h.date)}
                      </td>
                      <td>
                        {h.entryTime
                          ? <div className="ta-time-box" style={
                              h.lateStatus === 'VERY_LATE' ? { background: '#fff1f2', color: '#ef4444', borderColor: '#fecdd3' }
                              : h.lateStatus === 'LATE'     ? { background: '#fff7ed', color: '#f97316', borderColor: '#fed7aa' }
                              : { background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }
                            }>{h.entryTime}</div>
                          : <span className="ta-dash">—</span>}
                      </td>
                      <td>
                        {h.exitTime
                          ? <div className="ta-time-box ta-time-normal">{h.exitTime}</div>
                          : <span className="ta-dash">—</span>}
                      </td>
                      <td><span className="ta-duration-text">{presenceStr}</span></td>
                      <td>
                        <span className="ta-duration-text">
                          {totalBreakMs > 0 ? formatDuration(totalBreakMs) : '—'}
                        </span>
                      </td>
                      <td>
                        <span className="ta-shift-duration" style={myStatus ? { color: myStatus.color } : {}}>
                          {h.workTotal ? formatDuration(h.workTotal) : '—'}
                        </span>
                      </td>
                      <td>
                        {myStatus
                          ? <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, color: myStatus.color, background: myStatus.bg, border: `1px solid ${myStatus.color}33` }}>
                                {myStatus.value}
                              </span>
                              {h.overrideComment && (
                                <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', maxWidth: 160, lineHeight: 1.3 }}>
                                  {h.overrideComment}
                                </span>
                              )}
                            </div>
                          : <span className="ta-dash">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
            No records found for {monthLabel(year, month)}
          </div>
        )}

      </div>
    </div>
  )
}
