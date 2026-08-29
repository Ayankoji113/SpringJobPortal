import React, { useContext, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import * as jobService from '../services/jobService';
import { errorMessage } from '../services/api';
import { AuthContext } from '../context/auth-context';
import { SalaryPanel } from '../components/SalaryPanel';
import { Badge, Button, EmptyState, Modal, Skeleton, Textarea } from '../components/ui';
import { useToast } from '../components/ui/toast-context';
import { fullDate, jobTypeLabel, salaryRange } from '../lib/format';
import './jobdetail.css';

export function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isJobSeeker } = useContext(AuthContext);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);

  const { data: job, isPending, isError, error } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobService.getJobById(id),
  });

  const { data: savedState } = useQuery({
    queryKey: ['is-saved', id],
    queryFn: () => jobService.isJobSaved(id),
    enabled: isJobSeeker,
    retry: false,
  });
  const saved = Boolean(savedState?.saved);

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
      <div className="jp-container jp-page">
        <Skeleton width="55%" height={30} />
        <Skeleton width="35%" height={13} style={{ marginTop: 14 }} />
        <Skeleton width="100%" height={180} style={{ marginTop: 32, borderRadius: 8 }} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="jp-container jp-page">
        <EmptyState
          title="Job not found"
          body={errorMessage(error, 'This posting may have been removed.')}
          action={<Button variant="primary" onClick={() => navigate('/jobs')}>Back to jobs</Button>}
        />
      </div>
    );
  }

  const meta = [
    job.company?.name || job.postedBy?.fullName,
    job.isRemote ? 'Remote' : job.location,
    jobTypeLabel(job.jobType),
    job.reqExperience != null && `${job.reqExperience} years experience`,
  ].filter(Boolean);

  return (
    <div className="jp-container jp-page">
      <p className="jp-sm"><Link to="/jobs">← All jobs</Link></p>

      <div className="jp-detail">
        <article className="jp-detail__main">
          <header className="jp-detail__head">
            <h1 className="jp-display">{job.postProfile}</h1>
            <p className="jp-sm jp-muted">{meta.join(' · ')}</p>
            <div className="jp-detail__facts">
              <span className="jp-data">{salaryRange(job.salaryMin, job.salaryMax)}</span>
              {job.isFeatured && <Badge tone="accent">Featured</Badge>}
              <span className="jp-sm jp-muted">Posted {fullDate(job.postedDate)}</span>
            </div>
          </header>

          {job.postTechStack?.length > 0 && (
            <section className="jp-detail__section">
              <h2 className="jp-label">Tech stack</h2>
              <ul className="jp-detail__tags">
                {job.postTechStack.map((tech) => <li key={tech} className="jp-tag">{tech}</li>)}
              </ul>
            </section>
          )}

          <section className="jp-detail__section">
            <h2 className="jp-label">Description</h2>
            <p className="jp-detail__desc">{job.postDesc || 'No description provided.'}</p>
          </section>
        </article>

        <aside className="jp-detail__rail">
          <div className="jp-detail__cta">
            {isJobSeeker && (
              <>
                <Button variant="primary" block size="lg" onClick={() => setApplyOpen(true)}>Apply now</Button>
                <Button block onClick={() => toggleSave.mutate()} disabled={toggleSave.isPending}>
                  {saved ? <BookmarkCheck size={15} aria-hidden="true" /> : <Bookmark size={15} aria-hidden="true" />}
                  {saved ? 'Saved' : 'Save job'}
                </Button>
              </>
            )}
            {!isAuthenticated && (
              <>
                <Button variant="primary" block size="lg" onClick={() => navigate('/login')}>Sign in to apply</Button>
                <p className="jp-sm jp-muted">You need a job seeker account to apply.</p>
              </>
            )}
          </div>

          <SalaryPanel jobId={job.postId} salaryMin={job.salaryMin} salaryMax={job.salaryMax} />
        </aside>
      </div>

      <Modal
        open={applyOpen}
        onOpenChange={setApplyOpen}
        title={`Apply — ${job.postProfile}`}
        description="Your profile and resume are sent with the application."
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
        <form onSubmit={handleSubmit((values) => apply.mutate(values))}>
          <Textarea
            label="Cover letter"
            optional
            rows={7}
            placeholder="Why you are a good fit for this role…"
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
