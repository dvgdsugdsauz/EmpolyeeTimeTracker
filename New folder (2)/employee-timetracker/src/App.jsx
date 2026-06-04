import { useState, useEffect, useCallback, useRef } from 'react'
import { USERS, generateInitialAttendance, NOTIFICATIONS_INIT, DEVICES_INIT } from './data/mockData'
import { checkMissPunch } from './utils/attendanceLogic'
import * as api from './services/api'
import { requestNotificationPermission, triggerAlertsForNew } from './utils/notificationAlerts'
import Login from './components/Login'
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

// Set VITE_API_URL in .env.local to enable real backend
const USE_API = Boolean(import.meta.env.VITE_API_URL)

function getSession() {
  try { return JSON.parse(localStorage.getItem('wilotus_session')) } catch { return null }
}

const PAGE_TITLES = {
  dashboard:     'Dashboard',
  live:          'Live Monitor',
  breaks:        'Break Monitor',
  reports:       'Reports & Export',
  attendance:    'My Attendance',
  notifications: 'Approvals',
  employees:     'Employee Management',
  devices:       'Biometric Devices',
  settings:      'Settings',
}

// Transform API LiveStatusDto array into { users, attendance } matching UI format
function transformApiData(liveList) {
  const users = liveList.map(d => ({
    id: d.id, name: d.name, dept: d.dept,
    avatar: d.avatar, role: d.role,
    email: d.email, username: d.username,
  }))
  const attendance = liveList.map(d => ({
    employeeId: d.id,
    status: d.status,
    entryTime: d.entryTime,
    lastPunchIn: d.lastPunchIn,
    lastPunchOut: d.lastPunchOut,
    workTotal:  d.totalWorkMs  || 0,
    breakTotal: d.totalBreakMs || 0,
    lunchTotal: d.totalLunchMs || 0,
    lateStatus: d.lateStatus || 'NORMAL',
  }))
  return { users, attendance }
}

export default function App() {
  const [user, setUser]                     = useState(() => getSession())
  const [users, setUsers]                   = useState(USERS)
  const [attendance, setAttendance]         = useState(() => generateInitialAttendance())
  const [notifications, setNotifications]   = useState(NOTIFICATIONS_INIT)
  const [devices, setDevices]               = useState(DEVICES_INIT)
  const [currentPage, setCurrentPage]       = useState(() => {
    const session = getSession()
    return session?.role === 'manager' ? 'live' : 'dashboard'
  })
  const [chartData, setChartData]           = useState([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const apiMode = useRef(USE_API && !!user)

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
          status:       dto.status       || 'NOT_ARRIVED',
          entryTime:    dto.entryTime    || null,
          lastPunchIn:  dto.lastPunchIn  || null,
          lastPunchOut: dto.lastPunchOut || null,
          workTotal:    dto.totalWorkMs  || 0,
          breakTotal:   dto.totalBreakMs || 0,
          lunchTotal:   dto.totalLunchMs || 0,
          lateStatus:   dto.lateStatus   || 'NORMAL',
        }]
      })
    }

    // Initial load from dedicated my-endpoint
    api.fetchMyAttendance().then(applyMyRecord).catch(() => {})

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

  // ── Login ──────────────────────────────────────────────────────────────
  const handleLogin = async (identifier, password) => {
    if (USE_API) {
      try {
        const data = await api.login(identifier, password)
        const sessionUser = { ...data, fromApi: true }
        localStorage.setItem('wilotus_session', JSON.stringify(sessionUser))
        apiMode.current = true
        setUser(sessionUser)
        setCurrentPage(data.role === 'manager' ? 'live' : 'dashboard')
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
      localStorage.setItem('wilotus_session', JSON.stringify(sessionUser))
      apiMode.current = false
      setUser(sessionUser)
      setCurrentPage(found.role === 'manager' ? 'live' : 'dashboard')
      return true
    }
    return false
  }

  const handleLogout = () => {
    if (apiMode.current) api.logout()
    else localStorage.removeItem('wilotus_session')
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
      n.employeeId === employeeId && n.type === 'MISS_PUNCH'
        ? { ...n, resolved: true, read: true } : n))
  }, [])

  // ── Mark Notification Read ─────────────────────────────────────────────
  const handleMarkRead = useCallback(async (id) => {
    if (apiMode.current) {
      try { await api.markOneRead(id) } catch {/* ok */}
    }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }, [])

  // ── Employee CRUD ──────────────────────────────────────────────────────
  const handleAddUser = async (formData) => {
    if (apiMode.current) {
      try {
        const created = await api.createEmployee(formData)
        setUsers(prev => [...prev, { ...created, fromApi: true }])
        return
      } catch {/* fall through */}
    }
    const prefix = formData.role === 'admin' ? 'ADM' : formData.role === 'manager' ? 'MGR' : 'EMP'
    const count  = users.filter(u => u.role === formData.role).length + 1
    const id     = `${prefix}${String(count).padStart(3, '0')}`
    setUsers(prev => [...prev, { ...formData, id }])
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
        ? { ...d, connected: true, active: true, status: 'ONLINE' } : d))
  }

  const handleDisconnectDevice = async (id) => {
    if (apiMode.current) {
      try { await api.disconnectDevice(id) } catch {/* ok */}
    }
    setDevices(prev => prev.map(d =>
      d.id === id || String(d.id) === String(id)
        ? { ...d, connected: false, active: false, status: 'OFFLINE' } : d))
  }

  const handleToggleDevice = async (id) => {
    const dev = devices.find(d => d.id === id || String(d.id) === String(id))
    if (dev?.connected || dev?.status === 'ONLINE') {
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
      return <EmployeeDashboard user={user} attendance={myAttendance} />
    }

    if (user.role === 'manager' || user.role === 'admin') {
      switch (currentPage) {
        case 'dashboard':
          return user.role === 'admin'
            ? <AdminDashboard users={users} attendance={attendance} onNavigate={setCurrentPage} devices={devices} onToggleDevice={handleToggleDevice} chartData={chartData} />
            : <ManagerDashboard users={users} attendance={attendance} myAttendance={myAttendance} currentUser={user} onApproveOffline={handleApproveOffline} />
        case 'live':
          return <ManagerDashboard users={users} attendance={attendance} myAttendance={myAttendance} currentUser={user} onApproveOffline={handleApproveOffline} />
        case 'breaks': {
          const breakAtt = attendance.filter(a => ['BREAK', 'LUNCH', 'MISS_PUNCH'].includes(a.status))
          return (
            <ManagerDashboard
              users={users.filter(u => breakAtt.find(a => a.employeeId === u.id))}
              attendance={breakAtt}
              myAttendance={myAttendance}
              currentUser={user}
              onApproveOffline={handleApproveOffline}
            />
          )
        }
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
          return <ApprovalsPage notifications={notifications} onApproveOffline={handleApproveOffline} onMarkRead={handleMarkRead} />
        case 'settings':
          return <Settings />
        default:
          return user.role === 'admin'
            ? <AdminDashboard users={users} attendance={attendance} onNavigate={setCurrentPage} />
            : <ManagerDashboard users={users} attendance={attendance} onApproveOffline={handleApproveOffline} />
      }
    }
  }

  return (
    <div className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
      <Sidebar
        role={user.role}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
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
        />
      )}
    </div>
  )
}
