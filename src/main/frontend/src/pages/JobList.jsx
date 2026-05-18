import React, { useState, useEffect } from 'react';
import { JobCard } from '../components/JobCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import * as jobService from '../services/jobService';
import { Search, Briefcase } from 'lucide-react';

export const JobList = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadJobs();
    }, []);

    const loadJobs = async () => {
        setLoading(true);
        try {
            const data = await jobService.getAllJobs();
            setJobs(data);
        } catch (error) {
            console.error("Failed to load jobs", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (searchTerm.trim()) {
                const data = await jobService.searchJobs(searchTerm);
                setJobs(data);
            } else {
                await loadJobs();
            }
        } catch (error) {
            console.error("Search failed", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="jobs-page">
            <div className="jobs-page__header">
                <div>
                    <h2 className="jobs-page__title">Browse Opportunities</h2>
                    <p className="jobs-page__subtitle">
                        {!loading && `${jobs.length} position${jobs.length !== 1 ? 's' : ''} available`}
                    </p>
                </div>
                
                <form onSubmit={handleSearch} className="jobs-page__search">
                    <Search size={18} className="jobs-page__search-icon" />
                    <input 
                        type="text" 
                        placeholder="Search jobs, skills..." 
                        className="jobs-page__search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button type="submit" className="jobs-page__search-btn">
                        Search
                    </button>
                </form>
            </div>

            {loading ? (
                <LoadingSpinner />
            ) : jobs.length === 0 ? (
                <div className="jobs-page__empty">
                    <Briefcase size={48} />
                    <h3>No jobs found</h3>
                    <p>Try adjusting your search criteria</p>
                </div>
            ) : (
                <div className="jobs-grid">
                    {jobs.map(job => (
                        <JobCard key={job.postId} job={job} />
                    ))}
                </div>
            )}
        </div>
    );
};
