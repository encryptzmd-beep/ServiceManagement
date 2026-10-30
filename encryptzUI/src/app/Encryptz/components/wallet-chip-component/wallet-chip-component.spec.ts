import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { WalletService } from '../../Services/wallet-service';
import { WalletChipComponent } from './wallet-chip-component';

describe('WalletChipComponent', () => {
  let balance: ReturnType<typeof signal<number | null>>;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [WalletChipComponent],
      providers: [
        provideRouter([]),
        { provide: WalletService, useValue: { balance } },
      ],
    });
    const fixture = TestBed.createComponent(WalletChipComponent);
    fixture.detectChanges();
    return fixture;
  };
  const link = (f: any) => f.nativeElement.querySelector('a') as HTMLAnchorElement | null;

  beforeEach(() => { balance = signal<number | null>(150); });

  it('shows the credits and links to the wallet', () => {
    const f = create();
    expect(link(f)?.textContent).toContain('150 credits');
    expect(link(f)?.getAttribute('href')).toBe('/apps/wallet');
    expect(link(f)?.getAttribute('aria-label')).toBe('Wallet: 150 credits');
    expect(link(f)?.textContent).toContain('account_balance_wallet');
  });

  it('says "1 credit" for one', () => {
    balance.set(1);
    const f = create();
    expect(link(f)?.textContent).toContain('1 credit');
    expect(link(f)?.textContent).not.toContain('1 credits');
  });

  it('renders nothing while the balance is unknown', () => {
    balance.set(null);
    expect(link(create())).toBeNull();
  });
});
