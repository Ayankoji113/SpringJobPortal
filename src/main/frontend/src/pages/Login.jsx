import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export const Login = () => {
    const [credentials, setCredentials] = useState({ email: '', password: '' });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setCredentials({...credentials, [e.target.name]: e.target.value});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        
        try {
            await login(credentials.email, credentials.password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to login. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container glass-panel">
            <h2 className="auth-title">Welcome Back</h2>
            <p className="auth-subtitle">Login to your account to continue</p>

            {error && <div className="badge badge-danger w-full mb-4 text-center" style={{padding: '0.75rem', width: '100%'}}>{error}</div>}

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <input 
                        type="email" 
                        name="email" 
                        className="form-input" 
                        value={credentials.email} 
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
                        value={credentials.password} 
                        onChange={handleChange} 
                        required 
                    />
                </div>

                <button type="submit" className="btn btn-primary w-full" style={{width: '100%'}} disabled={loading}>
                    {loading ? 'Logging in...' : 'Log In'}
                </button>
            </form>

            <div className="text-center mt-2">
                <Link to="/forgot-password" style={{ fontSize: '0.9rem' }}>Forgot Password?</Link>
            </div>

            <div className="text-center mt-4">
                <span className="text-secondary">Don't have an account? </span>
                <Link to="/register">Sign Up</Link>
            </div>
        </div>
    );
};
