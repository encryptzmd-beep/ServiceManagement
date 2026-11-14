import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlatformLoginAd, PlatformService } from '../../Services/platform-service';
import { DialogService } from '../../Services/dialog-service';
import { ScrollIntoViewOn } from '../shared/scroll-into-view';
import { EscapeClose } from '../shared/escape-close';

/** At most 2 MB, as the API (LoginAdRules.MaxImageBytes). */
export const MAX_AD_IMAGE_BYTES = 2 * 1024 * 1024;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function day(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** When a slide is shown: "Always", "From 1 Oct 2026", "Until 31 Oct 2026" or "1 Oct 2026 – 31 Oct 2026". */
export function showsText(ad: Pick<PlatformLoginAd, 'showFrom' | 'showUntil'>): string {
  if (ad.showFrom && ad.showUntil) return `${day(ad.showFrom)} – ${day(ad.showUntil)}`;
  if (ad.showFrom) return `From ${day(ad.showFrom)}`;
  if (ad.showUntil) return `Until ${day(ad.showUntil)}`;
  return 'Always';
}

/** Active, Hidden (switched off) or Ended (its last day has passed). `today` is yyyy-MM-dd. */
export function adStatus(ad: Pick<PlatformLoginAd, 'isActive' | 'showUntil'>, today: string): 'Active' | 'Hidden' | 'Ended' {
  if (ad.showUntil && ad.showUntil.slice(0, 10) < today) return 'Ended';
  return ad.isActive ? 'Active' : 'Hidden';
}

interface AdForm {
  loginAdId: number;
  tag: string;
  title: string;
  body: string;
  buttonText: string;
  linkUrl: string;
  showFrom: string;
  showUntil: string;
  isActive: boolean;
}

/**
 * Platform Admin › Login Ads: the slides of the sign-in and register pages. The API was in
 * place (PlatformController, login-ads); this screen was missing (QA BUG-031).
 */
@Component({
  selector: 'app-login-ads-panel',
  standalone: true,
  imports: [FormsModule, ScrollIntoViewOn, EscapeClose],
  templateUrl: './login-ads-panel-component.html',
  // the dialog, form and button styles of Platform Admin
  styleUrls: ['../platform-admin-component/platform-admin-component.scss', './login-ads-panel-component.scss'],
})
export class LoginAdsPanelComponent implements OnInit, OnDestroy {
  private api = inject(PlatformService);
  private dialog = inject(DialogService);

  readonly showsText = showsText;
  readonly today = new Date().toLocaleDateString('en-CA');   // yyyy-MM-dd, the local day

  ads = signal<PlatformLoginAd[]>([]);
  loading = signal(false);
  loadError = signal('');
  busy = signal(false);
  /** Object URLs of the thumbnails, by slide id; revoked when the list is read again. */
  thumbs = signal<Record<number, string>>({});

  form = signal<AdForm | null>(null);
  file: File | null = null;
  formError = signal('');

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.revokeThumbs();
  }

  status(ad: PlatformLoginAd): 'Active' | 'Hidden' | 'Ended' {
    return adStatus(ad, this.today);
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.getLoginAds().subscribe({
      next: res => {
        this.loading.set(false);
        if (!res.success) { this.loadError.set(res.message || 'Could not read the slides'); return; }
        const list = [...(res.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
        this.ads.set(list);
        this.loadThumbs(list);
      },
      error: () => { this.loading.set(false); this.loadError.set('Could not read the slides. Please try again'); },
    });
  }

  private loadThumbs(list: PlatformLoginAd[]): void {
    this.revokeThumbs();
    for (const ad of list) {
      this.api.loginAdImage(ad.loginAdId).subscribe({
        next: blob => this.thumbs.update(t => ({ ...t, [ad.loginAdId]: URL.createObjectURL(blob) })),
        error: () => { /* no thumbnail */ },
      });
    }
  }

  private revokeThumbs(): void {
    Object.values(this.thumbs()).forEach(url => URL.revokeObjectURL(url));
    this.thumbs.set({});
  }

  // ── order and state ─────────────────────────────────────────────────────

  move(index: number, step: -1 | 1): void {
    const list = [...this.ads()];
    const to = index + step;
    if (this.busy() || to < 0 || to >= list.length) return;
    [list[index], list[to]] = [list[to], list[index]];
    this.ads.set(list);
    this.run(this.api.reorderLoginAds(list.map(a => a.loginAdId)));
  }

  toggle(ad: PlatformLoginAd): void {
    if (this.busy()) return;
    this.run(this.api.setLoginAdActive(ad.loginAdId, !ad.isActive));
  }

  async remove(ad: PlatformLoginAd): Promise<void> {
    if (this.busy()) return;
    const ok = await this.dialog.confirm({ title: 'Delete this slide?', message: 'This cannot be undone.', okText: 'Delete', cancelText: 'Cancel', kind: 'danger' });
    if (ok) this.run(this.api.deleteLoginAd(ad.loginAdId));
  }

  /** A change, then the list read again (also after a refusal, so what is shown is what is stored). */
  private run(call: ReturnType<PlatformService['deleteLoginAd']>): void {
    this.busy.set(true);
    call.subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success) this.dialog.alert({ message: res.message || 'Could not save the change', kind: 'danger' });
        this.load();
      },
      error: () => { this.busy.set(false); this.dialog.alert({ message: 'Could not save the change. Please try again', kind: 'danger' }); this.load(); },
    });
  }

  // ── add and edit ────────────────────────────────────────────────────────

  openNew(): void {
    this.file = null;
    this.formError.set('');
    this.form.set({ loginAdId: 0, tag: '', title: '', body: '', buttonText: '', linkUrl: '', showFrom: '', showUntil: '', isActive: true });
  }

  edit(ad: PlatformLoginAd): void {
    this.file = null;
    this.formError.set('');
    this.form.set({
      loginAdId: ad.loginAdId, tag: ad.tag, title: ad.title, body: ad.body, buttonText: ad.buttonText, linkUrl: ad.linkUrl,
      showFrom: ad.showFrom?.slice(0, 10) ?? '', showUntil: ad.showUntil?.slice(0, 10) ?? '', isActive: ad.isActive,
    });
  }

  close(): void {
    this.form.set(null);
    this.file = null;
  }

  pickFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.formError.set('');
    if (file && file.size > MAX_AD_IMAGE_BYTES) {
      this.formError.set('The image is larger than 2 MB');
      this.file = null;
      input.value = '';
      return;
    }
    this.file = file;
  }

  save(): void {
    const f = this.form();
    if (!f || this.busy()) return;
    if (!f.loginAdId && !this.file) { this.formError.set('Choose an image'); return; }
    const link = f.linkUrl.trim();
    if (link && !/^https?:\/\/\S+$/i.test(link)) { this.formError.set('The link must start with http:// or https://'); return; }
    if (f.showFrom && f.showUntil && f.showUntil < f.showFrom) { this.formError.set("'Show until' is before 'Show from'"); return; }

    this.busy.set(true);
    this.formError.set('');
    this.api.saveLoginAd({ ...f, linkUrl: link, showFrom: f.showFrom || null, showUntil: f.showUntil || null }, this.file).subscribe({
      next: res => {
        this.busy.set(false);
        if (!res.success) { this.formError.set(res.message || 'Could not save the slide'); return; }
        this.close();
        this.load();
      },
      error: () => { this.busy.set(false); this.formError.set('Could not save the slide. Please try again'); },
    });
  }
}
