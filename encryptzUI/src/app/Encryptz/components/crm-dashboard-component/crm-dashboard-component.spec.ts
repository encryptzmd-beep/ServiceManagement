import { CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CrmBoardCardDto, CrmBoardDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { CrmDashboardComponent } from './crm-dashboard-component';

function boardCard(over: Partial<CrmBoardCardDto> = {}): CrmBoardCardDto {
  return {
    leadId: 1, leadNo: 'LD-0001', contactName: 'Ravi', city: 'Kochi', status: 'New', priority: 'Normal',
    ownerUserId: 1, ownerName: 'Anu', nextFollowUpAt: null, statusSince: null, daysInStage: 0,
    quotationId: null, quotationNo: null, quotationStatus: null, quotationValue: null, quotationSentAt: null,
    isOverdue: false, isDueToday: false, isNewNotContacted: false, hasNoFollowUp: false, isQuotationWaiting: false, isStuck: false,
    ...over,
  };
}

describe('CrmDashboardComponent', () => {
  let crm: any;
  let board: CrmBoardDto;
  let changeCalls: any[];
  let boardCalls: number;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrmDashboardComponent],
      providers: [provideRouter([]), { provide: CrmService, useValue: crm }],
    });
    const fixture = TestBed.createComponent(CrmDashboardComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, cmp: fixture.componentInstance };
  };
  const col = (el: HTMLElement, status: string) => el.querySelector(`.crm-col[data-status="${status}"]`) as HTMLElement;
  const cardIds = (el: HTMLElement, status: string) =>
    Array.from(col(el, status).querySelectorAll('.crm-kcard')).map(a => a.getAttribute('href'));
  const dialog = (el: HTMLElement) => el.querySelector('app-crm-status-dialog') as HTMLElement | null;
  const button = (root: HTMLElement, text: string) =>
    Array.from(root.querySelectorAll('button')).find(b => b.textContent!.trim() === text) as HTMLButtonElement;

  beforeEach(() => {
    changeCalls = [];
    boardCalls = 0;
    board = {
      cards: [
        boardCard({ leadId: 12, leadNo: 'LD-0012', status: 'New', isOverdue: true, quotationValue: null }),
        boardCard({ leadId: 13, leadNo: 'LD-0013', contactName: 'Meera', status: 'Contacted', quotationValue: 50000 }),
        boardCard({ leadId: 14, leadNo: 'LD-0014', status: 'Contacted', isStuck: true, quotationValue: 25000, priority: 'High', daysInStage: 12 }),
      ],
      counts: { overdue: 1, dueToday: 2, newNotContacted: 3, noFollowUp: 4, quotationWaiting: 5, stuck: 6,
        openLeads: 3, convertedThisMonth: 7, lostThisMonth: 8 },
      truncated: false,
    };
    crm = {
      getBoard: () => { boardCalls++; return of({ success: true, message: '', data: structuredClone(board) }); },
      changeStatus: (id: number, dto: any) => { changeCalls.push([id, dto]); return of({ success: true, message: '', data: id }); },
      getMasters: () => of({ success: true, message: '', data: [
        { id: 3, name: 'Price too high', sortOrder: 1, isActive: true },
        { id: 4, name: 'Old reason', sortOrder: 2, isActive: false },
      ] }),
      me: () => of({ success: true, message: '', data: { userId: 1, fullName: 'Anu', isManager: false } }),
      getMembers: () => of({ success: true, message: '', data: { members: [], available: [] } }),
    };
  });

  it('shows the six attention tiles with counts', () => {
    const { el } = create();
    const tiles = Array.from(el.querySelectorAll('.crm-attn'));
    expect(tiles.map(t => t.getAttribute('data-key')))
      .toEqual(['overdue', 'today', 'newNotContacted', 'noFollowUp', 'quotationWaiting', 'stuck']);
    expect(tiles[0].textContent).toContain('Overdue follow-ups');
    expect(tiles[0].textContent).toContain('1');
    expect(tiles[5].textContent).toContain('Stuck in stage');
    expect(tiles[5].textContent).toContain('6');
    expect(el.querySelector('.crm-page-head')!.textContent).toContain('7');
    expect(el.querySelector('.crm-page-head')!.textContent).toContain('8');
    const contacted = col(el, 'Contacted');
    expect(contacted.querySelector('.crm-col-count')!.textContent).toContain('2');
    expect(contacted.querySelector('.crm-col-value')!.textContent).toContain('₹75,000');
    expect(cardIds(el, 'New')).toEqual(['/crm/leads/12']);
    expect(el.querySelector('.crm-lost-zone')!.classList).not.toContain('open');
    expect(el.querySelector('.crm-truncated')).toBeNull();
  });

  it('a card shows its priority and the days in this stage', () => {
    const { el } = create();
    const card = el.querySelector('.crm-kcard[href="/crm/leads/14"]') as HTMLElement;
    expect(card.querySelector('.crm-kcard-priority')!.textContent).toContain('High');
    expect(card.querySelector('.crm-kcard-priority')!.classList).toContain('crm-pill');
    expect(card.querySelector('.crm-kcard-days')!.textContent).toContain('12 d in stage');
  });

  it('the board scrolls itself during a drag (cdkScrollable)', () => {
    const { fixture } = create();
    const scrollables = fixture.debugElement.queryAll(By.directive(CdkScrollable));
    expect(scrollables.map(d => (d.nativeElement as HTMLElement).classList.contains('crm-board'))).toContain(true);
  });

  it('the lost zone is a drop list in the group before any drag starts, hidden until a drag', () => {
    const { fixture, el } = create();
    const zone = el.querySelector('.crm-lost-zone') as HTMLElement;
    expect(zone).not.toBeNull();
    expect(zone.classList).not.toContain('open');
    expect(zone.getAttribute('aria-hidden')).toBe('true');
    const lists = fixture.debugElement.queryAll(By.directive(CdkDropList)).map(d => d.injector.get(CdkDropList));
    const lost = lists.find(l => l.data === 'Lost')!;
    expect(lost).toBeTruthy();
    expect(lost.autoScrollDisabled).toBe(true);
    const group = fixture.debugElement.query(By.directive(CdkDropListGroup)).injector.get(CdkDropListGroup);
    expect(Array.from(group._items)).toContain(lost);
    expect(lists.filter(l => l.data !== 'Lost').every(l => group._items.has(l))).toBe(true);
  });

  it('shows the lost zone while dragging and hides it when the drag ends', () => {
    const { fixture, el, cmp } = create();
    const zone = () => el.querySelector('.crm-lost-zone') as HTMLElement;
    cmp.dragStarted();
    fixture.detectChanges();
    expect(zone().classList).toContain('open');
    expect(zone().getAttribute('aria-hidden')).toBe('false');
    cmp.dragEnded();
    fixture.detectChanges();
    expect(cmp.dragging()).toBe(false);
    expect(zone().classList).not.toContain('open');
  });

  it('clicking a tile filters the board', () => {
    const { fixture, el } = create();
    const stuck = el.querySelector('.crm-attn[data-key="stuck"]') as HTMLElement;
    stuck.click();
    fixture.detectChanges();
    expect(stuck.classList).toContain('active');
    expect(cardIds(el, 'New')).toEqual([]);
    expect(cardIds(el, 'Contacted')).toEqual(['/crm/leads/14']);
    stuck.click();
    fixture.detectChanges();
    expect(stuck.classList).not.toContain('active');
    expect(cardIds(el, 'Contacted')).toEqual(['/crm/leads/13', '/crm/leads/14']);
  });

  it('drop opens the status dialog with the target status', () => {
    const { fixture, el, cmp } = create();
    cmp.onDrop(cmp.cards().find(c => c.leadId === 12)!, 'Qualified');
    fixture.detectChanges();
    expect(cardIds(el, 'Qualified')).toEqual(['/crm/leads/12']);
    expect(cardIds(el, 'New')).toEqual([]);
    const d = dialog(el)!;
    expect(d).not.toBeNull();
    expect(d.textContent).toContain('LD-0012');
    expect(d.textContent).toContain('Qualified');
    expect(d.querySelector('select')).toBeNull();
  });

  it('cancel puts the card back without a request', () => {
    const { fixture, el, cmp } = create();
    cmp.onDrop(cmp.cards().find(c => c.leadId === 12)!, 'Qualified');
    fixture.detectChanges();
    button(dialog(el)!, 'Cancel').click();
    fixture.detectChanges();
    expect(dialog(el)).toBeNull();
    expect(cardIds(el, 'New')).toEqual(['/crm/leads/12']);
    expect(cardIds(el, 'Qualified')).toEqual([]);
    expect(changeCalls).toEqual([]);
  });

  it('confirm calls changeStatus with note', () => {
    const { fixture, el, cmp } = create();
    cmp.onDrop(cmp.cards().find(c => c.leadId === 12)!, 'Qualified');
    fixture.detectChanges();
    const note = dialog(el)!.querySelector('textarea') as HTMLTextAreaElement;
    note.value = 'Called, wants a demo';
    note.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    button(dialog(el)!, 'Confirm').click();
    fixture.detectChanges();
    expect(changeCalls).toEqual([[12, { status: 'Qualified', note: 'Called, wants a demo', lostReasonId: null }]]);
    expect(boardCalls).toBe(2);
    expect(dialog(el)).toBeNull();
  });

  it('restores the card when the server refuses', () => {
    crm.changeStatus = (id: number, dto: any) => {
      changeCalls.push([id, dto]);
      return throwError(() => ({ status: 400, error: { message: 'A lead with no quotation cannot move to Negotiation' } }));
    };
    const { fixture, el, cmp } = create();
    cmp.onDrop(cmp.cards().find(c => c.leadId === 13)!, 'Negotiation');
    fixture.detectChanges();
    button(dialog(el)!, 'Confirm').click();
    fixture.detectChanges();
    expect(changeCalls.length).toBe(1);
    expect(cardIds(el, 'Contacted')).toEqual(['/crm/leads/13', '/crm/leads/14']);
    expect(cardIds(el, 'Negotiation')).toEqual([]);
    expect(el.querySelector('.crm-board-msg')!.textContent).toContain('A lead with no quotation cannot move to Negotiation');
    expect(boardCalls).toBe(1);
  });

  it('restores the card when the answer is not a success', () => {
    crm.changeStatus = () => of({ success: false, message: 'Not allowed now', data: 0 });
    const { fixture, el, cmp } = create();
    cmp.onDrop(cmp.cards().find(c => c.leadId === 12)!, 'Contacted');
    fixture.detectChanges();
    button(dialog(el)!, 'Confirm').click();
    fixture.detectChanges();
    expect(cardIds(el, 'New')).toEqual(['/crm/leads/12']);
    expect(el.querySelector('.crm-board-msg')!.textContent).toContain('Not allowed now');
  });

  it('drop on Lost opens lost mode and needs a reason', () => {
    const { fixture, el, cmp } = create();
    cmp.onDrop(cmp.cards().find(c => c.leadId === 13)!, 'Lost');
    fixture.detectChanges();
    expect(cardIds(el, 'Contacted')).toEqual(['/crm/leads/14']);
    const d = dialog(el)!;
    const select = d.querySelector('select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(Array.from(select.options).map(o => o.textContent!.trim())).toContain('Price too high');
    expect(Array.from(select.options).map(o => o.textContent!.trim())).not.toContain('Old reason');
    expect(button(d, 'Confirm').disabled).toBe(true);
    select.value = '3';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(button(d, 'Confirm').disabled).toBe(false);
    button(d, 'Confirm').click();
    fixture.detectChanges();
    expect(changeCalls).toEqual([[13, { status: 'Lost', note: null, lostReasonId: 3 }]]);
  });

  it('shows the truncated notice', () => {
    board.truncated = true;
    const { el } = create();
    expect(el.querySelector('.crm-truncated a[href="/crm/leads"]')).not.toBeNull();
  });

  it('makes each column body the drop list and the scrolling element, with the header outside it', () => {
    const { el } = create();
    const body = col(el, 'Contacted').querySelector('.crm-col-body') as HTMLElement;
    expect(body.classList).toContain('cdk-drop-list');
    expect(col(el, 'Contacted').classList).not.toContain('cdk-drop-list');
    expect(body.querySelector('.crm-col-head')).toBeNull();
    expect(body.classList).toContain('crm-col-body');
    expect(getComputedStyle(body).overflowY).toBe('auto');
  });

  it('sends the person to the module list when the token is not for CRM', () => {
    crm.getBoard = () => throwError(() => ({ status: 403 }));
    const { el } = create();
    expect(el.textContent).toContain('Open CRM from the module list');
    expect(el.querySelector('.crm-col')).toBeNull();
  });
});
