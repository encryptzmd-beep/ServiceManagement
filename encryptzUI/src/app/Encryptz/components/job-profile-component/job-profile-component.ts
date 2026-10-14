import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../Models/ApiModels';
import {
  JobCertificate,
  JobEducation,
  JobExperience,
  JobPreferences,
  JobProfilePage,
  JobProfileView,
  JobSkill,
  JobWorkMode,
  JobsService,
} from '../../Services/jobs-service';
import { JOBS_MENU } from '../personal-shell-component/jobs-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';

type DialogKind = 'profile' | 'preferences' | 'experience' | 'education' | 'skill' | 'certificate';
type RowKind = 'experience' | 'education' | 'skill' | 'certificate';

interface Dialog {
  kind: DialogKind;
  title: string;
  /** What is typed. Its shape depends on the kind. */
  model: any;
  /** The file picked in the certificate dialog. */
  file?: File | null;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_PREFERENCES = 10;
const SUGGEST_AFTER_MS = 300;
const NO_PREFERENCES: JobPreferences = { jobs: [], locations: [], workModes: [], expectedCtc: null };
const HTTPS_LINK = /^https:\/\/[^\s"<>]+$/i;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Job Portal, phase 1: the person's own profile. Everything is read and written through
 * the API for whoever is logged in; this page never sends or receives a user id.
 */
@Component({
  selector: 'app-job-profile-component',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PersonalShellComponent],
  templateUrl: './job-profile-component.html',
  styleUrl: './job-profile-component.scss',
})
export class JobProfileComponent implements OnInit, OnDestroy {
  private api = inject(JobsService);

  loading = signal(true);
  /** Why the page cannot be shown ('' when it can). */
  unavailable = signal('');
  page = signal<JobProfilePage | null>(null);

  dialog = signal<Dialog | null>(null);
  formError = signal('');
  saving = signal(false);

  visibleError = signal('');
  visibleBusy = signal(false);

  resumeError = signal('');
  resumeBusy = signal(false);

  suggestions = signal<string[]>([]);
  toast = signal<{ text: string; ok: boolean } | null>(null);

  readonly levels = ['Beginner', 'Intermediate', 'Expert'];
  readonly workModes: JobWorkMode[] = ['On-site', 'Remote', 'Hybrid'];

  readonly menu = JOBS_MENU;

  /** The photo as an address the page can show ('' when there is none). */
  photoUrl = signal('');
  photoError = signal('');
  photoBusy = signal(false);

  /** Which company looked at the profile; null while it is read or when it could not be. */
  views = signal<JobProfileView[] | null>(null);

  private suggestTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.load();
    this.loadPhoto();
    this.loadViews();
  }

  ngOnDestroy(): void {
    this.showPhoto(null);
    if (this.suggestTimer) clearTimeout(this.suggestTimer);
  }

  /** A failure only hides the card: the rest of the page is not affected. */
  private loadViews(): void {
    this.api.getProfileViews().subscribe({
      next: res => this.views.set(res.success ? res.data ?? [] : null),
      error: () => this.views.set(null),
    });
  }

