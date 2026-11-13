/* Product-specific primitives. `index.jsx` holds the generic controls (Button, Input, Modal…);
   everything here exists because this is a job board that makes three promises: the listing is
   real, the pay is shown, and the employer answers. */
import React, { useState } from 'react';
import { BadgeCheck, Banknote, Clock } from 'lucide-react';
import { fullDate } from '../../lib/format';
import './kit.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const DAY = 86400000;
const daysBetween = (from, to) => Math.floor((new Date(to).getTime() - new Date(from).getTime()) / DAY);

/* ------------------------------------------------------------ ResponseClock
   The signature element: one tick per day of the employer's response window.
   Waiting  — elapsed days filled in marigold, the rest open.
   Answered — the days it took, filled in teal.
   Lapsed   — every tick spent, in the danger colour.
   It is the same object on the seeker's application, the employer's queue and
   the home page, so the deadline reads as one promise seen from three sides. */
export function ResponseClock({ appliedAt, respondBy, respondedAt, status, size }) {
  // Read the time once per mount: a clock that re-reads it on every render is impure.
  const [now] = useState(() => Date.now());
  if (!appliedAt || !respondBy) return null;

  const total = Math.max(1, daysBetween(appliedAt, respondBy));
  const lapsed = status === 'NO_RESPONSE' || (!respondedAt && new Date(respondBy).getTime() < now);
  const answered = Boolean(respondedAt) && !lapsed;
  const spent = answered
    ? Math.min(total, Math.max(1, daysBetween(appliedAt, respondedAt) + 1))
    : lapsed ? total : Math.min(total, Math.max(0, daysBetween(appliedAt, now)));
  const left = total - spent;

  const state = answered ? 'answered' : lapsed ? 'lapsed' : 'waiting';
  const text = answered
    ? `Answered in ${spent} ${spent === 1 ? 'day' : 'days'}`
    : lapsed
      ? `No answer in ${total} days`
      : left <= 0 ? 'Answer due today' : `${left} ${left === 1 ? 'day' : 'days'} left to answer`;

  return (
    <div className={cx('jp-clock', `jp-clock--${state}`, size && `jp-clock--${size}`)}>
      <div className="jp-clock__ticks" role="img" aria-label={`${text}. Response due ${fullDate(respondBy)}.`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < spent ? 'jp-clock__tick jp-clock__tick--on' : 'jp-clock__tick'}
            style={{ '--i': i }} />
        ))}
      </div>
      <span className="jp-clock__text">{text}</span>
    </div>
  );
}

/* --------------------------------------------------------------- StageTrack
   Where an application stands, as a real sequence: these are ordered steps, so
   a track is information here, not decoration. Ways out of the sequence
   (rejected, withdrawn, unanswered) end the track where it stopped. */
const STAGES = [
  ['PENDING', 'Applied'],
  ['REVIEWED', 'Reviewed'],
  ['INTERVIEW', 'Interview'],
  ['OFFERED', 'Offer'],
  ['ACCEPTED', 'Hired'],
];
const ENDINGS = { REJECTED: 'Not selected', WITHDRAWN: 'Withdrawn', NO_RESPONSE: 'No answer' };

/** `reached` is the furthest stage an application got to before it ended, when known. */
export function StageTrack({ status, reached }) {
  const ended = ENDINGS[status];
  const at = Math.max(0, STAGES.findIndex(([key]) => key === (ended ? reached || 'PENDING' : status)));

  return (
    <ol className={cx('jp-track', ended && 'jp-track--ended')} aria-label="Application progress">
      {STAGES.map(([key, label], i) => (
        <li
          key={key}
          className={cx('jp-track__step', i < at && 'jp-track__step--done', i === at && 'jp-track__step--current')}
          aria-current={i === at && !ended ? 'step' : undefined}
        >
          <span className="jp-track__dot" aria-hidden="true" />
          <span className="jp-track__label">{label}</span>
        </li>
      ))}
      {ended && <li className="jp-track__end">{ended}</li>}
    </ol>
  );
}

