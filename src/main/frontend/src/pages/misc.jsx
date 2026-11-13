import React, { useContext, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import {
  BadgeCheck, Banknote, Bell, CalendarDays, Check, Clock, FileText, Mail, MailWarning, Trash2, UserPlus,
} from 'lucide-react';
import * as jobService from '../services/jobService';
import * as notificationService from '../services/notificationService';
import * as userService from '../services/userService';
import api, { errorMessage } from '../services/api';
import { AuthContext } from '../context/auth-context';
import { JobRow, JobRowSkeletonList } from '../components/JobRow';
import { Button, EmptyState, IconButton, Input, Skeleton, Textarea } from '../components/ui';
import { Fact, Facts, Monogram, PageHead, ResponseClock, StageTrack } from '../components/ui/kit';
import { useToast } from '../components/ui/toast-context';
import { fullDate, relativeDate } from '../lib/format';
import './pages.css';
import './home.css';
import './misc.css';

const DAY = 86400000;

/* -------------------------------------------------------------------------- home */

/** What happens after someone applies, drawn with the real clock and track on sample dates. */
function ApplicationDemo() {
  // Read the time once per mount, as ResponseClock does: render stays pure.
  const [sample] = useState(() => {
    const now = Date.now();
    return {
      appliedAt: new Date(now - 5 * DAY).toISOString(),
      respondBy: new Date(now + 9 * DAY).toISOString(),
    };
  });

  return (
    <figure className="jp-demo">
      <figcaption className="jp-label jp-muted">What you see after you apply</figcaption>
      <div className="jp-demo__job">
        <Monogram name="Kaveri Systems" />
        <div>
          <p className="jp-h3">Senior Backend Engineer</p>
          <p className="jp-sm jp-muted">Kaveri Systems, Bengaluru</p>
        </div>
      </div>
      <div className="jp-demo__clock">
        <ResponseClock size="lg" appliedAt={sample.appliedAt} respondBy={sample.respondBy} status="REVIEWED" />
        <p className="jp-sm jp-muted">
          You applied {relativeDate(sample.appliedAt)}. An answer is due by {fullDate(sample.respondBy)}.
        </p>
      </div>
      <StageTrack status="REVIEWED" />
      <p className="jp-sm jp-muted jp-demo__foot">
        If the clock runs out, your application is marked unanswered and it counts against the
        employer on every listing they post.
      </p>
    </figure>
  );
}

const PROMISES = [
  [BadgeCheck, 'Every listing is real', 'A person reviews each posting before it goes live, so you never apply to a role that does not exist.'],
  [Banknote, 'The pay is shown', 'Postings carry a salary range, and each one is compared with what similar roles pay.'],
  [Clock, 'You get an answer', 'The employer has 14 days to respond to your application, and their record of doing so is public.'],
];

const EMPLOYER_STEPS = [
  ['Post the role with its pay range', 'It takes a few minutes. Listings with a range are the ones candidates open.'],
  ['We review it before it is listed', 'That check is why candidates here trust what they read.'],
  ['Answer each applicant within 14 days', 'A yes, a no or a next step all count. Your on-time rate appears on every posting.'],
];

/** The closing section speaks to whoever is reading: an employer, a seeker, or a visitor. */
function closingFor({ isAuthenticated, isEmployer, isJobSeeker, isAdmin }) {
  if (isEmployer) {
    return {
      title: 'Your next hire is waiting on an answer',
      body: 'Candidates see how reliably you respond before they apply. Keep the clock in your favour by clearing your queue.',
      actions: [['/post-job', 'Post a job'], ['/manage-applications', 'Review candidates']],
    };
  }
  if (isJobSeeker) {
    return {
      title: 'Every application you send starts a clock',
      body: 'Follow each one from applied to answered, and see which employers are running out of time.',
      actions: [['/my-applications', 'My applications'], ['/recommendations', 'Jobs matched to my skills']],
    };
  }
  if (isAdmin) {
    return {
      title: 'Listings wait for your review',
      body: 'Nothing is listed until it has been checked. The queue shows what is pending.',
      actions: [['/admin', 'Open review queue']],
    };
  }
  return {
    title: 'Hiring? The clock works for you too',
    body: 'Employers who answer on time show it on every listing, and candidates choose them first. Posting is free to try.',
    actions: isAuthenticated ? [['/jobs', 'Browse jobs']] : [['/register', 'Create an employer account']],
  };
}

export function Home() {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const featured = useQuery({ queryKey: ['featured-jobs'], queryFn: jobService.getFeaturedJobs, retry: false });
  const recent = useQuery({ queryKey: ['home-jobs'], queryFn: () => jobService.getJobsPaginated(0, 6) });

  // Featured postings lead; the newest fill the rest of the six.
  const lead = featured.data || [];
  const jobs = [...lead, ...(recent.data?.content || []).filter((j) => !lead.some((f) => f.postId === j.postId))].slice(0, 6);

  const onSearch = (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ['keyword', 'location']) {
      const value = String(form.get(key) || '').trim();
      if (value) params.set(key, value);
    }
    navigate(`/jobs${params.size ? `?${params}` : ''}`);
  };

  const closing = closingFor(auth);

  return (
    <>
      <section className="jp-hero jp-on-band">
        <div className="jp-container jp-hero__inner">
          <div>
            <h1 className="jp-hero__title">
              Every employer here has <span className="jp-hero__time">14 days</span> to answer you.
            </h1>
            <p className="jp-hero__body">
              Real engineering roles with the pay shown, and a deadline on the employer instead of
              silence after you apply.
            </p>
            <form className="jp-hero__search" role="search" onSubmit={onSearch}>
              <Input label="Role or skill" name="keyword" placeholder="Backend engineer, React" autoComplete="off" />
              <Input label="Location" name="location" placeholder="Bengaluru, Remote" autoComplete="off" />
              <Button type="submit" variant="primary" size="lg">Search jobs</Button>
            </form>
          </div>
          <ApplicationDemo />
        </div>
      </section>

      <div className="jp-container">
        <section className="jp-promises" aria-label="What JobPortal promises">
          {PROMISES.map(([icon, title, body]) => (
            <div key={title} className="jp-promise">
              <h2 className="jp-h2">{React.createElement(icon, { size: 18, "aria-hidden": true })}{title}</h2>
              <p>{body}</p>
            </div>
          ))}
        </section>

        <section className="jp-home__section">
          <div className="jp-page-head">
            <h2 className="jp-h1">Latest openings</h2>
            <Link to="/jobs">See all jobs</Link>
          </div>
          {recent.isPending ? (
            <JobRowSkeletonList count={6} />
          ) : jobs.length === 0 ? (
            <EmptyState
              title="No openings posted yet"
              body="This board is new. Employers can publish the first role in a few minutes."
              action={<Link className="jp-btn jp-btn--primary" to={auth.isEmployer ? '/post-job' : '/register'}>
                {auth.isEmployer ? 'Post a job' : 'Create an account'}
              </Link>}
            />
          ) : (
            <div className="jp-list">
              {jobs.map((job) => <JobRow key={job.postId} job={job} />)}
            </div>
          )}
        </section>

        <section className="jp-closing">
          <div>
            <h2 className="jp-display">{closing.title}</h2>
            <p className="jp-closing__body">{closing.body}</p>
            <div className="jp-row-actions">
              {closing.actions.map(([to, label], i) => (
                <Link key={to} to={to} className={`jp-btn jp-btn--lg jp-btn--${i === 0 ? 'primary' : 'secondary'}`}>{label}</Link>
              ))}
            </div>
          </div>
          <div>
            <h3 className="jp-label">What every employer here agrees to</h3>
            <ol className="jp-steps">
              {EMPLOYER_STEPS.map(([title, body]) => (
                <li key={title}>
                  <p className="jp-h3">{title}</p>
                  <p className="jp-sm jp-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- notifications */
const NOTE_ICON = { APPLICATION_RECEIVED: UserPlus, APPLICATION_STATUS_CHANGED: FileText };

/** Names where a notification leads. Only in-app paths are linked. */
function actionLabel(url) {
  if (!url?.startsWith('/') || url.startsWith('//')) return null;
  if (url.startsWith('/manage-applications')) return 'Review candidates';
  if (url.startsWith('/my-applications')) return 'View my applications';
  if (url.startsWith('/job/')) return 'View the job';
  return 'Open';
}

function NotificationItem({ n, onRead, onDelete }) {
  const Icon = NOTE_ICON[n.type] || Bell;
  const label = actionLabel(n.actionUrl);
  return (
    <li className={n.isRead ? 'jp-note' : 'jp-note jp-note--unread'}>
      <Icon className="jp-note__icon" size={18} aria-hidden="true" />
      <div className="jp-note__main">
        <h3 className="jp-note__title">
          {!n.isRead && <span className="jp-note__dot" aria-hidden="true" />}
          {!n.isRead && <span className="jp-sr-only">Unread: </span>}
          {n.title}
        </h3>
        <p className="jp-note__msg">{n.message}</p>
        <div className="jp-note__foot">
          <time className="jp-sm jp-muted" dateTime={n.createdAt} title={fullDate(n.createdAt)}>{relativeDate(n.createdAt)}</time>
          {label && (
            <Link to={n.actionUrl} className="jp-sm" onClick={() => !n.isRead && onRead(n.id)}>{label}</Link>
          )}
        </div>
      </div>
      <div className="jp-note__actions">
        {!n.isRead && (
          <IconButton label={`Mark "${n.title}" as read`} onClick={() => onRead(n.id)}>
            <Check size={16} aria-hidden="true" />
          </IconButton>
        )}
        <IconButton label={`Delete "${n.title}"`} onClick={() => onDelete(n.id)}>
          <Trash2 size={16} aria-hidden="true" />
        </IconButton>
      </div>
    </li>
  );
}

export function Notifications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isEmployer } = useContext(AuthContext);

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

  const all = data || [];
  const unread = all.filter((n) => !n.isRead);
  const read = all.filter((n) => n.isRead);
  const groups = [['Unread', unread], [unread.length ? 'Earlier' : 'All read', read]].filter(([, items]) => items.length);

  const sub = isPending ? 'Loading…'
    : isError ? null
      : all.length === 0 ? 'Nothing yet'
        : unread.length ? `${unread.length} unread, ${all.length} in total` : `${all.length} in total, all read`;

  return (
    <div className="jp-container jp-page jp-notes">
      <PageHead title="Notifications" sub={sub}>
        {unread.length > 0 && (
          <Button onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <Check size={15} aria-hidden="true" />Mark all read
          </Button>
        )}
      </PageHead>

      {isPending && (
        <div className="jp-list" aria-busy="true">
          <span className="jp-sr-only">Loading notifications</span>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="jp-note">
              <Skeleton width={18} height={18} />
              <div className="jp-note__main">
                <Skeleton width="30%" height={14} />
                <Skeleton width="65%" height={11} style={{ marginTop: 8 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && !isPending && (
        <EmptyState title="Could not load notifications" body={errorMessage(error)}
          action={<Button variant="primary" onClick={() => refetch()}>Try again</Button>} />
      )}

      {!isPending && !isError && all.length === 0 && (
        <EmptyState
          title="No notifications yet"
          body={isEmployer
            ? 'You will hear here when someone applies to one of your jobs, and when an answer is close to its 14-day deadline.'
            : 'You will hear here when an employer reviews, moves or answers one of your applications, or lets the 14 days run out.'}
          action={isEmployer
            ? <Link className="jp-btn jp-btn--primary" to="/post-job">Post a job</Link>
            : <Link className="jp-btn jp-btn--primary" to="/jobs">Browse jobs</Link>}
        />
      )}

      <div aria-live="polite">
        {groups.map(([heading, items]) => (
          <section key={heading} className="jp-notes__group">
            <h2 className="jp-label">{heading}</h2>
            <ul className="jp-list jp-notes__list">
              {items.map((n) => (
                <NotificationItem key={n.id} n={n} onRead={markRead.mutate} onDelete={remove.mutate} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- profile */

/** What an employer looks for on a seeker's profile, checked against the saved profile. */
const COMPLETENESS = [
  ['Add a profile photo', (p) => p.profilePhotoPath],
  ['Add a phone number', (p) => p.phone],
  ['Add your location', (p) => p.location],
  ['Add your current job title', (p) => p.currentJobTitle],
  ['Add your years of experience', (p) => p.experienceYears != null],
  ['Write a short bio', (p) => p.bio],
  ['List at least three skills', (p) => (p.skills || []).length >= 3],
  ['Add a LinkedIn, GitHub or portfolio link', (p) => p.linkedinUrl || p.githubUrl || p.portfolioUrl],
  ['Upload your resume', (p) => p.resumePath],
];

function Completeness({ profile }) {
  const missing = COMPLETENESS.filter(([, has]) => !has(profile)).map(([todo]) => todo);
  const total = COMPLETENESS.length;
  const done = total - missing.length;
  return (
    <section className="jp-side-block">
      <h2 className="jp-label">Profile completeness</h2>
      <p className="jp-meter__count"><strong>{done}</strong> of {total} complete</p>
      <div className="jp-meter" role="img" aria-label={`${done} of ${total} profile items complete`}>
        {COMPLETENESS.map(([todo], i) => <span key={todo} className={i < done ? 'jp-meter__on' : undefined} />)}
      </div>
      {missing.length === 0 ? (
        <p className="jp-sm jp-muted">Everything an employer looks for is here.</p>
      ) : (
        <>
          <p className="jp-sm jp-muted">Still to do:</p>
          <ul className="jp-sm jp-meter__todo">{missing.map((todo) => <li key={todo}>{todo}</li>)}</ul>
        </>
      )}
    </section>
  );
}

function ProfileSection({ title, hint, children }) {
  return (
    <section className="jp-psec">
      <div className="jp-psec__head">
        <h2 className="jp-h2">{title}</h2>
        {hint && <p className="jp-sm jp-muted">{hint}</p>}
      </div>
      <div className="jp-psec__body">{children}</div>
    </section>
  );
}

const fileName = (path) => path?.split(/[\\/]/).pop();
// The file endpoint only serves the public photo and logo folders.
const photoUrl = (path) => (path?.startsWith('photos/') ? `${api.defaults.baseURL}/files?path=${encodeURIComponent(path)}` : undefined);

export function Profile() {
  const { user, updateUser, isJobSeeker, isEmployer } = useContext(AuthContext);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoInput = useRef(null);
  const resumeInput = useRef(null);

  const { data, isPending } = useQuery({ queryKey: ['me'], queryFn: userService.getCurrentProfile });

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting, isDirty } } = useForm({ mode: 'onBlur' });
  const skillsDraft = useWatch({ control, name: 'skills' }) || '';
  const skills = skillsDraft.split(',').map((s) => s.trim()).filter(Boolean);

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

  const visibility = useMutation({
    mutationFn: (isPublic) => userService.toggleVisibility(isPublic),
    onSuccess: (_r, isPublic) => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      toast(isPublic ? 'Your profile is public' : 'Your profile is hidden', 'success');
    },
    onError: (err) => toast(errorMessage(err, 'Could not change visibility.'), 'error'),
  });

  const onFile = (kind) => (e) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate({ kind, file });
    e.target.value = ''; // so choosing the same file again still fires
  };

  if (isPending) {
    return (
      <div className="jp-container jp-page" aria-busy="true">
        <span className="jp-sr-only">Loading your profile</span>
        <Skeleton width="30%" height={30} />
        <Skeleton width="100%" height={320} style={{ marginTop: 24, borderRadius: 8 }} />
      </div>
    );
  }

  const profile = data || {};
  const isPublic = profile.isProfilePublic !== false;
  const uploading = upload.isPending && upload.variables?.kind;

  return (
    <div className="jp-container jp-page">
      <PageHead title="Profile"
        sub={isJobSeeker ? 'Employers see this when you apply. Your skills decide which jobs are matched to you.'
          : 'Candidates see this next to the jobs you post.'} />

      <div className="jp-profile">
        <aside className="jp-profile__aside">
          <section className="jp-ident">
            <div className="jp-ident__top">
              <Monogram size="lg" name={profile.fullName || user?.fullName || ''} src={photoUrl(profile.profilePhotoPath)} />
              <div>
                <h2 className="jp-h2">{profile.fullName || user?.fullName}</h2>
                <p className="jp-sm jp-muted">
                  {profile.currentJobTitle || (isEmployer ? 'Employer' : isJobSeeker ? 'Job seeker' : 'Admin')}
                </p>
              </div>
            </div>
            <Facts className="jp-ident__facts">
              <Fact icon={Mail}>{profile.email || user?.email}</Fact>
              {profile.isEmailVerified != null && (
                <Fact icon={profile.isEmailVerified ? BadgeCheck : MailWarning}>
                  {profile.isEmailVerified ? 'Email verified' : 'Email not verified yet'}
                </Fact>
              )}
              {profile.createdAt && <Fact icon={CalendarDays}>Member since {fullDate(profile.createdAt)}</Fact>}
            </Facts>
            <input ref={photoInput} type="file" accept="image/*" hidden aria-label="Profile photo" onChange={onFile('photo')} />
            <Button size="sm" disabled={upload.isPending} onClick={() => photoInput.current?.click()}>
              {uploading === 'photo' ? 'Uploading…' : profile.profilePhotoPath ? 'Change photo' : 'Add a photo'}
            </Button>
          </section>

          {isJobSeeker && <Completeness profile={profile} />}

          <section className="jp-side-block">
            <h2 className="jp-label">Visibility</h2>
            <label className="jp-check">
              <input type="checkbox" checked={isPublic} disabled={visibility.isPending}
                onChange={(e) => visibility.mutate(e.target.checked)} />
              <span>Public profile</span>
            </label>
            <p className="jp-sm jp-muted">
              {isPublic
                ? 'Other people on JobPortal can open your profile. Your email address is never shown to them.'
                : 'Hidden. Nobody else can open your profile page.'}
            </p>
          </section>
        </aside>

        <form className="jp-profile__form" onSubmit={handleSubmit((values) => save.mutate(values))} noValidate>
          <ProfileSection title="About you" hint="The basics shown at the top of your profile.">
            <div className="jp-form-grid">
              <Input label="Full name" autoComplete="name" error={errors.fullName?.message}
                {...register('fullName', { required: 'Full name is required' })} />
              <Input label="Phone" optional type="tel" autoComplete="tel" {...register('phone')} />
              <Input label="Location" optional placeholder="Pune" {...register('location')} />
              <Input label="Current job title" optional autoComplete="organization-title" {...register('currentJobTitle')} />
              <Input label="Years of experience" type="number" min="0" optional
                error={errors.experienceYears?.message}
                {...register('experienceYears', { min: { value: 0, message: 'Cannot be negative' } })} />
            </div>
            <Textarea label="Bio" optional rows={5} hint="Two or three sentences on what you have built and what you want next."
              {...register('bio')} />
          </ProfileSection>

          <ProfileSection title="Skills" hint="Matched against the tech stack of each job.">
            <Input label="Skills" optional hint="Separate skills with commas."
              placeholder="java, spring boot, kubernetes" {...register('skills')} />
            {skills.length > 0 && (
              <ul className="jp-chips jp-skill-preview" aria-label="Skills as they will be saved">
                {skills.map((skill, i) => <li key={`${skill}-${i}`} className="jp-chip">{skill}</li>)}
              </ul>
            )}
          </ProfileSection>

          <ProfileSection title="Links" hint="Where someone can see your work.">
            <Input label="LinkedIn URL" optional type="url" placeholder="https://www.linkedin.com/in/…" {...register('linkedinUrl')} />
            <Input label="GitHub URL" optional type="url" placeholder="https://github.com/…" {...register('githubUrl')} />
            <Input label="Portfolio URL" optional type="url" placeholder="https://" {...register('portfolioUrl')} />
          </ProfileSection>

          {!isEmployer && (
            <ProfileSection title="Resume" hint="Sent to an employer only when you apply to their job.">
              <div className="jp-resume">
                <FileText size={20} aria-hidden="true" />
                <div className="jp-resume__name">
                  {profile.resumePath
                    ? <><p className="jp-resume__file">{fileName(profile.resumePath)}</p><p className="jp-sm jp-muted">Current resume</p></>
                    : <><p className="jp-resume__file">No resume uploaded</p><p className="jp-sm jp-muted">PDF or Word document</p></>}
                </div>
                <input ref={resumeInput} type="file" accept=".pdf,.doc,.docx" hidden aria-label="Resume" onChange={onFile('resume')} />
                <Button disabled={upload.isPending} onClick={() => resumeInput.current?.click()}>
                  {uploading === 'resume' ? 'Uploading…' : profile.resumePath ? 'Replace resume' : 'Upload resume'}
                </Button>
              </div>
            </ProfileSection>
          )}

          <div className="jp-savebar">
            <p className="jp-sm jp-muted" aria-live="polite">
              {isDirty ? 'You have unsaved changes.' : 'No unsaved changes.'}
            </p>
            <div className="jp-row-actions">
              {isDirty && <Button variant="ghost" onClick={() => reset()}>Discard</Button>}
              <Button type="submit" variant="primary" disabled={isSubmitting || save.isPending}>
                {save.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- not found */
export function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="jp-container jp-page jp-notfound">
      <p className="jp-label">Error 404</p>
      <h1 className="jp-hero__title">This page does not exist.</h1>
      <p className="jp-notfound__body">
        Nothing lives at <code className="jp-data">{pathname}</code>. The link may be out of date, or the
        job may have been filled and taken down.
      </p>
      <div className="jp-row-actions">
        <Link className="jp-btn jp-btn--primary jp-btn--lg" to="/jobs">Browse jobs</Link>
        <Link className="jp-btn jp-btn--secondary jp-btn--lg" to="/">Go to the home page</Link>
      </div>
    </div>
  );
}
