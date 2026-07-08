import { useState, useEffect, useCallback, useRef } from 'react'
import { USERS, generateInitialAttendance, NOTIFICATIONS_INIT, DEVICES_INIT } from './data/mockData'
import { checkMissPunch } from './utils/attendanceLogic'
import * as api from './services/api'
import { requestNotificationPermission, triggerAlertsForNew } from './utils/notificationAlerts'
import Login from './components/Login'
import Loader from './components/Loader'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import NotificationPanel from './components/NotificationPanel'
import EmployeeDashboard from './pages/employee/EmployeeDashboard'
import MyAttendance from './pages/employee/MyAttendance'
import ManagerDashboard from './pages/manager/ManagerDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'
import UserManagement from './pages/admin/UserManagement'
import DeviceManagement from './pages/admin/DeviceManagement'
import Reports from './pages/admin/Reports'
import ApprovalsPage from './pages/manager/ApprovalsPage'
import Settings from './pages/admin/Settings'
import TimesheetPage from './pages/employee/TimesheetPage'
import ManagerTimesheetPage from './pages/manager/ManagerTimesheetPage'
import TimesheetImport from './pages/admin/TimesheetImport'
import ManagerTaskPage from './pages/manager/ManagerTaskPage'
import MyTasksPage from './pages/employee/MyTasksPage'

// Set VITE_API_URL in .env.local to enable real backend
const USE_API = Boolean(import.meta.env.VITE_API_URL)

function getSession() {
  try { return JSON.parse(sessionStorage.getItem('wilotus_session')) } catch { return null }
}

const PAGE_TITLES = {
  dashboard:     'Dashboard',
  live:          'Live Monitor',
  reports:       'Reports & Export',
  attendance:    'Attendance',
  notifications: 'Approvals',
  timesheet:     'Timesheet',
  'my-timesheet': 'My Timesheet',
  import:        'Import Data',
  employees:     'Employee Management',
  devices:       'Biometric Devices',
  settings:      'Settings',
}

// Normalize Java array times → ISO string (Jackson serializes LocalDateTime as [y,m,d,h,m,s])
function toIso(t) {
  if (!t) return null
  if (Array.isArray(t)) {
    if (t.length >= 6)
      return `${t[0]}-${String(t[1]).padStart(2,'0')}-${String(t[2]).padStart(2,'0')}T${String(t[3]).padStart(2,'0')}:${String(t[4]).padStart(2,'0')}:${String(t[5]).padStart(2,'0')}`
    return `1970-01-01T${String(t[0]).padStart(2,'0')}:${String(t[1]).padStart(2,'0')}:${String(t[2]||0).padStart(2,'0')}`
  }
  return t
}

// Transform API LiveStatusDto array into { users, attendance } matching UI format
function transformApiData(liveList) {
  const users = liveList.map(d => ({
    id: d.id, name: d.name, dept: d.dept,
    designation: d.designation,
    avatar: d.avatar, role: d.role,
    email: d.email, username: d.username,
  }))
  const attendance = liveList.map(d => ({
    employeeId: d.id,
    status: d.status,
    entryTime:    toIso(d.entryTime),
    lastPunchIn:  toIso(d.lastPunchIn),
    lastPunchOut: toIso(d.lastPunchOut),
    workTotal:  d.totalWorkMs  || 0,
    breakTotal: d.totalBreakMs || 0,
    lunchTotal: d.totalLunchMs || 0,
    lateStatus: d.lateStatus || 'NORMAL',
  }))
  return { users, attendance }
}

