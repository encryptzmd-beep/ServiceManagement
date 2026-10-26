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
