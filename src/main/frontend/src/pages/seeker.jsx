import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, Globe, MapPin, Minus } from 'lucide-react';
import { ApplicationTimeline } from '../components/ApplicationTimeline';
import * as jobService from '../services/jobService';
import * as aiService from '../services/aiService';
import { errorMessage } from '../services/api';
import { JobRow, JobRowSkeletonList } from '../components/JobRow';
import { Button, EmptyState, Modal, Skeleton } from '../components/ui';
import { Fact, Facts, Monogram, PageHead, ResponseClock, Stat, StatGroup, StageTrack } from '../components/ui/kit';
import { useToast } from '../components/ui/toast-context';
import { fullDate, relativeDate } from '../lib/format';
import './pages.css';
import './seeker.css';

const DAY = 86400000;
const companyOf = (job) => job?.company?.name || job?.postedBy?.fullName || '';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Days the employer took to answer, counted the way the clock counts them. */
const daysToAnswer = (app) =>
  Math.max(1, Math.floor((new Date(app.respondedAt) - new Date(app.appliedDate)) / DAY) + 1);

/* What needs attention first: the clocks still running, then the conversations
   that are moving (furthest along first), then everything that has ended. */
const STAGE_ORDER = ['PENDING', 'REVIEWED', 'INTERVIEW', 'OFFERED'];
const SECTIONS = [
  {
    key: 'waiting',
    title: 'Waiting for an answer',
    sub: 'The employer’s 14 days are running. Closest deadline first.',
    has: (a) => a.status === 'PENDING',
    sort: (a, b) => new Date(a.respondBy) - new Date(b.respondBy),
  },
  {
    key: 'progress',
    title: 'In progress',
    sub: 'The employer has answered and the conversation is moving.',
    has: (a) => ['REVIEWED', 'INTERVIEW', 'OFFERED'].includes(a.status),
    sort: (a, b) => STAGE_ORDER.indexOf(b.status) - STAGE_ORDER.indexOf(a.status),
  },
  {
    key: 'closed',
    title: 'Closed',
    sub: 'Hired, not selected, withdrawn, or left without an answer.',
    has: () => true,
    sort: (a, b) => new Date(b.appliedDate) - new Date(a.appliedDate),
  },
];

function sectionsFor(apps) {
  const left = [...apps];
  return SECTIONS.map((s) => {
    const items = left.filter(s.has).sort(s.sort);
    items.forEach((a) => left.splice(left.indexOf(a), 1));
    return { ...s, items };
  }).filter((s) => s.items.length);
}

function Summary({ apps }) {
  const waiting = apps.filter((a) => a.status === 'PENDING');
  const answered = apps.filter((a) => a.respondedAt);
  const lapsed = apps.filter((a) => a.status === 'NO_RESPONSE');
  const nextDue = waiting.map((a) => a.respondBy).filter(Boolean).sort()[0];
  const avg = answered.length ? answered.reduce((n, a) => n + daysToAnswer(a), 0) / answered.length : null;

  return (
    <div className="jp-apps__summary">
      <StatGroup>
        <Stat label="Waiting for an answer" value={waiting.length}
          hint={nextDue ? `Next one due ${fullDate(nextDue)}` : 'No clocks running'} />
        <Stat label="Answered" value={answered.length} hint={`Of ${plural(apps.length, 'application')}`} tone="accent" />
        <Stat label="Average days to answer" value={avg == null ? '–' : Number(avg.toFixed(1))}
          hint={avg == null ? 'No answers yet' : 'Employers here promise 14 or fewer'} />
        <Stat label="Ran out of time" value={lapsed.length} tone={lapsed.length ? 'danger' : undefined}
          hint={lapsed.length ? 'Counted against those employers' : 'Every employer answered in time'} />
      </StatGroup>
    </div>
  );
}

