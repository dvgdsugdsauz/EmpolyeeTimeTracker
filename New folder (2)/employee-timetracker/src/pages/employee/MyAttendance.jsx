import { useState, useEffect } from 'react'
import { generateHistory } from '../../data/mockData'
import { formatDuration, formatDateLabel } from '../../utils/timeUtils'
import * as api from '../../services/api'

const USE_API = Boolean(import.meta.env.VITE_API_URL)
const MIN_YEAR = 2023   // oldest data year from MDB migration

function timeStr(t) {
  if (!t) return null
  if (Array.isArray(t)) return `${String(t[0]).padStart(2,'0')}:${String(t[1]).padStart(2,'0')}`
  return String(t).slice(0, 5)
}

function mapDto(s) {
  return {
    date:       s.date,
    status:     s.status     || 'ABSENT',
    entryTime:  timeStr(s.entryTime),
    exitTime:   timeStr(s.exitTime),
    workTotal:  s.totalWorkMs  || 0,
    breakTotal: s.totalBreakMs || 0,
    lunchTotal: s.totalLunchMs || 0,
    lateStatus: s.lateStatus  || 'NORMAL',
  }
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
    if (USE_API) {
      api.fetchMyHistoryByMonth(year, month)
        .then(list => setMonthHistory(list.map(mapDto)))
        .catch(() => setMonthHistory([]))
        .finally(() => setLoading(false))
    } else {
      setMonthHistory(generateHistory(30))
      setLoading(false)
    }
  }, [user?.id, year, month])

  const goBack = () => {
    const isOldestMonth = year === MIN_YEAR && month === 0
    if (isOldestMonth) return
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  const goForward = () => {
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
    if (isCurrentMonth) return
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
  const isOldestMonth  = year === MIN_YEAR && month === 0

  const filtered = filter === 'All' ? monthHistory : monthHistory.filter(h => h.status === filter)

  const summary = {
    present:  monthHistory.filter(h => h.status === 'PRESENT' || h.status === 'OFFLINE').length,
    absent:   monthHistory.filter(h => h.status === 'ABSENT').length,
    late:     monthHistory.filter(h => h.lateStatus === 'LATE').length,
    veryLate: monthHistory.filter(h => h.lateStatus === 'VERY_LATE').length,
    avgHours: monthHistory.filter(h => h.workTotal > 0).length > 0
      ? (monthHistory.filter(h => h.workTotal > 0).reduce((s, h) => s + h.workTotal, 0)
          / monthHistory.filter(h => h.workTotal > 0).length / 3600000).toFixed(1)
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
        <div className="ta-chip ta-chip-working" style={{ background: '#fee2e2', color: '#ef4444' }}>
          <span>{summary.absent}</span> Absent
        </div>
        <div className="ta-chip ta-chip-outside"><span>{summary.late}</span> Late</div>
        <div className="ta-chip ta-chip-miss"><span>{summary.veryLate}</span> Very Late</div>
        <div className="ta-chip ta-chip-away"><span>{summary.avgHours}h</span> Avg Hours</div>
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
                  <th>Status</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>Work Hours</th>
                  <th>Break</th>
                  <th>Late</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(h => (
                  <tr key={h.date}>
                    <td style={{ fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap' }}>
                      {formatDateLabel(h.date)}
                    </td>
                    <td>
                      <span className={`presence-badge ${
                        h.status === 'PRESENT' ? 'badge-present'
                        : h.status === 'HOLIDAY' ? 'badge-holiday'
                        : h.status === 'OFFLINE' ? 'badge-offline'
                        : 'badge-absent'
                      }`}>
                        {h.status}
                      </span>
                    </td>
                    <td>
                      {h.entryTime
                        ? <div className="ta-time-box ta-time-normal">{h.entryTime}</div>
                        : <span className="ta-dash">—</span>}
                    </td>
                    <td>
                      {h.exitTime
                        ? <div className="ta-time-box ta-time-normal">{h.exitTime}</div>
                        : <span className="ta-dash">—</span>}
                    </td>
                    <td>
                      <span className={`ta-shift-duration ${
                        h.workTotal > 8 * 3600000 ? 'ta-shift-ot'
                        : h.workTotal > 0 ? 'ta-shift-ok' : ''
                      }`}>
                        {h.workTotal ? formatDuration(h.workTotal) : '—'}
                      </span>
                    </td>
                    <td>
                      <span className="ta-duration-text">
                        {h.breakTotal ? formatDuration(h.breakTotal) : '—'}
                      </span>
                    </td>
                    <td>
                      {(h.lateStatus === 'LATE' || h.lateStatus === 'VERY_LATE')
                        ? <span className="late-tag" style={{
                            color: h.lateStatus === 'LATE' ? '#f97316' : '#ef4444',
                            background: h.lateStatus === 'LATE' ? '#ffedd5' : '#fee2e2',
                          }}>
                            {h.lateStatus === 'LATE' ? 'Late' : 'Very Late'}
                          </span>
                        : h.status === 'PRESENT'
                          ? <span className="ta-ontime">On Time</span>
                          : <span className="ta-dash">—</span>
                      }
                    </td>
                  </tr>
                ))}
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
