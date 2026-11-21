import { CompanyDashboard, CompanyPosting } from '../../Services/company-jobs-service';
import { ConsultClient, OwnCandidate, Placement, PostingClient, PostingMatchCount } from '../../Services/consultancy-service';
import { ReportColumn } from '../crm-reports-component/crm-export';

/** A fee not paid this many days after the candidate joined counts as overdue. */
export const FEE_OVERDUE_DAYS = 30;
/** A guarantee ending within this many days is shown as ending soon. */
export const GUARANTEE_SOON_DAYS = 30;
/** An open job with no applicant after this many days needs a push. */
export const QUIET_JOB_DAYS = 7;
/** A job closing within this many days is shown as closing soon. */
export const CLOSING_SOON_DAYS = 7;

const DAY_MS = 86_400_000;

/** Whole calendar days from a to b, in local time (daylight saving cannot shift the count). */
function daysBetween(a: Date, b: Date): number {
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / DAY_MS);
}

/** A date from the API: yyyy-MM-dd is read as a local day, never as UTC. */
function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function showDay(value: string | null | undefined): string {
  const d = parseDay(value);
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}

export function rupees(value: number | null | undefined): string {
  return '₹' + Math.round(value ?? 0).toLocaleString('en-IN');
}

const count = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const names = (list: string[]) => list.slice(0, 2).join(', ') + (list.length > 2 ? ` and ${list.length - 2} more` : '');

// ── what needs attention ─────────────────────────────────────────────────────

export type AttentionLevel = 'high' | 'medium';

export interface AttentionItem {
  key: string;
  level: AttentionLevel;
  icon: string;
  title: string;
  detail: string;
  link: string;
  query?: Record<string, number>;
  action: string;
}

export interface AttentionInput {
  postings: CompanyPosting[] | null;
  interviews: CompanyDashboard['interviews'] | null;
  /** Null until read: nothing is claimed about what is not known. */
  placements: Placement[] | null;
  suitable: Record<number, number>;
  unreadMessages: number;
  today: Date;
}

const LEVEL_ORDER: Record<AttentionLevel, number> = { high: 0, medium: 1 };

/** One job opens that job; several open the list they belong to. */
const jobLink = (jobs: CompanyPosting[], many = '/consultancy/postings') =>
  jobs.length === 1 ? { link: '/consultancy/postings', query: { job: jobs[0].postingId } } : { link: many };

