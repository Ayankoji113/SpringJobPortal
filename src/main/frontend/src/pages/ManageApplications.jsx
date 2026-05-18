import React, { useState, useEffect } from 'react';
import * as jobService from '../services/jobService';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Mail, Briefcase } from 'lucide-react';

export const ManageApplications = () => {
    const [jobs, setJobs] = useState([]);
    const [selectedJobId, setSelectedJobId] = useState('');
    const [applications, setApplications] = useState([]);
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [loadingApps, setLoadingApps] = useState(false);

    useEffect(() => {
        const fetchEmployerJobs = async () => {
            try {
                // In a real app we might want a specific endpoint for employer's own jobs.
                // Here we fetch all jobs and filter by the current logged-in employer
                const allJobs = await jobService.getAllJobs();
                const user = JSON.parse(localStorage.getItem('user'));
                const myJobs = allJobs.filter(j => j.postedBy?.id === user.id);
                setJobs(myJobs);
                if (myJobs.length > 0) {
                    setSelectedJobId(myJobs[0].postId.toString());
                }
            } catch (error) {
                console.error("Failed to load jobs", error);
            } finally {
                setLoadingJobs(false);
            }
        };
        fetchEmployerJobs();
    }, []);

    useEffect(() => {
        if (selectedJobId) {
            fetchApplications(selectedJobId);
        }
    }, [selectedJobId]);

    const fetchApplications = async (jobId) => {
        setLoadingApps(true);
        try {
            const data = await jobService.getApplicationsForJob(jobId);
            setApplications(data);
        } catch (error) {
            console.error("Failed to load applications", error);
        } finally {
            setLoadingApps(false);
        }
    };

    const handleStatusUpdate = async (appId, newStatus) => {
        try {
            await jobService.updateApplicationStatus(appId, newStatus);
            // Update local state
            setApplications(applications.map(app => 
                app.id === appId ? { ...app, status: newStatus } : app
            ));
        } catch (error) {
            alert('Failed to update status');
        }
    };

    const getStatusBadgeClass = (status) => {
        switch(status) {
            case 'ACCEPTED': return 'badge-success';
            case 'REJECTED': return 'badge-danger';
            case 'REVIEWED': return 'badge-warning';
            default: return 'badge-primary';
        }
    };

    if (loadingJobs) return <LoadingSpinner />;

    return (
        <div style={{maxWidth: '1000px', margin: '0 auto'}}>
            <h2 className="font-bold mb-4" style={{fontSize: '2rem'}}>Manage Applicants</h2>

            {jobs.length === 0 ? (
                <div className="glass-panel text-center" style={{padding: '3rem'}}>
                    <p className="text-secondary mb-4">You haven't posted any jobs yet.</p>
                </div>
            ) : (
                <>
                    <div className="form-group glass-panel" style={{padding: '1.5rem', marginBottom: '2rem'}}>
                        <label className="form-label" style={{fontSize: '1.1rem'}}>Select Job Post</label>
                        <select 
                            className="form-input" 
                            value={selectedJobId} 
                            onChange={(e) => setSelectedJobId(e.target.value)}
                        >
                            {jobs.map(job => (
                                <option key={job.postId} value={job.postId}>{job.postProfile}</option>
                            ))}
                        </select>
                    </div>

                    {loadingApps ? (
                        <LoadingSpinner />
                    ) : applications.length === 0 ? (
                        <div className="glass-panel text-center" style={{padding: '3rem'}}>
                            <p className="text-secondary">No applicants for this job yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1">
                            {applications.map(app => (
                                <div key={app.id} className="glass-card">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-xl">{app.applicant.fullName}</h3>
                                            <div className="flex items-center gap-4 text-secondary mt-1 text-sm">
                                                <span className="flex items-center gap-1"><Mail size={14}/> {app.applicant.email}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`badge ${getStatusBadgeClass(app.status)}`}>
                                                {app.status}
                                            </span>
                                            <div className="flex gap-2 mt-2">
                                                {app.status === 'PENDING' && (
                                                    <button onClick={() => handleStatusUpdate(app.id, 'REVIEWED')} className="btn btn-secondary btn-sm">Mark Reviewed</button>
                                                )}
                                                {app.status !== 'ACCEPTED' && (
                                                    <button onClick={() => handleStatusUpdate(app.id, 'ACCEPTED')} className="btn btn-success btn-sm">Accept</button>
                                                )}
                                                {app.status !== 'REJECTED' && (
                                                    <button onClick={() => handleStatusUpdate(app.id, 'REJECTED')} className="btn btn-danger btn-sm">Reject</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 pt-4" style={{borderTop: '1px solid rgba(255,255,255,0.05)'}}>
                                        <h4 className="font-bold text-sm mb-2 text-secondary uppercase tracking-wider">Cover Letter</h4>
                                        <p className="text-sm" style={{whiteSpace: 'pre-wrap'}}>{app.coverLetter}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
