export const STATUS_META = {
  WORKING:     { label: 'Working',     color: '#16a34a', bg: '#dcfce7', dot: '#22c55e' },
  BREAK:       { label: 'On Break',    color: '#ea580c', bg: '#ffedd5', dot: '#f97316' },
  LUNCH:       { label: 'Lunch',       color: '#ca8a04', bg: '#fef9c3', dot: '#eab308' },
  MISS_PUNCH:  { label: 'Miss Punch',  color: '#dc2626', bg: '#fee2e2', dot: '#ef4444' },
  OFFLINE:     { label: 'Offline',     color: '#374151', bg: '#f3f4f6', dot: '#6b7280' },
  NOT_ARRIVED: { label: 'Not Arrived', color: '#6b7280', bg: '#f9fafb', dot: '#9ca3af' },
}

export function getLateLabel(lateStatus) {
  if (lateStatus === 'LATE')      return { label: 'Late',      color: '#f97316', bg: '#ffedd5' }
  if (lateStatus === 'VERY_LATE') return { label: 'Very Late', color: '#ef4444', bg: '#fee2e2' }
  return { label: 'On Time', color: '#16a34a', bg: '#dcfce7' }
}

export function isInLunchWindow(isoString) {
  const t = new Date(isoString)
  const mins = t.getHours() * 60 + t.getMinutes()
  return mins >= 12 * 60 + 45 && mins < 14 * 60
}

export function getOutsideStatus(punchOutIso) {
  return isInLunchWindow(punchOutIso) ? 'LUNCH' : 'BREAK'
}

export function checkMissPunch(att) {
  if (!att.lastPunchOut) return false
  if (['WORKING', 'NOT_ARRIVED', 'OFFLINE', 'MISS_PUNCH'].includes(att.status)) return false
  const outside = Date.now() - new Date(att.lastPunchOut).getTime()
  return outside >= 2 * 3600000
}

export function getLiveWorkTotal(att, now) {
  if (att.status === 'WORKING' && att.lastPunchIn) {
    return att.workTotal + (now - new Date(att.lastPunchIn).getTime())
  }
  return att.workTotal
}

export function getLiveOutsideTotal(att, now) {
  if ((att.status === 'BREAK' || att.status === 'LUNCH' || att.status === 'MISS_PUNCH') && att.lastPunchOut) {
    const elapsed = now - new Date(att.lastPunchOut).getTime()
    if (att.status === 'LUNCH') return { break: att.breakTotal, lunch: att.lunchTotal + elapsed }
    return { break: att.breakTotal + elapsed, lunch: att.lunchTotal }
  }
  return { break: att.breakTotal, lunch: att.lunchTotal }
}

export function getPendingMs(att, now) {
  const REQUIRED = (9 * 3600 + 30 * 60) * 1000   // 9h 30m
  const worked = getLiveWorkTotal(att, now)
  return Math.max(0, REQUIRED - worked)
}
