import { useState } from 'react'
import { changeMyPassword, rebuildData } from '../../services/api'

const USE_API = Boolean(import.meta.env.VITE_API_URL)

const SECTION = ({ title, children }) => (
  <div className="section-card" style={{ marginBottom: 20 }}>
    <div className="section-header">
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1e293b' }}>{title}</h3>
    </div>
    <div style={{ padding: '20px 24px 16px' }}>
      {children}
    </div>
  </div>
)

const Field = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 16 }}>
    <label style={{ width: 220, fontSize: 13, color: '#64748b', flexShrink: 0 }}>{label}</label>
    <div style={{ flex: 1 }}>{children}</div>
  </div>
)

const Input = (props) => (
  <input {...props} style={{
    width: '100%', padding: '7px 11px', borderRadius: 7,
    border: '1.5px solid #e2e8f0', fontSize: 13, color: '#1e293b',
    background: '#f8fafc', outline: 'none', boxSizing: 'border-box',
    ...props.style
  }} />
)

const SaveBtn = ({ onClick, saved }) => (
  <button onClick={onClick} style={{
    display: 'block', marginTop: 8, marginLeft: 'auto',
    padding: '8px 22px', borderRadius: 8,
    background: saved ? '#16a34a' : '#1e293b', color: '#fff',
    border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    transition: 'background 0.3s'
  }}>
    {saved ? '✓ Saved' : 'Save Changes'}
  </button>
)

