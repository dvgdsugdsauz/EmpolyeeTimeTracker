import { useState, useRef } from 'react'
import * as api from '../../services/api'

export default function TimesheetImport() {
  const [file, setFile]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')
  const inputRef = useRef()

  async function handleImport() {
    if (!file) { setError('Please select a CSV file'); return }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.importTimesheets(formData)
      setResult(res)
    } catch (e) {
      setError(e.message || 'Import failed')
    }
    setLoading(false)
  }

  return (
    <div className="page-content">
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#1e293b' }}>
        Timesheet CSV Import
      </h2>

      <div className="card" style={{ maxWidth: 540, padding: 28 }}>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#64748b' }}>
          Upload the <strong>DailyTimeSheet CSV</strong> exported from SharePoint.
          Only records from <strong>Jan 2026 onwards</strong> will be imported.
          Employees not in the system will be skipped automatically.
        </p>

        {/* File picker */}
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: '2px dashed #c4b5fd', borderRadius: 10, padding: '28px 20px',
            textAlign: 'center', cursor: 'pointer', background: '#faf5ff', marginBottom: 18,
          }}
        >
          <input
            ref={inputRef} type="file" accept=".csv"
            style={{ display: 'none' }}
            onChange={e => { setFile(e.target.files[0] || null); setResult(null); setError('') }}
          />
          {file
            ? <div>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📄</div>
                <div style={{ fontWeight: 600, color: '#7c3aed', fontSize: 14 }}>{file.name}</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
                  {(file.size / 1024).toFixed(1)} KB — click to change
                </div>
              </div>
            : <div>
                <div style={{ fontSize: 28, marginBottom: 6 }}>☁️</div>
                <div style={{ color: '#7c3aed', fontWeight: 600, fontSize: 14 }}>Click to select CSV file</div>
                <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>DailyTimeSheet.csv</div>
              </div>
          }
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
            padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleImport}
          disabled={!file || loading}
          style={{
            width: '100%', padding: '11px', borderRadius: 8, border: 'none',
            background: file && !loading ? '#7c3aed' : '#c4b5fd',
            color: '#fff', cursor: file && !loading ? 'pointer' : 'not-allowed',
            fontSize: 14, fontWeight: 700,
          }}
        >
          {loading ? 'Importing…' : 'Import Timesheets'}
        </button>

        {/* Result */}
        {result && (
          <div style={{ marginTop: 22, padding: 18, background: '#f0fdf4',
            border: '1px solid #bbf7d0', borderRadius: 10 }}>
            <div style={{ fontWeight: 700, color: '#059669', fontSize: 15, marginBottom: 12 }}>
              ✓ Import Complete
            </div>
            {[
              { label: 'Records Imported',      value: result.imported,         color: '#059669' },
              { label: 'Modules Created',        value: result.modulesCreated,   color: '#7c3aed' },
              { label: 'Skipped (not in system)',value: result.skippedNotInDb,   color: '#d97706' },
              { label: 'Skipped (no date)',      value: result.skippedNoDate,    color: '#d97706' },
              { label: 'Skipped (before 2026)',  value: result.skippedOldDate,   color: '#94a3b8' },
              { label: 'Skipped (no employee)',  value: result.skippedNoEmployee,color: '#94a3b8' },
              { label: 'Errors',                 value: result.errors,           color: '#dc2626' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between',
                marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: '#374151' }}>{r.label}</span>
                <span style={{ fontWeight: 700, color: r.value > 0 ? r.color : '#94a3b8' }}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
