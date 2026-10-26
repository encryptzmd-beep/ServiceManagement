import { Component, ElementRef, OnDestroy, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CompanyJobsService } from '../../Services/company-jobs-service';
import { JobAlertsService } from '../../Services/job-alerts-service';
import { JobsService } from '../../Services/jobs-service';
import { ChatMessage, Conversation, ConversationSummary, MessageSide, MessagesService } from '../../Services/messages-service';
import { NotificationService } from '../../Services/notification-service';
import { jobPath } from '../../Services/public-jobs-service';
import { initial } from '../../Services/job-labels';
import { CONSULTANCY_MENU } from '../personal-shell-component/consultancy-menu';
import { jobsMenu } from '../personal-shell-component/jobs-menu';
import { PersonalShellComponent } from '../personal-shell-component/personal-shell-component';
import { VerifiedBadgeComponent } from '../verified-badge-component/verified-badge-component';

/** A job that can be put into a message. */
interface ShareableJob { postingId: number; title: string; city: string; }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REFRESH_EVERY_MS = 30_000;

/**
 * Messages, like LinkedIn: the conversations on the left, the open one on the right. One page
 * for both sides (the route says which): the person in Job Portal (/apps/jobs/messages) and the
 * company in Job Consultancy (/consultancy/messages). `?c=<id>` opens a conversation. A message
 * can carry a job: the person shares a saved job, the company one of its open jobs. New messages
 * arrive with the notifications (SignalR); the page also looks again every 30 seconds.
 */
