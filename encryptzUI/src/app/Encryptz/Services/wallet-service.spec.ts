import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { AuthService } from '../Auth/auth-service';
import { WalletService } from './wallet-service';

describe('WalletService', () => {
  let http: HttpTestingController;
  let s: WalletService;
  let user: ReturnType<typeof signal<any>>;

  beforeEach(() => {
    user = signal<any>(null);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthService, useValue: { currentUser: user } }] });
    http = TestBed.inject(HttpTestingController);
    s = TestBed.inject(WalletService);
  });

  it('starts without a balance', () => {
    expect(s.balance()).toBeNull();
  });

  it('sets the balance from the API', () => {
    s.refreshBalance();
    const req = http.expectOne(r => r.url.endsWith('/wallet/balance'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: '', data: { balance: 150 } });
    expect(s.balance()).toBe(150);
  });

  it('keeps the old balance on an HTTP error', () => {
    s.balance.set(40);
    s.refreshBalance();
    http.expectOne(r => r.url.endsWith('/wallet/balance')).flush('x', { status: 500, statusText: 'Server Error' });
    expect(s.balance()).toBe(40);
  });

  it('keeps the old balance when the API refuses', () => {
    s.balance.set(40);
    s.refreshBalance();
    http.expectOne(r => r.url.endsWith('/wallet/balance')).flush({ success: false, message: 'no', data: null });
    expect(s.balance()).toBe(40);
  });

  it('reads a page of the ledger', () => {
    s.ledger(2).subscribe(res => expect(res.data?.totalCount).toBe(30));
    const req = http.expectOne(r => r.url.endsWith('/wallet/ledger') && r.params.get('page') === '2');
    req.flush({ success: true, message: '', data: { balance: 5, totalCount: 30, entries: [] } });
  });

  it('reads the referrals and the offer', () => {
    s.referrals().subscribe();
    http.expectOne(r => r.url.endsWith('/wallet/referrals') && r.method === 'GET').flush({ success: true, message: '', data: [] });
    s.offer().subscribe(res => expect(res.data?.referralCredits).toBe(100));
    http.expectOne(r => r.url.endsWith('/wallet/offer')).flush({ success: true, message: '', data: { referralCredits: 100 } });
  });

  it('invites by e-mail and then refreshes the balance', () => {
    s.invite('a@b.com').subscribe();
    const req = http.expectOne(r => r.url.endsWith('/wallet/referrals') && r.method === 'POST');
    expect(req.request.body).toEqual({ email: 'a@b.com' });
    req.flush({ success: true, message: '', data: { result: 'Created', mailSent: true } });
    http.expectOne(r => r.url.endsWith('/wallet/balance')).flush({ success: true, message: '', data: { balance: 9 } });
    expect(s.balance()).toBe(9);
  });

  it('does not refresh the balance when the invite is refused', () => {
    s.invite('a@b.com').subscribe();
    http.expectOne(r => r.method === 'POST').flush({ success: false, message: 'Already invited', data: null });
    http.expectNone(r => r.url.endsWith('/wallet/balance'));
  });

  it('resets and re-reads the balance when another person logs in, and clears it on logout', () => {
    user.set({ userId: 1 });
    TestBed.tick();
    http.expectOne(r => r.url.endsWith('/wallet/balance')).flush({ success: true, message: '', data: { balance: 50 } });
    expect(s.balance()).toBe(50);

    user.set({ userId: 2 });
    TestBed.tick();
    expect(s.balance()).toBeNull();
    http.expectOne(r => r.url.endsWith('/wallet/balance')).flush('x', { status: 500, statusText: 'Err' });
    expect(s.balance()).toBeNull();

    user.set(null);
    TestBed.tick();
    expect(s.balance()).toBeNull();
    http.expectNone(r => r.url.endsWith('/wallet/balance'));
  });

  it('drops a late answer for a person who is no longer logged in', () => {
    user.set({ userId: 1 });
    TestBed.tick();
    const a = http.expectOne(r => r.url.endsWith('/wallet/balance'));

    user.set({ userId: 2 });
    TestBed.tick();
    const b = http.expectOne(r => r.url.endsWith('/wallet/balance'));

    a.flush({ success: true, message: '', data: { balance: 50 } });
    expect(s.balance()).toBeNull();
    b.flush({ success: true, message: '', data: { balance: 7 } });
    expect(s.balance()).toBe(7);

    s.refreshBalance();
    const c = http.expectOne(r => r.url.endsWith('/wallet/balance'));
    user.set(null);
    TestBed.tick();
    c.flush({ success: true, message: '', data: { balance: 99 } });
    expect(s.balance()).toBeNull();
  });
});
