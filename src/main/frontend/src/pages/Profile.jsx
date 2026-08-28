import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import * as userService from '../services/userService';
import { User, Upload, Save, Eye, EyeOff, MapPin, Briefcase, Github, Linkedin, Globe } from 'lucide-react';

export const Profile = () => {
    const { updateUser } = useContext(AuthContext);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [skillInput, setSkillInput] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await userService.getCurrentProfile();
                setProfile(data);
            } catch (e) { console.error(e); }
            setLoading(false);
        };
        fetchProfile();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await userService.updateProfile({
                fullName: profile.fullName,
                phone: profile.phone,
                bio: profile.bio,
                location: profile.location,
                skills: profile.skills,
                experienceYears: profile.experienceYears,
                currentJobTitle: profile.currentJobTitle,
                linkedinUrl: profile.linkedinUrl,
                githubUrl: profile.githubUrl,
                portfolioUrl: profile.portfolioUrl,
                isProfilePublic: profile.isProfilePublic,
            });
            setProfile(updated);
            updateUser({ fullName: updated.fullName });
            setMessage('Profile updated successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (e) { setMessage('Error updating profile'); }
        setSaving(false);
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const result = await userService.uploadProfilePhoto(file);
            setProfile(p => ({ ...p, profilePhotoPath: result.path }));
            setMessage('Photo uploaded!');
            setTimeout(() => setMessage(''), 3000);
        } catch (e) { setMessage('Error uploading photo'); }
    };

    const handleResumeUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const result = await userService.uploadResume(file);
            setProfile(p => ({ ...p, resumePath: result.path }));
            setMessage('Resume uploaded!');
            setTimeout(() => setMessage(''), 3000);
        } catch (e) { setMessage('Error uploading resume'); }
    };

    const addSkill = () => {
        if (skillInput.trim() && !profile.skills?.includes(skillInput.trim())) {
            setProfile(p => ({ ...p, skills: [...(p.skills || []), skillInput.trim()] }));
            setSkillInput('');
        }
    };

    const removeSkill = (skill) => {
        setProfile(p => ({ ...p, skills: p.skills.filter(s => s !== skill) }));
    };

    if (loading) return <div className="flex justify-center mt-4"><div className="spinner"></div></div>;
    if (!profile) return <div className="text-center mt-4">Error loading profile</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem',
                background: 'linear-gradient(135deg, #f8fafc, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                My Profile
            </h1>
            <p className="text-secondary mb-4">Manage your personal information and preferences</p>

            {message && (
                <div className="glass-card mb-2" style={{ padding: '0.75rem', borderColor: message.includes('Error') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)' }}>
                    {message}
                </div>
            )}

            {/* Photo & Basic Info */}
            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                <div className="flex items-center gap-4" style={{ marginBottom: '1.5rem' }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(167,139,250,0.3))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0
                    }}>
                        {profile.profilePhotoPath
                            ? <img src={`http://localhost:8080/api/files?path=${profile.profilePhotoPath}`} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <User size={36} color="#a5b4fc" />}
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{profile.fullName}</h2>
                        <p className="text-secondary">{profile.email}</p>
                        <span className="badge badge-primary">{profile.role}</span>
                    </div>
                    <label className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', cursor: 'pointer' }}>
                        <Upload size={14} /> Photo
                        <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                    </label>
                </div>

                <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input className="form-input" value={profile.fullName || ''} onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Phone</label>
                        <input className="form-input" value={profile.phone || ''} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label"><MapPin size={14} style={{ display: 'inline' }} /> Location</label>
                        <input className="form-input" value={profile.location || ''} onChange={e => setProfile(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Mumbai, India" />
                    </div>
                    <div className="form-group">
                        <label className="form-label"><Briefcase size={14} style={{ display: 'inline' }} /> Job Title</label>
                        <input className="form-input" value={profile.currentJobTitle || ''} onChange={e => setProfile(p => ({ ...p, currentJobTitle: e.target.value }))} placeholder="e.g. Full Stack Developer" />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Experience (years)</label>
                        <input className="form-input" type="number" min="0" value={profile.experienceYears || ''} onChange={e => setProfile(p => ({ ...p, experienceYears: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Profile Visibility</label>
                        <button
                            className={`btn ${profile.isProfilePublic ? 'btn-success' : 'btn-secondary'}`}
                            onClick={() => setProfile(p => ({ ...p, isProfilePublic: !p.isProfilePublic }))}
                            style={{ width: '100%' }}
                        >
                            {profile.isProfilePublic ? <><Eye size={16} /> Public</> : <><EyeOff size={16} /> Private</>}
                        </button>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Bio</label>
                    <textarea className="form-input" rows={3} value={profile.bio || ''} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} placeholder="Tell employers about yourself..." />
                </div>

                <div className="grid grid-cols-3" style={{ gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label"><Linkedin size={14} style={{ display: 'inline' }} /> LinkedIn</label>
                        <input className="form-input" value={profile.linkedinUrl || ''} onChange={e => setProfile(p => ({ ...p, linkedinUrl: e.target.value }))} placeholder="https://linkedin.com/in/..." />
                    </div>
                    <div className="form-group">
                        <label className="form-label"><Github size={14} style={{ display: 'inline' }} /> GitHub</label>
                        <input className="form-input" value={profile.githubUrl || ''} onChange={e => setProfile(p => ({ ...p, githubUrl: e.target.value }))} placeholder="https://github.com/..." />
                    </div>
                    <div className="form-group">
                        <label className="form-label"><Globe size={14} style={{ display: 'inline' }} /> Portfolio</label>
                        <input className="form-input" value={profile.portfolioUrl || ''} onChange={e => setProfile(p => ({ ...p, portfolioUrl: e.target.value }))} placeholder="https://..." />
                    </div>
                </div>
            </div>

            {/* Skills */}
            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Skills</h3>
                <div className="flex gap-2" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {(profile.skills || []).map(skill => (
                        <span key={skill} className="job-card__skill" style={{ cursor: 'pointer' }} onClick={() => removeSkill(skill)}>
                            {skill} ×
                        </span>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input className="form-input" value={skillInput} onChange={e => setSkillInput(e.target.value)} placeholder="Add a skill..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} style={{ flex: 1 }} />
                    <button className="btn btn-primary" onClick={addSkill}>Add</button>
                </div>
            </div>

            {/* Resume */}
            <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Resume</h3>
                {profile.resumePath ? (
                    <div className="flex items-center gap-2">
                        <span className="badge badge-success">Resume uploaded</span>
                        <a href={`http://localhost:8080/api/files?path=${profile.resumePath}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">View</a>
                    </div>
                ) : (
                    <p className="text-secondary mb-2">No resume uploaded yet</p>
                )}
                <label className="btn btn-primary mt-2" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                    <Upload size={16} /> Upload Resume (PDF/DOC)
                    <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} style={{ display: 'none' }} />
                </label>
            </div>

            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '0.8rem', fontSize: '1.1rem' }}>
                <Save size={18} /> {saving ? 'Saving...' : 'Save Profile'}
            </button>
        </div>
    );
};