@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [FormsModule, RouterModule, PersonalShellComponent, VerifiedBadgeComponent],
  templateUrl: './messages-component.html',
  styleUrls: ['../job-profile-component/job-profile-component.scss', './messages-component.scss'],
})
export class MessagesComponent implements OnDestroy {
  private api = inject(MessagesService);
  private jobs = inject(JobsService);
  private companyJobs = inject(CompanyJobsService);
  private notices = inject(NotificationService);
  private alerts = inject(JobAlertsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly side: MessageSide = this.route.snapshot.data['side'] === 'company' ? 'company' : 'person';
  readonly menu = computed(() => (this.side === 'company' ? CONSULTANCY_MENU : jobsMenu(this.alerts.unread())));

  loading = signal(true);
  unavailable = signal('');
  conversations = signal<ConversationSummary[]>([]);
  filter = '';

  openId = signal<number | null>(null);
  open = signal<Conversation | null>(null);
  openLoading = signal(false);

  draft = '';
  sending = signal(false);
  sendError = signal('');
  /** The job put into the message being written. */
  attached = signal<ShareableJob | null>(null);
  pickerOpen = signal(false);
  shareable = signal<ShareableJob[] | null>(null);

  toast = signal<{ text: string; ok: boolean } | null>(null);

  private thread = viewChild<ElementRef<HTMLElement>>('thread');
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly initial = initial;

  readonly shown = computed(() => {
    const q = this.filterText().toLowerCase();
    const list = this.conversations();
    return q ? list.filter(c => this.otherName(c).toLowerCase().includes(q) || (c.postingTitle || '').toLowerCase().includes(q)) : list;
  });
  private filterText = signal('');

  constructor() {
    this.route.queryParamMap.subscribe(params => {
      const id = Number(params.get('c'));
      if (Number.isInteger(id) && id > 0) this.select(id, false);
    });
    this.loadList();

    // a message arrives with the notifications: the list and the open conversation follow
    let seen = untracked(() => this.notices.arrived());
    effect(() => {
      const now = this.notices.arrived();
      if (now === seen) return;
      seen = now;
      if (untracked(() => this.notices.incoming())?.kind === 'Message') untracked(() => this.refresh());
    });
    this.timer = setInterval(() => this.refresh(), REFRESH_EVERY_MS);
    if (this.side === 'person') this.alerts.refresh();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ── reading ───────────────────────────────────────────────────────────────

  loadList(): void {
    this.api.list(this.side).subscribe({
      next: res => {
        this.loading.set(false);
        if (!res.success) { this.unavailable.set(res.message || 'Messages are not available right now'); return; }
        this.unavailable.set('');
        // the open conversation is being read: the list may have been read before it was
        const reading = this.openId();
        this.conversations.set((res.data ?? []).map(c => (c.conversationId === reading ? { ...c, unread: 0 } : c)));
        // a wide screen opens the newest conversation at once
        if (this.openId() == null && (res.data?.length ?? 0) > 0 && window.matchMedia?.('(min-width: 900px)').matches) {
          this.select(res.data![0].conversationId, false);
        }
      },
      error: () => { this.loading.set(false); this.unavailable.set('Messages could not be loaded. Please try again.'); },
    });
  }

  private refresh(): void {
    this.loadList();
    const id = this.openId();
    if (id != null) this.loadOpen(id, true);
  }

  setFilter(text: string): void {
    this.filterText.set(text.trim());
  }

  /** Opens a conversation; `updateUrl` keeps ?c= in the address, so a reload opens it again. */
  select(id: number, updateUrl = true): void {
    if (this.openId() !== id) {
      this.draft = '';
      this.attached.set(null);
      this.sendError.set('');
      this.pickerOpen.set(false);
    }
    this.openId.set(id);
    this.loadOpen(id, false);
    if (updateUrl) this.router.navigate([], { relativeTo: this.route, queryParams: { c: id }, replaceUrl: true });
  }

  back(): void {
    this.openId.set(null);
    this.open.set(null);
    this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
  }

  private loadOpen(id: number, quiet: boolean): void {
    if (!quiet) this.openLoading.set(true);
    this.api.get(this.side, id).subscribe({
      next: res => {
        this.openLoading.set(false);
        if (this.openId() !== id) return;
        if (!res.success || !res.data) {
          if (!quiet) { this.open.set(null); this.notify(res.message === 'Not found' ? 'This conversation is not there any more' : res.message, false); }
          return;
        }
        const grew = (res.data.messages.length ?? 0) !== (this.open()?.messages.length ?? -1);
        this.open.set(res.data);
        // it is read now: its unread count goes
        this.conversations.update(list => list.map(c => (c.conversationId === id ? { ...c, unread: 0 } : c)));
        if (grew) this.scrollDown();
      },
      error: () => { this.openLoading.set(false); if (!quiet) this.notify('The conversation could not be opened', false); },
    });
  }

  private scrollDown(): void {
    setTimeout(() => {
      const el = this.thread()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  // ── writing ───────────────────────────────────────────────────────────────

  get blockedForMe(): boolean {
    return this.side === 'company' && !!this.open()?.blockedByPerson;
  }

  onKey(event: KeyboardEvent): void {
    // Enter sends, Shift+Enter is a new line
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.send();
    }
  }

  send(): void {
    const c = this.open();
    if (!c || this.sending() || this.blockedForMe) return;

    const body = this.draft.trim();
    const job = this.attached();
    if (!body && !job) return;
    if (body.length > 2000) { this.sendError.set('A message can have at most 2000 characters'); return; }

    this.sending.set(true);
    this.sendError.set('');
    this.api.send(this.side, c.conversationId, { body, sharePostingId: job?.postingId ?? null }).subscribe({
      next: res => {
        this.sending.set(false);
        if (!res.success) { this.sendError.set(res.message || 'The message could not be sent'); return; }
        this.draft = '';
        this.attached.set(null);
        this.loadOpen(c.conversationId, true);
        this.loadList();
      },
      error: () => { this.sending.set(false); this.sendError.set('The message could not be sent. Please try again'); },
    });
  }

  /** The jobs that can be shared: the person's saved jobs that are open, or the company's open jobs. */
  togglePicker(): void {
    const next = !this.pickerOpen();
    this.pickerOpen.set(next);
    if (!next || this.shareable() !== null) return;

    if (this.side === 'company') {
      this.companyJobs.getPostings().subscribe({
        next: res => this.shareable.set((res.data ?? []).filter(p => p.status === 'Open').map(p => ({ postingId: p.postingId!, title: p.title, city: p.city }))),
        error: () => this.shareable.set([]),
      });
    } else {
      this.jobs.getSaved().subscribe({
        next: res => this.shareable.set((res.data ?? []).filter(p => p.isOpen).map(p => ({ postingId: p.postingId, title: p.title, city: p.city }))),
        error: () => this.shareable.set([]),
      });
    }
  }

  attach(job: ShareableJob): void {
    this.attached.set(job);
    this.pickerOpen.set(false);
  }

  toggleBlock(): void {
    const c = this.open();
    if (!c || this.side !== 'person') return;
    const blocked = !c.blockedByPerson;
    if (blocked && !window.confirm(`Block ${c.companyName}? They will not be able to write to you here until you write to them again.`)) return;
    this.api.block(c.conversationId, blocked).subscribe({
      next: res => {
        this.notify(res.message, res.success);
        if (res.success) {
          this.open.update(o => (o ? { ...o, blockedByPerson: blocked } : o));
          this.conversations.update(list => list.map(x => (x.conversationId === c.conversationId ? { ...x, blockedByPerson: blocked } : x)));
        }
      },
      error: () => this.notify('Could not change this. Please try again', false),
    });
  }

  // ── what the template shows ───────────────────────────────────────────────

  otherName(c: { companyName: string; fullName: string }): string {
    return this.side === 'person' ? c.companyName : c.fullName || 'Job Portal user';
  }

  mine(m: ChatMessage): boolean {
    return (m.fromSide === 'Person') === (this.side === 'person');
  }

  /** The link of a shared job: its page in Job Portal for the person, the public page for the company. */
  jobLink(p: { postingId: number; title: string; city: string }): string {
    return this.side === 'person' ? `/apps/jobs/job/${p.postingId}` : jobPath(p);
  }

  /** The other side read the last message the page sent. */
  seen(c: Conversation): boolean {
    const last = [...c.messages].reverse().find(m => this.mine(m));
    return !!last && !!c.otherReadAt && c.otherReadAt >= last.createdAt;
  }

  isLastMine(c: Conversation, m: ChatMessage): boolean {
    const last = [...c.messages].reverse().find(x => this.mine(x));
    return last?.messageId === m.messageId;
  }

  /** "14:05" today, "Mon" this week, "12 Oct" before. Dates are taken as text (no time zone shift). */
  when(value: string): string {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value ?? '')) return '';
    const [date, time] = value.split('T');
    const [y, m, d] = date.split('-').map(Number);
    const today = new Date();
    if (y === today.getFullYear() && m === today.getMonth() + 1 && d === today.getDate()) return time.slice(0, 5);
    return `${d} ${MONTHS[m - 1]}${y !== today.getFullYear() ? ' ' + y : ''}`;
  }

  /** A new day in the conversation: a line with the date. */
  dayBreak(c: Conversation, index: number): string {
    const day = c.messages[index].createdAt.slice(0, 10);
    if (index > 0 && c.messages[index - 1].createdAt.slice(0, 10) === day) return '';
    const [y, m, d] = day.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }

  private notify(text: string | undefined, ok: boolean): void {
    this.toast.set({ text: text || (ok ? 'Done' : 'Something went wrong'), ok });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
