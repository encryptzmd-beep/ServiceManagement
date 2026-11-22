import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { apiErrorMessage } from '../../Auth/api-error';
import { AppToastComponent } from '../app-toast-component/app-toast-component';
import { CompanyAccessApi } from './company-access';

type FieldKind = 'text' | 'area' | 'image' | 'mode';
interface Field { key: string; label: string; kind: FieldKind; hint?: string; wide?: boolean; }
interface Section { title: string; hint: string; fields: Field[]; hidden?: boolean; }

export const PRINT_SECTIONS: Section[] = [
  { title: 'Logo and seal', hint: 'A transparent PNG prints best.', fields: [
    { key: 'Print.CompanyLogo', label: 'Company logo', kind: 'image' },
    { key: 'Print.SealImage', label: 'Seal and signature', kind: 'image' },
  ] },
  { title: 'Company details', hint: 'Printed at the top of the quotation.', fields: [
    { key: 'Print.CompanyName', label: 'Company name', kind: 'text', hint: 'Blank uses the company name of the login' },
    { key: 'Print.CompanyGSTIN', label: 'GSTIN', kind: 'text' },
    { key: 'Print.CompanyMSME', label: 'MSME / Udyam number', kind: 'text' },
    { key: 'Print.CompanyPhone', label: 'Phone', kind: 'text' },
    { key: 'Print.CompanyEmail', label: 'Email', kind: 'text' },
    { key: 'Print.CompanyAddress', label: 'Address', kind: 'area', hint: 'One line per row', wide: true },
  ] },
  { title: 'Bank details', hint: 'Shown beside the warranty and terms.', fields: [
    { key: 'Print.BankAccountHolder', label: 'Account holder', kind: 'text' },
    { key: 'Print.BankAccountNo', label: 'Account number', kind: 'text' },
    { key: 'Print.BankIFSC', label: 'IFS code', kind: 'text' },
    { key: 'Print.BankName', label: 'Bank and branch', kind: 'text' },
  ] },
  { title: 'Quotation content', hint: 'The same on every quotation.', hidden: true, fields: [
    { key: 'Print.ItemsNote', label: 'Note under the products', kind: 'text', wide: true },
    { key: 'Print.Warranty', label: 'Warranty', kind: 'area', hint: 'One point per row', wide: true },
    { key: 'Print.Terms', label: 'Terms and conditions', kind: 'area', hint: 'One point per row. A quotation with its own terms prints those instead', wide: true },
    { key: 'Print.ClosingMessage', label: 'Closing message', kind: 'area', wide: true },
    { key: 'Print.SignatoryName', label: 'Name under Thanks & Regards', kind: 'text', hint: 'Blank uses the company name' },
    { key: 'Print.SignatoryMobile', label: 'Mobile under Thanks & Regards', kind: 'text' },
  ] },
  { title: 'Header and footer', hint: 'Optional letterhead above and below the document.', fields: [
    { key: 'Print.HeaderMode', label: 'Header', kind: 'mode' },
    { key: 'Print.FooterMode', label: 'Footer', kind: 'mode' },
    { key: 'Print.HeaderText', label: 'Header text', kind: 'area' },
    { key: 'Print.FooterText', label: 'Footer text', kind: 'area' },
    { key: 'Print.HeaderImage', label: 'Header image', kind: 'image' },
    { key: 'Print.FooterImage', label: 'Footer image', kind: 'image' },
  ] },
];

const MAX_IMAGE_WIDTH = 1600;
const MAX_IMAGE_LENGTH = 1_572_864;

/** Settings > Print Settings of the company: what quotations print. Open to whoever manages Users & Roles. */
@Component({
  selector: 'app-company-print-settings',
  standalone: true,
  imports: [AppToastComponent],
  templateUrl: './company-print-settings.html',
  styleUrl: './company-print-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompanyPrintSettingsComponent implements OnInit {
  private api = inject(CompanyAccessApi);
  private destroyRef = inject(DestroyRef);

  readonly sections = PRINT_SECTIONS.filter(s => !s.hidden);
  loading = signal(true);
  loadError = signal('');
  saveError = signal('');
  saving = signal(false);
  toast = signal('');
  private saved = signal<Record<string, string>>({});
  values = signal<Record<string, string>>({});
  private toastTimer?: ReturnType<typeof setTimeout>;

  /** Only what changed is sent, so a save does not carry every image again. */
  readonly changes = computed(() => {
    const before = this.saved(), now = this.values();
    return Object.fromEntries(Object.entries(now).filter(([k, v]) => v !== (before[k] ?? '')));
  });
  readonly dirty = computed(() => Object.keys(this.changes()).length > 0);

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.toastTimer));
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');
    this.api.printSettings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.loading.set(false);
        if (!res.success || !res.data) { this.loadError.set(res.message || 'Could not load the print settings'); return; }
        this.saved.set(res.data);
        this.values.set({ ...res.data });
      },
      error: err => {
        this.loading.set(false);
        this.loadError.set(apiErrorMessage(err, 'Could not load the print settings'));
      },
    });
  }

  value(key: string): string { return this.values()[key] ?? ''; }
  set(key: string, value: string): void {
    this.saveError.set('');
    this.values.update(v => ({ ...v, [key]: value }));
  }
  text(event: Event): string { return (event.target as HTMLInputElement).value; }

  onImage(key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { this.saveError.set('Only PNG, JPG or WEBP images can be used'); return; }
    if (file.size > 5 * 1024 * 1024) { this.saveError.set('The image must be smaller than 5 MB'); return; }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = img.width > MAX_IMAGE_WIDTH ? MAX_IMAGE_WIDTH / img.width : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { this.saveError.set('Could not read the image'); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // PNG keeps the transparency of a logo or seal; WEBP is drawn to PNG for the same reason
      const data = file.type === 'image/jpeg' ? canvas.toDataURL('image/jpeg', 0.88) : canvas.toDataURL('image/png');
      if (data.length > MAX_IMAGE_LENGTH) { this.saveError.set('The image is still too large after scaling. Use a smaller image'); return; }
      this.set(key, data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); this.saveError.set('Could not read the image'); };
    img.src = url;
  }

  save(): void {
    const sent = this.changes();
    if (!Object.keys(sent).length || this.saving()) return;
    this.saving.set(true);
    this.saveError.set('');
    this.api.savePrintSettings(sent).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.saving.set(false);
        if (!res.success) { this.saveError.set(res.message || 'The print settings could not be saved'); return; }
        this.saved.update(v => ({ ...v, ...sent }));
        this.toast.set('Print settings saved');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.toast.set(''), 3200);
      },
      error: err => {
        this.saving.set(false);
        this.saveError.set(apiErrorMessage(err, 'The print settings could not be saved'));
      },
    });
  }
}
