import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as jobService from '../services/jobService';
import { Bookmark, Trash2 } from 'lucide-react';

export const SavedJobs = () => {
    const [savedJobs, setSavedJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await jobService.getSavedJobs();
                setSavedJobs(data);
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        fetch();
    }, []);

    const handleUnsave = async (jobPostId) => {
        await jobService.unsaveJob(jobPostId);
        setSavedJobs(s => s.filter(j => j.jobPost?.postId !== jobPostId));
    };

    if (loading) return <div className="flex justify-center mt-4"><div className="spinner"></div></div>;

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem',
                background: 'linear-gradient(135deg, #f8fafc, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                <Bookmark size={28} style={{ display: 'inline', verticalAlign: 'middle' }} /> Saved Jobs
            </h1>
            <p className="text-secondary mb-4">{savedJobs.length} saved jobs</p>

            {savedJobs.length === 0 ? (
                <div className="glass-panel text-center" style={{ padding: '3rem' }}>
                    <Bookmark size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p className="text-secondary">No saved jobs yet. Browse jobs and save the ones you like!</p>
                    <Link to="/jobs" className="btn btn-primary mt-2">Browse Jobs</Link>
                </div>
            ) : (
                <div className="grid" style={{ gap: '1rem' }}>
                    {savedJobs.map(saved => (
                        <div key={saved.id} className="glass-card">
                            <div className="flex justify-between items-center">
                                <Link to={`/job/${saved.jobPost?.postId}`} style={{ textDecoration: 'none' }}>
                                    <h3 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{saved.jobPost?.postProfile}</h3>
                                </Link>
                                <button className="btn btn-danger btn-sm" onClick={() => handleUnsave(saved.jobPost?.postId)}>
                                    <Trash2 size={14} /> Remove
                                </button>
                            </div>
                            <p className="text-secondary" style={{ fontSize: '0.88rem' }}>{saved.jobPost?.postDesc?.substring(0, 150)}...</p>
                            <div className="flex gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
                                {saved.jobPost?.postTechStack?.slice(0, 5).map(s => <span key={s} className="job-card__skill">{s}</span>)}
                                {saved.jobPost?.location && <span className="job-card__meta-item">{saved.jobPost.location}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