function AnswerCell({ app }) {
  if (app.status === 'WITHDRAWN' && !app.respondedAt) {
    return <p className="jp-sm jp-muted">You withdrew before the employer answered.</p>;
  }
  const caption = app.respondedAt
    ? `First answer ${fullDate(app.respondedAt)}`
    : app.status === 'NO_RESPONSE' ? `Was due ${fullDate(app.respondBy)}` : `Due ${fullDate(app.respondBy)}`;
  return (
    <>
      <ResponseClock appliedAt={app.appliedDate} respondBy={app.respondBy} respondedAt={app.respondedAt} status={app.status} />
      <p className="jp-sm jp-muted">{caption}</p>
    </>
  );
}

function ApplicationRow({ app, onWithdraw, busy }) {
  const job = app.jobPost || {};
  const company = companyOf(job);
  return (
    <li className="jp-app">
      <Monogram name={company} />
      <div className="jp-app__main">
        <h3 className="jp-h3 jp-app__title"><Link to={`/job/${job.postId}`}>{job.postProfile}</Link></h3>
        <p className="jp-app__company">{company}</p>
        <Facts className="jp-app__facts">
          {job.isRemote ? <Fact icon={Globe}>Remote</Fact> : job.location && <Fact icon={MapPin}>{job.location}</Fact>}
          <Fact icon={CalendarDays}>Applied {relativeDate(app.appliedDate)}</Fact>
        </Facts>
      </div>
      <div className="jp-app__track"><StageTrack status={app.status} /></div>
      <div className="jp-app__answer"><AnswerCell app={app} /></div>
      <div className="jp-app__actions">
        {app.nextStatuses?.length > 0 && (
          <Button size="sm" disabled={busy} onClick={() => onWithdraw(app)}
            aria-label={`Withdraw application for ${job.postProfile}`}>
            Withdraw
          </Button>
        )}
      </div>
      <div className="jp-app__history"><ApplicationTimeline applicationId={app.id} /></div>
    </li>
  );
}

function ApplicationsSkeleton() {
  return (
    <div aria-busy="true">
      <span className="jp-sr-only">Loading your applications</span>
      <div className="jp-apps__summary jp-apps__summary--skeleton">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}><Skeleton width="70%" height={11} /><Skeleton width={48} height={28} style={{ marginTop: 10 }} /></div>
        ))}
      </div>
      <Skeleton width={220} height={18} style={{ marginBottom: 16 }} />
      <ul className="jp-list jp-apps__list">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="jp-app">
            <Skeleton width={40} height={40} radius={6} />
            <div className="jp-app__main">
              <Skeleton width="70%" height={15} />
              <Skeleton width="40%" height={11} style={{ marginTop: 9 }} />
            </div>
            <div className="jp-app__track"><Skeleton width="100%" height={10} /></div>
            <div className="jp-app__answer"><Skeleton width={150} height={18} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------------------------------------- applications */
