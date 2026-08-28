import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';
import { Briefcase, LogOut, User as UserIcon, Menu, X } from 'lucide-react';
import './Navbar.css';

export const Navbar = () => {
    const { user, logout, isAuthenticated, isEmployer } = useContext(AuthContext);
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="navbar glass-panel">
            <div className="navbar-container">
                <Link to="/" className="navbar-logo">
                    <Briefcase size={28} color="var(--accent-color)" />
                    <span>NextGen Jobs</span>
                </Link>

                <button className="navbar-toggle" onClick={() => setMenuOpen(!menuOpen)}>
                    {menuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>

                <div className={`navbar-menu ${menuOpen ? 'active' : ''}`}>
                    <Link to="/jobs" className="navbar-item" onClick={() => setMenuOpen(false)}>Browse Jobs</Link>

                    {isAuthenticated ? (
                        <>
                            {isEmployer && (
                                <>
                                    <Link to="/post-job" className="navbar-item" onClick={() => setMenuOpen(false)}>Post Job</Link>
                                    <Link to="/employer-dashboard" className="navbar-item" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                                    <Link to="/manage-applications" className="navbar-item" onClick={() => setMenuOpen(false)}>Applicants</Link>
                                </>
                            )}

                            {!isEmployer && (
                                <>
                                    <Link to="/my-applications" className="navbar-item" onClick={() => setMenuOpen(false)}>My Applications</Link>
                                    <Link to="/saved-jobs" className="navbar-item" onClick={() => setMenuOpen(false)}>Saved</Link>
                                    <Link to="/ai-tools" className="navbar-item" onClick={() => setMenuOpen(false)}>AI Tools</Link>
                                </>
                            )}

                            <div className="navbar-user">
                                <NotificationBell />
                                <Link to="/profile" className="user-name" onClick={() => setMenuOpen(false)}>
                                    <UserIcon size={16} /> {user?.fullName || 'User'}
                                </Link>
                                <button onClick={handleLogout} className="btn btn-secondary btn-sm logout-btn">
                                    <LogOut size={16} /> Logout
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="navbar-auth">
                            <Link to="/login" className="navbar-item" onClick={() => setMenuOpen(false)}>Log In</Link>
                            <Link to="/register" className="btn btn-primary" onClick={() => setMenuOpen(false)}>Sign Up</Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};
