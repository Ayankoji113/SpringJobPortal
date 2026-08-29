import React, { useContext, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { AuthContext } from '../../context/auth-context';
import * as notificationService from '../../services/notificationService';
import { Badge, Button, IconButton } from '../ui';
import { useToast } from '../ui/toast-context';
import './shell.css';

function NavItem({ to, children, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) => (isActive ? 'jp-nav__link jp-nav__link--active' : 'jp-nav__link')}
    >
      {children}
    </NavLink>
  );
}

function UnreadBell() {
  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 60_000,
    retry: false,
  });
  const count = typeof data === 'number' ? data : data?.count ?? 0;

  return (
    <Link to="/notifications" className="jp-bell" aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}>
      <Bell size={17} aria-hidden="true" />
      {count > 0 && <span className="jp-bell__dot" aria-hidden="true" />}
    </Link>
  );
}

export function AppShell({ children }) {
  const { user, isAuthenticated, isEmployer, isJobSeeker, logout } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  /* A dead session is announced, not enacted behind the user's back — and it
     remembers where they were so signing back in returns them there. */
  useEffect(() => {
    const onExpired = () => {
      logout();
      toast('Your session expired. Please sign in again.', 'error');
      navigate('/login', { replace: true, state: { from: location.pathname } });
    };
    window.addEventListener('jp:session-expired', onExpired);
    return () => window.removeEventListener('jp:session-expired', onExpired);
  }, [logout, navigate, toast, location.pathname]);

  const close = () => setMenuOpen(false);

  return (
    <div className="jp-shell">
      <a className="jp-skip-link" href="#main">Skip to content</a>

      <header className="jp-header">
        <div className="jp-container jp-header__inner">
          <Link to="/" className="jp-wordmark">JobPortal</Link>

          <nav className={menuOpen ? 'jp-nav jp-nav--open' : 'jp-nav'} aria-label="Main">
            <NavItem to="/jobs" onNavigate={close}>Jobs</NavItem>
            {isJobSeeker && <NavItem to="/my-applications" onNavigate={close}>Applications</NavItem>}
            {isJobSeeker && <NavItem to="/saved-jobs" onNavigate={close}>Saved</NavItem>}
            {isEmployer && <NavItem to="/employer-dashboard" onNavigate={close}>Dashboard</NavItem>}
            {isEmployer && <NavItem to="/post-job" onNavigate={close}>Post a job</NavItem>}
            {isAuthenticated && <NavItem to="/profile" onNavigate={close}>Profile</NavItem>}
          </nav>

          <div className="jp-header__actions">
            {isAuthenticated ? (
              <>
                <UnreadBell />
                <span className="jp-header__who jp-sm">
                  {user?.fullName}
                  <Badge tone="neutral">{isEmployer ? 'Employer' : 'Job seeker'}</Badge>
                </span>
                <IconButton label="Sign out" onClick={() => { logout(); navigate('/'); }}>
                  <LogOut size={16} aria-hidden="true" />
                </IconButton>
              </>
            ) : (
              <>
                <Button onClick={() => navigate('/login')} size="sm">Sign in</Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/register')}>Create account</Button>
              </>
            )}
            <IconButton
              label={menuOpen ? 'Close menu' : 'Open menu'}
              className="jp-header__toggle"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </IconButton>
          </div>
        </div>
      </header>

      <main id="main" className="jp-main">{children}</main>

      <footer className="jp-footer">
        <div className="jp-container jp-footer__inner jp-sm jp-muted">
          <span>JobPortal</span>
          <span>Built with Spring Boot and React</span>
        </div>
      </footer>
    </div>
  );
}
