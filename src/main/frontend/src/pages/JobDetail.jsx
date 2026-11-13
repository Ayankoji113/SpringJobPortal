import React, { useContext, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Bookmark, BookmarkCheck, Briefcase, CalendarDays, Globe, MapPin, Signal, Star } from 'lucide-react';
import * as jobService from '../services/jobService';
import { errorMessage } from '../services/api';
import { AuthContext } from '../context/auth-context';
import { SalaryPanel } from '../components/SalaryPanel';
import { Button, EmptyState, IconButton, Modal, Skeleton, Textarea } from '../components/ui';
import { Fact, Facts, Monogram, Proofs, ResponseClock } from '../components/ui/kit';
import { useToast } from '../components/ui/toast-context';
import { jobTypeLabel, relativeDate, salaryRange } from '../lib/format';
import './jobdetail.css';

const WINDOW_DAYS = 14;

/** The employer's answer record as a small data display: rate, typical days, sample. */
function ResponseRecord({ data, company }) {
  if (!data) return null;
  const rate = data.responseRatePercent;
  const median = data.medianDays;

  if (rate == null) {
    return (
      <section className="jp-resp" aria-labelledby="jp-resp-title">
        <h2 id="jp-resp-title" className="jp-h3">Response record</h2>
        <p className="jp-resp__new">New employer</p>
        <p className="jp-sm jp-muted">
          {company || 'This employer'} has {data.sampleSize
            ? `${data.sampleSize} ${data.sampleSize === 1 ? 'application' : 'applications'} so far, too few`
            : 'no applications yet, so too few'} to show a record. The {WINDOW_DAYS}-day answer deadline still applies to you.
        </p>
      </section>
    );
  }

  const typical = median == null ? null : Math.min(WINDOW_DAYS, Math.max(1, Math.ceil(median)));
  return (
    <section className="jp-resp" aria-labelledby="jp-resp-title">
      <h2 id="jp-resp-title" className="jp-h3">Response record</h2>
      <dl className="jp-resp__stats">
        <div>
          <dt>Answered on time</dt>
          <dd className="jp-resp__value">{rate}<span className="jp-resp__unit">%</span></dd>
        </div>
        {median != null && (
          <div>
            <dt>Typical answer</dt>
            <dd className="jp-resp__value">{median}<span className="jp-resp__unit"> {median === 1 ? 'day' : 'days'}</span></dd>
          </div>
        )}
      </dl>
      {/* The answer window drawn as the clock's own ticks: how much of it this employer typically uses. */}
      {typical != null && (
        <div className="jp-resp__window">
          <div className="jp-resp__ticks" role="img"
            aria-label={`Typically answers within ${median} of the ${WINDOW_DAYS} days allowed`}>
            {Array.from({ length: WINDOW_DAYS }, (_, i) => (
              <span key={i} className={i < typical ? 'jp-resp__tick jp-resp__tick--on' : 'jp-resp__tick'} />
            ))}
          </div>
          <span className="jp-resp__scale" aria-hidden="true">
            <span>Day 1</span><span>Day {WINDOW_DAYS}</span>
          </span>
        </div>
      )}
      <p className="jp-sm jp-muted">
        Based on {data.sampleSize} {data.sampleSize === 1 ? 'application' : 'applications'} in the last 90 days.
      </p>
    </section>
  );
}

