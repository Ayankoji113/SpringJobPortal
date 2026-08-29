import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/auth-context';

export const ProtectedRoute = ({ children, requireEmployer, requireJobSeeker }) => {
    const { isAuthenticated, isEmployer, isJobSeeker } = useContext(AuthContext);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (requireEmployer && !isEmployer) {
        return <Navigate to="/" replace />;
    }

    if (requireJobSeeker && !isJobSeeker) {
        return <Navigate to="/" replace />;
    }

    return children;
};
