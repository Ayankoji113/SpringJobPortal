import React from 'react';
import { useQuery } from '@tanstack/react-query';
import * as aiService from '../services/aiService';
import { Badge, Skeleton } from './ui';
import { lakhs } from '../lib/format';
import './salarypanel.css';

const TONE = { HIGH: 'success', MEDIUM: 'warning', LOW: 'danger' };

/** Percentiles from comparable postings, with the posting's own range overlaid.
 *  The figures always render; the model's explanation may be absent. */
export function SalaryPanel({ jobId, salaryMin, salaryMax }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['salary-estimate', jobId],
    queryFn: () => aiService.getSalaryEstimate(jobId),
    retry: false,
  });

  if (isPending) {
    return (
      <section className="jp-salary">
        <Skeleton width="45%" height={14} />
        <Skeleton width="100%" height={6} style={{ marginTop: 18, borderRadius: 999 }} />
        <Skeleton width="70%" height={11} style={{ marginTop: 12 }} />
      </section>
    );
  }

  if (isError || !data) return null;

  if (!data.sampleSize) {
    return (
      <section className="jp-salary">
        <h2 className="jp-h3">Market range</h2>
        <p className="jp-sm jp-muted">
          No comparable postings with salary data yet, so there is nothing to compare this against.
        </p>
      </section>
    );
  }

  const { p25, p50, p75, sampleSize, confidence, narrative } = data;

  // Scale the track a little wider than the p25–p75 band so both ends breathe.
  const span = Math.max(p75 - p25, 1);
  const lo = p25 - span * 0.35;
  const hi = p75 + span * 0.35;
  const pct = (v) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));

  const hasOwnRange = salaryMin != null && salaryMax != null;

  return (
    <section className="jp-salary">
      <div className="jp-salary__head">
        <h2 className="jp-h3">Market range</h2>
        <Badge tone={TONE[confidence] || 'neutral'}>{confidence} confidence</Badge>
      </div>
      <p className="jp-sm jp-muted">Based on {sampleSize} comparable {sampleSize === 1 ? 'posting' : 'postings'}</p>

      <div className="jp-salary__track" role="img"
        aria-label={`Market range: 25th percentile ${lakhs(p25)}, median ${lakhs(p50)}, 75th percentile ${lakhs(p75)}`}>
        <span className="jp-salary__band" style={{ left: `${pct(p25)}%`, right: `${100 - pct(p75)}%` }} />
        <span className="jp-salary__median" style={{ left: `${pct(p50)}%` }} />
        {hasOwnRange && (
          <span
            className="jp-salary__own"
            style={{ left: `${pct(Number(salaryMin))}%`, right: `${100 - pct(Number(salaryMax))}%` }}
          />
        )}
      </div>

      <div className="jp-salary__scale jp-data">
        <span>{lakhs(p25)}<span className="jp-salary__tick">p25</span></span>
        <span>{lakhs(p50)}<span className="jp-salary__tick">median</span></span>
        <span>{lakhs(p75)}<span className="jp-salary__tick">p75</span></span>
      </div>

      {hasOwnRange && (
        <p className="jp-sm jp-salary__legend">
          <span className="jp-salary__swatch" aria-hidden="true" /> This posting: {lakhs(salaryMin)} – {lakhs(salaryMax)}
        </p>
      )}

      {narrative ? (
        <dl className="jp-salary__narrative">
          <dt className="jp-label">What drives it</dt>
          <dd>{narrative.rangeDrivers}</dd>
          <dt className="jp-label">Where this sits</dt>
          <dd>{narrative.positioning}</dd>
          <dt className="jp-label">Outlier check</dt>
          <dd>{narrative.outlierAssessment}</dd>
        </dl>
      ) : (
        <p className="jp-sm jp-muted jp-salary__narrative">
          The written explanation is unavailable right now. The figures above are unaffected.
        </p>
      )}
    </section>
  );
}
