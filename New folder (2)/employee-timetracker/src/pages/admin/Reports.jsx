import { useState, useRef, useEffect, useMemo } from 'react'
import { generateHistory } from '../../data/mockData'
import { formatDuration, formatDateLabel } from '../../utils/timeUtils'
import * as api from '../../services/api'

const USE_API = Boolean(import.meta.env.VITE_API_URL)

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

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export default function Reports({ users }) {
  const today = new Date()

  const [allEmployees, setAllEmployees]   = useState([])
  const [selectedEmp, setSelectedEmp]     = useState(null)
  const [search, setSearch]               = useState('')
  const [showList, setShowList]           = useState(false)
  const [year,  setYear]                  = useState(today.getFullYear())
  const [month, setMonth]                 = useState(today.getMonth())
  const [monthHistory, setMonthHistory]   = useState([])
  const [loading, setLoading]             = useState(false)
  const wrapRef = useRef(null)

  // Load all employees from API on mount
  useEffect(() => {
    if (USE_API) {
      api.fetchEmployees()
        .then(list => {
          // Show all active staff — employees, managers, admins
          const emps = list.filter(u => u.active !== false)
          setAllEmployees(emps)
        })
        .catch(() => {
          setAllEmployees(users.filter(u => u.active !== false))
        })
    } else {
      setAllEmployees(users.filter(u => u.active !== false))
    }
  }, [])

  const employees = allEmployees

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowList(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fetch attendance when employee or month changes
  useEffect(() => {
    if (!selectedEmp) { setMonthHistory([]); return }

    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    setLoading(true)
    if (USE_API) {
      api.fetchAttendanceHistory(selectedEmp.id, from, to)
        .then(list => setMonthHistory(list.map(mapDto)))
        .catch(() => setMonthHistory([]))
        .finally(() => setLoading(false))
    } else {
      const ALL_HISTORY = generateHistory(90)
      const key = `${year}-${String(month + 1).padStart(2, '0')}`
      setMonthHistory(ALL_HISTORY.filter(h => h.date.startsWith(key)))
      setLoading(false)
    }
  }, [selectedEmp?.id, year, month])

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
  const oldestDate = new Date(today.getFullYear(), today.getMonth() - 11, 1)
  const isOldestMonth = year === oldestDate.getFullYear() && month === oldestDate.getMonth()

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

  const summary = useMemo(() => ({
    present:  monthHistory.filter(h => h.status === 'PRESENT' || h.status === 'OFFLINE').length,
    absent:   monthHistory.filter(h => h.status === 'ABSENT').length,
    late:     monthHistory.filter(h => h.lateStatus === 'LATE').length,
    veryLate: monthHistory.filter(h => h.lateStatus === 'VERY_LATE').length,
    avgHours: monthHistory.filter(h => h.workTotal > 0).length > 0
      ? (monthHistory.filter(h => h.workTotal > 0).reduce((s, h) => s + h.workTotal, 0)
          / monthHistory.filter(h => h.workTotal > 0).length / 3600000).toFixed(1)
      : '0.0',
  }), [monthHistory])

  const filtered = employees.filter(e =>
    search.trim()
      ? (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.id || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.dept || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.username || '').toLowerCase().includes(search.toLowerCase())
      : true
  )

  const selectEmployee = emp => {
    setSelectedEmp(emp)
    setSearch(emp.name)
    setShowList(false)
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  const handleExport = () => {
    if (!selectedEmp) return
    const headers = ['Date', 'Employee', 'Department', 'Status', 'Entry', 'Exit', 'Work Hours', 'Late']
    const rows = monthHistory.map(h => [
      h.date, selectedEmp.name, selectedEmp.dept,
      h.status, h.entryTime || '--', h.exitTime || '--',
      h.workTotal ? (h.workTotal / 3600000).toFixed(2) : '0',
      h.lateStatus || '--',
    ])
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `attendance_${selectedEmp.id}_${year}-${String(month + 1).padStart(2,'0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-content">
      <div className="section-card">

        {/* Header */}
        <div className="section-header">
          <div className="section-header-left">
            <h3>Attendance Reports</h3>
          </div>
          <div className="section-header-right" style={{ gap: 10, flexWrap: 'wrap' }}>

            {/* Employee search */}
            <div ref={wrapRef} style={{ position: 'relative' }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <svg style={{ position: 'absolute', left: 10, width: 15, height: 15, color: '#94a3b8', pointerEvents: 'none' }}
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  className="ta-search"
                  style={{ paddingLeft: 32, width: 210 }}
                  placeholder="Search employee..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setShowList(true) }}
                  onFocus={() => setShowList(true)}
                />
                {search && (
                  <button onClick={() => { setSearch(''); setSelectedEmp(null); setShowList(true) }}
                    style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, lineHeight: 1 }}>
                    ×
                  </button>
                )}
              </div>

              {showList && filtered.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,.10)', marginTop: 4,
                  maxHeight: 220, overflowY: 'auto',
                }}>
                  {filtered.map(emp => (
                    <div key={emp.id} onMouseDown={() => selectEmployee(emp)}
                      style={{
                        padding: '9px 14px', cursor: 'pointer', display: 'flex',
                        alignItems: 'center', gap: 10,
                        background: selectedEmp?.id === emp.id ? '#f1f5f9' : '#fff',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = selectedEmp?.id === emp.id ? '#f1f5f9' : '#fff'}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', background: '#1e293b',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                      }}>{emp.avatar || emp.name?.slice(0,2).toUpperCase()}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{emp.id} · {emp.dept}</div>
                      </div>
                      {selectedEmp?.id === emp.id && (
                        <svg style={{ marginLeft: 'auto', color: '#16a34a', width: 14, height: 14 }}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {showList && filtered.length === 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                  background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,.10)', marginTop: 4,
                  padding: '14px', textAlign: 'center', fontSize: 13, color: '#94a3b8',
                }}>
                  No employee found
                </div>
              )}
            </div>

            <button className="btn-export" onClick={handleExport} disabled={!selectedEmp || loading}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* Employee info bar */}
        {selectedEmp && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 16px', padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%', background: '#1e293b',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>{selectedEmp.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{selectedEmp.name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{selectedEmp.id} · {selectedEmp.dept}</div>
            </div>

            {/* Month navigation */}
            <div className="ta-date-nav" style={{ marginLeft: 'auto' }}>
              <button className="ta-nav-btn" onClick={goBack} disabled={isOldestMonth}
                style={{ opacity: isOldestMonth ? .35 : 1 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', minWidth: 120, textAlign: 'center' }}>
                {monthLabel(year, month)}
              </span>
              <button className="ta-nav-btn" onClick={goForward} disabled={isCurrentMonth}
                style={{ opacity: isCurrentMonth ? .35 : 1 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Summary chips */}
        {selectedEmp && (
          <div className="report-summary-row">
            <div className="report-stat"><div className="report-stat-val green">{summary.present}</div><div>Present</div></div>
            <div className="report-stat"><div className="report-stat-val red">{summary.absent}</div><div>Absent</div></div>
            <div className="report-stat"><div className="report-stat-val orange">{summary.late}</div><div>Late</div></div>
            <div className="report-stat"><div className="report-stat-val red">{summary.veryLate}</div><div>Very Late</div></div>
            <div className="report-stat"><div className="report-stat-val blue">{summary.avgHours}h</div><div>Avg Hours</div></div>
          </div>
        )}

        {/* Table */}
        {selectedEmp ? (
          loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
              Loading...
            </div>
          ) : monthHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
              No records found for {monthLabel(year, month)}
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Presence</th>
                    <th>Break</th>
                    <th>Work Hours</th>
                    <th>Late</th>
                  </tr>
                </thead>
                <tbody>
                  {monthHistory.map(h => (
                    <tr key={h.date}>
                      <td className="text-nowrap">{formatDateLabel(h.date)}</td>
                      <td>
                        <span className={`presence-badge ${h.status === 'PRESENT' ? 'badge-present' : h.status === 'HOLIDAY' ? 'badge-holiday' : h.status === 'OFFLINE' ? 'badge-offline' : 'badge-absent'}`}>
                          {h.status}
                        </span>
                      </td>
                      <td>{h.entryTime || '--'}</td>
                      <td>{h.exitTime || '--'}</td>
                      <td>{(h.entryTime && h.exitTime) ? (() => {
                        const [eh, em] = h.entryTime.split(':').map(Number)
                        const [xh, xm] = h.exitTime.split(':').map(Number)
                        const diffMin = (xh * 60 + xm) - (eh * 60 + em)
                        if (diffMin <= 0) return '--'
                        return `${Math.floor(diffMin / 60)}h ${String(diffMin % 60).padStart(2,'0')}m`
                      })() : '--'}</td>
                      <td>{(h.breakTotal + h.lunchTotal) > 0 ? formatDuration(h.breakTotal + h.lunchTotal) : '--'}</td>
                      <td>{h.workTotal ? formatDuration(h.workTotal) : '--'}</td>
                      <td>
                        {(h.lateStatus === 'LATE' || h.lateStatus === 'VERY_LATE') ? (
                          <span className="late-tag" style={{
                            color: h.lateStatus === 'LATE' ? '#f97316' : '#ef4444',
                            background: h.lateStatus === 'LATE' ? '#ffedd5' : '#fee2e2',
                          }}>
                            {h.lateStatus === 'LATE' ? 'Late' : 'Very Late'}
                          </span>
                        ) : h.status === 'PRESENT' ? (
                          <span className="ta-ontime">On Time</span>
                        ) : <span className="ta-dash">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
            Search and select an employee to view their attendance report
          </div>
        )}

      </div>
    </div>
  )
}
