import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as jobService from '../services/jobService';
import * as aiService from '../services/aiService';
import { errorMessage } from '../services/api';
import { JobRow, JobRowSkeletonList } from '../components/JobRow';
import { Badge, Button, EmptyState, Skeleton } from '../components/ui';
import { useToast } from '../components/ui/toast-context';
import { relativeDate, statusTone, titleCase } from '../lib/format';
import './pages.css';

/* --------------------------------------------------------------- applications */
export function MyApplications() {
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['my-applications'],
    queryFn: jobService.getMyApplications,
  });

  return (
    <div className="jp-container jp-page">
      <div className="jp-page-head">
        <div>
          <h1 className="jp-display">Applications</h1>
          <p className="jp-sm jp-muted">
            {isPending ? 'Loading…' : `${data?.length || 0} submitted`}
          </p>
        </div>
      </div>

      {isPending && (
        <div className="jp-list" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="jp-jobrow">
              <div className="jp-jobrow__main">
                <Skeleton width="40%" height={15} />
                <Skeleton width="55%" height={11} style={{ marginTop: 8 }} />
              </div>
              <Skeleton width={70} height={18} radius={999} />
            </div>
          ))}
        </div>
      )}

      {isError && !isPending && (
        <EmptyState title="Could not load your applications" body={errorMessage(error)}
          action={<Button variant="primary" onClick={() => refetch()}>Retry</Button>} />
      )}

      {!isPending && !isError && data.length === 0 && (
        <EmptyState
          title="You have not applied to anything yet"
          body="When you apply to a job it appears here with its current status."
          action={<Button variant="primary" onClick={() => navigate('/jobs')}>Browse jobs</Button>}
        />
      )}

      {!isPending && !isError && data.length > 0 && (
        <div className="jp-list">
          {data.map((app) => (
            <article key={app.id} className="jp-jobrow">
              <div className="jp-jobrow__main">
                <h2 className="jp-h3">
                  <Link to={`/job/${app.jobPost?.postId}`} className="jp-jobrow__link">
                    {app.jobPost?.postProfile}
                  </Link>
                </h2>
                <p className="jp-sm jp-muted jp-jobrow__meta">
                  {[app.jobPost?.postedBy?.fullName, app.jobPost?.location].filter(Boolean).join(' · ')}
                  {' · applied '}{relativeDate(app.appliedDate)}
                </p>
              </div>
              <div className="jp-jobrow__side">
                <Badge tone={statusTone(app.status)}>{titleCase(app.status)}</Badge>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- saved jobs */
export function SavedJobs() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: jobService.getSavedJobs,
  });

  const unsave = useMutation({
    mutationFn: (jobId) => jobService.unsaveJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs'] });
      toast('Removed from saved jobs', 'success');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  return (
    <div className="jp-container jp-page">
      <div className="jp-page-head">
        <div>
          <h1 className="jp-display">Saved jobs</h1>
          <p className="jp-sm jp-muted">{isPending ? 'Loading…' : `${data?.length || 0} saved`}</p>
        </div>
      </div>

      {isPending && <JobRowSkeletonList count={3} />}

      {isError && !isPending && (
        <EmptyState title="Could not load saved jobs" body={errorMessage(error)}
          action={<Button variant="primary" onClick={() => refetch()}>Retry</Button>} />
      )}

      {!isPending && !isError && data.length === 0 && (
        <EmptyState
          title="Nothing saved yet"
          body="Save a job from the listing or its detail page and it will wait for you here."
          action={<Button variant="primary" onClick={() => navigate('/jobs')}>Browse jobs</Button>}
        />
      )}

      {!isPending && !isError && data.length > 0 && (
        <div className="jp-list">
          {data.map((saved) => saved.jobPost && (
            <JobRow
              key={saved.id}
              job={saved.jobPost}
              saved
              onToggleSave={(job) => unsave.mutate(job.postId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- recommendations */
export function Recommendations() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['recommended-jobs'],
    queryFn: () => aiService.getRecommendedJobs(50),
  });

  const autoApply = useMutation({
    mutationFn: () => aiService.autoApply(70),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      toast(`Applied to ${result.applicationsSubmitted} of ${result.matchesFound} matches`, 'success');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  return (
    <div className="jp-container jp-page">
      <div className="jp-page-head">
        <div>
          <h1 className="jp-display">Recommended</h1>
          <p className="jp-sm jp-muted">Scored against the skills and experience on your profile.</p>
        </div>
        <Button onClick={() => autoApply.mutate()} disabled={autoApply.isPending}>
          {autoApply.isPending ? 'Applying…' : 'Auto-apply above 70%'}
        </Button>
      </div>

      {isPending && <JobRowSkeletonList count={4} />}

      {isError && !isPending && (
        <EmptyState title="Could not load recommendations" body={errorMessage(error)}
          action={<Button variant="primary" onClick={() => refetch()}>Retry</Button>} />
      )}

      {!isPending && !isError && data.length === 0 && (
        <EmptyState
          title="No matches above 50% yet"
          body="Matching uses the skills on your profile. Adding a few more usually surfaces roles."
          action={<Button variant="primary" onClick={() => navigate('/profile')}>Edit profile</Button>}
        />
      )}

      {!isPending && !isError && data.length > 0 && (
        <div className="jp-list">
          {data.map((match) => match.jobPost && (
            <JobRow
              key={match.id}
              job={match.jobPost}
              trailing={
                <div className="jp-jobrow__side">
                  <Badge tone={match.score >= 75 ? 'success' : match.score >= 50 ? 'warning' : 'neutral'}>
                    {Math.round(match.score)}% match
                  </Badge>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