export function attentionItems(x: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];
  const open = (x.postings ?? []).filter(p => p.status === 'Open');

  const returned = (x.postings ?? []).filter(p => p.status === 'Draft' && !!p.reviewNote?.trim());
  if (returned.length) {
    items.push({ key: 'returned', level: 'high', icon: 'assignment_return', title: `${count(returned.length, 'job')} returned by Encryptz`,
      detail: names(returned.map(p => p.title)), ...jobLink(returned), action: 'Fix and resend' });
  }

  const expired = open.filter(p => { const d = parseDay(p.closesOn); return !!d && daysBetween(x.today, d) < 0; });
  if (expired.length) {
    items.push({ key: 'expired', level: 'high', icon: 'event_busy', title: `${count(expired.length, 'open job')} past the closing date`,
      detail: names(expired.map(p => p.title)), ...jobLink(expired), action: 'Extend or close' });
  }

  if (x.placements) {
    const overdue = x.placements.filter(p => {
      const joined = parseDay(p.joinDate);
      return p.feeStatus !== 'Paid' && (p.feeAmount ?? 0) > 0 && !!joined && daysBetween(joined, x.today) > FEE_OVERDUE_DAYS;
    });
    if (overdue.length) {
      const total = overdue.reduce((s, p) => s + (p.feeAmount ?? 0), 0);
      items.push({ key: 'fees', level: 'high', icon: 'payments', title: `${rupees(total)} in overdue fees`,
        detail: `${count(overdue.length, 'placement')} unpaid more than ${FEE_OVERDUE_DAYS} days after joining`, link: '/consultancy/reports/fees', action: 'See fees' });
    }

    const ending = x.placements.filter(p => {
      const until = parseDay(p.guaranteeUntil);
      if (!until) return false;
      const left = daysBetween(x.today, until);
      return left >= 0 && left <= GUARANTEE_SOON_DAYS;
    });
    if (ending.length) {
      items.push({ key: 'guarantees', level: 'medium', icon: 'shield', title: `${count(ending.length, 'guarantee')} ending soon`,
        detail: `Within ${GUARANTEE_SOON_DAYS} days: ${names(ending.map(p => p.candidateName))}`, link: '/consultancy/reports/guarantees', action: 'Check in' });
    }
  }

  const soon = (x.interviews ?? []).filter(i => { const d = parseDay(i.interviewAt); if (!d) return false; const left = daysBetween(x.today, d); return left >= 0 && left <= 1; });
  if (soon.length) {
    const first = soon[0];
    items.push({ key: 'interviews', level: 'high', icon: 'event_available', title: `${count(soon.length, 'interview')} today or tomorrow`,
      detail: names(soon.map(i => i.fullName || 'Applicant')), link: '/consultancy/postings',
      ...(new Set(soon.map(i => i.postingId)).size === 1 ? { query: { job: first.postingId } } : {}), action: 'Prepare' });
  }

  const waiting = open.filter(p => p.applied > 0).sort((a, b) => b.applied - a.applied);
  if (waiting.length) {
    const people = waiting.reduce((s, p) => s + p.applied, 0);
    items.push({ key: 'waiting', level: 'medium', icon: 'how_to_reg', title: `${count(people, 'applicant')} waiting for a decision`,
      detail: `Most on ${waiting[0].title}`, link: '/consultancy/postings', query: { job: waiting[0].postingId }, action: 'Review' });
  }

  const closing = open.filter(p => { const d = parseDay(p.closesOn); if (!d) return false; const left = daysBetween(x.today, d); return left >= 0 && left <= CLOSING_SOON_DAYS; });
  if (closing.length) {
    items.push({ key: 'closing', level: 'medium', icon: 'schedule', title: `${count(closing.length, 'job')} closing within ${CLOSING_SOON_DAYS} days`,
      detail: names(closing.map(p => p.title)), ...jobLink(closing), action: 'Open' });
  }

  const quiet = open.filter(p => {
    const since = parseDay(p.publishedAt ?? p.createdAt);
    return !!since && daysBetween(since, x.today) >= QUIET_JOB_DAYS && p.applied + p.shortlisted + p.rejected + p.hired === 0;
  });
  if (quiet.length) {
    const suitable = quiet.reduce((s, p) => s + (x.suitable[p.postingId] ?? 0), 0);
    items.push({ key: 'quiet', level: 'medium', icon: 'notifications_paused', title: `${count(quiet.length, 'job')} with no applicants`,
      detail: suitable ? `${count(suitable, 'suitable candidate')} to invite` : `Open for ${QUIET_JOB_DAYS} days or more`, ...jobLink(quiet), action: 'Find people' });
  }

  if (x.unreadMessages > 0) {
    items.push({ key: 'messages', level: 'medium', icon: 'mark_chat_unread', title: `${count(x.unreadMessages, 'unread message')}`,
      detail: 'From candidates', link: '/consultancy/messages', action: 'Reply' });
  }

  return items.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

// ── reports ──────────────────────────────────────────────────────────────────

export type ConsultancyReportKey = 'jobs' | 'clients' | 'placements' | 'fees' | 'guarantees' | 'sources';

export interface ConsultancyReportLink { key: ConsultancyReportKey; label: string; icon: string; }

/** The reports in menu order. Keys are the URL (/consultancy/reports/<key>). */
export const CONSULTANCY_REPORTS: ConsultancyReportLink[] = [
  { key: 'jobs', label: 'Job performance', icon: 'work_history' },
  { key: 'clients', label: 'Client performance', icon: 'handshake' },
  { key: 'placements', label: 'Placement register', icon: 'verified' },
  { key: 'fees', label: 'Fees outstanding', icon: 'payments' },
  { key: 'guarantees', label: 'Guarantee tracker', icon: 'shield' },
  { key: 'sources', label: 'Candidate sources', icon: 'campaign' },
];

export type ReportRow = Record<string, string | number | null>;

export interface ReportData {
  postings: CompanyPosting[];
  postingClients: PostingClient[];
  clients: ConsultClient[];
  placements: Placement[];
  matchCounts: PostingMatchCount[];
  ownCandidates: OwnCandidate[];
  /** How many own candidates exist; more than were read means the report is partial. */
  ownTotal: number;
}

