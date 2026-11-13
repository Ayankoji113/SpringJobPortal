import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import * as jobService from '../services/jobService';
import { errorMessage } from '../services/api';
import { Skeleton } from './ui';
import { fullDate, titleCase } from '../lib/format';
import './ApplicationTimeline.css';

const STEP = {
  PENDING: 'Applied',
  REVIEWED: 'Reviewed',
  INTERVIEW: 'Moved to interview',
  OFFERED: 'Offer made',
  ACCEPTED: 'Offer accepted',
  REJECTED: 'Not selected',
  WITHDRAWN: 'Withdrawn',
  NO_RESPONSE: 'No answer within 14 days',
};
const ACTOR = { APPLICANT: 'By the applicant', EMPLOYER: 'By the employer', SYSTEM: 'Automatically' };

const time = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

/**
 * An application's history behind a native disclosure, drawn as dated steps on a rail. The
 * request is made the first time it is opened, so a list of fifty applications does not make
 * fifty calls. Used by the seeker's applications and the employer's candidate list.
 */
export function ApplicationTimeline({ applicationId }) {
  const [opened, setOpened] = useState(false);
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['application-timeline', applicationId],
    queryFn: () => jobService.getApplicationTimeline(applicationId),
    enabled: opened,
  });

  return (
    <details className="jp-timeline jp-history" onToggle={(e) => e.currentTarget.open && setOpened(true)}>
      <summary className="jp-history__toggle">
        <ChevronRight size={14} aria-hidden="true" />History
      </summary>
      <div className="jp-history__body" aria-live="polite" aria-busy={opened && isPending}>
        {opened && isPending && (
          <div className="jp-history__loading">
            <span className="jp-sr-only">Loading history</span>
            <Skeleton width="40%" height={12} />
            <Skeleton width="65%" height={11} />
            <Skeleton width="35%" height={12} />
          </div>
        )}
        {isError && <p className="jp-sm jp-history__error" role="alert">Could not load the history. {errorMessage(error)}</p>}
        {data && data.length === 0 && <p className="jp-sm jp-muted">Nothing has happened on this application yet.</p>}
        {data && data.length > 0 && (
          <ol className="jp-timeline__list jp-history__list">
            {data.map((entry, i) => (
              <li key={`${entry.toStatus}-${entry.createdAt}`}
                className={i === data.length - 1 ? 'jp-history__step jp-history__step--last' : 'jp-history__step'}>
                <span className={`jp-history__dot jp-history__dot--${(entry.actor || 'SYSTEM').toLowerCase()}`} aria-hidden="true" />
                <div className="jp-history__line">
                  <strong className="jp-history__what">
                    {entry.fromStatus ? STEP[entry.toStatus] || titleCase(entry.toStatus) : 'Applied'}
                  </strong>
                  <time className="jp-history__when" dateTime={entry.createdAt}>
                    {fullDate(entry.createdAt)}, {time(entry.createdAt)}
                  </time>
                </div>
                <p className="jp-history__who">{ACTOR[entry.actor] || 'Automatically'}</p>
                {entry.note && (
                  <blockquote className="jp-history__note">
                    <p>{entry.note}</p>
                  </blockquote>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
