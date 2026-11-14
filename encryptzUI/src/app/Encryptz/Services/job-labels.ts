/** How a job reads on the public job pages: the same words as the job board of Job Portal. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function experienceLabel(p: { experienceMinYears?: number | null; experienceMaxYears?: number | null }): string {
  const min = p.experienceMinYears, max = p.experienceMaxYears;
  if (min != null && max != null) return min === max ? `${min} ${min === 1 ? 'year' : 'years'}` : `${min} – ${max} years`;
  if (min != null) return min === 0 ? 'Freshers welcome' : `${min}+ years`;
  if (max != null) return `Up to ${max} years`;
  return '';
}

export function salaryLabel(p: { salaryMin?: number | null; salaryMax?: number | null }): string {
  const money = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const min = p.salaryMin, max = p.salaryMax;
  if (min != null && max != null) return min === max ? `${money(min)} per month` : `${money(min)} – ${money(max)} per month`;
  if (min != null) return `From ${money(min)} per month`;
  if (max != null) return `Up to ${money(max)} per month`;
  return '';
}

export function skillList(skills: string | null | undefined, limit = 12): string[] {
  return (skills || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, limit);
}

/** Dates are taken as text: a Date object would shift them by the time zone. */
export function dayLabel(value: string | null | undefined): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value ?? '')) return '';
  const [year, m, d] = (value as string).slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${year}`;
}

/** The first letter of the company, for the tile where a logo would be. */
export function initial(name: string | null | undefined): string {
  const first = Array.from((name ?? '').trim())[0];
  return first ? first.toUpperCase() : '?';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The time of an interview, "Tue, 28 Oct 2026 · 10:30 AM": taken as text, as the company typed it, never shifted by a time zone. */
export function interviewLabel(value: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value ?? '');
  if (!m) return '';
  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const weekday = DAYS[new Date(year, month - 1, day).getDay()];
  const h12 = hour % 12 || 12;
  return `${weekday}, ${day} ${MONTHS[month - 1]} ${year} · ${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** The interview as a moment here, to compare with now (NaN when there is none). */
export function interviewTime(value: string | null | undefined): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : NaN;
}

/** A place that is a web address (the link of a video call). */
export function isWebLink(place: string | null | undefined): boolean {
  return /^https?:\/\/\S+$/i.test((place ?? '').trim());
}

/** An interview for its date tile: { day: '28', month: 'Oct', rest: 'Tue · 10:30 AM' }. */
export function interviewParts(value: string | null | undefined): { day: string; month: string; rest: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value ?? '');
  if (!m) return { day: '', month: '', rest: '' };
  // interviewLabel is "Tue, 28 Oct 2026 · 10:30 AM": the weekday and the time are kept
  const [date, time] = interviewLabel(value).split(' · ');
  return { day: String(+m[3]), month: MONTHS[+m[2] - 1], rest: `${date.slice(0, 3)} · ${time}` };
}
