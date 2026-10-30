import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PersonalMenuItem, PersonalShellComponent } from '../personal-shell-component/personal-shell-component';
import { Referral, WalletEntry, WalletService } from '../../Services/wallet-service';

const PAGE_SIZE = 20;

/**
 * Wallet (/apps/wallet): the credits of the person, an invitation to a friend, the friends
 * invited so far and the history of the credits. Every part is read on its own: one that
 * cannot be read stays empty and the rest of the page shows.
 */
@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [FormsModule, DatePipe, PersonalShellComponent],
  templateUrl: './wallet-component.html',
  styleUrls: ['../job-dashboard-component/job-dashboard-component.scss', './wallet-component.scss'],
})
export class WalletComponent implements OnInit {
  readonly wallet = inject(WalletService);

  readonly menu: PersonalMenuItem[] = [{ label: 'Wallet', icon: 'account_balance_wallet', route: '/apps/wallet', exact: true }];

  referralCredits = signal(0);
  /** The person's own link to share (/register?inv=key); null until read or when it cannot be. */
  link = signal<string | null>(null);
  linkMessage = signal('');
  /** The phone's share sheet (WhatsApp and the rest) where the browser has one. */
  readonly canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  referrals = signal<Referral[] | null>(null);
  entries = signal<WalletEntry[] | null>(null);
  page = signal(1);
  totalCount = signal(0);

  email = '';
  busy = signal(false);
  /** What the last invite answered: a text, and whether it is a refusal. */
  inviteMessage = signal('');
  inviteFailed = signal(false);

  readonly hasNewer = computed(() => this.page() > 1);
  readonly hasOlder = computed(() => this.page() * PAGE_SIZE < this.totalCount());

  ngOnInit(): void {
    this.wallet.refreshBalance();
    this.wallet.offer().subscribe({
      next: r => { if (r.success && r.data) this.referralCredits.set(r.data.referralCredits); },
      error: () => {},
    });
    this.wallet.inviteLink().subscribe({
      next: r => { if (r.success && r.data?.url) this.link.set(r.data.url); },
      error: () => {},
    });
    this.loadReferrals();
    this.loadLedger(1);
  }

  copyLink(): void {
    const url = this.link();
    if (!url) return;
    const clip = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clip) { this.linkMessage.set('Copy the link above'); return; }
    clip.writeText(url).then(
      () => this.linkMessage.set('Link copied'),
      () => this.linkMessage.set('Copy the link above'));
  }

  shareLink(): void {
    const url = this.link();
    if (!url || !this.canShare) return;
    // a closed share sheet rejects: nothing to say
    navigator.share({ title: 'Join Encryptz', text: 'Join me on Encryptz', url }).catch(() => {});
  }

  private loadReferrals(): void {
    this.wallet.referrals().subscribe({
      next: r => this.referrals.set(r.success && r.data ? r.data : []),
      error: () => this.referrals.set([]),
    });
  }

  loadLedger(page: number): void {
    this.wallet.ledger(page).subscribe({
      next: r => {
        if (!r.success || !r.data) { this.entries.set([]); return; }
        this.page.set(page);
        this.totalCount.set(r.data.totalCount);
        this.entries.set(r.data.entries);
      },
      error: () => this.entries.set([]),
    });
  }

  send(email: string = this.email): void {
    email = email.trim();
    if (!email || this.busy()) return;
    this.busy.set(true);
    this.inviteMessage.set('');
    this.wallet.invite(email).subscribe({
      next: r => {
        this.busy.set(false);
        if (!r.success || !r.data) {
          this.inviteFailed.set(true);
          this.inviteMessage.set(r.message || 'The invite could not be sent.');
          return;
        }
        this.inviteFailed.set(false);
        this.inviteMessage.set(r.data.mailSent ? 'Invite sent' : 'Invite saved, but the mail could not be sent. Try Resend.');
        this.email = '';
        this.loadReferrals();
      },
      error: err => {
        this.busy.set(false);
        this.inviteFailed.set(true);
        this.inviteMessage.set(err?.error?.message || 'The invite could not be sent.');
      },
    });
  }

  amountLabel(amount: number): string {
    return amount > 0 ? `+${amount}` : `${amount}`;
  }
}
