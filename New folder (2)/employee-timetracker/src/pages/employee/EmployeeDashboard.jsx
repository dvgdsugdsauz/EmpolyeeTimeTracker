import { useState, useEffect } from 'react'
import { STATUS_META, getLateLabel, getLiveWorkTotal, getLiveOutsideTotal, workStatus } from '../../utils/attendanceLogic'
import { formatDurationHHMMSS, formatDuration, formatTime12 } from '../../utils/timeUtils'
import * as api from '../../services/api'

const USE_API = Boolean(import.meta.env.VITE_API_URL)
const TARGET_MS = 30600000 // 8h 30m

const CHART_COLORS = {
  'Full Day':     'linear-gradient(180deg,#34d399 0%,#059669 100%)',
  'Half Day':     'linear-gradient(180deg,#fcd34d 0%,#d97706 100%)',
  'Early Logoff': 'linear-gradient(180deg,#fdba74 0%,#ea580c 100%)',
  'Short':        'linear-gradient(180deg,#fb7185 0%,#e11d48 100%)',
  'Absent':       'linear-gradient(180deg,#e2e8f0 0%,#cbd5e1 100%)',
  'Leave':        'linear-gradient(180deg,#c4b5fd 0%,#7c3aed 100%)',
  'Holiday':      'linear-gradient(180deg,#7dd3fc 0%,#0284c7 100%)',
}

const CHART_DOT_COLORS = {
  'Full Day':     '#059669',
  'Half Day':     '#d97706',
  'Early Logoff': '#ea580c',
  'Short':        '#e11d48',
  'Absent':       '#94a3b8',
  'Leave':        '#7c3aed',
  'Holiday':      '#0284c7',
}

const CHART_TEXT_COLORS = {
  'Full Day':     '#059669',
  'Half Day':     '#b45309',
  'Early Logoff': '#c2410c',
  'Short':        '#be123c',
  'Absent':       '#64748b',
  'Leave':        '#6d28d9',
  'Holiday':      '#0369a1',
}

function toHHMM(t) {
  if (!t) return null
  if (Array.isArray(t)) return `${String(t[0]).padStart(2,'0')}:${String(t[1]).padStart(2,'0')}`
  return String(t).slice(0, 5)
}

