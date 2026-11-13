import React, { useContext, useEffect } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell, Bookmark, FileText, Inbox, LayoutDashboard, LogOut, Search, ShieldCheck, SquarePen, User,
} from 'lucide-react';
import { AuthContext } from '../../context/auth-context';
import * as notificationService from '../../services/notificationService';
import { Button, IconButton } from '../ui';
import { Proofs } from '../ui/kit';
import { useToast } from '../ui/toast-context';
import './shell.css';

/** One list drives both the desktop bar and the phone tab bar, so they cannot drift apart. */
function navFor({ isJobSeeker, isEmployer, isAdmin, isAuthenticated }) {
  return [
    { to: '/jobs', label: 'Jobs', icon: Search },
    isJobSeeker && { to: '/my-applications', label: 'Applications', icon: FileText },
    isJobSeeker && { to: '/saved-jobs', label: 'Saved', icon: Bookmark },
    isEmployer && { to: '/employer-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    isEmployer && { to: '/manage-applications', label: 'Candidates', icon: Inbox },
    isEmployer && { to: '/post-job', label: 'Post a job', icon: SquarePen },
    isAdmin && { to: '/admin', label: 'Review', icon: ShieldCheck },
    isAuthenticated && { to: '/profile', label: 'Profile', icon: User },
  ].filter(Boolean);
}

/** The mark is the product in miniature: a response clock, part spent. */
function Wordmark() {
  return (
    <Link to="/" className="jp-wordmark" aria-label="JobPortal, home">
      <span className="jp-wordmark__mark" aria-hidden="true"><i /><i /><i /><i /><i /></span>
      JobPortal
    </Link>
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
  const auth = useContext(AuthContext);
  const { user, isAuthenticated, logout } = auth;
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const items = navFor(auth);
  const roleLabel = auth.isAdmin ? 'Admin' : auth.isEmployer ? 'Employer' : 'Job seeker';

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

  return (
    <div className={isAuthenticated ? 'jp-shell jp-shell--tabbed' : 'jp-shell'}>
      <a className="jp-skip-link" href="#main">Skip to content</a>

      <header className="jp-header">
        <div className="jp-container jp-header__inner">
          <Wordmark />

          <nav className="jp-nav" aria-label="Main">
            {items.map(({ to, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) => (isActive ? 'jp-nav__link jp-nav__link--active' : 'jp-nav__link')}>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="jp-header__actions">
            {isAuthenticated ? (
              <>
                <UnreadBell />
                <span className="jp-header__who">
                  <span className="jp-header__name">{user?.fullName}</span>
                  <span className="jp-header__role">{roleLabel}</span>
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
          </div>
        </div>
      </header>

      <main id="main" className="jp-main">{children}</main>

      <footer className="jp-footer jp-on-band">
        <div className="jp-container jp-footer__inner">
          <div>
            <Wordmark />
            <p className="jp-sm jp-muted jp-footer__line">
              A job board that holds employers to an answer.
            </p>
          </div>
          <Proofs verified salaryShown responsiveness={{ responseRatePercent: null }} className="jp-footer__proofs" />
        </div>
      </footer>

      {/* Phones get the same destinations within thumb reach instead of a hidden menu. */}
      {isAuthenticated && (
        <nav className="jp-tabbar" aria-label="Main, mobile">
          {items.slice(0, 5).map(({ to, label, icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => (isActive ? 'jp-tabbar__tab jp-tabbar__tab--active' : 'jp-tabbar__tab')}>
              {React.createElement(icon, { size: 19, 'aria-hidden': true })}
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
