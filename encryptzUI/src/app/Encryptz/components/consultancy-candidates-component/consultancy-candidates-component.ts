import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../Auth/auth-service';
import { CompanyJobsService, CompanyPosting } from '../../Services/company-jobs-service';
import {
  Candidate,
  CandidatePage,
  CandidateSearch,
  CandidateFacet,
  ConsultancyService,
  OwnCandidate,
  EXPERIENCE_BANDS,
  TALENT_STAGES,
  TalentStage,
} from '../../Services/consultancy-service';
import { JOB_WORK_MODES, JobEducation, JobSkill } from '../../Services/jobs-service';
import { MessagesService } from '../../Services/messages-service';
import { CONSULTANCY_MENU } from '../personal-shell-component/consultancy-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';
import { VerifiedBadgeComponent } from '../verified-badge-component/verified-badge-component';
import { AutocompleteComponent, AutocompleteOption } from '../autocomplete-component/autocomplete-component';
import { EscapeClose } from '../shared/escape-close';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Job Consultancy, Candidates: people who chose "Employers can find me" on Job Portal.
 * The consultancy searches them, keeps the ones it works with in its pool (stage and
 * note), opens a profile (the person sees which company looked) and invites a candidate
 * to apply for one of its open jobs.
 */
/** An open job whose closing day (if any) is today or later: it still takes applications. */
export function takesApplications(p: { status: string; closesOn?: string | null }, today = new Date()): boolean {
  if (p.status !== 'Open') return false;
  if (!p.closesOn) return true;
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return p.closesOn.slice(0, 10) >= day;
}

