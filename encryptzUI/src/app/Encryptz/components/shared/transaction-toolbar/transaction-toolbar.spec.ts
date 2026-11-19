import { TestBed } from '@angular/core/testing';
import { TransactionToolbarComponent } from './transaction-toolbar';
import { TransactionFindComponent } from './transaction-find';

describe('TransactionToolbarComponent', () => {
  const create = (inputs: Record<string, any>) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TransactionToolbarComponent] });
    const f = TestBed.createComponent(TransactionToolbarComponent);
    for (const [k, v] of Object.entries(inputs)) f.componentRef.setInput(k, v);
    f.detectChanges();
    return f;
  };
  const btn = (f: any, name: string) => (f.nativeElement as HTMLElement).querySelector(`[data-tb="${name}"]`) as HTMLButtonElement | null;

  it('a new document can be saved but not edited, printed or cancelled', () => {
    const f = create({ mode: 'new', canSave: true, previousId: 7, nextId: null });
    expect(btn(f, 'save')!.disabled).toBe(false);
    expect(btn(f, 'edit')).toBeNull();
    expect(btn(f, 'print')!.disabled).toBe(true);
    expect(btn(f, 'cancel')!.disabled).toBe(true);
    expect(btn(f, 'previous')!.disabled).toBe(false);
    expect(btn(f, 'next')!.disabled).toBe(true);
  });

  it('a document in view offers Edit, Print and Cancel, not Save', () => {
    const f = create({ mode: 'view', canEdit: true, canCancel: true, canSave: true, previousId: 3, nextId: 5 });
    expect(btn(f, 'edit')!.disabled).toBe(false);
    expect(btn(f, 'save')!.disabled).toBe(true);
    expect(btn(f, 'print')!.disabled).toBe(false);
    expect(btn(f, 'cancel')!.disabled).toBe(false);
  });

  it('a locked document cannot be edited or cancelled', () => {
    const f = create({ mode: 'view', canEdit: false, canCancel: false });
    expect(btn(f, 'edit')!.disabled).toBe(true);
    expect(btn(f, 'cancel')!.disabled).toBe(true);
  });

  it('in edit, Edit becomes Discard and Save is on', () => {
    const f = create({ mode: 'edit', canSave: true });
    expect(btn(f, 'edit')).toBeNull();
    expect(btn(f, 'discard')!.disabled).toBe(false);
    expect(btn(f, 'save')!.disabled).toBe(false);
  });

  it('busy turns every action off', () => {
    const f = create({ mode: 'view', canEdit: true, busy: true, previousId: 1, nextId: 2 });
    for (const b of ['new', 'edit', 'print', 'cancel', 'previous', 'next', 'find']) expect(btn(f, b)!.disabled).toBe(true);
  });

  it('tells the screen what was pressed', () => {
    const f = create({ mode: 'view', canEdit: true, canCancel: true, previousId: 3, nextId: 5 });
    const got: string[] = [];
    const c = f.componentInstance;
    c.newDoc.subscribe(() => got.push('new')); c.edit.subscribe(() => got.push('edit'));
    c.print.subscribe(() => got.push('print')); c.cancelDoc.subscribe(() => got.push('cancel'));
    c.previous.subscribe(() => got.push('previous')); c.next.subscribe(() => got.push('next')); c.find.subscribe(() => got.push('find'));
    for (const b of ['new', 'edit', 'print', 'cancel', 'previous', 'next', 'find']) btn(f, b)!.click();
    expect(got).toEqual(['new', 'edit', 'print', 'cancel', 'previous', 'next', 'find']);
  });

  it('shows the document label', () => {
    const f = create({ mode: 'view', label: 'SO-0012', status: 'Billed' });
    expect(f.nativeElement.textContent).toContain('SO-0012');
    expect(f.nativeElement.textContent).toContain('Billed');
  });
});

describe('TransactionFindComponent', () => {
  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TransactionFindComponent] });
    const f = TestBed.createComponent(TransactionFindComponent);
    f.componentRef.setInput('title', 'Find a sales order');
    f.componentRef.setInput('rows', [
      { id: 12, number: 'SO-0012', date: '2026-11-18', party: 'Anil Kumar', amount: 1180, status: 'Billed' },
      { id: 11, number: 'SO-0011', date: '2026-11-17', party: 'Beena', amount: 500, status: 'Cancelled' },
    ]);
    f.detectChanges();
    return f;
  };
  const el = (f: any) => f.nativeElement as HTMLElement;

  it('searches with the text and the dates', () => {
    const f = create();
    const got: any[] = [];
    f.componentInstance.search.subscribe((q: any) => got.push(q));
    const set = (sel: string, v: string) => { const i = el(f).querySelector(sel) as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input')); };
    set('[name="term"]', ' anil ');
    set('[name="from"]', '2026-11-01');
    set('[name="to"]', '2026-11-30');
    (el(f).querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(got).toEqual([{ term: 'anil', from: '2026-11-01', to: '2026-11-30' }]);
  });

  it('searches once when it opens, with nothing typed', () => {
    const got: any[] = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TransactionFindComponent] });
    const f = TestBed.createComponent(TransactionFindComponent);
    f.componentInstance.search.subscribe((q: any) => got.push(q));
    f.detectChanges();
    expect(got).toEqual([{ term: '', from: '', to: '' }]);
  });

  it('lists the documents and picks one', () => {
    const f = create();
    expect(el(f).textContent).toContain('SO-0012');
    expect(el(f).textContent).toContain('Anil Kumar');
    expect(el(f).textContent).toContain('₹1,180.00');
    const picked: number[] = [];
    f.componentInstance.pick.subscribe((id: number) => picked.push(id));
    (el(f).querySelectorAll('tbody tr')[1] as HTMLElement).click();
    expect(picked).toEqual([11]);
  });

  it('closes with Escape and the close button', () => {
    const f = create();
    let closed = 0;
    f.componentInstance.close.subscribe(() => closed++);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    (el(f).querySelector('.tf-close') as HTMLButtonElement).click();
    expect(closed).toBe(2);
  });
});
