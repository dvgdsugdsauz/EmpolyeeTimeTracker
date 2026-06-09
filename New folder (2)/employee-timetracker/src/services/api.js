const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function getToken() {
  return localStorage.getItem('tt_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.status !== 204 ? res.json() : null
}

// ── Real-time SSE stream ───────────────────────────────────────────────────

export function subscribeToLiveAttendance(onData, onError) {
  const token = getToken()
  if (!token) return null

  const url = `${BASE}/api/attendance/stream?token=${encodeURIComponent(token)}`
  const source = new EventSource(url)

  source.addEventListener('attendance', (e) => {
    try { onData(JSON.parse(e.data)) } catch {}
  })

  source.addEventListener('ping', () => {}) // keep-alive, ignore

  source.onerror = () => {
    if (onError) onError()
    source.close()
  }

  return source // caller must call source.close() on cleanup
}

// ── Auth ───────────────────────────────────────────────────────────────────

export async function login(identifier, password) {
  const data = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  })
  localStorage.setItem('tt_token', data.token)
  return data
}

export function logout() {
  localStorage.removeItem('tt_token')
  localStorage.removeItem('tt_user')
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export function fetchMetrics() {
  return request('/api/dashboard/metrics')
}

export function fetchLiveAttendance() {
  return request('/api/dashboard/live')
}

// ── My Attendance (Employee) ───────────────────────────────────────────────

export function fetchMyAttendance() {
  return request('/api/attendance/my')
}

export function fetchMyHistory(days = 30) {
  return request(`/api/attendance/my/history?days=${days}`)
}

export function fetchMyHistoryByMonth(year, month) {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return request(`/api/attendance/my/history?from=${from}&to=${to}`)
}

export function fetchTodayPunches() {
  return request('/api/attendance/my/today-punches')
}

// ── Admin / Manager ────────────────────────────────────────────────────────

export function fetchAttendanceHistory(employeeId, from, to) {
  return request(`/api/attendance/history?employeeId=${employeeId}&from=${from}&to=${to}`)
}

export function fetchDailySummary(date) {
  return request(`/api/attendance/daily?date=${date}`)
}

export function approveOffline(employeeId) {
  return request(`/api/attendance/approve-offline/${employeeId}`, { method: 'POST' })
}

export async function exportAttendance(from, to) {
  const token = getToken()
  const res = await fetch(`${BASE}/api/attendance/export?from=${from}&to=${to}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Export failed')
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `attendance_${from}_to_${to}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Employees ──────────────────────────────────────────────────────────────

export function fetchEmployees() {
  return request('/api/employees')
}

export function createEmployee(dto) {
  return request('/api/employees', { method: 'POST', body: JSON.stringify(dto) })
}

export function updateEmployee(id, dto) {
  return request(`/api/employees/${id}`, { method: 'PUT', body: JSON.stringify(dto) })
}

export function deleteEmployee(id) {
  return request(`/api/employees/${id}`, { method: 'DELETE' })
}

export function resetEmployeePassword(id, newPassword) {
  return request(`/api/employees/${id}/reset-password`, {
    method: 'POST', body: JSON.stringify({ newPassword }),
  })
}

export function changeMyPassword(currentPassword, newPassword) {
  return request('/api/auth/change-password', {
    method: 'POST', body: JSON.stringify({ currentPassword, newPassword }),
  })
}

// ── Devices ────────────────────────────────────────────────────────────────

export function fetchDevices() {
  return request('/api/devices')
}

export function createDevice(device) {
  return request('/api/devices', { method: 'POST', body: JSON.stringify(device) })
}

export function updateDevice(id, device) {
  return request(`/api/devices/${id}`, { method: 'PUT', body: JSON.stringify(device) })
}

export function deleteDevice(id) {
  return request(`/api/devices/${id}`, { method: 'DELETE' })
}

export function toggleDevice(id) {
  return request(`/api/devices/${id}/toggle`, { method: 'POST' })
}

export function connectDevice(id) {
  return request(`/api/devices/${id}/connect`, { method: 'POST' })
}

export function disconnectDevice(id) {
  return request(`/api/devices/${id}/disconnect`, { method: 'POST' })
}

// ── Admin ──────────────────────────────────────────────────────────────────

export function rebuildData() {
  return request('/api/dashboard/admin/rebuild-data', { method: 'POST' })
}

// ── Notifications ──────────────────────────────────────────────────────────

export function fetchNotifications() {
  return request('/api/notifications')
}

export function fetchUnreadCount() {
  return request('/api/notifications/unread-count')
}

export function markAllRead() {
  return request('/api/notifications/mark-all-read', { method: 'POST' })
}

export function markOneRead(id) {
  return request(`/api/notifications/${id}/read`, { method: 'POST' })
}
