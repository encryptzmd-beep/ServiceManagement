/** The checks on what is typed in the Sales screens (SalesInputRules in the API checks the same). */
export function normalizeMobile(value: string | null | undefined): string | null {
  let digits = (value ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export const isEmailOrBlank = (value: string | null | undefined) =>
  !value?.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

export const isPinOrBlank = (value: string | null | undefined) =>
  !value?.trim() || /^[1-9]\d{5}$/.test(value.trim());

/** Today as yyyy-MM-dd in India, for the earliest date of a visit. */
export function todayInIndia(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** "WorkCompleted" as people read it: "Work Completed". */
export const statusText = (status: string | null | undefined) =>
  (status ?? '').replace(/([a-z])([A-Z])/g, '$1 $2');
