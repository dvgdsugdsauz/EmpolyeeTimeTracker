export function formatDuration(ms) {
  if (!ms || ms <= 0) return '0h 0m'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${h}h ${m}m`
}

export function formatDurationHHMMSS(ms) {
  if (!ms || ms <= 0) return '00:00:00'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export function formatTime12(iso) {
  if (!iso) return '--'
  // Handle "HH:MM" or "HH:MM:SS" time-only strings (no date part)
  const src = (typeof iso === 'string' && /^\d{2}:\d{2}/.test(iso))
    ? `1970-01-01T${iso.length === 5 ? iso + ':00' : iso}`
    : iso
  return new Date(src).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export function formatDateLabel(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