@Component({
  selector: 'app-consultancy-candidates-component',
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet, FormsModule, RouterModule, PersonalShellComponent, VerifiedBadgeComponent, AutocompleteComponent, EscapeClose],
  templateUrl: './consultancy-candidates-component.html',
  styleUrls: [
    '../job-profile-component/job-profile-component.scss',
    '../job-board-component/job-board-component.scss',
    './consultancy-candidates-component.scss',
  ],
})
export class ConsultancyCandidatesComponent implements OnInit {
  private api = inject(ConsultancyService);
  private jobs = inject(CompanyJobsService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private messages = inject(MessagesService);

  readonly menu = CONSULTANCY_MENU;
  readonly stages = TALENT_STAGES;
  readonly workModes = JOB_WORK_MODES;
  readonly bands = EXPERIENCE_BANDS;

  loading = signal(true);
  unavailable = signal('');
  items = signal<Candidate[]>([]);
  /** The company's own candidates that match the search: only this company sees them. */
  ownItems = signal<OwnCandidate[]>([]);
  ownTotal = signal(0);
  total = signal(0);
  pageSize = signal(20);

  filter: CandidateSearch = {
    q: '', matchAll: true, cities: [], bands: [], modes: [], skills: [], skillsAll: false,
    verifiedOnly: false, withResume: false, pool: false, page: 1,
  };

  /** The choices of the filters with how many people have each (from the last search). */
  facets = signal<CandidateFacet[]>([]);
  /** A search is on its way: the list stays, a little faded. */
  searching = signal(false);
  filtersOpen = signal(false);
  /** The server knows the filters (it answers their choices): false = it is older than the page. */
  serverFilters = signal(true);
  /** A city or skill typed to tick, when it is not among the choices. */
  addCity = '';
  addSkill = '';
  private asked = 0;

  /** The candidate who is open, and what is typed for the pool. */
  open = signal<CandidatePage | null>(null);
  poolStage: TalentStage = 'New';
  poolNote = '';
  poolBusy = signal(false);

  /** The open jobs of the company, for an invitation. */
  openJobs = signal<CompanyPosting[]>([]);
  /** The open jobs as choices: searched by title, city and type. */
  readonly jobOptions = computed<AutocompleteOption<number>[]>(() =>
    this.openJobs().map(j => ({ value: j.postingId!, label: j.title, sub: [j.city, j.employmentType, j.workMode].filter(Boolean).join(' · ') })));
  invitePostingId: number | null = null;
  inviteMessage = '';
  inviting = signal(false);
  /** The invitations sent to the open candidate while the dialog is open: shown in it. */
  invited = signal<string[]>([]);

  panelError = signal('');
  toast = signal<{ text: string; ok: boolean } | null>(null);

  /** /consultancy/candidates/:key: one candidate on a page of its own (the list opens it in a new tab). */
  readonly pageMode = this.route.snapshot.data['page'] === true;
  /** Why the page of one candidate cannot be shown ('' while it loads or when it can). */
  pageMissing = signal('');

  ngOnInit(): void {
    if (!this.auth.scopeState().companyId) { this.router.navigate(['/select-company']); return; }
    if (this.pageMode) {
      const key = this.route.snapshot.paramMap.get('key') ?? '';
      if (/^[0-9a-f-]{36}$/i.test(key)) this.openCandidate({ candidateKey: key } as Candidate);
      else this.pageMissing.set('This candidate can no longer be found');
    } else {
      // My pool opened from a link (the tabs of Our candidates)
      if (this.route.snapshot.queryParamMap.get('pool') === '1') this.filter.pool = true;
      this.load();
    }
    // a candidate named in the address (a suitable candidate of a job): opened at once
    const named = this.route.snapshot.queryParamMap.get('candidate');
    if (named && /^[0-9a-f-]{36}$/i.test(named)) this.openCandidate({ candidateKey: named } as Candidate);
    this.jobs.getPostings().subscribe({
      // only a job that still takes applications: one past its closing day is refused by the server
      next: res => this.openJobs.set(res.success ? (res.data ?? []).filter(p => takesApplications(p)) : []),
      error: () => this.openJobs.set([]),
    });
  }

  load(): void {
    // only the answer to the last search is shown: a tick can be quicker than the answer before it
    const ask = ++this.asked;
    this.searching.set(true);
    this.api.searchCandidates(this.filter).subscribe({
      next: res => {
        if (ask !== this.asked) return;
        this.loading.set(false);
        this.searching.set(false);
        if (res.success && res.data) {
          this.unavailable.set('');
          this.items.set(res.data.items ?? []);
          this.total.set(res.data.total);
          this.ownItems.set(res.data.ownItems ?? []);
          this.ownTotal.set(res.data.ownTotal ?? 0);
          this.pageSize.set(res.data.pageSize || 20);
          this.facets.set(res.data.facets ?? []);
          // a server from before the filters answers no choices at all (not even an empty list)
          this.serverFilters.set(Array.isArray(res.data.facets));
        } else this.unavailable.set(res.message || 'This application is not available right now');
      },
      error: err => {
        if (ask !== this.asked) return;
        this.loading.set(false);
        this.searching.set(false);
        this.unavailable.set(err?.status === 403 ? (err.error?.message || "You don't have access to Job Consultancy. Ask your administrator") : 'The candidates could not be loaded. Please try again.');
      },
    });
  }

  search(): void {
    this.filter.page = 1;
    this.load();
  }

  // ── the filters ───────────────────────────────────────────────────────────

  /** The values of a list filter to show: the choices of the last search, and what is ticked. */
  choices(kind: 'City' | 'Skill', ticked: string[]): { value: string; people: number | null }[] {
    const found = this.facets().filter(f => f.kind === kind).map(f => ({ value: f.value, people: f.people as number | null }));
    const extra = ticked.filter(t => !found.some(f => f.value.toLowerCase() === t.toLowerCase())).map(t => ({ value: t, people: null }));
    return [...extra, ...found];
  }

  /** How many of the people the words found have a working mode or a band. */
  countOf(kind: 'Mode' | 'Band', value: string): number | null {
    return this.facets().find(f => f.kind === kind && f.value === value)?.people ?? null;
  }

  isTicked(list: string[], value: string): boolean {
    return list.some(v => v.toLowerCase() === value.toLowerCase());
  }

  /** Ticks or unticks a value of a list filter, and searches again at once. */
  toggle(key: 'cities' | 'bands' | 'modes' | 'skills', value: string): void {
    const list = this.filter[key];
    this.filter[key] = this.isTicked(list, value) ? list.filter(v => v.toLowerCase() !== value.toLowerCase()) : [...list, value];
    this.search();
  }

  setFlag(key: 'matchAll' | 'skillsAll' | 'verifiedOnly' | 'withResume', on: boolean): void {
    if (this.filter[key] === on) return;
    this.filter[key] = on;
    // "all words" changes nothing without words, "all skills" nothing without skills
    if ((key === 'matchAll' && !this.filter.q.trim()) || (key === 'skillsAll' && this.filter.skills.length < 2)) return;
    this.search();
  }

  addTyped(key: 'cities' | 'skills'): void {
    const field = key === 'cities' ? 'addCity' : 'addSkill';
    const value = this[field].trim().slice(0, 100);
    this[field] = '';
    if (!value || this.isTicked(this.filter[key], value)) return;
    this.filter[key] = [...this.filter[key], value];
    this.search();
  }

  get activeFilters(): number {
    const f = this.filter;
    return f.cities.length + f.bands.length + f.modes.length + f.skills.length + (f.verifiedOnly ? 1 : 0) + (f.withResume ? 1 : 0);
  }

  /** "6 years", "6 years (from headline)" when the person entered no experience but wrote it there. */
  experienceLabel(c: Candidate): string {
    const years = `${c.experienceYears} ${c.experienceYears === 1 ? 'year' : 'years'}`;
    return c.experienceSource === 'Headline' ? `${years} (from headline)` : years;
  }

  ownExperience(years: number | null): string {
    if (years == null) return 'Experience not added';
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }

  bandLabel(value: string): string {
    return EXPERIENCE_BANDS.find(b => b.value === value)?.label ?? value;
  }

  clearFilters(): void {
    this.filter = { ...this.filter, cities: [], bands: [], modes: [], skills: [], verifiedOnly: false, withResume: false };
    this.search();
  }

  clearAll(): void {
    this.filter = { ...this.filter, q: '', cities: [], bands: [], modes: [], skills: [], verifiedOnly: false, withResume: false };
    this.search();
  }

  setPool(pool: boolean): void {
    if (this.filter.pool === pool) return;
    this.filter.pool = pool;
    this.search();
  }

  get lastPage(): number {
    return Math.max(1, Math.ceil(this.total() / this.pageSize()));
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage || page === this.filter.page) return;
    this.filter.page = page;
    this.load();
  }

