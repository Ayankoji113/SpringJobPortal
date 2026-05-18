import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import * as aiService from '../services/aiService';
import { Brain, Wand2, DollarSign, FileText, Sparkles, Zap, Loader2 } from 'lucide-react';

export const AITools = () => {
    const { user } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState('suggestions');
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState(null);
    const [salary, setSalary] = useState(null);
    const [recommended, setRecommended] = useState([]);
    const [autoApplyResult, setAutoApplyResult] = useState(null);
    const [threshold, setThreshold] = useState(60);

    const fetchSuggestions = async () => {
        setLoading(true);
        try {
            const data = await aiService.getResumeSuggestions();
            setSuggestions(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const fetchSalary = async () => {
        setLoading(true);
        try {
            const data = await aiService.getSalaryEstimate();
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
        if (activeTab === 'suggestions') fetchSuggestions();
        if (activeTab === 'salary') fetchSalary();
        if (activeTab === 'recommended') fetchRecommended();
    }, [activeTab]);

    const tabs = [
        { id: 'suggestions', label: 'Profile Analysis', icon: <FileText size={16} /> },
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

            {/* Profile Analysis */}
            {activeTab === 'suggestions' && suggestions && !loading && (
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h2 style={{ fontWeight: 700, marginBottom: '1rem' }}>Profile Completeness: {suggestions.profileCompleteness}%</h2>
                    <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.1)', marginBottom: '1.5rem', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: 4,
                            width: `${suggestions.profileCompleteness}%`,
                            background: suggestions.profileCompleteness >= 70 ? 'var(--success-color)' : suggestions.profileCompleteness >= 40 ? 'var(--warning-color)' : 'var(--danger-color)',
                            transition: 'width 0.5s ease'
                        }} />
                    </div>
                    <span className={`badge ${suggestions.overallRating === 'Excellent' ? 'badge-success' : suggestions.overallRating === 'Good' ? 'badge-primary' : 'badge-warning'}`} style={{ marginBottom: '1rem', display: 'inline-block' }}>
                        {suggestions.overallRating}
                    </span>

                    {suggestions.improvements?.length > 0 && (
                        <>
                            <h3 style={{ fontWeight: 600, marginTop: '1rem', marginBottom: '0.5rem' }}>Improvement Suggestions:</h3>
                            {suggestions.improvements.map((imp, i) => (
                                <div key={i} className="flex items-center gap-2" style={{ padding: '0.6rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <Wand2 size={14} color="var(--warning-color)" />
                                    <span style={{ fontSize: '0.9rem' }}>{imp}</span>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* Salary Estimate */}
            {activeTab === 'salary' && salary && !loading && (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                    <DollarSign size={48} color="var(--success-color)" style={{ margin: '0 auto 1rem' }} />
                    <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Estimated Salary Range</h2>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--success-color)', marginBottom: '0.5rem' }}>
                        ₹{(salary.estimatedMinSalary / 100000).toFixed(1)}L - ₹{(salary.estimatedMaxSalary / 100000).toFixed(1)}L
                    </div>
                    <p className="text-secondary mb-2">per annum ({salary.currency})</p>
                    <div className="flex justify-center gap-4 mt-2" style={{ flexWrap: 'wrap' }}>
                        <span className="badge badge-primary">Experience: {salary.experienceYears || 0} years</span>
                        <span className="badge badge-primary">Skills: {salary.skillCount}</span>
                    </div>
                    {salary.highDemandSkills?.length > 0 && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <p className="text-secondary" style={{ fontSize: '0.85rem' }}>High-demand skills boosting your salary:</p>
                            <div className="flex gap-2 justify-center mt-1" style={{ flexWrap: 'wrap' }}>
                                {salary.highDemandSkills.map(s => <span key={s} className="job-card__skill">{s}</span>)}
                            </div>
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
