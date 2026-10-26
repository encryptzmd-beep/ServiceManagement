import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CertificateReview, PersonReview, PersonReviewShow, PlatformService, PostingReview } from '../../Services/platform-service';
import { VerifiedBadgeComponent } from '../verified-badge-component/verified-badge-component';

type Filter = 'all' | 'certificates' | 'postings' | 'people';

/** One thing that waits: a certificate or a job, in one list. */
export type ReviewItem =
  | { kind: 'certificate'; key: string; at: string; item: CertificateReview }
  | { kind: 'posting'; key: string; at: string; item: PostingReview };

/**
 * Platform Admin, Verification: everything that waits for a platform administrator in one
 * list, oldest first: certificates people uploaded and jobs companies want to publish.
 * Approving needs one click; refusing needs a reason, which the person or the company reads.
 * People are a list of their own (they do not wait): the administrator verifies a person,
 * which gives the Verified tick, or takes the tick away with a reason the person reads.
 */
@Component({
  selector: 'app-verification-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, VerifiedBadgeComponent],
  templateUrl: './verification-panel-component.html',
  styleUrl: './verification-panel-component.scss',
})
export class VerificationPanelComponent implements OnInit {
  private api = inject(PlatformService);

  loading = signal(true);
  error = signal('');
  certificates = signal<CertificateReview[]>([]);
  postings = signal<PostingReview[]>([]);
  filter = signal<Filter>('all');

  /** The item whose refusal is being written, and the reason typed so far. */
  refusing = signal<string | null>(null);
  reason = '';
  busy = signal<string | null>(null);
  itemError = signal<{ key: string; text: string } | null>(null);
  toast = signal<{ text: string; ok: boolean } | null>(null);

  readonly items = computed<ReviewItem[]>(() => {
    const certificates: ReviewItem[] = this.certificates().map(c => ({ kind: 'certificate', key: `c${c.certificateId}`, at: c.submittedAt, item: c }));
    const postings: ReviewItem[] = this.postings().map(p => ({ kind: 'posting', key: `p${p.postingId}`, at: p.submittedAt, item: p }));
    if (this.filter() === 'people') return [];
    const shown = this.filter() === 'certificates' ? certificates : this.filter() === 'postings' ? postings : [...certificates, ...postings];
    return shown.sort((a, b) => a.at.localeCompare(b.at));
  });

  /** People to verify: the page shown, what is searched and which of them. */
  people = signal<PersonReview[]>([]);
  peopleTotal = signal(0);
  peopleLoading = signal(false);
  peopleError = signal('');
  peopleShow = signal<PersonReviewShow>('waiting');
  peoplePage = signal(1);
  peoplePageSize = signal(20);
  peopleQuery = '';
  private peopleLoaded = false;

  get peopleLastPage(): number {
    return Math.max(1, Math.ceil(this.peopleTotal() / this.peoplePageSize()));
  }

  ngOnInit(): void {
    this.load();
  }

  showFilter(filter: Filter): void {
    this.filter.set(filter);
    this.cancelRefusal();
    if (filter === 'people' && !this.peopleLoaded) this.loadPeople(1);
  }

  refresh(): void {
    if (this.filter() === 'people') this.loadPeople(this.peoplePage());
    else this.load();
  }

  loadPeople(page: number): void {
    this.peopleLoaded = true;
    this.peopleLoading.set(true);
    this.api.getPeopleForReview(this.peopleQuery.trim(), this.peopleShow(), page).subscribe({
      next: res => {
        this.peopleLoading.set(false);
        if (!res.success || !res.data) { this.peopleError.set(res.message || 'The list could not be loaded'); return; }
        this.peopleError.set('');
        this.people.set(res.data.items ?? []);
        this.peopleTotal.set(res.data.total ?? 0);
        this.peoplePage.set(res.data.page || page);
        this.peoplePageSize.set(res.data.pageSize || 20);
      },
      error: () => { this.peopleLoading.set(false); this.peopleError.set('The list could not be loaded. Please try again.'); },
    });
  }

  setPeopleShow(show: PersonReviewShow): void {
    this.peopleShow.set(show);
    this.cancelRefusal();
    this.loadPeople(1);
  }

  personKey(p: PersonReview): string {
    return `u${p.candidateKey}`;
  }

  verifyPerson(p: PersonReview): void {
    this.decidePerson(p, true, '');
  }

  startPersonRefusal(p: PersonReview): void {
    this.reason = '';
    this.itemError.set(null);
    this.refusing.set(this.personKey(p));
  }

  unverifyPerson(p: PersonReview): void {
    const reason = this.reason.trim();
    const key = this.personKey(p);
    if (!reason) { this.itemError.set({ key, text: 'Say why the tick is taken away. The person reads it' }); return; }
    if (reason.length > 500) { this.itemError.set({ key, text: 'The reason can have at most 500 characters' }); return; }
    this.decidePerson(p, false, reason);
  }

