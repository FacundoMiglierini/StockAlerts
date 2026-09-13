import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { LogoMark } from '../components/icons'
import { useToast } from '../components/Toast'
import { isValidEmail } from '../validation'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { showSuccess, showError } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    setError(null)

    if (!isValidEmail(email)) {
      setError('Enter a valid email address')
      return
    }
    if (!password) {
      setError('Password is required')
      return
    }

    setSubmitting(true)
    try {
      await login(email, password)
      showSuccess('Signed in.')
      navigate('/alarms')
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed'
      setError(message)
      showError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="centered-page">
      <div className="card form-card login-card">
        <div className="login-header">
          <span className="app-logo-mark login-brand-mark">
            <LogoMark size={20} />
          </span>
          <div>
            <h1 className="login-title">Stock Alerts</h1>
            <p className="text-muted login-tagline">Sign in to manage your price alerts.</p>
          </div>
        </div>

        <form className="alarm-form" onSubmit={handleSubmit} noValidate>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />
          </label>
          <div>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <div className="forgot-password-link">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
          </div>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-muted login-footnote">Accounts are created by an admin — there's no self-signup.</p>
      </div>
    </div>
  )
}
