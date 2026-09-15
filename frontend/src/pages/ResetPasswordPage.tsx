import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { BackIcon, CheckCircleIcon, LockIcon } from '../components/icons';
import { useToast } from '../components/Toast';
import { MIN_PASSWORD_LENGTH } from '../validation';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const passwordTooShort =
    newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const passwordsMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const isValid =
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    newPassword === confirmPassword;

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setDone(true);
      showSuccess('Password updated.');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'This reset link is invalid or has expired';
      setError(message);
      showError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="centered-page">
        <div className="card form-card login-card">
          <p className="error-text">
            This reset link is missing its token. Request a new one.
          </p>
          <Link to="/forgot-password" className="back-to-login-link">
            <BackIcon size={14} />
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="centered-page">
        <div className="card form-card login-card">
          <div className="reset-confirm">
            <span className="reset-confirm-icon">
              <CheckCircleIcon size={24} />
            </span>
            <h1 className="login-title">Password updated</h1>
            <p className="text-muted">
              You can sign in with your new password now.
            </p>
          </div>
          <button type="button" onClick={() => navigate('/login')}>
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="centered-page">
      <div className="card form-card login-card">
        <div className="login-header">
          <span className="app-logo-mark login-brand-mark">
            <LockIcon size={20} />
          </span>
          <div>
            <h1 className="login-title">Choose a new password</h1>
          </div>
        </div>

        <form className="alarm-form" onSubmit={handleSubmit} noValidate>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoFocus
            />
          </label>
          <p className={passwordTooShort ? 'error-text' : 'password-hint'}>
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
          <label>
            Confirm password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
          {passwordsMismatch && (
            <p className="error-text">Passwords do not match</p>
          )}
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={submitting || !isValid}>
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
