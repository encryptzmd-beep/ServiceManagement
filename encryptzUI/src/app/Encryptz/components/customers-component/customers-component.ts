import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';
import {
  CustomerImportResult, CustomerImportRow, CustomerListItem, CustomerMatch, INDIAN_STATES, SalesCustomerSave,
} from '../../Models/ApiModels';
import { AppToastComponent } from '../app-toast-component/app-toast-component';
import { AppRightDirective } from '../shared/app-right/app-right';
import { ModuleRefusedComponent, isModuleRefusal } from '../shared/module-refused';
import { CustomerMatchWarningComponent } from '../shared/customer-match/customer-match-warning';
import { downloadCustomerTemplate, readCustomersExcel } from './customer-excel';

const blankForm = (): SalesCustomerSave => ({
  customerId: 0, customerName: '', mobileNumber: '', alternatePhone: '', email: '', address: '', city: '', state: '',
  pinCode: '', landmark: '', gstin: '',
} as SalesCustomerSave);

/**
 * Customers: the one customer master (party) shared by CRM quotations, Sales orders, repeat supplies and Service.
 * One record per party (same mobile or same GSTIN); a new customer that is already there is pointed out, and a
 * bulk upload updates the customers it matches with the file's values.
 */
@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [DatePipe, FormsModule, AppToastComponent, AppRightDirective, ModuleRefusedComponent, CustomerMatchWarningComponent],
  templateUrl: './customers-component.html',
  styleUrl: './customers-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomersComponent implements OnInit {
  private api = inject(ApiService);
  private destroyRef = inject(DestroyRef);
  readonly states = INDIAN_STATES;

  // ── list ──
  customers = signal<CustomerListItem[]>([]);
  totalCount = signal(0);
  totalPages = signal(1);
  loading = signal(false);
  refused = signal(false);
  search = '';
  page = 1;
  readonly pageSize = 25;

  // ── new / edit ──
  formOpen = signal(false);
  form = signal<SalesCustomerSave>(blankForm());
  formError = signal('');
  saving = signal(false);

  // ── bulk upload ──
  uploadOpen = signal(false);
  fileName = signal('');
  fileProblem = signal('');
  rows = signal<CustomerImportRow[]>([]);
  checking = signal(false);
  importing = signal(false);
  result = signal<CustomerImportResult | null>(null);
  /** Only rows that would change something can be imported. */
  readonly canImport = computed(() => {
    const r = this.result();
    return !!r && !r.applied && r.newCount + r.updateCount > 0;
  });

  toast = signal<{ type: 'success' | 'error'; text: string } | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.listCustomers(this.search.trim() || undefined, this.page, this.pageSize)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: r => {
          this.loading.set(false);
          const d = r?.data;
          this.customers.set(d?.items ?? []);
          this.totalCount.set(d?.totalCount ?? 0);
          this.totalPages.set(Math.max(1, d?.totalPages ?? 1));
        },
        error: e => { this.loading.set(false); this.refused.set(isModuleRefusal(e)); this.customers.set([]); },
      });
  }

  find(): void { this.page = 1; this.load(); }
  prev(): void { if (this.page > 1) { this.page--; this.load(); } }
  next(): void { if (this.page < this.totalPages()) { this.page++; this.load(); } }

  // ── new / edit ──
  newCustomer(): void { this.form.set(blankForm()); this.formError.set(''); this.formOpen.set(true); }

  edit(c: CustomerListItem): void {
    this.form.set({
      customerId: c.customerId, customerName: c.customerName, mobileNumber: c.mobileNumber, alternatePhone: c.alternatePhone ?? '',
      email: c.email ?? '', address: c.address ?? '', city: c.city ?? '', state: c.state ?? '', pinCode: c.pinCode ?? '',
      landmark: c.landmark ?? '', gstin: c.gstin ?? '',
    } as SalesCustomerSave);
    this.formError.set('');
    this.formOpen.set(true);
  }

  set<K extends keyof SalesCustomerSave>(key: K, value: SalesCustomerSave[K]): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  /** The warning offered an existing customer: open that one instead of making a second record. */
  useExisting(m: CustomerMatch): void {
    this.edit({ ...m, totalOrders: 0, totalComplaints: 0, totalCount: 0 });
    this.toast.set({ type: 'success', text: `Opened the existing customer ${m.customerName}` });
  }

  save(): void {
    const f = this.form();
    if (!f.customerName?.trim()) { this.formError.set('Enter the customer name'); return; }
    if ((f.mobileNumber ?? '').replace(/\D/g, '').length < 10) { this.formError.set('Enter a valid 10-digit mobile number'); return; }
    this.saving.set(true);
    this.formError.set('');
    this.api.saveSalesCustomer({ ...f, gstin: (f.gstin ?? '').replace(/\s/g, '').toUpperCase() || null } as SalesCustomerSave)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: r => {
          this.saving.set(false);
          if (!r?.success) { this.formError.set(r?.message || 'The customer could not be saved'); return; }
          // a new customer that matched an existing party was saved into that one
          const text = !f.customerId && !r.data?.isNew ? 'This customer was already there: its details were updated' : (r.message || 'Customer saved');
          this.toast.set({ type: 'success', text });
          this.formOpen.set(false);
          this.load();
        },
        error: e => { this.saving.set(false); this.formError.set(e?.error?.message || 'The customer could not be saved'); },
      });
  }

  // ── bulk upload ──
  openUpload(): void {
    this.uploadOpen.set(true);
    this.fileName.set(''); this.fileProblem.set(''); this.rows.set([]); this.result.set(null);
  }

  template(): void { downloadCustomerTemplate(); }

  async onFile(event: Event): Promise<void> {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0];
    field.value = '';
    if (!file) return;
    this.result.set(null);
    this.fileName.set(file.name);
    if (!file.name.toLowerCase().endsWith('.xlsx')) { this.fileProblem.set('Use an .xlsx file (Excel). Save a CSV as Excel first'); return; }
    const read = await readCustomersExcel(file);
    this.fileProblem.set(read.problem);
    this.rows.set(read.rows);
    if (!read.problem) this.check(false);
  }

  /** apply=false: what each row would do; apply=true: save them. */
  check(apply: boolean): void {
    const busy = apply ? this.importing : this.checking;
    busy.set(true);
    this.api.importCustomers(this.rows(), apply).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        busy.set(false);
        if (!r?.success || !r.data) { this.fileProblem.set(r?.message || 'The file could not be checked'); return; }
        this.result.set(r.data);
        if (apply) { this.toast.set({ type: 'success', text: r.message || 'Customers imported' }); this.load(); }
      },
      error: e => { busy.set(false); this.fileProblem.set(e?.error?.message || 'The file could not be checked'); },
    });
  }
}
