import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { AdminUserSummary } from '../types';
import { LockIcon, TrashIcon, UserPlusIcon } from '../components/icons';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InviteUserModal } from '../components/InviteUserModal';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth/AuthContext';

function RoleBadge({ role }: { role: AdminUserSummary['role'] }) {
  return (
    <span
      className={`badge ${role === 'ADMIN' ? 'badge-admin' : 'badge-user'}`}
    >
      {role}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`badge ${active ? 'badge-active' : 'badge-disabled'}`}>
      <span className="badge-dot" />
      {active ? 'Active' : 'Disabled'}
    </span>
  );
}

export function AdminPage() {
  const { user: currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUserSummary | null>(
    null,
  );
  const [pendingDisable, setPendingDisable] = useState<AdminUserSummary | null>(
    null,
  );
  const [invitingUser, setInvitingUser] = useState(false);

  async function loadUsers() {
    setError(null);
    try {
      const data = await api.get<AdminUserSummary[]>('/users');
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    }
  }

  useEffect(() => {
    loadUsers().finally(() => setLoading(false));
  }, []);

  function handleToggleActive(user: AdminUserSummary) {
    if (user.active) {
      setPendingDisable(user);
    } else {
      handleSetActive(user.id, true);
    }
  }

  async function handleSetActive(id: string, active: boolean) {
    try {
      const updated = await api.patch<AdminUserSummary>(`/users/${id}`, {
        active,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, active: updated.active } : u)),
      );
      showSuccess(`${updated.email} ${active ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update user');
    }
  }

  async function handleDelete(id: string) {
    const target = users.find((u) => u.id === id);
    try {
      await api.delete(`/users/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showSuccess(`${target?.email ?? 'User'} deleted.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  }

  return (
    <div className="page-stack">
      <div className="section-header">
        <div>
          <h2>Users</h2>
          <p className="text-muted admin-subtitle">
            Manage accounts across the team.
          </p>
        </div>
        <div className="section-header-actions">
          <span className="tag">
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </span>
          <button
            type="button"
            className="invite-trigger"
            onClick={() => setInvitingUser(true)}
          >
            <UserPlusIcon size={14} />
            Invite
          </button>
        </div>
      </div>

      {loading && <p className="text-muted">Loading…</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <>
          <button
            type="button"
            className="mobile-invite-trigger"
            onClick={() => setInvitingUser(true)}
          >
            <UserPlusIcon size={14} />
            Invite
          </button>

          <div className="card admin-table-card">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Alarms</th>
                  <th>Status</th>
                  <th className="admin-table-actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className={u.active ? '' : 'is-disabled'}>
                      <td className="admin-table-email">{u.email}</td>
                      <td>
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="mono">{u.alarmCount}</td>
                      <td>
                        <StatusBadge active={u.active} />
                      </td>
                      <td className="admin-table-actions">
                        {u.isDefaultAdmin ? (
                          <span className="text-muted admin-self-note admin-protected-note">
                            <LockIcon size={12} />
                            Default admin{isSelf ? ' · you' : ''}
                          </span>
                        ) : isSelf ? (
                          <span className="text-muted admin-self-note">
                            You
                          </span>
                        ) : (
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                            >
                              {u.active ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              className="danger"
                              onClick={() => setPendingDelete(u)}
                            >
                              <TrashIcon size={13} />
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="admin-card-list">
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id;
              return (
                <li
                  key={u.id}
                  className={`card admin-user-card ${u.active ? '' : 'is-disabled'}`}
                >
                  <div className="admin-user-card-row">
                    <strong>{u.email}</strong>
                    <RoleBadge role={u.role} />
                  </div>
                  <div className="admin-user-card-row">
                    <span className="text-muted">
                      <span className="mono">{u.alarmCount}</span>{' '}
                      {u.alarmCount === 1 ? 'alarm' : 'alarms'}
                    </span>
                    <StatusBadge active={u.active} />
                  </div>
                  {u.isDefaultAdmin ? (
                    <span className="text-muted admin-self-note admin-protected-note">
                      <LockIcon size={12} />
                      Default admin{isSelf ? ' · you' : ''}
                    </span>
                  ) : isSelf ? (
                    <span className="text-muted admin-self-note">
                      This is you
                    </span>
                  ) : (
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        style={{ flex: 1 }}
                      >
                        {u.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="danger"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => setPendingDelete(u)}
                      >
                        <TrashIcon size={13} />
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {pendingDisable && (
        <ConfirmDialog
          title="Disable user"
          message={`Disable ${pendingDisable.email}? They'll be signed out immediately and won't be able to log back in until re-enabled.`}
          confirmLabel="Disable"
          danger
          onCancel={() => setPendingDisable(null)}
          onConfirm={() => {
            handleSetActive(pendingDisable.id, false);
            setPendingDisable(null);
          }}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete user"
          message={`Delete ${pendingDelete.email}? This removes their account and all ${pendingDelete.alarmCount} alarm(s). This can't be undone.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            handleDelete(pendingDelete.id);
            setPendingDelete(null);
          }}
        />
      )}
      {invitingUser && (
        <InviteUserModal
          onClose={() => setInvitingUser(false)}
          onInvited={(email) => {
            setInvitingUser(false);
            showSuccess(`Invite sent to ${email}.`);
          }}
        />
      )}
    </div>
  );
}