export interface ConsultancyReportView {
  key: ConsultancyReportKey;
  title: string;
  note: string;
  /** The From / To filter applies to this report. */
  dated: boolean;
  stats: { label: string; value: string }[];
  columns: ReportColumn<ReportRow>[];
  rows: ReportRow[];
}

const statusLabel = (s: string) => (s === 'InReview' ? 'In review' : s);
const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

function inRange(value: string, from: string, to: string): boolean {
  const day = (value || '').slice(0, 10);
  return (!from || day >= from) && (!to || day <= to);
}

function jobsReport(d: ReportData, today: Date): ConsultancyReportView {
  const clientOf = new Map(d.postingClients.map(c => [c.postingId, c.clientName]));
  const suitable = new Map(d.matchCounts.map(m => [m.postingId, m.suitable]));
  const rows = d.postings.map<ReportRow>(p => {
    const received = p.applied + p.shortlisted + p.rejected + p.hired;
    const since = parseDay(p.publishedAt);
    return {
      title: p.title, client: clientOf.get(p.postingId) ?? '', city: p.city, status: statusLabel(p.status),
      received, waiting: p.applied, shortlisted: p.shortlisted, hired: p.hired, rejected: p.rejected,
      hireRate: percent(p.hired, received), suitable: suitable.get(p.postingId) ?? 0,
      daysOpen: p.status === 'Open' && since ? daysBetween(since, today) : null, closesOn: showDay(p.closesOn),
    };
  });
  const sum = (k: string) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  return {
    key: 'jobs', title: 'Job performance', note: 'Every job with its applicants as they stand now.', dated: false,
    stats: [
      { label: 'Open jobs', value: String(d.postings.filter(p => p.status === 'Open').length) },
      { label: 'Applicants', value: String(sum('received')) },
      { label: 'Waiting', value: String(sum('waiting')) },
      { label: 'Hire rate', value: `${percent(sum('hired'), sum('received'))}%` },
    ],
    columns: [
      { key: 'title', title: 'Job' }, { key: 'client', title: 'Client' }, { key: 'city', title: 'City' }, { key: 'status', title: 'Status' },
      { key: 'received', title: 'Applicants', kind: 'number' }, { key: 'waiting', title: 'Waiting', kind: 'number' },
      { key: 'shortlisted', title: 'Shortlisted', kind: 'number' }, { key: 'hired', title: 'Hired', kind: 'number' },
      { key: 'rejected', title: 'Rejected', kind: 'number' }, { key: 'hireRate', title: 'Hire rate', kind: 'percent' },
      { key: 'suitable', title: 'Suitable', kind: 'number' }, { key: 'daysOpen', title: 'Days open', kind: 'number' },
      { key: 'closesOn', title: 'Closes on' },
    ],
    rows,
  };
}

function clientsReport(d: ReportData): ConsultancyReportView {
  const rows = d.clients.map<ReportRow>(c => {
    const mine = d.placements.filter(p => p.clientId === c.clientId);
    const fee = (paid: boolean) => mine.filter(p => (p.feeStatus === 'Paid') === paid).reduce((s, p) => s + (p.feeAmount ?? 0), 0);
    return {
      name: c.name, contact: c.contactPerson, city: c.city, industry: c.industry, status: c.isActive ? 'Active' : 'Inactive',
      openJobs: c.openJobs ?? 0, placements: mine.length, paid: fee(true), outstanding: fee(false),
    };
  }).sort((a, b) => Number(b['paid']) + Number(b['outstanding']) - Number(a['paid']) - Number(a['outstanding']));
  const sum = (k: string) => rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
  return {
    key: 'clients', title: 'Client performance', note: 'Clients by the fees they bring in.', dated: false,
    stats: [
      { label: 'Active clients', value: String(d.clients.filter(c => c.isActive).length) },
      { label: 'Placements', value: String(sum('placements')) },
      { label: 'Fees paid', value: rupees(sum('paid')) },
      { label: 'Outstanding', value: rupees(sum('outstanding')) },
    ],
    columns: [
      { key: 'name', title: 'Client' }, { key: 'contact', title: 'Contact' }, { key: 'city', title: 'City' }, { key: 'industry', title: 'Industry' },
      { key: 'status', title: 'Status' }, { key: 'openJobs', title: 'Open jobs', kind: 'number' }, { key: 'placements', title: 'Placements', kind: 'number' },
      { key: 'paid', title: 'Fees paid', kind: 'money' }, { key: 'outstanding', title: 'Outstanding', kind: 'money' },
    ],
    rows,
  };
}

