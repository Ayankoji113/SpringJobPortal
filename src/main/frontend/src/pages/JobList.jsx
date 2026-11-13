import React, { useContext, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import * as jobService from '../services/jobService';
import { errorMessage } from '../services/api';
import { AuthContext } from '../context/auth-context';
import { JobRow, JobRowSkeletonList } from '../components/JobRow';
import { Button, EmptyState, Input, Modal, Select } from '../components/ui';
import { useToast } from '../components/ui/toast-context';
import { JOB_TYPES, jobTypeLabel } from '../lib/format';
import './joblist.css';

const PAGE_SIZE = 10;
const FILTER_KEYS = ['keyword', 'location', 'jobType', 'isRemote', 'minExp', 'maxExp'];
const EMPTY = { keyword: '', location: '', jobType: '', isRemote: '', minExp: '', maxExp: '' };

/* Only /jobs/search sorts; these are its sortBy/sortDir parameters. */
const SORTS = {
  newest: { label: 'Newest first', sortBy: 'postedDate', sortDir: 'desc' },
  pay: { label: 'Highest pay', sortBy: 'salaryMax', sortDir: 'desc' },
};

function chipText(key, value) {
  switch (key) {
    case 'keyword': return `“${value}”`;
    case 'jobType': return jobTypeLabel(value);
    case 'isRemote': return 'Remote only';
    case 'minExp': return `At least ${value} yrs`;
    case 'maxExp': return `At most ${value} yrs`;
    default: return value;
  }
}

/** Everything except the search bar: type, remote, experience. */
function Refine({ draft, setDraft, onApply, onClear, activeCount, idPrefix }) {
  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });
  return (
    <form className="jp-refine" onSubmit={(e) => { e.preventDefault(); onApply(); }}>
      <fieldset className="jp-refine__group">
        <legend className="jp-refine__legend">Job type</legend>
        {[['', 'Any type'], ...JOB_TYPES].map(([value, text]) => (
          <label key={value || 'any'} className="jp-refine__option">
            <input type="radio" name={`${idPrefix}-jobType`} value={value}
              checked={draft.jobType === value} onChange={set('jobType')} />
            {text}
          </label>
        ))}
      </fieldset>

      <fieldset className="jp-refine__group">
        <legend className="jp-refine__legend">Workplace</legend>
        <label className="jp-refine__option">
          <input type="checkbox" checked={draft.isRemote === 'true'}
            onChange={(e) => setDraft({ ...draft, isRemote: e.target.checked ? 'true' : '' })} />
          Remote only
        </label>
      </fieldset>

      <fieldset className="jp-refine__group">
        <legend className="jp-refine__legend">Experience in years</legend>
        <div className="jp-refine__pair">
          <Input label="From" type="number" min="0" inputMode="numeric" placeholder="0"
            value={draft.minExp} onChange={set('minExp')} />
          <Input label="To" type="number" min="0" inputMode="numeric" placeholder="Any"
            value={draft.maxExp} onChange={set('maxExp')} />
        </div>
      </fieldset>

      <div className="jp-refine__actions">
        <Button type="submit" variant="primary" block>Show results</Button>
        {activeCount > 0 && <Button type="button" variant="ghost" block onClick={onClear}>Clear all filters</Button>}
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

  // The URL is the state: /jobs?keyword=..&location=.. from the home hero lands pre-filled,
  // and every search writes back to it so results can be shared.
  const applied = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'newest';
  const page = Number(params.get('page') || 0);
  const active = FILTER_KEYS.filter((k) => applied[k]);
  const activeCount = active.length;
  const refineCount = active.filter((k) => k !== 'keyword' && k !== 'location').length;

  /* Re-initialise the draft when the URL changes (back/forward, chip removal)
     without syncing state inside an effect. */
  const [draft, setDraft] = useState(applied);
  const [draftKey, setDraftKey] = useState(params.toString());
  if (draftKey !== params.toString()) {
    setDraftKey(params.toString());
    setDraft(applied);
  }

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['jobs', applied, sort, page],
    queryFn: () => {
      if (activeCount === 0 && sort === 'newest') return jobService.getJobsPaginated(page, PAGE_SIZE);
      const query = { page, size: PAGE_SIZE, sortBy: SORTS[sort].sortBy, sortDir: SORTS[sort].sortDir };
      active.forEach((k) => { query[k] = applied[k]; });
      return jobService.searchJobsAdvanced(query);
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

  /** Writes filters + sort to the URL; any change of criteria starts again at page one. */
  const commit = (filters, nextSort = sort) => {
    const p = new URLSearchParams();
    FILTER_KEYS.forEach((k) => { const v = String(filters[k] ?? '').trim(); if (v) p.set(k, v); });
    if (nextSort !== 'newest') p.set('sort', nextSort);
    setParams(p);
  };

  const applyFilters = () => { commit(draft); setDrawerOpen(false); };
  const clearFilters = () => { setDraft(EMPTY); commit(EMPTY); setDrawerOpen(false); };
  const removeFilter = (key) => commit({ ...applied, [key]: '' });

  const setPage = (next) => {
    const p = new URLSearchParams(params);
    p.set('page', String(next));
    setParams(p);
    window.scrollTo({ top: 0 });
  };

  const jobs = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalJobs = data?.totalElements ?? 0;
  const first = page * PAGE_SIZE + 1;
  const last = page * PAGE_SIZE + jobs.length;

  const refineProps = { draft, setDraft, onApply: applyFilters, onClear: clearFilters, activeCount };

  return (
    <div className="jp-container jp-page jp-jobs">
      <h1 className="jp-display">Find a job</h1>

      <form className="jp-jobs__search" role="search" onSubmit={(e) => { e.preventDefault(); applyFilters(); }}>
        <label className="jp-jobs__field">
          <Search size={17} aria-hidden="true" />
          <span className="jp-sr-only">Keyword</span>
          <input type="search" placeholder="Job title, skill or keyword" value={draft.keyword}
            onChange={(e) => setDraft({ ...draft, keyword: e.target.value })} />
        </label>
        <label className="jp-jobs__field">
          <MapPin size={17} aria-hidden="true" />
          <span className="jp-sr-only">Location</span>
          <input type="text" placeholder="City, or Remote" value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
        </label>
        <Button type="submit" variant="primary" size="lg" className="jp-jobs__go">Search</Button>
      </form>

      <div className="jp-jobs__grid">
        <aside className="jp-jobs__rail" aria-labelledby="jp-refine-title">
          <h2 id="jp-refine-title" className="jp-h3">Filters</h2>
          <Refine {...refineProps} idPrefix="rail" />
        </aside>

        <section className="jp-jobs__results" aria-labelledby="jp-results-count">
          <div className="jp-jobs__bar">
            <p id="jp-results-count" className="jp-jobs__count" aria-live="polite">
              {isPending ? 'Searching…' : isError ? 'Results unavailable' : (
                <>
                  <strong>{totalJobs}</strong> {totalJobs === 1 ? 'opening' : 'openings'}
                  {totalPages > 1 && <span className="jp-muted">, showing {first} to {last}</span>}
                </>
              )}
            </p>
            <div className="jp-jobs__tools">
              <Button className="jp-filters__trigger" onClick={() => setDrawerOpen(true)}>
                <SlidersHorizontal size={15} aria-hidden="true" />
                Filters{refineCount > 0 && <span className="jp-jobs__trigger-count">{refineCount}</span>}
              </Button>
              <div className="jp-jobs__sort">
                <Select label="Sort by" value={sort} onChange={(e) => commit(applied, e.target.value)}>
                  {Object.entries(SORTS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
                </Select>
              </div>
            </div>
          </div>

          {activeCount > 0 && (
            <ul className="jp-fchips" aria-label="Active filters">
              {active.map((key) => (
                <li key={key}>
                  <button type="button" className="jp-fchip" onClick={() => removeFilter(key)}
                    aria-label={`Remove filter: ${chipText(key, applied[key])}`}>
                    {chipText(key, applied[key])}
                    <X size={13} aria-hidden="true" />
                  </button>
                </li>
              ))}
              {activeCount > 1 && (
                <li><button type="button" className="jp-fchips__clear" onClick={clearFilters}>Clear all</button></li>
              )}
            </ul>
          )}

          {isPending && <JobRowSkeletonList count={6} />}

          {isError && !isPending && (
            <EmptyState
              title="Could not load jobs"
              body={`${errorMessage(error, 'The job service did not respond.')} Your filters are kept; try again.`}
              action={<Button variant="primary" onClick={() => queryClient.invalidateQueries({ queryKey: ['jobs'] })}>Try again</Button>}
            />
          )}

          {!isPending && !isError && jobs.length === 0 && (
            <EmptyState
              title={activeCount ? 'No jobs match these filters' : 'No jobs posted yet'}
              body={activeCount
                ? 'Remove a filter above, widen the experience range, or clear everything to see all openings.'
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
                  <Button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous page</Button>
                  <span className="jp-sm jp-muted">Page {page + 1} of {totalPages}</span>
                  <Button disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next page</Button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>

      <Modal open={drawerOpen} onOpenChange={setDrawerOpen} title="Filters" variant="drawer">
        <Refine {...refineProps} idPrefix="drawer" />
      </Modal>
    </div>
  );
}
