import React, { useState, useEffect } from 'react';
import * as dashboardService from '../services/dashboardService';
import { BarChart3, Briefcase, Users, Eye, TrendingUp } from 'lucide-react';

export const EmployerDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await dashboardService.getEmployerDashboard();
                setStats(data);
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        fetch();
    }, []);

    if (loading) return <div className="flex justify-center mt-4"><div className="spinner"></div></div>;

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={32} color="var(--accent-color)" />
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(135deg, #f8fafc, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Employer Dashboard
                    </h1>
                    <p className="text-secondary">Overview of your hiring activity</p>
                </div>
            </div>

            {stats && (
                <>
                    <div className="grid grid-cols-3" style={{ gap: '1rem', marginBottom: '2rem' }}>
                        <div className="glass-card text-center">
                            <Briefcase size={32} color="#6366f1" style={{ margin: '0 auto 0.5rem' }} />
                            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#6366f1' }}>{stats.totalJobs}</div>
                            <div className="text-secondary">Active Jobs</div>
                        </div>
                        <div className="glass-card text-center">
                            <Users size={32} color="#10b981" style={{ margin: '0 auto 0.5rem' }} />
                            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#10b981' }}>{stats.totalApplications}</div>
                            <div className="text-secondary">Total Applications</div>
                        </div>
                        <div className="glass-card text-center">
                            <Eye size={32} color="#f59e0b" style={{ margin: '0 auto 0.5rem' }} />
                            <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f59e0b' }}>{stats.totalViews}</div>
                            <div className="text-secondary">Total Views</div>
                        </div>
                    </div>

                    {stats.applicationsByStatus && Object.keys(stats.applicationsByStatus).length > 0 && (
                        <div className="glass-panel" style={{ padding: '2rem' }}>
                            <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>
                                <TrendingUp size={18} style={{ display: 'inline', verticalAlign: 'middle' }} /> Application Status Breakdown
                            </h3>
                            <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                                {Object.entries(stats.applicationsByStatus).map(([status, count]) => (
                                    <div key={status} className="flex justify-between items-center" style={{
                                        padding: '0.75rem 1rem', borderRadius: '8px',
                                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <span className={`badge ${status === 'ACCEPTED' ? 'badge-success' : status === 'REJECTED' ? 'badge-danger' : status === 'REVIEWED' ? 'badge-primary' : 'badge-warning'}`}>
                                            {status}
                                        </span>
                                        <span style={{ fontSize: '1.4rem', fontWeight: 700 }}>{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