function placementsReport(d: ReportData, from: string, to: string): ConsultancyReportView {
  const list = d.placements.filter(p => inRange(p.joinDate, from, to)).sort((a, b) => (b.joinDate || '').localeCompare(a.joinDate || ''));
  const fees = list.reduce((s, p) => s + (p.feeAmount ?? 0), 0);
  const withCtc = list.filter(p => (p.annualCtc ?? 0) > 0);
  return {
    key: 'placements', title: 'Placement register', note: 'Filtered by joining date.', dated: true,
    stats: [
      { label: 'Placements', value: String(list.length) },
      { label: 'Total fees', value: rupees(fees) },
      { label: 'Average fee', value: rupees(list.length ? fees / list.length : 0) },
      { label: 'Average CTC', value: rupees(withCtc.length ? withCtc.reduce((s, p) => s + (p.annualCtc ?? 0), 0) / withCtc.length : 0) },
    ],
    columns: [
      { key: 'candidate', title: 'Candidate' }, { key: 'job', title: 'Job' }, { key: 'client', title: 'Client' }, { key: 'joined', title: 'Joined' },
      { key: 'ctc', title: 'Annual CTC', kind: 'money' }, { key: 'fee', title: 'Fee', kind: 'money' }, { key: 'status', title: 'Fee status' }, { key: 'guarantee', title: 'Guarantee until' },
    ],
    rows: list.map(p => ({
      candidate: p.candidateName, job: p.jobTitle, client: p.clientName ?? '', joined: showDay(p.joinDate),
      ctc: p.annualCtc ?? null, fee: p.feeAmount ?? null, status: p.feeStatus, guarantee: showDay(p.guaranteeUntil),
    })),
  };
}

function ageBand(days: number): string {
  if (days <= FEE_OVERDUE_DAYS) return 'Not overdue';
  if (days <= 60) return '31–60 days';
  if (days <= 90) return '61–90 days';
  return 'Over 90 days';
}

function feesReport(d: ReportData, today: Date): ConsultancyReportView {
  const list = d.placements
    .filter(p => p.feeStatus !== 'Paid' && (p.feeAmount ?? 0) > 0)
    .map(p => ({ p, age: Math.max(0, daysBetween(parseDay(p.joinDate) ?? today, today)) }))
    .sort((a, b) => b.age - a.age);
  const total = (keep: (age: number) => boolean) => list.filter(x => keep(x.age)).reduce((s, x) => s + (x.p.feeAmount ?? 0), 0);
  return {
    key: 'fees', title: 'Fees outstanding', note: `Oldest first. Overdue means unpaid more than ${FEE_OVERDUE_DAYS} days after joining.`, dated: false,
    stats: [
      { label: 'Outstanding', value: rupees(total(() => true)) },
      { label: 'Overdue', value: rupees(total(a => a > FEE_OVERDUE_DAYS)) },
      { label: 'Over 90 days', value: rupees(total(a => a > 90)) },
      { label: 'Placements', value: String(list.length) },
    ],
    columns: [
      { key: 'client', title: 'Client' }, { key: 'candidate', title: 'Candidate' }, { key: 'job', title: 'Job' }, { key: 'joined', title: 'Joined' },
      { key: 'fee', title: 'Fee', kind: 'money' }, { key: 'status', title: 'Fee status' }, { key: 'age', title: 'Days since joining', kind: 'number' }, { key: 'band', title: 'Age' },
    ],
    rows: list.map(({ p, age }) => ({
      client: p.clientName ?? '', candidate: p.candidateName, job: p.jobTitle, joined: showDay(p.joinDate),
      fee: p.feeAmount ?? 0, status: p.feeStatus, age, band: ageBand(age),
    })),
  };
}

