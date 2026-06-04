import { useState } from 'react'

const EMPTY = { name: '', ipAddress: '', port: '4370', location: '', pollIntervalSeconds: '30' }

function formatLastSeen(ts) {
  if (!ts) return 'Never'
  const d = new Date(ts)
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function DeviceManagement({
  devices, onAddDevice, onDeleteDevice, onToggleDevice, onEditDevice, onConnectDevice, onDisconnectDevice
}) {
  const [showAddForm, setShowAddForm]   = useState(false)
  const [editDevice, setEditDevice]     = useState(null)
  const [form, setForm]                 = useState(EMPTY)
  const [editForm, setEditForm]         = useState(EMPTY)
  const [error, setError]               = useState('')
  const [editError, setEditError]       = useState('')
  const [loadingId, setLoadingId]       = useState(null)

  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/

  const handleAdd = (e) => {
    e.preventDefault()
    setError('')
    if (!ipPattern.test(form.ipAddress)) { setError('Enter a valid IP address.'); return }
    if (+form.port < 1 || +form.port > 65535) { setError('Port must be 1–65535.'); return }
    onAddDevice({ ...form, port: +form.port, pollIntervalSeconds: +form.pollIntervalSeconds })
    setForm(EMPTY)
    setShowAddForm(false)
  }

  const openEdit = (dev) => {
    setEditDevice(dev)
    setEditForm({
      name:                dev.name || '',
      ipAddress:           dev.ipAddress || dev.ip || '',
      port:                String(dev.port || 4370),
      location:            dev.location || '',
      pollIntervalSeconds: String(dev.pollIntervalSeconds || dev.interval || 30),
    })
    setEditError('')
  }

  const handleEdit = (e) => {
    e.preventDefault()
    setEditError('')
    if (!ipPattern.test(editForm.ipAddress)) { setEditError('Enter a valid IP address.'); return }
    if (+editForm.port < 1 || +editForm.port > 65535) { setEditError('Port must be 1–65535.'); return }
    onEditDevice(editDevice.id, { ...editForm, port: +editForm.port, pollIntervalSeconds: +editForm.pollIntervalSeconds })
    setEditDevice(null)
  }

  const handleConnect = async (dev) => {
    setLoadingId(dev.id)
    await onConnectDevice(dev.id)
    setLoadingId(null)
  }

  const handleDisconnect = async (dev) => {
    setLoadingId(dev.id)
    await onDisconnectDevice(dev.id)
    setLoadingId(null)
  }

  return (
    <div className="page-content">
      <div className="section-card">
        <div className="section-header">
          <div className="section-header-left">
            <h3>Biometric Devices</h3>
            <span className="section-count">{devices.length} configured</span>
          </div>
          <button className="btn-primary-sm" onClick={() => { setShowAddForm(true); setError('') }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Device
          </button>
        </div>

        {devices.length === 0 ? (
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
            </svg>
            <p>No biometric devices configured.</p>
          </div>
        ) : (
          <div className="devices-grid">
            {devices.map(dev => {
              const isConnected = dev.connected || dev.status === 'ONLINE'
              const isLoading   = loadingId === dev.id
              const ip          = dev.ipAddress || dev.ip || '—'
              const port        = dev.port || 4370
              const interval    = dev.pollIntervalSeconds || dev.interval || '—'
              const lastSeen    = dev.lastSeen

              return (
                <div key={dev.id} className="device-card">
                  <div className="device-card-top">
                    <div className="device-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
                        <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
                        <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
                        <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
                        <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
                      </svg>
                    </div>
                    <div className="device-info">
                      <div className="device-name">{dev.name}</div>
                      <div className="device-location">{dev.location || '—'}</div>
                    </div>
                    <div className={`device-status-badge ${isConnected ? 'status-online' : 'status-offline-dev'}`}>
                      <span className="sdot"/>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                  </div>

                  <div className="device-details">
                    <div className="device-detail-item">
                      <span>IP Address</span>
                      <code>{ip}</code>
                    </div>
                    <div className="device-detail-item">
                      <span>Port</span>
                      <code>{port}</code>
                    </div>
                    <div className="device-detail-item">
                      <span>Poll Interval</span>
                      <code>{interval}s</code>
                    </div>
                    <div className="device-detail-item">
                      <span>Last Seen</span>
                      <code style={{ fontSize: 11 }}>{formatLastSeen(lastSeen)}</code>
                    </div>
                  </div>

                  <div className="device-actions">
                    {isConnected ? (
                      <button
                        className="btn-toggle-dev btn-toggle-off"
                        onClick={() => handleDisconnect(dev)}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Please wait…' : 'Disconnect'}
                      </button>
                    ) : (
                      <button
                        className="btn-toggle-dev btn-toggle-on"
                        onClick={() => handleConnect(dev)}
                        disabled={isLoading}
                      >
                        {isLoading ? 'Connecting…' : 'Connect'}
                      </button>
                    )}
                    <button className="btn-secondary-sm" onClick={() => openEdit(dev)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Edit
                    </button>
                    <button className="btn-danger-sm" onClick={() => onDeleteDevice(dev.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      </svg>
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Device Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAddForm(false) }}>
          <div className="modal-card">
            <div className="modal-header">
              <h3>Add New Device</h3>
              <button className="modal-close" onClick={() => setShowAddForm(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleAdd} className="modal-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Device Name</label>
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Main Entrance" required />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="e.g. Ground Floor – Gate A" required />
                </div>
                <div className="form-group">
                  <label>IP Address</label>
                  <input value={form.ipAddress} onChange={e => setForm({...form, ipAddress: e.target.value})} placeholder="192.168.1.224" required />
                </div>
                <div className="form-group">
                  <label>Port</label>
                  <input type="number" value={form.port} onChange={e => setForm({...form, port: e.target.value})} placeholder="4370" required />
                </div>
                <div className="form-group form-col-span-2">
                  <label>Poll Interval (seconds)</label>
                  <input type="number" value={form.pollIntervalSeconds} onChange={e => setForm({...form, pollIntervalSeconds: e.target.value})} min="5" max="300" required />
                </div>
              </div>
              {error && <p className="form-error">{error}</p>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Add Device</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Device Modal */}
      {editDevice && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditDevice(null) }}>
          <div className="modal-card">
            <div className="modal-header">
              <h3>Edit Device</h3>
              <button className="modal-close" onClick={() => setEditDevice(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleEdit} className="modal-form">
              <div className="form-grid-2">
                <div className="form-group">
                  <label>Device Name</label>
                  <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <input value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>IP Address</label>
                  <input value={editForm.ipAddress} onChange={e => setEditForm({...editForm, ipAddress: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Port</label>
                  <input type="number" value={editForm.port} onChange={e => setEditForm({...editForm, port: e.target.value})} required />
                </div>
                <div className="form-group form-col-span-2">
                  <label>Poll Interval (seconds)</label>
                  <input type="number" value={editForm.pollIntervalSeconds} onChange={e => setEditForm({...editForm, pollIntervalSeconds: e.target.value})} min="5" max="300" required />
                </div>
              </div>
              {editError && <p className="form-error">{editError}</p>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setEditDevice(null)}>Cancel</button>
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
