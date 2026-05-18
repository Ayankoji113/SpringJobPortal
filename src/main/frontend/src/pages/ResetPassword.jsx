import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as authService from '../services/authService';
import { Lock, CheckCircle } from 'lucide-react';

export const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [done, setDone] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await authService.resetPassword(token, password);
            setDone(true);
        } catch (e) {
            setError('Invalid or expired reset token');
        }
        setLoading(false);
    };

    if (!token) {
        return (
            <div className="auth-container glass-panel text-center" style={{ padding: '2rem' }}>
                <p className="text-secondary">Invalid reset link. Please request a new one.</p>
                <Link to="/forgot-password" className="btn btn-primary mt-2">Request New Link</Link>
            </div>
        );
    }

    return (
        <div className="auth-container glass-panel" style={{ padding: '2rem' }}>
            <h1 className="auth-title"><Lock size={28} style={{ display: 'inline', verticalAlign: 'middle' }} /> New Password</h1>

            {done ? (
                <div className="text-center">
                    <CheckCircle size={48} color="var(--success-color)" style={{ margin: '1rem auto' }} />
                    <p style={{ marginBottom: '1rem' }}>Your password has been reset successfully!</p>
                    <Link to="/login" className="btn btn-primary">Log In</Link>
                </div>
            ) : (
                <form onSubmit={handleSubmit}>
                    {error && <div className="form-error mb-2">{error}</div>}
                    <div className="form-group">
                        <label className="form-label">New Password</label>
                        <input className="form-input" type="password" value={password}
                            onChange={e => setPassword(e.target.value)} required minLength={6} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Confirm Password</label>
                        <input className="form-input" type="password" value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)} required />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%' }}>
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
            )}
        </div>
    );
};
