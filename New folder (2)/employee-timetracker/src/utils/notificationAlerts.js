// ── Desktop Notification Permission ────────────────────────────────────────
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

// ── Alert Sound (Web Audio API — no audio file needed) ─────────────────────
export function playMissPunchSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()

    // Two-tone alert beep
    const times = [0, 0.3]
    times.forEach(startAt => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.4, ctx.currentTime + startAt)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + 0.25)
      osc.start(ctx.currentTime + startAt)
      osc.stop(ctx.currentTime + startAt + 0.25)
    })
  } catch {
    // Browser may block autoplay — silently ignore
  }
}

// ── Desktop Popup Notification ─────────────────────────────────────────────
export function showDesktopNotification(employeeName, employeeId, message) {
  if (Notification.permission !== 'granted') return

  const notif = new Notification('⚠ MISS PUNCH ALERT', {
    body: `Employee: ${employeeName}\nID: ${employeeId}\n${message}`,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: `miss-punch-${employeeId}`,   // prevents duplicate popups for same employee
    requireInteraction: true,          // stays until user dismisses
  })

  // Auto-close after 10 seconds
  setTimeout(() => notif.close(), 10000)
}

// ── Track which notifications have already been alerted ────────────────────
const alerted = new Set()

export function triggerAlertsForNew(notifications) {
  const newMissPunch = notifications.filter(
    n => n.type === 'MISS_PUNCH' && !n.read && !n.resolved && !alerted.has(n.id)
  )

  newMissPunch.forEach(n => {
    alerted.add(n.id)
    playMissPunchSound()
    showDesktopNotification(n.employeeName, n.employeeId, n.message)
  })
}
