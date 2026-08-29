import React, { useContext, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import * as jobService from '../services/jobService';
import { errorMessage } from '../services/api';
import { AuthContext } from '../context/auth-context';
import { JobRow, JobRowSkeletonList } from '../components/JobRow';
import { Button, EmptyState, Input, Modal, Select } from '../components/ui';
import { useToast } from '../components/ui/toast-context';
import { JOB_TYPES } from '../lib/format';
import './joblist.css';

const PAGE_SIZE = 10;
const EMPTY = { keyword: '', location: '', jobType: '', minExp: '', maxExp: '' };

function FilterForm({ draft, setDraft, onApply, onClear, activeCount }) {
  return (
    <form
      className="jp-filters"
      onSubmit={(e) => { e.preventDefault(); onApply(); }}
    >
      <Input
        label="Keyword"
        placeholder="Title or description"
        value={draft.keyword}
        onChange={(e) => setDraft({ ...draft, keyword: e.target.value })}
      />
      <Input
        label="Location"
        placeholder="Pune, Remote…"
        value={draft.location}
        onChange={(e) => setDraft({ ...draft, location: e.target.value })}
      />
      <Select
        label="Job type"
        value={draft.jobType}
        onChange={(e) => setDraft({ ...draft, jobType: e.target.value })}
      >
        <option value="">Any</option>
        {JOB_TYPES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </Select>
      <div className="jp-filters__pair">
        <Input
          label="Min years"
          type="number"
          min="0"
          value={draft.minExp}
          onChange={(e) => setDraft({ ...draft, minExp: e.target.value })}
        />
        <Input
          label="Max years"
          type="number"
          min="0"
          value={draft.maxExp}
          onChange={(e) => setDraft({ ...draft, maxExp: e.target.value })}
        />
      </div>
      <div className="jp-filters__actions">
        <Button type="submit" variant="primary" block>Apply filters</Button>
        {activeCount > 0 && <Button type="button" variant="ghost" block onClick={onClear}>Clear all</Button>}
      </div>
    </form>
  );
}

export function JobList() {
  const [params, setParams] = useSearchParams();
  const { isJobSeeker } = useContext(AuthContext);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const applied = {
    keyword: params.get('keyword') || '',
    location: params.get('location') || '',
    jobType: params.get('jobType') || '',
    minExp: params.get('minExp') || '',
    maxExp: params.get('maxExp') || '',
  };
  const page = Number(params.get('page') || 0);
  const activeCount = Object.values(applied).filter(Boolean).length;

  /* Keyed by the query string: when the URL changes the draft is re-initialised
     by remounting, which avoids syncing state inside an effect. */
  const [draft, setDraft] = useState(applied);
  const [draftKey, setDraftKey] = useState(params.toString());
  if (draftKey !== params.toString()) {
    setDraftKey(params.toString());
    setDraft(applied);
  }

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['jobs', applied, page],
    queryFn: () => {
      const query = { page, size: PAGE_SIZE };
      Object.entries(applied).forEach(([k, v]) => { if (v) query[k] = v; });
      return activeCount > 0
        ? jobService.searchJobsAdvanced(query)
        : jobService.getJobsPaginated(page, PAGE_SIZE);
    },
  });

  const { data: savedJobs } = useQuery({
    queryKey: ['saved-jobs'],
    queryFn: jobService.getSavedJobs,
    enabled: isJobSeeker,
  });
  const savedIds = new Set((savedJobs || []).map((s) => s.jobPost?.postId));

  const toggleSave = useMutation({
    mutationFn: ({ job, saved }) => (saved ? jobService.unsaveJob(job.postId) : jobService.saveJob(job.postId)),
    onSuccess: (_result, { job, saved }) => {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs'] });
      toast(saved ? `Removed ${job.postProfile}` : `Saved ${job.postProfile}`, 'success');
    },
    onError: (err) => toast(errorMessage(err, 'Could not update saved jobs.'), 'error'),
  });

  const setPage = (next) => {
    const p = new URLSearchParams(params);
    p.set('page', String(next));
    setParams(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const applyFilters = () => {
    const p = new URLSearchParams();
    Object.entries(draft).forEach(([k, v]) => { if (v) p.set(k, v); });
    setParams(p);
    setDrawerOpen(false);
  };

  const clearFilters = () => {
    setDraft(EMPTY);
    setParams(new URLSearchParams());
    setDrawerOpen(false);
  };

  const jobs = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalJobs = data?.totalElements ?? 0;

  return (
    <div className="jp-container jp-page">
      <div className="jp-page-head">
        <div>
          <h1 className="jp-display">Jobs</h1>
          <p className="jp-sm jp-muted">
            {isPending ? 'Searching…' : `${totalJobs} ${totalJobs === 1 ? 'opening' : 'openings'}${activeCount ? ' matching your filters' : ''}`}
          </p>
        </div>
        <Button className="jp-filters__trigger" onClick={() => setDrawerOpen(true)}>
          <SlidersHorizontal size={15} aria-hidden="true" />
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </Button>
      </div>

      <div className="jp-joblist">
        <aside className="jp-joblist__rail" aria-label="Filters">
          <FilterForm draft={draft} setDraft={setDraft} onApply={applyFilters} onClear={clearFilters} activeCount={activeCount} />
        </aside>

        <div className="jp-joblist__results">
          {isPending && <JobRowSkeletonList />}

          {isError && !isPending && (
            <EmptyState
              title="Could not load jobs"
              body={errorMessage(error)}
              action={<Button variant="primary" onClick={() => queryClient.invalidateQueries({ queryKey: ['jobs'] })}>Retry</Button>}
            />
          )}

          {!isPending && !isError && jobs.length === 0 && (
            <EmptyState
              title={activeCount ? 'No jobs match these filters' : 'No jobs posted yet'}
              body={activeCount
                ? 'Try widening the experience range or clearing the location.'
                : 'Once employers start posting, openings will appear here.'}
              action={activeCount ? <Button variant="primary" onClick={clearFilters}>Clear filters</Button> : null}
            />
          )}

          {!isPending && !isError && jobs.length > 0 && (
            <>
              <div className="jp-list">
                {jobs.map((job) => (
                  <JobRow
                    key={job.postId}
                    job={job}
                    saved={savedIds.has(job.postId)}
                    onToggleSave={isJobSeeker ? (j) => toggleSave.mutate({ job: j, saved: savedIds.has(j.postId) }) : undefined}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <nav className="jp-pagination" aria-label="Pagination">
                  <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
                  <span className="jp-sm jp-muted">Page {page + 1} of {totalPages}</span>
                  <Button size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      <Modal open={drawerOpen} onOpenChange={setDrawerOpen} title="Filters" variant="drawer">
        <FilterForm draft={draft} setDraft={setDraft} onApply={applyFilters} onClear={clearFilters} activeCount={activeCount} />
      </Modal>
    </div>
  );
}
