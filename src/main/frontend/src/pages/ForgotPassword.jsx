import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import * as authService from '../services/authService';
import { Mail, ArrowLeft } from 'lucide-react';

export const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await authService.forgotPassword(email);
            setSent(true);
        } catch (e) {
            setError('Something went wrong. Please try again.');
        }
        setLoading(false);
    };

    return (
        <div className="auth-container glass-panel" style={{ padding: '2rem' }}>
            <h1 className="auth-title">Reset Password</h1>
            <p className="auth-subtitle">Enter your email to receive a reset link</p>

            {sent ? (
                <div className="text-center">
                    <Mail size={48} color="var(--success-color)" style={{ margin: '1rem auto' }} />
                    <p style={{ marginBottom: '1rem' }}>If an account exists with <strong>{email}</strong>, we've sent a password reset link.</p>
                    <Link to="/login" className="btn btn-primary"><ArrowLeft size={16} /> Back to Login</Link>
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                    {error && <div className="form-error mb-2">{error}</div>}
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input className="form-input" type="email" value={email}
                            onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                        {loading ? 'Sending...' : 'Send Reset Link'}
                    </button>
                    <p className="text-center mt-2" style={{ fontSize: '0.9rem' }}>
                        <Link to="/login">Back to Login</Link>
                    </p>
                </form>
            )}
        </div>
    );
};