export default function App() {
  // On startup: if API mode is enabled, only restore sessions that came from API login.
  // Mock sessions (fromApi: false) are cleared so login page is shown fresh.
  const initialUser = (() => {
    const s = getSession()
    if (!s) return null
    if (USE_API && !s.fromApi) {
      sessionStorage.removeItem('wilotus_session')
      return null
    }
    return s
  })()

  const [user, setUser]                     = useState(initialUser)
  const [users, setUsers]                   = useState(USERS)
  const [attendance, setAttendance]         = useState(() => generateInitialAttendance())
  const [notifications, setNotifications]   = useState(NOTIFICATIONS_INIT)
  const [devices, setDevices]               = useState(DEVICES_INIT)
  const [currentPage, setCurrentPage]       = useState(() => {
    const session = initialUser
    return (session?.role === 'manager' || session?.role === 'hr') ? 'live' : 'dashboard'
  })
  const [chartData, setChartData]           = useState([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [appLoading, setAppLoading]         = useState(false)
  const loadingTimer = useRef(null)
  const apiMode = useRef(USE_API && !!initialUser)

  // ── API mode: admin/manager — real-time SSE with polling fallback ────────
  useEffect(() => {
    if (!apiMode.current || !user || user.role === 'employee') return

    const applyLive = (liveList) => {
      const { users: u, attendance: a } = transformApiData(liveList)
      setUsers(u)
      setAttendance(a)
    }

    api.fetchLiveAttendance().then(applyLive).catch(() => {})
    api.fetchDevices().then(list => setDevices(list)).catch(() => {})
    api.fetchMetrics().then(m => { if (m?.chartData) setChartData(m.chartData) }).catch(() => {})

    // Safety poll every 15s — catches missed SSE events and initial load gaps
    const safetyTimer = setInterval(() => {
      api.fetchLiveAttendance().then(applyLive).catch(() => {})
    }, 15000)

    let fallbackTimer = null
    const source = api.subscribeToLiveAttendance(applyLive, () => {
      // SSE failed — fall back to 5s polling
      fallbackTimer = setInterval(() => {
        api.fetchLiveAttendance().then(applyLive).catch(() => {})
      }, 5000)
    })

    return () => {
      if (source) source.close()
      if (fallbackTimer) clearInterval(fallbackTimer)
      clearInterval(safetyTimer)
    }
  }, [apiMode.current, user?.role])

  // ── API mode: employee — SSE (filtered to own record) + 3s polling fallback
  useEffect(() => {
    if (!apiMode.current || !user || user.role !== 'employee') return

    const applyMyRecord = (dto) => {
      if (!dto) return
      setAttendance(prev => {
        const rest = prev.filter(a => a.employeeId !== dto.id)
        return [...rest, {
          employeeId:   dto.id,
          status:       dto.status            || 'NOT_ARRIVED',
          entryTime:    toIso(dto.entryTime)    || null,
          lastPunchIn:  toIso(dto.lastPunchIn)  || null,
          lastPunchOut: toIso(dto.lastPunchOut) || null,
          workTotal:    dto.totalWorkMs  || 0,
          breakTotal:   dto.totalBreakMs || 0,
          lunchTotal:   dto.totalLunchMs || 0,
          lateStatus:   dto.lateStatus   || 'NORMAL',
        }]
      })
    }

    // Initial load from dedicated my-endpoint
    api.fetchMyAttendance().then(applyMyRecord).catch(() => {})

    // Re-fetch when tab comes back from background (recovers stale state)
    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        api.fetchMyAttendance().then(applyMyRecord).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisible)

    // SSE: receive full live list, filter for own record → near-instant updates
    let fallbackTimer = null
    const source = api.subscribeToLiveAttendance((liveList) => {
      const mine = Array.isArray(liveList) ? liveList.find(d => d.id === user.id) : null
      applyMyRecord(mine)
    }, () => {
      // SSE unavailable — fall back to 3s polling
      fallbackTimer = setInterval(() => {
        api.fetchMyAttendance().then(applyMyRecord).catch(() => {})
      }, 3000)
    })

    return () => {
      if (source) source.close()
      if (fallbackTimer) clearInterval(fallbackTimer)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [apiMode.current, user?.id])

  // ── API mode: poll notifications every 10 seconds ─────────────────────
  useEffect(() => {
    if (!apiMode.current) return

    const pollNotif = async () => {
      try {
        const list = await api.fetchNotifications()
        setNotifications(list.map(n => ({
          id: String(n.id),
          type: n.type,
          employeeId: n.employeeId,
          employeeName: n.employeeName,
          message: n.message,
          time: n.createdAt,
          read: n.read,
          resolved: n.read,
        })))
      } catch {/* keep last */}
    }

    pollNotif()
    const t = setInterval(pollNotif, 10000)
    return () => clearInterval(t)
  }, [apiMode.current])

  // ── Mock mode: simulate biometric miss-punch detection every 8 seconds ──
  useEffect(() => {
    if (apiMode.current) return

    const poll = setInterval(() => {
      setAttendance(prev => {
        let changed = false
        const updated = prev.map(att => {
          if (checkMissPunch(att) && att.status !== 'MISS_PUNCH') {
            changed = true
            const exists = notifications.find(
              n => n.employeeId === att.employeeId && n.type === 'MISS_PUNCH' && !n.resolved)
            if (!exists) {
              const emp = users.find(u => u.id === att.employeeId)
              const outside = Date.now() - new Date(att.lastPunchOut).getTime()
              const mins = Math.floor(outside / 60000)
              const h = Math.floor(mins / 60), m = mins % 60
              setNotifications(prev => [{
                id: `N${Date.now()}`,
                type: 'MISS_PUNCH',
                employeeId: att.employeeId,
                employeeName: emp?.name || att.employeeId,
                message: `Outside for ${h}h ${m}m without returning.`,
                time: new Date().toISOString(),
                read: false, resolved: false,
              }, ...prev])
            }
            return { ...att, status: 'MISS_PUNCH' }
          }
          return att
        })
        // Only trigger re-render if something actually changed
        return changed ? updated : prev
      })
    }, 8000)
    return () => clearInterval(poll)
  }, [users, notifications, apiMode.current])

  function navigateTo(page) {
    if (loadingTimer.current) clearTimeout(loadingTimer.current)
    setAppLoading(true)
    setCurrentPage(page)
    loadingTimer.current = setTimeout(() => setAppLoading(false), 400)
  }

  // ── Login ──────────────────────────────────────────────────────────────
  const handleLogin = async (identifier, password) => {
    if (USE_API) {
      try {
        const data = await api.login(identifier, password)
        const sessionUser = { ...data, fromApi: true }
        sessionStorage.setItem('wilotus_session', JSON.stringify(sessionUser))
        apiMode.current = true
        setAppLoading(true)
        setUser(sessionUser)
        setCurrentPage((data.role === 'manager' || data.role === 'hr') ? 'live' : 'dashboard')
        setTimeout(() => setAppLoading(false), 800)
        return true
      } catch {
        // fall through to mock login
      }
    }

    // Mock login
    const found = USERS.find(u =>
      (u.id.toLowerCase() === identifier.toLowerCase() ||
       u.email.toLowerCase() === identifier.toLowerCase()) &&
      u.password === password
    )
    if (found) {
      const sessionUser = { ...found, fromApi: false }
      sessionStorage.setItem('wilotus_session', JSON.stringify(sessionUser))
      apiMode.current = false
      setAppLoading(true)
      setUser(sessionUser)
      setCurrentPage((found.role === 'manager' || found.role === 'hr') ? 'live' : 'dashboard')
      setTimeout(() => setAppLoading(false), 600)
      return true
    }
    return false
  }

  const handleLogout = () => {
    api.logout()
    sessionStorage.removeItem('wilotus_session')
    setUser(null)
    apiMode.current = false
  }

  // ── Approve Offline ────────────────────────────────────────────────────
  const handleApproveOffline = useCallback(async (employeeId) => {
    if (apiMode.current) {
      try { await api.approveOffline(employeeId) } catch {/* ui still updates */}
    }
    setAttendance(prev => prev.map(a =>
      a.employeeId === employeeId ? { ...a, status: 'OFFLINE' } : a))
    setNotifications(prev => prev.map(n =>
      n.employeeId === employeeId && !n.resolved
        ? { ...n, resolved: true, read: true } : n))
  }, [])

  // ── Mark Notification Read ─────────────────────────────────────────────
  const handleMarkRead = useCallback(async (id) => {
    if (apiMode.current) {
      try { await api.markOneRead(id) } catch {/* ok */}
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true, resolved: true } : n))
  }, [])

  // ── Clear All Resolved Notifications ───────────────────────────────────
  const handleClearResolved = useCallback(async () => {
    if (apiMode.current) {
      try { await api.clearResolvedNotifications() } catch {/* ok */}
    }
    setNotifications(prev => prev.filter(n => !n.resolved))
  }, [])

  // ── Clear All Notifications ────────────────────────────────────────────
  const handleClearAll = useCallback(async () => {
    if (apiMode.current) {
      try { await api.clearAllNotifications() } catch {/* ok */}
    }
    setNotifications([])
  }, [])

  // ── Employee CRUD ──────────────────────────────────────────────────────
  const handleAddUser = async (formData) => {
    if (apiMode.current) {
      const created = await api.createEmployee(formData)
      setUsers(prev => [...prev, { ...created, fromApi: true }])
      return
    }
    setUsers(prev => [...prev, { ...formData }])
  }

  const handleEditUser = async (id, formData) => {
    if (apiMode.current) {
      try {
        const updated = await api.updateEmployee(id, formData)
        setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updated } : u))
        return
      } catch {/* fall through */}
    }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...formData } : u))
  }

  const handleDeleteUser = async (id) => {
    if (apiMode.current) {
      try { await api.deleteEmployee(id) } catch {/* ok */}
    }
    setUsers(prev => prev.filter(u => u.id !== id))
  }

  const handleToggleTimesheetAccess = async (id, enabled) => {
    if (apiMode.current) {
      try { await api.setTimesheetAccess(id, enabled) } catch {/* ok */}
    }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, timesheetAccess: enabled } : u))
  }

  // ── Device CRUD ────────────────────────────────────────────────────────
  const handleAddDevice = async (dev) => {
    if (apiMode.current) {
      try {
        const created = await api.createDevice(dev)
        setDevices(prev => [...prev, created])
        return
      } catch {/* fall through */}
    }
    const id = `DEV${String(devices.length + 1).padStart(3, '0')}`
    setDevices(prev => [...prev, { ...dev, id }])
  }

  const handleEditDevice = async (id, data) => {
    if (apiMode.current) {
      try {
        const updated = await api.updateDevice(id, data)
        setDevices(prev => prev.map(d => d.id === id || String(d.id) === String(id) ? updated : d))
        return
      } catch {/* fall through */}
    }
    setDevices(prev => prev.map(d => d.id === id ? { ...d, ...data } : d))
  }

  const handleDeleteDevice = async (id) => {
    if (apiMode.current) {
      try { await api.deleteDevice(id) } catch {/* ok */}
    }
    setDevices(prev => prev.filter(d => d.id !== id && String(d.id) !== String(id)))
  }

  const handleConnectDevice = async (id) => {
    if (apiMode.current) {
      try { await api.connectDevice(id) } catch {/* ok */}
    }
    setDevices(prev => prev.map(d =>
      d.id === id || String(d.id) === String(id)
        ? { ...d, connected: true, active: true } : d))
  }

  const handleDisconnectDevice = async (id) => {
    if (apiMode.current) {
      try { await api.disconnectDevice(id) } catch {/* ok */}
    }
    setDevices(prev => prev.map(d =>
      d.id === id || String(d.id) === String(id)
        ? { ...d, connected: false, active: false } : d))
  }

  const handleToggleDevice = async (id) => {
    const dev = devices.find(d => d.id === id || String(d.id) === String(id))
    if (dev?.connected) {
      await handleDisconnectDevice(id)
    } else {
      await handleConnectDevice(id)
    }
  }

  // Request desktop notification permission when manager/admin logs in
  useEffect(() => {
    if (user && user.role !== 'employee') {
      requestNotificationPermission()
    }
  }, [user])

  // Trigger desktop popup + sound for new MISS_PUNCH notifications
  useEffect(() => {
    if (user && user.role !== 'employee') {
      triggerAlertsForNew(notifications)
    }
  }, [notifications, user])

  const unreadCount = notifications.filter(n => !n.read).length

  if (!user) return <Login onLogin={handleLogin} />

  const myAttendance = attendance.find(a => a.employeeId === user.id)

  const renderPage = () => {
    if (user.role === 'employee') {
      if (currentPage === 'attendance') return <MyAttendance user={user} />
      if (currentPage === 'timesheet') return <TimesheetPage user={user} />
      if (currentPage === 'my-tasks') return <MyTasksPage user={user} />
      return <EmployeeDashboard user={user} attendance={myAttendance} />
    }

    if (user.role === 'hr') {
      switch (currentPage) {
        case 'live':
          return <ManagerDashboard users={users} attendance={attendance} myAttendance={myAttendance} currentUser={user} onApproveOffline={handleApproveOffline} />
        case 'employees':
          return <UserManagement users={users} onAddUser={handleAddUser} onEditUser={handleEditUser} onDeleteUser={handleDeleteUser} />
        case 'reports':
          return <Reports users={users} attendance={attendance} />
        case 'attendance':
          return <MyAttendance user={user} />
        case 'settings':
          return <Settings role={user.role} />
        default:
          return <ManagerDashboard users={users} attendance={attendance} myAttendance={myAttendance} currentUser={user} onApproveOffline={handleApproveOffline} />
      }
    }

    if (user.role === 'manager' || user.role === 'admin') {
      switch (currentPage) {
        case 'dashboard':
          return user.role === 'admin'
            ? <AdminDashboard users={users} attendance={attendance} onNavigate={navigateTo} devices={devices} onToggleDevice={handleToggleDevice} chartData={chartData} />
            : <ManagerDashboard users={users} attendance={attendance} myAttendance={myAttendance} currentUser={user} onApproveOffline={handleApproveOffline} />
        case 'live':
          return <ManagerDashboard users={users} attendance={attendance} myAttendance={myAttendance} currentUser={user} onApproveOffline={handleApproveOffline} />
        case 'reports':
          return <Reports users={users} attendance={attendance} />
        case 'employees':
          return <UserManagement users={users} onAddUser={handleAddUser} onEditUser={handleEditUser} onDeleteUser={handleDeleteUser} />
        case 'devices':
          return <DeviceManagement
            devices={devices}
            onAddDevice={handleAddDevice}
            onEditDevice={handleEditDevice}
            onDeleteDevice={handleDeleteDevice}
            onToggleDevice={handleToggleDevice}
            onConnectDevice={handleConnectDevice}
            onDisconnectDevice={handleDisconnectDevice}
          />
        case 'attendance':
          return <MyAttendance user={user} />
        case 'notifications':
          return <ApprovalsPage notifications={notifications} onApproveOffline={handleApproveOffline} onMarkRead={handleMarkRead} onClearResolved={handleClearResolved} />
        case 'timesheet':
          return <ManagerTimesheetPage user={user} />
        case 'my-timesheet':
          return <TimesheetPage user={user} />
        case 'tasks':
          return <ManagerTaskPage user={user} />
        case 'import':
          return <TimesheetImport />
        case 'settings':
          return <Settings role={user.role} />
        default:
          return user.role === 'admin'
            ? <AdminDashboard users={users} attendance={attendance} onNavigate={navigateTo} />
            : <ManagerDashboard users={users} attendance={attendance} onApproveOffline={handleApproveOffline} />
      }
    }
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      {appLoading && <Loader />}
      <Sidebar
        role={user.role}
        currentPage={currentPage}
        onNavigate={navigateTo}
        unreadCount={unreadCount}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
      />
      <div className="app-main">
        <TopBar
          user={user}
          pageTitle={PAGE_TITLES[currentPage] || 'Dashboard'}
          unreadCount={unreadCount}
          onBellClick={() => user.role !== 'employee' && setShowNotifPanel(true)}
          onLogout={handleLogout}
        />
        <div className="page-wrapper">
          {renderPage()}
        </div>
      </div>

      {showNotifPanel && (
        <NotificationPanel
          notifications={notifications}
          onClose={() => setShowNotifPanel(false)}
          onMarkRead={handleMarkRead}
          onApproveOffline={(n) => { handleApproveOffline(n.employeeId); setShowNotifPanel(false) }}
          onClearAll={handleClearAll}
        />
      )}
    </div>
  )
}
