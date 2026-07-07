import { useState, useRef, useEffect, useMemo } from 'react'
import { generateHistory } from '../../data/mockData'
import { formatDuration, formatDateLabel } from '../../utils/timeUtils'
import { workStatus } from '../../utils/attendanceLogic'
import * as api from '../../services/api'
import * as XLSX from 'xlsx'

const USE_API = Boolean(import.meta.env.VITE_API_URL)

const EXCLUDED_IDS = new Set(['10002', '100175', 'ADM001', '100174', '10003', '10123'])

const OVERRIDE_OPTIONS = [
  { value: 'Full Day',     color: '#059669', bg: '#ecfdf5' },
  { value: 'Half Day',     color: '#d97706', bg: '#fffbeb' },
  { value: 'Early Logoff', color: '#ea580c', bg: '#fff7ed' },
  { value: 'Short',        color: '#e11d48', bg: '#fff1f2' },
  { value: 'Absent',       color: '#64748b', bg: '#f8fafc' },
  { value: 'Leave',        color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'Holiday',      color: '#0284c7', bg: '#f0f9ff' },
  { value: 'CLEAR',        color: '#94a3b8', bg: '#f1f5f9' },
]

function timeStr(t) {
  if (!t) return null
  if (Array.isArray(t)) return `${String(t[0]).padStart(2,'0')}:${String(t[1]).padStart(2,'0')}`
  return String(t).slice(0, 5)
}

