import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as jobService from '../services/jobService';

export const PostJob = () => {
    const navigate = useNavigate();
    const [jobData, setJobData] = useState({
        postProfile: '',
        postDesc: '',
        reqExperience: 0,
        postTechStack: []
    });
    const [techInput, setTechInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        setJobData({...jobData, [e.target.name]: e.target.value});
    };

    const handleAddTech = (e) => {
        if (e.key === 'Enter' || e.type === 'click') {
            e.preventDefault();
            if (techInput.trim() && !jobData.postTechStack.includes(techInput.trim())) {
                setJobData({
                    ...jobData,
                    postTechStack: [...jobData.postTechStack, techInput.trim()]
                });
                setTechInput('');
            }
        }
    };

    const removeTech = (tech) => {
        setJobData({
            ...jobData,
            postTechStack: jobData.postTechStack.filter(t => t !== tech)
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const payload = { ...jobData, reqExperience: parseInt(jobData.reqExperience, 10) || 0 };
            const created = await jobService.createJob(payload);
            navigate(`/job/${created.postId}`);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to post job');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{maxWidth: '600px', margin: '0 auto'}}>
            <div className="glass-panel" style={{padding: '2rem'}}>
                <h1 className="font-bold text-2xl mb-4 text-center">Post a New Job</h1>
                
                {error && <div className="badge badge-danger w-full mb-4 text-center" style={{padding: '0.75rem', display: 'block'}}>{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Job Title / Profile</label>
                        <input 
                            type="text" 
                            name="postProfile" 
                            className="form-input" 
                            value={jobData.postProfile}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2">
                        <div className="form-group">
                            <label className="form-label">Required Experience (Years)</label>
                            <input 
                                type="number" 
                                name="reqExperience" 
                                className="form-input" 
                                min="0"
                                value={jobData.reqExperience}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Technology Stack</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                className="form-input" 
                                value={techInput}
                                onChange={(e) => setTechInput(e.target.value)}
                                onKeyDown={handleAddTech}
                                placeholder="e.g. React, Java, Spring"
                            />
                            <button type="button" className="btn btn-secondary" onClick={handleAddTech}>Add</button>
                        </div>
                        <div className="flex gap-2 flex-wrap mt-2">
                            {jobData.postTechStack.map((tech, i) => (
                                <span key={i} className="badge badge-primary flex items-center gap-1">
                                    {tech} <span style={{cursor:'pointer', marginLeft:'4px'}} onClick={() => removeTech(tech)}>×</span>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Job Description</label>
                        <textarea 
                            name="postDesc" 
                            className="form-input" 
                            rows={8}
                            value={jobData.postDesc}
                            onChange={handleChange}
                            required
                        ></textarea>
                    </div>

                    <button type="submit" className="btn btn-primary w-full" style={{width: '100%'}} disabled={loading}>
                        {loading ? 'Posting...' : 'Post Job'}
                    </button>
                </form>
            </div>
        </div>
    );
};
