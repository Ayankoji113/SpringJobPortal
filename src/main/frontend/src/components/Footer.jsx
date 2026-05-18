import React from 'react';

export const Footer = () => {
    return (
        <footer style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 'auto' }}>
            <p>&copy; {new Date().getFullYear()} NextGen Jobs. All rights reserved.</p>
        </footer>
    );
};