  // ── one candidate ─────────────────────────────────────────────────────────

  openCandidate(c: Candidate): void {
    this.api.getCandidate(c.candidateKey).subscribe({
      next: res => {
        if (!res.success || !res.data) {
          const why = res.message === 'Not found' ? 'This candidate can no longer be found' : res.message;
          if (this.pageMode) { this.pageMissing.set(why || 'This candidate could not be opened'); return; }
          this.notify(why, false);
          if (res.message === 'Not found') this.load();
          return;
        }
        this.panelError.set('');
        this.poolStage = (res.data.stage || 'New') as TalentStage;
        this.poolNote = res.data.note || '';
        this.invitePostingId = this.openJobs()[0]?.postingId ?? null;
        this.inviteMessage = '';
        this.invited.set([]);
        this.open.set(res.data);
      },
      error: () => (this.pageMode ? this.pageMissing.set('The candidate could not be opened. Please try again') : this.notify('The candidate could not be opened. Please try again', false)),
    });
  }

  close(): void {
    if (this.poolBusy() || this.inviting()) return;
    this.open.set(null);
  }

  saveToPool(): void {
    const c = this.open();
    if (!c || this.poolBusy()) return;
    if (this.poolNote.trim().length > 1000) { this.panelError.set('The note can have at most 1000 characters'); return; }

    this.poolBusy.set(true);
    this.panelError.set('');
    this.api.saveTalent(c.candidateKey, this.poolStage, this.poolNote.trim()).subscribe({
      next: res => {
        this.poolBusy.set(false);
        if (!res.success) { this.panelError.set(res.message || 'Could not save'); return; }
        this.open.update(p => (p ? { ...p, inPool: true, stage: this.poolStage, note: this.poolNote.trim() } : p));
        this.items.update(list => list.map(x => (x.candidateKey === c.candidateKey ? { ...x, inPool: true, stage: this.poolStage } : x)));
        this.notify(res.message, true);
      },
      error: () => { this.poolBusy.set(false); this.panelError.set('Could not save. Please try again'); },
    });
  }

  removeFromPool(): void {
    const c = this.open();
    if (!c || this.poolBusy()) return;
    if (!window.confirm('Remove this candidate from your pool? Your note goes too.')) return;

    this.poolBusy.set(true);
    this.api.removeTalent(c.candidateKey).subscribe({
      next: res => {
        this.poolBusy.set(false);
        if (!res.success) { this.panelError.set(res.message || 'Could not remove'); return; }
        this.open.update(p => (p ? { ...p, inPool: false, stage: '', note: '' } : p));
        this.poolNote = '';
        this.items.update(list => (this.filter.pool
          ? list.filter(x => x.candidateKey !== c.candidateKey)
          : list.map(x => (x.candidateKey === c.candidateKey ? { ...x, inPool: false, stage: '' } : x))));
        this.notify(res.message, true);
      },
      error: () => { this.poolBusy.set(false); this.panelError.set('Could not remove. Please try again'); },
    });
  }

