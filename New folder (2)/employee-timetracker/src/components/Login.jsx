import { useState } from 'react'
import wilotusLogo from '../assets/wilotus.png'

export default function Login({ onLogin }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setTimeout(() => {
      const ok = onLogin(identifier.trim(), password)
      if (!ok) setError('Invalid username or password. Please try again.')
      setLoading(false)
    }, 500)
  }

  return (
    <div className="login-root">
      <div className="login-card">

        {/* Left — branding */}
        <div className="login-brand-col">
          <img src={wilotusLogo} alt="WILOTUS" className="wilotus-logo-img" />
        </div>

        {/* Divider */}
        <div className="login-divider"/>

        {/* Right — form */}
        <div className="login-form-col">
          <form onSubmit={handleSubmit} autoComplete="on">
            <div className="lf-group">
              <label htmlFor="identifier">
                Username <span className="lf-required">*</span>
              </label>
              <div className="lf-input-wrap">
                <svg className="lf-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Enter your username or email"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div className="lf-group">
              <label htmlFor="password">
                Password <span className="lf-required">*</span>
              </label>
              <div className="lf-input-wrap">
                <svg className="lf-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="4"/>
                  <path d="M5 3l14 18"/>
                </svg>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  required
                />
                <button type="button" className="lf-eye-btn" onClick={() => setShowPass(s => !s)} tabIndex={-1}>
                  {showPass ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <p className="lf-error">{error}</p>}

            <button type="submit" className="lf-btn-login" disabled={loading}>
              {loading ? (
                <span className="lf-spinner"/>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  LOGIN
                </>
              )}
            </button>

            <div className="lf-forgot">
              <a href="#">Forgot Password?</a>
            </div>
          </form>

        </div>

      </div>
    </div>
  )
}
