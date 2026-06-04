function hoursAgo(h) {
  return new Date(Date.now() - h * 3600000).toISOString()
}
function minsAgo(m) {
  return new Date(Date.now() - m * 60000).toISOString()
}

export const USERS = [
  { id: 'EMP001', name: 'Vemana Kalyan',  email: 'kalyan.v@wilotus.com',   role: 'employee', dept: 'Engineering',  password: 'pass123',  avatar: 'VK' },
  { id: 'EMP002', name: 'Rajesh Kumar',   email: 'rajesh.k@wilotus.com',   role: 'employee', dept: 'Marketing',    password: 'pass123',  avatar: 'RK' },
  { id: 'EMP003', name: 'Priya Sharma',   email: 'priya.s@wilotus.com',    role: 'employee', dept: 'Sales',        password: 'pass123',  avatar: 'PS' },
  { id: 'EMP004', name: 'Arun Patel',     email: 'arun.p@wilotus.com',     role: 'employee', dept: 'Engineering',  password: 'pass123',  avatar: 'AP' },
  { id: 'EMP005', name: 'Deepa Nair',     email: 'deepa.n@wilotus.com',    role: 'employee', dept: 'Finance',      password: 'pass123',  avatar: 'DN' },
  { id: 'EMP006', name: 'Suresh Babu',    email: 'suresh.b@wilotus.com',   role: 'employee', dept: 'Operations',   password: 'pass123',  avatar: 'SB' },
  { id: 'EMP007', name: 'Kavya Reddy',    email: 'kavya.r@wilotus.com',    role: 'employee', dept: 'Engineering',  password: 'pass123',  avatar: 'KR' },
  { id: 'EMP008', name: 'Mohan Das',      email: 'mohan.d@wilotus.com',    role: 'employee', dept: 'Support',      password: 'pass123',  avatar: 'MD' },
  { id: 'EMP009', name: 'Anita Singh',    email: 'anita.s@wilotus.com',    role: 'employee', dept: 'HR',           password: 'pass123',  avatar: 'AS' },
  { id: 'EMP010', name: 'Rahul Verma',    email: 'rahul.v@wilotus.com',    role: 'employee', dept: 'Engineering',  password: 'pass123',  avatar: 'RV' },
  { id: 'MGR001', name: 'Suresh Reddy',   email: 'manager@wilotus.com',    role: 'manager',  dept: 'Engineering',  password: 'mgr123',   avatar: 'SR' },
  { id: 'ADM001', name: 'Admin User',     email: 'admin@wilotus.com',      role: 'admin',    dept: 'IT',           password: 'admin123', avatar: 'AU' },
]

export function generateInitialAttendance() {
  return [
    {
      employeeId: 'EMP001', status: 'WORKING', lateStatus: 'NORMAL',
      entryTime: hoursAgo(5.1), lastPunchIn: hoursAgo(5.1), lastPunchOut: null,
      workTotal: 5.1 * 3600000, breakTotal: 0, lunchTotal: 0,
    },
    {
      employeeId: 'EMP002', status: 'BREAK', lateStatus: 'NORMAL',
      entryTime: hoursAgo(4.8), lastPunchIn: hoursAgo(4.38), lastPunchOut: minsAgo(25),
      workTotal: 4.38 * 3600000, breakTotal: 25 * 60000, lunchTotal: 0,
    },
    {
      employeeId: 'EMP003', status: 'LUNCH', lateStatus: 'NORMAL',
      entryTime: hoursAgo(4.5), lastPunchIn: hoursAgo(4.5), lastPunchOut: minsAgo(40),
      workTotal: (4.5 - 40/60) * 3600000, breakTotal: 0, lunchTotal: 40 * 60000,
    },
    {
      employeeId: 'EMP004', status: 'WORKING', lateStatus: 'LATE',
      entryTime: hoursAgo(4.2), lastPunchIn: hoursAgo(4.2), lastPunchOut: null,
      workTotal: 4.2 * 3600000, breakTotal: 0, lunchTotal: 0,
    },
    {
      employeeId: 'EMP005', status: 'MISS_PUNCH', lateStatus: 'NORMAL',
      entryTime: hoursAgo(5), lastPunchIn: hoursAgo(5), lastPunchOut: hoursAgo(2.2),
      workTotal: 2.8 * 3600000, breakTotal: 0, lunchTotal: 0,
    },
    {
      employeeId: 'EMP006', status: 'OFFLINE', lateStatus: 'NORMAL',
      entryTime: hoursAgo(5.5), lastPunchIn: hoursAgo(5.5), lastPunchOut: hoursAgo(3),
      workTotal: 2.5 * 3600000, breakTotal: 0, lunchTotal: 0,
    },
    {
      employeeId: 'EMP007', status: 'NOT_ARRIVED', lateStatus: null,
      entryTime: null, lastPunchIn: null, lastPunchOut: null,
      workTotal: 0, breakTotal: 0, lunchTotal: 0,
    },
    {
      employeeId: 'EMP008', status: 'WORKING', lateStatus: 'VERY_LATE',
      entryTime: hoursAgo(2.9), lastPunchIn: hoursAgo(2.9), lastPunchOut: null,
      workTotal: 2.9 * 3600000, breakTotal: 0, lunchTotal: 0,
    },
    {
      employeeId: 'EMP009', status: 'WORKING', lateStatus: 'NORMAL',
      entryTime: hoursAgo(5.3), lastPunchIn: hoursAgo(5.3), lastPunchOut: null,
      workTotal: 5.3 * 3600000, breakTotal: 0, lunchTotal: 0,
    },
    {
      employeeId: 'EMP010', status: 'BREAK', lateStatus: 'LATE',
      entryTime: hoursAgo(4.1), lastPunchIn: hoursAgo(3.85), lastPunchOut: minsAgo(15),
      workTotal: 3.85 * 3600000, breakTotal: 15 * 60000, lunchTotal: 0,
    },
  ]
}

export function generateHistory(days = 30) {
  const rows = []
  for (let i = 1; i <= days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const day = d.getDay()
    const dateStr = d.toISOString().slice(0, 10)
    if (day === 0 || day === 6) { rows.push({ date: dateStr, status: 'HOLIDAY', workTotal: 0 }); continue }
    const r = Math.random()
    if (r < 0.05) { rows.push({ date: dateStr, status: 'ABSENT', workTotal: 0 }); continue }
    const eh = 8 + Math.floor(Math.random() * 2.5)
    const em = Math.floor(Math.random() * 60)
    const wh = 7.5 + Math.random() * 2
    const totalMins = eh * 60 + em
    rows.push({
      date: dateStr,
      status: 'PRESENT',
      workTotal: wh * 3600000,
      entryTime: `${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`,
      exitTime: `${String(Math.floor(eh + wh)).padStart(2,'0')}:${String(em).padStart(2,'0')}`,
      lateStatus: totalMins <= 555 ? 'NORMAL' : totalMins <= 629 ? 'LATE' : 'VERY_LATE',
    })
  }
  return rows
}

export const DEVICES_INIT = [
  { id: 'DEV001', name: 'Main Entrance', ip: '192.168.1.224', port: 4370, location: 'Ground Floor – Main Gate', interval: 10, status: 'OFFLINE' },
]

export const NOTIFICATIONS_INIT = [
  {
    id: 'N001', type: 'MISS_PUNCH',
    employeeId: 'EMP005', employeeName: 'Deepa Nair', employeeId2: '10152',
    message: 'Outside for 2h 12m without returning.',
    time: new Date(Date.now() - 12 * 60000).toISOString(),
    read: false,
  },
]
