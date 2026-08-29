import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Trash2, X } from 'lucide-react';
import * as jobService from '../services/jobService';
import * as dashboardService from '../services/dashboardService';
import { errorMessage } from '../services/api';
import { Badge, Button, Card, CardBody, CardHead, EmptyState, IconButton, Input, Modal, Select, Skeleton, Textarea } from '../components/ui';
import { useToast } from '../components/ui/toast-context';
import { APPLICATION_STATUSES, JOB_TYPES, relativeDate, salaryRange, statusTone, titleCase } from '../lib/format';
import './pages.css';

/* -------------------------------------------------------------------- dashboard */
export function EmployerDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState(null);

  const stats = useQuery({ queryKey: ['dashboard'], queryFn: dashboardService.getEmployerDashboard, retry: false });
  const jobs = useQuery({ queryKey: ['my-jobs'], queryFn: jobService.getMyJobs });

  const remove = useMutation({
    mutationFn: (jobId) => jobService.deleteJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setPendingDelete(null);
      toast('Posting deleted', 'success');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  const tiles = [
    ['Active postings', stats.data?.totalJobs],
    ['Applications received', stats.data?.totalApplications],
    ['Profile views', stats.data?.totalViews],
  ];

  return (
    <div className="jp-container jp-page">
      <div className="jp-page-head">
        <div>
          <h1 className="jp-display">Dashboard</h1>
          <p className="jp-sm jp-muted">Your postings and the applications they have drawn.</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/post-job')}>Post a job</Button>
      </div>

      <div className="jp-stats">
        {tiles.map(([label, value]) => (
          <div key={label} className="jp-stat">
            <span className="jp-label">{label}</span>
            {stats.isPending
              ? <Skeleton width={56} height={28} style={{ marginTop: 10 }} />
              : <span className="jp-stat__value">{value ?? 0}</span>}
          </div>
        ))}
      </div>

      <Card flush>
        <CardHead title="Your postings">
          <Link to="/manage-applications" className="jp-sm">Review applications →</Link>
        </CardHead>
        <CardBody>
          {jobs.isPending && (
            <div style={{ padding: 'var(--jp-space-5)' }}>
              <Skeleton width="100%" height={14} />
              <Skeleton width="80%" height={14} style={{ marginTop: 12 }} />
              <Skeleton width="60%" height={14} style={{ marginTop: 12 }} />
            </div>
          )}

          {jobs.isError && !jobs.isPending && (
            <div style={{ padding: 'var(--jp-space-5)' }}>
              <EmptyState title="Could not load your postings" body={errorMessage(jobs.error)}
                action={<Button variant="primary" onClick={() => jobs.refetch()}>Retry</Button>} />
            </div>
          )}

          {!jobs.isPending && !jobs.isError && jobs.data.length === 0 && (
            <div style={{ padding: 'var(--jp-space-5)' }}>
              <EmptyState
                title="No postings yet"
                body="Publish your first opening and it will appear in the public listing straight away."
                action={<Button variant="primary" onClick={() => navigate('/post-job')}>Post a job</Button>}
              />
            </div>
          )}

          {!jobs.isPending && !jobs.isError && jobs.data.length > 0 && (
            <div className="jp-table-wrap">
              <table className="jp-table">
                <thead>
                  <tr>
                    <th scope="col">Role</th>
                    <th scope="col">Location</th>
                    <th scope="col">Salary</th>
                    <th scope="col">Views</th>
                    <th scope="col">Posted</th>
                    <th scope="col"><span className="jp-sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.data.map((job) => (
                    <tr key={job.postId}>
                      <td><Link to={`/job/${job.postId}`}>{job.postProfile}</Link></td>
                      <td>{job.isRemote ? 'Remote' : job.location || '—'}</td>
                      <td className="jp-data">{salaryRange(job.salaryMin, job.salaryMax)}</td>
                      <td className="jp-data">{job.viewCount ?? 0}</td>
                      <td className="jp-sm jp-muted">{relativeDate(job.postedDate)}</td>
                      <td>
                        <div className="jp-row">
                          <Button size="sm" onClick={() => navigate(`/post-job/${job.postId}`)}>Edit</Button>
                          <IconButton label={`Delete ${job.postProfile}`} onClick={() => setPendingDelete(job)}>
                            <Trash2 size={15} aria-hidden="true" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this posting?"
        description={pendingDelete ? `“${pendingDelete.postProfile}” will stop appearing in the listing.` : ''}
        footer={
          <>
            <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => remove.mutate(pendingDelete.postId)} disabled={remove.isPending}>
              {remove.isPending ? 'Deleting…' : 'Delete posting'}
            </Button>
          </>
        }
      >
        <p className="jp-sm">Applications already received are kept, but candidates can no longer find or apply to it.</p>
      </Modal>
    </div>
  );
}

/* ---------------------------------------------------------- manage applications */
export function ManageApplications() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [jobId, setJobId] = useState('');

  const jobs = useQuery({ queryKey: ['my-jobs'], queryFn: jobService.getMyJobs });
  const selected = jobId || jobs.data?.[0]?.postId || '';

  const applications = useQuery({
    queryKey: ['applications', selected],
    queryFn: () => jobService.getApplicationsForJob(selected),
    enabled: Boolean(selected),
  });

  const setStatus = useMutation({
    mutationFn: ({ applicationId, status }) => jobService.updateApplicationStatus(applicationId, status),
    onSuccess: (_r, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['applications', selected] });
      toast(`Marked as ${titleCase(status)}`, 'success');
    },
    onError: (err) => toast(errorMessage(err), 'error'),
  });

  return (
    <div className="jp-container jp-page">
      <div className="jp-page-head">
        <div>
          <h1 className="jp-display">Applications</h1>
          <p className="jp-sm jp-muted">Review candidates and move them through your process.</p>
        </div>
      </div>

      {jobs.isPending && <Skeleton width={280} height={36} />}

      {!jobs.isPending && (jobs.data?.length || 0) === 0 && (
        <EmptyState
          title="No postings to review"
          body="Applications appear here once you have published a job and candidates have applied."
          action={<Link to="/post-job"><Button variant="primary">Post a job</Button></Link>}
        />
      )}

      {!jobs.isPending && (jobs.data?.length || 0) > 0 && (
        <>
          <div style={{ maxWidth: 360, marginBottom: 'var(--jp-space-5)' }}>
            <Select label="Posting" value={selected} onChange={(e) => setJobId(e.target.value)}>
              {jobs.data.map((job) => (
                <option key={job.postId} value={job.postId}>{job.postProfile}</option>
              ))}
            </Select>
          </div>

          {applications.isPending && <Skeleton width="100%" height={120} />}

          {applications.isError && !applications.isPending && (
            <EmptyState title="Could not load applications" body={errorMessage(applications.error)}
              action={<Button variant="primary" onClick={() => applications.refetch()}>Retry</Button>} />
          )}

          {!applications.isPending && !applications.isError && applications.data.length === 0 && (
            <EmptyState
              title="No applications for this posting yet"
              body="Sharing the job link is the quickest way to get the first few."
            />
          )}

          {!applications.isPending && !applications.isError && applications.data.length > 0 && (
            <Card flush>
              <CardBody>
                <div className="jp-table-wrap">
                  <table className="jp-table">
                    <thead>
                      <tr>
                        <th scope="col">Candidate</th>
                        <th scope="col">Applied</th>
                        <th scope="col">Cover letter</th>
                        <th scope="col">Status</th>
                        <th scope="col">Set status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.data.map((app) => (
                        <tr key={app.id}>
                          <td>
                            <strong>{app.applicant?.fullName}</strong>
                            <br />
                            <span className="jp-sm jp-muted">{app.applicant?.email}</span>
                          </td>
                          <td className="jp-sm jp-muted">{relativeDate(app.appliedDate)}</td>
                          <td className="jp-sm">{app.coverLetter ? `${app.coverLetter.slice(0, 90)}${app.coverLetter.length > 90 ? '…' : ''}` : '—'}</td>
                          <td><Badge tone={statusTone(app.status)}>{titleCase(app.status)}</Badge></td>
                          <td>
                            <select
                              className="jp-select"
                              aria-label={`Set status for ${app.applicant?.fullName}`}
                              value={app.status}
                              onChange={(e) => setStatus.mutate({ applicationId: app.id, status: e.target.value })}
                            >
                              {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------- post job */
export function PostJob() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tech, setTech] = useState([]);
  const [techInput, setTechInput] = useState('');

  const existing = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobService.getJobById(id),
    enabled: isEdit,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    mode: 'onBlur',
    defaultValues: {
      postProfile: '', postDesc: '', reqExperience: 0,
      location: '', jobType: 'FULL_TIME', isRemote: false,
      salaryMin: '', salaryMax: '',
    },
  });

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
      });
      setTech(existing.data.postTechStack || []);
    }
  }, [existing.data, reset]);

  const save = useMutation({
    mutationFn: (values) => {
      const payload = {
        ...values,
        reqExperience: Number(values.reqExperience) || 0,
        salaryMin: values.salaryMin === '' ? null : Number(values.salaryMin),
        salaryMax: values.salaryMax === '' ? null : Number(values.salaryMax),
        postTechStack: tech,
        isActive: true,
      };
      return isEdit ? jobService.updateJob(id, payload) : jobService.createJob(payload);
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast(isEdit ? 'Posting updated' : 'Posting published', 'success');
      navigate(`/job/${job.postId}`);
    },
    onError: (err) => toast(errorMessage(err, 'Could not save the posting.'), 'error'),
  });

  const addTech = () => {
    const value = techInput.trim();
    if (value && !tech.includes(value)) setTech([...tech, value]);
    setTechInput('');
  };

  return (
    <div className="jp-container jp-page">
      <div className="jp-page-head">
        <div>
          <h1 className="jp-display">{isEdit ? 'Edit posting' : 'Post a job'}</h1>
          <p className="jp-sm jp-muted">
            Salary and location are what let candidates filter and compare — postings without them are much harder to find.
          </p>
        </div>
      </div>

      <form className="jp-form" onSubmit={handleSubmit((values) => save.mutate(values))} noValidate>
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
          rows={7}
          placeholder="What the role involves, the team, and what you expect from candidates."
          error={errors.postDesc?.message}
          {...register('postDesc')}
        />

        <div className="jp-form-grid">
          <Input
            label="Location"
            placeholder="Pune"
            error={errors.location?.message}
            {...register('location')}
          />
          <Select label="Job type" {...register('jobType')}>
            {JOB_TYPES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </Select>

          <Input
            label="Minimum salary (₹ per year)"
            type="number"
            min="0"
            step="10000"
            placeholder="1800000"
            hint="Leave blank if you would rather not publish it."
            error={errors.salaryMin?.message}
            {...register('salaryMin', { min: { value: 0, message: 'Salary cannot be negative' } })}
          />
          <Input
            label="Maximum salary (₹ per year)"
            type="number"
            min="0"
            step="10000"
            placeholder="2400000"
            error={errors.salaryMax?.message}
            {...register('salaryMax', { min: { value: 0, message: 'Salary cannot be negative' } })}
          />

          <Input
            label="Required experience (years)"
            type="number"
            min="0"
            error={errors.reqExperience?.message}
            {...register('reqExperience', { min: { value: 0, message: 'Experience cannot be negative' } })}
          />

          <div className="jp-field" style={{ justifyContent: 'flex-end' }}>
            <label className="jp-row" style={{ gap: 'var(--jp-space-2)' }}>
              <input type="checkbox" {...register('isRemote')} />
              <span className="jp-sm">This role is remote</span>
            </label>
          </div>
        </div>

        <div className="jp-field">
          <span className="jp-field__label">Tech stack</span>
          <div className="jp-row">
            <input
              className="jp-input"
              value={techInput}
              onChange={(e) => setTechInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTech(); } }}
              placeholder="Type a skill and press Enter"
              aria-label="Add a skill"
            />
            <Button onClick={addTech}>Add</Button>
          </div>
          {tech.length > 0 && (
            <ul className="jp-chips" style={{ marginTop: 'var(--jp-space-2)', listStyle: 'none' }}>
              {tech.map((t) => (
                <li key={t} className="jp-chip">
                  {t}
                  <button type="button" aria-label={`Remove ${t}`} onClick={() => setTech(tech.filter((x) => x !== t))}>
                    <X size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="jp-form__actions">
          <Button type="submit" variant="primary" disabled={isSubmitting || save.isPending}>
            {save.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Publish posting'}
          </Button>
          <Button onClick={() => navigate(-1)}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
