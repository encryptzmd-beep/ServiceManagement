import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../Models/ApiModels';
import {
  JobCertificate,
  JobEducation,
  JobExperience,
  JobProfilePage,
  JobSkill,
  JobsService,
} from '../../Services/jobs-service';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';

type DialogKind = 'profile' | 'experience' | 'education' | 'skill' | 'certificate';
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
const HTTPS_LINK = /^https:\/\/[^\s"<>]+$/i;

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
export class JobProfileComponent implements OnInit {
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

  ngOnInit(): void {
    this.load();
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

  suggest(text: string): void {
    const query = (text || '').trim();
    if (query.length < 2) { this.suggestions.set([]); return; }
    this.api.suggestSkills(query).subscribe({
      next: res => this.suggestions.set(res.success ? res.data ?? [] : []),
      error: () => this.suggestions.set([]),
    });
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
        this.dialog.set(null);
        this.notify(res.message, true);
        this.load();
      },
      error: err => {
        this.saving.set(false);
        this.formError.set(err?.status === 413 ? 'The file is larger than 5 MB' : 'Could not save. Please try again');
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

      case 'experience':
        if (!t(m.organisation) || !t(m.title)) return 'Enter the organisation and your title';
        if (!t(m.startMonth)) return 'Choose the month you started';
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

  /** The same checks the API makes on the name and the size; the API also looks into the file. */
  private fileProblem(file: File, kind: 'resume' | 'certificate'): string {
    const extension = (file.name.match(/\.[^.\\/]+$/)?.[0] ?? '').toLowerCase();
    const allowed = kind === 'resume' ? ['.pdf', '.doc', '.docx'] : ['.pdf', '.jpg', '.jpeg', '.png'];

    if (!allowed.includes(extension))
      return kind === 'resume' ? 'A resume must be a PDF, DOC or DOCX file' : 'A certificate must be a PDF, JPG or PNG file';
    if (file.size <= 0) return 'Choose a file';
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
