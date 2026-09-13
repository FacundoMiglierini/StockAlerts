import { useState } from 'react'
import type { SubmitEvent } from 'react'
import { api } from '../api/client'
import type { Role } from '../types'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { isValidEmail } from '../validation'

interface Props {
  onClose: () => void
  onInvited: (email: string) => void
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'USER', label: 'User' },
  { value: 'ADMIN', label: 'Admin' },
]

export function InviteUserModal({ onClose, onInvited }: Props) {
  const { showError } = useToast()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('USER')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault()
    setError(null)

    if (!isValidEmail(email)) {
      setError('Enter a valid email address')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/users/invite', { email: email.trim(), role })
      onInvited(email.trim())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send invite'
      setError(message)
      showError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Invite someone" onClose={onClose}>
      <form className="alarm-form" onSubmit={handleSubmit} noValidate>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            required
            autoFocus
          />
        </label>

        <label>
          Role
          <div className="role-picker">
            {ROLE_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={role === value ? 'role-option is-active' : 'role-option'}
                onClick={() => setRole(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </label>

        <p className="text-muted invite-hint">
          They'll get an email with a link to set their own password and activate the account. The
          link expires in 1 hour — you'll be able to send another if it lapses.
        </p>

        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send invite'}
        </button>
      </form>
    </Modal>
  )
}
