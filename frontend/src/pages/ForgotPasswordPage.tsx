import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { BackIcon, CheckCircleIcon, MailIcon } from '../components/icons';
import { isValidEmail } from '../validation';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError('Enter a valid email address');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="centered-page">
        <div className="card form-card login-card">
          <div className="reset-confirm">
            <span className="reset-confirm-icon">
              <CheckCircleIcon size={24} />
            </span>
            <h1 className="login-title">Check your inbox</h1>
            <p className="text-muted">
              If an account exists for <strong>{email}</strong>, we've sent a
              link to reset the password. The link expires in 1 hour.
            </p>
          </div>
          <Link to="/login" className="back-to-login-link">
            <BackIcon size={14} />
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="centered-page">
      <div className="card form-card login-card">
        <div className="login-header">
          <span className="app-logo-mark login-brand-mark">
            <MailIcon size={20} />
          </span>
          <div>
            <h1 className="login-title">Reset your password</h1>
            <p className="text-muted login-tagline">
              We'll email you a link to set a new one.
            </p>
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
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>

        <Link to="/login" className="back-to-login-link">
          <BackIcon size={14} />
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