  private decidePerson(p: PersonReview, verify: boolean, note: string): void {
    const key = this.personKey(p);
    if (this.busy()) return;
    this.busy.set(key);
    this.itemError.set(null);

    this.api.decidePerson(p.candidateKey, verify, note).subscribe({
      next: res => {
        this.busy.set(null);
        if (!res.success) { this.itemError.set({ key, text: res.message || 'Could not save the decision' }); return; }
        this.refusing.set(null);
        this.reason = '';
        if (this.peopleShow() === 'all') {
          // the list keeps everybody: only the tick changes
          this.people.update(list => list.map(x => x.candidateKey !== p.candidateKey ? x
            : { ...x, verifiedAt: verify ? new Date().toISOString() : null, verifiedBy: verify ? 'you' : '' }));
        } else {
          this.people.update(list => list.filter(x => x.candidateKey !== p.candidateKey));
          this.peopleTotal.update(n => Math.max(0, n - 1));
        }
        this.notify(res.message, true);
      },
      error: () => { this.busy.set(null); this.itemError.set({ key, text: 'Could not save the decision. Please try again' }); },
    });
  }

  load(): void {
    this.loading.set(true);
    this.api.getVerificationQueue().subscribe({
      next: res => {
        this.loading.set(false);
        if (!res.success || !res.data) { this.error.set(res.message || 'The list could not be loaded'); return; }
        this.error.set('');
        this.certificates.set(res.data.certificates ?? []);
        this.postings.set(res.data.postings ?? []);
      },
      error: () => { this.loading.set(false); this.error.set('The list could not be loaded. Please try again.'); },
    });
  }

  approve(entry: ReviewItem): void {
    this.decide(entry, true, '');
  }

  startRefusal(entry: ReviewItem): void {
    this.reason = '';
    this.itemError.set(null);
    this.refusing.set(entry.key);
  }

  cancelRefusal(): void {
    this.refusing.set(null);
    this.reason = '';
  }

  refuse(entry: ReviewItem): void {
    const reason = this.reason.trim();
    if (!reason) {
      this.itemError.set({ key: entry.key, text: entry.kind === 'certificate' ? 'Say why the certificate is not verified' : 'Say why the job is returned, so that the company can correct it' });
      return;
    }
    if (reason.length > 500) { this.itemError.set({ key: entry.key, text: 'The reason can have at most 500 characters' }); return; }
    this.decide(entry, false, reason);
  }

  private decide(entry: ReviewItem, approve: boolean, note: string): void {
    if (this.busy()) return;
    this.busy.set(entry.key);
    this.itemError.set(null);

    const call = entry.kind === 'certificate'
      ? this.api.decideCertificate(entry.item.certificateId, approve, note)
      : this.api.decidePosting(entry.item.postingId, approve, note);

    call.subscribe({
      next: res => {
        this.busy.set(null);
        if (!res.success) {
          this.itemError.set({ key: entry.key, text: res.message || 'Could not save the decision' });
          // decided elsewhere or changed meanwhile: show what waits now
          if ((res.message ?? '').includes('no longer waits')) this.load();
          return;
        }
        this.refusing.set(null);
        this.reason = '';
        this.drop(entry);
        this.notify(res.message, true);
      },
      error: () => { this.busy.set(null); this.itemError.set({ key: entry.key, text: 'Could not save the decision. Please try again' }); },
    });
  }

  private drop(entry: ReviewItem): void {
    if (entry.kind === 'certificate') this.certificates.update(list => list.filter(c => c.certificateId !== entry.item.certificateId));
    else this.postings.update(list => list.filter(p => p.postingId !== entry.item.postingId));
  }

  viewFile(c: CertificateReview): void {
    this.api.getCertificateFileForReview(c.certificateId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = c.fileName || 'certificate';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.notify('The file could not be opened', false),
    });
  }

  // ── what the template shows ───────────────────────────────────────────────

  dayLabel(value: string | null | undefined): string {
    if (!/^\d{4}-\d{2}-\d{2}/.test(value ?? '')) return '';
    const [y, m, d] = (value as string).slice(0, 10).split('-').map(Number);
    return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
  }

  range(min: number | null | undefined, max: number | null | undefined, unit: string): string {
    if (min != null && max != null) return min === max ? `${min} ${unit}` : `${min} – ${max} ${unit}`;
    if (min != null) return `from ${min} ${unit}`;
    if (max != null) return `up to ${max} ${unit}`;
    return '';
  }

  private notify(text: string | undefined, ok: boolean): void {
    this.toast.set({ text: text || (ok ? 'Done' : 'Something went wrong'), ok });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
