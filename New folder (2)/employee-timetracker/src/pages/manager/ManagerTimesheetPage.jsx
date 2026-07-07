import { useState, useEffect, useRef } from 'react'
import * as api from '../../services/api'
import * as XLSX from 'xlsx'

const STATUS = {
  DRAFT:     { label: 'Draft',     color: '#6b7280', bg: '#f1f5f9' },
  SUBMITTED: { label: 'Submitted', color: '#b45309', bg: '#fef3c7' },
  APPROVED:  { label: 'Approved',  color: '#065f46', bg: '#d1fae5' },
  REJECTED:  { label: 'Rejected',  color: '#991b1b', bg: '#fee2e2' },
}

function fmtHours(minutes) {
  const m = Number(minutes) || 0
  const h = Math.floor(m / 60)
  const min = m % 60
  return min > 0 ? `${h}h ${min}m` : `${h}h`
}

function Badge({ status }) {
  const s = STATUS[status] || STATUS.DRAFT
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '4px 12px',
      borderRadius: 20, fontSize: 12, fontWeight: 700,
      color: s.color, background: s.bg, whiteSpace: 'nowrap',
      letterSpacing: '0.3px',
    }}>{s.label}</span>
  )
}

function fmtDate(d) {
  if (!d) return ''
  const parts = String(d).slice(0, 10).split('-')
  return parts.length < 3 ? d : `${parts[2]}/${parts[1]}/${parts[0]}`
}

function ModChip({ name, color = '#7c3aed', bg = '#ede9fe' }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 6,
      fontSize: 11, fontWeight: 600, color, background: bg,
      margin: '2px 3px 2px 0', whiteSpace: 'nowrap',
    }}>{name}</span>
  )
}

/* ── Detail modal ──────────────────────────────────────── */
function DetailModal({ ts, onClose, onApprove, onReject, actionLoading }) {
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject]     = useState(false)

  if (!ts) return null
  const mods = ts.modules ? ts.modules.split(',').map(m => m.trim()).filter(Boolean) : []

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560,
        margin: '16px', boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Modal header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              {ts.employeeName || ts.employeeId}
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              {fmtDate(ts.workingDate)} &nbsp;·&nbsp; {fmtHours(ts.workingHours)} worked
              {ts.managerName && <> &nbsp;·&nbsp; Manager: <strong>{ts.managerName}</strong></>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge status={ts.status} />
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#94a3b8', fontSize: 22, lineHeight: 1, padding: 4,
            }}>×</button>
          </div>
        </div>

        {/* Modal body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {/* Modules */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
              letterSpacing: '0.8px', marginBottom: 8 }}>Working Modules</div>
            {mods.length > 0
              ? mods.map(m => <ModChip key={m} name={m} />)
              : <span style={{ color: '#94a3b8', fontSize: 13 }}>No modules listed</span>
            }
          </div>

          {/* Description */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
              letterSpacing: '0.8px', marginBottom: 8 }}>Brief Description</div>
            <div style={{
              background: '#f8fafc', borderRadius: 10, padding: '14px 16px',
              fontSize: 13, color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap',
              border: '1px solid #e2e8f0', maxHeight: 240, overflowY: 'auto',
            }}>
              {ts.description || <span style={{ color: '#94a3b8' }}>No description provided.</span>}
            </div>
          </div>

          {/* Rejection reason */}
          {ts.status === 'REJECTED' && ts.rejectReason && (
            <div style={{
              background: '#fef2f2', borderRadius: 10, padding: '12px 16px',
              border: '1px solid #fecaca', marginBottom: 18,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase',
                letterSpacing: '0.8px', marginBottom: 6 }}>Rejection Reason</div>
              <div style={{ fontSize: 13, color: '#7f1d1d' }}>{ts.rejectReason}</div>
            </div>
          )}

          {/* Reject input */}
          {showReject && (
            <div style={{ marginBottom: 12 }}>
              <textarea
                autoFocus
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection…"
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', border: '1px solid #fca5a5',
                  borderRadius: 8, fontSize: 13, boxSizing: 'border-box',
                  resize: 'vertical', fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
          )}
        </div>

        {/* Modal footer */}
        {ts.status === 'SUBMITTED' && (
          <div style={{
            padding: '16px 24px', borderTop: '1px solid #f1f5f9',
            display: 'flex', gap: 8, justifyContent: 'flex-end',
          }}>
            {showReject
              ? <>
                  <button onClick={() => { setShowReject(false); setRejectReason('') }} style={{
                    padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
                    background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 13,
                  }}>Cancel</button>
                  <button
                    onClick={() => { if (rejectReason.trim()) onReject(ts.id, rejectReason) }}
                    disabled={!rejectReason.trim() || actionLoading === ts.id}
                    style={{
                      padding: '9px 20px', borderRadius: 8, border: 'none',
                      background: '#dc2626', color: '#fff', cursor: 'pointer',
                      fontSize: 13, fontWeight: 700,
                    }}>Confirm Reject</button>
                </>
              : <>
                  <button onClick={() => setShowReject(true)} style={{
                    padding: '9px 18px', borderRadius: 8, border: '1px solid #fca5a5',
                    background: '#fff', color: '#dc2626', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600,
                  }}>✕ Reject</button>
                  <button onClick={() => onApprove(ts.id)} disabled={actionLoading === ts.id} style={{
                    padding: '9px 22px', borderRadius: 8, border: 'none',
                    background: '#059669', color: '#fff', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                    boxShadow: '0 2px 6px rgba(5,150,105,0.3)',
                  }}>✓ Approve</button>
                </>
            }
          </div>
        )}
      </div>
    </div>
  )
}