  load(): void {
    this.api.getPage().subscribe({
      next: res => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.unavailable.set('');
          this.page.set(res.data);
        } else {
          this.page.set(null);
          this.unavailable.set(res.message || 'This application is not available right now');
        }
      },
      error: () => {
        this.loading.set(false);
        this.page.set(null);
        this.unavailable.set('Job Portal could not be loaded. Please try again.');
      },
    });
  }

  // ── visibility ────────────────────────────────────────────────────────────

  onVisibleChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.toggleVisible(input.checked, input);
  }

  /**
   * @param input the checkbox that was clicked. It has already moved, and the binding
   *   does not move it back when the stored value did not change: on a refusal it is
   *   set back by hand.
   */
  toggleVisible(on: boolean, input?: HTMLInputElement): void {
    const stored = !!this.page()?.profile.isVisible;
    if (this.visibleBusy()) { if (input) input.checked = stored; return; }

    this.visibleError.set('');
    this.visibleBusy.set(true);

    this.api.setVisible(on).subscribe({
      next: res => {
        this.visibleBusy.set(false);
        if (!res.success) {
          this.visibleError.set(res.message || 'Could not change this. Please try again.');
          if (input) input.checked = stored;
          return;
        }
        this.page.update(p => (p ? { ...p, profile: { ...p.profile, isVisible: on } } : p));
        this.notify(res.message, true);
      },
      error: () => {
        this.visibleBusy.set(false);
        this.visibleError.set('Could not change this. Please try again.');
        if (input) input.checked = stored;
      },
    });
  }

  // ── dialogs ───────────────────────────────────────────────────────────────

  openProfile(): void {
    const p = this.page()?.profile;
    this.open('profile', 'Edit profile', {
      fullName: p?.fullName ?? '', headline: p?.headline ?? '', summary: p?.summary ?? '', city: p?.city ?? '',
      contactEmail: p?.contactEmail ?? '', contactPhone: p?.contactPhone ?? '', dateOfBirth: this.dayOf(p?.dateOfBirth),
    });
  }

  openPreferences(): void {
    const p = this.prefs(this.page());
    this.open('preferences', 'Job preferences', {
      jobs: [...p.jobs], locations: [...p.locations], workModes: [...p.workModes],
      expectedCtc: p.expectedCtc ?? '', jobInput: '', locationInput: '',
    });
  }

  /** Adds what is typed in the box of that list; commas separate several entries. */
  addPreference(kind: 'jobs' | 'locations'): void {
    const m = this.dialog()?.model;
    if (!m) return;

    const box = kind === 'jobs' ? 'jobInput' : 'locationInput';
    const list: string[] = m[kind];
    this.formError.set('');

    for (const entry of String(m[box] ?? '').split(',').map(v => v.trim()).filter(Boolean)) {
      if (list.some(v => v.toLowerCase() === entry.toLowerCase())) continue;
      if (list.length >= MAX_PREFERENCES) {
        this.formError.set(`Choose at most 10 preferred ${kind}`);
        break;
      }
      list.push(entry.slice(0, 100));
    }
    m[box] = '';
  }

  removePreference(kind: 'jobs' | 'locations', index: number): void {
    this.dialog()?.model[kind].splice(index, 1);
    this.formError.set('');
  }

  toggleWorkMode(mode: JobWorkMode): void {
    const modes: JobWorkMode[] | undefined = this.dialog()?.model.workModes;
    if (!modes) return;
    const at = modes.indexOf(mode);
    if (at >= 0) modes.splice(at, 1); else modes.push(mode);
  }

  openExperience(row?: JobExperience): void {
    this.open('experience', row ? 'Edit experience' : 'Add experience', {
      experienceId: row?.experienceId ?? 0, organisation: row?.organisation ?? '', title: row?.title ?? '',
      startMonth: this.monthOf(row?.startMonth), endMonth: this.monthOf(row?.endMonth),
      current: row ? !row.endMonth : false, description: row?.description ?? '',
    });
  }

  openEducation(row?: JobEducation): void {
    this.open('education', row ? 'Edit education' : 'Add education', {
      educationId: row?.educationId ?? 0, institution: row?.institution ?? '', course: row?.course ?? '',
      fieldOfStudy: row?.fieldOfStudy ?? '', startYear: row?.startYear ?? null, endYear: row?.endYear ?? null,
    });
  }

  openSkill(row?: JobSkill): void {
    this.suggestions.set([]);
    this.open('skill', row ? 'Edit skill' : 'Add skill', {
      skillId: row?.skillId ?? 0, skillName: row?.skillName ?? '', level: row?.level ?? '', evidenceUrl: row?.evidenceUrl ?? '',
    });
  }

  openCertificate(row?: JobCertificate): void {
    this.open('certificate', row ? 'Edit certificate' : 'Add certificate', {
      certificateId: row?.certificateId ?? 0, title: row?.title ?? '', issuer: row?.issuer ?? '',
      issuedOn: this.dayOf(row?.issuedOn), currentFile: row?.fileName ?? '',
    });
  }

  private open(kind: DialogKind, title: string, model: any): void {
    this.formError.set('');
    this.saving.set(false);
    this.dialog.set({ kind, title, model, file: null });
  }

  closeDialog(): void {
    // while a save is on the way the dialog stays: its answer belongs to it
    if (this.saving()) return;
    this.dialog.set(null);
    this.formError.set('');
    this.saving.set(false);
  }

  onCertificateFile(event: Event): void {
    const d = this.dialog();
    if (!d) return;
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    d.file = file;
    this.formError.set(file ? this.fileProblem(file, 'certificate') : '');
  }

  /** Asks for suggestions once the typing stops for a moment, not for every letter. */
  suggest(text: string): void {
    if (this.suggestTimer) clearTimeout(this.suggestTimer);
    const query = (text || '').trim();
    if (query.length < 2) { this.suggestions.set([]); return; }
    this.suggestTimer = setTimeout(() => {
      this.suggestTimer = null;
      this.api.suggestSkills(query).subscribe({
        next: res => this.suggestions.set(res.success ? res.data ?? [] : []),
        error: () => this.suggestions.set([]),
      });
    }, SUGGEST_AFTER_MS);
  }

  /** "today", "yesterday", "5 days ago", or the date. */
  agoLabel(value: string | null | undefined): string {
    const day = this.dayOf(value);
    if (!day) return '';
    const [y, m, d] = day.split('-').map(Number);
    const now = new Date();
    const days = Math.round((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(y, m - 1, d)) / 86_400_000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    return this.dayLabel(value);
  }

  save(): void {
    const d = this.dialog();
    if (!d || this.saving()) return;

    const prepared = this.prepare(d);
    if (typeof prepared === 'string') { this.formError.set(prepared); return; }

    this.formError.set('');
    this.saving.set(true);
    prepared.subscribe({
      next: res => {
        this.saving.set(false);
        if (!res.success) { this.formError.set(res.message || 'Could not save. Please try again'); return; }
        if (this.dialog() === d) this.dialog.set(null);
        this.notify(res.message, true);
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.formError.set(err?.status === 413 ? 'The file is larger than 5 MB' : 'Could not save. Please try again');
        // the answer was lost, the save may have happened: show what is stored now
        this.load();
      },
    });
  }

  /** The call that saves the dialog, or the sentence that says what is missing. */
  private prepare(d: Dialog): Observable<ApiResponse<unknown>> | string {
    const m = d.model;
    const t = (v: unknown) => String(v ?? '').trim();

    switch (d.kind) {
      case 'profile':
        // isVisible is not sent from here: the switch is the only way to change it
        return this.api.saveProfile({
          fullName: t(m.fullName), headline: t(m.headline), summary: t(m.summary), city: t(m.city),
          contactEmail: t(m.contactEmail), contactPhone: t(m.contactPhone), dateOfBirth: t(m.dateOfBirth) || null,
        });

      case 'preferences': {
        // what is still in a box counts as typed
        this.addPreference('jobs');
        if (this.formError()) return this.formError();
        this.addPreference('locations');
        if (this.formError()) return this.formError();

        const ctc = t(m.expectedCtc);
        if (ctc && !/^[1-9]\d{0,8}$/.test(ctc)) return 'Enter the expected CTC as a yearly amount';

        return this.api.savePreferences({
          jobs: [...m.jobs], locations: [...m.locations], workModes: [...m.workModes], expectedCtc: ctc ? Number(ctc) : null,
        });
      }

      case 'experience':
        if (!t(m.organisation) || !t(m.title)) return 'Enter the organisation and your title';
        if (!t(m.startMonth)) return 'Choose the month you started';
        // a browser without a month picker shows a plain text box
        if (!MONTH.test(t(m.startMonth))) return 'Enter the start month as YYYY-MM, for example 2019-04';
        if (!m.current && t(m.endMonth) && !MONTH.test(t(m.endMonth))) return 'Enter the end month as YYYY-MM, for example 2019-04';
        return this.api.saveExperience({
          experienceId: m.experienceId, organisation: t(m.organisation), title: t(m.title),
          startMonth: `${t(m.startMonth)}-01`,
          endMonth: m.current || !t(m.endMonth) ? null : `${t(m.endMonth)}-01`,
          description: t(m.description),
        });

      case 'education':
        if (!t(m.institution) || !t(m.course)) return 'Enter the institution and the course';
        return this.api.saveEducation({
          educationId: m.educationId, institution: t(m.institution), course: t(m.course), fieldOfStudy: t(m.fieldOfStudy),
          startYear: this.yearOf(m.startYear), endYear: this.yearOf(m.endYear),
        });

      case 'skill':
        if (!t(m.skillName)) return 'Enter the skill';
        if (!this.levels.includes(m.level)) return 'Choose a level';
        if (t(m.evidenceUrl) && !HTTPS_LINK.test(t(m.evidenceUrl))) return 'The link must start with https://';
        return this.api.saveSkill({ skillId: m.skillId, skillName: t(m.skillName), level: m.level, evidenceUrl: t(m.evidenceUrl) });

      case 'certificate': {
        if (!t(m.title)) return 'Enter the title of the certificate';
        const problem = d.file ? this.fileProblem(d.file, 'certificate') : '';
        if (problem) return problem;
        return this.api.saveCertificate(
          { certificateId: m.certificateId, title: t(m.title), issuer: t(m.issuer), issuedOn: t(m.issuedOn) || null },
          d.file ?? null);
      }
    }
  }

  // ── removing ──────────────────────────────────────────────────────────────

  remove(kind: RowKind, id: number, name: string): void {
    if (!window.confirm(`Remove "${name}"?`)) return;

    const call: Observable<ApiResponse<boolean>> =
      kind === 'experience' ? this.api.deleteExperience(id)
      : kind === 'education' ? this.api.deleteEducation(id)
      : kind === 'skill' ? this.api.deleteSkill(id)
      : this.api.deleteCertificate(id);

    call.subscribe({
      next: res => { this.notify(res.message, res.success); this.load(); },
      error: () => this.notify('Could not remove it. Please try again', false),
    });
  }

  // ── resume ────────────────────────────────────────────────────────────────

  onResumePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';   // the same file can be picked again after a refusal
    if (file) this.uploadResume(file);
  }

  uploadResume(file: File): void {
    const problem = this.fileProblem(file, 'resume');
    this.resumeError.set(problem);
    if (problem || this.resumeBusy()) return;

    this.resumeBusy.set(true);
    this.api.saveResume(file).subscribe({
      next: res => {
        this.resumeBusy.set(false);
        if (!res.success) { this.resumeError.set(res.message || 'Could not upload the file'); return; }
        this.notify(res.message, true);
        this.load();
      },
      error: err => {
        this.resumeBusy.set(false);
        this.resumeError.set(err?.status === 413 ? 'The file is larger than 5 MB' : 'Could not upload the file. Please try again');
        // the answer was lost, the file may have been stored: show what is stored now
        this.load();
      },
    });
  }

  removeResume(): void {
    if (!window.confirm('Remove your resume?')) return;
    this.api.deleteResume().subscribe({
      next: res => { this.notify(res.message, res.success); this.load(); },
      error: () => this.notify('Could not remove it. Please try again', false),
    });
  }

  // ── photo ─────────────────────────────────────────────────────────────────

  private loadPhoto(): void {
    this.api.getPhoto().subscribe({
      next: blob => this.showPhoto(blob && blob.size > 0 ? blob : null),
      error: () => this.showPhoto(null),
    });
  }

  private showPhoto(blob: Blob | null): void {
    const old = this.photoUrl();
    this.photoUrl.set(blob ? URL.createObjectURL(blob) : '');
    if (old) URL.revokeObjectURL(old);
  }

  onPhotoPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';   // the same file can be picked again after a refusal
    if (file) this.uploadPhoto(file);
  }

  uploadPhoto(file: File): void {
    const problem = this.fileProblem(file, 'photo');
    this.photoError.set(problem);
    if (problem || this.photoBusy()) return;

    this.photoBusy.set(true);
    this.api.savePhoto(file).subscribe({
      next: res => {
        this.photoBusy.set(false);
        if (!res.success) { this.photoError.set(res.message || 'Could not upload the photo'); return; }
        this.notify(res.message, true);
        this.loadPhoto();
      },
      error: err => {
        this.photoBusy.set(false);
        this.photoError.set(err?.status === 413 ? 'The photo is larger than 2 MB' : 'Could not upload the photo. Please try again');
        // the answer was lost, the photo may have been stored: show what is stored now
        this.loadPhoto();
      },
    });
  }

  removePhoto(): void {
    if (!window.confirm('Remove your photo?')) return;
    this.api.deletePhoto().subscribe({
      next: res => {
        this.notify(res.message, res.success);
        if (res.success) this.showPhoto(null); else this.loadPhoto();
      },
      error: () => this.notify('Could not remove it. Please try again', false),
    });
  }

  // ── resume made from the profile ──────────────────────────────────────────

  /**
   * Opens the print window of the browser with the resume view ("Save as PDF" makes the
   * file). The page title is the name the browser proposes for the file.
   */
  downloadResume(): void {
    const name = (this.page()?.profile.fullName ?? '').trim();
    if (!name) { this.notify('Add your name to the profile first', false); return; }

    const title = document.title;
    document.title = `${name} - Resume`;
    try {
      window.print();
    } finally {
      document.title = title;
    }
  }

  /** The preferences of the page; empty ones when the API sent none. */
  prefs(page: JobProfilePage | null): JobPreferences {
    return page?.preferences ?? NO_PREFERENCES;
  }

  hasPreferences(p: JobPreferences): boolean {
    return p.jobs.length + p.locations.length + p.workModes.length > 0 || p.expectedCtc != null;
  }

  /** "₹6,00,000 per year": grouped the Indian way. */
  ctcLabel(amount: number): string {
    return `₹${amount.toLocaleString('en-IN')} per year`;
  }

  /** City, e-mail and phone on one line, as resume readers expect them. */
  contactLine(p: JobProfilePage['profile']): string {
    return [p.city, p.contactEmail, p.contactPhone].map(v => (v ?? '').trim()).filter(Boolean).join(' | ');
  }

  skillsLine(skills: JobSkill[]): string {
    return skills.map(s => `${s.skillName} (${s.level})`).join(', ');
  }

  /** The same checks the API makes on the name and the size; the API also looks into the file. */
  private fileProblem(file: File, kind: 'resume' | 'certificate' | 'photo'): string {
    const extension = (file.name.match(/\.[^.\\/]+$/)?.[0] ?? '').toLowerCase();
    const allowed = kind === 'resume' ? ['.pdf', '.doc', '.docx']
      : kind === 'photo' ? ['.jpg', '.jpeg', '.png']
      : ['.pdf', '.jpg', '.jpeg', '.png'];

    if (!allowed.includes(extension))
      return kind === 'resume' ? 'A resume must be a PDF, DOC or DOCX file'
        : kind === 'photo' ? 'A photo must be a JPG or PNG file'
        : 'A certificate must be a PDF, JPG or PNG file';
    if (file.size <= 0) return 'Choose a file';
    if (kind === 'photo' && file.size > MAX_PHOTO_BYTES) return 'The photo is larger than 2 MB';
    if (file.size > MAX_FILE_BYTES) return 'The file is larger than 5 MB';
    return '';
  }

  download(fileId: number, fileName: string): void {
    this.api.downloadFile(fileId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName || 'file';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.notify('The file could not be downloaded', false),
    });
  }

  // ── what the template shows ───────────────────────────────────────────────

  /** The first letters of the first two words of the name, for the picture place. */
  initials(name: string | null | undefined): string {
    return (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map(word => Array.from(word)[0].toUpperCase()).join('');
  }

  /** The link when it is a plain https address, '' otherwise: nothing else is ever put into an href. */
  safeLink(url: string | null | undefined): string {
    const text = (url ?? '').trim();
    return HTTPS_LINK.test(text) ? text : '';
  }

  monthLabel(value: string | null | undefined): string {
    const month = this.monthOf(value);
    if (!month) return '';
    const [year, m] = month.split('-').map(Number);
    return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${year}`;
  }

  dayLabel(value: string | null | undefined): string {
    const day = this.dayOf(value);
    if (!day) return '';
    const [year, m, d] = day.split('-').map(Number);
    return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${year}`;
  }

  years(row: JobEducation): string {
    if (row.startYear && row.endYear) return `${row.startYear} – ${row.endYear}`;
    return String(row.endYear || row.startYear || '');
  }

  sizeLabel(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} bytes`;
  }

  statusLabel(status: string): string {
    return status === 'Uploaded' ? 'Uploaded by you' : status;
  }

  // dates are taken as text: a Date object would shift them by the time zone
  private monthOf(value: string | null | undefined): string {
    return /^\d{4}-\d{2}/.test(value ?? '') ? (value as string).slice(0, 7) : '';
  }

  private dayOf(value: string | null | undefined): string {
    return /^\d{4}-\d{2}-\d{2}/.test(value ?? '') ? (value as string).slice(0, 10) : '';
  }

  private yearOf(value: unknown): number | null {
    const year = Number(value);
    return value === null || value === '' || !Number.isInteger(year) ? null : year;
  }

  private notify(text: string, ok: boolean): void {
    this.toast.set({ text: text || (ok ? 'Saved' : 'Something went wrong'), ok });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