function guaranteesReport(d: ReportData, today: Date): ConsultancyReportView {
  const list = d.placements
    .map(p => ({ p, until: parseDay(p.guaranteeUntil) }))
    .filter((x): x is { p: Placement; until: Date } => !!x.until && daysBetween(today, x.until) >= 0)
    .map(x => ({ p: x.p, left: daysBetween(today, x.until) }))
    .sort((a, b) => a.left - b.left);
  const within = (days: number) => list.filter(x => x.left <= days).length;
  return {
    key: 'guarantees', title: 'Guarantee tracker', note: 'Placements still under guarantee, the first to end on top.', dated: false,
    stats: [
      { label: 'Under guarantee', value: String(list.length) },
      { label: 'Ending in 7 days', value: String(within(7)) },
      { label: `Ending in ${GUARANTEE_SOON_DAYS} days`, value: String(within(GUARANTEE_SOON_DAYS)) },
      { label: 'Fees at risk', value: rupees(list.filter(x => x.left <= GUARANTEE_SOON_DAYS).reduce((s, x) => s + (x.p.feeAmount ?? 0), 0)) },
    ],
    columns: [
      { key: 'candidate', title: 'Candidate' }, { key: 'client', title: 'Client' }, { key: 'job', title: 'Job' }, { key: 'joined', title: 'Joined' },
      { key: 'until', title: 'Guarantee until' }, { key: 'left', title: 'Days left', kind: 'number' }, { key: 'fee', title: 'Fee', kind: 'money' }, { key: 'status', title: 'Fee status' },
    ],
    rows: list.map(({ p, left }) => ({
      candidate: p.candidateName, client: p.clientName ?? '', job: p.jobTitle, joined: showDay(p.joinDate),
      until: showDay(p.guaranteeUntil), left, fee: p.feeAmount ?? null, status: p.feeStatus,
    })),
  };
}

function sourcesReport(d: ReportData): ConsultancyReportView {
  const groups = new Map<string, OwnCandidate[]>();
  for (const c of d.ownCandidates) {
    const source = c.source?.trim() || 'Not set';
    groups.set(source, [...(groups.get(source) ?? []), c]);
  }
  const rows = [...groups.entries()].map<ReportRow>(([source, list]) => {
    const at = (stage: string) => list.filter(c => c.stage === stage).length;
    return {
      source, total: list.length, fresh: at('New'), contacted: at('Contacted'), interview: at('Interview'),
      placed: at('Placed'), notSuitable: at('NotSuitable'), placedRate: percent(at('Placed'), list.length),
    };
  }).sort((a, b) => Number(b['total']) - Number(a['total']));
  const placed = rows.reduce((s, r) => s + Number(r['placed']), 0);
  const best = [...rows].filter(r => Number(r['placed']) > 0).sort((a, b) => Number(b['placedRate']) - Number(a['placedRate']))[0];
  const partial = d.ownCandidates.length < d.ownTotal;
  return {
    key: 'sources', title: 'Candidate sources',
    note: partial ? `Based on the first ${d.ownCandidates.length} of ${d.ownTotal} candidates.` : 'The candidates your company added, by where you met them.', dated: false,
    stats: [
      { label: 'Candidates', value: String(d.ownTotal) },
      { label: 'Sources', value: String(rows.length) },
      { label: 'Placed', value: String(placed) },
      { label: 'Best source', value: best ? String(best['source']) : '–' },
    ],
    columns: [
      { key: 'source', title: 'Source' }, { key: 'total', title: 'Candidates', kind: 'number' }, { key: 'fresh', title: 'New', kind: 'number' },
      { key: 'contacted', title: 'Contacted', kind: 'number' }, { key: 'interview', title: 'Interview', kind: 'number' }, { key: 'placed', title: 'Placed', kind: 'number' },
      { key: 'notSuitable', title: 'Not suitable', kind: 'number' }, { key: 'placedRate', title: 'Placed rate', kind: 'percent' },
    ],
    rows,
  };
}

export function buildReport(key: ConsultancyReportKey, data: ReportData, today: Date, from = '', to = ''): ConsultancyReportView {
  switch (key) {
    case 'clients': return clientsReport(data);
    case 'placements': return placementsReport(data, from, to);
    case 'fees': return feesReport(data, today);
    case 'guarantees': return guaranteesReport(data, today);
    case 'sources': return sourcesReport(data);
    default: return jobsReport(data, today);
  }
}
