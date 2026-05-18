import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

export const ProtectedRoute = ({ children, requireEmployer, requireJobSeeker, requireAdmin }) => {
    const { isAuthenticated, isEmployer, isJobSeeker, isAdmin } = useContext(AuthContext);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requireEmployer && !isEmployer) {
        return <Navigate to="/" replace />;
    }

    if (requireJobSeeker && !isJobSeeker) {
        return <Navigate to="/" replace />;
    }

    if (requireAdmin && !isAdmin) {
        return <Navigate to="/" replace />;
    }

    return children;
};
