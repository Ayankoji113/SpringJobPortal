import React, { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Gauge } from 'lucide-react';
import * as aiService from '../services/aiService';
import { AuthContext } from '../context/auth-context';
import { Skeleton } from './ui';
import { Fact, Facts } from './ui/kit';
import { lakhs, salaryRange } from '../lib/format';
import './salarypanel.css';

const CONFIDENCE = { HIGH: 'High confidence', MEDIUM: 'Medium confidence', LOW: 'Low confidence' };
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** Where this job's range sits, said in words so the chart is never the only cue. */
function positionText(mid, { p25, p50, p75 }) {
  if (mid == null || p50 == null) return null;
  if (p25 != null && mid < p25) return 'Below most comparable postings';
  if (p75 != null && mid > p75) return 'Above most comparable postings';
  if (Math.abs(mid - p50) <= (p75 != null && p25 != null ? (p75 - p25) * 0.1 : p50 * 0.05)) return 'Close to the market median';
  return mid < p50 ? 'In the lower half of the market' : 'In the upper half of the market';
}

/** Percentiles from comparable postings, with the posting's own range drawn against them.
 *  The figures always render; the model's explanation may be absent. */
export function SalaryPanel({ jobId, salaryMin, salaryMax }) {
  const { isAuthenticated } = useContext(AuthContext);
  const location = useLocation();
  const { data, isPending, isError } = useQuery({
    queryKey: ['salary-estimate', jobId],
    queryFn: () => aiService.getSalaryEstimate(jobId),
    retry: false,
    // The estimate is for signed-in users; asking without a session only earns a refusal.
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return (
      <section className="jp-salary" aria-labelledby="jp-salary-title">
        <h2 id="jp-salary-title" className="jp-h3">Market range</h2>
        <p className="jp-sm jp-muted jp-salary__note">
          <Link to="/login" state={{ from: location.pathname }}>Sign in</Link> to see how this pay compares
          with similar roles.
        </p>
      </section>
    );
  }

  if (isPending) {
    return (
      <section className="jp-salary" aria-busy="true">
        <Skeleton width="45%" height={15} />
        <Skeleton width="100%" height={10} style={{ marginTop: 22 }} />
        <Skeleton width="60%" height={10} style={{ marginTop: 12 }} />
        <Skeleton width="80%" height={11} style={{ marginTop: 18 }} />
      </section>
    );
  }

  if (isError || !data) return null;

  const p25 = num(data.p25);
  const p50 = num(data.p50);
  const p75 = num(data.p75);
  const { sampleSize, confidence, narrative } = data;

  if (!sampleSize || (p25 == null && p50 == null && p75 == null)) {
    return (
      <section className="jp-salary" aria-labelledby="jp-salary-title">
        <h2 id="jp-salary-title" className="jp-h3">Market range</h2>
        <p className="jp-sm jp-muted jp-salary__note">
          No comparable postings with pay data yet, so there is nothing to compare this range against.
        </p>
      </section>
    );
  }

  const lo = num(salaryMin);
  const hi = num(salaryMax);
  const own = lo != null || hi != null;
  const ownMid = lo != null && hi != null ? (lo + hi) / 2 : (lo ?? hi);

  // Scale: the market band plus a margin, widened to include this job's range.
  const known = [p25, p50, p75].filter((v) => v != null);
  const bandLo = Math.min(...known);
  const bandHi = Math.max(...known);
  const pad = Math.max(bandHi - bandLo, bandHi * 0.2, 1) * 0.35;
  const min = Math.min(bandLo - pad, lo ?? Infinity, hi ?? Infinity);
  const max = Math.max(bandHi + pad, hi ?? -Infinity, lo ?? -Infinity);
  const pct = (v) => ((v - min) / (max - min)) * 100;

  const marks = [['P25', p25], ['Median', p50], ['P75', p75]].filter(([, v]) => v != null);
  const position = positionText(ownMid, { p25, p50, p75 });
  const summary = `Market: ${marks.map(([l, v]) => `${l} ${lakhs(v)}`).join(', ')}. `
    + (own ? `This job: ${salaryRange(lo, hi)}.` : 'This job does not disclose pay.');

  return (
    <section className="jp-salary" aria-labelledby="jp-salary-title">
      <h2 id="jp-salary-title" className="jp-h3">Market range</h2>
      <Facts className="jp-salary__facts">
        <Fact icon={BarChart3}>{sampleSize} comparable {sampleSize === 1 ? 'posting' : 'postings'}</Fact>
        {CONFIDENCE[confidence] && <Fact icon={Gauge}>{CONFIDENCE[confidence]}</Fact>}
      </Facts>

      <figure className="jp-salary__chart">
        <div role="img" aria-label={summary}>
          <div className="jp-salary__row">
            <span className="jp-salary__rowlabel" aria-hidden="true">Market</span>
            <div className="jp-salary__track">
              {p25 != null && p75 != null && (
                <span className="jp-salary__band" style={{ left: `${pct(p25)}%`, width: `${pct(p75) - pct(p25)}%` }} />
              )}
              {marks.map(([label, v]) => (
                <span key={label} className={label === 'Median' ? 'jp-salary__mark jp-salary__mark--median' : 'jp-salary__mark'}
                  style={{ left: `${pct(v)}%` }}>
                  <span className="jp-salary__marklabel" aria-hidden="true">{label}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="jp-salary__row">
            <span className="jp-salary__rowlabel" aria-hidden="true">This job</span>
            <div className="jp-salary__track jp-salary__track--own">
              {own && (lo != null && hi != null
                ? <span className="jp-salary__own" style={{ left: `${pct(lo)}%`, width: `${Math.max(pct(hi) - pct(lo), 1)}%` }} />
                : <span className="jp-salary__own jp-salary__own--point" style={{ left: `${pct(ownMid)}%` }} />)}
            </div>
          </div>
        </div>

        <figcaption>
          <dl className="jp-salary__figures">
            {marks.map(([label, v]) => (
              <div key={label} className={label === 'Median' ? 'jp-salary__fig jp-salary__fig--median' : 'jp-salary__fig'}>
                <dt>{label}</dt>
                <dd className="jp-data">{lakhs(v)}</dd>
              </div>
            ))}
          </dl>
          <p className="jp-salary__verdict">
            <span className="jp-salary__key" aria-hidden="true" />
            <span>
              <strong>This job {own ? <span className="jp-data">{salaryRange(lo, hi)}</span> : 'does not disclose pay'}</strong>
              {position && <span className="jp-salary__position">{position}</span>}
            </span>
          </p>
        </figcaption>
      </figure>

      {narrative ? (
        <dl className="jp-salary__narrative">
          {[['What drives the range', narrative.rangeDrivers], ['Where this job sits', narrative.positioning], ['Outlier check', narrative.outlierAssessment]]
            .filter(([, text]) => text)
            .map(([title, text]) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{text}</dd>
              </div>
            ))}
        </dl>
      ) : (
        <p className="jp-sm jp-muted jp-salary__note">
          The written explanation is unavailable right now. The figures above are unaffected.
        </p>
      )}
    </section>
  );
}
