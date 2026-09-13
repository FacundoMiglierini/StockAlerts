import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import { BackIcon, CheckCircleIcon, UserPlusIcon } from '../components/icons'
import { useToast } from '../components/Toast'
import { MIN_PASSWORD_LENGTH } from '../validation'

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { showSuccess, showError } = useToast()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/auth/accept-invite', { token, password })
      setDone(true)
      showSuccess('Account activated.')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'This invite link is invalid or has expired'
      setError(message)
      showError(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="centered-page">
        <div className="card form-card login-card">
          <p className="error-text">This invite link is missing its token. Ask an admin to send another.</p>
          <Link to="/login" className="back-to-login-link">
            <BackIcon size={14} />
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="centered-page">
        <div className="card form-card login-card">
          <div className="reset-confirm">
            <span className="reset-confirm-icon">
              <CheckCircleIcon size={24} />
            </span>
            <h1 className="login-title">Account activated</h1>
            <p className="text-muted">You can sign in with your new password now.</p>
          </div>
          <button type="button" onClick={() => navigate('/login')}>
            Go to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="centered-page">
      <div className="card form-card login-card">
        <div className="login-header">
          <span className="app-logo-mark login-brand-mark">
            <UserPlusIcon size={20} />
          </span>
          <div>
            <h1 className="login-title">You've been invited</h1>
            <p className="text-muted login-tagline">Set a password to activate your account.</p>
          </div>
        </div>

        <form className="alarm-form" onSubmit={handleSubmit} noValidate>
          <label>
            New password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </label>
          <p className="password-hint">At least {MIN_PASSWORD_LENGTH} characters.</p>
          <label>
            Confirm password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Activating…' : 'Activate account'}
          </button>
        </form>
      </div>
    </div>
  )
}
