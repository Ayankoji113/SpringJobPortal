import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as jobService from '../services/jobService';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Building, Calendar } from 'lucide-react';

export const MyApplications = () => {
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchApps = async () => {
            try {
                const data = await jobService.getMyApplications();
                setApplications(data);
            } catch (error) {
                console.error("Failed to load applications", error);
            } finally {
                setLoading(false);
            }
        };
        fetchApps();
    }, []);

    const getStatusBadgeClass = (status) => {
        switch(status) {
            case 'ACCEPTED': return 'badge-success';
            case 'REJECTED': return 'badge-danger';
            case 'REVIEWED': return 'badge-warning';
            default: return 'badge-primary';
        }
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div style={{maxWidth: '800px', margin: '0 auto'}}>
            <h2 className="font-bold mb-4" style={{fontSize: '2rem'}}>My Applications</h2>

            {applications.length === 0 ? (
                <div className="glass-panel text-center" style={{padding: '3rem'}}>
                    <p className="text-secondary mb-4">You haven't applied to any jobs yet.</p>
                    <Link to="/jobs" className="btn btn-primary">Browse Jobs</Link>
                </div>
            ) : (
                <div className="grid grid-cols-1">
                    {applications.map(app => (
                        <div key={app.id} className="glass-card">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="font-bold text-xl">
                                        <Link to={`/job/${app.jobPost.postId}`}>{app.jobPost.postProfile}</Link>
                                    </h3>
                                    <div className="flex items-center gap-4 text-secondary mt-1 text-sm">
                                        <span className="flex items-center gap-1"><Building size={14}/> {app.jobPost.postedBy?.fullName || 'Company'}</span>
                                        <span className="flex items-center gap-1"><Calendar size={14}/> Applied: {new Date(app.appliedDate).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <span className={`badge ${getStatusBadgeClass(app.status)}`}>
                                    {app.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
