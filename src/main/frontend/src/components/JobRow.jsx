import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { IconButton, Skeleton } from './ui';
import { jobTypeLabel, relativeDate, salaryRange } from '../lib/format';
import './jobrow.css';

/** One scannable line in a list. Shared by the listing, saved jobs and the
 *  employer's own postings so all three stay identical to read. */
export function JobRow({ job, saved, onToggleSave, trailing }) {
  const meta = [
    job.company?.name || job.postedBy?.fullName,
    job.isRemote ? 'Remote' : job.location,
    jobTypeLabel(job.jobType),
    job.reqExperience != null && `${job.reqExperience} yrs`,
  ].filter(Boolean);

  return (
    <article className="jp-jobrow">
      <div className="jp-jobrow__main">
        <h3 className="jp-h3">
          <Link to={`/job/${job.postId}`} className="jp-jobrow__link">{job.postProfile}</Link>
        </h3>
        <p className="jp-jobrow__meta jp-sm jp-muted">{meta.join(' · ')}</p>
        {job.postTechStack?.length > 0 && (
          <ul className="jp-jobrow__tags" aria-label="Tech stack">
            {job.postTechStack.slice(0, 5).map((tech) => (
              <li key={tech} className="jp-tag">{tech}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="jp-jobrow__side">
        <span className="jp-data">{salaryRange(job.salaryMin, job.salaryMax)}</span>
        <span className="jp-sm jp-muted">{relativeDate(job.postedDate)}</span>
      </div>

      {onToggleSave && (
        <IconButton
          label={saved ? `Remove ${job.postProfile} from saved jobs` : `Save ${job.postProfile}`}
          aria-pressed={saved}
          onClick={() => onToggleSave(job)}
        >
          {saved ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
        </IconButton>
      )}

      {trailing}
    </article>
  );
}

/** Skeleton with the same geometry as the row above — title, meta, salary. */
export function JobRowSkeleton() {
  return (
    <div className="jp-jobrow">
      <div className="jp-jobrow__main">
        <Skeleton width="42%" height={15} />
        <Skeleton width="60%" height={11} style={{ marginTop: 8 }} />
        <Skeleton width="30%" height={11} style={{ marginTop: 10 }} />
      </div>
      <div className="jp-jobrow__side">
        <Skeleton width={82} height={12} />
        <Skeleton width={54} height={10} style={{ marginTop: 8 }} />
      </div>
    </div>
  );
}

export function JobRowSkeletonList({ count = 6 }) {
  return (
    <div className="jp-list" aria-busy="true" aria-live="polite">
      <span className="jp-sr-only">Loading jobs</span>
      {Array.from({ length: count }, (_, i) => <JobRowSkeleton key={i} />)}
    </div>
  );
}
