import { useState, useEffect, useMemo, useCallback } from 'react'
import { STATUS_META, getLiveWorkTotal, getLiveOutsideTotal, getPendingMs, getOvertimeMs, checkMissPunch, workStatus } from '../../utils/attendanceLogic'
import { formatTime12, formatDuration, formatDurationHHMMSS } from '../../utils/timeUtils'
import * as api from '../../services/api'

function EmployeePunchModal({ emp, att, now, onClose, date, isToday, histSummary, canAddPunch }) {
  const [punches, setPunches]       = useState(null)
  const [punchError, setPunchError] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addTime, setAddTime]         = useState('')
  const [addState, setAddState]       = useState(0)   // 0=IN, 1=OUT
  const [addSaving, setAddSaving]     = useState(false)
  const [addError, setAddError]       = useState('')

  const load = useCallback(() => {
    if (!USE_API || !emp) return
    const p = isToday
      ? api.fetchEmployeeTodayPunches(emp.id)
      : api.fetchEmployeePunchesByDate(emp.id, date)
    p.then(data => { setPunches(data); setPunchError(false) })
     .catch(() => { setPunchError(true); setPunches([]) })
  }, [emp?.id, date, isToday])

  useEffect(() => {
    load()
    const t = isToday ? setInterval(load, 8000) : null
    return () => { if (t) clearInterval(t) }
  }, [load, isToday])

  // Close on backdrop click
  const onBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }

  const isMissPunch = att ? checkMissPunch(att) : false
  const meta     = isToday
    ? (STATUS_META[isMissPunch ? 'MISS_PUNCH' : (att?.status || 'NOT_ARRIVED')] || STATUS_META.NOT_ARRIVED)
    : (HIST_STATUS_META[histSummary?.status || 'ABSENT'] || HIST_STATUS_META.ABSENT)
  const workMs   = isToday ? (att ? getLiveWorkTotal(att, now) : 0) : (histSummary?.totalWorkMs || 0)
  const { break: breakMs } = isToday ? (att ? getLiveOutsideTotal(att, now) : { break: 0 }) : { break: (histSummary?.totalBreakMs || 0) + (histSummary?.totalLunchMs || 0) }
  const pendingMs = isToday ? (att ? getPendingMs(att, now) : 0) : 0

  // Parse a Java LocalDateTime (array or ISO string) to ms for comparison
  function parseTimeMs(t) {
    if (!t) return 0
    if (Array.isArray(t)) return new Date(t[0], t[1]-1, t[2], t[3]||0, t[4]||0, t[5]||0).getTime()
    return new Date(t).getTime()
  }

  // Build a fallback timeline from live status fields when raw API returns empty
  function derivePunchesFromAtt(a) {
    if (!a?.entryTime) return []
    const events = []
    const entMs    = parseTimeMs(a.entryTime)
    const lastInMs = parseTimeMs(a.lastPunchIn)
    const lastOutMs= parseTimeMs(a.lastPunchOut)

    events.push({ time: a.entryTime, state: 'IN' })

    if (lastOutMs > entMs) {
      events.push({ time: a.lastPunchOut, state: 'OUT' })
    }
    if (lastInMs > entMs && lastInMs > lastOutMs) {
      events.push({ time: a.lastPunchIn, state: 'IN' })
    }
    return events
  }

  // Build minimal timeline from histSummary entry/exit (historical fallback only)
  function derivePunchesFromHist(s) {
    if (!s?.entryTime) return []
    const events = []
    events.push({ time: s.entryTime, state: 'IN' })
    if (s.exitTime) events.push({ time: s.exitTime, state: 'OUT' })
    return events
  }

  // Use API data if available; for today fall back to live status, for history fall back to summary entry/exit
  const loading        = punches === null
  const rawPunches     = punches ?? []
  const displayPunches = rawPunches.length > 0
    ? rawPunches
    : (isToday ? derivePunchesFromAtt(att) : derivePunchesFromHist(histSummary))
  const isDerived = rawPunches.length === 0 && displayPunches.length > 0

  async function handleAddPunch() {
    if (!addTime) { setAddError('Enter a time'); return }
    setAddSaving(true); setAddError('')
    try {
      await api.addManualPunch(emp.id, date, addTime, addState)
      setShowAddForm(false); setAddTime(''); setAddState(0)
      load()   // refresh timeline
    } catch (e) {
      setAddError('Failed to save punch')
    } finally {
      setAddSaving(false)
    }
  }

  function toLocalTime(t) {
    if (!t) return '—'
    let h, m
    if (Array.isArray(t)) {
      // LocalTime: [h, m, s]  vs  LocalDateTime: [year, month, day, h, m, s]
      if (t.length <= 3) { h = t[0] ?? 0; m = t[1] ?? 0 }
      else               { h = t[3] ?? 0; m = t[4] ?? 0 }
    } else {
      const s = String(t)
      const part = s.includes('T') ? s.slice(11, 16) : s.slice(0, 5)
      const sp = part.split(':')
      h = parseInt(sp[0]); m = parseInt(sp[1])
    }
    if (isNaN(h) || isNaN(m)) return '—'
    return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h >= 12 ? 'PM' : 'AM'}`
  }

  return (
    <div onClick={onBackdrop} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 18, width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1e293b, #334155)',
          padding: '18px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: '#fff',
            }}>{emp.avatar || emp.name.slice(0,2).toUpperCase()}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>{emp.name}</div>
              {emp.designation && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{emp.designation}</div>}
              <div style={{ fontSize: 11, color: '#64748b' }}>{emp.dept} · {emp.id}</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.1)', color: '#94a3b8',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, lineHeight: 1,
          }}>×</button>
        </div>

        {/* Live stats */}
        <div style={{ padding: '14px 20px', display: 'flex', gap: 0, borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Status</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: meta.bg, fontSize: 12, fontWeight: 700, color: meta.color }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.dot, flexShrink: 0,
                animation: att?.status === 'WORKING' ? 'pulse 1.5s infinite' : 'none' }}/>
              {meta.label}
            </div>
          </div>
          <div style={{ width: 1, background: '#f1f5f9', margin: '0 4px' }}/>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Work</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: workMs > 0 ? '#16a34a' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{formatDurationHHMMSS(workMs)}</div>
          </div>
          <div style={{ width: 1, background: '#f1f5f9', margin: '0 4px' }}/>
          <div style={{ flex: 1, textAlign: 'center', minWidth: 80 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Break</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: breakMs > 0 ? '#f97316' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{breakMs > 0 ? formatDuration(breakMs) : '—'}</div>
          </div>
          <div style={{ width: 1, background: '#f1f5f9', margin: '0 4px' }}/>
          {isToday && (
            <div style={{ flex: 1, textAlign: 'center', minWidth: 80 }}>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Remaining</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: pendingMs > 0 ? '#ef4444' : '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                {pendingMs > 0 ? formatDurationHHMMSS(pendingMs) : 'Done'}
              </div>
            </div>
          )}
        </div>

        {/* Punch Timeline */}
        <div style={{ padding: '14px 20px 20px', maxHeight: 340, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {isToday ? "Today's Timeline" : new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {isDerived && (
                <span style={{ fontSize: 10, color: '#94a3b8', background: '#f1f5f9', borderRadius: 6, padding: '2px 7px' }}>
                  from live status
                </span>
              )}
              {canAddPunch && (
                <button onClick={() => { setShowAddForm(v => !v); setAddError('') }} style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 7,
                  border: '1px solid #6366f1', background: showAddForm ? '#6366f1' : '#fff',
                  color: showAddForm ? '#fff' : '#6366f1', cursor: 'pointer',
                }}>+ Add Punch</button>
              )}
            </div>
          </div>

          {/* Add Punch Form */}
          {showAddForm && canAddPunch && (
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[{ v: 0, label: 'Punch In', color: '#059669', bg: '#f0fdf4' }, { v: 1, label: 'Punch Out', color: '#ea580c', bg: '#fff7ed' }].map(o => (
                    <button key={o.v} onClick={() => setAddState(o.v)} style={{
                      padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                      border: `1px solid ${addState === o.v ? o.color : '#e2e8f0'}`,
                      background: addState === o.v ? o.bg : '#fff',
                      color: addState === o.v ? o.color : '#94a3b8', cursor: 'pointer',
                    }}>{o.label}</button>
                  ))}
                </div>
                <input
                  type="time"
                  value={addTime}
                  onChange={e => setAddTime(e.target.value)}
                  style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }}
                />
                <button onClick={handleAddPunch} disabled={addSaving} style={{
                  padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                  background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer', opacity: addSaving ? 0.7 : 1,
                }}>{addSaving ? 'Saving…' : 'Save'}</button>
              </div>
              {addError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{addError}</div>}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>
              Loading timeline…
            </div>
          ) : displayPunches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8', fontSize: 13 }}>
              {punchError ? 'Could not load timeline data' : 'No punches recorded today'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {displayPunches.map((p, i) => {
                const isIn   = p.state === 'IN'
                const isLast = i === displayPunches.length - 1
                let segDuration = null
                if (!isLast) {
                  segDuration = Math.max(0, parseTimeMs(displayPunches[i+1].time) - parseTimeMs(p.time))
                }

                return (
                  <div key={i} style={{ display: 'flex', gap: 14 }}>
                    {/* Timeline spine */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: isIn ? '#059669' : '#ea580c',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 0 0 3px ${isIn ? '#d1fae5' : '#ffedd5'}`,
                        zIndex: 1, flexShrink: 0,
                      }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                          {isIn
                            ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
                            : <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 5 19 12"/></>}
                        </svg>
                      </div>
                      {!isLast && (
                        <div style={{
                          width: 2, flex: 1, minHeight: 24, marginTop: 2,
                          background: isIn ? '#d1fae5' : '#ffedd5',
                        }}/>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, paddingBottom: isLast ? 0 : 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isIn ? '#059669' : '#ea580c' }}>
                          {isIn ? 'Punch In' : 'Punch Out'}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                          {toLocalTime(p.time)}
                        </span>
                      </div>
                      {segDuration !== null && segDuration > 0 && (
                        <div style={{
                          marginTop: 4, fontSize: 11, color: '#94a3b8',
                          padding: '2px 8px', background: '#f8fafc', borderRadius: 6,
                          display: 'inline-block',
                        }}>
                          {isIn ? 'Worked' : 'Break'}: {formatDuration(segDuration)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Live pulse tail if last event was IN and employee is working TODAY */}
              {isToday && displayPunches[displayPunches.length - 1]?.state === 'IN' && att?.status === 'WORKING' && (
                <div style={{ display: 'flex', gap: 14 }}>
                  <div style={{ width: 28, display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e',
                      boxShadow: '0 0 0 4px #dcfce7', animation: 'pulse 1.5s infinite', marginTop: 8 }}/>
                  </div>
                  <div style={{ paddingTop: 6, fontSize: 12, color: '#059669', fontWeight: 600 }}>Still working…</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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


export default function ManagerDashboard({ users, attendance, myAttendance, currentUser, onApproveOffline, defaultStatusFilter }) {
  const [search, setSearch]         = useState('')
  const [deptFilter, setDeptFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState(defaultStatusFilter || 'All')
  const [now, setNow]               = useState(Date.now())
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [histData, setHistData]     = useState(null)
  const [histLoading, setHistLoading] = useState(false)
  const [selectedEmp, setSelectedEmp] = useState(null)

  const isToday = selectedDate === todayStr()

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

  const employees   = useMemo(() => users, [users])
  const attMap      = useMemo(() => Object.fromEntries(attendance.map(a => [a.employeeId, a])), [attendance])
  const departments = useMemo(() => ['All', ...new Set(employees.map(e => e.dept))], [employees])

  // For historical view: build a map empId → summaryDto
  const histMap = useMemo(() => {
    if (!histData) return {}
    return Object.fromEntries(histData.map(s => [s.employeeId, s]))
  }, [histData])

  const filtered = useMemo(() => {
    const list = employees.filter(emp => {
      const att = isToday ? attMap[emp.id] : histMap[emp.id]
      const matchSearch = !search || emp.name.toLowerCase().includes(search.toLowerCase()) || emp.id.toLowerCase().includes(search.toLowerCase())
      const matchDept   = deptFilter === 'All' || emp.dept === deptFilter
      const curStatus   = isToday ? att?.status : (histMap[emp.id]?.status || 'ABSENT')
      const matchStatus = statusFilter === 'All'
        || curStatus === statusFilter
        || (statusFilter === 'BREAK' && curStatus === 'LUNCH')
      return matchSearch && matchDept && matchStatus
    })
    if (!isToday) return list
    // Sort: arrived employees by entry time descending (latest first), NOT_ARRIVED at bottom
    return [...list].sort((a, b) => {
      const attA = attMap[a.id], attB = attMap[b.id]
      const noA = !attA || attA.status === 'NOT_ARRIVED'
      const noB = !attB || attB.status === 'NOT_ARRIVED'
      if (noA && noB) return 0
      if (noA) return 1
      if (noB) return -1
      const tA = attA.entryTime ? new Date(attA.entryTime).getTime() : 0
      const tB = attB.entryTime ? new Date(attB.entryTime).getTime() : 0
      return tB - tA
    })
  }, [employees, attMap, histMap, search, deptFilter, statusFilter, isToday])

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
  const { break: myBreakMs } = myAttendance ? getLiveOutsideTotal(myAttendance, now) : { break: 0 }
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
                <option value="BREAK">On Break</option>
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
                  <th>Status</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>{isToday ? 'Worked' : 'Hours'}</th>
                  <th>Break</th>
                  {!isToday && <th>Status</th>}
                  <th>{isToday ? 'Remaining' : 'Presence'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => {
                  if (!isToday) {
                    // Historical row
                    const s    = histMap[emp.id]
                    const meta = HIST_STATUS_META[s?.status] || HIST_STATUS_META.ABSENT
                    return (
                      <tr key={emp.id} className="ta-row" onClick={() => setSelectedEmp(emp)} style={{ cursor: 'pointer' }}>
                        <td style={(s?.totalWorkMs > 0 && s?.totalWorkMs < 34200000) ? { borderLeft: '3px solid #f97316' } : {}}>
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
                        <td><div className="status-dot-badge" style={{ background: meta.bg, color: meta.color }}><span className="sdot" style={{ background: meta.dot }}/>{meta.label}</div></td>
                        <td>{s?.entryTime ? <div className="ta-time-box" style={
                            s?.lateStatus === 'VERY_LATE' ? { background: '#fff1f2', color: '#ef4444', borderColor: '#fecdd3' }
                            : s?.lateStatus === 'LATE'     ? { background: '#fff7ed', color: '#f97316', borderColor: '#fed7aa' }
                            : { background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }
                          }>{formatLocalTime(s.entryTime)}</div> : <span className="ta-dash">—</span>}</td>
                        <td>{s?.exitTime  ? <div className="ta-time-box ta-time-normal">{formatLocalTime(s.exitTime)}</div>  : <span className="ta-dash">—</span>}</td>
                        <td><span className="ta-shift-duration" style={s?.totalWorkMs > 0 ? { color: workStatus(s.totalWorkMs)?.color ?? '#6b7280' } : {}}>{s?.totalWorkMs > 0 ? formatDuration(s.totalWorkMs) : '—'}</span></td>
                        <td>{(() => {
                            const bms = (s?.totalBreakMs||0) + (s?.totalLunchMs||0)
                            return bms > 0 ? (
                              <button onClick={(e) => { e.stopPropagation(); setSelectedEmp(emp) }} style={{
                                background: 'none', border: 'none', padding: 0,
                                color: '#ea580c', fontWeight: 600, fontSize: 13,
                                cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3,
                              }}>{formatDuration(bms)}</button>
                            ) : <span className="ta-dash">—</span>
                          })()}</td>
                        <td>
                          {(() => { const ws = workStatus(s?.totalWorkMs); return ws ? <span className="late-tag" style={{ color: ws.color, background: ws.bg }}>{ws.label}</span> : <span className="ta-dash">—</span> })()}
                        </td>
                        <td>{(() => {
                            const pms = (s?.totalWorkMs||0) + (s?.totalBreakMs||0) + (s?.totalLunchMs||0)
                            return pms > 0 ? <span className="ta-shift-duration">{formatDuration(pms)}</span> : <span className="ta-dash">—</span>
                          })()}</td>
                      </tr>
                    )
                  }

                  // Live row
                  const att      = attMap[emp.id]
                  const isMissPunch = att ? checkMissPunch(att) : false
                  const meta     = STATUS_META[isMissPunch ? 'MISS_PUNCH' : (att?.status || 'NOT_ARRIVED')] || STATUS_META.NOT_ARRIVED
                  const workMs   = att ? getLiveWorkTotal(att, now) : 0
                  const { break: breakMs } = att ? getLiveOutsideTotal(att, now) : { break: 0 }
                  const pendingMs  = att ? getPendingMs(att, now) : 0
                  const overtimeMs = att ? getOvertimeMs(att, now) : 0
                  return (
                    <tr key={emp.id} className="ta-row" onClick={() => setSelectedEmp(emp)} style={{ cursor: 'pointer' }}>
                      <td style={workMs > 0 && workMs < 34200000 ? { borderLeft: '3px solid #f97316' } : {}}>
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
                      <td><div className="status-dot-badge" style={{ background: meta.bg, color: meta.color }}><span className="sdot" style={{ background: meta.dot }}/>{meta.label}</div></td>
                      <td>
                        {att?.entryTime
                          ? <div className="ta-time-box" style={
                              att?.lateStatus === 'VERY_LATE' ? { background: '#fff1f2', color: '#ef4444', borderColor: '#fecdd3' }
                              : att?.lateStatus === 'LATE'     ? { background: '#fff7ed', color: '#f97316', borderColor: '#fed7aa' }
                              : { background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }
                            }>{formatTime12(att.entryTime)}</div>
                          : <span className="ta-dash">—</span>}
                      </td>
                      <td>
                        {att?.status === 'WORKING'
                          ? <span className="ta-live-pill">Live</span>
                          : att?.lastPunchOut
                            ? <div className="ta-time-box ta-time-normal">{formatTime12(att.lastPunchOut)}</div>
                            : <span className="ta-dash">—</span>}
                      </td>
                      <td><span className={`ta-shift-duration ${
                        att?.status === 'WORKING' ? 'ta-shift-ok' :
                        (att?.status === 'BREAK' || att?.status === 'LUNCH') ? 'ta-shift-warn' :
                        att?.status === 'MISS_PUNCH' ? 'ta-shift-warn' :
                        workMs >= 34200000 ? 'ta-shift-ok' :
                        workMs > 0 ? 'ta-shift-ot' : ''
                      }`}>{workMs > 0 ? formatDurationHHMMSS(workMs) : '—'}</span></td>
                      <td>
                        {['BREAK','LUNCH'].includes(att?.status) ? (
                          <span className="ta-dash">—</span>
                        ) : breakMs > 0 ? (
                          <button onClick={(e) => { e.stopPropagation(); setSelectedEmp(emp) }} style={{
                            background: 'none', border: 'none', padding: 0,
                            color: '#ea580c', fontWeight: 600, fontSize: 13,
                            cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3,
                          }}>
                            {formatDuration(breakMs)}
                          </button>
                        ) : (
                          <span className="ta-dash">—</span>
                        )}
                      </td>
                      <td>
                        {att?.entryTime
                          ? <span style={{ color: pendingMs > 0 ? '#ef4444' : '#16a34a', fontWeight: 600, fontSize: 13 }}>
                              {pendingMs > 0 ? formatDurationHHMMSS(pendingMs) : `+${formatDuration(overtimeMs)}`}
                            </span>
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

      {selectedEmp && (
        <EmployeePunchModal
          emp={selectedEmp}
          att={attMap[selectedEmp.id]}
          now={now}
          onClose={() => setSelectedEmp(null)}
          date={selectedDate}
          isToday={isToday}
          histSummary={histMap[selectedEmp.id]}
          canAddPunch={currentUser?.role === 'admin' || currentUser?.role === 'hr'}
        />
      )}
    </div>
  )
}
