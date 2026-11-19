import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../Services/API/api-service';

/** 10 digits after dropping spaces, dashes, +91 / 91 or a leading 0 (the API checks the same). */
export function normaliseMobile(value: string): string | null {
  let d = (value ?? '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.length === 10 ? d : null;
}

interface Form {
  mobile: string; fullName: string; email: string; category: string; subject: string;
  brandName: string; modelNumber: string; description: string; locationName: string;
}

const EMPTY: Form = {
  mobile: '', fullName: '', email: '', category: '', subject: '',
  brandName: '', modelNumber: '', description: '', locationName: '',
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Office staff register a complaint for a customer who phones in (Complaints › Register Complaint). */
@Component({
  selector: 'app-staff-complaint-register',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './staff-complaint-register-component.html',
  styleUrl: './staff-complaint-register-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffComplaintRegisterComponent {
  private api = inject(ApiService);

  form = signal<Form>({ ...EMPTY });
  categories = signal<string[]>([]);
  /** null: not looked up yet (or the mobile is not complete). */
  customer = signal<{ found: boolean; customerName?: string | null } | null>(null);
  lookingUp = signal(false);
  saving = signal(false);
  error = signal('');
  done = signal<string | null>(null);
  photo = signal<{ base64: string; name: string; type: string } | null>(null);

  readonly isNew = computed(() => this.customer()?.found === false);
  private lookedUp = '';

  constructor() {
    this.api.getComplaintCategories().subscribe({
      next: (r: any) => this.categories.set(r?.data ?? []),
      error: () => this.categories.set([]),
    });
  }

  set<K extends keyof Form>(key: K, value: string): void {
    this.form.update(f => ({ ...f, [key]: value }));
    this.error.set('');
    if (key === 'mobile') this.onMobile(value);
  }

  private onMobile(value: string): void {
    const m = normaliseMobile(value);
    if (!m) { this.customer.set(null); this.lookedUp = ''; this.lookingUp.set(false); return; }
    if (m === this.lookedUp) return;
    this.lookedUp = m;
    this.lookingUp.set(true);
    this.api.staffCustomerLookup(m).subscribe({
      next: (r: any) => {
        if (this.lookedUp !== m) return;
        this.lookingUp.set(false);
        this.customer.set({ found: !!r?.data?.found, customerName: r?.data?.customerName ?? null });
      },
      error: () => {
        if (this.lookedUp !== m) return;   // an older lookup
        this.lookingUp.set(false);
        this.customer.set({ found: false });
      },
    });
  }

  onPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      this.error.set('The photo must be a JPG, PNG or WEBP image of up to 5 MB');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result ?? '');
      this.photo.set({ base64: data.slice(data.indexOf(',') + 1), name: file.name, type: file.type });
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void { this.photo.set(null); }

  /** The first problem of the form, worded as the API words it. */
  problem(): string | null {
    const f = this.form();
    if (!normaliseMobile(f.mobile)) return 'Enter a valid 10-digit mobile number';
    if (this.isNew() && !f.fullName.trim()) return 'Enter the customer name';
    if (!f.subject.trim()) return 'Enter the subject';
    return null;
  }

  submit(event?: Event): void {
    event?.preventDefault();
    if (this.saving()) return;
    const problem = this.problem();
    if (problem) { this.error.set(problem); return; }

    const f = this.form();
    const p = this.photo();
    const t = (s: string) => s.trim() || undefined;
    this.saving.set(true);
    this.error.set('');
    this.api.staffRegisterComplaint({
      mobileNumber: normaliseMobile(f.mobile)!,
      fullName: t(f.fullName) ?? this.customer()?.customerName ?? undefined,
      email: t(f.email),
      subject: f.subject.trim(),
      category: t(f.category),
      brandName: t(f.brandName),
      modelNumber: t(f.modelNumber),
      description: t(f.description),
      locationName: t(f.locationName),
      imageBase64: p?.base64, imageName: p?.name, contentType: p?.type,
    }).subscribe({
      next: (r: any) => {
        this.saving.set(false);
        if (r?.success === false) { this.error.set(r?.message || 'The complaint could not be registered'); return; }
        this.done.set(r?.data?.complaintNumber ?? r?.data?.ComplaintNumber ?? 'Registered');
      },
      error: (err: any) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'The complaint could not be registered. Try again');
      },
    });
  }

  another(): void {
    this.form.set({ ...EMPTY });
    this.customer.set(null);
    this.lookedUp = '';
    this.lookingUp.set(false);
    this.photo.set(null);
    this.error.set('');
    this.done.set(null);
  }
}