function mapH(s) {
  const raw = s.status || 'ABSENT'
  return {
    ...s,
    status:    (raw === 'OFFLINE' && s.entryTime) ? 'PRESENT' : raw,
    entryTime: toHHMM(s.entryTime),
    exitTime:  toHHMM(s.exitTime),
  }
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function getBarInfo(h) {
  const work = h.totalWorkMs || 0
  const isPresent = h.status === 'PRESENT' || (h.entryTime && work > 0)

  if (h.overrideStatus) {
    const bg  = CHART_COLORS[h.overrideStatus] || CHART_COLORS['Absent']
    const dot = CHART_DOT_COLORS[h.overrideStatus] || '#94a3b8'
    const pct = work > 0 ? Math.max(8, Math.min(100, (work / TARGET_MS) * 100)) : 8
    return { color: bg, dot, label: h.overrideStatus, pct, showDuration: work > 0 }
  }

  if (isPresent && work > 0) {
    const pct   = Math.max(8, Math.min(100, (work / TARGET_MS) * 100))
    const key   = workStatus(work)?.label ?? 'Short'
    return { color: CHART_COLORS[key], dot: CHART_DOT_COLORS[key], label: key, pct, showDuration: true }
  }

  if (h.status === 'ABSENT')  return { color: CHART_COLORS['Absent'],  dot: CHART_DOT_COLORS['Absent'],  label: 'Absent',  pct: 0, showDuration: false }
  if (h.status === 'HOLIDAY') return { color: CHART_COLORS['Holiday'], dot: CHART_DOT_COLORS['Holiday'], label: 'Holiday', pct: 8, showDuration: false }

  const dow = h.date ? new Date(h.date + 'T00:00:00').getDay() : -1
  if (dow === 0 || dow === 6) return { color: '#f1f5f9', dot: '#e2e8f0', label: 'Weekend', pct: 0, showDuration: false }

  return { color: '#e2e8f0', dot: '#cbd5e1', label: '', pct: 0, showDuration: false }
}

function StatCard({ label, value, sub, active, activeColor, activeBg, activeBorder, icon }) {
  return (
    <div style={{
      background: active ? activeBg : '#fff',
      borderRadius: 14,
      border: `1px solid ${active ? activeBorder : '#e2e8f0'}`,
      padding: '12px 14px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: active ? activeColor : '#f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          {icon(active)}
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums', color: active ? activeColor : '#0f172a' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600, color: active ? activeColor : '#94a3b8' }}>{sub}</div>}
    </div>
  )
}

function BarTooltip({ h, label, color, dotColor, textColor, showDuration }) {
  const date = new Date(h.date + 'T00:00:00')
  const dateStr = date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  const isLate = h.lateStatus === 'LATE' || h.lateStatus === 'VERY_LATE'

  return (
    <div style={{
      position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
      transform: 'translateX(-50%)', zIndex: 100,
      background: '#1e293b', color: '#f8fafc',
      borderRadius: 10, padding: '10px 13px',
      minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      fontSize: 12, whiteSpace: 'nowrap', pointerEvents: 'none',
    }}>
      {/* Arrow */}
      <div style={{
        position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid #1e293b',
      }}/>
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#e2e8f0' }}>{dateStr}</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', marginBottom: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }}/>
        <span style={{ fontWeight: 700, color: dotColor, fontSize: 11 }}>{label || '—'}</span>
      </div>
      {showDuration && h.totalWorkMs > 0 && (
        <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: isLate ? 4 : 0 }}>
          Work: <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{formatDuration(h.totalWorkMs)}</span>
        </div>
      )}
      {h.entryTime && (
        <div style={{ color: '#94a3b8', fontSize: 11 }}>
          In: <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{h.entryTime}</span>
          {h.exitTime && <> &nbsp;Out: <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{h.exitTime}</span></>}
        </div>
      )}
      {isLate && (
        <div style={{ marginTop: 4, fontSize: 10, fontWeight: 700, color: h.lateStatus === 'VERY_LATE' ? '#f87171' : '#fb923c' }}>
          {h.lateStatus === 'VERY_LATE' ? '⚠ Very Late' : '⚠ Late'}
        </div>
      )}
    </div>
  )
}

export default function EmployeeDashboard({ user, attendance }) {
  const [now, setNow]           = useState(Date.now())
  const [history, setHistory]   = useState([])
  const [punches, setPunches]   = useState([])
  const [hoveredBar, setHovered] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!USE_API) return
    api.fetchMyHistory(15).then(list => setHistory(list.map(mapH))).catch(() => {})
    api.fetchTodayPunches().then(setPunches).catch(() => {})
  }, [])

  useEffect(() => {
    if (!USE_API || !attendance) return
    api.fetchTodayPunches().then(setPunches).catch(() => {})
  }, [attendance?.status, attendance?.lastPunchIn?.toString(), attendance?.lastPunchOut?.toString()])

  if (!attendance) return (
    <div className="page-content">
      <div className="empty-state"><p>No attendance data found.</p></div>
    </div>
  )

  const meta      = STATUS_META[attendance.status] || STATUS_META.NOT_ARRIVED
  const lateInfo  = attendance.lateStatus ? getLateLabel(attendance.lateStatus) : null
  const workMs    = getLiveWorkTotal(attendance, now)
  const { break: breakMs } = getLiveOutsideTotal(attendance, now)
  const pendingMs = Math.max(0, TARGET_MS - workMs)
  const isDone    = pendingMs <= 0 && workMs > 0

  const isWorking    = attendance.status === 'WORKING'
  const isOnBreak    = attendance.status === 'BREAK' || attendance.status === 'LUNCH'
  const isNotArrived = attendance.status === 'NOT_ARRIVED'

  const d     = new Date(now)
  const todayStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const clock = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const date  = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="page-content" style={{ padding: '12px 16px' }}>

      {/* ── Header Card ── */}
      <div style={{
        background: '#fff', borderRadius: 14,
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        padding: '14px 18px',
        marginBottom: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        {/* Left: avatar + name + late badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: '#fff',
          }}>
            {user.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{greeting()}, {user.name.split(' ')[0]}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: 500 }}>
              {user.designation || user.dept || ''}
              {user.id && <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {user.id}</span>}
            </div>
            {lateInfo && lateInfo.label !== 'On Time' && (
              <span style={{
                display: 'inline-block', marginTop: 4,
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: lateInfo.bg, color: lateInfo.color,
              }}>{lateInfo.label}</span>
            )}
          </div>
        </div>

        {/* Right: clock + IN/OUT */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>{clock}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, marginBottom: 8 }}>{date}</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <div style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
              IN &nbsp;{attendance.entryTime ? formatTime12(attendance.entryTime) : '—'}
            </div>
            <div style={{
              padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
              background: isWorking ? '#f8fafc' : '#fff7ed',
              color:      isWorking ? '#94a3b8' : '#ea580c',
              border:     `1px solid ${isWorking ? '#e2e8f0' : '#fed7aa'}`,
            }}>
              OUT &nbsp;{isWorking ? '—' : attendance.lastPunchOut ? formatTime12(attendance.lastPunchOut) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── 3 Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 8 }}>
        <StatCard
          label="Work Time" value={formatDurationHHMMSS(workMs)}
          sub={isWorking ? '● Live' : null}
          active={isWorking} activeColor="#16a34a" activeBg="#f0fdf4" activeBorder="#a7f3d0"
          icon={a => (
            <svg viewBox="0 0 24 24" fill="none" stroke={a ? '#fff' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          )}
        />
        <StatCard
          label="Break Time" value={formatDurationHHMMSS(breakMs)}
          sub={isOnBreak ? '● On Break' : null}
          active={isOnBreak} activeColor="#ea580c" activeBg="#fff7ed" activeBorder="#fed7aa"
          icon={a => (
            <svg viewBox="0 0 24 24" fill="none" stroke={a ? '#fff' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
            </svg>
          )}
        />
        <StatCard
          label={isDone ? 'Target Done' : 'Remaining'} value={isDone ? 'Complete' : formatDurationHHMMSS(pendingMs)}
          sub={isDone ? '● Goal reached' : null}
          active={isDone} activeColor="#16a34a" activeBg="#f0fdf4" activeBorder="#a7f3d0"
          icon={a => (
            <svg viewBox="0 0 24 24" fill="none" stroke={a ? '#fff' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              {isDone ? <polyline points="20 6 9 17 4 12"/> : <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
            </svg>
          )}
        />
      </div>

      {/* ── Today's Timeline ── */}
      {punches.length > 0 && (
        <div className="section-card" style={{ marginBottom: 8 }}>
          <div className="section-header" style={{ padding: '12px 16px' }}>
            <h3 style={{ margin: 0, fontSize: 14 }}>Today's Timeline</h3>
            <span className="section-count">{punches.length} punches</span>
          </div>
          <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {punches.map((p, i) => {
              const isIn = p.state === 'IN'
              const isLast = i === punches.length - 1
              return (
                <div key={i} style={{ display: 'flex', gap: 16, position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: isIn ? '#22c55e' : '#f97316',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '3px solid #fff', boxShadow: `0 0 0 2px ${isIn ? '#22c55e' : '#f97316'}20`,
                      zIndex: 1, flexShrink: 0,
                    }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
                        {isIn
                          ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
                          : <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 5 19 12"/></>}
                      </svg>
                    </div>
                    {!isLast && <div style={{ width: 2, flex: 1, background: '#f1f5f9', minHeight: 16, marginTop: 2 }}/>}
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', paddingBottom: isLast ? 0 : 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isIn ? '#16a34a' : '#ea580c' }}>
                      {isIn ? 'Punched In' : 'Punched Out'}
                    </span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#374151', fontVariantNumeric: 'tabular-nums' }}>
                      {formatTime12(p.time)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Last 15 Days Chart ── */}
      <div className="section-card" style={{ overflow: 'visible' }}>
        <div className="section-header" style={{ padding: '12px 16px' }}>
          <h3 style={{ margin: 0, fontSize: 14 }}>Last 15 Days</h3>
        </div>
        <div style={{ padding: '4px 16px 14px' }}>
          {history.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>No history available.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(history.filter(h => h.date !== todayStr).length, 15)}, 1fr)`, gap: 4 }}>
              {history.filter(h => h.date !== todayStr).slice(0, 15).map((h, i) => {
                const { color, dot, label, pct, showDuration } = getBarInfo(h)
                const textColor    = CHART_TEXT_COLORS[label] || dot
                const isWeekendDay = label === 'Weekend'
                const dayLabel = new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })
                const dayNum   = new Date(h.date + 'T00:00:00').getDate()
                const isHovered = hoveredBar === h.date

                return (
                  <div
                    key={h.date}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, opacity: isWeekendDay ? 0.35 : 1, position: 'relative', cursor: isWeekendDay ? 'default' : 'pointer' }}
                    onMouseEnter={() => !isWeekendDay && setHovered(h.date)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {/* Tooltip */}
                    {isHovered && !isWeekendDay && (
                      <BarTooltip h={h} label={label} color={color} dotColor={dot} textColor={textColor} showDuration={showDuration} />
                    )}
                    {/* Bar container */}
                    <div style={{ width: '100%', height: 160, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      {pct > 0 ? (
                        <div
                          className="bar-grow"
                          style={{
                            width: '72%', borderRadius: '5px 5px 0 0',
                            height: `${pct}%`, minHeight: 6,
                            background: color,
                            opacity: isHovered ? 0.8 : 1,
                            boxShadow: isHovered ? `0 4px 16px ${dot}55` : `0 2px 8px ${dot}33`,
                            animationDelay: `${i * 0.04}s`,
                          }}/>
                      ) : (
                        <div style={{ width: '72%', height: 2, background: '#f1f5f9', borderRadius: 2 }}/>
                      )}
                    </div>
                    {/* Base line */}
                    <div style={{ width: '100%', height: 1, background: '#e2e8f0' }}/>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{dayNum}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{dayLabel}</div>
                    {showDuration && h.totalWorkMs > 0 && (
                      <div style={{ fontSize: 10, color: textColor, fontWeight: 700, textAlign: 'center' }}>
                        {formatDuration(h.totalWorkMs)}
                      </div>
                    )}
                    {!showDuration && label && !isWeekendDay && (
                      <div style={{ fontSize: 10, color: textColor, fontWeight: 600, textAlign: 'center' }}>{label}</div>
                    )}
                    {(h.lateStatus === 'LATE' || h.lateStatus === 'VERY_LATE') && showDuration && (
                      <div style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
                        background: h.lateStatus === 'LATE' ? '#fff7ed' : '#fff1f2',
                        color:      h.lateStatus === 'LATE' ? '#f97316' : '#ef4444',
                      }}>
                        {h.lateStatus === 'LATE' ? 'Late' : 'V.Late'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