export function MyApplications() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['my-applications'],
    queryFn: jobService.getMyApplications,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [withdrawing, setWithdrawing] = useState(null);
  const withdraw = useMutation({
    mutationFn: (applicationId) => jobService.withdrawApplication(applicationId),
    onSuccess: (_r, applicationId) => {
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-timeline', applicationId] });
      setWithdrawing(null);
      toast('Application withdrawn', 'success');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const apps = data || [];
  const sub = isPending ? 'Loading…'
    : isError ? null
      : apps.length ? `${plural(apps.length, 'application')} sent. Each employer has 14 days to answer you.` : null;

  return (
    <div className="jp-container jp-page jp-apps">
      <PageHead title="Applications" sub={sub}>
        {apps.length > 0 && <Link to="/recommendations" className="jp-btn jp-btn--secondary">Jobs matched to my skills</Link>}
      </PageHead>

      {isPending && <ApplicationsSkeleton />}

      {isError && !isPending && (
        <EmptyState title="Could not load your applications" body={errorMessage(error)}
          action={<Button variant="primary" onClick={() => refetch()}>Try again</Button>} />
      )}

      {!isPending && !isError && apps.length === 0 && (
        <div className="jp-apps__empty">
          <h2 className="jp-h2">You have not applied to anything yet</h2>
          <p className="jp-muted">
            When you apply, the employer’s 14-day clock starts. Every application you send is tracked here
            until you get an answer.
          </p>
          <div className="jp-row-actions">
            <Link className="jp-btn jp-btn--primary" to="/jobs">Browse jobs</Link>
            <Link className="jp-btn jp-btn--secondary" to="/recommendations">See jobs matched to my skills</Link>
          </div>
        </div>
      )}

      {!isPending && !isError && apps.length > 0 && (
        <>
          <Summary apps={apps} />
          {sectionsFor(apps).map((section) => (
            <section key={section.key} className="jp-apps__section" aria-labelledby={`apps-${section.key}`}>
              <div className="jp-apps__head">
                <h2 className="jp-h2" id={`apps-${section.key}`}>
                  {section.title} <span className="jp-apps__count">{section.items.length}</span>
                </h2>
                <p className="jp-sm jp-muted">{section.sub}</p>
              </div>
              <ul className={`jp-list jp-apps__list jp-apps__list--${section.key}`}>
                {section.items.map((app) => (
                  <ApplicationRow key={app.id} app={app} onWithdraw={setWithdrawing} busy={withdraw.isPending} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <Modal
        open={Boolean(withdrawing)}
        onOpenChange={(open) => !open && setWithdrawing(null)}
        title="Withdraw this application?"
        description={withdrawing && `${withdrawing.jobPost?.postProfile} at ${companyOf(withdrawing.jobPost)}`}
        footer={
          <>
            <Button onClick={() => setWithdrawing(null)}>Keep it</Button>
            <Button variant="danger" disabled={withdraw.isPending} onClick={() => withdraw.mutate(withdrawing.id)}>
              {withdraw.isPending ? 'Withdrawing…' : 'Withdraw'}
            </Button>
          </>
        }
      >
        <p className="jp-sm">
          The employer stops seeing it and its clock stops. This cannot be undone, and you cannot apply to
          the same posting again.
        </p>
      </Modal>
    </div>
  );
}

/** The server accepts at most this many postings in one bulk application. */
const MAX_PICKS = 5;

/* ----------------------------------------------------------------- saved jobs */
export function SavedJobs() {
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

  const saved = (data || []).filter((s) => s.jobPost);
  const sub = isPending ? 'Loading…' : isError ? null
    : saved.length ? `${plural(saved.length, 'job')} you kept for later. Pay is shown on every one.` : null;

  return (
    <div className="jp-container jp-page">
      <PageHead title="Saved jobs" sub={sub}>
        {saved.length > 0 && <Link to="/jobs" className="jp-btn jp-btn--secondary">Browse more jobs</Link>}
      </PageHead>

      {isPending && <JobRowSkeletonList count={3} />}

      {isError && !isPending && (
        <EmptyState title="Could not load saved jobs" body={errorMessage(error)}
          action={<Button variant="primary" onClick={() => refetch()}>Try again</Button>} />
      )}

      {!isPending && !isError && saved.length === 0 && (
        <EmptyState
          title="Nothing saved yet"
          body="Use Save on any job in the listing or on its page, and it waits for you here until you are ready to apply."
          action={<Link className="jp-btn jp-btn--primary" to="/jobs">Browse jobs</Link>}
        />
      )}

      {!isPending && !isError && saved.length > 0 && (
        <div className="jp-list" aria-live="polite">
          {saved.map((s) => (
            <JobRow key={s.id} job={s.jobPost} saved onToggleSave={(job) => unsave.mutate(job.postId)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- recommendations */
function MatchWhy({ match }) {
  const have = match.matchedSkills || [];
  const missing = match.missingSkills || [];
  const total = have.length + missing.length;
  return (
    <div className="jp-match__why">
      <p className="jp-match__score">
        <strong>{Math.round(match.score)}%</strong> match
      </p>
      <div className="jp-match__skills">
        <p className="jp-sm jp-match__reason">
          {total
            ? missing.length
              ? `You have ${have.length} of the ${total} skills this role asks for.`
              : `You have all ${total} skills this role asks for.`
            : 'Scored on your experience; this role lists no skills.'}
        </p>
        {total > 0 && (
          <ul className="jp-match__chips" aria-label="Skills compared with your profile">
            {have.map((s) => (
              <li key={s} className="jp-skill jp-skill--have">
                <Check size={12} aria-hidden="true" />{s}<span className="jp-sr-only"> (on your profile)</span>
              </li>
            ))}
            {missing.map((s) => (
              <li key={s} className="jp-skill jp-skill--missing">
                <Minus size={12} aria-hidden="true" />{s}<span className="jp-sr-only"> (missing from your profile)</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function Recommendations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['recommended-jobs'],
    queryFn: () => aiService.getRecommendedJobs(50),
  });

  // The seeker ticks the roles they actually want; nothing is applied to on their behalf.
  const [picked, setPicked] = useState([]);
  const toggle = (jobId) => setPicked((ids) =>
    (ids.includes(jobId) ? ids.filter((id) => id !== jobId) : [...ids, jobId]));

  const applySelected = useMutation({
    mutationFn: () => jobService.applyToJobs(picked),
    onSuccess: ({ applied, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      setPicked([]);
      const failed = Object.values(skipped);
      toast(
        failed.length
          ? `Applied to ${applied.length}. ${failed.length} skipped: ${failed[0]}`
          : `Applied to ${applied.length} ${applied.length === 1 ? 'job' : 'jobs'}`,
        applied.length ? 'success' : 'error',
      );
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const matches = (data || []).filter((m) => m.jobPost);
  const full = picked.length >= MAX_PICKS;
  const status = picked.length === 0
    ? `Select up to ${MAX_PICKS} roles to apply to them together.`
    : full
      ? `${MAX_PICKS} of ${MAX_PICKS} selected, the most you can send at once.`
      : `${picked.length} of ${MAX_PICKS} selected.`;

  return (
    <div className="jp-container jp-page jp-recs">
      <PageHead
        title="Recommended for you"
        sub="Scored against the skills and experience on your profile. Each match shows which skills you have and which you are missing."
      />

      {isPending && <JobRowSkeletonList count={4} />}

      {isError && !isPending && (
        <EmptyState title="Could not load recommendations" body={errorMessage(error)}
          action={<Button variant="primary" onClick={() => refetch()}>Try again</Button>} />
      )}

      {!isPending && !isError && matches.length === 0 && (
        <EmptyState
          title="No roles match 50% of your skills yet"
          body="Matching compares the skills on your profile with each job’s tech stack. Adding a few more usually surfaces roles."
          action={<Link className="jp-btn jp-btn--primary" to="/profile">Add skills to my profile</Link>}
        />
      )}

      {!isPending && !isError && matches.length > 0 && (
        <>
          <ul className="jp-list jp-recs__list">
            {matches.map((match) => {
              const id = match.jobPost.postId;
              const on = picked.includes(id);
              return (
                <li key={match.id} className={on ? 'jp-match jp-match--picked' : 'jp-match'}>
                  <JobRow
                    job={match.jobPost}
                    trailing={
                      <label className={on ? 'jp-pickbox jp-pickbox--on' : 'jp-pickbox'}>
                        <input type="checkbox" checked={on} disabled={!on && full} onChange={() => toggle(id)}
                          aria-label={`Select ${match.jobPost.postProfile} to apply`} />
                        <span aria-hidden="true">{on ? 'Selected' : 'Select'}</span>
                      </label>
                    }
                  />
                  <MatchWhy match={match} />
                </li>
              );
            })}
          </ul>

          <div className={picked.length ? 'jp-pickbar jp-pickbar--active' : 'jp-pickbar'}>
            <p className="jp-sm" aria-live="polite">
              <span className="jp-pickbar__dots" aria-hidden="true">
                {Array.from({ length: MAX_PICKS }, (_, i) => <i key={i} className={i < picked.length ? 'on' : undefined} />)}
              </span>
              {status}
            </p>
            <div className="jp-row-actions">
              {picked.length > 0 && <Button variant="ghost" onClick={() => setPicked([])}>Clear</Button>}
              <Button variant="primary" onClick={() => applySelected.mutate()}
                disabled={picked.length === 0 || applySelected.isPending}>
                {applySelected.isPending ? 'Applying…' : `Apply to selected (${picked.length})`}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
