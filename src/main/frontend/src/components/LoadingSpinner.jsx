import React from 'react';

export const LoadingSpinner = ({ fullScreen }) => {
    if (fullScreen) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }
    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <div className="spinner"></div>
        </div>
    );
};
