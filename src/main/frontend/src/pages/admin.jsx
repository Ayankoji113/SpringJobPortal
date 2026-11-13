import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Briefcase, Check, Globe, MapPin, ShieldOff, Signal, Star, X,
} from 'lucide-react';
import * as adminService from '../services/adminService';
import { errorMessage } from '../services/api';
import { Button, EmptyState, Modal, Skeleton, Textarea } from '../components/ui';
import { Fact, Facts, Monogram, PageHead, Stat, StatGroup } from '../components/ui/kit';
import { useToast } from '../components/ui/toast-context';
import { fullDate, jobTypeLabel, relativeDate, salaryRange } from '../lib/format';
import './admin.css';

const DAY = 86400000;
const PAGE_SIZE = 20;
const cx = (...parts) => parts.filter(Boolean).join(' ');

/* Audit-log actions as a sentence fragment. Unknown codes fall back to the raw code. */
const ACTION = {
  JOB_PUBLISHED: ['Approved', 'ok'],
  JOB_REJECTED: ['Rejected', 'bad'],
  JOB_SUSPENDED: ['Suspended', 'bad'],
  JOB_FEATURED: ['Featured', 'ok'],
  JOB_UNFEATURED: ['Unfeatured', 'neutral'],
  USER_BANNED: ['Banned', 'bad'],
  USER_UNBANNED: ['Reinstated', 'ok'],
};

