import React, { useContext, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import {
  AlertTriangle, Ban, Briefcase, CheckCircle2, ChevronRight, CircleDot, Clock, Eye, FileText, Globe, Hourglass, MailWarning,
  MapPin, Pencil, Trash2, Users, X, XCircle,
} from 'lucide-react';
import * as jobService from '../services/jobService';
import * as dashboardService from '../services/dashboardService';
import { errorMessage } from '../services/api';
import { AuthContext } from '../context/auth-context';
import { Button, EmptyState, IconButton, Input, Modal, Select, Skeleton, Textarea } from '../components/ui';
import {
  Fact, Facts, Monogram, PageHead, ResponseClock, SegmentBar, Stat, StatGroup,
} from '../components/ui/kit';
import { useToast } from '../components/ui/toast-context';
import { JobRow } from '../components/JobRow';
import { ApplicationTimeline } from '../components/ApplicationTimeline';
import { JOB_TYPES, fullDate, jobTypeLabel, relativeDate, salaryRange } from '../lib/format';
import './pages.css';
import './employer.css';

const DAY = 86400000;
const cx = (...parts) => parts.filter(Boolean).join(' ');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* Where an application stands, in the words an employer would use. */
const STAGE = {
  PENDING: 'Waiting for an answer',
  REVIEWED: 'Reviewed',
  INTERVIEW: 'Interviewing',
  OFFERED: 'Offer made',
  ACCEPTED: 'Hired',
  REJECTED: 'Not selected',
  WITHDRAWN: 'Withdrawn',
  NO_RESPONSE: 'Went unanswered',
};

/* What each move does, said as the button says it. */
const MOVE = {
  REVIEWED: 'Mark reviewed',
  INTERVIEW: 'Invite to interview',
  OFFERED: 'Make an offer',
  ACCEPTED: 'Mark as hired',
  REJECTED: 'Reject',
};
const CONFIRM = {
  REVIEWED: (n) => `Mark ${n} as reviewed?`,
  INTERVIEW: (n) => `Invite ${n} to interview?`,
  OFFERED: (n) => `Make ${n} an offer?`,
  ACCEPTED: (n) => `Mark ${n} as hired?`,
  REJECTED: (n) => `Reject ${n}?`,
};

/** A posting's moderation state, as the employer needs to read it. */
function postingState(job) {
  if (job.status === 'PENDING_REVIEW') {
    return { key: 'review', label: 'In review', icon: Hourglass, note: 'Candidates cannot see it until a reviewer approves it.' };
  }
  if (job.status === 'REJECTED') return { key: 'refused', label: 'Not approved', icon: XCircle };
  if (job.status === 'SUSPENDED') return { key: 'refused', label: 'Suspended', icon: Ban };
  if (job.isActive === false) return { key: 'closed', label: 'Closed', icon: CircleDot };
  return { key: 'live', label: 'Live', icon: CheckCircle2 };
}

function PostingState({ job }) {
  const state = postingState(job);
  return (
    <span className={`jp-pstate jp-pstate--${state.key}`}>
      {React.createElement(state.icon, { size: 14, 'aria-hidden': true })}
      {state.label}
    </span>
  );
}

/* -------------------------------------------------------------------- dashboard */

/** The employer's own record, which is what candidates see on every posting. */
function AnswerRecord({ record, waiting, lapsed, loading }) {
  // Sample dates for the "typical answer" clock, read once so render stays pure.
  const [start] = useState(() => Date.now() - 14 * DAY);
  const rate = record?.responseRatePercent;
  const median = record?.medianDays;
  const days = median == null ? null : Math.max(1, Math.ceil(median));

  return (
    <section className="jp-record" aria-labelledby="record-title">
      <div className="jp-record__intro">
        <h2 id="record-title" className="jp-h2">Your answer record</h2>
        <p className="jp-sm jp-muted">
          Candidates see this on every posting before they apply. It covers the last 90 days.
        </p>
      </div>

      {loading ? (
        <div className="jp-record__figures"><Skeleton width="80%" height={56} /></div>
      ) : (
        <dl className="jp-record__figures">
          <div className="jp-record__fig">
            <dt>Answered on time</dt>
            <dd className={cx('jp-record__num', rate == null && 'jp-record__num--none')}>{rate == null ? 'No record yet' : `${rate}%`}</dd>
            <dd className="jp-sm jp-muted">
              {rate == null
                ? `Shown once 5 applications have an outcome (${record?.sampleSize ?? 0} so far).`
                : `Of ${plural(record.sampleSize, 'application')} with an outcome.`}
            </dd>
          </div>
          <div className="jp-record__fig">
            <dt>Typical first answer</dt>
            <dd className={cx('jp-record__num', days == null && 'jp-record__num--none')}>{days == null ? 'Not yet' : plural(days, 'day')}</dd>
            <dd>
              {days == null ? (
                <span className="jp-sm jp-muted">Answer your first few applicants to start it.</span>
              ) : (
                <ResponseClock
                  size="sm"
                  appliedAt={new Date(start).toISOString()}
                  respondBy={new Date(start + 14 * DAY).toISOString()}
                  respondedAt={new Date(start + (days - 1) * DAY).toISOString()}
                  status="REVIEWED"
                />
              )}
            </dd>
          </div>
          <div className={cx('jp-record__fig', waiting > 0 && 'jp-record__fig--due')}>
            <dt>Waiting for you now</dt>
            <dd className="jp-record__num">{waiting}</dd>
            <dd className="jp-record__act">
              {waiting > 0
                ? <Link to="/manage-applications" className="jp-btn jp-btn--primary jp-btn--sm">Answer candidates</Link>
                : <span className="jp-sm jp-muted">Nobody is waiting. Good.</span>}
              {lapsed > 0 && (
                <span className="jp-sm jp-record__lapsed">
                  <AlertTriangle size={14} aria-hidden="true" />
                  {plural(lapsed, 'application')} went unanswered
                </span>
              )}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

const PIPELINE = [
  ['PENDING', 'Waiting', 'signal'],
  ['REVIEWED', 'Reviewed', 'neutral'],
  ['INTERVIEW', 'Interviewing', 'accent'],
  ['OFFERED', 'Offer made', 'success'],
  ['ACCEPTED', 'Hired', 'success'],
  ['REJECTED', 'Not selected', 'neutral'],
  ['WITHDRAWN', 'Withdrawn', 'neutral'],
  ['NO_RESPONSE', 'Unanswered', 'danger'],
];

function PostingRow({ job, onRemove }) {
  const state = postingState(job);
  const reason = job.moderationReason;
  return (
    <li className={cx('jp-posting', `jp-posting--${state.key}`)}>
      <div className="jp-posting__main">
        <h3 className="jp-h3">
          <Link to={`/job/${job.postId}`}>{job.postProfile}</Link>
        </h3>
        <Facts>
          <Fact icon={job.isRemote ? Globe : MapPin}>{job.isRemote ? 'Remote' : job.location || 'No location'}</Fact>
          <Fact icon={Briefcase}>{jobTypeLabel(job.jobType)}</Fact>
          <Fact>Posted {relativeDate(job.postedDate)}</Fact>
        </Facts>
      </div>
      <div className="jp-posting__state"><PostingState job={job} /></div>
      <div className="jp-posting__pay">
        <span className={cx('jp-data', job.salaryMin == null && job.salaryMax == null && 'jp-muted')}>
          {salaryRange(job.salaryMin, job.salaryMax)}
        </span>
      </div>
      <div className="jp-posting__views">
        <span className="jp-data">{(job.viewCount ?? 0).toLocaleString('en-IN')}</span>
        <span className="jp-sm jp-muted"> views</span>
      </div>
      <div className="jp-posting__actions">
        <Link to={`/post-job/${job.postId}`} className="jp-btn jp-btn--secondary jp-btn--sm">
          <Pencil size={14} aria-hidden="true" />Edit
        </Link>
        <IconButton label={`Close or delete ${job.postProfile}`} onClick={() => onRemove(job)}>
          <Trash2 size={15} aria-hidden="true" />
        </IconButton>
      </div>
      {state.key === 'review' && <p className="jp-posting__note jp-sm">{state.note}</p>}
      {state.key === 'refused' && (
        <div className="jp-posting__reason jp-sm">
          <p><strong>Reviewer’s reason:</strong> {reason || 'No reason was recorded.'}</p>
          <p className="jp-muted">Edit the posting to address this and it goes back for review.</p>
        </div>
      )}
    </li>
  );
}

const FIRST_STEPS = [
  ['Post the role with its pay range', 'Every listing here shows pay, so candidates can tell in a glance whether it is for them.'],
  ['A reviewer checks it before it goes live', 'You are told straight away if anything needs changing.'],
  ['Answer each applicant within 14 days', 'A yes, a no or a next step all count. Your on-time rate appears on every posting.'],
];

export function EmployerDashboard() {
  const { user } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingRemove, setPendingRemove] = useState(null);

  const stats = useQuery({ queryKey: ['dashboard'], queryFn: dashboardService.getEmployerDashboard, retry: false });
  const jobs = useQuery({ queryKey: ['my-jobs'], queryFn: jobService.getMyJobs });
  const record = useQuery({
    queryKey: ['responsiveness', user?.id],
    queryFn: () => jobService.getEmployerResponsiveness(user.id),
    enabled: Boolean(user?.id),
    retry: false,
  });

  const remove = useMutation({
    mutationFn: (jobId) => jobService.deleteJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setPendingRemove(null);
      toast('Posting taken down', 'success');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const byStatus = stats.data?.applicationsByStatus || {};
  const list = jobs.data || [];
  const live = list.filter((j) => postingState(j).key === 'live').length;
  const inReview = list.filter((j) => postingState(j).key === 'review').length;
  const refused = list.filter((j) => postingState(j).key === 'refused').length;
  const isNew = !jobs.isPending && !jobs.isError && list.length === 0;
  const value = (n) => (stats.isPending ? '–' : (n ?? 0).toLocaleString('en-IN'));

  return (
    <div className="jp-container jp-page">
      <PageHead title="Dashboard" sub="Your postings, the candidates they drew, and how quickly you answer them.">
        {!isNew && <Link to="/manage-applications" className="jp-btn jp-btn--secondary">Review candidates</Link>}
        <Link to="/post-job" className="jp-btn jp-btn--primary">Post a job</Link>
      </PageHead>

      <AnswerRecord
        record={record.data}
        loading={record.isPending && Boolean(user?.id)}
        waiting={byStatus.PENDING || 0}
        lapsed={byStatus.NO_RESPONSE || 0}
      />

      {isNew ? (
        <section className="jp-firstrun" aria-labelledby="firstrun-title">
          <div>
            <h2 id="firstrun-title" className="jp-h1">Post your first role</h2>
            <p className="jp-muted">
              It takes a few minutes. Once it is live, applications arrive here and on the Candidates page,
              each with its own 14-day clock.
            </p>
            <Link to="/post-job" className="jp-btn jp-btn--primary jp-btn--lg">Post a job</Link>
          </div>
          <ol className="jp-firstrun__steps">
            {FIRST_STEPS.map(([title, body]) => (
              <li key={title}>
                <p className="jp-h3">{title}</p>
                <p className="jp-sm jp-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <>
          <div className="jp-dash__kpis">
            <StatGroup>
              <Stat label="Live postings" value={jobs.isPending ? '–' : live}
                hint={inReview || refused ? [inReview && `${inReview} in review`, refused && `${refused} not approved`].filter(Boolean).join(', ') : `of ${list.length} in total`} />
              <Stat label="Applications" value={value(stats.data?.totalApplications)} hint="Across all your postings" />
              <Stat label="In interviews" value={value(byStatus.INTERVIEW)} tone={byStatus.INTERVIEW ? 'accent' : undefined} />
              <Stat label="Hired" value={value(byStatus.ACCEPTED)} hint={byStatus.OFFERED ? `${byStatus.OFFERED} offer${byStatus.OFFERED === 1 ? '' : 's'} out` : undefined} />
              <Stat label="Views of your postings" value={value(stats.data?.totalViews)} />
            </StatGroup>
          </div>

          <div className="jp-dash__grid">
            <section className="jp-dash__postings" aria-labelledby="postings-title">
              <div className="jp-dash__head">
                <h2 id="postings-title" className="jp-h2">Your postings</h2>
                {!jobs.isPending && <span className="jp-sm jp-muted">{plural(list.length, 'posting')}</span>}
              </div>

              {jobs.isPending && (
                <div className="jp-postings" aria-busy="true">
                  {[0, 1, 2].map((i) => <div key={i} className="jp-posting"><Skeleton width="60%" height={16} /></div>)}
                </div>
              )}
              {jobs.isError && (
                <EmptyState title="Could not load your postings" body={errorMessage(jobs.error)}
                  action={<Button variant="primary" onClick={() => jobs.refetch()}>Try again</Button>} />
              )}
              {!jobs.isPending && !jobs.isError && (
                <ul className="jp-postings">
                  {list.map((job) => <PostingRow key={job.postId} job={job} onRemove={setPendingRemove} />)}
                </ul>
              )}
            </section>

            <aside className="jp-dash__pipeline" aria-labelledby="pipeline-title">
              <h2 id="pipeline-title" className="jp-h2">Where candidates stand</h2>
              {stats.isPending && <Skeleton width="100%" height={10} />}
              {stats.isError && <p className="jp-sm jp-muted">{errorMessage(stats.error)}</p>}
              {stats.data && (stats.data.totalApplications ? (
                <>
                  <SegmentBar
                    label="Applications by stage"
                    segments={PIPELINE.map(([key, label, tone]) => ({ label, tone, value: byStatus[key] || 0 }))}
                  />
                  <p className="jp-sm jp-muted">
                    {byStatus.PENDING
                      ? `${plural(byStatus.PENDING, 'candidate is', 'candidates are')} waiting for a first answer. Each one counts against your record if their 14 days run out.`
                      : 'Everyone who applied has had a first answer.'}
                  </p>
                </>
              ) : (
                <p className="jp-sm jp-muted">No applications yet. Stages fill in as candidates apply and you answer them.</p>
              ))}
              <Link to="/manage-applications" className="jp-btn jp-btn--secondary jp-btn--block">
                <Users size={15} aria-hidden="true" />Open candidates
              </Link>
            </aside>
          </div>
        </>
      )}

      <Modal
        open={Boolean(pendingRemove)}
        onOpenChange={(open) => !open && setPendingRemove(null)}
        title="Take this posting down?"
        description={pendingRemove ? `“${pendingRemove.postProfile}” will leave the listing straight away.` : ''}
        footer={
          <>
            <Button onClick={() => setPendingRemove(null)}>Keep it</Button>
            <Button variant="danger" onClick={() => remove.mutate(pendingRemove.postId)} disabled={remove.isPending}>
              {remove.isPending ? 'Taking down…' : 'Take down posting'}
            </Button>
          </>
        }
      >
        <ul className="jp-consequences jp-sm">
          <li><strong>If anyone has applied,</strong> the posting is closed rather than deleted, so their history is kept.
            Everyone still waiting or in progress is answered “Position closed” and notified.</li>
          <li><strong>If nobody has applied,</strong> it is deleted for good.</li>
        </ul>
      </Modal>
    </div>
  );
}

/* ---------------------------------------------------------- manage applications */

/** Opens the resume in a new tab. The endpoint needs the auth header, so a plain link cannot. */
function useResume() {
  const { toast } = useToast();
  return async (app) => {
    const tab = window.open('', '_blank'); // opened synchronously so the browser does not block it
    try {
      const blob = await dashboardService.getApplicantResume(app.id);
      const url = URL.createObjectURL(blob);
      if (tab) tab.location.href = url; else window.location.assign(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      tab?.close();
      toast(err.response?.status === 404
        ? `${app.applicant?.fullName || 'This candidate'} has not uploaded a resume.`
        : errorMessage(err, 'Could not open the resume.'), 'error');
    }
  };
}

function CoverLetter({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return <p className="jp-sm jp-muted jp-cand__letter">No cover letter.</p>;
  const long = text.length > 160;
  return (
    <div className="jp-cand__letter">
      <p className={cx('jp-sm', long && !open && 'jp-cand__clamp')}>{text}</p>
      {long && (
        <button type="button" className="jp-textbtn jp-sm" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Show less' : 'Read cover letter'}
        </button>
      )}
    </div>
  );
}

function Candidate({ app, onMove, onResume, wide }) {
  const person = app.applicant || {};
  const waiting = app.status === 'PENDING' || app.status === 'NO_RESPONSE';
  const moves = app.nextStatuses || [];
  return (
    <article className={cx('jp-cand', wide && 'jp-cand--wide')} aria-label={person.fullName}>
      <div className="jp-cand__who">
        <Monogram name={person.fullName || '?'} size="sm" />
        <div>
          <h3 className="jp-h3">{person.fullName}</h3>
          {person.currentJobTitle && <p className="jp-sm jp-muted">{person.currentJobTitle}</p>}
          <p className="jp-sm jp-muted" title={fullDate(app.appliedDate)}>Applied {relativeDate(app.appliedDate)}</p>
        </div>
      </div>

      <CoverLetter text={app.coverLetter} />

      <div className="jp-cand__side">
        {waiting && (
          <ResponseClock appliedAt={app.appliedDate} respondBy={app.respondBy} respondedAt={app.respondedAt} status={app.status} />
        )}
        {moves.length > 0 && (
          <div className="jp-cand__moves">
            {moves.map((status) => (
              <Button key={status} size="sm"
                variant={status === 'REJECTED' ? 'ghost' : waiting || moves.length === 1 ? 'primary' : 'secondary'}
                onClick={() => onMove({ app, status })}>
                {MOVE[status] || status}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="jp-cand__foot">
        <button type="button" className="jp-textbtn jp-sm" onClick={() => onResume(app)}>
          <FileText size={14} aria-hidden="true" />Resume
        </button>
        <ApplicationTimeline applicationId={app.id} />
      </div>
    </article>
  );
}

const IN_PROGRESS = ['REVIEWED', 'INTERVIEW', 'OFFERED'];
const CLOSED = ['ACCEPTED', 'REJECTED', 'WITHDRAWN'];

export function ManageApplications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const openResume = useResume();
  const [jobId, setJobId] = useState('');

  const jobs = useQuery({ queryKey: ['my-jobs'], queryFn: jobService.getMyJobs });
  const selected = jobId || jobs.data?.[0]?.postId || '';
  const selectedJob = jobs.data?.find((j) => String(j.postId) === String(selected));

  const applications = useQuery({
    queryKey: ['applications', selected],
    queryFn: () => jobService.getApplicationsForJob(selected),
    enabled: Boolean(selected),
  });

  // A move cannot be undone, so each one is confirmed, with room for a note to the candidate.
  const [move, setMove] = useState(null); // { app, status }
  const [note, setNote] = useState('');
  const closeMove = () => { setMove(null); setNote(''); };

  const setStatus = useMutation({
    mutationFn: ({ applicationId, status }) =>
      jobService.updateApplicationStatus(applicationId, status, note.trim() || undefined),
    onSuccess: (_r, { applicationId, status }) => {
      queryClient.invalidateQueries({ queryKey: ['applications', selected] });
      queryClient.invalidateQueries({ queryKey: ['application-timeline', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast(`${move?.app.applicant?.fullName || 'Candidate'}: ${STAGE[status] || status}`, 'success');
      closeMove();
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const all = applications.data || [];
  // Waiting first, the one closest to its deadline on top; lapsed ones are already past it.
  const waiting = all.filter((a) => a.status === 'PENDING' || a.status === 'NO_RESPONSE')
    .sort((a, b) => new Date(a.respondBy) - new Date(b.respondBy));
  const stages = IN_PROGRESS.map((s) => [s, all.filter((a) => a.status === s)]);
  const closed = all.filter((a) => CLOSED.includes(a.status));
  const inProgress = stages.reduce((n, [, l]) => n + l.length, 0);
  const props = { onMove: setMove, onResume: openResume };

  const name = move?.app.applicant?.fullName || 'this candidate';

  return (
    <div className="jp-container jp-page">
      <PageHead title="Candidates" sub="Answer the people waiting first. Each has a 14-day clock, and your record shows on every posting." />

      {jobs.isPending && <Skeleton width={320} height={40} />}
      {jobs.isError && (
        <EmptyState title="Could not load your postings" body={errorMessage(jobs.error)}
          action={<Button variant="primary" onClick={() => jobs.refetch()}>Try again</Button>} />
      )}

      {!jobs.isPending && !jobs.isError && (jobs.data?.length || 0) === 0 && (
        <EmptyState
          title="No postings yet"
          body="Candidates appear here once you have a live posting and people apply to it."
          action={<Link to="/post-job" className="jp-btn jp-btn--primary">Post a job</Link>}
        />
      )}

      {!jobs.isPending && (jobs.data?.length || 0) > 0 && (
        <>
          <div className="jp-ma__bar">
            <div className="jp-ma__pick">
              <Select label="Posting" value={selected} onChange={(e) => setJobId(e.target.value)}>
                {jobs.data.map((job) => (
                  <option key={job.postId} value={job.postId}>{job.postProfile}</option>
                ))}
              </Select>
            </div>
            {selectedJob && (
              <Facts className="jp-ma__facts">
                <li className="jp-fact"><PostingState job={selectedJob} /></li>
                <Fact icon={Eye}>{(selectedJob.viewCount ?? 0).toLocaleString('en-IN')} views</Fact>
                {applications.data && <Fact icon={Users}>{plural(all.length, 'applicant')}</Fact>}
              </Facts>
            )}
          </div>

          {applications.isPending && <Skeleton width="100%" height={140} />}

          {applications.isError && (
            <EmptyState title="Could not load applications" body={errorMessage(applications.error)}
              action={<Button variant="primary" onClick={() => applications.refetch()}>Try again</Button>} />
          )}

          {applications.data && all.length === 0 && (
            <EmptyState
              title="Nobody has applied yet"
              body={selectedJob && postingState(selectedJob).key === 'review'
                ? 'This posting is still in review. Candidates can apply once a reviewer approves it.'
                : 'Sharing the job link is the quickest way to get the first few applicants.'}
            />
          )}

          {applications.data && all.length > 0 && (
            <div className="jp-ma" aria-live="polite">
              <section className="jp-ma__section" aria-labelledby="ma-waiting">
                <div className="jp-ma__head">
                  <h2 id="ma-waiting" className="jp-h2">Waiting for a first answer</h2>
                  <span className="jp-ma__count">{waiting.length}</span>
                  <p className="jp-sm jp-muted">Nearest deadline first.</p>
                </div>
                {waiting.length ? (
                  <div className="jp-ma__list">
                    {waiting.map((app) => <Candidate key={app.id} app={app} wide {...props} />)}
                  </div>
                ) : (
                  <p className="jp-ma__clear jp-sm">
                    <CheckCircle2 size={16} aria-hidden="true" />Everyone has had a first answer.
                  </p>
                )}
              </section>

              {inProgress > 0 && (
                <section className="jp-ma__section" aria-labelledby="ma-progress">
                  <div className="jp-ma__head">
                    <h2 id="ma-progress" className="jp-h2">In progress</h2>
                    <span className="jp-ma__count">{inProgress}</span>
                  </div>
                  <div className="jp-board">
                    {stages.map(([status, list]) => (
                      <section key={status} className="jp-board__col" aria-labelledby={`col-${status}`}>
                        <h3 id={`col-${status}`} className="jp-board__title">
                          {STAGE[status]} <span className="jp-ma__count">{list.length}</span>
                        </h3>
                        {list.length
                          ? list.map((app) => <Candidate key={app.id} app={app} {...props} />)
                          : <p className="jp-sm jp-muted jp-board__empty">Nobody at this stage.</p>}
                      </section>
                    ))}
                  </div>
                </section>
              )}

              {closed.length > 0 && (
                <details className="jp-ma__closed">
                  <summary>
                    <ChevronRight size={18} aria-hidden="true" className="jp-ma__chev" />
                    <span className="jp-h2">Closed</span>
                    <span className="jp-ma__count">{closed.length}</span>
                    <span className="jp-sm jp-muted">Hired, not selected or withdrawn</span>
                  </summary>
                  <ul className="jp-closedlist">
                    {closed.map((app) => (
                      <li key={app.id}>
                        <span className="jp-closedlist__name">{app.applicant?.fullName}</span>
                        <span className={cx('jp-sm', app.status === 'ACCEPTED' ? 'jp-closedlist__hired' : 'jp-muted')}>
                          {STAGE[app.status]}
                        </span>
                        <span className="jp-sm jp-muted">Applied {relativeDate(app.appliedDate)}</span>
                        <ApplicationTimeline applicationId={app.id} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        open={Boolean(move)}
        onOpenChange={(open) => !open && closeMove()}
        title={move ? CONFIRM[move.status]?.(name) || `Move ${name}?` : ''}
        description={`${name} is notified straight away. This cannot be undone.`}
        footer={
          <>
            <Button onClick={closeMove}>Cancel</Button>
            <Button
              variant={move?.status === 'REJECTED' ? 'danger' : 'primary'}
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ applicationId: move.app.id, status: move.status })}
            >
              {setStatus.isPending ? 'Saving…' : move ? MOVE[move.status] || 'Confirm' : 'Confirm'}
            </Button>
          </>
        }
      >
        <Textarea
          label="Note to the candidate"
          optional
          rows={3}
          maxLength={500}
          hint={move?.status === 'REJECTED' ? 'A sentence on why helps candidates more than a bare no.' : 'Next steps, times or anything they should prepare.'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Modal>
    </div>
  );
}

/* --------------------------------------------------------------------- post job */

const NEXT_STEPS = [
  ['A reviewer checks it', 'If something needs fixing you get the reason, and can edit and resend.'],
  ['It goes live', 'Candidates can find it, and each one who applies starts a 14-day clock.'],
  ['You answer each applicant', 'From the Candidates page. Answering on time is what keeps your record high.'],
];

function Section({ title, sub, children }) {
  return (
    <section className="jp-pj__sec">
      <div className="jp-pj__sechead">
        <h2 className="jp-h2">{title}</h2>
        {sub && <p className="jp-sm jp-muted">{sub}</p>}
      </div>
      <div className="jp-pj__secbody">{children}</div>
    </section>
  );
}

export function PostJob() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useContext(AuthContext);
  const [tech, setTech] = useState([]);
  const [techInput, setTechInput] = useState('');
  const [blocked, setBlocked] = useState(null); // the 403 message, when posting is not allowed yet
  const [openedAt] = useState(() => new Date().toISOString());

  const existing = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobService.getJobById(id),
    enabled: isEdit,
  });
  const companies = useQuery({ queryKey: ['my-companies'], queryFn: dashboardService.getMyCompanies, retry: false });

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm({
    mode: 'onBlur',
    defaultValues: {
      postProfile: '', postDesc: '', reqExperience: 0,
      location: '', jobType: 'FULL_TIME', isRemote: false,
      salaryMin: '', salaryMax: '', companyId: '',
    },
  });
  const values = useWatch({ control });

  React.useEffect(() => {
    if (existing.data) {
      reset({
        postProfile: existing.data.postProfile || '',
        postDesc: existing.data.postDesc || '',
        reqExperience: existing.data.reqExperience ?? 0,
        location: existing.data.location || '',
        jobType: existing.data.jobType || 'FULL_TIME',
        isRemote: Boolean(existing.data.isRemote),
        salaryMin: existing.data.salaryMin ?? '',
        salaryMax: existing.data.salaryMax ?? '',
        companyId: existing.data.company?.id ?? '',
      });
      setTech(existing.data.postTechStack || []);
    }
  }, [existing.data, reset]);

  const save = useMutation({
    mutationFn: (form) => {
      const payload = {
        ...form,
        reqExperience: Number(form.reqExperience) || 0,
        salaryMin: form.salaryMin === '' ? null : Number(form.salaryMin),
        salaryMax: form.salaryMax === '' ? null : Number(form.salaryMax),
        companyId: form.companyId === '' ? undefined : Number(form.companyId),
        postTechStack: tech,
        isActive: true,
      };
      return isEdit ? jobService.updateJob(id, payload) : jobService.createJob(payload);
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', String(job?.postId ?? id)] });
      toast(job?.status === 'PUBLISHED' ? 'Posting updated' : 'Sent for review. You will be notified when it is live.', 'success');
      navigate('/employer-dashboard');
    },
    onError: (err) => {
      if (err.response?.status === 403) setBlocked(errorMessage(err));
      else toast(errorMessage(err, 'Could not save the posting.'), 'error');
    },
  });

  const addTech = () => {
    const value = techInput.trim();
    if (value && !tech.includes(value)) setTech([...tech, value]);
    setTechInput('');
  };

  const num = (v) => (v === '' || v == null ? null : Number(v));
  const company = companies.data?.find((c) => String(c.id) === String(values.companyId));
  const preview = {
    postId: id || 0,
    postProfile: values.postProfile?.trim() || 'Job title',
    company: company ? { name: company.name } : null,
    postedBy: { fullName: user?.fullName || '' },
    salaryMin: num(values.salaryMin),
    salaryMax: num(values.salaryMax),
    location: values.location,
    isRemote: values.isRemote,
    jobType: values.jobType,
    reqExperience: num(values.reqExperience),
    postTechStack: tech,
    postedDate: openedAt,
  };
  const live = isEdit && existing.data?.status === 'PUBLISHED';

  if (isEdit && existing.isPending) {
    return <div className="jp-container jp-page"><Skeleton width={260} height={36} /><Skeleton width="100%" height={320} style={{ marginTop: 24 }} /></div>;
  }

  return (
    <div className="jp-container jp-page">
      <PageHead
        title={isEdit ? 'Edit posting' : 'Post a job'}
        sub={isEdit ? existing.data?.postProfile : 'A reviewer checks every posting before candidates see it.'}
      />

      {isEdit && existing.data && ['REJECTED', 'SUSPENDED'].includes(existing.data.status) && (
        <div className="jp-pj__notice jp-pj__notice--danger" role="note">
          <XCircle size={17} aria-hidden="true" />
          <div>
            <p><strong>{existing.data.status === 'REJECTED' ? 'Not approved' : 'Suspended'}.</strong> {existing.data.moderationReason}</p>
            <p className="jp-sm">Saving your changes sends it back for review.</p>
          </div>
        </div>
      )}

      <div className="jp-pj">
        <form className="jp-pj__form" onSubmit={handleSubmit((form) => { setBlocked(null); save.mutate(form); })} noValidate>
          <Section title="Role" sub="What the job is, in the words a candidate would search for.">
            <Input
              label="Job title"
              placeholder="Senior Backend Engineer"
              error={errors.postProfile?.message}
              {...register('postProfile', {
                required: 'A job title is required',
                minLength: { value: 3, message: 'Use at least 3 characters' },
              })}
            />
            <Textarea
              label="Description"
              rows={8}
              placeholder="What the role involves, the team, and what you expect from candidates."
              error={errors.postDesc?.message}
              {...register('postDesc')}
            />
            <div className="jp-pj__narrow">
              <Input
                label="Required experience (years)"
                type="number"
                min="0"
                error={errors.reqExperience?.message}
                {...register('reqExperience', { min: { value: 0, message: 'Experience cannot be negative' } })}
              />
            </div>
          </Section>

          <Section title="Pay" sub="Candidates here are promised a pay range. A posting without one shows “Pay not disclosed” in every list, and is opened far less.">
            <div className="jp-pj__pay">
              <Input
                label="Minimum (₹ per year)"
                type="number"
                min="0"
                step="10000"
                placeholder="1800000"
                hint={num(values.salaryMin) != null ? `Shows as ${salaryRange(values.salaryMin, null).replace('from ', '')}` : undefined}
                error={errors.salaryMin?.message}
                {...register('salaryMin', { min: { value: 0, message: 'Salary cannot be negative' } })}
              />
              <Input
                label="Maximum (₹ per year)"
                type="number"
                min="0"
                step="10000"
                placeholder="2400000"
                hint={num(values.salaryMax) != null ? `Shows as ${salaryRange(null, values.salaryMax).replace('up to ', '')}` : undefined}
                error={errors.salaryMax?.message}
                {...register('salaryMax', {
                  min: { value: 0, message: 'Salary cannot be negative' },
                  validate: (v, all) => v === '' || all.salaryMin === '' || Number(v) >= Number(all.salaryMin)
                    || 'The maximum must be at least the minimum',
                })}
              />
            </div>
          </Section>

          <Section title="Location and type">
            <div className="jp-pj__pair">
              <Input label="Location" placeholder="Pune" error={errors.location?.message} {...register('location')} />
              <Select label="Job type" {...register('jobType')}>
                {JOB_TYPES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </Select>
            </div>
            <label className="jp-pj__check">
              <input type="checkbox" {...register('isRemote')} />
              This role is remote
            </label>
          </Section>

          <Section title="Skills" sub="Used to match the posting to candidates’ profiles.">
            <div className="jp-field">
              <label className="jp-field__label" htmlFor="tech-input">Add a skill</label>
              <div className="jp-row">
                <input
                  id="tech-input"
                  className="jp-input"
                  value={techInput}
                  onChange={(e) => setTechInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTech(); } }}
                  placeholder="Type a skill and press Enter"
                />
                <Button onClick={addTech}>Add</Button>
              </div>
            </div>
            {tech.length > 0 ? (
              <ul className="jp-chips jp-pj__chips" aria-label="Skills added">
                {tech.map((t) => (
                  <li key={t} className="jp-chip">
                    {t}
                    <button type="button" aria-label={`Remove ${t}`} onClick={() => setTech(tech.filter((x) => x !== t))}>
                      <X size={13} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="jp-sm jp-muted">No skills yet.</p>}
          </Section>

          <Section title="Company" sub="The name candidates see on the listing.">
            {companies.data?.length ? (
              <Select label="List this posting under" {...register('companyId')}>
                <option value="">My name ({user?.fullName})</option>
                {companies.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            ) : (
              <p className="jp-sm jp-muted">
                {companies.isPending ? 'Loading your companies…' : `You have no company yet, so this is listed under your name, ${user?.fullName}.`}
              </p>
            )}
          </Section>

          <div className="jp-pj__submit">
            <ul className="jp-pj__terms jp-sm">
              <li><Hourglass size={15} aria-hidden="true" />
                {live
                  ? 'Changing what this posting says sends it back for review, and it leaves the listing until a reviewer approves it again.'
                  : 'A reviewer checks the posting before it goes live. You are notified either way.'}
              </li>
              <li><Clock size={15} aria-hidden="true" className="jp-pj__time" />
                Once it is live, you agree to answer every applicant within 14 days. Your on-time rate is shown on all your postings.
              </li>
            </ul>

            {blocked && (
              <div className="jp-pj__notice jp-pj__notice--danger" role="alert">
                <MailWarning size={17} aria-hidden="true" />
                <div>
                  <p><strong>You cannot post yet.</strong> {blocked.replace(/\.$/, '')}.</p>
                  <p className="jp-sm">Open the link in the email we sent you, or <Link to="/profile">check your account on your profile</Link>.</p>
                </div>
              </div>
            )}

            <div className="jp-row-actions">
              <Button type="submit" variant="primary" size="lg" disabled={isSubmitting || save.isPending}>
                {save.isPending ? 'Sending…' : isEdit ? 'Save changes' : 'Send for review'}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </div>
        </form>

        <aside className="jp-pj__aside" aria-label="Preview">
          <h2 className="jp-label">How it appears in the listing</h2>
          {/* inert: the preview is a picture of the row, not a link anyone should follow. */}
          <div className="jp-pj__preview" inert>
            <JobRow job={preview} />
          </div>
          <p className="jp-sm jp-muted">
            Title, company, place and pay are what candidates scan first. Fill all four and the row does the work.
          </p>
          <h2 className="jp-label jp-pj__nexthead">What happens after you send it</h2>
          <ol className="jp-pj__next jp-sm">
            {NEXT_STEPS.map(([title, body]) => (
              <li key={title}><p><strong>{title}</strong></p><p className="jp-muted">{body}</p></li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
