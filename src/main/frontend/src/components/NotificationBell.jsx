import React, { useState, useEffect, useContext } from 'react';
import { Bell } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import * as notificationService from '../services/notificationService';

export const NotificationBell = () => {
    const { isAuthenticated } = useContext(AuthContext);
    const [count, setCount] = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) return;
        const fetchCount = async () => {
            try {
                const c = await notificationService.getUnreadCount();
                setCount(c);
            } catch (e) { /* ignore */ }
        };
        fetchCount();
        const interval = setInterval(fetchCount, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [isAuthenticated]);

    const handleOpen = async () => {
        setOpen(!open);
        if (!open) {
            try {
                const data = await notificationService.getUnreadNotifications();
                setNotifications(data);
            } catch (e) { /* ignore */ }
        }
    };

    const handleMarkAllRead = async () => {
        await notificationService.markAllAsRead();
        setCount(0);
        setNotifications([]);
        setOpen(false);
    };

    if (!isAuthenticated) return null;

    return (
        <div className="notification-bell" style={{ position: 'relative' }}>
            <button onClick={handleOpen} className="btn btn-secondary btn-sm" style={{ position: 'relative', padding: '0.4rem' }}>
                <Bell size={18} />
                {count > 0 && (
                    <span style={{
                        position: 'absolute', top: '-4px', right: '-4px',
                        background: 'var(--danger-color)', color: '#fff',
                        borderRadius: '50%', width: '18px', height: '18px',
                        fontSize: '0.7rem', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: 700
                    }}>{count > 9 ? '9+' : count}</span>
                )}
            </button>

            {open && (
                <div className="glass-panel" style={{
                    position: 'absolute', top: '100%', right: 0,
                    width: '320px', maxHeight: '400px', overflowY: 'auto',
                    zIndex: 1000, padding: '0.5rem', marginTop: '0.5rem'
                }}>
                    <div className="flex justify-between items-center" style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <strong style={{ fontSize: '0.9rem' }}>Notifications</strong>
                        {count > 0 && (
                            <button onClick={handleMarkAllRead} className="btn btn-sm" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', color: 'var(--accent-color)', background: 'none' }}>
                                Mark all read
                            </button>
                        )}
                    </div>
                    {notifications.length === 0 ? (
                        <p className="text-secondary text-center" style={{ padding: '1rem', fontSize: '0.85rem' }}>No new notifications</p>
                    ) : (
                        notifications.slice(0, 10).map(n => (
                            <div key={n.id} style={{
                                padding: '0.6rem', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                cursor: 'pointer'
                            }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{n.title}</div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{n.message}</div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