export function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isJobSeeker } = useContext(AuthContext);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);
  // The clock in the apply dialog starts "now"; read the time once, not on every render.
  const [now] = useState(() => Date.now());

  const { data: job, isPending, isError, error } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobService.getJobById(id),
  });

  const employerId = job?.postedBy?.id;
  const { data: responsiveness } = useQuery({
    queryKey: ['responsiveness', employerId],
    queryFn: () => jobService.getEmployerResponsiveness(employerId),
    enabled: Boolean(employerId),
  });

  // isJobSaved already unwraps the payload to a boolean.
  const { data: savedState } = useQuery({
    queryKey: ['is-saved', id],
    queryFn: () => jobService.isJobSaved(id),
    enabled: isJobSeeker,
    retry: false,
  });
  const saved = Boolean(savedState);

  const toggleSave = useMutation({
    mutationFn: () => (saved ? jobService.unsaveJob(id) : jobService.saveJob(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['is-saved', id] });
      queryClient.invalidateQueries({ queryKey: ['saved-jobs'] });
      toast(saved ? 'Removed from saved jobs' : 'Saved', 'success');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm({
    mode: 'onBlur',
    defaultValues: { coverLetter: '' },
  });
  const coverLetter = watch('coverLetter') || '';

  const apply = useMutation({
    mutationFn: (values) => jobService.applyToJob(id, values.coverLetter),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-applications'] });
      setApplyOpen(false);
      reset();
      toast('Application submitted', 'success');
      navigate('/my-applications');
    },
    onError: (err) => toast(errorMessage(err, 'Could not submit your application.'), 'error'),
  });

  if (isPending) {
    return (
      <div className="jp-container jp-page" aria-busy="true">
        <span className="jp-sr-only" role="status">Loading job</span>
        <div className="jp-detail">
          <div>
            <div className="jp-detail__id">
              <Skeleton width={56} height={56} radius={8} />
              <div style={{ flex: 1 }}>
                <Skeleton width="60%" height={30} />
                <Skeleton width="30%" height={13} style={{ marginTop: 12 }} />
              </div>
            </div>
            <Skeleton width="40%" height={28} style={{ marginTop: 32 }} />
            <Skeleton width="100%" height={240} style={{ marginTop: 32 }} />
          </div>
          <div className="jp-detail__rail">
            <Skeleton width="100%" height={42} />
            <Skeleton width="100%" height={160} />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="jp-container jp-page">
        <EmptyState
          title="Job not found"
          body={errorMessage(error, 'This posting may have been removed or closed.')}
          action={<Button variant="primary" onClick={() => navigate('/jobs')}>Browse all jobs</Button>}
        />
      </div>
    );
  }

  const company = job.company?.name || job.postedBy?.fullName || '';
  const disclosed = job.salaryMin != null || job.salaryMax != null;
  const experience = job.reqExperience == null ? null
    : Number(job.reqExperience) === 0 ? 'Entry level' : `${job.reqExperience}+ years experience`;
  const respondBy = new Date(now + WINDOW_DAYS * 86400000).toISOString();
  const canAct = isJobSeeker || !isAuthenticated;

  const saveButton = (
    <Button block onClick={() => toggleSave.mutate()} disabled={toggleSave.isPending} aria-pressed={saved}
      className="jp-detail__save">
      {saved ? <BookmarkCheck size={16} aria-hidden="true" /> : <Bookmark size={16} aria-hidden="true" />}
      {saved ? 'Saved' : 'Save job'}
    </Button>
  );

  return (
    <div className={canAct ? 'jp-container jp-page jp-detail-page jp-detail-page--bar' : 'jp-container jp-page jp-detail-page'}>
      <p className="jp-sm jp-detail__back"><Link to="/jobs">All jobs</Link></p>

      <div className="jp-detail">
        <article className="jp-detail__main">
          <header className="jp-detail__head">
            <div className="jp-detail__id">
              <Monogram name={company} size="lg" />
              <div className="jp-detail__titles">
                <h1 className="jp-display">{job.postProfile}</h1>
                <p className="jp-detail__company">
                  {company}
                  {job.isFeatured && <span className="jp-detail__featured"><Star size={13} aria-hidden="true" />Featured</span>}
                </p>
              </div>
            </div>

            <Facts className="jp-detail__facts">
              {job.isRemote
                ? <Fact icon={Globe}>Remote{job.location ? `, based in ${job.location}` : ''}</Fact>
                : job.location && <Fact icon={MapPin}>{job.location}</Fact>}
              {job.jobType && <Fact icon={Briefcase}>{jobTypeLabel(job.jobType)}</Fact>}
              {experience && <Fact icon={Signal}>{experience}</Fact>}
              {job.postedDate && <Fact icon={CalendarDays}>Posted {relativeDate(job.postedDate)}</Fact>}
            </Facts>

            <div className="jp-detail__pay">
              <span className="jp-detail__paylabel">{disclosed ? 'Pay range, per year' : 'Pay'}</span>
              <span className={disclosed ? 'jp-detail__amount' : 'jp-detail__amount jp-detail__amount--none'}>
                {disclosed ? salaryRange(job.salaryMin, job.salaryMax) : 'Not disclosed by the employer'}
              </span>
            </div>

            <Proofs
              className="jp-detail__proofs"
              verified={job.status === 'PUBLISHED'}
              salaryShown={disclosed}
              responsiveness={responsiveness}
            />
          </header>

          {job.postTechStack?.length > 0 && (
            <section className="jp-detail__section" aria-labelledby="jp-stack-title">
              <h2 id="jp-stack-title" className="jp-h2">Tech stack</h2>
              <ul className="jp-detail__tags">
                {job.postTechStack.map((tech) => <li key={tech} className="jp-tag">{tech}</li>)}
              </ul>
            </section>
          )}

          <section className="jp-detail__section" aria-labelledby="jp-desc-title">
            <h2 id="jp-desc-title" className="jp-h2">About the role</h2>
            <p className="jp-detail__desc">{job.postDesc || 'The employer has not written a description yet.'}</p>
          </section>

          {/* Beside the role rather than in the rail: the rail stays short enough to stay in view. */}
          <div className="jp-detail__market">
            <SalaryPanel jobId={job.postId} salaryMin={job.salaryMin} salaryMax={job.salaryMax} />
          </div>
        </article>

        <aside className="jp-detail__rail" aria-label="Apply">
          {canAct && (
            <div className="jp-detail__cta">
              {isJobSeeker ? (
                <>
                  <Button variant="primary" block size="lg" onClick={() => setApplyOpen(true)}>Apply now</Button>
                  {saveButton}
                </>
              ) : (
                <>
                  <Button variant="primary" block size="lg" onClick={() => navigate('/login', { state: { from: `/job/${id}` } })}>
                    Sign in to apply
                  </Button>
                  <p className="jp-sm jp-muted">
                    You need a job seeker account. <Link to="/register">Create one</Link>
                  </p>
                </>
              )}
              <p className="jp-detail__promise jp-sm">
                {company || 'The employer'} must answer within {WINDOW_DAYS} days of your application.
              </p>
            </div>
          )}

          <ResponseRecord data={responsiveness} company={company} />

        </aside>
      </div>

      {/* Phones and tablets: the action stays in reach, above the tab bar. */}
      {canAct && (
        <div className="jp-applybar">
          <div className="jp-applybar__pay">
            <span className={disclosed ? 'jp-data' : 'jp-muted'}>{disclosed ? salaryRange(job.salaryMin, job.salaryMax) : 'Pay not disclosed'}</span>
            <span className="jp-applybar__company">{company}</span>
          </div>
          {isJobSeeker ? (
            <>
              <IconButton
                label={saved ? 'Remove from saved jobs' : 'Save job'}
                aria-pressed={saved}
                className="jp-applybar__save"
                onClick={() => toggleSave.mutate()}
                disabled={toggleSave.isPending}
              >
                {saved ? <BookmarkCheck size={18} aria-hidden="true" /> : <Bookmark size={18} aria-hidden="true" />}
              </IconButton>
              <Button variant="primary" size="lg" onClick={() => setApplyOpen(true)}>Apply now</Button>
            </>
          ) : (
            <Button variant="primary" size="lg" onClick={() => navigate('/login', { state: { from: `/job/${id}` } })}>
              Sign in to apply
            </Button>
          )}
        </div>
      )}

      <Modal
        open={applyOpen}
        onOpenChange={setApplyOpen}
        title={`Apply to ${job.postProfile}`}
        description={`${company} receives your profile, resume and the note below.`}
        footer={
          <>
            <Button onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleSubmit((values) => apply.mutate(values))}
              disabled={isSubmitting || apply.isPending}
            >
              {apply.isPending ? 'Submitting…' : 'Submit application'}
            </Button>
          </>
        }
      >
        <div className="jp-applyclock">
          <ResponseClock appliedAt={new Date(now).toISOString()} respondBy={respondBy} status="PENDING" size="sm" />
          <p className="jp-sm">
            <strong>{company || 'The employer'} has {WINDOW_DAYS} days to answer you.</strong>{' '}
            If they do not, the application is closed as unanswered, you are told, and it counts against
            their response record.
          </p>
        </div>
        <form onSubmit={handleSubmit((values) => apply.mutate(values))}>
          <Textarea
            label="Cover letter"
            optional
            rows={7}
            placeholder="Why you are a good fit for this role"
            hint={`${coverLetter.length} / 2000 characters`}
            error={errors.coverLetter?.message}
            {...register('coverLetter', {
              maxLength: { value: 2000, message: 'Keep the cover letter under 2000 characters.' },
            })}
          />
        </form>
      </Modal>
    </div>
  );
}