/* ------------------------------------------------------------- one posting */
function ReviewItem({ job, onApprove, onReject, onBan, busy }) {
  const [full, setFull] = useState(false);
  const [feature, setFeature] = useState(false);
  const company = job.company?.name || job.postedBy?.fullName || 'No company';
  const disclosed = job.salaryMin != null || job.salaryMax != null;
  const desc = job.postDesc || '';
  const long = desc.length > 420;
  const headingId = `rv-${job.postId}`;

  return (
    <article className="jp-rv" aria-labelledby={headingId}>
      <div className="jp-rv__main">
        <header className="jp-rv__head">
          <Monogram name={company} size="lg" />
          <div>
            <h2 id={headingId} className="jp-h2">{job.postProfile}</h2>
            <p className="jp-rv__company">{company}</p>
            <p className="jp-sm jp-muted">
              Submitted <span title={fullDate(job.postedDate)}>{relativeDate(job.postedDate)}</span>
              {job.postedBy && <> by {job.postedBy.fullName} ({job.postedBy.email})</>}
            </p>
          </div>
        </header>

        <div className="jp-rv__facts">
          <p className={cx('jp-rv__pay', !disclosed && 'jp-rv__pay--none')}>
            {disclosed ? salaryRange(job.salaryMin, job.salaryMax) : (
              <><AlertTriangle size={15} aria-hidden="true" />No pay range given</>
            )}
          </p>
          <Facts>
            <Fact icon={job.isRemote ? Globe : MapPin}>{job.isRemote ? 'Remote' : job.location || 'No location given'}</Fact>
            {job.jobType && <Fact icon={Briefcase}>{jobTypeLabel(job.jobType)}</Fact>}
            {job.reqExperience != null && <Fact icon={Signal}>{Number(job.reqExperience) === 0 ? 'Entry level' : `${job.reqExperience}+ years`}</Fact>}
          </Facts>
        </div>

        <div className="jp-rv__desc">
          {desc
            ? <p className={cx(long && !full && 'jp-rv__clamp')}>{desc}</p>
            : <p className="jp-muted">No description given.</p>}
          {long && (
            <button type="button" className="jp-rv__more" aria-expanded={full} onClick={() => setFull(!full)}>
              {full ? 'Show less' : 'Read the full description'}
            </button>
          )}
        </div>

        {job.postTechStack?.length > 0 && (
          <ul className="jp-rv__tags" aria-label="Tech stack">
            {job.postTechStack.map((t) => <li key={t} className="jp-tag">{t}</li>)}
          </ul>
        )}
      </div>

      <div className="jp-rv__decide">
        <p className="jp-sm jp-muted">In the queue since {fullDate(job.postedDate)}.</p>
        <label className="jp-rv__check">
          <input type="checkbox" checked={feature} onChange={(e) => setFeature(e.target.checked)} />
          Feature it once approved
        </label>
        <Button variant="primary" block disabled={busy} onClick={() => onApprove(job, feature)}>
          <Check size={15} aria-hidden="true" />Approve and publish
        </Button>
        <Button variant="secondary" block disabled={busy} className="jp-rv__reject" onClick={() => onReject(job)}>
          <X size={15} aria-hidden="true" />Reject
        </Button>
        {job.postedBy && (
          <div className="jp-rv__ban">
            <p className="jp-sm jp-muted">Spam or a fake company?</p>
            <Button variant="ghost" size="sm" onClick={() => onBan(job.postedBy)}>
              <ShieldOff size={14} aria-hidden="true" />Ban {job.postedBy.fullName}
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------ the audit log */
function AuditLog({ actions }) {
  if (actions.isPending) return <Skeleton width="100%" height={200} />;
  if (actions.isError) {
    return <EmptyState title="Could not load the log" body={errorMessage(actions.error)}
      action={<Button variant="primary" onClick={() => actions.refetch()}>Try again</Button>} />;
  }
  const rows = actions.data?.content || [];
  if (!rows.length) return <EmptyState title="Nothing recorded yet" body="Every approval, rejection, feature and ban is recorded here." />;

  return (
    <ol className="jp-log">
      {rows.map((a) => {
        const [verb, tone] = ACTION[a.action] || [a.action, 'neutral'];
        const target = a.targetType === 'JOB'
          ? <Link to={`/job/${a.targetId}`}>posting #{a.targetId}</Link>
          : <span>account #{a.targetId}</span>;
        return (
          <li key={a.id} className="jp-log__row">
            <time className="jp-sm jp-muted" dateTime={a.createdAt} title={fullDate(a.createdAt)}>{relativeDate(a.createdAt)}</time>
            <p className="jp-log__what">
              <span className={`jp-log__verb jp-log__verb--${tone}`}>{verb}</span> {target}
            </p>
            <p className="jp-sm jp-log__reason">{a.reason || <span className="jp-muted">No reason recorded</span>}</p>
            <p className="jp-sm jp-muted jp-log__who">{a.adminEmail}</p>
          </li>
        );
      })}
    </ol>
  );
}

/* --------------------------------------------------------------- the page */
export function AdminReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'log' ? 'log' : 'queue';
  const [page, setPage] = useState(0);
  const [decided, setDecided] = useState([]); // postings decided in this session, newest first
  const [rejecting, setRejecting] = useState(null);
  const [banning, setBanning] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [now] = useState(() => Date.now());

  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminService.getStats });
  const pending = useQuery({ queryKey: ['admin', 'pending', page], queryFn: () => adminService.getPendingJobs(page, PAGE_SIZE) });
  const actions = useQuery({ queryKey: ['admin', 'actions'], queryFn: () => adminService.getActions(0, 50) });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });
  const closeModals = () => { setRejecting(null); setBanning(null); setReason(''); setReasonError(''); };

  const decide = useMutation({
    mutationFn: async ({ job, status, reason: why, feature }) => {
      let result = await adminService.decide(job.postId, status, why);
      if (feature && status === 'PUBLISHED') result = await adminService.setFeatured(job.postId, true);
      return result;
    },
    onSuccess: (result, { job, status }) => {
      setDecided((list) => [{ ...job, ...result }, ...list.filter((j) => j.postId !== job.postId)]);
      toast(status === 'PUBLISHED' ? `${job.postProfile} is live` : `${job.postProfile} rejected. The employer has been told why.`, 'success');
      closeModals();
      refresh();
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const feature = useMutation({
    mutationFn: ({ job, on }) => adminService.setFeatured(job.postId, on),
    onSuccess: (result) => {
      setDecided((list) => list.map((j) => (j.postId === result.postId ? { ...j, ...result } : j)));
      toast(result.isFeatured ? 'Featured on the home page' : 'No longer featured', 'success');
      refresh();
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const ban = useMutation({
    mutationFn: ({ user, why }) => adminService.setBanned(user.id, true, why),
    onSuccess: (_r, { user }) => {
      toast(`${user.fullName} is banned and signed out`, 'success');
      closeModals();
      refresh();
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const submitReason = () => {
    if (reason.trim().length < 10) { setReasonError('Give a reason of at least a sentence. The employer sees it.'); return; }
    if (rejecting) decide.mutate({ job: rejecting, status: 'REJECTED', reason: reason.trim() });
    else ban.mutate({ user: banning, why: reason.trim() });
  };

  const queue = pending.data?.content || [];
  const total = pending.data?.totalElements ?? stats.data?.pendingReview;
  const oldest = page === 0 ? queue[0] : null;
  const log = actions.data?.content || [];
  const lastDay = log.filter((a) => a.action.startsWith('JOB_') && now - new Date(a.createdAt).getTime() < DAY);
  const rejected = lastDay.filter((a) => a.action === 'JOB_REJECTED').length;

  return (
    <div className="jp-container jp-page">
      <PageHead title="Review queue" sub="Nothing is listed until it passes here. Check that the role is real, the pay is stated and the text is honest." />

      <StatGroup>
        <Stat label="Waiting for review" value={stats.isPending ? '–' : stats.data?.pendingReview ?? 0} tone={stats.data?.pendingReview ? 'accent' : undefined} />
        <Stat label="Oldest in the queue" value={oldest ? relativeDate(oldest.postedDate).replace(' ago', '') : '–'} hint={oldest ? `Since ${fullDate(oldest.postedDate)}` : 'Queue is empty'} />
        <Stat label="Decided in the last 24 hours" value={actions.isPending ? '–' : lastDay.length}
          hint={lastDay.length ? `${rejected} rejected` : undefined} />
      </StatGroup>

      <div className="jp-adm__tabs" role="group" aria-label="View">
        <button type="button" className="jp-adm__tab" aria-pressed={tab === 'queue'} onClick={() => setParams({})}>
          Pending postings{total != null && <span className="jp-adm__n">{total}</span>}
        </button>
        <button type="button" className="jp-adm__tab" aria-pressed={tab === 'log'} onClick={() => setParams({ tab: 'log' })}>
          Audit log
        </button>
      </div>

      {tab === 'log' ? <AuditLog actions={actions} /> : (
        <div className="jp-adm__queue" aria-live="polite">
          {decided.length > 0 && (
            <section className="jp-decided" aria-labelledby="decided-title">
              <h2 id="decided-title" className="jp-label">Decided in this session</h2>
              <ul>
                {decided.map((j) => (
                  <li key={j.postId}>
                    <span className="jp-decided__title">{j.postProfile}</span>
                    <span className={cx('jp-sm', j.status === 'PUBLISHED' ? 'jp-decided__ok' : 'jp-decided__bad')}>
                      {j.status === 'PUBLISHED' ? 'Published' : 'Rejected'}
                    </span>
                    {j.status === 'PUBLISHED' && (
                      <Button size="sm" variant="ghost" aria-pressed={Boolean(j.isFeatured)}
                        disabled={feature.isPending} onClick={() => feature.mutate({ job: j, on: !j.isFeatured })}>
                        <Star size={14} aria-hidden="true" className={j.isFeatured ? 'jp-decided__star' : undefined} />
                        {j.isFeatured ? 'Featured' : 'Feature'}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {pending.isPending && <Skeleton width="100%" height={320} />}
          {pending.isError && (
            <EmptyState title="Could not load the queue" body={errorMessage(pending.error)}
              action={<Button variant="primary" onClick={() => pending.refetch()}>Try again</Button>} />
          )}
          {pending.data && queue.length === 0 && (
            <EmptyState title="The queue is clear" body="New and edited postings appear here, oldest first. Check the audit log for what was decided." />
          )}
          {queue.map((job) => (
            <ReviewItem
              key={job.postId}
              job={job}
              busy={decide.isPending}
              onApprove={(j, feat) => decide.mutate({ job: j, status: 'PUBLISHED', feature: feat })}
              onReject={(j) => { closeModals(); setRejecting(j); }}
              onBan={(u) => { closeModals(); setBanning(u); }}
            />
          ))}

          {(pending.data?.totalPages || 0) > 1 && (
            <nav className="jp-adm__pager" aria-label="Queue pages">
              <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Older page</Button>
              <span className="jp-sm jp-muted">Page {page + 1} of {pending.data.totalPages}</span>
              <Button size="sm" disabled={pending.data.last} onClick={() => setPage(page + 1)}>Newer page</Button>
            </nav>
          )}
        </div>
      )}

      <Modal
        open={Boolean(rejecting || banning)}
        onOpenChange={(open) => !open && closeModals()}
        title={rejecting ? `Reject “${rejecting.postProfile}”?` : banning ? `Ban ${banning.fullName}?` : ''}
        description={rejecting
          ? 'The employer is notified with your reason and can edit the posting to resubmit it.'
          : 'They are signed out everywhere and cannot sign in again. Their postings stay as they are.'}
        footer={
          <>
            <Button onClick={closeModals}>Cancel</Button>
            <Button variant="danger" disabled={decide.isPending || ban.isPending} onClick={submitReason}>
              {rejecting ? (decide.isPending ? 'Rejecting…' : 'Reject posting') : (ban.isPending ? 'Banning…' : 'Ban account')}
            </Button>
          </>
        }
      >
        <Textarea
          label={rejecting ? 'Reason, shown to the employer' : 'Reason, kept in the audit log'}
          rows={4}
          maxLength={500}
          required
          value={reason}
          error={reasonError}
          placeholder={rejecting ? 'The pay range is missing. Add the salary band and resubmit.' : 'Posted the same fake role under three company names.'}
          onChange={(e) => { setReason(e.target.value); setReasonError(''); }}
        />
      </Modal>
    </div>
  );
}
