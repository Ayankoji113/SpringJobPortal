import React, { useState } from 'react';
import * as authService from '../services/authService';
import { AuthContext } from './auth-context';

export const AuthProvider = ({ children }) => {
    // Read once during the initial render rather than in an effect, which would
    // render null first and then immediately set state.
    const [user, setUser] = useState(() => authService.getCurrentUser());

    const login = async (email, password) => {
        const data = await authService.login(email, password);
        setUser(data);
        return data;
    };

    const register = async (userData) => {
        const data = await authService.register(userData);
        setUser(data);
        return data;
    };

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    const updateUser = (updates) => {
        const updated = { ...user, ...updates };
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
    };

    return (
        <AuthContext.Provider value={{
            user,
            login,
            register,
            logout,
            updateUser,
            isAuthenticated: !!user,
            isEmployer: user?.role === 'EMPLOYER',
            isJobSeeker: user?.role === 'JOB_SEEKER',
            isAdmin: user?.role === 'ADMIN'
        }}>
            {children}
        </AuthContext.Provider>
    );
};
