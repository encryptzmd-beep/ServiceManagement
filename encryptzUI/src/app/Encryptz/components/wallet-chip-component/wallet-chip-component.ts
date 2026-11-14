import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WalletService } from '../../Services/wallet-service';

/** The credits of the person, in the header next to the bell; opens the wallet. */
@Component({
  selector: 'app-wallet-chip',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (wallet.balance() !== null) {
      <a class="wc-chip" routerLink="/apps/wallet" [attr.aria-label]="'Wallet: ' + label()">
        <span class="wc-icon" aria-hidden="true"><span class="material-icons">account_balance_wallet</span></span>
        <span class="wc-text"><span class="wc-num">{{ wallet.balance() }}</span><span class="wc-unit"> {{ unit() }}</span></span>
      </a>
    }
  `,
  styles: [`
    /* the same box as the notification bell beside it: 38px high, 10px corners */
    :host { display: inline-flex; font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif; }
    .wc-chip {
      display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 12px 0 5px;
      box-sizing: border-box; border: 1px solid #e6eaf0; border-radius: 10px; background: #fff;
      text-decoration: none; white-space: nowrap; line-height: 1;
      transition: background 0.12s, border-color 0.12s;
    }
    .wc-icon {
      display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px;
      border-radius: 7px; background: #eef4fb; color: #2f6fb3;
    }
    .wc-icon .material-icons { font-size: 17px; }
    .wc-num { font-size: 14px; font-weight: 700; color: #111827; font-variant-numeric: tabular-nums; }
    .wc-unit { font-size: 12.5px; font-weight: 500; color: #6b7280; }
    .wc-chip:hover { background: #eef4fb; border-color: #cfdcec; }
    .wc-chip:hover .wc-icon { background: #fff; }
    .wc-chip:focus-visible { outline: 2px solid #2f6fb3; outline-offset: 2px; }
    @media (max-width: 600px) { .wc-unit { display: none; } .wc-chip { padding-right: 10px; gap: 6px; } }
  `],
})
export class WalletChipComponent {
  readonly wallet = inject(WalletService);

  unit(): string {
    return this.wallet.balance() === 1 ? 'credit' : 'credits';
  }

  label(): string {
    return `${this.wallet.balance()} ${this.unit()}`;
  }
}
