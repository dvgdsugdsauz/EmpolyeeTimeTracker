import { useState, useEffect, useRef } from 'react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']
const pad    = n => String(n).padStart(2,'0')

function CalendarGrid({ viewYear, viewMonth, value, onSelect, maxDate, minDate }) {
  const todayD = new Date(); todayD.setHours(0,0,0,0)
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate()

  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:'#94a3b8', padding:'4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
        {Array.from({length: firstDay}, (_,i) => <div key={'e'+i}/>)}
        {Array.from({length: daysInMonth}, (_,i) => {
          const day = i+1
          const d = new Date(viewYear, viewMonth, day); d.setHours(0,0,0,0)
          const disabled  = (maxDate && d > maxDate) || (minDate && d < minDate)
          const isToday   = d.getTime() === todayD.getTime()
          const dateStr   = `${viewYear}-${pad(viewMonth+1)}-${pad(day)}`
          const selected  = dateStr === value
          return (
            <button key={day} onClick={() => !disabled && onSelect(dateStr)}
              style={{
                border:'none', borderRadius:8, padding:'7px 0', fontSize:13,
                fontWeight: selected||isToday ? 700 : 400,
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: selected ? '#4f9e6f' : 'none',
                color: disabled ? '#d1d5db' : selected ? '#fff' : isToday ? '#4f9e6f' : '#374151',
                outline: isToday && !selected ? '2px solid #4f9e6f' : 'none',
                outlineOffset: -2,
              }}
              onMouseEnter={e => { if (!disabled && !selected) e.currentTarget.style.background='#f0fdf4' }}
              onMouseLeave={e => { if (!selected) e.currentTarget.style.background='none' }}
            >{day}</button>
          )
        })}
      </div>
    </>
  )
}