/* ----------------------------------------------------------------- Monogram
   A company's mark when it has uploaded none: its initials on one of four
   quiet tints, chosen from the name so the same company is always the same. */
export function Monogram({ name = '', src, size }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const tint = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 4;
  return src
    ? <img className={cx('jp-mono', size && `jp-mono--${size}`)} src={src} alt="" />
    : <span className={cx('jp-mono', `jp-mono--t${tint}`, size && `jp-mono--${size}`)} aria-hidden="true">{initials}</span>;
}

/* -------------------------------------------------------------------- Facts
   Replaces "A · B · C" strings. Each fact is its own element, so it can carry
   an icon, wrap cleanly on a phone and be read out as a list. */
export function Facts({ className, children }) {
  return <ul className={cx('jp-facts', className)}>{children}</ul>;
}

export function Fact({ icon: Icon, strong, children }) {
  return (
    <li className={cx('jp-fact', strong && 'jp-fact--strong')}>
      {Icon && <Icon size={14} aria-hidden="true" />}
      <span>{children}</span>
    </li>
  );
}

/* ------------------------------------------------------------------- Proofs
   The three promises, stated as facts about one posting or one employer.
   `responsiveness` is the payload of GET /applications/employer/{id}/responsiveness. */
export function Proofs({ verified, salaryShown, responsiveness, className }) {
  const rate = responsiveness?.responseRatePercent;
  return (
    <ul className={cx('jp-proofs', className)}>
      {verified && (
        <li className="jp-proof"><BadgeCheck size={15} aria-hidden="true" />Reviewed before it was listed</li>
      )}
      {salaryShown && (
        <li className="jp-proof"><Banknote size={15} aria-hidden="true" />Pay range shown</li>
      )}
      {responsiveness && (
        <li className="jp-proof">
          <Clock size={15} aria-hidden="true" />
          {rate == null
            ? 'New employer, no answer record yet'
            : `Answers ${rate}% of applicants on time`}
        </li>
      )}
    </ul>
  );
}

/* --------------------------------------------------------------------- Stat */
export function Stat({ label, value, hint, tone }) {
  return (
    <div className={cx('jp-kpi', tone && `jp-kpi--${tone}`)}>
      <dt className="jp-kpi__label">{label}</dt>
      <dd className="jp-kpi__value">{value}</dd>
      {hint && <dd className="jp-kpi__hint">{hint}</dd>}
    </div>
  );
}

export function StatGroup({ children }) {
  return <dl className="jp-kpis">{children}</dl>;
}

/* --------------------------------------------------------------- SegmentBar
   One bar split by share, with its legend. `segments`: [{ label, value, tone }]
   where tone is one of accent | success | warning | danger | signal | neutral.
   Tone is never the only cue: every segment is also named and counted. */
export function SegmentBar({ segments, label }) {
  const shown = segments.filter((s) => s.value > 0);
  const total = shown.reduce((sum, s) => sum + s.value, 0);
  if (!total) return null;
  return (
    <figure className="jp-seg">
      <div className="jp-seg__bar" role="img"
        aria-label={`${label}: ${shown.map((s) => `${s.label} ${s.value}`).join(', ')}`}>
        {shown.map((s) => (
          <span key={s.label} className={`jp-seg__part jp-seg__part--${s.tone || 'neutral'}`}
            style={{ flexGrow: s.value }} />
        ))}
      </div>
      <figcaption className="jp-seg__legend">
        {shown.map((s) => (
          <span key={s.label} className="jp-seg__key">
            <span className={`jp-seg__swatch jp-seg__part--${s.tone || 'neutral'}`} aria-hidden="true" />
            {s.label} <strong>{s.value}</strong>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/* ----------------------------------------------------------------- PageHead */
export function PageHead({ title, sub, children }) {
  return (
    <div className="jp-page-head">
      <div>
        <h1 className="jp-display">{title}</h1>
        {sub && <p className="jp-sm jp-muted">{sub}</p>}
      </div>
      {children && <div className="jp-row-actions">{children}</div>}
    </div>
  );
}
