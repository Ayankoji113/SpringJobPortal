/** Indian salaries are read in lakhs, so 1800000 shows as ₹18.0L. */
export function lakhs(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return `₹${(n / 100000).toFixed(1)}L`;
}

export function salaryRange(min, max) {
  const lo = lakhs(min);
  const hi = lakhs(max);
  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return `from ${lo}`;
  if (hi) return `up to ${hi}`;
  return 'Not disclosed';
}

const RELATIVE = [
  [60, 'second', 1],
  [3600, 'minute', 60],
  [86400, 'hour', 3600],
  [604800, 'day', 86400],
  [2629800, 'week', 604800],
  [31557600, 'month', 2629800],
];

export function relativeDate(value) {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 45) return 'just now';
  for (const [limit, unit, divisor] of RELATIVE) {
    if (seconds < limit) {
      const n = Math.round(seconds / divisor);
      return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
    }
  }
  const years = Math.round(seconds / 31557600);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

export function fullDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export const JOB_TYPES = [
  ['FULL_TIME', 'Full time'],
  ['PART_TIME', 'Part time'],
  ['CONTRACT', 'Contract'],
  ['INTERNSHIP', 'Internship'],
  ['FREELANCE', 'Freelance'],
];

export const jobTypeLabel = (value) => JOB_TYPES.find(([v]) => v === value)?.[1] || value || '';

export function statusTone(status) {
  switch (status) {
    case 'ACCEPTED':
    case 'OFFERED': return 'success';
    case 'REJECTED':
    case 'NO_RESPONSE': return 'danger';
    case 'REVIEWED':
    case 'INTERVIEW': return 'accent';
    case 'WITHDRAWN': return 'neutral';
    default: return 'warning';
  }
}

/** NO_RESPONSE reads as "No response". */
export const titleCase = (s) =>
  (s ? s.charAt(0) + s.slice(1).toLowerCase().replaceAll('_', ' ') : '');

/** Whole days from now until a date; negative once it has passed. */
export function daysUntil(value) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}
