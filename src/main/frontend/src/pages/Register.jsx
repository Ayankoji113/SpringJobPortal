import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export const Register = () => {
    const [userData, setUserData] = useState({ fullName: '', email: '', password: '', role: 'JOB_SEEKER' });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const { register } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setUserData({...userData, [e.target.name]: e.target.value});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        
        try {
            await register(userData);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Registration failed. Email might be in use.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container glass-panel">
            <h2 className="auth-title">Create Account</h2>
            <p className="auth-subtitle">Join us to find or post jobs</p>

            {error && <div className="badge badge-danger w-full mb-4 text-center" style={{padding: '0.75rem', width: '100%'}}>{error}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label">Account Type</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                            <input 
                                type="radio" 
                                name="role" 
                                value="JOB_SEEKER" 
                                checked={userData.role === 'JOB_SEEKER'} 
                                onChange={handleChange} 
                            />
                            Job Seeker
                        </label>
                        <label className="flex items-center gap-2">
                            <input 
                                type="radio" 
                                name="role" 
                                value="EMPLOYER" 
                                checked={userData.role === 'EMPLOYER'} 
                                onChange={handleChange} 
                            />
                            Employer
                        </label>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input 
                        type="text" 
                        name="fullName" 
                        className="form-input" 
                        value={userData.fullName} 
                        onChange={handleChange} 
                        required 
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                        type="email" 
                        name="email" 
                        className="form-input" 
                        value={userData.email} 
                        onChange={handleChange} 
                        required 
                    />
                </div>
                
                <div className="form-group">
                    <label className="form-label">Password</label>
                    <input 
                        type="password" 
                        name="password" 
                        className="form-input" 
                        value={userData.password} 
                        onChange={handleChange} 
                        required 
                        minLength={6}
                    />
                </div>

                <button type="submit" className="btn btn-primary w-full" style={{width: '100%'}} disabled={loading}>
                    {loading ? 'Creating Account...' : 'Sign Up'}
                </button>
            </form>

            <div className="text-center mt-4">
                <span className="text-secondary">Already have an account? </span>
                <Link to="/login">Log In</Link>
            </div>
        </div>
    );
};