export default function Settings({ role = 'admin' }) {
  const [saved, setSaved] = useState({})

  const save = (section) => {
    setSaved(prev => ({ ...prev, [section]: true }))
    setTimeout(() => setSaved(prev => ({ ...prev, [section]: false })), 2000)
  }

  const [attendance, setAttendance] = useState({
    lateAfter: '09:15',
    veryLateAfter: '10:30',
    lunchStart: '12:45',
    lunchEnd: '14:00',
    missPunchHours: '2',
    targetHours: '9',
    dailyResetTime: '00:00',
  })

  const [company, setCompany] = useState({
    name: 'WILOTUS',
    address: '',
    phone: '',
    email: 'admin@wilotus.com',
    timezone: 'Asia/Kolkata',
  })

  const [password, setPassword] = useState({
    current: '', newPass: '', confirm: ''
  })
  const [pwError, setPwError] = useState('')
  const [pwSaved, setPwSaved] = useState(false)

  const handleSavePassword = async () => {
    setPwError('')
    if (!password.current) return setPwError('Enter current password')
    if (password.newPass.length < 6) return setPwError('New password must be at least 6 characters')
    if (password.newPass !== password.confirm) return setPwError('Passwords do not match')
    if (USE_API) {
      try {
        await changeMyPassword(password.current, password.newPass)
      } catch (e) {
        return setPwError(e.message || 'Failed to change password')
      }
    }
    setPwSaved(true)
    setPassword({ current: '', newPass: '', confirm: '' })
    setTimeout(() => setPwSaved(false), 2000)
  }

  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      await rebuildData()
      setSyncMsg('Sync started successfully')
    } catch (e) {
      setSyncMsg('Failed: ' + (e.message || 'unknown error'))
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(''), 4000)
    }
  }

  const isAdmin = role === 'admin'

  return (
    <div className="page-content">

      {/* Attendance Rules — admin only */}
      {isAdmin && (
        <SECTION title="Attendance Rules">
          <Field label="Late arrival after">
            <Input type="time" value={attendance.lateAfter}
              onChange={e => setAttendance(p => ({ ...p, lateAfter: e.target.value }))} style={{ width: 140 }} />
          </Field>
          <Field label="Very late arrival after">
            <Input type="time" value={attendance.veryLateAfter}
              onChange={e => setAttendance(p => ({ ...p, veryLateAfter: e.target.value }))} style={{ width: 140 }} />
          </Field>
          <Field label="Lunch window start">
            <Input type="time" value={attendance.lunchStart}
              onChange={e => setAttendance(p => ({ ...p, lunchStart: e.target.value }))} style={{ width: 140 }} />
          </Field>
          <Field label="Lunch window end">
            <Input type="time" value={attendance.lunchEnd}
              onChange={e => setAttendance(p => ({ ...p, lunchEnd: e.target.value }))} style={{ width: 140 }} />
          </Field>
          <Field label="Miss punch threshold (hours)">
            <Input type="number" min="1" max="8" value={attendance.missPunchHours}
              onChange={e => setAttendance(p => ({ ...p, missPunchHours: e.target.value }))} style={{ width: 80 }} />
          </Field>
          <Field label="Daily work target (hours)">
            <Input type="number" min="1" max="12" value={attendance.targetHours}
              onChange={e => setAttendance(p => ({ ...p, targetHours: e.target.value }))} style={{ width: 80 }} />
          </Field>
          <Field label="Daily reset time">
            <Input type="time" value={attendance.dailyResetTime}
              onChange={e => setAttendance(p => ({ ...p, dailyResetTime: e.target.value }))} style={{ width: 140 }} />
          </Field>
          <SaveBtn onClick={() => save('attendance')} saved={saved.attendance} />
        </SECTION>
      )}

      {/* Company Info — admin only */}
      {isAdmin && (
        <SECTION title="Company Information">
          <Field label="Company name">
            <Input value={company.name}
              onChange={e => setCompany(p => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Address">
            <Input value={company.address} placeholder="Office address"
              onChange={e => setCompany(p => ({ ...p, address: e.target.value }))} />
          </Field>
          <Field label="Phone">
            <Input value={company.phone} placeholder="+91 ..."
              onChange={e => setCompany(p => ({ ...p, phone: e.target.value }))} />
          </Field>
          <Field label="Admin email">
            <Input type="email" value={company.email}
              onChange={e => setCompany(p => ({ ...p, email: e.target.value }))} />
          </Field>
          <Field label="Timezone">
            <select value={company.timezone}
              onChange={e => setCompany(p => ({ ...p, timezone: e.target.value }))}
              style={{ padding: '7px 11px', borderRadius: 7, border: '1.5px solid #e2e8f0', fontSize: 13, color: '#1e293b', background: '#f8fafc' }}>
              <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
          <SaveBtn onClick={() => save('company')} saved={saved.company} />
        </SECTION>
      )}

      {/* Data Sync — admin only */}
      {isAdmin && (
        <SECTION title="Data Sync">
          <Field label="Rebuild attendance data">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={handleSync} disabled={syncing} style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: syncing ? '#94a3b8' : '#1e293b', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: syncing ? 'default' : 'pointer'
              }}>
                {syncing ? 'Running...' : 'Run Sync'}
              </button>
              {syncMsg && (
                <span style={{ fontSize: 13, color: syncMsg.startsWith('Failed') ? '#ef4444' : '#16a34a', fontWeight: 500 }}>
                  {syncMsg}
                </span>
              )}
            </div>
          </Field>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0 236px' }}>
            Runs device_sync.py on the server — syncs biometric device data and rebuilds attendance records.
          </p>
        </SECTION>
      )}

      {/* Change Password */}
      <SECTION title="Change Password">
        <Field label="Current password">
          <Input type="password" value={password.current} placeholder="••••••••"
            onChange={e => setPassword(p => ({ ...p, current: e.target.value }))} style={{ width: 240 }} />
        </Field>
        <Field label="New password">
          <Input type="password" value={password.newPass} placeholder="••••••••"
            onChange={e => setPassword(p => ({ ...p, newPass: e.target.value }))} style={{ width: 240 }} />
        </Field>
        <Field label="Confirm new password">
          <Input type="password" value={password.confirm} placeholder="••••••••"
            onChange={e => setPassword(p => ({ ...p, confirm: e.target.value }))} style={{ width: 240 }} />
        </Field>
        {pwError && <p style={{ color: '#ef4444', fontSize: 13, margin: '4px 0 8px 236px' }}>{pwError}</p>}
        <SaveBtn onClick={handleSavePassword} saved={pwSaved} />
      </SECTION>


    </div>
  )
}