function MonthNav({ viewYear, viewMonth, onPrev, onNext, canNext }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
      <button onClick={onPrev} style={{ background:'#f1f5f9', border:'none', borderRadius:7, width:30, height:30, cursor:'pointer', fontSize:16, color:'#475569', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
      <span style={{ fontWeight:700, fontSize:14, color:'#0f172a' }}>{MONTHS[viewMonth]} {viewYear}</span>
      <button onClick={onNext} style={{ background: canNext?'#f1f5f9':'none', border:'none', borderRadius:7, width:30, height:30, cursor: canNext?'pointer':'not-allowed', fontSize:16, color: canNext?'#475569':'#cbd5e1', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
    </div>
  )
}

/* ── Date-only picker ─────────────────────────────────── */
export function DatePicker({ value, onChange, max, min, placeholder = 'Select date…', accentColor = '#4f9e6f' }) {
  const [open, setOpen]         = useState(false)
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.slice(0,4)) : new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.slice(5,7))-1 : new Date().getMonth())
  const ref = useRef()

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (value) { setViewYear(parseInt(value.slice(0,4))); setViewMonth(parseInt(value.slice(5,7))-1) }
  }, [value])

  const maxDate = max ? new Date(max+'T00:00:00') : null
  const minDate = min ? new Date(min+'T00:00:00') : null
  const nowD = new Date()
  const canNext = !max || !(viewYear===parseInt(max.slice(0,4)) && viewMonth===parseInt(max.slice(5,7))-1)

  function prevMonth() {
    if (viewMonth===0){setViewMonth(11);setViewYear(y=>y-1)} else setViewMonth(m=>m-1)
  }
  function nextMonth() {
    if (!canNext) return
    if (viewMonth===11){setViewMonth(0);setViewYear(y=>y+1)} else setViewMonth(m=>m+1)
  }

  const display = value ? `${value.slice(8)}/${value.slice(5,7)}/${value.slice(0,4)}` : ''

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div onClick={() => setOpen(v=>!v)} style={{
        width:'100%', padding:'9px 12px', border:`1px solid ${open ? accentColor : (value ? '#6366f1' : '#e2e8f0')}`,
        borderRadius:8, fontSize:13, boxSizing:'border-box',
        background: open ? '#fff' : '#f8fafc', cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'space-between', userSelect:'none',
      }}>
        <span style={{ color: value ? '#1e293b' : '#94a3b8' }}>{display || placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:500,
          background:'#fff', border:'1px solid #e2e8f0', borderRadius:14,
          boxShadow:'0 12px 32px rgba(0,0,0,0.14)', width:280, padding:'14px 16px',
        }}>
          <MonthNav viewYear={viewYear} viewMonth={viewMonth} onPrev={prevMonth} onNext={nextMonth} canNext={canNext} />
          <CalendarGrid viewYear={viewYear} viewMonth={viewMonth} value={value} maxDate={maxDate} minDate={minDate}
            onSelect={d => { onChange(d); setOpen(false) }} />
          <div style={{ marginTop:10, borderTop:'1px solid #f1f5f9', paddingTop:10, textAlign:'center' }}>
            <button onClick={() => { const t=new Date(); onChange(`${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`); setOpen(false) }}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color: accentColor, fontWeight:700 }}>
              Today
            </button>
            {value && (
              <button onClick={() => { onChange(''); setOpen(false) }}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#94a3b8', fontWeight:600, marginLeft:16 }}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Date + Time picker ───────────────────────────────── */
export function DateTimePicker({ value, onChange, placeholder = 'Select date & time…' }) {
  // value format: "YYYY-MM-DDTHH:MM" or "YYYY-MM-DD HH:MM"
  const normalize = v => v ? v.replace(' ','T') : ''
  const val = normalize(value)

  const datePart = val ? val.slice(0,10) : ''
  const timePart = val ? val.slice(11,16) : ''

  const [open, setOpen]           = useState(false)
  const [viewYear, setViewYear]   = useState(() => datePart ? parseInt(datePart.slice(0,4)) : new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => datePart ? parseInt(datePart.slice(5,7))-1 : new Date().getMonth())
  const [hour, setHour]           = useState(() => timePart ? timePart.slice(0,2) : pad(new Date().getHours()))
  const [minute, setMinute]       = useState(() => timePart ? timePart.slice(3,5) : pad(new Date().getMinutes()))
  const ref = useRef()

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (datePart) { setViewYear(parseInt(datePart.slice(0,4))); setViewMonth(parseInt(datePart.slice(5,7))-1) }
    if (timePart) { setHour(timePart.slice(0,2)); setMinute(timePart.slice(3,5)) }
  }, [value])

  const nowD = new Date()
  const canNext = !(viewYear===nowD.getFullYear() && viewMonth===nowD.getMonth())

  function prevMonth() {
    if (viewMonth===0){setViewMonth(11);setViewYear(y=>y-1)} else setViewMonth(m=>m-1)
  }
  function nextMonth() {
    if (!canNext) return
    if (viewMonth===11){setViewMonth(0);setViewYear(y=>y+1)} else setViewMonth(m=>m+1)
  }

  function applyTime(h, m) {
    const hh = String(Math.min(23,Math.max(0,parseInt(h)||0))).padStart(2,'0')
    const mm = String(Math.min(59,Math.max(0,parseInt(m)||0))).padStart(2,'0')
    return { hh, mm }
  }

  function selectDate(d) {
    const { hh, mm } = applyTime(hour, minute)
    onChange(`${d}T${hh}:${mm}`)
  }

  function updateTime(newH, newM) {
    const { hh, mm } = applyTime(newH, newM)
    setHour(hh); setMinute(mm)
    if (datePart) onChange(`${datePart}T${hh}:${mm}`)
  }

  function setNow() {
    const t = new Date()
    const d = `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`
    const hh = pad(t.getHours()), mm = pad(t.getMinutes())
    setHour(hh); setMinute(mm)
    onChange(`${d}T${hh}:${mm}`)
    setOpen(false)
  }

  const display = datePart && timePart
    ? `${datePart.slice(8)}/${datePart.slice(5,7)}/${datePart.slice(0,4)}  ${timePart}`
    : datePart
      ? `${datePart.slice(8)}/${datePart.slice(5,7)}/${datePart.slice(0,4)}`
      : ''

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div onClick={() => setOpen(v=>!v)} style={{
        width:'100%', padding:'9px 12px', border:`1px solid ${open ? '#6366f1' : '#e2e8f0'}`,
        borderRadius:8, fontSize:13, boxSizing:'border-box',
        background: open ? '#fff' : '#f8fafc', cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'space-between', userSelect:'none',
      }}>
        <span style={{ color: val ? '#1e293b' : '#94a3b8' }}>{display || placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:500,
          background:'#fff', border:'1px solid #e2e8f0', borderRadius:14,
          boxShadow:'0 12px 32px rgba(0,0,0,0.14)', width:290, padding:'14px 16px',
        }}>
          <MonthNav viewYear={viewYear} viewMonth={viewMonth} onPrev={prevMonth} onNext={nextMonth} canNext={canNext} />
          <CalendarGrid viewYear={viewYear} viewMonth={viewMonth} value={datePart} maxDate={null} minDate={null}
            onSelect={selectDate} />

          {/* Time selector */}
          <div style={{ marginTop:12, borderTop:'1px solid #f1f5f9', paddingTop:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px' }}>Time</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}>
              <input
                type="number" min="0" max="23" value={hour}
                onChange={e => updateTime(e.target.value, minute)}
                style={{ width:52, padding:'8px 0', borderRadius:8, border:'1px solid #e2e8f0', fontSize:16, fontWeight:700, color:'#1e293b', background:'#f8fafc', outline:'none', textAlign:'center' }}
              />
              <span style={{ fontSize:18, fontWeight:700, color:'#64748b' }}>:</span>
              <input
                type="number" min="0" max="59" value={minute}
                onChange={e => updateTime(hour, e.target.value)}
                style={{ width:52, padding:'8px 0', borderRadius:8, border:'1px solid #e2e8f0', fontSize:16, fontWeight:700, color:'#1e293b', background:'#f8fafc', outline:'none', textAlign:'center' }}
              />
            </div>
          </div>

          <div style={{ marginTop:10, borderTop:'1px solid #f1f5f9', paddingTop:10, textAlign:'center' }}>
            <button onClick={setNow}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#4f9e6f', fontWeight:700 }}>
              Now
            </button>
            {val && (
              <button onClick={() => { onChange(''); setOpen(false) }}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#94a3b8', fontWeight:600, marginLeft:16 }}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