const PAGE_SIZE = 15

function Pagination({ page, total, pageSize, onChange }) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  const pages = []
  for (let i = 1; i <= totalPages; i++) pages.push(i)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 20px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
      <span style={{ fontSize: 12, color: '#64748b' }}>
        Showing {Math.min((page-1)*pageSize+1, total)}–{Math.min(page*pageSize, total)} of <strong>{total}</strong>
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={() => onChange(page - 1)} disabled={page === 1} style={{
          padding: '5px 10px', borderRadius: 7, border: '1px solid #e2e8f0',
          background: '#fff', cursor: page === 1 ? 'default' : 'pointer',
          color: page === 1 ? '#cbd5e1' : '#374151', fontSize: 13, fontWeight: 600,
        }}>‹</button>
        {pages.map(p => (
          <button key={p} onClick={() => onChange(p)} style={{
            padding: '5px 10px', borderRadius: 7, border: '1px solid #e2e8f0',
            background: p === page ? '#1e293b' : '#fff',
            color: p === page ? '#fff' : '#374151',
            cursor: 'pointer', fontSize: 13, fontWeight: p === page ? 700 : 500,
            minWidth: 34,
          }}>{p}</button>
        ))}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages} style={{
          padding: '5px 10px', borderRadius: 7, border: '1px solid #e2e8f0',
          background: '#fff', cursor: page === totalPages ? 'default' : 'pointer',
          color: page === totalPages ? '#cbd5e1' : '#374151', fontSize: 13, fontWeight: 600,
        }}>›</button>
      </div>
    </div>
  )
}

