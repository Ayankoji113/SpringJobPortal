import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Clock, MapPin, ArrowRight } from 'lucide-react';

export const JobCard = ({ job }) => {
    const formatDate = (dateValue) => {
        if (!dateValue) return 'Recently';
        const date = new Date(dateValue);
        if (isNaN(date.getTime()) || date.getFullYear() <= 1970) return 'Recently';
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <div className="job-card">
            <div className="job-card__header">
                <div className="job-card__icon">
                    <Briefcase size={20} />
                </div>
                <span className="job-card__date">
                    <Clock size={13} />
                    {formatDate(job.postedDate)}
                </span>
            </div>

            <h3 className="job-card__title">{job.postProfile}</h3>

            <p className="job-card__desc">
                {job.postDesc?.substring(0, 100)}{job.postDesc?.length > 100 ? '...' : ''}
            </p>

            <div className="job-card__meta">
                <span className="job-card__meta-item">
                    <Briefcase size={14} />
                    {job.reqExperience} {job.reqExperience === 1 ? 'year' : 'years'}
                </span>
            </div>

            <div className="job-card__skills">
                {job.postTechStack?.slice(0, 4).map((tech, index) => (
                    <span key={index} className="job-card__skill">{tech}</span>
                ))}
                {job.postTechStack?.length > 4 && (
                    <span className="job-card__skill job-card__skill--more">
                        +{job.postTechStack.length - 4}
                    </span>
                )}
            </div>

            <Link to={`/job/${job.postId}`} className="job-card__link">
                View Details
                <ArrowRight size={16} />
            </Link>
        </div>
    );
};