function mapDto(s) {
  return {
    id:           s.id,
    date:         s.date,
    status:       s.status     || 'ABSENT',
    entryTime:    timeStr(s.entryTime),
    exitTime:     timeStr(s.exitTime),
    workTotal:    s.totalWorkMs  || 0,
    breakTotal:   s.totalBreakMs || 0,
    lunchTotal:   s.totalLunchMs || 0,
    lateStatus:   s.lateStatus  || 'NORMAL',
    overrideStatus: s.overrideStatus || null,
    overrideComment: s.overrideComment || null,
    employeeName: s.employeeName || null,
    dept:         s.dept || null,
    employeeId:   s.employeeId || null,
  }
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function getDisplayStatus(h, isToday = false) {
  if (h.overrideStatus) {
    const opt = OVERRIDE_OPTIONS.find(o => o.value === h.overrideStatus)
    return opt || { value: h.overrideStatus, color: '#6b7280', bg: '#f9fafb' }
  }
  // Today: employee has arrived but the day is not over — never auto-label Short/Full Day
  if (isToday && h.entryTime) return null
  // Past date: entryTime with no exit and zero work means still active (edge case)
  if (h.entryTime && !h.exitTime && h.workTotal === 0)
    return { value: 'Working', color: '#16a34a', bg: '#dcfce7' }
  const ws = workStatus(h.workTotal)
  return ws ? { value: ws.label, color: ws.color, bg: ws.bg } : null
}

// Only show editable dropdown if employee has a DB record (has entryTime or a status)
function canOverride(h) {
  return h.entryTime || h.workTotal > 0 || h.status === 'ABSENT'
}

const STATUS_STRIPE = {
  'Full Day':     { border: '#059669', bg: '#f0fdf4' },
  'Half Day':     { border: '#d97706', bg: '#fffbeb' },
  'Early Logoff': { border: '#ea580c', bg: '#fff7ed' },
  'Short':        { border: '#e11d48', bg: '#fff1f2' },
  'Absent':       { border: '#94a3b8', bg: '#f8fafc' },
  'Leave':        { border: '#7c3aed', bg: '#faf5ff' },
  'Holiday':      { border: '#0284c7', bg: '#f0f9ff' },
  'Working':      { border: '#059669', bg: '#f0fdf4' },
}

function rowStyle(h, isToday = false) {
  if (h.status === 'WEEKEND') return { trBg: '#f8fafc', tdBorder: '#e2e8f0' }
  const ws = getDisplayStatus(h, isToday)
  const s = ws ? STATUS_STRIPE[ws.value] : null
  return s ? { trBg: s.bg, tdBorder: s.border } : { trBg: 'transparent', tdBorder: '#e2e8f0' }
}

function StatusPopup({ h, onSelect, onClose }) {
  const [selected, setSelected] = useState(h.overrideStatus || null)
  const [comment, setComment]   = useState(h.overrideComment || '')

  function apply() {
    if (!selected) return
    onSelect(selected, selected === 'CLEAR' ? null : comment.trim() || null)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(15,23,42,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, padding: '6px 0 12px', boxShadow: '0 24px 64px rgba(0,0,0,.18)', minWidth: 240, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '10px 16px 8px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #f1f5f9' }}>
          Override Status
        </div>
        {OVERRIDE_OPTIONS.map(opt => (
          <div
            key={opt.value}
            onClick={() => setSelected(opt.value)}
            style={{
              padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: opt.color, display: 'flex', alignItems: 'center', gap: 10,
              background: selected === opt.value ? opt.bg : 'transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.background = opt.bg}
            onMouseLeave={e => e.currentTarget.style.background = selected === opt.value ? opt.bg : 'transparent'}
          >
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
            {opt.value === 'CLEAR' ? 'Clear Override' : opt.value}
            {selected === opt.value && (
              <svg style={{ marginLeft: 'auto', width: 13, height: 13 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
          </div>
        ))}
        {selected && selected !== 'CLEAR' && (
          <div style={{ padding: '8px 16px 4px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative' }}>
              <textarea
                placeholder="Reason / comment (optional)"
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={2}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'none',
                  border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 10px',
                  fontSize: 12, color: '#334155', outline: 'none', fontFamily: 'inherit',
                }}
                autoFocus
              />
              {comment && (
                <button
                  onClick={() => setComment('')}
                  style={{
                    position: 'absolute', top: 4, right: 6, background: 'none', border: 'none',
                    cursor: 'pointer', color: '#94a3b8', fontSize: 14, lineHeight: 1, padding: 2,
                  }}
                  title="Clear comment"
                >✕</button>
              )}
            </div>
          </div>
        )}
        {selected && (
          <div style={{ padding: '6px 16px 0', display: 'flex', gap: 8 }}>
            <button
              onClick={apply}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#1e293b', color: '#fff', fontSize: 12, fontWeight: 700,
              }}
            >Apply</button>
            <button
              onClick={onClose}
              style={{
                padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer',
                background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 600,
              }}
            >Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusCell({ h, onOverride, saving, isToday = false }) {
  const [open, setOpen] = useState(false)
  const ws = getDisplayStatus(h, isToday)

  return (
    <>
      <div
        onClick={() => !saving && setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 6, cursor: saving ? 'default' : 'pointer',
          fontSize: 12, fontWeight: 600,
          color: ws ? ws.color : '#94a3b8',
          background: ws ? ws.bg : 'transparent',
          border: `1px solid ${ws ? ws.color + '33' : '#e2e8f0'}`,
          userSelect: 'none', opacity: saving ? 0.6 : 1,
        }}
      >
        {ws ? ws.value : '—'}
        <svg style={{ width: 10, height: 10, opacity: 0.5 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      {open && (
        <StatusPopup h={h} onSelect={(val, cmt) => onOverride(h, val, cmt)} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

export default function Reports({ users }) {
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const [viewMode, setViewMode]           = useState('individual') // 'individual' | 'daily'
  const [allEmployees, setAllEmployees]   = useState([])
  const [selectedEmp, setSelectedEmp]     = useState(null)
  const [search, setSearch]               = useState('')
  const [showList, setShowList]           = useState(false)
  const [year,  setYear]                  = useState(today.getFullYear())
  const [month, setMonth]                 = useState(today.getMonth())
  const [monthHistory, setMonthHistory]   = useState([])
  const [loading, setLoading]             = useState(false)
  const [savingRow, setSavingRow]         = useState(null) // date string being saved

  // Daily All view state
  const [dailyDate, setDailyDate]         = useState(todayStr)
  const [dailyRecords, setDailyRecords]   = useState([])
  const [dailyLoading, setDailyLoading]   = useState(false)

  // All Employees — month view
  const [dailySubView, setDailySubView]   = useState('day') // 'day' | 'month'
  const [allYear,  setAllYear]            = useState(today.getFullYear())
  const [allMonth, setAllMonth]           = useState(today.getMonth())
  const [monthAllData, setMonthAllData]   = useState([])
  const [monthAllLoading, setMonthAllLoading] = useState(false)
  const [monthAllSearch, setMonthAllSearch] = useState('')
  const [dailySearch, setDailySearch]     = useState('')

  const wrapRef = useRef(null)

  useEffect(() => {
    if (USE_API) {
      api.fetchEmployees()
        .then(list => setAllEmployees(list.filter(u => u.active !== false && !EXCLUDED_IDS.has(u.id))))
        .catch(() => setAllEmployees(users.filter(u => u.active !== false && !EXCLUDED_IDS.has(u.id))))
    } else {
      setAllEmployees(users.filter(u => u.active !== false))
    }
  }, [])

  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowList(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Individual view fetch
  useEffect(() => {
    if (!selectedEmp || viewMode !== 'individual') { setMonthHistory([]); return }
    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    setLoading(true)
    if (USE_API) {
      api.fetchAttendanceHistory(selectedEmp.id, from, to)
        .then(list => {
          const byDate = {}
          list.forEach(s => { byDate[s.date] = mapDto(s) })
          const todayD = new Date()
          const firstDay = new Date(year, month, 1)
          const lastDayD = new Date(year, month + 1, 0)
          const endDay = (year === todayD.getFullYear() && month === todayD.getMonth()) ? todayD : lastDayD
          const full = []
          for (let d = new Date(firstDay); d <= endDay; d.setDate(d.getDate() + 1)) {
            const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
            const dow = d.getDay()
            if (dow === 0 || dow === 6) {
              full.push({ date: dateStr, status: 'WEEKEND', entryTime: null, exitTime: null,
                workTotal: 0, breakTotal: 0, lunchTotal: 0, lateStatus: 'NORMAL', overrideStatus: null })
            } else if (byDate[dateStr]) {
              full.push(byDate[dateStr])
            } else {
              full.push({ date: dateStr, status: 'ABSENT', entryTime: null, exitTime: null,
                workTotal: 0, breakTotal: 0, lunchTotal: 0, lateStatus: 'NORMAL', overrideStatus: null })
            }
          }
          setMonthHistory(full.reverse())
        })
        .catch(() => setMonthHistory([]))
        .finally(() => setLoading(false))
    } else {
      const ALL_HISTORY = generateHistory(90)
      const key = `${year}-${String(month + 1).padStart(2, '0')}`
      setMonthHistory(ALL_HISTORY.filter(h => h.date.startsWith(key)))
      setLoading(false)
    }
  }, [selectedEmp?.id, year, month, viewMode])

  // Daily All view fetch
  useEffect(() => {
    if (viewMode !== 'daily') return
    setDailyLoading(true)
    if (USE_API) {
      api.fetchDailySummary(dailyDate)
        .then(list => setDailyRecords(list.map(mapDto)))
        .catch(() => setDailyRecords([]))
        .finally(() => setDailyLoading(false))
    } else {
      setDailyRecords([])
      setDailyLoading(false)
    }
  }, [dailyDate, viewMode])

  // Month view — all employees summary fetch
  useEffect(() => {
    if (viewMode !== 'daily' || dailySubView !== 'month' || !USE_API) return
    setMonthAllLoading(true)
    const firstDay = new Date(allYear, allMonth, 1)
    const lastDay  = new Date(allYear, allMonth + 1, 0)
    const todayD   = new Date()
    const endDay   = (allYear === todayD.getFullYear() && allMonth === todayD.getMonth()) ? todayD : lastDay
    const weekdays = []
    for (let d = new Date(firstDay); d <= endDay; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) {
        weekdays.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
      }
    }
    Promise.all(weekdays.map(dt => api.fetchDailySummary(dt).catch(() => [])))
      .then(results => {
        const byEmp = {}
        allEmployees.forEach(e => { byEmp[e.id] = { emp: e, present: 0, absent: 0, leave: 0, late: 0, veryLate: 0, totalWorkMs: 0 } })
        weekdays.forEach((date, i) => {
          const dayRecs = results[i] || []
          const presentIds = new Set()
          const leaveIds   = new Set()
          dayRecs.forEach(r => {
            if (EXCLUDED_IDS.has(r.employeeId) || !byEmp[r.employeeId]) return
            const m = mapDto(r)
            if (m.overrideStatus === 'Leave') {
              leaveIds.add(r.employeeId)
              byEmp[r.employeeId].leave++
            } else {
              presentIds.add(r.employeeId)
              byEmp[r.employeeId].present++
              byEmp[r.employeeId].totalWorkMs += m.workTotal || 0
              if (m.lateStatus === 'LATE')      byEmp[r.employeeId].late++
              if (m.lateStatus === 'VERY_LATE') byEmp[r.employeeId].veryLate++
            }
          })
          allEmployees.forEach(e => {
            if (!presentIds.has(e.id) && !leaveIds.has(e.id) && byEmp[e.id]) byEmp[e.id].absent++
          })
        })
        setMonthAllData(Object.values(byEmp).sort((a, b) => a.emp.name.localeCompare(b.emp.name)))
      })
      .catch(() => setMonthAllData([]))
      .finally(() => setMonthAllLoading(false))
  }, [viewMode, dailySubView, allYear, allMonth, allEmployees.length])

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

  const isAllCurrentMonth = allYear === today.getFullYear() && allMonth === today.getMonth()
  const isAllOldestMonth  = allYear === oldestDate.getFullYear() && allMonth === oldestDate.getMonth()
  const goAllBack = () => {
    if (isAllOldestMonth) return
    if (allMonth === 0) { setAllMonth(11); setAllYear(y => y - 1) }
    else setAllMonth(m => m - 1)
  }
  const goAllForward = () => {
    if (isAllCurrentMonth) return
    if (allMonth === 11) { setAllMonth(0); setAllYear(y => y + 1) }
    else setAllMonth(m => m + 1)
  }

  // Daily all-employees view: fill in absent employees who have no DB record that day
  const allDailyRecords = useMemo(() => {
    const dow = new Date(dailyDate + 'T12:00:00').getDay()
    if (dow === 0 || dow === 6) return dailyRecords // weekend — no fill
    const presentIds = new Set(dailyRecords.map(r => r.employeeId))
    const absentRows = allEmployees
      .filter(e => !presentIds.has(e.id))
      .map(e => ({
        id: null, date: dailyDate, status: 'ABSENT',
        employeeId: e.id, employeeName: e.name, dept: e.dept,
        entryTime: null, exitTime: null, workTotal: 0, breakTotal: 0, lunchTotal: 0,
        lateStatus: 'NORMAL', overrideStatus: null,
      }))
    return [...dailyRecords.filter(r => !EXCLUDED_IDS.has(r.employeeId)), ...absentRows].sort((a, b) => (a.employeeName || '').localeCompare(b.employeeName || ''))
  }, [dailyRecords, allEmployees, dailyDate])

  const summary = useMemo(() => {
    const localToday = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
    const workedDays = monthHistory.filter(h => h.workTotal > 0 && h.date !== localToday)
    return {
      present:  monthHistory.filter(h => h.status === 'PRESENT' || h.status === 'OFFLINE').length,
      absent:   monthHistory.filter(h => h.status === 'ABSENT').length,
      late:     monthHistory.filter(h => h.lateStatus === 'LATE').length,
      veryLate: monthHistory.filter(h => h.lateStatus === 'VERY_LATE').length,
      avgMs: workedDays.length > 0
        ? workedDays.reduce((s, h) => s + h.workTotal, 0) / workedDays.length
        : 0,
    }
  }, [monthHistory])

  const filtered = allEmployees.filter(e =>
    search.trim()
      ? (e.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.id || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.dept || '').toLowerCase().includes(search.toLowerCase())
      : true
  )

  const filteredMonthAll = useMemo(() => {
    const q = monthAllSearch.trim().toLowerCase()
    if (!q) return monthAllData
    return monthAllData.filter(({ emp }) =>
      (emp.name || '').toLowerCase().includes(q) ||
      (emp.id || '').toLowerCase().includes(q) ||
      (emp.dept || '').toLowerCase().includes(q)
    )
  }, [monthAllData, monthAllSearch])

  const filteredDailyRecords = useMemo(() => {
    const q = dailySearch.trim().toLowerCase()
    if (!q) return allDailyRecords
    return allDailyRecords.filter(h =>
      (h.employeeName || '').toLowerCase().includes(q) ||
      (h.employeeId || '').toLowerCase().includes(q) ||
      (h.dept || '').toLowerCase().includes(q)
    )
  }, [allDailyRecords, dailySearch])

  const selectEmployee = emp => {
    setSelectedEmp(emp)
    setSearch(emp.name)
    setShowList(false)
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  async function handleOverride(h, overrideStatus, overrideComment) {
    const empId = viewMode === 'individual' ? selectedEmp.id : h.employeeId
    setSavingRow(h.date)
    try {
      await api.overrideAttendanceStatus(empId, h.date, overrideStatus, overrideComment)
      const newVal     = overrideStatus === 'CLEAR' ? null : overrideStatus
      const newComment = overrideStatus === 'CLEAR' ? null : (overrideComment || null)
      if (viewMode === 'individual') {
        setMonthHistory(prev => prev.map(r => r.date === h.date ? { ...r, overrideStatus: newVal, overrideComment: newComment } : r))
      } else {
        setDailyRecords(prev => prev.map(r => r.date === h.date && r.employeeId === empId ? { ...r, overrideStatus: newVal, overrideComment: newComment } : r))
      }
    } catch (e) {
      alert('Failed to save: ' + e.message)
    } finally {
      setSavingRow(null)
    }
  }

  const handleExport = () => {
    if (!selectedEmp) return
    const headers = ['Date', 'Employee', 'Department', 'Entry', 'Exit', 'Work Hours', 'Status']
    const rows = monthHistory.map(h => {
      const ws = getDisplayStatus(h)
      return [h.date, selectedEmp.name, selectedEmp.dept, h.entryTime || '--', h.exitTime || '--',
        h.workTotal ? formatDuration(h.workTotal) : '0', ws ? ws.value : '--']
    })
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `attendance_${selectedEmp.id}_${year}-${String(month + 1).padStart(2,'0')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportMonthAll = () => {
    const rows = filteredMonthAll.map(({ emp, present, absent, leave, late, veryLate, totalWorkMs }) => ({
      'Employee Name': emp.name,
      'Employee ID':   emp.id,
      'Department':    emp.dept || '',
      'Present':       present,
      'Absent':        absent,
      'Leave':         leave,
      'Late':          late,
      'Very Late':     veryLate,
      'Total Hours':   totalWorkMs > 0 ? formatDuration(totalWorkMs) : '0',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 20 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 11 }, { wch: 13 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, monthLabel(allYear, allMonth))
    XLSX.writeFile(wb, `attendance_${allYear}-${String(allMonth + 1).padStart(2,'0')}.xlsx`)
  }

  const handleExportDaily = () => {
    const headers = ['Employee', 'Department', 'Entry', 'Exit', 'Work Hours', 'Status']
    const rows = dailyRecords.map(h => {
      const ws = getDisplayStatus(h)
      return [h.employeeName || '', h.dept || '', h.entryTime || '--', h.exitTime || '--',
        h.workTotal ? formatDuration(h.workTotal) : '0', ws ? ws.value : '--']
    })
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `attendance_daily_${dailyDate}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-content">
      <div className="section-card" style={{ minHeight: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="section-header">
          <div className="section-header-left">
            <h3>Attendance Reports</h3>
            {/* View mode toggle */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2, marginLeft: 12 }}>
              {[{ key: 'individual', label: 'Individual' }, { key: 'daily', label: 'All Employees' }].map(m => (
                <button
                  key={m.key}
                  onClick={() => setViewMode(m.key)}
                  style={{
                    padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                    background: viewMode === m.key ? '#fff' : 'transparent',
                    color: viewMode === m.key ? '#1e293b' : '#64748b',
                    boxShadow: viewMode === m.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="section-header-right" style={{ gap: 10, flexWrap: 'wrap' }}>
            {viewMode === 'individual' && (
              <>
                <div ref={wrapRef} style={{ position: 'relative' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <svg style={{ position: 'absolute', left: 10, width: 15, height: 15, color: '#94a3b8', pointerEvents: 'none' }}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input className="ta-search" style={{ paddingLeft: 32, width: 210 }}
                      placeholder="Search employee..."
                      value={search}
                      onChange={e => { setSearch(e.target.value); setShowList(true) }}
                      onFocus={() => setShowList(true)}
                    />
                    {search && (
                      <button onClick={() => { setSearch(''); setSelectedEmp(null); setShowList(true) }}
                        style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>×</button>
                    )}
                  </div>
                  {showList && filtered.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,.10)', marginTop: 4, maxHeight: 220, overflowY: 'auto' }}>
                      {filtered.map(emp => (
                        <div key={emp.id} onMouseDown={() => selectEmployee(emp)}
                          style={{ padding: '9px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                            background: selectedEmp?.id === emp.id ? '#f1f5f9' : '#fff', borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = selectedEmp?.id === emp.id ? '#f1f5f9' : '#fff'}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1e293b', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {emp.avatar || emp.name?.slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{emp.name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{emp.id} · {emp.dept}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {showList && filtered.length === 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,.10)', marginTop: 4, padding: '14px', textAlign: 'center', fontSize: 13, color: '#94a3b8' }}>
                      No employee found
                    </div>
                  )}
                </div>
                <button className="btn-export" onClick={handleExport} disabled={!selectedEmp || loading}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export CSV
                </button>
              </>
            )}

            {viewMode === 'daily' && (
              <>
                {/* Day / Month sub-toggle */}
                <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2 }}>
                  {[{ key: 'day', label: 'Day View' }, { key: 'month', label: 'Month View' }].map(v => (
                    <button key={v.key} onClick={() => setDailySubView(v.key)} style={{
                      padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                      background: dailySubView === v.key ? '#fff' : 'transparent',
                      color: dailySubView === v.key ? '#1e293b' : '#64748b',
                      boxShadow: dailySubView === v.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
                    }}>{v.label}</button>
                  ))}
                </div>

                {dailySubView === 'day' && (
                  <>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <svg style={{ position: 'absolute', left: 9, width: 14, height: 14, color: '#94a3b8', pointerEvents: 'none' }}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <input
                        className="ta-search"
                        style={{ paddingLeft: 30, width: 180 }}
                        placeholder="Search employee..."
                        value={dailySearch}
                        onChange={e => setDailySearch(e.target.value)}
                      />
                      {dailySearch && (
                        <button onClick={() => setDailySearch('')}
                          style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>×</button>
                      )}
                    </div>
                    <input type="date" value={dailyDate} max={todayStr}
                      onChange={e => setDailyDate(e.target.value)}
                      style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0',
                        fontSize: 13, fontWeight: 500, color: '#1e293b', background: '#fff', cursor: 'pointer' }}
                    />
                  </>
                )}

                {dailySubView === 'month' && (
                  <>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <svg style={{ position: 'absolute', left: 9, width: 14, height: 14, color: '#94a3b8', pointerEvents: 'none' }}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <input
                        className="ta-search"
                        style={{ paddingLeft: 30, width: 180 }}
                        placeholder="Search employee..."
                        value={monthAllSearch}
                        onChange={e => setMonthAllSearch(e.target.value)}
                      />
                      {monthAllSearch && (
                        <button onClick={() => setMonthAllSearch('')}
                          style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16 }}>×</button>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button className="ta-nav-btn" onClick={goAllBack} disabled={isAllOldestMonth} style={{ opacity: isAllOldestMonth ? .35 : 1 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', minWidth: 120, textAlign: 'center' }}>
                        {monthLabel(allYear, allMonth)}
                      </span>
                      <button className="ta-nav-btn" onClick={goAllForward} disabled={isAllCurrentMonth} style={{ opacity: isAllCurrentMonth ? .35 : 1 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </button>
                    </div>
                  </>
                )}

                <button className="btn-export" onClick={dailySubView === 'day' ? handleExportDaily : handleExportMonthAll}
                  disabled={dailySubView === 'day' ? (dailyLoading || dailyRecords.length === 0) : (monthAllLoading || monthAllData.length === 0)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {dailySubView === 'month' ? 'Export Excel' : 'Export CSV'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── INDIVIDUAL VIEW ── */}
        {viewMode === 'individual' && (
          <>
            {selectedEmp && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 16px',
                padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#1e293b', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {selectedEmp.avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{selectedEmp.name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{selectedEmp.id} · {selectedEmp.dept}</div>
                </div>
                <div className="ta-date-nav" style={{ marginLeft: 'auto' }}>
                  <button className="ta-nav-btn" onClick={goBack} disabled={isOldestMonth} style={{ opacity: isOldestMonth ? .35 : 1 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', minWidth: 120, textAlign: 'center' }}>
                    {monthLabel(year, month)}
                  </span>
                  <button className="ta-nav-btn" onClick={goForward} disabled={isCurrentMonth} style={{ opacity: isCurrentMonth ? .35 : 1 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {selectedEmp && (
              <div className="report-summary-row">
                <div className="report-stat"><div className="report-stat-val green">{summary.present}</div><div>Present</div></div>
                <div className="report-stat"><div className="report-stat-val red">{summary.absent}</div><div>Absent</div></div>
                <div className="report-stat"><div className="report-stat-val orange">{summary.late}</div><div>Late</div></div>
                <div className="report-stat"><div className="report-stat-val red">{summary.veryLate}</div><div>Very Late</div></div>
                <div className="report-stat"><div className="report-stat-val blue">{formatDuration(summary.avgMs)}</div><div>Avg Hours</div></div>
              </div>
            )}

            {selectedEmp ? (
              loading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>Loading...</div>
              ) : monthHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
                  No records found for {monthLabel(year, month)}
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th><th>Entry</th><th>Exit</th><th>Presence</th>
                        <th>Break</th><th>Work Hours</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthHistory.map(h => {
                        if (h.status === 'WEEKEND') return (
                          <tr key={h.date} style={{ background: '#f8fafc', opacity: 0.6 }}>
                            <td className="text-nowrap" style={{ borderLeft: '3px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>{formatDateLabel(h.date)}</td>
                            <td colSpan={6} style={{ textAlign: 'center' }}>
                              <span style={{ fontSize: 12, color: '#94a3b8', background: '#f1f5f9', padding: '3px 10px', borderRadius: 6, fontWeight: 600 }}>Weekend</span>
                            </td>
                          </tr>
                        )
                        const isTodayRow = h.date === todayStr
                        const ws = getDisplayStatus(h, isTodayRow)
                        const wHoursStyle = ws && !isTodayRow ? { color: ws.color } : {}
                        const rs = rowStyle(h, isTodayRow)
                        return (
                          <tr key={h.date} style={{ background: rs.trBg }}>
                            <td className="text-nowrap" style={{ borderLeft: `3px solid ${rs.tdBorder}` }}>
                              {formatDateLabel(h.date)}
                            </td>
                            <td>{h.entryTime
                              ? <div className="ta-time-box" style={
                                  h.lateStatus === 'VERY_LATE' ? { background: '#fff1f2', color: '#ef4444', borderColor: '#fecdd3' }
                                  : h.lateStatus === 'LATE' ? { background: '#fff7ed', color: '#f97316', borderColor: '#fed7aa' }
                                  : { background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }
                                }>{h.entryTime}</div>
                              : '--'}</td>
                            <td>{h.exitTime || '--'}</td>
                            <td>{(() => {
                              const pms = (h.workTotal || 0) + (h.breakTotal || 0) + (h.lunchTotal || 0)
                              return pms > 0 ? formatDuration(pms) : '--'
                            })()}</td>
                            <td>{(h.breakTotal + h.lunchTotal) > 0 ? formatDuration(h.breakTotal + h.lunchTotal) : '--'}</td>
                            <td><span className="ta-shift-duration" style={wHoursStyle}>{h.workTotal ? formatDuration(h.workTotal) : '--'}</span></td>
                            <td>
                              {canOverride(h)
                                ? <StatusCell h={h} onOverride={handleOverride} saving={savingRow === h.date} isToday={isTodayRow} />
                                : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
                Search and select an employee to view their attendance report
              </div>
            )}
          </>
        )}

        {/* ── DAILY ALL EMPLOYEES VIEW ── */}
        {viewMode === 'daily' && (
          <>
            {/* Sub-header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 12px', padding: '10px 14px',
              background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              {dailySubView === 'day' ? (
                <>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    Showing attendance for <strong style={{ color: '#1e293b' }}>{new Date(dailyDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                  </div>
                  {!dailyLoading && (
                    <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#64748b', background: '#e2e8f0', padding: '3px 10px', borderRadius: 20 }}>
                      {filteredDailyRecords.filter(r => r.id).length} present · {filteredDailyRecords.filter(r => !r.id).length} absent
                    </span>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    Monthly summary for <strong style={{ color: '#1e293b' }}>{monthLabel(allYear, allMonth)}</strong>
                  </div>
                  {!monthAllLoading && (
                    <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: '#64748b', background: '#e2e8f0', padding: '3px 10px', borderRadius: 20 }}>
                      {filteredMonthAll.length} employees
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Month view table */}
            {dailySubView === 'month' && (
              monthAllLoading ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>Loading...</div>
              ) : monthAllData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>No data</div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th style={{ textAlign: 'center' }}>Present</th>
                        <th style={{ textAlign: 'center' }}>Absent</th>
                        <th style={{ textAlign: 'center' }}>Leave</th>
                        <th style={{ textAlign: 'center' }}>Late</th>
                        <th style={{ textAlign: 'center' }}>Very Late</th>
                        <th style={{ textAlign: 'right' }}>Total Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMonthAll.map(({ emp, present, absent, leave, late, veryLate, totalWorkMs }) => (
                        <tr key={emp.id}>
                          <td style={{ borderLeft: `3px solid ${present > 0 ? '#059669' : '#94a3b8'}` }}>
                            <div className="table-emp-cell">
                              <div className="table-avatar">{(emp.name || '?').slice(0,2).toUpperCase()}</div>
                              <div>
                                <div className="table-emp-name">{emp.name}</div>
                                <div className="table-emp-id">{emp.id}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{emp.dept || '--'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: '#059669' }}>{present}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: absent > 0 ? '#dc2626' : '#94a3b8' }}>{absent}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: leave > 0 ? '#7c3aed' : '#94a3b8' }}>{leave}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: late > 0 ? '#f97316' : '#94a3b8' }}>{late}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: veryLate > 0 ? '#ef4444' : '#94a3b8' }}>{veryLate}</span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="ta-shift-duration" style={{ color: totalWorkMs > 0 ? '#059669' : '#94a3b8' }}>
                              {totalWorkMs > 0 ? formatDuration(totalWorkMs) : '--'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Day view table */}
            {dailySubView === 'day' && (dailyLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>Loading...</div>
            ) : allDailyRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>
                No attendance records found for this date
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th><th>Department</th><th>Entry</th><th>Exit</th>
                      <th>Break</th><th>Work Hours</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDailyRecords.map((h, i) => {
                      const isAbsentRow = !h.id && h.status === 'ABSENT'
                      const isTodayRow  = dailyDate === todayStr
                      const rs = rowStyle(h, isTodayRow)
                      return (
                        <tr key={`${h.employeeId}-${i}`} style={{ background: rs.trBg, opacity: isAbsentRow ? 0.8 : 1 }}>
                          <td style={{ borderLeft: `3px solid ${rs.tdBorder}` }}>
                            <div className="table-emp-cell">
                              <div className="table-avatar" style={isAbsentRow ? { background: '#e2e8f0', color: '#94a3b8' } : {}}>
                                {(h.employeeName || '?').slice(0,2).toUpperCase()}
                              </div>
                              <div>
                                <div className="table-emp-name">{h.employeeName}</div>
                                <div className="table-emp-id">{h.employeeId}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{h.dept || '--'}</td>
                          <td>{h.entryTime
                            ? <div className="ta-time-box" style={
                                h.lateStatus === 'VERY_LATE' ? { background: '#fff1f2', color: '#ef4444', borderColor: '#fecdd3' }
                                : h.lateStatus === 'LATE' ? { background: '#fff7ed', color: '#f97316', borderColor: '#fed7aa' }
                                : { background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }
                              }>{h.entryTime}</div>
                            : '--'}</td>
                          <td>{h.exitTime || '--'}</td>
                          <td>{(h.breakTotal + h.lunchTotal) > 0 ? formatDuration(h.breakTotal + h.lunchTotal) : '--'}</td>
                          <td><span className="ta-shift-duration" style={h.workTotal && !isTodayRow ? { color: getDisplayStatus(h, isTodayRow)?.color } : {}}>
                            {h.workTotal ? formatDuration(h.workTotal) : '--'}
                          </span></td>
                          <td>
                            {isAbsentRow
                              ? <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6 }}>Absent</span>
                              : <StatusCell h={h} onOverride={handleOverride} saving={savingRow === h.date} isToday={isTodayRow} />}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </>
        )}

      </div>
    </div>
  )
}
