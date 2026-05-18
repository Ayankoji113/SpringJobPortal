import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import * as jobService from '../services/jobService';
import { Briefcase, Clock, Building, ArrowLeft } from 'lucide-react';

export const JobDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [applying, setApplying] = useState(false);
    const [coverLetter, setCoverLetter] = useState('');
    const [showApply, setShowApply] = useState(false);
    const [message, setMessage] = useState(null);

    const { isAuthenticated, isEmployer } = useContext(AuthContext);

    useEffect(() => {
        const fetchJob = async () => {
            try {
                const data = await jobService.getJobById(id);
                setJob(data);
            } catch (error) {
                setMessage({ type: 'danger', text: 'Job not found' });
            } finally {
                setLoading(false);
            }
        };
        fetchJob();
    }, [id]);

    const handleApply = async (e) => {
        e.preventDefault();
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        
        setApplying(true);
        try {
            await jobService.applyToJob(id, coverLetter);
            setMessage({ type: 'success', text: 'Application submitted successfully!' });
            setShowApply(false);
        } catch (error) {
            setMessage({ type: 'danger', text: error.response?.data?.error || 'Failed to apply. You may have already applied.' });
        } finally {
            setApplying(false);
        }
    };

    if (loading) return <LoadingSpinner />;
    if (!job) return <div className="text-center mt-4">Job not found</div>;

    return (
        <div className="job-detail-container" style={{maxWidth: '800px', margin: '0 auto'}}>
            <button onClick={() => navigate(-1)} className="btn btn-secondary mb-4">
                <ArrowLeft size={16} /> Back
            </button>

            {message && (
                <div className={`badge badge-${message.type} w-full mb-4`} style={{padding: '1rem', display: 'block', fontSize: '1rem'}}>
                    {message.text}
                </div>
            )}

            <div className="glass-panel" style={{padding: '2rem'}}>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h1 className="font-bold mb-1" style={{fontSize: '2.5rem'}}>{job.postProfile}</h1>
                        <div className="flex items-center gap-4 text-secondary mt-2">
                            <span className="flex items-center gap-1"><Building size={16}/> {job.postedBy?.fullName || 'Company'}</span>
                            <span className="flex items-center gap-1"><Briefcase size={16}/> {job.reqExperience} years exp</span>
                            <span className="flex items-center gap-1"><Clock size={16}/> Posted {job.postedDate ? new Date(job.postedDate).toLocaleDateString() : 'Recently'}</span>
                        </div>
                    </div>
                    
                    {!isEmployer && !showApply && (
                        <button onClick={() => setShowApply(true)} className="btn btn-primary btn-lg">Apply Now</button>
                    )}
                </div>

                <div className="mt-4">
                    <h3 className="font-bold text-xl mb-2">Technologies</h3>
                    <div className="flex gap-2 flex-wrap">
                        {job.postTechStack?.map((tech, i) => (
                            <span key={i} className="badge badge-primary">{tech}</span>
                        ))}
                    </div>
                </div>

                <div className="mt-4 pt-4" style={{borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                    <h3 className="font-bold text-xl mb-2">Job Description</h3>
                    <div className="text-secondary" style={{whiteSpace: 'pre-wrap'}}>
                        {job.postDesc}
                    </div>
                </div>

                {showApply && (
                    <div className="mt-4 pt-4" style={{borderTop: '1px solid rgba(255,255,255,0.1)'}}>
                        <h3 className="font-bold text-xl mb-2">Submit Application</h3>
                        <form onSubmit={handleApply}>
                            <div className="form-group">
                                <label className="form-label">Cover Letter</label>
                                <textarea 
                                    className="form-input" 
                                    value={coverLetter}
                                    onChange={(e) => setCoverLetter(e.target.value)}
                                    placeholder="Explain why you are a great fit for this role..."
                                    required
                                    rows={5}
                                ></textarea>
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className="btn btn-primary" disabled={applying}>
                                    {applying ? 'Submitting...' : 'Submit Application'}
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowApply(false)}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};