  invite(): void {
    const c = this.open();
    if (!c || this.inviting()) return;
    if (!this.invitePostingId) { this.panelError.set('Choose one of your open jobs'); return; }
    if (this.inviteMessage.trim().length > 500) { this.panelError.set('The message can have at most 500 characters'); return; }

    this.inviting.set(true);
    this.panelError.set('');
    this.api.invite(c.candidateKey, this.invitePostingId, this.inviteMessage.trim()).subscribe({
      next: res => {
        this.inviting.set(false);
        if (!res.success) { this.panelError.set(res.message || 'Could not send the invitation'); return; }
        const job = this.openJobs().find(j => j.postingId === this.invitePostingId);
        if (job) this.invited.update(list => [...list, job.title]);
        this.inviteMessage = '';
        this.notify(res.message, true);
      },
      error: () => { this.inviting.set(false); this.panelError.set('Could not send the invitation. Please try again'); },
    });
  }

  downloadResume(): void {
    const c = this.open();
    if (!c) return;
    this.api.downloadCandidateResume(c.candidateKey).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = c.profile.resume?.fileName || 'resume';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.notify('The resume could not be downloaded', false),
    });
  }

  /** A placement for this candidate, on the Placements page. */
  /** The conversation with this candidate (made when there is none), in Messages. */
  message(): void {
    const c = this.open();
    if (!c || this.messaging()) return;
    this.messaging.set(true);
    this.messages.startAsCompany({ candidateKey: c.candidateKey }).subscribe({
      next: res => {
        this.messaging.set(false);
        if (res.success && res.data) this.router.navigate(['/consultancy/messages'], { queryParams: { c: res.data } });
        else this.panelError.set(res.message || 'Could not open the conversation');
      },
      error: () => { this.messaging.set(false); this.panelError.set('Could not open the conversation. Please try again'); },
    });
  }

  messaging = signal(false);

  recordPlacement(): void {
    const c = this.open();
    if (!c) return;
    this.router.navigate(['/consultancy/placements'], {
      queryParams: { candidate: c.candidateKey, name: c.profile.profile.fullName },
    });
  }

  // ── what the template shows ───────────────────────────────────────────────

  stageLabel(stage: string): string {
    return stage === 'NotSuitable' ? 'Not suitable' : stage;
  }

  stageClass(stage: string): string {
    const map: Record<string, string> = { New: 'applied', Contacted: 'applied', Interview: 'shortlisted', Placed: 'hired', NotSuitable: 'rejected' };
    return `jb-status ${map[stage] ?? ''}`;
  }

  initials(name: string | null | undefined): string {
    return (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => Array.from(w)[0].toUpperCase()).join('');
  }

  /** One of four pastel tones for an avatar, the same for the same name. */
  tone(name: string | null | undefined): number {
    let sum = 0;
    for (const ch of name ?? '') sum = (sum + ch.charCodeAt(0)) % 997;
    return sum % 4;
  }

  list(text: string): string[] {
    return (text || '').split(',').map(s => s.trim()).filter(Boolean);
  }

  monthLabel(value: string | null | undefined): string {
    if (!/^\d{4}-\d{2}/.test(value ?? '')) return '';
    const [year, m] = (value as string).slice(0, 7).split('-').map(Number);
    return `${MONTHS[m - 1]} ${year}`;
  }

  dayLabel(value: string | null | undefined): string {
    if (!/^\d{4}-\d{2}-\d{2}/.test(value ?? '')) return '';
    const [y, m, d] = (value as string).slice(0, 10).split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }

  years(row: JobEducation): string {
    if (row.startYear && row.endYear) return `${row.startYear} – ${row.endYear}`;
    return String(row.endYear || row.startYear || '');
  }

  certificateLabel(status: string): string {
    return status === 'Verified' ? 'Verified' : status === 'Rejected' ? 'Not verified' : 'Not checked';
  }

  safeLink(url: string | null | undefined): string {
    const text = (url ?? '').trim();
    return /^https:\/\/[^\s"<>]+$/i.test(text) ? text : '';
  }

  /** "GST 4/5, Payroll 3/5": the sub-skills of a skill with the rating the person gave them. */
  subSkillsLine(skill: JobSkill): string {
    return (skill.subSkills ?? []).map(u => `${u.name} ${u.rating}/5`).join(', ');
  }

  private notify(text: string | undefined, ok: boolean): void {
    this.toast.set({ text: text || (ok ? 'Done' : 'Something went wrong'), ok });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
