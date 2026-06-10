import { useState } from 'react'
import { changeMyPassword } from '../../services/api'

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

      {/* System Info */}
      <SECTION title="System Information">
        <Field label="Application version"><span style={{ fontSize: 13, color: '#475569' }}>v1.0.0</span></Field>
        <Field label="Backend"><span style={{ fontSize: 13, color: '#475569' }}>Spring Boot 3.2.5</span></Field>
        <Field label="Database"><span style={{ fontSize: 13, color: '#475569' }}>PostgreSQL — 192.168.1.104:5432</span></Field>
        <Field label="Frontend"><span style={{ fontSize: 13, color: '#475569' }}>React 19 + Vite</span></Field>
        <Field label="Mode">
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
            background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0'
          }}>LAN Mode</span>
        </Field>
      </SECTION>

    </div>
  )
}
