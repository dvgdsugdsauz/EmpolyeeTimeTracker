const BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

function getToken() {
  return sessionStorage.getItem('tt_token')
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
  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : null
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
  sessionStorage.setItem('tt_token', data.token)
  return data
}

export function logout() {
  sessionStorage.removeItem('tt_token')
  sessionStorage.removeItem('tt_user')
}

/**
 * Verify the stored token against the server.
 * Returns { valid: true, user } on success,
 *         { valid: false } on 401 (token invalid/expired),
 *         null on network errors or server errors (don't force logout).
 */
export async function verifySession() {
  const token = getToken()
  if (!token) return { valid: false }
  try {
    const res = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.status === 401 || res.status === 403) return { valid: false }
    if (!res.ok) return null // server error — don't touch the session
    const user = await res.json()
    return { valid: true, user }
  } catch {
    return null // network error — don't touch the session
  }
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

export function fetchEmployeeTodayPunches(employeeId) {
  return request(`/api/attendance/today-punches/${employeeId}`)
}

export function fetchEmployeePunchesByDate(employeeId, date) {
  return request(`/api/attendance/punches/${employeeId}?date=${date}`)
}

export function addManualPunch(employeeId, date, time, punchState) {
  return request('/api/attendance/admin-punch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId, date, time, punchState: String(punchState) }),
  })
}

export function fetchAttendanceHistory(employeeId, from, to) {
  return request(`/api/attendance/history?employeeId=${employeeId}&from=${from}&to=${to}`)
}

export function fetchDailySummary(date) {
  return request(`/api/attendance/daily?date=${date}`)
}

export function approveOffline(employeeId) {
  return request(`/api/attendance/approve-offline/${employeeId}`, { method: 'POST' })
}

export function overrideAttendanceStatus(employeeId, date, overrideStatus, overrideComment) {
  return request('/api/attendance/override-status', {
    method: 'POST',
    body: JSON.stringify({ employeeId, date, overrideStatus, overrideComment: overrideComment || null }),
  })
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

export function setTimesheetAccess(id, enabled) {
  return request(`/api/employees/${id}/timesheet-access`, {
    method: 'PATCH', body: JSON.stringify({ enabled }),
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

export function clearResolvedNotifications() {
  return request('/api/notifications/resolved', { method: 'DELETE' })
}

export function clearAllNotifications() {
  return request('/api/notifications/all', { method: 'DELETE' })
}

// ── Timesheets ─────────────────────────────────────────────────────────────

export function fetchMyTimesheets() {
  return request('/api/timesheets/my')
}

export function fetchTeamTimesheets() {
  return request('/api/timesheets/team')
}

export function createTimesheet(dto) {
  return request('/api/timesheets', { method: 'POST', body: JSON.stringify(dto) })
}

export function updateTimesheet(id, dto) {
  return request(`/api/timesheets/${id}`, { method: 'PUT', body: JSON.stringify(dto) })
}

export function deleteTimesheet(id) {
  return request(`/api/timesheets/${id}`, { method: 'DELETE' })
}

export function approveTimesheet(id) {
  return request(`/api/timesheets/${id}/approve`, { method: 'POST' })
}

export function rejectTimesheet(id, reason) {
  return request(`/api/timesheets/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) })
}

export function fetchTimesheetModules() {
  return request('/api/timesheets/modules')
}

export function addTimesheetModule(moduleName) {
  return request('/api/timesheets/modules', { method: 'POST', body: JSON.stringify({ moduleName }) })
}

export function deleteTimesheetModule(id) {
  return request(`/api/timesheets/modules/${id}`, { method: 'DELETE' })
}

// ── Tasks ──────────────────────────────────────────────────────────────────

export function fetchAllTasks() {
  return request('/api/tasks')
}

export function fetchMyTasks() {
  return request('/api/tasks/my')
}

export function importTasks(tasks) {
  return request('/api/tasks/import', { method: 'POST', body: JSON.stringify(tasks) })
}

export function assignTask(taskId, employeeId) {
  return request(`/api/tasks/${encodeURIComponent(taskId)}/assign`, {
    method: 'POST', body: JSON.stringify({ employeeId }),
  })
}

export function assignTasksBulk(taskIds, employeeId, targetDate, plannedDate) {
  return request('/api/tasks/assign-bulk', {
    method: 'POST', body: JSON.stringify({ taskIds, employeeId, targetDate: targetDate || null, plannedDate: plannedDate || null }),
  })
}

export function updateMyTask(taskId, dto) {
  return request(`/api/tasks/${encodeURIComponent(taskId)}/my-update`, {
    method: 'PUT', body: JSON.stringify(dto),
  })
}

export function fetchTimesheetManagers() {
  return request('/api/timesheets/managers')
}

export async function importTimesheets(formData) {
  const token = getToken()
  const res = await fetch(`${BASE}/api/admin/import-timesheets`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Import failed')
  }
  return res.json()
}
