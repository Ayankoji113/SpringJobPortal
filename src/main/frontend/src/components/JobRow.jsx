import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Briefcase, Globe, MapPin, Signal, Star } from 'lucide-react';
import { Button, Skeleton } from './ui';
import { Fact, Facts, Monogram } from './ui/kit';
import { jobTypeLabel, relativeDate, salaryRange } from '../lib/format';
import './jobrow.css';

const MAX_TAGS = 4;
const MAX_TAGS_PHONE = 3;

const experienceLabel = (years) => (years == null ? null : Number(years) === 0 ? 'Entry level' : `${years}+ yrs`);

/** One job in a list. Shared by the listing, the home page, saved jobs and
 *  recommendations so a job reads the same wherever it appears.
 *  `trailing` is rendered at the right edge (a badge, a checkbox, a button). */
export function JobRow({ job, saved, onToggleSave, trailing }) {
  const company = job.company?.name || job.postedBy?.fullName || '';
  const tags = job.postTechStack || [];
  const disclosed = job.salaryMin != null || job.salaryMax != null;
  const experience = experienceLabel(job.reqExperience);

  return (
    <article className={job.isFeatured ? 'jp-jobrow jp-jobrow--job jp-jobrow--featured' : 'jp-jobrow jp-jobrow--job'}>
      <Monogram name={company} />

      <div className="jp-jobrow__main">
        <h3 className="jp-h3 jp-jobrow__title">
          <Link to={`/job/${job.postId}`} className="jp-jobrow__link">{job.postProfile}</Link>
        </h3>
        <p className="jp-jobrow__company">
          {company}
          {job.isFeatured && (
            <span className="jp-jobrow__featured"><Star size={12} aria-hidden="true" />Featured</span>
          )}
        </p>
        <Facts className="jp-jobrow__facts">
          {job.isRemote
            ? <Fact icon={Globe}>Remote</Fact>
            : job.location && <Fact icon={MapPin}>{job.location}</Fact>}
          {job.jobType && <Fact icon={Briefcase}>{jobTypeLabel(job.jobType)}</Fact>}
          {experience && <Fact icon={Signal}>{experience}</Fact>}
        </Facts>
        {tags.length > 0 && (
          <ul className="jp-jobrow__tags" aria-label="Tech stack">
            {tags.slice(0, MAX_TAGS).map((tech) => <li key={tech} className="jp-tag">{tech}</li>)}
            {/* Phones show one tag fewer, so the overflow count differs by width. */}
            {tags.length > MAX_TAGS && (
              <li className="jp-jobrow__more jp-jobrow__more--wide">+{tags.length - MAX_TAGS}<span className="jp-sr-only"> more</span></li>
            )}
            {tags.length > MAX_TAGS_PHONE && (
              <li className="jp-jobrow__more jp-jobrow__more--phone" aria-hidden="true">+{tags.length - MAX_TAGS_PHONE}</li>
            )}
          </ul>
        )}
      </div>

      <div className="jp-jobrow__pay">
        <span className={disclosed ? 'jp-jobrow__salary' : 'jp-jobrow__salary jp-jobrow__salary--none'}>
          {disclosed ? salaryRange(job.salaryMin, job.salaryMax) : 'Pay not disclosed'}
        </span>
        <span className="jp-jobrow__posted">{relativeDate(job.postedDate)}</span>
      </div>

      {(onToggleSave || trailing) && (
        <div className="jp-jobrow__actions">
          {onToggleSave && (
            <Button
              size="sm"
              className="jp-jobrow__save"
              aria-pressed={Boolean(saved)}
              aria-label={saved ? `Remove ${job.postProfile} from saved jobs` : `Save ${job.postProfile}`}
              onClick={() => onToggleSave(job)}
            >
              {saved ? <BookmarkCheck size={15} aria-hidden="true" /> : <Bookmark size={15} aria-hidden="true" />}
              {saved ? 'Saved' : 'Save'}
            </Button>
          )}
          {trailing}
        </div>
      )}
    </article>
  );
}

/** Skeleton with the same geometry as the row above: mark, title, facts, pay. */
export function JobRowSkeleton() {
  return (
    <div className="jp-jobrow jp-jobrow--job">
      <Skeleton width={40} height={40} radius={6} style={{ flex: 'none' }} />
      <div className="jp-jobrow__main">
        <Skeleton width="46%" height={15} />
        <Skeleton width="24%" height={11} style={{ marginTop: 9 }} />
        <Skeleton width="58%" height={11} style={{ marginTop: 9 }} />
      </div>
      <div className="jp-jobrow__pay">
        <Skeleton width={112} height={14} />
        <Skeleton width={60} height={10} />
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
