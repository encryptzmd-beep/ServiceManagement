import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../Models/ApiModels';
import {
  JobCertificate,
  JobEducation,
  JobExperience,
  JobInterests,
  JobPreferences,
  JobProfilePage,
  JobProfileShare,
  JobProfileView,
  JobSkill,
  JobSocialLink,
  JobWorkMode,
  JobsService,
} from '../../Services/jobs-service';
import { JobAlertsService } from '../../Services/job-alerts-service';
import { jobsMenu } from '../personal-shell-component/jobs-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';
import { VerifiedBadgeComponent } from '../verified-badge-component/verified-badge-component';
import { SOCIAL_PLATFORMS, SocialPlatform, platformOf } from './social-platforms';

type DialogKind = 'profile' | 'preferences' | 'interests' | 'social' | 'experience' | 'education' | 'skill' | 'certificate';
/** The lists of words typed into a box and shown as chips. */
type ListKind = 'jobs' | 'locations' | 'interests' | 'hobbies';
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
const MAX_INTERESTS = 15;
const MAX_SOCIAL_LINKS = 10;
/** The box each list is typed into, how many it takes, and what the limit says. */
const LISTS: Record<ListKind, { box: string; max: number; tooMany: string }> = {
  jobs: { box: 'jobInput', max: MAX_PREFERENCES, tooMany: 'Choose at most 10 preferred jobs' },
  locations: { box: 'locationInput', max: MAX_PREFERENCES, tooMany: 'Choose at most 10 preferred locations' },
  interests: { box: 'interestInput', max: MAX_INTERESTS, tooMany: 'Add at most 15 interests' },
  hobbies: { box: 'hobbyInput', max: MAX_INTERESTS, tooMany: 'Add at most 15 hobbies' },
};
const SUGGEST_AFTER_MS = 300;
const MAX_SUB_SKILLS = 20;
/** How many catalogue sub-skills are offered as chips at a time. */
const CATALOG_CHIPS = 30;
const NO_PREFERENCES: JobPreferences = { jobs: [], locations: [], workModes: [], expectedCtc: null };
const NO_INTERESTS: JobInterests = { interests: [], hobbies: [] };
const HTTPS_LINK = /^https:\/\/[^\s"<>]+$/i;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Job Portal, phase 1: the person's own profile. Everything is read and written through
 * the API for whoever is logged in; this page never sends or receives a user id.
 */
@Component({
  selector: 'app-job-profile-component',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PersonalShellComponent, VerifiedBadgeComponent],
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

  /** The shareable link: null until it is read (or when it cannot be). */
  share = signal<JobProfileShare | null>(null);
  shareBusy = signal(false);
  shareError = signal('');

  resumeError = signal('');
  resumeBusy = signal(false);

  suggestions = signal<string[]>([]);
  toast = signal<{ text: string; ok: boolean } | null>(null);

  /** The sub-skills the catalogue knows for the skill in the dialog. */
  catalog = signal<string[]>([]);

  readonly stars = [1, 2, 3, 4, 5];
  readonly maxSubSkills = MAX_SUB_SKILLS;
  readonly workModes: JobWorkMode[] = ['On-site', 'Remote', 'Hybrid'];

  private alerts = inject(JobAlertsService);
  readonly menu = computed(() => jobsMenu(this.alerts.unread()));

  /** The photo as an address the page can show ('' when there is none). */
  photoUrl = signal('');
  photoError = signal('');
  photoBusy = signal(false);

  /** Which company looked at the profile; null while it is read or when it could not be. */
  views = signal<JobProfileView[] | null>(null);

  private suggestTimer: ReturnType<typeof setTimeout> | null = null;
  private catalogTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.load();
    this.loadPhoto();
    this.loadViews();
    this.loadShare();
    this.alerts.refresh();
  }

  ngOnDestroy(): void {
    this.showPhoto(null);
    if (this.suggestTimer) clearTimeout(this.suggestTimer);
    if (this.catalogTimer) clearTimeout(this.catalogTimer);
  }

  // ── the shareable link ────────────────────────────────────────────────

  /** A failure only hides the card: the rest of the page is not affected. */
  private loadShare(): void {
    this.api.getShare().subscribe({
      next: res => this.share.set(res.success && res.data ? res.data : null),
      error: () => this.share.set(null),
    });
  }

  /** The whole address of the shared profile, for copying and sending. */
  get shareUrl(): string {
    const code = this.share()?.code;
    return code ? `${location.origin}/p/${code}` : '';
  }

  onShareChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const stored = !!this.share()?.isOn;
    if (this.shareBusy()) { input.checked = stored; return; }

    this.shareError.set('');
    this.shareBusy.set(true);
    this.api.setShare(input.checked).subscribe({
      next: res => {
        this.shareBusy.set(false);
        if (!res.success || !res.data) {
          this.shareError.set(res.message || 'Could not change this. Please try again.');
          input.checked = stored;
          return;
        }
        this.share.set(res.data);
        this.notify(res.message, true);
      },
      error: () => {
        this.shareBusy.set(false);
        this.shareError.set('Could not change this. Please try again.');
        input.checked = stored;
      },
    });
  }

  copyShareLink(): void {
    const url = this.shareUrl;
    if (!url) return;
    navigator.clipboard?.writeText(url).then(
      () => this.notify('Link copied. Paste it anywhere to share your profile', true),
      () => this.notify('Copy the link from the box', false),
    );
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
  addPreference(kind: ListKind): void {
    const m = this.dialog()?.model;
    if (!m) return;

    const { box, max, tooMany } = LISTS[kind];
    const list: string[] = m[kind];
    this.formError.set('');

    for (const entry of String(m[box] ?? '').split(',').map(v => v.trim()).filter(Boolean)) {
      if (list.some(v => v.toLowerCase() === entry.toLowerCase())) continue;
      if (list.length >= max) {
        this.formError.set(tooMany);
        break;
      }
      list.push(entry.slice(0, 100));
    }
    m[box] = '';
  }

  removePreference(kind: ListKind, index: number): void {
    this.dialog()?.model[kind].splice(index, 1);
    this.formError.set('');
  }

  toggleWorkMode(mode: JobWorkMode): void {
    const modes: JobWorkMode[] | undefined = this.dialog()?.model.workModes;
    if (!modes) return;
    const at = modes.indexOf(mode);
    if (at >= 0) modes.splice(at, 1); else modes.push(mode);
  }

  openInterests(): void {
    const i = this.interestsOf(this.page());
    this.open('interests', 'Interests & hobbies', {
      interests: [...i.interests], hobbies: [...i.hobbies], interestInput: '', hobbyInput: '',
    });
  }

  openSocialLinks(): void {
    this.open('social', 'Social media links', {
      links: this.linksOf(this.page()).map(l => l.url), linkInput: '',
    });
  }

  /**
   * Adds the address typed in the box. "linkedin.com/in/me" becomes https://linkedin.com/in/me
   * and an http address becomes https: only https addresses are stored.
   */
  addSocialLink(): void {
    const m = this.dialog()?.model;
    if (!m) return;
    this.formError.set('');

    let url = String(m.linkInput ?? '').trim();
    if (!url) return;
    if (/^http:\/\//i.test(url)) url = 'https://' + url.slice(7);
    else if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;

    if (!this.isLink(url)) { this.formError.set('Enter the full address of the profile, for example https://linkedin.com/in/your-name'); return; }
    if (m.links.some((v: string) => v.toLowerCase() === url.toLowerCase())) { this.formError.set('This link is in the list already'); return; }
    if (m.links.length >= MAX_SOCIAL_LINKS) { this.formError.set('Add at most 10 links'); return; }

    m.links.push(url);
    m.linkInput = '';
  }

  removeSocialLink(index: number): void {
    this.dialog()?.model.links.splice(index, 1);
    this.formError.set('');
  }

  /** A plain https address with a host that has a dot, as the API takes it. */
  private isLink(url: string): boolean {
    if (url.length > 400 || !HTTPS_LINK.test(url)) return false;
    try {
      const u = new URL(url);
      return u.hostname.includes('.') && !u.username && !u.password;
    } catch {
      return false;
    }
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
    this.catalog.set([]);
    this.open('skill', row ? 'Edit skill' : 'Add skill', {
      skillId: row?.skillId ?? 0, skillName: row?.skillName ?? '', rating: row?.rating ?? 0, evidenceUrl: row?.evidenceUrl ?? '',
      subSkills: (row?.subSkills ?? []).map(u => ({ name: u.name, rating: u.rating })),
      newSubSkill: '',
    });
    if (row) this.loadCatalog(row.skillName);
  }

  /** The skill name changed: suggestions for it, and the sub-skills the catalogue knows. */
  skillNameChanged(text: string): void {
    this.suggest(text);
    if (this.catalogTimer) clearTimeout(this.catalogTimer);
    this.catalogTimer = setTimeout(() => {
      this.catalogTimer = null;
      this.loadCatalog(text);
    }, SUGGEST_AFTER_MS);
  }

  private loadCatalog(skill: string): void {
    const name = (skill || '').trim();
    if (!name) { this.catalog.set([]); return; }
    this.api.catalogSubSkills(name).subscribe({
      next: res => {
        // an answer for a name that was typed over is of no use
        if ((this.dialog()?.model.skillName ?? '').trim() === name) this.catalog.set(res.success ? res.data ?? [] : []);
      },
      error: () => this.catalog.set([]),
    });
  }

  /** Catalogue sub-skills not in the list yet. */
  catalogChips(model: any): string[] {
    const taken = new Set((model.subSkills as { name: string }[]).map(u => u.name.trim().toLowerCase()));
    return this.catalog().filter(n => !taken.has(n.toLowerCase())).slice(0, CATALOG_CHIPS);
  }

  addSubSkill(model: any, name: string): void {
    const text = (name || '').trim();
    this.formError.set('');
    if (!text) return;
    if (model.subSkills.length >= MAX_SUB_SKILLS) { this.formError.set(`A skill can have up to ${MAX_SUB_SKILLS} sub-skills`); return; }
    if (model.subSkills.some((u: { name: string }) => u.name.trim().toLowerCase() === text.toLowerCase())) {
      this.formError.set('This sub-skill is in the list already');
      return;
    }
    model.subSkills.push({ name: text, rating: 0 });
    model.newSubSkill = '';
  }

  removeSubSkill(model: any, index: number): void {
    model.subSkills.splice(index, 1);
  }

  /** "4 out of 5" for a screen reader, and for the title of a star. */
  ratingLabel(rating: number): string {
    return rating ? `${rating} out of 5` : 'Not rated';
  }

  /**
   * The overall rating of the skill in the dialog: the average of the sub-skills rated so far,
   * to one decimal. 0 while none is rated. The API works it out the same way on save.
   */
  overallOf(model: any): number {
    const rated = (model.subSkills as { rating: number }[]).map(u => u.rating).filter(r => r >= 1 && r <= 5);
    if (!rated.length) return 0;
    return Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10;
  }

  /** What a skill on the page shows: the average of its sub-skills, or its own rating. */
  shownRating(s: JobSkill): number {
    return s.overall || s.rating;
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
        if (!t(m.dateOfBirth)) return 'Enter your date of birth';
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

      case 'interests': {
        // what is still in a box counts as typed
        this.addPreference('interests');
        if (this.formError()) return this.formError();
        this.addPreference('hobbies');
        if (this.formError()) return this.formError();
        return this.api.saveInterests({ interests: [...m.interests], hobbies: [...m.hobbies] });
      }

      case 'social':
        if (t(m.linkInput)) {
          this.addSocialLink();
          if (this.formError()) return this.formError();
        }
        return this.api.saveSocialLinks([...m.links]);

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
        if (t(m.evidenceUrl) && !HTTPS_LINK.test(t(m.evidenceUrl))) return 'The link must start with https://';
        if (t(m.newSubSkill)) return 'Press Add for the sub-skill you typed, or clear it';
        if (m.subSkills.some((u: { rating: number }) => !(u.rating >= 1 && u.rating <= 5))) return 'Rate every sub-skill from 1 to 5';
        // with sub-skills the overall rating is theirs; without them the skill is rated itself
        // (from the exact average, as the API does: 3.45 is 3, not 3.5 and then 4)
        const rating = m.subSkills.length
          ? Math.round(m.subSkills.reduce((a: number, u: { rating: number }) => a + u.rating, 0) / m.subSkills.length)
          : m.rating;
        if (!(rating >= 1 && rating <= 5)) return 'Rate the skill from 1 to 5';
        return this.api.saveSkill({
          skillId: m.skillId, skillName: t(m.skillName), rating, evidenceUrl: t(m.evidenceUrl),
          subSkills: m.subSkills.map((u: { name: string; rating: number }) => ({ name: t(u.name), rating: u.rating })),
        });

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

  /** The interests and hobbies of the page; empty ones when the API sent none. */
  interestsOf(page: JobProfilePage | null): JobInterests {
    return page?.interests ?? NO_INTERESTS;
  }

  /** The social links of the page that are plain https addresses. */
  linksOf(page: JobProfilePage | null): JobSocialLink[] {
    return (page?.socialLinks ?? []).filter(l => !!this.safeLink(l.url));
  }

  /** The platform an address belongs to, for the logo in the dialog before it is saved. */
  platformOf(url: string): string {
    return platformOf(url);
  }

  /** The logo and colour of a platform; null for a Website, which shows a globe. */
  logo(platform: string): SocialPlatform | null {
    return SOCIAL_PLATFORMS[platform] ?? null;
  }

  /** "linkedin.com/in/someone": the address without https:// and www. */
  shortLink(url: string): string {
    return url.replace(/^https:\/\/(www\.)?/i, '').replace(/\/$/, '');
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
    return skills.map(s => {
      const parts = (s.subSkills ?? []).map(u => `${u.name} ${u.rating}/5`).join(', ');
      return `${s.skillName} (${this.shownRating(s)}/5${parts ? `: ${parts}` : ''})`;
    }).join('; ');
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

  /** Full years since the date of birth; null without one (or one in the future). */
  ageOf(dateOfBirth: string | null | undefined, today = new Date()): number | null {
    const day = this.dayOf(dateOfBirth);
    if (!day) return null;
    const [y, m, d] = day.split('-').map(Number);
    let age = today.getFullYear() - y;
    if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
    return age >= 0 && age < 130 ? age : null;
  }

  /**
   * The time worked over all experience entries: "5 yrs 3 mos", "8 mos", '' for none.
   * Months in which two jobs overlap count once; a job without an end runs to this month.
   */
  experienceLabel(rows: JobExperience[] | null | undefined, today = new Date()): string {
    const now = today.getFullYear() * 12 + today.getMonth();
    const index = (value: string | null | undefined) => {
      const month = this.monthOf(value);
      if (!month) return null;
      const [y, m] = month.split('-').map(Number);
      return y * 12 + m - 1;
    };

    const spans = (rows ?? [])
      .map(r => [index(r.startMonth), r.endMonth ? index(r.endMonth) : now] as const)
      .filter((s): s is readonly [number, number] => s[0] != null && s[1] != null && s[0] <= Math.min(s[1], now))
      .map(([start, end]) => [start, Math.min(end, now)])
      .sort((a, b) => a[0] - b[0]);

    // both months count: April to June is three months
    let months = 0;
    let open = -1;
    let close = -1;
    for (const [start, end] of spans) {
      if (start > close + 1) {
        if (close >= open && open >= 0) months += close - open + 1;
        open = start;
        close = end;
      } else {
        close = Math.max(close, end);
      }
    }
    if (open >= 0) months += close - open + 1;

    const years = Math.floor(months / 12);
    const rest = months % 12;
    return [years ? `${years} ${years === 1 ? 'yr' : 'yrs'}` : '', rest ? `${rest} ${rest === 1 ? 'mo' : 'mos'}` : '']
      .filter(Boolean).join(' ');
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

  /** Verified, Rejected, Waiting (a file to check) or Uploaded (no file: nothing to check). */
  certificateState(c: { status: string; fileId: number }): string {
    if (c.status === 'Verified' || c.status === 'Rejected') return c.status;
    return c.fileId ? 'Waiting' : 'Uploaded';
  }

  certificateLabel(c: { status: string; fileId: number }): string {
    switch (this.certificateState(c)) {
      case 'Verified': return 'Verified';
      case 'Rejected': return 'Not verified';
      case 'Waiting': return 'Waiting for verification';
      default: return 'Uploaded by you';
    }
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
