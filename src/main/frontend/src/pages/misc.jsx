import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Check, Trash2 } from 'lucide-react';
import * as jobService from '../services/jobService';
import * as notificationService from '../services/notificationService';
import * as userService from '../services/userService';
import { errorMessage } from '../services/api';
import { AuthContext } from '../context/auth-context';
import { JobRow, JobRowSkeletonList } from '../components/JobRow';
import { Badge, Button, Card, CardBody, CardHead, EmptyState, IconButton, Input, Skeleton, Textarea } from '../components/ui';
import { useToast } from '../components/ui/toast-context';
import { relativeDate } from '../lib/format';
import './pages.css';
import './home.css';

/* -------------------------------------------------------------------------- home */
export function Home() {
  const { isAuthenticated, isEmployer } = useContext(AuthContext);
  const navigate = useNavigate();

  const { data, isPending } = useQuery({
    queryKey: ['featured-jobs'],
    queryFn: jobService.getFeaturedJobs,
    retry: false,
  });

  const { data: recent } = useQuery({
    queryKey: ['jobs', {}, 0],
    queryFn: () => jobService.getJobsPaginated(0, 5),
  });

  const jobs = (data?.length ? data : recent?.content) || [];

  return (
    <div className="jp-container jp-page">
      <section className="jp-hero">
        <h1 className="jp-hero__title">
          Engineering roles,<br />with the salary in plain sight.
        </h1>
        <p className="jp-hero__body">
          Every posting is compared against real market data from similar roles, so you can see where an
          offer actually sits before you apply.
        </p>
        <div className="jp-row jp-hero__actions">
          <Button variant="primary" size="lg" onClick={() => navigate('/jobs')}>Browse jobs</Button>
          {!isAuthenticated && (
            <Button size="lg" onClick={() => navigate('/register')}>Create an account</Button>
          )}
          {isEmployer && (
            <Button size="lg" onClick={() => navigate('/post-job')}>Post a job</Button>
          )}
        </div>
      </section>

      <section className="jp-home__list">
        <div className="jp-page-head">
          <h2 className="jp-h1">Latest openings</h2>
          <Link to="/jobs" className="jp-sm">See all →</Link>
        </div>
        {isPending && !recent ? (
          <JobRowSkeletonList count={4} />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No openings posted yet"
            body="This board is new. Employers can publish the first role in under a minute."
            action={<Button variant="primary" onClick={() => navigate(isEmployer ? '/post-job' : '/register')}>
              {isEmployer ? 'Post a job' : 'Create an account'}
            </Button>}
          />
        ) : (
          <div className="jp-list">
            {jobs.slice(0, 5).map((job) => <JobRow key={job.postId} job={job} />)}
          </div>
        )}
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------- notifications */
export function Notifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationService.getNotifications,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
  };

  const markRead = useMutation({
    mutationFn: (id) => notificationService.markAsRead(id),
    onSuccess: invalidate,
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const markAll = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => { invalidate(); toast('All marked as read', 'success'); },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id) => notificationService.deleteNotification(id),
    onSuccess: invalidate,
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  return (
    <div className="jp-container jp-page">
      <div className="jp-page-head">
        <div>
          <h1 className="jp-display">Notifications</h1>
          <p className="jp-sm jp-muted">{isPending ? 'Loading…' : `${data?.length || 0} total`}</p>
        </div>
        {(data?.length || 0) > 0 && (
          <Button onClick={() => markAll.mutate()} disabled={markAll.isPending}>Mark all as read</Button>
        )}
      </div>

      {isPending && (
        <div className="jp-list">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="jp-jobrow">
              <div className="jp-jobrow__main">
                <Skeleton width="30%" height={14} />
                <Skeleton width="65%" height={11} style={{ marginTop: 8 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && !isPending && (
        <EmptyState title="Could not load notifications" body={errorMessage(error)}
          action={<Button variant="primary" onClick={() => refetch()}>Retry</Button>} />
      )}

      {!isPending && !isError && data.length === 0 && (
        <EmptyState
          title="Nothing to catch up on"
          body="Application updates and new applicants will show up here."
          action={<Link to="/jobs"><Button variant="primary">Browse jobs</Button></Link>}
        />
      )}

      {!isPending && !isError && data.length > 0 && (
        <div className="jp-list">
          {data.map((n) => (
            <article key={n.id} className="jp-jobrow">
              <div className="jp-jobrow__main">
                <h2 className="jp-h3">
                  {n.title} {!n.isRead && <Badge tone="accent">New</Badge>}
                </h2>
                <p className="jp-sm jp-muted jp-jobrow__meta">{n.message}</p>
                <p className="jp-sm jp-muted">{relativeDate(n.createdAt)}</p>
              </div>
              <div className="jp-row">
                {!n.isRead && (
                  <IconButton label={`Mark "${n.title}" as read`} onClick={() => markRead.mutate(n.id)}>
                    <Check size={15} aria-hidden="true" />
                  </IconButton>
                )}
                <IconButton label={`Delete "${n.title}"`} onClick={() => remove.mutate(n.id)}>
                  <Trash2 size={15} aria-hidden="true" />
                </IconButton>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- profile */
export function Profile() {
  const { user, updateUser } = useContext(AuthContext);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({ queryKey: ['me'], queryFn: userService.getCurrentProfile });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ mode: 'onBlur' });

  React.useEffect(() => {
    if (data) {
      reset({
        fullName: data.fullName || '', phone: data.phone || '', bio: data.bio || '',
        location: data.location || '', currentJobTitle: data.currentJobTitle || '',
        experienceYears: data.experienceYears ?? '', skills: (data.skills || []).join(', '),
        linkedinUrl: data.linkedinUrl || '', githubUrl: data.githubUrl || '', portfolioUrl: data.portfolioUrl || '',
      });
    }
  }, [data, reset]);

  const save = useMutation({
    mutationFn: (values) => userService.updateProfile({
      ...values,
      experienceYears: values.experienceYears === '' ? null : Number(values.experienceYears),
      skills: values.skills ? values.skills.split(',').map((s) => s.trim()).filter(Boolean) : [],
    }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      updateUser({ fullName: updated.fullName });
      toast('Profile saved', 'success');
    },
    onError: (err) => toast(errorMessage(err, 'Could not save your profile.'), 'error'),
  });

  const upload = useMutation({
    mutationFn: ({ kind, file }) => (kind === 'photo' ? userService.uploadProfilePhoto(file) : userService.uploadResume(file)),
    onSuccess: (_r, { kind }) => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast(kind === 'photo' ? 'Photo updated' : 'Resume uploaded', 'success');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  if (isPending) {
    return <div className="jp-container jp-page"><Skeleton width="40%" height={30} /><Skeleton width="100%" height={220} style={{ marginTop: 24, borderRadius: 8 }} /></div>;
  }

  return (
    <div className="jp-container jp-page">
      <div className="jp-page-head">
        <div>
          <h1 className="jp-display">Profile</h1>
          <p className="jp-sm jp-muted">{user?.email} · skills here drive job matching.</p>
        </div>
      </div>

      <form className="jp-form" onSubmit={handleSubmit((values) => save.mutate(values))} noValidate>
        <div className="jp-form-grid">
          <Input label="Full name" error={errors.fullName?.message}
            {...register('fullName', { required: 'Full name is required' })} />
          <Input label="Phone" optional {...register('phone')} />
          <Input label="Location" optional placeholder="Pune" {...register('location')} />
          <Input label="Current job title" optional {...register('currentJobTitle')} />
          <Input label="Years of experience" type="number" min="0" optional
            error={errors.experienceYears?.message}
            {...register('experienceYears', { min: { value: 0, message: 'Cannot be negative' } })} />
          <Input label="LinkedIn URL" optional type="url" {...register('linkedinUrl')} />
          <Input label="GitHub URL" optional type="url" {...register('githubUrl')} />
          <Input label="Portfolio URL" optional type="url" {...register('portfolioUrl')} />
        </div>

        <Input label="Skills" optional hint="Comma separated — these are matched against job tech stacks."
          placeholder="java, spring boot, kubernetes" {...register('skills')} />

        <Textarea label="Bio" optional rows={4} {...register('bio')} />

        <div className="jp-form__actions">
          <Button type="submit" variant="primary" disabled={isSubmitting || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </form>

      <Card style={{ marginTop: 'var(--jp-space-6)', maxWidth: 720 }}>
        <CardHead title="Files" />
        <CardBody>
          <div className="jp-form-grid">
            <div className="jp-field">
              <label className="jp-field__label" htmlFor="photo">Profile photo</label>
              <input id="photo" type="file" accept="image/*"
                onChange={(e) => e.target.files?.[0] && upload.mutate({ kind: 'photo', file: e.target.files[0] })} />
              {data?.profilePhotoPath && <span className="jp-field__hint">Current: {data.profilePhotoPath}</span>}
            </div>
            <div className="jp-field">
              <label className="jp-field__label" htmlFor="resume">Resume</label>
              <input id="resume" type="file" accept=".pdf,.doc,.docx"
                onChange={(e) => e.target.files?.[0] && upload.mutate({ kind: 'resume', file: e.target.files[0] })} />
              {data?.resumePath && <span className="jp-field__hint">Current: {data.resumePath}</span>}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* --------------------------------------------------------------------- not found */
export function NotFound() {
  return (
    <div className="jp-container jp-page">
      <EmptyState
        title="That page does not exist"
        body="The link may be out of date, or the posting may have been removed."
        action={<Link to="/jobs"><Button variant="primary">Browse jobs</Button></Link>}
      />
    </div>
  );
}