/* ── Main component ───────────────────────────────────── */
export default function ManagerTimesheetPage({ user }) {
  const [tab, setTab]               = useState('pending')
  const [timesheets, setTimesheets] = useState([])
  const [modules, setModules]       = useState([])
  const [loading, setLoading]       = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [actionLoading, setActionLoading] = useState(null)
  const [detailTs, setDetailTs]     = useState(null)
  const [selected, setSelected]     = useState(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkRejectMode, setBulkRejectMode] = useState(false)
  const [bulkRejectReason, setBulkRejectReason] = useState('')
  const [newModule, setNewModule]   = useState('')
  const [moduleError, setModuleError] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [empSearch, setEmpSearch]       = useState('')
  const [showEmpDrop, setShowEmpDrop]   = useState(false)
  const empDropRef = useRef(null)
  const [pendingPage, setPendingPage] = useState(1)
  const [allPage, setAllPage]         = useState(1)

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (empDropRef.current && !empDropRef.current.contains(e.target)) {
        setShowEmpDrop(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [ts, mods] = await Promise.all([api.fetchTeamTimesheets(), api.fetchTimesheetModules()])
      setTimesheets(ts)
      setModules(mods)
      setSelected(new Set())
    } catch {}
    setLoading(false)
  }

  async function handleApprove(id) {
    setActionLoading(id)
    try {
      const updated = await api.approveTimesheet(id)
      setTimesheets(prev => prev.map(t => t.id === id ? updated : t))
      if (detailTs?.id === id) setDetailTs(updated)
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    } catch (e) { alert(e.message || 'Failed to approve') }
    setActionLoading(null)
  }

  async function handleReject(id, reason) {
    setActionLoading(id)
    try {
      const updated = await api.rejectTimesheet(id, reason)
      setTimesheets(prev => prev.map(t => t.id === id ? updated : t))
      if (detailTs?.id === id) setDetailTs(updated)
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    } catch (e) { alert(e.message || 'Failed to reject') }
    setActionLoading(null)
  }

  async function handleBulkApprove() {
    if (selected.size === 0) return
    if (!window.confirm(`Approve ${selected.size} selected timesheet(s)?`)) return
    setBulkLoading(true)
    const ids = [...selected]
    for (const id of ids) {
      try {
        const updated = await api.approveTimesheet(id)
        setTimesheets(prev => prev.map(t => t.id === id ? updated : t))
      } catch {}
    }
    setSelected(new Set())
    setBulkLoading(false)
  }

  async function handleBulkReject() {
    if (!bulkRejectReason.trim()) return
    setBulkLoading(true)
    const ids = [...selected]
    for (const id of ids) {
      try {
        const updated = await api.rejectTimesheet(id, bulkRejectReason.trim())
        setTimesheets(prev => prev.map(t => t.id === id ? updated : t))
      } catch {}
    }
    setSelected(new Set())
    setBulkRejectMode(false)
    setBulkRejectReason('')
    setBulkLoading(false)
  }

  async function handleAddModule() {
    if (!newModule.trim()) { setModuleError('Module name is required'); return }
    setModuleError('')
    try {
      const created = await api.addTimesheetModule(newModule.trim())
      setModules(prev => [...prev, created])
      setNewModule('')
    } catch (e) { setModuleError(e.message || 'Failed to add module') }
  }

  async function handleDeleteModule(id) {
    if (!window.confirm('Delete this module?')) return
    try {
      await api.deleteTimesheetModule(id)
      setModules(prev => prev.filter(m => m.id !== id))
    } catch (e) { alert(e.message || 'Failed to delete') }
  }

  // Only show employees who currently have SUBMITTED (pending) timesheets
  const empNames = [...new Set(
    timesheets.filter(t => t.status === 'SUBMITTED').map(t => t.employeeName || t.employeeId).filter(Boolean)
  )].sort()

  function applyEmpFilter(rows) {
    if (!employeeFilter) return rows
    const q = employeeFilter.toLowerCase()
    return rows.filter(t =>
      (t.employeeName || '').toLowerCase().includes(q) ||
      (t.employeeId || '').toLowerCase().includes(q)
    )
  }

  function setEmpFilter(val) { setEmployeeFilter(val); setPendingPage(1); setAllPage(1) }
  function setStatus(val) { setStatusFilter(val); setAllPage(1) }

  const pending  = applyEmpFilter(timesheets.filter(t => t.status === 'SUBMITTED'))
  const filtered = applyEmpFilter(statusFilter === 'ALL' ? timesheets : timesheets.filter(t => t.status === statusFilter))

  const pagedPending  = pending.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE)
  const pagedFiltered = filtered.slice((allPage - 1) * PAGE_SIZE, allPage * PAGE_SIZE)

  const counts = {
    pending:  pending.length,
    approved: timesheets.filter(t => t.status === 'APPROVED').length,
    rejected: timesheets.filter(t => t.status === 'REJECTED').length,
    total:    timesheets.length,
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function toggleSelectAll(rows) {
    const ids = rows.map(r => r.id)
    const allSelected = ids.every(id => selected.has(id))
    setSelected(prev => {
      const n = new Set(prev)
      allSelected ? ids.forEach(id => n.delete(id)) : ids.forEach(id => n.add(id))
      return n
    })
  }

  function exportToExcel() {
    const rows = tab === 'pending' ? pending : filtered
    const data = rows.map(ts => ({
      'Employee Name': ts.employeeName || ts.employeeId || '',
      'Employee ID':   ts.employeeId || '',
      'Date':          fmtDate(ts.workingDate),
      'Working Hours': fmtHours(ts.workingHours),
      'Modules':       ts.modules ? String(ts.modules).split(',').map(m => m.trim()).filter(Boolean).join(', ') : '',
      'Description':   ts.description || '',
      'Status':        STATUS[ts.status]?.label || ts.status || '',
      'Reject Reason': ts.rejectReason || '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheets')
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([wbout], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timesheets_${tab}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function renderTable(rows, showActions) {
    if (rows.length === 0)
      return (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 14 }}>No records found.</div>
        </div>
      )

    const allSelected = rows.every(r => selected.has(r.id))
    const someSelected = rows.some(r => selected.has(r.id))

    return (
      <div style={{ overflowX: 'auto' }}>
        {/* Bulk action bar */}
        {showActions && selected.size > 0 && (
          <div style={{
            padding: '10px 20px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 600 }}>
                {selected.size} selected
              </span>
              <button onClick={handleBulkApprove} disabled={bulkLoading || bulkRejectMode} style={{
                padding: '7px 18px', borderRadius: 8, border: 'none',
                background: '#059669', color: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                boxShadow: '0 2px 6px rgba(5,150,105,0.3)',
                opacity: bulkRejectMode ? 0.5 : 1,
              }}>
                {bulkLoading && !bulkRejectMode ? 'Approving…' : `✓ Approve Selected (${selected.size})`}
              </button>
              {!bulkRejectMode
                ? <button onClick={() => setBulkRejectMode(true)} disabled={bulkLoading} style={{
                    padding: '7px 18px', borderRadius: 8, border: '1px solid #fca5a5',
                    background: '#fff', color: '#dc2626', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700,
                  }}>✕ Reject Selected ({selected.size})</button>
                : null
              }
              <button onClick={() => { setSelected(new Set()); setBulkRejectMode(false); setBulkRejectReason('') }} style={{
                padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
                background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 13,
              }}>Cancel</button>
            </div>
            {bulkRejectMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input
                  autoFocus
                  value={bulkRejectReason}
                  onChange={e => setBulkRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection…"
                  style={{
                    flex: 1, maxWidth: 420, padding: '8px 12px',
                    border: '1px solid #fca5a5', borderRadius: 8,
                    fontSize: 13, outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <button onClick={handleBulkReject} disabled={!bulkRejectReason.trim() || bulkLoading} style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: '#dc2626', color: '#fff', cursor: 'pointer',
                  fontSize: 13, fontWeight: 700,
                  opacity: !bulkRejectReason.trim() ? 0.5 : 1,
                }}>{bulkLoading ? 'Rejecting…' : 'Confirm Reject'}</button>
                <button onClick={() => { setBulkRejectMode(false); setBulkRejectReason('') }} style={{
                  padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
                  background: '#fff', color: '#64748b', cursor: 'pointer', fontSize: 13,
                }}>Cancel</button>
              </div>
            )}
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              {showActions && (
                <th style={{ padding: '12px 14px', width: 40 }}>
                  <input type="checkbox"
                    checked={allSelected && rows.length > 0}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                    onChange={() => toggleSelectAll(rows)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#059669' }}
                  />
                </th>
              )}
              {['Employee', 'Date', 'Hours', 'Modules', 'Description', 'Status'].map(h => (
                <th key={h} style={{
                  padding: '14px 16px', textAlign: 'left',
                  fontWeight: 700, color: '#64748b', fontSize: 12,
                  textTransform: 'uppercase', letterSpacing: '0.6px', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(ts => {
              const isSelected = selected.has(ts.id)
              const mods = ts.modules ? ts.modules.split(',').map(m => m.trim()).filter(Boolean) : []
              return (
                <tr
                  key={ts.id}
                  onClick={() => setDetailTs(ts)}
                  style={{
                    borderBottom: '1px solid #f1f5f9', cursor: 'pointer',
                    background: isSelected ? '#f0fdf4' : '#fff',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#f0fdf4' : '#fff' }}
                >
                  {showActions && (
                    <td style={{ padding: '16px 16px' }} onClick={e => { e.stopPropagation(); toggleSelect(ts.id) }}>
                      <input type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#059669' }}
                      />
                    </td>
                  )}
                  <td style={{ padding: '16px 16px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 14 }}>
                      {ts.employeeName || ts.employeeId}
                    </div>
                  </td>
                  <td style={{ padding: '16px 16px', color: '#475569', whiteSpace: 'nowrap', fontSize: 14 }}>
                    {fmtDate(ts.workingDate)}
                  </td>
                  <td style={{ padding: '16px 16px', color: '#475569', fontWeight: 500, fontSize: 14 }}>
                    {fmtHours(ts.workingHours)}
                  </td>
                  <td style={{ padding: '16px 16px', maxWidth: 180 }}>
                    {mods.length > 0
                      ? mods.slice(0, 2).map(m => <ModChip key={m} name={m} />)
                          .concat(mods.length > 2
                            ? [<span key="more" style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
                                +{mods.length - 2} more
                              </span>]
                            : [])
                      : <span style={{ color: '#cbd5e1', fontSize: 13 }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '16px 16px', maxWidth: 260 }}>
                    <div style={{ color: '#374151', fontSize: 14, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                      {ts.description || <span style={{ color: '#cbd5e1' }}>—</span>}
                    </div>
                    {ts.status === 'REJECTED' && ts.rejectReason && (
                      <div style={{ color: '#dc2626', fontSize: 12, marginTop: 3 }}>
                        ✕ {ts.rejectReason}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px 16px' }}><Badge status={ts.status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="page-content">
      {/* Header row: title + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Timesheets</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportToExcel} style={{
            background: '#16a34a', border: 'none', borderRadius: 8,
            padding: '5px 14px', cursor: 'pointer', fontSize: 12, color: '#fff',
            display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600,
          }}>⬇ Export Excel</button>
          <button onClick={loadAll} style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '5px 14px', cursor: 'pointer', fontSize: 12, color: '#64748b',
            display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500,
          }}>↻ Refresh</button>
        </div>
      </div>

      {/* Stats + Employee filter on same row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { label: 'Pending',  value: counts.pending,  color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
            { label: 'Approved', value: counts.approved, color: '#065f46', bg: '#d1fae5', border: '#a7f3d0' },
            { label: 'Rejected', value: counts.rejected, color: '#991b1b', bg: '#fee2e2', border: '#fecaca' },
            { label: 'Total',    value: counts.total,    color: '#1e40af', bg: '#dbeafe', border: '#bfdbfe' },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10,
              padding: '6px 16px', minWidth: 80,
            }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: s.color, opacity: 0.8 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Employee filter — searchable dropdown */}
        <div ref={empDropRef} style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', position: 'relative' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
            Employee:
          </span>
          <div
            onClick={() => { setShowEmpDrop(v => !v); setEmpSearch('') }}
            style={{
              padding: '6px 32px 6px 12px', borderRadius: 8,
              border: `1px solid ${showEmpDrop ? '#6366f1' : '#d1d5db'}`,
              fontSize: 13, color: employeeFilter ? '#1e293b' : '#9ca3af',
              background: '#fff', cursor: 'pointer', minWidth: 180, maxWidth: 280,
              userSelect: 'none', position: 'relative', boxShadow: showEmpDrop ? '0 0 0 2px #e0e7ff' : 'none',
            }}
          >
            {employeeFilter || 'All Employees'}
            <span style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              color: '#94a3b8', fontSize: 10, pointerEvents: 'none',
            }}>▼</span>
          </div>

          {showEmpDrop && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, zIndex: 200,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, marginTop: 4,
              overflow: 'hidden',
            }}>
              {/* Search input */}
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                <input
                  autoFocus
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  placeholder="Search employee..."
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%', padding: '6px 10px', borderRadius: 7,
                    border: '1px solid #e2e8f0', fontSize: 13, outline: 'none',
                    color: '#1e293b', background: '#f8fafc', boxSizing: 'border-box',
                  }}
                />
              </div>
              {/* Options list */}
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {/* All Employees option */}
                <div
                  onClick={() => { setEmpFilter(''); setShowEmpDrop(false) }}
                  style={{
                    padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                    color: !employeeFilter ? '#6366f1' : '#374151',
                    fontWeight: !employeeFilter ? 700 : 400,
                    background: !employeeFilter ? '#eef2ff' : 'transparent',
                  }}
                  onMouseEnter={e => { if (employeeFilter) e.currentTarget.style.background = '#f8fafc' }}
                  onMouseLeave={e => { if (employeeFilter) e.currentTarget.style.background = 'transparent' }}
                >
                  All Employees
                </div>
                {empNames
                  .filter(n => n.toLowerCase().includes(empSearch.toLowerCase()))
                  .map(n => (
                    <div
                      key={n}
                      onClick={() => { setEmpFilter(n); setShowEmpDrop(false) }}
                      style={{
                        padding: '9px 14px', fontSize: 13, cursor: 'pointer',
                        color: employeeFilter === n ? '#6366f1' : '#374151',
                        fontWeight: employeeFilter === n ? 700 : 400,
                        background: employeeFilter === n ? '#eef2ff' : 'transparent',
                      }}
                      onMouseEnter={e => { if (employeeFilter !== n) e.currentTarget.style.background = '#f8fafc' }}
                      onMouseLeave={e => { if (employeeFilter !== n) e.currentTarget.style.background = 'transparent' }}
                    >
                      {n}
                    </div>
                  ))
                }
                {empNames.filter(n => n.toLowerCase().includes(empSearch.toLowerCase())).length === 0 && (
                  <div style={{ padding: '12px 14px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                    No employees found
                  </div>
                )}
              </div>
            </div>
          )}

          {employeeFilter && (
            <button onClick={() => setEmpFilter('')} style={{
              background: 'none', border: '1px solid #e2e8f0', borderRadius: 7,
              padding: '5px 10px', cursor: 'pointer', fontSize: 11, color: '#64748b',
            }}>✕</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: '#f1f5f9',
        borderRadius: 10, padding: 3, width: 'fit-content' }}>
        {[
          { id: 'pending', label: 'Pending Approval', badge: applyEmpFilter(timesheets.filter(t => t.status === 'SUBMITTED')).length },
          { id: 'all',     label: 'All Timesheets',   badge: 0 },
          { id: 'modules', label: 'Modules',          badge: 0 },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
            fontWeight: tab === t.id ? 700 : 500, fontSize: 13,
            background: tab === t.id ? '#fff' : 'transparent',
            color: tab === t.id ? '#0f172a' : '#64748b',
            boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            position: 'relative', transition: 'all 0.15s',
          }}>
            {t.label}
            {t.badge > 0 && (
              <span style={{
                marginLeft: 6, background: '#dc2626', color: '#fff',
                borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading
        ? <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading…</div>
        : tab === 'pending' ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
            overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
            {renderTable(pagedPending, true)}
            <Pagination page={pendingPage} total={pending.length} pageSize={PAGE_SIZE} onChange={setPendingPage} />
          </div>

        ) : tab === 'all' ? (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
            overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
            {/* Filter bar */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginRight: 4 }}>FILTER:</span>
              {['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DRAFT'].map(s => (
                <button key={s} onClick={() => setStatus(s)} style={{
                  padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontWeight: statusFilter === s ? 700 : 500, fontSize: 12,
                  background: statusFilter === s
                    ? (s === 'APPROVED' ? '#059669' : s === 'REJECTED' ? '#dc2626' : s === 'SUBMITTED' ? '#d97706' : '#334155')
                    : '#f1f5f9',
                  color: statusFilter === s ? '#fff' : '#374151',
                  transition: 'all 0.15s',
                }}>{s === 'ALL' ? 'All' : STATUS[s]?.label || s}</button>
              ))}
            </div>
            {renderTable(pagedFiltered, false)}
            <Pagination page={allPage} total={filtered.length} pageSize={PAGE_SIZE} onChange={setAllPage} />
          </div>

        ) : (
          /* Modules tab */
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
            padding: 24, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
              Module Management
            </h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={newModule}
                onChange={e => setNewModule(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddModule()}
                placeholder="Add new module name…"
                style={{
                  flex: 1, padding: '10px 14px', border: '1px solid #d1d5db',
                  borderRadius: 9, fontSize: 14, outline: 'none',
                }}
              />
              <button onClick={handleAddModule} style={{
                background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 9,
                padding: '10px 20px', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}>+ Add</button>
            </div>
            {moduleError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 12 }}>{moduleError}</div>}
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
              {modules.length === 0
                ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 24, fontSize: 14, gridColumn: '1/-1' }}>No modules yet.</p>
                : modules.map(m => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 16px', borderRadius: 10, background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}>
                      <span style={{ fontWeight: 600, color: '#374151', fontSize: 14 }}>{m.moduleName}</span>
                      <button onClick={() => handleDeleteModule(m.id)} style={{
                        background: 'none', border: '1px solid #fecaca', borderRadius: 7,
                        padding: '4px 12px', cursor: 'pointer', fontSize: 12, color: '#dc2626', fontWeight: 600,
                      }}>Delete</button>
                    </div>
                  ))
              }
            </div>
          </div>
        )
      }

      {/* Detail modal */}
      <DetailModal
        ts={detailTs}
        onClose={() => setDetailTs(null)}
        onApprove={async (id) => { await handleApprove(id); setDetailTs(null) }}
        onReject={async (id, reason) => { await handleReject(id, reason); setDetailTs(null) }}
        actionLoading={actionLoading}
      />
    </div>
  )
}
