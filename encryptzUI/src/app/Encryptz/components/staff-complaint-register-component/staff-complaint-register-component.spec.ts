import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ApiService } from '../../Services/API/api-service';
import { StaffComplaintRegisterComponent } from './staff-complaint-register-component';

describe('StaffComplaintRegisterComponent', () => {
  let api: any;
  let register$: Subject<any>;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [StaffComplaintRegisterComponent],
      providers: [{ provide: ApiService, useValue: api }, provideRouter([])],
    });
    const f = TestBed.createComponent(StaffComplaintRegisterComponent);
    f.detectChanges();
    return f;
  };
  const el = (f: any) => f.nativeElement as HTMLElement;
  const input = (f: any, name: string, value: string) => {
    const i = el(f).querySelector(`[name="${name}"]`) as HTMLInputElement;
    i.value = value;
    i.dispatchEvent(new Event('input'));
    f.detectChanges();
  };
  const submit = (f: any) => { (el(f).querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit')); f.detectChanges(); };

  beforeEach(() => {
    register$ = new Subject();
    api = {
      getComplaintCategories: () => of({ success: true, data: ['AC Service', 'Installation'] }),
      staffCustomerLookup: vi.fn((m: string) => of({ success: true, data: m === '9847012345'
        ? { found: true, customerName: 'Anil Kumar', email: 'a@x.in' } : { found: false } })),
      staffRegisterComplaint: vi.fn(() => register$),
    };
  });

  it('looks up the customer at 10 digits', () => {
    const f = create();
    input(f, 'mobile', '98470');
    expect(api.staffCustomerLookup).not.toHaveBeenCalled();
    input(f, 'mobile', '98470 12345');
    expect(api.staffCustomerLookup).toHaveBeenCalledWith('9847012345');
    expect(el(f).textContent).toContain('Anil Kumar');
    expect(el(f).querySelector('[name="fullName"]')).toBeNull();
  });

  it('stops "Looking up" when the mobile is edited before the answer', () => {
    const pending = new Subject<any>();
    api.staffCustomerLookup = vi.fn(() => pending);
    const f = create();
    input(f, 'mobile', '9847012345');
    expect(el(f).textContent).toContain('Looking up');
    input(f, 'mobile', '984701234');
    expect(el(f).textContent).not.toContain('Looking up');
  });

  it('an older failed lookup does not undo the newer answer', () => {
    const first = new Subject<any>();
    api.staffCustomerLookup = vi.fn((m: string) => m === '9000000001' ? first
      : of({ success: true, data: { found: true, customerName: 'Anil Kumar' } }));
    const f = create();
    input(f, 'mobile', '9000000001');
    input(f, 'mobile', '9847012345');
    first.error(new Error('timeout'));
    f.detectChanges();
    expect(el(f).textContent).toContain('Anil Kumar');
    expect(el(f).querySelector('[name="fullName"]')).toBeNull();
  });

  it('asks the name of a new customer', () => {
    const f = create();
    input(f, 'mobile', '9000000001');
    expect(el(f).textContent).toContain('New customer');
    expect(el(f).querySelector('[name="fullName"]')).not.toBeNull();
  });

  it('name and subject are required', () => {
    const f = create();
    input(f, 'mobile', '9000000001');
    submit(f);
    expect(api.staffRegisterComplaint).not.toHaveBeenCalled();
    expect(el(f).textContent).toContain('Enter the customer name');
    input(f, 'fullName', 'Beena');
    submit(f);
    expect(el(f).textContent).toContain('Enter the subject');
    expect(api.staffRegisterComplaint).not.toHaveBeenCalled();
  });

  it('lists the complaint categories', () => {
    const f = create();
    const opts = Array.from(el(f).querySelectorAll('[name="category"] option')).map(o => o.textContent!.trim());
    expect(opts).toEqual(expect.arrayContaining(['AC Service', 'Installation']));
  });

  it('registers once', () => {
    const f = create();
    input(f, 'mobile', '9847012345');
    input(f, 'subject', 'AC not cooling');
    submit(f);
    submit(f);
    expect(api.staffRegisterComplaint).toHaveBeenCalledTimes(1);
    expect(api.staffRegisterComplaint).toHaveBeenCalledWith(expect.objectContaining({ mobileNumber: '9847012345', subject: 'AC not cooling' }));
  });

  it('shows the complaint number and registers another', () => {
    const f = create();
    input(f, 'mobile', '9847012345');
    input(f, 'subject', 'AC not cooling');
    submit(f);
    register$.next({ success: true, data: { complaintNumber: 'CMP-20261119-0042' } });
    f.detectChanges();
    expect(el(f).textContent).toContain('CMP-20261119-0042');
    (el(f).querySelector('.scr-another') as HTMLButtonElement).click();
    f.detectChanges();
    expect((el(f).querySelector('[name="mobile"]') as HTMLInputElement).value).toBe('');
    expect(el(f).textContent).not.toContain('CMP-20261119-0042');
  });

  it('shows the server message on refusal', () => {
    api.staffRegisterComplaint = vi.fn(() => throwError(() => ({ error: { message: 'Duplicate complaint' } })));
    const f = create();
    input(f, 'mobile', '9847012345');
    input(f, 'subject', 'AC not cooling');
    submit(f);
    expect(el(f).textContent).toContain('Duplicate complaint');
  });
});
