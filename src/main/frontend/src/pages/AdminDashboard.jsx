import React, { useState, useEffect } from 'react';
import * as adminService from '../services/adminService';
import { Users, Briefcase, FileText, Shield, Search, Ban, CheckCircle, Trash2, XCircle } from 'lucide-react';

export const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('stats');
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [pendingJobs, setPendingJobs] = useState([]);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const data = await adminService.getAdminStats();
            setStats(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = searchKeyword ? await adminService.searchUsers(searchKeyword) : await adminService.getAllUsers();
            setUsers(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const fetchPendingJobs = async () => {
        setLoading(true);
        try {
            const data = await adminService.getPendingJobs();
            setPendingJobs(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
        if (activeTab === 'jobs') fetchPendingJobs();
    }, [activeTab]);

    const handleBan = async (id) => {
        await adminService.banUser(id);
        fetchUsers();
    };

    const handleUnban = async (id) => {
        await adminService.unbanUser(id);
        fetchUsers();
    };

    const handleDeleteUser = async (id) => {
        if (window.confirm('Delete this user permanently?')) {
            await adminService.deleteUser(id);
            fetchUsers();
        }
    };

    const handleApproveJob = async (id) => {
        await adminService.approveJob(id);
        fetchPendingJobs();
    };

    const handleRejectJob = async (id) => {
        await adminService.rejectJob(id);
        fetchPendingJobs();
    };

    const tabs = [
        { id: 'stats', label: 'Dashboard', icon: <Shield size={16} /> },
        { id: 'users', label: 'Users', icon: <Users size={16} /> },
        { id: 'jobs', label: 'Job Approvals', icon: <Briefcase size={16} /> },
    ];

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem',
                background: 'linear-gradient(135deg, #f8fafc, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                <Shield size={28} style={{ display: 'inline', verticalAlign: 'middle' }} /> Admin Panel
            </h1>
            <p className="text-secondary mb-4">Manage users, jobs, and platform analytics</p>

            <div className="flex gap-2 mb-4">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {loading && <div className="flex justify-center"><div className="spinner"></div></div>}

            {/* Stats */}
            {activeTab === 'stats' && stats && !loading && (
                <div className="grid grid-cols-3" style={{ gap: '1rem' }}>
                    {[
                        { label: 'Total Users', value: stats.totalUsers, color: 'var(--accent-color)', icon: <Users /> },
                        { label: 'Employers', value: stats.totalEmployers, color: '#f59e0b', icon: <Briefcase /> },
                        { label: 'Job Seekers', value: stats.totalJobSeekers, color: '#10b981', icon: <Users /> },
                        { label: 'Total Jobs', value: stats.totalJobs, color: '#6366f1', icon: <Briefcase /> },
                        { label: 'Applications', value: stats.totalApplications, color: '#ec4899', icon: <FileText /> },
                        { label: 'Pending Approvals', value: stats.pendingJobApprovals, color: '#f59e0b', icon: <Shield /> },
                    ].map((card, i) => (
                        <div key={i} className="glass-card text-center">
                            <div style={{ color: card.color, marginBottom: '0.5rem' }}>{card.icon}</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: card.color }}>{card.value}</div>
                            <div className="text-secondary" style={{ fontSize: '0.85rem' }}>{card.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Users */}
            {activeTab === 'users' && !loading && (
                <div>
                    <div className="flex gap-2 mb-4">
                        <input className="form-input" placeholder="Search users..." value={searchKeyword}
                            onChange={e => setSearchKeyword(e.target.value)} style={{ flex: 1 }} />
                        <button className="btn btn-primary" onClick={fetchUsers}><Search size={16} /> Search</button>
                    </div>
                    <div className="glass-panel" style={{ overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Name</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Email</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Role</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>{u.fullName}</td>
                                        <td style={{ padding: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                                        <td style={{ padding: '0.75rem' }}><span className="badge badge-primary">{u.role}</span></td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span className={`badge ${u.isBanned ? 'badge-danger' : 'badge-success'}`}>
                                                {u.isBanned ? 'Banned' : 'Active'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                            <div className="flex gap-2 justify-end">
                                                {u.isBanned ? (
                                                    <button className="btn btn-success btn-sm" onClick={() => handleUnban(u.id)}><CheckCircle size={14} /> Unban</button>
                                                ) : (
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleBan(u.id)}><Ban size={14} /> Ban</button>
                                                )}
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id)}><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pending Jobs */}
            {activeTab === 'jobs' && !loading && (
                <div>
                    {pendingJobs.length === 0 ? (
                        <div className="glass-panel text-center" style={{ padding: '3rem' }}>
                            <CheckCircle size={48} color="var(--success-color)" style={{ marginBottom: '1rem' }} />
                            <p className="text-secondary">No pending job approvals</p>
                        </div>
                    ) : (
                        <div className="grid" style={{ gap: '1rem' }}>
                            {pendingJobs.map(job => (
                                <div key={job.postId} className="glass-card">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 style={{ fontWeight: 700 }}>{job.postProfile}</h3>
                                            <p className="text-secondary" style={{ fontSize: '0.85rem' }}>Posted by: {job.postedBy?.fullName}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button className="btn btn-success btn-sm" onClick={() => handleApproveJob(job.postId)}><CheckCircle size={14} /> Approve</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleRejectJob(job.postId)}><XCircle size={14} /> Reject</button>
                                        </div>
                                    </div>
                                    <p className="text-secondary" style={{ fontSize: '0.88rem', marginTop: '0.5rem' }}>{job.postDesc?.substring(0, 200)}...</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
