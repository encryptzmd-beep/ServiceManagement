import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CrmBoardCardDto, CrmBoardDto, CrmMasterDto, CrmMemberDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmRefusedComponent } from '../crm-shell-component/crm-refused';
import { CrmStatusDialogComponent } from '../crm-shell-component/crm-status-dialog-component';
import { FORBIDDEN, pill, refusalOf, rupees, showDateTime } from '../crm-shell-component/crm-ui';
import { ATTENTION, AttentionKey, BOARD_COLUMNS, badgesOf, boardHeight, columnValue, columnsOf } from './crm-board';

/** A drop waiting for the person to confirm it in the dialog. */
interface PendingMove { card: CrmBoardCardDto; fromStatus: string; toStatus: string; mode: 'status' | 'lost'; }

const LOST = 'Lost';

const DENSITY_KEY = 'crm.board.density';
function readDensity(): 'comfortable' | 'compact' {
  try { return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable'; } catch { return 'comfortable'; }
}

/**
 * /crm/dashboard: the open leads as a Kanban board, one column per open status, with an attention strip that
 * filters it. Dragging a card to another column (or to "Mark lost") asks for confirmation and changes the
 * status; the server decides, and a refused move puts the card back.
 */
@Component({
  selector: 'app-crm-dashboard',
  standalone: true,
  imports: [RouterLink, CdkScrollable, CdkDropListGroup, CdkDropList, CdkDrag, CrmRefusedComponent, CrmStatusDialogComponent],
  templateUrl: './crm-dashboard-component.html',
  styleUrls: ['../crm-shell-component/crm-pages.scss', './crm-dashboard-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmDashboardComponent {
  private crm = inject(CrmService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private frame = 0;

  readonly forbidden = FORBIDDEN;
  readonly attention = ATTENTION;
  readonly columnNames = BOARD_COLUMNS;
  readonly rupees = rupees;
  readonly pill = pill;
  readonly showDateTime = showDateTime;
  readonly badgesOf = badgesOf;
  readonly columnValue = columnValue;
  /** Touch waits before a drag starts, so a finger can still scroll the board. */
  readonly dragDelay = { touch: 250, mouse: 0 };

  board = signal<CrmBoardDto | null>(null);
  /** The cards as shown: the board's cards with any move not yet confirmed. */
  cards = signal<CrmBoardCardDto[]>([]);
  error = signal('');
  message = signal('');
  filter = signal<AttentionKey | null>(null);
  dragging = signal(false);
  pending = signal<PendingMove | null>(null);
  busy = signal(false);

  isManager = signal(false);
  owners = signal<CrmMemberDto[]>([]);
  ownerUserId = signal<number | null>(null);
  lostReasons = signal<CrmMasterDto[]>([]);

  /** Card density: 'comfortable' (three lines a card) or 'compact' (two lines, the most cards on screen). */
  density = signal<'comfortable' | 'compact'>(readDensity());

  setDensity(d: 'comfortable' | 'compact'): void {
    this.density.set(d);
    try { localStorage.setItem(DENSITY_KEY, d); } catch { /* storage blocked: the choice lasts this visit */ }
  }

  /** The follow-up as "22 Nov, 11:00 am" (the year only when it is not this year). */
  shortWhen(value: string | null | undefined): string {
    if (!value) return '';
    const at = new Date(value);
    if (Number.isNaN(at.getTime())) return '';
    const sameYear = at.getFullYear() === new Date().getFullYear();
    const day = at.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
    const time = at.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    return `${day}, ${time}`;
  }

  /** Initials of the owner, for the small avatar. */
  initials(name: string | null | undefined): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
  }

  /** The badges other than the follow-up ones, which the follow-up line already shows by its colour. */
  otherBadges(card: CrmBoardCardDto) {
    return badgesOf(card).filter(b => b.label !== 'Overdue' && b.label !== 'Today' && b.label !== 'No follow-up');
  }

  readonly columns = computed(() => {
    const cols = columnsOf(this.cards(), this.filter());
    return this.columnNames.map(status => ({ status, cards: cols[status], value: columnValue(cols[status]) }));
  });

  constructor() {
    this.load();
    // Tablet / desktop: the board is in normal flow with a measured height, so the footer always sits below it.
    const schedule = () => { if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.fitBoard(); }); };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(this.host.nativeElement);
    window.addEventListener('resize', schedule);
    effect(() => { this.board(); this.error(); this.message(); this.filter(); schedule(); });
    inject(DestroyRef).onDestroy(() => {
      observer?.disconnect();
      window.removeEventListener('resize', schedule);
      if (this.frame) cancelAnimationFrame(this.frame);
    });
    this.crm.me().subscribe({ next: res => {
      const manager = !!(res.success && res.data?.isManager);
      this.isManager.set(manager);
      if (manager) this.crm.getMembers().subscribe({
        next: m => this.owners.set(m.success ? (m.data?.members ?? []).filter(x => x.isActive) : []), error: () => {},
      });
    }, error: () => {} });
    this.crm.getMasters('lost-reasons').subscribe({
      next: res => this.lostReasons.set(res.success ? (res.data ?? []).filter(r => r.isActive) : []), error: () => {},
    });
  }

  private fitBoard(): void {
    const board = this.host.nativeElement.querySelector('.crm-board');
    if (!(board instanceof HTMLElement)) return;
    if (window.innerWidth <= 640) { board.style.height = ''; return; }
    const footer = document.querySelector('app-footer')?.getBoundingClientRect().height || 43;
    board.style.height = '';
    const top = board.getBoundingClientRect().top;
    board.style.height = boardHeight(window.innerHeight, top, footer) + 'px';
  }

  load(): void {
    this.crm.getBoard(this.ownerUserId() ?? undefined).subscribe({
      next: res => {
        if (res.success && res.data) { this.board.set(res.data); this.cards.set(res.data.cards ?? []); this.error.set(''); }
        else this.error.set(res.message || 'The board could not be read');
      },
      error: err => this.error.set(refusalOf(err)),
    });
  }

  setOwner(value: string): void {
    this.ownerUserId.set(value ? Number(value) : null);
    this.load();
  }

  toggleFilter(key: AttentionKey): void {
    this.filter.update(f => (f === key ? null : key));
  }

  countOf(key: AttentionKey): number {
    const rule = ATTENTION.find(a => a.key === key)!;
    return Number(this.board()?.counts?.[rule.count] ?? 0);
  }

  /**
   * A drag started: show the "Mark lost" zone. The zone is always in the DOM (hidden), so it is already in the
   * drop list group when CDK collects the source list's siblings; nothing here has to render synchronously.
   */
  dragStarted(): void {
    this.dragging.set(true);
    this.message.set('');
  }

  /** A drag ended. CDK has already chosen the drop list by now, so hiding the zone cannot lose the drop. */
  dragEnded(): void {
    this.dragging.set(false);
  }

  /** A card was dropped on a list (the one it came from, another column or the lost zone). */
  dropped(event: CdkDragDrop<any, any, CrmBoardCardDto>): void {
    this.dragging.set(false);
    if (event.previousContainer === event.container) return;
    this.onDrop(event.item.data, String(event.container.data));
  }

  /** Move the card at once and ask to confirm; nothing is sent until the person confirms. */
  onDrop(card: CrmBoardCardDto, toStatus: string): void {
    if (this.pending() || card.status === toStatus) return;
    this.message.set('');
    this.pending.set({ card, fromStatus: card.status, toStatus, mode: toStatus === LOST ? 'lost' : 'status' });
    this.setStatus(card.leadId, toStatus);
  }

  cancelMove(): void {
    const p = this.pending();
    if (!p) return;
    this.setStatus(p.card.leadId, p.fromStatus);
    this.pending.set(null);
  }

  confirmMove(answer: { note: string; lostReasonId: number | null }): void {
    const p = this.pending();
    if (!p || this.busy()) return;
    this.busy.set(true);
    this.crm.changeStatus(p.card.leadId, {
      status: p.toStatus,
      note: answer.note || null,
      lostReasonId: p.mode === 'lost' ? answer.lostReasonId : null,
    }).subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success) { this.refuse(p, res.message || 'The status could not be changed'); return; }
        this.pending.set(null);
        this.load();
      },
      error: err => {
        this.busy.set(false);
        const said = refusalOf(err);
        if (said === FORBIDDEN) { this.pending.set(null); this.error.set(said); return; }
        this.refuse(p, said);
      },
    });
  }

  private refuse(p: PendingMove, said: string): void {
    this.setStatus(p.card.leadId, p.fromStatus);
    this.pending.set(null);
    this.message.set(said);
  }

  private setStatus(leadId: number, status: string): void {
    this.cards.update(list => list.map(c => (c.leadId === leadId ? { ...c, status } : c)));
  }
}
