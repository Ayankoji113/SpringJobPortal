import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Briefcase } from 'lucide-react';

export const Home = () => {
    return (
        <div className="home-container">
            <div className="hero glass-panel">
                <h1>Find Your Next Dream Job</h1>
                <p>Discover thousands of job opportunities with all the information you need. Its your future. Come find it.</p>
                
                <div className="flex justify-center gap-4 mt-4">
                    <Link to="/jobs" className="btn btn-primary" style={{padding: '0.8rem 1.5rem', fontSize: '1.1rem'}}>
                        <Search size={20} /> Browse Jobs
                    </Link>
                    <Link to="/register" className="btn btn-secondary" style={{padding: '0.8rem 1.5rem', fontSize: '1.1rem'}}>
                        <Briefcase size={20} /> Post a Job
                    </Link>
                </div>
            </div>

            <div className="features grid grid-cols-3 mt-4">
                <div className="glass-card text-center">
                    <h3 className="font-bold mb-2">For Job Seekers</h3>
                    <p className="text-secondary text-sm">Browse thousands of jobs, apply with one click, and track your applications easily.</p>
                </div>
                <div className="glass-card text-center">
                    <h3 className="font-bold mb-2">For Employers</h3>
                    <p className="text-secondary text-sm">Post jobs, review applicant profiles, and hire the best talent globally.</p>
                </div>
                <div className="glass-card text-center">
                    <h3 className="font-bold mb-2">Secure & Fast</h3>
                    <p className="text-secondary text-sm">Powered by Spring Boot Security and JWT for a seamless and secure experience.</p>
                </div>
            </div>
        </div>
    );
};
