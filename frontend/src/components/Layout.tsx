import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  LogoMark,
  LogOutIcon,
  MenuIcon,
  BellIcon,
  GearIcon,
  ShieldIcon,
} from './icons';
import { ConfirmDialog } from './ConfirmDialog';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  function handleLogout() {
    setConfirmingLogout(false);
    setNavOpen(false);
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-logo">
          <span className="app-logo-mark">
            <LogoMark />
          </span>
          <span className="app-title">Stock Alerts</span>
        </div>
        <button
          type="button"
          className="icon-button nav-toggle"
          aria-label="Toggle navigation"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((prev) => !prev)}
        >
          <span className="nav-toggle-icon">
            <MenuIcon />
          </span>
        </button>
        <nav className={navOpen ? 'is-open' : ''}>
          <NavLink to="/alarms" onClick={() => setNavOpen(false)}>
            <BellIcon />
            Alarms
          </NavLink>
          <NavLink to="/settings" onClick={() => setNavOpen(false)}>
            <GearIcon />
            Settings
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink to="/admin" onClick={() => setNavOpen(false)}>
              <ShieldIcon />
              Admin
            </NavLink>
          )}
        </nav>
        <div className="app-header-user">
          <span className="text-muted">{user?.email}</span>
          <div className="app-header-divider" />
          <button
            type="button"
            className="icon-button"
            onClick={() => setConfirmingLogout(true)}
          >
            <LogOutIcon />
            Log out
          </button>
        </div>
      </header>
      <main className="app-main">
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
      {confirmingLogout && (
        <ConfirmDialog
          title="Log out"
          message="Are you sure you want to log out?"
          confirmLabel="Log out"
          danger
          onCancel={() => setConfirmingLogout(false)}
          onConfirm={handleLogout}
        />
      )}
    </div>
  );
}
