import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import * as aiService from '../services/aiService';
import * as jobService from '../services/jobService';
import { Brain, DollarSign, Sparkles, Zap } from 'lucide-react';

export const AITools = () => {
    const { user } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState('salary');
    const [loading, setLoading] = useState(false);
    const [salary, setSalary] = useState(null);
    const [recommended, setRecommended] = useState([]);
    const [autoApplyResult, setAutoApplyResult] = useState(null);
    const [threshold, setThreshold] = useState(60);
    const [jobs, setJobs] = useState([]);
    const [salaryJobId, setSalaryJobId] = useState('');

    const fetchSalary = async (jobId) => {
        if (!jobId) return;
        setLoading(true);
        try {
            const data = await aiService.getSalaryEstimate(jobId);
            setSalary(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const fetchRecommended = async () => {
        setLoading(true);
        try {
            const data = await aiService.getRecommendedJobs(threshold);
            setRecommended(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleAutoApply = async () => {
        setLoading(true);
        try {
            const result = await aiService.autoApply(threshold);
            setAutoApplyResult(result);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => {
        if (activeTab === 'salary' && jobs.length === 0) {
            jobService.getAllJobs().then(setJobs).catch(console.error);
        }
        if (activeTab === 'recommended') fetchRecommended();
    }, [activeTab]);

    const tabs = [
        { id: 'salary', label: 'Salary Estimate', icon: <DollarSign size={16} /> },
        { id: 'recommended', label: 'Recommended Jobs', icon: <Sparkles size={16} /> },
        { id: 'autoapply', label: 'Auto Apply', icon: <Zap size={16} /> },
    ];

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="flex items-center gap-2 mb-4">
                <Brain size={32} color="var(--accent-color)" />
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(135deg, #f8fafc, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        AI Tools
                    </h1>
                    <p className="text-secondary">Powered by intelligent matching algorithms</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {loading && <div className="flex justify-center mt-4"><div className="spinner"></div></div>}

            {/* Salary Estimate */}
            {activeTab === 'salary' && (
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <div className="flex items-center gap-2 mb-2">
                        <label className="text-secondary" style={{ fontSize: '0.9rem' }}>Posting:</label>
                        <select
                            value={salaryJobId}
                            onChange={e => { setSalaryJobId(e.target.value); setSalary(null); fetchSalary(e.target.value); }}
                            style={{ flex: 1 }}
                        >
                            <option value="">Choose a job posting…</option>
                            {jobs.map(j => (
                                <option key={j.postId} value={j.postId}>
                                    {j.postProfile}{j.location ? ` — ${j.location}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {salary && !loading && (
                        <div style={{ textAlign: 'center' }}>
                            <DollarSign size={48} color="var(--success-color)" style={{ margin: '0 auto 1rem' }} />
                            <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Comparable Postings</h2>
                            {salary.sampleSize === 0 ? (
                                <p className="text-secondary">No comparable postings with salary data yet.</p>
                            ) : (
                                <>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success-color)', marginBottom: '0.5rem' }}>
                                        ₹{(salary.p25 / 100000).toFixed(1)}L – ₹{(salary.p75 / 100000).toFixed(1)}L
                                    </div>
                                    <p className="text-secondary mb-2">
                                        median ₹{(salary.p50 / 100000).toFixed(1)}L per annum ({salary.currency})
                                    </p>
                                    <div className="flex justify-center gap-4 mt-2" style={{ flexWrap: 'wrap' }}>
                                        <span className="badge badge-primary">{salary.sampleSize} comparable postings</span>
                                        <span className={`badge ${salary.confidence === 'HIGH' ? 'badge-success' : salary.confidence === 'MEDIUM' ? 'badge-warning' : 'badge-danger'}`}>
                                            {salary.confidence} confidence
                                        </span>
                                    </div>
                                    {salary.narrative ? (
                                        <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                                            <p className="mb-2"><strong>What drives the range:</strong> {salary.narrative.rangeDrivers}</p>
                                            <p className="mb-2"><strong>Where this posting sits:</strong> {salary.narrative.positioning}</p>
                                            <p><strong>Outlier check:</strong> {salary.narrative.outlierAssessment}</p>
                                        </div>
                                    ) : (
                                        <p className="text-secondary" style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>
                                            Explanation unavailable right now — the figures above are unaffected.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Recommended Jobs */}
            {activeTab === 'recommended' && !loading && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <label className="text-secondary" style={{ fontSize: '0.9rem' }}>Min match: {threshold}%</label>
                        <input type="range" min={20} max={90} value={threshold} onChange={e => setThreshold(parseInt(e.target.value))} style={{ flex: 1 }} />
                        <button className="btn btn-primary btn-sm" onClick={fetchRecommended}>Refresh</button>
                    </div>
                    {recommended.length === 0 ? (
                        <div className="glass-panel text-center" style={{ padding: '3rem' }}>
                            <p className="text-secondary">No jobs match your profile above {threshold}% threshold. Try lowering it or adding more skills.</p>
                        </div>
                    ) : (
                        <div className="grid" style={{ gap: '1rem' }}>
                            {recommended.map(match => (
                                <div key={match.id} className="glass-card">
                                    <div className="flex justify-between items-center">
                                        <h3 style={{ fontWeight: 700 }}>{match.jobPost?.postProfile}</h3>
                                        <span className={`badge ${match.score >= 80 ? 'badge-success' : match.score >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                                            {match.score}% match
                                        </span>
                                    </div>
                                    <div className="flex gap-2 mt-1" style={{ flexWrap: 'wrap' }}>
                                        {match.matchedSkills?.map(s => <span key={s} className="job-card__skill">{s}</span>)}
                                        {match.missingSkills?.map(s => (
                                            <span key={s} className="job-card__skill" style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5' }}>{s} (missing)</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Auto Apply */}
            {activeTab === 'autoapply' && !loading && (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                    <Zap size={48} color="var(--warning-color)" style={{ margin: '0 auto 1rem' }} />
                    <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Auto Apply</h2>
                    <p className="text-secondary mb-4">Automatically apply to all jobs matching your profile above the threshold with AI-generated cover letters.</p>
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <label className="text-secondary">Threshold: {threshold}%</label>
                        <input type="range" min={50} max={95} value={threshold} onChange={e => setThreshold(parseInt(e.target.value))} />
                    </div>
                    <button className="btn btn-primary" onClick={handleAutoApply} style={{ fontSize: '1.1rem', padding: '0.8rem 2rem' }}>
                        <Zap size={18} /> Start Auto Apply
                    </button>

                    {autoApplyResult && (
                        <div className="glass-card mt-4">
                            <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Results:</h3>
                            <div className="flex justify-center gap-4">
                                <div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-color)' }}>{autoApplyResult.matchesFound}</div>
                                    <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Matches Found</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success-color)' }}>{autoApplyResult.applicationsSubmitted}</div>
                                    <div className="text-secondary" style={{ fontSize: '0.85rem' }}>Applications Sent</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
