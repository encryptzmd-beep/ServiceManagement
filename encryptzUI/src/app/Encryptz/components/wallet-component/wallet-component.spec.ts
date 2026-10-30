import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { WalletService } from '../../Services/wallet-service';
import { routes } from '../../../app.routes';
import { authGuard } from '../../Auth/guard-guard';
import { WalletComponent } from './wallet-component';

describe('WalletComponent', () => {
  const ok = (data: any) => of({ success: true, message: '', data });
  let api: any;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [WalletComponent],
      providers: [
        provideRouter([]),
        { provide: WalletService, useValue: api },
        { provide: AuthService, useValue: { userName: () => 'Leo', currentUser: () => ({ userId: 11, individualId: 'EZ-7K4M-2P9Q-XD3Q' }) } },
      ],
    });
    const fixture = TestBed.createComponent(WalletComponent);
    fixture.detectChanges();
    return fixture;
  };
  const text = (f: any) => (f.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const send = async (f: any, email: string) => {
    await f.whenStable();
    const input = f.nativeElement.querySelector('input[type=email]') as HTMLInputElement;
    input.value = email;
    input.dispatchEvent(new Event('input'));
    f.detectChanges();
    (f.nativeElement.querySelector('button.wl-send') as HTMLButtonElement).click();
    f.detectChanges();
  };

  beforeEach(() => {
    api = {
      balance: signal(42),
      refreshBalance: () => {},
      ledger: () => ok({ balance: 42, totalCount: 1, entries: [{ entryId: 1, amount: 10, kind: 'Welcome', note: 'Welcome credits', createdAt: '2026-10-20T10:00:00' }] }),
      referrals: () => ok([{ referralId: 1, email: 'a@x.com', status: 'Sent', sentAt: '2026-10-21T10:00:00', joinedAt: null, creditedAt: null, friendName: '' }]),
      offer: () => ok({ referralCredits: 5 }),
      invite: () => ok({ result: 'Created', mailSent: true }),
      inviteLink: () => ok({ key: 'K7M2QX9PLR4T', url: 'https://x.test/register?inv=K7M2QX9PLR4T' }),
    };
  });

  it('shows the invite link to share', () => {
    const f = create();
    const input = f.nativeElement.querySelector('input[aria-label="Your invite link"]') as HTMLInputElement;
    expect(input.value).toBe('https://x.test/register?inv=K7M2QX9PLR4T');
    expect(text(f)).toContain('Copy');
  });

  it('hides the link part when there is no link', () => {
    api.inviteLink = () => ok(null);
    expect(create().nativeElement.querySelector('input[aria-label="Your invite link"]')).toBeNull();
  });

  it('shows the balance from the service', () => {
    expect(text(create())).toContain('42');
  });

  it('shows the offer line only above 0', () => {
    expect(text(create())).toContain('You get 5 credits for each friend who joins.');
    api.offer = () => ok({ referralCredits: 0 });
    expect(text(create())).not.toContain('for each friend');
  });

  it('shows history and invites', () => {
    const t = text(create());
    expect(t).toContain('+10');
    expect(t).toContain('a@x.com');
    expect(t).toContain('Sent');
  });

  it('shows empty texts', () => {
    api.ledger = () => ok({ balance: 0, totalCount: 0, entries: [] });
    api.referrals = () => ok([]);
    const t = text(create());
    expect(t).toContain('No invites yet');
    expect(t).toContain('No credits yet');
  });

  it('shows the API refusal after a failed invite', async () => {
    api.invite = () => of({ success: false, message: 'You already invited this person.', data: null });
    const f = create();
    await send(f, 'b@x.com');
    expect(text(f)).toContain('You already invited this person.');
  });

  it('says when the mail could not be sent', async () => {
    api.invite = () => ok({ result: 'Created', mailSent: false });
    const f = create();
    await send(f, 'b@x.com');
    expect(text(f)).toContain('Invite saved, but the mail could not be sent. Try Resend.');
  });

  it('says Invite sent on success', async () => {
    const f = create();
    await send(f, 'b@x.com');
    expect(text(f)).toContain('Invite sent');
  });

  it('has the apps/wallet route with authGuard', () => {
    const r = routes.find(x => x.path === 'apps/wallet');
    expect(r).toBeTruthy();
    expect(r!.canActivate).toContain(authGuard);
    expect(r!.data?.['title']).toBe('Wallet');
  });
});
