import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { useTheme } from '../components/ThemeContext';
import type { ThemePreference } from '../components/ThemeContext';
import { SunIcon, MoonIcon, MonitorIcon } from '../components/icons';
import { isValidTelegramChatId } from '../validation';

const TELEGRAM = 'TELEGRAM';

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: typeof SunIcon;
}[] = [
  { value: 'system', label: 'System', icon: MonitorIcon },
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
];

export function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { showSuccess, showError } = useToast();
  const linkedTelegram = user?.channels.find((c) => c.type === TELEGRAM);
  const [chatId, setChatId] = useState(linkedTelegram?.externalId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = chatId.trim();
    if (trimmed && !isValidTelegramChatId(trimmed)) {
      setError(
        'That doesn\'t look like a Telegram chat id — it should be all digits (optionally starting with "-" for a group).',
      );
      return;
    }

    setSubmitting(true);
    try {
      if (trimmed) {
        await api.put(`/users/me/channels/${TELEGRAM}`, {
          externalId: trimmed,
        });
        showSuccess('Telegram linked.');
      } else {
        await api.delete(`/users/me/channels/${TELEGRAM}`);
        showSuccess('Telegram unlinked.');
      }
      await refreshUser();
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'Failed to update settings',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="card form-card settings-card">
        <h2>Appearance</h2>
        <p className="text-muted">
          Choose how Stock Alerts looks on this device.
        </p>
        <div className="theme-picker">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={
                theme === value ? 'theme-option is-active' : 'theme-option'
              }
              onClick={() => {
                setTheme(value);
                showSuccess(`Theme set to ${label.toLowerCase()}.`);
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card form-card settings-card">
        <h2>Notifications</h2>
        <p className="text-muted">
          Email always goes to <strong>{user?.email}</strong>. Telegram is
          optional and free — link it below to also get alerts there.
        </p>
        <ol className="instructions">
          <li>
            Find the bot your admin set up and message it once (e.g. send it
            "/start").
          </li>
          <li>
            Open{' '}
            <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> in
            a browser (ask your admin for the token) and find your chat id under{' '}
            <code>result[].message.chat.id</code>.
          </li>
          <li>
            Paste that id below and save. Clear it and save again to unlink.
          </li>
        </ol>
        <form className="alarm-form" onSubmit={handleSubmit} noValidate>
          <label>
            Telegram chat id
            <input
              className="ticker"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="e.g. 123456789"
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </form>
      </section>
    </div>
  );
}
